import React from 'react';
import { ICONS } from './icons';

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

/**
 * SVG Icon component. Renders inline SVGs from the icon registry.
 * All icons are 24x24, stroke-based, using currentColor.
 *
 * Usage: <Icon name="search" size={16} />
 */
export default function Icon({
  name,
  size = 24,
  className,
  style,
  strokeWidth = 2,
}: IconProps) {
  const icon = ICONS[name];
  if (!icon) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {icon.paths?.map((d, i) => (
        <path key={`p${i}`} d={d} />
      ))}
      {icon.circles?.map((c, i) => (
        <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
      {icon.lines?.map((l, i) => (
        <line key={`l${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      ))}
      {icon.polylines?.map((points, i) => (
        <polyline key={`pl${i}`} points={points} />
      ))}
      {icon.rects?.map((r, i) => (
        <rect key={`r${i}`} x={r.x} y={r.y} width={r.width} height={r.height} rx={r.rx} />
      ))}
    </svg>
  );
}
