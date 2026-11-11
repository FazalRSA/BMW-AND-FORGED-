import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FACTORY_WHEEL,
  Selection,
  carOptions,
  changeSelection,
  describeSelection,
  finishOptions,
  isRendered,
  neighbourViews,
  paintGroups,
  paintOptions,
  parseSelection,
  previewSelection,
  reconcileSelection,
  selectionParams,
  viewOptions,
  wheelLayer,
  wheelOptions
} from '../../services/plates/selection';
import { joinCatalog, withoutPlates } from '../../services/plates/catalog';
import { parseManifest } from '../../services/plates/manifest';
import { CATALOG, catalog, rawManifest } from './fixtures';

const cat = catalog();
const sel = (patch: Partial<Selection> = {}): Selection => ({ car: 'm2_cs_g87', view: 'front34', paint: 'portimao_blue_metallic', wheel: FACTORY_WHEEL, finish: FACTORY_WHEEL, ...patch });
const available = (options: { id: string; available: boolean }[]) => options.filter((o) => o.available).map((o) => o.id);
const unavailable = (options: { id: string; available: boolean }[]) => options.filter((o) => !o.available).map((o) => o.id);

describe('missing plates disable options', () => {
  test('a paint without a body plate in this view is not available', () => {
    assert.deepEqual(unavailable(paintOptions(cat, sel())), []);
    assert.deepEqual(available(paintOptions(cat, sel({ view: 'side' }))), ['alpine_white', 'portimao_blue_metallic']);
    assert.deepEqual(unavailable(paintOptions(cat, sel({ view: 'side' }))), ['grigio_telesto_pearl', 'frozen_pure_grey_metallic', 'satin_slate_blue']);
  });

  test('a view without the body plate of the current paint is not available', () => {
    assert.deepEqual(available(viewOptions(cat, sel())), ['front34', 'side', 'rear34']);
    assert.deepEqual(unavailable(viewOptions(cat, sel())), ['wheel']);
    assert.deepEqual(available(viewOptions(cat, sel({ paint: 'satin_slate_blue' }))), ['front34']);
  });

  test('a view without the wheel plate of the current wheel is not available', () => {
    const gold = sel({ wheel: 'forged_fsa002', finish: 'gold' });
    assert.deepEqual(available(viewOptions(cat, gold)), ['front34', 'side']);
    assert.deepEqual(available(viewOptions(cat, sel({ wheel: 'forged_fsa002', finish: 'hyper_black' }))), ['front34']);
  });

  test('a wheel is available when one of its finishes is rendered here', () => {
    assert.deepEqual(available(wheelOptions(cat, sel())), ['forged_fsa002', 'forged_fsa004']);
    assert.deepEqual(unavailable(wheelOptions(cat, sel())), ['forged_fsa001', 'forged_fsa_03', 'sixnine_ff1', 'sixnine_ff3']);
    assert.deepEqual(available(wheelOptions(cat, sel({ view: 'side' }))), ['forged_fsa002']);
    assert.deepEqual(available(wheelOptions(cat, sel({ view: 'rear34' }))), []);
    assert.deepEqual(available(wheelOptions(cat, sel({ car: 'm5_g90', paint: 'alpine_white' }))), []);
  });

  test('a finish without a wheel plate is not available', () => {
    const options = finishOptions(cat, sel({ wheel: 'forged_fsa002', finish: 'gold' }));
    assert.deepEqual(options.map((o) => [o.id, o.available, o.selected]), [['gold', true, true], ['hyper_black', true, false], ['polished_face', false, false]]);
    assert.deepEqual(finishOptions(cat, sel()), [], 'the factory wheel has no finishes');
  });

  test('a car is available when it has any body plate', () => {
    assert.deepEqual(carOptions(cat, sel()).map((o) => [o.id, o.available, o.selected]), [['m2_cs_g87', true, true], ['m5_g90', true, false]]);
    const raw = rawManifest();
    raw.cars[1].plates.front34.body = [];
    const parsed = parseManifest(raw);
    assert.equal(parsed.ok, true);
    if (parsed.ok === true) assert.deepEqual(available(carOptions(joinCatalog(parsed.manifest, CATALOG), sel())), ['m2_cs_g87']);
  });

  test('paints are grouped by finish type, in a fixed order', () => {
    assert.deepEqual(paintGroups(cat, sel()).map((g) => [g.finish, g.options.map((o) => o.id)]), [
      ['solid', ['alpine_white']],
      ['metallic', ['portimao_blue_metallic']],
      ['pearl', ['grigio_telesto_pearl']],
      ['frozen', ['frozen_pure_grey_metallic']],
      ['satin', ['satin_slate_blue']]
    ]);
  });

  test('every available option gives a rendered combination', () => {
    for (const s of [sel(), sel({ view: 'side' }), sel({ wheel: 'forged_fsa002', finish: 'gold' }), sel({ car: 'm5_g90', paint: 'alpine_white' })]) {
      assert.ok(isRendered(cat, s));
      for (const o of viewOptions(cat, s)) if (o.available) assert.ok(isRendered(cat, changeSelection(cat, s, { view: o.id })));
      for (const o of paintOptions(cat, s)) if (o.available) assert.deepEqual(changeSelection(cat, s, { paint: o.id }), { ...s, paint: o.id });
      for (const o of wheelOptions(cat, s)) if (o.available) assert.equal(changeSelection(cat, s, { wheel: o.id }).wheel, o.id);
      for (const o of finishOptions(cat, s)) if (o.available) assert.deepEqual(changeSelection(cat, s, { finish: o.id }), { ...s, finish: o.id });
      for (const o of carOptions(cat, s)) if (o.available) assert.ok(isRendered(cat, changeSelection(cat, s, { car: o.id })));
    }
  });
});

