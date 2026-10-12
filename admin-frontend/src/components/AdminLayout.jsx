import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  FolderTree,
  ShoppingBag,
  Users,
  Mail,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/books', label: 'Books', icon: BookOpen },
  { path: '/categories', label: 'Categories', icon: FolderTree },
  { path: '/orders', label: 'Orders', icon: ShoppingBag },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/subscribers', label: 'Subscribers', icon: Mail },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const AdminLayout = () => {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'AD';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="admin-root-layout">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="admin-mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'admin-sidebar-mobile-open' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="admin-brand-crest">
            <span className="admin-crest-symbol">✦</span>
            <div className="admin-brand-text">
              <span className="admin-brand-name">AETHERIUM</span>
              <span className="admin-brand-sub">ADMINISTRATION</span>
            </div>
          </div>
          <button
            type="button"
            className="admin-sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="admin-nav" aria-label="Administrative Navigation">
          <div className="admin-nav-group-title">MAIN SECTIONS</div>
          <ul className="admin-nav-list">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path} className="admin-nav-item">
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `admin-nav-link ${isActive ? 'active' : ''}`
                    }
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon size={18} className="admin-nav-icon" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>

          <div className="admin-nav-group-title" style={{ marginTop: 'auto' }}>STOREFRONT LINK</div>
          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-nav-link admin-nav-link-external"
          >
            <ExternalLink size={16} className="admin-nav-icon" />
            <span>Customer Storefront</span>
          </a>
        </nav>

        {/* Current User Card */}
        <div className="admin-sidebar-footer">
          <div className="admin-user-card">
            <div className="admin-user-avatar">
              {getInitials(user?.full_name || user?.username)}
            </div>
            <div className="admin-user-details">
              <span className="admin-user-name">{user?.full_name || user?.username}</span>
              <span className="admin-user-role">
                {user?.is_superuser ? 'Super Administrator' : 'Staff Curator'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="admin-sidebar-logout-btn"
            title="Terminate Administrative Session"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main-wrapper">
        {/* Top bar */}
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-topbar-menu-btn"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>

          <div className="admin-topbar-breadcrumbs">
            <span className="admin-breadcrumb-root">AETHERIUM ARCHIVES</span>
            <span className="admin-breadcrumb-sep">/</span>
            <span className="admin-breadcrumb-active">CURATORIAL CONTROL</span>
          </div>

          <div className="admin-topbar-actions">
            <span className="admin-topbar-status-indicator">
              <span className="admin-pulse-dot" />
              Django API Connected
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="admin-page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
