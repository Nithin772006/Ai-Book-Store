import React from 'react';
import { Database, Shield, Cpu, Globe } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

export const SettingsPage = () => {
  const { user } = useAdminAuth();

  return (
    <div className="admin-settings-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-headline">System Architecture & Environment</h1>
          <p className="admin-page-subheadline">
            Infrastructure overview, database engine readiness, and administrative access settings.
          </p>
        </div>
      </div>

      <div className="admin-settings-grid">
        {/* Active Session */}
        <div className="admin-panel">
          <div className="admin-panel-title-with-icon">
            <Shield size={18} style={{ color: '#8A2232' }} />
            <h2 className="admin-panel-title">Active Curatorial Session</h2>
          </div>
          <div className="admin-spec-list">
            <div className="admin-spec-item">
              <span className="admin-spec-label">Staff Username:</span>
              <span className="admin-spec-val"><code>@{user?.username}</code></span>
            </div>
            <div className="admin-spec-item">
              <span className="admin-spec-label">Email:</span>
              <span className="admin-spec-val">{user?.email || 'Not specified'}</span>
            </div>
            <div className="admin-spec-item">
              <span className="admin-spec-label">Privilege Level:</span>
              <span className="admin-spec-val">
                {user?.is_superuser ? 'Super Administrator (Full System)' : 'Staff Curator'}
              </span>
            </div>
            <div className="admin-spec-item">
              <span className="admin-spec-label">Authentication Scheme:</span>
              <span className="admin-spec-val">Django REST Framework Token + Session</span>
            </div>
          </div>
        </div>

        {/* Network & Local Ports */}
        <div className="admin-panel">
          <div className="admin-panel-title-with-icon">
            <Globe size={18} style={{ color: '#2A4B7C' }} />
            <h2 className="admin-panel-title">Local Environment Topology</h2>
          </div>
          <div className="admin-spec-list">
            <div className="admin-spec-item">
              <span className="admin-spec-label">Customer Storefront:</span>
              <span className="admin-spec-val">
                <a href="http://localhost:5173" target="_blank" rel="noreferrer" className="admin-table-link">
                  http://localhost:5173
                </a>
              </span>
            </div>
            <div className="admin-spec-item">
              <span className="admin-spec-label">Admin Management Portal:</span>
              <span className="admin-spec-val">
                <code>http://localhost:5174</code> (Port strictly bound)
              </span>
            </div>
            <div className="admin-spec-item">
              <span className="admin-spec-label">Django Backend Server:</span>
              <span className="admin-spec-val">
                <code>http://localhost:8000/api/</code>
              </span>
            </div>
            <div className="admin-spec-item">
              <span className="admin-spec-label">CORS / CSRF Configuration:</span>
              <span className="admin-spec-val">Configured for ports 5173 & 5174 only</span>
            </div>
          </div>
        </div>

        {/* Database & Supabase Preparation */}
        <div className="admin-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="admin-panel-title-with-icon">
            <Database size={18} style={{ color: '#326E50' }} />
            <h2 className="admin-panel-title">Database Engine & Supabase PostgreSQL Migration Readiness</h2>
          </div>
          <p className="admin-panel-instruction" style={{ marginBottom: '1rem' }}>
            Current database: <strong>SQLite (Local Development)</strong>. Planned target: <strong>Supabase Managed PostgreSQL</strong>.
          </p>

          <div className="admin-supabase-readiness-box">
            <div className="admin-readiness-checklist">
              <div className="admin-checklist-item">
                <span className="admin-check-icon">✓</span>
                <div>
                  <strong>Protected Foreign Keys & Cascades:</strong>
                  <p>Category-to-Book relationship uses <code>on_delete=models.PROTECT</code>; OrderItem-to-Book uses <code>models.SET_NULL</code> with immutable title/author snapshots.</p>
                </div>
              </div>

              <div className="admin-checklist-item">
                <span className="admin-check-icon">✓</span>
                <div>
                  <strong>Decimal Financial Precision:</strong>
                  <p>All prices, subtotals, and totals use <code>DecimalField(max_digits=10, decimal_places=2)</code> with non-negative validators, fully compatible with PostgreSQL <code>NUMERIC(10,2)</code>.</p>
                </div>
              </div>

              <div className="admin-checklist-item">
                <span className="admin-check-icon">✓</span>
                <div>
                  <strong>Database-Backed Identity & Security:</strong>
                  <p>All authentication, password hashing, and permissions are handled natively by Django's auth subsystem, ensuring zero architectural friction when migrating database engines.</p>
                </div>
              </div>

              <div className="admin-checklist-item">
                <span className="admin-check-icon">✓</span>
                <div>
                  <strong>Single Data Access Gateway:</strong>
                  <p>Neither frontend application connects directly to the database. All queries flow exclusively through the Django REST API.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Provider Config */}
        <div className="admin-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="admin-panel-title-with-icon">
            <Cpu size={18} style={{ color: '#D97706' }} />
            <h2 className="admin-panel-title">AI Provider & Intelligence Configuration</h2>
          </div>
          <div className="admin-spec-list">
            <div className="admin-spec-item">
              <span className="admin-spec-label">AI Engine:</span>
              <span className="admin-spec-val">Groq Cloud Platform (Fast Inference Engine)</span>
            </div>
            <div className="admin-spec-item">
              <span className="admin-spec-label">Active Model:</span>
              <span className="admin-spec-val"><code>qwen/qwen3.8-27b</code></span>
            </div>
            <div className="admin-spec-item">
              <span className="admin-spec-label">Diagnostic Tooling:</span>
              <span className="admin-spec-val"><code>python manage.py check_groq</code></span>
            </div>
            <div className="admin-spec-item">
              <span className="admin-spec-label">Secret Isolation:</span>
              <span className="admin-spec-val">API credentials reside exclusively on the backend server; zero client exposure.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
