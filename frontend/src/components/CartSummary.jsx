import React from 'react';
import { Link } from 'react-router-dom';
import Button from './Button';

export default function CartSummary({
  cart,
  onClearCart,
  isClearing,
}) {
  const itemCount = cart?.item_count || 0;
  const subtotal = cart?.subtotal || '0.00';

  return (
    <aside className="editorial-cart-summary-card">
      <h2 className="cart-summary-heading">Order Summary</h2>

      <div className="cart-summary-breakdown">
        <div className="summary-row">
          <span className="summary-label">
            Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </span>
          <span className="summary-value" id="cart-summary-subtotal">
            ${subtotal}
          </span>
        </div>

        <div className="summary-row">
          <span className="summary-label">Curated Archival Packaging</span>
          <span className="summary-value summary-value-free">Complimentary</span>
        </div>

        <div className="summary-row">
          <span className="summary-label">Estimated Shipping</span>
          <span className="summary-value summary-subtext">Calculated at checkout</span>
        </div>
      </div>

      <div className="cart-summary-divider" />

      <div className="summary-total-row">
        <span className="total-label">Estimated Total</span>
        <span className="total-amount" id="cart-summary-total">
          ${subtotal}
        </span>
      </div>

      {/* Checkout Action Button */}
      <div className="cart-summary-actions">
        <Button
          to="/checkout"
          variant="burgundy"
          size="lg"
          className="cart-checkout-btn"
          id="btn-proceed-checkout"
          disabled={itemCount === 0}
          iconRight={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          }
        >
          Proceed to Checkout
        </Button>

        <div className="cart-summary-secondary-actions">
          <Link to="/books" className="cart-continue-link">
            ← Continue Browsing Books
          </Link>

          <button
            type="button"
            className="cart-clear-btn"
            onClick={onClearCart}
            disabled={isClearing || itemCount === 0}
            id="btn-clear-cart"
          >
            {isClearing ? 'Clearing...' : 'Clear Bag'}
          </button>
        </div>
      </div>

      {/* Trust & Guarantee Notes */}
      <div className="cart-assurance-notes">
        <div className="assurance-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Safe & Secure reader transactions</span>
        </div>
        <div className="assurance-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>First edition authenticity verified</span>
        </div>
      </div>
    </aside>
  );
}
