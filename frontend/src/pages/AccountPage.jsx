import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../context/useAuth';
import { getRecommendations } from '../api/books';
import Button from '../components/Button';
import BookGrid from '../components/BookGrid';

gsap.registerPlugin(useGSAP);

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const [recommendations, setRecommendations] = useState([]);
  const [isPersonalized, setIsPersonalized] = useState(false);

  useEffect(() => {
    let ignore = false;
    getRecommendations(4)
      .then((data) => {
        if (!ignore && data) {
          setRecommendations(data.results || []);
          setIsPersonalized(Boolean(data.personalized));
        }
      })
      .catch((err) => console.warn('Could not load account recommendations:', err));
    return () => { ignore = true; };
  }, []);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.from('.account-card-block', {
      opacity: 0,
      y: 20,
      stagger: 0.1,
      duration: 0.7,
      ease: 'power3.out',
    });
  }, { scope: pageRef, dependencies: [user] });

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  if (!user) return null;

  const formattedDate = user.date_joined
    ? new Date(user.date_joined).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Active Edition';

  return (
    <div ref={pageRef} className="editorial-account-page store-container">
      {/* Breadcrumb Trail */}
      <nav className="editorial-breadcrumbs" aria-label="Breadcrumbs">
        <Link to="/" className="breadcrumb-crumb">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active" aria-current="page">Customer Profile</span>
      </nav>

      {/* Account Hero Bar */}
      <header className="account-hero-bar account-card-block">
        <div className="account-monogram-box">
          <span className="account-monogram-text">{user.initials || 'EL'}</span>
        </div>

        <div className="account-title-column">
          <div className="account-badge-row">
            <span className="account-role-badge">Verified Reader</span>
            {user.is_staff && (
              <span className="account-staff-badge">Curator / Staff</span>
            )}
          </div>
          <h1 className="account-user-name">{user.full_name}</h1>
          <p className="account-user-email">{user.email}</p>
        </div>

        <div className="account-actions-box">
          <Button
            variant="outline"
            size="md"
            onClick={handleLogout}
            id="btn-account-logout"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Profile Information Grid */}
      <div className="account-grid-layout">
        {/* Left Column: Account Details */}
        <section className="account-info-card account-card-block" aria-labelledby="heading-account-details">
          <div className="card-header-line">
            <h2 id="heading-account-details" className="account-section-heading">
              Account Credentials & Folio
            </h2>
          </div>

          <dl className="account-spec-list">
            <div className="account-spec-item">
              <dt className="spec-label">Full Name</dt>
              <dd className="spec-value">{user.full_name}</dd>
            </div>

            <div className="account-spec-item">
              <dt className="spec-label">Primary Email</dt>
              <dd className="spec-value">{user.email}</dd>
            </div>

            <div className="account-spec-item">
              <dt className="spec-label">Reader Identifier</dt>
              <dd className="spec-value">@{user.username}</dd>
            </div>

            <div className="account-spec-item">
              <dt className="spec-label">Member Enrolled</dt>
              <dd className="spec-value">{formattedDate}</dd>
            </div>

            <div className="account-spec-item">
              <dt className="spec-label">Account Security</dt>
              <dd className="spec-value">
                <span className="security-status-indicator">
                  <span className="security-dot active" /> PBKDF2 Password Hashing & Token Protection
                </span>
              </dd>
            </div>
          </dl>
        </section>

        {/* Right Column: Library Navigation & Status */}
        <section className="account-info-card account-card-block" aria-labelledby="heading-library-status">
          <div className="card-header-line">
            <h2 id="heading-library-status" className="account-section-heading">
              Bookstore Quick Access
            </h2>
          </div>

          <p className="account-card-prose">
            Your AETHERIUM reader folio grants you immediate access to all archival collections,
            curated staff selections, and intellectual treatises.
          </p>

          <div className="account-links-cluster">
            <Link to="/account/orders" className="account-quick-link" id="account-link-orders">
              <span className="link-title">View Acquisition & Order History</span>
              <span className="link-arrow">→</span>
            </Link>

            <Link to="/cart" className="account-quick-link" id="account-link-cart">
              <span className="link-title">View Your Reading Bag</span>
              <span className="link-arrow">→</span>
            </Link>

            <Link to="/books" className="account-quick-link">
              <span className="link-title">Browse Full Literary Archive</span>
              <span className="link-arrow">→</span>
            </Link>

            <Link to="/categories" className="account-quick-link">
              <span className="link-title">Explore Academic Disciplines</span>
              <span className="link-arrow">→</span>
            </Link>

            <Link to="/reading-assistant" className="account-quick-link" id="account-link-assistant">
              <span className="link-title">✦ Consult AI Reading Assistant</span>
              <span className="link-arrow">→</span>
            </Link>
          </div>

          <div className="account-scope-note" role="note">
            <div className="note-title">✦ Verified Reader Status</div>
            <p className="note-body">
              Your customer account is authenticated with active order tracking and persistent cart management.
              Browse orders anytime to inspect purchase-time editions and dispatch status.
            </p>
          </div>
        </section>
      </div>

      {/* Recommended for Your Reading Folio (Phase 8) */}
      {recommendations.length > 0 && (
        <section className="account-recommendations-section account-card-block" style={{ marginTop: '2.5rem' }}>
          <div className="shelf-header">
            <div className="shelf-header-text">
              <span className="editorial-kicker">
                {isPersonalized ? 'TAILORED TO YOUR READING TASTES' : 'ARCHIVAL SELECTIONS'}
              </span>
              <h2 className="shelf-title" style={{ fontSize: '1.5rem' }}>
                {isPersonalized ? 'Recommended For Your Folio' : 'Distinguished Works to Acquire'}
              </h2>
              <p className="shelf-subtext">
                {isPersonalized
                  ? 'Curated volumes complementing your past reading acquisitions and favored disciplines.'
                  : 'Hand-picked volumes from our library archives to enrich your collection.'}
              </p>
            </div>
            <Link to="/reading-assistant" className="shelf-view-all-link">
              ✦ Ask AI Assistant <span className="arrow-glyph">→</span>
            </Link>
          </div>

          <BookGrid books={recommendations} />
        </section>
      )}
    </div>
  );
}
