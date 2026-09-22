/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CarModel {
  id: string;
  name: string;
  badge: string;
  generation: string;
  chassisCode: string;
  engine: string;
  power: string;
  torque: string;
  acceleration: string;
  recommendedWheelFitment: {
    front: string;
    rear: string;
    pcd: string;
    cb: string;
  };
  bodyStyle: 'coupe' | 'sedan';
}

export interface PaintColor {
  id: string;
  name: string;
  code: string;
  hex: string;
  type: 'Metallic' | 'Frozen' | 'Uni';
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
}

export type FinishVariantKey = 'liquid_metal' | 'bronze' | 'black' | 'titanium' | 'champagne_gold' | 'rose_gold';

export interface WheelFinish {
  id: FinishVariantKey;
  name: string;
  colorName: string;
  hex: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  description: string;
  badge: string;
}

export interface WheelDesign {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  style: string;
  spokeType: 'multi' | 'y_spoke' | 'directional' | 'mesh' | 'aerodisc' | 'clubsport';
  spokeCount: number;
  weightFrontKg: number;
  weightRearKg: number;
  weightSavingsKg: number;
  standardSizes: string[];
  pricePerSet: number;
  description: string;
  highlights: string[];
  availableVariants: FinishVariantKey[];
  defaultVariant: FinishVariantKey;
}

export interface CaliperColor {
  id: string;
  name: string;
  hex: string;
  logo: string;
}

export type CameraViewPreset = 
  | 'frontThreeQuarter' 
  | 'side' 
  | 'frontWheel' 
  | 'rearWheel' 
  | 'rearThreeQuarter' 
  | 'top';

export type StudioTheme = 'studio_dark' | 'studio_pure' | 'night_runway';

export interface BrochureLead {
  id: string;
  name: string;
  surname: string;
  email: string;
  cellNumber: string;
  carModel: string;
  paintColor: string;
  wheelModel: string;
  wheelFinish: string;
  wheelSize: string;
  caliperColor: string;
  requestFitmentConsultation: boolean;
  timestamp: string;
  notes?: string;
}

export interface Custom2DWheelConfig {
  imageUrl: string;
  name: string;
  bumpScale: number;
  invertAlpha: boolean;
  spokeThreshold: number;
}
