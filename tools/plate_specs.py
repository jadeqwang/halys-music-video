"""Seedance plate specs: the director's shot list for reference footage.

Plates are reference only. The JS renderer reads them (motion, composition, faces, physics, light) and
redraws them in its own style; the footage itself never appears in the film. Prompts should therefore
favour *traceable* pictures: one clear action, readable silhouettes, hard directional light, simple
backgrounds, no on-screen text.

Run them with tools/plates.py (see production/TOOLING.md):
    python3 tools/plates.py --list
    python3 tools/plates.py --dry P12              # request + cost estimate, no API call
    python3 tools/plates.py P12                    # generate (a new take each time it is named)
    python3 tools/plates.py --budget=80 --yes      # every plate with fewer takes on disk than `takes`

Fields per plate (only `prompt` is required):
  prompt          str, <= 2000 chars (Seedance 2.5). Name references by order ("reference image 1").
  model           default "bytedance/seedance-2.5" (also: "bytedance/seedance-2.0", "...-2.0-fast", "...-2.0-mini")
  duration        4..30 seconds, or -1 (model picks). Default 5. Billed per output second.
  resolution      "480p" ($0.1028/s) | "720p" ($0.2312/s, default). 24 fps always.
  aspect_ratio    "16:9" (default) | "4:3" | "1:1" | "3:4" | "9:16" | "21:9" | "adaptive"
  refs            list of REFS keys or repo paths -> reference_images (max 30; 1-4 works best). Images are
                  flattened to RGB JPEG, <= 2048 px, padded to <= 2.4:1 (wider references are rejected).
  first_frame     REFS key/path -> `image` (image-to-video; aspect_ratio is then forced to adaptive)
  last_frame      REFS key/path -> `last_frame_image` (needs first_frame)
  ref_videos      list of repo paths -> reference_videos (total <= 30 s). Switches billing to the
                  video-input rate: $0.4304/s at 480p, $0.9676/s at 720p (~4x).
  audio           audio reference(s) -> reference_audios (total <= 30 s). Each item is either a path, or
                  {"t0": song seconds, "dur": seconds (default: the plate duration), "src": "song" | "vocals" | path}.
                  "song" = Halys.mp3; "vocals" = the isolated vocal stem (media/stems/, see tools/audio/).
                  The slice is cut by plates.py into media/plates/<id>/audio_<src>_<t0>_<dur>.mp3.
  generate_audio  default False. True gives the plate its own soundtrack (handy to measure where Seedance
                  placed the reference audio), but a soundtrack built from the song can trip the provider's
                  copyright filter.
  avatar          use_virtual_avatar (default False). Routes image refs through ByteDance's virtual-avatar
                  library; set True when a realistic-face reference fails with "...PrivacyInformation".
  seed            int (accepted, reproducibility not guaranteed)
  takes           how many takes to keep for this plate when plates.py runs without ids (default 1)
  t_song          [t0, t1]: where the plate sits in the song (bookkeeping; used by lip-sync checks)
  example         True = never generated unless named explicitly on the command line
  notes           free text
Extra bookkeeping fields (ignored by plates.py, read by the review in production/PLATES.md):
  shots           the SHOTLIST shots this plate serves
  sync            [[song_t, "event"], ...]: the musical hits the plate's action should land on. With the audio
                  reference cut at t0 and the plate's own duration, plate time = song time - t0.

Plate conventions (production/STYLE_BIBLE.md, TREATMENT.md v0.2, RESEARCH.md 3-5, BOARDS.md):
  * Photoreal, readable: clean silhouettes, subject separated from a darker background, high shutter (no motion
    blur), no fog/haze walls, no text. BRONZE/GOLD plates: one hard low golden sun raking in from frame right
    (WNW). Totality / marble / frozen plates: readable dusk light (the renderer paints the eclipse and the night).
  * Identity: the canonical sheets in media/chars/ are attached and named by order. The Lydian = crested bronze
    helmet, crimson tunic, lion shield; the Mede = red felt cap, ochre tunic, trousers, sword on the RIGHT thigh.
    Equal dignity, mirrored framing. No stirrups, no flags, no modern objects, no fantasy armour.
  * Audio reference: the ORIGINAL song slice (Halys.mp3) for the plate's window, cut at t0 with the plate's
    duration (P41 alone uses the sound-design master, so the wink can sit near the 276.95 "ting").
"""

# Reference images, by short key. Paths are relative to the repo root.
REFS = {
    "SHEET": "Pasted image.png",   # the singer as an anime character: front / three-quarter / side / back turnaround
    # canonical identity sheets (BOARDS.md)
    "LYD": "media/chars/lydian.jpg",
    "MED": "media/chars/mede.jpg",
    "LYD_CAV": "media/chars/lydian_cavalryman.jpg",
    "LYD_CAV_H": "media/chars/lydian_cavalryman_horse.jpg",
    "MED_ARCH": "media/chars/median_archer.jpg",
    "MED_CAV": "media/chars/median_cavalryman.jpg",
    "MED_CAV_H": "media/chars/median_cavalryman_horse.jpg",
    "THALES": "media/chars/thales.jpg",
    "ALYATTES": "media/chars/alyattes.jpg",
    "CYAXARES": "media/chars/cyaxares.jpg",
    # sets and frames
    "WIDE": "media/boards/sets/halys_wide3_gpt_t1.jpg",
    "TOTALITY": "media/boards/sets/halys_totality3_gpt_j_t1.jpg",
    "SHALLOWS": "media/boards/sets/halys_shallows_b_t1.jpg",
    "ROOM_A": "media/boards/sets/room_a_e1p_t1.jpg",      # behind the chair
    "ROOM_B": "media/boards/sets/room_b_e1p_t1.jpg",      # three-quarter front
    "ROOM_C": "media/boards/sets/room_c_e1_t1.jpg",       # face lit by the monitor
    "F8": "media/boards/frames/f8_room_gpt_e1_t1.jpg",    # the sly smile and the wink
}

# ---------------------------------------------------------------- shared prompt fragments
NO_TEXT = "No on-screen text, no captions, no labels, no watermark."
SINGER = ("the young woman from the reference character sheet (long straight black hair, white cropped jacket with "
          "orange stripes, black crop top, orange headphones around her neck, navy cargo trousers)")
SING = ("She sings the words of the reference audio: her lips move in sync with every word and breath of the vocal, "
        "natural singing mouth shapes, jaw and throat movement.")

REAL = "Photoreal live-action cinema, crisp focus, high shutter speed with no motion blur."
SUN = ("Hard, low golden sun raking in from frame right (the sun itself is outside the frame, beyond the right edge), long "
       "shadows, deep black shadows, warm rim light, background much darker than the figures. Clear air: no fog, no haze, no smoke.")
DUSK = ("Readable dusk light of a total eclipse: dim, even twilight, an orange glow low along the horizon, every face "
        "and costume still clearly readable. No fog, no smoke.")
SHEET_ONLY = "Reference images are identity, costume and location references only: never show the grey studio, the turnaround layout or the inset panels."
PERIOD = "No stirrups, no flags, no modern objects."
NOSING = "Nobody sings or speaks; the audio is only background music for timing."
NOTXT = "No text, no watermark."

LYD = ("the Lydian from reference image {n} (crested bronze Corinthian helmet pushed up so his face shows, long dark braids, "
       "short beard, crimson tunic, bronze scale corselet, round crimson shield with a black lion, spear)")
LYD_S = "the Lydian from reference image {n} (crested bronze helmet pushed up, braids, short beard, crimson tunic, bronze scale corselet, crimson lion shield)"
MED = ("the Mede from reference image {n} (soft red felt cap with ear flaps, full black curly beard, long-sleeved ochre tunic "
       "with a red rosette border, iron scale corselet, dark brown trousers, round wicker shield, spear, short sword in a "
       "scabbard on his RIGHT thigh)")
MED_S = "the Mede from reference image {n} (red felt cap, black curly beard, long-sleeved ochre tunic, iron scale corselet, wicker shield, short sword on his RIGHT thigh)"
LYD_ARMY = "Lydians (crested bronze helmets, crimson tunics, bronze scale corselets, round crimson shields with a black lion)"
MED_ARMY = "Medes (soft red felt caps, long-sleeved ochre tunics, dark trousers, round wicker shields)"
ANIME = ("Anime style with clean cel shading and crisp tapered line art, exactly matching the character sheet of reference "
         "image 1: flat cel colours, one shadow tone, painted flat backgrounds, no depth-of-field blur, no yellow cast.")
JADE = ("the young woman from reference image 1 (long straight black hair, brown eyes, white cropped bomber jacket with orange "
        "stripes, a round 1420 MHz patch on the left sleeve and a light-blue circle with RARE EARTH on the back, orange "
        "headphones around her neck, black crop top, navy wide cargo trousers)")
ROOM_LIGHT = ("A small dark apartment room at night: cool pearl glow from the monitors and one warm orange desk lamp; "
              "a foggy window with a distant red-blinking tower.")

SONG = "song"


def a(t0, dur=None, src=SONG):
    d = {"t0": t0, "src": src}
    if dur:
        d["dur"] = dur
    return d


