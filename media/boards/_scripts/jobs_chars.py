"""Character turnaround sheets (photoreal, 16:9). Costume per production/RESEARCH.md section 3."""
from jobs import job

NBP = "google/nano-banana-pro"

SHEET = (
    "A photographic character turnaround sheet for a historical feature film, shot in a costume-department studio. "
    "One actor in a complete, museum-accurate reconstructed costume of c. 585 BC Anatolia is photographed four times "
    "at full length, side by side at exactly the same scale, feet on one shared floor line, evenly spaced across the "
    "left three-quarters of the frame: (1) front view, (2) three-quarter front view, (3) full side profile, "
    "(4) back view. The right quarter of the frame is a separate column with two framed inset panels: {insets} "
    "Seamless neutral mid-grey studio backdrop (flat 18% grey), soft key light from the upper left with gentle fill, "
    "soft natural contact shadows on the floor. Shot on a medium-format digital camera, 80 mm lens, f/8: tack sharp, "
    "true colour, cinematic photographic realism, nothing illustrated or stylised."
)
SKIN = (
    "Natural, unretouched skin with visible pores, fine lines, sun damage and slight facial asymmetry; a real, specific, "
    "individual face of a non-model actor; no airbrushing, no beauty filter, no waxy or plastic skin, natural hands "
    "with five fingers. The same person, costume, colours and props in every view."
)
NOTEXT = ("No text, no letters, no labels, no captions, no numbers, no logos, no watermark and no colour swatches "
          "anywhere in the image.")
PERIOD = ("Historically accurate for 585 BC: no stirrups, no steel or chrome shine, no chain mail, no plate armour, "
          "no Roman, medieval or fantasy elements, no modern objects.")


def sheet(insets, body, refs_note=""):
    return " ".join([SHEET.format(insets=insets), body, refs_note, SKIN, PERIOD, NOTEXT])


# ------------------------------------------------------------------ THE LYDIAN (hero infantryman)
LYDIAN_BODY = (
    "THE LYDIAN, a Lydian infantryman of about 32: a compact, strong farmer-citizen, about 175 cm, broad shoulders, "
    "strong forearms. Anatolian, olive skin tanned by the sun; broad cheekbones, a slightly crooked nose that was once "
    "broken, deep-set dark brown eyes under heavy brows, a thin pale scar through his left eyebrow, a short dark beard "
    "trimmed close; a steady, decent, tired expression. Long dark brown hair worn in thin braids that fall from under "
    "the helmet over his shoulders and down his back. "
    "Costume, exactly: (1) a Corinthian helmet of warm hammered bronze exactly like the museum helmet in the second "
    "reference image, worn PUSHED UP and tipped back on the crown of his head like a cap, so that his whole face from "
    "brow to chin is uncovered and clearly visible; a tall fore-and-aft horsehair crest dyed crimson and black on a low "
    "crest-holder; (2) a knee-length crimson wool chiton with a narrow dark border; (3) over it a "
    "corselet of stiff layered linen faced with small overlapping bronze scales on chest and back, shoulder flaps tied "
    "down on the chest, a short skirt of linen strips at the hips; (4) bronze greaves on the shins; (5) simple leather "
    "sandals; (6) a round shield about 90 cm across, slightly convex, bronze-faced with a bronze rim, carried on his left "
    "forearm by a central arm-band, lowered at his side; its face is painted dark crimson-red with one stylised ARCHAIC "
    "lion in Greek black-figure vase-painting style (gold-ochre body, black incised details, flame-like mane tufts, open "
    "roaring jaws, long curled tail), not a naturalistic or heraldic lion (visible in the front view); (7) a 2.3 m ash-wood "
    "spear with an iron leaf-shaped blade and a bronze butt-spike, held upright in his right hand, its whole length "
    "inside the frame; (8) a short iron sword sheathed in a wooden scabbard on a leather baldric under the left arm (only the hilt "
    "shows, no bare blade); (9) around his neck on a thin leather cord, one small knucklebone: a real sheep's astragalus, "
    "a knobbly, irregular, roughly cube-shaped ankle bone about 3 cm long, worn smooth and yellowed from handling, "
    "drilled and hung on the cord (not a cartoon dog-bone shape): his child's toy, worn as a charm. "
    "Bearing: calm and upright, a decent man, not a movie hero; no bare torso, no muscle cuirass."
)
LYDIAN_REFS = ("The attached image is a board of museum references: an Attic vase of c. 550 BC with hoplites in "
               "crested helmets carrying round blazoned shields, a Lydian gold coin with a lion's head, and the head of a "
               "marble kouros of c. 590 BC with long beaded hair. The second image is a bronze Corinthian helmet of the late "
               "7th-6th century BC: copy its shape exactly. Use the references only for the kit shapes, the archaic lion "
               "design and the archaic long hair; do not copy their style: the result must look like a real photograph of "
               "a real man.")
job("lydian", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same man in three-quarter view, helmet pushed up, face fully "
    "visible; bottom, a close-up of his open calloused palm holding the small knucklebone on its leather cord.",
    LYDIAN_BODY, LYDIAN_REFS), refs=["board:lyd_inf", "board:lyd_helmet"])

