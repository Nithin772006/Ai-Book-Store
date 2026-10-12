import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Truck,
  User,
  MapPin,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { getAdminOrder, updateAdminOrderStatus } from '../api/admin';
import StatusBadge from '../components/StatusBadge';

const LEGAL_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const OrderDetailPage = () => {
  const { id } = useParams();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminOrder(id);
      setOrder(data);
      const allowed = LEGAL_TRANSITIONS[data.order_status] || [];
      if (allowed.length > 0) {
        setSelectedStatus(allowed[0]);
      } else {
        setSelectedStatus('');
      }
    } catch (err) {
      console.error('Failed to load order detail:', err);
      setError('Unable to load order detail from administrative API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!selectedStatus) return;

    setUpdating(true);
    setError(null);

    try {
      const res = await updateAdminOrderStatus(id, selectedStatus, statusNotes);
      setMessage(res.message);
      setOrder(res.order);
      const allowed = LEGAL_TRANSITIONS[res.order.order_status] || [];
      setSelectedStatus(allowed.length > 0 ? allowed[0] : '');
      setStatusNotes('');
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error('Update status error:', err);
      const serverMsg = err.response?.data?.order_status?.[0] || err.response?.data?.error || 'Failed to update order status.';
      setError(serverMsg);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page-loading">
        <div className="admin-loading-spinner" />
        <p>Loading Order Ledger...</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="admin-page-error">
        <AlertTriangle size={32} />
        <h2>Order Retrieval Error</h2>
        <p>{error}</p>
        <Link to="/orders" className="admin-btn admin-btn-secondary">
          <ArrowLeft size={16} /> Return to Orders
        </Link>
      </div>
    );
  }

  const allowedTransitions = LEGAL_TRANSITIONS[order.order_status] || [];
  const isTerminal = allowedTransitions.length === 0;

  return (
    <div className="admin-order-detail-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <nav className="admin-form-breadcrumbs">
            <Link to="/orders" className="admin-breadcrumb-link">
              <ArrowLeft size={14} /> Back to Orders
            </Link>
          </nav>
          <div className="admin-order-title-row">
            <h1 className="admin-page-headline">Order {order.reference}</h1>
            <StatusBadge type="order" value={order.order_status} />
            <StatusBadge type="payment" value={order.payment_status} />
          </div>
          <p className="admin-page-subheadline">
            Submitted on {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchOrder}
          className="admin-btn admin-btn-secondary"
          title="Reload order"
        >
          <RefreshCw size={14} /> Reload
        </button>
      </div>

      {/* Notifications */}
      {message && (
        <div className="admin-alert admin-alert-success" role="status">
          <CheckCircle size={16} />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="admin-alert admin-alert-danger" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Two Column Grid */}
      <div className="admin-order-grid">
        {/* Left: Items Snapshot */}
        <div className="admin-order-left">
          <div className="admin-panel">
            <h2 className="admin-panel-title">Purchased Items Snapshot</h2>
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Unit Price</th>
                    <th>Qty</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.book_title}</strong>
                        {item.book_author && (
                          <div className="admin-table-subtext">by {item.book_author}</div>
                        )}
                      </td>
                      <td>${parseFloat(item.unit_price).toFixed(2)}</td>
                      <td>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>${parseFloat(item.subtotal).toFixed(2)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="admin-order-totals-box">
              <div className="admin-total-row">
                <span>Items Subtotal:</span>
                <span>${parseFloat(order.subtotal).toFixed(2)}</span>
              </div>
              <div className="admin-total-row">
                <span>Shipping Fee:</span>
                <span>${parseFloat(order.shipping_charge).toFixed(2)}</span>
              </div>
              {parseFloat(order.discount_amount) > 0 && (
                <div className="admin-total-row admin-total-discount">
                  <span>Promotional Discount:</span>
                  <span>-${parseFloat(order.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="admin-total-row admin-total-final">
                <span>Total Amount Charged:</span>
                <span>${parseFloat(order.total_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Customer & Fulfillment Controller */}
        <div className="admin-order-right">
          {/* Fulfillment Controller */}
          <div className="admin-panel">
            <h2 className="admin-panel-title">Fulfillment Stage Controller</h2>
            <p className="admin-panel-instruction">
              Legal transitions enforce warehouse lifecycle integrity.
            </p>

            {isTerminal ? (
              <div className="admin-status-terminal-notice">
                <CheckCircle size={18} />
                <span>
                  This order is in a terminal state (<strong>{order.order_status}</strong>). No further state transitions are permitted.
                </span>
              </div>
            ) : (
              <form onSubmit={handleStatusUpdate} className="admin-status-form">
                <div className="admin-form-group">
                  <label htmlFor="next_status" className="admin-form-label">
                    Advance to Stage:
                  </label>
                  <select
                    id="next_status"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="admin-form-input"
                    disabled={updating}
                  >
                    {allowedTransitions.map((st) => (
                      <option key={st} value={st}>
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="status_notes" className="admin-form-label">
                    Fulfillment Notes <span className="admin-optional">(Optional)</span>
                  </label>
                  <input
                    id="status_notes"
                    type="text"
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder="e.g. Dispatched via Royal Mail Special Delivery"
                    className="admin-form-input"
                    disabled={updating}
                  />
                </div>

                <button
                  type="submit"
                  className="admin-btn admin-btn-primary admin-btn-block"
                  disabled={updating || !selectedStatus}
                >
                  <Truck size={16} />
                  <span>{updating ? 'Updating Stage...' : 'Update Fulfillment Status'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Patron Details */}
          <div className="admin-panel" style={{ marginTop: '1.5rem' }}>
            <h2 className="admin-panel-title">Patron & Recipient</h2>
            <div className="admin-info-item">
              <User size={16} className="admin-info-icon" />
              <div>
                <strong>{order.customer_name}</strong>
                <div className="admin-table-subtext">{order.customer_email}</div>
                <div className="admin-table-micro">Account: {order.customer_username}</div>
              </div>
            </div>

            <div className="admin-info-item" style={{ marginTop: '1rem' }}>
              <MapPin size={16} className="admin-info-icon" />
              <div>
                <strong>Shipping Address:</strong>
                <div>{order.shipping_address_line1}</div>
                {order.shipping_address_line2 && <div>{order.shipping_address_line2}</div>}
                <div>
                  {order.city}, {order.state_region} {order.postal_code}
                </div>
                <div>{order.country}</div>
              </div>
            </div>

            <div className="admin-info-item" style={{ marginTop: '1rem' }}>
              <CreditCard size={16} className="admin-info-icon" />
              <div>
                <strong>Payment Method:</strong>
                <div>{order.payment_method}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