PLATES = {
    # An example to copy. It reproduces the 2026-10-02 smoke test (media/tests/seedance25_test_480p_4s.mp4);
    # `example=True` keeps `plates.py` (no ids) from ever spending money on it.
    "example_singer_cu": dict(
        example=True, duration=4, resolution="480p", refs=["SHEET"],
        audio={"t0": 69.12, "dur": 4.0, "src": "song"}, t_song=[69.12, 73.12],
        prompt=(f"Anime style with clean cel shading, exactly like the reference character sheet. Medium close-up of {SINGER} "
                f"singing softly in a dim room lit by a single warm lamp. {SING} Almost static camera with a very slow push-in. "
                + NO_TEXT),
        notes="verse 1: '...lys, on the sixth year of the war'"),

    # ============================================================ 1-3 · cold open, intro (BRONZE)
    "P01": dict(
        duration=15, takes=2, refs=["WIDE", "LYD", "MED"], audio=a(7.18), t_song=[7.18, 22.18],
        shots="S04-06, S16, S20, S24, S30, S35, S44",
        sync=[[7.18, "strings enter (plate 0)"], [10.69, "S06 descent begins"], [14.19, "cut to S07"]],
        prompt=("Aerial establishing shot from about 40 m above the middle of the broad red-brown clay river of reference image 1, "
                "looking straight downstream to the west-north-west. The river runs from the bottom of the frame straight to the "
                "low golden sun, which sits just above the horizon at the river's vanishing point. Left bank: the Lydian army, "
                "dressed like the man in reference image 2 (crested bronze helmets, crimson tunics, round crimson shields with a "
                "black lion, long spears, horsemen, a gold lion standard on a pole). Right bank: the Median army, dressed like the "
                "man in reference image 3 (red felt caps, ochre tunics, dark trousers, round wicker shields, archers, horsemen, a "
                "bronze horse standard on a pole). Mirror-symmetric composition with equal weight on both banks. In the middle "
                "distance the two front lines meet in a wide shallow ford: a dense, churning battle in the water, spears and "
                "shields moving, spray flashing gold. Behind the fighting, the rest of each army stands in ranks along its bank. "
                "Backlit golden hour: long shadows stretch toward the camera, rim-lit helmets and spear tips, darker foreground "
                "banks. The battle in the ford is already raging in the first frame. Camera: it stays high above the river for the "
                "whole 15 seconds, drifting slowly and steadily forward at almost constant height (it descends only a little), so "
                "the river, both banks, the ford and the sun stay in frame to the end; no cuts, no shake. Clear air: no fog, no "
                "haze, no smoke. Photoreal live-action "
                f"cinema, crisp. {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Master composition by day. River = perspective line to the sun at the vanishing point; Lydians left, Medes right."),

    "P02": dict(
        duration=8, refs=["TOTALITY", "WIDE"], audio=a(0.0), t_song=[0.0, 8.0],
        shots="S01-02", sync=[[1.45, "diamond-ring flash (renderer)"], [1.89, "S02 text"]],
        prompt=("The same aerial view as reference image 1, matched to the daylight view of reference image 2: high above the middle "
                "of a broad red-brown river, looking straight downstream to the west-north-west horizon; the Lydian army (crested "
                "bronze helmets, crimson tunics, crimson lion shields) on the left bank and the Median army (red felt caps, ochre "
                "tunics, wicker shields) on the right bank, mirrored. It is the middle of a total solar eclipse. Readable dusk light: "
                "the sky a dark umber dome, an orange sunset glow all around the horizon, and the land in a dim, even twilight in "
                "which the soldiers, shields, banks and river stay clearly visible and readable. Both armies stand completely "
                "frozen: every soldier is motionless, his face turned up toward the sky above the river's vanishing point. Nothing "
                "moves except a faint ripple on the water. The sky above the horizon is empty: no sun, no moon. Camera: an almost "
                "imperceptible slow push forward, perfectly steady, no cuts. Clear air: no fog, no smoke. Photoreal live-action "
                f"cinema. {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Same view as P01 at totality; never too dark to analyse. The renderer paints the black sun and the corona."),

    "P03": dict(
        duration=5, refs=["LYD"], audio=a(14.19), t_song=[14.19, 19.19], shots="S07",
        sync=[[14.19, "cut in"], [17.66, "cut out (plate 3.47)"]],
        prompt=("Medium close-up of the Lydian infantryman from reference image 1 on a riverbank before battle, his body turned "
                "three-quarters toward frame right. The hard, low golden sun from frame right falls straight on his face in a tight "
                "pool of light; behind him a dark, shadowed riverbank with the shapes of soldiers far away, much darker than him. "
                "Action: 0-3 s he lifts his crested bronze Corinthian helmet with both hands, settles it on his head pushed back "
                "so his face stays visible, and presses the bronze cheek-pieces into place with his fingertips; the small ivory "
                "knucklebone charm on its leather cord swings at his chest and glints in the sun. At 3.5 s he lowers his hands, "
                "takes one breath and looks off toward frame right, steady and resolute. Long dark braids, short beard, crimson "
                f"tunic, bronze scale corselet. Camera static, very slight push-in. {REAL} Clear air, no haze. {NOSING} "
                f"{SHEET_ONLY} {NOTXT}"),
        notes="Faces right; light pool on his face; the knucklebone must read."),

    "P04": dict(
        duration=5, refs=["MED"], audio=a(17.66), t_song=[17.66, 22.66], shots="S08, S42",
        sync=[[17.66, "cut in"], [21.15, "cut out (plate 3.49)"]],
        prompt=("Medium close-up of the Mede from reference image 1 on a riverbank before battle, his body turned three-quarters "
                "toward frame left: the mirror image of a matching shot of his Lydian opponent. The hard, low golden sun from frame "
                "right rakes across his face and beard in a tight pool of light; behind him a dark, shadowed riverbank with the "
                "shapes of soldiers far away, much darker than him. Action: 0-1.5 s his hand closes around the ash shaft of his "
                "tall spear and tightens its grip, and he plants the spear butt; a small terracotta toy horse with painted red "
                "stripes is tucked into his belt at his waist, clearly visible. At 2.5 s he lifts his chin and looks off toward "
                "frame left, steady and resolute. Soft red felt cap with ear flaps, full black curly beard, long-sleeved ochre tunic "
                "with a red rosette border, iron scale corselet, short sword in its scabbard on his RIGHT thigh. Camera static, very "
                f"slight push-in. {REAL} Clear air, no haze. {NOSING} {SHEET_ONLY} {NOTXT}"),
        notes="Mirror of P03: faces left, same light and closeness (equal dignity). Clay horse in the belt."),

    "P05": dict(
        duration=6, refs=["ALYATTES", "LYD_CAV_H"], audio=a(21.15), t_song=[21.15, 27.15], shots="S09, S22, S43",
        sync=[[23.3, "ostinato stops, rubato swell (plate 2.15)"], [24.49, "stab (plate 3.34)"]],
        prompt=("Medium-wide, low-angle shot of Alyattes, king of Lydia, the man from reference image 1 (about 50, long grey-streaked "
                "hair with a gold fillet, full beard, deep purple wool mantle with a gold meander border over a white linen "
                "chiton, gold lion-head bracelets), mounted on a glossy chestnut horse like the one in reference image 2 (crimson "
                "and ochre patterned saddlecloth, bronze bridle fittings, no saddle, no stirrups). He faces three-quarters toward "
                "frame right. Behind him, darker and further away, ranks of Lydian spearmen in crested bronze helmets with crimson "
                "shields and a gold lion standard on a pole. Action: 0-2 s he sits still, gazing ahead; at 2.2 s he slowly raises "
                "his right hand high, palm open, commanding; at 3.5 s he turns his head toward his men and shouts a command, mouth "
                "wide, arm still raised, to the end; the horse shifts and tosses its head. The king and horse stay centred in the "
                f"middle half of the frame (the sides will be cropped). Camera static. {SUN} {REAL} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Left panel of the kings' diptych; mirrored with P06. Raise a hand (S09), then shout (S22)."),

    "P06": dict(
        duration=6, refs=["CYAXARES", "MED_CAV_H"], audio=a(21.15), t_song=[21.15, 27.15], shots="S09, S22, S43",
        sync=[[23.3, "ostinato stops, rubato swell (plate 2.15)"], [24.49, "stab (plate 3.34)"]],
        prompt=("Medium-wide, low-angle shot of Cyaxares, king of the Medes, the man from reference image 1 (about 60, grey curled "
                "beard, madder-red felt cap with a gold diadem band, long-sleeved saffron tunic embroidered with winged creatures, "
                "ochre coat worn as a cape, gold lion torque, a composite bow, short sword on his RIGHT thigh), mounted on a big bay "
                "horse like the one in reference image 2 (forelock tied in a topknot, cropped upright mane, patterned saddlecloth, "
                "bronze bit, no saddle, no stirrups). He faces three-quarters toward frame left: the mirror of a matching shot of "
                "the Lydian king. Behind him, darker and further away, ranks of Median spearmen and archers in red felt caps and "
                "ochre tunics with wicker shields and a bronze horse standard on a pole. Action: 0-2 s he sits still, gazing "
                "ahead; at 2.2 s he slowly raises his left hand high, palm open, commanding; at 3.5 s he turns his head toward his "
                "men and shouts a command, mouth wide, arm still raised, to the end; the horse shifts and tosses its head. The king "
                "and horse stay centred in the middle half of the frame (the sides will be cropped). Camera static. "
                f"{SUN} {REAL} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Right panel of the kings' diptych; mirror of P05 (same audio, same beats)."),

    "P07": dict(
        duration=5, refs=["LYD", "MED", "SHALLOWS"], audio=a(25.5), t_song=[25.5, 30.5], shots="S10",
        sync=[[27.24, "boom = cut to the clash (plate 1.74)"]],
        prompt=("Slow-motion, very low-angle shot at the waterline in the middle of a wide shallow ford of the red-brown clay river "
                "of reference image 3. From the left bank the Lydian front line, dressed like reference image 1 (crested bronze "
                "helmets, crimson tunics, round crimson shields with a black lion, spears levelled), charges into the knee-deep "
                "water toward frame right; from the right bank the Median front line, dressed like reference image 2 (red felt "
                "caps, ochre tunics, round wicker shields, spears), charges into the water toward frame left. They run toward each "
                "other, legs churning the water, spray thrown up and lit gold, spears lowered; the gap between them closes steadily "
                "but they do not meet. Mirror-symmetric composition, the gap centred. Camera very low, just above the water, static "
                f"with a slight push forward. {SUN} {REAL} High-frame-rate slow motion. {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Crescendo into the 27.24 boom; the lines must not collide here (that is P08)."),

    "P08": dict(
        duration=5, refs=["LYD", "MED", "SHALLOWS"], audio=a(26.0), t_song=[26.0, 31.0], shots="S11",
        sync=[[27.24, "BOOM: shields collide (plate 1.24)"]],
        prompt=("Medium shot at the waterline in a knee-deep red-brown river ford like reference image 3: the Lydian front line, "
                "dressed like reference image 1 (crested bronze helmets, crimson tunics, round crimson lion shields), rushes in "
                "from frame left and the Median front line, dressed like reference image 2 (red felt caps, ochre tunics, round "
                "wicker shields), rushes in from frame right. Exactly at the 1.2-second mark, on the big drum hit of the reference "
                "audio, the two central shields slam together in the middle of the frame, a crimson lion shield against a wicker "
                "shield, and a huge crown of red-brown spray explodes upward into the golden sunlight; after the impact everything "
                "continues in slow motion as the lines push shield against shield and the spray hangs and falls. Mirror-symmetric "
                f"framing on the point of impact. Camera static, slightly low. {SUN} {REAL} No blood, no gore. {SHEET_ONLY} "
                f"{PERIOD} {NOTXT}"),
        notes="The clash: impact on the boom at 27.24 = plate 1.24 s."),

    "P09": dict(
        duration=5, refs=["LYD_CAV_H", "LYD_CAV", "SHALLOWS"], audio=a(32.47), t_song=[32.47, 37.47], shots="S13",
        sync=[[34.19, "stab (plate 1.72)"], [35.30, "timpani (plate 2.83)"]],
        prompt=("Low-angle shot from the water: Lydian cavalry charging through the shallows of the red-brown river of reference "
                "image 3, straight toward the camera. The riders are dressed like the man in reference images 1 and 2: open-faced "
                "crested bronze helmets, crimson tunics, bronze scale corselets, ochre cloaks, soft boots; they ride chestnut and "
                "bay horses on crimson and ochre saddlecloths with bronze bridle fittings, bareback with NO stirrups and no "
                "saddles. Each rider holds a long 3-metre ash spear lowered overhand toward the camera. The lead horse is centred; "
                "five or six more follow in a staggered line. Hooves explode the water into spray lit gold; the horses gallop in "
                "powerful, slightly slowed motion and grow larger in frame, and the lead horse passes just beside the camera at "
                f"the end. Camera static, low, just above the water. {SUN} {REAL} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Long spears, saddlecloths, no stirrups."),

    "P10": dict(
        duration=5, refs=["MED_ARCH"], audio=a(35.98), t_song=[35.98, 40.98], shots="S14",
        sync=[[36.845, "stab (plate 0.87)"], [38.23, "timpani: the loose (plate 2.25)"]],
        prompt=("Side-on, medium-wide shot of a disciplined rank of Median archers on a riverbank, all dressed like the man in "
                "reference image 1 (soft undyed felt hoods with side flaps, long-sleeved ochre tunics with embroidered hems, dark "
                "leather trousers, sheepskin cloaks, short double-curved composite bows, decorated bow-cases at the hip, short "
                "sword on the right thigh). The front rank kneels, the second rank stands behind; every man is an individual, "
                "noble, calm and focused. Action: 0-2 s they nock arrows and draw together to the chin in one smooth motion and "
                "hold; at the 2.2-second mark, on the drum hit of the reference audio, they all loose at once: the bows snap "
                "forward and a volley of arrows rises across the sky toward frame right; then they reach for the next arrows. "
                "They face frame right, into the light. Camera static on a tripod, slightly low, the arrows' flight visible "
                f"against the sky. {SUN} {REAL} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Disciplined, dignified, never a horde."),

    "P11": dict(
        duration=5, refs=["LYD", "MED"], audio=a(39.48), t_song=[39.48, 44.48], shots="S15",
        sync=[[39.48, "cut in"], [41.24, "cut out"]],
        prompt=("Two shots joined by one hard cut at 2.5 seconds, mirrored like a matching pair. Shot 1 (0-2.5 s): medium close-up "
                f"of {LYD_S.format(n=1)} in the middle of a river melee, shoulders turned three-quarters toward frame right; fighting "
                "soldiers move behind him as dark shapes. He breathes hard, then turns his head and freezes, staring across at "
                "someone toward frame right. Shot 2 (2.5-5 s): the mirror image: medium close-up of the Mede from reference image 2 "
                "(red felt cap with ear flaps, full black curly beard, ochre tunic, iron scale corselet, wicker shield) in the same "
                "melee, turned three-quarters toward frame left; he turns his head and freezes, staring back toward frame left, "
                "recognition in his eyes. In both shots the hard, low golden sun from frame right lights the face, deep shadows, "
                f"a much darker background, the face sharp. Camera static. {REAL} Clear air, no fog. {NOSING} {SHEET_ONLY} {NOTXT}"),
        notes="Two mirrored singles in one plate; the renderer cuts on beat 3."),

    "P12": dict(
        duration=8, takes=2, refs=["LYD", "MED", "SHALLOWS"], audio=a(44.73), t_song=[44.73, 52.73],
        shots="S17, S19, S27 (S36/S37 moved to P42-P46 in the 02:43 shot list)",
        sync=[[46.06, "beat: first thrust turned by the lion shield (plate 1.33)"], [47.563, "stab (plate 2.83)"],
              [48.912, "stab (plate 4.18)"], [49.533, "stab (plate 4.80)"], [50.633, "stab + timpani (plate 5.90)"],
              [51.484, "stab (plate 6.75)"]],
        prompt=("Medium-wide, side-on shot of a duel in the knee-deep red-brown shallows of the river side channel of reference "
                f"image 3 (gravel bar, reeds, red clay bank). On the left, {LYD.format(n=1)}, faces right; on the right, "
                f"{MED.format(n=2)}, faces left. Both full figures visible, centred, mirrored and equal in size. Choreography "
                "with clear, readable strikes landing on the accents of the reference audio: 0-1 s they circle, shields raised; at "
                "1.3 s the Mede thrusts his spear and the Lydian turns it aside with his lion shield; at 2.8 s the Lydian thrusts "
                "back and the Mede catches it on his wicker shield; at 4.2 s and 4.8 s two fast exchanges, spear shafts clacking; "
                "at 5.9 s the Lydian smashes his shield into the Mede's shield and the water bursts up in a gold spray; at 6.8 s "
                "they spring apart and circle again. Every strike ends in a sharp stop, never a blur. Camera steady, a very slow "
                f"arc around the fighters. {SUN} {REAL} No blood. {SHEET_ONLY} {NOTXT}"),
        notes="The duel; also the 3D orbit plate (S37), so keep both men whole and readable with clean depth."),

    "P13": dict(
        duration=5, refs=["LYD", "MED", "SHALLOWS"], audio=a(58.72), t_song=[58.72, 63.72], shots="S21",
        sync=[[59.60, "timpani: knocked down (plate 0.88)"], [61.76, "timpani (plate 3.04)"], [62.20, "cut out (plate 3.48)"]],
        prompt=("Medium-wide, side-on shot in the knee-deep red-brown shallows of the river side channel of reference image 3. "
                f"{LYD_S.format(n=1)[0].upper() + LYD_S.format(n=1)[1:]} fights {MED_S.format(n=2)}. At 0.9 s the Mede slams his "
                "wicker shield into the Lydian, who falls backward into the water with a big splash; at 2.0 s the Mede drives his "
                "spear down at him; the Lydian rolls sideways, clear, and the spear stabs into the water where he was, throwing "
                "up spray; by 3.5 s the Lydian is up on one knee, shield raised, water streaming off him, facing the Mede again. "
                f"Clear, readable action with sharp stops, no blood. Camera static, slightly low. {SUN} {REAL} {SHEET_ONLY} {NOTXT}"),
        notes="Knocked down, spear comes down, rolls clear."),

    "P14": dict(
        duration=5, takes=2, refs=["LYD"], audio=a(65.67), t_song=[65.67, 70.67], shots="S23, S36, S41, S47",
        sync=[[66.96, "timpani (plate 1.29)"], [67.73, "first sung word: the frame is still (plate 2.06)"]],
        prompt=("Close-up of the face of the Lydian from reference image 1 in the middle of a battle: crested bronze Corinthian "
                "helmet pushed up on his head, long dark braids, short beard, sweat and red river water on his skin, the bronze "
                "scale corselet at the bottom of the frame. The hard, low golden sun from frame right falls across his face in a "
                "tight pool of light; the background is near-black with faint shapes of fighting soldiers. 0-1.8 s: he breathes "
                "hard, chest heaving, eyes darting; at 1.8 s he goes completely still and holds his breath; at 2.6 s he slowly "
                "lifts his face and eyes toward the sky at frame right and his expression turns to awe; he holds that upward gaze, "
                f"lips slightly parted, to the end. Camera static, a barely perceptible push-in. {REAL} Natural skin detail, clear "
                f"air. {NOSING} {SHEET_ONLY} {NOTXT}"),
        notes="One face in the chaos; still before the voice; then looking up (reused for S41 lines and S47 marble)."),

    # ============================================================ 4-6 · verse 1, pre-chorus, chorus 1
    "P15": dict(
        duration=7, takes=2, refs=["LYD", "MED", "SHALLOWS"], audio=a(74.41), t_song=[74.41, 81.41], shots="S25",
        sync=[[74.655, "'Lydians' (plate 0.25)"], [75.925, "'Medes' (plate 1.52)"], [77.88, "cut to the shore melee (plate 3.47)"]],
        prompt=("Two shots joined by one hard cut at 3.5 seconds. Shot 1 (0-3.5 s): a symmetrical face-off in the knee-deep "
                f"red-brown shallows of reference image 3. {LYD_S.format(n=1)[0].upper() + LYD_S.format(n=1)[1:]}, holding a spear, "
                f"stands on the left in profile facing right; {MED_S.format(n=2)}, holding a spear, stands on the right in profile "
                "facing left. Exactly centred and mirrored, full figures, shields up, spear points lowered toward each other, the "
                "gap between them in the middle of the frame; they step slowly sideways, circling, eyes locked. Behind them on the "
                "far shore, smaller and darker, Lydians and Medes fight. Shot 2 (3.5-7 s): wide shot of that melee on the shore: "
                f"{LYD_ARMY} on the left and {MED_ARMY} on the right clash along the riverbank, spears and shields moving, dust "
                f"kicked up; mirrored composition. Both shots: camera static. {SUN} {REAL} No blood. {NOSING} {SHEET_ONLY} "
                f"{PERIOD} {NOTXT}"),
        notes="Face-off centred and mirrored (LYDIANS over left, MEDES over right), then the shore melee after the cut."),

    "P16": dict(
        duration=5, refs=["LYD"], audio=a(81.36), t_song=[81.36, 86.36], shots="S26",
        sync=[[82.65, "'burning' (plate 1.29)"], [84.38, "'bronze': the glint sweeps (plate 3.02)"]],
        prompt=("Extreme close-up macro shot of polished, convex bronze armour from reference image 1: the camera glides slowly "
                "across the curved, polished bronze rim of the round Lydian shield (crimson paint with a black lion inside the "
                "bronze rim) and up over the bronze edge of the crested Corinthian helmet with its red and black horsehair crest. "
                "The low golden sun from frame right burns across the curved metal: a hard specular highlight slides along the "
                "bronze, the hammered texture, small dents and scratches razor sharp. At 3 s the sun's glint sweeps across the "
                "convex rim in one bright, clean flash. Deep black background. Camera: slow, smooth lateral slide on a slider. "
                f"Photoreal macro cinematography, crisp, no lens-flare rays, no motion blur. {SHEET_ONLY} {NOTXT}"),
        notes="Bronze macro; the renderer adds the reflected easter-egg figure on the convex bronze."),

    "P17": dict(
        duration=4, refs=["LYD"], audio=a(85.91), t_song=[85.91, 89.91], shots="S27",
        sync=[[87.68, "'when light went strange' (plate 1.77)"], [88.69, "'strange': he looks up (plate 2.78)"]],
        prompt=(f"Medium close-up of {LYD_S.format(n=1)}, standing in the shallows, body three-quarters toward frame right. A Median "
                "wicker shield held up just outside frame right breaks the low golden sunlight into a field of many small bright "
                "spots of light that dapple his bronze scales, his shield and his face, gently shimmering. 0-1.5 s he breathes in a "
                "fighting stance; at 1.8 s he notices the strange spotted light on his chest and glances down at it, puzzled; at "
                "2.8 s he slowly lifts his face toward the sky at frame right and stares up. The light is low and golden but "
                f"slightly flat and cool, the background dark. Camera static, slight push-in. {REAL} Clear air. {NOSING} "
                f"{SHEET_ONLY} {NOTXT}"),
        notes="The renderer paints the stretched crescent suns; the plate gives the dappled light, the glance down and the look up."),

    "P18": dict(
        duration=4, refs=["LYD", "MED"], audio=a(89.22), t_song=[89.22, 93.22], shots="S28",
        sync=[[89.78, "'halo' (plate 0.56)"], [91.31, "boom 'warriors': all faces up (plate 2.09)"]],
        prompt=("Medium-wide shot of a line of seven or eight exhausted warriors standing side by side on a riverbank after "
                "fighting, Lydians dressed like reference image 1 (crested bronze helmets, crimson tunics, bronze scale corselets, "
                "lion shields) and Medes dressed like reference image 2 (red felt caps, ochre tunics, wicker shields) mixed "
                "together, all looking ahead at first. One after another, from left to right, each man turns his face up to the "
                "sky: the first at 0.4 s, then the next every quarter second, so that by 2.1 seconds every face is turned upward "
                "toward the sky at frame right, in wonder; then they hold still, gazing up. The low sun from frame right is "
                "weakening: the light is golden but flat and slightly metallic, shadows crisp, the background darker. Camera "
                f"static, slightly low. {REAL} Clear air, no fog. {NOSING} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Faces turn up one after another; all up on the 91.31 boom."),

    "P19": dict(
        duration=4, refs=["LYD"], audio=a(93.0), t_song=[93.0, 97.0], shots="S29, S36",
        sync=[[93.95, "'eye' (plate 0.95)"], [95.185, "'god' (plate 2.19)"]],
        prompt=("Extreme close-up of one eye of the Lydian from reference image 1: the bronze edge of his helmet's cheek-piece and "
                "a few dark braids at the frame edge, sun-weathered skin, a dark brown iris. He is looking up toward the sky at "
                "frame right; a small bright reflection of the sky shines in the dark pupil. 0-1 s the eye searches the sky; at "
                "1 s it locks still and the pupil slowly widens; the eye stays wide open and steady, with no blink, to the end, with "
                "the faintest tremble. Low golden light from frame right grazing the skin, deep shadows, black surroundings. Camera "
                f"static, extremely slow push-in. Photoreal macro cinematography, crisp lashes and iris detail, no motion blur. "
                f"{SHEET_ONLY} {NOTXT}"),
        notes="XCU eye; the renderer puts the crescent in the pupil."),

    "P19b": dict(
        duration=4, refs=["MED"], audio=a(93.0), t_song=[93.0, 97.0], shots="S42 (and S36)",
        sync=[[93.95, "'eye' (plate 0.95)"]],
        prompt=("Extreme close-up of one eye of the Mede from reference image 1: the edge of his red felt cap's ear flap and his "
                "black curly beard at the frame edge, sun-weathered skin, a dark brown iris. He is looking up toward the sky, "
                "slightly toward frame left; a small bright reflection of the sky shines in the dark pupil. 0-1 s the eye searches "
                "the sky; at 1 s it locks still and the pupil slowly widens; the eye stays wide open and steady, with no blink, to "
                "the end, with the faintest tremble. Low golden light from frame right grazing the skin, deep shadows, black "
                "surroundings. Camera static, extremely slow push-in. Photoreal macro cinematography, crisp lashes and iris detail, "
                f"no motion blur. {SHEET_ONLY} {NOTXT}"),
        notes="The Mede variant of P19 (equal dignity; S42 the Mede's face in lines)."),

    "P20": dict(
        duration=4, refs=["LYD", "MED"], audio=a(100.24), t_song=[100.24, 104.24], shots="S31, S55",
        sync=[[100.27, "boom (plate 0.03)"], [102.21, "BIGGEST BOOM: every face up in unison (plate 1.97)"]],
        prompt=("Low-angle, medium-wide shot of massed soldiers of both armies standing close together on a riverbank during a total "
                "solar eclipse: Lydians dressed like reference image 1 (crested bronze helmets, crimson tunics, lion shields) on "
                "the left half and Medes dressed like reference image 2 (red felt caps, ochre tunics, wicker shields) on the right "
                "half, mirrored, dozens of faces readable. The sky above them is a dark umber dome with an orange glow along the "
                "horizon; the faces and costumes stay clearly readable in the dim, even twilight. 0-1.9 s: everyone stands "
                "completely still, eyes lowered, frozen in silence. At exactly 2.0 s, on the huge drum hit of the reference audio, "
                "every soldier lifts his face to the sky at the same instant, in unison, as one body; then they hold the upward "
                "gaze, motionless, to the end. Open, empty sky in the upper third (no sun, no moon). Camera static, low. "
                f"{REAL} No fog, no smoke. {NOSING} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="The formation moment: all faces up on 102.21 (plate 1.97). Also S55 (statues gaze up)."),

    "P21": dict(
        duration=4, takes=2, refs=["LYD", "MED", "SHALLOWS"], audio=a(103.64), t_song=[103.64, 107.64], shots="S32",
        sync=[[104.26, "'down' (plate 0.62)"], [104.96, "'blade': the sword hits the water (plate 1.32)"]],
        prompt=("Mirrored medium two-shot in the knee-deep red-brown shallows of reference image 3, during a total solar eclipse. "
                f"{DUSK} The Lydian from reference image 1 (crested bronze helmet pushed up, braids, crimson tunic, bronze scale "
                "corselet, crimson lion shield, a short iron sword in his right hand) stands on the left facing right; the Mede "
                "from reference image 2 (red felt cap, black curly beard, ochre tunic, iron scale corselet, wicker shield, spear, "
                "short sword sheathed on his RIGHT thigh) stands on the right facing left. Exactly centred and symmetrical. "
                "0-0.5 s: both are frozen mid-duel, faces turned up to the darkened sky. 0.5-1.2 s: slowly they lower their eyes "
                "to each other and let their weapons sink. At 1.3 s the Lydian opens his hand and his sword drops straight down "
                "into the water with a small splash; the Mede lowers his spear point into the water. From 1.6 s they stand still, "
                f"shields lowered, looking into each other's eyes, breathing. Camera static. {REAL} {NOSING} {SHEET_ONLY} {NOTXT}"),
        notes="The duelists stop; the sword drop must read and land near 104.96 (plate 1.32)."),

    "P22a": dict(
        duration=4, refs=["LYD"], audio=a(105.85), t_song=[105.85, 109.85], shots="S33 (left panel)",
        sync=[[105.85, "'Go' (plate 0)"], [107.02, "'home' (plate 1.17)"]],
        prompt=("Extreme close-up of the right hand of the Lydian from reference image 1, palm up, in the dim, even light of an "
                "eclipse dusk: skin, fingers and the object clearly readable, a warm orange rim along the edge of the hand, black "
                "background. The edge of his crimson tunic and bronze scale corselet sits at the frame edge. The hand comes in from "
                "frame left as a loose closed fist and slowly opens, the fingers uncurling one by one, revealing a small, lumpy, "
                "ivory-coloured knucklebone (a sheep's astragalus) on a thin leather cord resting in his palm, as in the inset of "
                "reference image 1; the open palm ends centred and holds still. An anatomically correct hand with five fingers and "
                "natural skin creases. Camera static, very slow push-in. Photoreal macro cinematography, crisp, no motion blur. "
                f"{SHEET_ONLY} {NOTXT}"),
        notes="Left panel of the hands diptych (mirror of P22b)."),

    "P22b": dict(
        duration=4, refs=["MED"], audio=a(105.85), t_song=[105.85, 109.85], shots="S33 (right panel)",
        sync=[[105.85, "'Go' (plate 0)"], [107.02, "'home' (plate 1.17)"]],
        prompt=("Extreme close-up of the left hand of the Mede from reference image 1, palm up, in the dim, even light of an "
                "eclipse dusk: skin, fingers and the object clearly readable, a warm orange rim along the edge of the hand, black "
                "background. The cuff of his long ochre sleeve with its red rosette border sits at the wrist. The hand comes in "
                "from frame right as a loose closed fist and slowly opens, the fingers uncurling one by one, revealing a small "
                "terracotta toy horse with painted red stripes resting in his palm, as in the inset of reference image 1; the open "
                "palm ends centred and holds still. An anatomically correct hand with five fingers and natural skin creases. Camera "
                f"static, very slow push-in. Photoreal macro cinematography, crisp, no motion blur. {SHEET_ONLY} {NOTXT}"),
        notes="Right panel of the hands diptych (mirror of P22a)."),

    "P23": dict(
        duration=4, refs=["LYD", "MED", "SHALLOWS"], audio=a(3.65), t_song=[3.65, 7.65], shots="S03",
        sync=[[3.65, "cut in"], [5.40, "cut out (plate 1.75)"]],
        prompt=("Mirrored medium-wide two-shot in the knee-deep red-brown shallows of reference image 3, during a total solar "
                f"eclipse. {DUSK} {LYD_S.format(n=1)[0].upper() + LYD_S.format(n=1)[1:]} on the left and {MED_S.format(n=2)} on the "
                "right stand a few steps apart, facing each other, exactly symmetrical. Their spears hang lowered at their sides, "
                "points in the water, shields down; both have their faces turned up to the dark sky above, completely still, in "
                "awe. Only the water ripples and their hair and tunics stir in a faint wind. Camera: an almost imperceptible slow "
                f"push-in, steady. {REAL} {SHEET_ONLY} {NOTXT}"),
        notes="Cold-open payoff image; frozen, faces up, mirrored."),

    # ============================================================ 7-9 · drop 1, breakdown, verse 2 (CORONA / MARBLE)
    "P24": dict(
        duration=4, refs=["LYD"], audio=a(124.47), t_song=[124.47, 128.47], shots="S38",
        sync=[[124.475, "kick out: hand to the sky"], [126.206, "kick returns (plate 1.74)"]],
        prompt=(f"Low-angle medium shot from behind and slightly to the side of {LYD_S.format(n=1)}, standing on a bare ridge "
                "against an empty, dark dusk sky; the only light is a dim twilight and an orange glow along the horizon, his "
                "silhouette crisp and readable. Action: 0-1.5 s he slowly raises his right arm overhead and presses his open palm "
                "flat against the sky, as if the sky were a sheet of glass just above him: the palm flattens and stops against the "
                "invisible surface; at 2 s he spreads his fingers and pushes harder; at 2.6 s he leans his head and shoulders "
                "forward and up, pressing his face toward the surface beside his hand, curious and awed. Camera static. "
                f"{REAL} Clear air, no fog. {SHEET_ONLY} {NOTXT}"),
        notes="Flammarion: the renderer makes the sky a membrane of lines where the palm presses."),

    "P25": dict(
        duration=10, takes=2, refs=["LYD", "MED", "MED_ARCH"], audio=a(153.83), t_song=[153.83, 163.83],
        shots="S45, S46, S49", sync=[[157.03, "boom: cut closer (plate 3.20)"], [160.70, "verse 2 (plate 6.87)"]],
        prompt=("Frozen time during a total solar eclipse: a battle on the bank of a red-brown river stopped dead in mid-action. "
                f"Every warrior is completely motionless, like a statue, caught mid-strike. In the centre {LYD_S.format(n=1)} is "
                f"frozen in the middle of a spear thrust, facing {MED_S.format(n=2)}, frozen as he blocks. Around them more frozen "
                "Lydians and Medes mid-swing, a rider on a rearing horse, and Median archers like reference image 3 frozen at full "
                "draw; arrows hang motionless in the air; river spray and water droplets are suspended in mid-air like glass "
                "beads; dust hangs still. Nothing moves at all: no breathing, no cloth movement, no hair movement. Only the camera "
                "moves: one slow, smooth, continuous dolly that glides between and around the frozen figures, orbiting the central "
                "duel from left to right over 10 seconds, and in the last 3 seconds cranes up and tilts toward the dark sky above. "
                f"{DUSK} Photoreal live-action bullet-time, crisp, no motion blur. {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Frozen-time hero plate: statues mid-action, camera moving (S46 drift; S49 tilt up to the sky)."),

    "P26": dict(
        duration=4, refs=["LYD", "MED"], audio=a(178.66), t_song=[178.66, 182.66], shots="S51",
        sync=[[179.23, "'wind' (plate 0.57)"], [181.115, "'chill' (plate 2.46)"]],
        prompt=("Frozen time during a total solar eclipse: on a riverbank, Lydian and Median warriors dressed like reference images "
                "1 and 2 (crested bronze helmets and crimson tunics; red felt caps and ochre tunics) stand completely motionless, "
                "like statues, caught mid-action: one mid-stride, one with his spear raised, one with his shield up. Their bodies "
                "do not move at all. Only the wind moves: a cold gust blows in from frame right, rippling their tunics and cloaks "
                "and the red and black horsehair crests, lifting their long hair and braids, streaming the crimson cloth ribbons "
                "tied under a gold lion standard on a pole, bending the silver feather grass around their legs and lifting fine "
                f"dust that drifts across the frame. {DUSK} Camera static on a tripod. {REAL} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Only cloth, hair, grass and dust move."),

    # ============================================================ 11 · Thales (MARBLE + one living figure)
    "P27": dict(
        duration=4, takes=2, refs=["THALES", "LYD", "MED"], audio=a(181.23), t_song=[181.23, 185.23], shots="S52",
        sync=[[182.485, "'Thales' (plate 1.26)"]],
        prompt=("During a total solar eclipse, on a riverbank, Thales of Miletus, the man from reference image 1 (about 40, lean, "
                "dark hair knotted at the nape under a braided fillet, short pointed beard with a shaved upper lip, crinkled "
                "off-white linen chiton, terracotta-red wool mantle over the left shoulder, leather sandals, a tall wooden staff in "
                "his hand), walks slowly toward the camera between warriors frozen like statues mid-battle: Lydians like reference "
                "image 2 (crested bronze helmets, crimson tunics, lion shields) and Medes like reference image 3 (red felt caps, "
                "ochre tunics, wicker shields), caught mid-strike and completely motionless. He is the only thing that moves: "
                "calm, unhurried steps, head tilted back, looking up at the sky with quiet curiosity, his mantle swaying. "
                f"{DUSK} He is lit a little warmer than the frozen men. Camera: slow, steady tracking shot moving backward in "
                f"front of him at chest height. {REAL} {SHEET_ONLY} {NOTXT}"),
        notes="The only living thing walks between the statues (painted in colour by the renderer)."),

    "P28": dict(
        duration=5, takes=2, refs=["THALES"], audio=a(184.64), t_song=[184.64, 189.64], shots="S53, S54",
        sync=[[186.38, "'dark' (plate 1.74)"], [187.65, "the breath: he glances at camera (plate 3.01)"]],
        prompt=("Medium close-up of Thales of Miletus, the man from reference image 1 (about 40, lean and sun-weathered, dark hair "
                "knotted at the nape under a braided fillet, short pointed beard with a shaved upper lip, off-white linen chiton, "
                "terracotta-red mantle over the left shoulder, holding a tall wooden staff), standing among motionless warriors "
                "(dark shapes behind him) during a total solar eclipse. Readable dusk light: dim twilight from above and a warm "
                "orange glow from the horizon on one side of his face, the face clearly lit. 0-3 s: he looks up at the sky, head "
                "tilted back, calm, studying it, with a slight nod as if confirming a calculation. At 3.0 s he lowers his gaze and "
                "looks straight into the camera lens with a dry, knowing half-smile and a slight lift of one eyebrow, and holds the "
                f"look to the end. Camera static, very slow push-in. {REAL} Natural skin. {NOSING} {SHEET_ONLY} {NOTXT}"),
        notes="He looks up, then glances into the lens in the breath (187.65 = plate 3.01): he knows."),

    # ============================================================ 11-12 · spark, final chorus (GOLD)
    "P29": dict(
        duration=9, takes=2, refs=["LYD", "MED"], audio=a(194.86), t_song=[194.86, 203.86], shots="S57, S58",
        sync=[[194.845, "'spark' (plate 0)"], [200.315, "'Shadow turned to day': the roar (plate 5.46)"],
              [203.60, "boom (plate 8.74)"]],
        prompt=("Medium-wide shot on a riverbank: Lydian and Median warriors dressed like reference images 1 and 2 (crested bronze "
                "helmets, crimson tunics, bronze scale corselets, crimson lion shields; red felt caps, ochre tunics, wicker shields) "
                "stand mixed together, frozen like statues, faces turned up to the sky, in the dim, cool, readable twilight of a "
                "total eclipse. 0-1 s: completely still. 1-4 s: a wave of warm golden sunlight sweeps across the scene from frame "
                "right to frame left, and as the light reaches each warrior he comes back to life: he blinks, breathes, lowers his "
                "face and looks around in wonder. 4-5.4 s: they turn to each other, amazed. From 5.4 s both armies roar with joy "
                "together, raising their arms, spears and shields high to the sky, cheering, laughing, embracing; the motion grows "
                "bigger to the end. From 4 s the light is a hard, low golden sun from frame right with long shadows and warm rim "
                f"light, the background darker. Camera: slow push-in. {REAL} Clear air, no fog. {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Light returns: statues to flesh, then the roar on 'Shadow turned to day' (plate 5.46)."),

    "P30": dict(
        duration=4, refs=["LYD", "MED"], audio=a(203.39), t_song=[203.39, 207.39], shots="S59",
        sync=[[203.60, "boom (plate 0.21)"], [205.08, "boom (plate 1.69)"], [207.0, "boom (plate 3.61)"]],
        prompt=(f"Close two-shot in glorious warm golden light: {LYD_S.format(n=1)} on the left and the Mede from reference image 2 "
                "(red felt cap with ear flaps, full black curly beard, ochre tunic, iron scale corselet) on the right, side by side, "
                "their faces lit gold by the low sun from frame right, other cheering warriors behind them. They look up at the sky "
                "and burst out laughing with relief and joy, eyes shining, heads thrown back; at 1.7 s the Mede claps the Lydian on "
                "the shoulder and they laugh together, looking up, to the end. Warm, high-key golden light with rich shadows and a "
                f"darker background. Camera static, slightly low. {REAL} Natural faces, clear air. {NOSING} {SHEET_ONLY} {NOTXT}"),
        notes="Baroque glory: golden faces, laughter."),

    "P31": dict(
        duration=4, refs=["LYD", "MED", "SHALLOWS"], audio=a(207.4), t_song=[207.4, 211.4], shots="S60",
        sync=[[207.4, "drop-out breath (plate 0)"], [208.5, "hold ends (plate 1.1)"]],
        prompt=("Close, mirrored two-shot in profile in warm returning golden light: the Lydian from reference image 1 (crested bronze "
                "helmet pushed up, braids, short beard, crimson tunic, bronze scale corselet, crimson lion shield on his arm, short "
                "sword in his hand) on the left facing right, and the Mede from reference image 2 (red felt cap, black curly beard, "
                "ochre tunic, iron scale corselet, wicker shield on his arm, spear in his hand) on the right facing left, face to "
                "face about a metre apart in the red-brown shallows of reference image 3. Exactly symmetrical. Both completely "
                "still, weapons still in hand but lowered, looking into each other's eyes; only their breathing and a faint wind "
                f"in their hair. Camera static. {SUN} {REAL} {NOSING} {SHEET_ONLY} {NOTXT}"),
        notes="Face to face, still, weapons in hand."),

    "P32": dict(
        duration=5, takes=2, refs=["LYD", "MED", "WIDE"], audio=a(208.7), t_song=[208.7, 213.7], shots="S61",
        sync=[[208.7, "'Throw' (plate 0)"], [209.945, "'blade' (plate 1.25)"], [210.18, "low end out: hold on the sinking sword (plate 1.48)"],
              [211.877, "beat returns (plate 3.18)"]],
        prompt=("Two shots joined by one hard cut at 2 seconds. Shot 1 (0-2 s): a wide slow-motion shot across the red-brown river of "
                "reference image 3 in warm golden light: on the left bank Lydian soldiers dressed like reference image 1 (crested "
                "bronze helmets, crimson tunics), on the right bank Median soldiers dressed like reference image 2 (red felt caps, "
                "ochre tunics), all throw their swords and spears into the river at the same moment; a rain of bronze blades arcs "
                "through the golden air from both banks and splashes into the water. Shot 2 (2-5 s): close-up at the surface of the "
                "red-brown water: one bronze sword enters the water point-first and slowly sinks, the hilt disappearing last, rings "
                f"spreading across the water lit gold. Camera static in both shots. {SUN} {REAL} High-frame-rate slow motion. "
                f"{SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Rain of bronze; then one sword sinking during the held 'blade'."),

    "P33": dict(
        duration=4, refs=["LYD"], audio=a(211.88), t_song=[211.88, 215.88], shots="S62 (-> S63 match cut)",
        sync=[[212.3, "riser (plate 0.42)"], [215.287, "DROP 2 kick: match cut at the apex (plate 3.41)"]],
        prompt=(f"Low-angle shot looking up at {LYD_S.format(n=1)} on a riverbank in warm golden light, a golden sky with painterly "
                "clouds behind him. At 0.3 s, grinning, he tosses his short bronze sword high into the air; the camera tilts up to "
                "follow it; the sword spins end over end, rising against the golden sky and flashing in the low sun each time it "
                "turns; it slows as it climbs, and at about 3.3 s it hangs almost still at the top of its arc, point up, centred in "
                f"the frame against the sky. Hard, low golden sun from frame right. {REAL} Slow motion. Clear air. {SHEET_ONLY} "
                f"{NOTXT}"),
        notes="The sword at its apex, point up, match-cuts to the rocket (P34) on the Drop 2 kick."),

    # ============================================================ 13 · drop 2 (ORBIT): modern plates, no identity refs
    "P34": dict(
        duration=7, audio=a(215.29), t_song=[215.29, 222.29], shots="S63",
        sync=[[215.287, "Drop 2 kick (plate 0)"]],
        prompt=("A tall, slender, polished stainless-steel rocket with a pointed nose and four small fins at its base, completely "
                "unbranded: no logos, no flags, no lettering, no markings anywhere. At dusk it lifts off from a launch pad on a "
                "brilliant column of white-gold flame, slowly at first, then accelerating straight up; billows of exhaust spread "
                "across the pad. A low-angle camera on the ground at a distance tilts up to follow it as it rises into a deep dusk "
                "sky; the flame light slides over the steel skin. The rocket stays centred and vertical in the frame, a clean "
                "silhouette. No lens-flare rays, no fog wall, no people, no buildings with signs. Photoreal live-action cinema, "
                "crisp, no motion blur. No text, no logos, no watermark."),
        notes="Swords into starships: the spinning sword match-cuts to it. Unbranded, generic shape (no real rocket design)."),

    "P35": dict(
        duration=4, audio=a(232.27), t_song=[232.27, 236.27], shots="S67",
        prompt=("A white supersonic airliner with a slender delta wing and a long drooped needle nose (a Concorde-type jet), plain "
                "white with no markings, no logos and no lettering, flying fast above a sea of clouds at dusk. The camera tracks "
                "alongside at the same speed, a little behind and above, the aircraft steady in the middle of the frame in profile "
                "toward frame right, a row of small round cabin windows along the fuselage, the cloud tops streaming past below, a "
                "warm orange glow along the horizon and a darker sky above. Smooth and steady, no shake. Photoreal live-action "
                "cinema, crisp, no motion blur on the aircraft. No text, no logos, no watermark."),
        notes="1973 Concorde 001 eclipse chase; the renderer adds the eclipse through a porthole."),

    "P36": dict(
        duration=4, audio=a(235.66), t_song=[235.66, 239.66], shots="S68",
        sync=[[237.66, "faces lift together (plate 2.0)"]],
        prompt=("A crowd of people of all ages and backgrounds stands together in an open park, everyone wearing simple paper "
                "eclipse glasses and looking up at the sky; plain modern clothes with no logos and no text. The late-afternoon light "
                "is slowly and strangely dimming. 0-1.5 s they look up, some steadying their glasses with a hand; at 2 s, all at "
                "once, their faces lift further and their mouths open in awe, a few point up, and a child on a parent's shoulders "
                "raises both arms. Medium-wide shot, slightly low angle, many faces readable, sky above them. Camera static. "
                "Photoreal live-action cinema, crisp, no motion blur. No text, no logos, no brands, no watermark."),
        notes="2024 crowd; rhymes with the warriors' faces-up moment (P20)."),

    "P37": dict(
        duration=4, audio=a(242.45), t_song=[242.45, 246.45], shots="S70",
        prompt=("Looking straight up from the stone floor of the Great Hypostyle Hall of Karnak temple in Egypt: massive papyrus "
                "columns carved with reliefs rise from every side of the frame and converge toward a patch of open midday sky in "
                "the centre, with heavy stone architraves crossing it. Harsh, high midday sun lights the column tops; deep shadows "
                "below. Over the 4 seconds the daylight dims steadily and strangely, the sky deepening and the shadows softening "
                "as if noon were turning to dusk, but the stone stays readable to the end. Camera: a slow, steady rotation around "
                "the vertical axis while looking straight up. No people. Photoreal live-action cinema, crisp, no lens-flare rays. "
                "No text, no watermark."),
        notes="Darkness at noon (2027, near Luxor); the renderer paints the black sun near the zenith."),

    # ============================================================ 14 · outro: GOLD formation, then the room (INK)
    "P38": dict(
        duration=5, takes=2, refs=["LYD", "MED"], audio=a(257.68), t_song=[257.68, 262.68], shots="S74, S75, S76",
        sync=[[259.35, "hit: blades raised (plate 1.67)"], [260.62, "BLADE: all blades slam down (plate 2.94)"],
              [261.05, "hit: the straggler's blade lands (plate 3.37)"]],
        prompt=("Medium-wide shot in warm golden light on a riverbank with the red-brown river behind: a front rank of about twelve "
                "soldiers stands shoulder to shoulder facing the camera, Lydians on the left half dressed like reference image 1 "
                "(crested bronze helmets, crimson tunics, bronze scale corselets) and Medes on the right half dressed like reference "
                "image 2 (red felt caps, ochre tunics, iron scale corselets), more ranks behind them. 0-1.5 s: they stand at rest, "
                "short swords in hand. At 1.7 s, on a hit of the reference audio, all of them raise their swords high overhead in "
                "perfect unison and hold. At 2.9 s, on the next hit, all of them slam their swords down point-first into the "
                "ground at the same instant, one sharp unison stroke, except one Lydian soldier just right of centre in the front "
                "rank, who is a beat late: his sword comes down alone at 3.4 s. He glances left and right at the others, then gives "
                f"a sheepish shrug with both shoulders and a small embarrassed grin. Camera static. {SUN} {REAL} {SHEET_ONLY} "
                f"{PERIOD} {NOTXT}"),
        notes="Formation: raise on 259.35 (plate 1.67), slam on 260.62 (plate 2.94), straggler on 261.05 (plate 3.37), shrug."),

    "P39": dict(
        duration=4, refs=["SHEET", "ROOM_A"], audio=a(266.12), t_song=[266.12, 270.12], shots="S78",
        sync=[[266.12, "ticking build: one terminal line per tick"]],
        prompt=(f"{ANIME} The room is exactly the room of reference image 2, seen from the same angle, behind her desk chair. "
                f"{ROOM_LIGHT} {JADE[0].upper() + JADE[1:]} sits at the desk with her back to the camera, facing an ultrawide "
                "monitor and a vertical side monitor, typing steadily on a mechanical keyboard, her head moving slightly as she "
                "reads the scrolling terminal; the light-blue circle on the back of her jacket faces the camera. Camera static. "
                "No readable text on the screens, no captions, no watermark."),
        notes="From behind the chair; RARE EARTH circle rhymes with Earth. The renderer draws every screen."),

    "P40": dict(
        duration=5, takes=2, refs=["SHEET", "ROOM_A"], audio=a(268.3), t_song=[268.3, 273.3], shots="S79",
        sync=[[270.04, "final stark chord: the spin ends facing camera (plate 1.74)"], [271.6, "freeze (plate 3.3)"]],
        prompt=(f"{ANIME} The room is exactly the room of reference image 2, seen from the same angle, from behind her desk chair. "
                f"{ROOM_LIGHT} Medium shot: {JADE} sits typing at her monitors with her back to the camera. At 1.0 s she stops "
                "typing and spins her office chair around toward the camera in one smooth half-turn; at 1.7 s the chair stops facing "
                "the camera squarely and she looks straight into the lens. From 1.8 s to the end she holds a completely deadpan "
                "stare at the camera: expressionless, eyelids relaxed, mouth closed, perfectly still, no blinking, only her hair "
                "settling after the spin. The monitors glow behind her; the warm desk lamp lights her face. Camera static. "
                "No readable text on the screens, no captions, no watermark."),
        notes="The spin lands on the final chord (270.04 = plate 1.74); deadpan hold after."),

    "P41": dict(
        duration=6, takes=2, refs=["SHEET", "ROOM_C", "F8"], audio=a(273.4, src="media/stems/halys_sd_master.wav"),
        t_song=[273.4, 279.4], shots="S80, S81",
        sync=[[273.45, "key 1 (plate 0.05)"], [274.05, "key 2 (plate 0.65)"], [274.95, "key 3 (plate 1.55)"],
              [276.95, "the 'ting': THE WINK (plate 3.55)"]],
        prompt=(f"{ANIME} Close-up, head and shoulders, of {JADE}, facing the camera, her desk and glowing monitors behind her in a "
                "dark room; reference image 2 shows her face, lighting and framing, reference image 3 the sly smile and wink she "
                "ends on. She stares straight into the lens, completely deadpan. Without looking away she reaches back with one "
                "hand to the keyboard behind her and taps three keys blind (at 0.1 s, 0.7 s and 1.6 s), only her shoulder and arm "
                "moving, eyes locked on the camera. At 2.6 s the corner of her mouth curls into a small, mischievous half-smile. At "
                "3.5 s she gives one clear, deliberate wink with one eye: the upper eyelid sweeps down over the iris, stays closed "
                "for half a second, then opens, while the other eye stays open; she keeps the sly smile to the end. Light: cool "
                "pearl monitor glow from behind as a rim on her hair, warm orange desk lamp on her face. Camera static. No readable "
                "text, no captions, no watermark."),
        notes="Audio = sound-design master 273.4-279.4 so the wink sits near the 276.95 ting (plate 3.55)."),
}

# ---------------------------------------------------------------- Drop 1 reactions (director's addition, 2026-10-03: SHOTLIST P42-P46)
# S35-S37: at totality the warriors react with shock, horror and prayer. Equal numbers of Lydian and Median reactions;
# readable dusk (the renderer applies the eclipse). Kicks of the drop (plate time from t0 = 110.58): 0.00, 0.43, 0.86, 1.29,
# 1.73, 2.16, 2.60, 3.03, 3.47, 3.90, 4.34, 4.77. S35 cuts: IN THE 110.98 (the Lydian kneeling, P42), SKY 111.455 (the rearing
# horse, P44), SKY 111.89 (the prostrate Mede, P43), so those actions come first in their plates.
PLATES.update({
    "P42": dict(
        duration=5, takes=2, refs=["LYD"], audio=a(110.58), t_song=[110.58, 115.58], shots="S35, S36",
        sync=[[110.98, "IN THE: the kneeling man's arms go up (S35 cut)"], [111.435, "kick: the spin round"],
              [111.865, "kick: eyes covered"], [112.305, "kick: the spear drops"]],
        prompt=(f"{DUSK} In the knee-deep red-brown shallows of a river, four Lydian infantrymen dressed like reference image 1 "
                "(crested bronze helmets pushed up so the faces show, long braids, crimson tunics, bronze scale corselets, round "
                "crimson shields with a black lion, spears) stand a few metres apart, each clearly separate, staring up at the sky "
                "that has just gone dark. They react in shock and prayer one after another, each on a drum hit of the reference "
                "audio: at 0.4 s the second man from the left sinks to his knees in the water and raises both arms high to the sky, "
                "palms open and turned up, praying; at 0.9 s the man on the far left spins round, staring wildly in every direction "
                "in terror; at 1.3 s the third man throws his forearm over his eyes and turns his face away; at 1.7 s the spear "
                "slips from the fourth man's hand and splashes into the water as he stares up, mouth open. Then they hold these "
                "poses, trembling, to the end. Medium-wide shot, full figures, the group turned three-quarters toward frame right, "
                f"the far bank dark behind them. Camera static. {REAL} {NOSING} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Lydian reactions: kneeling Greek prayer (arms up, palms up), spin in terror, eyes covered, spear dropped."),
    "P43": dict(
        duration=5, takes=2, refs=["MED", "MED_ARCH"], audio=a(110.58), t_song=[110.58, 115.58], shots="S35, S36",
        sync=[[111.89, "SKY: the prostration (S35 cut)"], [111.435, "kick: the amulet prayer"],
              [111.865, "kick: the bow falls"], [112.305, "kick: grabs his neighbour's arm"]],
        prompt=(f"{DUSK} In the shallows of a red-brown river, beside a low gravel bar, four Median soldiers stand a few metres "
                "apart, each clearly separate: three spearmen dressed like reference image 1 (soft red felt caps with ear flaps, "
                "black curly beards, long-sleeved ochre tunics, iron scale corselets, round wicker shields, short sword on the right "
                "thigh) and an archer dressed like reference image 2 (undyed felt hood, ochre tunic, sheepskin cloak, short composite "
                "bow). All stare up at the sky that has just gone dark, then react one after another, each on a drum hit of the "
                "reference audio: at 0.4 s the man on the far right drops to his knees on the gravel bar and prostrates himself, "
                "pressing his forehead down to the river stones, arms stretched forward; at 0.9 s the second man clutches a small "
                "amulet hanging on a cord at his chest with both hands and prays silently, eyes on the sky; at 1.3 s the archer lets "
                "his bow fall from his hand into the water; at 1.7 s the fourth man grabs his neighbour's arm in fear. Then they hold, "
                "trembling, to the end. Medium-wide shot, full figures, the group turned three-quarters toward frame left (the mirror "
                f"of a matching shot of the Lydians), the far bank dark behind them. Camera static. {REAL} {NOSING} {SHEET_ONLY} "
                f"{PERIOD} {NOTXT}"),
        notes="Median mirror of P42: proskynesis, amulet prayer, the archer drops his bow, grabs his neighbour's arm."),
    "P44": dict(
        duration=5, refs=["LYD_CAV_H", "MED_CAV_H"], audio=a(110.58), t_song=[110.58, 115.58], shots="S35, S36",
        sync=[[111.455, "SKY: the horse rears (S35 cut)"]],
        prompt=(f"{DUSK} Medium-wide shot on a riverbank. In the foreground a Lydian cavalryman like the rider in reference image "
                "1 (open-faced crested bronze helmet, crimson tunic, bronze scale corselet, ochre cloak) sits bareback on a chestnut "
                "horse with a crimson and ochre saddlecloth and bronze bridle fittings, NO stirrups: at 0.4 s the horse rears up high "
                "on its hind legs in panic, front hooves pawing the air, eyes wide, and the rider leans forward gripping the mane and "
                "reins, fighting to hold it; it drops back down and rears again at 2.6 s. Behind them, clearly visible, a Median rider "
                "like reference image 2 (red felt hood, ochre tunic, bay horse with a topknot, cropped upright mane and patterned "
                "saddlecloth, no stirrups) swings down from his horse at 1.0 s and, standing at its head, pulls the horse's head gently "
                "against his chest, stroking its face to calm it. Manes and tails fly. Correct horse anatomy, four legs each. Camera "
                f"static. {REAL} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="Horses: the Lydian rearing-horse beat and its Median mirror (RESEARCH 3.5/3.7)."),
    "P45": dict(
        duration=5, refs=["LYD", "MED", "ALYATTES", "CYAXARES"], audio=a(112.31), t_song=[112.31, 117.31], shots="S36",
        sync=[[112.31, "stutter montage starts"]],
        prompt=("Four tight face close-ups joined by hard cuts at 1.25, 2.5 and 3.75 seconds, all in the readable dusk light of a "
                "total eclipse: dim twilight, a warm orange glow from the horizon on one side of the face, a black background, every "
                "face sharp and clearly readable. Shot 1 (0-1.25 s): the Lydian from reference image 1 (crested bronze helmet pushed "
                "up, long braids, short beard) looks around wildly, eyes darting, breathing fast, then stares up at the sky. Shot 2 "
                "(1.25-2.5 s): the Mede from reference image 2 (red felt cap with ear flaps, black curly beard) whips his head round, "
                "eyes wide, then looks up. Shot 3 (2.5-3.75 s): Alyattes, king of Lydia, from reference image 3 (long grey-streaked "
                "hair, gold fillet, full beard, purple mantle) in shock, mouth open, looking up. Shot 4 (3.75-5 s): Cyaxares, king of "
                "the Medes, from reference image 4 (grey curled beard, madder-red felt cap with a gold band) in shock, eyes wide, "
                f"looking up. Each face fills most of the frame. {REAL} {NOSING} {SHEET_ONLY} {NOTXT}"),
        notes="Four faces for the S36 stutter montage: Lydian, Mede, Alyattes, Cyaxares (cuts at 1.25/2.5/3.75 s)."),
    "P46": dict(
        duration=8, takes=2, refs=["LYD", "MED", "LYD_CAV_H"], audio=a(117.53), t_song=[117.53, 125.53], shots="S37",
        sync=[[117.53, "orbit starts"], [124.475, "kick out (one-bar break)"]],
        prompt=("Frozen time during a total solar eclipse: a Baroque sculpture group of warriors on a riverbank, every figure "
                f"completely motionless, like statues. At the centre {LYD_S.format(n=1)} and {MED_S.format(n=2)} are stopped "
                "mid-strike, spears crossed, both faces turned up to the sky. Around them, frozen: two men kneeling with both arms "
                "raised to the sky, palms up (one Lydian, one Mede); a Mede prostrate with his forehead on the river stones; a Lydian "
                "pointing up at the sky, mouth open in a shout; a Mede covering his eyes with his forearm; and behind them a Lydian "
                "rider like reference image 3 holding his horse frozen on its hind legs in a rear. Nothing moves at all: no breathing, "
                "no cloth, no hair, no water. Only the camera moves: one slow, smooth orbit of about 30 degrees around the group from "
                f"left to right over the 8 seconds, at chest height, every figure staying in frame. {DUSK} Photoreal live-action "
                f"bullet-time, crisp, no motion blur. {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="S37 orbit plate (replaces P12 + depth): a frozen reaction tableau, ~30 degree orbit; clean depth matters."),
})

# ---------------------------------------------------------------- the arm-pull (singer's request, 2026-10-03: SHOTLIST P47 / S31b)
PLATES.update({
    "P47": dict(
        duration=5, takes=2, refs=["LYD", "MED"], audio=a(100.24, 4.76), t_song=[100.24, 105.0], shots="S31b",
        sync=[[102.21, "BOOM: the comrade grabs the raised forearm"]],
        prompt=("Medium-wide side-on shot at waist height in a knee-deep red-brown river during a total solar eclipse. "
                f"{DUSK} In the centre {LYD_S.format(n=1)} stands over {MED_S.format(n=2)}, who kneels on one knee in the "
                "water at frame right, shield lowered, looking up at him. The Lydian faces right and holds a short "
                "iron sword raised high over his head, about to strike. Just behind him at frame left stands a second Lydian "
                "soldier, a different, younger, clean-shaven man dressed like reference image 1 (crested bronze helmet, crimson "
                "tunic, bronze scale corselet). Three clearly separate figures. 0-1.8 s: the blow is about to fall. At exactly "
                "2.0 s, on the big drum hit of the reference audio, the soldier behind lunges forward, grabs the raised sword arm "
                "by the forearm with both hands and pulls it back. At 2.4 s the striker turns his head toward him in surprise. "
                "At 2.8 s the soldier lets go with one hand and points up at the sky. From 3.2 s all three look up at the sky in "
                "awe and hold still, the sword held back. Behind them on the darker far bank the ranks of both armies (crested "
                f"bronze helmets left, red felt caps right) turn their faces up together at 3.0 s. Camera static. {REAL} {NOSING} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="The arm-pull: the comrade's grab lands on the 102.21 boom (plate 1.97); then the look up."),
})

# ---------------------------------------------------------------- retakes (first-pass review, 2026-10-03)
# Each override keeps the first-pass prompt in `prompt_v1` and says what went wrong in `retake_note`; every take's
# take<N>.json snapshots the exact spec it was generated from. Reviews: media/plates/<id>/review.json.
WATER = "they stand IN the middle of a red-brown river, the water flowing around their knees; there is no dry ground anywhere near them"
RETAKES = {
    "P01": dict(
        refs=["LYD", "MED"],
        retake_note="takes 1-2 copied the WIDE board as a first frame (parade ranks, no battle) and then dived into the melee; "
                    "v2 drops the board and describes the battle at the ford and a constant-height drift in words",
        prompt=("Aerial view from about 60 m above the middle of a broad red-brown clay river in the late afternoon, looking straight "
                "downstream to the west-north-west: the river runs from the bottom of the frame straight to the low golden sun, which "
                "hangs just above the horizon exactly at the river's vanishing point. In the middle distance, where the river widens "
                "into a shallow ford, two armies are locked in a huge battle in knee-deep water: hundreds of small figures, spears and "
                "shields churning, spray flashing gold. On the left bank the rest of the Lydian army, dressed like reference image 1 "
                "(crested bronze helmets, crimson tunics, round crimson shields), pours down toward the ford in ranks, with horsemen and "
                "a gold lion standard on a pole; on the right bank the Median army, dressed like reference image 2 (red felt caps, ochre "
                "tunics, round wicker shields), with archers loosing volleys, horsemen and a bronze horse standard on a pole. "
                "Mirror-symmetric composition with equal weight on both banks; red badland hills, broad-crowned trees, tall golden "
                "clouds. Backlit golden hour: long shadows stretch toward the camera, rim-lit helmets and spear tips. Camera: one "
                "continuous, slow, steady forward drift at constant height for all 15 seconds; it never descends, and the sun, the ford "
                "and both banks stay in frame to the end; no cuts, no shake. Clear air: no fog, no haze, no smoke. Photoreal "
                f"live-action cinema, crisp. {SHEET_ONLY} {PERIOD} {NOTXT}")),
    "P18": dict(
        retake_note="take 1: the upward-face wave was barely visible (tiny head moves), 1 Lydian + 7 Medes, pale beach",
        prompt=("Medium shot at eye level of six warriors standing shoulder to shoulder on a riverbank after the fighting, framed from "
                "the chest up, alternating from left to right Lydian, Mede, Lydian, Mede, Lydian, Mede. The Lydians are dressed like "
                "reference image 1 (crested bronze helmets pushed up so the faces show, crimson tunics, bronze scale corselets); the "
                "Medes like reference image 2 (red felt caps with ear flaps, black beards, ochre tunics, iron scale corselets). At first "
                "they all look straight ahead, exhausted, breathing. Then one after another, from left to right, each man tips his whole "
                "head back and stares straight up at the sky: the first at 0.3 s, the second at 0.6 s, the third at 0.9 s, the fourth at "
                "1.2 s, the fifth at 1.5 s, the sixth at 1.8 s; by 2.1 s all six faces point up at the sky, mouths slightly open in "
                "wonder, and they hold perfectly still. Every head movement is big and clear. The low sun from frame right lights their "
                "faces in a warm, slightly flat light; behind them a dark riverbank in deep shadow. Camera static. "
                f"{REAL} No fog. {NOSING} {SHEET_ONLY} {NOTXT}")),
    "P21": dict(
        refs=["LYD", "MED"],
        retake_note="takes 1-2 stood on the dry gravel bar of the SHALLOWS board: the sword fell on stones (take 2: it vanished)",
        prompt=(f"During a total solar eclipse, {LYD_S.format(n=1)} and {MED_S.format(n=2)}: {WATER}. Mirrored medium two-shot, the "
                "Lydian on the left facing right, the Mede on the right facing left, a few steps apart, exactly symmetrical, both "
                f"visible from the knees up. {DUSK} The Lydian holds a short iron sword in his right hand; the Mede holds a spear and "
                "his wicker shield. 0-0.5 s: both are frozen mid-duel, faces turned up to the darkened sky. 0.5-1.1 s: slowly they "
                "lower their eyes and look straight at each other. At 1.2 s the Lydian opens his hand and his sword drops straight down "
                "and splashes into the water in front of him, a small bright splash; the Mede lowers his spear point into the water. "
                "From 1.6 s they stand still, looking into each other's eyes, breathing. Camera static, waist-high above the water. "
                f"{REAL} {NOSING} {SHEET_ONLY} {NOTXT}")),
    "P23": dict(
        refs=["LYD", "MED"],
        retake_note="take 1 put them on a dry gravel bank with spears upright",
        prompt=(f"During a total solar eclipse, mirrored medium-wide two-shot: {LYD_S.format(n=1)} on the left and {MED_S.format(n=2)} "
                f"on the right; {WATER}. They stand a few steps apart, facing each other, exactly symmetrical. Their spears are "
                "lowered, points resting in the water, shields hanging at their sides; both have their faces turned up to the dark "
                "sky, completely still, in awe. Only the water ripples around their legs and their hair and tunics stir in a faint "
                f"wind. {DUSK} Camera: an almost imperceptible slow push-in, steady. {REAL} {SHEET_ONLY} {NOTXT}")),
    "P27": dict(
        retake_note="takes 1-2: the model orbited the camera and Thales hardly walked (take 2 also lost the staff)",
        prompt=("During a total solar eclipse, on a flat riverbank, Thales of Miletus, the man from reference image 1 (about 40, lean, "
                "dark hair knotted at the nape under a braided fillet, short pointed beard with a shaved upper lip, crinkled off-white "
                "linen chiton, terracotta-red wool mantle over the left shoulder, leather sandals), walks toward the camera: four slow, "
                "clear steps (left foot, right foot, left, right), his tall wooden staff in his right hand touching the ground with each "
                "step, his mantle swaying, his face tilted up to the sky with quiet curiosity. He walks along a path between warriors "
                "frozen like statues mid-battle on both sides of him: a Lydian like reference image 2 (crested bronze helmet, crimson "
                "tunic, lion shield) frozen mid-thrust on the left, a Mede like reference image 3 (red felt cap, ochre tunic, wicker "
                "shield) frozen behind his shield on the right, more frozen warriors further back. The warriors are completely "
                f"motionless; Thales is the only thing that moves. {DUSK} He is lit a little warmer than the frozen men. Camera static "
                "on a tripod at chest height: he starts in the middle distance and ends in a medium shot. "
                f"{REAL} {SHEET_ONLY} {NOTXT}")),
    "P34": dict(
        retake_note="take 1 came out as a SpaceX-Starship look-alike (forward and aft flaps): STYLE_BIBLE forbids Musk iconography",
        prompt=("A slender, classic rocket with a smooth, polished stainless-steel skin: a plain cylinder tapering to a long pointed "
                "nose cone, with three small swept-back fins at the very bottom and nothing else on its body: no flaps, no wings, no "
                "canards, no grid fins, no windows, no logos, no flags, no lettering, no markings anywhere. At dusk it lifts off from a "
                "plain concrete pad on a brilliant column of white-gold flame, slowly at first, then accelerating straight up; billows "
                "of exhaust spread across the ground. A low-angle camera on the ground at a distance tilts up to follow it into a deep "
                "dusk sky; the flame light slides over the steel skin. The rocket stays centred and vertical, a clean silhouette. No "
                "people, no launch towers, no buildings, no lens-flare rays, no fog wall. Photoreal live-action cinema, crisp, no motion "
                "blur. No text, no logos, no watermark.")),
    "P35": dict(
        retake_note="take 1 drew a T-tail business jet, not a Concorde",
        prompt=("A Concorde supersonic airliner flying above a sea of clouds at dusk, seen in clean side profile: a long, very slender "
                "white fuselage with a sharply pointed needle nose that droops slightly downward; one large ogival delta wing, a smooth "
                "curved triangle set low on the fuselage, with four jet engines in two rectangular pairs under the wing; a single tall "
                "swept tail fin and NO horizontal tailplane at all; a row of small round cabin windows. Plain white, no markings, no "
                "logos, no lettering. The camera flies alongside at the same speed, the aircraft steady in the middle of the frame, "
                "nose toward frame right, the cloud tops streaming past below, a warm orange glow along the horizon and a darker sky "
                "above. Smooth and steady, no shake. Photoreal live-action cinema, crisp, no motion blur on the aircraft. No text, no "
                "logos, no watermark.")),
    "P38": dict(
        retake_note="takes 1-2: a dense wall of soldiers, no visible straggler or shrug (take 1 dropped blades in unison at 2.54 s; "
                    "take 2 never slammed); v2: nine distinct men, the straggler in the exact centre",
        prompt=("Medium-wide shot at eye level in warm golden light on a riverbank, the red-brown river behind them: one front row of "
                "nine soldiers stands shoulder to shoulder facing the camera, each clearly separate: four Lydians on the left dressed "
                "like reference image 1 (crested bronze helmets, crimson tunics, bronze scale corselets), four Medes on the right "
                "dressed like reference image 2 (red felt caps, ochre tunics, iron scale corselets), and in the exact centre a fifth "
                "Lydian, the straggler. Smaller ranks of both armies stand behind them. Everyone holds a short sword. 0-1.5 s: at "
                "rest. At 1.7 s all nine raise their swords high overhead in perfect unison and hold them up. At 2.9 s eight of them "
                "swing their swords down hard together and stab them point-first into the sand in front of their feet, where the "
                "blades stay standing upright in a row; the man in the exact centre is late: his sword is still raised, he glances left "
                "and right at the others, then at 3.4 s he stabs his sword into the sand too, a beat late, and gives a sheepish shrug "
                "with both shoulders and a small embarrassed grin. The ranks behind move with the front row. Camera static. "
                f"{SUN} {REAL} {SHEET_ONLY} {PERIOD} {NOTXT}")),
    "P41": dict(
        retake_note="take 1 closed BOTH eyes (happy squint); take 2 shut both eyes for 0.4 s before settling into a one-eye wink",
        prompt=(f"{ANIME} Close-up, head and shoulders, of {JADE}, facing the camera squarely, her desk and glowing monitors behind "
                "her in a dark room; reference image 2 shows her face and lighting, reference image 3 the one-eye wink. She stares "
                "straight into the lens, completely deadpan. Without looking away she reaches back with her right hand to the keyboard "
                "behind her and taps three keys blind (at 0.1 s, 0.7 s and 1.6 s), only her shoulder and arm moving, eyes locked on "
                "the camera. At 2.4 s the corner of her mouth curls into a small, mischievous half-smile. At 3.2 s she winks with ONE "
                "eye only: her right eye (on the left side of the frame) closes quickly, stays closed for half a second and opens "
                "again, while her left eye (on the right side of the frame) stays wide open, looking at the camera the whole time; "
                "both eyes are never closed at the same time. Then she holds the sly smile with both eyes open, looking at the camera, "
                "to the end. Light: cool pearl monitor glow from behind as a rim on her hair, warm orange desk lamp on her face. "
                "Camera static. No readable text, no captions, no watermark.")),
    "P07": dict(
        refs=["LYD", "MED"],
        retake_note="take 1: Lydians filled 2/3 of the frame (Medes cropped at the edge), bright sky behind",
        prompt=("Slow-motion, very low-angle shot at the waterline in the middle of a wide shallow ford of a red-brown clay river. The "
                "camera sits exactly halfway between two charging front lines: from the left the Lydian line, dressed like reference "
                "image 1 (crested bronze helmets, crimson tunics, round crimson shields with a black lion, spears levelled), splashes "
                "into the knee-deep water toward frame right; from the right the Median line, dressed like reference image 2 (red felt "
                "caps, ochre tunics, round wicker shields, spears levelled), splashes in toward frame left. Both lines are the same "
                "size, mirror images of each other, the closing gap in the centre of the frame; they do not meet. Legs churn the water, "
                "spray is thrown up and lit gold. The far bank behind them is in deep shadow, darker than the men. Camera static, just "
                f"above the water. {SUN} {REAL} High-frame-rate slow motion. {SHEET_ONLY} {PERIOD} {NOTXT}")),
    "P09": dict(
        refs=["LYD_CAV_H", "LYD_CAV"],
        retake_note="take 1: spears held up (not lowered), sun in frame with a bright sky (SHALLOWS board), blurred pass-by; "
                    "take 2 still raised the spears: v3 says level/horizontal and 'no spear points up'",
        prompt=("Low-angle shot from the water: Lydian cavalry charging through the knee-deep shallows of a red-brown river straight "
                "toward the camera. The riders are dressed like the man in reference images 1 and 2: open-faced crested bronze helmets, "
                "crimson tunics, bronze scale corselets, ochre cloaks, soft boots; they ride chestnut and bay horses bareback on crimson "
                "and ochre saddlecloths with bronze bridle fittings, NO stirrups, no saddles. Every rider levels a long 3-metre ash "
                "spear level and horizontal at shoulder height, aimed straight at the camera like a row of lances, the iron points leading; "
                "no spear points up at the sky. The lead horse is centred, five or six more follow "
                "in a staggered line; hooves explode the water into spray lit gold. The horses grow larger in frame and the lead horse "
                "fills a third of the frame by the end, still in frame and sharp (it does not pass the camera). The far bank behind "
                f"them is in deep shadow, darker than the riders. Camera static, low, just above the water. {SUN} {REAL} {SHEET_ONLY} "
                f"{PERIOD} {NOTXT}")),
    "P13": dict(
        refs=["LYD", "MED"],
        retake_note="take 1 backlit with the sun in frame (SHALLOWS board); action fine",
        prompt=(f"Medium-wide, side-on shot in the knee-deep red-brown shallows of a river. {LYD_S.format(n=1)[0].upper() + LYD_S.format(n=1)[1:]} "
                f"fights {MED_S.format(n=2)}. At 0.9 s the Mede slams his wicker shield into the Lydian, who falls backward into the "
                "water with a big splash; at 2.0 s the Mede drives his spear down at him; the Lydian rolls sideways, clear, and the "
                "spear stabs into the water where he was, throwing up spray; by 3.5 s the Lydian is up on one knee, shield raised, "
                "water streaming off him, facing the Mede again. Clear, readable action with sharp stops, no blood. The far bank is in "
                f"deep shadow, darker than the fighters. Camera static, slightly low. {SUN} {REAL} {SHEET_ONLY} {NOTXT}")),
}
for _k, _v in RETAKES.items():
    PLATES[_k]["prompt_v1"] = PLATES[_k]["prompt"]
    PLATES[_k]["refs_v1"] = PLATES[_k].get("refs")
    PLATES[_k].update(_v)

RETAKES2 = {
    "P46": dict(
        retake_note="takes 1-2: reactions unbalanced (take 1 mostly Lydian, take 2 mostly Median kneelers), take 2 drew a bright "
                    "corona; take 3 (4+4 by nationality) still put every kneeling/prostrate pose on a red cap, the horse did not rear "
                    "and the orbit was ~10 degrees; v3 assigns each pose by COSTUME and asks for a wider arc",
        prompt=("Frozen time during a total solar eclipse: a Baroque sculpture group of eight warriors on a stony riverbank, every "
                "figure completely motionless like a statue, arranged from left to right: (1) a man in a crested bronze helmet and a "
                "crimson tunic kneels with both arms raised to the sky, palms up; (2) a man in a red felt cap and an ochre tunic stands "
                "pointing up at the sky, mouth open in a shout; (3) at the centre the man in the crested bronze helmet from reference "
                "image 1 and (4) the man in the red felt cap from reference image 2, stopped mid-strike with their spears crossed, both "
                "faces turned up to the sky; (5) a man in a red felt cap and an ochre tunic kneels with both arms raised, palms up; "
                "(6) a man in a crested bronze helmet and a crimson tunic covers his eyes with his forearm; (7) a man in a red felt cap "
                "lies prostrate with his forehead on the river stones; (8) behind them a rider in a crested bronze helmet like reference "
                "image 3, his chestnut horse frozen high on its hind legs, front hooves in the air. Nothing moves at all: no breathing, "
                "no cloth, no hair, no water. The sky is empty and dark: no sun, no moon. Only the camera moves: a slow, smooth arc of "
                "about 30 degrees around the group from left to right over the 8 seconds, at chest height, clearly showing the group "
                f"from a new side by the end, every figure staying in frame. {DUSK} Photoreal live-action bullet-time, crisp, no "
                f"motion blur. {SHEET_ONLY} {PERIOD} {NOTXT}")),
}
for _k, _v in RETAKES2.items():
    PLATES[_k]["prompt_v1"] = PLATES[_k]["prompt"]
    PLATES[_k].update(_v)

# ---------------------------------------------------------------- Thales redesign (director, 2026-10-03): he read as Jesus
# New canonical sheet media/chars/thales.jpg (= media/boards/chars/thales3_t1.jpg; the old one is media/chars/thales_v1.jpg):
# short curly hair with a thin fillet, trimmed curly beard, saffron himation with a dark woven border, wax tablet + short gnomon.
THALES2 = ("Thales of Miletus, the man from reference image 1 (about 40, SHORT CURLY dark hair bound with a thin fillet, a short "
           "trimmed curly beard, a lively, clever face; a saffron-ochre wool himation with a dark woven border over an undyed "
           "cream chiton, leather sandals; a wax tablet in his left hand and a short wooden shadow-stick, a gnomon about 40 cm "
           "long, in his right hand; no long staff, no red robe, no long hair)")
RETAKES3 = {
    "P27": dict(
        retake_note="Thales redesign: v1/v2 used the old sheet (long knotted hair, terracotta mantle, long staff), which read as "
                    "Jesus; v3 uses the new philosopher-herm sheet and keeps v2's static camera and explicit steps",
        prompt=(f"During a total solar eclipse, on a flat riverbank, {THALES2} walks toward the camera: four slow, clear steps (left "
                "foot, right foot, left, right), the shadow-stick in his right hand, tablet in his left, his face tilted up to the "
                "sky with sharp, amused curiosity, as if checking a calculation. He walks along a path between warriors frozen like "
                "statues mid-battle on both sides of him: a Lydian like reference image 2 (crested bronze helmet, crimson tunic, lion "
                "shield) frozen mid-thrust on the left, a Mede like reference image 3 (red felt cap, ochre tunic, wicker shield) "
                "frozen behind his shield on the right, more frozen warriors further back. The warriors are completely motionless; "
                f"Thales is the only thing that moves. {DUSK} He is lit a little warmer than the frozen men. Camera static on a "
                f"tripod at chest height: he starts in the middle distance and ends in a medium shot. {REAL} {SHEET_ONLY} {NOTXT}")),
    "P28": dict(
        retake_note="Thales redesign: takes 1-2 used the old Jesus-like sheet; v2 uses the new philosopher-herm sheet",
        prompt=(f"Medium close-up of {THALES2}, standing among motionless warriors (dark shapes behind him) during a total solar "
                "eclipse. Readable dusk light: dim twilight from above and a warm orange glow from the horizon on one side of his "
                "face, the face clearly lit. 0-3 s: he looks up at the sky, studying it with quick, intelligent eyes, tapping the "
                "shadow-stick against the tablet as if confirming a calculation. At 3.0 s he lowers his gaze and looks straight into "
                "the camera lens with a knowing look and the hint of a sly smile, one eyebrow slightly raised, and holds it to the "
                f"end. Camera static, very slow push-in. {REAL} Natural skin. {NOSING} {SHEET_ONLY} {NOTXT}")),
}
for _k, _v in RETAKES3.items():
    PLATES[_k]["prompt_v2"] = PLATES[_k]["prompt"]
    PLATES[_k].update(_v)

# ---------------------------------------------------------------- v2 revision, ACT1 (production/REVISION_V2.md decisions 2-3)
# S17/S18: a battle, not a duel (the director: "background characters should also be fighting"); S28: pairs caught
# mid-fight look up one after another ("mid action, not standing in a row"). No SHALLOWS board (it turned P12/P13 into
# contre-jour): the river is described in words. Audio windows put each asked-for action on its musical hit
# (P48: 2.0 s = the 46.06 beat; P50: 1.5 / 2.0 / 2.5 s = "halo" 89.78, "in" 90.23, "sky" 90.87; 3.0 s = the 91.31 boom).
ACT1_SUN = ("Hard, low golden sun raking in from frame right (the sun itself just beyond the right edge of the frame), long "
            "shadows, warm rim light; the far bank behind the melee in deep shadow, darker than the men. Clear air: no fog, no "
            "haze, no smoke.")
PLATES.update({
    "P48": dict(
        duration=5, takes=2, refs=["LYD", "MED"], avatar=True, audio=a(44.06), t_song=[44.06, 49.06], shots="S17",
        sync=[[46.057, "beat: the Mede's thrust turned by the lion shield (plate 2.0)"], [48.217, "downbeat: the Lydian's counter (plate 4.16)"]],
        prompt=("Medium-wide side-on shot, waist height, in the knee-deep red-brown shallows of a river ford. Foreground centre: "
                f"two duelists, full figures, mirrored, equal in size: on the left {LYD_S.format(n=1)} with a spear, facing right; on the "
                f"right {MED_S.format(n=2)} with a spear, facing left. Behind them, smaller and further back, the two battle lines fight "
                "across the whole width of the frame in the water: Lydians (crested bronze helmets, crimson tunics, lion shields) against "
                "Medes (red felt caps, ochre tunics, wicker shields), pair against pair, spears thrusting, shields slamming, swords swung, "
                "men shoving and splashing; nobody in the background stands still or watches the duel. Open water separates the duel from "
                "the melee. The duel: 0-1.8 s they circle, shields up, spears levelled; at exactly 2.0 s, on a beat of the reference "
                "audio, the Mede lunges and thrusts his spear at the Lydian's chest and the Lydian swings his lion shield across and turns "
                "the point aside: a sharp stop, a burst of spray; 2.3-3.8 s they recover and circle; at 4.0 s the Lydian thrusts back and "
                "the Mede catches it on his wicker shield. Every strike ends in a sharp stop. Camera static, slightly low. "
                f"{ACT1_SUN} {REAL} No blood. {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="S17 v2: P12's first exchange in front of the two battle lines fighting in the shallows (decision 2)."),
    "P49": dict(
        duration=6, takes=2, refs=["LYD", "MED"], avatar=True, audio=a(46.49), t_song=[46.49, 52.49], shots="S18",
        sync=[[46.49, "first contact: S18 cut in (plate 0)"], [51.72, "S18 cut out (plate 5.23)"]],
        prompt=("Extreme long-lens telephoto shot from far away at ground level, camera completely static. A flat, straight horizon (the "
                "crest of a low riverbank) crosses the frame in its lower fifth; above it a huge low golden sun sits just above the "
                "horizon in the centre of the frame, the sky around it bright orange and gold. Along the whole horizon, from the left edge "
                "of the frame to the right edge, a long line of small warriors fights in pure black silhouette against the bright sky: "
                "Lydians like reference image 1 (crested Corinthian helmets, round shields, spears) coming from the left and Medes like "
                "reference image 2 (soft rounded felt caps, round wicker shields, spears) from the right, locked in combat in pairs and "
                "small groups all along the line: spears thrusting, shields clashing, a sword raised and swung down, two men grappling, "
                "one shoving another back, a man stumbling and getting up again. Every figure keeps fighting the whole time; nobody "
                "looks up and nobody stops. Each figure is a crisp, separate silhouette standing on the horizon line, legs, arms, crests "
                "and weapons readable, bright sky visible between the figures; all of them the same small size, about one sixth of the "
                "frame height. No dust, no fog, no haze, no heat shimmer, no birds. Photoreal live-action cinema, crisp, high shutter "
                f"speed, no motion blur. {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="S18 v2: the fighting line along the horizon under the low sun (mattes -> silhouettes; the renderer paints the sun and its bite)."),
    "P50": dict(
        duration=5, takes=2, refs=["LYD", "MED"], avatar=True, audio=a(88.28), t_song=[88.28, 93.28], shots="S28",
        sync=[[89.78, "'halo': the left pair looks up (plate 1.5)"], [90.225, "'in': the centre pair (plate 1.95)"],
              [90.87, "'sky': the right pair (plate 2.59)"], [91.31, "boom 'warriors': all faces up, cut (plate 3.03)"]],
        prompt=("Low-angle medium-wide shot, camera at waist height, in the knee-deep red-brown shallows of a river during a deep partial "
                "solar eclipse: the light is strangely dim and metallic, a cold silvery-gold light from a low sun beyond the top right "
                "corner of the frame (the sun is not in the frame), crisp hard shadows, colours drained; the empty sky, deep steel-blue, "
                "fills the upper third of the frame; faces and costumes stay clearly readable. Three pairs of warriors fight side by side "
                "across the frame, knees up, each pair one Lydian like reference image 1 (crested bronze helmet pushed up so the face "
                "shows, crimson tunic, bronze scale corselet, crimson lion shield) against one Mede like reference image 2 (red felt cap, "
                "black curly beard, ochre tunic, iron scale corselet, wicker shield): on the left a Mede's spear thrust caught on the "
                "Lydian's lion shield, both straining against it; in the centre a Lydian with his short sword raised high over his head "
                "to strike, the Mede bracing under his wicker shield; on the right a Lydian and a Mede grappling, gripping each other's "
                "wrists and shoulders, shoving. 0-1.4 s: all three pairs fight hard, pushing and straining, feet churning the water. Then "
                "one pair after another stops mid-action and both men turn their faces up to the sky at the top right, in wonder, their "
                "bodies still locked in the same pose: at 1.5 s the left pair (spear still on the shield), at 2.0 s the centre pair "
                "(sword still raised), at 2.5 s the right pair (still gripping). From 3.0 s all six stare up, frozen mid-fight, breathing "
                f"hard. Big, clear head movements. Camera static. {REAL} {NOSING} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="S28 v2 (replaces P18's row of six): pairs locked mid-combat look up one after another (decision 3)."),
})

# ---------------------------------------------------------------- v2 follow-up, ACT1: the rest of Act I's lone duels (decision 2's principle)
# S19, S21 and S25 also showed a lone duel on empty water. P60 / P61 continue P48's shot (its frames 97 / 84 as first frames:
# the same duelists, light and battle behind them) into S19's flurry on the beats and S21's knock-down; P62 continues P15's
# own face-off (its first frame) while the ranks on the far bank crash into a melee, so the cut at 77.88 to P15's shore melee
# still matches. First frame + audio only (as P58): the first frame carries identity and costume.
ACT1_LIGHT = "Hard, low golden sun from frame right, warm rim light, long shadows; clear air, no fog, no haze."
ACT1_DUEL = ("the Lydian on the left (crested bronze helmet, crimson tunic, bronze scale corselet, round crimson lion shield, spear) and "
             "the Mede on the right (red felt cap, black beard, ochre tunic, iron scale corselet, round wicker shield, spear)")
PLATES.update({
    "P60": dict(
        duration=5, takes=2, first_frame="media/plates/P60/ff_P48t1_f097.jpg", audio=a(51.27), t_song=[51.27, 56.27], shots="S19",
        sync=[[52.166, "beat: strike 1 (plate 0.90)"], [52.596, "beat: strike 2 (plate 1.33)"], [53.466, "downbeat: shields slam (plate 2.20)"],
              [54.346, "beat: strike 4 (plate 3.08)"], [54.776, "beat: strike 5 (plate 3.51)"]],
        prompt=("The same shot continues from the first frame: side-on at waist height in the knee-deep red-brown shallows, "
                f"{ACT1_DUEL}, full figures, mirrored; behind them both battle lines keep fighting in the water across the whole frame, "
                "nobody stands still. The duel speeds up into five fast, clear exchanges, one on each drum beat of the reference audio: "
                "at 0.9 s the Lydian thrusts and the Mede catches the point on his wicker shield; at 1.3 s the Mede thrusts back and the "
                "Lydian turns it with his lion shield; at 2.2 s they slam shield against shield and the water bursts up in a gold spray; "
                "at 3.1 s the Mede swings his spear shaft and the Lydian blocks it; at 3.5 s the Lydian thrusts low and the Mede jumps "
                f"back. Every strike ends in a sharp stop, never a blur. Camera static. {ACT1_LIGHT} {REAL} No blood. {PERIOD} {NOTXT}"),
        notes="S19 v2: P48's duel continues as five exchanges on the beats, the battle behind them."),
    "P61": dict(
        duration=5, takes=2, first_frame="media/plates/P61/ff_P48t1_f084.jpg", audio=a(58.72), t_song=[58.72, 63.72], shots="S21",
        sync=[[59.60, "timpani: knocked down (plate 0.88)"], [62.20, "cut out: up on one knee (plate 3.48)"]],
        prompt=("The same shot continues from the first frame: side-on at waist height in the knee-deep red-brown shallows, "
                f"{ACT1_DUEL}; behind them both battle lines keep fighting in the water across the whole frame. At 0.9 s, on the drum "
                "hit of the reference audio, the Mede charges and slams his wicker shield into the Lydian, who falls backward into the "
                "water with a big splash; at 2.0 s the Mede drives his spear down at him; the Lydian rolls sideways, clear, and the spear "
                "stabs into the water where he was, throwing up spray; by 3.5 s the Lydian is up on one knee, shield raised, water "
                "streaming off him, facing the Mede again. Clear, readable action with sharp stops, no blood. Camera static. "
                f"{ACT1_LIGHT} {REAL} {PERIOD} {NOTXT}"),
        notes="S21 v2: P13's knock-down, in P48's shot, the battle behind them."),
    "P62": dict(
        duration=5, takes=2, first_frame="media/plates/P62/ff_P15t2_f001.jpg", audio=a(74.41), t_song=[74.41, 79.41], shots="S25",
        sync=[[74.655, "'Lydians' (plate 0.25)"], [75.925, "'Medes' (plate 1.52)"], [77.88, "cut to P15's shore melee (plate 3.47)"]],
        prompt=("The same shot continues from the first frame: a symmetrical face-off in the knee-deep red-brown shallows, "
                f"{ACT1_DUEL.replace('on the left (', 'on the left in profile facing right (').replace('on the right (', 'on the right in profile facing left (')}, "
                "exactly centred and mirrored, shields up, spear points lowered toward each other; they step slowly sideways, circling, "
                "eyes locked, and do not strike. Behind them, on the gravel bank across the water, the two lines fight from the first "
                "second: Lydians (crested helmets, crimson tunics, lion shields) and Medes (red caps, ochre tunics, wicker shields) clash "
                "all along the bank, spears thrusting, shields slamming, men falling, dust kicked up; the melee fills the whole width of "
                f"the far bank. Camera static. Low golden sun at frame right, long shadows, clear air. {REAL} No blood. {PERIOD} {NOTXT}"),
        notes="S25 v2: P15's mirrored face-off, now with the melee raging on the shore behind them."),
})
# P62 retake: with P15's first frame the far bank stayed a line of soldiers in stances (the first frame's ranks anchored it);
# v2 drops the first frame and describes the melee raging from the first frame, the costumes from the sheets
PLATES["P62"]["prompt_v1"] = PLATES["P62"]["prompt"]
PLATES["P62"]["first_frame_v1"] = PLATES["P62"].pop("first_frame")
PLATES["P62"].update(
    refs=["LYD", "MED"], avatar=True,
    retake_note="takes 1-2 (first frame = P15 take 2 f1): the far bank stays a line of soldiers in fighting stances, not a melee",
    prompt=("Medium-wide shot, camera static at waist height, in the knee-deep red-brown shallows of a river in the late afternoon: "
            f"a symmetrical face-off. {LYD_S.format(n=1)[0].upper() + LYD_S.format(n=1)[1:]}, holding a spear, stands on the left in "
            f"profile facing right; {MED_S.format(n=2)}, holding a spear, stands on the right in profile facing left. Exactly centred "
            "and mirrored, full figures, shields up, spear points lowered toward each other, the gap between them in the middle of the "
            "frame; they step slowly sideways, circling, eyes locked, and do not strike. Behind them, across the water on a gravel bank, "
            "a raging battle fills the whole width of the frame from the very first frame: dozens of Lydians (crested bronze helmets, "
            "crimson tunics, lion shields) and Medes (red felt caps, ochre tunics, wicker shields) locked in combat in pairs and knots, "
            "spears thrusting, shields slamming, swords swung, men shoving, falling and getting up again, dust kicked up; it never "
            "pauses and nobody watches the two men in the water. Low golden sun at frame right, long shadows, warm rim light, clear "
            f"air. {REAL} No blood. {NOSING} {SHEET_ONLY} {PERIOD} {NOTXT}"))

# ---------------------------------------------------------------- v2 revision, GOLD (production/REVISION_V2.md decision 5)
# "Bronze was precious: nobody throws it away." Caught mid-action, shocked, they let go: weapons FALL from opening hands,
# never thrown; no shrug, no posing, serious faces. S61 the wide drop (P51), S61b one hand opens over the held "blade"
# (P52), S62 the dropped sword stands point-down in the mud while its owner walks home (P53: the upright blade is the
# vertical that match-cuts to the rocket at 215.29), S75-S76 a battle line caught mid-fight drops every blade on BLADE,
# one late on the 261.05 hit (P54). No set board (boards act like first frames): the river is described in words.
GOLD_SUN = ("Hard, low golden sun raking in from frame right (the sun itself just beyond the right edge of the frame), long "
            "shadows, warm rim light; the far bank and background in deep shadow, darker than the men. Clear air: no fog, no "
            "haze, no smoke.")
DROP = "Nobody throws anything: the weapons simply fall straight down out of the opening hands."
PLATES.update({
    "P51": dict(
        duration=5, takes=2, refs=["LYD", "MED"], avatar=True, audio=a(208.70), t_song=[208.70, 213.70], shots="S61",
        sync=[[208.70, "'Throw': S61 cut in, mid-fight (plate 0)"], [209.945, "'blade': the weapons land (plate 1.25)"],
              [210.177, "low end out: cut to S61b (plate 1.48)"]],
        prompt=("Medium-wide shot at waist height at the edge of a red-brown clay river in warm golden evening light: the warriors "
                "stand in shin-deep water and on the muddy bank. Lydians dressed like reference image 1 (crested bronze helmets "
                "pushed up so the faces show, crimson tunics, bronze scale corselets, round crimson lion shields) come from the left "
                "facing right; Medes dressed like reference image 2 (red felt caps, black beards, long-sleeved ochre tunics, iron "
                "scale corselets, round wicker shields) come from the right facing left; short straight swords and spears. Mirrored "
                "composition: in the exact centre of the frame one Lydian and one Mede fight face to face, full figures; more pairs "
                "fight on both sides of them and behind them. 0-0.8 s: everyone fights hard, mid-action: the centre Lydian swings his "
                "sword down onto the Mede's shield, spears thrust, shields slam, water splashes. At 0.9 s every man stops dead in the "
                "middle of his movement, shocked, eyes wide, staring at the man in front of him. At 1.2 s all their fingers open at "
                f"once and the weapons drop: spears clatter onto the mud of the bank, swords splash into the shallows. {DROP} Then "
                "they stand still, empty-handed, arms hanging, stunned and serious, breathing hard, to the end. High-frame-rate slow "
                f"motion. Camera static. {GOLD_SUN} {REAL} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="S61 v2: shocked mid-fight, both lines let go; weapons fall onto the bank and into the shallows (never thrown)."),
    "P52": dict(
        duration=4, takes=2, refs=["LYD"], avatar=True, audio=a(210.18), t_song=[210.18, 214.18], shots="S61b",
        sync=[[210.18, "the held 'blade': S61b cut in (plate 0)"], [210.55, "the fingers open (plate ~0.4)"],
              [211.0, "the point enters the water (plate ~0.8)"], [211.44, "'Home': cut out (plate 1.26)"]],
        prompt=("Close-up at water level in a shin-deep red-brown river, in warm, low golden light. The right hand of the Lydian "
                "from reference image 1 (bare forearm, the edge of his crimson tunic sleeve and bronze scales at the top edge of the "
                "frame) holds a short straight sword by its dark wrapped grip, point down, the blade hanging straight down just above "
                "the water, the bronze cross-guard under his fist. At 0.3 s his fingers slowly open; the sword slips out of his hand "
                "and drops straight down, point first; at 0.8 s the point pierces the water with a small bright splash and sinks into "
                "the soft mud of the riverbed, and the sword stays standing upright in the water, the hilt and most of the blade above "
                "the surface, swaying slightly as it comes to rest. Rings spread across the water, lit gold. The empty hand stays open "
                "above it, fingers spread, still, to the end. The sword is centred in the frame; behind it the far bank is dark. An "
                "anatomically correct hand with five fingers. High-frame-rate slow motion. Camera static, just above the water "
                f"surface. {GOLD_SUN} {REAL} {NOSING} {SHEET_ONLY} {NOTXT}"),
        notes="S61b v2: one hand opens and its sword drops point-first into the shallows, standing in the mud (sets up S62)."),
    "P53": dict(
        duration=5, takes=2, refs=["LYD"], avatar=True, audio=a(211.44), t_song=[211.44, 216.44], shots="S62 (-> S63 match cut)",
        sync=[[211.44, "'Home': he turns away (plate 0)"], [211.877, "beat returns (plate 0.44)"],
              [215.287, "Drop 2 kick: match cut to the rocket (plate 3.85)"]],
        prompt=("Low-angle shot from just above the mud at the edge of a red-brown river in warm golden evening light, the camera "
                "completely static. In the foreground, in the exact centre of the frame, a short straight sword stands upright, point "
                "down, its blade stuck in the wet mud where ankle-deep water laps the bank: the bronze cross-guard, the dark wrapped "
                "grip and the round pommel at the top, the blade going straight down into the mud. The sword fills about one fifth "
                "of the frame height, its pommel a little above the centre of the frame; it stands perfectly vertical and never "
                "moves. Just behind it stands its owner, the Lydian from reference image 1 (crested bronze helmet pushed up, long "
                "braids, crimson tunic, bronze scale corselet, crimson lion shield on his arm), seen from the knees down at first, "
                "looking down at the sword. At 0.4 s he turns and walks away from the camera, unhurried, with slow, clear steps, up "
                "the bank and away into the distance toward the right, never looking back, leaving the sword where it stands; his "
                "long shadow stretches back toward it. By 3.5 s he is a small full figure in the right half of the frame. Further "
                "away, small figures of other Lydians and Medes walk off empty-handed in both directions. Above the bank a golden "
                f"sky with tall glowing clouds. {GOLD_SUN} Deep focus: the sword and the walking man both sharp. {REAL} "
                f"{SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="S62 v2: the upright sword (a vertical at the frame centre) stays; its owner walks home. Match cut to P34/S63."),
    "P54": dict(
        duration=5, takes=2, refs=["LYD", "MED"], avatar=True, audio=a(259.355), t_song=[259.355, 264.355], shots="S75, S76",
        sync=[[259.355, "the hit: S75 cut in, mid-fight (plate 0)"], [259.775, "THROW DOWN chop (plate 0.42)"],
              [260.625, "BLADE: every blade drops at once (plate 1.27)"], [261.045, "hit: the late blade lands (plate 1.69)"],
              [262.724, "boom: S77 pull-back (plate 3.37)"]],
        prompt=("Shot at head height looking straight along a battle line on a sandy riverbank in warm golden evening light, the "
                "red-brown river behind. Two armies fight face to face along a line that runs from the foreground straight away from "
                "the camera into the distance: on the left Lydians like reference image 1 (crested bronze helmets pushed up, crimson "
                "tunics, bronze scale corselets, crimson lion shields) facing right; on the right Medes like reference image 2 (red "
                "felt caps, black beards, ochre tunics, iron scale corselets, wicker shields) facing left; each man holds a short "
                "straight sword or a spear. Mirror-symmetric: the nearest pair stands in the centre foreground, full figures about "
                "two thirds of the frame height; pair after pair recedes behind them. 0-1.2 s: everyone fights hard, mid-action: "
                "swords swing against shields, spears thrust, shields slam, sand flies. At 1.3 s every man along the whole line stops "
                "dead and opens his hand at the same instant: every sword and spear drops straight down to the sand at once. "
                f"{DROP} One man is late: the Mede of the nearest pair keeps his grip a moment longer; at 1.7 s his fingers open and "
                "his sword drops alone. Then all stand still, empty-handed, facing the enemy, serious and stunned, breathing hard, to "
                f"the end. No smiles, no shrugs, no posing. Camera static. {GOLD_SUN} {REAL} {SHEET_ONLY} {PERIOD} {NOTXT}"),
        notes="S75-S76 v2 (replaces P38's formation and shrug): a battle line mid-fight; every blade drops on BLADE, one late."),
})

# ---------------------------------------------------------------- v2 revision, TREATY (production/REVISION_V2.md decision 7)
# S79 (270.04-273.40) goes back in-universe: Alyattes and Cyaxares swear the peace (Herodotus 1.74: sworn compacts as the
# Greeks make them, plus cut arms). The gesture is the right-hand clasp (dexiosis), the pledge of Greek and Near Eastern
# reliefs, with one thin fresh cut on each bare forearm; no licking, no gore. Reference image 1 is the keyframe still
# media/plates/P55/key_t4.jpg (Nano Banana Pro from the two kings' sheets plus a composite of the mediators' sheets,
# media/plates/P55/ref_mediators.jpg): a board in the references acts like a first frame, which is what we want here. The
# audio is the sound-design master from 269.54 (the final chord 270.04 = plate 0.50; the freeze 271.6 = plate 2.06).
PLATES.update({
    "P55": dict(
        duration=5, takes=2, avatar=True,
        refs=["media/plates/P55/key_t4.jpg", "ALYATTES", "CYAXARES", "media/plates/P55/ref_mediators.jpg"],
        audio=a(269.54, 5.0, src="media/stems/halys_sd_master.wav"), t_song=[269.54, 274.54], shots="S79",
        sync=[[270.04, "the final chord: one firm shake seals the clasp (plate 0.50)"], [271.6, "the chord freezes (plate 2.06)"],
              [273.40, "cut to S80 (plate 3.86)"]],
        prompt=("The video opens exactly on reference image 1: the same two kings, costumes, gesture, mediators, riverbank, light "
                "and framing. Medium-close two-shot at chest height on a gravel riverbank at dusk, just after a solar eclipse. On "
                "the left Alyattes, king of Lydia, the man of reference image 2 (gold fillet, long grey-streaked crimped tresses, "
                "full grey beard, white linen chiton, deep purple mantle with a gold meander border, gold lion-head bracelet), "
                "facing right; on the right Cyaxares, king of the Medes, the man of reference image 3 (madder-red felt cap with a "
                "gold diadem band, grey roll of curls at the nape, long curled grey beard, saffron tunic embroidered with winged "
                "lions, ochre cape, gold lion torque), facing left. They clasp right hands in a level handshake between them; each "
                "bare forearm shows one thin fresh red cut. Behind them, near the left and right edges and half in shadow, the two "
                "mediators of reference image 4 stand still and watch. Action: 0-0.4 s they stand still, hands clasped. At 0.5 s, "
                "on the loud chord of the reference audio, they give the clasped hands one firm, slow downward shake, sealing the "
                "oath, and Alyattes presses his left hand to his chest. Then they hold completely still to the end, hands clasped, "
                "eyes locked, grave and calm; only breathing and the faint ripple of the river. Nobody speaks; nobody brings an arm "
                "to the mouth; no licking, no gore. Camera: a very slow, steady push-in toward the clasped hands; no cuts, no "
                "shake. One warm, low golden key light from behind the camera, a little above, on the clasp and both faces "
                "equally; the river and the far bank behind them darker than the figures. Clear air, no fog. Photoreal live-action "
                f"cinema, crisp, high shutter speed, no motion blur. Reference images 2-4 are identity and costume references only. "
                f"{PERIOD} {NOTXT}"),
        notes="S79 v2: the kings' oath; the clasp seals on the final chord, then a held, solemn two-shot through the frozen chord."),
})

# ---------------------------------------------------------------- v2 revision, ROOM (production/REVISION_V2.md decisions 6 and 8)
# She is anime. Each plate starts from an anime keyframe made with nano-banana-pro (media/plates/<id>/K*.jpg, prompt and refs in
# the .json beside it): P39 f40 / P41 f22 redrawn so she matches the character sheet. K78d: her hair ends at the top of the
# circle, the light-blue circle and RARE EARTH are fully visible, the 1420 MHz patch is on her LEFT sleeve (K78b + a paint-over
# guide -> K78d). K80b: the closed-lip, one-corner-up smirk of the director's reference photo; the photo was shown to the image
# model only, as an expression reference, and is never sent to Seedance. The renderer draws the wink itself (eye.js), so P58
# keeps both eyes open.
ANIME_FF = ("Anime style with clean cel shading and crisp tapered line art exactly like the first frame: flat cel colours, one "
            "shadow tone, painted flat backgrounds, no depth-of-field blur, no yellow cast.")
PLATES.update({
    "P57": dict(
        duration=4, takes=2, first_frame="media/plates/P57/K78d_ff.jpg", audio=a(266.12), t_song=[266.12, 270.12], shots="S78",
        sync=[[266.12, "ticking build: she types, one terminal line per tick"],
              [268.081, "dt.shift: she leans toward the vertical monitor (plate 1.96)"],
              [269.288, "the commit burst: fast typing (plate 3.17)"]],
        prompt=(f"{ANIME_FF} The first frame is the start of the shot: a small dark apartment room at night seen from behind her "
                "desk chair. The young woman of the first frame sits with her back to the camera and types steadily on the "
                "mechanical keyboard with both hands, her head moving slightly as she reads the scrolling screen. Her shoulders "
                "and arms move with the typing, so the folds and creases of her white jacket shift, and the light-blue circle and "
                "the RARE EARTH lettering printed on her back move and bend with the fabric; the round 1420 MHz patch stays "
                "stitched on her left sleeve (the arm on the left side of the picture) and moves with that arm. At 2.0 s she leans "
                "in a little toward the vertical monitor on the right, then settles back; from 3.1 s she types fast. Her hair "
                "keeps exactly its length, ending at the top of the circle. Camera static, locked off. The screens show no "
                "readable text. No captions, no watermark."),
        notes="From the K78d keyframe (first frame). Only she is used: the room stays P39's painted background (registered)."),
    "P58": dict(
        duration=5, takes=2, first_frame="media/plates/P58/K80b_ff.jpg", audio=a(273.4, src="media/stems/halys_sd_master.wav"),
        t_song=[273.4, 278.4], shots="S80, S81",
        sync=[[273.45, "key 1 (plate 0.05)"], [274.05, "key 2 (plate 0.65)"], [274.95, "key 3, enter (plate 1.55)"],
              [276.95, "the ting: the drawn wink shuts (plate 3.55)"]],
        prompt=(f"{ANIME_FF} Close-up, head and shoulders, of the young woman of the first frame, facing the camera with her head "
                "tilted slightly, the dark room with the glowing monitor and the warm desk lamp behind her. The whole time she "
                "wears the same knowing, mischievous closed-lip smirk (one corner of her mouth curled up), her eyes slightly "
                "narrowed and locked on the lens. Without looking away she reaches back with her right hand (the shoulder on the "
                "left side of the picture) to the keyboard behind her and taps three keys blind, at 0.05 s, 0.65 s and 1.55 s: "
                "on each tap that shoulder dips a little; only her shoulder and arm move. Then she holds still, smirking at the "
                "camera, to the end; at 3.0 s the smirk deepens very slightly. She does not blink, does not wink and does not "
                "open her mouth. Light: cool pearl monitor glow from behind as a rim on her hair, warm orange desk lamp on her "
                "face. Camera static. No text, no captions, no watermark."),
        notes="From the K80b keyframe (first frame). Both eyes stay open: the renderer draws the eclipse wink on 276.95."),
})

# GOLD retakes (review 2026-10-03): the first prompt is kept in `prompt_v1`, the reason in `retake_note`.
GOLD_RETAKES = {
    "P54": dict(
        retake_note="takes 1-2: take 2 drops every blade at once (the corridor of swords on the sand) but has no late one; "
                    "take 1 has a late Mede but the nearest pair turns to pose for the camera; v2 names the late one (the "
                    "nearest Mede, sword hand on the camera side) and forbids turning to the camera",
        prompt=("Head-height shot looking straight along a battle line on a sandy riverbank in warm golden evening light, the "
                "red-brown river behind. Two armies face each other along a line running from the foreground straight away into "
                "the distance: on the left Lydians like reference image 1 (crested bronze helmets pushed up, crimson tunics, "
                "bronze scale corselets, crimson lion shields) facing right; on the right Medes like reference image 2 (red felt "
                "caps, black beards, ochre tunics, iron scale corselets, wicker shields) facing left; each holds a short straight "
                "sword or a spear. Mirror-symmetric: the nearest pair in the centre foreground, full figures, pair after pair "
                "receding behind. Every man faces his opponent the whole time; nobody turns toward the camera. 0-1.2 s: all "
                "fight hard, mid-action: swords against shields, spear thrusts, sand flying. At 1.3 s every man except one stops "
                "dead and opens his hand at the same instant: swords and spears drop straight down to the sand at once. Nobody "
                "throws anything. The exception is the Mede of the nearest pair, right foreground, his sword in his right hand "
                "on the camera side: he alone keeps his grip a moment longer, staring at the blades on the sand; at 1.9 s his "
                "fingers open and his sword falls alone into the sand at his feet. Then all stand still, empty-handed, facing "
                "each other, serious and stunned, breathing hard. No smiles, no shrugs, no posing. Camera static. "
                f"{GOLD_SUN} {REAL} {SHEET_ONLY} {PERIOD} {NOTXT}")),
}
for _k, _v in GOLD_RETAKES.items():
    PLATES[_k]["prompt_v1"] = PLATES[_k]["prompt"]
    PLATES[_k].update(_v)

GOLD_RETAKES2 = {
    "P54": dict(
        retake_note="take 4 (v2) again dropped every blade at once with no late one (the near Mede's sword fell with the rest; "
                    "blades stuck upright in the sand); v3 makes two separate drops and names the late one as the nearest "
                    "Lydian, whose held-out sword stays visible in take 2's framing",
        prompt=("Head-height shot looking straight along a battle line on a sandy riverbank in warm golden evening light, the "
                "red-brown river behind. Two armies face each other along a line running from the foreground straight away into "
                "the distance: on the left Lydians like reference image 1 (crested bronze helmets pushed up, crimson tunics, "
                "bronze scale corselets, crimson lion shields) facing right; on the right Medes like reference image 2 (red felt "
                "caps, black beards, ochre tunics, iron scale corselets, wicker shields) facing left; each holds a short straight "
                "sword. Mirror-symmetric: the nearest pair in the foreground, full figures, pair after pair receding behind. Every "
                "man faces his opponent; nobody turns toward the camera. 0-1.2 s: all fight hard, mid-action, swords clashing on "
                "shields. Then two separate drops. FIRST, at 1.3 s: every man but one stops dead and opens his hand at the same "
                "instant, and their swords fall straight down to the sand together. Nobody throws anything. The one who does not "
                "let go is the nearest Lydian, in the left foreground: he stays frozen with his sword still held out toward his "
                "enemy while all the other swords already lie on the sand. SECOND, at 2.0 s: his fingers open and his sword falls "
                "alone, the last one, landing at his feet. Then all stand still, empty-handed, facing each other, serious and "
                "stunned, breathing hard. No smiles, no shrugs, no posing. Camera static. "
                f"{GOLD_SUN} {REAL} {SHEET_ONLY} {PERIOD} {NOTXT}")),
}
for _k, _v in GOLD_RETAKES2.items():
    PLATES[_k]["prompt_v2"] = PLATES[_k]["prompt"]
    PLATES[_k].update(_v)

# Every photoreal identity sheet trips Seedance's real-person filter (InputImageSensitiveContentDetected.PrivacyInformation,
# measured on the 2026-10-03 pilot: P01, P03, P12 all rejected at input, free); the virtual-avatar route then accepts them and
# keeps identity and costume. Go straight to it for plates that attach a photoreal sheet.
_PHOTOREAL = {"LYD", "MED", "LYD_CAV", "LYD_CAV_H", "MED_ARCH", "MED_CAV", "MED_CAV_H", "THALES", "ALYATTES", "CYAXARES"}
for _k, _v in PLATES.items():
    if set(_v.get("refs", [])) & _PHOTOREAL:
        _v.setdefault("avatar", True)

if __name__ == "__main__":
    for k, v in PLATES.items():
        n = len(v["prompt"])
        print(f"{k:18s} {n:5d} chars {'TOO LONG' if n > 2000 else ''}")
