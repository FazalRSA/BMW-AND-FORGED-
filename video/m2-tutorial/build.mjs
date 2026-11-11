// node build.mjs : writes index.html + compositions/*.html from scenes.mjs (engine: ../lib/engine.mjs)
import path from 'node:path';
import { build } from '../lib/engine.mjs';
import { SCENES } from './scenes.mjs';
build({
  ROOT: path.dirname(new URL(import.meta.url).pathname), SCENES,
  cfg: { cardW: 700, cardFont: 54, defaultSeam: 'blur', musicVolume: 0.1,
    end: { tag: 'Car, paint, wheels,<br>size, finish, summary.', url: 'www.forgedsa.com', pic: 'hero.png', top: 260 } }
});