# ------------------------------------------------------------------ THE MEDE (hero spearman)
MEDE_BODY = (
    "THE MEDE, a Median spearman of about 33, the Lydian's mirror in dignity and build: a compact, strong man of about "
    "175 cm. Ancient Iranian, olive to light-brown skin weathered by sun and wind; a long oval face, a high-bridged "
    "aquiline nose, heavy-lidded hazel-brown eyes with laugh lines, a full black beard of tight natural curls trimmed "
    "round, no grey; he looks 33, not older; a calm, thoughtful expression. Thick black hair gathered in a visible bunch "
    "of curls at the nape below the cap (clearly seen in the back and side views). "
    "Costume, exactly: (1) a soft, rounded, dome-shaped felt cap in madder red, with soft side flaps hanging loose "
    "beside the cheeks and a short neck flap; (2) a long-sleeved, knee-length wool tunic dyed saffron yellow-ochre, with "
    "a narrow woven border of small red-brown rosettes at the hem and cuffs, belted with a plain leather belt; (3) over "
    "the tunic a sleeveless corselet of small dark iron scales like fish scales, ending at the waist; (4) close-fitting "
    "trousers of dark brown wool; (5) soft, flexible, laced leather ankle boots wrapped and tied with thongs at the ankle (no modern shoes, no "
    "hard soles); (6) a round wicker shield about 70 cm "
    "across, of tightly woven willow withies in a visible basket weave with tiny gaps of light, rim bound in leather, "
    "a small leather-covered centre boss, carried on his left forearm and lowered at his side; (7) a spear about 2 m "
    "long, ash shaft, iron leaf-shaped blade and a small round bronze counterweight at the butt, held upright in his "
    "right hand, its whole length inside the frame; (8) an akinakes, a short straight iron sword in a leather scabbard "
    "with a lobed top, strapped to the outside of his RIGHT thigh with thongs (his right side: on the viewer's left in "
    "the front view; nothing hangs at his left hip); (9) tucked into the front of his belt, a small hand-modelled "
    "terracotta toy horse the size of his palm, with painted red-brown stripes: his child's toy. "
    "Bearing: calm and upright, noble and individual, never a villain; no fluted Persian crown, no turban, no long "
    "Persian court robe, no black clothing, no curved sword."
)
MEDE_REFS = ("The attached image is a board of museum references: a relief of a man in Median dress (rounded felt cap, "
             "curls bunched at the nape, curled beard, belted tunic), an Assyrian-era relief of a Median groom with a "
             "headband and curly beard, and a relief of a servant wearing the soft hood. Use them only for the cap, "
             "hair, beard and garment cut; do not copy their style: the result must look like a real photograph of a "
             "real man.")
job("mede", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same man in three-quarter view wearing the cap; bottom, a "
    "close-up of his open calloused palm holding the small terracotta toy horse.",
    MEDE_BODY, MEDE_REFS), refs=["board:med_sp"])

# ------------------------------------------------------------------ Lydian cavalryman (rider on foot + mounted sheet)
CAV_BODY = (
    "A LYDIAN CAVALRYMAN of about 30, an elite horseman from a landed family: long legs, light and lean build, about "
    "178 cm. Anatolian, olive skin; a lean long face, high cheekbones, a slightly hooked nose, a strong jaw with a cleft "
    "chin, thick black eyebrows, clean-shaven; alert, proud, intelligent eyes. Long dark hair in crimped tresses falling "
    "from under the helmet to his shoulder blades. "
    "Costume, exactly: (1) an OPEN-FACED crested bronze helmet with no nose-guard (his whole face is uncovered): a "
    "rounded hammered-bronze bowl, hinged bronze cheekpieces hanging beside his cheeks, a short neck guard and a crimson "
    "horsehair crest; (2) a knee-length crimson wool chiton; (3) a corselet of layered linen faced with small bronze "
    "scales; (4) a short ochre wool cloak pinned at his right shoulder with a bronze pin; (5) soft high leather riding "
    "boots reaching mid-calf, laced at the front; (6) a LONG SPEAR about 3 m: ash shaft, iron leaf-shaped head and a "
    "bronze butt-spike, held upright in his right hand, the tip near the top of the frame; (7) a short iron sword "
    "sheathed on a baldric at his left hip; no large shield. "
    "Bearing: controlled, elegant, a superb rider at ease."
)
CAV_REFS = ("The first attached image is a board of museum references: a Corinthian vase of c. 590-570 BC with a frieze "
            "of riders (bridles, riding seat, horse type) and an Assyrian relief of cavalrymen riding beside a stream on "
            "saddlecloths. The second shows Lydian/Greek kit of the period and the Lydian lion. Use them only for kit and "
            "tack; do not copy their style: the result must look like a real photograph of a real man.")
job("lyd_cav_rider", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same man in three-quarter view wearing the open-faced helmet; "
    "bottom, a close-up of his hand gripping the ash shaft of the long spear, showing the iron spearhead socket.",
    CAV_BODY, CAV_REFS), refs=["board:lyd_cav", "board:lyd_inf"])

