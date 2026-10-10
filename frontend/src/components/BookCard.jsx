import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Editorial texture & palette generator for placeholder book jackets
 */
const getJacketStyle = (categoryName = '', title = '') => {
  const hash = (categoryName + title).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const palettes = [
    { bg: '#331520', spine: '#431E2B', gold: '#B89A65', pattern: 'radial-gradient(#B89A65 0.5px, transparent 0.5px)' },
    { bg: '#1C2922', spine: '#233F34', gold: '#C2A370', pattern: 'radial-gradient(#C2A370 0.5px, transparent 0.5px)' },
    { bg: '#2B231D', spine: '#3B3028', gold: '#BA9863', pattern: 'radial-gradient(#BA9863 0.5px, transparent 0.5px)' },
    { bg: '#1E232A', spine: '#28303A', gold: '#A89474', pattern: 'radial-gradient(#A89474 0.5px, transparent 0.5px)' },
  ];
  return palettes[hash % palettes.length];
};

export default function BookCard({ book }) {
  if (!book) return null;

  const hasDiscount = Boolean(
    book.discount_price &&
    Number(book.discount_price) < Number(book.price)
  );

  const isOutOfStock = book.stock_quantity === 0;
  const isLowStock = book.stock_quantity > 0 && book.stock_quantity <= 3;
  const jacket = getJacketStyle(book.category_name, book.title);

  return (
    <article className="editorial-book-card" id={`book-card-${book.id}`}>
      {/* Cover / Placeholder Section */}
      <Link to={`/books/${book.id}`} className="card-cover-frame" tabIndex={-1}>
        {book.cover_image ? (
          <img
            src={book.cover_image}
            alt={`Cover of ${book.title}`}
            className="card-cover-image"
            loading="lazy"
          />
        ) : (
          <div
            className="card-cover-jacket"
            style={{
              backgroundColor: jacket.bg,
              backgroundImage: jacket.pattern,
              backgroundSize: '12px 12px',
            }}
          >
            <div className="jacket-spine" style={{ backgroundColor: jacket.spine }} />
            <div className="jacket-content">
              <div className="jacket-ornament" style={{ color: jacket.gold }}>
                ✦
              </div>
              <div className="jacket-rule" style={{ backgroundColor: jacket.gold }} />
              <h4 className="jacket-title">{book.title}</h4>
              <p className="jacket-author">{book.author}</p>
              {book.category_name && (
                <span className="jacket-category" style={{ color: jacket.gold }}>
                  {book.category_name}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Badges Overlay */}
        <div className="card-badge-rack">
          {book.is_bestseller && (
            <span className="badge badge-bestseller">Bestseller</span>
          )}
          {book.is_featured && !book.is_bestseller && (
            <span className="badge badge-featured">Featured</span>
          )}
          {book.is_new_arrival && (
            <span className="badge badge-new">New</span>
          )}
          {hasDiscount && (
            <span className="badge badge-sale">Sale</span>
          )}
        </div>
      </Link>

      {/* Book Metadata Block */}
      <div className="card-info-block">
        {book.category_name && (
          <div className="card-genre-row">
            {book.category_slug ? (
              <Link to={`/categories/${book.category_slug}`} className="card-genre-link">
                {book.category_name}
              </Link>
            ) : (
              <span className="card-genre-text">{book.category_name}</span>
            )}
          </div>
        )}

        <h3 className="card-title">
          <Link to={`/books/${book.id}`} title={book.title} id={`book-title-${book.id}`}>
            {book.title}
          </Link>
        </h3>

        <p className="card-author">by {book.author}</p>

        {/* Pricing Block */}
        <div className="card-price-row">
          {hasDiscount ? (
            <div className="price-duo">
              <span className="price-current discount-price">${book.discount_price}</span>
              <span className="price-struck">${book.price}</span>
            </div>
          ) : (
            <span className="price-current">${book.price}</span>
          )}
        </div>

        {/* Card Footer: Stock & Details Action */}
        <div className="card-footer-row">
          <span
            className={`card-stock-pill ${
              isOutOfStock ? 'stock-out' : isLowStock ? 'stock-low' : 'stock-in'
            }`}
          >
            {isOutOfStock ? 'Out of Stock' : isLowStock ? `Only ${book.stock_quantity} left` : 'In Stock'}
          </span>

          <Link
            to={`/books/${book.id}`}
            className="card-details-arrow-link"
            id={`btn-view-${book.id}`}
            aria-label={`View details for ${book.title}`}
          >
            Details <span className="arrow-glyph">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
