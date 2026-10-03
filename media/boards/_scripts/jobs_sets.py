"""Set sheets: the Halys battlefield (photoreal) and the singer's room (anime). RESEARCH.md section 4-5, ROOM.md."""
from jobs import job

NBP = "google/nano-banana-pro"

PHOTO = ("Photoreal cinematic film still for a historical epic, shot on an ARRI Alexa 65 with natural colour science: no "
         "orange-and-teal grade, no lens flare, no god rays, no haze filter, no bloom, no vignette. No text, no letters, "
         "no watermark anywhere.")

LAND = (
    "Central Anatolian plateau in late May: a steppe valley at 1,000 m, rolling and open, green turning gold, with "
    "feather grass (Stipa) whose long silky silver plumes catch the light, silver-grey wormwood, thistles and scattered "
    "red poppies; generic eroded tuff and sandstone badland bluffs and low red-clay cliffs along the valley (NOT "
    "Cappadocian fairy chimneys); distant low hills. The river is the Kizilirmak, the Halys: wide, full and fast after "
    "the snowmelt, opaque red-brown like brick dust or milky cocoa from iron-rich clay, with gravel bars, side channels "
    "and shallows; banks of red clay cut two to five metres high; white salt crust on drying mud at the margins. Reed "
    "beds (Phragmites), pink feathery tamarisk shrubs, willows, silver oleaster and broad-crowned native black poplars "
    "line the banks (no pencil-thin columnar poplars)."
)
ARMIES = (
    "Two armies stand in disciplined ranks facing each other across the river, mirror images of equal size and equal "
    "dignity. On the LEFT (west) bank, the LYDIANS, dressed exactly like the soldier in the first reference sheet: "
    "crested bronze helmets, crimson tunics, bronze-scale corselets, round shields painted dark crimson with archaic "
    "lions, upright spears; long-spear cavalry on its outer wing; a gold lion on a pole as its standard. On the RIGHT "
    "(east) bank, the MEDES, dressed exactly like the soldier in the second reference sheet: soft rounded madder-red "
    "felt caps, saffron tunics, iron-scale corselets, round wicker shields, upright spears, with a separate rank of "
    "archers with bows; cavalry on its outer wing; a bronze horse figure on a pole as its standard. No flags or banners "
    "of any kind, no modern objects. Individual men, not clones; nobody is a villain."
)

# ---------------------------------------------------------------- HALYS_WIDE (the master composition)
job("halys_wide", NBP, "sets", " ".join([
    "HALYS_WIDE, the master composition: a vast wide establishing shot, 28 May 585 BC, late afternoon about 18:00. The "
    "camera stands on a low rise above the river and looks DOWNSTREAM to the west-north-west, straight along the river "
    "toward the low sun, which hangs 8 to 10 degrees above the horizon exactly above the river's vanishing point, a "
    "bright white-gold disc softened by haze. The river runs from the bottom centre of the frame in gentle curves to the "
    "horizon under the sun, a perspective line that splits the frame into two mirrored halves.",
    LAND, ARMIES,
    "Light: raking golden-hour sunlight from straight ahead, low and almost horizontal; every figure, spear and poplar "
    "throws a long shadow six to seven times its height, pointing back toward the camera (east-south-east); rim light "
    "on bronze helmets and spear points; dust raised by the armies glows gold in the backlight. Sky: broken cumulus lit "
    "gold and copper from below, a warm hazy gold and pale ochre sky with no blue at all. Palette: umber, ochre, "
    "vermilion, bronze, lead white. 24 mm lens, deep focus, the camera about 15 m above the water.",
    "The first two attached images are the costume sheets for the two armies (left bank = first sheet, right bank = "
    "second sheet). The third is a satellite view of this stretch of the Kizilirmak in late May, for the true colours of "
    "the red-brown river, the thin green riparian strip and the ochre steppe only.",
    PHOTO]), refs=["chars/lydian_e1_t1.jpg", "chars/mede_e1_t1.jpg", "board:halys_land"])

