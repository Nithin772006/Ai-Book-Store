import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { getCategories } from '../api/books';

export default function Navbar() {
  const [categories, setCategories] = useState([]);
  const [catOpen, setCatOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [cartCount] = useState(0);
  const [cartToast, setCartToast] = useState(false);

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
      setSearchQuery('');
      setSearchOpen(false);
      setMobileMenuOpen(false);
    }
  };

  const handleCartClick = () => {
    setCartToast(true);
    setTimeout(() => setCartToast(false), 3000);
  };

  return (
    <header className={`editorial-navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="store-container navbar-inner">
        {/* Brand Wordmark & Emblem */}
        <Link to="/" className="navbar-brand" id="nav-brand-logo" aria-label="EX LIBRIS Homepage">
          <div className="brand-crest-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="brand-crest-svg">
              {/* Classical Arch / Temple Column Emblem */}
              <path d="M4 21V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v16" />
              <path d="M2 21h20" />
              <path d="M8 8v9" />
              <path d="M12 8v9" />
              <path d="M16 8v9" />
              <path d="M4 4h16" />
            </svg>
          </div>
          <div className="brand-typography">
            <span className="brand-wordmark">EX LIBRIS</span>
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

          {/* Categories Dropdown */}
          <div className="nav-dropdown-wrapper">
            <button
              type="button"
              className={`nav-link dropdown-toggle ${catOpen ? 'open' : ''}`}
              onClick={() => setCatOpen(!catOpen)}
              onBlur={() => setTimeout(() => setCatOpen(false), 220)}
              id="nav-categories-dropdown"
              aria-expanded={catOpen}
            >
              <span>Categories</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="dropdown-caret">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {catOpen && categories.length > 0 && (
              <div className="editorial-dropdown-menu" role="menu">
                <div className="dropdown-heading">Curated Disciplines</div>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/categories/${cat.slug}`}
                    className="dropdown-item"
                    role="menuitem"
                  >
                    <span className="item-name">{cat.name}</span>
                    {cat.books_count !== undefined && (
                      <span className="item-count">{cat.books_count}</span>
                    )}
                  </Link>
                ))}
                <div className="dropdown-divider"></div>
                <Link to="/books" className="dropdown-view-all">
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
                />
                <button type="submit" className="nav-search-submit-btn" aria-label="Submit search">
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
            <button
              type="button"
              onClick={handleCartClick}
              className="utility-btn cart-btn"
              aria-label="Shopping bag"
              title="View bag"
              id="btn-nav-cart"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span className="cart-badge-count">{cartCount}</span>
            </button>

            {cartToast && (
              <div className="cart-preview-popover" role="status">
                <span className="cart-popover-title">Your Reading Bag (0)</span>
                <p className="cart-popover-sub">
                  Cart & checkout functionality is scheduled for Phase 4. Select "Details" on any book to inspect its edition.
                </p>
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
            <Link to="/" className="mobile-nav-link">Home</Link>
            <Link to="/books" className="mobile-nav-link">Browse Full Catalogue</Link>
            <div className="mobile-section-header">Disciplines & Categories</div>
            <div className="mobile-cats-grid">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/categories/${cat.slug}`}
                  className="mobile-cat-pill"
                >
                  <span>{cat.name}</span>
                  {cat.books_count !== undefined && <span className="cat-count">({cat.books_count})</span>}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
