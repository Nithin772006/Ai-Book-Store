import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Button from './Button';

export default function LoginForm({ onSuccess }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Destination to redirect back to after login
  const from = location.state?.from?.pathname || '/account';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (generalError) setGeneralError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!formData.identifier.trim()) {
      setFieldErrors((prev) => ({ ...prev, identifier: 'Please enter your email or username.' }));
      return;
    }
    if (!formData.password) {
      setFieldErrors((prev) => ({ ...prev, password: 'Please enter your password.' }));
      return;
    }

    setSubmitting(true);
    setGeneralError('');
    setFieldErrors({});

    const res = await login({
      identifier: formData.identifier.trim(),
      password: formData.password,
    });

    setSubmitting(false);

    if (res.success) {
      if (onSuccess) {
        onSuccess(res.user);
      } else {
        navigate(from, { replace: true });
      }
    } else {
      setGeneralError(res.error || 'Invalid credentials. Please verify your details.');
      if (res.fieldErrors) {
        setFieldErrors(res.fieldErrors);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-editorial-form" noValidate aria-label="Customer Login Form">
      {generalError && (
        <div className="auth-alert-box error" role="alert" id="login-error-alert">
          <span className="alert-icon" aria-hidden="true">⚠️</span>
          <span className="alert-text">{generalError}</span>
        </div>
      )}

      {/* Identifier Field */}
      <div className={`auth-field-group ${fieldErrors.identifier ? 'has-error' : ''}`}>
        <label htmlFor="login-identifier" className="auth-label">
          Email Address or Username
        </label>
        <div className="auth-input-wrapper">
          <input
            id="login-identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoFocus
            value={formData.identifier}
            onChange={handleChange}
            placeholder="reader@aetherium-books.com"
            disabled={submitting}
            className="auth-input-field"
            aria-invalid={Boolean(fieldErrors.identifier)}
            aria-describedby={fieldErrors.identifier ? 'login-identifier-error' : undefined}
          />
        </div>
        {fieldErrors.identifier && (
          <span className="auth-field-error" id="login-identifier-error">
            {Array.isArray(fieldErrors.identifier) ? fieldErrors.identifier[0] : fieldErrors.identifier}
          </span>
        )}
      </div>

      {/* Password Field */}
      <div className={`auth-field-group ${fieldErrors.password ? 'has-error' : ''}`}>
        <div className="auth-label-row">
          <label htmlFor="login-password" className="auth-label">
            Password
          </label>
        </div>
        <div className="auth-input-wrapper">
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••••••"
            disabled={submitting}
            className="auth-input-field"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="auth-password-toggle-btn"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={0}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {fieldErrors.password && (
          <span className="auth-field-error" id="login-password-error">
            {Array.isArray(fieldErrors.password) ? fieldErrors.password[0] : fieldErrors.password}
          </span>
        )}
      </div>

      {/* Submit Button */}
      <div className="auth-action-stack">
        <Button
          type="submit"
          variant="burgundy"
          size="lg"
          loading={submitting}
          disabled={submitting}
          className="auth-submit-btn"
          id="btn-login-submit"
        >
          {submitting ? 'Authenticating...' : 'Sign In to Account'}
        </Button>
      </div>

      <div className="auth-footer-prompt">
        <span>New to AETHERIUM?</span>{' '}
        <Link to="/register" state={{ from: location.state?.from }} className="auth-inline-link">
          Create a Reader Account →
        </Link>
      </div>
    </form>
  );
}
