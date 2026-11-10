/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Copy for the Terms & Conditions, Delivery & Fitment and Model credits pages. Edit the text here;
 * the pages (components/InfoPage.tsx) lay it out.
 *
 * DRAFT: written as a sensible South African starting point (Consumer Protection Act, POPIA), not
 * legal advice. Have an attorney review it, fill in the [bracketed] details, then set
 * `LEGAL_DRAFT` to false to remove the draft notice from the pages.
 *
 * CREDITS mirrors public/models/CREDITS.md (the file of record): change both together.
 */

export const LEGAL_DRAFT = true;
export const PAGES_UPDATED = '10 November 2026';

export interface InfoSection {
  title: string;
  /** Paragraphs. */
  body?: string[];
  /** Bullet points after the paragraphs. */
  points?: string[];
}

export interface InfoPageContent {
  path: '/terms' | '/delivery' | '/credits';
  eyebrow: string;
  title: string;
  intro: string;
  sections: InfoSection[];
}

export const TERMS: InfoPageContent = {
  path: '/terms',
  eyebrow: 'Legal',
  title: 'Terms & conditions',
  intro:
    'These terms apply when you use the FORGEDSA configurator, request a quotation or buy wheels from us. They are written to be read, not skimmed past. Nothing in them limits the rights you have under the Consumer Protection Act 68 of 2008.',
  sections: [
    {
      title: '1. Who we are',
      body: [
        'FORGEDSA ([registered company name], registration number [number], VAT number [number]) is an independent forged wheel brand based in South Africa. References to "we", "us" and "our" mean FORGEDSA; "you" means the person using the configurator or buying from us.'
      ]
    },
    {
      title: '2. The configurator is a visualisation',
      body: [
        'The configurator shows how our wheels could look on your BMW M. Paint colours, wheel finishes, proportions and sizes on screen are as accurate as we can make them, but screens differ and the cars are pre-curated 3D visualisations, not photographs of your vehicle.',
        'Prices shown are indicative, in the currency you selected, and include VAT where applicable. A configuration, a saved code or a PDF is not an order or an offer that binds either of us.'
      ]
    },
    {
      title: '3. Quotations and orders',
      points: [
        'Send an enquiry from the configurator or contact us. We confirm fitment for your exact vehicle (bolt pattern, offset, centre bore, brake clearance and load rating) before quoting.',
        'Our written quotation sets out the final specification, price, lead time and delivery or fitment option. It is valid for 14 days unless it says otherwise.',
        'An order is confirmed when you accept the quotation and we receive your deposit. We send a written order confirmation.'
      ]
    },
    {
      title: '4. Made to order, deposits and payment',
      body: [
        'Our wheels are forged and finished to your specification. Production starts only after we confirm your order.',
        'A deposit of [50]% of the order value is payable to start production. The balance is due before dispatch or fitment. We accept EFT and [other payment methods]; goods remain our property until paid in full.'
      ]
    },
    {
      title: '5. Changes and cancellations',
      points: [
        'Before production starts you may change or cancel your order. We refund your deposit less any reasonable costs already incurred, which we will itemise.',
        'Once production has started the wheels are made specifically for you. If you cancel then, we may keep a reasonable cancellation charge, as allowed by section 17 of the Consumer Protection Act, up to the value of work done and materials committed.',
        'If you ordered in response to direct marketing, you may cancel within five business days of the order or delivery, whichever is later, under section 16 of the Act.'
      ]
    },
    {
      title: '6. Delivery, collection and risk',
      body: [
        'Delivery, collection and fitment options, lead times and what to check when your wheels arrive are set out on our Delivery & fitment page, which forms part of these terms. Risk in the goods passes to you when they are delivered to you or collected.'
      ]
    },
    {
      title: '7. Fitment',
      body: [
        'Forged wheels must be fitted by a qualified technician. We recommend fitment by us or an approved fitment partner, who will balance the wheels, fit or transfer tyre pressure sensors (TPMS) where applicable and torque the wheel bolts to BMW specification. We are not responsible for damage or defects caused by incorrect fitment by others.'
      ]
    },
    {
      title: '8. Quality and warranty',
      body: [
        'Every wheel is inspected before it leaves us. In addition to your rights under the Consumer Protection Act (including the implied six-month warranty of quality), we warrant our wheels against structural defects for [number] years and against finish defects for [number] months from delivery.'
      ],
      points: [
        'The warranty covers defects in materials and workmanship.',
        'It does not cover kerb or impact damage, damage from accidents, incorrect fitment, harsh or acidic cleaning products, abrasive cleaning, modification or repairs by others, or normal wear.',
        'To claim, contact us with your order number, photos and a description. We will repair, replace or refund as the Act provides.'
      ]
    },
    {
      title: '9. Returns',
      body: [
        'Because wheels are made to your specification, we cannot accept returns of wheels that are not defective and match the confirmed order. Defective or incorrectly supplied goods may be returned within six months of delivery for repair, replacement or a refund, in line with section 56 of the Consumer Protection Act.'
      ]
    },
    {
      title: '10. Your information (POPIA)',
      body: [
        'When you send an enquiry or save a configuration we process your name, contact details and the configuration you chose. We use them only to respond to you, prepare your quotation and fulfil your order. We do not sell your information. We store it securely with our service providers and keep it only as long as we need it or the law requires.',
        'You may ask to see, correct or delete your information at any time by emailing [info@forgedsa.com]. Our Information Officer is [name]. You may also complain to the Information Regulator (inforegulator.org.za).'
      ]
    },
    {
      title: '11. Trademarks and content',
      body: [
        'BMW, M and the model names shown are trademarks of BMW AG. FORGEDSA is an independent brand and is not affiliated with or endorsed by BMW AG. Vehicle models in the configurator are 3D visualisations credited to their creators. The FORGEDSA name, logo, wheel designs and site content belong to us.'
      ]
    },
    {
      title: '12. Liability',
      body: [
        'To the extent the law allows, we are not liable for indirect or consequential loss arising from use of the configurator or our products. Nothing in these terms excludes liability that cannot be excluded under the Consumer Protection Act.'
      ]
    },
    {
      title: '13. Governing law and disputes',
      body: [
        'These terms are governed by the laws of the Republic of South Africa. If something goes wrong, please contact us first; we will try to resolve it quickly. You may also approach the Consumer Goods and Services Ombud (cgso.org.za) or the National Consumer Commission.'
      ]
    }
  ]
};

