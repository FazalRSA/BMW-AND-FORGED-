import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hmacSha256Hex } from './hmac.mjs';
import { handle, verify } from './mailer.mjs';
import { EMAIL } from './config.mjs';
import { renderHtml, renderText, safeUrl } from './render.mjs';
import { AUTH_EMAILS } from './auth.mjs';

const KEY = 'test-signing-key-0123456789abcdef';
const NOW = 1_800_000_000_000;
// The contract with the database (private.notify_mailer): sent_at.event.id.data.email.data.customer_copy
const sign = (event, id, data = {}, sentAt = NOW / 1000, key = KEY) => hmacSha256Hex(key, `${sentAt}.${event}.${id}.${data.email ?? ''}.${data.customer_copy ?? ''}`);
const lead = (over = {}) => ({
  id: 'lead-1', created_at: '2026-11-24T08:00:00Z', source: 'enquiry', name: 'Thandi Nkosi', email: 'thandi@example.com', phone: '082 123 4567', message: 'Is the 20" set in stock?', consultation: true,
  config_code: 'ABCD1234', region: 'za', size: '20"', signed_in: false,
  car: { name: 'BMW M2 CS', generation: 'G87' }, paint: { name: 'Zandvoort Blue', hex: '#2f5fa8', type: 'metallic' },
  wheel: { name: 'FSA003', code: 'FSA-03', image_url: 'https://forged-configurator.vercel.app/rim-images/fsa003.webp', price_usd: 2200 },
  finish: { name: 'Satin Black', hex: '#1a1a1a' }, customer_copy: true, ...over
});
const event = (name, data, id = 'lead-1') => ({ event: name, id, sent_at: NOW / 1000, signature: sign(name, id, data), data });

test('hmac matches node:crypto for ascii, unicode, empty and long keys', () => {
  for (const [k, m] of [['k', 'm'], ['', ''], ['x'.repeat(100), 'message with ünïcödé ✓ 🚗'], [KEY, '1800000000.lead.abc']]) {
    assert.equal(hmacSha256Hex(k, m), createHmac('sha256', k).update(m).digest('hex'));
  }
});

test('lead event gives the team notice and the customer copy, from admin@', () => {
  const out = handle({ body: event('lead', lead()) }, { key: KEY, now: NOW });
  assert.equal(out.length, 2);
  assert.equal(out[0].to, EMAIL.teamTo);
  assert.equal(out[0].replyTo, 'thandi@example.com');
  assert.equal(out[1].to, 'thandi@example.com');
  assert.equal(out[1].replyTo, EMAIL.replyTo);
  for (const m of out) { assert.equal(m.fromEmail, 'admin@forgedsa.co.za'); assert.ok(m.html.includes('<!doctype html>')); assert.ok(m.text.length > 100); }
  assert.match(out[1].subject, /We have your enquiry: BMW M2 CS/);
  assert.match(out[1].html, /R\s?40\s?040/); // 2200 USD x 18.2 = 40 040 ZAR
});

test('pdf lead sends the build link, welcome sends the garage email', () => {
  const pdf = handle({ body: event('lead', lead({ source: 'pdf' })) }, { key: KEY, now: NOW });
  assert.match(pdf[1].subject, /^Your FORGEDSA build/);
  assert.ok(pdf[1].html.includes('?config=ABCD1234'));
  const w = handle({ body: { event: 'welcome', id: 'u1', sent_at: NOW / 1000, signature: sign('welcome', 'u1', { email: 'a@b.co' }), data: { email: 'a@b.co', name: 'Sipho Dlamini' } } }, { key: KEY, now: NOW });
  assert.equal(w.length, 1);
  assert.match(w[0].subject, /^Welcome to FORGEDSA, Sipho$/);
  assert.ok(w[0].html.includes(EMAIL.accountUrl));
});

test('a forged, stale or unknown event sends nothing', () => {
  assert.throws(() => handle({ body: { ...event('lead', lead()), signature: sign('lead', 'lead-1', lead(), NOW / 1000, 'wrong-key') } }, { key: KEY, now: NOW }), /Bad signature/);
  assert.throws(() => handle({ body: event('lead', lead()) }, { key: KEY, now: NOW + 16 * 60 * 1000 }), /Stale/);
  assert.throws(() => handle({ body: { ...event('lead', lead()), id: 'other' } }, { key: KEY, now: NOW }), /Bad signature/); // id is signed
  const good = event('lead', lead());
  assert.throws(() => handle({ body: { ...good, data: { ...good.data, email: 'someone-else@example.com' } } }, { key: KEY, now: NOW }), /Bad signature/); // the recipient is signed
  assert.throws(() => handle({ body: { ...good, data: { ...good.data, customer_copy: false } } }, { key: KEY, now: NOW }), /Bad signature/); // so is the copy flag
  assert.throws(() => handle({ body: event('lead', lead()) }, { key: KEY, now: NOW - 16 * 60 * 1000 }), /Stale/); // an event from the future is refused too
  assert.throws(() => handle({ body: event('mystery', {}, 'x') }, { key: KEY, now: NOW }), /Unknown mailer event/);
  assert.throws(() => verify(event('lead', lead()), '__MAILER_SIGNING_KEY__', NOW), /not set/);
  assert.throws(() => handle({ body: { event: 'lead' } }, { key: KEY, now: NOW }), /signed/);
});

