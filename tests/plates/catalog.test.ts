import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BRAND, formatMoney } from '../../config/brand';
import { rimPrice, rimSizes } from '../../services/pricing';
import { joinCatalog, paintAsCatalogue, paintDetail } from '../../services/plates/catalog';
import { CATALOG, catalog, manifest } from './fixtures';

const ZA = BRAND.regions[0];

describe('joinCatalog', () => {
  test('plate cars take the catalogue car; the M2 CS is found under its catalogue id', () => {
    const cat = catalog();
    assert.deepEqual(cat.cars.map((c) => [c.id, c.model.id]), [['m2_cs_g87', 'm2_g87'], ['m5_g90', 'm5_g90']]);
    assert.equal(cat.cars[0].model.name, 'BMW M2 CS');
  });

  test('the car is named as the plates name it, even when the catalogue row says otherwise', () => {
    // the live database still calls m2_g87 "BMW M2 Coupe" (badge "M2 G87"); the plates are of the M2 CS
    const stale = { ...CATALOG, cars: CATALOG.cars.map((c) => (c.id === 'm2_g87' ? { ...c, name: 'BMW M2 Coupe', badge: 'M2 G87' } : c)) };
    const cat = joinCatalog(manifest(), stale);
    assert.deepEqual([cat.cars[0].model.name, cat.cars[0].model.badge, cat.cars[0].shortName], ['BMW M2 CS', 'M2 CS G87', 'M2 CS']);
    assert.equal(cat.cars[0].model.id, 'm2_g87', 'builds and leads still carry the catalogue id');
    assert.equal(cat.cars[0].model.engine, CATALOG.cars.find((c) => c.id === 'm2_g87')!.engine, 'specs are the catalogue\'s');
    assert.ok(cat.warnings.some((w) => /M2 Coupe/.test(w)));
    assert.equal(catalog().warnings.some((w) => /calls/.test(w)), false, 'no report when the names agree');
  });

  test('a plate car without a catalogue car is hidden and reported', () => {
    const cat = catalog();
    assert.equal(cat.cars.some((c) => c.id === 'm9_x99'), false);
    assert.ok(cat.warnings.some((w) => /m9_x99/.test(w)));
  });

  test('a plate car whose catalogue car is hidden is not shown', () => {
    const hidden = { ...CATALOG, cars: CATALOG.cars.map((c) => (c.id === 'm5_g90' ? { ...c, active: false } : c)) };
    const cat = joinCatalog(manifest(), hidden);
    assert.deepEqual(cat.cars.map((c) => c.id), ['m2_cs_g87']);
    assert.ok(cat.warnings.some((w) => /m5_g90.*hidden/.test(w)));
  });

  test('a renamed catalogue row is still found by model name and chassis', () => {
    const renamed = { ...CATALOG, cars: CATALOG.cars.map((c) => (c.id === 'm5_g90' ? { ...c, id: 'm5_sedan' } : c)) };
    assert.equal(joinCatalog(manifest(), renamed).cars[1].model.id, 'm5_sedan');
  });

  test('the wheels are the six stocked catalogue wheels, in catalogue order, with catalogue names', () => {
    const cat = catalog();
    assert.deepEqual(cat.wheels.map((w) => w.id), ['forged_fsa001', 'forged_fsa002', 'forged_fsa_03', 'forged_fsa004', 'sixnine_ff1', 'sixnine_ff3']);
    assert.deepEqual(cat.wheels.map((w) => w.design.name), ['FSA001', 'FSA002', 'FSA003', 'FSA004', 'FF-1', 'FF-3']);
    // hidden catalogue wheels (active: false) never appear
    assert.equal(cat.wheels.some((w) => w.design.active === false), false);
  });

  test('a plate wheel without a catalogue wheel is hidden and reported', () => {
    const cat = catalog();
    assert.equal(cat.wheels.some((w) => w.id === 'ghost_wheel'), false);
    assert.ok(cat.warnings.some((w) => /ghost_wheel/.test(w)));
  });

  test('finishes, sizes and prices are the catalogue\'s', () => {
    const cat = catalog();
    const fsa002 = cat.wheels.find((w) => w.id === 'forged_fsa002')!;
    assert.deepEqual(fsa002.finishes.map((f) => f.id), ['gold', 'hyper_black', 'polished_face']);
    assert.deepEqual(fsa002.finishes.map((f) => f.name), ['Gold', 'Hyper Black', 'Polished Face']);
    assert.deepEqual(rimSizes(fsa002.design), ['20"', '21"']);
    // the stock sheet: R75 000, Polished Face R85 000
    assert.equal(Math.round(rimPrice(fsa002.design, '20"', 'gold') * ZA.rate), 75000);
    assert.equal(Math.round(rimPrice(fsa002.design, '20"', 'polished_face') * ZA.rate), 85000);
    assert.match(formatMoney(rimPrice(fsa002.design, '20"', 'gold'), ZA), /75[\s  ]?000/);
  });

  test('a plate finish the catalogue does not offer on that wheel is reported', () => {
    const fewer = { ...CATALOG, wheels: CATALOG.wheels.map((w) => (w.id === 'forged_fsa002' ? { ...w, availableVariants: ['gold'] } : w)) };
    const cat = joinCatalog(manifest(), fewer);
    assert.deepEqual(cat.wheels.find((w) => w.id === 'forged_fsa002')!.finishes.map((f) => f.id), ['gold']);
    assert.ok(cat.warnings.some((w) => /forged_fsa002.*hyper_black/.test(w)));
  });

  test('a catalogue wheel under another id is matched by the name of its 3D file', () => {
    const moved = { ...CATALOG, wheels: CATALOG.wheels.map((w) => (w.id === 'forged_fsa004' ? { ...w, id: 'fsa004_v2' } : w)) };
    const wheel = joinCatalog(manifest(), moved).wheels.find((w) => w.design.id === 'fsa004_v2')!;
    assert.equal(wheel.id, 'forged_fsa004', 'plates are looked up under the plate id');
  });

  test('catalogue paints map to the plate paint with the same BMW code', () => {
    const cat = catalog();
    assert.equal(cat.paintAliases.portimao_blue, 'portimao_blue_metallic');
    assert.equal(cat.paintAliases.alpine_white, 'alpine_white');
    assert.equal(cat.paintAliases.isle_of_man_green, undefined);
  });
});

