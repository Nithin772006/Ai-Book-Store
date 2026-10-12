import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  ShoppingBag,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { getAdminOrders } from '../api/admin';
import StatusBadge from '../components/StatusBadge';

export const OrdersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const searchQuery = searchParams.get('search') || '';
  const statusFilter = searchParams.get('order_status') || '';
  const paymentFilter = searchParams.get('payment_status') || '';

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        search: searchQuery || undefined,
        order_status: statusFilter || undefined,
        payment_status: paymentFilter || undefined,
      };
      const res = await getAdminOrders(params);
      setOrders(res.results || []);
      setCount(res.count || 0);
      setTotalPages(Math.ceil((res.count || 0) / 12) || 1);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError('Unable to load orders from administrative API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [searchParams]);

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1');
    setSearchParams(next);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      const next = new URLSearchParams(searchParams);
      next.set('page', newPage.toString());
      setSearchParams(next);
    }
  };

  return (
    <div className="admin-orders-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-headline">Order Management & Fulfillment</h1>
          <p className="admin-page-subheadline">
            Monitor patron transactions, verify payment statuses, and advance fulfillment stages.
          </p>
        </div>
      </div>

      {error && (
        <div className="admin-alert admin-alert-danger" role="alert">
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="admin-filter-bar">
        <div className="admin-search-wrapper">
          <Search size={16} className="admin-search-icon" />
          <input
            type="text"
            placeholder="Search by reference, patron name, or email..."
            defaultValue={searchQuery}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateFilter('search', e.target.value.trim());
              }
            }}
            onBlur={(e) => updateFilter('search', e.target.value.trim())}
            className="admin-search-input"
          />
        </div>

        <div className="admin-select-wrapper">
          <select
            value={statusFilter}
            onChange={(e) => updateFilter('order_status', e.target.value)}
            className="admin-select"
          >
            <option value="">All Fulfillment Stages</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="admin-select-wrapper">
          <select
            value={paymentFilter}
            onChange={(e) => updateFilter('payment_status', e.target.value)}
            className="admin-select"
          >
            <option value="">All Payment States</option>
            <option value="paid">Paid (Demo)</option>
            <option value="unpaid">Unpaid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        <button
          type="button"
          onClick={fetchOrders}
          className="admin-btn admin-btn-secondary"
          title="Reload table"
        >
          <RefreshCw size={14} className={loading ? 'admin-spin' : ''} />
        </button>
      </div>

      {/* Table Panel */}
      <div className="admin-panel">
        <div className="admin-panel-meta-bar">
          <span className="admin-meta-count">
            Total Orders: <strong>{count}</strong>
          </span>
        </div>

        {loading ? (
          <div className="admin-table-loading">
            <div className="admin-loading-spinner" />
            <p>Retrieving transaction logs...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="admin-empty-state">
            <ShoppingBag size={36} />
            <h3>No orders found</h3>
            <p>No customer transactions match the active criteria.</p>
          </div>
        ) : (
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order Reference</th>
                  <th>Patron</th>
                  <th>Date & Time</th>
                  <th>Items</th>
                  <th>Total Amount</th>
                  <th>Fulfillment Status</th>
                  <th>Payment</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`} className="admin-table-primary-link">
                        <code>{o.reference}</code>
                      </Link>
                    </td>
                    <td>
                      <strong>{o.customer_name}</strong>
                      <div className="admin-table-subtext">{o.customer_email}</div>
                    </td>
                    <td className="admin-table-muted">
                      {new Date(o.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span className="admin-pill-counter">
                        {o.total_items} item{o.total_items === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td>
                      <strong>${parseFloat(o.total_amount).toFixed(2)}</strong>
                    </td>
                    <td>
                      <StatusBadge type="order" value={o.order_status} />
                    </td>
                    <td>
                      <StatusBadge type="payment" value={o.payment_status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/orders/${o.id}`}
                        className="admin-btn admin-btn-secondary admin-btn-xs"
                      >
                        <Eye size={13} /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="admin-pagination">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="admin-pagination-btn"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span className="admin-pagination-info">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="admin-pagination-btn"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
