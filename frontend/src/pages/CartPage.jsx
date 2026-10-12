import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useCart } from '../context/useCart';
import CartItem from '../components/CartItem';
import CartSummary from '../components/CartSummary';
import LoadingState from '../components/LoadingState';
import Button from '../components/Button';

gsap.registerPlugin(useGSAP);

export default function CartPage() {
  const {
    cart,
    loading,
    error,
    activeItemAction,
    refreshCart,
    updateItem,
    removeItem,
    clearAllItems,
  } = useCart();

  const [clearing, setClearing] = useState(false);
  const [localFeedback, setLocalFeedback] = useState(null);
  const pageRef = useRef(null);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.from('.cart-anim-entry', {
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.7,
      ease: 'power3.out',
    });
  }, { scope: pageRef, dependencies: [cart.items.length] });

  const handleUpdateQuantity = async (itemId, quantity) => {
    setLocalFeedback(null);
    const result = await updateItem(itemId, quantity);
    if (!result.success) {
      setLocalFeedback({ type: 'error', message: result.error });
    }
  };

  const handleRemove = async (itemId) => {
    setLocalFeedback(null);
    const result = await removeItem(itemId);
    if (!result.success) {
      setLocalFeedback({ type: 'error', message: result.error });
    }
  };

  const handleClearCart = async () => {
    if (window.confirm('Are you sure you wish to remove all books from your shopping bag?')) {
      setClearing(true);
      setLocalFeedback(null);
      const result = await clearAllItems();
      setClearing(false);
      if (!result.success) {
        setLocalFeedback({ type: 'error', message: result.error });
      }
    }
  };

  const items = cart?.items || [];
  const isEmpty = items.length === 0;

  return (
    <div ref={pageRef} className="editorial-cart-page store-container">
      {/* Breadcrumb Navigation */}
      <nav className="editorial-breadcrumbs cart-anim-entry" aria-label="Breadcrumbs">
        <Link to="/" className="breadcrumb-crumb">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active" aria-current="page">Shopping Bag</span>
      </nav>

      {/* Page Header */}
      <header className="cart-page-header cart-anim-entry">
        <span className="cart-header-kicker">AETHERIUM FOLIO</span>
        <h1 className="cart-header-title">Your Reading Bag</h1>
        <p className="cart-header-subtitle">
          Carefully preserved editions awaiting your personal collection.
        </p>
      </header>

      {/* Global & Local Feedback Alerts */}
      {(error || localFeedback) && (
        <div
          className={`cart-alert-banner ${localFeedback?.type === 'error' || error ? 'alert-error' : 'alert-success'} cart-anim-entry`}
          role="alert"
        >
          <span className="alert-icon">⚠️</span>
          <span className="alert-text">{localFeedback?.message || error}</span>
          <button
            type="button"
            className="alert-dismiss-btn"
            onClick={() => {
              setLocalFeedback(null);
              if (error) refreshCart();
            }}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && isEmpty ? (
        <div className="cart-loading-box">
          <LoadingState message="Retrieving your reading folio from archives..." count={2} />
        </div>
      ) : isEmpty ? (
        /* Empty Bag State */
        <div className="cart-empty-state cart-anim-entry" id="cart-empty-state">
          <div className="empty-state-emblem">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2 className="empty-state-title">Your Reading Bag is Empty</h2>
          <p className="empty-state-prose">
            You have not yet selected any volumes for your personal library. Explore our catalogued first editions, literary fiction, and rare discoveries.
          </p>
          <Button
            to="/books"
            variant="burgundy"
            size="lg"
            className="empty-state-cta-btn"
            id="btn-empty-browse-books"
          >
            Explore Curated Volumes
          </Button>
        </div>
      ) : (
        /* Populated Bag Layout */
        <div className="cart-main-grid cart-anim-entry">
          {/* Left Column: Items List */}
          <div className="cart-items-section">
            <div className="cart-items-column-header">
              <span className="col-header-item">Book Edition</span>
              <span className="col-header-qty">Quantity</span>
              <span className="col-header-total">Subtotal</span>
            </div>

            <div className="cart-items-list" role="list">
              {items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemove={handleRemove}
                  isMutating={activeItemAction === item.id}
                />
              ))}
            </div>
          </div>

          {/* Right Column: Order Summary */}
          <div className="cart-summary-section">
            <CartSummary
              cart={cart}
              onClearCart={handleClearCart}
              isClearing={clearing}
            />
          </div>
        </div>
      )}
    </div>
  );
}
