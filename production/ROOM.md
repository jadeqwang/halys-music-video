# THE ROOM — ending design (director's notes)

## The reveal, beat by beat

1. **Earthset on the monitor.** Drop 2 resolves on Earth setting behind the Moon: the first blue in the film, a blue circle.
2. **Pull back through the bezel.** The image is on an ultrawide monitor in a dark room. We are behind a desk chair.
3. **The graphic match.** Over the chair back we see a white bomber jacket with a **blue circle** on the back and the words RARE EARTH.
   The planet we just left and the patch on her back are the same blue and the same circle.
4. **The side monitor** (vertical) shows four persistent panes, `lydians`, `medes`, `sun`, `moon`, all reading *going home* / *on schedule*.
5. She leans in, **drags the eclipse path** on a small ΔT map so the band of totality sits squarely over the Halys. This settles the "was it really total at the
   battlefield?" debate by hand. Then `git commit`.
6. **Back in-universe: the kings make peace** (S79, 270.04–273.40, BRONZE, `video/src/scenes/treaty.js`). On the final stark chord we cut from the
   room to the Halys at dusk. Alyattes and Cyaxares seal the peace with the right-hand clasp and one firm shake, and each bare forearm carries one
   thin fresh cut: Lydians and Medes "make sworn compacts as do the Greeks; and besides, when they cut the skin of their arms, they lick each other's
   blood" (Herodotus 1.74, tr. Godley; no licking, no gore). The mediators Syennesis and Labynetus watch from the edges. One light pool falls on the
   clasp, the shot holds through the frozen chord, and a small plaque reads `THE OATH · HERODOTUS 1.74`. Her terminal never draws over this shot.
7. **Cut back to her grin, then the wink on the ting** (S80–S81). At 273.40 we are back in the room, in a close-up of her own anime footage
   (composited, not redrawn): a warm, closed-lip half-smile with relaxed brows and bright eyes, the knowing look of the reference photo. She types
   blind, her shoulder dropping on each key (273.455, 274.025, enter 274.927), and the commit prints behind her. Then her own anime wink shuts on the
   ting at 276.95, with a small sparkle. Hold, then black.
8. End card: **HALYS** / Jade Wang / NEXT TOTALITY · 2027-08-02 · LUXOR · 6m23s.

**She stays in her own anime; the room stays abstract** (REVISION_V2 decisions 6 and 8, and the director's v3 note: keep her in her anime
style so she is different from her surroundings, as the rewind video does, which keeps the wink cute rather than sinister).

**Unlike the rest of the film, these three shots (S78, S80, S81) show AI-generated anime footage of her.** Everywhere else a plate is traced
reference and never shown; here the Seedance plates P57 and P59 themselves are on screen, matted and composited directly over the painted room.
Each plate starts from an anime keyframe made from the character sheet with nano-banana-pro (prompts and references beside the files in
`media/plates/P57/`, `P59/`), and Seedance animates it with the song as the audio reference. The rewind precedent is followed exactly: the anime
footage composited directly, a light grade, an ink outline and a scene rim light. The v2 cel re-segmentation of her (and its drawn smirk, eyes
and eyelid) is gone: nothing on her is redrawn except the patch's lettering in S78.

* **How she is composited** (`video/src/worlds/ink/prep/direct.py`, `video/src/worlds/ink/direct.js`). Every odd frame of the take, at its native
  1280x720: her matte (the INK prep matte, snapped to the full-size frame and cut crisp; in S78 the plate's chair is cut out, so the room's chair
  stands in front of her; in the close-up the monitor glow between her outer strands is removed), a light grade (the bottom of the range to the
  room's ink, blue casts trimmed, colours otherwise the plate's own), then in the renderer a clean ink line on the matte edge, the room's light
  across her as a light multiply wash, and a hard anime rim on the edges that face each light: pearl from the monitors, orange from the lamp.
  Timing is the room's: on twos, real holds, each event on its exact master frame (`video/src/worlds/ink/sheets.js`).
* **S78 = P57** (take 2, from keyframe K78d: P39's frame with her redrawn to the sheet's back view). Long straight black hair ending at the top of
  the light-blue circle; RARE EARTH under it; the round **1420 MHz patch on her LEFT sleeve**; orange stripes on both upper sleeves. Her footage is
  registered into P39's frame; the room is P39's painted background as before. On the first ticks she types (a new drawing on each tick), drifts
  toward the vertical monitor, leans in on the tick before `dt.shift` and lands the lean on it (268.08), types on the next ticks leaned, settles
  back from 268.52 and types the commit in a burst on twos; the last drawing holds to the cut on the chord. The circle, RARE EARTH and the folds
  are the footage's own, so they bend, turn and swing with the jacket in every frame. The patch's lettering is not: Seedance garbles 1420 MHz into
  glyphs that change every frame, so the patch is redrawn crisp on the footage, mapped onto its ring as measured on that frame (it turns with the
  arm), in the disc and ink colours sampled from that frame, clipped to her (`decals.js`).
