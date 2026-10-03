"""Concept style frames, one per world (targets for the JavaScript renderer). TREATMENT.md + RESEARCH.md section 5-6."""
from jobs import job, REFBOARDS, P, S

NBP = "google/nano-banana-pro"
GPT = "openai/gpt-image-2"
SDR = "bytedance/seedream-5-pro"
FLX = "black-forest-labs/flux-2-max"

REFBOARDS["marble"] = [(S + "met_253370_new-york-kouros_c590-580BC.jpg", None),
                       (S + "met_204758_canova_perseus-with-the-head-of-medusa_1804.jpg", None)]
REFBOARDS["caravaggio"] = [(P + "met_437986_caravaggio_denial-of-saint-peter_1610.jpg", None)]
REFBOARDS["rubens"] = [(P + "met_437536_rubens_wolf-and-fox-hunt_c1616.jpg", None)]

NOTXT = "No text, letters or watermark anywhere in the image."
WIDE = "sets/halys_wide2_t1.jpg"          # the master composition (set sheet), used as a layout reference
LYD = "chars/lydian_e1_t1.jpg"
MED = "chars/mede_e3_t1.jpg"


def frame(fid, models, prompt, refs=(), **params):
    for m in models:
        tag = {NBP: "nbp", GPT: "gpt", SDR: "sdr", FLX: "flx"}[m]
        job(f"{fid}_{tag}", m, "frames", prompt, refs=refs, **params)


# ---------------------------------------------------------------- F1 THE EYE (hook)
F1 = (
    "F1 THE EYE, the opening image of a music video, a painted cinematic frame. A total solar eclipse fills about 60% "
    "of the frame height, centred a little above the middle, and reads unmistakably as a giant eye looking at the "
    "viewer: the Moon's perfectly black, hard-edged disc is the pupil; the pearly-white corona around it is the iris, "
    "its fine silky streamers radiating outward exactly like the fibres of a human iris (radial striations, small "
    "crypts, a slightly darker limbal ring at the outer edge where the streamers fade into the night); a thin broken rim "
    "of pink-red prominences hugs the pupil like the inner ring of an iris. The corona is pearl white (#f3efe6) with "
    "warm ivory and faint orange tints, never blue. Below the eye, across the bottom fifth of the frame, a dark painted "
    "battlefield on a river plain at dusk: two armies of tiny figures with forests of upright spears on either bank of "
    "a dark red river that runs toward the eye, in dark umber with a thin orange glow along the horizon, painted like "
    "the distant armies in Altdorfer's Battle of Alexander at Issus. The sky around the eye is near-black umber-navy "
    "(#05070c). Oil paint with visible brushwork and glazes; not a photograph, not a lens flare, no starburst rays, no "
    "Eye-of-Providence triangle, no eyelids or eyelashes. " + NOTXT)
frame("f1_eye", [NBP, GPT, SDR], F1)

# ---------------------------------------------------------------- F2 BRONZE (master composition, Baroque)
F2 = (
    "F2 BRONZE: a Baroque oil painting on panel combining Caravaggio's tenebrism with the sky of Albrecht Altdorfer's "
    "Battle of Alexander at Issus, painted over the composition of the attached reference photograph. A high viewpoint "
    "looks straight down a red-brown river that runs from the bottom centre of the picture to a vanishing point on the "
    "horizon. Two vast armies are mirrored on the two banks: the Lydians on the left bank (crested bronze helmets, round "
    "dark-crimson shields with archaic lions, crimson tunics), the Medes on the right bank (soft madder-red felt caps, "
    "saffron tunics, round wicker shields, archers with bows); each army a sea of thousands of tiny figures with "
    "forests of upright spears whose points glint like Altdorfer's, with a gold lion standard on the left and a bronze "
    "horse standard on the right. The sun sits low on the horizon exactly above the river's vanishing point, partially "
    "eclipsed: a blazing thin crescent of light at its upper left, the rest a crisp black disc. Around it a vast "
    "Altdorfer vortex of cloud, burning gold, copper and vermilion near the sun and darkening to umber at the edges of "
    "the sky; the far horizon slightly curved, as if seen from impossible height. Below, Caravaggio tenebrism: the land "
    "in near-black umber shadow with raking golden light from the low sun picking out the front ranks, the spear points "
    "and the river; long shadows stretching toward the viewer. Hanging from the top edge of the sky on a cord, with a "
    "tassel beneath, is an Altdorfer-style painted tablet (cartouche) in pale parchment colour with a dark frame, "
    "inscribed in clean Roman inscriptional capitals with exactly three words: THE RIVER HALYS. Palette: umber, ochre, "
    "vermilion, bronze, lead white; no blue anywhere. Museum-quality old master painting, visible brushwork, glazes and "
    "fine detail; not a photograph. No other text or letters.")
