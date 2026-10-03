# THE ROOM — ending design (director's notes)

## The reveal, beat by beat

1. **Earthset on the monitor.** Drop 2 resolves on Earth setting behind the Moon: the first blue in the film, a blue circle.
2. **Pull back through the bezel.** The image is on an ultrawide monitor in a dark room. We are behind a desk chair.
3. **The graphic match.** Over the chair back we see a white bomber jacket with a **blue circle** on the back and the words RARE EARTH.
   The planet we just left and the patch on her back are the same blue and the same circle.
4. **The side monitor** (vertical) shows four persistent panes, `lydians`, `medes`, `sun`, `moon`, all reading *going home* / *on schedule*.
5. She leans in, **drags the eclipse path** on a small ΔT map so the band of totality sits squarely over the Halys. This settles the "was it really total at the
   battlefield?" debate by hand. Then `git commit`.
6. **She spins the chair to camera**: mischievous half-smile, headphones around her neck.
7. **The wink lands on the final stark chord.** Her eyelid closes across her iris with the curved edge of the Moon crossing the Sun. Hold two beats. Black.
8. End card: **HALYS** / Jade Wang / NEXT TOTALITY · 2027-08-02 · LUXOR · 6m23s.

The plate supplies the chair spin and head turn. The renderer **retimes the plate** so the wink frame lands exactly on the chord, and redraws the
closing eyelid itself (INK style), so the eclipse edge is ours and frame-exact.

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
> Jupiter visible; under standard ΔT the Halys itself only reached 96–99 %, total if ΔT is ~300 s larger. Hence `dt.shift(+300)`.

The spinner is our own: moon phases `◐ ◓ ◑ ◒` cycling. No product logos, names or cloned UIs.

Main pane (`~/sims/earth`):

```
jade@rare-earth:~/sims/earth (main)$ ./halys run --seed=-585 --region=anatolia --from=-585-05-28T15:00
loaded world: 8,412,066 agents · terrain: halys basin · weather: clear
t=-585-05-28T15:02 LMT  lydia ⟷ media  war.year=6
warn: casualties rising at halys.ford (0.8/min)

› make them stop. nobody else gets hurt.

◑ syzygizing… 14s

  moon.align(saros=57)                                      ok
  eclipse.schedule("-585-05-28T18:21 LMT", over="halys")    ok
  dt.shift(+300)   # nudge the path north so it's total at the river
  thales.notify("the sun goes dark this year")              ok   # he will take credit

  totality over battlefield: 2m16s · sun 8.6° WNW · jupiter visible

war.status = RESOLVED   treaty: border=halys · aryenis ⚭ astyages

jade@rare-earth:~/sims/earth (main)$ git commit -am "fix(halys): schedule eclipse to end war (#585)"
[main 585ec1a] fix(halys): schedule eclipse to end war (#585)
 1 file changed, 1 insertion(+), 1 deletion(-)
```

Side panes (vertical monitor, tmux-style, each one line updating):

```
[lydians] 18:16  laying down arms · walking home
[medes]   18:16  laying down arms · walking home
[sun]     magnitude 1.000 · alt 8.6° · corona visible · birds: silent
[moon]    on schedule ✓
[1420.405 MHz]  6EQUJ5
```

## Sound

Room tone, a few mechanical-keyboard clicks on the commit, the chord held by spectral freeze, and one small bright sparkle on the wink. Then silence.
