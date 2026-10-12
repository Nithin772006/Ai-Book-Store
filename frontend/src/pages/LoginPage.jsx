import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import LoginForm from '../components/LoginForm';

gsap.registerPlugin(useGSAP);

export default function LoginPage() {
  const pageRef = useRef(null);

  useGSAP(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    gsap.from('.auth-card-wrapper', {
      opacity: 0,
      y: 24,
      duration: 0.8,
      ease: 'power3.out',
    });
  }, { scope: pageRef });

  return (
    <div ref={pageRef} className="editorial-auth-page store-container">
      {/* Breadcrumb Navigation */}
      <nav className="editorial-breadcrumbs" aria-label="Breadcrumbs">
        <Link to="/" className="breadcrumb-crumb">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-active" aria-current="page">Sign In</span>
      </nav>

      <div className="auth-card-wrapper">
        <div className="auth-editorial-card">
          {/* Card Header */}
          <div className="auth-card-header">
            <div className="auth-crest-emblem">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 21V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v16" />
                <path d="M2 21h20" />
                <path d="M8 8v9" />
                <path d="M12 8v9" />
                <path d="M16 8v9" />
                <path d="M4 4h16" />
              </svg>
            </div>
            <span className="auth-card-kicker">AETHERIUM ARCHIVES</span>
            <h1 className="auth-card-title">Welcome Back</h1>
            <p className="auth-card-subtitle">
              Sign in to manage your reading folio, explore personalized collections, and access reserved volumes.
            </p>
          </div>

          {/* Form Component */}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
