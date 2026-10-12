import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminLogin, adminGetMe, adminLogout } from '../api/admin';

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    return sessionStorage.getItem('aetherium_admin_token') || localStorage.getItem('aetherium_admin_token') || null;
  });
  const [loading, setLoading] = useState(true);

  // Validate session on mount if token exists
  useEffect(() => {
    let isMounted = true;
    const verifyAuth = async () => {
      const activeToken = sessionStorage.getItem('aetherium_admin_token') || localStorage.getItem('aetherium_admin_token');
      if (!activeToken) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const userData = await adminGetMe();
        if (isMounted) {
          setUser(userData);
          setToken(activeToken);
        }
      } catch (err) {
        console.warn('Admin session validation failed:', err);
        sessionStorage.removeItem('aetherium_admin_token');
        localStorage.removeItem('aetherium_admin_token');
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    verifyAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (identifier, password, rememberMe = false) => {
    const data = await adminLogin(identifier, password);
    const receivedToken = data.token;
    const userData = data.user;

    if (rememberMe) {
      localStorage.setItem('aetherium_admin_token', receivedToken);
    } else {
      sessionStorage.setItem('aetherium_admin_token', receivedToken);
    }

    setToken(receivedToken);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await adminLogout();
    } catch (err) {
      // Ignored if session already terminated
    } finally {
      sessionStorage.removeItem('aetherium_admin_token');
      localStorage.removeItem('aetherium_admin_token');
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user && !!token,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
