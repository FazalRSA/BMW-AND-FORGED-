/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { ChevronDown, ChevronUp, AlertTriangle, Loader2 } from 'lucide-react';
import type { WheelFinish } from '../types';
import { FINISH_FLAKE_SCALE, applyFinishLook, finishLook, installFinishLayers, type FinishLook } from '../services/wheelFinish';
import {
  BRAKE_PARTS,
  FINISH_PARTS,
  cameraDistanceScale,
  classifyStudioPart,
  explodeOffsets,
  type StudioPart
} from '../services/wheelStudioParts';

/**
 * 3D wheel studio for wheels that have a real .glb model (the rim page, /rims/<id>). Ported from
 * the FORGED website's WheelStudio, so both show a wheel the same way.
 *
 * A light product-photography stage: studio reflections built in code (no HDR download),
 * a soft contact shadow, fixed camera views, an exploded view and, when the model carries brake
 * meshes, a brake clearance check that ghosts the barrel. Wheels with a second model (staggered
 * rear size) get a Front / Rear switch.
 *
 * Differences from the website's copy:
 * - the finishes are this catalogue's (`WheelFinish` rows) and are drawn by services/wheelFinish.ts,
 *   the same recipe the car's wheels use, so a finish is the same coating here and on the car;
 * - the rim files in public/models/rims are meshopt-compressed and quantized, so the loader carries
 *   the decoders the car engine uses, and the flake grain is scaled per mesh;
 * - a file in other units or lying on another axis is stood up and sized like the engine does;
 * - the Exploded, Bolts and Cap toggles are only offered when the model has the parts for them;
 * - the stage is only drawn when something changed.
 */

export type StudioViewId = 'face' | 'three' | 'side' | 'back' | 'top';

export interface StudioToggles {
  orbit: boolean;
  spin: boolean;
  explode: boolean;
  wire: boolean;
  bolts: boolean;
  cap: boolean;
  brakes: boolean;
}

export const DEFAULT_STUDIO_TOGGLES: StudioToggles = {
  orbit: true,
  spin: false,
  explode: false,
  wire: false,
  bolts: true,
  cap: true,
  brakes: false
};

export interface WheelStudioProps {
  wheelModel: string;
  wheelSeries: string;
  /** The finishes this wheel is offered in (catalogue rows), in the order they are listed. */
  finishes: WheelFinish[];
  selectedFinish?: WheelFinish;
  onSelectFinish: (finish: WheelFinish) => void;
  onEnquire?: () => void;
  /** Served path to the wheel's .glb, e.g. "/models/rims/forged_fsa002.glb". */
  modelUrl: string;
  /** Optional second model for the rear axle of a staggered set. */
  rearModelUrl?: string | null;
  /** The catalogue's modelFlip: only read when the file does not say which side is the face. */
  modelFlip?: boolean;
  /** One-line spec shown in the badge, e.g. "PCD 5×112 · ET8/15 · CB 66.6". */
  specFront?: string;
  specRear?: string;
  initialView?: StudioViewId;
  initialToggles?: Partial<StudioToggles>;
  /** Size of the stage. The default is the website's: 76% of the screen height, 540 to 860 px. */
  className?: string;
}

interface LoadedModelInfo {
  /** Null when the file is not in metres (it was resized to fit, so its size says nothing). */
  diameterMm: number | null;
  widthMm: number | null;
  hasBrakes: boolean;
  hasBolts: boolean;
  hasCap: boolean;
  /** At least two kinds of part: with one, the exploded view would only move the wheel. */
  canExplode: boolean;
}

type FinishValues = Pick<WheelFinish, 'hex' | 'metalness' | 'roughness' | 'clearcoat'>;

interface StudioEngine {
  load: (url: string, flip: boolean) => void;
  setFinish: (finish: FinishValues) => void;
  setToggles: (toggles: StudioToggles) => void;
  goView: (view: StudioViewId, instant?: boolean) => void;
  /** Height in CSS pixels of the control panel covering the bottom of the stage. */
  setBottomInset: (px: number) => void;
  dispose: () => void;
}

