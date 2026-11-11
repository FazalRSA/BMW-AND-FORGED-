// The configurator tutorial: an educational walkthrough, in the order a visitor meets things.
// vo = the narration (what is said); label/text = the function name and what it is for, in different words (SPEC.md).
// ref = [captured screen, control] (its real box); box = [x, y, w, h] where a control was not captured (1920x1080).
const CAR = [640, 230, 1100, 470]; // the car on the welcome stage

export const SCENES = [
  { id: 'c01', base: 'welcome-m2', focus: [1100, 600],
    vo: "This is the Forged S A configurator, a tool for trying forged wheels on a BMW M car before anything is fitted. In this video we'll go through every part of it, in order, beginning with the welcome screen. The car on stage is the one you'll configure, and each car is shown in one of its own factory colours. This first one is the BMW M two CS, a compact coupe with a three-litre twin-turbo straight-six, here in Portimao Blue Metallic. Now, the next car.",
    beats: [
      { at: 'configurator', label: 'FORGEDSA CONFIGURATOR', text: 'Forged wheels on a BMW M car', pos: 'tl' },
      { at: 'welcome', label: 'WELCOME SCREEN', text: 'Every visit starts here', pos: 'tl' },
      { at: 'compact', box: CAR, label: 'BMW M2 CS', text: 'Coupe, inline-six engine', pos: 'tl' },
      { at: 'next', ref: ['welcome-m2', 'next'], label: 'ARROWS', text: 'Move to the next car', click: true, pos: 'tl' }
    ] },
  { id: 'c02', seam: 'iris', base: 'welcome-m4', focus: [1100, 600],
    vo: "Second is the BMW M four CS, also a coupe with a three-litre straight-six, here in São Paulo Yellow. Each car has its own palette of factory colours and its own wheel fitment, so the choices you'll see later depend on which car you pick. On to the next one.",
    beats: [
      { at: 'Second', box: CAR, label: 'BMW M4 CS', text: 'Coupe, inline-six engine', pos: 'tl' },
      { at: 'palette', label: 'PER-CAR CHOICES', text: 'Own colours, own fitment', pos: 'tl' },
      { at: 'next', ref: ['welcome-m4', 'next'], click: true, card: false }
    ] },
  { id: 'c03', seam: 'blur', base: 'welcome-m5', focus: [1100, 600],
    vo: "Third is the BMW M five, a saloon with a four-point-four-litre twin-turbo V eight and a hybrid system, in Fire Red Metallic. Notice that the lighting and framing are the same for every car. Next, the last one.",
    beats: [
      { at: 'Third', box: CAR, label: 'BMW M5', text: 'Saloon, V8 hybrid', pos: 'tl' },
      { at: 'Notice', label: 'SAME STAGE', text: 'Same light, same framing', pos: 'tl' },
      { at: 'Next', ref: ['welcome-m5', 'next'], click: true, card: false }
    ] },
  { id: 'c04', seam: 'iris', base: 'welcome-m5t', focus: [1100, 600],
    vo: "The last car is the M five Touring: the same V eight hybrid drivetrain as the saloon, in an estate body, shown in Frozen Pure Grey Metallic. Frozen is one of BMW's matte paint families. You can move between the cars with the arrow buttons, the dots underneath, the keyboard arrows, the scroll wheel, or by swiping on a phone.",
    beats: [
      { at: 'last', box: CAR, label: 'BMW M5 TOURING', text: 'Estate, V8 hybrid', pos: 'tl' },
      { at: 'Frozen', label: 'FROZEN PAINT', text: 'A matte finish family', pos: 'tl' },
      { at: 'arrow', box: [1586, 980, 262, 44], label: 'MOVING ON', text: 'Arrows, dots, keys, scroll, swipe', pos: 'tl' }
    ] },
  { id: 'c05', seam: 'blur', base: 'welcome-m5t', focus: [600, 800],
    vo: "Before you enter, the region picker sets your language and currency. Prices are stored in US dollars and converted, so South Africa shows rand and the United Kingdom shows pounds. I'll jump back to the M two with the dots, then press Enter, which opens the configurator on the car that's on stage.",
    beats: [
      { at: 'region', ref: ['welcome-m2', 'region'], label: 'REGION', text: 'Language and currency', pos: 'tl' },
      { at: 'dollars', label: 'PRICES', text: 'Stored in US dollars', pos: 'tl' },
      { at: 'jump', ref: ['welcome-m2', 'dots'], label: 'DOTS', text: 'Jump straight to a car', click: true, show: 'welcome-m2', pos: 'tl' },
      { at: 'Enter', ref: ['welcome-m2', 'enter'], label: 'ENTER', text: 'Opens the configurator', click: true, pos: 'tl' }
    ] },
  { id: 'c06', seam: 'zoom', base: 'configure-overview', focus: [1700, 540],
    vo: "Now we're inside the configurator. The panel on the right is your build, and it has four parts: paint, wheels, wheel size and wheel finish. Whenever you change one, the car on the left updates straight away. The numbers across the top are the steps, and at the bottom is the price for a set of four wheels. We'll go through the steps in order, beginning with paint.",
    beats: [
      { at: 'panel', ref: ['configure-overview', 'panel'], label: 'YOUR BUILD', text: 'Four parts, one panel' },
      { at: 'numbers', ref: ['configure-overview', 'stepper'], label: 'STEPS', text: 'One for each part' },
      { at: 'price', ref: ['configure-overview', 'price'], label: 'LIVE PRICE', text: 'For a set of four wheels' },
      { at: 'beginning', ref: ['configure-overview', 'stepper'], label: 'STEP 1', text: 'Paint', click: true }
    ] },
  { id: 'c07', seam: 'iris', base: 'paint-step', focus: [1700, 500],
    vo: "Step one is paint. The colours are BMW's factory colours, sorted into families, and each car is only offered the ones in its own palette. That's why the M two shows more colours than the M four CS. Metallic paints have fine metal flakes in the clear coat, while Frozen paints are matte. I'll choose Black Sapphire, a deep metallic black.",
    beats: [
      { at: 'colours', ref: ['paint-step', 'panel'], label: 'FACTORY COLOURS', text: 'Sorted into families' },
      { at: 'Metallic', label: 'PAINT TYPES', text: 'Metallic has flake, Frozen is matte' },
      { at: 'choose', ref: ['paint-step', 'swatch'], label: 'BLACK SAPPHIRE', text: 'Metallic, paint code 475', click: true, show: 'paint-black' }
    ] },
  { id: 'c08', seam: 'blur', base: 'wheels-step', focus: [1700, 560],
    vo: "Step two is the wheels. The camera moves in on the wheel, and the list shows the real stock: six designs, each with its name and a starting price. The second line tells you how the wheel is built. A monoblock is machined from a single piece of forged aluminium. Two-piece and three-piece wheels are assembled from separate parts: a face, and one or two barrel sections. I'll choose the F F one, a two-piece wheel with a split five-spoke face.",
    beats: [
      { at: 'stock', ref: ['wheels-step', 'list'], label: 'WHEELS', text: 'Six designs from real stock' },
      { at: 'monoblock', ref: ['wheels-step', 'list'], label: 'MONOBLOCK', text: 'One forged piece of aluminium' },
      { at: 'assembled', ref: ['wheels-step', 'list'], label: 'TWO OR THREE PIECE', text: 'A face plus barrel sections' },
      { at: 'choose', ref: ['wheels-scrolled', 'row'], pre: 'wheels-scrolled', label: 'FF-1', text: 'Two-piece, split five-spoke', click: true, show: 'wheels-pick' }
    ] },
  { id: 'c09', seam: 'blur', base: 'wheels-pick', focus: [1700, 560],
    vo: "The info button opens the details for a wheel: how it's built, every size it comes in with the price for each, and its fitment. Fitment means the bolt pattern, the offset and the centre bore the wheel is made for, and they have to match the hubs on your car.",
    beats: [
      { at: 'info', ref: ['wheels-pick', 'info'], label: 'WHEEL DETAILS', text: 'Build, sizes, prices, fitment', click: true, show: 'wheel-info' },
      { at: 'Fitment', box: [690, 480, 540, 160], label: 'FITMENT', text: 'Bolt pattern, offset, centre bore' }
    ] },
  { id: 'c10', seam: 'blur', base: 'size-21', focus: [1700, 400],
    vo: "Step three is size: the wheel's diameter, in inches. A larger wheel has a shorter tyre sidewall, and each size shows its price for the set of four. The note underneath gives the car's own factory fitment. On the M two that's a nineteen-inch wheel at the front and a twenty-inch at the rear, with five bolts on a one-hundred-and-twelve millimetre circle. I'll pick twenty-one inch.",
    beats: [
      { at: 'diameter', box: [1489, 295, 403, 110], label: 'WHEEL SIZE', text: 'Diameter in inches' },
      { at: 'note', box: [1489, 415, 403, 80], label: 'FACTORY FITMENT', text: 'What the car was built for' },
      { at: 'pick', ref: ['size-21', 'size'], label: '21 INCH', text: 'Set price shown per size', click: true }
    ] },
  { id: 'c11', seam: 'iris', base: 'finish-pick', focus: [1700, 400],
    vo: "Step four is finish, the surface treatment on the wheel. Each design offers only the finishes it's made in. The F F one comes in Silver and Liquid Metal. Liquid Metal is a mirror-chrome finish with deep reflections, and it costs more than Silver, because a finish can carry its own price. I'll choose Liquid Metal.",
    beats: [
      { at: 'finish', box: [1489, 285, 403, 145], label: 'FINISH', text: 'The surface treatment' },
      { at: 'mirror', ref: ['finish-pick', 'finish'], label: 'LIQUID METAL', text: 'Mirror chrome, priced higher' },
      { at: 'choose', ref: ['finish-pick', 'finish'], click: true, card: false }
    ] },
  { id: 'c12', seam: 'blur', base: 'cam-front', focus: [960, 940],
    vo: "Now check the result from every angle. The camera buttons move between the front three-quarter view, the side, the rear, a close-up of the wheel, and a view from above. The turntable button rotates the car continuously, so you can look all the way round without touching anything. When you're done, open the summary.",
    beats: [
      { at: 'side', ref: ['cam-side', 'chip'], label: 'CAMERA', text: 'Five viewpoints', click: true, show: 'cam-side' },
      { at: 'rear', ref: ['cam-rear', 'chip'], click: true, show: 'cam-rear', card: false },
      { at: 'close-up', ref: ['cam-wheel', 'chip'], click: true, show: 'cam-wheel', card: false },
      { at: 'above', ref: ['cam-top', 'chip'], click: true, show: 'cam-top', card: false },
      { at: 'turntable', ref: ['turntable', 'turntable'], label: 'TURNTABLE', text: 'A continuous rotation', click: true, show: 'turntable' },
      { at: 'summary', ref: ['configure-overview', 'summaryIcon'], label: 'SUMMARY', text: 'The build on one page', click: true }
    ] },
  { id: 'c13', seam: 'zoom', base: 'summary-top', focus: [960, 540],
    vo: "The summary begins with stills of your exact build, rendered from the same model. Below them are the options you picked, and a second tab lists the car's standard features: the engine, power, torque, acceleration, factory fitment and bolt pattern.",
    beats: [
      { at: 'stills', box: [420, 290, 1080, 610], label: 'SUMMARY', text: 'Stills of your exact build' },
      { at: 'options', box: [414, 321, 690, 225], pre: 'summary-options', label: 'OPTIONS PICKED', text: 'Paint, wheel, size, finish' },
      { at: 'second', ref: ['summary-standard', 'tab'], label: 'STANDARD FEATURES', text: 'The car\'s own specification', click: true, show: 'summary-standard' }
    ] },
  { id: 'c14', seam: 'blur', base: 'summary-options', focus: [1500, 400],
    vo: "The price card shows the wheel set price in your currency. Enquire opens a short form that sends your build and your contact details to the team. Share gives you a configuration code that reopens exactly this build. The P D F button downloads a two-page spec sheet, after asking for your email and mobile number. And the notice at the bottom reminds you that these images are visualisations: the final specification and fitment are confirmed with the team.",
    beats: [
      { at: 'price', ref: ['summary-options', 'price'], label: 'PRICE', text: 'The wheel set, your currency' },
      { at: 'Enquire', ref: ['summary-options', 'enquire'], label: 'ENQUIRE', text: 'Sends your build to the team', click: true, show: 'enquire-modal' },
      { at: 'Share', ref: ['summary-options', 'share'], pre: 'summary-options', label: 'SHARE', text: 'A code that reopens the build', click: true, show: 'share-modal' },
      { at: 'P', ref: ['summary-options', 'pdf'], pre: 'summary-options', label: 'PDF', text: 'A two-page spec sheet' },
      { at: 'notice', box: [1172, 580, 304, 90], label: 'VISUALISATION', text: 'Final spec is confirmed with the team' }
    ] },
  { id: 'c15', seam: 'dip', base: 'rim-page', focus: [960, 540],
    vo: "Every wheel also has its own page, with a three-dimensional viewer that you can spin, in each finish it's made in. Back in the configurator, the three dots open more options: your region, a place to load a saved configuration using its code, your account and garage, which uses Google sign-in, and links to delivery, fitment and the terms.",
    beats: [
      { at: 'page', box: [60, 120, 1300, 840], label: 'WHEEL PAGE', text: 'Spin it in 3D, finish by finish' },
      { at: 'dots', box: [735, 78, 450, 930], pre: 'more-options', label: 'MORE OPTIONS', text: 'Region, saved codes, your account' }
    ] },
  { id: 'c16', kind: 'end', seam: 'blur',
    vo: "That's the whole journey. Choose a car, then the paint, the wheels, the size and the finish, check it from every angle, and keep the summary as a code, a P D F, or an enquiry.",
    beats: [] }
];
