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
7. **Cut back to her grin, then the wink on the ting** (S80–S81). At 273.40 we are back in the room, in an anime close-up: the closed-lip,
   one-corner-up, mischievous smirk. She types blind (keys 273.45, 274.05, enter 274.95) and the commit prints behind her. Then the wink lands
   on the ting at 276.95: her eyelid crosses her eye like the Moon crossing the Sun. Hold, then black.
8. End card: **HALYS** / Jade Wang / NEXT TOTALITY · 2027-08-02 · LUXOR · 6m23s.

**She is anime; the room stays abstract** (REVISION_V2 decisions 6 and 8). Her two plates start from anime keyframes made from the character
sheet (nano-banana-pro; prompts beside the files in `media/plates/P57/`, `P58/`), then Seedance animates them with the song as the audio reference:

* **S78 = P57** (take 2, from keyframe K78d: P39's frame with her redrawn to the sheet's back view). Long straight black hair ending at the top of
  the light-blue circle; RARE EARTH under it; the round **1420 MHz patch on her LEFT sleeve**; orange stripes on both upper sleeves. Only she comes
  from P57 (registered into P39's frame); the room is P39's painted background as before. Limited animation on the ticks: the body is held, the
  typing hand is redrawn on each tick; on the tick before `dt.shift` she leans toward the ΔT map and the lean lands on `dt.shift` (268.08), she
  settles back before the commit, the commit is typed in a burst on twos; cut on the chord. Her hair carries light strand lines and a sheen in the
  lean, the way the sheet draws black hair.
* **The print and the patch are drawn by us but sit on the fabric.** Their positions are measured on every plate frame (`video/src/worlds/ink/
  prep/decals.py`): the circle's true edge (an ellipse, ignoring where hair overlaps it), the cap line and baseline of the RARE EARTH line, the
  patch's ring, and over the print the jacket's fold field (fold depth from the plate's own shading, carried along each fold's axis, because the
  plate draws the print flat while its folds run up to it). The circle and RARE EARTH are one printed piece: wrapped round her back as a cylinder
  about the spine (they compress toward the side that turns away, and the baseline arcs with the convex back seen from above), kinked where a
  fold crosses them, and toned with their own shadow colour under the folds and the hair's cast shadow. The patch is mapped onto the measured
  ellipse. All are drawn between the fills and the line art, clipped to her visible jacket, crisp; so the print bends in any single frame and
  swings with the lean, and the patch rides on the sleeve, turning with the arm.
* **S80–S81 = P58** (take 2, from keyframe K80b: P41's close-up with the director's reference expression). The smirk is there from the cut back
  (closed lips, her left corner up, eyes narrowed and on us, head tilted). The face is one held cel; her right shoulder dips on each key click.
  Tracing thins the expression's two carrying lines, so the renderer draws them as an animator would on the key drawing: the smirk line with the
  curled corner and the cheek crease, and heavy-lidded eyes with catchlights. The reference photo was shown only to the image model, as an
  expression reference; it was never sent to Seedance.
* **The wink is ours:** her left eye (frame right, the smirk's side); the eyelid crosses the iris with the Moon's curved limb and shuts exactly
  on the ting (276.95), the diamond-ring flare and a sparkle, the other eye narrows a touch; black at 277.55.

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
