// The dealership admin tutorial: an educational walkthrough of /admin, in the order a dealer meets things.
// vo = what is said; label/text = the function name and what it is for, in different words.
// Screens are real captures of the admin page (stubbed demo session, bundled catalogue, fictional sample enquiries).

export const SCENES = [
  { id: 'd01', base: 'login', focus: [960, 540],
    vo: "This video explains the dealership admin: the page where the catalogue behind the configurator is managed. That means the cars, the wheels with their sizes and prices, the finishes, the paints, and the enquiries customers send. It lives at slash admin, and it starts with a sign-in form. You sign in with an email and a password, and only emails on the allowlist are let through. An allowlist is simply a list of addresses the system trusts. If it's your first time, or you've forgotten your password, the link underneath emails you a one-time link to set a new one.",
    beats: [
      { at: 'sign-in', ref: ['login', 'form'], label: 'ADMIN SIGN-IN', text: 'Found at /admin', pos: 'bl' },
      { at: 'allowlist', ref: ['login', 'email'], label: 'ALLOWLIST', text: 'Only trusted emails get in', pos: 'bl' },
      { at: 'link', ref: ['login', 'forgot'], label: 'FIRST TIME?', text: 'Set or reset a password', click: true, show: 'login-reset', pos: 'bl' },
      { at: 'one-time', ref: ['login-reset', 'send'], label: 'ONE-TIME LINK', text: 'Sent to the admin email', pos: 'bl' }
    ] },
  { id: 'd02', seam: 'blur', base: 'cars-list', focus: [960, 300],
    vo: "Once you're signed in, you'll see five tabs: cars, wheels, finishes, paints and enquiries. The first four are the catalogue, the same data the configurator reads, and the fifth collects the leads. When you save a change in any tab, the configurator picks it up straight away.",
    beats: [
      { at: 'five', ref: ['cars-list', 'tabs'], label: 'FIVE TABS', text: 'Four catalogue, one for leads', pos: 'bl' },
      { at: 'save', label: 'SAVE', text: 'Live in the configurator', pos: 'bl' }
    ] },
  { id: 'd03', seam: 'blur', base: 'cars-list', focus: [400, 540],
    vo: "On the left is the list for that tab. Anything marked hidden is switched off for customers, but it's kept, so it can be switched back on later. Press New to create something, or pick an item to edit it. I'll open the M two.",
    beats: [
      { at: 'list', ref: ['cars-list', 'list'], label: 'THE LIST', text: 'Everything in the tab', pos: 'br' },
      { at: 'hidden', ref: ['cars-edit', 'hidden'], label: 'HIDDEN', text: 'Off for customers, never deleted', show: 'cars-edit', pos: 'br' },
      { at: 'New', ref: ['cars-list', 'newBtn'], pre: 'cars-list', label: 'NEW', text: 'Create a car, wheel, finish or paint', pos: 'br' },
      { at: 'M', ref: ['cars-edit', 'item'], label: 'OPEN AN ITEM', text: 'Click it in the list', click: true, show: 'cars-edit', pos: 'br' }
    ] },
  { id: 'd04', seam: 'iris', base: 'cars-edit', focus: [1100, 540],
    vo: "A car's details appear on the right: its name, badge and chassis code, the engine, power, torque and acceleration, and the factory wheel fitment. The configurator shows the engine, power and fitment on its summary page.",
    beats: [{ at: 'details', ref: ['cars-edit', 'form'], label: 'CAR DETAILS', text: 'Shown on the summary page', pos: 'bl' }] },
  { id: 'd05', seam: 'blur', base: 'cars-paints', focus: [1000, 540],
    vo: "Further down, you choose which factory paints the car is offered in, which is why each car's palette is different. If you tick none, the car is offered every visible paint.",
    beats: [{ at: 'choose', ref: ['cars-paints', 'field'], label: 'PAINTS PER CAR', text: 'Its own palette', pos: 'bl' }] },
  { id: 'd06', seam: 'blur', base: 'cars-model', focus: [1000, 540],
    vo: "Next is the car's 3D model, a G L B file. Uploading a new one replaces it. The rotation turns the model until the nose faces the camera, and the real length scales it to the true size of the car.",
    beats: [
      { at: 'model', ref: ['cars-model', 'field'], label: '3D MODEL', text: 'A GLB file, replaced by upload', pos: 'bl' },
      { at: 'rotation', ref: ['cars-model', 'rotation'], label: 'ROTATION', text: 'Nose towards the camera', pos: 'bl' },
      { at: 'length', ref: ['cars-model', 'length'], label: 'REAL LENGTH', text: 'Scales it to true size', pos: 'bl' }
    ] },
  { id: 'd07', seam: 'blur', base: 'cars-visible', focus: [1000, 700],
    vo: "At the bottom, the Visible box controls whether customers can see the item at all. Unticking it hides the car without deleting anything. Delete removes it for good, so it asks you to confirm first. And Save writes your changes to the database, which is what the configurator reads.",
    beats: [
      { at: 'Visible', ref: ['cars-visible', 'visible'], label: 'VISIBLE', text: 'Shown to customers, or not', pos: 'tl' },
      { at: 'Delete', ref: ['cars-visible', 'del'], label: 'DELETE', text: 'Permanent, so it asks first', pos: 'tl' },
      { at: 'Save', ref: ['cars-visible', 'save'], label: 'SAVE', text: 'Writes to the database', click: true, pos: 'tl' }
    ] },
  { id: 'd08', seam: 'iris', base: 'wheels-edit', focus: [1100, 540],
    vo: "The wheels tab works the same way. A wheel has a code, a name, a style such as monoblock or two-piece, and a rim picture. The configurator turns that picture into three-dimensional spokes automatically.",
    beats: [
      { at: 'code', ref: ['wheels-edit', 'form'], label: 'A WHEEL', text: 'Code, name, style, picture', pos: 'bl' },
      { at: 'picture', ref: ['wheels-edit', 'image'], label: 'RIM IMAGE', text: 'Becomes 3D spokes', pos: 'bl' }
    ] },
  { id: 'd09', seam: 'blur', base: 'wheels-model', focus: [1000, 540],
    vo: "For the best quality you can upload the manufacturer's own 3D file instead. If it's in a CAD format such as STEP, IGES, S T L or O B J, it's converted to G L B in your browser first. There's also a separate rear file, for staggered sets that use a different wheel at the back.",
    beats: [{ at: 'manufacturer', ref: ['wheels-model', 'field'], label: 'RIM 3D MODEL', text: 'The maker\'s own file', pos: 'bl' }] },
  { id: 'd10', seam: 'blur', base: 'wheels-sizes', focus: [1000, 540],
    vo: "Sizes and prices are set here. Only the sizes listed are offered to customers. Each price is for a full set of four wheels, and it's stored in US dollars, which is how the configurator can show every region its own currency.",
    beats: [{ at: 'Sizes', ref: ['wheels-sizes', 'field'], label: 'SIZES AND PRICES', text: 'A full set of four, in dollars', pos: 'bl' }] },
  { id: 'd11', seam: 'blur', base: 'wheels-finishes', focus: [1000, 540],
    vo: "Then you choose which finishes this wheel is made in. If a finish costs more, like Polished Face or Liquid Metal, its higher set price goes underneath. Leave it blank and that finish costs the same as the others.",
    beats: [
      { at: 'choose', ref: ['wheels-finishes', 'field'], label: 'FINISHES', text: 'Only those it is made in', pos: 'bl' },
      { at: 'costs', ref: ['wheels-finishes', 'dearer'], label: 'DEARER FINISHES', text: 'A higher set price', pos: 'tl' }
    ] },
  { id: 'd12', seam: 'blur', base: 'wheels-price-edit', focus: [1000, 400],
    vo: "To change a price, type the new figure and press Save. A green message confirms it, and the configurator reloads its catalogue, so the new price shows up straight away.",
    beats: [
      { at: 'type', ref: ['wheels-price-edit', 'price'], label: 'EDIT A PRICE', text: 'Type the new figure', pos: 'bl' },
      { at: 'Save', ref: ['wheels-price-edit', 'save'], label: 'SAVE', text: 'Writes and reloads', click: true, show: 'wheels-saved', pos: 'bl' },
      { at: 'green', ref: ['wheels-saved', 'message'], label: 'CONFIRMED', text: 'Saved, catalogue reloaded', pos: 'br' }
    ] },
  { id: 'd13', seam: 'iris', base: 'finishes-edit', focus: [1000, 540],
    vo: "Finishes and paints have their own tabs. Each has a colour, then three numbers describing how the surface behaves in light: how metallic it is, how rough, and how glossy its clear coat is. Those numbers are what make a finish look like the real coating on screen.",
    beats: [
      { at: 'colour', ref: ['finishes-edit', 'colour'], label: 'FINISHES', text: 'A colour, then how it reflects', pos: 'bl' },
      { at: 'metallic', ref: ['finishes-edit', 'metal'], label: 'METAL, ROUGH, GLOSS', text: 'Three numbers, 0 to 1', pos: 'bl' },
      { at: 'real', ref: ['paints-edit', 'type'], label: 'PAINTS', text: 'The same fields for colours', show: 'paints-edit', pos: 'bl' }
    ] },
  { id: 'd14', seam: 'blur', base: 'wheels-new', focus: [1000, 400],
    vo: "To add something new, press New and give it an ID. That's a short unique name with no spaces, because cars and wheels refer to each other by it. Then add the pictures or the 3D file, set the sizes, and save. The ID can't be changed afterwards.",
    beats: [{ at: 'ID', ref: ['wheels-new', 'id'], label: 'THE ID', text: 'Unique, and fixed once saved', pos: 'bl' }] },
  { id: 'd15', seam: 'iris', base: 'enquiries', focus: [1000, 540],
    vo: "Finally, the enquiries tab. Every enquiry form and every P D F download from the configurator is recorded here, newest first, with the customer's contact details and the exact build they chose. A badge marks anyone who asked for a fitment consultation. Reply opens an email to the customer, Open build reopens their configuration, the bin deletes the enquiry after a confirmation, and Export C S V gives you a spreadsheet. The names shown here are sample data.",
    beats: [
      { at: 'enquiries', ref: ['enquiries', 'count'], label: 'ENQUIRIES (SAMPLE DATA)', text: 'Newest first', pos: 'bl' },
      { at: 'exact', ref: ['enquiries', 'first'], label: 'THE BUILD', text: 'Exactly what they chose', pos: 'bl' },
      { at: 'Reply', box: [1407, 309, 115, 45], label: 'REPLY', text: 'Opens an email', pos: 'bl' },
      { at: 'Open', box: [1535, 309, 161, 45], label: 'OPEN BUILD', text: 'Reopens the configuration', pos: 'bl' },
      { at: 'bin', box: [1708, 309, 48, 45], label: 'DELETE', text: 'After a confirmation', pos: 'bl' },
      { at: 'Export', ref: ['enquiries', 'exportCsv'], label: 'EXPORT CSV', text: 'For a spreadsheet', pos: 'bl' }
    ] },
  { id: 'd16', kind: 'end', seam: 'blur',
    vo: "That's the admin: five tabs, a list, an editor, and Save. Anything you save here is what customers see in the configurator.",
    beats: [] }
];
