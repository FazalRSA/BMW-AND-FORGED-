/**
 * The email layout: one block model, two renderers (HTML and plain text), one signature and legal footer.
 * Pure functions, no imports besides the config, so the build can paste it into the n8n Code node.
 *
 *   doc = { subject, preheader, kicker, title, blocks: [...], footer: 'customer' | 'team' | 'auth' , reason }
 *   blocks: { t:'p', text } { t:'muted', text } { t:'rows', rows:[[label, value, swatchHex?]] }
 *           { t:'buttons', items:[{ label, href, kind:'primary'|'ghost' }] } { t:'steps', items:[[title, body]] }
 *           { t:'build', image, title, subtitle } { t:'price', label, value, code }
 *           { t:'note', text } { t:'code', text }
 */
import { EMAIL } from './config.mjs';

const C = EMAIL.colors;
const FONT = "'Satoshi','Inter','Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Menlo,Consolas,monospace";

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Only web, mail, phone and WhatsApp links ever reach an href. A Supabase `{{ .ConfirmationURL }}` placeholder is allowed through. */
export const safeUrl = (u) => {
  const s = String(u ?? '').trim();
  if (/^\{\{\s*\.[A-Za-z]+\s*\}\}$/.test(s)) return s;
  return /^(https:\/\/|mailto:|tel:\+?[\d]+$)/i.test(s) ? s : '#';
};
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : d);

