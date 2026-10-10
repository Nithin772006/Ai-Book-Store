import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCategories, getBooks } from '../api/books';
import HeroSection from '../components/HeroSection';
import ImmersiveFeature from '../components/ImmersiveFeature';
import BookGrid from '../components/BookGrid';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [curatedBooks, setCuratedBooks] = useState([]);
  const [bestsellers, setBestsellers] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const [catsRes, booksRes, bestRes, newRes] = await Promise.all([
          getCategories(controller.signal),
          getBooks({ page_size: 8 }, controller.signal),
          getBooks({ bestseller: true, page_size: 4 }, controller.signal),
          getBooks({ new_arrival: true, page_size: 4 }, controller.signal),
        ]);

        if (!ignore) {
          setCategories(catsRes || []);
          setCuratedBooks(booksRes?.results || []);
          setBestsellers(bestRes?.results || []);
          setNewArrivals(newRes?.results || []);
        }
      } catch (err) {
        if (!ignore && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          console.error('Failed to load homepage data:', err);
          setError('Unable to reach the bookstore catalogue. Please check that the Django API server is active.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [retryTrigger]);

  return (
    <div className="editorial-homepage">
      {/* SECTION B: Cinematic Hero Video & Editorial Statement */}
      <HeroSection />

      {/* Error Feedback */}
      {error && (
        <div className="store-container section-pad">
          <ErrorState
            title="Catalogue Connection Issue"
            message={error}
            onRetry={() => {
              setLoading(true);
              setError(null);
              setRetryTrigger((prev) => prev + 1);
            }}
          />
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="store-container section-pad">
          <LoadingState message="Assembling curated bookstore shelves..." count={4} />
        </div>
      )}

      {/* Live Content Sections */}
      {!loading && !error && (
        <>
          {/* SECTION C: Curated Book Collection */}
          {curatedBooks.length > 0 && (
            <section className="editorial-shelf-section" aria-labelledby="heading-curated">
              <div className="store-container">
                <div className="shelf-header">
                  <div className="shelf-header-text">
                    <span className="editorial-kicker">EDITORS' SELECTION</span>
                    <h2 id="heading-curated" className="shelf-title">
                      Curated for curious readers
                    </h2>
                    <p className="shelf-subtext">
                      Handpicked volumes selected for philosophical depth, software craftsmanship, and timeless insight.
                    </p>
                  </div>
                  <Link to="/books" className="shelf-view-all-link">
                    View All Books <span className="arrow-glyph">→</span>
                  </Link>
                </div>

                <BookGrid books={curatedBooks} />
              </div>
            </section>
          )}

          {/* SECTION D: Immersive Library Feature */}
          <ImmersiveFeature />

          {/* SECTION E: Browse by Discipline (Categories Showcase) */}
          {categories.length > 0 && (
            <section className="editorial-shelf-section disciplines-section" aria-labelledby="heading-disciplines">
              <div className="store-container">
                <div className="shelf-header">
                  <div className="shelf-header-text">
                    <span className="editorial-kicker">DISCIPLINES & TOPICS</span>
                    <h2 id="heading-disciplines" className="shelf-title">
                      Explore by Discipline
                    </h2>
                  </div>
                  <Link to="/books" className="shelf-view-all-link">
                    Full Library Index <span className="arrow-glyph">→</span>
                  </Link>
                </div>

                <div className="editorial-category-grid">
                  {categories.map((cat) => (
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
                      <h3 className="cat-card-name">{cat.name}</h3>
                      {cat.description && (
                        <p className="cat-card-summary">{cat.description}</p>
                      )}
                      <div className="cat-card-footer">
                        <span className="cat-card-cta">Browse Archive</span>
                        <span className="cat-card-arrow">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SECTION E: Bestsellers Section (Reader Favorites) */}
          {bestsellers.length > 0 && (
            <section className="editorial-shelf-section bestsellers-shelf" aria-labelledby="heading-bestsellers">
              <div className="store-container">
                <div className="shelf-header">
                  <div className="shelf-header-text">
                    <span className="editorial-kicker">READER FAVORITES</span>
                    <h2 id="heading-bestsellers" className="shelf-title">
                      Most Read & Revered
                    </h2>
                    <p className="shelf-subtext">
                      Celebrated works that have captured the imagination of software architects and scholars worldwide.
                    </p>
                  </div>
                  <Link to="/books?bestseller=true" className="shelf-view-all-link">
                    All Bestsellers <span className="arrow-glyph">→</span>
                  </Link>
                </div>

                <BookGrid books={bestsellers} />
              </div>
            </section>
          )}

          {/* SECTION E: New Arrivals Section */}
          {newArrivals.length > 0 && (
            <section className="editorial-shelf-section new-arrivals-shelf" aria-labelledby="heading-new-arrivals">
              <div className="store-container">
                <div className="shelf-header">
                  <div className="shelf-header-text">
                    <span className="editorial-kicker">RECENT ACQUISITIONS</span>
                    <h2 id="heading-new-arrivals" className="shelf-title">
                      Fresh Off the Press
                    </h2>
                    <p className="shelf-subtext">
                      The latest arrivals to grace our library shelves, catalogued and ready for immediate inquiry.
                    </p>
                  </div>
                  <Link to="/books?new_arrival=true" className="shelf-view-all-link">
                    All New Arrivals <span className="arrow-glyph">→</span>
                  </Link>
                </div>

                <BookGrid books={newArrivals} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