frame("f2_bronze", [NBP, GPT, SDR], F2, refs=[WIDE])

# ---------------------------------------------------------------- F3 BRONZE CLOSE (Caravaggio duel)
F3 = (
    "F3 BRONZE CLOSE: an oil painting in the manner of Caravaggio (The Calling of Saint Matthew, The Denial of Saint "
    "Peter): a duel knee-deep in the shallow red-brown water of a river, at the instant before the eclipse stops it. On "
    "the left, THE LYDIAN of the first reference sheet: Corinthian bronze helmet pushed up on his head, long braided "
    "hair, crimson chiton, bronze-scale corselet, round dark-crimson shield with an archaic black lion, spear. On the "
    "right, THE MEDE of the second reference sheet: soft madder-red felt cap, curly black beard, saffron long-sleeved "
    "tunic, iron-scale corselet, round wicker shield, spear. They face each other at close quarters, spears crossed, "
    "shields up, both caught mid-movement with water splashing around their legs, and both are beginning to glance up. "
    "Three-quarter-length figures cropped tight. A single raking beam of low golden light from the upper left picks out "
    "their faces, the bronze, the wet spear blades and the drops of red water; everything else falls into near-black "
    "warm umber darkness. Both men equally noble, faces individual, weathered and human, neither a villain. Visible "
    "impasto: thick, loaded paint in the highlights, thin dark glazes in the shadows, canvas texture. Palette: umber, "
    "ochre, vermilion, bronze, lead white; no blue. " + NOTXT)
frame("f3_duel", [NBP, GPT, SDR], F3, refs=[LYD, MED, "board:caravaggio"])

# ---------------------------------------------------------------- F4 CORONA (field lines)
F4 = (
    "F4 CORONA: a frame of an elegant scientific visualisation. The same composition as the attached reference "
    "photograph (a river running from the foreground straight to the low sun on the horizon, two armies of spearmen "
    "mirrored on the two banks, hills and trees) is drawn ONLY as thin luminous field lines on a flat navy-black "
    "background (#05070c), like a magnetic field-line plot of the solar corona or a streamline flow visualisation. The "
    "sun is now a perfectly black eclipsed disc exactly above the river's vanishing point; its corona is a crown of "
    "fine pearl-white (#f3efe6) streamers that curve outward and loop back like magnetic field lines. The river, banks, "
    "hills, soldiers, spears and shields are traced by thousands of fine, continuous, flowing contour lines that follow "
    "their form, like an engraving made of light: mostly pearl white, with signal orange (#f08a2a) for the horizon glow, "
    "the river's edges and small accents on spear points and helmet crests. Crisp, thin, precise lines with only a "
    "restrained soft glow; generous dark negative space; no fills, no gradients, no indigo, no violet, no purple, no "
    "blue, no particles or dots, no Matrix rain, no bloom haze, no lens flare. " + NOTXT)
frame("f4_corona", [NBP, GPT, FLX], F4, refs=[WIDE])

# ---------------------------------------------------------------- F5 MARBLE (time paused)
F5 = (
    "F5 MARBLE: a cinematic painted frame of a battle frozen in time as white marble statuary at night, on a riverbank. "
    "Life-size Lydian and Median warriors carved in white marble stand frozen mid-movement: a Lydian with a crested "
    "helmet and round shield, a Mede in a soft rounded cap with a wicker shield and a curly beard, a rearing horse, "
    "spears; arrows hang suspended in mid-air, a flock of birds is stopped in the sky, spray from the river hangs like "
    "glass beads, feather grass stopped mid-wave, all turned to marble. In the sky low over the horizon at the end of "
    "the river hangs the black eclipsed sun with its pearly corona; Jupiter is a single bright point above and to the "
    "left of it; all around the horizon a band of orange twilight glow; the sky above is near-black. The marble is lit "
    "cool pearl from the corona and warm orange from the horizon glow, with deep shadows in the undercuts like the "
    "Pergamon Altar frieze; polished highlights like Canova's marble. Walking between the statues is the only living "
    "thing: THALES of Miletus, the man of the first reference sheet (lean, about 42, greying hair knotted at the nape, "
    "pointed beard, off-white linen chiton and terracotta-red mantle, wooden staff), in full living painted colour, "
    "looking up at the black sun with a knowing half-smile. The statues' eyes are blank carved stone: no glowing eyes, "
    "no glow on the statues. Painterly realism, quiet museum-at-night mood. " + NOTXT)
frame("f5_marble", [NBP, GPT, SDR], F5, refs=["chars/thales_e1_t1.jpg", "board:marble"])

