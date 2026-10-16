// CampusHub Phase 1 Frontend Handler

const API_BASE_URL = "https://campushub-backend-dak3.onrender.com/api";

document.addEventListener('DOMContentLoaded', () => {
  const checkBtn = document.getElementById('check-health-btn');
  if (checkBtn) {
    checkBtn.addEventListener('click', checkSystemHealth);
  }

  // Initial check on page load
  checkSystemHealth();
});

async function checkSystemHealth() {
  const serverBadge = document.getElementById('server-status');
  const dbBadge = document.getElementById('db-status');
  const deptCountEl = document.getElementById('dept-count');
  const userCountEl = document.getElementById('user-count');
  const timestampEl = document.getElementById('timestamp');
  const rawResponseEl = document.getElementById('raw-response');
  const indicator = document.getElementById('status-indicator');

  try {
    // Set UI to loading state
    serverBadge.className = 'badge badge-warning';
    serverBadge.textContent = 'CHECKING...';
    indicator.className = 'pulse-indicator';

    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();

    if (data.success) {
      // Server is Online
      serverBadge.className = 'badge badge-success';
      serverBadge.textContent = data.data.server.toUpperCase();

      // Database status badge
      if (data.data.database === 'connected') {
        dbBadge.className = 'badge badge-success';
        dbBadge.textContent = 'CONNECTED';
        indicator.className = 'pulse-indicator active';
      } else {
        dbBadge.className = 'badge badge-warning';
        dbBadge.textContent = data.data.database.toUpperCase();
        indicator.className = 'pulse-indicator';
      }

      if (deptCountEl) deptCountEl.textContent = data.data.departmentsCount ?? 0;
      if (userCountEl) userCountEl.textContent = data.data.usersCount ?? 0;

      timestampEl.textContent = new Date(data.data.timestamp).toLocaleTimeString();
      rawResponseEl.textContent = JSON.stringify(data, null, 2);
    } else {
      throw new Error(data.message || 'Health check failed');
    }
  } catch (error) {
    serverBadge.className = 'badge badge-danger';
    serverBadge.textContent = 'OFFLINE';

    dbBadge.className = 'badge badge-danger';
    dbBadge.textContent = 'DISCONNECTED';

    indicator.className = 'pulse-indicator error';
    timestampEl.textContent = new Date().toLocaleTimeString();

    rawResponseEl.textContent = JSON.stringify({
      success: false,
      error: error.message,
      hint: 'Make sure the backend server is running on https://campushub-backend-dak3.onrender.com/api'
    }, null, 2);
  }
}
