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
        shots="S17, S19, S27, S36, S37",
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
        duration=5, refs=["LYD"], audio=a(81.36), t_song=[81.36, 86.36], shots="S26, S36",
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