HORSE_SHEET = (
    "A photographic turnaround sheet of a mounted horseman for a historical feature film, shot in a large studio on a "
    "seamless neutral mid-grey backdrop (flat 18% grey) with soft key light from the upper left and soft contact shadows. "
    "The same rider on the same horse is shown three times at exactly the same scale on one shared floor line: on the "
    "left half of the frame, one large full side profile of horse and rider facing left; on the right half, a front "
    "view and a three-quarter rear view side by side. Medium-format photograph, f/8, true colour, cinematic photographic "
    "realism, nothing illustrated. "
)
HORSE_BODY = (
    "The rider is the Lydian cavalryman from the first reference image (same face, same open-faced crested bronze helmet, "
    "crimson chiton, bronze-scale linen corselet, ochre cloak, high boots), sitting upright with long legs hanging "
    "straight down and bare of any stirrups, holding the 3 m ash spear upright in his right hand and the reins in his "
    "left. The horse: a glossy, well-bred chestnut stallion of about 14.2 hands, fine head, arched neck, full natural "
    "mane and tail, unshod hooves. Tack, exactly: a patterned woollen saddlecloth in crimson and ochre with a woven "
    "geometric border, held by a girth and a breast-strap; NO saddle tree, NO stirrups, NO horseshoes; a leather bridle "
    "with bronze cheekpieces and bronze bosses, a simple bronze bit, single reins; a bronze frontlet plate on the "
    "forehead. " + SKIN.replace("five fingers. The same person", "five fingers. The same rider and horse") + " " +
    PERIOD + " " + NOTEXT
)
job("lyd_cav_horse", NBP, "chars", HORSE_SHEET + HORSE_BODY +
    " The second attached image shows period riders and saddlecloths on a Corinthian vase and an Assyrian relief (tack "
    "reference only); the third is a painting of horses for anatomy only.",
    refs=["chars/lyd_cav_rider_t1.jpg", "board:lyd_cav", "board:horse_art"])

# ------------------------------------------------------------------ Median archer
ARCHER_BODY = (
    "A MEDIAN ARCHER of about 24: lean, hard, hill- and steppe-bred, about 172 cm. Ancient Iranian, light-brown "
    "weathered skin; a narrow young face, prominent cheekbones, a straight nose, dark brown eyes, a small mole on his "
    "left cheek, a short curly black beard just filling in; disciplined, alert, individual. Dark hair bunched in curls "
    "at the nape under the hood. "
    "Costume, exactly: (1) a soft undyed oatmeal-coloured felt hood (bashlyk) with a rounded crown and long side flaps "
    "that can wrap the chin, worn open so the whole face shows; (2) a long-sleeved, knee-length belted wool tunic dyed "
    "saffron-ochre, with an embroidered red-brown border at the hem; (3) close trousers of dark leather; (4) soft "
    "leather boots tied at the ankle; (5) a sheepskin cloak with the fleece inside, worn over the shoulders; (6) a "
    "short, double-curved composite bow of the Scythian type, about 1 m, held in his left hand; (7) a gorytos (a "
    "combined bow-case and quiver) of decorated tooled leather hanging at his LEFT hip, holding reed arrows with "
    "feather fletching; (8) an akinakes short sword strapped to his RIGHT thigh. "
    "Bearing: upright, calm, noble; no Persian 'Immortals' robes, no fluted hat, no fur hat, no lamellar armour, no "
    "black clothing, no face mask, no skulls."
)
ARCHER_REFS = ("The attached image is a board of museum references: a bronze statuette of a 'Scythian' archer with a "
               "double-curved bow, a relief of a servant wearing the soft hood, and a relief of a man in Median dress. "
               "Use them only for the bow, hood and garment cut; do not copy their style: the result must look like a "
               "real photograph of a real young man.")
job("med_archer", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same young man in three-quarter view, hood open; bottom, a "
    "close-up of the decorated leather gorytos with the bow in its case and the reed arrows with three-bladed bronze "
    "arrowheads.",
    ARCHER_BODY, ARCHER_REFS), refs=["board:med_arch"])

# ------------------------------------------------------------------ Thales
THALES_BODY = (
    "THALES OF MILETUS, an Ionian Greek natural philosopher aged about 42 (NOT an old sage): lean and wiry, long-limbed, "
    "sun-weathered, about 180 cm, a walker and sailor. A narrow, intelligent face, crow's feet from squinting at the sky, "
    "a dry, knowing half-smile; dark brown hair with the first grey at the temples, worn long and knotted at the nape, "
    "held by a plain cloth fillet; a short, neat, pointed beard with a few grey threads and a shaved upper lip (archaic "
    "fashion); ink-stained fingertips. "
    "Costume, exactly: (1) an ankle-length Ionian chiton of fine natural off-white linen, finely crinkle-pleated, its "
    "wide sleeves closed by a row of small bronze pins along the upper arms; (2) a wool himation (mantle) in terracotta "
    "red with a narrow dark border, draped diagonally over his left shoulder and around his body; (3) plain leather "
    "sandals; (4) one engraved seal ring; good cloth, little gold. "
    "Props: he holds a gnomon, a straight smooth wooden rod about 1.5 m long, like a staff in his right hand, and an "
    "open wooden wax-tablet diptych in his left. "
    "Avoid: white beard, bald head, snub nose, toga, laurel wreath, telescope, astrolabe, armillary sphere, globe, "
    "books, quills, spectacles, star-patterned wizard robe."
)
THALES_REFS = ("The first attached image is a board of museum references: the head of a marble kouros of c. 590 BC "
               "(archaic face and long hair of his generation), an Attic vase of c. 550 BC with draped men in mantles, "
               "and a pottery fragment from Miletus of his own time. The second is a Rembrandt philosopher, for warmth "
               "of character only. Do not copy their style: the result must look like a real photograph of a real man.")
