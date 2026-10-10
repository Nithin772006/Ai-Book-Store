import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getCategoryBooks, getCategories } from '../api/books';
import BookGrid from '../components/BookGrid';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

gsap.registerPlugin(useGSAP);

export default function CategoryPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const searchQuery = searchParams.get('search') || '';
  const selectedOrdering = searchParams.get('ordering') || '-created_at';
  const inStockOnly = searchParams.get('in_stock') === 'true';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [categoryInfo, setCategoryInfo] = useState(null);
  const [books, setBooks] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((cats) => {
        if (!isMounted) return;
        const currentCat = cats.find((c) => c.slug === slug);
        if (currentCat) {
          setCategoryInfo(currentCat);
        }
      })
      .catch((err) => console.warn('Could not load category metadata:', err));
    return () => { isMounted = false; };
  }, [slug]);

  const updateParams = useCallback((updates) => {
    setLoading(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, val]) => {
        if (val === null || val === undefined || val === '' || val === false) {
          next.delete(key);
        } else {
          next.set(key, String(val));
        }
      });
      if (!('page' in updates)) {
        next.delete('page');
      }
      return next;
    });
  }, [setSearchParams]);

  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    const loadCategoryBooks = async () => {
      try {
        const params = {
          search: searchQuery,
          ordering: selectedOrdering,
          in_stock: inStockOnly ? 'true' : undefined,
          page: currentPage,
        };

        const data = await getCategoryBooks(slug, params, controller.signal);
        if (!ignore) {
          setBooks(data.results || []);
          setTotalCount(data.count || 0);
          setHasNext(Boolean(data.next));
          setHasPrev(Boolean(data.previous));
        }
      } catch (err) {
        if (!ignore && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error('Failed to load category books:', err);
          if (err.response && err.response.status === 404) {
            setError('This discipline archive does not exist or has been retired from the catalogue.');
          } else {
            setError('Unable to load volumes for this discipline. Please verify the API connection.');
          }
          setBooks([]);
          setTotalCount(0);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadCategoryBooks();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [slug, searchQuery, selectedOrdering, inStockOnly, currentPage, retryTrigger]);

  useGSAP(() => {
    if (loading || books.length === 0) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.from('.editorial-book-card', {
      opacity: 0,
      y: 20,
      stagger: 0.05,
      duration: 0.5,
      ease: 'power2.out',
    });
  }, { scope: containerRef, dependencies: [books, loading] });

  return (
    <div ref={containerRef} className="editorial-category-page store-container">
      {/* Breadcrumb Trail */}
      <nav className="editorial-breadcrumbs" aria-label="Breadcrumbs">
        <Link to="/" className="breadcrumb-crumb">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <Link to="/books" className="breadcrumb-crumb">Catalogue</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active" aria-current="page">
          {categoryInfo ? categoryInfo.name : slug}
        </span>
      </nav>

      {/* Category Header Banner */}
      <header className="category-editorial-header">
        <div className="category-header-text">
          <span className="editorial-kicker">DISCIPLINE COLLECTION</span>
          <h1 className="category-main-title">
            {categoryInfo ? categoryInfo.name : slug.replace(/-/g, ' ')}
          </h1>
          {categoryInfo && categoryInfo.description && (
            <p className="category-intro-summary">{categoryInfo.description}</p>
          )}
        </div>

        {!loading && !error && (
          <div className="category-volume-count-badge">
            <span className="count-num">{totalCount}</span> {totalCount === 1 ? 'Volume Catalogued' : 'Volumes Catalogued'}
          </div>
        )}
      </header>

      {/* Filter and Search Controls */}
      <section className="editorial-filter-panel" aria-label="Category Controls">
        <div className="filter-search-container">
          <SearchBar
            initialValue={searchQuery}
            onSearch={(val) => updateParams({ search: val })}
            placeholder={`Search within ${categoryInfo ? categoryInfo.name : 'this discipline'}...`}
          />
        </div>

        <div className="filter-controls-row">
          <div className="filter-select-group">
            <label htmlFor="cat-sort-ordering" className="filter-label">Sort Order</label>
            <div className="select-wrapper">
              <select
                id="cat-sort-ordering"
                className="editorial-select"
                value={selectedOrdering}
                onChange={(e) => updateParams({ ordering: e.target.value })}
              >
                <option value="-created_at">Recently Catalogued</option>
                <option value="price">Price: Low to High</option>
                <option value="-price">Price: High to Low</option>
                <option value="title">Title: A to Z</option>
              </select>
            </div>
          </div>

          <div className="filter-pills-cluster">
            <label className="editorial-pill-checkbox">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => updateParams({ in_stock: e.target.checked })}
              />
              <span className="pill-text">In Stock Only</span>
            </label>
          </div>

          {(searchQuery || inStockOnly || selectedOrdering !== '-created_at') && (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setSearchParams(new URLSearchParams());
              }}
              className="editorial-reset-filters-btn"
            >
              Reset Filters
            </button>
          )}
        </div>
      </section>

      {/* Results Section */}
      <section className="catalogue-results-stage" aria-live="polite">
        {loading && (
          <LoadingState message="Retrieving discipline archives..." count={6} />
        )}

        {error && !loading && (
          <ErrorState
            title="Discipline Unavailable"
            message={error}
            onRetry={() => {
              setLoading(true);
              setError(null);
              setRetryTrigger((prev) => prev + 1);
            }}
          />
        )}

        {!loading && !error && books.length === 0 && (
          <EmptyState
            title="No Volumes Found in This Discipline"
            message="No books currently match your search or filter within this discipline."
            actionText="Browse Full Catalogue"
            onAction={() => window.location.assign('/books')}
          />
        )}

        {!loading && !error && books.length > 0 && (
          <>
            <BookGrid books={books} />
            <Pagination
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={12}
              hasNext={hasNext}
              hasPrev={hasPrev}
              onPageChange={(page) => updateParams({ page })}
            />
          </>
        )}
      </section>
    </div>
  );
}
