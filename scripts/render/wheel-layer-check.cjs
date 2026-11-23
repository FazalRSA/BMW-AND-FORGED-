/**
 * Check the path-traced wheel layers in the real app (docs/ADD_PREPARED_CAR.md, "Path-traced wheel layers"): enters
 * the car from the welcome carousel, picks the wheel (by its code, e.g. "FF-1") and finish (by name, e.g. "Silver") in
 * the drawer, then shoots each view chip and FAILS if a view that wheels.json lists for that choice does not show its
 * layer, or still draws the live wheels under it.
 *
 *   bunx vite --host 127.0.0.1 --port 5173            # dev server, in another shell
 *   node scripts/render/wheel-layer-check.cjs <outDir> <carId> "<slide name>" "<wheel code>" "<finish name>"
 *
 * Supabase writes are answered locally (never a real lead). WHEEL_ROWS=<json file> merges partial wheels rows into the
 * catalogue read (see below). SwiftShader: a few minutes.
 */
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [,, OUT, CAR, SLIDE, WHEEL, FINISH] = process.argv;
if (!OUT || !CAR || !SLIDE || !WHEEL || !FINISH) {
  console.error('usage: wheel-layer-check.cjs <outDir> <carId> "<slide name>" "<wheel code>" "<finish name>"');
  process.exit(2);
}
const VIEWS = [['Front', 'frontThreeQuarter'], ['Side', 'side'], ['Rear', 'rearThreeQuarter'], ['Wheel', 'frontWheel'], ['Top', 'top']];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const problems = [];
  p.on('pageerror', (e) => problems.push('pageerror ' + e.message));
  await p.route(/supabase\.co\/(rest|functions)\//, (r) => (['GET', 'HEAD'].includes(r.request().method()) ? r.continue() : r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })));
  // (registered after the generic route above: Playwright runs the newest matching route first)
  // WHEEL_ROWS=<json file>: partial wheels rows (an array with ids) merged into the live catalogue's answer, in this browser
  // only, to check a catalogue change (a new rim file, changed finishes) before its migration is applied. Nothing is written.
  const rowsFile = process.env.WHEEL_ROWS;
  if (rowsFile) {
    let extra;
    try { extra = JSON.parse(fs.readFileSync(rowsFile, 'utf8')); } catch (e) { console.error(`WHEEL_ROWS=${rowsFile}: ${e.message}`); process.exit(2); }
    if (!Array.isArray(extra) || extra.some((x) => !x || typeof x.id !== 'string')) { console.error(`WHEEL_ROWS=${rowsFile}: expected an array of rows with an id`); process.exit(2); }
    await p.route(/supabase\.co\/rest\/v1\/wheels\?/, async (r) => {
      try {
        const res = await r.fetch();
        const rows = await res.json();
        if (Array.isArray(rows)) for (const x of extra) { const row = rows.find((y) => y.id === x.id); if (row) Object.assign(row, x); }
        await r.fulfill({ response: res, json: rows });
      } catch (e) {
        problems.push(`could not merge WHEEL_ROWS into the catalogue read: ${e.message}`);
        await r.continue().catch(() => {});
      }
    });
  }
  const tag = `${CAR}-${WHEEL}-${FINISH}`.replace(/[^A-Za-z0-9_-]+/g, '_');
  const shot = (name) => p.screenshot({ path: path.join(OUT, `${tag}-${name}.png`), timeout: 120000 });
  const log = (s) => console.log(`${CAR}: ${s}`);

  try {
    await p.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 240000 });
    await p.getByRole('button', { name: /enter|start|begin|discover/i }).first().waitFor({ timeout: 240000 });
    const dot = p.getByRole('button', { name: SLIDE, exact: true }).first();
    if (!(await dot.count())) throw new Error(`no slide "${SLIDE}" on the welcome carousel`);
    await dot.click();
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: /enter|start|begin|discover/i }).first().click({ timeout: 60000 });
    await p.getByRole('button', { name: /step 2|wheels/i }).first().waitFor({ timeout: 180000 });
    await p.waitForTimeout(4000);

    // the drawer: open the wheels row, pick the design; then the finish row, pick the finish
    await p.getByRole('button', { name: /^wheels\b/i }).first().click({ timeout: 30000 });
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: new RegExp(esc(WHEEL), 'i') }).first().click({ timeout: 30000 });
    await p.waitForTimeout(1500);
    // a design opens in its default finish: pick another only when the build summary does not already show it
    const chosen = await p.evaluate((f) => new RegExp(`·\\s*${f}\\b`, 'i').test(document.body.innerText), esc(FINISH));
    if (!chosen) {
      await p.getByRole('button', { name: /^step 4/i }).first().click({ timeout: 30000 });
      await p.waitForTimeout(800);
      await p.getByRole('button', { name: new RegExp(`^${esc(FINISH)}\\b`, 'i') }).first().click({ timeout: 30000 });
    }
    await p.waitForTimeout(4000);
  } catch (e) {
    await shot('failed-drawer').catch(() => {});
    console.error(`${CAR}: could not pick ${WHEEL} ${FINISH}: ${e.message}`);
    await b.close();
    process.exit(1);
  }

  const index = await p.evaluate(() => fetch('/renders/wheels.json').then((r) => r.json()).catch(() => null));
  for (const [label, view] of VIEWS) {
    const chip = p.getByRole('button', { name: new RegExp(`^${label}$`) }).first();
    if (await chip.count()) { await chip.click(); await p.waitForTimeout(6000); }
    const state = await p.evaluate(() => {
      const img = [...document.querySelectorAll('img')].find((i) => i.src.includes('/wheels/') && i.src.endsWith('.webp'));
      return { src: img ? new URL(img.src).pathname : null, shown: !!img && img.complete && getComputedStyle(img).opacity === '1' };
    });
    const listed = !!index?.cars?.[CAR]?.[view] && !!state.src;
    await shot(view);
    log(`${view}: ${state.src ? `${state.src} ${state.shown ? 'shown' : 'NOT SHOWN'}` : 'no layer (live wheels)'}`);
    if (index?.cars?.[CAR]?.[view] && !state.src) problems.push(`${view}: wheels.json lists the view but no layer is drawn`);
    if (listed && !state.shown) problems.push(`${view}: the layer did not show`);
  }
  await b.close();
  if (problems.length) { console.log('PROBLEMS:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log(`${CAR}: ok`);
})().catch((e) => { console.error(e); process.exit(1); });