job("thales", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same man in three-quarter view, a dry knowing half-smile; "
    "bottom, a still life of his props on the grey floor: a polished bronze bowl filled with water, the open wax-tablet "
    "diptych with neat rows of tally marks (short vertical strokes grouped in fives, no letters) and a bronze stylus, a "
    "knotted cord, and a few counting pebbles.",
    THALES_BODY, THALES_REFS), refs=["board:thales", "board:thales_mood"])

# ------------------------------------------------------------------ Alyattes (court / oath dress)
ALYATTES_BODY = (
    "ALYATTES, KING OF LYDIA, about 50: heavy-shouldered, solid, a horseman's thighs, the stillness of long rule, about "
    "176 cm. Anatolian; a broad weathered face, a strong nose, deep-set dark eyes, grave and appraising. Long dark hair "
    "streaked with grey, worn in archaic crimped tresses down his back and bound with a plain gold fillet (diadem band); "
    "a full beard combed into wavy locks, squared at the tip. "
    "Costume, exactly: (1) an ankle-length fine white linen chiton; (2) a large wool mantle in deep murex purple "
    "(crimson-maroon) with woven borders of meander and rosette patterns in ochre, pinned at the right shoulder with a "
    "gold pin and draped around the body; (3) soft, decorated red-brown leather boots; (4) gold: the fillet, a gold "
    "bracelet on each wrist ending in two small lion heads, and a signet ring. He holds a tall plain wooden staff-sceptre "
    "with a small gold knob in his right hand; his left hand rests on the hilt of a sheathed short sword at his hip "
    "without drawing it. "
    "Bearing: deliberate, pragmatic, honour-bound; a real king, not a costume party. Avoid: Roman toga, laurel, eagle, "
    "medieval crown, Persian fluted crown, heroic nudity, 'Spartan' styling."
)
ALYATTES_REFS = ("The first attached image is a board of museum references: a Lydian gold coin with a lion's head (his "
                 "emblem), an archaic Cypriot limestone head with a long stylised beard (beard shape), and an Attic vase "
                 "of c. 550 BC. The second is a Baroque painting of royal silk, for fabric only. Do not copy their style: "
                 "the result must look like a real photograph of a real man.")
job("alyattes", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same man in three-quarter view; bottom, a close-up of his hands "
    "holding a shallow gold libation bowl (phiale) with a raised central boss, the lion-head gold bracelets on his wrists.",
    ALYATTES_BODY, ALYATTES_REFS), refs=["board:alyattes", "board:royal_silk"])

# ------------------------------------------------------------------ Cyaxares
CYAXARES_BODY = (
    "CYAXARES, KING OF THE MEDES, ancient Iranian, about 60: a lean, hard, upright old soldier, broad-chested, about "
    "178 cm, with old scars on his forearms; the founder of an empire. A long face, a strong aquiline nose, hollow "
    "cheeks, intense dark eyes, deep lines; a commander's frown. Grey-streaked dark hair bunched in a thick roll of curls "
    "at the nape; a long, full beard of tight, carefully groomed curls, grey at the chin. "
    "Costume, exactly: (1) a soft, rounded, dome-shaped felt cap in deep madder red with a gold diadem band around it; "
    "its neck and cheek flaps tied back up; (2) a long-sleeved, knee-length belted wool tunic in saffron-ochre with "
    "embroidered borders of rosettes and small winged creatures at the hem, cuffs and neck; (3) close trousers of dark "
    "red-brown leather; (4) soft leather ankle boots with straps; (5) a kandys: a long ochre wool coat with a dark "
    "border, worn draped over his shoulders like a cape, its long empty sleeves hanging loose at his sides (his arms are "
    "not in the sleeves); (6) a rigid gold neck-ring (torque) open at the front and ending in two small lion heads, gold "
    "armlets, and a belt of small gold plaques; (7) an akinakes, a short straight sword in a scabbard strapped to his "
    "RIGHT thigh. He holds a recurved composite bow, unstrung? no: strung, in his left hand. "
    "Bearing: a king used to being obeyed, dignified and noble. Avoid: fluted Persian crown, long pleated Persian court "
    "robe, '300'-style Xerxes, piercings, chains, turban, scimitar, black clothing, kohl-rimmed villain eyes."
)
CYAXARES_BODY = CYAXARES_BODY.replace("unstrung? no: strung, in his left hand", "strung, in his left hand")
CYAXARES_REFS = ("The attached image is a board of museum references: a relief of a man in Median dress (rounded cap, "
                 "curls at the nape, curled beard), and two Iranian gold works of the 8th-7th century BC (registers of "
                 "winged creatures; a king in a long patterned garment): use them for the cap, hair, beard and the style "
                 "of the gold ornament and embroidery only. Do not copy their style: the result must look like a real "
                 "photograph of a real man.")