describe('reconcileSelection', () => {
  test('a first visit: the first car in its default paint, on the first rendered catalogue wheel', () => {
    assert.deepEqual(reconcileSelection(cat), sel({ wheel: 'forged_fsa002', finish: 'gold' }));
    // a car with no wheel plates is shown on its own wheels
    assert.deepEqual(reconcileSelection(cat, { car: 'm5_g90' }), { car: 'm5_g90', view: 'front34', paint: 'frozen_pure_grey_metallic', wheel: FACTORY_WHEEL, finish: FACTORY_WHEEL });
  });

  test('unknown ids are ignored', () => {
    assert.deepEqual(reconcileSelection(cat, { car: 'tesla', view: 'top', paint: 'pink', wheel: 'steelies', finish: 'rust' }), reconcileSelection(cat));
    assert.deepEqual(reconcileSelection(cat, { car: 'm9_x99' }), reconcileSelection(cat), 'a plate car the catalogue hides');
    assert.deepEqual(reconcileSelection(cat, { wheel: 'ghost_wheel', finish: 'silver' }), reconcileSelection(cat), 'a plate wheel the catalogue hides');
    assert.equal(reconcileSelection(cat, { wheel: 'forged_fsa002', finish: 'rust' })?.finish, 'gold', "an unknown finish becomes the wheel's default");
  });

  test('catalogue ids from older links and saved builds are understood', () => {
    assert.equal(reconcileSelection(cat, { car: 'm2_g87' })?.car, 'm2_cs_g87');
    assert.equal(reconcileSelection(cat, { car: 'm2_g87', paint: 'portimao_blue' })?.paint, 'portimao_blue_metallic');
    assert.equal(reconcileSelection(cat, { car: 'm2_g87', paint: 'isle_of_man_green' })?.paint, 'portimao_blue_metallic', 'a colour with no plate: the default paint');
  });

  test('the factory wheel is kept when it is asked for', () => {
    assert.deepEqual(reconcileSelection(cat, { wheel: FACTORY_WHEEL }), sel());
  });

  test('a wheel that was asked for is kept over the view', () => {
    // hyper black is rendered in the front view only
    assert.deepEqual(reconcileSelection(cat, { view: 'side', wheel: 'forged_fsa002', finish: 'hyper_black' }), sel({ wheel: 'forged_fsa002', finish: 'hyper_black' }));
    // gold is rendered in the side view, but not with this paint there: the paint is kept, the view gives way
    assert.deepEqual(reconcileSelection(cat, { view: 'side', paint: 'satin_slate_blue', wheel: 'forged_fsa002', finish: 'gold' }), sel({ paint: 'satin_slate_blue', wheel: 'forged_fsa002', finish: 'gold' }));
  });

  test('a finish that is not rendered gives way to one that is, on the same wheel', () => {
    assert.deepEqual(reconcileSelection(cat, { wheel: 'forged_fsa002', finish: 'polished_face' }), sel({ wheel: 'forged_fsa002', finish: 'gold' }));
    assert.deepEqual(reconcileSelection(cat, { wheel: 'forged_fsa004', finish: 'black' }), sel({ wheel: 'forged_fsa004', finish: 'silver' }));
  });

  test('a wheel that is not rendered on this car gives way to the factory wheel, never to another design', () => {
    assert.deepEqual(reconcileSelection(cat, { wheel: 'sixnine_ff3', finish: 'pure_bronze' }), sel());
    assert.equal(reconcileSelection(cat, { car: 'm5_g90', wheel: 'forged_fsa002', finish: 'gold' })?.wheel, FACTORY_WHEEL);
  });

  test('the result is always rendered when anything is', () => {
    const wanted = [{}, { car: 'm5_g90' }, { view: 'wheel' }, { view: 'rear34', wheel: 'forged_fsa002' }, { paint: 'satin_slate_blue', view: 'side' }, { car: 'm5_g90', paint: 'satin_slate_blue' }];
    for (const w of wanted) assert.ok(isRendered(cat, reconcileSelection(cat, w)!), JSON.stringify(w));
  });

  test('a catalogue with no cars has no selection', () => {
    assert.equal(reconcileSelection(joinCatalog({ ...cat.manifest, cars: [] }, CATALOG)), null);
  });
});

