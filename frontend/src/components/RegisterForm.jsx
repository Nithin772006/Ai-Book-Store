import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Button from './Button';

export default function RegisterForm({ onSuccess }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    password_confirm: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

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

  const validateClientSide = () => {
    const errors = {};
    if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }

    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    }

    if (!formData.password_confirm) {
      errors.password_confirm = 'Please confirm your password.';
    } else if (formData.password !== formData.password_confirm) {
      errors.password_confirm = 'Passwords do not match.';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const clientErrors = validateClientSide();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    setGeneralError('');
    setFieldErrors({});

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      username: formData.username.trim() || undefined,
      password: formData.password,
      password_confirm: formData.password_confirm,
    };

    const res = await register(payload);
    setSubmitting(false);

    if (res.success) {
      if (onSuccess) {
        onSuccess(res.user);
      } else {
        navigate(from, { replace: true });
      }
    } else {
      setGeneralError(res.error || 'Registration could not be completed.');
      if (res.fieldErrors) {
        setFieldErrors(res.fieldErrors);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-editorial-form" noValidate aria-label="Customer Registration Form">
      {generalError && (
        <div className="auth-alert-box error" role="alert" id="register-error-alert">
          <span className="alert-icon" aria-hidden="true">⚠️</span>
          <span className="alert-text">{generalError}</span>
        </div>
      )}

      {/* Full Name Field */}
      <div className={`auth-field-group ${fieldErrors.name ? 'has-error' : ''}`}>
        <label htmlFor="reg-name" className="auth-label">
          Full Name
        </label>
        <div className="auth-input-wrapper">
          <input
            id="reg-name"
            name="name"
            type="text"
            autoComplete="name"
            autoFocus
            value={formData.name}
            onChange={handleChange}
            placeholder="Ada Lovelace"
            disabled={submitting}
            className="auth-input-field"
          />
        </div>
        {fieldErrors.name && (
          <span className="auth-field-error">
            {Array.isArray(fieldErrors.name) ? fieldErrors.name[0] : fieldErrors.name}
          </span>
        )}
      </div>

      {/* Email Field */}
      <div className={`auth-field-group ${fieldErrors.email ? 'has-error' : ''}`}>
        <label htmlFor="reg-email" className="auth-label">
          Email Address <span className="auth-required-mark">*</span>
        </label>
        <div className="auth-input-wrapper">
          <input
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="ada@analytical-engine.org"
            disabled={submitting}
            className="auth-input-field"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
          />
        </div>
        {fieldErrors.email && (
          <span className="auth-field-error" id="reg-email-error">
            {Array.isArray(fieldErrors.email) ? fieldErrors.email[0] : fieldErrors.email}
          </span>
        )}
      </div>

      {/* Optional Username Field */}
      <div className={`auth-field-group ${fieldErrors.username ? 'has-error' : ''}`}>
        <label htmlFor="reg-username" className="auth-label">
          Username <span className="auth-optional-tag">(Optional)</span>
        </label>
        <div className="auth-input-wrapper">
          <input
            id="reg-username"
            name="username"
            type="text"
            autoComplete="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="ada_reader"
            disabled={submitting}
            className="auth-input-field"
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={fieldErrors.username ? 'reg-username-error' : 'reg-username-help'}
          />
        </div>
        <span className="auth-field-hint" id="reg-username-help">
          Leave blank to generate an automatic reader identifier from your email.
        </span>
        {fieldErrors.username && (
          <span className="auth-field-error" id="reg-username-error">
            {Array.isArray(fieldErrors.username) ? fieldErrors.username[0] : fieldErrors.username}
          </span>
        )}
      </div>

      {/* Password Field */}
      <div className={`auth-field-group ${fieldErrors.password ? 'has-error' : ''}`}>
        <label htmlFor="reg-password" className="auth-label">
          Password <span className="auth-required-mark">*</span>
        </label>
        <div className="auth-input-wrapper">
          <input
            id="reg-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={formData.password}
            onChange={handleChange}
            placeholder="Minimum 8 characters"
            disabled={submitting}
            className="auth-input-field"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'reg-password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="auth-password-toggle-btn"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {fieldErrors.password && (
          <span className="auth-field-error" id="reg-password-error">
            {Array.isArray(fieldErrors.password) ? fieldErrors.password[0] : fieldErrors.password}
          </span>
        )}
      </div>

      {/* Password Confirmation Field */}
      <div className={`auth-field-group ${fieldErrors.password_confirm ? 'has-error' : ''}`}>
        <label htmlFor="reg-password-confirm" className="auth-label">
          Confirm Password <span className="auth-required-mark">*</span>
        </label>
        <div className="auth-input-wrapper">
          <input
            id="reg-password-confirm"
            name="password_confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={formData.password_confirm}
            onChange={handleChange}
            placeholder="Re-enter password"
            disabled={submitting}
            className="auth-input-field"
            aria-invalid={Boolean(fieldErrors.password_confirm)}
            aria-describedby={fieldErrors.password_confirm ? 'reg-password-confirm-error' : undefined}
          />
        </div>
        {fieldErrors.password_confirm && (
          <span className="auth-field-error" id="reg-password-confirm-error">
            {Array.isArray(fieldErrors.password_confirm)
              ? fieldErrors.password_confirm[0]
              : fieldErrors.password_confirm}
          </span>
        )}
      </div>

      {/* Submit Action */}
      <div className="auth-action-stack">
        <Button
          type="submit"
          variant="burgundy"
          size="lg"
          loading={submitting}
          disabled={submitting}
          className="auth-submit-btn"
          id="btn-register-submit"
        >
          {submitting ? 'Creating Reader Account...' : 'Open Reader Account'}
        </Button>
      </div>

      <div className="auth-footer-prompt">
        <span>Already have an account?</span>{' '}
        <Link to="/login" state={{ from: location.state?.from }} className="auth-inline-link">
          Sign In Here →
        </Link>
      </div>
    </form>
  );
}
