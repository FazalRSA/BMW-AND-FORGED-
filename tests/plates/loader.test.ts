import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { LoadableImage, createPlateLoader } from '../../services/plates/loader';

/** Images that load or fail when the test says so. */
function fakeImages() {
  const pending = new Map<string, { resolve: () => void; reject: (e: Error) => void }>();
  const requested: string[] = [];
  const createImage = (): LoadableImage => {
    const image: LoadableImage = {
      src: '',
      crossOrigin: null,
      onload: null,
      onerror: null,
      decode: () =>
        new Promise<void>((resolve, reject) => {
          requested.push(image.src);
          pending.set(image.src, { resolve, reject });
        })
    };
    return image;
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return {
    createImage,
    requested,
    inFlight: () => [...pending.keys()],
    finish: async (url: string) => {
      pending.get(url)!.resolve();
      pending.delete(url);
      await tick();
    },
    fail: async (url: string) => {
      pending.get(url)!.reject(new Error('EncodingError'));
      pending.delete(url);
      await tick();
    }
  };
}

describe('createPlateLoader', () => {
  test('load resolves once the picture is decoded, and asks for each picture once', async () => {
    const images = fakeImages();
    const loader = createPlateLoader({ createImage: images.createImage });
    let done = false;
    const first = loader.load('/a.avif').then(() => (done = true));
    const second = loader.load('/a.avif');
    assert.deepEqual(images.requested, ['/a.avif']);
    assert.equal(loader.ready('/a.avif'), false);
    assert.equal(done, false);
    await images.finish('/a.avif');
    await Promise.all([first, second]);
    assert.equal(done, true);
    assert.equal(loader.ready('/a.avif'), true);
    await loader.load('/a.avif');
    assert.deepEqual(images.requested, ['/a.avif'], 'a kept picture is not fetched again');
  });

  test('a picture that fails rejects, is forgotten, and loads on the next request', async () => {
    const images = fakeImages();
    const loader = createPlateLoader({ createImage: images.createImage });
    const failed = assert.rejects(loader.load('/broken.avif'), /could not load \/broken\.avif/);
    await images.fail('/broken.avif');
    await failed;
    assert.equal(loader.ready('/broken.avif'), false);

    const retried = loader.load('/broken.avif');
    assert.deepEqual(images.requested, ['/broken.avif', '/broken.avif']);
    await images.finish('/broken.avif');
    await retried;
    assert.equal(loader.ready('/broken.avif'), true);
  });

  test('a browser without decode() falls back to the load and error events', async () => {
    const created: LoadableImage[] = [];
    const loader = createPlateLoader({
      createImage: () => {
        const image: LoadableImage = { src: '', crossOrigin: null, onload: null, onerror: null };
        created.push(image);
        return image;
      }
    });
    const ok = loader.load('/a.webp');
    (created[0].onload as unknown as () => void)();
    await ok;
    const bad = assert.rejects(loader.load('/b.webp'));
    (created[1].onerror as unknown as () => void)();
    await bad;
  });

  test('warm downloads a few at a time and never the whole list at once', async () => {
    const images = fakeImages();
    const loader = createPlateLoader({ createImage: images.createImage, concurrency: 2 });
    loader.warm(['/1', '/2', '/3', '/4', '/2']);
    assert.deepEqual(images.inFlight(), ['/1', '/2']);
    await images.finish('/1');
    assert.deepEqual(images.inFlight(), ['/2', '/3']);
    await images.finish('/2');
    await images.finish('/3');
    assert.deepEqual(images.inFlight(), ['/4']);
    await images.finish('/4');
    assert.deepEqual(images.requested, ['/1', '/2', '/3', '/4']);
  });

  test('a new warm list replaces what had not started', async () => {
    const images = fakeImages();
    const loader = createPlateLoader({ createImage: images.createImage, concurrency: 1 });
    loader.warm(['/old-1', '/old-2', '/old-3']);
    loader.warm(['/new-1']);
    await images.finish('/old-1');
    assert.deepEqual(images.inFlight(), ['/new-1']);
    await images.finish('/new-1');
    assert.deepEqual(images.requested, ['/old-1', '/new-1']);
  });

  test('load does not wait behind the warm queue, and a failed warm-up is not an error', async () => {
    const images = fakeImages();
    const loader = createPlateLoader({ createImage: images.createImage, concurrency: 1 });
    loader.warm(['/w1', '/w2', '/wanted']);
    const wanted = loader.load('/wanted');
    assert.deepEqual(images.inFlight(), ['/w1', '/wanted']);
    await images.finish('/wanted');
    await wanted;
    await images.fail('/w1');
    assert.deepEqual(images.inFlight(), ['/w2'], 'the queue carries on after a failure');
    await images.finish('/w2');
    assert.deepEqual(images.requested, ['/w1', '/wanted', '/w2'], '/wanted was not fetched twice');
  });

  test('only the most recent pictures are kept', async () => {
    const images = fakeImages();
    const loader = createPlateLoader({ createImage: images.createImage, keep: 2 });
    for (const url of ['/1', '/2', '/3']) {
      const loading = loader.load(url);
      await images.finish(url);
      await loading;
    }
    assert.deepEqual(['/1', '/2', '/3'].map((url) => loader.ready(url)), [false, true, true]);
  });

  test('crossOrigin is set when asked for', () => {
    const created: LoadableImage[] = [];
    const images = fakeImages();
    const loader = createPlateLoader({ crossOrigin: 'anonymous', createImage: () => (created.push(images.createImage()), created[created.length - 1]) });
    void loader.load('/a');
    assert.equal(created[0].crossOrigin, 'anonymous');
  });
});