# ---------------------------------------------------------------- F6 GOLD (the light returns)
F6 = (
    "F6 GOLD: a Baroque oil painting in the manner of Tiepolo and Rubens: golden hour on the red river as the sun "
    "returns after the eclipse. On both banks, Lydian warriors (crested bronze helmets, crimson tunics, like the first "
    "reference sheet) and Median warriors (soft madder-red felt caps, saffron tunics, like the second reference sheet) "
    "throw their swords and spears into the red-brown river: bronze and iron blades tumble through the air in great "
    "arcs and splash into the water; some men embrace, some lift their faces to the light, some roar with joy, equal "
    "relief and joy on both sides. The low sun on the horizon at the end of the river is breaking out again, a "
    "brilliant thin crescent. Warm golden light floods everything from the low sun; a luminous Tiepolo sky of glowing "
    "clouds in gold, rose, apricot and cream, with soft painted radiance. The light is painted, diffuse and glowing: no "
    "lens flare, no god rays, no light beams, no bloom. Palette: gold, ochre, vermilion, rose, cream, umber; the sky is "
    "warm gold and cream with no blue. Visible brushwork, Baroque movement and diagonals. " + NOTXT)
frame("f6_gold", [NBP, GPT, SDR], F6, refs=[LYD, MED, "board:rubens"])

# ---------------------------------------------------------------- F7 ORBIT (Earthset)
F7 = (
    "F7 ORBIT: a frame of an elegant scientific visualisation drawn ONLY with thin luminous lines on a flat navy-black "
    "background (#05070c): Earthset seen from lunar orbit. The curved grey limb of the Moon runs across the lower third "
    "of the frame, its craters, ridges and terrain traced by thousands of fine pearl-white (#f3efe6) contour lines like "
    "a topographic field-line plot. Above the lunar horizon, the Earth is half set behind it: a gibbous Earth whose lower "
    "part is hidden by the Moon, drawn in fine flowing lines of saturated ocean blue (the only blue in the image), its "
    "clouds and weather systems as swirling pearl-white streamlines, its night side dark, with one thin signal-orange "
    "(#f08a2a) line of atmosphere along the sunlit limb. Crisp, thin, precise lines with a restrained soft glow; lots of "
    "black space; very few faint stars; no indigo or violet gradients, no particles, no bloom haze, no lens flare. "
    + NOTXT)
frame("f7_orbit", [NBP, GPT, FLX], F7)

# ---------------------------------------------------------------- F8 ROOM (the wink)
F8 = (
    "F8 ROOM: a close-up anime frame of the young woman from the attached character sheet, drawn exactly as there "
    "(same face and design: long straight black hair, warm dark brown eyes, white cropped bomber jacket with an orange "
    "stripe, orange over-ear headphones around her neck, black crop top). She has just spun her chair to face the camera "
    "and WINKS at the viewer: her left eye closed in a clean curved wink line, her right eye open, bright and sparkling, "
    "one eyebrow raised, a mischievous, affectionate half-smile. The cool pearl-white glow of the monitor lights her face "
    "from the front left; a warm orange rim light from the desk lamp catches her hair and cheek; the dark navy room "
    "behind her, softly out of focus. Clean modern anime cel style exactly like the sheet: crisp line art with slight "
    "line-weight variation, flat cel colours with one hard-edged shadow tone, no airbrushed gradients, no glow-shaded "
    "skin, no Ghibli-soft painting, no yellow or sepia cast. " + NOTXT)
frame("f8_room", [NBP, GPT], F8, refs=["Pasted image.png"])


# ---------------------------------------------------------------- fix passes
job("f8_room_gpt_e1", GPT, "frames",
    "Edit this anime frame. Keep the same girl, face, pose, wink, outfit, room, composition and the clean flat cel style "
    "exactly. Three changes only: (1) the round black patch on the upper part of her left sleeve becomes a WHITE round "
    "patch with a thin black border, reading '1420' above 'MHz' in clean black sans-serif letters, exactly like the patch "
    "on the attached character sheet (second image); (2) make the expression more mischievous: the corner of her mouth "
    "lifts a little higher on one side into a sly, knowing half-smile, and the eyebrow over her open eye arches slightly; "
    "(3) light her face and hair from the left with the cool pearl-white glow of the monitor (a crisp cel highlight shape "
    "on the left side of her face, hair and jacket), while the warm orange desk-lamp rim light stays on the right edge of "
    "her hair. No other text anywhere.", refs=["frames/f8_room_gpt_t1.jpg", "Pasted image.png"])
