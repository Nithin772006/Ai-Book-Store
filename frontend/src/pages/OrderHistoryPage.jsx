import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getCustomerOrders } from '../api/orders';
import Button from '../components/Button';
import LoadingState from '../components/LoadingState';

gsap.registerPlugin(useGSAP);

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pageRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    getCustomerOrders(controller.signal)
      .then((data) => {
        if (isMounted) setOrders(data || []);
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        console.error('Failed to load order history:', err);
        if (isMounted) setError('Unable to load your order folios at this time.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.from('.orders-anim-entry', {
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.7,
      ease: 'power3.out',
    });
  }, { scope: pageRef, dependencies: [loading, orders.length] });

  const formatDate = (dateString) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div ref={pageRef} className="editorial-orders-page store-container">
      {/* Breadcrumb Navigation */}
      <nav className="editorial-breadcrumbs orders-anim-entry" aria-label="Breadcrumbs">
        <Link to="/" className="breadcrumb-crumb">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to="/account" className="breadcrumb-crumb">Reader Profile</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active" aria-current="page">Acquisition History</span>
      </nav>

      {/* Header */}
      <header className="orders-page-header orders-anim-entry">
        <span className="cart-header-kicker">AETHERIUM ARCHIVES</span>
        <h1 className="cart-header-title">Your Acquisition Folios</h1>
        <p className="cart-header-subtitle">
          Historical records of your literary acquisitions, verified editions, and archival dispatches.
        </p>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="cart-alert-banner alert-error orders-anim-entry" role="alert">
          <span className="alert-icon">⚠️</span>
          <span className="alert-text">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="orders-loading-box">
          <LoadingState message="Retrieving your reader order archive..." count={3} />
        </div>
      ) : orders.length === 0 ? (
        /* Empty Orders State */
        <div className="orders-empty-state orders-anim-entry" id="orders-empty-state">
          <div className="empty-state-emblem">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h2 className="empty-state-title">No Orders Catalogued Yet</h2>
          <p className="empty-state-prose">
            You have not yet made any acquisitions in the bookstore. When you complete checkout, your order folios will be preserved here.
          </p>
          <Button to="/books" variant="burgundy" size="lg">
            Explore Curated Volumes
          </Button>
        </div>
      ) : (
        /* Populated Orders Table / Grid */
        <div className="orders-history-table-wrapper orders-anim-entry">
          <table className="orders-history-table">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Date</th>
                <th scope="col">Volumes</th>
                <th scope="col">Status</th>
                <th scope="col">Settlement</th>
                <th scope="col">Total</th>
                <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((ord) => (
                <tr key={ord.id} id={`order-row-${ord.reference}`}>
                  <td>
                    <Link
                      to={`/account/orders/${ord.reference}`}
                      className="order-reference-link"
                      title="View order folio"
                    >
                      {ord.reference}
                    </Link>
                  </td>
                  <td className="order-date-cell">{formatDate(ord.created_at)}</td>
                  <td>{ord.item_count} {ord.item_count === 1 ? 'volume' : 'volumes'}</td>
                  <td>
                    <span className={`status-pill status-${ord.order_status}`}>
                      {ord.order_status}
                    </span>
                  </td>
                  <td>
                    <span className="status-pill status-paid">
                      {ord.payment_status}
                    </span>
                  </td>
                  <td className="order-total-cell">${ord.total_amount}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      to={`/account/orders/${ord.reference}`}
                      className="order-view-btn"
                      id={`btn-view-order-${ord.reference}`}
                    >
                      Inspect Folio →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
