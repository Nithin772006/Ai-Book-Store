import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getCategories, getBooks, getRecommendations } from '../api/books';
import HeroSection from '../components/HeroSection';
import ImmersiveFeature from '../components/ImmersiveFeature';
import BookGrid from '../components/BookGrid';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [curatedBooks, setCuratedBooks] = useState([]);
  const [bestsellers, setBestsellers] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const homeRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const [catsRes, booksRes, bestRes, newRes, recsRes] = await Promise.all([
          getCategories(controller.signal),
          getBooks({ page_size: 8 }, controller.signal),
          getBooks({ bestseller: true, page_size: 4 }, controller.signal),
          getBooks({ new_arrival: true, page_size: 4 }, controller.signal),
          getRecommendations(4, controller.signal).catch(() => ({ results: [] })),
        ]);

        if (!ignore) {
          setCategories(catsRes || []);
          setCuratedBooks(booksRes?.results || []);
          setBestsellers(bestRes?.results || []);
          setNewArrivals(newRes?.results || []);
          setRecommendations(recsRes?.results || []);
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

  // Orchestrate ScrollTrigger entrance for shelf sections
  useGSAP(() => {
    if (loading || error || !homeRef.current) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const shelfSections = homeRef.current.querySelectorAll('.editorial-shelf-section');
    shelfSections.forEach((section) => {
      const headerText = section.querySelector('.shelf-header-text');
      const viewAllLink = section.querySelector('.shelf-view-all-link');
      const cards = section.querySelectorAll('.editorial-book-card, .editorial-category-card');

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
        defaults: { ease: 'power3.out' },
      });

      if (headerText) {
        tl.from(headerText, { opacity: 0, y: 24, duration: 0.8 });
      }
      if (viewAllLink) {
        tl.from(viewAllLink, { opacity: 0, x: -12, duration: 0.6 }, '-=0.5');
      }
      if (cards.length > 0) {
        tl.from(cards, { opacity: 0, y: 30, stagger: 0.08, duration: 0.7 }, '-=0.4');
      }
    });
  }, { scope: homeRef, dependencies: [loading, error] });

  return (
    <div ref={homeRef} className="editorial-homepage">
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
            <section className="editorial-shelf-section" id="curated-selections" aria-labelledby="heading-curated">
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

          {/* SECTION: Curated Recommendations (Phase 8) */}
          {recommendations.length > 0 && (
            <section className="editorial-shelf-section recommendations-shelf" aria-labelledby="heading-recommendations">
              <div className="store-container">
                <div className="shelf-header">
                  <div className="shelf-header-text">
                    <span className="editorial-kicker">CURATED FOR YOU</span>
                    <h2 id="heading-recommendations" className="shelf-title">
                      Discover Your Next Read
                    </h2>
                    <p className="shelf-subtext">
                      Intelligently selected volumes from our archive based on literary disciplines and reader favorites.
                    </p>
                  </div>
                  <Link to="/reading-assistant" className="shelf-view-all-link">
                    ✦ Ask AI Assistant <span className="arrow-glyph">→</span>
                  </Link>
                </div>

                <BookGrid books={recommendations} />
              </div>
            </section>
          )}

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
