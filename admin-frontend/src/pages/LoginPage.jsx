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
      console.info('[Auth] Initiating administrator login attempt...');
      await login(identifier.trim(), password, rememberMe);
      console.info('[Auth] Administrator login successful, navigating to destination.');
      navigate(from, { replace: true });
    } catch (err) {
      const serverDetail = err.response?.data?.detail;
      const serverError = err.response?.data?.error;
      const status = err.response?.status;

      const detailStr = (serverDetail || '').toLowerCase();
      const errorStr = (serverError || '').toLowerCase();
      const isCsrfError = detailStr.includes('csrf') || errorStr.includes('csrf');

      if (isCsrfError) {
        if (detailStr.includes('origin checking failed')) {
          console.error('[Auth] CSRF Origin check failed: Frontend origin is not allowed in backend CSRF_TRUSTED_ORIGINS.');
          setError('Origin verification failed: this admin frontend domain is not trusted by the backend. Please check backend CSRF_TRUSTED_ORIGINS.');
        } else {
          console.warn(`[Auth] CSRF validation failed (${serverDetail || 'token mismatch'}). Requesting fresh security token...`);
          try {
            await initAdminCsrf();
            console.info('[Auth] Fresh CSRF token acquired successfully. Awaiting user resubmission.');
            setError('Security validation expired. Security token refreshed — please submit again.');
          } catch (refreshErr) {
            console.error('[Auth] CSRF token re-initialization failed:', refreshErr.response?.status || refreshErr.message);
            setError('Security validation expired, and the server could not issue a fresh security token. Please check server connectivity.');
          }
        }
      } else if (status === 401) {
        console.warn('[Auth] Login rejected: Invalid administrator credentials (401).');
        setError(serverError || 'Invalid administrative credentials. Please verify your username and password.');
      } else if (status === 403) {
        console.warn('[Auth] Login rejected: Forbidden (403). Non-staff privileges or inactive account.');
        setError(serverError || serverDetail || 'Access denied. Administrative staff privileges are required to access this portal.');
      } else if (status === 400) {
        console.warn('[Auth] Login rejected: Bad request (400).');
        setError(serverError || serverDetail || 'Please verify the submitted administrator credentials.');
      } else if (!err.response) {
        console.error('[Auth] Login failed: Network connection error.');
        setError('Unable to reach the administration backend. Please verify your network connection and ensure the Render backend is online.');
      } else {
        console.error(`[Auth] Login failed with HTTP status ${status}.`);
        setError(serverError || serverDetail || `Authentication failed with status ${status}. Please try again.`);
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
