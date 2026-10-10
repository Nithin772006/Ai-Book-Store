import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { getBooks, getCategories } from '../api/books';
import BookGrid from '../components/BookGrid';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

gsap.registerPlugin(useGSAP);

export default function BooksPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL query parameters
  const searchQuery = searchParams.get('search') || '';
  const selectedCategory = searchParams.get('category') || '';
  const selectedOrdering = searchParams.get('ordering') || '-created_at';
  const inStockOnly = searchParams.get('in_stock') === 'true';
  const featuredOnly = searchParams.get('featured') === 'true';
  const bestsellerOnly = searchParams.get('bestseller') === 'true';
  const newArrivalOnly = searchParams.get('new_arrival') === 'true';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // Component state
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const containerRef = useRef(null);

  // Load categories once
  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((data) => {
        if (isMounted) setCategories(data || []);
      })
      .catch((err) => console.warn('Could not load categories in BooksPage:', err));
    return () => { isMounted = false; };
  }, []);

  // Update query params helper
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
      // If updating a filter (not page), reset page back to 1
      if (!('page' in updates)) {
        next.delete('page');
      }
      return next;
    });
  }, [setSearchParams]);

  const [retryTrigger, setRetryTrigger] = useState(0);

  // Fetch books matching current URL parameters
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    const fetchCatalogue = async () => {
      try {
        const params = {
          search: searchQuery,
          category: selectedCategory,
          ordering: selectedOrdering,
          in_stock: inStockOnly ? 'true' : undefined,
          featured: featuredOnly ? 'true' : undefined,
          bestseller: bestsellerOnly ? 'true' : undefined,
          new_arrival: newArrivalOnly ? 'true' : undefined,
          page: currentPage,
        };

        const data = await getBooks(params, controller.signal);
        if (!ignore) {
          setBooks(data.results || []);
          setTotalCount(data.count || 0);
          setHasNext(Boolean(data.next));
          setHasPrev(Boolean(data.previous));
        }
      } catch (err) {
        if (!ignore && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error('Books catalogue fetch failed:', err);
          setError('Unable to fetch books from the server. Please verify your connection.');
          setBooks([]);
          setTotalCount(0);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchCatalogue();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [
    searchQuery,
    selectedCategory,
    selectedOrdering,
    inStockOnly,
    featuredOnly,
    bestsellerOnly,
    newArrivalOnly,
    currentPage,
    retryTrigger,
  ]);

  const handleClearAllFilters = () => {
    setLoading(true);
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = Boolean(
    searchQuery ||
    selectedCategory ||
    inStockOnly ||
    featuredOnly ||
    bestsellerOnly ||
    newArrivalOnly ||
    selectedOrdering !== '-created_at'
  );

  // Subtle entrance animation on catalogue results
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
    <div ref={containerRef} className="editorial-catalogue-page store-container">
      {/* Catalogue Editorial Header */}
      <header className="catalogue-top-header">
        <div className="header-titles">
          <span className="editorial-kicker">COMPLETE ARCHIVE</span>
          <h1 className="catalogue-title">Browse Literary Collection</h1>
          <p className="catalogue-subtitle">
            Curated treatises, architectural references, and intellectual milestones across disciplines.
          </p>
        </div>

        {/* Dynamic Count Badge */}
        {!loading && !error && (
          <div className="catalogue-count-tag" id="results-count-badge">
            <span className="count-number">{totalCount}</span> {totalCount === 1 ? 'Volume Catalogued' : 'Volumes Catalogued'}
          </div>
        )}
      </header>

      {/* Editorial Filter & Control Bar */}
      <section className="editorial-filter-panel" aria-label="Search and Filter Controls">
        {/* Full-width Search Bar */}
        <div className="filter-search-container">
          <SearchBar
            initialValue={searchQuery}
            onSearch={(val) => updateParams({ search: val })}
            placeholder="Search by title, author, description, or ISBN..."
          />
        </div>

        {/* Filter Controls Row */}
        <div className="filter-controls-row">
          {/* Category Dropdown */}
          <div className="filter-select-group">
            <label htmlFor="filter-category" className="filter-label">Discipline</label>
            <div className="select-wrapper">
              <select
                id="filter-category"
                className="editorial-select"
                value={selectedCategory}
                onChange={(e) => updateParams({ category: e.target.value })}
              >
                <option value="">All Disciplines</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name} ({cat.books_count !== undefined ? cat.books_count : '–'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="filter-select-group">
            <label htmlFor="sort-ordering" className="filter-label">Sort Order</label>
            <div className="select-wrapper">
              <select
                id="sort-ordering"
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

          {/* Filter Pills / Toggles */}
          <div className="filter-pills-cluster">
            <label className="editorial-pill-checkbox">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => updateParams({ in_stock: e.target.checked })}
                id="filter-in-stock"
              />
              <span className="pill-text">In Stock Only</span>
            </label>

            <label className="editorial-pill-checkbox">
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={(e) => updateParams({ featured: e.target.checked })}
                id="filter-featured"
              />
              <span className="pill-text">Staff Picks</span>
            </label>

            <label className="editorial-pill-checkbox">
              <input
                type="checkbox"
                checked={bestsellerOnly}
                onChange={(e) => updateParams({ bestseller: e.target.checked })}
                id="filter-bestseller"
              />
              <span className="pill-text">Bestsellers</span>
            </label>

            <label className="editorial-pill-checkbox">
              <input
                type="checkbox"
                checked={newArrivalOnly}
                onChange={(e) => updateParams({ new_arrival: e.target.checked })}
                id="filter-new-arrival"
              />
              <span className="pill-text">New Arrivals</span>
            </label>
          </div>

          {/* Clear Filter Link */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="editorial-reset-filters-btn"
              id="btn-clear-filters"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </section>

      {/* Main Results Display */}
      <section className="catalogue-results-stage" aria-live="polite">
        {loading && (
          <LoadingState message="Retrieving library records..." count={8} />
        )}

        {error && !loading && (
          <ErrorState
            title="Catalogue Error"
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
            title="No Matching Volumes Found"
            message="No books in our catalogue match your current search or filter criteria. Try expanding your search terms or clearing selected filters."
            actionText={hasActiveFilters ? "Clear All Filters" : undefined}
            onAction={hasActiveFilters ? handleClearAllFilters : undefined}
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