/** A greeting name: one word of letters (with ' or -), or nothing. Never anything that could carry a link or markup. */
export const firstName = (name) => {
  const n = String(name || '').trim().split(/\s+/)[0];
  return /^\p{L}[\p{L}'\u2019-]{0,29}$/u.test(n) ? n : '';
};

export const whatsappUrl = (text) => `https://wa.me/${EMAIL.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const telUrl = () => `tel:+${EMAIL.whatsappNumber}`;

// ---------------------------------------------------------------------------------------------
// HTML blocks
// ---------------------------------------------------------------------------------------------
const labelCss = `font-family:${FONT};font-size:10px;letter-spacing:2.2px;text-transform:uppercase;color:${C.mute};font-weight:700;`;

const swatch = (c) =>
  `<span style="display:inline-block;width:16px;height:16px;border-radius:8px;background-color:${c};border:1px solid #444;vertical-align:middle;margin-right:8px;">&nbsp;</span>`;

function htmlBlock(b) {
  switch (b.t) {
    case 'p':
      return `<tr><td class="px" style="padding:0 36px 16px;font-family:${FONT};font-size:16px;line-height:26px;color:${C.ink};">${esc(b.text)}</td></tr>`;
    case 'muted':
      return `<tr><td class="px" style="padding:0 36px 16px;font-family:${FONT};font-size:13px;line-height:21px;color:${C.mute};">${esc(b.text)}</td></tr>`;
    case 'note':
      return `<tr><td class="px" style="padding:4px 36px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:3px solid ${C.gold};padding:2px 0 2px 14px;font-family:${FONT};font-size:13px;line-height:21px;color:${C.mute};">${esc(b.text)}</td></tr></table></td></tr>`;
    case 'code':
      return `<tr><td class="px" align="center" style="padding:4px 36px 24px;"><div style="display:inline-block;padding:14px 26px;border-radius:12px;background-color:${C.bg};border:1px solid ${C.line};font-family:${MONO};font-size:26px;letter-spacing:8px;color:${C.gold};font-weight:700;">${esc(b.text)}</div></td></tr>`;
    case 'rows': {
      const rows = b.rows
        .filter((r) => r && r[1] !== undefined && r[1] !== null && String(r[1]).trim() !== '')
        .map(
          (r, i, all) =>
            `<tr><td style="padding:13px 0;${i < all.length - 1 ? `border-bottom:1px solid ${C.line};` : ''}width:36%;vertical-align:top;${labelCss}">${esc(r[0])}</td><td style="padding:12px 0;${i < all.length - 1 ? `border-bottom:1px solid ${C.line};` : ''}vertical-align:top;font-family:${FONT};font-size:15px;line-height:22px;color:${C.ink};">${r[2] ? swatch(hex(r[2], '#555555')) : ''}${esc(r[1])}</td></tr>`
        )
        .join('');
      return rows ? `<tr><td class="px" style="padding:0 36px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>` : '';
    }
    case 'buttons': {
      const items = b.items.filter((x) => x && x.href && x.href !== '#');
      if (!items.length) return '';
      const btn = (x) =>
        x.kind === 'ghost'
          ? `<a class="btn" href="${esc(safeUrl(x.href))}" style="display:inline-block;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;text-decoration:none;padding:15px 26px;margin:0 10px 10px 0;border-radius:999px;border:1px solid #4a4a4a;color:${C.ink};">${esc(x.label)}</a>`
          : `<a class="btn" href="${esc(safeUrl(x.href))}" style="display:inline-block;font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;text-decoration:none;padding:16px 28px;margin:0 10px 10px 0;border-radius:999px;background-color:${C.ember};color:${C.bg};">${esc(x.label)}</a>`;
      return `<tr><td class="px" style="padding:8px 36px 18px;">${items.map(btn).join('')}</td></tr>`;
    }
    case 'steps':
      return `<tr><td class="px" style="padding:6px 36px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${b.items
        .map(
          (s, i) =>
            `<tr><td width="40" valign="top" style="padding:10px 0;"><div style="width:28px;height:28px;border-radius:14px;border:1px solid ${C.gold};text-align:center;line-height:28px;font-family:${FONT};font-size:12px;font-weight:800;color:${C.gold};">${i + 1}</div></td><td valign="top" style="padding:10px 0 10px;font-family:${FONT};"><div style="font-size:15px;font-weight:700;color:${C.ink};line-height:22px;">${esc(s[0])}</div><div style="font-size:13px;line-height:20px;color:${C.mute};padding-top:2px;">${esc(s[1])}</div></td></tr>`
        )
        .join('')}</table></td></tr>`;
    case 'build': {
      const img = b.image
        ? `<td width="132" valign="middle" align="center" style="padding:14px 0 14px 14px;"><img src="${esc(safeUrl(b.image))}" width="104" alt="${esc(b.title || 'Wheel')}" style="display:block;width:104px;height:auto;border:0;"></td>`
        : '';
      return `<tr><td class="px" style="padding:4px 36px 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.bg};border:1px solid ${C.line};border-radius:16px;"><tr>${img}<td valign="middle" style="padding:18px 20px;"><div style="${labelCss}">${esc(b.label || 'Your build')}</div><div style="font-family:${FONT};font-size:20px;line-height:26px;font-weight:800;color:${C.ink};padding-top:6px;">${esc(b.title)}</div>${b.subtitle ? `<div style="font-family:${FONT};font-size:13px;line-height:20px;color:${C.mute};padding-top:3px;">${esc(b.subtitle)}</div>` : ''}</td></tr></table></td></tr>`;
    }
    case 'price':
      return `<tr><td class="px" style="padding:6px 36px 14px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="bottom"><div style="${labelCss}">${esc(b.label)}</div><div style="font-family:${FONT};font-size:28px;line-height:34px;font-weight:800;color:${C.ink};padding-top:6px;">${esc(b.value)}</div></td>${b.code ? `<td valign="bottom" align="right"><div style="${labelCss}">Build code</div><div style="font-family:${MONO};font-size:16px;color:${C.gold};padding-top:8px;letter-spacing:1.5px;">${esc(b.code)}</div></td>` : ''}</tr></table></td></tr>`;
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------------------------
// Signature and legal footer
// ---------------------------------------------------------------------------------------------
const chip = (href, text) =>
  `<a href="${esc(safeUrl(href))}" style="display:inline-block;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.4px;text-decoration:none;padding:9px 16px;margin:0 8px 8px 0;border-radius:999px;border:1px solid ${C.line};background-color:${C.raised};color:${C.ink};">${esc(text)}</a>`;

export const legalLines = () => {
  const L = EMAIL.legal;
  const entity = [L.registeredName, L.registrationNumber ? `Reg. no. ${L.registrationNumber}` : '', L.vatNumber ? `VAT no. ${L.vatNumber}` : ''].filter(Boolean);
  return { entity, officer: L.infoOfficerEmail || EMAIL.fromEmail, officerName: L.infoOfficerName };
};

const contactChips = () =>
  [
    chip(`mailto:${EMAIL.fromEmail}`, EMAIL.fromEmail),
    EMAIL.whatsappNumber ? chip(whatsappUrl(), 'WhatsApp') : '',
    EMAIL.instagramUrl ? chip(EMAIL.instagramUrl, `Instagram ${EMAIL.instagramHandle}`) : '',
    EMAIL.tiktokUrl ? chip(EMAIL.tiktokUrl, 'TikTok') : '',
    EMAIL.youtubeUrl ? chip(EMAIL.youtubeUrl, 'YouTube') : '',
    chip(EMAIL.siteUrl, EMAIL.siteUrl.replace('https://', ''))
  ].join('');

