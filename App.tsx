/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CarConfiguratorEngine } from './services/CarConfiguratorEngine';
import { ConfiguratorHeader } from './components/ConfiguratorHeader';
import { WheelDrawer } from './components/WheelDrawer';
import { BottomColorBar } from './components/BottomColorBar';
import { StudioControls } from './components/StudioControls';
import { BrochureModal } from './components/BrochureModal';
import { TwoDToThreeDGuideModal } from './components/TwoDToThreeDGuideModal';
import { LeadsManagerModal } from './components/LeadsManagerModal';
import { ForgedPage } from './components/ForgedPage';
import { 
  BMW_MODELS, 
  BMW_PAINTS, 
  WHEEL_DESIGNS, 
  WHEEL_FINISHES, 
  CALIPER_COLORS 
} from './data/configuratorData';
import { 
  CarModel, 
  PaintColor, 
  WheelDesign, 
  WheelFinish, 
  CaliperColor, 
  CameraViewPreset, 
  StudioTheme, 
  BrochureLead,
  Custom2DWheelConfig 
} from './types';
import { Sparkles, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CarConfiguratorEngine | null>(null);

  // Core Configuration State
  const [selectedCar, setSelectedCar] = useState<CarModel>(BMW_MODELS[0]); // M4 Competition
  const [selectedPaint, setSelectedPaint] = useState<PaintColor>(BMW_PAINTS[0]); // Isle of Man Green
  const [selectedWheel, setSelectedWheel] = useState<WheelDesign>(WHEEL_DESIGNS[0]); // FW-01 Monoblock GT3
  const [selectedFinish, setSelectedFinish] = useState<WheelFinish>(WHEEL_FINISHES.liquid_metal); // Liquid Metal
  const [selectedSize, setSelectedSize] = useState<string>('20"');
  const [selectedCaliper, setSelectedCaliper] = useState<CaliperColor>(CALIPER_COLORS[0]); // M Blue
  const [rideHeight, setRideHeight] = useState<number>(0);

  // Custom 2D image projection state
  const [custom2DConfig, setCustom2DConfig] = useState<Custom2DWheelConfig | null>(null);

  // UI & Drawer state
  const [isVehicleDrawerOpen, setIsVehicleDrawerOpen] = useState<boolean>(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [currentCameraView, setCurrentCameraView] = useState<CameraViewPreset>('frontThreeQuarter');
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(false);
  const [isSpinningWheels, setIsSpinningWheels] = useState<boolean>(false);
  const [isBloomEnabled, setIsBloomEnabled] = useState<boolean>(true);
  const [studioTheme, setStudioTheme] = useState<StudioTheme>('studio_dark');

  // Modals state
  const [isBrochureModalOpen, setIsBrochureModalOpen] = useState<boolean>(false);
  const [is2DGuideModalOpen, setIs2DGuideModalOpen] = useState<boolean>(false);
  const [isLeadsModalOpen, setIsLeadsModalOpen] = useState<boolean>(false);

  // Route State: 'studio' (3D Configurator) or 'forged' (Forged Monoblock Showcase Page)
  const [currentRoute, setCurrentRoute] = useState<'studio' | 'forged'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path === '/forged' || hash === '#/forged' || hash === '#forged') {
        return 'forged';
      }
    }
    return 'studio';
  });

  // Keep route synced with browser back/forward buttons & URL hash/path
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path === '/forged' || hash === '#/forged' || hash === '#forged') {
        setCurrentRoute('forged');
      } else {
        setCurrentRoute('studio');
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigateTo = useCallback((route: 'studio' | 'forged') => {
    setCurrentRoute(route);
    if (typeof window !== 'undefined') {
      const targetPath = route === 'forged' ? '/forged' : '/';
      try {
        window.history.pushState({ route }, '', targetPath);
      } catch {
        window.location.hash = route === 'forged' ? '#/forged' : '#/';
      }
    }
  }, []);

  // Loading state
  const [isEngineReady, setIsEngineReady] = useState<boolean>(false);

  // Collected Brochure Leads (Stored in localStorage)
  const [leads, setLeads] = useState<BrochureLead[]>(() => {
    try {
      const saved = localStorage.getItem('apex_forged_brochure_leads');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Initialize Three.js Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new CarConfiguratorEngine(containerRef.current, () => {
      setIsEngineReady(true);
    });
    engineRef.current = engine;

    // Apply initial config
    engine.applyPaintColor(selectedPaint);
    engine.applyWheelDesign(selectedWheel);
    engine.applyWheelFinish(selectedFinish);
    engine.applyCaliperColor(selectedCaliper);

    const handleResize = () => {
      engine.handleResize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.cleanup();
      engineRef.current = null;
    };
  }, []);

  // Update Paint on 3D Car
  const handleSelectPaint = useCallback((paint: PaintColor) => {
    setSelectedPaint(paint);
    engineRef.current?.applyPaintColor(paint);
  }, []);

  // Update Car Model on 3D Car
  const handleSelectCar = useCallback((car: CarModel) => {
    setSelectedCar(car);
    if (engineRef.current) {
      engineRef.current.buildBMWCarBody(car.bodyStyle);
      // Re-apply paint and ride height
      engineRef.current.applyPaintColor(selectedPaint);
      engineRef.current.setRideHeight(rideHeight);
      engineRef.current.applyWheelDesign(selectedWheel, custom2DConfig || undefined);
    }
  }, [selectedPaint, rideHeight, selectedWheel, custom2DConfig]);

  // Update Wheel Model
  const handleSelectWheel = useCallback((wheel: WheelDesign) => {
    setSelectedWheel(wheel);
    // Auto select default variant if current finish not available for this wheel
    const isCurrentFinishAvailable = wheel.availableVariants.includes(selectedFinish.id);
    const newFinish = isCurrentFinishAvailable 
      ? selectedFinish 
      : (WHEEL_FINISHES[wheel.defaultVariant] || WHEEL_FINISHES.liquid_metal);

    setSelectedFinish(newFinish);
    setCustom2DConfig(null); // Return to 3D procedural wheel

    if (engineRef.current) {
      engineRef.current.applyWheelDesign(wheel);
      engineRef.current.applyWheelFinish(newFinish);
    }
  }, [selectedFinish]);

  // Update Finish Variant ('bronze', 'liquid metal', 'black', etc.)
  const handleSelectFinish = useCallback((finish: WheelFinish) => {
    setSelectedFinish(finish);
    engineRef.current?.applyWheelFinish(finish);
  }, []);

  // Update Caliper Color
  const handleSelectCaliper = useCallback((caliper: CaliperColor) => {
    setSelectedCaliper(caliper);
    engineRef.current?.applyCaliperColor(caliper);
  }, []);

  // Update Stance / Ride Height
  const handleSelectRideHeight = useCallback((height: number) => {
    setRideHeight(height);
    engineRef.current?.setRideHeight(height);
  }, []);

  // Camera Presets
  const handleSelectCameraView = useCallback((view: CameraViewPreset) => {
    setCurrentCameraView(view);
    engineRef.current?.setCameraPreset(view);
  }, []);

  // Focus directly onto front wheel macro
  const handleFocusWheelCamera = useCallback(() => {
    setCurrentCameraView('frontWheel');
    engineRef.current?.setCameraPreset('frontWheel');
  }, []);

  // Turntable Auto-rotate
  const handleToggleAutoRotate = useCallback(() => {
    setIsAutoRotate((prev) => {
      const next = !prev;
      engineRef.current?.setAutoRotate(next);
      return next;
    });
  }, []);

  // Spin Wheels (Dyno / Drive mode)
  const handleToggleWheelSpin = useCallback(() => {
    setIsSpinningWheels((prev) => {
      const next = !prev;
      engineRef.current?.setSpinningWheels(next, 60);
      return next;
    });
  }, []);

  // Post-Processing Bloom Pass Toggle
  const handleToggleBloom = useCallback(() => {
    setIsBloomEnabled((prev) => {
      const next = !prev;
      engineRef.current?.setBloomEnabled(next);
      return next;
    });
  }, []);

  // Studio Theme
  const handleChangeStudioTheme = useCallback((theme: StudioTheme) => {
    setStudioTheme(theme);
    engineRef.current?.setupStudioLighting(theme);
  }, []);

  // Custom 2D Wheel apply
  const handleApplyCustom2DWheel = useCallback((config: Custom2DWheelConfig | null) => {
    setCustom2DConfig(config);
    if (config && engineRef.current) {
      engineRef.current.applyWheelDesign(selectedWheel, config);
      setCurrentCameraView('frontWheel');
      engineRef.current.setCameraPreset('frontWheel');
    } else if (!config && engineRef.current) {
      engineRef.current.applyWheelDesign(selectedWheel);
    }
  }, [selectedWheel]);

  // Lead Collection
  const handleSaveLead = useCallback((newLead: BrochureLead) => {
    setLeads((prev) => {
      const updated = [newLead, ...prev];
      try {
        localStorage.setItem('apex_forged_brochure_leads', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save lead to localStorage', e);
      }
      return updated;
    });
  }, []);

  const handleClearLeads = useCallback(() => {
    setLeads([]);
    try {
      localStorage.removeItem('apex_forged_brochure_leads');
    } catch {}
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0b0d] select-none">
      {/* 3D WebGL Canvas Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Loading Overlay */}
      {!isEngineReady && (
        <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-[#FF5500] animate-spin" />
            <Sparkles className="w-4 h-4 text-[#FF5500] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <div className="text-white font-extrabold tracking-widest text-sm uppercase font-mono">
              APEX FORGED 3D STUDIO
            </div>
            <p className="text-neutral-500 text-xs mt-1 font-mono">
              Loading BMW M Chassis & Photorealistic Forged Wheel Shaders...
            </p>
          </div>
        </div>
      )}

      {/* Vercel Geometric Header */}
      <ConfiguratorHeader
        car={selectedCar}
        wheel={selectedWheel}
        finish={selectedFinish}
        paint={selectedPaint}
        onOpenBrochure={() => setIsBrochureModalOpen(true)}
        onOpen2DGuide={() => setIs2DGuideModalOpen(true)}
        onNavigateToForged={() => navigateTo('forged')}
      />

      {/* Camera & Studio Controls HUD */}
      <StudioControls
        currentView={currentCameraView}
        isAutoRotate={isAutoRotate}
        isSpinningWheels={isSpinningWheels}
        studioTheme={studioTheme}
        isBloomEnabled={isBloomEnabled}
        isDrawerOpen={isVehicleDrawerOpen || isDrawerOpen}
        onSelectView={handleSelectCameraView}
        onToggleAutoRotate={handleToggleAutoRotate}
        onToggleWheelSpin={handleToggleWheelSpin}
        onChangeStudioTheme={handleChangeStudioTheme}
        onToggleBloom={handleToggleBloom}
      />

      {/* Vehicle Specification & Colour Side Drawer (Right Side) */}
      <BottomColorBar
        selectedCar={selectedCar}
        selectedPaint={selectedPaint}
        selectedCaliper={selectedCaliper}
        rideHeight={rideHeight}
        isOpen={isVehicleDrawerOpen}
        onToggleOpen={() => {
          setIsVehicleDrawerOpen((prev) => {
            const next = !prev;
            if (next) setIsDrawerOpen(false);
            return next;
          });
        }}
        onSelectCar={handleSelectCar}
        onSelectPaint={handleSelectPaint}
        onSelectCaliper={handleSelectCaliper}
        onSelectRideHeight={handleSelectRideHeight}
        onOpenWheelDrawer={() => {
          setIsVehicleDrawerOpen(false);
          setIsDrawerOpen(true);
        }}
      />

      {/* Right-Hand Side Sliding Wheel & Variants Drawer */}
      <WheelDrawer
        wheels={WHEEL_DESIGNS}
        selectedWheel={selectedWheel}
        selectedFinish={selectedFinish}
        selectedSize={selectedSize}
        car={selectedCar}
        isOpen={isDrawerOpen}
        onToggleOpen={() => {
          setIsDrawerOpen((prev) => {
            const next = !prev;
            if (next) setIsVehicleDrawerOpen(false);
            return next;
          });
        }}
        onSelectWheel={handleSelectWheel}
        onSelectFinish={handleSelectFinish}
        onSelectSize={setSelectedSize}
        onFocusWheelCamera={handleFocusWheelCamera}
        onOpenBrochure={() => setIsBrochureModalOpen(true)}
        onOpen2DGuide={() => setIs2DGuideModalOpen(true)}
      />

      {/* Brochure Request & Lead Capture Modal */}
      <BrochureModal
        isOpen={isBrochureModalOpen}
        onClose={() => setIsBrochureModalOpen(false)}
        car={selectedCar}
        paint={selectedPaint}
        wheel={selectedWheel}
        finish={selectedFinish}
        caliper={selectedCaliper}
        wheelSize={selectedSize}
        onSaveLead={handleSaveLead}
      />

      {/* 2D to 3D Wheel Conversion Guide & Live Image Projection Modal */}
      <TwoDToThreeDGuideModal
        isOpen={is2DGuideModalOpen}
        onClose={() => setIs2DGuideModalOpen(false)}
        onApplyCustom2DWheel={handleApplyCustom2DWheel}
        activeCustomConfig={custom2DConfig}
      />

      {/* Collected Leads / Business Inquiry Records Modal */}
      <LeadsManagerModal
        isOpen={isLeadsModalOpen}
        onClose={() => setIsLeadsModalOpen(false)}
        leads={leads}
        onClearLeads={handleClearLeads}
      />

      {/* Route: Forged Page Showcase with Neon Orange Gradient Beams */}
      {currentRoute === 'forged' && (
        <div className="absolute inset-0 z-50 animate-fadeIn">
          <ForgedPage onBackToStudio={() => navigateTo('studio')} />
        </div>
      )}
    </div>
  );
};

export default App;