job("f5_marble_nbp_e1", NBP, "frames",
    "Edit this painted frame. Keep the composition, the statues, Thales, the black sun and the painting style. Changes: "
    "(1) the night sky becomes near-black warm umber with a hint of deep violet-brown at the top: NO blue anywhere in the "
    "sky, the land or the water; the only light comes from the pearly corona around the black sun and the orange "
    "twilight glow along the whole horizon; (2) the river reflects only that orange glow and the pale corona; (3) the "
    "white marble Lydian warrior statue fighting in the centre-left wears a carved marble scale corselet over a "
    "knee-length tunic instead of a bare muscled chest; (4) remove the two small light dots at the far upper left and put "
    "ONE brilliant white point (the planet Jupiter) in the sky above and slightly to the left of the black sun. The "
    "statues' eyes stay blank carved stone. No text.", refs=["frames/f5_marble_nbp_t1.jpg"])

job("f4_corona_gpt_e1", GPT, "frames",
    "Edit this field-line visualisation. Keep everything exactly as it is (the black sun, the corona field lines, the "
    "river, the hills, trees, the LEFT army, the line style and the colours: pearl white and signal orange on navy-black) "
    "except the army on the RIGHT bank: it must be the MEDES, not a copy of the left army. Redraw the right-bank soldiers, "
    "in the same luminous line style and the same mirrored formation, as Median spearmen and archers: soft, low, rounded "
    "felt caps with small cheek flaps (no helmets, no crests), round wicker shields drawn as fine basket-weave line "
    "patterns, long-sleeved knee-length tunics, upright spears, and in the front rank archers holding short double-curved "
    "bows; keep the bronze horse standard and the riders on the right. No text.", refs=["frames/f4_corona_gpt_t1.jpg"])

job("f5_marble_nbp_e2", NBP, "frames",
    "Edit this painted frame. Replace only the living man in colour (Thales, standing between the statues with a "
    "staff) with the man from the second attached image: same lean build and age (about 40), his dark hair knotted at "
    "the nape under a braided fillet, a short pointed dark beard on the chin with a SHAVED upper lip, the off-white "
    "crinkled linen chiton with pinned sleeves and the terracotta-red mantle; he holds his wooden gnomon staff and looks "
    "up at the black sun with a dry, knowing half-smile. Keep him in full living painted colour and keep everything else "
    "exactly the same: the marble statues, their blank stone eyes, the black sun and corona, Jupiter, the frozen birds, "
    "arrows and spray, the umber night sky with no blue, the orange horizon glow, the composition and the painting style. "
    "No text.", refs=["frames/f5_marble_nbp_e1_t1.jpg", "chars/thales2_e1_t1.jpg"])

# ---------------------------------------------------------------- F5 MARBLE v2 (stronger brief; canonical Thales)
F5B = (
    "F5 MARBLE, a frame from an art film: time has stopped during a total solar eclipse at the height of a battle on the "
    "bank of the red river Halys, and every warrior, horse, arrow and splash has turned to white marble. A low camera at "
    "chest height drifts among the statues like a night walk through a sculpture museum, with statues at several depths. "
    "Foreground left: the marble torso and raised round shield of a Lydian warrior in a crested Corinthian helmet and a "
    "carved scale corselet over a knee-length tunic. Middle ground: a marble Mede in a soft rounded cap, with a curly "
    "beard and a round wicker shield carved in a basket-weave pattern, his spear stopped mid-thrust; a marble horse "
    "rearing; marble arrows hanging motionless in the air; a flock of marble birds stopped mid-flight; spray from the "
    "river frozen into glass beads; feather grass stopped mid-wave. Both warriors equally noble. The marble is white and "
    "fine-grained with faint grey veining, deeply undercut like the Pergamon Altar frieze, with polished highlights like "
    "Canova's marble; every carved face has blank stone eyes. "
    "Light: no sunlight. The only light comes from the pearly corona of the black sun hanging low over the far end of "
    "the river, which rims the statues with cool pearl-white edge light, and from the orange twilight glow burning all "
    "around the horizon, which warms their lower planes; deep velvety shadows in the undercuts. Sky: a near-black "
    "umber-violet dome; the black sun with a soft, small pearly corona low over the far end of the river; Jupiter as ONE "
    "brilliant white point above and slightly to the left of it; a few faint stars. "
    "Walking between the statues in the middle ground is the only living, moving thing: THALES of Miletus exactly as on "
    "the first reference sheet (about 40, lean, dark hair knotted at the nape under a braided fillet, a short pointed "
    "dark beard with a shaved upper lip, off-white crinkled linen chiton, terracotta-red mantle, wooden gnomon staff), "
    "mid-stride, in full natural living colour with warm skin, head tilted up toward the black sun with a dry, knowing "
    "half-smile. Painterly cinematic realism, like an oil painting made from a film still. No glow on the statues, no "
    "glowing eyes, no blue anywhere, no fog, no lens flare. The second attached image shows marble finish references (an "
    "archaic kouros of c. 590 BC and Canova's polished marble), for the surface only. " + NOTXT)
frame("f5_marble2", [NBP, GPT, SDR], F5B, refs=["chars/thales2_e1_t1.jpg", "board:marble"])
