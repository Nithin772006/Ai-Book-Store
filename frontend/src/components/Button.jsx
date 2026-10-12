import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable Aetherium Button System
 * Variants:
 *  - 'primary' / 'burgundy' : Solid deep burgundy button with wine hover
 *  - 'ink'                  : Solid dark ink button with subtle lift
 *  - 'outline'              : Refined border button with warm ivory hover
 *  - 'editorial-link'       : Typography link with micro-animated arrow
 *  - 'icon'                 : Compact rounded button for icons/cart
 * Sizes: 'sm', 'md', 'lg'
 * Props:
 *  - magnetic: boolean (subtle desktop pointer attraction physics)
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  to,
  href,
  onClick,
  disabled = false,
  loading = false,
  magnetic = false,
  className = '',
  iconRight = null,
  iconLeft = null,
  type = 'button',
  ariaLabel,
  style = {},
  ...props
}) {
  const btnRef = useRef(null);
  const [magneticOffset, setMagneticOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!magnetic || disabled || loading) return;
    if (typeof window === 'undefined') return;

    // Only apply magnetic attraction on pointer-capable devices without reduced motion
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isFinePointer || isReducedMotion) return;

    const { clientX, clientY } = e;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Subtle 18% magnetic pull
    const deltaX = (clientX - centerX) * 0.18;
    const deltaY = (clientY - centerY) * 0.18;
    setMagneticOffset({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    if (!magnetic) return;
    setMagneticOffset({ x: 0, y: 0 });
  };

  const dynamicStyle = {
    ...style,
    ...(magnetic && (magneticOffset.x !== 0 || magneticOffset.y !== 0)
      ? { transform: `translate3d(${magneticOffset.x}px, ${magneticOffset.y}px, 0)` }
      : {}),
  };

  const baseClasses = `btn-editorial btn-editorial-${variant} btn-size-${size} ${
    magnetic ? 'btn-magnetic' : ''
  } ${className}`;

  const content = (
    <>
      {loading && <span className="btn-spinner" aria-hidden="true" />}
      {iconLeft && <span className="btn-icon-left">{iconLeft}</span>}
      <span className="btn-text">{children}</span>
      {variant === 'editorial-link' && !iconRight && (
        <span className="btn-arrow" aria-hidden="true">→</span>
      )}
      {iconRight && <span className="btn-icon-right">{iconRight}</span>}
    </>
  );

  const sharedProps = {
    ref: btnRef,
    className: baseClasses,
    style: dynamicStyle,
    onClick,
    onMouseMove: magnetic ? handleMouseMove : undefined,
    onMouseLeave: magnetic ? handleMouseLeave : undefined,
    'aria-label': ariaLabel,
    ...props,
  };

  if (to && !disabled) {
    return (
      <Link to={to} {...sharedProps}>
        {content}
      </Link>
    );
  }

  if (href && !disabled) {
    return (
      <a href={href} {...sharedProps}>
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      {...sharedProps}
    >
      {content}
    </button>
  );
}