# ---------------------------------------------------------------- HALYS_TOTALITY (same view, black sun)
job("halys_totality", NBP, "sets", " ".join([
    "HALYS_TOTALITY: exactly the same view, camera, river, landscape and armies as the first attached image, but two "
    "minutes later, at the moment of total solar eclipse (18:21 local time). The sun has gone out: where it stood, low "
    "over the river's vanishing point about 8 degrees above the west-north-west horizon, hangs a perfectly black, "
    "hard-edged disc, blacker than the sky, surrounded by a soft pearly-white corona of silky streamers, brightest close "
    "to the disc and fading outward, smaller, warmer and dimmer than in modern high-sun photographs because it is seen "
    "low through the haze; two longer streamers stand almost upright, leaning slightly to the left; two or three tiny "
    "pink-red prominences on the rim. No rays like a cartoon sun, no bright starburst. Jupiter shines as one brilliant "
    "white point above and slightly to the left of the black sun: about a quarter of the frame height above it and about "
    "a twelfth of the frame width to its left. A few fainter stars only. The sky is a deep dark dome, near-black "
    "umber-violet at the top, and all around the horizon burns a 360-degree band of orange-yellow twilight glow like a "
    "sunset in every direction, brightest toward the left and right edges of the frame and darker directly under the "
    "black sun. Deep twilight on the ground: colours mostly gone, figures in silhouette with faint orange rim light from "
    "the horizon glow. Both armies stand frozen on their banks, every face turned up to the black sun, spears and "
    "shields lowered, nobody fighting.",
    "The second attached image is a computed chart of this sky (schematic colours): use it only for the relative "
    "positions of the black sun and Jupiter. No crescent moon anywhere, no Venus, no Orion.",
    PHOTO]), refs=["sets/halys_wide_t1.jpg", "board:sky_chart"])

# ---------------------------------------------------------------- HALYS_SHALLOWS (the duel ground)
job("halys_shallows", NBP, "sets", " ".join([
    "HALYS_SHALLOWS, the duel ground, an empty set with no people: a knee-deep shallow stretch of the red-brown "
    "Kizilirmak over a gravel bar, seen from a low camera standing in the water at knee height. Rounded river stones "
    "break the surface in the foreground, wet and glossy; the opaque red-brown water riffles over them; a reed bed and a "
    "pink tamarisk on the left edge, a red-clay bank two metres high with exposed roots behind, a broad-crowned black "
    "poplar on the far bank. Light: one raking beam of low golden sunlight from the left, nearly horizontal, catching "
    "the riffles and the wet stones and leaving the rest in deep warm shadow, like a Caravaggio painting made "
    "photographic; long shadows across the water; fine dust and midges glowing in the beam. 35 mm lens, f/4.",
    LAND, PHOTO]))
job("halys_shallows_b", NBP, "sets", " ".join([
    "HALYS_SHALLOWS, reverse angle, an empty set with no people: a low camera at knee height in a shallow, knee-deep "
    "ford of the red-brown Kizilirmak, looking downstream INTO the low sun, which sits just above the far end of the "
    "valley behind thin haze. The opaque red-brown water over a wide gravel bar glitters gold in the backlight around "
    "dark rounded stones; reed beds and tamarisk on both banks in silhouette with glowing rims; a low red-clay cliff on "
    "the right; long shadows of every stone and reed reach toward the camera. 35 mm lens, f/5.6.",
    LAND, PHOTO]))

