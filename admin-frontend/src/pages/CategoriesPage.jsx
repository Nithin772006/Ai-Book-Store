import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, FolderTree, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { getAdminCategories, createAdminCategory, updateAdminCategory, deleteAdminCategory } from '../api/admin';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';

export const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Modal State for Add / Edit
  const [modalState, setModalState] = useState({
    isOpen: false,
    category: null,
    name: '',
    description: '',
    is_active: true,
  });

  // Delete Dialog State
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, category: null });

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError('Unable to load categories from administrative API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openAddModal = () => {
    setModalState({
      isOpen: true,
      category: null,
      name: '',
      description: '',
      is_active: true,
    });
  };

  const openEditModal = (cat) => {
    setModalState({
      isOpen: true,
      category: cat,
      name: cat.name,
      description: cat.description || '',
      is_active: Boolean(cat.is_active),
    });
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!modalState.name.trim()) return;

    setActionLoading(true);
    setError(null);

    try {
      const payload = {
        name: modalState.name.trim(),
        description: modalState.description.trim(),
        is_active: modalState.is_active,
      };

      if (modalState.category) {
        await updateAdminCategory(modalState.category.id, payload);
        setMessage(`Category "${payload.name}" updated successfully.`);
      } else {
        await createAdminCategory(payload);
        setMessage(`New category "${payload.name}" created successfully.`);
      }

      setModalState({ isOpen: false, category: null, name: '', description: '', is_active: true });
      fetchCategories();
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error('Save category error:', err);
      const serverErr = err.response?.data?.name?.[0] || err.response?.data?.error || 'Failed to save category.';
      setError(serverErr);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    const cat = deleteDialog.category;
    if (!cat) return;

    setActionLoading(true);
    setError(null);

    try {
      await deleteAdminCategory(cat.id);
      setMessage(`Category "${cat.name}" was removed.`);
      setDeleteDialog({ isOpen: false, category: null });
      fetchCategories();
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      console.error('Delete category error:', err);
      const serverErr = err.response?.data?.error || 'Failed to delete category.';
      setError(serverErr);
      setDeleteDialog({ isOpen: false, category: null });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="admin-categories-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-headline">Disciplines & Categories</h1>
          <p className="admin-page-subheadline">
            Organize the AETHERIUM catalogue by genre, intellectual tradition, and subject.
          </p>
        </div>
        <button type="button" onClick={openAddModal} className="admin-btn admin-btn-primary">
          <Plus size={16} />
          <span>New Discipline</span>
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

      {/* Categories Table Panel */}
      <div className="admin-panel">
        <div className="admin-panel-meta-bar">
          <span className="admin-meta-count">
            Total Disciplines: <strong>{categories.length}</strong>
          </span>
          <button
            type="button"
            onClick={fetchCategories}
            className="admin-btn admin-btn-secondary admin-btn-sm"
          >
            <RefreshCw size={14} className={loading ? 'admin-spin' : ''} />
            <span>Reload</span>
          </button>
        </div>

        {loading ? (
          <div className="admin-table-loading">
            <div className="admin-loading-spinner" />
            <p>Loading discipline records...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="admin-empty-state">
            <FolderTree size={36} />
            <h3>No categories recorded</h3>
            <p>Create your first bookstore discipline to classify titles.</p>
          </div>
        ) : (
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Discipline Name</th>
                  <th>Slug</th>
                  <th>Description</th>
                  <th>Associated Volumes</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong className="admin-table-primary-title">{c.name}</strong>
                    </td>
                    <td>
                      <code>{c.slug}</code>
                    </td>
                    <td className="admin-table-desc-cell">
                      {c.description ? (
                        <span>{c.description}</span>
                      ) : (
                        <span className="admin-table-muted">No description provided</span>
                      )}
                    </td>
                    <td>
                      <span className="admin-pill-counter">
                        {c.book_count || 0} volume{c.book_count === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge type="boolean" value={c.is_active} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="admin-actions-cell">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="admin-btn-icon"
                          title="Edit discipline"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteDialog({ isOpen: true, category: c })}
                          className="admin-btn-icon admin-btn-icon-danger"
                          title="Delete discipline"
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
      </div>

      {/* Add / Edit Category Modal */}
      {modalState.isOpen && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        >
          <div className="admin-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                {modalState.category ? 'Edit Discipline' : 'Add New Discipline'}
              </h3>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label htmlFor="modal_cat_name" className="admin-form-label">
                    Category Name <span className="admin-required">*</span>
                  </label>
                  <input
                    id="modal_cat_name"
                    type="text"
                    value={modalState.name}
                    onChange={(e) =>
                      setModalState((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g. Natural Philosophy, Epistemology, Poetry"
                    className="admin-form-input"
                    required
                    autoFocus
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="modal_cat_desc" className="admin-form-label">
                    Overview Synopsis <span className="admin-optional">(Optional)</span>
                  </label>
                  <textarea
                    id="modal_cat_desc"
                    rows={3}
                    value={modalState.description}
                    onChange={(e) =>
                      setModalState((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Brief description of the literary traditions classified under this discipline..."
                    className="admin-form-input"
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={modalState.is_active}
                      onChange={(e) =>
                        setModalState((prev) => ({ ...prev, is_active: e.target.checked }))
                      }
                    />
                    <span>
                      <strong>Active</strong> (Visible to readers browsing catalogue)
                    </span>
                  </label>
                </div>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : modalState.category ? 'Update Discipline' : 'Create Discipline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Remove Discipline"
        message={`Are you certain you wish to remove "${deleteDialog.category?.name}"? If there are any associated volumes in this category, deletion will be safely rejected by the server.`}
        confirmLabel="Confirm Deletion"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ isOpen: false, category: null })}
        loading={actionLoading}
      />
    </div>
  );
};

export default CategoriesPage;
