/**
 * A small manifest and the bundled catalogue, shared by the plate tests.
 *
 * What is rendered in the fixture (everything else is "not rendered yet"):
 *
 *   m2_cs_g87  front34  body: all five paints   wheels: factory, FSA002 gold + hyper_black, FSA004 silver
 *              side     body: portimao, alpine  wheels: FSA002 gold
 *              rear34   body: portimao          wheels: none
 *              wheel    nothing
 *   m5_g90     front34  body: frozen grey, alpine   wheels: none
 *   m9_x99     a plate car the catalogue does not have
 *   ghost_wheel  a plate wheel the catalogue does not have
 */
import { BMW_MODELS, BMW_PAINTS, WHEEL_DESIGNS, WHEEL_FINISHES } from '../../data/configuratorData';
import { CatalogSource, PlateCatalog, joinCatalog } from '../../services/plates/catalog';
import { PlateManifest, parseManifest } from '../../services/plates/manifest';

export const CATALOG: CatalogSource = { cars: BMW_MODELS, paints: BMW_PAINTS, wheels: WHEEL_DESIGNS, finishes: WHEEL_FINISHES };

const BOX = [0.3, 0.5, 0.8, 0.85];

export const rawManifest = () => ({
  version: 1,
  frame: { w: 1920, h: 1080 },
  formats: ['avif', 'webp'],
  sizes: [
    { w: 1920, suffix: '' },
    { w: 1280, suffix: '-1280w' }
  ],
  factoryWheel: 'factory__factory',
  views: [
    { id: 'front34', label: 'Front' },
    { id: 'side', label: 'Side' },
    { id: 'rear34', label: 'Rear' },
    { id: 'wheel', label: 'Wheel' }
  ],
  paints: [
    { id: 'alpine_white', name: 'Alpine White', code: '300', group: 'Standard', finish: 'solid', hex: '#EEEEEA' },
    { id: 'portimao_blue_metallic', name: 'Portimao Blue Metallic', code: 'C31', group: 'Standard', finish: 'metallic', hex: '#1F4DAE' },
    { id: 'grigio_telesto_pearl', name: 'Grigio Telesto Pearl', code: 'P6M', group: 'Individual', finish: 'pearl', hex: '#8F9394' },
    { id: 'frozen_pure_grey_metallic', name: 'Frozen Pure Grey Metallic', code: 'X1F', group: 'Frozen', finish: 'frozen', hex: '#B4B6B7' },
    { id: 'satin_slate_blue', name: 'Satin Slate Blue', code: '—', group: 'Satin', finish: 'satin', hex: '#606870' }
  ],
  wheels: [
    { id: 'forged_fsa002', name: 'FSA002', finishes: [{ id: 'gold', name: 'Gold', hex: '#c9a24e' }, { id: 'hyper_black', name: 'Hyper Black', hex: '#3a3e44' }, { id: 'polished_face', name: 'Polished Face', hex: '#e6e9ec' }] },
    { id: 'forged_fsa004', name: 'FSA004', finishes: [{ id: 'silver', name: 'Silver', hex: '#c3c8cd' }, { id: 'hyper_black', name: 'Hyper Black', hex: '#3a3e44' }, { id: 'black', name: 'Gloss Black', hex: '#141618' }] },
    { id: 'sixnine_ff1', name: 'FF-1', finishes: [{ id: 'silver', name: 'Silver', hex: '#c3c8cd' }, { id: 'liquid_metal', name: 'Liquid Metal', hex: '#dfe4e8' }] },
    { id: 'ghost_wheel', name: 'Ghost', finishes: [{ id: 'silver', name: 'Silver', hex: '#c3c8cd' }] }
  ],
  cars: [
    {
      id: 'm2_cs_g87',
      label: 'BMW M2 CS',
      chassis: 'G87',
      defaultPaint: 'portimao_blue_metallic',
      plates: {
        front34: {
          body: ['alpine_white', 'portimao_blue_metallic', 'grigio_telesto_pearl', 'frozen_pure_grey_metallic', 'satin_slate_blue'],
          wheels: { factory__factory: BOX, forged_fsa002__gold: BOX, forged_fsa002__hyper_black: BOX, forged_fsa004__silver: [0.31, 0.5, 0.8, 0.85] }
        },
        side: { body: ['portimao_blue_metallic', 'alpine_white'], wheels: { forged_fsa002__gold: [0.1, 0.55, 0.9, 0.8] } },
        rear34: { body: ['portimao_blue_metallic'], wheels: {} },
        wheel: { body: [], wheels: {} }
      }
    },
    {
      id: 'm5_g90',
      label: 'BMW M5',
      chassis: 'G90',
      defaultPaint: 'frozen_pure_grey_metallic',
      plates: {
        front34: { body: ['frozen_pure_grey_metallic', 'alpine_white'], wheels: {} },
        side: { body: [], wheels: {} },
        rear34: { body: [], wheels: {} },
        wheel: { body: [], wheels: {} }
      }
    },
    {
      id: 'm9_x99',
      label: 'BMW M9',
      chassis: 'X99',
      defaultPaint: 'alpine_white',
      plates: { front34: { body: ['alpine_white'], wheels: {} }, side: { body: [], wheels: {} }, rear34: { body: [], wheels: {} }, wheel: { body: [], wheels: {} } }
    }
  ]
});

export function manifest(): PlateManifest {
  const result = parseManifest(rawManifest());
  if (result.ok === false) throw new Error(result.error.message);
  return result.manifest;
}

export const catalog = (): PlateCatalog => joinCatalog(manifest(), CATALOG);