export const DELIVERY: InfoPageContent = {
  path: '/delivery',
  eyebrow: 'Ordering',
  title: 'Delivery & fitment',
  intro:
    'Every FORGEDSA wheel is forged and finished to order. Here is what happens between your enquiry and the moment your wheels are on the car.',
  sections: [
    {
      title: 'From enquiry to your driveway',
      points: [
        'Enquiry: send your configuration from the configurator. We reply within one to two business days.',
        'Fitment check and quotation: we confirm the specification for your exact car and send a written quotation.',
        'Deposit and production: your wheels are forged, machined and finished to order. Typical lead time is [6–10] weeks from deposit.',
        'Inspection: each wheel is checked for runout, balance and finish before it is packed.',
        'Delivery or fitment: we deliver to you, or fit the wheels by appointment.'
      ]
    },
    {
      title: 'Delivery options',
      points: [
        'Nationwide insured courier: door to door across South Africa, usually [2–5] business days after dispatch. Delivery to main centres is [included / quoted]; outlying areas are quoted on request.',
        'Collection: collect from [our premises / fitment partner, city] by appointment.',
        'Fitment by appointment: we fit, balance and torque your wheels at [fitment partner, city], including TPMS transfer where applicable.',
        'Outside South Africa: available on request. Duties, taxes and import charges are for the buyer.'
      ]
    },
    {
      title: 'Tracking and updates',
      body: [
        'We keep you updated at each stage of production and send a tracking number when your wheels are dispatched. Deliveries need a signature from an adult at the address.'
      ]
    },
    {
      title: 'What is in the box',
      points: [
        'Four wheels, individually protected and boxed.',
        'Centre caps fitted, and valve stems where specified.',
        'Wheel bolts, locking bolts or spacers, if they were part of your order.',
        'A care guide for your finish.'
      ]
    },
    {
      title: 'When your wheels arrive',
      points: [
        'Check that the boxes are intact before signing, and note any visible damage on the delivery slip.',
        'Unpack on a soft surface and inspect every wheel and finish.',
        'Report any damage or discrepancy within 48 hours with photos, to [info@forgedsa.com]. We will arrange a solution.'
      ]
    },
    {
      title: 'Before you fit',
      body: [
        'Test-fit one wheel on each axle before tyres are mounted, especially if your car has upgraded brakes. Forged wheels should be fitted by a qualified technician and the bolts torqued to BMW specification, then re-checked after the first 50–100 km.'
      ]
    }
  ]
};

const CC_BY = 'CC BY 4.0 (creativecommons.org/licenses/by/4.0)';
const SKETCHFAB = 'sketchfab.com/3d-models/';

/** One CC BY 4.0 car credit: title, author, source, licence and the changes we made. */
const ccByCar = (title: string, author: string, slug: string, changes: string) =>
  `"${title}" by ${author}. Source: ${SKETCHFAB}${slug}. Licence: ${CC_BY}. Changes: ${changes}`;

/**
 * Model credits page (/credits). Satisfies the attribution the CC BY 4.0 car models require and
 * records the source of everything else drawn in the configurator. Mirror of public/models/CREDITS.md.
 */