job("cyaxares", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same man in three-quarter view; bottom, a close-up of the gold "
    "torque with lion-head terminals at his throat and the embroidered tunic border of winged creatures.",
    CYAXARES_BODY, CYAXARES_REFS), refs=["board:cyaxares"])

# ------------------------------------------------------------------ Aryenis
ARYENIS_BODY = (
    "ARYENIS, PRINCESS OF LYDIA, about 19: graceful, composed, about 163 cm; a person with will, the living guarantee of "
    "the peace, not a trophy. Anatolian, olive skin; large dark eyes, straight dark brows, a hint of the archaic smile, "
    "no modern make-up. Long dark wavy hair, centre-parted, with a fringe of small tight curls over the forehead and "
    "long tresses over her shoulders, bound by an embroidered headband studded with small gold rosettes (the Lydian "
    "mitra); a fine sheer saffron veil falls from the headband BEHIND her head and down her back (her face is "
    "uncovered). "
    "Costume, exactly: (1) an ankle-length, finely crinkle-pleated saffron linen chiton with sleeves; (2) over it a "
    "deep crimson-purple wool mantle draped diagonally in the archaic Ionian manner, its borders woven with friezes of "
    "small animals and rosettes and sewn with small gold appliques; (3) soft embroidered red leather shoes; (4) "
    "jewellery: stacked necklaces of gold beads with small acorn, pomegranate and rosette pendants, granulated gold "
    "disc earrings, gold bracelets ending in lion heads. She holds a small round-bellied striped clay perfume jar (a "
    "lydion) in both hands. "
    "Bearing: upright and still, dignified, modest. Avoid: harem or belly-dancer costume, face veil, revealing cuts, "
    "Disney styling, modern make-up, blue."
)
ARYENIS_REFS = ("The first attached image is a board of museum references: a Cypriot limestone statue of a woman of "
                "the early 6th century BC with stacked necklaces and a headband, a vase of c. 550 BC showing a wedding "
                "procession, and a Lydian perfume jar (lydion). The second is a Baroque painting of a queen in silk, for "
                "fabric only. Do not copy their style: the result must look like a real photograph of a real young "
                "woman.")
job("aryenis", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same young woman in three-quarter view; bottom, a close-up of "
    "her stacked gold necklaces, granulated earring and the lion-head bracelet on the wrist of a hand holding the lydion.",
    ARYENIS_BODY, ARYENIS_REFS).replace("actor", "actress"), refs=["board:aryenis", "board:royal_silk"])

# ------------------------------------------------------------------ Astyages
ASTYAGES_BODY = (
    "ASTYAGES, CROWN PRINCE OF THE MEDES, ancient Iranian, about 40: tall, athletic, a fine rider, about 183 cm; open and "
    "confident. He is the son of the old king in the first reference image: give him his father's aquiline nose and "
    "eyes, softened; handsome, alert, curious, warm. Dark curls bunched at the nape; a full, neatly curled black beard, "
    "not yet grey. "
    "Costume, exactly: (1) a soft, rounded, dome-shaped felt cap in saffron with a gold fillet; (2) a knee-length "
    "belted wool tunic in madder red with LONG sleeves reaching his wrists and a gold-embroidered border at hem and "
    "cuffs; (3) close dark trousers; (4) soft "
    "leather ankle boots; (5) an ochre kandys (long-sleeved coat) worn draped over his shoulders like a cape, its sleeves "
    "hanging empty; (6) a gold torque and gold armlets; (7) an akinakes in a gold-mounted scabbard hanging on the outside of "
    "his RIGHT thigh (on the left side of the image in the front view). He holds a recurved composite bow in his left hand. "
    "Bearing: noble, open, hopeful: the generation that chooses peace. Avoid: fluted Persian crown, long pleated Persian "
    "court robe, turban, scimitar, black clothing, villain styling."
)
job("astyages", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same man in three-quarter view; bottom, a close-up of the "
    "gold-mounted akinakes scabbard strapped to his right thigh.",
    ASTYAGES_BODY,
    "The first attached image is the character sheet of his father, King Cyaxares: match the Median royal dress "
    "language and give the son a family resemblance, but he is a different, younger man. The second is a board of "
    "museum references for Median dress and Iranian gold ornament; do not copy its style."),
    refs=["chars/cyaxares_t1.jpg", "board:cyaxares"])

