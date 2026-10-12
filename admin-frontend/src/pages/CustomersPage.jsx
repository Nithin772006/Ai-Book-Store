import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { getAdminCustomers, updateAdminCustomerStatus } from '../api/admin';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';

export const CustomersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [customers, setCustomers] = useState([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const searchQuery = searchParams.get('search') || '';

  // Deactivate dialog
  const [statusDialog, setStatusDialog] = useState({ isOpen: false, customer: null, targetStatus: false });

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        search: searchQuery || undefined,
      };
      const res = await getAdminCustomers(params);
      setCustomers(res.results || []);
      setCount(res.count || 0);
      setTotalPages(Math.ceil((res.count || 0) / 12) || 1);
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError('Unable to load customer ledger from administrative API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchParams]);

  const updateSearch = (val) => {
    const next = new URLSearchParams(searchParams);
    if (val) {
      next.set('search', val);
    } else {
      next.delete(search);
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

  const handleStatusConfirm = async () => {
    const { customer, targetStatus } = statusDialog;
    if (!customer) return;

    setActionLoading(true);
    setError(null);

    try {
      const res = await updateAdminCustomerStatus(customer.id, targetStatus);
      setMessage(res.message);
      setCustomers((prev) =>
        prev.map((c) => (c.id === customer.id ? { ...c, is_active: targetStatus } : c))
      );
      setStatusDialog({ isOpen: false, customer: null, targetStatus: false });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error('Update customer status error:', err);
      const serverMsg = err.response?.data?.error || 'Failed to update customer status.';
      setError(serverMsg);
      setStatusDialog({ isOpen: false, customer: null, targetStatus: false });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="admin-customers-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-headline">Patron Accounts & Audit</h1>
          <p className="admin-page-subheadline">
            Monitor registered customer accounts, transaction frequency, and manage access status.
          </p>
        </div>
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

      {/* Filter and Search Bar */}
      <div className="admin-filter-bar">
        <div className="admin-search-wrapper">
          <Search size={16} className="admin-search-icon" />
          <input
            type="text"
            placeholder="Search by patron name, username, or email..."
            defaultValue={searchQuery}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateSearch(e.target.value.trim());
              }
            }}
            onBlur={(e) => updateSearch(e.target.value.trim())}
            className="admin-search-input"
          />
        </div>

        <button
          type="button"
          onClick={fetchCustomers}
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
            Total Patrons: <strong>{count}</strong>
          </span>
        </div>

        {loading ? (
          <div className="admin-table-loading">
            <div className="admin-loading-spinner" />
            <p>Retrieving patron records...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="admin-empty-state">
            <Users size={36} />
            <h3>No patron accounts found</h3>
            <p>No customer accounts match your search query.</p>
          </div>
        ) : (
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Patron Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Orders Placed</th>
                  <th>Lifetime Spend</th>
                  <th>Member Since</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Access Control</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong className="admin-table-primary-title">
                        {c.full_name || c.username}
                      </strong>
                    </td>
                    <td>
                      <code>@{c.username}</code>
                    </td>
                    <td>{c.email}</td>
                    <td>
                      <span className="admin-pill-counter">
                        {c.order_count || 0} order{c.order_count === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td>
                      <strong>${parseFloat(c.total_spent || '0').toFixed(2)}</strong>
                    </td>
                    <td className="admin-table-muted">
                      {new Date(c.date_joined).toLocaleDateString()}
                    </td>
                    <td>
                      <StatusBadge type="boolean" value={c.is_active} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setStatusDialog({
                            isOpen: true,
                            customer: c,
                            targetStatus: !c.is_active,
                          })
                        }
                        className={`admin-btn admin-btn-xs ${
                          c.is_active ? 'admin-btn-secondary' : 'admin-btn-primary'
                        }`}
                        disabled={actionLoading}
                        title={c.is_active ? 'Suspend account access' : 'Restore account access'}
                      >
                        {c.is_active ? (
                          <>
                            <UserX size={13} /> Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck size={13} /> Activate
                          </>
                        )}
                      </button>
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

      {/* Confirmation Dialog for Status Change */}
      <ConfirmDialog
        isOpen={statusDialog.isOpen}
        title={statusDialog.targetStatus ? 'Activate Patron Account' : 'Deactivate Patron Account'}
        message={
          statusDialog.targetStatus
            ? `Are you sure you wish to re-enable account access for ${statusDialog.customer?.username}? They will be able to log in and make purchases again.`
            : `Are you sure you wish to suspend access for ${statusDialog.customer?.username}? They will be blocked from logging into the bookstore storefront.`
        }
        confirmLabel={statusDialog.targetStatus ? 'Activate Account' : 'Deactivate Account'}
        isDanger={!statusDialog.targetStatus}
        onConfirm={handleStatusConfirm}
        onCancel={() => setStatusDialog({ isOpen: false, customer: null, targetStatus: false })}
        loading={actionLoading}
      />
    </div>
  );
};

export default CustomersPage;
