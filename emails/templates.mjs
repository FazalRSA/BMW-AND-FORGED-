/** The emails themselves: each returns { to, subject, doc, replyTo }. Rendering is in render.mjs. */
import { EMAIL } from './config.mjs';
import { firstName, whatsappUrl } from './render.mjs';

const clip = (v, n) => String(v ?? '').slice(0, n);
/** Text from a visitor that goes into an email to somebody else: no links, no markup, short. */
export const plain = (v, n = 60) => String(v ?? '').replace(/(https?:\/\/|www\.)\S*/gi, '').replace(/[<>{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const SAFE_CODE = /^[A-Za-z0-9]{4,40}$/;
const SAFE_IMAGE = new RegExp('^' + EMAIL.configuratorUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/');

const NBSP = new RegExp('[\\u00a0\\u202f]', 'g');
export const moneyFor = (usd, regionId) => {
  if (!(Number(usd) > 0)) return null;
  const r = EMAIL.regions[regionId] || EMAIL.regions.za;
  const n = Math.round((Number(usd) * r.rate) / 10) * 10;
  return new Intl.NumberFormat(r.locale, { style: 'currency', currency: r.currency, maximumFractionDigits: 0 }).format(n).replace(NBSP, ' ');
};

/** A South African or international number as wa.me digits, or '' when it does not look like one. */
export const waDigits = (phone) => {
  let d = String(phone || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '27' + d.slice(1);
  return d.length >= 9 && d.length <= 15 ? d : '';
};

const buildParts = (lead) => {
  const car = lead.car || {};
  const paint = lead.paint || {};
  const wheel = lead.wheel || {};
  const finish = lead.finish || {};
  const code = clip(lead.config_code, 40);
  const buildUrl = code ? `${EMAIL.configuratorUrl}/?config=${encodeURIComponent(code)}` : EMAIL.configuratorUrl;
  const rows = [
    ['Vehicle', [car.name, car.generation].filter(Boolean).join(' · ')],
    ['Paint', [paint.name, paint.type].filter(Boolean).join(' · '), paint.hex],
    ['Wheel', [wheel.name, wheel.code].filter(Boolean).join(' · ')],
    ['Size', lead.size],
    ['Finish', [finish.name, finish.color_name && finish.color_name !== finish.name ? finish.color_name : ''].filter(Boolean).join(' · '), finish.hex]
  ];
  return { car, paint, wheel, finish, code, buildUrl, rows, price: moneyFor(wheel.price_usd, lead.region) };
};

/** The same parts as buildParts, every visitor-typed string cleaned, for the mail that goes to the visitor's address. */
const safeParts = (lead) => {
  // A name counts only when the database found it in the catalogue (the lookup adds a code, generation or colour);
  // when it fell back to text the visitor typed, it is left out of mail to that address.
  const car = lead.car || {}, paint = lead.paint || {}, wheel = lead.wheel || {}, finish = lead.finish || {};
  const known = (o, proof) => (proof ? plain(o.name) : '');
  const c = {
    ...lead,
    size: plain(lead.size, 12),
    car: { name: known(car, car.generation || car.badge), generation: plain(car.generation, 12) },
    paint: { name: known(paint, paint.hex), type: plain(paint.type, 20), hex: paint.hex },
    wheel: { name: known(wheel, wheel.code || wheel.style), code: plain(wheel.code, 20), image_url: SAFE_IMAGE.test(wheel.image_url || '') ? wheel.image_url : '', price_usd: wheel.price_usd },
    finish: { name: known(finish, finish.hex), color_name: finish.hex ? plain(finish.color_name) : '', hex: finish.hex },
    config_code: SAFE_CODE.test(lead.config_code || '') ? lead.config_code : ''
  };
  return { lead: c, p: buildParts(c) };
};

const kindOf = (lead) => (lead.source === 'pdf' ? 'pdf' : 'enquiry');

/** The team's notice of a new lead (to the team inbox, replies go to the customer). */
export function leadTeam(lead) {
  const p = buildParts(lead);
  const who = clip(lead.name, 80).trim() || lead.email || 'Unknown';
  const isPdf = kindOf(lead) === 'pdf';
  const wa = waDigits(lead.phone);
  const when = new Date(lead.created_at || Date.now()).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' });
  return {
    to: EMAIL.teamTo,
    replyTo: lead.email,
    subject: `${isPdf ? 'New PDF download' : 'New enquiry'}: ${who}${p.car.name ? ` · ${p.car.name}` : ''}`,
    doc: {
      footer: 'team',
      preheader: `${who} · ${p.car.name || ''} · ${p.wheel.name || ''} ${lead.size || ''}`,
      kicker: `New lead · ${isPdf ? 'PDF download' : 'Enquiry'}`,
      title: who,
      blocks: [
        { t: 'muted', text: `${isPdf ? 'Downloaded the spec sheet for this build.' : 'Sent an enquiry about this build.'}${lead.consultation ? ' They want a consultation.' : ''} ${when} (SAST)${lead.signed_in ? ' · Signed in to an account.' : ''}` },
        { t: 'rows', rows: [['Name', clip(lead.name, 80)], ['Email', lead.email], ['Mobile', clip(lead.phone, 40)]] },
        ...(lead.message ? [{ t: 'rows', rows: [['Message', clip(lead.message, 2000)]] }] : []),
        { t: 'build', label: 'Their build', image: p.wheel.image_url, title: p.car.name || 'Their build', subtitle: [p.wheel.name, lead.size].filter(Boolean).join(' · ') },
        { t: 'rows', rows: p.rows },
        { t: 'price', label: 'Wheel set price', value: p.price || 'On request', code: p.code },
        {
          t: 'buttons',
          items: [
            lead.email ? { label: `Reply to ${firstName(lead.name) || 'lead'}`, href: `mailto:${lead.email}?subject=${encodeURIComponent('Your FORGEDSA build')}`, kind: 'primary' } : null,
            wa ? { label: 'WhatsApp', href: `https://wa.me/${wa}`, kind: 'ghost' } : null,
            { label: 'Open their build', href: p.buildUrl, kind: 'ghost' }
          ].filter(Boolean)
        }
      ]
    }
  };
}

/** The customer's copy: an enquiry receipt, or the build link after a PDF download. */
export function leadCustomer(rawLead) {
  const { lead, p } = safeParts(rawLead);
  const first = firstName(lead.name);
  const carName = p.car.name || 'your build';
  const isPdf = kindOf(lead) === 'pdf';
  const chat = whatsappUrl(`Hi FORGEDSA, I have a question about my build${p.code ? ` (${p.code})` : ''}.`);
  const common = [
    { t: 'build', image: p.wheel.image_url, title: p.car.name || 'Your build', subtitle: [p.wheel.name, lead.size].filter(Boolean).join(' · ') },
    { t: 'rows', rows: p.rows },
    ...(p.price ? [{ t: 'price', label: 'Wheel set price (set of four)', value: p.price, code: p.code }] : p.code ? [{ t: 'price', label: 'Wheel set price', value: 'On request', code: p.code }] : [])
  ];
  if (isPdf) {
    return {
      to: lead.email,
      replyTo: EMAIL.replyTo,
      subject: `Your FORGEDSA build${p.car.name ? `: ${p.car.name}` : ''}`,
      doc: {
        preheader: 'Your build and its link, kept safe.',
        kicker: 'Spec sheet',
        title: first ? `Your build, ${first}.` : 'Your build.',
        reason: 'You are receiving this because you downloaded a spec sheet from the FORGEDSA configurator with this email address.',
        blocks: [
          { t: 'p', text: `Thanks for downloading the spec sheet for ${carName}. Here is your build, so you can come back to it, change it or share it. Anyone with the link can view it.` },
          ...common,
          { t: 'buttons', items: [{ label: 'Open your build', href: p.buildUrl, kind: 'primary' }, { label: 'Ask us about it', href: chat, kind: 'ghost' }] },
          ...(lead.signed_in ? [] : [{ t: 'note', text: 'Want every build kept in one place? Sign in with Google in the configurator and save it to your garage. The same account works on our website.' }]),
          { t: 'note', text: EMAIL.visualisationNotice }
        ]
      }
    };
  }
  return {
    to: lead.email,
    replyTo: EMAIL.replyTo,
    subject: `We have your enquiry${p.car.name ? `: ${p.car.name}` : ''}`,
    doc: {
      preheader: 'Your enquiry is with the team.',
      kicker: 'Enquiry received',
      title: first ? `Thanks, ${first}. We are on it.` : 'Thanks. We are on it.',
      reason: 'You are receiving this because you sent an enquiry on the FORGEDSA configurator with this email address.',
      blocks: [
        { t: 'p', text: `We have your enquiry about ${carName}${lead.consultation ? ' and your request for a consultation' : ''}. A member of the team will come back to you by email or WhatsApp.` },
        ...common,
        { t: 'steps', items: [['We review your build', 'We check the wheel, size and finish against your car.'], ['We get in touch', 'You hear from us with confirmed fitment and pricing.'], ['You decide', 'Nothing is final until you approve the specification.']] },
        { t: 'buttons', items: [{ label: 'Open your build', href: p.buildUrl, kind: 'primary' }, { label: 'Chat on WhatsApp', href: chat, kind: 'ghost' }] },
        { t: 'note', text: EMAIL.visualisationNotice }
      ]
    }
  };
}

/** The first email a new customer gets, when their account is created. */
export function welcome(data) {
  const first = firstName(data.name);
  return {
    to: data.email,
    replyTo: EMAIL.replyTo,
    subject: `Welcome to ${EMAIL.brandName}${first ? `, ${first}` : ''}`,
    doc: {
      preheader: 'Your garage is ready.',
      kicker: 'Welcome',
      title: first ? `Welcome to the garage, ${first}.` : 'Welcome to the garage.',
      reason: 'You are receiving this because an account was created with this email address on the FORGEDSA configurator or website.',
      blocks: [
        { t: 'p', text: 'Your FORGEDSA account is ready. It is one account for both the configurator and our website, so a build you save in one is waiting in the other.' },
        { t: 'steps', items: [['Choose your BMW M', 'Pick the car and the paint it wears.'], ['Design your wheels', 'Choose the design, size and finish, and see it on the car.'], ['Save it, then talk to us', 'Keep it in your garage and send an enquiry when you are ready.']] },
        { t: 'buttons', items: [{ label: 'Configure your wheels', href: EMAIL.configuratorUrl, kind: 'primary' }, { label: 'Open your garage', href: EMAIL.accountUrl, kind: 'ghost' }] },
        { t: 'muted', text: 'You can change your details, choose whether to receive news and offers, download your data or delete your account at any time from your account page.' }
      ]
    }
  };
}
