import React, { useState, useEffect } from 'react';
import { Mail, RefreshCw } from 'lucide-react';
import { getAdminSubscribers } from '../api/admin';

export const SubscribersPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const res = await getAdminSubscribers();
      setData(res);
    } catch (err) {
      console.error('Failed to load subscribers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  return (
    <div className="admin-subscribers-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-headline">Gazette & Newsletter Subscribers</h1>
          <p className="admin-page-subheadline">
            Auditing and distribution management for literary announcements and dispatches.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSubscribers}
          className="admin-btn admin-btn-secondary"
        >
          <RefreshCw size={14} className={loading ? 'admin-spin' : ''} /> Reload
        </button>
      </div>

      <div className="admin-panel">
        <div className="admin-empty-state">
          <Mail size={42} style={{ color: '#8A2232', marginBottom: '1rem' }} />
          <h3>Newsletter Service Uninitialized</h3>
          <p style={{ maxWidth: '540px', margin: '0.5rem auto 1.5rem', lineHeight: '1.6' }}>
            {data?.message ||
              'A newsletter subscriber model is not currently configured in the database schema. When newsletter capture is enabled on the storefront, subscribed reader records will appear here for administrative oversight.'}
          </p>
          <div className="admin-info-badge-row">
            <span className="admin-micro-pill">Status: Schema Standby</span>
            <span className="admin-micro-pill">Configured: False</span>
            <span className="admin-micro-pill">Total Subscribers: 0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscribersPage;
