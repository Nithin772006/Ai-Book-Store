import React from 'react';

export default function ErrorState({
  title = 'Unable to Load Catalogue',
  message = 'We encountered an unexpected issue while communicating with the bookstore API. Please ensure the backend server is reachable.',
  onRetry,
}) {
  return (
    <div className="state-panel error-panel" role="alert" id="catalogue-error-state">
      <div className="error-icon-box">⚠️</div>
      <h3 className="error-headline">{title}</h3>
      <p className="error-description">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="retry-button"
          id="btn-error-retry"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
