// CampusHub Authentication & Role Authorization Client

const Auth = {
  async login(email, password) {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (response.ok && response.data.success) {
      const { user, token } = response.data.data;
      localStorage.setItem('campushub_token', token);
      localStorage.setItem('campushub_user', JSON.stringify(user));

      // Redirect based on user role using dynamic base path
      this.redirectToDashboard(user.role);
      return { success: true };
    } else {
      return {
        success: false,
        message: response.data.message || 'Login failed'
      };
    }
  },

  async logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore logout API failures
    } finally {
      localStorage.removeItem('campushub_token');
      localStorage.removeItem('campushub_user');
      window.location.href = getAppPath('login.html');
    }
  },

  getUser() {
    const userStr = localStorage.getItem('campushub_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getToken() {
    return localStorage.getItem('campushub_token');
  },

  redirectToDashboard(role) {
    switch (role) {
      case 'admin':
        window.location.href = getAppPath('pages/admin/dashboard.html');
        break;
      case 'faculty':
        window.location.href = getAppPath('pages/faculty/dashboard.html');
        break;
      case 'student':
      default:
        window.location.href = getAppPath('pages/student/dashboard.html');
        break;
    }
  },

  checkAuth(allowedRoles = []) {
    const token = this.getToken();
    const user = this.getUser();

    if (!token || !user) {
      window.location.href = getAppPath('login.html');
      return false;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      console.warn(`User role '${user.role}' not permitted for this page. Redirecting...`);
      this.redirectToDashboard(user.role);
      return false;
    }

    return true;
  }
};
