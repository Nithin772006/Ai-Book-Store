import React from 'react';
import BookCard from './BookCard';

export default function BookGrid({ books = [] }) {
  if (!books || books.length === 0) {
    return null;
  }

  return (
    <div className="book-grid" id="catalogue-book-grid" role="region" aria-label="Book collection">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