# ---------------------------------------------------------------- ROOM (anime, three angles)
ROOM_STYLE = (
    "Clean modern anime cel style exactly matching the attached character sheet: crisp, confident line art with slight "
    "line-weight variation, flat cel colours with one hard-edged shadow tone, no airbrushed gradients, no glow-shaded "
    "skin, no Ghibli-soft painting, no yellow or sepia cast, no film grain. Neutral, accurate colours."
)
JADE = (
    "The young woman from the attached character sheet, drawn exactly as there (same face, same design): long straight "
    "black hair; white cropped bomber jacket with orange stripes across the chest and sleeves, a round patch reading "
    "'1420 MHz' on the left sleeve, a light-blue circle and the words 'RARE EARTH' on the back; orange over-ear "
    "headphones around her neck; black crop top; navy wide cargo pants with orange straps; white chunky sneakers."
)
ROOM_SET = (
    "Her room: a small San Francisco apartment room at night. Through the window, fog and, far away, the small "
    "three-pronged silhouette of Sutro Tower with tiny blinking red lights. On the desk: one ultrawide curved monitor and "
    "one vertical monitor beside it, a mechanical keyboard, a mug, a pair of paper eclipse glasses and a small brass "
    "gearwheel desk toy (an Antikythera-style dial). On the wall: star charts and a printed eclipse map with a path "
    "circled. A tall Yagi antenna (like the one on her sheet) leans in the corner. A small sticker on the monitor bezel "
    "reads '1420.405 MHz'. Light: the cool pearl-white glow of the monitors plus one warm orange desk lamp; the rest of "
    "the room in deep navy shadow. The ultrawide monitor shows the blue Earth setting behind the grey horizon of the "
    "Moon; the vertical monitor shows four dark terminal panes with a few short lines of tiny pale monospace text."
)
ROOM_REF = ("The attached image is her official character sheet: match her face, hair, proportions, outfit and the "
            "drawing style exactly. The only lettering allowed is 'RARE EARTH', '1420 MHz' and '1420.405 MHz'.")
job("room_a", NBP, "sets", " ".join([
    "ROOM, angle A: a wide shot from behind her desk chair, facing the monitors. She sits in a low-backed office chair at "
    "the desk, seen from behind: the back of her white bomber jacket is clearly visible above the low chair back, with "
    "the light-blue circle and the words 'RARE EARTH' in the centre of the frame, her long black hair falling to either "
    "side, the orange headphones around her neck. The ultrawide monitor fills the upper middle of the frame with the "
    "blue Earth setting behind the grey lunar horizon, the same blue as the circle on her jacket.",
    JADE, ROOM_SET, ROOM_STYLE, ROOM_REF]), refs=["Pasted image.png"])
job("room_b", NBP, "sets", " ".join([
    "ROOM, angle B: a three-quarter front view from beside the desk: she sits in her chair, turned slightly toward the "
    "camera, one hand on the keyboard, a calm, focused half-smile, lit on one side by the pearl monitor glow and on the "
    "other by the warm orange desk lamp; the room around her: window with fog and the distant tower, the wall of star "
    "charts, the Yagi antenna in the corner.",
    JADE, ROOM_SET, ROOM_STYLE, ROOM_REF]), refs=["Pasted image.png"])
job("room_c", NBP, "sets", " ".join([
    "ROOM, angle C: a close-up of her face lit by the monitor: she looks at the screen just off camera, the pale "
    "pearl-white monitor glow on her face and eyes, the screen reflected as a small bright rectangle in her irises, a "
    "rim of warm orange light from the desk lamp on her hair and the edge of her cheek, the orange headphones around her "
    "neck, the collar of the white bomber jacket; dark navy room behind, softly out of focus.",
    JADE, ROOM_STYLE, ROOM_REF]), refs=["Pasted image.png"])


