/**
 * Everything the emails say about the business, in one place. Empty strings are left out of the email
 * (nothing is ever invented): fill `legal` in when the owner supplies the details.
 *
 * The values match the website's src/config/site.ts (phone, WhatsApp, Instagram, address, domain).
 * A change of colour, contact or legal wording is made here and rebuilt with `bun run emails:build`
 * (it regenerates n8n/mailer.code.js and supabase/templates/*.html).
 */
export const EMAIL = {
  brandName: 'FORGEDSA',
  tagline: 'Precision. Forged.',
  /** Every email is sent from this mailbox, and replies come back to it. */
  fromName: 'FORGEDSA',
  fromEmail: 'admin@forgedsa.co.za',
  replyTo: 'admin@forgedsa.co.za',
  /** Where the team's own notifications go (new enquiries and PDF downloads). */
  teamTo: 'forgedsa1@gmail.com',

  siteUrl: 'https://www.forgedsa.co.za',
  configuratorUrl: 'https://forged-configurator.vercel.app',
  accountUrl: 'https://www.forgedsa.co.za/account',
  privacyUrl: 'https://www.forgedsa.co.za/privacy-policy',
  logoUrl: 'https://forged-configurator.vercel.app/brand/forgedsa-wordmark.png',

  phoneDisplay: '+27 83 447 2654',
  /** E.164 digits only (wa.me). */
  whatsappNumber: '27834472654',
  instagramUrl: 'https://www.instagram.com/forged_sa1/',
  instagramHandle: '@forged_sa1',
  /** Left empty until the owner confirms the accounts (the app and the website disagree today). */
  tiktokUrl: '',
  youtubeUrl: '',

  addressLine: "11 Saint Mary's Avenue, Windermere, Berea, Durban, 4001",

  /** Company details for the legal footer. Shown only when set. */
  legal: {
    registeredName: '',
    registrationNumber: '',
    vatNumber: '',
    infoOfficerName: '',
    /** Falls back to fromEmail when empty. */
    infoOfficerEmail: ''
  },
  regulatorUrl: 'https://inforegulator.org.za/complaints/',

  colors: {
    bg: '#121212',
    card: '#1A1A1A',
    raised: '#222222',
    line: '#2A2A2A',
    gold: '#CF9F52',
    brass: '#E8C37D',
    ink: '#F2EEE6',
    mute: '#9C978E',
    ember: '#FF5A00'
  },

  /** The configurator's disclaimer (config/brand.ts visualisationNotice), kept word for word. */
  visualisationNotice:
    'The vehicles in the configurator are pre-curated visualisations. Paint, wheel size and finish are shown as accurately as possible, but on-screen colours and proportions are indicative. Your final specification and fitment are confirmed with our team.',

  regions: {
    za: { label: 'South Africa', currency: 'ZAR', locale: 'en-ZA', rate: 18.2 },
    uk: { label: 'United Kingdom', currency: 'GBP', locale: 'en-GB', rate: 0.79 },
    us: { label: 'United States', currency: 'USD', locale: 'en-US', rate: 1 },
    eu: { label: 'Europe', currency: 'EUR', locale: 'en-IE', rate: 0.92 },
    ae: { label: 'United Arab Emirates', currency: 'AED', locale: 'en-AE', rate: 3.67 }
  }
};
