import React, { useState, useEffect, useCallback } from 'react';
import { checkApiHealth, API_BASE_URL } from './api';
import './App.css';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState(null);
  const [latency, setLatency] = useState(null);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealthStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await checkApiHealth();
      setHealthData(result.data);
      setLatency(result.latencyMs);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to communicate with Django API:', err);
      let errorMsg = 'Unable to connect to the Django REST Framework server.';
      let details = '';

      if (err.response) {
        // Server responded with an error code
        errorMsg = `Server responded with HTTP ${err.response.status}`;
        details = JSON.stringify(err.response.data, null, 2);
      } else if (err.request) {
        // Request made but no response (server offline or CORS blockage)
        errorMsg = `Connection refused at ${API_BASE_URL}/api/health/`;
        details = 'Ensure the Django development server is running and django-cors-headers is configured to allow this origin.';
      } else {
        errorMsg = err.message || 'An unexpected client error occurred.';
      }

      setError({ message: errorMsg, details });
      setHealthData(null);
      setLatency(null);
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthStatus();
  }, [fetchHealthStatus]);

  return (
    <div className="app-container">
      {/* Header Banner */}
      <header className="app-header">
        <div className="brand-badge">
          <span className="brand-icon">📚</span>
          <span className="brand-title">AI Online Bookstore</span>
          <span className="phase-pill">Phase 1: Foundation</span>
        </div>
        <h1 className="header-headline">Full-Stack Architecture Verification</h1>
        <p className="header-subtitle">
          Real-time integration status between React (Vite) and Django REST Framework
        </p>
      </header>

      {/* Main Status Container */}
      <main className="status-grid">
        {/* Core Status Card */}
        <section className="status-card" id="status-card-main">
          <div className="card-top-bar">
            <div className="status-indicator-wrapper">
              <span
                id="status-dot"
                className={`status-dot ${
                  loading ? 'loading' : error ? 'error' : 'active'
                }`}
              />
              <span className="status-title-text" id="status-state-text">
                {loading
                  ? 'Connecting to Django API...'
                  : error
                  ? 'Connection Failed'
                  : 'API Online & Healthy'}
              </span>
            </div>

            <button
              id="btn-recheck"
              className="refresh-button"
              onClick={fetchHealthStatus}
              disabled={loading}
              title="Re-verify health endpoint"
            >
              <span className={`refresh-icon ${loading ? 'spinning' : ''}`}>↻</span>
              <span>{loading ? 'Checking...' : 'Check Again'}</span>
            </button>
          </div>

          {/* Conditional States */}
          {loading && (
            <div className="state-panel loading-panel" id="loading-indicator">
              <div className="custom-spinner" />
              <p className="loading-caption">
                Pinging <code>{API_BASE_URL}/api/health/</code>...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="state-panel error-panel" id="error-container">
              <div className="error-header">
                <span className="error-badge-icon">⚠️</span>
                <div className="error-titles">
                  <h3 id="error-headline">{error.message}</h3>
                  <p className="error-subtext">{error.details}</p>
                </div>
              </div>

              <div className="troubleshooting-guide">
                <h4>Troubleshooting Steps:</h4>
                <ol>
                  <li>
                    Verify Django is running on port 8000:
                    <pre>cd backend; .\.venv\Scripts\python.exe manage.py runserver</pre>
                  </li>
                  <li>
                    Verify <code>CORS_ALLOWED_ORIGINS</code> includes{' '}
                    <code>http://localhost:5173</code> in{' '}
                    <code>backend/config/settings.py</code>
                  </li>
                  <li>
                    Verify <code>VITE_API_URL</code> in{' '}
                    <code>frontend/.env</code> points to{' '}
                    <code>http://127.0.0.1:8000</code>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {!loading && healthData && (
            <div className="state-panel success-panel" id="success-container">
              <div className="success-banner">
                <div className="success-icon-badge">✓</div>
                <div className="success-meta">
                  <h3 id="api-message">{healthData.message}</h3>
                  <p className="success-caption">
                    Handshake verified via Django REST Framework endpoint
                  </p>
                </div>
              </div>

              {/* Data Metrics Grid */}
              <div className="metrics-grid">
                <div className="metric-box">
                  <span className="metric-label">Project Name</span>
                  <span className="metric-value highlight" id="project-name">
                    {healthData.project}
                  </span>
                </div>

                <div className="metric-box">
                  <span className="metric-label">API Version</span>
                  <span className="metric-value mono" id="api-version">
                    v{healthData.version}
                  </span>
                </div>

                <div className="metric-box">
                  <span className="metric-label">Response Status</span>
                  <span className="metric-value badge-status" id="response-status">
                    {healthData.status.toUpperCase()}
                  </span>
                </div>

                <div className="metric-box">
                  <span className="metric-label">Round-Trip Latency</span>
                  <span className="metric-value mono" id="api-latency">
                    {latency ? `${latency} ms` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Live Payload Preview */}
              <div className="payload-container">
                <div className="payload-header">
                  <span className="payload-title">Live Response Payload</span>
                  <span className="payload-badge">application/json</span>
                </div>
                <pre className="payload-content" id="raw-json-output">
                  {JSON.stringify(healthData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Footer Metadata */}
          <footer className="card-footer">
            <div className="footer-meta-item">
              <span className="meta-muted">Backend URL:</span>
              <code className="meta-code" id="backend-url-display">{API_BASE_URL}</code>
            </div>
            <div className="footer-meta-item">
              <span className="meta-muted">Endpoint:</span>
              <code className="meta-code">GET /api/health/</code>
            </div>
            {lastChecked && (
              <div className="footer-meta-item">
                <span className="meta-muted">Last Checked:</span>
                <span className="meta-text">{lastChecked}</span>
              </div>
            )}
          </footer>
        </section>

        {/* Phase 1 Verification Checklist Card */}
        <section className="architecture-card">
          <h2 className="architecture-title">Phase 1 Stack & Architecture</h2>
          <ul className="checklist">
            <li className="checklist-item done">
              <span className="check-icon">✓</span>
              <div>
                <strong>Frontend Setup</strong>
                <p>React 19, Vite, Vanilla CSS design tokens</p>
              </div>
            </li>
            <li className="checklist-item done">
              <span className="check-icon">✓</span>
              <div>
                <strong>Backend REST API</strong>
                <p>Django 5.2, Django REST Framework in virtual environment</p>
              </div>
            </li>
            <li className="checklist-item done">
              <span className="check-icon">✓</span>
              <div>
                <strong>CORS Security</strong>
                <p>Configured strictly for localhost & 127.0.0.1 (port 5173)</p>
              </div>
            </li>
            <li className="checklist-item done">
              <span className="check-icon">✓</span>
              <div>
                <strong>Modular HTTP Client</strong>
                <p>Reusable Axios instance configured via <code>VITE_API_URL</code></p>
              </div>
            </li>
            <li className="checklist-item pending">
              <span className="check-icon">⏳</span>
              <div>
                <strong>Next Step: Phase 2</strong>
                <p>Database models, Admin portal, and Authentication</p>
              </div>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
