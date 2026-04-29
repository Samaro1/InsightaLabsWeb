/**
 * utils.js — Insighta portal
 *
 * Shared API client with silent token refresh.
 *
 * Token architecture (web portal):
 *   - access_token  → HTTP-only cookie, 3-min TTL
 *   - refresh_token → HTTP-only cookie, 5-min TTL
 *
 * Both cookies are sent automatically by the browser on every
 * same-origin request. JS cannot read them via document.cookie.
 *
 * Silent refresh strategy:
 *   1. PROACTIVE — a timer fires at 2m 30s after page load to refresh
 *      before the access token actually expires.
 *   2. REACTIVE  — any 401 response triggers one refresh attempt.
 *      Concurrent requests that 401 during the refresh are queued and
 *      replayed once the new token is set (no thundering herd).
 *   3. FALLBACK  — if refresh itself fails (both tokens expired /
 *      revoked), clear state and redirect to login.
 *
 * Backend requirement:
 *   POST /auth/refresh must accept the refresh_token from either
 *   the JSON body OR the "refresh_token" HTTP-only cookie so the
 *   browser-based flow works without JS reading the cookie value.
 *   If your backend currently only reads from the body, add cookie
 *   fallback:
 *
 *     refresh_token = body.get("refresh_token") or request.cookies.get("refresh_token")
 */

// ─── Refresh state ────────────────────────────────────────────
let _isRefreshing   = false;   // true while a refresh request is in-flight
let _refreshPromise = null;    // the in-flight refresh Promise (shared by all waiters)
let _proactiveTimer = null;    // setTimeout handle for proactive refresh

// How long before expiry to proactively refresh (ms).
// Access token TTL = 3 min = 180 000 ms. Refresh at 2m 30s = 150 000 ms.
const PROACTIVE_REFRESH_MS = 150_000;

// ─── Proactive refresh timer ──────────────────────────────────
/**
 * Schedule a proactive token refresh PROACTIVE_REFRESH_MS from now.
 * Call this once on page load and again after each successful refresh.
 */
function scheduleProactiveRefresh() {
  clearTimeout(_proactiveTimer);
  _proactiveTimer = setTimeout(async () => {
    try {
      await _doRefresh();
      // Reschedule for the next cycle after a successful refresh
      scheduleProactiveRefresh();
    } catch {
      // Refresh failed — redirect handled inside _doRefresh
    }
  }, PROACTIVE_REFRESH_MS);
}

// ─── Core refresh logic ───────────────────────────────────────
/**
 * Perform one refresh cycle. Deduplicates concurrent calls —
 * if a refresh is already in-flight every caller awaits the same promise.
 *
 * POST /auth/refresh with an empty JSON body so the browser sends
 * the refresh_token HTTP-only cookie automatically. The backend should
 * read from cookies when the body field is absent.
 *
 * @returns {Promise<void>} resolves on success, rejects on failure
 */
