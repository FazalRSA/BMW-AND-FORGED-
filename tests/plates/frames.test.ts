import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Frame, PlateSource, StagedFrame, dropHiddenFrames, frameFor, frameImages, layersOf, pickSize, sameFrame, stageFrame } from '../../services/plates/frames';
import { FACTORY_WHEEL, Selection } from '../../services/plates/selection';
import { catalog } from './fixtures';

const cat = catalog();
const SIZES = cat.manifest.sizes;
const source: PlateSource = { base: '/plates', format: 'avif', size: SIZES[0] };
const sel = (patch: Partial<Selection> = {}): Selection => ({ car: 'm2_cs_g87', view: 'front34', paint: 'portimao_blue_metallic', wheel: 'forged_fsa002', finish: 'gold', ...patch });
const frame = (patch: Partial<Selection> = {}) => frameFor(cat, sel(patch), source);

describe('frameFor', () => {
  test('a catalogue wheel: the body plate and the wheel plate with its box', () => {
    assert.deepEqual(frame(), {
      group: 'm2_cs_g87/front34',
      body: { plate: 'm2_cs_g87/front34/body/portimao_blue_metallic', url: '/plates/m2_cs_g87/front34/body/portimao_blue_metallic.avif' },
      wheel: { plate: 'm2_cs_g87/front34/wheels/forged_fsa002__gold', url: '/plates/m2_cs_g87/front34/wheels/forged_fsa002__gold.avif', box: [0.3, 0.5, 0.8, 0.85] }
    });
  });

  test('the factory wheel: its plate where the view has one, else the body plate alone', () => {
    assert.equal(frame({ wheel: FACTORY_WHEEL, finish: FACTORY_WHEEL }).wheel?.url, '/plates/m2_cs_g87/front34/wheels/factory__factory.avif');
    assert.equal(frame({ view: 'side', wheel: FACTORY_WHEEL, finish: FACTORY_WHEEL }).wheel, null);
  });

  test('the size suffix, the format and the base are part of the file name', () => {
    const phone = frameFor(cat, sel(), { base: 'https://cdn.example/p', format: 'webp', size: SIZES[1] });
    assert.equal(phone.body.url, 'https://cdn.example/p/m2_cs_g87/front34/body/portimao_blue_metallic-1280w.webp');
    assert.equal(phone.wheel?.url, 'https://cdn.example/p/m2_cs_g87/front34/wheels/forged_fsa002__gold-1280w.webp');
    assert.equal(phone.body.plate, frame().body.plate, 'the plate is the same whatever the file');
  });

  test('frameImages lists what has to be loaded', () => {
    assert.deepEqual(frameImages(frame()).map((image) => image.plate), ['m2_cs_g87/front34/body/portimao_blue_metallic', 'm2_cs_g87/front34/wheels/forged_fsa002__gold']);
    assert.equal(frameImages(frame({ view: 'side', wheel: FACTORY_WHEEL })).length, 1);
    assert.equal(sameFrame(frame(), frame()), true);
    assert.equal(sameFrame(frame(), frame({ finish: 'hyper_black' })), false);
    assert.equal(sameFrame(null, frame()), false);
  });
});

describe('pickSize', () => {
  test('the smallest size that covers the stage in device pixels', () => {
    assert.equal(pickSize(SIZES, 390, 3).w, 1280, 'a phone');
    assert.equal(pickSize(SIZES, 1037, 1).w, 1280, 'a laptop beside the panel');
    assert.equal(pickSize(SIZES, 1037, 2).w, 1920, 'the same on a high-density screen');
    assert.equal(pickSize(SIZES, 2400, 2).w, 1920, 'never more than there is');
    assert.equal(pickSize([{ w: 1920, suffix: '' }], 300, 1).w, 1920, 'a manifest with one size');
  });

  test('a size in use is not swapped for a smaller one', () => {
    assert.equal(pickSize(SIZES, 390, 2, SIZES[0]).w, 1920);
  });
});

