import React from 'react';

export default function LoadingState({ message = 'Retrieving catalogue records...', count = 6 }) {
  return (
    <div className="loading-state-container" aria-live="polite" aria-busy="true">
      <div className="loading-spinner-banner">
        <div className="editorial-spinner"></div>
        <p className="loading-message">{message}</p>
      </div>

      {/* Grid Skeleton Placeholder Cards */}
      <div className="skeleton-grid">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="skeleton-card">
            <div className="skeleton-cover"></div>
            <div className="skeleton-text skeleton-tag"></div>
            <div className="skeleton-text skeleton-title"></div>
            <div className="skeleton-text skeleton-author"></div>
            <div className="skeleton-text skeleton-price"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
