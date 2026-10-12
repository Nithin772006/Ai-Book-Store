import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getCategories } from '../api/books';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

gsap.registerPlugin(useGSAP);

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [retryTrigger, setRetryTrigger] = useState(0);

  const containerRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    const fetchCategories = async () => {
      try {
        const data = await getCategories(controller.signal);
        if (!ignore) {
          const list = Array.isArray(data) ? data : (data?.results || []);
          setCategories(list);
          setError(null);
        }
      } catch (err) {
        if (!ignore && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error('Failed to load categories:', err);
          setError('Unable to retrieve discipline archives. Please verify the API connection.');
          setCategories([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchCategories();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [retryTrigger]);

  const filteredCategories = useMemo(() => {
    if (!searchFilter.trim()) return categories;
    const q = searchFilter.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name?.toLowerCase().includes(q) ||
        cat.description?.toLowerCase().includes(q)
    );
  }, [categories, searchFilter]);

  useGSAP(() => {
    if (loading || filteredCategories.length === 0) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.from('.editorial-category-card', {
      opacity: 0,
      y: 20,
      stagger: 0.06,
      duration: 0.5,
      ease: 'power2.out',
    });
  }, { scope: containerRef, dependencies: [filteredCategories, loading] });

  return (
    <div ref={containerRef} className="editorial-category-page store-container">
      {/* Breadcrumb Navigation */}
      <nav className="editorial-breadcrumbs" aria-label="Breadcrumbs">
        <Link to="/" className="breadcrumb-crumb">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active" aria-current="page">Categories</span>
      </nav>

      {/* Editorial Header */}
      <header className="category-editorial-header">
        <div className="category-header-text">
          <span className="editorial-kicker">DISCIPLINARY ARCHIVES</span>
          <h1 className="category-main-title">Browse Disciplines & Categories</h1>
          <p className="category-intro-summary">
            Explore our curated library catalogued across specialized intellectual fields,
            foundational computer sciences, and design disciplines.
          </p>
        </div>

        {!loading && !error && (
          <div className="category-volume-count-badge">
            <span className="count-num">{categories.length}</span>{' '}
            {categories.length === 1 ? 'Curated Discipline' : 'Curated Disciplines'}
          </div>
        )}
      </header>

      {/* Filter / Search Bar */}
      {!loading && !error && categories.length > 0 && (
        <section className="editorial-filter-panel" aria-label="Category Filter">
          <div className="filter-search-container">
            <div className="search-input-wrap">
              <svg
                className="search-input-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter disciplines by name or subject matter..."
                className="search-field"
                id="categories-filter-input"
                aria-label="Filter disciplines"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="search-clear-btn"
                  aria-label="Clear category filter"
                  title="Clear filter"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Main Results Display */}
      <section className="catalogue-results-stage" aria-live="polite">
        {loading && (
          <LoadingState message="Retrieving library disciplines..." count={4} />
        )}

        {error && !loading && (
          <ErrorState
            title="Disciplines Catalogue Unavailable"
            message={error}
            onRetry={() => {
              setLoading(true);
              setError(null);
              setRetryTrigger((prev) => prev + 1);
            }}
          />
        )}

        {!loading && !error && categories.length === 0 && (
          <EmptyState
            title="No Disciplines Catalogued"
            message="No active category archives are currently available in the bookstore."
            actionText="Return to Home"
            onAction={() => window.location.assign('/')}
          />
        )}

        {!loading && !error && categories.length > 0 && filteredCategories.length === 0 && (
          <EmptyState
            title="No Matching Disciplines Found"
            message={`No disciplines match "${searchFilter}". Try a broader term or reset the filter.`}
            actionText="Reset Filter"
            onAction={() => setSearchFilter('')}
          />
        )}

        {!loading && !error && filteredCategories.length > 0 && (
          <div className="editorial-category-grid" id="categories-grid-container">
            {filteredCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/categories/${cat.slug}`}
                className="editorial-category-card"
                id={`cat-card-${cat.slug}`}
              >
                <div className="cat-card-header">
                  <span className="cat-card-ornament">§</span>
                  {cat.books_count !== undefined && (
                    <span className="cat-card-volume-count">
                      {cat.books_count} {cat.books_count === 1 ? 'Volume' : 'Volumes'}
                    </span>
                  )}
                </div>
                <h2 className="cat-card-name" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                  {cat.name}
                </h2>
                {cat.description && (
                  <p className="cat-card-summary">{cat.description}</p>
                )}
                <div className="cat-card-footer" style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                  <span className="cat-card-cta">Browse Archive</span>
                  <span className="cat-card-arrow">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
