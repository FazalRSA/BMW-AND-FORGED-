#!/usr/bin/env python3
"""Instrumental music bed via OpenRouter (google/lyria-3-pro-preview, about $0.08 a track, auth injected by the proxy).

  python3 ../lib/music.py <seconds-needed> [out=assets/music.mp3]     # run inside a project folder

Each take is a ~2.5 minute instrumental; takes are generated until the length is covered and joined with a 4 s
crossfade. Quiet on purpose (the engine plays it at 10% under the voice).
"""
import base64, json, os, subprocess, sys

PROMPTS = [
    "Instrumental only, no vocals. A calm, warm, unobtrusive background track for an educational software walkthrough: soft felt piano and gentle pads, a light steady pulse, around 84 BPM, understated and focused, no drops, no big builds, easy to talk over. About two and a half minutes.",
    "Instrumental only, no vocals. A calm, warm background track for a how-it-works tutorial: mellow electric piano, soft warm bass and a brushed, quiet groove, around 88 BPM, steady and unhurried, no drops, no big builds, easy to talk over. About two and a half minutes.",
    "Instrumental only, no vocals. A gentle, focused background track for a product explainer: airy pads, a plucked guitar motif and a soft pulse, around 80 BPM, understated, no drops, no big builds, easy to talk over. About two and a half minutes.",
]

def take(prompt, path):
    body = {"model": "google/lyria-3-pro-preview", "modalities": ["text", "audio"], "stream": True,
            "messages": [{"role": "user", "content": prompt}]}
    p = subprocess.run(["curl", "-sS", "-N", "https://openrouter.ai/api/v1/chat/completions", "-H", "Content-Type: application/json",
                        "-d", json.dumps(body)], capture_output=True, text=True, timeout=290)
    if p.returncode != 0:
        raise SystemExit(f"music request failed (curl exit {p.returncode}): {p.stderr[:300]}")
    buf = b""
    for line in p.stdout.splitlines():
        if line.startswith("data:") and '"audio"' in line:
            for ch in json.loads(line[5:].strip()).get("choices", []):
                a = (ch.get("delta") or {}).get("audio") or {}
                if a.get("data"): buf += base64.b64decode(a["data"])
    if not buf: raise SystemExit("no audio returned: " + (p.stdout[:300] or p.stderr[:300]))
    open(path, "wb").write(buf)
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).decode())

def main():
    need = float(sys.argv[1]); out = sys.argv[2] if len(sys.argv) > 2 else "assets/music.mp3"
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    takes, total, i = [], 0.0, 0
    while total < need + 6 * len(takes):
        path = f"assets/.take{i}.mp3"; d = take(PROMPTS[i % len(PROMPTS)], path)
        print(f"take {i}: {d:.0f}s"); takes.append(path); total += d - 4 if i else d; i += 1
        if i > 5: break
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    for t in takes: cmd += ["-i", t]
    if len(takes) == 1: cmd += ["-c:a", "libmp3lame", "-b:a", "192k", out]
    else:
        f, last = [], "0:a"
        for k in range(1, len(takes)):
            f.append(f"[{last}][{k}:a]acrossfade=d=4:c1=tri:c2=tri[x{k}]"); last = f"x{k}"
        cmd += ["-filter_complex", ";".join(f), "-map", f"[{last}]", "-c:a", "libmp3lame", "-b:a", "192k", out]
    subprocess.run(cmd, check=True)
    for t in takes: os.remove(t)
    print("music:", out, subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).decode().strip(), "s")

main()
