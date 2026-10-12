import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Save,
  ArrowLeft,
  Upload,
  AlertTriangle,
  CheckCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { getAdminBook, createAdminBook, updateAdminBook, getAdminCategories } from '../api/admin';

export const BookFormPage = () => {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    category: '',
    price: '',
    discount_price: '',
    stock_quantity: 1,
    isbn: '',
    publisher: '',
    publication_date: '',
    language: 'English',
    description: '',
    is_featured: false,
    is_bestseller: false,
    is_new_arrival: false,
    is_active: true,
  });

  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);

  // Load categories and book data if editing
  useEffect(() => {
    const initData = async () => {
      try {
        const cats = await getAdminCategories();
        setCategories(cats);

        if (isEditing) {
          const book = await getAdminBook(id);
          setFormData({
            title: book.title || '',
            author: book.author || '',
            category: book.category || '',
            price: book.price || '',
            discount_price: book.discount_price || '',
            stock_quantity: book.stock_quantity ?? 0,
            isbn: book.isbn || '',
            publisher: book.publisher || '',
            publication_date: book.publication_date || '',
            language: book.language || 'English',
            description: book.description || '',
            is_featured: Boolean(book.is_featured),
            is_bestseller: Boolean(book.is_bestseller),
            is_new_arrival: Boolean(book.is_new_arrival),
            is_active: Boolean(book.is_active),
          });
          if (book.cover_image) {
            setCoverPreview(book.cover_image);
          }
        } else if (cats.length > 0) {
          // Default to first category on new
          setFormData((prev) => ({ ...prev, category: cats[0].id }));
        }
      } catch (err) {
        console.error('Failed to load form data:', err);
        setError('Unable to load volume records from server.');
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear specific field error when user edits
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({
        ...prev,
        cover_image: 'File size exceeds the 5 MB limit.',
      }));
      return;
    }

    // Validate format
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        cover_image: 'Only JPEG, PNG, or WebP images are allowed.',
      }));
      return;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setFieldErrors((prev) => ({ ...prev, cover_image: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Client-side quick checks
    if (!formData.title.trim()) {
      setFieldErrors((prev) => ({ ...prev, title: 'Title is required.' }));
      return;
    }
    if (!formData.author.trim()) {
      setFieldErrors((prev) => ({ ...prev, author: 'Author is required.' }));
      return;
    }
    if (!formData.category) {
      setFieldErrors((prev) => ({ ...prev, category: 'Please select a discipline/category.' }));
      return;
    }
    if (!formData.price || parseFloat(formData.price) < 0) {
      setFieldErrors((prev) => ({ ...prev, price: 'Valid non-negative price is required.' }));
      return;
    }

    setSubmitting(true);

    try {
      const payload = new FormData();
      payload.append('title', formData.title.trim());
      payload.append('author', formData.author.trim());
      payload.append('category', formData.category);
      payload.append('price', formData.price);
      if (formData.discount_price) {
        payload.append('discount_price', formData.discount_price);
      }
      payload.append('stock_quantity', formData.stock_quantity.toString());
      if (formData.isbn) payload.append('isbn', formData.isbn.trim());
      if (formData.publisher) payload.append('publisher', formData.publisher.trim());
      if (formData.publication_date) payload.append('publication_date', formData.publication_date);
      payload.append('language', formData.language);
      payload.append('description', formData.description.trim());
      payload.append('is_featured', formData.is_featured);
      payload.append('is_bestseller', formData.is_bestseller);
      payload.append('is_new_arrival', formData.is_new_arrival);
      payload.append('is_active', formData.is_active);

      if (coverFile) {
        payload.append('cover_image', coverFile);
      }

      if (isEditing) {
        await updateAdminBook(id, payload);
        setSuccessMsg('Volume updated successfully.');
      } else {
        await createAdminBook(payload);
        setSuccessMsg('New volume created successfully.');
      }

      setTimeout(() => {
        navigate('/books');
      }, 1200);
    } catch (err) {
      console.error('Save book failed:', err);
      if (err.response?.data) {
        setFieldErrors(err.response.data);
        setError('Please correct the validation errors below.');
      } else {
        setError('Failed to save volume records.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-page-loading">
        <div className="admin-loading-spinner" />
        <p>Loading Volume Record...</p>
      </div>
    );
  }

  return (
    <div className="admin-book-form-page">
      {/* Breadcrumb & Actions */}
      <div className="admin-page-header">
        <div>
          <nav className="admin-form-breadcrumbs">
            <Link to="/books" className="admin-breadcrumb-link">
              <ArrowLeft size={14} /> Back to Volumes
            </Link>
          </nav>
          <h1 className="admin-page-headline">
            {isEditing ? `Edit: ${formData.title || 'Volume'}` : 'Register New Volume'}
          </h1>
          <p className="admin-page-subheadline">
            {isEditing
              ? 'Update catalog specifications, pricing, stock levels, or cover image.'
              : 'Add a new curated title to the AETHERIUM bookstore catalogue.'}
          </p>
        </div>
      </div>

      {/* Status Banners */}
      {successMsg && (
        <div className="admin-alert admin-alert-success" role="status">
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="admin-alert admin-alert-danger" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Form Grid */}
      <form onSubmit={handleSubmit} className="admin-book-form">
        <div className="admin-form-two-column">
          {/* Left Column: Primary Details */}
          <div className="admin-form-column">
            <div className="admin-panel">
              <h2 className="admin-panel-title">Bibliographical Details</h2>

              <div className="admin-form-group">
                <label htmlFor="title" className="admin-form-label">
                  Volume Title <span className="admin-required">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. The Name of the Rose"
                  className={`admin-form-input ${fieldErrors.title ? 'error' : ''}`}
                  required
                />
                {fieldErrors.title && <span className="admin-field-error">{fieldErrors.title}</span>}
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group admin-flex-1">
                  <label htmlFor="author" className="admin-form-label">
                    Author(s) <span className="admin-required">*</span>
                  </label>
                  <input
                    id="author"
                    name="author"
                    type="text"
                    value={formData.author}
                    onChange={handleChange}
                    placeholder="e.g. Umberto Eco"
                    className={`admin-form-input ${fieldErrors.author ? 'error' : ''}`}
                    required
                  />
                  {fieldErrors.author && <span className="admin-field-error">{fieldErrors.author}</span>}
                </div>

                <div className="admin-form-group admin-flex-1">
                  <label htmlFor="category" className="admin-form-label">
                    Discipline / Category <span className="admin-required">*</span>
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className={`admin-form-input ${fieldErrors.category ? 'error' : ''}`}
                    required
                  >
                    <option value="">Select a category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.category && <span className="admin-field-error">{fieldErrors.category}</span>}
                </div>
              </div>

              <div className="admin-form-group">
                <label htmlFor="description" className="admin-form-label">
                  Catalogue Synopsis / Description <span className="admin-required">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={6}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Comprehensive editorial overview and synopsis for readers..."
                  className={`admin-form-input ${fieldErrors.description ? 'error' : ''}`}
                  required
                />
                {fieldErrors.description && (
                  <span className="admin-field-error">{fieldErrors.description}</span>
                )}
              </div>
            </div>

            {/* Inventory & Pricing */}
            <div className="admin-panel" style={{ marginTop: '1.5rem' }}>
              <h2 className="admin-panel-title">Pricing & Warehouse Inventory</h2>

              <div className="admin-form-row">
                <div className="admin-form-group admin-flex-1">
                  <label htmlFor="price" className="admin-form-label">
                    Base Price ($) <span className="admin-required">*</span>
                  </label>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="24.99"
                    className={`admin-form-input ${fieldErrors.price ? 'error' : ''}`}
                    required
                  />
                  {fieldErrors.price && <span className="admin-field-error">{fieldErrors.price}</span>}
                </div>

                <div className="admin-form-group admin-flex-1">
                  <label htmlFor="discount_price" className="admin-form-label">
                    Promotional Price ($) <span className="admin-optional">(Optional)</span>
                  </label>
                  <input
                    id="discount_price"
                    name="discount_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discount_price}
                    onChange={handleChange}
                    placeholder="19.99"
                    className={`admin-form-input ${fieldErrors.discount_price ? 'error' : ''}`}
                  />
                  {fieldErrors.discount_price && (
                    <span className="admin-field-error">{fieldErrors.discount_price}</span>
                  )}
                </div>

                <div className="admin-form-group admin-flex-1">
                  <label htmlFor="stock_quantity" className="admin-form-label">
                    Stock Quantity <span className="admin-required">*</span>
                  </label>
                  <input
                    id="stock_quantity"
                    name="stock_quantity"
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={handleChange}
                    className={`admin-form-input ${fieldErrors.stock_quantity ? 'error' : ''}`}
                    required
                  />
                  {fieldErrors.stock_quantity && (
                    <span className="admin-field-error">{fieldErrors.stock_quantity}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Cover & Flags */}
          <div className="admin-form-column">
            {/* Cover Image Upload */}
            <div className="admin-panel">
              <h2 className="admin-panel-title">Cover Artwork</h2>
              <div className="admin-cover-upload-area">
                <div className="admin-cover-preview-box">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover Preview" className="admin-cover-preview-img" />
                  ) : (
                    <div className="admin-cover-empty-placeholder">
                      <ImageIcon size={32} />
                      <span>No artwork selected</span>
                    </div>
                  )}
                </div>
                <div className="admin-cover-controls">
                  <label htmlFor="cover_image_input" className="admin-btn admin-btn-secondary admin-btn-sm">
                    <Upload size={14} /> Upload Cover File
                  </label>
                  <input
                    id="cover_image_input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <span className="admin-cover-help">Max 5 MB (JPEG, PNG, WebP)</span>
                  {fieldErrors.cover_image && (
                    <span className="admin-field-error">{fieldErrors.cover_image}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Publication Metadata */}
            <div className="admin-panel" style={{ marginTop: '1.5rem' }}>
              <h2 className="admin-panel-title">Edition Details</h2>

              <div className="admin-form-group">
                <label htmlFor="isbn" className="admin-form-label">
                  ISBN <span className="admin-optional">(Optional)</span>
                </label>
                <input
                  id="isbn"
                  name="isbn"
                  type="text"
                  value={formData.isbn}
                  onChange={handleChange}
                  placeholder="978-0156659512"
                  className={`admin-form-input ${fieldErrors.isbn ? 'error' : ''}`}
                />
                {fieldErrors.isbn && <span className="admin-field-error">{fieldErrors.isbn}</span>}
              </div>

              <div className="admin-form-group">
                <label htmlFor="publisher" className="admin-form-label">
                  Publisher / Imprint <span className="admin-optional">(Optional)</span>
                </label>
                <input
                  id="publisher"
                  name="publisher"
                  type="text"
                  value={formData.publisher}
                  onChange={handleChange}
                  placeholder="Harcourt Brace Jovanovich"
                  className="admin-form-input"
                />
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group admin-flex-1">
                  <label htmlFor="publication_date" className="admin-form-label">
                    Publication Date
                  </label>
                  <input
                    id="publication_date"
                    name="publication_date"
                    type="date"
                    value={formData.publication_date}
                    onChange={handleChange}
                    className="admin-form-input"
                  />
                </div>
                <div className="admin-form-group admin-flex-1">
                  <label htmlFor="language" className="admin-form-label">
                    Language
                  </label>
                  <input
                    id="language"
                    name="language"
                    type="text"
                    value={formData.language}
                    onChange={handleChange}
                    className="admin-form-input"
                  />
                </div>
              </div>
            </div>

            {/* Visibility & Flags */}
            <div className="admin-panel" style={{ marginTop: '1.5rem' }}>
              <h2 className="admin-panel-title">Visibility & Editorial Flags</h2>

              <div className="admin-checkbox-group">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                  />
                  <span>
                    <strong>Active in Catalogue</strong> (Visible on storefront)
                  </span>
                </label>

                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    name="is_featured"
                    checked={formData.is_featured}
                    onChange={handleChange}
                  />
                  <span>
                    <strong>Featured Title</strong> (Highlighted on homepage)
                  </span>
                </label>

                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    name="is_bestseller"
                    checked={formData.is_bestseller}
                    onChange={handleChange}
                  />
                  <span>
                    <strong>Bestseller Flag</strong> (Marked with bestseller badge)
                  </span>
                </label>

                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    name="is_new_arrival"
                    checked={formData.is_new_arrival}
                    onChange={handleChange}
                  />
                  <span>
                    <strong>New Arrival</strong> (Highlighted in recent arrivals)
                  </span>
                </label>
              </div>
            </div>

            {/* Submit Action Card */}
            <div className="admin-form-submit-panel" style={{ marginTop: '1.5rem' }}>
              <button
                type="submit"
                className="admin-btn admin-btn-primary admin-btn-block"
                disabled={submitting}
              >
                <Save size={16} />
                <span>{submitting ? 'Saving Volume...' : isEditing ? 'Update Volume' : 'Register Volume'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default BookFormPage;
