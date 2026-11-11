import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadManifest, manifestUrl, parseManifest } from '../../services/plates/manifest';
import { rawManifest } from './fixtures';

const parsed = (raw: unknown) => {
  const result = parseManifest(raw);
  if (result.ok === false) throw new Error(result.error.message);
  return result;
};

describe('parseManifest', () => {
  test('reads a well-formed manifest without warnings', () => {
    const { manifest, warnings } = parsed(rawManifest());
    assert.deepEqual(warnings, []);
    assert.deepEqual(manifest.frame, { w: 1920, h: 1080 });
    assert.deepEqual(manifest.formats, ['avif', 'webp']);
    assert.deepEqual(manifest.views.map((v) => v.id), ['front34', 'side', 'rear34', 'wheel']);
    assert.equal(manifest.paints.length, 5);
    assert.equal(manifest.cars[0].plates.front34.body.length, 5);
    assert.deepEqual(manifest.cars[0].plates.side.wheels, { forged_fsa002__gold: [0.1, 0.55, 0.9, 0.8] });
    assert.equal(manifest.placeholder, false);
  });

  test('reads the example of the master plan (no sizes, no factoryWheel)', () => {
    const { manifest, warnings } = parsed({
      version: 1,
      frame: { w: 1920, h: 1080 },
      formats: ['avif', 'webp'],
      views: [{ id: 'front34', label: 'Front' }],
      paints: [{ id: 'alpine_white', name: 'Alpine White', code: '300', group: 'Standard', finish: 'solid', hex: '#EEEEEA' }],
      wheels: [{ id: 'forged_fsa002', name: 'FSA002', finishes: [{ id: 'gold', name: 'Gold', hex: '#c9a24e' }] }],
      cars: [{ id: 'm2_cs_g87', label: 'BMW M2 CS', chassis: 'G87', defaultPaint: 'alpine_white', plates: { front34: { body: ['alpine_white'], wheels: { forged_fsa002__gold: [0.31, 0.52, 0.47, 0.83] } } } }]
    });
    assert.deepEqual(warnings, []);
    assert.deepEqual(manifest.sizes, [{ w: 1920, suffix: '' }], 'the full frame is the only size');
    assert.equal(manifest.factoryWheel, 'factory__factory');
  });

  test('sizes come back largest first', () => {
    const raw = { ...rawManifest(), sizes: [{ w: 1280, suffix: '-1280w' }, { w: 1920, suffix: '' }, { w: 0, suffix: 'x' }, { w: 640, suffix: '../640' }] };
    const { manifest, warnings } = parsed(raw);
    assert.deepEqual(manifest.sizes, [{ w: 1920, suffix: '' }, { w: 1280, suffix: '-1280w' }]);
    assert.equal(warnings.length, 2);
  });

  test('the placeholder flag is read; the encoder block and other extra keys are ignored', () => {
    const { manifest, warnings } = parsed({ ...rawManifest(), placeholder: true, placeholders: ['m2_cs_g87/front34/body/alpine_white'], encoder: { avif: {} }, somethingNew: 1 });
    assert.equal(manifest.placeholder, true);
    assert.deepEqual(warnings, []);
  });

  test('a paint without a BMW code has an empty code', () => {
    const { manifest } = parsed(rawManifest());
    assert.equal(manifest.paints.find((p) => p.id === 'satin_slate_blue')?.code, '');
  });

  test('a manifest of the wrong shape fails as such, with a message', () => {
    const bad: [unknown, RegExp][] = [
      [null, /not a JSON object/],
      [[], /not a JSON object/],
      ['manifest', /not a JSON object/],
      [{ ...rawManifest(), version: 2 }, /version/],
      [{ ...rawManifest(), frame: { w: 0, h: 1080 } }, /frame/],
      [{ ...rawManifest(), formats: ['jxl'] }, /format/],
      [{ ...rawManifest(), views: [] }, /views/]
    ];
    for (const [raw, message] of bad) {
      const result = parseManifest(raw);
      assert.equal(result.ok, false);
      if (result.ok === false) {
        assert.equal(result.error.kind, 'shape');
        assert.match(result.error.message, message);
      }
    }
  });

  test('entries it cannot use are dropped with a warning, the rest is kept', () => {
    const raw = rawManifest();
    raw.paints.push({ id: 'no_colour', name: 'No colour', code: '', group: '', finish: 'solid', hex: 'blue' });
    raw.paints.push({ id: 'odd_finish', name: 'Odd', code: '', group: '', finish: 'chrome', hex: '#101010' });
    raw.paints.push({ id: '../etc/passwd', name: 'Traversal', code: '', group: '', finish: 'solid', hex: '#101010' });
    const front = raw.cars[0].plates.front34 as { body: unknown[]; wheels: Record<string, unknown> };
    front.body.push('unknown_paint', 42);
    front.wheels.forged_fsa002__polished_face = [0.5, 0.5, 0.4, 0.9]; // right is left of left
    front.wheels.sixnine_ff1__silver = [0, 0, 1.2, 1]; // outside the frame
    front.wheels['nope__silver'] = [0.1, 0.1, 0.2, 0.2]; // not a wheel of this manifest
    front.wheels['forged_fsa002__black'] = [0.1, 0.1, 0.2, 0.2]; // not a finish of that wheel
    (raw.cars[0].plates as Record<string, unknown>).top = { body: ['alpine_white'], wheels: {} };

    const { manifest, warnings } = parsed(raw);
    assert.equal(manifest.paints.some((p) => p.id === 'no_colour'), false);
    assert.equal(manifest.paints.some((p) => p.id.includes('/')), false);
    assert.equal(manifest.paints.find((p) => p.id === 'odd_finish')?.finish, 'solid');
    assert.equal(manifest.cars[0].plates.front34.body.length, 5);
    assert.deepEqual(Object.keys(manifest.cars[0].plates.front34.wheels).sort(), ['factory__factory', 'forged_fsa002__gold', 'forged_fsa002__hyper_black', 'forged_fsa004__silver']);
    assert.equal('top' in manifest.cars[0].plates, false);
    assert.equal(warnings.length, 10, warnings.join('\n'));
  });

  test('every view has a plate set, even when the manifest leaves one out', () => {
    const raw = rawManifest();
    delete (raw.cars[1].plates as Record<string, unknown>).wheel;
    const { manifest } = parsed(raw);
    assert.deepEqual(manifest.cars[1].plates.wheel, { body: [], wheels: {} });
  });
});

