// CampusHub Common UI Components & Navigation Renderer

let twoFactorSetupChallengeId = null;

document.addEventListener('DOMContentLoaded', () => {
  const user = Auth.getUser();
  if (user) {
    renderSidebar(user);
    renderNavbar(user);
    setupProfileModal(user);
    setupMobileSidebarBackdrop();
  }
  makeTablesResponsive();
});

// Render Role-Based Sidebar Navigation Links
function renderSidebar(user) {
  const sidebarContainer = document.getElementById('sidebar-navigation');
  if (!sidebarContainer) return;

  // Setup mobile close button in sidebar header if missing
  const sidebarHeader = document.querySelector('.sidebar-header');
  if (sidebarHeader && !document.getElementById('sidebar-close-btn')) {
    const closeBtn = document.createElement('button');
    closeBtn.id = 'sidebar-close-btn';
    closeBtn.className = 'sidebar-close-btn';
    closeBtn.setAttribute('aria-label', 'Close sidebar menu');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = closeMobileSidebar;
    sidebarHeader.appendChild(closeBtn);
  }

  const currentPath = window.location.pathname;

  let menuItems = [];

  if (user.role === 'student') {
    menuItems = [
      { label: 'Dashboard', path: getAppPath('pages/student/dashboard.html'), icon: '📊' },
      { label: 'Academic Resources', path: getAppPath('pages/common/academic-resources.html'), icon: '📚' },
      { label: 'Notifications', path: getAppPath('pages/common/notifications.html'), icon: '🔔' },
      { label: 'Profile', path: '#profile', icon: '👤', isModal: true },
      { label: 'Leave Requests', path: getAppPath('pages/student/dashboard.html#leaves'), icon: '📝' },
      { label: 'Campus Issues', path: getAppPath('pages/student/dashboard.html#issues'), icon: '🔧' },
      { label: 'Complaints', path: getAppPath('pages/student/dashboard.html#complaints'), icon: '💬' },
      { label: 'Documents', path: getAppPath('pages/student/dashboard.html#documents'), icon: '📜' },
      { label: 'Events', path: getAppPath('pages/student/dashboard.html#events'), icon: '📅' },
      { label: 'Announcements', path: getAppPath('pages/student/dashboard.html#announcements'), icon: '📢' }
    ];
  } else if (user.role === 'faculty') {
    menuItems = [
      { label: 'Dashboard', path: getAppPath('pages/faculty/dashboard.html'), icon: '📊' },
      { label: 'Academic Resources', path: getAppPath('pages/common/academic-resources.html'), icon: '📚' },
      { label: 'Analytics', path: getAppPath('pages/faculty/analytics.html'), icon: '📈' },
      { label: 'Notifications', path: getAppPath('pages/common/notifications.html'), icon: '🔔' },
      { label: 'Profile', path: '#profile', icon: '👤', isModal: true },
      { label: 'Leave Requests', path: getAppPath('pages/faculty/dashboard.html#leaves'), icon: '📝' },
      { label: 'Assigned Issues', path: getAppPath('pages/faculty/dashboard.html#issues'), icon: '🔧' },
      { label: 'Complaints', path: getAppPath('pages/faculty/dashboard.html#complaints'), icon: '💬' },
      { label: 'Events', path: getAppPath('pages/faculty/dashboard.html#events'), icon: '📅' },
      { label: 'Announcements', path: getAppPath('pages/faculty/dashboard.html#announcements'), icon: '📢' }
    ];
  } else if (user.role === 'admin') {
    menuItems = [
      { label: 'Dashboard', path: getAppPath('pages/admin/dashboard.html'), icon: '📊' },
      { label: 'Academic Resources', path: getAppPath('pages/common/academic-resources.html'), icon: '📚' },
      { label: 'Analytics', path: getAppPath('pages/admin/analytics.html'), icon: '📈' },
      { label: 'Activity Logs', path: getAppPath('pages/admin/activity-logs.html'), icon: '📜' },
      { label: 'Notifications', path: getAppPath('pages/common/notifications.html'), icon: '🔔' },
      { label: 'Profile', path: '#profile', icon: '👤', isModal: true },
      { label: 'Users', path: getAppPath('pages/admin/dashboard.html#users'), icon: '👥' },
      { label: 'Departments', path: getAppPath('pages/admin/dashboard.html#departments'), icon: '🏛️' },
      { label: 'Leaves', path: getAppPath('pages/admin/dashboard.html#leaves'), icon: '📝' },
      { label: 'Campus Issues', path: getAppPath('pages/admin/dashboard.html#issues'), icon: '🔧' },
      { label: 'Complaints', path: getAppPath('pages/admin/dashboard.html#complaints'), icon: '💬' },
      { label: 'Documents', path: getAppPath('pages/admin/dashboard.html#documents'), icon: '📜' },
      { label: 'Events', path: getAppPath('pages/admin/dashboard.html#events'), icon: '📅' },
      { label: 'Announcements', path: getAppPath('pages/admin/dashboard.html#announcements'), icon: '📢' }
    ];
  }

  let html = `<div class="menu-category">${user.role} Navigation</div>`;
  menuItems.forEach((item) => {
    const isActive = currentPath === item.path ? 'active' : '';
    const clickHandler = item.isModal
      ? `onclick="openProfileModal(); closeMobileSidebar(); return false;"`
      : `onclick="closeMobileSidebar();"`;
    html += `
      <a href="${item.path}" class="nav-link ${isActive}" ${clickHandler}>
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </a>
    `;
  });

  sidebarContainer.innerHTML = html;
}

