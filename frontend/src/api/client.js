import axios from 'axios';

// Resolve backend base URL from Vite environment variables with fallback
// Supports both VITE_API_BASE_URL and VITE_API_URL.
// Normalizes URL by trimming trailing slashes and stripping /api if provided,
// because frontend API calls already include the /api prefix.
const rawApiUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').trim().replace(/\/+$/, '');
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl.slice(0, -4) : rawApiUrl;

export const AUTH_TOKEN_KEY = 'exlibris_auth_token';

// Reusable Axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true, // Send session cookies across origins
  xsrfCookieName: 'csrftoken', // Django CSRF cookie name
  xsrfHeaderName: 'X-CSRFToken', // Django CSRF header name
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request Interceptor: Attach Token authorization header if stored
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token && !config.headers['Authorization']) {
        config.headers['Authorization'] = `Token ${token}`;
      }
    } catch {
      // Ignore localStorage access errors (e.g. private browsing restrictions)
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Only clear if the failed request was not an intentional login/register attempt
      const url = error.config?.url || '';
      if (!url.includes('/api/auth/login/') && !url.includes('/api/auth/register/')) {
        try {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        } catch {
          // Ignore
        }
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch health status from Django REST Framework endpoint (Phase 1 verification)
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>} API health response payload
 */
export const checkApiHealth = async (options = {}) => {
  const startTime = performance.now();
  const response = await apiClient.get('/api/health/', { signal: options.signal });
  const durationMs = Math.round(performance.now() - startTime);

  return {
    data: response.data,
    status: response.status,
    latencyMs: durationMs,
    headers: response.headers,
  };
};

export { API_BASE_URL };
export default apiClient;
