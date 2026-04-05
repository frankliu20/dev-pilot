'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import Icon from './Icon';
import { cn } from '@/lib/utils';
import styles from './Toast.module.css';

export type ToastVariant = 'success' | 'warning' | 'danger' | 'info';

interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  duration: number;
  createdAt: number;
}

interface ToastContextValue {
  toast: (opts: {
    title: string;
    message?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const TOAST_ICONS: Record<ToastVariant, string> = {
  success: 'check-circle',
  warning: 'alert-triangle',
  danger: 'x-circle',
  info: 'alert-circle',
};

let toastCounter = 0;

function ToastItem_({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / item.duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        onDismiss(item.id);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <div className={cn(styles.toast, styles[item.variant])}>
      <span className={cn(styles.icon, styles[item.variant])}>
        <Icon name={TOAST_ICONS[item.variant]} size={16} />
      </span>
      <div className={styles.body}>
        <div className={styles.title}>{item.title}</div>
        {item.message && <div className={styles.message}>{item.message}</div>}
      </div>
      <button className={styles.close} onClick={() => onDismiss(item.id)}>
        <Icon name="x" size={14} />
      </button>
      <div className={styles.progress} style={{ width: `${progress}%` }} />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback(({
    title,
    message,
    variant = 'info',
    duration = 5000,
  }: {
    title: string;
    message?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => {
    const id = `toast-${++toastCounter}`;
    setToasts(prev => [...prev.slice(-4), { id, title, message, variant, duration, createdAt: Date.now() }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className={styles.container}>
          {toasts.map(t => (
            <ToastItem_ key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
