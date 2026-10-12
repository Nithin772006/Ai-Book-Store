import axios from 'axios';

// Resolve backend API URL from Vite environment variables with fallback.
// Admin endpoints are called relative to /api (e.g. /admin/books/), so ensure
// the baseURL always ends with /api regardless of whether the user sets
// https://backend.onrender.com or https://backend.onrender.com/api.
const rawApiUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').trim().replace(/\/+$/, '');
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

// In-memory CSRF token storage
let inMemoryCsrfToken = null;

export const setCsrfToken = (token) => {
  inMemoryCsrfToken = token;
};

export const getCsrfToken = () => {
  return inMemoryCsrfToken || getCookie('csrftoken');
};

// Helper function to extract cookie by name
export const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  headers: {
    'Accept': 'application/json',
  },
});

// Request interceptor: attach auth token and CSRF token if present
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('aetherium_admin_token') || localStorage.getItem('aetherium_admin_token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }

  // Attach X-CSRFToken header for state-changing requests or when token is known
  const csrfToken = inMemoryCsrfToken || getCookie('csrftoken');
  if (csrfToken && !config.headers['X-CSRFToken']) {
    config.headers['X-CSRFToken'] = csrfToken;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor: capture rotated CSRF tokens and handle 401 unauthorized
apiClient.interceptors.response.use(
  (response) => {
    // If backend returns a rotated or established CSRF token in payload
    if (response.data && response.data.csrfToken) {
      setCsrfToken(response.data.csrfToken);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      sessionStorage.removeItem('aetherium_admin_token');
      localStorage.removeItem('aetherium_admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;

