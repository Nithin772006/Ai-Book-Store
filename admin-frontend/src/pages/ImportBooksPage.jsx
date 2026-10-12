import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  UploadCloud,
  FileSpreadsheet,
  FileArchive,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Clock,
  Layers,
  Check,
  Info,
  ShieldAlert,
  ChevronRight,
  BookOpen,
  Sliders,
  Hash,
  Sparkles,
} from 'lucide-react';
import {
  getImportTemplate,
  uploadImportFile,
  validateImportJob,
  confirmImportJob,
  getImportHistory,
  downloadErrorReport,
  getAdminCategories,
} from '../api/admin';

export const ImportBooksPage = () => {
  // Navigation tabs: 'wizard' | 'history'
  const [activeTab, setActiveTab] = useState('wizard');

  // Wizard Steps: 1 ('upload') -> 2 ('mapping') -> 3 ('preview') -> 4 ('results')
  const [step, setStep] = useState(1);

  // -------------------------------------------------------------
  // STEP 1: UPLOAD STATE
  // -------------------------------------------------------------
  const [spreadsheetFile, setSpreadsheetFile] = useState(null);
  const [zipFile, setZipFile] = useState(null);
  const [isDraggingSpreadsheet, setIsDraggingSpreadsheet] = useState(false);
  const [isDraggingZip, setIsDraggingZip] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  const spreadsheetInputRef = useRef(null);
  const zipInputRef = useRef(null);

  // -------------------------------------------------------------
  // STEP 2: MAPPING & SELECTION STATE
  // -------------------------------------------------------------
  const [jobId, setJobId] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [canonicalFields, setCanonicalFields] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [mappingError, setMappingError] = useState(null);
  const [validateLoading, setValidateLoading] = useState(false);

  // Smart Quantity & Row Range Selection
  const [selectionMode, setSelectionMode] = useState('quantity'); // 'quantity' | 'range'
  const [quantityPreset, setQuantityPreset] = useState(50); // 10, 50, 100, 250, 500, 1000, 2000, 5000, 'custom'
  const [customQuantity, setCustomQuantity] = useState('');
  const [startRow, setStartRow] = useState(1);
  const [endRow, setEndRow] = useState(50);
  const [selectionInfo, setSelectionInfo] = useState(null);

  // Fallback defaults for datasets lacking price/category/description (e.g. Kaggle Book-Crossing)
  const [categoriesList, setCategoriesList] = useState([]);
  const [fallbackValues, setFallbackValues] = useState({
    price: '19.99',
    category: '',
    description: 'Catalogue volume published by {publisher} ({year}).',
  });

  // -------------------------------------------------------------
  // STEP 3: PREVIEW & CONFLICT POLICIES
  // -------------------------------------------------------------
  const [validationSummary, setValidationSummary] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewFilter, setPreviewFilter] = useState('all'); // 'all' | 'valid' | 'conflict' | 'error' | 'warning'
  const [previewPage, setPreviewPage] = useState(1);
  const previewPageSize = 10;
  const [conflictMode, setConflictMode] = useState('skip'); // 'skip' | 'update'
  const [createMissingCats, setCreateMissingCats] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  // -------------------------------------------------------------
  // STEP 4: RESULTS STATE
  // -------------------------------------------------------------
  const [finalResult, setFinalResult] = useState(null);
  const [downloadingErrors, setDownloadingErrors] = useState(false);

  // -------------------------------------------------------------
  // IMPORT HISTORY TAB STATE
  // -------------------------------------------------------------
  const [historyJobs, setHistoryJobs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Fetch categories on mount for fallback options
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const data = await getAdminCategories();
        const list = data.results || data || [];
        setCategoriesList(list);
        if (list.length > 0) {
          setFallbackValues((prev) => ({
            ...prev,
            category: prev.category || list[0].name || 'General',
          }));
        }
      } catch (err) {
        console.warn('Could not load categories for fallback defaults:', err);
      }
    };
    fetchCats();
  }, []);

  // Fetch history when tab is clicked
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await getImportHistory();
      setHistoryJobs(data.results || data || []);
    } catch (err) {
      console.error('Failed to load import history:', err);
      setHistoryError('Unable to load past import audit records.');
    } finally {
      setHistoryLoading(false);
    }
  };

  // -------------------------------------------------------------
  // TEMPLATE DOWNLOAD HANDLERS
  // -------------------------------------------------------------
  const handleDownloadTemplate = async (format) => {
    setTemplateLoading(true);
    try {
      const blob = await getImportTemplate(format);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `aetherium_book_import_template.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Template download error:', err);
      alert('Failed to download template. Please verify staff permissions.');
    } finally {
      setTemplateLoading(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 1 ACTIONS: FILE SELECTION & UPLOAD (100 MB CSV, 20 MB XLSX)
  // -------------------------------------------------------------
  const handleSpreadsheetDrop = (e) => {
    e.preventDefault();
    setIsDraggingSpreadsheet(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (ext !== '.csv' && ext !== '.xlsx') {
        setUploadError('Unsupported spreadsheet format. Please upload a .csv or .xlsx file.');
        return;
      }
      if (ext === '.csv' && file.size > 100 * 1024 * 1024) {
        setUploadError(`CSV file (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed limit of 100 MB.`);
        return;
      }
      if (ext === '.xlsx' && file.size > 20 * 1024 * 1024) {
        setUploadError(`Excel file (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed limit of 20 MB.`);
        return;
      }
      setSpreadsheetFile(file);
      setUploadError(null);
    }
  };

  const handleZipDrop = (e) => {
    e.preventDefault();
    setIsDraggingZip(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setUploadError('Cover archive must be a valid .zip file.');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setUploadError(`Cover ZIP archive (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed limit of 100 MB.`);
        return;
      }
      setZipFile(file);
      setUploadError(null);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!spreadsheetFile) {
      setUploadError('Please select a CSV or Excel (.xlsx) file to proceed.');
      return;
    }

    const ext = spreadsheetFile.name.substring(spreadsheetFile.name.lastIndexOf('.')).toLowerCase();
    if (ext === '.csv' && spreadsheetFile.size > 100 * 1024 * 1024) {
      setUploadError(`CSV file (${(spreadsheetFile.size / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed limit of 100 MB.`);
      return;
    }
    if (ext === '.xlsx' && spreadsheetFile.size > 20 * 1024 * 1024) {
      setUploadError(`Excel file (${(spreadsheetFile.size / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed limit of 20 MB.`);
      return;
    }

    if (zipFile && zipFile.size > 100 * 1024 * 1024) {
      setUploadError(`Cover ZIP archive (${(zipFile.size / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed limit of 100 MB.`);
      return;
    }

    setUploadLoading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', spreadsheetFile);
      if (zipFile) {
        formData.append('covers_zip', zipFile);
      }

      const res = await uploadImportFile(formData);
      setJobId(res.job_id);
      setFileMeta({
        filename: res.filename,
        fileType: res.file_type,
        fileSize: res.file_size,
        totalRows: res.total_rows,
        hasZip: res.has_zip_covers,
        maxBatchLimit: res.max_batch_limit || 5000,
      });
      setRawHeaders(res.raw_headers || []);
      setCanonicalFields(res.canonical_fields || []);
      setColumnMapping(res.suggested_mapping || {});

      // Reset selection defaults: 50 records default
      setSelectionMode('quantity');
      setQuantityPreset(50);
      setCustomQuantity('');
      setStartRow(1);
      setEndRow(Math.min(50, res.total_rows || 50));

      // Advance to Step 2
      setStep(2);
    } catch (err) {
      console.error('File upload error:', err);
      setUploadError(
        err.response?.data?.error ||
        'Failed to upload and parse file. Please verify file integrity and column structure.'
      );
    } finally {
      setUploadLoading(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 2 ACTIONS: SCOPE CALCULATION & VALIDATION
  // -------------------------------------------------------------
  const presetQuantities = [10, 50, 100, 250, 500, 1000, 2000, 5000];

  const getEffectiveScope = () => {
    if (selectionMode === 'quantity') {
      const q = quantityPreset === 'custom' ? parseInt(customQuantity, 10) || 50 : quantityPreset;
      return {
        mode: 'quantity',
        quantity: q,
        startRow: 1,
        endRow: q,
        count: q,
      };
    } else {
      const s = parseInt(startRow, 10) || 1;
      const e = parseInt(endRow, 10) || s;
      const cnt = Math.max(0, e - s + 1);
      return {
        mode: 'range',
        quantity: cnt,
        startRow: s,
        endRow: e,
        count: cnt,
      };
    }
  };

  const handleMappingChange = (canonicalKey, rawHeader) => {
    setColumnMapping((prev) => {
      const updated = { ...prev };
      if (!rawHeader) {
        delete updated[canonicalKey];
      } else {
        updated[canonicalKey] = rawHeader;
      }
      return updated;
    });
  };

  const runValidation = async ({
    targetConflictMode = conflictMode,
    targetCreateMissingCats = createMissingCats,
  } = {}) => {
    setValidateLoading(true);
    setMappingError(null);

    const scope = getEffectiveScope();

    // 1. Validate Scope Limits
    if (scope.mode === 'quantity') {
      if (!scope.quantity || scope.quantity < 1) {
        setMappingError('Please select or specify a valid positive book quantity.');
        setValidateLoading(false);
        return;
      }
      if (scope.quantity > 5000) {
        setMappingError('Maximum book quantity per import batch is 5,000 records.');
        setValidateLoading(false);
        return;
      }
    } else {
      if (!scope.startRow || scope.startRow < 1) {
        setMappingError('Start row must be a positive integer (minimum row 1).');
        setValidateLoading(false);
        return;
      }
      if (!scope.endRow || scope.endRow < scope.startRow) {
        setMappingError('End row cannot be less than start row.');
        setValidateLoading(false);
        return;
      }
      if (scope.count > 5000) {
        setMappingError(`Selected row range (${scope.count.toLocaleString()} rows) exceeds the maximum limit of 5,000 records per batch.`);
        setValidateLoading(false);
        return;
      }
    }

    // 2. Validate Essential Field Mappings
    if (!columnMapping['title']) {
      setMappingError('Please map the required "Title" field to a column in your spreadsheet.');
      setValidateLoading(false);
      return;
    }
    if (!columnMapping['author']) {
      setMappingError('Please map the required "Author" field to a column in your spreadsheet.');
      setValidateLoading(false);
      return;
    }

    // Check price fallback if price column is unmapped
    if (!columnMapping['price']) {
      const priceVal = parseFloat(fallbackValues.price);
      if (isNaN(priceVal) || priceVal <= 0) {
        setMappingError('Price is unmapped. Please configure a valid default fallback price (e.g. 19.99) under Dataset Fallback Defaults.');
        setValidateLoading(false);
        return;
      }
    }

    // Check category fallback if category column is unmapped
    if (!columnMapping['category'] && !fallbackValues.category) {
      setMappingError('Category is unmapped. Please select or specify a fallback category under Dataset Fallback Defaults.');
      setValidateLoading(false);
      return;
    }

    try {
      const res = await validateImportJob({
        job_id: jobId,
        column_mapping: columnMapping,
        conflict_mode: targetConflictMode,
        create_missing_categories: targetCreateMissingCats,
        selection_mode: scope.mode,
        quantity: scope.quantity,
        start_row: scope.startRow,
        end_row: scope.endRow,
        fallback_values: fallbackValues,
      });

      setValidationSummary(res.validation_summary);
      setPreviewRows(res.preview_rows || []);
      setSelectionInfo(res.selection_info);
      setStep(3);
    } catch (err) {
      console.error('Validation error:', err);
      setMappingError(
        err.response?.data?.error ||
        'Validation failed. Please verify column mappings.'
      );
    } finally {
      setValidateLoading(false);
    }
  };

  const handleValidateSubmit = async () => {
    await runValidation();
  };

  // -------------------------------------------------------------
  // STEP 3 ACTIONS: RE-VALIDATE WITH UPDATED POLICIES & CONFIRM
  // -------------------------------------------------------------
  const handleConflictModeChange = async (mode) => {
    setConflictMode(mode);
    await runValidation({ targetConflictMode: mode });
  };

  const handleCreateMissingCatsChange = async (checked) => {
    setCreateMissingCats(checked);
    await runValidation({ targetCreateMissingCats: checked });
  };

  const handleConfirmImport = async () => {
    setConfirmLoading(true);
    setConfirmError(null);

    const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}`;

    try {
      const res = await confirmImportJob({
        job_id: jobId,
        conflict_mode: conflictMode,
        create_missing_categories: createMissingCats,
        idempotency_key: idempotencyKey,
      });

      setFinalResult({
        job: res.job,
        message: res.message,
      });
      setStep(4);
    } catch (err) {
      console.error('Import execution error:', err);
      setConfirmError(
        err.response?.data?.error ||
        'An error occurred during database import execution. Transactions were safely rolled back.'
      );
    } finally {
      setConfirmLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ERROR REPORT CSV DOWNLOAD
  // -------------------------------------------------------------
  const handleDownloadErrors = async (targetJobId) => {
    setDownloadingErrors(true);
    try {
      const blob = await downloadErrorReport(targetJobId || jobId);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `import_error_report_${targetJobId || jobId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error report download failed:', err);
      alert('Could not download error report.');
    } finally {
      setDownloadingErrors(false);
    }
  };

  // -------------------------------------------------------------
  // RESET WIZARD
  // -------------------------------------------------------------
  const handleResetWizard = () => {
    setStep(1);
    setSpreadsheetFile(null);
    setZipFile(null);
    setJobId(null);
    setFileMeta(null);
    setRawHeaders([]);
    setCanonicalFields([]);
    setColumnMapping({});
    setValidationSummary(null);
    setPreviewRows([]);
    setFinalResult(null);
    setUploadError(null);
    setMappingError(null);
    setConfirmError(null);
    setConflictMode('skip');
    setCreateMissingCats(false);
    setSelectionMode('quantity');
    setQuantityPreset(50);
    setCustomQuantity('');
    setStartRow(1);
    setEndRow(50);
    setSelectionInfo(null);
  };

  // -------------------------------------------------------------
  // FILTERED PREVIEW ROWS & PAGINATION
  // -------------------------------------------------------------
  const filteredPreviewRows = previewRows.filter((r) => {
    if (previewFilter === 'all') return true;
    return r._status === previewFilter;
  });

  const totalPreviewPages = Math.ceil(filteredPreviewRows.length / previewPageSize) || 1;
  const paginatedPreviewRows = filteredPreviewRows.slice(
    (previewPage - 1) * previewPageSize,
    previewPage * previewPageSize
  );

  return (
    <div className="admin-page-container">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <div className="admin-breadcrumb">
            <Link to="/books">Volumes & Catalogue</Link>
            <ChevronRight size={14} />
            <span>Bulk Book Importer</span>
          </div>
          <h1 className="admin-page-headline">Bulk Catalogue Importer</h1>
          <p className="admin-page-subheadline">
            Ingest, map, validate, and register multi-volume inventories from CSV and Excel (.xlsx) archives.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="admin-tabs" style={{ alignSelf: 'flex-start' }}>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'wizard' ? 'active' : ''}`}
            onClick={() => setActiveTab('wizard')}
          >
            <UploadCloud size={16} />
            <span>Import Studio</span>
          </button>
          <button
            type="button"
            className={`admin-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Clock size={16} />
            <span>Audit History</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: IMPORT STUDIO WIZARD                                */}
      {/* ========================================================= */}
      {activeTab === 'wizard' && (
        <div className="admin-importer-wrapper">
          {/* Progress Stepper Bar */}
          <div className="admin-stepper-card">
            <div className="admin-stepper-track">
              {/* Step 1 */}
              <div className={`admin-stepper-node ${step >= 1 ? 'completed' : ''} ${step === 1 ? 'active' : ''}`}>
                <div className="admin-stepper-bubble">1</div>
                <span className="admin-stepper-title">Upload Archive</span>
              </div>
              <div className={`admin-stepper-connector ${step >= 2 ? 'filled' : ''}`} />

              {/* Step 2 */}
              <div className={`admin-stepper-node ${step >= 2 ? 'completed' : ''} ${step === 2 ? 'active' : ''}`}>
                <div className="admin-stepper-bubble">2</div>
                <span className="admin-stepper-title">Map Fields</span>
              </div>
              <div className={`admin-stepper-connector ${step >= 3 ? 'filled' : ''}`} />

              {/* Step 3 */}
              <div className={`admin-stepper-node ${step >= 3 ? 'completed' : ''} ${step === 3 ? 'active' : ''}`}>
                <div className="admin-stepper-bubble">3</div>
                <span className="admin-stepper-title">Validate & Preview</span>
              </div>
              <div className={`admin-stepper-connector ${step >= 4 ? 'filled' : ''}`} />

              {/* Step 4 */}
              <div className={`admin-stepper-node ${step === 4 ? 'active completed' : ''}`}>
                <div className="admin-stepper-bubble">4</div>
                <span className="admin-stepper-title">Results & Audit</span>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* STAGE 1: UPLOAD                                               */}
          {/* ------------------------------------------------------------- */}
          {step === 1 && (
            <div className="admin-importer-step-container">
              {/* Template Download & Instructions Card */}
              <div className="admin-panel-card" style={{ marginBottom: '1.5rem' }}>
                <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 className="admin-card-title">Curatorial Templates & Format Guidelines</h2>
                    <p className="admin-card-subtitle">
                      Download pre-formatted templates matching AETHERIUM's exact schema constraints.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => handleDownloadTemplate('csv')}
                      disabled={templateLoading}
                    >
                      <Download size={14} />
                      <span>Download CSV Template</span>
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => handleDownloadTemplate('xlsx')}
                      disabled={templateLoading}
                    >
                      <Download size={14} />
                      <span>Download Excel (.xlsx) Template</span>
                    </button>
                  </div>
                </div>

                <div className="admin-importer-guidelines-grid">
                  <div className="admin-guideline-item">
                    <span className="admin-guideline-badge">Accepted Formats</span>
                    <p>Large datasets in UTF-8 / UTF-8-sig <code>.csv</code> (up to 100 MB) or modern Excel <code>.xlsx</code> (up to 20 MB).</p>
                  </div>
                  <div className="admin-guideline-item">
                    <span className="admin-guideline-badge">Batch Control</span>
                    <p>Select any slice (e.g. <strong>first 50 books</strong> or range <strong>51–100</strong>) up to <strong>5,000 records</strong> per batch without file splitting.</p>
                  </div>
                  <div className="admin-guideline-item">
                    <span className="admin-guideline-badge">Maximum Limits</span>
                    <p>CSV up to <strong>100 MB</strong> (~27,000+ books), Excel up to <strong>20 MB</strong>. Cover ZIP up to <strong>100 MB</strong>.</p>
                  </div>
                  <div className="admin-guideline-item">
                    <span className="admin-guideline-badge">Security Defenses</span>
                    <p>Strict SSRF URL validation, CSV formula injection defense, and non-destructive duplicate skipping active.</p>
                  </div>
                </div>
              </div>

              {/* Upload Dropzones Form */}
              <form onSubmit={handleUploadSubmit} className="admin-panel-card">
                <h2 className="admin-card-title" style={{ marginBottom: '1rem' }}>Select Data Files</h2>

                {uploadError && (
                  <div className="admin-alert admin-alert-danger" style={{ marginBottom: '1.25rem' }}>
                    <AlertTriangle size={18} />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div className="admin-dropzone-grid">
                  {/* Primary Dropzone: Spreadsheet */}
                  <div
                    className={`admin-dropzone-box ${isDraggingSpreadsheet ? 'dragging' : ''} ${spreadsheetFile ? 'has-file' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingSpreadsheet(true); }}
                    onDragLeave={() => setIsDraggingSpreadsheet(false)}
                    onDrop={handleSpreadsheetDrop}
                    onClick={() => spreadsheetInputRef.current?.click()}
                  >
                    <input
                      ref={spreadsheetInputRef}
                      type="file"
                      accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                          if (ext === '.csv' && file.size > 100 * 1024 * 1024) {
                            setUploadError(`CSV file (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed limit of 100 MB.`);
                          } else if (ext === '.xlsx' && file.size > 20 * 1024 * 1024) {
                            setUploadError(`Excel file (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed limit of 20 MB.`);
                          } else {
                            setSpreadsheetFile(file);
                            setUploadError(null);
                          }
                        }
                      }}
                    />
                    <div className="admin-dropzone-icon-wrap">
                      <FileSpreadsheet size={32} />
                    </div>
                    {spreadsheetFile ? (
                      <div className="admin-dropzone-file-info">
                        <span className="admin-dropzone-file-name">{spreadsheetFile.name}</span>
                        <span className="admin-dropzone-file-size">
                          {(spreadsheetFile.size / 1024 / 1024).toFixed(2)} MB • Click to replace
                        </span>
                      </div>
                    ) : (
                      <div className="admin-dropzone-prompt">
                        <span className="admin-dropzone-main-text">Drag & drop spreadsheet here</span>
                        <span className="admin-dropzone-sub-text">or click to browse from device (CSV max 100 MB, XLSX max 20 MB)</span>
                      </div>
                    )}
                  </div>

                  {/* Secondary Dropzone: Optional Cover ZIP */}
                  <div
                    className={`admin-dropzone-box ${isDraggingZip ? 'dragging' : ''} ${zipFile ? 'has-file' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingZip(true); }}
                    onDragLeave={() => setIsDraggingZip(false)}
                    onDrop={handleZipDrop}
                    onClick={() => zipInputRef.current?.click()}
                  >
                    <input
                      ref={zipInputRef}
                      type="file"
                      accept=".zip, application/zip, application/x-zip-compressed"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          if (!file.name.toLowerCase().endsWith('.zip')) {
                            setUploadError('Cover archive must be a valid .zip file.');
                          } else if (file.size > 100 * 1024 * 1024) {
                            setUploadError(`Cover ZIP archive (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds maximum allowed limit of 100 MB.`);
                          } else {
                            setZipFile(file);
                            setUploadError(null);
                          }
                        }
                      }}
                    />
                    <div className="admin-dropzone-icon-wrap subtle">
                      <FileArchive size={32} />
                    </div>
                    {zipFile ? (
                      <div className="admin-dropzone-file-info">
                        <span className="admin-dropzone-file-name">{zipFile.name}</span>
                        <span className="admin-dropzone-file-size">
                          {(zipFile.size / 1024 / 1024).toFixed(2)} MB • Maximum cover ZIP size: 100 MB
                        </span>
                        <button
                          type="button"
                          className="admin-dropzone-remove-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setZipFile(null);
                          }}
                        >
                          Remove ZIP
                        </button>
                      </div>
                    ) : (
                      <div className="admin-dropzone-prompt">
                        <span className="admin-dropzone-main-text">Optional Cover Images ZIP</span>
                        <span className="admin-dropzone-sub-text">Maximum cover ZIP size: 100 MB • Matched by ISBN or cover_filename (.zip)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Action */}
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={!spreadsheetFile || uploadLoading}
                  >
                    {uploadLoading ? (
                      <>
                        <RefreshCw size={16} className="admin-spin" />
                        <span>{zipFile ? 'Uploading and inspecting archive (up to 100 MB)...' : 'Inspecting & Uploading Archive...'}</span>
                      </>
                    ) : (
                      <>
                        <span>Continue to Field Mapping</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STAGE 2: IMPORT QUANTITY SELECTION & COLUMN MAPPING           */}
          {/* ------------------------------------------------------------- */}
          {step === 2 && (
            <div className="admin-importer-step-container">
              {/* File Meta Header Card */}
              <div className="admin-panel-card" style={{ marginBottom: '1.5rem' }}>
                <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 className="admin-card-title">Uploaded Dataset Overview</h2>
                    <p className="admin-card-subtitle">
                      Large dataset parsed and indexed. Select your batch slice below without needing to split or edit the file in Excel.
                    </p>
                  </div>
                  <div className="admin-badge-group">
                    <span className="admin-badge badge-neutral">
                      File: <strong>{fileMeta?.filename}</strong>
                    </span>
                    <span className="admin-badge badge-info">
                      Total Available Records: <strong>{fileMeta?.totalRows?.toLocaleString()}</strong>
                    </span>
                    {fileMeta?.fileSize && (
                      <span className="admin-badge badge-neutral">
                        Size: <strong>{(fileMeta.fileSize / 1024 / 1024).toFixed(1)} MB</strong>
                      </span>
                    )}
                    {fileMeta?.hasZip && (
                      <span className="admin-badge badge-success">Cover ZIP Attached</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Scope & Quantity Selector Card */}
              <div className="admin-scope-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <Sliders size={20} style={{ color: 'var(--admin-accent-primary)' }} />
                  <h3 className="admin-card-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                    How many books would you like to import?
                  </h3>
                </div>
                <p className="admin-card-subtitle" style={{ marginBottom: '1.25rem' }}>
                  Choose a preset quantity or specify an advanced row range. The server batch limit is 5,000 records.
                </p>

                {/* Mode Switcher Tabs */}
                <div className="admin-mode-tabs">
                  <button
                    type="button"
                    className={`admin-mode-tab ${selectionMode === 'quantity' ? 'active' : ''}`}
                    onClick={() => setSelectionMode('quantity')}
                  >
                    Preset Quantity Mode
                  </button>
                  <button
                    type="button"
                    className={`admin-mode-tab ${selectionMode === 'range' ? 'active' : ''}`}
                    onClick={() => setSelectionMode('range')}
                  >
                    Advanced Row Range Mode
                  </button>
                </div>

                {/* Mode 1: Preset Quantity */}
                {selectionMode === 'quantity' && (
                  <div>
                    <div className="admin-quantity-grid">
                      {presetQuantities.map((preset) => {
                        const isSelected = quantityPreset === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            className={`admin-quantity-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                              setQuantityPreset(preset);
                              setCustomQuantity('');
                            }}
                          >
                            <span>{preset.toLocaleString()} books</span>
                            {preset === 50 && (
                              <span className="admin-quantity-btn-badge">(Default)</span>
                            )}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className={`admin-quantity-btn ${quantityPreset === 'custom' ? 'active' : ''}`}
                        onClick={() => setQuantityPreset('custom')}
                      >
                        <span>Custom quantity</span>
                        <span className="admin-quantity-btn-badge">Enter value</span>
                      </button>
                    </div>

                    {quantityPreset === 'custom' && (
                      <div className="admin-custom-quantity-box">
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--admin-text-primary)' }}>
                          Enter Book Count:
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="5000"
                          placeholder="e.g. 75"
                          className="admin-form-input"
                          style={{ width: '130px' }}
                          value={customQuantity}
                          onChange={(e) => setCustomQuantity(e.target.value)}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                          (1 – 5,000 records)
                        </span>
                      </div>
                    )}

                    {/* Scope Notice */}
                    {fileMeta?.totalRows && (quantityPreset === 'custom' ? (parseInt(customQuantity, 10) || 50) : quantityPreset) > fileMeta.totalRows && (
                      <div className="admin-alert admin-alert-warning" style={{ marginBottom: '1rem' }}>
                        <Info size={16} />
                        <span>
                          The CSV contains <strong>{fileMeta.totalRows.toLocaleString()} data records</strong>, which is fewer than the requested{' '}
                          <strong>{(quantityPreset === 'custom' ? (parseInt(customQuantity, 10) || 50) : quantityPreset).toLocaleString()} books</strong>.
                          The import will safely process all {fileMeta.totalRows.toLocaleString()} available records.
                        </span>
                      </div>
                    )}

                    <div className="admin-scope-summary-banner">
                      <div className="admin-scope-summary-text">
                        <strong>Selected Scope:</strong> Records 1 to{' '}
                        {Math.min(
                          quantityPreset === 'custom' ? parseInt(customQuantity, 10) || 50 : quantityPreset,
                          fileMeta?.totalRows || 5000
                        ).toLocaleString()}{' '}
                        of {fileMeta?.totalRows?.toLocaleString() || '...'} available data records
                      </div>
                      <span className="admin-badge badge-info">
                        {(quantityPreset === 'custom' ? parseInt(customQuantity, 10) || 50 : quantityPreset).toLocaleString()} books
                      </span>
                    </div>
                  </div>
                )}

                {/* Mode 2: Advanced Row Range */}
                {selectionMode === 'range' && (
                  <div>
                    <div className="admin-range-form-grid">
                      <div>
                        <label className="admin-form-label" style={{ marginBottom: '0.25rem', display: 'block', fontSize: '0.82rem', fontWeight: 600 }}>
                          Start Row (1-based data record):
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="admin-form-input"
                          value={startRow}
                          onChange={(e) => setStartRow(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="admin-form-label" style={{ marginBottom: '0.25rem', display: 'block', fontSize: '0.82rem', fontWeight: 600 }}>
                          End Row:
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="admin-form-input"
                          value={endRow}
                          onChange={(e) => setEndRow(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Quick Range Presets Chips */}
                    <div style={{ marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-secondary)', fontWeight: 500 }}>
                        Quick Range Presets:
                      </span>
                      <div className="admin-preset-chips">
                        {[
                          { label: '1–50', start: 1, end: 50 },
                          { label: '51–100', start: 51, end: 100 },
                          { label: '101–150', start: 101, end: 150 },
                          { label: '501–1,000', start: 501, end: 1000 },
                        ].map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            className="admin-range-chip"
                            onClick={() => {
                              setStartRow(chip.start);
                              setEndRow(chip.end);
                            }}
                          >
                            Rows {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="admin-scope-summary-banner">
                      <div className="admin-scope-summary-text">
                        <strong>Selected Range:</strong> Rows {startRow} to {endRow} (
                        {Math.max(0, (parseInt(endRow, 10) || 0) - (parseInt(startRow, 10) || 0) + 1).toLocaleString()} records)
                      </div>
                      <span className="admin-badge badge-info">
                        {Math.max(0, (parseInt(endRow, 10) || 0) - (parseInt(startRow, 10) || 0) + 1).toLocaleString()} records
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Column Mapping Card */}
              <div className="admin-panel-card" style={{ marginBottom: '1.5rem' }}>
                <div className="admin-card-header">
                  <div>
                    <h3 className="admin-card-title">Map Spreadsheet Columns to Catalogue Fields</h3>
                    <p className="admin-card-subtitle">
                      Review column mapping. Columns not present in the dataset can use fallback defaults below.
                    </p>
                  </div>
                </div>

                {mappingError && (
                  <div className="admin-alert admin-alert-danger" style={{ marginBottom: '1.25rem' }}>
                    <AlertTriangle size={18} />
                    <span>{mappingError}</span>
                  </div>
                )}

                <div className="admin-mapping-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>Bookstore Field</th>
                        <th style={{ width: '12%' }}>Requirement</th>
                        <th style={{ width: '38%' }}>Spreadsheet Header</th>
                        <th style={{ width: '28%' }}>Description / Expected Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {canonicalFields.map((field) => {
                        const currentVal = columnMapping[field.key] || '';
                        const isAutoMatched = Boolean(currentVal);

                        return (
                          <tr key={field.key}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <strong>{field.label}</strong>
                                {isAutoMatched && (
                                  <span title="Auto-matched by alias" style={{ color: 'var(--admin-status-success)' }}>
                                    <Check size={14} />
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)' }}>
                                <code>{field.key}</code>
                              </span>
                            </td>
                            <td>
                              {field.required ? (
                                <span className="admin-badge badge-danger">Required</span>
                              ) : (
                                <span className="admin-badge badge-neutral">Optional</span>
                              )}
                            </td>
                            <td>
                              <select
                                className="admin-form-select"
                                value={currentVal}
                                onChange={(e) => handleMappingChange(field.key, e.target.value)}
                              >
                                <option value="">-- Do Not Import / Leave Blank --</option>
                                {rawHeaders.map((header) => (
                                  <option key={header} value={header}>
                                    {header}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
                              {field.description}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fallback Defaults Card */}
              <div className="admin-fallback-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <Sparkles size={18} style={{ color: 'var(--admin-accent-primary)' }} />
                  <h3 className="admin-card-title" style={{ margin: 0, fontSize: '1.05rem' }}>
                    Dataset Fallback Defaults (Safe Schema Fallbacks)
                  </h3>
                </div>
                <p className="admin-card-subtitle" style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
                  If your dataset (e.g. Kaggle Book-Crossing) does not contain columns for Price, Category, or Description, these explicit fallback values satisfy database constraints without inventing ISBNs.
                </p>

                <div className="admin-fallback-grid">
                  <div>
                    <label className="admin-form-label" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      Default Price ($ USD) (Used if unmapped):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="admin-form-input"
                      value={fallbackValues.price}
                      onChange={(e) => setFallbackValues({ ...fallbackValues, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="admin-form-label" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      Default Category (Used if unmapped):
                    </label>
                    <input
                      type="text"
                      list="categories-datalist"
                      className="admin-form-input"
                      placeholder="e.g. Fiction"
                      value={fallbackValues.category}
                      onChange={(e) => setFallbackValues({ ...fallbackValues, category: e.target.value })}
                    />
                    <datalist id="categories-datalist">
                      {categoriesList.map((c) => (
                        <option key={c.id || c.name} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="admin-form-label" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                      Default Description Template (Used if unmapped):
                    </label>
                    <input
                      type="text"
                      className="admin-form-input"
                      placeholder="Catalogue volume published by {publisher} ({year})."
                      value={fallbackValues.description}
                      onChange={(e) => setFallbackValues({ ...fallbackValues, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Stage 2 Navigation */}
              <div className="admin-stage-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Upload</span>
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={handleValidateSubmit}
                  disabled={validateLoading}
                >
                  {validateLoading ? (
                    <>
                      <RefreshCw size={16} className="admin-spin" />
                      <span>Validating Selected Records...</span>
                    </>
                  ) : (
                    <>
                      <span>Validate & Preview Records</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STAGE 3: VALIDATION SUMMARY, POLICIES & PREVIEW               */}
          {/* ------------------------------------------------------------- */}
          {step === 3 && validationSummary && (
            <div className="admin-importer-step-container">
              {/* Selected Dataset Slice Banner */}
              <div className="admin-scope-summary-banner" style={{ marginBottom: '1.5rem', background: 'var(--admin-bg-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <CheckCircle2 size={20} style={{ color: 'var(--admin-status-success)' }} />
                  <div className="admin-scope-summary-text">
                    <strong>Selected Slice:</strong> Rows {selectionInfo?.start_row || 1} to {selectionInfo?.end_row || previewRows.length} •{' '}
                    <strong>{selectionInfo?.total_selected || previewRows.length} records selected</strong> from{' '}
                    {selectionInfo?.total_available_rows?.toLocaleString() || fileMeta?.totalRows?.toLocaleString()} total records in <code>{fileMeta?.filename}</code>
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => setStep(2)}
                >
                  Change Quantity / Rows
                </button>
              </div>

              {/* Metric KPI Cards */}
              <div className="admin-importer-kpi-grid">
                <div className="admin-importer-kpi-card valid">
                  <span className="admin-kpi-number">{validationSummary.valid_rows_count}</span>
                  <span className="admin-kpi-label">Ready / Valid</span>
                  <span className="admin-kpi-desc">Meets all model constraints</span>
                </div>
                <div className="admin-importer-kpi-card warning">
                  <span className="admin-kpi-number">{validationSummary.warning_rows_count}</span>
                  <span className="admin-kpi-label">Warnings</span>
                  <span className="admin-kpi-desc">Minor notices (non-fatal)</span>
                </div>
                <div className="admin-importer-kpi-card conflict">
                  <span className="admin-kpi-number">{validationSummary.conflict_rows_count}</span>
                  <span className="admin-kpi-label">Conflicts / Duplicates</span>
                  <span className="admin-kpi-desc">Matches existing book in DB</span>
                </div>
                <div className="admin-importer-kpi-card error">
                  <span className="admin-kpi-number">{validationSummary.invalid_rows_count}</span>
                  <span className="admin-kpi-label">Fatal Errors</span>
                  <span className="admin-kpi-desc">Will be skipped or rejected</span>
                </div>
              </div>

              {/* Conflict & Category Policies Card */}
              <div className="admin-panel-card" style={{ marginBottom: '1.5rem' }}>
                <h3 className="admin-card-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
                  Import Policies & Safeguards
                </h3>

                <div className="admin-policy-grid">
                  {/* Duplicate Policy */}
                  <div className="admin-policy-section">
                    <label className="admin-policy-heading">Duplicate & Conflict Handling</label>
                    <div className="admin-radio-group">
                      <label className="admin-radio-label">
                        <input
                          type="radio"
                          name="conflict_mode"
                          value="skip"
                          checked={conflictMode === 'skip'}
                          onChange={() => handleConflictModeChange('skip')}
                        />
                        <div>
                          <strong>Skip existing duplicates (Recommended)</strong>
                          <p>Preserves existing volumes in the bookstore. Only creates new books.</p>
                        </div>
                      </label>
                      <label className="admin-radio-label">
                        <input
                          type="radio"
                          name="conflict_mode"
                          value="update"
                          checked={conflictMode === 'update'}
                          onChange={() => handleConflictModeChange('update')}
                        />
                        <div>
                          <strong>Update existing books</strong>
                          <p>Overwrites matching volumes with updated prices, stock, and descriptions.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Category Policy */}
                  <div className="admin-policy-section">
                    <label className="admin-policy-heading">Discipline / Category Creation</label>
                    <label className="admin-checkbox-label">
                      <input
                        type="checkbox"
                        checked={createMissingCats}
                        onChange={(e) => handleCreateMissingCatsChange(e.target.checked)}
                      />
                      <span>Automatically create missing categories</span>
                    </label>
                    <p style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>
                      By default, missing categories trigger warnings and row rejections to prevent accidental taxonomy pollution.
                    </p>

                    {validationSummary.missing_categories?.length > 0 && (
                      <div className="admin-missing-cats-box">
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Unrecognized categories detected:</span>
                        <div className="admin-badge-list" style={{ marginTop: '0.35rem' }}>
                          {validationSummary.missing_categories.map((c) => (
                            <span key={c} className="admin-badge badge-warning">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="admin-panel-card" style={{ marginBottom: '1.5rem' }}>
                <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 className="admin-card-title">Normalized Data Preview</h3>
                    <p className="admin-card-subtitle">
                      Showing row-level validation status and normalization output.
                    </p>
                  </div>

                  {/* Filter Tabs */}
                  <div className="admin-filter-pills">
                    <button
                      type="button"
                      className={`admin-pill ${previewFilter === 'all' ? 'active' : ''}`}
                      onClick={() => { setPreviewFilter('all'); setPreviewPage(1); }}
                    >
                      All ({previewRows.length})
                    </button>
                    <button
                      type="button"
                      className={`admin-pill ${previewFilter === 'valid' ? 'active' : ''}`}
                      onClick={() => { setPreviewFilter('valid'); setPreviewPage(1); }}
                    >
                      Valid ({validationSummary.valid_rows_count})
                    </button>
                    <button
                      type="button"
                      className={`admin-pill ${previewFilter === 'conflict' ? 'active' : ''}`}
                      onClick={() => { setPreviewFilter('conflict'); setPreviewPage(1); }}
                    >
                      Conflicts ({validationSummary.conflict_rows_count})
                    </button>
                    <button
                      type="button"
                      className={`admin-pill ${previewFilter === 'error' ? 'active' : ''}`}
                      onClick={() => { setPreviewFilter('error'); setPreviewPage(1); }}
                    >
                      Errors ({validationSummary.invalid_rows_count})
                    </button>
                  </div>
                </div>

                <div className="admin-table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{ width: '70px' }}>Row</th>
                        <th style={{ width: '100px' }}>Status</th>
                        <th>Title & Author</th>
                        <th>Publisher & Year</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>ISBN</th>
                        <th>Cover</th>
                        <th>Notices / Diagnostics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPreviewRows.map((row) => (
                        <tr key={row._row_num} className={`admin-row-status-${row._status}`}>
                          <td>
                            <strong>#{row._row_num}</strong>
                          </td>
                          <td>
                            {row._status === 'valid' && (
                              <span className="admin-badge badge-success">Valid</span>
                            )}
                            {row._status === 'warning' && (
                              <span className="admin-badge badge-warning">Warning</span>
                            )}
                            {row._status === 'conflict' && (
                              <span className="admin-badge badge-info">
                                {conflictMode === 'update' ? 'Will Update' : 'Will Skip'}
                              </span>
                            )}
                            {row._status === 'error' && (
                              <span className="admin-badge badge-danger">Invalid</span>
                            )}
                          </td>
                          <td>
                            <strong>{row.title || <em>[Missing Title]</em>}</strong>
                            <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-secondary)' }}>
                              {row.author || <em>[Missing Author]</em>}
                            </div>
                          </td>
                          <td>
                            <div>{row.publisher || '—'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>
                              {row.publication_year ? `Year: ${row.publication_year}` : ''}
                            </div>
                          </td>
                          <td>
                            <span>{row.category_name}</span>
                            {row.category_id ? (
                              <span title="Matched existing category" style={{ color: 'var(--admin-status-success)', marginLeft: '4px' }}>
                                ✓
                              </span>
                            ) : (
                              <span title="New or fallback category" style={{ color: 'var(--admin-status-warning)', marginLeft: '4px' }}>
                                ⚠
                              </span>
                            )}
                          </td>
                          <td>${row.price || '0.00'}</td>
                          <td>
                            <code>{row.isbn || '—'}</code>
                          </td>
                          <td>
                            {row.cover_image_url ? (
                              <a
                                href={row.cover_image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={row.cover_image_url}
                                style={{ fontSize: '0.75rem', color: 'var(--admin-accent-primary)', textDecoration: 'underline' }}
                              >
                                View Cover
                              </a>
                            ) : row.cover_filename ? (
                              <span className="admin-badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                                ZIP: {row.cover_filename}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.75rem' }}>—</span>
                            )}
                          </td>
                          <td>
                            {row._errors?.length > 0 && (
                              <div className="admin-error-text">
                                {row._errors.map((err, idx) => (
                                  <div key={idx}>✕ {err}</div>
                                ))}
                              </div>
                            )}
                            {row._warnings?.length > 0 && (
                              <div className="admin-warning-text">
                                {row._warnings.map((warn, idx) => (
                                  <div key={idx}>⚠ {warn}</div>
                                ))}
                              </div>
                            )}
                            {row._status === 'conflict' && row.conflict_details && (
                              <div className="admin-info-text">
                                ℹ {row.conflict_details.reason} (Current Title: "{row.conflict_details.existing_title}")
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Preview Pagination */}
                {totalPreviewPages > 1 && (
                  <div className="admin-pagination-bar">
                    <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>
                      Page {previewPage} of {totalPreviewPages} ({filteredPreviewRows.length} total rows)
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        disabled={previewPage <= 1}
                        onClick={() => setPreviewPage((p) => Math.max(p - 1, 1))}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        disabled={previewPage >= totalPreviewPages}
                        onClick={() => setPreviewPage((p) => Math.min(p + 1, totalPreviewPages))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {confirmError && (
                <div className="admin-alert admin-alert-danger" style={{ marginBottom: '1.25rem' }}>
                  <AlertTriangle size={18} />
                  <span>{confirmError}</span>
                </div>
              )}

              {/* Stage 3 Navigation */}
              <div className="admin-stage-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setStep(2)}
                  disabled={confirmLoading}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Field Mapping</span>
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={handleConfirmImport}
                  disabled={confirmLoading || (validationSummary.ready_to_import_count === 0)}
                >
                  {confirmLoading ? (
                    <>
                      <RefreshCw size={16} className="admin-spin" />
                      <span>Writing to Database & Uploading Covers...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirm & Import {validationSummary.ready_to_import_count} Volumes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* STAGE 4: FINAL RESULTS                                        */}
          {/* ------------------------------------------------------------- */}
          {step === 4 && finalResult && (
            <div className="admin-importer-step-container">
              <div className="admin-panel-card">
                <div className="admin-results-hero">
                  <div className="admin-results-icon-wrap">
                    <CheckCircle2 size={48} />
                  </div>
                  <h2 className="admin-results-title">Inventory Import Completed</h2>
                  <p className="admin-results-sub">{finalResult.message}</p>
                </div>

                {/* Tallies */}
                <div className="admin-importer-kpi-grid" style={{ margin: '2rem 0' }}>
                  <div className="admin-importer-kpi-card valid">
                    <span className="admin-kpi-number">{finalResult.job.created_count}</span>
                    <span className="admin-kpi-label">Volumes Created</span>
                  </div>
                  <div className="admin-importer-kpi-card conflict">
                    <span className="admin-kpi-number">{finalResult.job.updated_count}</span>
                    <span className="admin-kpi-label">Volumes Updated</span>
                  </div>
                  <div className="admin-importer-kpi-card warning">
                    <span className="admin-kpi-number">{finalResult.job.skipped_count}</span>
                    <span className="admin-kpi-label">Volumes Skipped</span>
                  </div>
                  <div className="admin-importer-kpi-card error">
                    <span className="admin-kpi-number">{finalResult.job.failed_count}</span>
                    <span className="admin-kpi-label">Rejected / Failed</span>
                  </div>
                </div>

                {/* Error Report Download if any failed rows exist */}
                {finalResult.job.failed_count > 0 && (
                  <div className="admin-alert admin-alert-warning" style={{ marginBottom: '2rem', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <AlertTriangle size={20} />
                      <div>
                        <strong>{finalResult.job.failed_count} rows were rejected during execution.</strong>
                        <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                          A downloadable CSV report with row numbers, rejected values, and formula-injection defense is available.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => handleDownloadErrors(finalResult.job.job_id)}
                      disabled={downloadingErrors}
                    >
                      <Download size={14} />
                      <span>Download Error Report (CSV)</span>
                    </button>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-secondary"
                    onClick={handleResetWizard}
                  >
                    <UploadCloud size={16} />
                    <span>Import Another File</span>
                  </button>
                  <Link to="/books" className="admin-btn admin-btn-primary">
                    <BookOpen size={16} />
                    <span>View Book Catalogue</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: AUDIT HISTORY                                      */}
      {/* ========================================================= */}
      {activeTab === 'history' && (
        <div className="admin-panel-card">
          <div className="admin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="admin-card-title">Catalogue Import Audit Log</h2>
              <p className="admin-card-subtitle">
                Immutable ledger of past batch imports, initiating staff members, and executed counts.
              </p>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={fetchHistory}
              disabled={historyLoading}
            >
              <RefreshCw size={14} className={historyLoading ? 'admin-spin' : ''} />
              <span>Refresh Log</span>
            </button>
          </div>

          {historyError && (
            <div className="admin-alert admin-alert-danger" style={{ marginBottom: '1.25rem' }}>
              <AlertTriangle size={18} />
              <span>{historyError}</span>
            </div>
          )}

          {historyLoading ? (
            <div className="admin-table-loading">
              <div className="admin-loading-spinner" />
              <p>Loading historical import audits...</p>
            </div>
          ) : historyJobs.length === 0 ? (
            <div className="admin-empty-state">
              <Clock size={36} />
              <h3>No past import jobs found</h3>
              <p>All bulk uploads and their audit tallies will be recorded here.</p>
            </div>
          ) : (
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Initiator</th>
                    <th>Filename</th>
                    <th>Status</th>
                    <th>Execution Tallies</th>
                    <th style={{ textAlign: 'right' }}>Error Report</th>
                  </tr>
                </thead>
                <tbody>
                  {historyJobs.map((job) => (
                    <tr key={job.job_id}>
                      <td style={{ fontSize: '0.8rem' }}>
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td>
                        <strong>{job.created_by_name || 'Staff Curator'}</strong>
                      </td>
                      <td>
                        <code>{job.filename}</code>
                        <span className="admin-badge badge-neutral" style={{ marginLeft: '6px' }}>
                          {job.file_type?.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {job.status === 'completed' && (
                          <span className="admin-badge badge-success">Completed</span>
                        )}
                        {job.status === 'processing' && (
                          <span className="admin-badge badge-info">Processing</span>
                        )}
                        {job.status === 'validated' && (
                          <span className="admin-badge badge-warning">Validated</span>
                        )}
                        {job.status === 'failed' && (
                          <span className="admin-badge badge-danger">Failed</span>
                        )}
                        {job.status === 'pending' && (
                          <span className="admin-badge badge-neutral">Pending</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--admin-status-success)' }}>
                          +{job.created_count} created
                        </span>
                        {' • '}
                        <span style={{ color: 'var(--admin-status-info)' }}>
                          ~{job.updated_count} updated
                        </span>
                        {' • '}
                        <span style={{ color: 'var(--admin-status-warning)' }}>
                          -{job.skipped_count} skipped
                        </span>
                        {' • '}
                        <span style={{ color: 'var(--admin-status-danger)' }}>
                          !{job.failed_count} failed
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {job.failed_count > 0 ? (
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                            onClick={() => handleDownloadErrors(job.job_id)}
                          >
                            <Download size={12} />
                            <span>Errors CSV</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>
                            Clean Import
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportBooksPage;
