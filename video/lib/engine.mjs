/**
 * Shared scene engine for the tutorial films (video/m2-tutorial, video/admin-tutorial).
 *
 * A project's build.mjs calls build({ ROOT, SCENES, cfg }). From the scene table, the capture manifest
 * (assets/shots/manifest.json: where each real control is on screen) and the voice timing
 * (assets/voice/meta.json) it writes compositions/<id>.html and index.html.
 *
 * Stitching (the seams between scenes):
 *   - every scene says how it ENTERS: seam: 'iris' | 'zoom' | 'blur' | 'dip' | 'cut'
 *       iris  opens from the point the previous scene clicked (a click is the cause of the new screen)
 *       zoom  the previous scene pushes through the clicked control while the new one settles from slightly large
 *       blur  the new scene resolves out of a blur over the old one: the stage never cuts (same app, new view)
 *       dip   the old frame darkens for 3 frames, then a hard cut
 *       cut   hard cut
 *   - iris / zoom / blur overlap the scenes (OVERLAP seconds), so the picture is already moving when the voice starts
 *     (the voice starts LEAD after the scene's own start: picture first, then sound)
 *   - whoosh on the iris and zoom seams (two takes, alternating), a soft click on every real click, music ducked low
 *
 * Everything on screen is a function of timeline time (no random, no timers): see SPEC.md in each project.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const W = 1920, H = 1080;
const OVERLAP = { iris: 0.5, zoom: 0.6, blur: 0.45, dip: 0, cut: 0 };
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function build({ ROOT, SCENES, cfg = {} }) {
  const C = {
    cardW: 700, cardFont: 58, cardOrder: ['tl', 'tr', 'br', 'bl'], push: 1.025, wps: 2.35, tail: 0.9, minBeatGap: 1.7,
    musicVolume: 0.1, endHold: 0, ...cfg
  };
  const manifestPath = path.join(ROOT, 'assets/shots/manifest.json');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (e) { throw new Error(`cannot read ${manifestPath} (run the capture scripts first): ${e.message}`); }
  const vmPath = path.join(ROOT, 'assets/voice/meta.json');
  const voiceMeta = fs.existsSync(vmPath) ? JSON.parse(fs.readFileSync(vmPath, 'utf8')) : {};
  const has = (f) => fs.existsSync(path.join(ROOT, f));
  const dur = (f) => { try { return +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(ROOT, f)]).toString().trim(); } catch { return 0.8; } };

  const FONT = `
@font-face { font-family: 'Satoshi'; src: url('assets/fonts/satoshi-500.woff2') format('woff2'); font-weight: 500; }
@font-face { font-family: 'Satoshi'; src: url('assets/fonts/satoshi-700.woff2') format('woff2'); font-weight: 700; }
@font-face { font-family: 'Satoshi'; src: url('assets/fonts/satoshi-900.woff2') format('woff2'); font-weight: 900; }`;

  // ---- timing -------------------------------------------------------------------------------------
  const wordsOf = (s, lead) => {
    const m = voiceMeta[s.id];
    if (m?.words?.length) return m.words.map((w) => ({ ...w, start: w.start + lead, end: w.end + lead }));
    return s.vo.split(/\s+/).map((t, i) => ({ text: t, start: lead + i / C.wps, end: lead + (i + 1) / C.wps }));
  };
  const voiceEnd = (s, lead) => (voiceMeta[s.id]?.duration ? lead + voiceMeta[s.id].duration : lead + s.vo.split(/\s+/).length / C.wps);
  function resolveBeats(s, lead) {
    const ws = wordsOf(s, lead); let from = 0; let prev = lead - 1.2;
    return s.beats.map((b) => {
      let idx = ws.findIndex((w, k) => k >= from && norm(w.text).startsWith(norm(b.at)));
      if (idx < 0) { console.warn(`! ${s.id}: anchor "${b.at}" not found after word ${from}`); idx = Math.min(ws.length - 1, from); }
      from = idx + 1;
      const t = Math.max(prev + (b.card === false ? 1.0 : C.minBeatGap), ws[idx].start + 0.05);
      prev = t;
      return { ...b, t };
    });
  }
  const boxOf = (b) => {
    if (b.box) { const [x, y, w, h] = b.box; return { x, y, w, h }; }
    if (b.ref) { const bb = manifest[b.ref[0]]?.boxes?.[b.ref[1]]; if (bb) return bb; console.warn(`! no box for ${b.ref.join('.')}`); }
    return null;
  };
  const centre = (bx) => [Math.round(bx.x + bx.w / 2), Math.round(bx.y + bx.h / 2)];
  function cardRect(b, bx, h) {
    const slots = { bl: [72, H - 72 - h], br: [W - 72 - C.cardW, H - 72 - h], tl: [72, 140], tr: [W - 72 - C.cardW, 140] };
    const order = b.pos ? [b.pos] : C.cardOrder;
    const hit = (s) => bx && !(s[0] + C.cardW < bx.x - 40 || s[0] > bx.x + bx.w + 40 || s[1] + h < bx.y - 40 || s[1] > bx.y + bx.h + 40);
    return slots[order.find((k) => !hit(slots[k])) || order[0]];
  }

  // ---- plan: lead, beats, length, seam of every scene ----------------------------------------------
  const plan = SCENES.map((s, i) => {
    const seam = i === 0 ? 'cut' : s.seam || C.defaultSeam || 'blur';
    const ov = OVERLAP[seam];
    const lead = Math.max(0.5, ov + 0.1);
    const beats = s.kind === 'end' ? [] : resolveBeats(s, lead);
    const last = beats.length ? beats[beats.length - 1].t + 1.6 : 0;
    const length = +Math.max(voiceEnd(s, lead) + C.tail, last, 3).toFixed(2);
    return { s, seam, ov, lead, beats, length };
  });
  // where the previous scene clicked last: the point an iris opens from and a zoom pushes through
  const exitPoint = (p) => {
    const withBox = [...p.beats].reverse().find((b) => b.click && boxOf(b)) || [...p.beats].reverse().find((b) => boxOf(b));
    return withBox ? centre(boxOf(withBox)) : [960, 540];
  };

  // ---- scene files --------------------------------------------------------------------------------
  function sceneDoc(i) {
    const { s, beats, length: L, seam, ov, lead } = plan[i];
    const next = plan[i + 1];
    const id = s.id;
    if (s.kind === 'end') return endDoc(s, L, seam, ov, i > 0 ? exitPoint(plan[i - 1]) : [960, 540]);
    const imgs = [...new Set([s.base, ...beats.flatMap((b) => [b.pre, b.show]).filter(Boolean)])];
    const file = (n) => (n === 'hero' ? 'assets/shots/hero.png' : `assets/shots/${manifest[n].file}`);
    const [fx, fy] = s.focus || [960, 540];
    const tw = []; const sfx = [];
    let html = `<div id="${id}-cam" class="clip" data-start="0" data-duration="${L}" data-track-index="0"><div id="${id}-fx" class="fx"><div id="${id}-cami" class="cam">`;
    imgs.forEach((n, k) => { html += `<img id="${id}-img-${k}" class="shot" src="${file(n)}" alt="" style="opacity:${k === 0 ? 1 : 0}">`; });
    beats.forEach((b, k) => {
      const bx = boxOf(b); if (!bx) return; const pad = 12;
      html += `<div id="${id}-ring-${k}" class="ring" style="left:${bx.x - pad}px;top:${bx.y - pad}px;width:${bx.w + pad * 2}px;height:${bx.h + pad * 2}px"></div>`;
      if (b.click) { const [cx, cy] = centre(bx); html += `<div id="${id}-click-${k}" class="click" style="left:${cx - 60}px;top:${cy - 60}px"></div>`; }
    });
    html += `<svg id="${id}-cur" class="cur" viewBox="0 0 24 24" width="40" height="40"><path d="M3 2 L3 19 L8 14.5 L11.2 21.5 L14 20.3 L10.9 13.4 L17.5 13 Z" fill="#fff" stroke="#0b0b0c" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    html += `</div></div></div>`;
    if (next?.seam === 'dip') html += `<div id="${id}-dip" class="clip dip" data-start="${(L - 0.2).toFixed(2)}" data-duration="0.2" data-track-index="3"></div>`;

    // camera push on the picture (a push on a real UI screen crops its edges: keep it small, about a point near the centre)
    const hero = s.kind === 'hero';
    const ox = hero ? fx : Math.round(960 + (fx - 960) * 0.25), oy = hero ? fy : Math.round(540 + (fy - 540) * 0.25);
    tw.push(`gsap.set("#${id}-cami",{transformOrigin:"${ox}px ${oy}px"});`);
    const pushTo = hero ? 1.1 : s.push ?? C.push;
    if (pushTo !== 1) tw.push(`tl.fromTo("#${id}-cami",{scale:1},{scale:${pushTo},duration:${L},ease:"sine.inOut"},0);`);

    // how this scene enters
    const [ex, ey] = i > 0 ? exitPoint(plan[i - 1]) : [960, 540];
    if (seam === 'blur') tw.push(`tl.fromTo("#${id}-fx",{opacity:0,filter:"blur(10px)"},{opacity:1,filter:"blur(0px)",duration:${ov},ease:"power2.out"},0);`);
    if (seam === 'iris') tw.push(`tl.fromTo("#${id}-fx",{clipPath:"circle(0px at ${ex}px ${ey}px)"},{clipPath:"circle(2400px at ${ex}px ${ey}px)",duration:${ov},ease:"power2.inOut"},0);`);
    if (seam === 'zoom') {
      tw.push(`gsap.set("#${id}-fx",{transformOrigin:"${ex}px ${ey}px"});`);
      tw.push(`tl.fromTo("#${id}-fx",{opacity:0,scale:1.14,filter:"blur(8px)"},{opacity:1,scale:1,filter:"blur(0px)",duration:${ov},ease:"power3.out"},0);`);
    }
    // how it leaves (only a zoom needs the old scene to move: push through the clicked control as the new one resolves)
    if (next?.seam === 'zoom') {
      const [px, py] = exitPoint(plan[i]);
      const o = OVERLAP.zoom;
      tw.push(`tl.to("#${id}-fx",{scale:1.5,filter:"blur(7px)",transformOrigin:"${px}px ${py}px",duration:${o},ease:"power3.in"},${(L - o).toFixed(2)});`);
    }
    if (next?.seam === 'dip') tw.push(`tl.fromTo("#${id}-dip",{opacity:0},{opacity:0.45,duration:0.12,ease:"none"},${(L - 0.2).toFixed(2)});`);

    // beats: cursor, ring, click, picture swaps
    let cx = W * 0.5, cy = H + 60, shown = 0, curPlaced = false, z = 1;
    beats.forEach((b, k) => {
      const bx = boxOf(b); const t = b.t;
      if (bx) {
        const [tx, ty] = centre(bx);
        if (!curPlaced) { tw.push(`gsap.set("#${id}-cur",{x:${cx},y:${cy},opacity:0});`); curPlaced = true; }
        tw.push(`tl.to("#${id}-cur",{x:${tx},y:${ty},opacity:1,duration:0.8,ease:"power3.inOut"},${Math.max(0.1, t - 0.8).toFixed(2)});`);
        const ringEnd = t + (beats[k + 1] ? Math.max(0.5, Math.min(1.4, beats[k + 1].t - t - 1.0)) : 1.1);
        tw.push(`tl.fromTo("#${id}-ring-${k}",{opacity:0,scale:1.12},{opacity:1,scale:1,duration:0.25,ease:"power4.out"},${(t - 0.3).toFixed(2)});`);
        tw.push(`tl.to("#${id}-ring-${k}",{opacity:0,duration:0.25,ease:"power2.in"},${ringEnd.toFixed(2)});`);
        if (b.click) {
          tw.push(`tl.fromTo("#${id}-click-${k}",{opacity:1,scale:0.3},{opacity:0,scale:1,duration:0.4,ease:"power2.out"},${t.toFixed(2)});`);
          tw.push(`tl.to("#${id}-cur",{scale:0.86,duration:0.08,ease:"power1.in",transformOrigin:"3px 2px"},${(t - 0.02).toFixed(2)});`);
          tw.push(`tl.to("#${id}-cur",{scale:1,duration:0.14,ease:"power2.out",transformOrigin:"3px 2px"},${(t + 0.08).toFixed(2)});`);
          if (has('assets/sfx/click.wav')) sfx.push({ id: `${id}-clk-${k}`, src: 'assets/sfx/click.wav', at: t - 0.04, vol: 0.9 });
        }
        cx = tx; cy = ty;
      }
      const swap = (name, at) => {
        const kk = imgs.indexOf(name); if (kk === shown) return;
        z += 1;
        tw.push(`tl.set("#${id}-img-${kk}",{zIndex:${z},opacity:0},${at.toFixed(2)});`);
        tw.push(`tl.to("#${id}-img-${kk}",{opacity:1,duration:0.3,ease:"power1.inOut"},${at.toFixed(2)});`);
        tw.push(`tl.set("#${id}-img-${shown}",{opacity:0},${(at + 0.32).toFixed(2)});`);
        shown = kk;
      };
      if (b.pre) swap(b.pre, Math.max(0.05, t - 0.9));
      if (b.show) swap(b.show, t + 0.1);
    });

    // cards (function name + what it is for; one per beat that has one, until the next starts)
    let cards = '';
    const cb = beats.map((_, k) => k).filter((k) => beats[k].card !== false && (beats[k].label || beats[k].text));
    cb.forEach((k, n) => {
      const b = beats[k]; const bx = boxOf(b);
      const nextT = n + 1 < cb.length ? beats[cb[n + 1]].t - 0.5 : L - 0.25;
      const show = Math.max(0, b.t - 0.55); const end = Math.max(show + 1.2, nextT);
      const [x, y] = cardRect(b, bx, 190);
      cards += `<div id="${id}-card-${k}" class="clip card-host" data-start="${show.toFixed(2)}" data-duration="${(end - show).toFixed(2)}" data-track-index="2" style="left:${x}px;top:${y}px"><div id="${id}-cardi-${k}" class="card"><div class="eye">${esc(b.label || '')}</div><div class="line">${esc(b.text || '')}</div></div></div>`;
      tw.push(`tl.fromTo("#${id}-cardi-${k}",{opacity:0,x:-24},{opacity:1,x:0,duration:0.33,ease:"power4.out"},${(show + 0.05).toFixed(2)});`);
      tw.push(`tl.to("#${id}-cardi-${k}",{opacity:0,x:-10,duration:0.2,ease:"power2.in"},${(end - 0.24).toFixed(2)});`);
    });

    const doc = `<template>
  <style>${FONT}
    #root { position: absolute; inset: 0; overflow: hidden; }
    #root .fx { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
    #root .cam { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
    #root .shot { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; }
    #root .ring { position: absolute; border: 4px solid #CF9F52; border-radius: 14px; opacity: 0; box-shadow: 0 0 0 2px rgba(11,11,12,.55); box-sizing: border-box; }
    #root .click { position: absolute; width: 120px; height: 120px; border: 4px solid #CF9F52; border-radius: 50%; opacity: 0; }
    #root .cur { position: absolute; left: 0; top: 0; opacity: 0; filter: drop-shadow(0 1.5px 1.5px rgba(0,0,0,.5)); }
    #root .dip { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; background: #000; opacity: 0; }
    #root .card-host { position: absolute; width: ${C.cardW}px; }
    #root .card { background: #0b0b0c; border-left: 10px solid #CF9F52; border-radius: 6px; padding: 22px 28px 26px 26px; box-shadow: 0 24px 60px rgba(0,0,0,.45); font-family: 'Satoshi', sans-serif; }
    #root .eye { color: #CF9F52; font-weight: 700; font-size: 28px; letter-spacing: .16em; }
    #root .line { margin-top: 10px; color: #fff; font-weight: 900; font-size: ${C.cardFont}px; line-height: 1.06; letter-spacing: -.015em; }
  </style>
  <div id="root" data-composition-id="${id}" data-width="${W}" data-height="${H}">
    ${html}${cards}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${tw.join('\n    ')}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`;
    return { doc, sfx };
  }

  function endDoc(s, L, seam, ov, [ex, ey]) {
    const id = s.id; const e = C.end;
    const wm = has('assets/brand/forgedsa-wordmark.svg') ? 'assets/brand/forgedsa-wordmark.svg' : 'assets/brand/forgedsa-wordmark.png';
    const enter = seam === 'blur' ? `tl.fromTo("#${id}-fx",{opacity:0,filter:"blur(10px)"},{opacity:1,filter:"blur(0px)",duration:${ov},ease:"power2.out"},0);`
      : seam === 'iris' ? `tl.fromTo("#${id}-fx",{clipPath:"circle(0px at ${ex}px ${ey}px)"},{clipPath:"circle(2400px at ${ex}px ${ey}px)",duration:${ov},ease:"power2.inOut"},0);` : '';
    const doc = `<template>
  <style>${FONT}
    #root { position: absolute; inset: 0; overflow: hidden; font-family: 'Satoshi', sans-serif; }
    #root .fx { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; background: #0b0b0c; }
    #root .pic-host { position: absolute; left: 820px; top: 0; width: 1100px; height: 1080px; overflow: hidden; }
    #root .pic { position: absolute; left: -274px; top: 108px; width: 1728px; height: 972px; }
    #root .wm-host { position: absolute; left: 110px; top: ${e.top ?? 260}px; width: 640px; }
    #root .wm { width: 640px; display: block; }
    #root .rule { position: absolute; left: 110px; top: ${(e.top ?? 260) + 140}px; width: 240px; height: 10px; background: #CF9F52; }
    #root .tag-host { position: absolute; left: 110px; top: ${(e.top ?? 260) + 200}px; width: 700px; }
    #root .tag { color: #fff; font-weight: 900; font-size: 60px; line-height: 1.08; letter-spacing: -.02em; }
    #root .url-host { position: absolute; left: 110px; top: 800px; }
    #root .url { color: #fff; font-weight: 700; font-size: 44px; letter-spacing: .02em; border-bottom: 8px solid #FF5500; padding-bottom: 8px; display: inline-block; }
  </style>
  <div id="root" data-composition-id="${id}" data-width="${W}" data-height="${H}">
    <div id="${id}-cam" class="clip" data-start="0" data-duration="${L}" data-track-index="0"><div id="${id}-fx" class="fx">
      <div id="${id}-pic" class="pic-host" data-layout-allow-overflow><img id="${id}-pici" class="pic" src="assets/shots/${e.pic ?? 'hero.png'}" alt=""></div>
      <div id="${id}-wm" class="wm-host"><img id="${id}-wmi" class="wm" src="${wm}" alt="FORGEDSA"></div>
      <div id="${id}-rule" class="rule"></div>
      <div id="${id}-tag" class="clip tag-host" data-hold data-start="0" data-duration="${L}" data-track-index="2"><div id="${id}-tagi" class="tag">${e.tag}</div></div>
      <div id="${id}-url" class="clip url-host" data-hold data-start="0" data-duration="${L}" data-track-index="3"><div id="${id}-urli" class="url">${e.url}</div></div>
    </div></div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${enter}
    tl.fromTo("#${id}-pici",{opacity:0,scale:1.0,transformOrigin:"50% 100%"},{opacity:1,scale:1.04,duration:${L},ease:"sine.out"},0);
    tl.fromTo("#${id}-wmi",{x:-80,opacity:0},{x:0,opacity:1,duration:0.6,ease:"power4.out"},0.3);
    tl.fromTo("#${id}-rule",{scaleX:0,transformOrigin:"0% 50%"},{scaleX:1,duration:0.5,ease:"power3.out"},0.7);
    tl.fromTo("#${id}-tagi",{x:-40,opacity:0},{x:0,opacity:1,duration:0.45,ease:"power4.out"},1.0);
    tl.fromTo("#${id}-urli",{opacity:0},{opacity:1,duration:0.3,ease:"power2.out"},1.8);
    window.__timelines["${id}"] = tl;
  </script>
</template>
`;
    return { doc, sfx: [] };
  }

  // ---- assemble -----------------------------------------------------------------------------------
  fs.mkdirSync(path.join(ROOT, 'compositions'), { recursive: true });
  const hosts = []; const audios = []; const log = [];
  let end = 0; let whoosh = 0;
  plan.forEach((p, i) => {
    const start = +(i === 0 ? 0 : end - p.ov).toFixed(2);
    const { doc, sfx } = sceneDoc(i);
    fs.writeFileSync(path.join(ROOT, `compositions/${p.s.id}.html`), doc);
    hosts.push(`    <div id="${p.s.id}" data-composition-id="${p.s.id}" data-composition-src="compositions/${p.s.id}.html" data-start="${start}" data-duration="${p.length}" data-track-index="1" data-track-kind="graphics" data-width="${W}" data-height="${H}" style="z-index:${i + 1}"></div>`);
    if (has(`assets/voice/${p.s.id}.wav`)) audios.push(`    <audio id="vo-${p.s.id}" src="assets/voice/${p.s.id}.wav" data-start="${(start + p.lead).toFixed(2)}" data-duration="${(voiceMeta[p.s.id]?.duration ?? 1).toFixed(2)}" data-track-index="5" data-volume="1"></audio>`);
    for (const a of sfx) audios.push(`    <audio id="${a.id}" src="${a.src}" data-start="${(start + a.at).toFixed(2)}" data-duration="0.37" data-track-index="6" data-volume="${a.vol}"></audio>`);
    if ((p.seam === 'iris' || p.seam === 'zoom' || p.seam === 'blur') && has('assets/sfx/whoosh-1.wav')) {
      // the whoosh's loudest moment sits in the middle of the seam (take 1 peaks 0.16 s in, take 2 0.5 s in)
      const n = (whoosh++ % 2) + 1; const f = `assets/sfx/whoosh-${n}.wav`; const peak = n === 1 ? 0.16 : 0.5;
      if (has(f)) audios.push(`    <audio id="wh-${p.s.id}" src="${f}" data-start="${Math.max(0, start + p.ov / 2 - peak).toFixed(2)}" data-duration="${Math.min(1.5, dur(f)).toFixed(2)}" data-track-index="7" data-volume="${p.seam === 'blur' ? 0.35 : 0.55}"></audio>`);
    }
    end = +(start + p.length).toFixed(2);
    log.push(`${p.s.id}  ${String(start.toFixed(1)).padStart(6)}s  ${p.length.toFixed(1).padStart(5)}s  ${p.seam.padEnd(5)} beats ${p.beats.map((b) => b.t.toFixed(1)).join(', ')}`);
  });
  const total = end;
  if (has('assets/music.mp3')) audios.push(`    <audio id="bed" src="assets/music.mp3" data-start="0" data-duration="${total}" data-track-index="4" data-volume="${C.musicVolume}" data-fade-in="1.5" data-fade-out="4"></audio>`);
  const index = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #000; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1920" data-height="1080">
${hosts.join('\n')}
${audios.join('\n')}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, 'index.html'), index);
  console.log(log.join('\n'));
  console.log(`total ${total}s (${(total / 60).toFixed(1)} min)  voice meta: ${Object.keys(voiceMeta).length ? 'yes' : 'estimated'}  music: ${has('assets/music.mp3') ? 'yes' : 'no'}`);
}
