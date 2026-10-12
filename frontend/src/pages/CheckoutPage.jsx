import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../context/useAuth';
import { useCart } from '../context/useCart';
import { createCheckoutOrder } from '../api/orders';
import Button from '../components/Button';
import LoadingState from '../components/LoadingState';

gsap.registerPlugin(useGSAP);

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cart, loading: cartLoading, refreshCart } = useCart();
  const navigate = useNavigate();
  const pageRef = useRef(null);

  const [formData, setFormData] = useState(() => ({
    customer_name: user?.full_name || user?.username || '',
    customer_email: user?.email || '',
    shipping_address_line1: '',
    shipping_address_line2: '',
    city: '',
    state_region: '',
    postal_code: '',
    country: 'United States',
    payment_method: 'demo_card',
  }));

  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState(null);

  // Client-generated idempotency token for this checkout session
  const [idempotencyKey] = useState(() => `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.from('.checkout-anim-entry', {
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.7,
      ease: 'power3.out',
    });
  }, { scope: pageRef, dependencies: [cartLoading] });

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
    if (generalError) setGeneralError(null);
  };

  const validate = () => {
    const errors = {};
    if (!formData.customer_name.trim()) errors.customer_name = 'Please provide your full name.';
    if (!formData.customer_email.trim()) errors.customer_email = 'Please provide an email address.';
    if (!formData.shipping_address_line1.trim()) errors.shipping_address_line1 = 'Address line 1 is required.';
    if (!formData.city.trim()) errors.city = 'City is required.';
    if (!formData.state_region.trim()) errors.state_region = 'State or region is required.';
    if (!formData.postal_code.trim()) errors.postal_code = 'Postal code is required.';
    if (!formData.country.trim()) errors.country = 'Country is required.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!validate()) {
      setGeneralError('Please review and complete the required shipping details.');
      return;
    }

    setSubmitting(true);
    setGeneralError(null);

    try {
      const payload = {
        ...formData,
        idempotency_key: idempotencyKey,
      };

      const result = await createCheckoutOrder(payload);
      const confirmedOrder = result.order;

      // Synchronize cart state so navbar badge updates to 0
      await refreshCart();

      // Navigate to order confirmation
      navigate(`/order-confirmation/${confirmedOrder.reference}`, {
        state: { order: confirmedOrder },
        replace: true,
      });
    } catch (err) {
      console.error('Checkout error:', err);
      let errorMsg = 'An unexpected error occurred while placing your order. Please try again.';
      if (err.response?.data) {
        const data = err.response.data;
        if (data.detail) errorMsg = data.detail;
        else if (typeof data === 'string') errorMsg = data;
        else {
          // Field-level error mapping
          const newErrors = {};
          Object.keys(data).forEach((key) => {
            newErrors[key] = Array.isArray(data[key]) ? data[key][0] : data[key];
          });
          setFieldErrors(newErrors);
          errorMsg = 'Please verify the highlighted fields below.';
        }
      }
      setGeneralError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const items = cart?.items || [];
  const isEmpty = items.length === 0;

  if (cartLoading) {
    return (
      <div className="store-container section-pad">
        <LoadingState message="Preparing checkout folio..." count={2} />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="editorial-checkout-page store-container" ref={pageRef}>
        <div className="cart-empty-state" id="checkout-empty-state">
          <div className="empty-state-emblem">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2 className="empty-state-title">Your Reading Bag is Empty</h2>
          <p className="empty-state-prose">
            Cannot proceed to checkout without volumes in your bag. Explore our curated collections to select an edition.
          </p>
          <Button to="/books" variant="burgundy" size="lg">
            Explore Curated Volumes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="editorial-checkout-page store-container">
      {/* Breadcrumb Navigation */}
      <nav className="editorial-breadcrumbs checkout-anim-entry" aria-label="Breadcrumbs">
        <Link to="/" className="breadcrumb-crumb">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to="/cart" className="breadcrumb-crumb">Shopping Bag</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active" aria-current="page">Checkout</span>
      </nav>

      <header className="checkout-page-header checkout-anim-entry">
        <span className="cart-header-kicker">AETHERIUM ARCHIVES</span>
        <h1 className="cart-header-title">Acquisition & Checkout</h1>
        <p className="cart-header-subtitle">
          Provide your archival dispatch destination to secure your reserved volumes.
        </p>
      </header>

      {/* Global Error Alert */}
      {generalError && (
        <div className="cart-alert-banner alert-error checkout-anim-entry" role="alert" id="checkout-error-banner">
          <span className="alert-icon">⚠️</span>
          <span className="alert-text">{generalError}</span>
          <button
            type="button"
            className="alert-dismiss-btn"
            onClick={() => setGeneralError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <div className="checkout-main-grid checkout-anim-entry">
        {/* Left Column: Shipping Form & Demo Payment */}
        <section className="checkout-form-section">
          <form onSubmit={handleSubmit} noValidate id="checkout-form">
            {/* Step 1: Shipping Destination */}
            <div className="checkout-card-box">
              <div className="card-box-header">
                <span className="box-step-badge">1</span>
                <h2 className="box-title">Shipping & Archival Dispatch</h2>
              </div>

              <div className="form-grid-2col">
                <div className="form-field-group">
                  <label htmlFor="customer_name" className="form-label">
                    Full Name <span className="label-req">*</span>
                  </label>
                  <input
                    type="text"
                    id="customer_name"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleChange}
                    className={`editorial-input ${fieldErrors.customer_name ? 'input-error' : ''}`}
                    placeholder="e.g. Julian Blackwood"
                    required
                  />
                  {fieldErrors.customer_name && (
                    <span className="field-error-msg">{fieldErrors.customer_name}</span>
                  )}
                </div>

                <div className="form-field-group">
                  <label htmlFor="customer_email" className="form-label">
                    Email Address for Dispatch Notices <span className="label-req">*</span>
                  </label>
                  <input
                    type="email"
                    id="customer_email"
                    name="customer_email"
                    value={formData.customer_email}
                    onChange={handleChange}
                    className={`editorial-input ${fieldErrors.customer_email ? 'input-error' : ''}`}
                    placeholder="julian@example.com"
                    required
                  />
                  {fieldErrors.customer_email && (
                    <span className="field-error-msg">{fieldErrors.customer_email}</span>
                  )}
                </div>
              </div>

              <div className="form-field-group">
                <label htmlFor="shipping_address_line1" className="form-label">
                  Street Address Line 1 <span className="label-req">*</span>
                </label>
                <input
                  type="text"
                  id="shipping_address_line1"
                  name="shipping_address_line1"
                  value={formData.shipping_address_line1}
                  onChange={handleChange}
                  className={`editorial-input ${fieldErrors.shipping_address_line1 ? 'input-error' : ''}`}
                  placeholder="e.g. 14 Curzon Street"
                  required
                />
                {fieldErrors.shipping_address_line1 && (
                  <span className="field-error-msg">{fieldErrors.shipping_address_line1}</span>
                )}
              </div>

              <div className="form-field-group">
                <label htmlFor="shipping_address_line2" className="form-label">
                  Apartment, Suite, Unit (Optional)
                </label>
                <input
                  type="text"
                  id="shipping_address_line2"
                  name="shipping_address_line2"
                  value={formData.shipping_address_line2}
                  onChange={handleChange}
                  className="editorial-input"
                  placeholder="e.g. Apt 4B, Study Suite"
                />
              </div>

              <div className="form-grid-3col">
                <div className="form-field-group">
                  <label htmlFor="city" className="form-label">
                    City <span className="label-req">*</span>
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className={`editorial-input ${fieldErrors.city ? 'input-error' : ''}`}
                    placeholder="London"
                    required
                  />
                  {fieldErrors.city && (
                    <span className="field-error-msg">{fieldErrors.city}</span>
                  )}
                </div>

                <div className="form-field-group">
                  <label htmlFor="state_region" className="form-label">
                    State / Region <span className="label-req">*</span>
                  </label>
                  <input
                    type="text"
                    id="state_region"
                    name="state_region"
                    value={formData.state_region}
                    onChange={handleChange}
                    className={`editorial-input ${fieldErrors.state_region ? 'input-error' : ''}`}
                    placeholder="Greater London"
                    required
                  />
                  {fieldErrors.state_region && (
                    <span className="field-error-msg">{fieldErrors.state_region}</span>
                  )}
                </div>

                <div className="form-field-group">
                  <label htmlFor="postal_code" className="form-label">
                    Postal Code <span className="label-req">*</span>
                  </label>
                  <input
                    type="text"
                    id="postal_code"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleChange}
                    className={`editorial-input ${fieldErrors.postal_code ? 'input-error' : ''}`}
                    placeholder="W1J 5HN"
                    required
                  />
                  {fieldErrors.postal_code && (
                    <span className="field-error-msg">{fieldErrors.postal_code}</span>
                  )}
                </div>
              </div>

              <div className="form-field-group">
                <label htmlFor="country" className="form-label">
                  Country <span className="label-req">*</span>
                </label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className={`editorial-input ${fieldErrors.country ? 'input-error' : ''}`}
                  placeholder="United Kingdom"
                  required
                />
                {fieldErrors.country && (
                  <span className="field-error-msg">{fieldErrors.country}</span>
                )}
              </div>
            </div>

            {/* Step 2: Dummy Payment Simulation */}
            <div className="checkout-card-box payment-card-box">
              <div className="card-box-header">
                <span className="box-step-badge">2</span>
                <h2 className="box-title">Settlement & Verification</h2>
              </div>

              <div className="demo-payment-banner" role="status">
                <div className="demo-payment-emblem">✦</div>
                <div className="demo-payment-prose">
                  <strong>Simulated Bookstore Settlement:</strong> This is a demonstration transaction.
                  No actual currency or financial credentials will be collected. Your order will be confirmed
                  and archived immediately in our Django backend.
                </div>
              </div>

              <div className="payment-options-group">
                <label className="payment-radio-label active-option">
                  <input
                    type="radio"
                    name="payment_method"
                    value="demo_card"
                    checked={formData.payment_method === 'demo_card'}
                    onChange={handleChange}
                  />
                  <div className="radio-content">
                    <span className="radio-title">AETHERIUM House Reader Folio (Demo)</span>
                    <span className="radio-sub">Instant zero-risk order confirmation & inventory deduction</span>
                  </div>
                  <span className="radio-badge">Simulated</span>
                </label>
              </div>
            </div>

            {/* Submit Action */}
            <div className="checkout-submit-bar">
              <Button
                type="submit"
                variant="burgundy"
                size="lg"
                disabled={submitting}
                className="checkout-place-order-btn"
                id="btn-confirm-order"
                iconRight={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                }
              >
                {submitting ? 'Archiving Acquisition...' : `Confirm Acquisition ($${cart.subtotal})`}
              </Button>

              <p className="checkout-guarantee-note">
                By confirming, your volumes will be verified and reserved in the archives.
              </p>
            </div>
          </form>
        </section>

        {/* Right Column: Order Review Summary */}
        <aside className="checkout-summary-section">
          <div className="checkout-summary-box">
            <h2 className="checkout-summary-heading">Review Folio Items</h2>

            <div className="checkout-items-mini-list">
              {items.map((item) => (
                <div key={item.id} className="mini-item-row">
                  <div className="mini-item-cover">
                    {item.book.cover_image ? (
                      <img src={item.book.cover_image} alt={item.book.title} />
                    ) : (
                      <div className="mini-jacket-fallback">✦</div>
                    )}
                  </div>
                  <div className="mini-item-info">
                    <h3 className="mini-item-title">{item.book.title}</h3>
                    <p className="mini-item-author">by {item.book.author}</p>
                    <span className="mini-item-qty">Qty: {item.quantity}</span>
                  </div>
                  <div className="mini-item-total">
                    ${item.subtotal}
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-summary-divider" />

            <div className="checkout-breakdown">
              <div className="summary-row">
                <span className="summary-label">Items Subtotal</span>
                <span className="summary-value" id="checkout-subtotal">${cart.subtotal}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Archival Dispatch</span>
                <span className="summary-value summary-value-free">Complimentary</span>
              </div>
            </div>

            <div className="cart-summary-divider" />

            <div className="summary-total-row">
              <span className="total-label">Final Acquisition Total</span>
              <span className="total-amount" id="checkout-final-total">${cart.subtotal}</span>
            </div>

            <div className="checkout-back-link-wrapper">
              <Link to="/cart" className="cart-continue-link">
                ← Return to Shopping Bag
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
