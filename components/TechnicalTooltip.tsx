/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export interface TooltipMetric {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface TechnicalTooltipProps {
  children: React.ReactNode;
  title: string;
  badge?: string;
  badgeColor?: 'orange' | 'amber' | 'emerald' | 'cyan' | 'neutral';
  subtitle?: string;
  description?: string;
  metrics?: TooltipMetric[];
  footnote?: string;
  position?: 'top-left' | 'top-right' | 'top-center' | 'bottom-left' | 'bottom-right' | 'auto';
  width?: string;
  className?: string;
}

export const TechnicalTooltip: React.FC<TechnicalTooltipProps> = ({
  children,
  title,
  badge,
  badgeColor = 'orange',
  subtitle,
  description,
  metrics,
  footnote,
  position = 'top-center',
  width = 'w-72',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  // Determine positioning classes
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'bottom-full left-0 mb-2.5 origin-bottom-left';
      case 'top-right':
        return 'bottom-full right-0 mb-2.5 origin-bottom-right';
      case 'bottom-left':
        return 'top-full left-0 mt-2.5 origin-top-left';
      case 'bottom-right':
        return 'top-full right-0 mt-2.5 origin-top-right';
      case 'top-center':
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2.5 origin-bottom';
    }
  };

  const getBadgeClasses = () => {
    switch (badgeColor) {
      case 'emerald':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'cyan':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'neutral':
        return 'bg-white/[0.06] text-neutral-300 border-white/10';
      case 'orange':
      case 'amber':
      default:
        return 'bg-[#FF5500]/15 text-[#FF5500] border-[#FF5500]/40 shadow-[0_0_8px_rgba(255,85,0,0.15)]';
    }
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}

      {isVisible && (
        <div
          role="tooltip"
          className={`absolute ${getPositionClasses()} ${width} z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150 select-none`}
        >
          {/* Vercel Obsidian Tooltip Card with Neon Orange Header Accent */}
          <div className="bg-black/95 backdrop-blur-2xl border border-white/[0.12] border-t-2 border-t-[#FF5500] rounded-xl p-3 shadow-2xl shadow-black/95 text-left space-y-2 ring-1 ring-white/[0.06]">
            {/* Header: Title & Badges */}
            <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] pb-1.5">
              <div className="min-w-0">
                <div className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5 truncate">
                  <span>{title}</span>
                </div>
                {subtitle && (
                  <div className="text-[10px] text-neutral-400 font-mono mt-0.5 line-clamp-1">
                    {subtitle}
                  </div>
                )}
              </div>

              {badge && (
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getBadgeClasses()}`}>
                  {badge}
                </span>
              )}
            </div>

            {/* Description */}
            {description && (
              <p className="text-[11px] text-neutral-300 leading-relaxed font-sans">
                {description}
              </p>
            )}

            {/* Technical Metrics Grid */}
            {metrics && metrics.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 pt-0.5 font-mono">
                {metrics.map((m, idx) => (
                  <div 
                    key={idx}
                    className="bg-neutral-950/80 border border-white/[0.08] rounded-lg p-1.5 flex flex-col justify-between"
                  >
                    <span className="text-[9px] text-neutral-400 uppercase tracking-wider">
                      {m.label}
                    </span>
                    <span className={`text-[11px] font-semibold mt-0.5 ${
                      m.highlight ? 'text-[#FF5500] font-bold' : 'text-neutral-200'
                    }`}>
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Footnote / Warranty Note */}
            {footnote && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-white/[0.06] text-[10px] text-neutral-400 font-mono">
                <ShieldCheck className="w-3 h-3 text-[#FF5500] shrink-0" />
                <span className="truncate">{footnote}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