# ------------------------------------------------------------------ Mediators (optional)
LABYNETUS_BODY = (
    "LABYNETUS OF BABYLON, royal envoy (the future king Nabonidus), about 38: medium build, scholarly and composed, "
    "about 172 cm; an envoy, not a warrior. Mesopotamian, olive-brown skin; a calm, contemplative face, the calmest in "
    "the film; dark eyes. A long, square-cut beard dressed in rows of tight curls; shoulder-length curled hair. "
    "Costume, exactly: (1) an ankle-length robe of undyed white wool; (2) a long fringed shawl wrapped spirally around "
    "his body, with saffron and red fringes; (3) a belt; (4) a rounded cap with a gold band; (5) sandals; gold earrings "
    "and bracelets. He holds a tall wooden staff of office; a small stone cylinder seal hangs on a cord at his chest; a "
    "small gold crescent-moon emblem is pinned at his shoulder. "
    "Avoid: blue, ziggurat hats, turbans, Egyptian elements, villainy."
)
job("labynetus", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same man in three-quarter view; bottom, a close-up of his hands "
    "holding a small clay tablet with neat cuneiform signs, the cylinder seal on its cord.",
    LABYNETUS_BODY,
    "The attached image is a board of museum references: an Assyrian relief of a crown prince in court dress (beard, "
    "diadem, fringed robe) and a Babylonian clay tablet. Do not copy their style: the result must look like a real "
    "photograph of a real man."), refs=["board:labynetus"])

SYENNESIS_BODY = (
    "SYENNESIS, KING OF CILICIA, about 55: stout and regal, the merchant-king of a coastal plain, about 170 cm. "
    "Anatolian (Luwian); a strong nose, heavy-lidded shrewd eyes; a long curled grey-black beard; long hair curling at "
    "the neck. "
    "Costume, exactly (neither Lydian nor Median): (1) an ankle-length robe woven with an all-over pattern of small "
    "red-and-ochre squares and rosettes on white; (2) a fringed shawl over one shoulder; (3) a large gold bow-shaped "
    "fibula (safety-pin brooch) at the chest; (4) a round cap with a gold band; (5) leather shoes with upturned pointed "
    "toes. He holds a tall staff. "
    "Avoid: anything that reads Lydian or Median, Egyptian items, blue."
)
job("syennesis", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same man in three-quarter view; bottom, a close-up of the gold "
    "bow-shaped fibula on the patterned robe.",
    SYENNESIS_BODY,
    "The attached image is a board of museum references: a Neo-Hittite relief of a bearded ruler with a staff and an "
    "archaic Cypriot bearded head. Do not copy their style: the result must look like a real photograph of a real man."),
    refs=["board:syennesis"])

# ------------------------------------------------------------------ edit passes (keep identity, fix specific errors)
KEEP = (" Keep everything else exactly the same: the same person and face, costume, props, poses, layout of the views and "
        "inset panels, lighting and grey backdrop. Photographic realism. No text, labels or numbers anywhere.")


def edit(jid, src, change):
    job(jid, NBP, "chars", "Edit this photographic character turnaround sheet. " + change + KEEP, refs=[src])


edit("lydian_e1", "chars/lydian_t2.jpg",
     "Change only the small bone in his palm in the bottom-right inset panel: replace the dog-bone-shaped bone with a "
     "real sheep's astragalus, the ancient knucklebone game piece: a small, irregular, lumpy, roughly rectangular ankle "
     "bone about 3 cm long, with one hollow concave side, one rounded convex side and knobbly ends, worn smooth and "
     "polished, ivory-yellow, drilled through and threaded on the thin leather cord. Also show the same small astragalus "
     "hanging on its leather cord at his throat in the front and three-quarter views.")
edit("thales_e1", "chars/thales_t1.jpg",
     "Remove the four printed numbers '(1)', '(2)', '(3)' and '(4)' under the figures so the floor below them is plain "
     "and empty. In the bottom-right still-life panel, make the wax tablet show only neat rows of short vertical tally "
     "strokes grouped in fives with a diagonal stroke, with no letters, words or symbols.")
edit("cyaxares_e1", "chars/cyaxares_t1.jpg",
     "Make his saffron tunic LONG-SLEEVED in all four views: the sleeves continue down his forearms to the wrists, where "
     "the embroidered red border with golden winged creatures forms the cuffs, just above the gold bracelets. Move the "
     "short sword (akinakes) in its scabbard from his left side to the outside of his RIGHT thigh, hanging straight down "
     "and tied to the thigh with a thong (in the front view it is on the left side of the image, in the back view on the "
     "right side of the image).")
edit("mede_e1", "chars/mede_t2.jpg",
     "Make his saffron tunic LONG-SLEEVED in all four views: the sleeves continue down his forearms to the wrists, where "
     "the red rosette border forms the cuffs. Replace the laced boots with soft, wrinkled, unlaced leather ankle boots "
     "wrapped and tied with a thin thong at the ankle (no eyelets, no hard soles). The short sword (akinakes) in its "
     "scabbard hangs on the outside of his RIGHT thigh in every view (in the front view on the left side of the image, "
     "in the back view on the right side of the image) and nothing hangs at his left hip.")
edit("labynetus_e1", "chars/labynetus_t1.jpg",
     "Change the gold crescent pin on his shoulder into the Mesopotamian emblem of the moon god Sin: a gold crescent "
     "lying on its back with both horns pointing straight up, like a small boat, set on a small round gold disc (in the "
     "head close-up too).")
edit("syennesis_e1", "chars/syennesis_t1.jpg",
     "Replace the bow-tie-shaped brooch with a real Phrygian fibula: a gold safety-pin brooch shaped like a semicircular "
     "arch, with a straight pin across its base and small round bosses where arch and pin meet, about 8 cm wide (in the "
     "close-up panel too). Replace the flat peaked cap with a low, soft, rounded felt cap in red-brown with a broad gold "
     "band, no brim or peak. Remove the light flare at the top centre of the frame.")

