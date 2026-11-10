// Release check for the satin-bronze copies (disposeBody). Loads one car on the stock design in
// engine.html (which exposes the engine as window.e), attaches a 'dispose' listener to every bronze copy
// and to the car's own rim material, then releases the body. three.js fires 'dispose' on each material it
// frees, so the counts show what was released and what was left alone.
//   CAR=5 (M2 CS, default: the copies must be released)   CAR=7 (M5: no copies, nothing to release)
const { chromium } = require('playwright');
const CAR = process.env.CAR || '5';
const URL = process.env.URL_BASE || 'http://127.0.0.1:5173/scripts/render/engine.html';
const query = `car=${CAR}&paint=3&wheel=stock_bronze&finish=bronze&size=19%22&look=viewer`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  // The browser's own /favicon.ico request is a 404 here (engine.html declares no icon): not a finding.
  p.on('response', (r) => { if (r.status() >= 400 && !/favicon\.ico$/.test(r.url())) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await p.goto(`${URL}?${query}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.waitForFunction(() => window.done !== undefined, null, { timeout: 240000 });
  const result = await p.evaluate(() => {
    const e = window.e;
    const rims = e.modelWheelMeshes.filter((m) => m.userData.stockBronze);
    const copies = rims.map((m) => m.userData.stockBronze);
    const owns = rims.map((m) => m.userData.stockOriginal);
    const disposed = { copies: 0, owns: 0 };
    copies.forEach((c) => c.addEventListener('dispose', () => { disposed.copies++; }));
    owns.forEach((o) => o.addEventListener('dispose', () => { disposed.owns++; }));
    const before = { wheelMeshes: e.modelWheelMeshes.length, rimsWithCopy: rims.length, showingCopy: rims.filter((m) => m.material === m.userData.stockBronze).length };
    e.buildBMWCarBody('coupe'); // disposeBody runs first, then the body is rebuilt
    const after = {
      copiesDisposed: disposed.copies,
      ownDisposed: disposed.owns,
      copyLeftOnMesh: rims.filter((m) => m.userData.stockBronze !== undefined).length,
      ownBackOnMesh: rims.filter((m, i) => m.material === owns[i]).length,
    };
    return { before, after };
  });
  console.log(JSON.stringify({ car: CAR, ...result, errors: errors.length ? errors : 'none' }, null, 2));
  await b.close();
  if (errors.length) process.exit(1);
})().catch((err) => { console.error('TEST FAILED:', err.message); process.exit(1); });