* **S80–S81 = P59** (take 2, from keyframe K59b). K59b is the character sheet's own front face (its upscaled head), tilted slightly and pasted onto
  P41's close-up (the dark room, the monitor glow, the lamp, the jacket and headphones), then cleaned up by nano-banana-pro with minimal edits:
  relaxed, slightly raised brows, bright eyes on the lens, a soft closed-lip half-smile with one corner up and a faint dimple. The v2 keyframes
  (K80a/K80b, from P41's own face) read sinister, with furrowed brows and narrowed eyes, and are superseded with their plate P58. The half-smile is
  there from the cut back at 273.40. Her hand is up on the keyboard behind her and she types blind: her shoulder comes down on each key click
  (the plate's presses, frames 37 / 61 / 73, land on 273.455 / 274.025 / 274.927), then she lifts her hand off while the commit prints behind her.
  **The wink is hers** (the plate's own closed-eye arc, her left eye, frame right): it closes on two drawings and is shut exactly on the ting
  (276.947, frame 16617), with a small four-point sparkle beside it; it stays shut to black at 277.55. The director's reference photo was used only
  as an expression reference for the v2 keyframes; K59b was made from words and the sheet alone, and no photo has ever been sent to Seedance.

## Set

A small apartment room at night, San Francisco. Through the window: fog, and the three-pronged silhouette of **Sutro Tower** blinking red
(local easter egg, never featured). Desk: one ultrawide and one vertical monitor, a mechanical keyboard, a mug, a pair of paper eclipse glasses, and a
small brass **saros dial** desk toy (Antikythera-style gearwheel). On the wall: star charts and a printed eclipse map with the 2027 Luxor path circled.
The **Yagi antenna** from her character sheet leans in the corner. A sticker on the monitor bezel reads **1420.405 MHz**.
Light: monitor glow (pearl, the corona) plus one warm desk lamp (orange). These are her palette and the eclipse palette.

Wardrobe per `Pasted image.png`: long straight black hair; white cropped bomber with orange chest/sleeve stripes, round **1420 MHz** patch on the left
sleeve, light-blue circle and **RARE EARTH** on the back; orange over-ear headphones around the neck; black crop top; navy wide cargo pants with orange
straps; white chunky sneakers.

## Terminal (every line must be valid, readable on pause)

> Facts checked against RESEARCH.md §1.4–1.6: Saros 57; C2 at 18:21 local solar time; 2 m 16 s at a representative site; Sun 8.6° up at az 289° (WNW);
> Jupiter visible; under standard ΔT the Halys itself only reached 96–99 %, total if ΔT is ~300 s larger. Hence `dt.shift(+300)`, after which the river
> gets 1 m 19 s of totality with the Sun at 8.9° (FACTCHECK.md). Dates use astronomical year numbering (585 BC = −0584), Julian calendar; times are LAT.

The spinner is our own: moon phases `◐ ◓ ◑ ◒` cycling. No product logos, names or cloned UIs.

Main pane (`~/sims/earth`):

```
jade@rare-earth:~/sims/earth (main)$ ./halys run --seed=-585 --region=anatolia --from=-0584-05-28T15:00 --cal=julian
loaded world: 8,412,066 agents · terrain: halys basin · weather: clear
t=-0584-05-28T15:02 LAT  lydia ⟷ media  war.year=6
warn: casualties rising at halys.ford (0.8/min)

› make them stop. nobody else gets hurt.

◑ syzygizing… 14s

  moon.align(saros=57)                                      ok
  eclipse.schedule("-0584-05-28T18:21 LAT", over="halys")    ok
  dt.shift(+300)   # nudge the path north so it's total at the river
  thales.notify("the sun goes dark this year")              ok   # he will take credit

  totality at halys bend: 1m19s · sun 8.9° WNW · jupiter visible

war.status = RESOLVED   treaty: border=halys · aryenis ⚭ astyages

jade@rare-earth:~/sims/earth (main)$ git commit -am "fix(halys): schedule eclipse to end war (#585)"
[main 585ec1a] fix(halys): schedule eclipse to end war (#585)
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Side panes (vertical monitor, tmux-style, each one line updating):

```
[lydians] 18:21  laying down arms · walking home
[medes]   18:21  laying down arms · walking home
[sun]     obscuration 100% · alt 8.8° · corona visible · birds: silent
[moon]    on schedule ✓
[1420 MHz]  6EQUJ5
```

## Sound

Room tone, a few mechanical-keyboard clicks on the commit, the chord held by spectral freeze, and one small bright sparkle on the wink. Then silence.
