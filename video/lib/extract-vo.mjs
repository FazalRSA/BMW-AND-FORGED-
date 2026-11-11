// Writes assets/voice/src/<id>.txt from the `vo` strings in scenes.mjs (the script that tools/voice.py then speaks).
//   node ../lib/extract-vo.mjs
import fs from 'node:fs'; import path from 'node:path';
const root = process.cwd(); // run inside a project folder
const src = fs.readFileSync(path.join(root, 'scenes.mjs'), 'utf8');
fs.mkdirSync(path.join(root, 'assets/voice/src'), { recursive: true });
const re = /id: '([a-z]\d\d)'[\s\S]*?vo:\s*"((?:[^"\\]|\\.)*)"/g; let m, n = 0;
while ((m = re.exec(src))) { fs.writeFileSync(path.join(root, 'assets/voice/src', m[1] + '.txt'), m[2].replace(/\\"/g, '"')); n++; }
console.log(`${n} voice-over lines written`);
