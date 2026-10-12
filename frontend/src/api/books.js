import apiClient from './client';

/**
 * Fetch paginated books with optional search, filtering, and sorting parameters.
 * @param {Object} [params] - Query parameters
 * @param {string} [params.search] - Search keyword (title, author, description, ISBN)
 * @param {string} [params.category] - Category slug filter
 * @param {boolean} [params.featured] - Filter featured books
 * @param {boolean} [params.bestseller] - Filter bestseller books
 * @param {boolean} [params.new_arrival] - Filter new arrival books
 * @param {boolean} [params.in_stock] - Filter in-stock books
 * @param {string} [params.ordering] - Ordering key (price, -price, title, -created_at)
 * @param {number} [params.page] - Page number
 * @param {number} [params.page_size] - Items per page
 * @param {AbortSignal} [signal] - Optional abort signal for request cancellation
 * @returns {Promise<{count: number, next: string|null, previous: string|null, results: Array}>}
 */
export const getBooks = async (params = {}, signal = null) => {
  const cleanParams = {};
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      cleanParams[key] = val;
    }
  }

  const response = await apiClient.get('/api/books/', {
    params: cleanParams,
    signal,
  });
  return response.data;
};

/**
 * Fetch a single book by ID.
 * @param {number|string} id - Book ID
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export const getBookById = async (id, signal = null) => {
  const response = await apiClient.get(`/api/books/${id}/`, { signal });
  return response.data;
};

/**
 * Fetch all active categories with book counts.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export const getCategories = async (signal = null) => {
  const response = await apiClient.get('/api/categories/', { signal });
  return response.data;
};

/**
 * Fetch active books for a specific category slug.
 * @param {string} slug - Category slug
 * @param {Object} [params] - Additional filter, search, sort, and pagination params
 * @param {AbortSignal} [signal]
 * @returns {Promise<{count: number, next: string|null, previous: string|null, results: Array}>}
 */
export const getCategoryBooks = async (slug, params = {}, signal = null) => {
  const cleanParams = {};
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      cleanParams[key] = val;
    }
  }

  const response = await apiClient.get(`/api/categories/${slug}/books/`, {
    params: cleanParams,
    signal,
  });
  return response.data;
};

/**
 * Fetch featured books shortcut.
 * @param {number} [limit=6]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export const getFeaturedBooks = async (limit = 6, signal = null) => {
  const data = await getBooks({ featured: true, page_size: limit }, signal);
  return data.results || [];
};

/**
 * Fetch bestseller books shortcut.
 * @param {number} [limit=6]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export const getBestsellerBooks = async (limit = 6, signal = null) => {
  const data = await getBooks({ bestseller: true, page_size: limit }, signal);
  return data.results || [];
};

/**
 * Fetch new arrivals shortcut.
 * @param {number} [limit=6]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export const getNewArrivals = async (limit = 6, signal = null) => {
  const data = await getBooks({ new_arrival: true, page_size: limit }, signal);
  return data.results || [];
};

/**
 * Fetch or generate an AI summary for a book (Phase 7 - Groq).
 * Calls POST /api/ai/books/<id>/summary/ on demand.
 * @param {number|string} id - Book ID
 * @param {AbortSignal} [signal]
 * @returns {Promise<{book_id: number, title: string, summary: string, cached: boolean, model: string}>}
 */
export const getBookAiSummary = async (id, signal = null) => {
  const response = await apiClient.post(`/api/ai/books/${id}/summary/`, {}, { signal });
  return response.data;
};

/**
 * Fetch related books for a specific volume (Phase 8).
 * @param {number|string} id - Book ID
 * @param {number} [limit=4] - Number of related books
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export const getRelatedBooks = async (id, limit = 4, signal = null) => {
  const response = await apiClient.get(`/api/books/${id}/related/`, {
    params: { limit },
    signal,
  });
  return response.data || [];
};

/**
 * Fetch personalized or curated recommendations (Phase 8).
 * @param {number} [limit=8]
 * @param {AbortSignal} [signal]
 * @returns {Promise<{results: Array, count: number, personalized: boolean}>}
 */
export const getRecommendations = async (limit = 8, signal = null) => {
  const response = await apiClient.get('/api/recommendations/', {
    params: { limit },
    signal,
  });
  return response.data;
};

/**
 * Send a message to the AETHERIUM AI Reading Assistant (Phase 8).
 * @param {Object} payload
 * @param {string} payload.message - The reader's question or prompt
 * @param {number|string} [payload.bookId] - Optional selected book ID
 * @param {Array} [payload.history] - Optional conversation history
 * @param {AbortSignal} [signal]
 * @returns {Promise<{reply: string, book: Object|null, recommended_books: Array, model: string}>}
 */
export const askReadingAssistant = async (
  { message, bookId = null, history = [] },
  signal = null
) => {
  const response = await apiClient.post(
    '/api/ai/reading-assistant/',
    {
      message,
      book_id: bookId,
      history,
    },
    { signal }
  );
  return response.data;
};