interface EngineCallbacks {
  onLoaded: (info: LoadedModelInfo) => void;
  onError: (message: string) => void;
  onUserDrag: () => void;
}

const VIEWS: { id: StudioViewId; label: string }[] = [
  { id: 'face', label: 'Face' },
  { id: 'three', label: '3/4' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
  { id: 'top', label: 'Top' }
];

const TOGGLE_LABELS: { id: keyof StudioToggles; label: string }[] = [
  { id: 'orbit', label: 'Orbit' },
  { id: 'spin', label: 'Spin wheel' },
  { id: 'explode', label: 'Exploded' },
  { id: 'wire', label: 'Wireframe' },
  { id: 'bolts', label: 'Bolts' },
  { id: 'cap', label: 'Cap' },
  { id: 'brakes', label: 'Brake check' }
];

/** Shown until the page hands over a finish: the catalogue's Silver. */
const NEUTRAL_FINISH: FinishValues = { hex: '#c3c8cd', metalness: 0.9, roughness: 0.28, clearcoat: 0.7 };

/** How strongly the stage's softboxes show in the paint (the website's setting for its stage). */
const STAGE_ENV_INTENSITY = 1.1;

/** A rim between these diameters is taken to be in metres (a 17" to 24" rim is 0.45 to 0.65 m across). */
const METRE_RANGE: [number, number] = [0.25, 1.2];
/** Diameter given to a file in other units: a 20" rim, the engine's base size. */
const FALLBACK_DIAMETER = 0.52;

/** Studio reflections: a gradient dome with bright softboxes and dark flags, prefiltered once. */
function buildStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const envScene = new THREE.Scene();
  const dome = new THREE.SphereGeometry(50, 48, 24);
  const top = new THREE.Color(0.78, 0.82, 0.9);
  const horizon = new THREE.Color(0.3, 0.32, 0.35);
  const bottom = new THREE.Color(0.13, 0.13, 0.15);
  const tmp = new THREE.Color();
  const colours: number[] = [];
  const pos = dome.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const h = (pos.getY(i) / 50) * 0.5 + 0.5;
    if (h > 0.5) tmp.copy(horizon).lerp(top, (h - 0.5) * 2);
    else tmp.copy(bottom).lerp(horizon, h * 2);
    colours.push(tmp.r, tmp.g, tmp.b);
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  const disposables: { dispose: () => void }[] = [dome];
  const domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  disposables.push(domeMat);
  envScene.add(new THREE.Mesh(dome, domeMat));

  const addPanel = (w: number, h: number, at: [number, number, number], brightness: number) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(brightness, brightness, brightness),
      side: THREE.DoubleSide
    });
    disposables.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(at[0], at[1], at[2]);
    mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
  };
  addPanel(40, 14, [0, 40, 8], 7); // overhead softbox
  addPanel(12, 34, [-38, 10, 6], 5); // left strip
  addPanel(12, 34, [38, 10, -8], 4); // right strip
  addPanel(46, 7, [0, 6, -42], 3); // back horizon strip
  addPanel(30, 6, [0, 5, 40], 2.2); // front fill
  // dark flags give mirror finishes something to contrast against
  addPanel(26, 30, [26, 4, 30], 0.01);
  addPanel(26, 30, [-28, 2, -26], 0.01);
  addPanel(60, 10, [0, -12, 0], 0.02);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
  disposables.forEach((d) => d.dispose());
  return texture;
}

