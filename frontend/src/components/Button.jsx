import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable Ex Libris Button System
 * Variants:
 *  - 'primary' / 'burgundy' : Solid deep burgundy button with wine hover
 *  - 'ink'                  : Solid dark ink button with subtle lift
 *  - 'outline'              : Refined border button with warm ivory hover
 *  - 'editorial-link'       : Typography link with micro-animated arrow
 *  - 'icon'                 : Compact rounded button for icons/cart
 * Sizes: 'sm', 'md', 'lg'
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
  className = '',
  iconRight = null,
  iconLeft = null,
  type = 'button',
  ariaLabel,
  ...props
}) {
  const baseClasses = `btn-editorial btn-editorial-${variant} btn-size-${size} ${className}`;

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

  if (to && !disabled) {
    return (
      <Link to={to} className={baseClasses} aria-label={ariaLabel} {...props}>
        {content}
      </Link>
    );
  }

  if (href && !disabled) {
    return (
      <a href={href} className={baseClasses} aria-label={ariaLabel} {...props}>
        {content}
      </a>
    );
  }

  return (
    <button
      type={type}
      className={baseClasses}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      {...props}
    >
      {content}
    </button>
  );
}
