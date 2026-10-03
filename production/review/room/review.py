#!/usr/bin/env python3
"""Room review: render 262-281 s through the real harness, encode with the final mix, contact sheet, event strips, timing.

    python3 production/review/room/review.py [--tag=r1] [--from=262] [--to=281] [--workers=3] [--skip-render]

Frames go to video/out/frames_room (gitignored; render.mjs --dir, its own keys.json ledger). Outputs here:
  room_<tag>.mp4          H.264 1920x1080 60 fps + the sound-design master (<= 15 MB)
  room_<tag>_sheet.jpg    24 key frames with times (<= 1 MB)
  room_<tag>_events.jpg   each sync event: the frames around it, the event frame outlined (<= 1 MB)
  room_<tag>_timing.txt   check_timing.mjs output (measured onsets vs the frames the picture changes on)
"""
import os, subprocess, sys, pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[3]
HERE = pathlib.Path(__file__).resolve().parent
args = {a[2:].split('=', 1)[0]: (a.split('=', 1)[1] if '=' in a else True) for a in sys.argv[1:] if a.startswith('--')}
TAG = args.get('tag', 'r1')
T0, T1 = float(args.get('from', 262)), float(args.get('to', 281))
DIR = ROOT / 'video/out/frames_room'
FPS = 60


def run(cmd, **kw):
    print('$', ' '.join(map(str, cmd)), flush=True)
    return subprocess.run(cmd, check=True, **kw)


def frame(i):
    return DIR / f'f{i:05d}.jpg'


def font(px):
    for p in ['/home/user/halys-music-video/video/fonts/JetBrainsMono-Regular.ttf']:
        if os.path.exists(p):
            return ImageFont.truetype(p, px)
    return ImageFont.load_default()


