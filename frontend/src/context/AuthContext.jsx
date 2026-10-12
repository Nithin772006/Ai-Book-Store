import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './AuthContextInstance';
import {
  registerCustomer,
  loginCustomer,
  logoutCustomer,
  getCurrentUser,
  initCsrfCookie,
  AUTH_TOKEN_KEY,
} from '../api/auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY) || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize CSRF and verify session or stored token on initial app mount
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    const initializeAuth = async () => {
      // 1. Establish CSRF cookie
      await initCsrfCookie(controller.signal);

      // 2. If token exists or session cookie might be active, check /api/auth/me/
      try {
        const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
        if (storedToken) {
          const profile = await getCurrentUser(controller.signal);
          if (!ignore) {
            setUser(profile);
            setToken(storedToken);
          }
        }
      } catch (err) {
        if (!ignore && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          // Token is invalid or expired
          try {
            localStorage.removeItem(AUTH_TOKEN_KEY);
          } catch {}
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, []);

  const login = useCallback(async (credentials) => {
    setAuthError(null);
    try {
      const data = await loginCustomer(credentials);
      if (data.token) {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        } catch {}
        setToken(data.token);
      }
      setUser(data.user);
      return { success: true, user: data.user, message: data.message };
    } catch (err) {
      const resp = err.response?.data;
      let message = 'Unable to log in. Please check your network connection.';
      let fieldErrors = {};

      if (resp) {
        if (typeof resp === 'string') {
          message = resp;
        } else if (resp.detail) {
          message = resp.detail;
        } else if (resp.non_field_errors) {
          message = Array.isArray(resp.non_field_errors)
            ? resp.non_field_errors.join(' ')
            : String(resp.non_field_errors);
        } else {
          fieldErrors = resp;
          const firstField = Object.keys(resp)[0];
          if (firstField) {
            const firstErr = resp[firstField];
            message = Array.isArray(firstErr) ? firstErr[0] : String(firstErr);
          }
        }
      }

      setAuthError(message);
      return { success: false, error: message, fieldErrors };
    }
  }, []);

  const register = useCallback(async (userData) => {
    setAuthError(null);
    try {
      const data = await registerCustomer(userData);
      if (data.token) {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        } catch {}
        setToken(data.token);
      }
      setUser(data.user);
      return { success: true, user: data.user, message: data.message };
    } catch (err) {
      const resp = err.response?.data;
      let message = 'Account registration failed. Please review the highlighted fields.';
      let fieldErrors = {};

      if (resp) {
        if (typeof resp === 'string') {
          message = resp;
        } else if (resp.detail) {
          message = resp.detail;
        } else if (resp.non_field_errors) {
          message = Array.isArray(resp.non_field_errors)
            ? resp.non_field_errors.join(' ')
            : String(resp.non_field_errors);
        } else {
          fieldErrors = resp;
          const firstField = Object.keys(resp)[0];
          if (firstField) {
            const firstErr = resp[firstField];
            message = Array.isArray(firstErr) ? firstErr[0] : String(firstErr);
          }
        }
      }

      setAuthError(message);
      return { success: false, error: message, fieldErrors };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutCustomer();
    } catch (err) {
      console.warn('Logout API notification notice:', err.message);
    } finally {
      try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      } catch {}
      setUser(null);
      setToken(null);
      setAuthError(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await getCurrentUser();
      setUser(profile);
      return profile;
    } catch {
      return null;
    }
  }, []);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user),
    authError,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;

