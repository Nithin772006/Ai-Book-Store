import React from 'react';
import Button from '../components/Button';

export default function NotFoundPage() {
  return (
    <div className="not-found-page store-container">
      <div className="not-found-card">
        <span className="not-found-icon">🕯️</span>
        <span className="not-found-kicker">Archive Error 404</span>
        <h1 className="not-found-title">This Chapter Seems to Be Missing</h1>
        <p className="not-found-text">
          The manuscript, catalogue shelf, or page you were searching for has either been moved,
          renamed, or was never penned in this edition.
        </p>
        <div className="not-found-actions">
          <Button to="/" variant="burgundy" size="md" id="btn-404-home">
            Return to Front Desk (Home)
          </Button>
          <Button to="/books" variant="outline" size="md" id="btn-404-browse">
            Browse Entire Catalogue
          </Button>
        </div>
      </div>
    </div>
  );
}
