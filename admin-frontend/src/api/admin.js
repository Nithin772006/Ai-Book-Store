import apiClient, { setCsrfToken, getCsrfToken } from './client';

// ==========================================
// AUTHENTICATION & CSRF
// ==========================================

export const initAdminCsrf = async () => {
  const response = await apiClient.get('/admin/auth/csrf/');
  if (response.data?.csrfToken) {
    setCsrfToken(response.data.csrfToken);
  }
  return response.data;
};

export const adminLogin = async (identifier, password) => {
  // Ensure we have acquired an active CSRF token prior to POSTing credentials
  if (!getCsrfToken()) {
    try {
      await initAdminCsrf();
    } catch (err) {
      // Allow proceeding if cookie is already present in browser
      console.warn('CSRF initialization notice:', err?.message);
    }
  }

  const response = await apiClient.post('/admin/auth/login/', {
    identifier,
    password,
  });

  if (response.data?.csrfToken) {
    setCsrfToken(response.data.csrfToken);
  }

  return response.data;
};

export const adminGetMe = async () => {
  const response = await apiClient.get('/admin/auth/me/');
  return response.data;
};

export const adminLogout = async () => {
  const response = await apiClient.post('/admin/auth/logout/');
  return response.data;
};


// ==========================================
// DASHBOARD
// ==========================================

export const getDashboardMetrics = async () => {
  const response = await apiClient.get('/admin/dashboard/');
  return response.data;
};

// ==========================================
// BOOKS
// ==========================================

export const getAdminBooks = async (params = {}) => {
  const response = await apiClient.get('/admin/books/', { params });
  return response.data;
};

export const getAdminBook = async (id) => {
  const response = await apiClient.get(`/admin/books/${id}/`);
  return response.data;
};

export const createAdminBook = async (formData) => {
  const isMultipart = formData instanceof FormData;
  const response = await apiClient.post('/admin/books/', formData, {
    headers: isMultipart ? { 'Content-Type': 'multipart/form-data' } : undefined,
  });
  return response.data;
};

export const updateAdminBook = async (id, formData) => {
  const isMultipart = formData instanceof FormData;
  const response = await apiClient.patch(`/admin/books/${id}/`, formData, {
    headers: isMultipart ? { 'Content-Type': 'multipart/form-data' } : undefined,
  });
  return response.data;
};

export const deleteAdminBook = async (id) => {
  const response = await apiClient.delete(`/admin/books/${id}//`);
  return response.data;
};

// ==========================================
// CATEGORIES
// ==========================================

export const getAdminCategories = async () => {
  const response = await apiClient.get('/admin/categories/');
  return response.data;
};

export const createAdminCategory = async (data) => {
  const response = await apiClient.post('/admin/categories/', data);
  return response.data;
};

export const updateAdminCategory = async (id, data) => {
  const response = await apiClient.patch(`/admin/categories/${id}/`, data);
  return response.data;
};

export const deleteAdminCategory = async (id) => {
  const response = await apiClient.delete(`/admin/categories/${id}/`);
  return response.data;
};

// ==========================================
// ORDERS
// ==========================================

export const getAdminOrders = async (params = {}) => {
  const response = await apiClient.get('/admin/orders/', { params });
  return response.data;
};

export const getAdminOrder = async (id) => {
  const response = await apiClient.get(`/admin/orders/${id}/`);
  return response.data;
};

export const updateAdminOrderStatus = async (id, orderStatus, notes = '') => {
  const response = await apiClient.patch(`/admin/orders/${id}/status/`, {
    order_status: orderStatus,
    notes,
  });
  return response.data;
};

// ==========================================
// CUSTOMERS
// ==========================================

export const getAdminCustomers = async (params = {}) => {
  const response = await apiClient.get('/admin/customers/', { params });
  return response.data;
};

export const getAdminCustomer = async (id) => {
  const response = await apiClient.get(`/admin/customers/${id}/`);
  return response.data;
};

export const updateAdminCustomerStatus = async (id, isActive) => {
  const response = await apiClient.patch(`/admin/customers/${id}/status/`, {
    is_active: isActive,
  });
  return response.data;
};

// ==========================================
// NEWSLETTER
// ==========================================

export const getAdminSubscribers = async () => {
  const response = await apiClient.get('/admin/subscribers/');
  return response.data;
};
