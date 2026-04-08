import React from 'react';
import { cn } from '@/lib/utils';
import styles from './StatusDot.module.css';

type StatusDotVariant = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
type StatusDotSize = 'sm' | 'md' | 'lg';

interface StatusDotProps {
  variant?: StatusDotVariant;
  size?: StatusDotSize;
  pulse?: boolean;
  className?: string;
}

export default function StatusDot({
  variant = 'neutral',
  size = 'md',
  pulse = false,
  className,
}: StatusDotProps) {
  return (
    <span
      className={cn(
        styles.dot,
        styles[variant],
        size !== 'md' && styles[size],
        pulse && styles.pulse,
        className,
      )}
    />
  );
}
