import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { initAdminCsrf } from '../api/admin';

export const LoginPage = () => {
  const { login, isAuthenticated } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from?.pathname || '/dashboard';

  // Pre-initialize CSRF cookie and token when entering the login page
  useEffect(() => {
    initAdminCsrf().catch((err) => {
      // Non-fatal if server is booting; subsequent login attempt will retry
      console.warn('Admin CSRF pre-fetch:', err?.message || 'deferred');
    });
  }, []);

  // If already authenticated, redirect
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!identifier.trim() || !password) {
      setError('Please provide your staff username/email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await login(identifier.trim(), password, rememberMe);
      navigate(from, { replace: true });
    } catch (err) {
      const serverDetail = err.response?.data?.detail;
      const serverError = err.response?.data?.error;
      const isCsrfError = (serverDetail && serverDetail.toLowerCase().includes('csrf')) ||
                          (serverError && serverError.toLowerCase().includes('csrf'));

      if (isCsrfError) {
        // Attempt immediate token re-initialization
        initAdminCsrf().catch(() => {});
        setError('Security validation expired. Security token refreshed — please submit again.');
      } else {
        const errorMsg = serverError || serverDetail ||
          (err.response?.status === 403
            ? 'Access denied. Administrative staff privileges are required.'
            : 'Authentication failure. Please verify your administrator credentials.');
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-card">
        {/* Crest */}
        <div className="admin-login-crest-box">
          <span className="admin-login-crest-sparkle">✦</span>
          <h1 className="admin-login-brand">AETHERIUM</h1>
          <p className="admin-login-kicker">CURATORIAL & ADMINISTRATIVE ACCESS</p>
        </div>

        {/* Security Notice */}
        <div className="admin-login-security-notice">
          <ShieldAlert size={16} className="admin-security-icon" />
          <span>Restricted Portal. Authorized Bookstore Staff & Administrators Only.</span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="admin-alert admin-alert-danger" role="alert">
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="admin-form-group">
            <label htmlFor="identifier" className="admin-form-label">
              Staff Identifier or Email
            </label>
            <div className="admin-input-icon-wrap">
              <Mail size={16} className="admin-input-icon" />
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="curator or staff@aetherium.store"
                className="admin-form-input"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="password" className="admin-form-label">
              Security Password
            </label>
            <div className="admin-input-icon-wrap">
              <Lock size={16} className="admin-input-icon" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="admin-form-input"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="admin-form-row admin-login-options">
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <span>Remember session on this device</span>
            </label>
          </div>

          <button
            type="submit"
            className="admin-btn admin-btn-primary admin-btn-block"
            disabled={loading}
          >
            {loading ? (
              <span>Authenticating Session...</span>
            ) : (
              <>
                <span>Enter Administration</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="admin-login-footer">
          <p className="admin-login-provisioning-tip">
            Need staff credentials? Administrators are provisioned via backend Django management command (<code>createsuperuser</code>).
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
