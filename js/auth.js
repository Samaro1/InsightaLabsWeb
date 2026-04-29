/**
 * Auth utilities for Insighta portal
 * Handles authentication checks, CSRF tokens, and role-based features
 */

// ─── Role checking utilities ─────────────────────────────────
/**
 * Check if current user has admin role.
 * Used for conditional UI rendering.
 */
async function isAdmin() {
  const user = await checkAuth();
  return user?.role === 'admin';
}

/**
 * Check if current user has a specific role.
 * @param {string} requiredRole - e.g. 'admin', 'analyst'
 */
async function hasRole(requiredRole) {
  const user = await checkAuth();
  return user?.role === requiredRole;
}

/**
 * Show/hide admin-only elements based on user role.
 * Call after page loads and auth is confirmed.
 */
async function updateAdminElements() {
  const admin = await isAdmin();
  
  // Hide all admin-only elements
  document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.style.display = admin ? '' : 'none';
  });

  // Hide all analyst-only elements if user is admin
  if (!admin) {
    document.querySelectorAll('[data-analyst-only]').forEach(el => {
      el.style.display = '' ;
    });
  } else {
    document.querySelectorAll('[data-analyst-only]').forEach(el => {
      el.style.display = 'none';
    });
  }
}

/**
 * Store CSRF token from login/refresh response.
 * Backend should include X-CSRF-Token in response headers or body.
 */
function storeCSRFToken(response) {
  // Try to get CSRF token from response headers
  const csrfFromHeader = response.headers?.get?.('X-CSRF-Token');
  if (csrfFromHeader) {
    localStorage.setItem(CONFIG.CSRF_STORAGE_KEY, csrfFromHeader);
    return;
  }

  // Try to get from response body
  if (response.csrf_token) {
    localStorage.setItem(CONFIG.CSRF_STORAGE_KEY, response.csrf_token);
    return;
  }
}

/**
 * Clear CSRF token (on logout).
 */
function clearCSRFToken() {
  localStorage.removeItem(CONFIG.CSRF_STORAGE_KEY);
}

// ─── Enhanced initPage ──────────────────────────────────────
/**
 * Standard page init with role-based UI updates.
 *   1. Load navbar
 *   2. Verify authentication
 *   3. Show/hide admin-only elements
 *   4. Start proactive token refresh
 *   5. Dispatch auth-ready event
 *
 * @returns {Promise<object|null>} authenticated user object
 */
async function initPage() {
  await loadNavbar();
  const user = await checkAuth();
  
  if (user) {
    // Update UI based on role
    await updateAdminElements();
    
    // Start proactive refresh cycle
    scheduleProactiveRefresh();
    
    // Dispatch custom event for page-specific listeners
    document.dispatchEvent(new CustomEvent('auth-ready', { detail: user }));
  }
  
  return user;
}

// ─── Enhanced logout with CSRF cleanup ──────────────────────
/**
 * Revoke the refresh token server-side and redirect to login.
 * Also clears CSRF token from localStorage.
 */
async function enhancedLogout() {
  clearTimeout(_proactiveTimer);
  clearCSRFToken();
  
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    // Swallow — we're logging out regardless
  } finally {
    _redirectToLogin();
  }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', async () => {
  const user = await initPage();
  
  // If page needs user data, dispatch custom event
  if (user) {
    document.dispatchEvent(new CustomEvent('auth-ready', { detail: user }));
  }
});
