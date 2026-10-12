import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getBookById, getBookAiSummary, getRelatedBooks } from '../api/books';
import { useAuth } from '../context/useAuth';
import { useCart } from '../context/useCart';
import Button from '../components/Button';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import BookGrid from '../components/BookGrid';

gsap.registerPlugin(useGSAP);

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { addItem } = useCart();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartFeedback, setCartFeedback] = useState(null);

  // Phase 7: Groq AI Summary state
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Phase 8: Related books recommendation state
  const [relatedBooks, setRelatedBooks] = useState([]);

  const containerRef = useRef(null);

  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setLoading(true);
    setError(null);
    setQuantity(1);
    setCartFeedback(null);
    setAiSummary(null);
    setAiLoading(false);
    setAiError(null);
    setRelatedBooks([]);
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

    // Fetch related volumes (Phase 8)
    getRelatedBooks(id, 4, controller.signal)
      .then((data) => {
        setRelatedBooks(data || []);
      })
      .catch((err) => {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
        console.warn('Could not load related books:', err);
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

  const handleGenerateAiSummary = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError(null);

    try {
      const data = await getBookAiSummary(book.id);
      setAiSummary(data);
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      console.error('AI summary error:', err);
      const serverMsg = err.response?.data?.error;
      setAiError(
        serverMsg || 'Unable to generate summary at this time. Please check the backend connection and try again.'
      );
    } finally {
      setAiLoading(false);
    }
  };

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

            {/* Quantity and Cart Button Action */}
            <div className="detail-action-cluster">
              {!isOutOfStock && (
                <div className="detail-quantity-container">
                  <span className="detail-qty-label">Quantity</span>
                  <div className="quantity-stepper" role="group" aria-label="Book quantity">
                    <button
                      type="button"
                      className="stepper-btn stepper-btn-minus"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1 || addingToCart}
                      aria-label="Decrease quantity"
                      id="btn-detail-dec"
                    >
                      −
                    </button>
                    <span className="stepper-value" id="detail-qty-val">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      className="stepper-btn stepper-btn-plus"
                      onClick={() => setQuantity((q) => Math.min(book.stock_quantity, q + 1))}
                      disabled={quantity >= book.stock_quantity || addingToCart}
                      aria-label="Increase quantity"
                      id="btn-detail-inc"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <Button
                variant="burgundy"
                size="lg"
                magnetic={!isOutOfStock}
                onClick={async () => {
                  if (!isAuthenticated) {
                    navigate('/login', { state: { from: location } });
                    return;
                  }
                  if (isOutOfStock || addingToCart) return;

                  setAddingToCart(true);
                  setCartFeedback(null);
                  const result = await addItem(book.id, quantity);
                  setAddingToCart(false);

                  if (result.success) {
                    setCartFeedback({
                      type: 'success',
                      message: `${quantity} ${quantity === 1 ? 'copy' : 'copies'} added to your reading bag.`,
                    });
                  } else {
                    setCartFeedback({
                      type: 'error',
                      message: result.error || 'Failed to add volume to your bag.',
                    });
                  }
                }}
                disabled={isOutOfStock || addingToCart}
                className="detail-add-bag-btn"
                id="btn-add-to-cart"
                iconLeft={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                }
              >
                {isOutOfStock
                  ? 'Out of Stock'
                  : addingToCart
                  ? 'Adding to Bag...'
                  : 'Add to Bag'}
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

            {/* Cart Operation Feedback */}
            {cartFeedback && (
              <div
                className={`detail-cart-feedback-banner ${
                  cartFeedback.type === 'success' ? 'feedback-success' : 'feedback-error'
                }`}
                role="status"
                id="detail-cart-feedback"
              >
                <div className="feedback-content">
                  <span className="feedback-icon">
                    {cartFeedback.type === 'success' ? '✓' : '⚠️'}
                  </span>
                  <span className="feedback-message">{cartFeedback.message}</span>
                </div>
                {cartFeedback.type === 'success' && (
                  <Link to="/cart" className="feedback-view-cart-link" id="link-feedback-view-bag">
                    View Reading Bag →
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setCartFeedback(null)}
                  className="feedback-dismiss-btn"
                  aria-label="Dismiss feedback"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Synopsis Description */}
          <section className="detail-synopsis-section detail-anim-fade">
            <h2 className="detail-section-subhead">About This Edition</h2>
            <div className="detail-prose-description">
              {(book.description || 'No formal synopsis catalogued for this edition.').split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>

          {/* AETHERIUM AI Literary Synopsis (Phase 7 - Groq) */}
          <section className="detail-ai-summary-section detail-anim-fade" aria-labelledby="ai-summary-heading">
            <div className="ai-summary-card">
              <div className="ai-summary-header">
                <div className="ai-summary-title-cluster">
                  <span className="ai-sparkle-icon" aria-hidden="true">✦</span>
                  <h2 id="ai-summary-heading" className="ai-summary-title">
                    AETHERIUM Intelligence Synopsis
                  </h2>
                </div>
                <div className="ai-summary-meta-badges">
                  <span className="ai-provider-badge">
                    Groq Intelligence
                  </span>
                  {aiSummary?.cached && (
                    <span className="ai-cached-badge" title="Retrieved instantaneously from archive cache">
                      Archived
                    </span>
                  )}
                </div>
              </div>

              <p className="ai-summary-disclaimer">
                Synthesized on demand from verified catalogue records to assist your reading acquisition.
              </p>

              {/* Initial Action State */}
              {!aiSummary && !aiLoading && !aiError && (
                <div className="ai-summary-cta-box">
                  <p className="ai-summary-prompt-text">
                    {book.description && book.description.trim().length >= 15
                      ? 'Request an AI-generated editorial synopsis synthesizing core themes and catalogue notes.'
                      : 'Catalogue details for this edition are brief. The AI summary will synthesize what is known from publisher and title records.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateAiSummary}
                    className="btn-editorial-ai-generate"
                    id="btn-generate-ai-summary"
                  >
                    <span className="btn-ai-icon" aria-hidden="true">✦</span>
                    <span>Generate AI Summary</span>
                  </button>
                </div>
              )}

              {/* Loading State */}
              {aiLoading && (
                <div className="ai-summary-loading-box" role="status" aria-live="polite">
                  <div className="ai-summary-spinner" />
                  <p className="ai-summary-loading-text">
                    Consulting AETHERIUM literary intelligence via Groq...
                  </p>
                </div>
              )}

              {/* Error State */}
              {aiError && !aiLoading && (
                <div className="ai-summary-error-box" role="alert">
                  <div className="ai-summary-error-content">
                    <span className="ai-error-icon" aria-hidden="true">⚠️</span>
                    <p className="ai-error-message">{aiError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAiSummary}
                    className="btn-editorial-ai-retry"
                    id="btn-retry-ai-summary"
                  >
                    Retry Generation
                  </button>
                </div>
              )}

              {/* Generated Result State */}
              {aiSummary && !aiLoading && (
                <div className="ai-summary-body" aria-live="polite">
                  <div className="ai-summary-prose">
                    {aiSummary.summary.split('\n\n').map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                  <div className="ai-summary-footer">
                    <span className="ai-summary-colophon">
                      AI-generated summary based on available catalogue metadata • Powered by Groq
                    </span>
                    <Link
                      to={`/reading-assistant?bookId=${book.id}`}
                      className="ai-summary-discuss-link"
                      id="link-discuss-volume-with-assistant"
                    >
                      ✦ Discuss with AI Assistant →
                    </Link>
                  </div>
                </div>
              )}
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

      {/* You May Also Like / Related Volumes (Phase 8) */}
      {relatedBooks.length > 0 && (
        <section className="detail-related-section detail-anim-fade" aria-labelledby="related-volumes-heading">
          <div className="related-section-header">
            <div className="related-kicker-cluster">
              <span className="related-crest-sparkle">✦</span>
              <span className="related-kicker">CURATED COMPANIONS</span>
            </div>
            <h2 id="related-volumes-heading" className="related-headline">You May Also Like</h2>
            <p className="related-subtitle">
              Other distinguished volumes sharing disciplinary themes or authorship with {book.title}.
            </p>
          </div>
          <BookGrid books={relatedBooks} />
        </section>
      )}
    </div>
  );
}
