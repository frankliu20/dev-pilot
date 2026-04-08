import React from 'react';
import { cn } from '@/lib/utils';
import styles from './Badge.module.css';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  count?: boolean;    // Solid filled style for count numbers
  pulse?: boolean;    // Bounce animation
  className?: string;
}

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  count = false,
  pulse = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        styles.badge,
        styles[variant],
        size !== 'md' && styles[size],
        count && styles.count,
        pulse && styles.pulse,
        className,
      )}
    >
      {children}
    </span>
  );
}