describe('loadManifest', () => {
  const respond = (status: number, body: unknown) => (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;

  test('fetches <base>/manifest.json', async () => {
    let asked = '';
    const fetcher = (async (url: string) => {
      asked = url;
      return new Response(JSON.stringify(rawManifest()));
    }) as unknown as typeof fetch;
    const r = await loadManifest('/plates/', { fetch: fetcher });
    assert.equal(asked, '/plates/manifest.json');
    assert.equal(manifestUrl('https://cdn.example/p'), 'https://cdn.example/p/manifest.json');
    assert.equal(r.ok, true);
  });

  test('every way the request can fail is a typed result, never an exception', async () => {
    const failure = async (fetcher: typeof fetch) => {
      const result = await loadManifest('/plates', { fetch: fetcher });
      assert.equal(result.ok, false);
      return result.ok === false ? result.error : null;
    };
    const offline = await failure((async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch);
    assert.equal(offline?.kind, 'network');
    assert.match(offline?.message ?? '', /Failed to fetch/);

    assert.deepEqual(await failure(respond(404, 'nope')), { kind: 'http', status: 404, message: '/plates/manifest.json answered 404' });
    assert.equal((await failure(respond(503, '')))?.status, 503);

    // an HTML error page served with status 200, or a half-written upload
    assert.equal((await failure(respond(200, '<html>Not found</html>')))?.kind, 'json');
    assert.equal((await failure(respond(200, '{"version": 1, "frame"')))?.kind, 'json');

    // JSON, but not a manifest
    assert.equal((await failure(respond(200, { hello: 'world' })))?.kind, 'shape');
    assert.equal((await failure(respond(200, [])))?.kind, 'shape');
  });
});
