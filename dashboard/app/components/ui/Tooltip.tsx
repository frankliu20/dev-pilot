import React from 'react';
import { cn } from '@/lib/utils';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: string;
  placement?: 'top' | 'bottom';
  children: React.ReactNode;
  className?: string;
}

export default function Tooltip({
  content,
  placement = 'top',
  children,
  className,
}: TooltipProps) {
  return (
    <span className={cn(styles.wrapper, placement === 'bottom' && styles.bottom, className)}>
      {children}
      <span className={styles.content}>{content}</span>
    </span>
  );
}
