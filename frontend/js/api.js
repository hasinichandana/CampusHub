// CampusHub Centralized API Client

const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to resolve dynamic frontend paths for Live Server compatibility
function getAppPath(relativePath) {
  const cleanPath = relativePath.replace(/^\//, '');
  const pathname = window.location.pathname;
  if (pathname.includes('/frontend/')) {
    return `/frontend/${cleanPath}`;
  }
  return `/${cleanPath}`;
}

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('campushub_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      // Token expired or unauthorized -> logout and redirect
      localStorage.removeItem('campushub_token');
      localStorage.removeItem('campushub_user');
      window.location.href = getAppPath('login.html');
      return;
    }

    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.error('API Fetch Error:', error);
    return { ok: false, status: 500, data: { success: false, message: 'Network error or server offline' } };
  }
}