async function _doRefresh() {
  if (_isRefreshing) {
    // Already refreshing — join the existing promise instead of making
    // a second request.
    return _refreshPromise;
  }

  _isRefreshing   = true;
  _refreshPromise = (async () => {
    try {
      const response = await fetch(`${CONFIG.API_BASE}/auth/refresh`, {
        method:      'POST',
        credentials: 'include',          // sends refresh_token cookie
        headers:     CONFIG.getHeaders(),
        // Empty body — backend must fall back to reading the cookie.
        // If your backend requires the body field, change this to:
        //   body: JSON.stringify({ refresh_token: null })
        // and update the backend to also check cookies.
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      // New access_token + refresh_token cookies are set by the backend
      // in Set-Cookie headers on this response. Nothing more to do here.
    } catch (err) {
      // Refresh failed — both tokens are likely expired/revoked.
      _redirectToLogin();
      throw err;
    } finally {
      _isRefreshing   = false;
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ─── Login redirect ───────────────────────────────────────────
function _redirectToLogin() {
  clearTimeout(_proactiveTimer);
  // Only redirect if not already on the login page
  if (!window.location.pathname.endsWith('index.html') &&
      window.location.pathname !== '/') {
    window.location.href = '/index.html';
  }
}

/**
 * apiRequest — Make an authenticated API request with automatic token refresh
 *
 * On 401, attempts one silent refresh then replays the original request.
 * On second 401 (refresh succeeded but token still rejected), redirects to login.
 *
 * Automatically includes:
 *   - X-API-Version header
 *   - X-CSRF-Token header (from localStorage for POST/DELETE)
 *   - HTTP-only cookies (access_token, refresh_token)
 *
 * @param {string} path    - API path, e.g. "/api/profiles"
 * @param {object} options - fetch options (method, body, headers, …)
 * @param {boolean} _isRetry - internal flag; do not pass from call sites
 * @returns {Promise<object>} parsed JSON response body
 */
async function apiRequest(path, options = {}, _isRetry = false) {
  // Determine if this is a state-changing request that needs CSRF
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  const method = (options.method || 'GET').toUpperCase();
  const needsCSRF = stateChangingMethods.includes(method);

  const response = await fetch(`${CONFIG.API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      ...CONFIG.getHeaders(needsCSRF),
      ...options.headers,
    },
    ...options,
  });

  // ── Success path ──────────────────────────────────────────
  if (response.ok) {
    // 204 No Content (e.g. DELETE) — nothing to parse
    if (response.status === 204) return null;
    return response.json();
  }

  // ── Silent refresh on 401 ─────────────────────────────────
  if (response.status === 401 && !_isRetry) {
    try {
      await _doRefresh();
    } catch {
      // _doRefresh already redirected; stop here
      return null;
    }

    // Replay the original request with the fresh cookie
    return apiRequest(path, options, true /* _isRetry */);
  }

  // ── Hard 401 after retry → login ─────────────────────────
  if (response.status === 401 && _isRetry) {
    _redirectToLogin();
    return null;
  }

  // ── CSRF token expired ──────────────────────────────────
  if (response.status === 403) {
    const errorBody = await response.json().catch(() => ({}));
    if (errorBody.message && errorBody.message.includes('CSRF')) {
      // Clear stale CSRF token and redirect to login
      localStorage.removeItem(CONFIG.CSRF_STORAGE_KEY);
      _redirectToLogin();
      throw new Error(CONFIG.ERRORS.CSRF_ERROR);
    }
  }

  // ── Other error statuses ──────────────────────────────────
  const errorBody = await response.json().catch(() => ({}));
  throw new Error(
    errorBody.message ||
    CONFIG.ERRORS.SERVER_ERROR
  );
}

// ─── Auth helpers ─────────────────────────────────────────────
/**
 * Fetch the current user from /auth/me.
 * Returns the user object or redirects to login on failure.
 */
async function checkAuth() {
  try {
    const response = await apiRequest('/auth/me');
    return response?.data || response || null;
  } catch {
    _redirectToLogin();
    return null;
  }
}

/**
 * Revoke the refresh token server-side and redirect to login.
 */
async function logout() {
  clearTimeout(_proactiveTimer);
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Swallow — we're logging out regardless
  } finally {
    _redirectToLogin();
  }
}

// ─── Navbar ───────────────────────────────────────────────────
async function loadNavbar() {
  try {
    const response = await fetch('/components/navbar.html');
    const html     = await response.text();
    const container = document.getElementById('navbar');
    if (container) container.innerHTML = html;
  } catch (err) {
    console.error('Error loading navbar:', err);
  }
}

/**
 * Standard page init: load navbar, verify auth, start proactive refresh.
 * @returns {Promise<object|null>} authenticated user object
 */
async function initPage() {
  await loadNavbar();
  const user = await checkAuth();
  if (user) {
    // Start proactive refresh cycle for this page session
    scheduleProactiveRefresh();
  }
  return user;
}

// ─── UI helpers ───────────────────────────────────────────────
function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

function formatUUID(uuid) {
  return uuid ? uuid.slice(0, 8) : '—';
}

function showLoading(elementId, message = 'Loading…') {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (el.tagName === 'TABLE') {
    const cols = el.querySelectorAll('thead th').length || 1;
    el.querySelector('tbody').innerHTML =
      `<tr><td colspan="${cols}" class="loading">${message}</td></tr>`;
  } else {
    el.innerHTML = `<p class="loading">${message}</p>`;
  }
}

function showError(elementId, message = CONFIG.ERRORS.SERVER_ERROR) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (el.tagName === 'TABLE') {
    const cols = el.querySelectorAll('thead th').length || 1;
    el.querySelector('tbody').innerHTML =
      `<tr><td colspan="${cols}" class="error">${message}</td></tr>`;
  } else {
    el.innerHTML = `<p class="error">${message}</p>`;
  }
}

/**
 * Build URLSearchParams from an object, dropping empty/null/undefined values.
 */
function buildParams(params) {
  const filtered = Object.entries(params)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
  return new URLSearchParams(filtered);
}

// ─── Exports (Node/CommonJS compat for any tooling) ───────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    apiRequest,
    checkAuth,
    logout,
    initPage,
    loadNavbar,
    scheduleProactiveRefresh,
    formatDate,
    formatUUID,
    showLoading,
    showError,
    buildParams,
  };
}