import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { getCategories } from '../api/books';
import { useAuth } from '../context/useAuth';
import { useCart } from '../context/useCart';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount } = useCart();
  const [categories, setCategories] = useState([]);
  const [catOpen, setCatOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    getCategories()
      .then((data) => {
        if (isMounted) setCategories(data || []);
      })
      .catch((err) => console.warn('Navbar categories load failed:', err.message));
    return () => { isMounted = false; };
  }, []);

  // Listen to scroll to add subtle elevation
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setCatOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    setCatOpen(false);
    setMobileMenuOpen(false);
    setSearchOpen(false);
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/books?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/books');
    }
    setSearchQuery('');
    setSearchOpen(false);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className={`editorial-navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="store-container navbar-inner">
        {/* Brand Wordmark & Emblem */}
        <Link to="/" className="navbar-brand" id="nav-brand-logo" aria-label="AETHERIUM Homepage">
          <div className="brand-crest-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="brand-crest-svg">
              <path d="M4 21V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v16" />
              <path d="M2 21h20" />
              <path d="M8 8v9" />
              <path d="M12 8v9" />
              <path d="M16 8v9" />
              <path d="M4 4h16" />
            </svg>
          </div>
          <div className="brand-typography">
            <span className="brand-wordmark">AETHERIUM</span>
            <span className="brand-descriptor">A CURATED BOOKSTORE</span>
          </div>
        </Link>

        {/* Desktop Editorial Navigation Links */}
        <nav className="navbar-links" aria-label="Main Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            id="nav-link-home"
          >
            Home
          </NavLink>

          <NavLink
            to="/books"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            id="nav-link-browse"
          >
            Browse Books
          </NavLink>

          <NavLink
            to="/reading-assistant"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            id="nav-link-reading-assistant"
          >
            <span style={{ color: 'var(--color-burgundy)', marginRight: '4px' }}>✦</span>
            Reading Assistant
          </NavLink>

          {/* Categories Dropdown */}
          <div className="nav-dropdown-wrapper" ref={dropdownRef}>
            <button
              type="button"
              className={`nav-link dropdown-toggle ${catOpen ? 'open' : ''}`}
              onClick={() => setCatOpen(!catOpen)}
              id="nav-categories-dropdown"
              aria-expanded={catOpen}
            >
              <span>Categories</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="dropdown-caret">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {catOpen && (
              <div className="editorial-dropdown-menu" role="menu">
                <div className="dropdown-heading">Curated Disciplines</div>
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/categories/${cat.slug}`}
                      className="dropdown-item"
                      role="menuitem"
                      onClick={() => setCatOpen(false)}
                    >
                      <span className="item-name">{cat.name}</span>
                      {cat.books_count !== undefined && (
                        <span className="item-count">{cat.books_count}</span>
                      )}
                    </Link>
                  ))
                ) : (
                  <div className="dropdown-item" style={{ color: 'var(--color-muted-brown)' }}>
                    Loading disciplines...
                  </div>
                )}
                <div className="dropdown-divider"></div>
                <Link
                  to="/categories"
                  className="dropdown-view-all"
                  onClick={() => setCatOpen(false)}
                  style={{ marginBottom: '0.35rem' }}
                >
                  Browse All Categories →
                </Link>
                <Link
                  to="/books"
                  className="dropdown-view-all"
                  onClick={() => setCatOpen(false)}
                >
                  View Full Catalogue →
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Navbar Controls: Search, Cart, Account */}
        <div className="navbar-utilities">
          {/* Search Trigger & Expandable Field */}
          <div className="nav-search-wrapper">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="nav-search-active-form">
                <input
                  type="search"
                  autoFocus
                  placeholder="Title, author, ISBN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="nav-search-inline-input"
                  aria-label="Search catalogue"
                  id="nav-search-input"
                />
                <button
                  type="submit"
                  className="nav-search-submit-btn"
                  aria-label="Submit search"
                  id="btn-nav-search-submit"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="nav-search-close-btn"
                  aria-label="Close search"
                  id="btn-nav-search-close"
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="utility-btn search-trigger-btn"
                aria-label="Open search input"
                title="Search books"
                id="btn-nav-search-trigger"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="search-trigger-label">Search</span>
              </button>
            )}
          </div>

          {/* Cart Utility Button */}
          <div className="nav-cart-wrapper">
            <Link
              to="/cart"
              className="utility-btn cart-btn"
              aria-label={`Shopping bag (${itemCount} items)`}
              title="View your shopping bag"
              id="btn-nav-cart"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span className="cart-badge-count" id="nav-cart-badge-count">{itemCount}</span>
            </Link>
          </div>

          {/* Customer Authentication Navigation Cluster */}
          <div className="nav-auth-wrapper">
            {isAuthenticated ? (
              <div className="nav-user-logged-cluster">
                <Link
                  to="/account"
                  className="nav-account-pill-link"
                  id="nav-link-account"
                  title="View your reader profile"
                >
                  <span className="nav-user-avatar-badge">{user?.initials || 'EL'}</span>
                  <span className="nav-user-name-label">{user?.first_name || user?.username}</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="nav-auth-text-btn"
                  id="nav-btn-logout"
                  title="Sign out of your account"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="nav-auth-guest-cluster">
                <Link
                  to="/login"
                  className="nav-auth-text-btn"
                  id="nav-link-login"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn-editorial btn-editorial-burgundy btn-size-sm nav-join-btn"
                  id="nav-link-register"
                >
                  Join
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            id="btn-mobile-nav-toggle"
          >
            <span className={`hamburger-bar ${mobileMenuOpen ? 'open-top' : ''}`} />
            <span className={`hamburger-bar ${mobileMenuOpen ? 'open-mid' : ''}`} />
            <span className={`hamburger-bar ${mobileMenuOpen ? 'open-bot' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="editorial-mobile-drawer" role="dialog" aria-label="Mobile Navigation">
          <form onSubmit={handleSearchSubmit} className="mobile-search-form">
            <input
              type="search"
              placeholder="Search books, authors, ISBNs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mobile-search-input"
            />
            <button type="submit" className="mobile-search-btn">Search</button>
          </form>

          <div className="mobile-nav-stack">
            <Link
              to="/"
              className="mobile-nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/books"
              className="mobile-nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse Full Catalogue
            </Link>
            <Link
              to="/reading-assistant"
              className="mobile-nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              ✦ AI Reading Assistant
            </Link>
            <Link
              to="/categories"
              className="mobile-nav-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse All Categories
            </Link>
            <Link
              to="/cart"
              className="mobile-nav-link mobile-cart-highlight"
              onClick={() => setMobileMenuOpen(false)}
            >
              Reading Bag {itemCount > 0 ? `(${itemCount})` : ''}
            </Link>
            <div className="mobile-section-header">Disciplines & Categories</div>
            <div className="mobile-cats-grid">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/categories/${cat.slug}`}
                  className="mobile-cat-pill"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>{cat.name}</span>
                  {cat.books_count !== undefined && <span className="cat-count">({cat.books_count})</span>}
                </Link>
              ))}
            </div>

            <div className="mobile-section-header">Reader Account</div>
            {isAuthenticated ? (
              <>
                <Link
                  to="/account"
                  className="mobile-nav-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  My Profile ({user?.full_name || user?.username})
                </Link>
                <Link
                  to="/account/orders"
                  className="mobile-nav-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Order History
                </Link>
                <button
                  type="button"
                  className="mobile-nav-link mobile-logout-action-btn"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                >
                  Sign Out of Account
                </button>
              </>
            ) : (
              <div className="mobile-auth-stack">
                <Link
                  to="/login"
                  className="mobile-nav-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="mobile-nav-link mobile-register-highlight"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Create Account →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
