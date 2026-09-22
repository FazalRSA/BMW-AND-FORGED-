/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  HelpCircle, 
  Sparkles, 
  Layers, 
  Box, 
  CheckCircle2, 
  ArrowRight, 
  Sliders, 
  ExternalLink,
  Code,
  Image as ImageIcon,
  Check,
  RefreshCw
} from 'lucide-react';
import { Custom2DWheelConfig } from '../types';

interface TwoDToThreeDGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCustom2DWheel: (config: Custom2DWheelConfig | null) => void;
  activeCustomConfig: Custom2DWheelConfig | null;
}

export const TwoDToThreeDGuideModal: React.FC<TwoDToThreeDGuideModalProps> = ({
  isOpen,
  onClose,
  onApplyCustom2DWheel,
  activeCustomConfig
}) => {
  const [activeTab, setActiveTab] = useState<'interactive_uploader' | 'blender_cad' | 'ai_conversion' | 'texture_pipeline'>('interactive_uploader');
  
  // Custom 2D image state
  const [uploadedImage, setUploadedImage] = useState<string | null>(activeCustomConfig?.imageUrl || null);
  const [wheelName, setWheelName] = useState<string>(activeCustomConfig?.name || 'My Custom 2D Wheel');
  const [bumpScale, setBumpScale] = useState<number>(activeCustomConfig?.bumpScale || 0.015);
  const [alphaThreshold, setAlphaThreshold] = useState<number>(activeCustomConfig?.spokeThreshold || 0.15);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Sample 2D transparent wheel PNG presets generated via SVG canvas data URLs
  const samplePresets = [
    {
      id: 'sample_turbofan',
      name: 'Turbofan GT Aero (Sample 2D)',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
        <circle cx="250" cy="250" r="240" fill="none" stroke="#e0e0e0" stroke-width="16"/>
        <circle cx="250" cy="250" r="215" fill="none" stroke="#ffffff" stroke-width="8"/>
        <circle cx="250" cy="250" r="185" fill="#181818" stroke="#333333" stroke-width="4"/>
        <circle cx="250" cy="250" r="70" fill="#0d0d0d" stroke="#e0e0e0" stroke-width="8"/>
        ${Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 360) / 12;
          return `<g transform="rotate(${angle} 250 250)">
            <rect x="238" y="70" width="24" height="115" rx="6" fill="#f0f0f0" stroke="#888" stroke-width="2"/>
            <circle cx="250" cy="120" r="5" fill="#111"/>
          </g>`;
        }).join('')}
        <circle cx="250" cy="250" r="35" fill="#0055b8"/>
        <text x="250" y="258" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">M</text>
      </svg>`
    },
    {
      id: 'sample_csl_star',
      name: 'CSL 5-Star Split (Sample 2D)',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
        <circle cx="250" cy="250" r="240" fill="none" stroke="#d4af37" stroke-width="20"/>
        <circle cx="250" cy="250" r="60" fill="#151515" stroke="#d4af37" stroke-width="10"/>
        ${Array.from({ length: 5 }).map((_, i) => {
          const angle = (i * 360) / 5;
          return `<g transform="rotate(${angle} 250 250)">
            <polygon points="230,70 240,195 248,195 242,70" fill="#e6c655"/>
            <polygon points="270,70 260,195 252,195 258,70" fill="#e6c655"/>
          </g>`;
        }).join('')}
        <circle cx="250" cy="250" r="28" fill="#111111"/>
        <circle cx="250" cy="250" r="8" fill="#d4af37"/>
      </svg>`
    }
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setUploadedImage(result);
      setWheelName(file.name.replace(/\.[^/.]+$/, ''));
    };
    reader.readAsDataURL(file);
  };

  const handleApplyPreset = (svgString: string, name: string) => {
    const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
    setUploadedImage(encoded);
    setWheelName(name);
    onApplyCustom2DWheel({
      imageUrl: encoded,
      name,
      bumpScale,
      invertAlpha: false,
      spokeThreshold: alphaThreshold
    });
  };

  const handleApplyCustomToCar = () => {
    if (!uploadedImage) {
      alert('Please select or upload a 2D wheel image first.');
      return;
    }

    onApplyCustom2DWheel({
      imageUrl: uploadedImage,
      name: wheelName,
      bumpScale,
      invertAlpha: false,
      spokeThreshold: alphaThreshold
    });
    onClose();
  };

  const handleResetTo3DModels = () => {
    onApplyCustom2DWheel(null);
    setUploadedImage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-black border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh] ring-1 ring-white/[0.06]">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-white/[0.08] bg-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF5500]/10 border border-[#FF5500]/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#FF5500]" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-white uppercase tracking-tight font-mono">
                2D Rim Images to 3D Pipeline Guide
              </h2>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                Convert your 2D mag wheel images into 3D models + live tester
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.08] bg-black px-4 pt-2 overflow-x-auto no-scrollbar font-mono">
          <button
            onClick={() => setActiveTab('interactive_uploader')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold tracking-wide uppercase border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'interactive_uploader'
                ? 'border-[#FF5500] text-[#FF5500]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            1. Test Your 2D Wheel Live
          </button>

          <button
            onClick={() => setActiveTab('blender_cad')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold tracking-wide uppercase border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'blender_cad'
                ? 'border-[#FF5500] text-[#FF5500]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            2. Blender / CAD Workflow
          </button>

          <button
            onClick={() => setActiveTab('ai_conversion')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold tracking-wide uppercase border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'ai_conversion'
                ? 'border-[#FF5500] text-[#FF5500]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            3. AI 2D-to-3D (60 Sec)
          </button>

          <button
            onClick={() => setActiveTab('texture_pipeline')}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold tracking-wide uppercase border-b-2 whitespace-nowrap transition-all ${
              activeTab === 'texture_pipeline'
                ? 'border-[#FF5500] text-[#FF5500]'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            4. WebGL PBR Spec
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-6 flex-1 text-xs text-neutral-300 bg-black">
          {activeTab === 'interactive_uploader' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-neutral-950 border border-white/[0.08] border-l-2 border-l-[#FF5500] rounded-xl p-4">
                <h4 className="font-bold text-[#FF5500] uppercase tracking-wide text-xs mb-1 font-mono">
                  How This Interactive Tester Works
                </h4>
                <p className="text-neutral-300 leading-relaxed font-sans">
                  You do not need to wait for 3D modeling! You can upload a transparent <strong>PNG / JPEG</strong> of your 2D mag wheel rim right here. Our Three.js engine will automatically map it onto the 3D wheel barrel with normal embossing and concavity, rendering it directly on the BMW in real time.
                </p>
              </div>

              {/* Upload Drop Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/[0.12] hover:border-[#FF5500] rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-neutral-950 hover:bg-neutral-900 transition-all text-center group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-neutral-900 group-hover:bg-[#FF5500]/15 text-neutral-400 group-hover:text-[#FF5500] flex items-center justify-center transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-white text-xs font-mono">
                    Upload Your 2D Wheel Image
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono">
                    PNG with transparent background is best (e.g. 1000x1000px)
                  </div>
                </div>

                {/* Preview Box */}
                <div className="bg-neutral-950 rounded-xl p-4 border border-white/[0.08] flex flex-col items-center justify-center">
                  {uploadedImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-28 h-28 rounded-full border border-[#FF5500]/40 overflow-hidden bg-black flex items-center justify-center p-2 shadow-xl relative">
                        <img
                          src={uploadedImage}
                          alt="2D Wheel Preview"
                          className="w-full h-full object-contain"
                        />
                        <span className="absolute bottom-1 bg-black/90 text-[#FF5500] text-[9px] px-1.5 py-0.5 rounded font-mono border border-white/[0.08]">
                          2D Mounted
                        </span>
                      </div>
                      <span className="text-white font-medium text-xs truncate max-w-[180px] font-mono">
                        {wheelName}
                      </span>
                    </div>
                  ) : (
                    <div className="text-center text-neutral-500 space-y-1 font-mono">
                      <ImageIcon className="w-8 h-8 mx-auto opacity-40" />
                      <p>No 2D image chosen yet</p>
                      <p className="text-[10px]">Select a sample preset below to test right now</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sample 2D Presets */}
              <div className="space-y-2 font-mono">
                <span className="font-bold text-white uppercase tracking-wider block text-[11px]">
                  Or Try A Pre-Cut Sample 2D Wheel:
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {samplePresets.map((sp) => (
                    <button
                      key={sp.id}
                      onClick={() => handleApplyPreset(sp.svg, sp.name)}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.08] bg-neutral-950 hover:bg-neutral-900 hover:border-[#FF5500]/50 text-left transition-all"
                    >
                      <div
                        className="w-10 h-10 rounded-full border border-white/[0.12] bg-black p-1 shrink-0"
                        dangerouslySetInnerHTML={{ __html: sp.svg }}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate text-xs">
                          {sp.name}
                        </div>
                        <div className="text-[10px] text-[#FF5500]">Click to preview</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Depth Sliders */}
              {uploadedImage && (
                <div className="bg-neutral-950 rounded-xl p-4 border border-white/[0.08] space-y-3 font-mono">
                  <div className="flex items-center gap-1.5 font-bold text-white uppercase tracking-wider text-xs">
                    <Sliders className="w-3.5 h-3.5 text-[#FF5500]" />
                    3D Normal & Alpha Fine-Tuning
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-neutral-400">Emboss Bump Depth:</span>
                        <span className="text-[#FF5500] font-mono">{bumpScale.toFixed(3)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.002"
                        max="0.04"
                        step="0.002"
                        value={bumpScale}
                        onChange={(e) => setBumpScale(parseFloat(e.target.value))}
                        className="w-full accent-[#FF5500]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-neutral-400">Spoke Cutout Threshold:</span>
                        <span className="text-[#FF5500] font-mono">{alphaThreshold.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.05"
                        max="0.5"
                        step="0.05"
                        value={alphaThreshold}
                        onChange={(e) => setAlphaThreshold(parseFloat(e.target.value))}
                        className="w-full accent-[#FF5500]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 font-mono">
                {activeCustomConfig && (
                  <button
                    onClick={handleResetTo3DModels}
                    className="flex items-center gap-1.5 text-neutral-400 hover:text-white font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reset to 3D Procedural Wheels
                  </button>
                )}

                <button
                  onClick={handleApplyCustomToCar}
                  disabled={!uploadedImage}
                  className="ml-auto flex items-center gap-2 bg-[#FF5500] hover:bg-[#FF6600] disabled:opacity-50 text-black font-bold px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(255,85,0,0.35)] transition-all"
                >
                  <span>Mount This 2D Wheel on BMW</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'blender_cad' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-neutral-950 rounded-xl p-4 border border-white/[0.08] space-y-2">
                <h4 className="font-bold text-white uppercase text-xs font-mono">
                  The Industry Standard 3D CAD/Blender Method
                </h4>
                <p className="text-neutral-400 leading-relaxed font-sans">
                  Automotive wheel manufacturers like BBS, HRE, and Vorsteiner create 3D mag wheels by tracing 2D vector CAD curves and extruding them into 3D geometry:
                </p>
              </div>

              <div className="space-y-3 font-sans">
                <div className="bg-neutral-950 p-3.5 rounded-xl border border-white/[0.08] flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#FF5500]/15 text-[#FF5500] font-bold font-mono flex items-center justify-center shrink-0 border border-[#FF5500]/30">1</span>
                  <div>
                    <h5 className="font-bold text-white text-xs font-mono">Isolate a Single Spoke in 2D (Illustrator / Inkscape / Figma)</h5>
                    <p className="text-neutral-400 mt-0.5">
                      Since wheels have radial symmetry, trace just <strong>one spoke quadrant</strong> from your 2D photo. Export as clean vector <code>.svg</code> or <code>.dxf</code>.
                    </p>
                  </div>
                </div>

                <div className="bg-neutral-950 p-3.5 rounded-xl border border-white/[0.08] flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#FF5500]/15 text-[#FF5500] font-bold font-mono flex items-center justify-center shrink-0 border border-[#FF5500]/30">2</span>
                  <div>
                    <h5 className="font-bold text-white text-xs font-mono">Import SVG into Blender & Extrude Face</h5>
                    <p className="text-neutral-400 mt-0.5">
                      In Blender, go to <em>File → Import → Scalable Vector Graphics (.svg)</em>. Convert curve to mesh (<code>Alt + C</code>), select all faces, and extrude (<code>E</code>) 25mm backward.
                    </p>
                  </div>
                </div>

                <div className="bg-neutral-950 p-3.5 rounded-xl border border-white/[0.08] flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#FF5500]/15 text-[#FF5500] font-bold font-mono flex items-center justify-center shrink-0 border border-[#FF5500]/30">3</span>
                  <div>
                    <h5 className="font-bold text-white text-xs font-mono">Add Radial Array Modifier</h5>
                    <p className="text-neutral-400 mt-0.5">
                      Place an Empty axis at [0,0,0]. Add an <strong>Array Modifier</strong> set to Object Offset (the Empty), with rotation angle = <code>360° / Spoke Count</code>. Your full 3D wheel appears instantly!
                    </p>
                  </div>
                </div>

                <div className="bg-neutral-950 p-3.5 rounded-xl border border-white/[0.08] flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#FF5500]/15 text-[#FF5500] font-bold font-mono flex items-center justify-center shrink-0 border border-[#FF5500]/30">4</span>
                  <div>
                    <h5 className="font-bold text-white text-xs font-mono">Lathe Outer Rim Barrel & Export GLB</h5>
                    <p className="text-neutral-400 mt-0.5">
                      Add a Screw/Lathe modifier on a cross-section curve to generate the stepped rim barrel. Export as <strong>.glb / .gltf</strong> for direct import into this web configurator!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai_conversion' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-neutral-950 rounded-xl p-4 border border-white/[0.08] space-y-2">
                <h4 className="font-bold text-white uppercase text-xs font-mono">
                  Instant AI 2D-to-3D Tools (60 Seconds)
                </h4>
                <p className="text-neutral-400 leading-relaxed font-sans">
                  If you have clear 2D frontal photos of your mag wheels, cutting-edge AI reconstructors can turn them into clean watertight 3D meshes in under 1 minute:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-neutral-950 p-4 rounded-xl border border-white/[0.08] flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-white text-xs flex items-center justify-between font-mono">
                      <span>Tripo3D (tripo3d.ai)</span>
                      <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">Fastest</span>
                    </div>
                    <p className="text-neutral-400 text-[11px] mt-1 font-sans">
                      Upload your transparent wheel PNG. It generates an accurate symmetrical 3D GLTF with PBR roughness & metalness maps in ~30 seconds.
                    </p>
                  </div>
                </div>

                <div className="bg-neutral-950 p-4 rounded-xl border border-white/[0.08] flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-white text-xs flex items-center justify-between font-mono">
                      <span>Meshy.ai (meshy.ai)</span>
                      <span className="text-[10px] bg-[#FF5500]/15 text-[#FF5500] border border-[#FF5500]/30 px-1.5 py-0.5 rounded">High Poly</span>
                    </div>
                    <p className="text-neutral-400 text-[11px] mt-1 font-sans">
                      Specializes in hard-surface mechanical models. Produces sharp spoke bevels and deep concave barrels.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-950 p-3.5 rounded-xl border border-white/[0.08] text-[11px] text-neutral-400 font-sans">
                <strong className="text-white block mb-1 font-mono">Pro-Tip for Best AI 2D-to-3D Results:</strong>
                Ensure the 2D wheel photo is strictly perpendicular (flat 90° straight-on view) and that the background between the spokes is masked out transparently.
              </div>
            </div>
          )}

          {activeTab === 'texture_pipeline' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-neutral-950 rounded-xl p-4 border border-white/[0.08] space-y-2">
                <h4 className="font-bold text-white uppercase text-xs font-mono">
                  Physical Based Rendering (PBR) Materials in Three.js
                </h4>
                <p className="text-neutral-400 leading-relaxed font-sans">
                  How our configurator achieves the Aston Martin showroom metallic look on wheels:
                </p>
              </div>

              <div className="bg-neutral-950 p-4 rounded-xl border border-white/[0.08] font-mono text-[11px] text-[#FF5500] space-y-1">
                <p className="text-neutral-500">// Three.js MeshPhysicalMaterial settings for Liquid Metal:</p>
                <p>const wheelMat = new THREE.MeshPhysicalMaterial({`{`}</p>
                <p className="pl-4 text-white">color: new THREE.Color('#d6dde3'),</p>
                <p className="pl-4 text-neutral-300">metalness: 0.98, // High metallic reflectivity</p>
                <p className="pl-4 text-neutral-300">roughness: 0.12, // Mirror-smooth liquid chrome</p>
                <p className="pl-4 text-neutral-300">clearcoat: 1.0,  // Automotive clear topcoat</p>
                <p className="pl-4 text-neutral-300">clearcoatRoughness: 0.08</p>
                <p>{`}`});</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