// Render Navbar Header User Profile Pill & Mobile Hamburger Toggle
function renderNavbar(user) {
  const navbarLeft = document.querySelector('.navbar-left');
  if (navbarLeft && !document.getElementById('mobile-menu-toggle')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'mobile-menu-toggle';
    toggleBtn.className = 'mobile-menu-btn';
    toggleBtn.setAttribute('aria-label', 'Toggle navigation menu');
    toggleBtn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      toggleMobileSidebar();
    };
    navbarLeft.prepend(toggleBtn);
  }

  const userNameEl = document.getElementById('nav-user-name');
  const userRoleEl = document.getElementById('nav-user-role');
  const userAvatarEl = document.getElementById('nav-user-avatar');

  if (userNameEl) userNameEl.textContent = user.name;
  if (userRoleEl) userRoleEl.textContent = user.role.toUpperCase();
  if (userAvatarEl) userAvatarEl.textContent = user.name.charAt(0).toUpperCase();

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => Auth.logout());
  }
}

// Setup Mobile Sidebar Backdrop Overlay
function setupMobileSidebarBackdrop() {
  if (!document.getElementById('sidebar-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.id = 'sidebar-backdrop';
    backdrop.className = 'sidebar-backdrop';
    backdrop.onclick = closeMobileSidebar;
    document.body.appendChild(backdrop);
  }
}

function toggleMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.toggle('active');
  if (backdrop) backdrop.classList.toggle('active');
}

function closeMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}

