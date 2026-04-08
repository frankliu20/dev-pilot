import React from 'react';
import Icon from './Icon';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;  // CTA button or other content
}

export default function EmptyState({
  icon = 'inbox',
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <div className={styles.container}>
      <div className={styles.icon}>
        <Icon name={icon} size={48} strokeWidth={1.5} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </div>
  );
}
