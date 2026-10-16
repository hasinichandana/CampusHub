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

// Authenticated File Download Helper
async function downloadAuthenticatedFile(endpoint, defaultFilename = 'campushub_download') {
  const token = localStorage.getItem('campushub_token') || localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      let errorMsg = 'Failed to download file';
      try {
        const errJson = await response.json();
        errorMsg = errJson.message || errorMsg;
      } catch (e) {}
      alert(`Download Error: ${errorMsg}`);
      return false;
    }

    let filename = defaultFilename;
    const disposition = response.headers.get('content-disposition');
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '').trim();
      }
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
    return true;
  } catch (error) {
    console.error('File Download Error:', error);
    alert('Network error downloading file');
    return false;
  }
}

// Authenticated File View / Preview Helper
async function viewAuthenticatedFile(endpoint) {
  const token = localStorage.getItem('campushub_token') || localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  const previewWindow = window.open('about:blank', '_blank');
  if (!previewWindow) {
    alert('Please allow pop-ups to preview this file.');
    return;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      previewWindow.close();
      let errorMsg = 'Failed to view file';
      try {
        const errJson = await response.json();
        errorMsg = errJson.message || errorMsg;
      } catch (e) {}
      alert(`File View Error: ${errorMsg}`);
      return;
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    previewWindow.location.href = objectUrl;
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
  } catch (error) {
    previewWindow.close();
    console.error('File View Error:', error);
    alert('Network error viewing file');
  }
}
