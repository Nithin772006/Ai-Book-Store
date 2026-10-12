import React from 'react';

/**
 * Editorial Error Boundary for Aetherium
 * Catches JavaScript rendering errors in descendant components and presents
 * a styled fallback without exposing internal stack traces.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error internally for debugging without displaying raw stacks to readers
    console.error('Aetherium Caught Component Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="store-container section-pad" role="alert">
          <div className="state-panel error-panel" style={{ maxWidth: '640px', margin: '2rem auto' }}>
            <div className="error-icon-box" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
              📜
            </div>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--color-wine)',
                display: 'block',
                marginBottom: '0.5rem',
              }}
            >
              Archival Interruption
            </span>
            <h2 className="error-headline" style={{ marginBottom: '0.85rem' }}>
              Something Unexpected Occurred in the Library
            </h2>
            <p className="error-description" style={{ marginBottom: '1.75rem' }}>
              An unexpected issue interrupted the display of this page or component. You may return
              to the front desk or attempt to reload the collection.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReset}
                className="retry-button"
                id="btn-error-boundary-retry"
              >
                Reload Component
              </button>
              <a
                href="/"
                className="btn-editorial btn-editorial-outline btn-size-md"
                id="btn-error-boundary-home"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  border: '1px solid var(--border-fine)',
                  color: 'var(--color-ink)',
                }}
              >
                Return to Front Desk
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
