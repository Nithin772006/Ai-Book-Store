import React from 'react';
import { Link } from 'react-router-dom';

const CURRENT_YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="editorial-footer">
      <div className="store-container footer-content-grid">
        {/* Brand Column */}
        <div className="footer-col brand-editorial-col">
          <div className="footer-brand-lockup">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#B89A65" strokeWidth="1.6" className="footer-crest-svg">
              <path d="M4 21V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v16" />
              <path d="M2 21h20" />
              <path d="M8 8v9" />
              <path d="M12 8v9" />
              <path d="M16 8v9" />
              <path d="M4 4h16" />
            </svg>
            <span className="footer-brand-title">EX LIBRIS</span>
          </div>

          <p className="footer-statement">
            A sanctuary for intellectual exploration and literary craftsmanship. Preserving foundational
            works in artificial intelligence, software architecture, classical systems, and human aesthetics.
          </p>

          <div className="footer-meta-tags">
            <span className="footer-tag">Independent Editorial Press</span>
            <span className="footer-tag">DRF + React Architecture</span>
          </div>
        </div>

        {/* Catalogue Navigation */}
        <div className="footer-col">
          <h4 className="footer-col-title">The Collection</h4>
          <ul className="footer-menu">
            <li><Link to="/books">Complete Library Index</Link></li>
            <li><Link to="/books?featured=true">Staff Picks & Curated</Link></li>
            <li><Link to="/books?bestseller=true">Most Revered Editions</Link></li>
            <li><Link to="/books?new_arrival=true">Recent Acquisitions</Link></li>
            <li><Link to="/books?in_stock=true">Available Immediately</Link></li>
          </ul>
        </div>

        {/* Disciplines Navigation */}
        <div className="footer-col">
          <h4 className="footer-col-title">Disciplines</h4>
          <ul className="footer-menu">
            <li><Link to="/categories/ai-machine-learning">Artificial Intelligence & ML</Link></li>
            <li><Link to="/categories/software-engineering">Software Architecture</Link></li>
            <li><Link to="/categories/data-systems-algorithms">Data Systems & Algorithms</Link></li>
            <li><Link to="/categories/design-human-experience">Design & Human Experience</Link></li>
            <li><Link to="/categories/philosophy-futures">Philosophy & Futures</Link></li>
          </ul>
        </div>

        {/* System & Archive Links */}
        <div className="footer-col">
          <h4 className="footer-col-title">Archive & System</h4>
          <ul className="footer-menu">
            <li>
              <a href="http://127.0.0.1:8000/api/health/" target="_blank" rel="noopener noreferrer">
                API Diagnostics ↗
              </a>
            </li>
            <li>
              <a href="http://127.0.0.1:8000/api/books/" target="_blank" rel="noopener noreferrer">
                Public JSON Endpoints ↗
              </a>
            </li>
            <li>
              <a href="http://127.0.0.1:8000/admin/" target="_blank" rel="noopener noreferrer">
                Curator Administration ↗
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer Colophon Bottom Bar */}
      <div className="footer-colophon-bar">
        <div className="store-container colophon-inner">
          <p className="colophon-text">
            © {CURRENT_YEAR} EX LIBRIS BOOKSTORE. Built with Django REST Framework & React.
          </p>
          <div className="colophon-links">
            <span className="colophon-note">Major Project Capstone Demonstration</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
