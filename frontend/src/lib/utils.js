import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with tailwind-merge and clsx
 * Standard helper used by Magic UI, Motion Primitives, and modern component systems
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
