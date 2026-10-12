import React from 'react';

export const StatusBadge = ({ type, value }) => {
  if (type === 'order') {
    const config = {
      pending: { label: 'Pending', className: 'badge-warning' },
      confirmed: { label: 'Confirmed', className: 'badge-info' },
      processing: { label: 'Processing', className: 'badge-accent' },
      shipped: { label: 'Shipped', className: 'badge-primary' },
      delivered: { label: 'Delivered', className: 'badge-success' },
      cancelled: { label: 'Cancelled', className: 'badge-danger' },
    };
    const c = config[value] || { label: value, className: 'badge-neutral' };
    return <span className={`admin-badge ${c.className}`}>{c.label}</span>;
  }

  if (type === 'payment') {
    const config = {
      paid: { label: 'Paid (Demo)', className: 'badge-success' },
      unpaid: { label: 'Unpaid', className: 'badge-warning' },
      failed: { label: 'Failed', className: 'badge-danger' },
      refunded: { label: 'Refunded', className: 'badge-neutral' },
    };
    const c = config[value] || { label: value, className: 'badge-neutral' };
    return <span className={`admin-badge ${c.className}`}>{c.label}</span>;
  }

  if (type === 'stock') {
    if (value === 0) {
      return <span className="admin-badge badge-danger">Out of Stock</span>;
    }
    if (value <= 5) {
      return <span className="admin-badge badge-warning">Low Stock ({value})</span>;
    }
    return <span className="admin-badge badge-success">In Stock ({value})</span>;
  }

  if (type === 'boolean') {
    return value ? (
      <span className="admin-badge badge-success">Active</span>
    ) : (
      <span className="admin-badge badge-neutral">Inactive</span>
    );
  }

  return <span className="admin-badge badge-neutral">{value}</span>;
};

export default StatusBadge;
