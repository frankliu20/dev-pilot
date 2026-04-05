import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'info';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  className,
  children,
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        iconOnly && styles.iconOnly,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
