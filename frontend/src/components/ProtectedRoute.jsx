import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import LoadingState from './LoadingState';

/**
 * Route wrapper that restricts access to authenticated customers.
 * Anonymous visitors are redirected to /login with their intended location preserved.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="store-container section-pad">
        <LoadingState message="Verifying bookstore credentials..." count={1} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
