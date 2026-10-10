import React from 'react';

export default function EmptyState({
  title = 'No Books Found',
  message = 'We could not find any titles matching your current search or filter criteria.',
  actionText,
  onAction,
}) {
  return (
    <div className="state-panel empty-panel" id="catalogue-empty-state">
      <div className="empty-icon-box">📚</div>
      <h3 className="empty-headline">{title}</h3>
      <p className="empty-description">{message}</p>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="empty-action-button"
          id="btn-empty-reset"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
