// node build.mjs : writes index.html + compositions/*.html from scenes.mjs (engine: ../lib/engine.mjs)
import path from 'node:path';
import { build } from '../lib/engine.mjs';
import { SCENES } from './scenes.mjs';
build({
  ROOT: path.dirname(new URL(import.meta.url).pathname), SCENES,
  cfg: { cardW: 560, cardFont: 48, cardOrder: ['bl', 'br', 'tr', 'tl'], defaultSeam: 'blur', musicVolume: 0.1,
    end: { tag: 'Five tabs.<br>Edit, then save.', url: 'Sign in at /admin', pic: 'hero.png', top: 300 } }
});
