import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getOrderByReference } from '../api/orders';
import Button from '../components/Button';
import LoadingState from '../components/LoadingState';

gsap.registerPlugin(useGSAP);

export default function OrderDetailPage() {
  const { reference } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pageRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    getOrderByReference(reference, controller.signal)
      .then((data) => {
        if (isMounted) setOrder(data);
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        console.error('Failed to load order folio:', err);
        if (isMounted) {
          if (err.response?.status === 404) {
            setError('This acquisition folio does not exist or does not belong to your account.');
          } else {
            setError('Unable to load order details. Please verify your connection.');
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [reference]);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.from('.order-detail-anim-entry', {
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.7,
      ease: 'power3.out',
    });
  }, { scope: pageRef, dependencies: [order] });

  const formatDate = (dateString) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="store-container section-pad">
        <LoadingState message="Retrieving acquisition folio from archives..." count={3} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="editorial-order-detail-page store-container" ref={pageRef}>
        <div className="cart-alert-banner alert-error">
          <span className="alert-icon">⚠️</span>
          <span className="alert-text">{error || 'Order could not be found.'}</span>
        </div>
        <div style={{ marginTop: '2rem' }}>
          <Button to="/account/orders" variant="burgundy" size="lg">
            ← Return to Order History
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="editorial-order-detail-page store-container">
      {/* Breadcrumb Navigation */}
      <nav className="editorial-breadcrumbs order-detail-anim-entry" aria-label="Breadcrumbs">
        <Link to="/" className="breadcrumb-crumb">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to="/account" className="breadcrumb-crumb">Reader Profile</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to="/account/orders" className="breadcrumb-crumb">Acquisition History</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active" aria-current="page">{order.reference}</span>
      </nav>

      {/* Header */}
      <header className="order-detail-header order-detail-anim-entry">
        <div className="header-meta-cluster">
          <span className="cart-header-kicker">ACQUISITION FOLIO</span>
          <h1 className="cart-header-title">{order.reference}</h1>
          <p className="order-recorded-time">
            Catalogued on {formatDate(order.created_at)}
          </p>
        </div>

        <div className="header-status-pills">
          <div className="status-pill-group">
            <span className="pill-group-label">Order Status:</span>
            <span className={`status-pill status-${order.order_status}`}>{order.order_status}</span>
          </div>
          <div className="status-pill-group">
            <span className="pill-group-label">Settlement:</span>
            <span className="status-pill status-paid">{order.payment_status}</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="order-detail-main-grid order-detail-anim-entry">
        {/* Left Column: Purchased Items */}
        <section className="order-items-column">
          <div className="checkout-card-box">
            <h2 className="box-title">Purchased Editions Snapshot ({order.item_count} items)</h2>

            <div className="order-items-table-list" role="list">
              {order.items.map((item) => (
                <article key={item.id} className="confirmed-item-row" id={`detail-item-${item.id}`}>
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

            <div className="cart-summary-divider" style={{ margin: '1.5rem 0' }} />

            <div className="order-financial-ledger">
              <div className="summary-row">
                <span className="summary-label">Items Subtotal</span>
                <span className="summary-value">${order.subtotal}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Archival Dispatch</span>
                <span className="summary-value summary-value-free">Complimentary</span>
              </div>
              <div className="summary-total-row" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                <span className="total-label">Total Amount Paid</span>
                <span className="total-amount">${order.total_amount}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Dispatch & Settlement Info */}
        <aside className="order-sidebar-column">
          <div className="checkout-card-box">
            <h2 className="box-title">Dispatch Details</h2>
            <div className="dispatch-spec-stack">
              <div className="dispatch-spec-item">
                <span className="spec-label">Customer</span>
                <span className="spec-val">{order.customer_name}</span>
              </div>
              <div className="dispatch-spec-item">
                <span className="spec-label">Email</span>
                <span className="spec-val">{order.customer_email}</span>
              </div>
              <div className="dispatch-spec-item">
                <span className="spec-label">Destination Address</span>
                <div className="spec-address-block">
                  <div>{order.shipping_address_line1}</div>
                  {order.shipping_address_line2 && <div>{order.shipping_address_line2}</div>}
                  <div>{order.city}, {order.state_region} {order.postal_code}</div>
                  <div>{order.country}</div>
                </div>
              </div>
              <div className="dispatch-spec-item">
                <span className="spec-label">Payment Method</span>
                <span className="spec-val">{order.payment_method} (Simulated)</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Button to="/account/orders" variant="outline" size="lg">
              ← Return to All Orders
            </Button>
            <Button to="/books" variant="burgundy" size="lg">
              Explore More Volumes
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
