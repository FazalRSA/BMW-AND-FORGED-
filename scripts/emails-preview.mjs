#!/usr/bin/env node
/**
 * Renders every email with sample data to <outdir>/*.html and, when Playwright is installed,
 * screenshots each at 640 px and 390 px (the production origin's images are served from ./public).
 * Usage: node scripts/emails-preview.mjs <outdir> [--no-shots]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMAIL } from '../emails/config.mjs';
import { renderHtml } from '../emails/render.mjs';
import { leadTeam, leadCustomer, welcome } from '../emails/templates.mjs';
import { AUTH_EMAILS } from '../emails/auth.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, '.scratch', 'emails');
mkdirSync(out, { recursive: true });

const lead = {
  id: 'preview', created_at: new Date().toISOString(), source: 'enquiry', name: 'Thandi Nkosi', email: 'thandi@example.com', phone: '082 123 4567', message: 'Is the 20" set in stock, and can you fit them this month?', consultation: true,
  config_code: 'K7M2QX9A', region: 'za', size: '20"', signed_in: false,
  car: { name: 'BMW M2 CS', generation: 'G87' }, paint: { name: 'Zandvoort Blue', hex: '#2f5fa8', type: 'metallic' },
  wheel: { name: 'FSA003', code: 'FSA-03', image_url: `${EMAIL.configuratorUrl}/rim-images/${process.env.PREVIEW_RIM || 'fsa003.webp'}`, price_usd: 2200 },
  finish: { name: 'Satin Black', color_name: 'Satin Black', hex: '#1a1a1a' }
};
const docs = {
  'lead-team': leadTeam(lead),
  'lead-customer-enquiry': leadCustomer(lead),
  'lead-customer-pdf': leadCustomer({ ...lead, source: 'pdf' }),
  welcome: welcome({ email: 'thandi@example.com', name: 'Thandi Nkosi' }),
  ...Object.fromEntries(Object.entries(AUTH_EMAILS).filter(([k]) => k === 'recovery').map(([k, t]) => [`auth-${k}`, { doc: { ...t.doc, subject: t.subject } }]))
};
const files = [];
for (const [name, m] of Object.entries(docs)) {
  m.doc.subject = m.doc.subject || m.subject;
  const f = join(out, `${name}.html`);
  writeFileSync(f, renderHtml(m.doc));
  files.push([name, f]);
}
console.log(`rendered ${files.length} emails to ${out}`);
if (process.argv.includes('--no-shots')) process.exit(0);

let chromium;
try {
  const { createRequire } = await import('node:module');
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.log('playwright not available: skipping screenshots');
  process.exit(0);
}
const browser = await chromium.launch();
const mime = { '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
for (const width of [640, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await ctx.route('https://forged-configurator.vercel.app/**', (route) => {
    const p = join(root, 'public', new URL(route.request().url()).pathname);
    if (existsSync(p)) route.fulfill({ status: 200, contentType: mime[extname(p)] || 'application/octet-stream', body: readFileSync(p) });
    else route.abort();
  });
  for (const [name, f] of files) {
    const page = await ctx.newPage();
    await page.goto('file://' + f);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.screenshot({ path: join(out, `${name}-${width}.png`), fullPage: true });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log('screenshots written');
