import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  BookOpen,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getAdminBooks, getAdminCategories, updateAdminBook, deleteAdminBook } from '../api/admin';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';

export const BooksPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Filters from query params
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const searchQuery = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || '';
  const stockFilter = searchParams.get('stock_status') || '';
  const activeFilter = searchParams.get('is_active') || '';

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, book: null });

  // Load categories once
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getAdminCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    loadCategories();
  }, []);

  // Fetch books when searchParams change
  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        search: searchQuery || undefined,
        category: categoryFilter || undefined,
        stock_status: stockFilter || undefined,
        is_active: activeFilter !== '' ? activeFilter : undefined,
      };
      const res = await getAdminBooks(params);
      setBooks(res.results || []);
      setCount(res.count || 0);
      setTotalPages(Math.ceil((res.count || 0) / 12) || 1);
    } catch (err) {
      console.error('Failed to load books:', err);
      setError('Unable to load book catalogue from administrative API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [searchParams]);

  // Handle filter changes
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

  // Quick toggle is_active
  const handleToggleActive = async (book) => {
    setActionLoading(true);
    try {
      const updated = await updateAdminBook(book.id, { is_active: !book.is_active });
      setBooks((prev) => prev.map((b) => (b.id === book.id ? updated : b)));
      setMessage(`Book "${book.title}" is now ${updated.is_active ? 'active' : 'hidden'}.`);
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error('Failed to toggle book active status:', err);
      setError('Failed to update book status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    const book = deleteDialog.book;
    if (!book) return;

    setActionLoading(true);
    try {
      const res = await deleteAdminBook(book.id);
      setMessage(res.message || `Book "${book.title}" was removed.`);
      setDeleteDialog({ isOpen: false, book: null });
      fetchBooks();
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error('Delete book failed:', err);
      setError(err.response?.data?.error || 'Failed to remove book.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="admin-books-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-headline">Volumes & Catalogue Management</h1>
          <p className="admin-page-subheadline">
            Audit inventory, publish editions, manage prices, and update cover imagery.
          </p>
        </div>
        <Link to="/books/new" className="admin-btn admin-btn-primary">
          <Plus size={16} />
          <span>Add New Volume</span>
        </Link>
      </div>

      {/* Notifications */}
      {message && (
        <div className="admin-alert admin-alert-success" role="status">
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="admin-alert admin-alert-danger" role="alert">
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="admin-filter-bar">
        {/* Search */}
        <div className="admin-search-wrapper">
          <Search size={16} className="admin-search-icon" />
          <input
            type="text"
            placeholder="Search by title, author, or ISBN..."
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

        {/* Category filter */}
        <div className="admin-select-wrapper">
          <select
            value={categoryFilter}
            onChange={(e) => updateFilter('category', e.target.value)}
            className="admin-select"
          >
            <option value="">All Disciplines</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stock status filter */}
        <div className="admin-select-wrapper">
          <select
            value={stockFilter}
            onChange={(e) => updateFilter('stock_status', e.target.value)}
            className="admin-select"
          >
            <option value="">All Stock Levels</option>
            <option value="in_stock">In Stock (&gt; 5)</option>
            <option value="low_stock">Low Stock (1-5)</option>
            <option value="out_of_stock">Out of Stock (0)</option>
          </select>
        </div>

        {/* Active status filter */}
        <div className="admin-select-wrapper">
          <select
            value={activeFilter}
            onChange={(e) => updateFilter('is_active', e.target.value)}
            className="admin-select"
          >
            <option value="">All Visibility</option>
            <option value="true">Active Only</option>
            <option value="false">Hidden / Inactive</option>
          </select>
        </div>

        <button
          type="button"
          onClick={fetchBooks}
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
            Showing <strong>{books.length}</strong> of <strong>{count}</strong> recorded volumes
          </span>
        </div>

        {loading ? (
          <div className="admin-table-loading">
            <div className="admin-loading-spinner" />
            <p>Querying catalogue records...</p>
          </div>
        ) : books.length === 0 ? (
          <div className="admin-empty-state">
            <BookOpen size={36} />
            <h3>No matching volumes found</h3>
            <p>Try refining your search terms or filters.</p>
          </div>
        ) : (
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Cover</th>
                  <th>Title & Author</th>
                  <th>Discipline</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Flags</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div className="admin-table-cover-thumb">
                        {b.cover_image ? (
                          <img src={b.cover_image} alt={b.title} />
                        ) : (
                          <div className="admin-table-cover-placeholder">✦</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <Link to={`/books/${b.id}/edit`} className="admin-table-primary-link">
                        {b.title}
                      </Link>
                      <div className="admin-table-subtext">by {b.author}</div>
                      {b.isbn && <div className="admin-table-micro">ISBN: {b.isbn}</div>}
                    </td>
                    <td>{b.category_name || 'Unassigned'}</td>
                    <td>
                      <div>${parseFloat(b.price).toFixed(2)}</div>
                      {b.discount_price && (
                        <div className="admin-table-discount-price">
                          Sale: ${parseFloat(b.discount_price).toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge type="stock" value={b.stock_quantity} />
                    </td>
                    <td>
                      <StatusBadge type="boolean" value={b.is_active} />
                    </td>
                    <td>
                      <div className="admin-badges-cluster">
                        {b.is_featured && <span className="admin-micro-badge">Featured</span>}
                        {b.is_bestseller && <span className="admin-micro-badge">Bestseller</span>}
                        {b.is_new_arrival && <span className="admin-micro-badge">New</span>}
                        {!b.is_featured && !b.is_bestseller && !b.is_new_arrival && (
                          <span className="admin-table-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="admin-actions-cell">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(b)}
                          className="admin-btn-icon"
                          title={b.is_active ? 'Hide from storefront' : 'Make visible on storefront'}
                          disabled={actionLoading}
                        >
                          {b.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <Link
                          to={`/books/${b.id}/edit`}
                          className="admin-btn-icon"
                          title="Edit volume details"
                        >
                          <Edit size={15} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteDialog({ isOpen: true, book: b })}
                          className="admin-btn-icon admin-btn-icon-danger"
                          title="Delete volume"
                          disabled={actionLoading}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Remove Volume"
        message={`Are you certain you wish to remove "${deleteDialog.book?.title}" from the catalogue? If this title is linked to existing customer orders, it will be safely deactivated rather than deleted to preserve order history.`}
        confirmLabel="Confirm Deletion"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ isOpen: false, book: null })}
        loading={actionLoading}
      />
    </div>
  );
};

export default BooksPage;
