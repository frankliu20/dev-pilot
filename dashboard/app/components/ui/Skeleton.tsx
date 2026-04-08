import React from 'react';
import { cn } from '@/lib/utils';
import styles from './Skeleton.module.css';

type SkeletonPreset = 'text' | 'textSm' | 'heading' | 'circle' | 'card' | 'row';

interface SkeletonProps {
  preset?: SkeletonPreset;
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;  // Render multiple skeleton lines
  gap?: number;    // Gap between multiple lines (px)
}

export default function Skeleton({
  preset,
  width,
  height,
  className,
  count = 1,
  gap = 8,
}: SkeletonProps) {
  const skeletonStyle: React.CSSProperties = {};
  if (width) skeletonStyle.width = typeof width === 'number' ? `${width}px` : width;
  if (height) skeletonStyle.height = typeof height === 'number' ? `${height}px` : height;

  if (count > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: `${gap}px` }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(styles.skeleton, preset && styles[preset], className)}
            style={{
              ...skeletonStyle,
              width: width || (i % 3 === 2 ? '70%' : i % 3 === 1 ? '85%' : '100%'),
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(styles.skeleton, preset && styles[preset], className)}
      style={skeletonStyle}
    />
  );
}
