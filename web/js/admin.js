/**
 * Admin Panel JavaScript
 * Handles user creation, deletion, and management
 */

let currentDeleteUserId = null;

// ─── Initialize page ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const user = await initPage();

  // Verify admin access
  if (!user || user.role !== 'admin') {
    window.location.href = '/dashboard.html';
    return;
  }

  // Update admin UI
  await updateAdminElements();

  // Load initial data
  await loadUsers();
  await loadSystemInfo();

  // Setup event listeners
  setupEventListeners();

  // Refresh data every 30 seconds
  setInterval(loadUsers, 30_000);
  setInterval(loadSystemInfo, 60_000);
});

// ─── Setup Event Listeners ──────────────────────────────────
function setupEventListeners() {
  const createUserForm = document.getElementById('createUserForm');
  const searchInput = document.getElementById('searchUsers');
  const deleteModal = document.getElementById('deleteModal');
  const deleteCancel = document.getElementById('deleteCancel');
  const deleteConfirm = document.getElementById('deleteConfirm');

  createUserForm.addEventListener('submit', handleCreateUser);
  searchInput.addEventListener('input', handleSearchUsers);
  deleteCancel.addEventListener('click', closeDeleteModal);
  deleteConfirm.addEventListener('click', confirmDeleteUser);

  // Close modal on outside click
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
      closeDeleteModal();
    }
  });
}

// ─── Create User ────────────────────────────────────────────
async function handleCreateUser(e) {
  e.preventDefault();

  const form = e.target;
  const statusEl = document.getElementById('createUserStatus');

  // Reset status
  statusEl.className = 'form-status';
  statusEl.textContent = '';

  try {
    const formData = new FormData(form);
    const userData = {
      email: formData.get('email'),
      first_name: formData.get('first_name'),
      last_name: formData.get('last_name'),
      role: formData.get('role'),
    };

    // Validate
    if (!userData.email || !userData.first_name || !userData.last_name) {
      throw new Error('All fields are required');
    }

    // Call API to create user
    const response = await apiRequest('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    if (!response) {
      throw new Error('Server error');
    }

    // Success
    statusEl.className = 'form-status success';
    statusEl.textContent = `✓ User ${userData.email} created successfully`;

    // Reset form
    form.reset();

    // Reload users table
    setTimeout(() => {
      loadUsers();
      loadSystemInfo();
    }, 1000);

  } catch (error) {
    statusEl.className = 'form-status error';
    statusEl.textContent = `✗ ${error.message || 'Failed to create user'}`;
    console.error('Error creating user:', error);
  }
}

// ─── Load Users ─────────────────────────────────────────────
async function loadUsers() {
  try {
    const response = await apiRequest('/api/users');

    if (!response || !response.data) {
      console.warn('No user data returned');
      return;
    }

    const users = response.data;
    const tbody = document.querySelector('#usersTable tbody');
    const emptyState = document.getElementById('usersEmptyState');

    if (users.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    // Build rows
    tbody.innerHTML = users.map(user => `
      <tr data-user-id="${user.id}">
        <td>${escapeHtml(user.email)}</td>
        <td>${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</td>
        <td><span class="user-role ${user.role}">${user.role}</span></td>
        <td>${formatDate(user.created_at)}</td>
        <td>
          <span class="user-status ${user.status || 'active'}">
            <span class="status-dot"></span>
            ${user.status || 'active'}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-action btn-edit" onclick="editUser('${user.id}')">Edit</button>
            <button class="btn-action btn-delete" onclick="openDeleteModal('${user.id}', '${escapeHtml(user.email)}')">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Error loading users:', error);
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="6" class="loading">Error loading users</td></tr>';
  }
}

// ─── Search Users ───────────────────────────────────────────
function handleSearchUsers(e) {
  const query = e.target.value.toLowerCase();
  const rows = document.querySelectorAll('#usersTable tbody tr[data-user-id]');

  rows.forEach(row => {
    const email = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
    const name = row.querySelector('td:nth-child(2)').textContent.toLowerCase();

    const matches = email.includes(query) || name.includes(query);
    row.style.display = matches ? '' : 'none';
  });

  // Show/hide empty state
  const visibleRows = Array.from(rows).filter(r => r.style.display !== 'none');
  document.getElementById('usersEmptyState').style.display = 
    visibleRows.length === 0 ? 'block' : 'none';
}

// ─── Delete User Modal ──────────────────────────────────────
function openDeleteModal(userId, userEmail) {
  currentDeleteUserId = userId;
  const modal = document.getElementById('deleteModal');
  const message = document.getElementById('deleteModalMessage');
  message.textContent = `Are you sure you want to delete ${userEmail}? This action cannot be undone.`;
  modal.classList.add('active');
}

function closeDeleteModal() {
  const modal = document.getElementById('deleteModal');
  modal.classList.remove('active');
  currentDeleteUserId = null;
}

async function confirmDeleteUser() {
  if (!currentDeleteUserId) return;

  const deleteBtn = document.getElementById('deleteConfirm');
  const originalText = deleteBtn.textContent;
  deleteBtn.textContent = 'Deleting…';
  deleteBtn.disabled = true;

  try {
    await apiRequest(`/api/users/${currentDeleteUserId}`, {
      method: 'DELETE',
    });

    // Success
    closeDeleteModal();
    await loadUsers();
    await loadSystemInfo();

  } catch (error) {
    alert(`Failed to delete user: ${error.message}`);
    console.error('Error deleting user:', error);
  } finally {
    deleteBtn.textContent = originalText;
    deleteBtn.disabled = false;
  }
}

// Edit user placeholder (future: modal or redirect to edit page)
function editUser(userId) {
  alert('Edit functionality coming soon. User ID: ' + userId);
  // Future: implement edit modal or redirect to /admin-edit.html?id=userId
}

// ─── Load System Info ───────────────────────────────────────
async function loadSystemInfo() {
  try {
    const response = await apiRequest('/api/admin/stats');

    if (!response || !response.data) {
      console.warn('No stats data returned');
      return;
    }

    const stats = response.data;

    document.getElementById('totalUsers').textContent = stats.total_users || '0';
    document.getElementById('adminCount').textContent = stats.admin_count || '0';
    document.getElementById('analystCount').textContent = stats.analyst_count || '0';
    document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();

  } catch (error) {
    console.error('Error loading system info:', error);
  }
}

// ─── Utilities ──────────────────────────────────────────────
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}
