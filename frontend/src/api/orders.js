import apiClient from './client';

/**
 * Submit checkout payload to create an order
 * @param {Object} checkoutData - Shipping and payment details
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ message: string, order: Object }>}
 */
export const createCheckoutOrder = async (checkoutData, signal = null) => {
  const response = await apiClient.post('/api/orders/checkout/', checkoutData, { signal });
  return response.data;
};

/**
 * Fetch the authenticated customer's order history
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<Object>>}
 */
export const getCustomerOrders = async (signal = null) => {
  const response = await apiClient.get('/api/orders/', { signal });
  return response.data;
};

/**
 * Fetch full details of an order by reference
 * @param {string} reference - Public order reference (e.g. EXL-1234ABCD)
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export const getOrderByReference = async (reference, signal = null) => {
  const response = await apiClient.get(`/api/orders/${reference}/`, { signal });
  return response.data;
};