// Automatically wrap table elements in .table-responsive for mobile scrolling
function makeTablesResponsive() {
  document.querySelectorAll('table').forEach(table => {
    if (!table.parentElement.classList.contains('table-responsive')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-responsive';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  });
}

// Setup Reusable User Profile Modal
function setupProfileModal(user) {
  const modalHTML = `
    <div id="profile-modal" class="modal-overlay">
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">User Profile Details</h3>
          <button class="modal-close" onclick="closeProfileModal()">&times;</button>
        </div>
        <div style="text-align: center; margin-bottom: 20px;">
          <div class="user-avatar" style="width: 64px; height: 64px; margin: 0 auto 12px auto; font-size: 1.5rem;">
            ${user.name.charAt(0).toUpperCase()}
          </div>
          <h4 style="margin-bottom: 4px; font-size: 1.2rem; color: #f8fafc;">${user.name}</h4>
          <span class="badge badge-success">${user.role.toUpperCase()}</span>
        </div>
        <div class="status-item" style="margin-bottom: 12px;">
          <div class="status-label">Email Address</div>
          <div class="status-value">${user.email}</div>
        </div>
        <div class="status-item" style="margin-bottom: 12px;">
          <div class="status-label">Department</div>
          <div class="status-value">${user.departmentId ? (user.departmentId.name || user.departmentId) : 'System Administrator'}</div>
        </div>
        <div class="status-item" style="margin-bottom: 20px;">
          <div class="status-label">Account Status</div>
          <div class="status-value"><span class="badge badge-success">${user.status || 'ACTIVE'}</span></div>
        </div>
        <div class="status-item" style="margin-bottom: 16px;">
          <div class="status-label">Email two-step sign-in</div>
          <div class="status-value" id="two-factor-status">${user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</div>
        </div>
        <div id="two-factor-settings" style="margin-bottom:20px;">
          <div id="two-factor-enable-controls" style="display:${user.twoFactorEnabled ? 'none' : 'block'};">
            <label class="form-label" for="two-factor-current-password">Confirm password to enable</label>
            <input class="form-input" type="password" id="two-factor-current-password" autocomplete="current-password">
            <button class="btn" type="button" style="margin-top:8px;" onclick="beginTwoFactorSetup()">Send confirmation code</button>
            <div id="two-factor-confirm-controls" style="display:none; margin-top:12px;">
              <label class="form-label" for="two-factor-code">Email confirmation code</label>
              <input class="form-input" id="two-factor-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6">
              <button class="btn" type="button" style="margin-top:8px;" onclick="confirmTwoFactorSetup()">Enable two-step sign-in</button>
            </div>
          </div>
          <div id="two-factor-disable-controls" style="display:${user.twoFactorEnabled ? 'block' : 'none'};">
            <label class="form-label" for="two-factor-disable-password">Confirm password to disable</label>
            <input class="form-input" type="password" id="two-factor-disable-password" autocomplete="current-password">
            <button class="btn" type="button" style="margin-top:8px; background:rgba(239,68,68,0.18); color:#f87171;" onclick="disableTwoFactor()">Disable two-step sign-in</button>
          </div>
          <div id="two-factor-alert" class="alert-box alert-danger" style="margin-top:10px; margin-bottom:0;"></div>
        </div>
        <button class="btn" style="background: rgba(239, 68, 68, 0.2); color: #f87171;" onclick="Auth.logout()">
          Sign Out of Account
        </button>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHTML;
  document.body.appendChild(container.firstElementChild);
}

function openProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.add('active');
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.remove('active');
}

async function beginTwoFactorSetup() {
  const alertBox = document.getElementById('two-factor-alert');
  const response = await apiFetch('/auth/two-factor/setup', {
    method: 'POST',
    body: JSON.stringify({ password: document.getElementById('two-factor-current-password').value })
  });
  if (!response?.ok || !response.data.success) {
    showTwoFactorAlert(response?.data?.message || 'Could not send a confirmation code.', false);
    return;
  }
  twoFactorSetupChallengeId = response.data.data.challengeId;
  document.getElementById('two-factor-current-password').value = '';
  document.getElementById('two-factor-confirm-controls').style.display = 'block';
  showTwoFactorAlert(response.data.message, true);
}

async function confirmTwoFactorSetup() {
  const response = await apiFetch('/auth/two-factor/enable', {
    method: 'POST',
    body: JSON.stringify({
      challengeId: twoFactorSetupChallengeId,
      code: document.getElementById('two-factor-code').value.trim()
    })
  });
  if (!response?.ok || !response.data.success) {
    showTwoFactorAlert(response?.data?.message || 'Could not enable two-step sign-in.', false);
    return;
  }

  const user = Auth.getUser();
  user.twoFactorEnabled = true;
  localStorage.setItem('campushub_user', JSON.stringify(user));
  document.getElementById('two-factor-status').textContent = 'Enabled';
  document.getElementById('two-factor-enable-controls').style.display = 'none';
  document.getElementById('two-factor-disable-controls').style.display = 'block';
  document.getElementById('two-factor-code').value = '';
  showTwoFactorAlert(response.data.message, true);
}

async function disableTwoFactor() {
  const response = await apiFetch('/auth/two-factor/disable', {
    method: 'POST',
    body: JSON.stringify({ password: document.getElementById('two-factor-disable-password').value })
  });
  if (!response?.ok || !response.data.success) {
    showTwoFactorAlert(response?.data?.message || 'Could not disable two-step sign-in.', false);
    return;
  }

  const user = Auth.getUser();
  user.twoFactorEnabled = false;
  localStorage.setItem('campushub_user', JSON.stringify(user));
  document.getElementById('two-factor-status').textContent = 'Disabled';
  document.getElementById('two-factor-disable-controls').style.display = 'none';
  document.getElementById('two-factor-enable-controls').style.display = 'block';
  document.getElementById('two-factor-confirm-controls').style.display = 'none';
  document.getElementById('two-factor-disable-password').value = '';
  showTwoFactorAlert(response.data.message, true);
}

function showTwoFactorAlert(message, success) {
  const alertBox = document.getElementById('two-factor-alert');
  alertBox.textContent = message;
  alertBox.className = `alert-box ${success ? 'alert-success' : 'alert-danger'}`;
  alertBox.style.display = 'block';
}