def sheet(times, out, cols=4, w=480):
    h = w * 9 // 16
    rows = (len(times) + cols - 1) // cols
    S = Image.new('RGB', (cols * w, rows * (h + 22)), (24, 24, 26))
    d = ImageDraw.Draw(S); f = font(14)
    for k, (t, label) in enumerate(times):
        i = int(round(t * FPS))
        if not frame(i).exists():
            continue
        im = Image.open(frame(i)).convert('RGB').resize((w, h), Image.LANCZOS)
        x, y = (k % cols) * w, (k // cols) * (h + 22)
        S.paste(im, (x, y))
        d.text((x + 6, y + h + 3), f'{t:7.3f}s f{i}  {label}', fill=(230, 230, 230), font=f)
    S.save(out, quality=84, optimize=True)
    print(out, os.path.getsize(out) // 1024, 'KB')


def events(out):
    sys.path.insert(0, str(HERE))
    # frames around each event (from the x-sheet via node)
    js = ("import('" + str(ROOT / 'video/src/worlds/ink/sheets.js') + "').then(async m => { const x = await import('" + str(ROOT / 'video/src/worlds/ink/xsheet.js') +
          "'); const S = m.roomSheets({}); const land = S.wide.find(e => e.tag === 'land').F; const keys = S.close.filter(e => e.tag === 'key').map(e => e.F);" +
          " let shut = 0; for (let i = x.frameAt(m.EV.ting) - 30; i < x.frameAt(m.EV.ting) + 30; i++) if (m.lidAt(i / 60) >= 1) { shut = i; break; }" +
          " console.log(JSON.stringify({ land, keys, shut, wink0: x.frameAt(m.EV.ting - .40) })); })")
    ev = subprocess.run(['node', '-e', js], capture_output=True, text=True, cwd=ROOT / 'video').stdout.strip()
    import json
    E = json.loads(ev)
    rows = [('spin lands on the final chord', E['land'], (420, 120, 1380, 1080)), *[(f'key click {k + 1}', F, (0, 560, 900, 1080)) for k, F in enumerate(E['keys'])],
            ('eyelid shuts on the ting', E['shut'], (660, 270, 1120, 530))]
    w, h, n = 300, 0, 5
    tiles = []
    for name, F, box in rows:
        bw, bh = box[2] - box[0], box[3] - box[1]
        th = int(w * bh / bw)
        tiles.append((name, F, box, th))
    H = sum(th + 26 for *_, th in tiles)
    S = Image.new('RGB', (w * n, H), (24, 24, 26)); d = ImageDraw.Draw(S); f = font(13)
    y = 0
    for name, F, box, th in tiles:
        d.text((6, y + 4), f'{name}: f{F} ({F / FPS:.3f} s); frames f{F - 2}..f{F + 2}, event frame outlined', fill=(240, 220, 120), font=f)
        y += 22
        for j, i in enumerate(range(F - 2, F + 3)):
            if frame(i).exists():
                im = Image.open(frame(i)).convert('RGB').crop(box).resize((w, th), Image.LANCZOS)
                S.paste(im, (j * w, y))
            if i == F:
                d.rectangle([j * w + 1, y + 1, j * w + w - 2, y + th - 2], outline=(255, 70, 40), width=3)
        y += th + 4
    S.save(out, quality=84, optimize=True)
    print(out, os.path.getsize(out) // 1024, 'KB')


def main():
    if not args.get('skip-render'):
        run(['node', 'render.mjs', f'--frames={T0}:{T1}', f'--workers={args.get("workers", 3)}', '--dir=out/frames_room', '--stale'], cwd=ROOT / 'video')
    mp4 = HERE / f'room_{TAG}.mp4'
    run(['node', 'render.mjs', '--encode', '--dir=out/frames_room', f'--range={T0}:{T1}', f'--out={mp4}', '--crf=23', '--preset=slow'], cwd=ROOT / 'video')
    if mp4.stat().st_size > 15e6:   # re-encode to a size cap
        tmp = mp4.with_suffix('.tmp.mp4')
        kbps = int(14.2e6 * 8 / (T1 - T0) / 1000) - 192
        run(['ffmpeg', '-y', '-v', 'error', '-i', str(mp4), '-c:v', 'libx264', '-b:v', f'{kbps}k', '-maxrate', f'{kbps * 2}k', '-bufsize', f'{kbps * 2}k', '-preset', 'slow',
             '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(tmp)])
        tmp.replace(mp4)
    print(mp4, round(mp4.stat().st_size / 1e6, 2), 'MB')
    times = [(262.5, 'S76 (not INK)'), (264.5, 'S77 pull-back (line engine)'), (266.14, 'S78 first frame: Earth on the monitor'), (266.6, 'terminal tick 2'),
             (267.2, 'warn tick'), (267.9, 'commands'), (268.25, 'dT band slides north'), (268.6, 'band on the Halys'), (269.4, 'commit burst'),
             (269.75, 'spin'), (269.85, 'spin'), (269.95, 'spin'), (270.02, 'lands on the chord'), (270.3, 'settle'), (271.0, 'deadpan'), (272.8, 'deadpan (freeze)'),
             (273.42, 'S80 close-up'), (273.47, 'key 1'), (274.04, 'key 2'), (274.94, 'key 3: enter'), (275.3, 'commit printed'), (276.4, 'sly smile'), (276.8, 'the eclipse lid'), (276.96, 'shut on the ting'),
             (277.3, 'wink held'), (278.2, 'end card'), (280.5, 'end card')]
    sheet(times, HERE / f'room_{TAG}_sheet.jpg', cols=4, w=480)
    events(HERE / f'room_{TAG}_events.jpg')
    r = subprocess.run(['node', 'production/review/room/check_timing.mjs', '--frames=video/out/frames_room'], capture_output=True, text=True, cwd=ROOT)
    (HERE / f'room_{TAG}_timing.txt').write_text(r.stdout + r.stderr)
    print(r.stdout)


if __name__ == '__main__':
    main()