# archer, take 2: same young man, but a real bashlyk and correct sides
ARCHER_BODY2 = ARCHER_BODY.replace(
    "(1) a soft undyed oatmeal-coloured felt hood (bashlyk) with a rounded crown and long side flaps that can wrap the "
    "chin, worn open so the whole face shows; ",
    "(1) a bashlyk: a soft undyed oatmeal-coloured felt hood that fits closely over his head like a cap, with a rounded "
    "top, covering the hair, ears and neck, with two long narrow side lappets hanging down onto his chest (they can be "
    "wrapped over chin and mouth against dust, but here hang open so the whole face shows); NOT a monk's cowl, no "
    "shoulder cape, no hoodie; ").replace(
    "(7) a gorytos (a combined bow-case and quiver) of decorated tooled leather hanging at his LEFT hip, holding reed "
    "arrows with feather fletching; (8) an akinakes short sword strapped to his RIGHT thigh. ",
    "(7) a gorytos (a combined bow-case and quiver) of decorated tooled leather hanging at his LEFT hip (on the right "
    "side of the image in the front view), holding reed arrows with feather fletching; (8) an akinakes, a short straight "
    "sword sheathed in a leather scabbard, hanging on the outside of his RIGHT thigh (on the left side of the image in the "
    "front view), no bare blade. ")
job("med_archer2", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same young man in three-quarter view, hood lappets open; "
    "bottom, a close-up of the decorated leather gorytos with the bow in its case and the reed arrows with three-bladed "
    "bronze arrowheads.",
    ARCHER_BODY2,
    "The first attached image shows this same young man in an earlier costume test: keep his face and build exactly, "
    "but correct the hood and the side of the gorytos and sword as described. The second is a board of museum references "
    "(Scythian archer statuette, the Persepolis hood, Median dress); do not copy its style."),
    refs=["chars/med_archer_t1.jpg", "board:med_arch"])

# ------------------------------------------------------------------ the akinakes-on-the-right-thigh fixes (image-space anchors)
AKI_EDIT = (
    "Fix only the position of his short sword (the akinakes in its leather scabbard). Median soldiers wore it on the "
    "RIGHT thigh. View by view: in view 1 (the front view, the figure on the far left) remove the scabbard that hangs "
    "on the right side of the figure behind the wicker shield, and instead draw the akinakes hanging vertically along "
    "the outside of the thigh on the LEFT side of the image, directly below the hand that holds the spear, its scabbard "
    "tied to the thigh with a thong. In view 2 (three-quarter view) do the same: the scabbard hangs below the spear "
    "hand, nothing hangs behind the shield. In view 3 (side profile facing right) keep the sword exactly as it is. In "
    "view 4 (back view) remove the scabbard near the shield on the left side of the image and draw it on the right side "
    "of the image, along the outside of his right thigh below the spear hand.")
edit("mede_e2", "chars/mede_e1_t1.jpg", AKI_EDIT)

AKI_FRESH = (
    "IMPORTANT, the side of the sword: the akinakes hangs on his RIGHT side, vertically along the outside of his right "
    "thigh, tied to the thigh with a thong, below his right hand; in the front view it is therefore on the LEFT side of "
    "the image and in the back view on the RIGHT side of the image. Nothing hangs at his left hip except what is "
    "described for that side.")
CYAXARES_BODY2 = CYAXARES_BODY.replace(
    "(2) a long-sleeved, knee-length belted wool tunic in saffron-ochre with embroidered borders of rosettes and small "
    "winged creatures at the hem, cuffs and neck; ",
    "(2) a knee-length belted wool tunic in saffron-ochre with LONG, close-fitting sleeves that reach his wrists, with "
    "embroidered borders of rosettes and small winged creatures at the hem, the neck and the wrist cuffs; ").replace(
    "(5) a kandys: a long ochre wool coat with a dark border, worn draped over his shoulders like a cape, its long empty "
    "sleeves hanging loose at his sides (his arms are not in the sleeves); ",
    "(5) a kandys: a long ochre wool coat with a dark border, worn draped over his shoulders like a cape in ALL four "
    "views, his arms NOT in its sleeves; its long empty sleeves hang down loosely behind his arms; ").replace(
    "(7) an akinakes, a short straight sword in a scabbard strapped to his RIGHT thigh. ",
    "(7) an akinakes, a short straight sword in a scabbard (see below). ")
job("cyaxares2", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same man in three-quarter view; bottom, a close-up of the gold "
    "torque with lion-head terminals at his throat and the embroidered tunic border of winged creatures.",
    CYAXARES_BODY2 + " The bow is in his LEFT hand. " + AKI_FRESH, CYAXARES_REFS), refs=["board:cyaxares"])