describe('changeSelection', () => {
  test('another car keeps the paint when that car has it, else takes its default', () => {
    assert.equal(changeSelection(cat, sel({ paint: 'alpine_white' }), { car: 'm5_g90' }).paint, 'alpine_white');
    assert.equal(changeSelection(cat, sel({ paint: 'satin_slate_blue' }), { car: 'm5_g90' }).paint, 'frozen_pure_grey_metallic');
  });

  test('another wheel keeps the finish when the wheel is rendered in it, else takes its default', () => {
    assert.equal(changeSelection(cat, sel({ wheel: 'forged_fsa002', finish: 'hyper_black' }), { wheel: 'forged_fsa004' }).finish, 'silver');
    assert.deepEqual(changeSelection(cat, sel({ wheel: 'forged_fsa004', finish: 'silver' }), { wheel: FACTORY_WHEEL }), sel());
  });
});

describe('the address bar', () => {
  test('a selection survives the round trip through the query string', () => {
    const selections = [sel(), sel({ view: 'side', wheel: 'forged_fsa002', finish: 'gold' }), sel({ paint: 'satin_slate_blue', wheel: 'forged_fsa004', finish: 'silver' }), reconcileSelection(cat, { car: 'm5_g90' })!];
    for (const s of selections) {
      const query = selectionParams(s).toString();
      assert.deepEqual(reconcileSelection(cat, parseSelection(query)), s, query);
      assert.deepEqual(reconcileSelection(cat, parseSelection('?' + query)), s, 'with the leading question mark');
    }
  });

  test('the parameters are in a fixed order, and the factory wheel has no finish', () => {
    assert.equal(selectionParams(sel({ wheel: 'forged_fsa002', finish: 'gold' })).toString(), 'car=m2_cs_g87&view=front34&paint=portimao_blue_metallic&wheel=forged_fsa002&finish=gold');
    assert.equal(selectionParams(sel()).toString(), 'car=m2_cs_g87&view=front34&paint=portimao_blue_metallic&wheel=factory');
  });

  test('other parameters and malformed values are left out', () => {
    assert.deepEqual(parseSelection('car=m5_g90&utm_source=ig&view=&paint=../../etc&wheel=a%20b&finish=<script>'), { car: 'm5_g90' });
    assert.deepEqual(parseSelection(''), {});
  });
});