function footerHtml(kind, reason) {
  const lg = legalLines();
  const tiny = `font-family:${FONT};font-size:11px;line-height:18px;color:${C.mute};`;
  if (kind === 'team') {
    return `<tr><td align="center" style="padding:26px 24px 8px;${tiny}">Sent automatically from the FORGEDSA configurator to the team inbox. Every lead is also in the <a href="${esc(EMAIL.configuratorUrl)}/admin" style="color:${C.gold};text-decoration:none;">admin</a> under Enquiries.</td></tr>`;
  }
  const signature = `<tr><td class="px" style="padding:6px 36px 22px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.line};"><tr><td style="padding-top:22px;font-family:${FONT};">
      <div style="font-size:15px;font-weight:800;color:${C.ink};">The ${esc(EMAIL.brandName)} team</div>
      <div style="font-size:12px;color:${C.gold};letter-spacing:2px;text-transform:uppercase;font-weight:700;padding:3px 0 14px;">${esc(EMAIL.tagline)}</div>
      <div style="font-size:13px;line-height:22px;color:${C.mute};padding-bottom:12px;">${EMAIL.phoneDisplay ? `<a href="${esc(telUrl())}" style="color:${C.ink};text-decoration:none;">${esc(EMAIL.phoneDisplay)}</a> &nbsp;·&nbsp; ` : ''}${esc(EMAIL.addressLine)}</div>
      ${contactChips()}
    </td></tr></table></td></tr>`;
  const why = reason ? `<p style="margin:0 0 10px;">${esc(reason)}</p>` : '';
  const entity = lg.entity.length ? `<p style="margin:0 0 10px;">${esc(lg.entity.join(' · '))}</p>` : '';
  const legal = `<tr><td style="background-color:${C.bg};border-radius:0 0 22px 22px;padding:22px 36px 26px;${tiny}" class="px">
      ${why}${entity}
      <p style="margin:0 0 10px;"><strong style="color:${C.ink};">Your privacy.</strong> ${esc(EMAIL.brandName)} is the responsible party for the personal information you give us, under the Protection of Personal Information Act 4 of 2013 (POPIA). We use it only for the purpose above. You can ask to see, correct or delete it at any time: write to <a href="mailto:${esc(lg.officer)}" style="color:${C.gold};text-decoration:none;">${esc(lg.officer)}</a>${lg.officerName ? ` (Information Officer: ${esc(lg.officerName)})` : ''}, or use your <a href="${esc(EMAIL.accountUrl)}" style="color:${C.gold};text-decoration:none;">account page</a>. Read our <a href="${esc(EMAIL.privacyUrl)}" style="color:${C.gold};text-decoration:none;">privacy notice</a>. If we have not resolved a concern you may complain to the <a href="${esc(EMAIL.regulatorUrl)}" style="color:${C.gold};text-decoration:none;">Information Regulator</a>.</p>
      <p style="margin:0 0 10px;"><strong style="color:${C.ink};">Service email, not marketing.</strong> This message is about your account or request. We send marketing email only if you have opted in, and every marketing email carries an unsubscribe link.</p>
      <p style="margin:0 0 10px;"><strong style="color:${C.ink};">Disclaimer.</strong> This email and any attachments are confidential and meant for the person it was sent to. If it reached you by mistake, please tell us and delete it. Prices and specifications are indicative until our team confirms them in writing. We will never ask for your password. Genuine email from us comes from ${esc(EMAIL.fromEmail)}.</p>
      <p style="margin:0;color:#6f6b64;">© ${new Date().getFullYear()} ${esc(EMAIL.brandName)}. All rights reserved.</p>
    </td></tr>`;
  return signature + legal;
}

