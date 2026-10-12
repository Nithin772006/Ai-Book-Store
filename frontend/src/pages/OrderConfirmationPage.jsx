import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getOrderByReference } from '../api/orders';
import Button from '../components/Button';
import LoadingState from '../components/LoadingState';

gsap.registerPlugin(useGSAP);

export default function OrderConfirmationPage() {
  const { reference } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order);
  const [error, setError] = useState(null);
  const pageRef = useRef(null);

  useEffect(() => {
    if (!order && reference) {
      const controller = new AbortController();
      getOrderByReference(reference, controller.signal)
        .then((data) => setOrder(data))
        .catch((err) => {
          if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
          console.error('Failed to retrieve order confirmation:', err);
          setError('Unable to load order confirmation details. Please check your order history.');
        })
        .finally(() => setLoading(false));

      return () => controller.abort();
    }
  }, [order, reference]);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.from('.confirmation-anim-entry', {
      opacity: 0,
      y: 24,
      stagger: 0.12,
      duration: 0.8,
      ease: 'power3.out',
    });
  }, { scope: pageRef, dependencies: [order] });

  if (loading) {
    return (
      <div className="store-container section-pad">
        <LoadingState message="Retrieving your confirmed acquisition folio..." count={2} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="editorial-confirmation-page store-container" ref={pageRef}>
        <div className="cart-alert-banner alert-error">
          <span className="alert-icon">⚠️</span>
          <span className="alert-text">{error || 'Order could not be found.'}</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Button to="/account/orders" variant="burgundy" size="lg">
            View Your Order Folios
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="editorial-confirmation-page store-container">
      {/* Breadcrumb Navigation */}
      <nav className="editorial-breadcrumbs confirmation-anim-entry" aria-label="Breadcrumbs">
        <Link to="/" className="breadcrumb-crumb">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active" aria-current="page">Acquisition Confirmation</span>
      </nav>

      {/* Hero Confirmation Banner */}
      <div className="confirmation-hero-card confirmation-anim-entry">
        <div className="confirmation-crest-symbol">✦</div>
        <span className="confirmation-kicker">AETHERIUM ARCHIVES — RECEIPT OF ACQUISITION</span>
        <h1 className="confirmation-title">Thank You for Your Acquisition</h1>
        <p className="confirmation-subtitle">
          Your literary order has been successfully confirmed and entered into our catalogued dispatch archives.
        </p>

        <div className="confirmation-meta-rack">
          <div className="conf-meta-box">
            <span className="conf-meta-label">Order Reference</span>
            <span className="conf-meta-val" id="order-ref-badge">{order.reference}</span>
          </div>
          <div className="conf-meta-box">
            <span className="conf-meta-label">Acquisition Status</span>
            <span className="conf-meta-badge badge-confirmed">Confirmed</span>
          </div>
          <div className="conf-meta-box">
            <span className="conf-meta-label">Settlement</span>
            <span className="conf-meta-badge badge-paid">Paid (Demo)</span>
          </div>
          <div className="conf-meta-box">
            <span className="conf-meta-label">Total Amount</span>
            <span className="conf-meta-val highlight-total">${order.total_amount}</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout for Order Details */}
      <div className="confirmation-grid confirmation-anim-entry">
        {/* Left Column: Purchased Items */}
        <section className="confirmation-items-panel">
          <h2 className="panel-heading">Reserved Editions ({order.item_count} volumes)</h2>

          <div className="confirmed-items-list" role="list">
            {order.items.map((item) => (
              <article key={item.id} className="confirmed-item-row" id={`order-item-${item.id}`}>
                <div className="confirmed-item-cover">
                  {item.book_cover_image ? (
                    <img src={item.book_cover_image} alt={item.book_title} />
                  ) : (
                    <div className="mini-jacket-fallback">✦</div>
                  )}
                </div>

                <div className="confirmed-item-info">
                  <h3 className="confirmed-item-title">
                    {item.book_id ? (
                      <Link to={`/books/${item.book_id}`}>{item.book_title}</Link>
                    ) : (
                      item.book_title
                    )}
                  </h3>
                  <p className="confirmed-item-author">by {item.book_author || 'Unknown'}</p>
                  <span className="confirmed-item-qty">Quantity: {item.quantity}</span>
                </div>

                <div className="confirmed-item-pricing">
                  <span className="confirmed-unit-price">${item.unit_price} each</span>
                  <span className="confirmed-item-total">${item.subtotal}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="confirmed-financial-summary">
            <div className="summary-row">
              <span className="summary-label">Items Subtotal</span>
              <span className="summary-value">${order.subtotal}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Archival Dispatch</span>
              <span className="summary-value summary-value-free">Complimentary</span>
            </div>
            <div className="summary-total-row">
              <span className="total-label">Final Amount</span>
              <span className="total-amount">${order.total_amount}</span>
            </div>
          </div>
        </section>

        {/* Right Column: Dispatch & Customer Details */}
        <aside className="confirmation-details-panel">
          <div className="dispatch-detail-box">
            <h2 className="panel-heading">Dispatch Destination</h2>

            <div className="dispatch-spec-stack">
              <div className="dispatch-spec-item">
                <span className="spec-label">Recipient</span>
                <span className="spec-val">{order.customer_name}</span>
              </div>

              <div className="dispatch-spec-item">
                <span className="spec-label">Contact Email</span>
                <span className="spec-val">{order.customer_email}</span>
              </div>

              <div className="dispatch-spec-item">
                <span className="spec-label">Archival Address</span>
                <div className="spec-address-block">
                  <div>{order.shipping_address_line1}</div>
                  {order.shipping_address_line2 && <div>{order.shipping_address_line2}</div>}
                  <div>{order.city}, {order.state_region} {order.postal_code}</div>
                  <div>{order.country}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="confirmation-actions-box">
            <Button
              to="/account/orders"
              variant="burgundy"
              size="lg"
              className="conf-history-btn"
              id="btn-view-order-history"
            >
              View Order History
            </Button>

            <Button
              to="/books"
              variant="outline"
              size="lg"
              className="conf-browse-btn"
            >
              Continue Browsing Catalogue
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
