// Car-switch smoke test: boot the app, open the build, switch car through the viewer's Car chips
// (M2 CS -> M5 -> M2 CS), screenshot each, and report every page error and the satin-bronze warning.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.argv[2];
const NOISE = /supabase|ERR_|Failed to load resource|favicon|net::|CORS|blocked/i;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const problems = [];
  p.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message));
  p.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !NOISE.test(t)) problems.push('CONSOLE ' + t);
    if (/satinBronzeRim/.test(t)) problems.push('WARN ' + t);
  });
  await p.goto('' + (process.env.BASE || 'http://127.0.0.1:5173/') + '', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await p.locator('[aria-label="Loading"]').waitFor({ state: 'hidden', timeout: 180000 }).catch(() => {});
  await p.getByRole('button', { name: /enter|start|begin|discover/i }).first().click({ timeout: 120000 });
  await p.getByRole('button', { name: /^build$/i }).first().waitFor({ timeout: 120000 });
  await p.getByRole('button', { name: /^build$/i }).first().click();
  const confirm = p.getByRole('button', { name: /^confirm$/i });
  if (await confirm.waitFor({ timeout: 8000 }).then(() => true, () => false)) await confirm.click({ timeout: 45000, noWaitAfter: true }).catch(() => {});
  const car = p.locator('section').filter({ hasText: /^Car/ }).first();
  await car.waitFor({ timeout: 120000 });
  console.log('car chips:', await car.locator('button').allTextContents());
  await p.waitForTimeout(6000);
  const switchTo = async (name, file) => {
    await car.getByRole('button', { name, exact: true }).click({ timeout: 60000 });
    await p.waitForTimeout(40000); // the new body draws only after its model file has loaded
    await p.screenshot({ path: path.join(OUT, file) });
    console.log('switched to', name, '->', file);
  };
  await switchTo('M5', 'switch-1-m5.png');
  await switchTo('M2 CS', 'switch-2-m2-back.png');
  await switchTo('M5', 'switch-3-m5-again.png');
  await switchTo('M2 CS', 'switch-4-m2-again.png');
  console.log(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'no page errors, no shader warning');
  await b.close();
})().catch((e) => { console.error('TEST FAILED:', e.message); process.exit(1); });
