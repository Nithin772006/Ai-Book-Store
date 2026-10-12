import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Editorial texture & palette generator for placeholder book jackets
 */
const getJacketStyle = (title = '') => {
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const palettes = [
    { bg: '#331520', spine: '#431E2B', gold: '#B89A65' },
    { bg: '#1C2922', spine: '#233F34', gold: '#C2A370' },
    { bg: '#2B231D', spine: '#3B3028', gold: '#BA9863' },
    { bg: '#1E232A', spine: '#28303A', gold: '#A89474' },
  ];
  return palettes[hash % palettes.length];
};

export default function CartItem({ item, onUpdateQuantity, onRemove, isMutating }) {
  const { book, quantity, unit_price, subtotal } = item;
  const jacket = getJacketStyle(book.title);
  const maxStock = book.stock_quantity ?? 99;
  const isAtMaxStock = quantity >= maxStock;

  const handleDecrement = () => {
    if (quantity > 1 && !isMutating) {
      onUpdateQuantity(item.id, quantity - 1);
    }
  };

  const handleIncrement = () => {
    if (quantity < maxStock && !isMutating) {
      onUpdateQuantity(item.id, quantity + 1);
    }
  };

  return (
    <article className={`cart-item-row ${isMutating ? 'item-mutating' : ''}`} id={`cart-item-${item.id}`}>
      {/* Book Cover / Jacket */}
      <div className="cart-item-cover-wrapper">
        <Link to={`/books/${book.id}`} className="cart-item-cover-link">
          {book.cover_image ? (
            <img
              src={book.cover_image}
              alt={`Cover of ${book.title}`}
              className="cart-item-cover-img"
            />
          ) : (
            <div
              className="cart-item-jacket-placeholder"
              style={{ backgroundColor: jacket.bg }}
            >
              <div className="cart-jacket-spine" style={{ backgroundColor: jacket.spine }} />
              <div className="cart-jacket-crest" style={{ color: jacket.gold }}>✦</div>
            </div>
          )}
        </Link>
      </div>

      {/* Book Information */}
      <div className="cart-item-details">
        <div className="cart-item-header">
          <h3 className="cart-item-title">
            <Link to={`/books/${book.id}`}>{book.title}</Link>
          </h3>
          <p className="cart-item-author">by {book.author}</p>
        </div>

        {/* Price Information */}
        <div className="cart-item-pricing">
          <span className="cart-item-unit-price">${unit_price} each</span>
          {book.discount_price && Number(book.discount_price) < Number(book.price) && (
            <span className="cart-item-original-price">${book.price}</span>
          )}
        </div>

        {/* Stock warning if low stock or maxed */}
        {isAtMaxStock && (
          <p className="cart-item-stock-warning">
            Maximum available stock ({maxStock} copies) reached.
          </p>
        )}
      </div>

      {/* Stepper Quantity Selector */}
      <div className="cart-item-stepper-cell">
        <div className="quantity-stepper" role="group" aria-label="Item quantity">
          <button
            type="button"
            className="stepper-btn stepper-btn-minus"
            onClick={handleDecrement}
            disabled={quantity <= 1 || isMutating}
            aria-label="Decrease quantity"
            id={`btn-cart-dec-${item.id}`}
          >
            −
          </button>
          <span className="stepper-value" aria-live="polite" id={`cart-qty-${item.id}`}>
            {quantity}
          </span>
          <button
            type="button"
            className="stepper-btn stepper-btn-plus"
            onClick={handleIncrement}
            disabled={isAtMaxStock || isMutating}
            aria-label="Increase quantity"
            id={`btn-cart-inc-${item.id}`}
          >
            +
          </button>
        </div>
      </div>

      {/* Subtotal & Action */}
      <div className="cart-item-total-cell">
        <span className="cart-item-subtotal-price" id={`cart-subtotal-${item.id}`}>
          ${subtotal}
        </span>
        <button
          type="button"
          className="cart-item-remove-btn"
          onClick={() => onRemove(item.id)}
          disabled={isMutating}
          aria-label={`Remove ${book.title} from shopping bag`}
          id={`btn-cart-remove-${item.id}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span className="remove-label">Remove</span>
        </button>
      </div>
    </article>
  );
}
