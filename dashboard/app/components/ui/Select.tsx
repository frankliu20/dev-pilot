import React from 'react';
import { cn } from '@/lib/utils';
import styles from './Select.module.css';

type SelectSize = 'sm' | 'md' | 'lg';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  size_?: SelectSize;  // 'size' conflicts with HTML attribute
}

export default function Select({
  size_ = 'md',
  className,
  children,
  ...props
}: SelectProps) {
  return (
    <select
      className={cn(
        styles.select,
        size_ !== 'md' && styles[size_],
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
