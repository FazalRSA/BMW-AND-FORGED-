/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  CarModel, 
  WheelDesign, 
  WheelFinish, 
  PaintColor 
} from '../types';
import { 
  Triangle, 
  FileText, 
  Layers,
  ArrowUpRight
} from 'lucide-react';

interface ConfiguratorHeaderProps {
  car: CarModel;
  wheel: WheelDesign;
  finish: WheelFinish;
  paint: PaintColor;
  onOpenBrochure?: () => void;
  onOpen2DGuide?: () => void;
  onNavigateToForged?: () => void;
}

export const ConfiguratorHeader: React.FC<ConfiguratorHeaderProps> = ({
  car,
  wheel,
  finish,
  paint,
  onOpenBrochure,
  onOpen2DGuide,
  onNavigateToForged
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-20 pointer-events-none p-3 md:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
      {/* Brand Logo Emblem - Clickable Route to Forged Page (Logo Only, No Text) */}
      <button
        id="apex-forged-logo-btn"
        type="button"
        onClick={onNavigateToForged}
        className="pointer-events-auto flex items-center justify-center bg-black/85 backdrop-blur-2xl border border-white/[0.08] hover:border-[#FF5500]/60 hover:shadow-[0_0_20px_rgba(255,85,0,0.25)] rounded-xl p-2.5 shadow-2xl transition-all cursor-pointer group"
        title="Apex Forged"
        aria-label="Apex Forged"
      >
        {/* Vercel-Style Triangular Delta Emblem with Neon Orange Core */}
        <div className="w-8 h-8 rounded-lg bg-neutral-950 border border-white/[0.12] group-hover:border-[#FF5500]/40 flex items-center justify-center relative overflow-hidden transition-colors">
          <div className="absolute inset-0 bg-[#FF5500]/15 opacity-80 group-hover:opacity-100 transition-opacity" />
          <Triangle className="w-4 h-4 text-[#FF5500] fill-[#FF5500] rotate-0 relative z-10 drop-shadow-[0_0_8px_rgba(255,85,0,0.8)] group-hover:scale-110 transition-transform" />
        </div>
      </button>

      {/* Center Spec Breadcrumbs Bar (Vercel Precision Style) */}
      <div className="pointer-events-auto hidden xl:flex items-center gap-2.5 bg-black/85 backdrop-blur-2xl border border-white/[0.08] rounded-xl px-4 py-2 shadow-2xl text-xs font-mono">
        <span className="text-neutral-400 font-medium">{car.name}</span>
        <span className="text-neutral-700">/</span>
        <span className="flex items-center gap-1.5 font-medium text-white">
          <span 
            className="w-2.5 h-2.5 rounded-full border border-white/30 shadow-sm"
            style={{ backgroundColor: paint.hex }}
          />
          {paint.name}
        </span>
        <span className="text-neutral-700">/</span>
        <span className="text-[#FF5500] font-semibold">{wheel.code}</span>
        <span className="text-neutral-700">/</span>
        <span className="text-neutral-300 font-medium">{finish.name}</span>
        <span className="text-neutral-700">/</span>
        <span className="bg-[#FF5500]/10 text-[#FF5500] font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-[#FF5500]/30 shadow-[0_0_10px_rgba(255,85,0,0.15)]">
          -{(wheel.weightSavingsKg * 4).toFixed(1)}kg Unsprung Mass
        </span>
      </div>

      {/* Vercel Header Action Group */}
      <div className="pointer-events-auto flex items-center gap-2">
        {onOpen2DGuide && (
          <button
            onClick={onOpen2DGuide}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/80 hover:bg-neutral-900 text-neutral-300 hover:text-white border border-white/[0.08] hover:border-white/[0.2] backdrop-blur-xl text-xs font-mono transition-all"
            title="Convert 2D Wheel Photo to 3D Live Texture"
          >
            <Layers className="w-3.5 h-3.5 text-[#FF5500]" />
            <span>2D → 3D AI</span>
          </button>
        )}

        {onOpenBrochure && (
          <button
            onClick={onOpenBrochure}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF5500] hover:bg-[#FF6600] active:scale-[0.98] text-black font-bold text-xs shadow-[0_0_20px_rgba(255,85,0,0.4)] transition-all"
            title="Download Custom PDF Spec Sheet"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Brochure</span>
            <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
          </button>
        )}
      </div>
    </header>
  );
};

