"""INK stand-ins: the art department's room stills, prepared like a one-frame plate (frame, subject matte, face meta),
for machines where video/plates/P39-P41 do not exist. The room scenes switch to them automatically.

    python3 video/src/worlds/ink/prep/standins.py

  sa  room_a board (behind the chair, typing)                    -> S78
  sb  d_room look-dev input (looking back at camera, deadpan)    -> S79 after the landing
  sc  d_room, a close crop on her face                           -> S80/S81 (the wink is drawn on her right eye)
Output: video/src/worlds/ink/standins/<id>/{frame.jpg, matte.png, meta.json} + standins/index.json (960x540 each).
"""
import json, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[5]
OUT = pathlib.Path(__file__).resolve().parents[1] / 'standins'
sys.path.insert(0, str(ROOT / 'tools'))
SRC = {
    'sa': ('media/boards/sets/room_a_e1p_t1.jpg', None, 'isnet-general-use'),
    'sb': ('media/lookdev/inputs/d_room.jpg', None, 'isnet-anime'),
    'sc': ('media/lookdev/inputs/d_room.jpg', (840, 120, 1480, 480), 'isnet-anime'),   # 640x360 crop around her face
}


def main():
    from rembg import remove, new_session
    import plate_meta
    idx = {}
    for sid, (path, crop, model) in SRC.items():
        im = Image.open(ROOT / path).convert('RGB')
        if crop:
            im = im.crop(crop)
        # cover-fit 960x540
        s = max(960 / im.width, 540 / im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        x0, y0 = (im.width - 960) // 2, (im.height - 540) // 2
        im = im.crop((x0, y0, x0 + 960, y0 + 540))
        d = OUT / sid; d.mkdir(parents=True, exist_ok=True)
        im.save(d / 'frame.jpg', quality=92)
        m = remove(im, session=new_session(model), only_mask=True)
        m.save(d / 'matte.png', optimize=True)
        meta, _ = plate_meta.measure(d / 'frame.jpg', None)
        (d / 'meta.json').write_text(json.dumps(meta))
        idx[sid] = {'w': 960, 'h': 540, 'gain': 1.0, 'src': path, 'faces': meta.get('faces', [])}
        print(sid, 'faces', len(meta.get('faces', [])), flush=True)
    (OUT / 'index.json').write_text(json.dumps(idx))


if __name__ == '__main__':
    main()