function createStudioEngine(mount: HTMLDivElement, callbacks: EngineCallbacks): StudioEngine {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const envTexture = buildStudioEnvironment(renderer);
  scene.environment = envTexture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 20);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.35;
  controls.maxDistance = 4;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.2;

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(1.2, 2.2, 1.0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -0.9;
  keyLight.shadow.camera.right = 0.9;
  keyLight.shadow.camera.top = 0.9;
  keyLight.shadow.camera.bottom = -0.9;
  keyLight.shadow.camera.near = 0.2;
  keyLight.shadow.camera.far = 6;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.radius = 6;
  scene.add(keyLight);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f98, 0.9));

  const floorGeo = new THREE.PlaneGeometry(12, 12);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.28 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // The finish, read the way the car's wheels read it (services/wheelFinish.ts).
  let currentLook: FinishLook = finishLook(NEUTRAL_FINISH);

  /**
   * A paint material for one part of the rim: the current finish with its face/flop and flake
   * layers. `unitScale` is the mesh's own unit in metres (the packed rim files are quantized, so
   * each mesh has its own), which keeps the flake cells about 1 mm, as on the car.
   */
  const makeFinishMaterial = (side: THREE.Side, unitScale: number) => {
    const material = new THREE.MeshPhysicalMaterial({ side });
    material.envMapIntensity = STAGE_ENV_INTENSITY;
    installFinishLayers(material).uFinishFlakeScale.value = FINISH_FLAKE_SCALE * (unitScale > 0 ? unitScale : 1);
    applyFinishLook(material, currentLook);
    return material;
  };

  interface Rig {
    spinGroup: THREE.Group;
    staticGroup: THREE.Group;
    parts: Record<StudioPart, THREE.Mesh[]>;
    homes: Map<THREE.Mesh, THREE.Vector3>;
    /** Paint materials made for this rig. The barrel's are separate so the brake check can ghost it alone. */
    finishMaterials: { material: THREE.MeshPhysicalMaterial; part: StudioPart }[];
    ownMaterials: THREE.Material[];
    axis: THREE.Vector3;
    centre: THREE.Vector3;
    diameter: number;
  }

  // The same decoders as the car engine, so every rim file the car accepts opens here too.
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const modelCache = new Map<string, THREE.Group>();
  let rig: Rig | null = null;
  let loadToken = 0;
  let toggles: StudioToggles = { ...DEFAULT_STUDIO_TOGGLES };
  let currentView: StudioViewId = 'three';
  let explodeNow = 0;
  let tween: {
    start: number;
    duration: number;
    fromPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toPos: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null = null;
  let disposed = false;
  let stageWidth = 1;
  let stageHeight = 1;
  let bottomInset = 0;
  /** Something changed that the next frame must draw. */
  let dirty = true;

  // Shift the picture up by half the covered height so the wheel sits in the visible area.
  const applyViewOffset = () => {
    const inset = Math.min(bottomInset, stageHeight * 0.6);
    if (inset > 0) camera.setViewOffset(stageWidth, stageHeight, 0, inset / 2, stageWidth, stageHeight);
    else camera.clearViewOffset();
  };

  const emptyParts = (): Record<StudioPart, THREE.Mesh[]> => ({
    barrel: [],
    face: [],
    bolts: [],
    cap: [],
    rotor: [],
    caliper: []
  });

  const removeRig = () => {
    if (!rig) return;
    scene.remove(rig.spinGroup);
    scene.remove(rig.staticGroup);
    rig.finishMaterials.forEach(({ material }) => material.dispose());
    rig = null;
    dirty = true;
  };

  const applyExplode = () => {
    if (!rig) return;
    const offsets = explodeOffsets(rig.diameter);
    (Object.keys(rig.parts) as StudioPart[]).forEach((part) => {
      for (const mesh of rig!.parts[part]) {
        const home = rig!.homes.get(mesh);
        if (home) mesh.position.copy(home).addScaledVector(rig!.axis, offsets[part] * explodeNow);
      }
    });
  };

  const applyToggles = () => {
    dirty = true;
    controls.autoRotate = toggles.orbit;
    if (!rig) return;
    rig.parts.bolts.forEach((m) => (m.visible = toggles.bolts));
    rig.parts.cap.forEach((m) => (m.visible = toggles.cap));
    BRAKE_PARTS.forEach((part) => rig!.parts[part].forEach((m) => (m.visible = toggles.brakes)));
    // Brake check: ghost the barrel so the caliper is visible against the spokes.
    const hasBrakes = rig.parts.rotor.length + rig.parts.caliper.length > 0;
    rig.finishMaterials.forEach(({ material, part }) => {
      const ghost = part === 'barrel' && toggles.brakes && hasBrakes;
      material.transparent = ghost;
      material.opacity = ghost ? 0.22 : 1;
      material.depthWrite = !ghost;
      material.wireframe = toggles.wire;
      material.needsUpdate = true;
    });
    rig.ownMaterials.forEach((m) => {
      if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = toggles.wire;
    });
  };

  const viewPose = (view: StudioViewId) => {
    const r = rig!;
    const visibleFraction = 1 - Math.min(bottomInset, stageHeight * 0.6) / stageHeight;
    const d = r.diameter * 2.75 * cameraDistanceScale(camera.aspect, visibleFraction);
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(up, r.axis).normalize();
    if (side.lengthSq() < 0.5) side.set(1, 0, 0);
    const c = r.centre;
    const poses: Record<StudioViewId, THREE.Vector3> = {
      face: c.clone().addScaledVector(r.axis, d),
      back: c.clone().addScaledVector(r.axis, -d),
      side: c.clone().addScaledVector(side, d * 1.05).add(new THREE.Vector3(0, 0.02, 0)),
      three: c
        .clone()
        .addScaledVector(r.axis, d * 0.78)
        .addScaledVector(side, d * 0.62)
        .add(new THREE.Vector3(0, d * 0.1, 0)),
      top: c.clone().add(new THREE.Vector3(0, d * 1.05, 0)).addScaledVector(r.axis, d * 0.15)
    };
    return { pos: poses[view], target: c.clone().add(new THREE.Vector3(0, -0.01, 0)) };
  };

  const goView = (view: StudioViewId, instant = false) => {
    currentView = view;
    if (!rig) return;
    const pose = viewPose(view);
    dirty = true;
    if (instant) {
      tween = null;
      camera.position.copy(pose.pos);
      controls.target.copy(pose.target);
      controls.update();
      return;
    }
    tween = {
      start: performance.now(),
      duration: 650,
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: pose.pos,
      toTarget: pose.target
    };
  };

  const buildRig = (source: THREE.Group, flip: boolean) => {
    const root = source.clone(true);
    scene.add(root);
    root.updateMatrixWorld(true);

    const parts = emptyParts();
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) parts[classifyStudioPart(mesh.name || mesh.parent?.name || '')].push(mesh);
    });

    const rimMeshes = parts.barrel.length ? parts.barrel : [...parts.face, ...parts.cap];
    const rimBox = new THREE.Box3();
    const measureRim = () => {
      root.updateMatrixWorld(true);
      rimBox.makeEmpty();
      rimMeshes.forEach((m) => rimBox.expandByObject(m));
      if (rimBox.isEmpty()) rimBox.setFromObject(root);
      return rimBox.getSize(new THREE.Vector3());
    };
    let size = measureRim();
    if (rimBox.isEmpty()) {
      scene.remove(root);
      throw new Error('the rim file has no geometry');
    }

    // The axle is the direction in which the rim is shortest. The rim files stand on +Y with the face
    // toward +Z; a file lying on another axis is turned to match, the way the engine reads it on the car.
    if (size.y < size.x && size.y < size.z) root.rotation.x = -Math.PI / 2;
    else if (size.x < size.y && size.x < size.z) root.rotation.y = -Math.PI / 2;
    size = measureRim();

    // Rim files are in metres. One in millimetres or centimetres (a CAD export) is sized like a 20"
    // rim, as on the car, and its measurements are not reported.
    const fileDiameter = Math.max(size.x, size.y);
    const inMetres = fileDiameter >= METRE_RANGE[0] && fileDiameter <= METRE_RANGE[1];
    if (!inMetres) {
      root.scale.multiplyScalar(FALLBACK_DIAMETER / (fileDiameter || 1));
      measureRim();
    }

    // Rest the rim on the floor, then measure it.
    root.position.y -= rimBox.min.y;
    size = measureRim();
    const centre = rimBox.getCenter(new THREE.Vector3());

    // Point the axle at the outboard side: where the cap (or the spoke face) sits. A file that does
    // not say (unnamed meshes) faces +Z, unless the catalogue's modelFlip turns it round.
    const axis = new THREE.Vector3(0, 0, 1);
    const outboard = parts.cap.length ? parts.cap : parts.face;
    const outboardBox = new THREE.Box3();
    outboard.forEach((m) => outboardBox.expandByObject(m));
    const lean = outboardBox.isEmpty() ? 0 : outboardBox.getCenter(new THREE.Vector3()).sub(centre).dot(axis);
    if (Math.abs(lean) > size.z * 0.02 ? lean < 0 : flip) axis.negate();

    const spinGroup = new THREE.Group();
    const staticGroup = new THREE.Group();
    spinGroup.position.copy(centre);
    staticGroup.position.copy(centre);
    scene.add(spinGroup, staticGroup);

    const homes = new Map<THREE.Mesh, THREE.Vector3>();
    const ownMaterials: THREE.Material[] = [];
    const finishMaterials: Rig['finishMaterials'] = [];
    const shared = new Map<string, THREE.MeshPhysicalMaterial>();
    const unit = new THREE.Vector3();
    (Object.keys(parts) as StudioPart[]).forEach((part) => {
      for (const mesh of parts[part]) {
        unit.setFromMatrixScale(mesh.matrixWorld);
        const unitScale = (unit.x + unit.y + unit.z) / 3;
        // The caliper is bolted to the car, so it must not turn with the wheel.
        (part === 'caliper' ? staticGroup : spinGroup).attach(mesh);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        homes.set(mesh, mesh.position.clone());
        if (FINISH_PARTS.includes(part)) {
          // One paint material per part, sidedness and unit (FSA001's barrel is an open, double-sided
          // shell); a mesh that brings its own texture or normal map keeps it on a copy.
          const old = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | undefined;
          const side = old?.side ?? THREE.FrontSide;
          const group = part === 'barrel' ? 'barrel' : 'face';
          if (old?.map || old?.normalMap) {
            const material = makeFinishMaterial(side, unitScale);
            material.map = old.map ?? null;
            material.normalMap = old.normalMap ?? null;
            finishMaterials.push({ material, part });
            mesh.material = material;
            continue;
          }
          const key = `${group}|${side}|${unitScale.toFixed(4)}`;
          let material = shared.get(key);
          if (!material) {
            material = makeFinishMaterial(side, unitScale);
            shared.set(key, material);
            finishMaterials.push({ material, part });
          }
          mesh.material = material;
        } else {
          const own = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          own.forEach((m) => {
            if ('envMapIntensity' in m) (m as THREE.MeshStandardMaterial).envMapIntensity = 1;
            ownMaterials.push(m);
          });
        }
      }
    });
    scene.remove(root);

    removeRig();
    const diameter = Math.max(size.x, size.y);
    rig = { spinGroup, staticGroup, parts, homes, finishMaterials, ownMaterials, axis, centre, diameter };
    applyToggles();
    explodeNow = toggles.explode ? 1 : 0;
    applyExplode();
    goView(currentView, true);
    const kinds = (Object.keys(parts) as StudioPart[]).filter((p) => !BRAKE_PARTS.includes(p) && parts[p].length > 0).length;
    callbacks.onLoaded({
      diameterMm: inMetres ? Math.round(diameter * 1000) : null,
      widthMm: inMetres ? Math.round(size.z * 1000) : null,
      hasBrakes: parts.rotor.length + parts.caliper.length > 0,
      hasBolts: parts.bolts.length > 0,
      hasCap: parts.cap.length > 0,
      canExplode: kinds > 1
    });
  };

  const load = (url: string, flip: boolean) => {
    const token = ++loadToken;
    const cached = modelCache.get(url);
    const showModel = (model: THREE.Group) => {
      try {
        buildRig(model, flip);
      } catch (err) {
        console.error('WheelStudio: could not prepare model', url, err);
        callbacks.onError('This 3D model could not be displayed.');
      }
    };
    if (cached) {
      showModel(cached);
      return;
    }
    loader.load(
      url,
      (gltf) => {
        if (disposed || token !== loadToken) return; // a newer request superseded this one
        modelCache.set(url, gltf.scene);
        showModel(gltf.scene);
      },
      undefined,
      (err) => {
        if (disposed || token !== loadToken) return;
        console.error('WheelStudio: could not load model', url, err);
        callbacks.onError('The 3D model could not be loaded. Check your connection and try again.');
      }
    );
  };

  const resize = () => {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    stageWidth = w;
    stageHeight = h;
    camera.aspect = w / h;
    applyViewOffset();
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);
  resize();

  // Only draw while the stage is on screen and the tab is visible.
  let onScreen = true;
  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      dirty = true;
    },
    { threshold: 0.01 }
  );
  visibilityObserver.observe(mount);
  const onVisibilityChange = () => {
    dirty = true;
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const onPointerDown = () => {
    tween = null;
    callbacks.onUserDrag();
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  let last = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!onScreen || document.hidden) return;
    let moving = false;
    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.duration);
      const eased = k * k * (3 - 2 * k);
      camera.position.lerpVectors(tween.fromPos, tween.toPos, eased);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      if (k >= 1) tween = null;
      moving = true;
    }
    const explodeTarget = toggles.explode ? 1 : 0;
    if (Math.abs(explodeTarget - explodeNow) > 0.001) {
      explodeNow += (explodeTarget - explodeNow) * Math.min(1, dt * 6);
      applyExplode();
      moving = true;
    }
    if (rig && toggles.spin) {
      rig.spinGroup.rotateOnWorldAxis(rig.axis, -dt * 1.6);
      moving = true;
    }
    // (with the frame time, so the orbit takes as long on a 120 Hz screen as on a 60 Hz one)
    if (controls.update(dt)) moving = true;
    // A still stage is not drawn again: the car's engine may be running under this page too.
    if (!moving && !dirty) return;
    dirty = false;
    renderer.render(scene, camera);
  };
  frame = requestAnimationFrame(tick);

  return {
    load,
    goView,
    setFinish: (finish) => {
      currentLook = finishLook(finish);
      rig?.finishMaterials.forEach(({ material }) => applyFinishLook(material, currentLook));
      dirty = true;
    },
    setToggles: (next) => {
      toggles = { ...next };
      applyToggles();
    },
    setBottomInset: (px) => {
      const next = Math.max(0, Math.round(px));
      if (next === bottomInset) return;
      const firstMeasure = bottomInset === 0;
      bottomInset = next;
      applyViewOffset();
      camera.updateProjectionMatrix();
      dirty = true;
      // Re-frame once the panel has been measured; later changes only shift the picture.
      if (firstMeasure && rig && !tween) goView(currentView, true);
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
      removeRig();
      modelCache.forEach((model) => {
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => m?.dispose());
        });
      });
      modelCache.clear();
      dracoLoader.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      envTexture.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      renderer.dispose();
      // Stepping through the wheels makes a new stage each time. A disposed context is only freed at
      // garbage collection (iOS keeps its GPU memory until then), and the browser drops the oldest
      // context, the car's, once too many are alive: release this one now.
      renderer.forceContextLoss();
    }
  };
}