// ---------------------------------------------------------------------------------------------
// Whole document
// ---------------------------------------------------------------------------------------------
export function renderHtml(doc) {
  const team = doc.footer === 'team';
  const body = doc.blocks.map(htmlBlock).join('');
  const pre = esc(doc.preheader || '');
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>${esc(doc.subject)}</title>
<style>
  body{margin:0;padding:0;background-color:${C.bg};-webkit-text-size-adjust:100%;}
  a{color:${C.gold};}
  @media (max-width:520px){
    .px{padding-left:22px!important;padding-right:22px!important;}
    .h1{font-size:28px!important;line-height:33px!important;}
    .btn{display:block!important;margin-right:0!important;text-align:center!important;}
    .wrap{padding:16px 10px!important;}
  }
</style></head>
<body style="margin:0;padding:0;background-color:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg};font-size:1px;line-height:1px;">${pre}${'&nbsp;&zwnj;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background-color:${C.bg};"><tr><td align="center" class="wrap" style="padding:32px 14px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
  <tr><td align="center" style="padding:6px 0 26px;"><a href="${esc(EMAIL.siteUrl)}" style="text-decoration:none;"><img src="${esc(EMAIL.logoUrl)}" width="176" alt="${esc(EMAIL.brandName)}" style="display:block;width:176px;height:auto;border:0;font-family:${FONT};font-size:20px;font-weight:800;color:${C.gold};"></a></td></tr>
  <tr><td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.line};border-radius:24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="height:4px;line-height:4px;font-size:0;background-color:${C.gold};border-radius:24px 24px 0 0;">&nbsp;</td></tr>
      <tr><td class="px" style="padding:36px 36px 8px;">
        ${doc.kicker ? `<div style="font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${C.gold};font-weight:800;">${esc(doc.kicker)}</div>` : ''}
        <div class="h1" style="font-family:${FONT};font-size:34px;line-height:40px;letter-spacing:-.5px;color:${C.ink};font-weight:800;padding-top:10px;">${esc(doc.title)}</div>
      </td></tr>
      <tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
      ${body}
      ${team ? '<tr><td style="height:18px;line-height:18px;font-size:0;">&nbsp;</td></tr>' : ''}
      ${team ? '' : footerHtml(doc.footer || 'customer', doc.reason)}
    </table>
  </td></tr>
  ${team ? footerHtml('team') : ''}
</table>
</td></tr></table>
</body></html>`;
}

// ---------------------------------------------------------------------------------------------
// Plain text (every email goes out as multipart: better deliverability, readable anywhere)
// ---------------------------------------------------------------------------------------------
export function renderText(doc) {
  const out = [];
  if (doc.kicker) out.push(doc.kicker.toUpperCase());
  out.push(doc.title, '');
  for (const b of doc.blocks) {
    if (b.t === 'p' || b.t === 'muted' || b.t === 'note') out.push(b.text, '');
    else if (b.t === 'code') out.push(b.text, '');
    else if (b.t === 'rows') {
      for (const r of b.rows) if (r && r[1] !== undefined && r[1] !== null && String(r[1]).trim() !== '') out.push(`${r[0]}: ${r[1]}`);
      out.push('');
    } else if (b.t === 'buttons') {
      for (const x of b.items) if (x && x.href && x.href !== '#') out.push(`${x.label}: ${x.href}`);
      out.push('');
    } else if (b.t === 'steps') {
      b.items.forEach((s, i) => out.push(`${i + 1}. ${s[0]} - ${s[1]}`));
      out.push('');
    } else if (b.t === 'build') out.push(`Your build: ${b.title}${b.subtitle ? ` (${b.subtitle})` : ''}`, '');
    else if (b.t === 'price') out.push(`${b.label}: ${b.value}${b.code ? `   Build code: ${b.code}` : ''}`, '');
  }
  if (doc.footer === 'team') {
    out.push('Sent automatically from the FORGEDSA configurator to the team inbox.');
    return out.join('\n').trim() + '\n';
  }
  const lg = legalLines();
  out.push('--', `The ${EMAIL.brandName} team`, EMAIL.tagline, `${EMAIL.fromEmail} | ${EMAIL.phoneDisplay} | WhatsApp ${whatsappUrl()}`, `${EMAIL.siteUrl} | Instagram ${EMAIL.instagramUrl}`, EMAIL.addressLine);
  if (lg.entity.length) out.push(lg.entity.join(' | '));
  out.push('');
  if (doc.reason) out.push(doc.reason, '');
  out.push(
    `Your privacy: ${EMAIL.brandName} is the responsible party for the personal information you give us, under the Protection of Personal Information Act 4 of 2013 (POPIA). We use it only for the purpose above. To see, correct or delete it, write to ${lg.officer}${lg.officerName ? ` (Information Officer: ${lg.officerName})` : ''} or use ${EMAIL.accountUrl}. Privacy notice: ${EMAIL.privacyUrl}. Complaints: ${EMAIL.regulatorUrl}`,
    '',
    'Service email, not marketing: this message is about your account or request. We send marketing email only if you have opted in, and every marketing email carries an unsubscribe link.',
    '',
    `Disclaimer: this email and any attachments are confidential and meant for the person it was sent to. If it reached you by mistake, please tell us and delete it. Prices and specifications are indicative until our team confirms them in writing. We will never ask for your password. Genuine email from us comes from ${EMAIL.fromEmail}.`
  );
  return out.join('\n').trim() + '\n';
}
