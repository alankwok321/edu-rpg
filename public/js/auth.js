// ========== AUTH HELPER (JWT Token Management) ==========
// Shared across all pages — must be loaded before other scripts
const Auth = {
  TOKEN_KEY: 'edu_rpg_token',

  // Get the stored JWT token
  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  // Save the JWT token
  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  // Remove the JWT token (logout)
  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  // Check if user has a token
  isLoggedIn() {
    return !!this.getToken();
  },

  // Get Authorization headers for fetch calls
  authHeaders() {
    const token = this.getToken();
    if (!token) return {};
    return { 'Authorization': 'Bearer ' + token };
  },

  // Convenience: get headers with JSON content type + auth
  jsonHeaders() {
    return {
      'Content-Type': 'application/json',
      ...this.authHeaders()
    };
  },

  // Authenticated fetch wrapper — auto-adds auth header, auto-redirects on 401
  async fetch(url, options = {}) {
    options.headers = {
      ...this.authHeaders(),
      ...(options.headers || {})
    };
    const res = await fetch(url, options);
    if (res.status === 401) {
      this.clearToken();
      window.location.href = '/';
      throw new Error('Not authenticated');
    }
    return res;
  },

  // Logout: clear token and redirect
  async logout() {
    try {
      await fetch('/api/logout', { method: 'POST', headers: this.authHeaders() });
    } catch (e) { /* ignore */ }
    this.clearToken();
    window.location.href = '/';
  }
};