// The stage is light inside the app's dark page: `stage-light` (index.css) turns the ink, mute, line and
// surface tokens dark-on-light, so the chips and cards below are the website's, in this app's tokens.
const chipBase =
  'shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] leading-none transition-colors cursor-pointer';
const chipOff = 'border-line bg-surface/70 text-ink hover:bg-surface';
const chipOn = 'border-ink bg-ink text-surface';

/** A phone on its side (the app's `short` layout): the stage is too low for the open control card. */
const startsCollapsed = () => typeof matchMedia === 'function' && matchMedia('(max-height: 519px)').matches;

export const WheelStudio = ({
  wheelModel,
  wheelSeries,
  finishes,
  selectedFinish,
  onSelectFinish,
  onEnquire,
  modelUrl,
  rearModelUrl,
  modelFlip = false,
  specFront,
  specRear,
  initialView = 'three',
  initialToggles,
  className = 'h-[76vh] min-h-[540px] max-h-[860px]'
}: WheelStudioProps) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<StudioEngine | null>(null);

  const [axle, setAxle] = useState<'front' | 'rear'>('front');
  const [view, setView] = useState<StudioViewId>(initialView);
  const [toggles, setToggles] = useState<StudioToggles>({
    ...DEFAULT_STUDIO_TOGGLES,
    ...initialToggles
  });
  const [collapsed, setCollapsed] = useState(startsCollapsed);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<LoadedModelInfo | null>(null);
  const [hintVisible, setHintVisible] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const hasRear = !!rearModelUrl && rearModelUrl !== modelUrl;
  const activeUrl = axle === 'rear' && hasRear ? rearModelUrl! : modelUrl;

  // Create the engine once.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let engine: StudioEngine;
    try {
      engine = createStudioEngine(mount, {
        onLoaded: (loaded) => {
          setInfo(loaded);
          setLoading(false);
          setError(null);
        },
        onError: (message) => {
          setError(message);
          setLoading(false);
        },
        onUserDrag: () => {
          setHintVisible(false);
          setToggles((t) => (t.orbit ? { ...t, orbit: false } : t));
        }
      });
    } catch (err) {
      console.error('WheelStudio: WebGL is not available', err);
      setError('3D view is not available on this device.');
      setLoading(false);
      return;
    }
    engineRef.current = engine;
    engine.goView(initialView, true);

    // Tell the engine how much of the stage the control panel covers.
    const panel = panelRef.current;
    const measurePanel = () => {
      if (panel) engine.setBottomInset(panel.offsetHeight + 8);
    };
    const panelObserver = new ResizeObserver(measurePanel);
    if (panel) panelObserver.observe(panel);
    measurePanel();

    return () => {
      panelObserver.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
    // initialView is read once on mount by design
  }, []);

  // Load (or switch) the model.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setLoading(true);
    setError(null);
    engine.load(activeUrl, modelFlip);
  }, [activeUrl, modelFlip, retryCount]);

  // The four numbers, not the row: a catalogue reload hands over new objects with the same values.
  const { hex, metalness, roughness, clearcoat } = selectedFinish ?? NEUTRAL_FINISH;
  useEffect(() => {
    engineRef.current?.setFinish({ hex, metalness, roughness, clearcoat });
  }, [hex, metalness, roughness, clearcoat]);

  useEffect(() => {
    engineRef.current?.setToggles(toggles);
  }, [toggles]);

  const chooseView = (next: StudioViewId) => {
    setView(next);
    setToggles((t) => ({ ...t, orbit: false }));
    engineRef.current?.goView(next);
  };

  const flipToggle = (id: keyof StudioToggles) => setToggles((t) => ({ ...t, [id]: !t[id] }));

  const specLine = axle === 'rear' && hasRear ? specRear ?? specFront : specFront;
  // A toggle is only offered when the model has the parts it acts on.
  const visibleToggles = TOGGLE_LABELS.filter(
    (t) =>
      (t.id !== 'brakes' || info?.hasBrakes) &&
      (t.id !== 'bolts' || !info || info.hasBolts) &&
      (t.id !== 'cap' || !info || info.hasCap) &&
      (t.id !== 'explode' || !info || info.canExplode)
  );
  const measured = info && info.diameterMm !== null && info.widthMm !== null;

  return (
    <div
      className={`wheel-stage stage-light relative w-full select-none text-ink ${className}`}
      data-studio-state={error ? 'error' : loading ? 'loading' : 'ready'}
    >
      <div
        ref={mountRef}
        role="img"
        aria-label={`Interactive 3D view of ${wheelModel}`}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      />

      {/* Title and spec badge */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-start justify-between gap-3 p-4 pointer-events-none">
        <div className="min-w-0">
          <div className="font-display text-lg font-extrabold tracking-wide truncate">{wheelModel}</div>
          <div className="hidden sm:block text-xs text-mute mt-0.5 truncate">{wheelSeries}</div>
        </div>
        {(specLine || hasRear || measured) && (
          <div className="max-w-[68%] rounded-xl border border-line bg-surface/85 backdrop-blur px-2.5 py-2 text-right text-[11px] leading-relaxed text-mute">
            {(specLine || hasRear) && (
              <div>
                {hasRear && <b className="font-semibold text-ink">{axle === 'rear' ? 'Rear ' : 'Front '}</b>}
                {specLine}
              </div>
            )}
            {measured && (
              <div className="whitespace-nowrap">
                Model: ⌀{info.diameterMm} × {info.widthMm} mm
              </div>
            )}
          </div>
        )}
      </div>

      {hintVisible && !loading && !error && (
        // (on a pill: the top of the wheel can reach this line, and the text was lost on a dark or gold rim)
        <div className="hidden sm:block absolute inset-x-0 top-16 z-10 text-center text-xs text-mute pointer-events-none">
          <span className="inline-block rounded-full bg-surface/80 backdrop-blur px-3 py-1">Drag to rotate · pinch or scroll to zoom</span>
        </div>
      )}

      {/* Controls */}
      <div
        ref={panelRef}
        className="absolute inset-x-2 bottom-2 z-20 mx-auto max-w-3xl rounded-2xl border border-line bg-surface/85 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            {hasRear && (
              <div className="inline-flex rounded-full bg-ink/[0.07] p-[3px]" role="group" aria-label="Axle">
                {(['front', 'rear'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={axle === a}
                    onClick={() => setAxle(a)}
                    className={`rounded-full px-4 py-1.5 text-[13px] font-semibold cursor-pointer transition-colors ${
                      axle === a ? 'bg-ink text-surface' : 'text-ink'
                    }`}
                  >
                    {a === 'front' ? 'Front' : 'Rear'}
                  </button>
                ))}
              </div>
            )}
            {onEnquire && (
              <button
                type="button"
                onClick={onEnquire}
                className="rounded-full bg-ember hover:bg-ember-light px-4 py-1.5 text-[13px] font-semibold text-white cursor-pointer transition-colors"
              >
                Enquire
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            className="inline-flex items-center gap-1 text-xs text-mute cursor-pointer"
          >
            Controls {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3.5 pb-3 max-h-[42vh] overflow-y-auto">
            <ControlRow label="View">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={view === v.id}
                  onClick={() => chooseView(v.id)}
                  className={`${chipBase} ${view === v.id ? chipOn : chipOff}`}
                >
                  {v.label}
                </button>
              ))}
            </ControlRow>

            {finishes.length > 0 && (
              <ControlRow label="Finish">
                {finishes.map((finish) => {
                  const active = selectedFinish?.id === finish.id;
                  return (
                    <button
                      key={finish.id}
                      type="button"
                      aria-pressed={active}
                      aria-label={`Select ${finish.name} finish`}
                      onClick={() => onSelectFinish(finish)}
                      className={`${chipBase} ${active ? chipOn : chipOff}`}
                    >
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-[-1px] border border-black/25"
                        style={{ background: finish.hex }}
                      />
                      {finish.name}
                    </button>
                  );
                })}
              </ControlRow>
            )}

            <ControlRow label="Show">
              {visibleToggles.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={toggles[t.id]}
                  onClick={() => flipToggle(t.id)}
                  className={`${chipBase} ${toggles[t.id] ? chipOn : chipOff}`}
                >
                  <span
                    className={`inline-block w-[7px] h-[7px] rounded-full mr-1.5 ${
                      toggles[t.id] ? 'bg-emerald-400' : 'bg-neutral-400'
                    }`}
                  />
                  {t.label}
                </button>
              ))}
            </ControlRow>
          </div>
        )}
      </div>

      {loading && !error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#f0f2f5]/90">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-mute">
            <Loader2 className="w-4 h-4 animate-spin text-ember" />
            Loading wheel…
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#f0f2f5]/95 px-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-6 h-6 text-ember" />
            <p className="text-sm text-ink/80 max-w-xs">{error}</p>
            {engineRef.current && (
              <button
                type="button"
                onClick={() => setRetryCount((n) => n + 1)}
                className="rounded-full border border-ink/15 bg-surface px-4 py-1.5 text-[13px] cursor-pointer hover:bg-ink/[0.04]"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ControlRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 mt-2">
    <div className="w-12 sm:w-14 shrink-0 text-[11px] uppercase tracking-wider text-mute">{label}</div>
    <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  </div>
);
