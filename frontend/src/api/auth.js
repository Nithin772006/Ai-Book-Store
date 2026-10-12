import apiClient, { AUTH_TOKEN_KEY } from './client';

/**
 * Initialize CSRF cookie from Django server
 * @param {AbortSignal} [signal]
 */
export const initCsrfCookie = async (signal = null) => {
  try {
    const res = await apiClient.get('/api/auth/csrf/', { signal });
    return res.data;
  } catch (err) {
    console.warn('Could not initialize CSRF cookie:', err);
    return null;
  }
};

/**
 * Register a new customer account
 * @param {Object} userData - { name, email, username, password, password_confirm }
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ user: Object, token: string, message: string }>}
 */
export const registerCustomer = async (userData, signal = null) => {
  const response = await apiClient.post('/api/auth/register/', userData, { signal });
  return response.data;
};

/**
 * Authenticate customer with email or username and password
 * @param {Object} credentials - { identifier, password } (or email, username)
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ user: Object, token: string, message: string }>}
 */
export const loginCustomer = async (credentials, signal = null) => {
  const response = await apiClient.post('/api/auth/login/', credentials, { signal });
  return response.data;
};

/**
 * Log out currently authenticated session / revoke token
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ message: string }>}
 */
export const logoutCustomer = async (signal = null) => {
  const response = await apiClient.post('/api/auth/logout/', {}, { signal });
  return response.data;
};

/**
 * Fetch the public profile of the currently authenticated customer
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export const getCurrentUser = async (signal = null) => {
  const response = await apiClient.get('/api/auth/me/', { signal });
  return response.data;
};

export { AUTH_TOKEN_KEY };