describe('layers on the stage', () => {
  const put = (staged: StagedFrame[], next: Frame, now: number) => stageFrame(staged, next, now);
  const shape = (staged: StagedFrame[]) =>
    layersOf(staged).map((group) => ({
      enter: group.enter,
      bodies: group.bodies.map((body) => (body.enter ? '+' : '') + body.url.split('/').pop()),
      wheels: group.wheels.map((wheel) => (wheel.enter ? '+' : '') + (wheel.leave ? '-' : '') + wheel.url.split('/').pop())
    }));

  test('the first frame is one group that appears whole', () => {
    assert.deepEqual(shape(put([], frame(), 0)), [{ enter: false, bodies: ['portimao_blue_metallic.avif'], wheels: ['forged_fsa002__gold.avif'] }]);
  });

  test('a paint change fades the new body in; the wheel layer is the same element', () => {
    const before = put([], frame(), 0);
    const after = put(before, frame({ paint: 'alpine_white' }), 100);
    assert.deepEqual(shape(after), [{ enter: false, bodies: ['portimao_blue_metallic.avif', '+alpine_white.avif'], wheels: ['forged_fsa002__gold.avif'] }]);
    assert.equal(after[1].wheelId, after[0].wheelId);
    assert.equal(after[1].groupId, after[0].groupId);
    assert.notEqual(after[1].bodyId, after[0].bodyId);
  });

  test('a wheel change fades the new wheel in; the body layer is the same element', () => {
    const after = put(put([], frame(), 0), frame({ finish: 'hyper_black' }), 100);
    assert.deepEqual(shape(after), [{ enter: false, bodies: ['portimao_blue_metallic.avif'], wheels: ['forged_fsa002__gold.avif', '+forged_fsa002__hyper_black.avif'] }]);
    assert.equal(after[1].bodyId, after[0].bodyId);
  });

  test('another view is a new group that fades in whole, so wheels never sit on the wrong body', () => {
    const after = put(put([], frame(), 0), frame({ view: 'side' }), 100);
    assert.deepEqual(shape(after), [
      { enter: false, bodies: ['portimao_blue_metallic.avif'], wheels: ['forged_fsa002__gold.avif'] },
      { enter: true, bodies: ['portimao_blue_metallic.avif'], wheels: ['forged_fsa002__gold.avif'] }
    ]);
    assert.notEqual(after[1].groupId, after[0].groupId);
  });

  test('going to a view without a factory plate fades the wheel out; coming back fades it in', () => {
    const sideGold = frame({ view: 'side' });
    const sideFactory = frame({ view: 'side', wheel: FACTORY_WHEEL, finish: FACTORY_WHEEL });
    const gone = put(put([], sideGold, 0), sideFactory, 100);
    assert.deepEqual(shape(gone)[0].wheels, ['-forged_fsa002__gold.avif']);
    const back = put(gone, sideGold, 200);
    assert.deepEqual(shape(back)[0].wheels, ['-forged_fsa002__gold.avif', '+forged_fsa002__gold.avif']);
  });

  test('frames under one that has finished fading in are dropped; the ones still fading stay', () => {
    let staged = put([], frame(), 0);
    staged = put(staged, frame({ paint: 'alpine_white' }), 100);
    staged = put(staged, frame({ paint: 'satin_slate_blue' }), 200);
    assert.equal(dropHiddenFrames(staged, 250, 300).length, 3, 'nothing above the first has finished');
    assert.deepEqual(dropHiddenFrames(staged, 420, 300).map((f) => f.body.plate.split('/').pop()), ['alpine_white', 'satin_slate_blue']);
    const settled = dropHiddenFrames(staged, 600, 300);
    assert.deepEqual(shape(settled), [{ enter: false, bodies: ['satin_slate_blue.avif'], wheels: ['forged_fsa002__gold.avif'] }]);
    // the surviving layers keep their identity, so nothing is redrawn when the stack collapses
    assert.deepEqual([settled[0].groupId, settled[0].bodyId, settled[0].wheelId], [staged[2].groupId, staged[2].bodyId, staged[2].wheelId]);
    assert.equal(dropHiddenFrames(settled, 10_000, 300), settled);
    assert.deepEqual(dropHiddenFrames([], 0, 300), []);
  });

  test('layer ids never repeat among the frames on stage', () => {
    let staged: StagedFrame[] = [];
    const steps = [frame(), frame({ finish: 'hyper_black' }), frame({ view: 'side' }), frame(), frame({ paint: 'alpine_white' }), frame({ wheel: 'forged_fsa004', finish: 'silver', paint: 'alpine_white' })];
    steps.forEach((next, index) => {
      staged = dropHiddenFrames(put(staged, next, index * 100), index * 100, 250);
      const groups = layersOf(staged);
      const ids = groups.flatMap((group) => [`g${group.id}`, ...group.bodies.map((body) => `b${body.id}`), ...group.wheels.map((wheel) => `w${wheel.id}`)]);
      assert.equal(new Set(ids).size, ids.length, JSON.stringify(ids));
    });
  });
});