describe('the render list and the catalogue agree', () => {
  // scripts/plates/plates.config.json is what gets rendered; the catalogue is what is sold
  const config = JSON.parse(readFileSync(new URL('../../scripts/plates/plates.config.json', import.meta.url), 'utf8'));
  const stocked = CATALOG.wheels.filter((w) => w.active !== false);

  test('every wheel that is rendered is a stocked catalogue wheel, in a finish it is sold in', () => {
    for (const w of config.wheels) {
      const design = stocked.find((d) => d.id === w.id);
      assert.ok(design, `${w.id} is rendered but not stocked`);
      for (const f of w.finishes) assert.ok(design.availableVariants.includes(f), `${w.id} is rendered in ${f}, which the catalogue does not offer`);
    }
  });

  test('every stocked wheel and finish is in the render list', () => {
    for (const d of stocked) {
      const w = config.wheels.find((x: { id: string }) => x.id === d.id);
      assert.ok(w, `${d.id} is stocked but not in the render list`);
      for (const f of d.availableVariants) assert.ok(w.finishes.includes(f), `${d.id} is sold in ${f}, which is not rendered`);
    }
  });

  test('every rendered car has a visible catalogue car', () => {
    const raw = { ...manifest(), cars: config.cars.map((c: { id: string; label: string; chassis: string }) => ({ id: c.id, label: c.label, chassis: c.chassis, defaultPaint: '', plates: {} })) };
    const cat = joinCatalog(raw, CATALOG);
    assert.deepEqual(cat.cars.map((c) => c.id), ['m2_cs_g87', 'm4_cs_g82', 'm5_g90', 'm5_touring_g99']);
  });
});

describe('paints for the summary, PDF and lead', () => {
  test('the detail line names the finish and the BMW code', () => {
    const [white, , , frozen, satin] = manifest().paints;
    assert.equal(paintDetail(white), 'Solid · 300');
    assert.equal(paintDetail(frozen), 'Frozen · X1F');
    assert.equal(paintDetail(satin), 'Satin');
  });

  test('a plate paint in the catalogue shape keeps its id, name and colour', () => {
    const p = paintAsCatalogue(manifest().paints[1]);
    assert.deepEqual([p.id, p.name, p.code, p.hex, p.type], ['portimao_blue_metallic', 'Portimao Blue Metallic', 'C31', '#1F4DAE', 'Metallic']);
  });
});
