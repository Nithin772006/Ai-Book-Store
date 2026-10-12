import React, { useState, useEffect } from 'react';

export default function SearchBar({
  initialValue = '',
  onSearch,
  placeholder = 'Search by title, author, description, or ISBN...',
  debounceMs = 350,
}) {
  const [value, setValue] = useState(initialValue);
  const [prevInitial, setPrevInitial] = useState(initialValue);

  // Sync internal state if initialValue changes (e.g. from URL changes)
  if (initialValue !== prevInitial) {
    setPrevInitial(initialValue);
    setValue(initialValue);
  }

  // Debounce search callback
  useEffect(() => {
    const handler = setTimeout(() => {
      if (value !== initialValue) {
        onSearch(value);
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [value, initialValue, onSearch, debounceMs]);

  const handleClear = () => {
    setValue('');
    onSearch('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(value);
  };

  return (
    <form onSubmit={handleSubmit} className="catalogue-search-bar" role="search">
      <div className="search-input-wrap">
        <svg
          className="search-input-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="search-field"
          id="catalogue-search-input"
          aria-label="Search catalogue"
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="search-clear-btn"
            aria-label="Clear search query"
            title="Clear search"
            id="btn-search-clear"
          >
            ✕
          </button>
        )}
      </div>
    </form>
  );
}
