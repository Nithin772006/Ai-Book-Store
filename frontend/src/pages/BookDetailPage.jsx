import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getBookById } from '../api/books';
import Button from '../components/Button';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

gsap.registerPlugin(useGSAP);

export default function BookDetailPage() {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartNotice, setCartNotice] = useState(false);

  const containerRef = useRef(null);

  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setLoading(true);
    setError(null);
    setCartNotice(false);
  }

  useEffect(() => {
    const controller = new AbortController();

    getBookById(id, controller.signal)
      .then((data) => {
        setBook(data);
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        console.error('Book detail fetch error:', err);
        if (err.response && err.response.status === 404) {
          setError('This volume could not be found or is currently inactive in the archives.');
        } else {
          setError('Failed to load volume details. Please check the backend connection.');
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [id]);

  useGSAP(() => {
    if (!book || loading) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.from('.detail-anim-fade', {
      opacity: 0,
      y: 24,
      stagger: 0.1,
      duration: 0.8,
      ease: 'power3.out',
    });
  }, { scope: containerRef, dependencies: [book, loading] });

  if (loading) {
    return (
      <div className="store-container section-pad">
        <LoadingState message="Retrieving manuscript details from the archive..." count={1} />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="store-container section-pad">
        <ErrorState
          title="Volume Unavailable"
          message={error || 'The requested volume is not catalogued in this edition.'}
        />
        <div className="detail-back-bar">
          <Link to="/books" className="editorial-arrow-back-link">
            ← Return to Bookstore Catalogue
          </Link>
        </div>
      </div>
    );
  }

  const hasDiscount = Boolean(
    book.discount_price &&
    Number(book.discount_price) < Number(book.price)
  );

  const discountAmount = hasDiscount
    ? (Number(book.price) - Number(book.discount_price)).toFixed(2)
    : null;

  const discountPercent = hasDiscount
    ? Math.round(((Number(book.price) - Number(book.discount_price)) / Number(book.price)) * 100)
    : null;

  const isOutOfStock = book.stock_quantity === 0;

  return (
    <div ref={containerRef} className="editorial-detail-page store-container">
      {/* Breadcrumb Navigation */}
      <nav className="editorial-breadcrumbs" aria-label="Breadcrumb Trail">
        <Link to="/" className="breadcrumb-crumb">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to="/books" className="breadcrumb-crumb">Catalogue</Link>
        <span className="breadcrumb-separator">/</span>
        {book.category_slug && (
          <>
            <Link to={`/categories/${book.category_slug}`} className="breadcrumb-crumb">
              {book.category_name}
            </Link>
            <span className="breadcrumb-separator">/</span>
          </>
        )}
        <span className="breadcrumb-active" aria-current="page">{book.title}</span>
      </nav>

      {/* Main Two-Column Showcase Layout */}
      <div className="editorial-detail-grid">
        {/* Left Column: Cover & Jacket Presentation */}
        <div className="detail-cover-presentation">
          <div className="cover-frame-shadow detail-anim-fade">
            {book.cover_image ? (
              <img
                src={book.cover_image}
                alt={`Cover of ${book.title}`}
                className="detail-actual-cover-img"
              />
            ) : (
              <div className="detail-jacket-embossed">
                <div className="jacket-emboss-spine" />
                <div className="jacket-emboss-body">
                  <div className="jacket-crest-symbol">✦</div>
                  <div className="jacket-ornament-line" />
                  <h2 className="jacket-emboss-title">{book.title}</h2>
                  <p className="jacket-emboss-author">{book.author}</p>
                  <span className="jacket-emboss-category">{book.category_name}</span>
                </div>
              </div>
            )}

            {/* Badges Overlay */}
            <div className="detail-badges-cluster">
              {book.is_bestseller && (
                <span className="badge badge-bestseller">Bestseller</span>
              )}
              {book.is_featured && (
                <span className="badge badge-featured">Staff Selection</span>
              )}
              {book.is_new_arrival && (
                <span className="badge badge-new">New Arrival</span>
              )}
              {hasDiscount && (
                <span className="badge badge-sale">Save {discountPercent}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Title, Metadata, Pricing, Actions */}
        <div className="detail-content-presentation">
          {book.category_name && (
            <div className="detail-category-tag detail-anim-fade">
              {book.category_slug ? (
                <Link to={`/categories/${book.category_slug}`} className="category-kicker-link">
                  {book.category_name}
                </Link>
              ) : (
                <span className="category-kicker-text">{book.category_name}</span>
              )}
            </div>
          )}

          <h1 className="detail-headline-title detail-anim-fade">{book.title}</h1>

          <p className="detail-byline-author detail-anim-fade">
            Written by <span className="author-highlight">{book.author}</span>
          </p>

          {/* Pricing & Acquisition Box */}
          <div className="detail-acquisition-box detail-anim-fade">
            <div className="acquisition-price-row">
              {hasDiscount ? (
                <div className="detail-price-stack">
                  <span className="detail-price-sale">${book.discount_price}</span>
                  <span className="detail-price-regular-strike">${book.price}</span>
                  <span className="detail-savings-pill">
                    Save ${discountAmount} ({discountPercent}%)
                  </span>
                </div>
              ) : (
                <span className="detail-price-standard">${book.price}</span>
              )}
            </div>

            {/* Inventory Status Indicator */}
            <div className="detail-inventory-status">
              <span className={`inventory-dot ${isOutOfStock ? 'dot-out' : 'dot-in'}`} />
              <span className="inventory-label">
                {isOutOfStock
                  ? 'Currently Out of Stock'
                  : book.stock_quantity <= 3
                  ? `Low Stock — Only ${book.stock_quantity} copies remaining`
                  : `In Stock (${book.stock_quantity} copies available in warehouse)`}
              </span>
            </div>

            {/* Cart Button Action (Phase 3 -> 4 Bridge) */}
            <div className="detail-action-cluster">
              <Button
                variant="burgundy"
                size="lg"
                onClick={() => setCartNotice(true)}
                className="detail-add-bag-btn"
                id="btn-add-to-cart-preview"
                iconLeft={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                }
              >
                Add to Bag
              </Button>

              <Button
                to="/books"
                variant="outline"
                size="lg"
                className="detail-back-catalogue-btn"
              >
                Back to Catalogue
              </Button>
            </div>

            {cartNotice && (
              <div className="phase-cart-notice-banner" role="status">
                <span className="notice-icon">ℹ️</span>
                <div className="notice-text">
                  <strong>Phase 3 Scope:</strong> Cart persistence, user sessions, and checkout flows
                  are introduced in <em>Phase 4</em>. Catalogue browsing is read-only.
                </div>
              </div>
            )}
          </div>

          {/* Synopsis Description */}
          <section className="detail-synopsis-section detail-anim-fade">
            <h2 className="detail-section-subhead">About This Edition</h2>
            <div className="detail-prose-description">
              {book.description.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>

          {/* Bibliographic Specifications Table */}
          <section className="detail-specifications-section detail-anim-fade">
            <h2 className="detail-section-subhead">Bibliographic Specifications</h2>
            <dl className="bibliographic-grid">
              <div className="spec-pair">
                <dt className="spec-title">ISBN</dt>
                <dd className="spec-detail">{book.isbn || 'Standard Edition'}</dd>
              </div>
              <div className="spec-pair">
                <dt className="spec-title">Publisher</dt>
                <dd className="spec-detail">{book.publisher || 'Independent Press'}</dd>
              </div>
              <div className="spec-pair">
                <dt className="spec-title">Publication Date</dt>
                <dd className="spec-detail">{book.publication_date || 'Current Edition'}</dd>
              </div>
              <div className="spec-pair">
                <dt className="spec-title">Language</dt>
                <dd className="spec-detail">{book.language || 'English'}</dd>
              </div>
              <div className="spec-pair">
                <dt className="spec-title">Discipline</dt>
                <dd className="spec-detail">{book.category_name}</dd>
              </div>
              <div className="spec-pair">
                <dt className="spec-title">Catalogue Reference</dt>
                <dd className="spec-detail">#{book.id}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
