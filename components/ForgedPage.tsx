/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Triangle, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Layers, 
  Check, 
  ExternalLink,
  Facebook,
  Instagram,
  Terminal,
  Copy,
  ChevronRight,
  Activity,
  Cpu,
  Disc,
  ArrowUpRight
} from 'lucide-react';

interface ForgedPageProps {
  onBackToStudio: () => void;
}

// Precision SVG for TikTok
const TikTokIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className} 
    aria-hidden="true"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.32a6.34 6.34 0 0 0-.86-.06A6.33 6.33 0 0 0 3 15.6a6.34 6.34 0 0 0 10.86 4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-.04-4.46z" />
  </svg>
);

export const ForgedPage: React.FC<ForgedPageProps> = ({ onBackToStudio }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [clickedFeedback, setClickedFeedback] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const cliCommand = "npx apex-forged --chassis m4-g82 --wheel monoblock-rs5";

  const handleCopyCli = () => {
    navigator.clipboard?.writeText(cliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleForgedClick = () => {
    setClickedFeedback(true);
    setTimeout(() => {
      onBackToStudio();
    }, 450);
  };

  return (
    <div className="relative w-screen h-screen overflow-y-auto bg-black text-white select-none flex flex-col justify-between">
      {/* ======================================================== */}
      {/* VERCEL ATMOSPHERIC BACKGROUND SYSTEM                     */}
      {/* ======================================================== */}

      {/* 1. Signature Vercel Background Grid with Radial Fade */}
      <div className="absolute inset-0 bg-vercel-lines mask-radial-top opacity-35 pointer-events-none" />

      {/* 2. Secondary Dot Grid Texture */}
      <div className="absolute inset-0 bg-vercel-grid opacity-20 pointer-events-none" />

      {/* 3. Vercel Top Conic Spotlight Beam (Radiates from Center Top) */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[520px] pointer-events-none blur-3xl opacity-80"
        style={{
          background: 'conic-gradient(from 180deg at 50% 0%, transparent 40%, rgba(255, 85, 0, 0.22) 47%, rgba(255, 255, 255, 0.35) 50%, rgba(255, 85, 0, 0.22) 53%, transparent 60%)'
        }}
      />

      {/* 4. Subtle Top Horizon Line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FF5500]/50 to-transparent" />

      {/* 5. Vercel Grid Corner Crosshairs (+) */}
      <div className="absolute top-20 left-8 text-neutral-700 font-mono text-xs select-none pointer-events-none hidden md:block">+</div>
      <div className="absolute top-20 right-8 text-neutral-700 font-mono text-xs select-none pointer-events-none hidden md:block">+</div>
      <div className="absolute top-1/2 left-8 text-neutral-800 font-mono text-xs select-none pointer-events-none hidden md:block">+</div>
      <div className="absolute top-1/2 right-8 text-neutral-800 font-mono text-xs select-none pointer-events-none hidden md:block">+</div>

      {/* ======================================================== */}
      {/* VERCEL NAVIGATION BAR                                    */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-black/80 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Left: Vercel Delta Brand Mark + Title */}
        <div className="flex items-center gap-6">
          <button
            onClick={onBackToStudio}
            className="group flex items-center gap-2.5 text-left transition-opacity hover:opacity-85"
            title="Return to 3D Studio"
          >
            {/* Vercel Geometric Delta Logo with Neon Orange Glow */}
            <div className="w-7 h-7 rounded-lg bg-neutral-950 border border-white/[0.12] flex items-center justify-center relative overflow-hidden group-hover:border-[#FF5500]/60 transition-colors">
              <Triangle className="w-3.5 h-3.5 text-white fill-white group-hover:text-[#FF5500] group-hover:fill-[#FF5500] transition-colors drop-shadow-[0_0_8px_rgba(255,85,0,0.8)]" />
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-white font-extrabold text-sm tracking-tight">APEX</span>
              <span className="text-neutral-400 font-normal text-sm">FORGED</span>
              <span className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[9px] font-mono text-[#FF5500] bg-[#FF5500]/10 border border-[#FF5500]/30 rounded">
                M-SPEC
              </span>
            </div>
          </button>

          {/* Vercel-Style Secondary Nav Links */}
          <nav className="hidden lg:flex items-center gap-5 text-xs text-neutral-400 font-mono">
            <button 
              onClick={onBackToStudio}
              className="hover:text-white transition-colors"
            >
              3D Studio
            </button>
            <span className="text-neutral-800">/</span>
            <span className="text-white font-semibold flex items-center gap-1">
              Monoblock Architecture
            </span>
            <span className="text-neutral-800">/</span>
            <span className="text-neutral-400 hover:text-white transition-colors">
              Chassis Fitment
            </span>
            <span className="text-neutral-800">/</span>
            <span className="text-neutral-400 hover:text-white transition-colors">
              FEA Benchmarks
            </span>
          </nav>
        </div>

        {/* Right: Vercel Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className="hidden sm:flex items-center gap-2 bg-neutral-950/80 border border-white/[0.08] px-3 py-1 rounded-full font-mono text-[11px] text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-[#FF5500] animate-pulse shadow-[0_0_8px_#FF5500]" />
            <span className="text-neutral-400">TELEMETRY:</span>
            <span className="text-[#FF5500] font-bold">ACTIVE</span>
          </div>

          {/* Primary High-Contrast Vercel Action Button */}
          <button
            onClick={onBackToStudio}
            className="group flex items-center gap-1.5 bg-white hover:bg-neutral-200 text-black text-xs font-semibold px-4 py-2 rounded-full transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.15)] active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Return to Studio</span>
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* HERO SECTION WITH VERCEL TYPOGRAPHY & BEAM CENTERPIECE   */}
      {/* ======================================================== */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-12 md:py-16 max-w-5xl mx-auto w-full">
        {/* 1. Vercel Shimmer Announcement Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-950/80 border border-white/[0.12] hover:border-[#FF5500]/60 text-xs font-mono text-neutral-300 mb-8 backdrop-blur-md transition-all shadow-lg group cursor-pointer"
             onClick={onBackToStudio}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500] animate-ping" />
          <span className="text-neutral-400 uppercase tracking-wider text-[11px]">
            Apex Monoblock v4.2 Forged for BMW M
          </span>
          <span className="text-[#FF5500] flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
            <span>Explore</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>

        {/* 2. Vercel Display Headline with Vertical Light Gradient */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold uppercase tracking-tight text-white max-w-4xl leading-[1.04] mb-4">
          Engineering the <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white/95 to-neutral-500">Apex</span>
          <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#FF8844] to-[#FF5500]"> of Unsprung Dynamics.</span>
        </h1>

        {/* 3. Refined Body Copy */}
        <p className="text-sm sm:text-base md:text-lg text-neutral-400 max-w-2xl mx-auto font-sans font-normal leading-relaxed mb-12">
          Precision-carved from aerospace-grade 6061-T6 aluminum billets under 10,000 metric tons of hydraulic pressure. 
          Engineered to eradicate rotational inertia and clear massive 400mm M Carbon Ceramic rotors.
        </p>

        {/* ======================================================== */}
        {/* HERO FORGED BUTTON WITH NEON ORANGE GRADIENT BEAMS       */}
        {/* ======================================================== */}
        <div className="relative flex items-center justify-center my-6 group">
          {/* Atmospheric Radial Aura */}
          <div 
            className={`absolute w-[480px] h-[480px] rounded-full bg-gradient-to-tr from-[#FF3300]/25 via-[#FF5500]/35 to-[#FFAA00]/25 blur-3xl pointer-events-none transition-all duration-700 ${
              isHovered ? 'scale-125 opacity-100' : 'scale-100 opacity-70'
            }`} 
          />

          {/* RADIANT GRADIENT BEAM RAY 1 (Horizontal Beam) */}
          <div className="absolute w-[620px] sm:w-[840px] h-[2px] bg-gradient-to-r from-transparent via-[#FF5500] to-transparent pointer-events-none opacity-60 animate-beam-pulse blur-[1px]" />
          <div className="absolute w-[440px] sm:w-[580px] h-[8px] bg-gradient-to-r from-transparent via-[#FF5500]/40 to-transparent pointer-events-none blur-[4px]" />

          {/* RADIANT GRADIENT BEAM RAY 2 (Diagonal 45-deg Beam) */}
          <div className="absolute w-[500px] sm:w-[640px] h-[1.5px] bg-gradient-to-r from-transparent via-[#FF6600]/80 to-transparent pointer-events-none rotate-45 opacity-50 animate-beam-pulse blur-[1px]" />

          {/* RADIANT GRADIENT BEAM RAY 3 (Diagonal -45-deg Beam) */}
          <div className="absolute w-[500px] sm:w-[640px] h-[1.5px] bg-gradient-to-r from-transparent via-[#FFAA00]/70 to-transparent pointer-events-none -rotate-45 opacity-50 animate-beam-pulse blur-[1px]" />

          {/* ROTATING CONIC GRADIENT BEAMS RING */}
          <div className="absolute w-[300px] h-[150px] sm:w-[350px] sm:h-[160px] rounded-[32px] overflow-hidden pointer-events-none p-[2px]">
            <div 
              className="w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 rounded-full animate-beam-spin pointer-events-none"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0%, #FF5500 20%, #FFAA00 35%, transparent 50%, #FF3D00 70%, #FF6600 85%, transparent 100%)'
              }}
            />
          </div>

          {/* SECOND CONIC COUNTER-ROTATING LIGHT SWEEP */}
          <div className="absolute w-[310px] h-[158px] sm:w-[360px] sm:h-[168px] rounded-[34px] overflow-hidden pointer-events-none opacity-75 blur-[2px]">
            <div 
              className="w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 rounded-full animate-ray-sweep pointer-events-none"
              style={{
                background: 'conic-gradient(from 180deg, transparent 0%, #FF5500 30%, transparent 60%, #FFAA00 80%, transparent 100%)'
              }}
            />
          </div>

          {/* THE "FORGED" BUTTON CONTAINER */}
          <button
            id="forged-hero-button"
            onClick={handleForgedClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`relative z-20 px-12 sm:px-16 py-6 sm:py-7 rounded-2xl bg-black border border-[#FF5500]/60 hover:border-[#FF5500] text-white transition-all duration-300 cursor-pointer shadow-[0_0_40px_rgba(255,85,0,0.5)] hover:shadow-[0_0_75px_rgba(255,85,0,0.85)] active:scale-[0.98] ${
              clickedFeedback ? 'scale-95 ring-4 ring-[#FF5500]' : ''
            }`}
          >
            {/* Subtle Inner Neon Orange Glow */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#FF5500]/20 via-transparent to-[#FF5500]/10 pointer-events-none" />
            
            {/* Precision Crosshair Tick Marks at 4 Corners (Vercel Style) */}
            <div className="absolute top-2 left-2 text-[#FF5500] text-xs font-mono select-none leading-none">+</div>
            <div className="absolute top-2 right-2 text-[#FF5500] text-xs font-mono select-none leading-none">+</div>
            <div className="absolute bottom-2 left-2 text-[#FF5500] text-xs font-mono select-none leading-none">+</div>
            <div className="absolute bottom-2 right-2 text-[#FF5500] text-xs font-mono select-none leading-none">+</div>

            {/* Button Inner Content */}
            <div className="relative z-10 flex items-center gap-3.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5500] animate-ping" />
              
              <span className="font-mono font-black text-2xl sm:text-3xl md:text-4xl uppercase tracking-[0.22em] text-white group-hover:text-[#FF5500] transition-colors drop-shadow-[0_2px_14px_rgba(255,85,0,0.6)]">
                Forged
              </span>

              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF5500] fill-[#FF5500] animate-pulse" />
            </div>
          </button>
        </div>

        {/* 4. Vercel Interactive CLI Box */}
        <div className="mt-8 flex items-center gap-2 bg-neutral-950 border border-white/[0.1] rounded-xl px-4 py-2 font-mono text-xs text-neutral-300 shadow-xl max-w-md w-full justify-between">
          <div className="flex items-center gap-2 overflow-hidden truncate">
            <Terminal className="w-3.5 h-3.5 text-[#FF5500] shrink-0" />
            <span className="text-neutral-500 shrink-0">$</span>
            <span className="truncate text-neutral-300 font-mono text-[11px] sm:text-xs">
              {cliCommand}
            </span>
          </div>

          <button
            onClick={handleCopyCli}
            className="shrink-0 p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors border border-white/[0.06]"
            title="Copy command"
          >
            {copiedCli ? (
              <Check className="w-3.5 h-3.5 text-[#FF5500]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* ======================================================== */}
        {/* VERCEL BENTO FEATURE GRID (HIGH-PRECISION CARDS)          */}
        {/* ======================================================== */}
        <div className="mt-14 w-full grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {/* Bento Card 1: 10,000T Forging */}
          <div className="group relative bg-neutral-950/70 border border-white/[0.08] hover:border-[#FF5500]/50 rounded-2xl p-5 backdrop-blur-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,85,0,0.15)] flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FF5500]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono uppercase text-[#FF5500] bg-[#FF5500]/10 border border-[#FF5500]/30 px-2 py-0.5 rounded font-bold">
                  AEROSPACE 6061-T6
                </span>
                <Cpu className="w-4 h-4 text-neutral-500 group-hover:text-[#FF5500] transition-colors" />
              </div>
              <div className="font-mono font-bold text-2xl text-white mb-1">
                10,000 Metric Tons
              </div>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                Closed-die hydraulic forging aligns the metallic crystalline grain boundary to eliminate micro-voids and maximize tensile rigidity.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>Grain Refinement</span>
              <span className="text-white font-semibold">100% Void-Free</span>
            </div>
          </div>

          {/* Bento Card 2: -16.4kg Unsprung Mass */}
          <div className="group relative bg-neutral-950/70 border border-white/[0.08] hover:border-[#FF5500]/50 rounded-2xl p-5 backdrop-blur-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,85,0,0.15)] flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FF5500]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono uppercase text-[#FF5500] bg-[#FF5500]/10 border border-[#FF5500]/30 px-2 py-0.5 rounded font-bold">
                  ROTATIONAL DYNAMICS
                </span>
                <Activity className="w-4 h-4 text-neutral-500 group-hover:text-[#FF5500] transition-colors" />
              </div>
              <div className="font-mono font-bold text-2xl text-white mb-1">
                -16.4kg Unsprung
              </div>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                28.4% reduction in angular momentum directly sharpens steering response, braking distances, and damper rebound control on BMW M chassis.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>Angular Momentum</span>
              <span className="text-emerald-400 font-semibold">-28.4% Inertia</span>
            </div>
          </div>

          {/* Bento Card 3: 400mm CCB Clearance */}
          <div className="group relative bg-neutral-950/70 border border-white/[0.08] hover:border-[#FF5500]/50 rounded-2xl p-5 backdrop-blur-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,85,0,0.15)] flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FF5500]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono uppercase text-[#FF5500] bg-[#FF5500]/10 border border-[#FF5500]/30 px-2 py-0.5 rounded font-bold">
                  5-AXIS CNC PRECISION
                </span>
                <Disc className="w-4 h-4 text-neutral-500 group-hover:text-[#FF5500] transition-colors" />
              </div>
              <div className="font-mono font-bold text-2xl text-white mb-1">
                400mm M Rotor
              </div>
              <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                Sculpted drop-center barrel geometry engineered to comfortably accommodate massive 400mm BMW M Carbon Ceramic discs and 6-piston calipers.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>Caliper Radial Margin</span>
              <span className="text-white font-semibold">4.5mm Airflow Gap</span>
            </div>
          </div>
        </div>
      </main>

      {/* ======================================================== */}
      {/* VERCEL FOOTER BAR                                        */}
      {/* ======================================================== */}
      <footer className="relative z-20 w-full border-t border-white/[0.08] bg-black/90 backdrop-blur-md px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Light grey text indicating functional prototype */}
        <div className="text-neutral-400 font-mono text-xs tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-500 shrink-0" />
          <span>This is a fully functional prototype</span>
        </div>

        {/* Center: Vercel System Status Pill */}
        <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <span>All Systems Operational</span>
          <span className="text-neutral-700">•</span>
          <span className="text-neutral-400">BMW M Performance Architecture</span>
        </div>

        {/* Right: Social Hyperlinks (Facebook, Instagram, TikTok) */}
        <div className="flex items-center gap-2.5">
          {/* Facebook */}
          <a
            href="https://www.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Apex Forged on Facebook"
            className="group w-9 h-9 rounded-xl bg-neutral-950 border border-white/[0.12] hover:border-[#FF5500] hover:bg-[#FF5500]/10 flex items-center justify-center text-neutral-400 hover:text-[#FF5500] hover:shadow-[0_0_15px_rgba(255,85,0,0.35)] transition-all"
            title="Facebook"
          >
            <Facebook className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </a>

          {/* Instagram */}
          <a
            href="https://www.instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Apex Forged on Instagram"
            className="group w-9 h-9 rounded-xl bg-neutral-950 border border-white/[0.12] hover:border-[#FF5500] hover:bg-[#FF5500]/10 flex items-center justify-center text-neutral-400 hover:text-[#FF5500] hover:shadow-[0_0_15px_rgba(255,85,0,0.35)] transition-all"
            title="Instagram"
          >
            <Instagram className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </a>

          {/* TikTok */}
          <a
            href="https://www.tiktok.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Visit Apex Forged on TikTok"
            className="group w-9 h-9 rounded-xl bg-neutral-950 border border-white/[0.12] hover:border-[#FF5500] hover:bg-[#FF5500]/10 flex items-center justify-center text-neutral-400 hover:text-[#FF5500] hover:shadow-[0_0_15px_rgba(255,85,0,0.35)] transition-all"
            title="TikTok"
          >
            <TikTokIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </a>
        </div>
      </footer>
    </div>
  );
};