# ---------------------------------------------------------------- take-2 fixes
job("halys_wide2", NBP, "sets", " ".join([
    "HALYS_WIDE, the master composition: a vast, symmetrical wide establishing shot, 28 May 585 BC, late afternoon about "
    "18:00. The camera hovers about 20 m above the MIDDLE of the river and looks straight DOWNSTREAM to the "
    "west-north-west. The red-brown river enters at the bottom edge of the frame, centred and wide, and runs away from "
    "the camera almost straight, narrowing to a vanishing point on the horizon at the exact horizontal centre of the "
    "frame. Directly above that vanishing point, 8 to 10 degrees above the horizon, hangs the low sun, a bright "
    "white-gold disc softened by haze. The river divides the frame into two mirrored halves: the LEFT bank fills the left "
    "third of the frame, the RIGHT bank the right third.",
    LAND,
    "Two armies stand in disciplined ranks on OPPOSITE banks, facing each other across the water, mirror images of "
    "equal size and equal dignity, each a long, deep formation of hundreds of men running from the foreground into the "
    "distance along its bank. On the LEFT bank, the LYDIANS, dressed exactly like the soldier in the first reference "
    "sheet: crested bronze helmets, crimson tunics, bronze-scale corselets, round shields painted dark crimson with "
    "archaic lions, upright spears; long-spear cavalry behind them; a gold lion on a pole as their standard. On the "
    "RIGHT bank, the MEDES, dressed exactly like the soldier in the second reference sheet: soft rounded madder-red felt "
    "caps, saffron tunics, iron-scale corselets, round wicker shields, upright spears, with a separate rank of archers "
    "with bows; cavalry behind them; a bronze horse figure on a pole as their standard. No soldiers stand in the river "
    "or on the same bank as the other army. No flags or banners, no modern objects.",
    "Light: raking golden-hour sunlight from straight ahead, low and almost horizontal; every figure and spear throws a "
    "long shadow six to seven times its height, pointing back toward the camera; rim light on bronze helmets and spear "
    "points; dust raised by the armies glows gold in the backlight. Sky: broken cumulus lit gold and copper from below, "
    "a warm hazy gold and pale ochre sky with no blue at all. Only broad-crowned trees, absolutely no pencil-thin "
    "columnar poplars or cypresses. Palette: umber, ochre, vermilion, bronze, lead white. 24 mm lens, deep focus.",
    "The first two attached images are the costume sheets for the two armies (left bank = first sheet, right bank = "
    "second sheet). The third is a satellite view of this stretch of the Kizilirmak in late May, for the true colours of "
    "the red-brown river, the thin green riparian strip and the ochre steppe only.",
    PHOTO]), refs=["chars/lydian_e1_t1.jpg", "chars/mede_e1_t1.jpg", "board:halys_land"])

job("halys_shallows2", NBP, "sets", " ".join([
    "HALYS_SHALLOWS, the duel ground, an empty set with no people: a wide, knee-deep shallow stretch of the red-brown "
    "Kizilirmak over a gravel bar, seen from a low camera standing in the water at knee height, looking across the "
    "river. Rounded river stones break the surface in the foreground, wet and glossy; the opaque red-brown water "
    "riffles over them; a reed bed and a pink tamarisk on the left edge, a red-clay bank two to three metres high with "
    "exposed roots on the far side, a broad-crowned black poplar beyond it. Light: one raking beam of low golden "
    "sunlight from the left, nearly horizontal, catching the riffles and the wet stones and leaving the rest in deep "
    "warm shadow, like a Caravaggio painting made photographic; long shadows across the water; fine dust and midges "
    "glowing in the beam. The sky, where visible, is a warm hazy gold-grey with no blue at all. 35 mm lens, f/4.",
    LAND, PHOTO]))

ROOM_FIX = (" Keep everything else exactly the same: her face, hair, outfit, pose, the room, the light, the camera "
            "angle and the clean anime cel style.")


def room_edit(jid, src, change):
    job(jid, NBP, "sets", "Edit this anime frame. " + change + ROOM_FIX, refs=[src, "Pasted image.png"])


room_edit("room_a_e1", "sets/room_a_t1.jpg",
          "Move the orange over-ear headphones from her head down to around her neck, resting on her collar, as on her "
          "character sheet (second image), and remove any lettering from the headphones. Replace the red-and-cyan 3D "
          "glasses on the desk with paper solar-eclipse glasses: a white cardboard frame with two opaque black "
          "solar-filter lenses. Remove the operating-system taskbar at the bottom of the vertical monitor. Let her hair "
          "fall to both sides of her back so the light-blue circle on the back of her jacket is fully visible above the "
          "words 'RARE EARTH'.")
room_edit("room_b_e1", "sets/room_b_t1.jpg",
          "Replace the red-and-cyan 3D glasses on the desk with paper solar-eclipse glasses: a white cardboard frame with "
          "two opaque black solar-filter lenses.")
room_edit("room_c_e1", "sets/room_c_t1.jpg",
          "Make her eyes warm dark brown exactly like on her character sheet (second image), and remove the pale "
          "triangular patch on her cheek below her eye. Make her jacket the white cropped bomber of the sheet with one "
          "orange stripe across the chest, not a striped sweater.")
