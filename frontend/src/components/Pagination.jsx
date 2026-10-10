import React from 'react';

export default function Pagination({
  currentPage = 1,
  totalCount = 0,
  pageSize = 12,
  onPageChange,
  hasNext = false,
  hasPrev = false,
}) {
  const totalPages = Math.ceil(totalCount / pageSize);

  if (totalPages <= 1) {
    return null;
  }

  // Calculate slice range for info label
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  // Generate page numbers with intelligent truncation
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <nav className="pagination-container" aria-label="Pagination Navigation">
      <div className="pagination-info">
        Showing <span className="font-semibold">{startItem}–{endItem}</span> of{' '}
        <span className="font-semibold">{totalCount}</span> books
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev || currentPage <= 1}
          className="pagination-btn pagination-prev"
          aria-label="Previous Page"
          id="btn-pagination-prev"
        >
          ← Previous
        </button>

        <div className="pagination-pages">
          {getPageNumbers().map((page, idx) => (
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="pagination-ellipsis">…</span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={`pagination-page-btn ${page === currentPage ? 'active' : ''}`}
                aria-current={page === currentPage ? 'page' : undefined}
                id={`btn-page-${page}`}
              >
                {page}
              </button>
            )
          ))}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext || currentPage >= totalPages}
          className="pagination-btn pagination-next"
          aria-label="Next Page"
          id="btn-pagination-next"
        >
          Next →
        </button>
      </div>
    </nav>
  );
}
