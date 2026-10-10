import axios from 'axios';

// Resolve backend base URL from Vite environment variables with fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Create a reusable Axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/**
 * Fetch health status from Django REST Framework endpoint
 * @returns {Promise<Object>} API health response payload
 */
export const checkApiHealth = async () => {
  const startTime = performance.now();
  const response = await apiClient.get('/api/health/');
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
