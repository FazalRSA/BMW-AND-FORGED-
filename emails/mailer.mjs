/**
 * The mailer's brain: takes the signed event the database posts and returns the messages to send.
 * `handle` is the only entry point; the n8n Code node calls it with the signing key and the clock.
 */
import { EMAIL } from './config.mjs';
import { renderHtml, renderText } from './render.mjs';
import { hmacSha256Hex, safeEqual } from './hmac.mjs';
import { leadTeam, leadCustomer, welcome } from './templates.mjs';

const MAX_AGE_SECONDS = 900;
const EMAIL_RE = /^[^\s@<>",;:]+@[^\s@<>",;:]+\.[^\s@<>",;:]+$/;
const LINE_BREAKS = new RegExp('[\\r\\n\\u2028\\u2029]+', 'g');
const oneLine = (s) => String(s ?? '').replace(LINE_BREAKS, ' ').trim().slice(0, 200);

/** What the database signed: time, event, id, and the two fields that decide who gets mail. */
export const signedString = (body) => `${Number(body.sent_at)}.${body.event}.${body.id ?? ''}.${(body.data && body.data.email) ?? ''}.${body.data && body.data.customer_copy !== undefined && body.data.customer_copy !== null ? String(body.data.customer_copy) : ''}`;

export function verify(body, key, nowMs) {
  if (!key || key.startsWith('__')) throw new Error('Mailer signing key is not set in the Code node');
  const sentAt = Number(body && body.sent_at);
  if (!body || !body.event || !body.signature || !Number.isFinite(sentAt)) throw new Error('Not a signed mailer event');
  if (Math.abs(nowMs / 1000 - sentAt) > MAX_AGE_SECONDS) throw new Error('Stale mailer event');
  const expected = hmacSha256Hex(key, signedString(body));
  if (!safeEqual(expected, String(body.signature))) throw new Error('Bad signature');
}

/** Finished message: addresses and subject cleaned of line breaks (header injection), HTML and text built. */
export function finish(m) {
  const to = oneLine(m.to);
  if (!EMAIL_RE.test(to)) return null;
  const replyTo = EMAIL_RE.test(oneLine(m.replyTo)) ? oneLine(m.replyTo) : EMAIL.replyTo;
  const subject = oneLine(m.subject);
  m.doc.subject = subject;
  return { to, replyTo, subject, fromName: EMAIL.fromName, fromEmail: EMAIL.fromEmail, html: renderHtml(m.doc), text: renderText(m.doc) };
}

export function messagesFor(event, data) {
  // The customer's own copy only when the database allowed it (customer_copy): see the leads trigger.
  if (event === 'lead') return data.customer_copy === true ? [leadTeam(data), leadCustomer(data)] : [leadTeam(data)];
  if (event === 'welcome') return [welcome(data)];
  throw new Error(`Unknown mailer event: ${event}`);
}

export function handle(input, ctx) {
  const body = input && typeof input.body === 'object' && input.body !== null ? input.body : input;
  verify(body, ctx.key, ctx.now);
  const data = body.data || {};
  return messagesFor(body.event, data).map(finish).filter(Boolean);
}
