// CampusHub Common UI Components & Navigation Renderer

document.addEventListener('DOMContentLoaded', () => {
  const user = Auth.getUser();
  if (user) {
    renderSidebar(user);
    renderNavbar(user);
    setupProfileModal(user);
  }
});

// Render Role-Based Sidebar Navigation Links
function renderSidebar(user) {
  const sidebarContainer = document.getElementById('sidebar-navigation');
  if (!sidebarContainer) return;

  const currentPath = window.location.pathname;

  let menuItems = [];

  if (user.role === 'student') {
    menuItems = [
      { label: 'Dashboard', path: getAppPath('pages/student/dashboard.html'), icon: '📊' },
      { label: 'Profile', path: '#profile', icon: '👤', isModal: true },
      { label: 'Leave Requests', path: '#', icon: '📝' },
      { label: 'Campus Issues', path: '#', icon: '🔧' },
      { label: 'Complaints', path: '#', icon: '💬' },
      { label: 'Documents', path: '#', icon: '📜' },
      { label: 'Events', path: '#', icon: '📅' },
      { label: 'Announcements', path: '#', icon: '📢' },
      { label: 'Notifications', path: '#', icon: '🔔' }
    ];
  } else if (user.role === 'faculty') {
    menuItems = [
      { label: 'Dashboard', path: getAppPath('pages/faculty/dashboard.html'), icon: '📊' },
      { label: 'Profile', path: '#profile', icon: '👤', isModal: true },
      { label: 'Students', path: '#', icon: '🎓' },
      { label: 'Leave Requests', path: '#', icon: '📝' },
      { label: 'Assigned Issues', path: '#', icon: '🔧' },
      { label: 'Complaints', path: '#', icon: '💬' },
      { label: 'Events', path: '#', icon: '📅' },
      { label: 'Announcements', path: '#', icon: '📢' },
      { label: 'Notifications', path: '#', icon: '🔔' }
    ];
  } else if (user.role === 'admin') {
    menuItems = [
      { label: 'Dashboard', path: getAppPath('pages/admin/dashboard.html'), icon: '📊' },
      { label: 'Profile', path: '#profile', icon: '👤', isModal: true },
      { label: 'Users', path: '#', icon: '👥' },
      { label: 'Departments', path: '#', icon: '🏛️' },
      { label: 'Leaves', path: '#', icon: '📝' },
      { label: 'Campus Issues', path: '#', icon: '🔧' },
      { label: 'Complaints', path: '#', icon: '💬' },
      { label: 'Documents', path: '#', icon: '📜' },
      { label: 'Events', path: '#', icon: '📅' },
      { label: 'Announcements', path: '#', icon: '📢' },
      { label: 'Analytics', path: '#', icon: '📈' },
      { label: 'Activity Logs', path: '#', icon: '📜' }
    ];
  }

  let html = `<div class="menu-category">${user.role} Navigation</div>`;
  menuItems.forEach((item) => {
    const isActive = currentPath === item.path ? 'active' : '';
    const clickHandler = item.isModal ? `onclick="openProfileModal(); return false;"` : '';
    html += `
      <a href="${item.path}" class="nav-link ${isActive}" ${clickHandler}>
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </a>
    `;
  });

  sidebarContainer.innerHTML = html;
}

// Render Navbar Header User Profile Pill
function renderNavbar(user) {
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