export const CREDITS: InfoPageContent = {
  path: '/credits',
  eyebrow: 'Legal',
  title: 'Model credits',
  intro:
    'The cars and wheels in the configurator are 3D visualisations. This page credits the people whose work they are built on and records the licence each model is used under. BMW, M and the model names are trademarks of BMW AG; FORGEDSA is an independent brand and is not affiliated with or endorsed by BMW AG.',
  sections: [
    {
      title: 'FORGEDSA wheels',
      body: [
        'The wheel designs are FORGEDSA’s own. The 3D rim files were supplied by FORGEDSA from its website and prepared for the configurator (web compression; the brake parts in the source files are not shown). The 3D artist who modelled them is not recorded in the files; creator credit to be confirmed.'
      ],
      points: [
        'FSA001 (2-piece, staggered 19×9.5 front / 20×11 rear): supplied by FORGEDSA; creator credit to be confirmed.',
        'FSA002: supplied by FORGEDSA; creator credit to be confirmed.',
        'FSA003: supplied by FORGEDSA; creator credit to be confirmed.',
        'FSA004: supplied by FORGEDSA; creator credit to be confirmed.',
        'FF-1: supplied by FORGEDSA; creator credit to be confirmed.',
        'FF-3: supplied by FORGEDSA; creator credit to be confirmed.',
        'Wheel thumbnails: cut-outs of FORGEDSA’s own product photographs; the FSA001 thumbnail is a render of its 3D rim file.'
      ]
    },
    {
      title: 'BMW cars prepared for FORGEDSA',
      body: [
        'The M2 CS (G87), M4 CS (G82), M5 (G90) and M5 Touring (G99) bodies were supplied by FORGEDSA as prepared 3D packages. Their author is not recorded in the files; licence to be confirmed. Original wheels replaced in the configurator.'
      ],
      points: [
        'BMW M2 CS (G87): supplied by FORGEDSA, licence to be confirmed.',
        'BMW M4 CS (G82): supplied by FORGEDSA, licence to be confirmed.',
        'BMW M5 (G90): supplied by FORGEDSA, licence to be confirmed.',
        'BMW M5 Touring (G99): supplied by FORGEDSA, licence to be confirmed.'
      ]
    },
    {
      title: 'BMW cars from Sketchfab (Creative Commons Attribution 4.0)',
      body: [
        'These models are used under the Creative Commons Attribution 4.0 International licence, which allows commercial use provided the author is credited and changes are indicated. In every case we replaced the original wheels with FORGEDSA wheels and compressed the file for the web. Some of these cars are not currently offered in the configurator; the credit stands while the file is part of the site.'
      ],
      points: [
        ccByCar('BMW M4 Competition M Package', 'SRT Performance', 'bmw-m4-competition-m-package-5c0a2dafb1ad408d9fc9eeef9aee531b', 'livery hidden, wheels replaced.'),
        ccByCar('2025 BMW M4 CS VR46 Edition', "BMW'S Lost Proxy", '2025-bmw-m4-cs-vr46-edition-3d111a7ed0f544bc9215e3038db4c8dc', 'compressed, wheels replaced, calipers recoloured.'),
        ccByCar('BMW M2 g87 [Free]', 'Black Snow', 'bmw-m2-g87-free-125412579b244790b27b2a7839527c6e', 'wheels replaced.'),
        ccByCar('2021 BMW M3 Competition (G80)', 'DisneyCars', '2021-bmw-m3-competition-g80-a9027a26b7ee4da4b564d939b6c27559', 'wheels replaced.'),
        ccByCar('BMW m3 Competition Tourning [g81]', 'Black Snow', 'bmw-m3-competition-tourning-g81-e2a4d608b2034e639c7eb6a2ef8dbfa1', 'wheels replaced.'),
        ccByCar('BMW M8 F92 Coupé Competition', 'kevin (ケビン)', 'bmw-m8-f92-coupe-competition-25d5b4f6d13e4217afa09bbf89f8d993', 'wheels replaced.'),
        ccByCar('BMW X5M F95 + Facelifted Versions', 'ZapupaNekra', 'bmw-x5m-f95-facelifted-versions-2f4b104aae8f4b59b05683a2a144902d', 'only the facelift X5 M Competition parts kept, materials rebuilt, plates and engine bay removed, wheels replaced.'),
        ccByCar('BMW G90 M5', 'JUSTGAME', 'bmw-g90-m5-9dc9e5c88bec4faa94552fdd0b76ed21', 'body panels given their own paint material, wheels replaced.'),
        ccByCar('2026 BMW X3', 'tonielpro520', '2026-bmw-x3-73212a0045524ca0804b82b813847a94', 'tyres separated from the trim mesh, wheels replaced.')
      ]
    },
    {
      title: 'BMW M235i Gran Coupé (Sketchfab Standard licence)',
      body: [
        `"BMW M235i Gran Coupé" by KOElkast1007 (sketchfab.com/koelkastasbers). Source: ${SKETCHFAB}bmw-m235i-gran-coupe-23aea45df6da44fab8785df6c3b09ecd. Licence: Sketchfab Standard (sketchfab.com/licenses), which permits use within this project but not redistribution of the model file. This car is not offered in the configurator and stays off unless re-licensed. Changes: skeleton baked out, wheels replaced.`
      ]
    },
    {
      title: 'Studio lighting',
      body: [
        '"Studio Small 09" HDRI by Poly Haven (polyhaven.com/a/studio_small_09), CC0 (public domain). Used for reflections.'
      ]
    },
    {
      title: 'Corrections',
      body: [
        'If you are the author of one of these models and the credit or licence shown is wrong, or you would like it displayed differently, email [info@forgedsa.com] and we will correct it promptly.'
      ]
    }
  ]
};