ASTYAGES_BODY2 = ASTYAGES_BODY.replace(
    "(1) a soft, rounded, dome-shaped felt cap in saffron with a gold fillet; ",
    "(1) a soft, rounded, dome-shaped felt cap in saffron with a gold fillet and cheek flaps tied up at the sides, the "
    "same Median cap shape as his father's; ").replace(
    "(5) an ochre kandys (long-sleeved coat) worn draped over his shoulders like a cape, its sleeves hanging empty; ",
    "(5) an ochre kandys (a long coat with long sleeves) worn draped over his shoulders like a cape in all four views, "
    "his arms NOT in its sleeves, the long empty sleeves hanging down behind his arms; ").replace(
    "(7) an akinakes in a gold-mounted scabbard hanging on the outside of his RIGHT thigh (on the left side of the image "
    "in the front view).", "(7) an akinakes in a gold-mounted scabbard (see below).")
job("astyages2", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same man in three-quarter view; bottom, a close-up of the "
    "gold-mounted akinakes scabbard tied to his right thigh.",
    ASTYAGES_BODY2 + " The bow is in his LEFT hand. " + AKI_FRESH,
    "The first attached image is the character sheet of his father, King Cyaxares: match the Median royal dress "
    "language and give the son a family resemblance (nose, eyes), but he is a different, younger, taller man. The "
    "second is a board of museum references for Median dress and Iranian gold ornament; do not copy its style."),
    refs=["chars/cyaxares2_t1.jpg", "board:cyaxares"])

ARCHER_BODY3 = ARCHER_BODY2.replace(
    "(7) a gorytos (a combined bow-case and quiver) of decorated tooled leather hanging at his LEFT hip (on the right "
    "side of the image in the front view), holding reed arrows with feather fletching; (8) an akinakes, a short straight "
    "sword sheathed in a leather scabbard, hanging on the outside of his RIGHT thigh (on the left side of the image in the "
    "front view), no bare blade. ",
    "(7) a gorytos (a combined bow-case and quiver) of decorated tooled leather hanging at his LEFT hip, on the SAME "
    "side as the hand holding the bow, holding reed arrows with feather fletching; (8) an akinakes, a short straight "
    "sword sheathed in a leather scabbard (no bare blade). ")
job("med_archer3", NBP, "chars", sheet(
    "top, a head-and-shoulders close-up portrait of the same young man in three-quarter view, hood lappets open; "
    "bottom, a close-up of the decorated leather gorytos with the bow in its case and the reed arrows with three-bladed "
    "bronze arrowheads.",
    ARCHER_BODY3 + " The bow is in his LEFT hand (on the right side of the image in the front view). " + AKI_FRESH,
    ARCHER_REFS), refs=["board:med_arch"])

# ------------------------------------------------------------------ akinakes, round 3: purely local per-view edits
AKI_LOCAL_MEDE = (
    "Make two small local corrections and nothing else. (a) In the first figure (the front view, far left): there is a "
    "sword scabbard whose tip shows below the wicker shield on the right side of the figure: remove it completely, so "
    "only the shield and his trousers are there. Then add a short sword in a brown leather scabbard with a bronze chape, "
    "exactly like the one worn by the second figure, hanging vertically along the outside of his right thigh, directly "
    "below the hand that holds the spear, on the LEFT side of the figure. (b) In the fourth figure (the back view): "
    "remove the scabbard hanging below the shield on the left side of the figure, and add the same sword hanging along "
    "the outside of his thigh on the RIGHT side of the figure, directly below the hand that holds the spear. Leave the "
    "second and third figures and both inset panels untouched.")
edit("mede_e3", "chars/mede_e2_t1.jpg", AKI_LOCAL_MEDE)
job("mede_g1", "openai/gpt-image-2", "chars",
    "Edit this photographic character turnaround sheet. " + AKI_LOCAL_MEDE + KEEP, refs=["chars/mede_e2_t1.jpg"])

AKI_LOCAL_KING = (
    "Make one local correction and nothing else: the short sword (akinakes) must hang on his RIGHT thigh, on the "
    "opposite side from the hand holding the bow. (a) In the first figure (front view, far left): remove the sword and "
    "scabbard next to the bow on the right side of the figure, and add the same sword in its scabbard hanging vertically "
    "along the outside of the thigh on the LEFT side of the figure, below his empty hand, tied to the thigh with a thong. "
    "(b) In the second figure (three-quarter view): likewise move it from beside the bow to below his empty hand. (c) In "
    "the fourth figure (back view): it hangs on the RIGHT side of the figure. Leave the third figure and the inset panels "
    "untouched.")
edit("cyaxares2_e1", "chars/cyaxares2_t1.jpg", AKI_LOCAL_KING)
edit("astyages2_e1", "chars/astyages2_t1.jpg", AKI_LOCAL_KING + " Also make his close trousers dark red-brown wool "
     "instead of black.")
edit("med_archer3_e1", "chars/med_archer3_t1.jpg",
     "Swap the sides of two items in all four figures and nothing else: the tooled-leather gorytos (bow-case and quiver "
     "with arrows) must hang at his LEFT hip, on the same side as the hand holding the bow (in the front view: the right "
     "side of the figure, next to the bow); the short sword in its scabbard must hang along his RIGHT thigh, on the "
     "opposite side (in the front view: the left side of the figure, below his empty hand). In the back view the gorytos "
     "is on the left side of the figure and the sword on the right side.")
