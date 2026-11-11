# Tutorial videos (HyperFrames)

Two educational, narrated how-it-works films, made with [HyperFrames](https://hyperframes.heygen.com) (HTML + GSAP rendered frame by frame):

| Project | What it teaches | Length |
|---|---|---|
| `m2-tutorial/` | The customer configurator, from the welcome carousel through every car, then a BMW M2 CS in Black Sapphire on FF-1 (Liquid Metal, 21"): paint, wheels (monoblock vs two/three-piece), size and fitment, finish, camera, summary, share/PDF/enquiry, the wheel page, more options | about 6 min 45 s |
| `admin-tutorial/` | The dealership admin (`/admin`): sign-in and allowlist, the five tabs, hiding vs deleting, car details/paints/3D model, wheel images and models, sizes and prices, dearer finishes, finishes and paints, adding items, enquiries | about 5 min 35 s |

Everything on screen is a real capture of the running app, never a redraw. The cursor, gold ring and purpose cards are placed from the
measured box of each real control (`assets/shots/manifest.json`).

## How it is built

- `lib/engine.mjs`: the shared scene engine. A project's `scenes.mjs` is the whole film as a table (the narration `vo`, which real control
  each beat points at, the card wording, how each scene enters); `build.mjs` runs the engine and writes `index.html` + `compositions/*.html`.
- **Seams** (every scene says how it enters): `iris` opens from the click that caused the new screen, `zoom` pushes through the clicked
  control, `blur` resolves out of a blur on the same stage, `dip` darkens then cuts, `cut`. Scenes overlap through a seam, the picture
  moves first and the voice starts after it, a whoosh sits mid-seam, a soft click on every real click, a quiet music bed under the voice.
- `lib/voice.py`: the narration, OpenAI `gpt-audio` through OpenRouter, voice `marin`, directed as a calm teacher (not a presenter).
  It retries a take until the spoken transcript equals the script.
- `lib/music.py`: an instrumental bed from Google Lyria 3 Pro through OpenRouter (takes joined with crossfades).
- `lib/extract-vo.mjs`: writes `assets/voice/src/<id>.txt` from the `vo` strings in `scenes.mjs`.

## Rebuild a film

```bash
bunx vite --host 127.0.0.1 --port 5173                                   # dev server (other shell)

# 1. screens (SwiftShader, no GPU: ~15 min for the configurator, ~2.5 min for the admin)
node scripts/video/capture-tutorial.cjs video/m2-tutorial/assets/shots   # WHEEL / FINISH / RIM_ID env choose the build
bun run scripts/video/admin-fixture.ts > video/admin-tutorial/assets/shots/fixtures.json
node scripts/video/capture-admin.cjs   video/admin-tutorial/assets/shots
# hero still (end card): scripts/render/shoot.cjs, car 5, paint 3, wheel sixnine_ff1, finish liquid_metal, size 21", view frontThreeQuarter, q "&look=stage", 1920x1080 -> assets/shots/hero.png

# 2. narration, music, sounds (inside the project folder)
cd video/m2-tutorial                    # or admin-tutorial
node ../lib/extract-vo.mjs && python3 ../lib/voice.py --all
python3 ../lib/music.py 420 assets/music.mp3
#   assets/sfx/click.wav, whoosh-1.wav, whoosh-2.wav: npx hyperframes media-use resolve --type sfx --intent "..." then trim/normalise with ffmpeg

# 3. build, check, render
node build.mjs && npx hyperframes check && npx hyperframes render --output renders/<name>.mp4
```

## Notes

- **The admin film never touches the live database or any real account.** `capture-admin.cjs` runs the real admin page with a stubbed demo
  session and answers every Supabase call from `admin-fixture.ts` (the bundled catalogue plus four fictional `example.com` enquiries,
  labelled "sample data" on screen). Writes are swallowed locally.
- The configurator capture stubs Supabase writes too, so no lead (each one emails the owner) is created.
- Liquid Metal looks like bright brushed metal rather than a mirror in these renders: the cloud has no GPU and the stage look is dark.
  Check the finish on a real device.
- The narration has not been listened to by the person who built it (a cloud session has no audio output): check it by ear.
- Generated screens, audio and renders are gitignored (large, reproducible).