test('customer text is escaped and cannot inject headers', () => {
  const evil = lead({ name: '<script>alert(1)</script>"><img src=x onerror=1>', message: '<b>hi</b> & "quoted"', email: 'victim@example.com' });
  const out = handle({ body: event('lead', evil) }, { key: KEY, now: NOW });
  for (const m of out) { assert.ok(!m.html.includes('<script>')); assert.ok(!/<img src=x/.test(m.html)); assert.ok(!m.html.includes('<b>hi</b>')); }
  const inj = handle({ body: event('lead', lead({ name: 'Eve\r\nBcc: boss@example.com', car: { name: 'M2\r\nBcc: x@y.z' } })) }, { key: KEY, now: NOW });
  for (const m of inj) assert.ok(!/[\r\n]/.test(m.subject));
  assert.equal(handle({ body: event('lead', lead({ email: 'a@b.co\r\nBcc: x@y.z' })) }, { key: KEY, now: NOW }).length, 1); // only the team copy survives a bad address
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('https://ok.example/x'), 'https://ok.example/x');
});

test('the visitor copy repeats nothing a stranger could have typed, and only follows the database flag', () => {
  const evil = lead({ name: 'Click http://evil.example now', message: 'Pay to evil.example', car: { name: 'M2 www.evil.example/x' }, config_code: 'x"><b>', wheel: { name: 'FSA003', image_url: 'https://evil.example/pixel.png' } });
  const out = handle({ body: event('lead', evil) }, { key: KEY, now: NOW });
  const copy = out[1];
  assert.ok(!/evil\.example/i.test(copy.html + copy.text));
  assert.ok(!copy.html.includes('Pay to'));
  const odd = handle({ body: event('lead', lead({ name: '<b>Bob</b>' })) }, { key: KEY, now: NOW })[1];
  assert.ok(odd.html.includes('Thanks. We are on it.')); // a name with markup is not used as a greeting
  assert.ok(!copy.html.includes('?config=x'));
  const typed = lead({ car: { name: 'Call 0800 123 to verify' }, paint: { name: 'Pay us' }, wheel: { name: 'Send money' }, finish: { name: 'Now' } });
  const typedCopy = handle({ body: event('lead', typed) }, { key: KEY, now: NOW })[1];
  for (const s of ['Call 0800', 'Pay us', 'Send money']) assert.ok(!typedCopy.html.includes(s), s); // names the catalogue did not vouch for stay out of the visitor's copy
  const noCopy = handle({ body: event('lead', lead({ customer_copy: false })) }, { key: KEY, now: NOW });
  assert.equal(noCopy.length, 1);
  assert.equal(noCopy[0].to, EMAIL.teamTo);
});

test('legal fields appear only when set; the footer always carries POPIA, contact and disclaimer', () => {
  const html = handle({ body: event('lead', lead()) }, { key: KEY, now: NOW })[1].html;
  for (const s of ['Protection of Personal Information Act', 'Information Regulator', 'admin@forgedsa.co.za', 'wa.me/27834472654', 'instagram.com/forged_sa1', 'www.forgedsa.co.za', 'Disclaimer', 'Service email, not marketing']) assert.ok(html.includes(s), s);
  assert.ok(!/Reg\. no\.|VAT no\./.test(html));
  Object.assign(EMAIL.legal, { registeredName: 'Example (Pty) Ltd', registrationNumber: '2020/123456/07', vatNumber: '4123456789', infoOfficerName: 'A. Officer', infoOfficerEmail: 'privacy@forgedsa.co.za' });
  const filled = handle({ body: event('lead', lead()) }, { key: KEY, now: NOW })[1].html;
  Object.assign(EMAIL.legal, { registeredName: '', registrationNumber: '', vatNumber: '', infoOfficerName: '', infoOfficerEmail: '' });
  for (const s of ['Example (Pty) Ltd', 'Reg. no. 2020/123456/07', 'VAT no. 4123456789', 'privacy@forgedsa.co.za', 'Information Officer: A. Officer']) assert.ok(filled.includes(s), s);
});

test('plain text has no markup', () => {
  const t = handle({ body: event('lead', lead()) }, { key: KEY, now: NOW })[1].text;
  assert.ok(!/<[a-z][\s\S]*>/i.test(t));
  assert.match(t, /POPIA/);
});

test('auth templates keep the Supabase placeholders', () => {
  for (const [name, t] of Object.entries(AUTH_EMAILS)) {
    const html = renderHtml({ ...t.doc, subject: t.subject });
    assert.ok(/\{\{ \.(ConfirmationURL|Token) \}\}/.test(html), name);
    assert.ok(!html.includes('href="#"'), `${name} lost its link`);
  }
  assert.ok(renderText({ ...AUTH_EMAILS.recovery.doc, subject: 's' }).includes('{{ .ConfirmationURL }}'));
});

test('the built n8n script runs the same way', () => {
  const code = readFileSync(new URL('../n8n/mailer.code.js', import.meta.url), 'utf8').replace('__MAILER_SIGNING_KEY__', KEY);
  const realNow = Date.now; Date.now = () => NOW;
  try {
    const run = new Function('$input', code);
    const out = run({ first: () => ({ json: { body: event('lead', lead()) } }) });
    assert.equal(out.length, 2);
    assert.equal(out[1].json.to, 'thandi@example.com');
  } finally { Date.now = realNow; }
});
