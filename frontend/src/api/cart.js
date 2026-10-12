import apiClient from './client';

/**
 * Fetch the authenticated customer's current cart
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} Cart data { id, items, item_count, subtotal, ... }
 */
export const getCart = async (signal = null) => {
  const response = await apiClient.get('/api/cart/', { signal });
  return response.data?.cart || response.data;
};

/**
 * Add a book to the customer's cart
 * @param {number|string} bookId - ID of the catalogue book
 * @param {number} [quantity=1] - Quantity to add
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} Updated cart data
 */
export const addToCart = async (bookId, quantity = 1, signal = null) => {
  const response = await apiClient.post(
    '/api/cart/items/',
    { book_id: Number(bookId), quantity: Number(quantity) },
    { signal }
  );
  return response.data?.cart || response.data;
};

/**
 * Update the quantity of a specific cart item
 * @param {number|string} itemId - ID of the cart item
 * @param {number} quantity - New target quantity
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} Updated cart data
 */
export const updateCartItem = async (itemId, quantity, signal = null) => {
  const response = await apiClient.patch(
    `/api/cart/items/${itemId}/`,
    { quantity: Number(quantity) },
    { signal }
  );
  return response.data?.cart || response.data;
};

/**
 * Remove an item completely from the cart
 * @param {number|string} itemId - ID of the cart item
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} Updated cart data
 */
export const removeCartItem = async (itemId, signal = null) => {
  const response = await apiClient.delete(`/api/cart/items/${itemId}/`, { signal });
  return response.data?.cart || response.data;
};

/**
 * Clear all items from the current customer's cart
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>} Cleared cart data
 */
export const clearCart = async (signal = null) => {
  const response = await apiClient.delete('/api/cart/', { signal });
  return response.data?.cart || response.data;
};
