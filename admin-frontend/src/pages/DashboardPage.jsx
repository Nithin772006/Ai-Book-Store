import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  FolderTree,
  Users,
  ShoppingBag,
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { getDashboardMetrics } from '../api/admin';
import StatusBadge from '../components/StatusBadge';

export const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboardMetrics();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      setError('Unable to load dashboard metrics from the Django administration API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading && !data) {
    return (
      <div className="admin-page-loading">
        <div className="admin-loading-spinner" />
        <p>Loading Curatorial Dashboard...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="admin-page-error">
        <AlertTriangle size={32} className="admin-error-icon" />
        <h2>Dashboard Error</h2>
        <p>{error}</p>
        <button type="button" onClick={fetchMetrics} className="admin-btn admin-btn-primary">
          <RefreshCw size={16} /> Retry Query
        </button>
      </div>
    );
  }

  const { metrics, recent_orders = [], recent_books = [] } = data || {};

  return (
    <div className="admin-dashboard-page">
      {/* Page Title & Refresh */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-headline">Curatorial Intelligence Dashboard</h1>
          <p className="admin-page-subheadline">
            Real-time bookstore metrics, catalog oversight, and fulfillment activity.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchMetrics}
          className="admin-btn admin-btn-secondary"
          disabled={loading}
          title="Refresh metrics"
        >
          <RefreshCw size={14} className={loading ? 'admin-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap" style={{ background: 'rgba(107, 23, 36, 0.08)', color: '#6B1724' }}>
            <BookOpen size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-kicker">CATALOGUE VOLUMES</span>
            <div className="admin-stat-value">{metrics?.active_books}</div>
            <span className="admin-stat-meta">Active ({metrics?.total_books} total registered)</span>
          </div>
          <Link to="/books" className="admin-stat-link" title="Manage Books">
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap" style={{ background: 'rgba(42, 75, 124, 0.08)', color: '#2A4B7C' }}>
            <FolderTree size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-kicker">DISCIPLINES</span>
            <div className="admin-stat-value">{metrics?.total_categories}</div>
            <span className="admin-stat-meta">Active catalogue genres</span>
          </div>
          <Link to="/categories" className="admin-stat-link" title="Manage Categories">
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap" style={{ background: 'rgba(50, 110, 80, 0.08)', color: '#326E50' }}>
            <Users size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-kicker">PATRONS</span>
            <div className="admin-stat-value">{metrics?.total_customers}</div>
            <span className="admin-stat-meta">Registered customer accounts</span>
          </div>
          <Link to="/customers" className="admin-stat-link" title="Manage Customers">
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap" style={{ background: 'rgba(180, 95, 20, 0.08)', color: '#B45F14' }}>
            <DollarSign size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-kicker">REVENUE (DEMO)</span>
            <div className="admin-stat-value">${parseFloat(metrics?.total_revenue || '0').toFixed(2)}</div>
            <span className="admin-stat-meta">From verified paid orders</span>
          </div>
          <Link to="/orders" className="admin-stat-link" title="Manage Orders">
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap" style={{ background: 'rgba(107, 23, 36, 0.08)', color: '#6B1724' }}>
            <ShoppingBag size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-kicker">ORDERS RECORDED</span>
            <div className="admin-stat-value">{metrics?.total_orders}</div>
            <span className="admin-stat-meta">Total lifetime transactions</span>
          </div>
          <Link to="/orders" className="admin-stat-link" title="View Orders">
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap" style={{ background: 'rgba(217, 119, 6, 0.08)', color: '#D97706' }}>
            <Clock size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-kicker">PENDING / PROCESSING</span>
            <div className="admin-stat-value">{metrics?.pending_orders + metrics?.processing_orders}</div>
            <span className="admin-stat-meta">{metrics?.pending_orders} pending, {metrics?.processing_orders} processing</span>
          </div>
          <Link to="/orders?order_status=processing" className="admin-stat-link" title="Fulfillment Queue">
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap" style={{ background: 'rgba(16, 149, 93, 0.08)', color: '#10955D' }}>
            <CheckCircle size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-kicker">FULFILLED ORDERS</span>
            <div className="admin-stat-value">{metrics?.completed_orders}</div>
            <span className="admin-stat-meta">Delivered to patrons</span>
          </div>
          <Link to="/orders?order_status=delivered" className="admin-stat-link" title="Delivered Orders">
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon-wrap" style={{ background: 'rgba(185, 28, 28, 0.08)', color: '#B91C1C' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="admin-stat-content">
            <span className="admin-stat-kicker">LOW STOCK VOLUMES</span>
            <div className="admin-stat-value">{metrics?.low_stock_count}</div>
            <span className="admin-stat-meta">≤ 5 copies remaining ({metrics?.out_of_stock_count} zero stock)</span>
          </div>
          <Link to="/books?stock_status=low_stock" className="admin-stat-link" title="View Low Stock">
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      {/* Dual Table Section */}
      <div className="admin-dashboard-dual-grid">
        {/* Recent Orders */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2 className="admin-panel-title">Recent Patron Orders</h2>
              <span className="admin-panel-subtitle">Latest fulfillment submissions</span>
            </div>
            <Link to="/orders" className="admin-btn admin-btn-sm admin-btn-secondary">
              View All Orders →
            </Link>
          </div>

          {recent_orders.length === 0 ? (
            <div className="admin-empty-state">
              <ShoppingBag size={24} />
              <p>No orders placed yet.</p>
            </div>
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Patron</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`} className="admin-table-link">
                          <code>{o.reference}</code>
                        </Link>
                      </td>
                      <td>{o.customer_name}</td>
                      <td>${parseFloat(o.total_amount).toFixed(2)}</td>
                      <td>
                        <StatusBadge type="order" value={o.order_status} />
                      </td>
                      <td className="admin-table-muted">
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Catalogue Additions */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2 className="admin-panel-title">Recent Catalogue Additions</h2>
              <span className="admin-panel-subtitle">Recently registered volumes</span>
            </div>
            <Link to="/books" className="admin-btn admin-btn-sm admin-btn-secondary">
              Catalogue →
            </Link>
          </div>

          {recent_books.length === 0 ? (
            <div className="admin-empty-state">
              <BookOpen size={24} />
              <p>No books catalogued yet.</p>
            </div>
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Volume Title</th>
                    <th>Author</th>
                    <th>Discipline</th>
                    <th>Price</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_books.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <Link to={`/books/${b.id}/edit`} className="admin-table-link">
                          {b.title}
                        </Link>
                      </td>
                      <td>{b.author}</td>
                      <td>{b.category || 'General'}</td>
                      <td>${parseFloat(b.price).toFixed(2)}</td>
                      <td>
                        <StatusBadge type="stock" value={b.stock_quantity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