describe('the wheel plate drawn over the body', () => {
  test('a catalogue wheel draws its plate at its box', () => {
    assert.deepEqual(wheelLayer(cat, sel({ view: 'side', wheel: 'forged_fsa002', finish: 'gold' })), { key: 'forged_fsa002__gold', box: [0.1, 0.55, 0.9, 0.8] });
  });

  test('the factory wheel draws the factory plate where the view has one, else nothing', () => {
    assert.deepEqual(wheelLayer(cat, sel()), { key: 'factory__factory', box: [0.3, 0.5, 0.8, 0.85] });
    assert.equal(wheelLayer(cat, sel({ view: 'side' })), null);
  });
});

describe('preloading on intent', () => {
  test('the neighbouring views of the current combination, nearest first, rendered ones only', () => {
    assert.deepEqual(neighbourViews(cat, sel()).map((s) => s.view), ['side', 'rear34']);
    assert.deepEqual(neighbourViews(cat, sel({ view: 'rear34' })).map((s) => s.view), ['side', 'front34']);
    assert.deepEqual(neighbourViews(cat, sel({ wheel: 'forged_fsa002', finish: 'hyper_black' })), []);
  });

  test('the combination under the pointer, when it is rendered and not the current one', () => {
    assert.deepEqual(previewSelection(cat, sel(), { paint: 'alpine_white' }), sel({ paint: 'alpine_white' }));
    assert.equal(previewSelection(cat, sel(), { paint: 'portimao_blue_metallic' }), null, 'already showing');
    assert.equal(previewSelection(cat, sel({ view: 'side' }), { paint: 'satin_slate_blue' })?.view, 'front34', 'what a click would show');
    assert.equal(previewSelection(cat, sel(), { wheel: 'sixnine_ff3' }), null, 'not rendered: nothing to warm');
  });
});

describe('describeSelection', () => {
  test('names the configuration', () => {
    assert.equal(describeSelection(cat, sel({ wheel: 'forged_fsa002', finish: 'gold' })), 'BMW M2 CS in Portimao Blue Metallic on FSA002 wheels in Gold, front view');
    assert.equal(describeSelection(cat, sel({ view: 'side' })), 'BMW M2 CS in Portimao Blue Metallic on its factory wheels, side view');
  });
});

describe('a plate that failed to load', () => {
  test('is treated like one that was never rendered: its option is unavailable and no selection lands on it', () => {
    const broken = withoutPlates(cat, new Set(['m2_cs_g87/front34/body/alpine_white', 'm2_cs_g87/front34/wheels/forged_fsa002__gold']));
    assert.deepEqual(unavailable(paintOptions(broken, sel())), ['alpine_white']);
    assert.equal(finishOptions(broken, sel({ wheel: 'forged_fsa002', finish: 'hyper_black' })).find((o) => o.id === 'gold')?.available, false);
    // a link to the broken combination opens on the nearest one that works
    assert.deepEqual(reconcileSelection(broken, { paint: 'alpine_white', view: 'front34', wheel: FACTORY_WHEEL }), sel({ paint: 'alpine_white', view: 'side' }));
    assert.deepEqual(reconcileSelection(broken, { wheel: 'forged_fsa002', finish: 'gold' }), sel({ view: 'side', wheel: 'forged_fsa002', finish: 'gold' }));
    // the catalogue it was made from is untouched, and an empty list changes nothing
    assert.deepEqual(unavailable(paintOptions(cat, sel())), []);
    assert.equal(withoutPlates(cat, new Set()), cat);
  });

  test('when every plate of a car has failed there is still a selection, and it is not rendered', () => {
    const all = new Set(['frozen_pure_grey_metallic', 'alpine_white'].map((paint) => `m5_g90/front34/body/${paint}`));
    const broken = withoutPlates(cat, all);
    const selection = reconcileSelection(broken, { car: 'm5_g90' })!;
    assert.equal(selection.car, 'm5_g90');
    assert.equal(isRendered(broken, selection), false);
    assert.equal(carOptions(broken, selection).find((o) => o.id === 'm5_g90')?.available, false);
  });
});
