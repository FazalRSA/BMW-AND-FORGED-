/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { WheelDesign, WheelFinish } from '../../types';
import { RimFaceSvg } from './RimFaceSvg';
import { RimPhotoThumb } from './ui';

/**
 * Rim thumbnail: the uploaded front-on image tinted by the finish, else the drawn preview.
 * The drawn preview pulls in three.js (services/proceduralRims.ts), which is why this is not in ui.tsx:
 * pages that never draw 3D import RimPhotoThumb from there instead.
 */
export const RimThumb: React.FC<{ wheel: WheelDesign; finish?: WheelFinish; size?: number; className?: string }> = ({ wheel, finish, size = 72, className }) => (
  <RimPhotoThumb
    wheel={wheel}
    finish={finish}
    size={size}
    className={className}
    fallback={<RimFaceSvg wheel={wheel} finishHex={finish?.hex} size={size} className={className} />}
  />
);
