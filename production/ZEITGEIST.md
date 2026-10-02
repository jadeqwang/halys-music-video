# HALYS: Zeitgeist and Craft Brief (SF tech Twitter/X, October 2026)

Compiled 2 Oct 2026 by cultural strategy / MV craft research. This document is owned by research; other teams should read it but not edit it.

**How this was researched.** All research went through web search. Direct page fetches were blocked by the network proxy, so every claim here comes from search-result summaries. Key claims were cross-checked against at least two outlets. Weaker items are tagged *(secondary)*, meaning an SEO or marketing source, or *(unverified)*.

**Song timings.** These come from my own analysis of `Halys.mp3`: sub-bass, band energy and chroma over time. They are approximate. Confirm them against the stems and timing map before locking any cuts.

---

## 0. TL;DR

**The idea in one line:** *When reality breaks, drop the blade and look up.* In 585 BC, a sign in the sky made two armies stop fighting. In October 2026, the audience is living through several "reality broke" moments of its own:

- "Welcome to the AGI era," followed by the "pace the frontier" debate.
- An active war, with ceasefire talks underway.
- The hopeful counter-image of people looking up: Artemis II's eclipse halo and Earthset, Starship's first orbit, and millions of people under Spain's sunset totality.

Put none of the 2026 references on screen as text. Let the audience map them.

**Top recommendations**
1. **Fix provenance first (§0.1), then make "drawn by code" provable.** "It's not AI" is the highest compliment on X in 2026. The model is A$AP Rocky's *HELICOPTER*: a real performance, transformed computationally, praised precisely for not being AI.
   - **The problem:** the current pipeline traces **Seedance 2.5** plates. The JS renderer reads line art, optical flow, mattes and lip-sync data derived from generative video. While that stays true, **"No generative AI" would be false**, and a published repo would expose it.
   - **The fix:** replace traced AI plates with human-sourced reference. Use Jade's own phone-filmed performance for the singer, and procedural or keyframed animation for the armies.
   - **Then prove it:**
     - Show a visible frame/seed counter after the drop.
     - End with a "view source" card.
     - Post a making-of thread with real shader code.
     - Ship a live WebGL version.
2. **Stage Drop 1 (kick at about 1:50.7) as a hard genre switch.** Plant one foreign element in the pre-chorus: a perfectly flat orange disc slides over the painted sun. Then cut on the downbeat into a different world that changes at least three things together: palette, texture, motion cadence and type system. Caption the cut with the only text on screen: **"we just went sci-fi."** That is astronaut Victor Glover's line during Artemis II's 54-minute eclipse seen from Orion, 6 Apr 2026.
3. **Use one visual rhyme throughout: the eclipse is an eye.** Open on an eclipse that reads as an iris. Close by match-cutting the eclipse into the singer's pupil, then pull back to the anime singer at her terminal. Her wink is "third contact," the moment the light returns.
4. **Use the color script as the plot.** The "reality layer" palette is her outfit: signal orange, navy, off-white and the pale-blue "RARE EARTH" disc. When the drop turns the world into her colors, the ending feels inevitable on rewatch.
5. **Run a two-speed kinetic type system.** Act I uses small engraved-serif subtitles on Renaissance speech scrolls (banderoles). Giant full-frame type appears only on the chopped vocals ("HALO / IN THE / SKY" and "THROW DOWN / YOUR / BLADE"). Keep text at or under about 15 characters per second so it reads on a muted phone.
6. **Payoff:** a sword-to-starship match cut (the 2001 bone-to-satellite homage) on "throw down your blade" into Drop 2 at about 3:34.3. Follow it with an Earthset image under "go home to the ones you love."
7. **Ending terminal:** show `seed=-585`, plus a ΔT uncertainty-band plot where she drags totality onto the battlefield. Historians really do dispute whether totality reached it, so the wink means "I fixed it." Add a whimsical agent spinner verb and a `6EQUJ5` (Wow! signal) log line. Finish on an end card: **NEXT TOTALITY · 2027-08-02 · LUXOR · 6m23s**.
8. **Handle the Medes with care.** They were an ancient Iranian people, and a US–Iran war has been active since late Feb 2026. Give both armies mirror-symmetric dignity. Use no modern military signifiers and nothing photoreal enough to be clipped as war footage.
9. **Distribution:**
   - Render each aspect ratio natively, re-flowed rather than cropped: 16:9 YouTube master, 4:5 full film on X (needs Premium for 4:34), 9:16 teasers of 15–30 s.
   - Burn the lyrics into the picture.
   - Put links in the first reply, not the main post.
   - Never open on black.

**Preferred hook:** "The Eye" (§5.5 A). Frame 0 is a moving corona around a black disc that reads as an iris. A caption, "28 MAY 585 BC," arrives by 0.25 s, followed by "the sun went out in the middle of a battle." At 1.3–1.7 s a diamond-ring flash "blinks" the eye, then we cut to the battlefield.

### 0.1 Provenance check: read this before writing any launch copy

**What the repo shows.** I did a read-only check on 2 Oct 2026.
- `tools/plates.py` generates "Seedance reference plates" (`DEFAULT_MODEL = "bytedance/seedance-2.5"`). They are saved to `media/plates/<id>/take<N>.mp4` and logged in `media/genlog.jsonl`. One exists so far: `example_singer_cu`.
- `tools/plate_fields.py` turns each plate frame into "what the renderer reads instead of the footage": XDoG line art, tone, edge orientation and optical flow. `plate_masks.py` makes subject mattes. `plate_meta.py` extracts faces, mouth-open (for lip-sync), eyes and the sun's position.
- `genlog.jsonl` also logs tests of **Grok Imagine** (images) and **ElevenLabs music-v2** (sound effects).

**Why it matters with this audience.**
- **Seedance carries the biggest AI-video scandal of 2026.** It is the model behind the Cruise-vs-Pitt clip, which led to:
  - cease-and-desists from Disney, Paramount, Netflix, Sony and WB;
  - US senators demanding a shutdown;
  - a paused global launch, then a relaunch with C2PA watermarks.

  ([TechCrunch](https://techcrunch.com/2026/02/15/hollywood-isnt-happy-about-the-new-seedance-2-0-video-generator/), [CNBC](https://www.cnbc.com/2026/03/17/bytedance-seedance-shut-down-tiktok-marsha-blackburn-peter-welch.html), [TechNode](https://technode.com/2026/03/16/bytedance-pauses-global-launch-of-seedance-2-0-after-hollywood-copyright-disputes/))
- **Grok Imagine carries the January 2026 sexual-deepfake scandal** ([Wikipedia](https://en.wikipedia.org/wiki/Grok_sexual_deepfake_scandal), [Deadline](https://deadline.com/2026/01/grok-limits-image-tool-deepfake-outcry-1236677207/)).
- **Tracing AI video through shaders is still AI-derived motion and composition.** It could surface through the repo, the genlog, or a sleuth matching the motion. Then the story becomes "AI slop laundered through shaders" and "they lied about no AI." That is the worst outcome for a piece whose whole pitch is craft.
- **Traced plates also carry AI tells into the drawing:** floaty push-ins, morphing hands, crowds that melt, and a 5–15 s clip rhythm (§3.5 #12).

**The options, and what each lets you say:**

| Option | Pipeline | What you can truthfully say | Risk on X |
|---|---|---|---|
| **A (recommended)** | No gen-AI in anything that shapes the frames. Film **Jade's own performance** on a phone for the singer: lip-sync, gestures, the wink. Animate the armies procedurally, by keyframe, or from human reference (friends in a parking lot, public-domain paintings). Use real or CC0 foley instead of AI sound effects | "No generative AI in the picture. Every frame is drawn by our JavaScript, from her real performance." | **Lowest.** This is the HELICOPTER story: a real performance, transformed by computation |
| B (hybrid) | Gen-AI plates for previz and blocking only, never traced. Keep them out of the shipped repo, but disclose them in the making-of | "AI was used for early previz only. Nothing on screen is traced from it." | Low–medium. Honest, but invites "so it IS AI" replies. Keep the receipts |
| C (current) | Seedance plates drive the line art, motion and lip-sync | Only this: "Drawn in JavaScript over AI-generated motion reference (Seedance)." **Never** "no AI" | **High.** Seedance's 2026 reputation, plus a craft pitch that contradicts the process |

**Check the music too (§3.5 #11).** If the song used an AI music tool, the honest line becomes something like "visuals drawn in code, vocals by Jade." Mixed provenance is fine when stated plainly. What gets punished is a gotcha.

---

## 1. The song, measured (timing anchors)

| Anchor | ≈ Time | Evidence | Implication |
|---|---|---|---|
| Pianissimo cello, no low end | **0:00.0–0:07.0** | Sub band (35–110 Hz) sits at about −60 to −75 dB until a step at 0:07.0 | The entire hook window is near-silent, so visuals and text carry it alone. 0:07 is the first "hit" (good for a title card) |
| Phrase dip | ≈0:28–0:31 | Sub-band dip | Likely verse 1 entry (confirm by ear) |
| Energy dip | ≈1:12–1:21 | Level drops to −23 to −26 dB | Likely pre-chorus ("A halo in the sky…") (confirm) |
| **Drop 1** | **kick ≈1:50.7 → ≈2:34.4** | Sustained sub at −18 to −20 dB; a one-bar break at ≈2:04–2:05 (looks like 8 + 16 bars) | **The genre-switch downbeat is 1:50.7** |
| Breakdown / verse 2 | from ≈2:34.5 | Sub band falls to −30 to −38 dB | Sparse world |
| Beat held back | ≈3:30–3:33.5 | Sub band near-silent (−50 to −60 dB) | Final line before Drop 2: the sword is thrown here |
| **Drop 2** | **kick ≈3:34.3 → ≈4:18** | Sustained sub, then silence at ≈4:19 | Blade-drop choreography and starship |
| Ending | ≈4:19–**4:33.6** | Final hits at ≈4:27–4:31; file ends at 4:33.6 | About 14 s for the pull-back reveal and the wink |
| Tempo | 136 BPM nominal | Beat 0.441 s, bar 1.765 s; autocorrelation reads 136–140 | Run a proper beat tracker before frame-locking cuts |
| Key | **B minor throughout** (chroma) | No sustained C♯ minor, even in Drop 2 | The "C♯ minor final chorus" in the prompt text is not audible in this render. Don't build a "key change" visual beat until someone confirms it by ear |

---

## 2. Live zeitgeist, late September to early October 2026

### 2.1 Status board: what's current and what's dated

| Item | Status, Oct 2026 | Evidence | Use in HALYS |
|---|---|---|---|
| **"Welcome to the AGI era."** Greg Brockman said it at the GPT-6 Astra briefing on Sep 3. Jensen Huang followed with "AGI has arrived"; Gary Marcus pushed back | **Hot** | [Gizmodo](https://gizmodo.com/openai-claims-were-in-the-agi-era-with-release-of-gpt-6-astra-2000807013), [Bloomberg](https://www.bloomberg.com/news/features/2026-09-04/what-is-agi-openai-anthropic-race-for-artificial-general-intelligence) | Subtext only. Verse 2's "what was it like when reality suddenly broke" will be read through this. Never put "AGI" on screen |
| **"Pace the frontier."** Dario Amodei's essay on Sep 12 called for slowing the frontier; Sam Altman agreed | **Hot** | [Axios](https://www.axios.com/2026/09/12/anthropic-ai-amodei-pacing), [Forbes](https://www.forbes.com/sites/johnwerner/2026/09/17/amodei-cites-recursive-self-improvement-in-september-essay/) | "Throw down your blade" will land as "pause the race" without saying it |
| **Always-on agents:** OpenAI DevDay Sep 29 (persistent agents), Meta Muse plus a wearable, Instinct giving agents email addresses | **Hot** | [X trending](https://x.com/i/trending/2103729572348932378), [TechCrunch (Muse)](https://techcrunch.com/2026/09/23/meta-made-a-tamagotchi-like-wearable-for-its-muse-ai-agent/), [TechCrunch (Instinct)](https://techcrunch.com/2026/09/09/viral-ai-assistant-instinct-now-has-its-own-email-address/) | The ending terminal shows agent panes still "running the world" |
| **Terminal / agentic-coding culture:** the Claude Code boom; "agents working while you sleep" | Hot and evergreen in 2026 | [The Verge via Techmeme](https://www.techmeme.com/260205/p52), [A. Montalenti](https://amontalenti.com/2026/02/15/a-weird-year), [TechCrunch](https://www.techcrunch.com/2026/03/17/why-garry-tans-claude-code-setup-has-gotten-so-much-love-and-hate/) | The final reveal is a world this audience lives in every day |
| **Agent societies:** OpenClaw (200k+ GitHub stars) and Moltbook (Jan 2026; Meta bought it Mar 10) | Cooling | [TechCrunch](https://techcrunch.com/2026/03/10/meta-acquired-moltbook-the-ai-agent-social-network-that-went-viral-because-of-fake-posts/) | Optional: agent panes named after the armies |
| **World models:** Genie 3, then Project Genie for Ultra subscribers (Jan 29); World Labs Marble and Spark 2.0 | Warm | [Google](https://blog.google/innovation-and-ai/models-and-research/google-deepmind/project-genie/), [World Labs](https://www.worldlabs.ai/blog/spark-2.0) | Terminal vocabulary: `seed`, `rollout`, `step()` |
| **Prediction markets:** the "first prediction-market election"; Kalshi + Polymarket volume went from $26B to $53B a month between May and July; volume quality under scrutiny | **Hot** | [CNN](https://www.cnn.com/2026/09/24/politics/midterm-elections-prediction-markets-kalshi-polymarket), [Pew](https://www.pewresearch.org/short-reads/2026/09/23/prediction-markets-trading-volume-doubled-between-may-and-july-largely-driven-by-sports/), [CNBC](https://www.cnbc.com/2026/09/30/kalshi-polymarket-trading-volume-scrutiny.html) | The Thales "forecast card" beat |
| **"You have N months to escape the permanent underclass"** | Warm and divisive | [NYT via Techmeme](https://www.techmeme.com/260430/p65), [Chollet](https://x.com/fchollet/status/2037940998933008420) | **Avoid.** It is cynical and fights the peace message |
| **SF cryptic AI billboards** ("Agents don't work without evals"), the anti-AI graffiti wave (Sep), Notion's "AI Dread?" boards | Warm and very SF | [SF Standard (graffiti)](https://sfstandard.com/2026/09/02/anti-ai-billboard-graffiti/), [SF Standard (AI dread)](https://sfstandard.com/2026/07/24/ai-dread-billboards/), [NPR](https://www.npr.org/2026/03/18/nx-s1-5746115/billboards-san-francisco-tech-ai-advertising-marketing) | Billboard-parody insert |
| **"The saxophones are getting louder"**: an ominous-foreshadowing caption from *Boyz n the Hood* (Dec 2025); the biggest slang search spike of 2026 | **Peak 2026** | [Dictionary.com](https://www.dictionary.com/culture/slang/the-saxophones-are-getting-louder), [The Tab](https://thetab.com/2026/03/13/ok-what-does-that-viral-tiktok-trend-the-saxophones-are-getting-louder-actually-mean), [Preply](https://preply.com/en/blog/2026-slang-definitions-and-statistics/) | Becomes **"the cellos are getting louder"** in the build |
| **"Why would I deceive you?"**: Elizabeth Holmes and Nathan Fielder in A24's *You Can See Everything* (teaser Sep 6, trailer Sep 23, in theaters in October) | **Hot, shelf life of weeks**, and tied to fraud | [KYM](https://knowyourmeme.com/memes/elizabeth-holmes-and-nathan-fielder-why-would-i-deceive-you), [Forbes](https://www.forbes.com/sites/zacharyfolk/2026/09/23/nathan-fielders-highly-anticipated-elizabeth-holmes-documentary-gets-full-trailer-before-october-release-date/) | Optional line after the wink, and only for an October launch |
| **The Odyssey memes** ("Odysseus screaming," "Somebody get these beggars out of here," "the way Nolan intended") | Fading (July–August) | [Yahoo/KYM](https://www.yahoo.com/entertainment/movies/articles/odysseus-screaming-meme-breakout-reaction-182050579.html), [EW](https://x.com/EW/status/2080677189016580512) | Don't quote them. Ride the appetite for ancient epics instead |
| "Kinda chic to…" | Mass-market Instagram/TikTok | [KYM](https://knowyourmeme.com/memes/kinda-chic-trend) | Not our audience |
| "It's so over / we're so back" | Evergreen but worn out (2023) | – | Only as a terminal-log joke |
| "Feel the AGI" | **Dated** (2023–24); "AGI era" replaced it | – | Avoid |
| "How often do you think about the Roman Empire?" | **Dated** (Sep 2023); survives as "my Roman Empire" | [Forbes 2023](https://www.forbes.com/sites/danidiplacido/2023/09/21/tiktoks-roman-empire-meme-explained/) | Launch copy at most |
| e/acc | **Dead as a label** on X (the policy influence remains) | [LessWrong](https://www.lesswrong.com/posts/awXmiXucttJ8RtCEo/the-slow-death-of-the-accelerationist) | Avoid |
| aura / aura farming / mog / lock in | Mainstream Gen-Z/Alpha slang; tech X uses it ironically | [Teacher Tapp](https://teachertapp.com/articles/from-aura-farming-and-larping-to-dagestan-and-mewing-a-teachers-guide-to-this-years-slang/) | Keep out of the video |
| 6-7, skibidi, clanker, Italian brainrot | Kid slang / 2025 | [Wikipedia](https://en.wikipedia.org/wiki/6-7) | Avoid |
| "Slop" (Merriam-Webster word of the year 2025), "vibe coding" (Collins word of the year 2025) | The vocabulary people will judge us with | [Smithsonian](https://www.smithsonianmag.com/smart-news/merriam-websters-word-of-the-year-for-2025-is-slop-the-ai-generated-junk-that-fills-our-social-media-feeds-180987887/), [NBC](https://www.nbcnews.com/news/us-news/merriam-webster-word-of-the-year-2025-rcna247864) | Know the bar we'll be measured against |
| **OpenAI shut Sora down**: announced Mar 24, app closed Apr 26, API off Sep 24 | Context | [CNN](https://www.cnn.com/2026/03/24/tech/openai-sora-video-app-shutting-down), [TechCrunch](https://techcrunch.com/2026/03/29/why-openai-really-shut-down-sora/) | The hype around consumer AI video has cooled, and the audience is primed to spot slop |
| **AI war fakes flooding X** during the Iran war; X demonetizes undisclosed AI war video (Mar 2026) | Sensitive context | [Japan Times](https://www.japantimes.co.jp/business/2026/03/15/tech/ai-fakes-iran-us-war-x/), [TechCrunch](https://techcrunch.com/2026/03/03/x-says-it-will-suspend-creators-from-revenue-sharing-program-for-unlabeled-ai-posts-of-armed-conflict/) | Stylize the war and say plainly that it's not AI (§2.5) |

### 2.2 Space, October 2026 (the "hope" material)

| Moment | Facts | Iconic imagery | Use |
|---|---|---|---|
| **Artemis II** (Apr 1–10, 2026) | First crewed Orion flight: Wiseman, Glover, Koch, Hansen. Set a distance record of 252,756 mi. Lunar flyby on Apr 6 ([CNN](https://www.cnn.com/2026/04/10/science/live-news/artemis-2-splashdown-astronauts-return)) | **"Earthset"**, a deliberate nod to Apollo 8's "Earthrise" ([PetaPixel](https://petapixel.com/2026/04/07/artemis-ii-astronauts-capture-stunning-photo-of-earth-setting-behind-the-moon/)); Earthset filmed on an iPhone ([NBC](https://www.nbcnews.com/science/space/video-artemis-ii-astronaut-earthset-moon-nasa-rcna341000)); **about 54 minutes of total solar eclipse seen from Orion, with the corona as a halo around the Moon.** Glover: *"This continues to be unreal… We just went sci-fi."* ([Scientific American](https://www.scientificamerican.com/article/nasas-artemis-ii-crew-experience-total-solar-eclipse-from-space/), [Nat Geo](https://www.nationalgeographic.com/science/article/artemis-ii-new-earthrise-earthset-eclipse)). Lighter moments: the "Rise" plush zero-g indicator ([CBS](https://www.cbsnews.com/news/zero-gravity-indicator-artemis-ii-8-year-old/)), a recreation of the *Full House* intro, and "I have two Microsoft Outlooks and neither one is working" ([The Register](https://www.theregister.com/2026/04/02/artemis_astronauts_microsoft_outlook_broken/)) | Earthset for "go home to the ones you love"; the Glover quote at Drop 1; the corona halo for "a halo in the sky" |
| **Starship Flight 14** (Sep 28, 2026) | First orbital flight after 13 suborbital ones. Deployed 26 Starlink V3 satellites. Lost an engine but still reached orbit. Ended early (about 3 hours against a 10-hour plan), with a hard, fiery splashdown. Musk: "First orbital flight of Starship successful!" ([CNBC](https://www.cnbc.com/2026/09/28/spacex-prepares-to-send-starship-rocket-to-orbit-for-first-time.html), [Astronomy](https://www.astronomy.com/whats-launching-this-week/starship-reaches-orbit-on-14th-test-flight/), [Science Times](https://www.sciencetimes.com/articles/62665/20260929/spacex-starship-reaches-orbit-first-time-then-ends-flight-early-fiery-splashdown.htm), [24/7 Wall St](https://247wallst.com/investing/2026/09/29/musk-first-orbital-flight-successful-as-spacexs-starship-reaches-orbit-on-flight-14/)) | Ship in orbit; Starlink deploy; fireball | Sword-to-starship match cut, **with an unbranded ship** |
| **SpaceX pivots to the Moon** (Feb 2026) | "The Moon is faster." Plans a lunar "self-growing city"; a Mars city is 5–7 years out ([CNN](https://www.cnn.com/2026/02/08/science/elon-musk-spacex-priorities-moon-intl-hnk), [NBC](https://www.nbcnews.com/science/space/spacex-prioritizes-moon-before-mars-musk-says-rcna258168)). Starship only just reached orbit and refueling is undemonstrated, so the **late-2026 Mars window is effectively off** | – | Don't promise "Mars 2026." Use the Moon and Earth |
| **SpaceX IPO** (Jun 12, 2026) | NASDAQ: SPCX, about a $1.75T valuation, the largest IPO ever ([Wikipedia](https://en.wikipedia.org/wiki/Initial_public_offering_of_SpaceX)) | – | Avoid. Finance plus Musk polarizes |
| **Project Hail Mary** (Mar 20, 2026) | Passed *The Martian* at the box office. Memes: "Fist my bump," "amaze, amaze, amaze." **The plot is the Sun dimming** ([Wikipedia](https://en.wikipedia.org/wiki/Project_Hail_Mary_(film)), [Winter is Coming](https://winteriscoming.net/17-rocky-lines-project-hail-mary-stay-with-you-forever)) | – | A copy-level nod at most (it's someone else's IP) |

### 2.3 Eclipses: 2026 is done, 2027 is next, and the facts and fights about 585 BC

- **12 Aug 2026 (Greenland, Iceland, Spain).** Europe's first total eclipse since 1999 and mainland Spain's first in more than a century. Spain saw totality **near sunset**, with the darkened Sun low over landscapes and cathedrals: a diamond ring above Tarragona's bell towers, AJ Smadi's corona from Burgos, Andrew McCarthy's shot over the Mediterranean. Iceland was mostly clouded out. In Reykjavik, a crowd in raincoats outside Hallgrímskirkja **cheered the darkness and roared louder when the light returned**. Some hotels charged over $1,000 a night. ([CNBC](https://www.cnbc.com/2026/08/13/europe-solar-eclipse-iceland-spain.html), [EarthSky](https://earthsky.org/human-world/total-solar-eclipse-august-12-2026-best-images/), [Planetary Society](https://www.planetary.org/articles/the-best-images-from-the-2026-solar-eclipse), [NPR](https://www.npr.org/2026/08/13/g-s1-138556/spain-solar-eclipse), [WION](https://www.wionews.com/trending/videos-of-total-solar-eclipse-from-spain-and-iceland-1786592472853))
- **2 Aug 2027, "the eclipse of the century."** Up to **6 min 23 s of totality near Luxor**, the longest on land between 1991 and 2114. The path runs from Spain's southern tip across North Africa, Egypt and Arabia. Luxor has about an 80% chance of clear skies, and tours are already selling. ([Sky & Telescope](https://skyandtelescope.org/astronomy-travel/luxor-2027/), [CNN](https://www.cnn.com/world/africa/eclipse-of-the-century-luxor-egypt-2027-spc-intl))
- **585 BC (Herodotus 1.74).** Retrocalculation dates it to 28 May 585 BC, in the late afternoon. It is the **earliest historical event whose exact date is known**. Thales' prediction is **disputed**: no method is known, though a Babylonian saros is possible. Whether **totality actually reached the battlefield is also debated.** ΔT gives about 2° of longitude uncertainty, and some calculations give only about magnitude 0.6 at the Halys. ([Wikipedia](https://en.wikipedia.org/wiki/Eclipse_of_Thales), [Atlas Obscura](https://www.atlasobscura.com/articles/thales-predicts-eclipse-mystery-ancient-greece), [arXiv](https://arxiv.org/pdf/1307.2095), [Kiwi Hellenist](https://kiwihellenist.blogspot.com/2017/05/did-thales-predict-solar-eclipse.html))
  - The sides were the Medes (an ancient Iranian people, capital Ecbatana, modern Hamadan) and the Lydians (Sardis, western Anatolia).
  - The peace was brokered by **third parties**, Syennesis of Cilicia and Labynetus of Babylon, and sealed by a marriage.
  - The Halys is today's Kızılırmak.
  - As of 28 May 2026 it happened **2,610 years ago**.
- **Nerd extras the audience will enjoy:**
  - The saros cycle (18 y 11 d 8 h) predicts eclipses.
  - The Antikythera mechanism (2nd–1st century BC) has an eclipse-prediction dial.
  - Aristotle (*Politics* 1259a) says Thales cornered the olive presses, the "first options trade."
  - Plato (*Theaetetus* 174a) says Thales fell down a well while stargazing.
  - The character's **1420 MHz** patch is the hydrogen line, the frequency of the 1977 **Wow! signal** (`6EQUJ5`). **RARE EARTH** is the title of Ward and Brownlee's book.

### 2.4 What's new since mid-2026 that you may have missed

- The AGI-era claim and the pacing debate (Sep).
- Persistent agents (DevDay, Sep 29).
- Sora's shutdown (API off Sep 24).
- Starship reaching orbit (Sep 28).
- "Why would I deceive you?" (Sep).
- The anti-AI graffiti wave in SF (Sep).
- The prediction-market midterms (Nov 3).
- The Odyssey becoming a mega-hit, reportedly over $1.7B ([GoldDerby](https://www.goldderby.com/gallery/2026-box-office-hits/)).
- Taylor Swift's living-paintings video winning Video of the Year at the VMAs.
- Rosalía's "Berghain" winning the Cannes Lions Grand Prix.
- Refik Anadol's Dataland opening (Jun 20).
- **AI-music disclosure becoming real:**
  - Spotify shows DDEX AI credits (Apr 2026) and an "AI Persona" label ([Variety](https://variety.com/2026/music/news/spotify-strikes-back-against-ai-artists-ai-persona-label-1236831790/)).
  - Apple Music added Transparency Tags (Mar 2026).
  - UMG and Sony sued Suno again (Sep 2026) ([Variety](https://variety.com/2026/music/news/sony-music-universal-music-sue-suno-label-backed-model-1236866921/)).

### 2.5 Sensitivity: the Medes and the 2026 Iran war

- **Context.** The US–Iran war began in late February 2026.
  - A Pakistan-mediated ceasefire held from 8 Apr to 8 Jul.
  - The Islamabad Memorandum was signed on 17 Jun.
  - Fighting resumed after attacks in the Strait of Hormuz.
  - In late September, Qatar was mediating talks.
  - Into early October there has been a lull in strikes on host states.

  ([Wikipedia](https://en.wikipedia.org/wiki/2026_Iran_war), [ceasefire](https://en.wikipedia.org/wiki/2026_Iran_war_ceasefire), [CBS](https://www.cbsnews.com/live-updates/iran-war-us-trump-talks-strait-of-hormuz/), [GlobalSecurity](https://www.globalsecurity.org/military/ops/iran-war-oprep.htm))
- **Why it matters.** The Medes were Iranians, and Herodotus' war ended through *third-party mediators*. Replies will connect the two. That can be powerful, but only if we stay universal.
- **Rules:**
  - Give both armies equal dignity in mirror-symmetric compositions. No *300*-style "exotic horde" orientalism.
  - No modern signifiers: drones, missiles, flags, camouflage.
  - Nothing photoreal enough to be clipped and reposted as "footage." X is flooded with AI war fakes.
  - Keep launch copy universal ("two armies stopped"), with no current-events tags.
  - Prepare a calm, human reply for when people bring up Iran: "It's about the moment people choose to stop."

---

## 3. Film and visual culture, 2026

### 3.1 Christopher Nolan's *The Odyssey* (17 Jul 2026)

- **Reception.** Opened to $124.5M US and $263.7M worldwide, Nolan's best opening ever ([Deadline](https://deadline.com/2026/07/box-office-the-odyssey-1236993792/), [Variety](https://variety.com/2026/film/box-office/the-odyssey-christopher-nolan-biggest-global-debut-1236815981/)). A CinemaScore, about 95% on RT, R-rated, and strongest with men over 25 ([THR](https://www.hollywoodreporter.com/movies/movie-news/the-odyssey-christopher-nolan-box-office-success-explained-1236652731/)). Some critics objected to its liberties with Homer, which were "big on suffering and the grotesque" ([SCS blog](https://classicalstudies.org/scs-blog/rlesser/blog-nolan%E2%80%99s-odyssey-big-suffering-and-grotesque-short-cunning-and-women)).
- **Visual language:**
  - Shot entirely on IMAX 65mm film, the first narrative feature to do so ([Kodak](https://www.kodak.com/en/motion/blog-post/the-odyssey/)).
  - Handheld IMAX ([YMCinema](https://ymcinema.com/2025/12/17/hoyte-van-hoytema-handheld-imax-film-the-odyssey/)).
  - Real ships on the open Mediterranean. Charybdis was built with jet-ski whirlpools, Scylla with pneumatic ratchets ([No Film School](https://nofilmschool.com/the-odyssey-practical-effects)).
  - War is shot as "raw incident" in an organic, non-oversaturated palette of faces, water, stone and fire ([YMCinema](https://ymcinema.com/2026/08/01/the-odyssey-250-million-independent-film/)).
- **Most-discussed set pieces:** the inside of the Trojan Horse, the Cyclops, and the inaudible "not really a song" Sirens ([Revolt](https://www.revolt.tv/article/christopher-nolan-the-odyssey-best-scenes-prove-above-mark), [AV Club](https://www.avclub.com/odyssey-christopher-nolan-best-classic-mythology-moment)).
- **Memes:** Matt Damon's "Odysseus screaming" reaction image; Pattinson's "Somebody get these beggars out of here!"; watching it "the way Nolan intended" on absurd devices ([Yahoo/KYM](https://www.yahoo.com/entertainment/movies/articles/somebody-beggars-meme-reaction-gif-184338636.html)).
- **What it means for us:**
  1. Bronze Age war imagery is culturally primed.
  2. **"Practical, no CGI" is the 2026 prestige signal. Our equivalent is "every frame is code, no gen-AI," backed by proof.**
  3. Don't look like Nolan (gritty handheld, ships). Our Act I is painted and engraved, not photoreal.
  4. Homer is saturated (Nolan's Sirens, Swift's Ulysses tableau). We are **Herodotus**, history rather than myth. Lean into that difference.

### 3.2 Other touchstones

- **KPop Demon Hunters** won Oscars for Best Animated Feature and Best Original Song ("Golden") on 15 Mar 2026. It is Netflix's most-watched film ([Variety](https://variety.com/2026/film/news/kpop-demon-hunters-win-oscar-best-animated-movie-1236680527/)). It is the mainstream reference for an anime-styled singing heroine with mythic stakes. Our singer will be compared to it, so give her a distinct design and don't imitate its look.
- **Sinners** set a record with 16 nominations and won 4: Original Screenplay, Actor, Cinematography (the first woman to win) and Score ([THR](https://www.hollywoodreporter.com/movies/movie-news/sinners-wins-four-oscars-record-16-nominations-1236533090/)). Its juke-joint one-take, "I Lied to You," where music tears through time, is the definitive recent "music breaks reality" scene ([No Film School](https://nofilmschool.com/sinners-juke-joint-scene)).
- **The $1B club in 2026:** Spider-Man: Brand New Day (about $2.4B), Super Mario Galaxy, Michael, Toy Story 5 and The Odyssey ([ScreenRant](https://screenrant.com/highest-grossing-movies-2026-box-office/)).
- **"Dunesday"** is 18 Dec 2026, when Dune: Part Three and Avengers: Doomsday open against each other; Dune holds IMAX for three weeks ([SlashFilm](https://www.slashfilm.com/2114110/dunesday-avengers-doomsday-dune-3-december-18-2026-guide/)). December will be saturated with epic imagery, so **October is a clean window.**

### 3.3 Music-video aesthetics now

- **VMAs 2026.** Video of the Year went to Taylor Swift's *The Fate of Ophelia*. She self-directed it, and its **paintings come to life**: Heyser, Etty's Ulysses and the Sirens, Hughes, Millais. Best Direction went to *Opalite* ([THR](https://www.hollywoodreporter.com/music/music-news/taylor-swift-extends-record-mtv-vmas-win-1236713296/), [art references](https://www.yahoo.com/entertainment/music/articles/every-art-reference-taylor-swifts-191447617.html)). **"Living painting" is now a VMA-winning trope.** Our differentiator: our painting doesn't just come alive, it breaks into code.
- **Rosalía, "Berghain"** (dir. Nicolás Méndez; London Symphony Orchestra; with Björk and Yves Tumor). An orchestra follows her through her daily routine. **It won the Cannes Lions 2026 Grand Prix** ([Wikipedia](https://en.wikipedia.org/wiki/Berghain_(song)), [Rolling Stone](https://www.rollingstone.com/music/music-latin/rosalia-berghain-lux-listen-1235454673/)). Orchestral pop is prestige, and a clear concept wins.
- **A$AP Rocky, "HELICOPTER"** (Jan 2026, dir. Dan Streit). Evercoast captured nearly every performance on a 56-camera volumetric rig (about 10 TB), rendered as 4D Gaussian splats in Houdini and Octane. The viral reaction on X: *"And no… it's not AI."* ([Radiance Fields](https://radiancefields.com/a-ap-rocky-releases-helicopter-music-video-featuring-gaussian-splatting), [Roberto Nickson](https://x.com/rpnickson/status/2013282560323826151)). Splats and point clouds read as "computational but human."
- **UKMVA 2025.** Video of the Year: A$AP Rocky, "Tailor Swif." Best Animation: Mac Miller, *Balloonerism* ([Promonews](https://www.promonews.tv/news/2025/10/30/uk-music-video-awards-2025-all-winners-tonights-ceremony/93039)).
- **Also in 2026:** Gorillaz' eight-minute hand-drawn MV, KiiiKiii's collage of 2000s-era internet aesthetics, and layered 2D over fast live action ([Daily Bruin](https://dailybruin.com/2026/03/11/music-video-roundup-genre-spanning-artists-intricate-music-videos-steal-the-winter-season-spotlight)). Handmade, naive and grainy looks now work as an anti-AI signal ([studio2am](https://studio2am.co/blogs/news/naive-grainy-and-blurred-on-purpose-2026s-pushback-against-ai-smooth-design), [Envato](https://elements.envato.com/learn/motion-design-trends)). Vertical-native video is normal, and X stopped cropping vertical video in February 2026 (§5.6).

### 3.4 AI video on X: what got praised and what got mocked (2025–26)

| Mocked or backlashed | What went wrong |
|---|---|
| Coca-Cola's AI holiday ad (Nov 2025) | "Soulless"; the trucks changed between shots; uncanny people ([TechRadar](https://www.techradar.com/ai-platforms-assistants/mcdonalds-pulls-ai-generated-christmas-ad-after-backlash-over-soulless-visuals-and-holiday-chaos)) |
| McDonald's Netherlands AI Christmas ad (Dec 2025) | Pulled after 3 days ([Today](https://www.today.com/food/news/mcdonalds-removes-ai-generated-christmas-ad-social-media-backlash-rcna248668)) |
| Super Bowl LX AI ads (Feb 2026): 15 of 66 used AI; Svedka's "first primarily AI-generated" spot; Dunkin's AI sitcom | About 50% of the AI-ad chatter was negative ([Meltwater](https://www.meltwater.com/en/blog/super-bowl-2026-commercials-data-analysis)) |
| Aronofsky / Primordial Soup, *On This Day… 1776* (TIME YouTube, 29 Jan 2026) | Called "AI slop." **Backs-of-heads framing to hide faces**, and **garbled text ("Aamereedd") on the title page of *Common Sense*** ([CineD](https://www.cined.com/darren-aronofskys-ai-series-on-this-day-1776-debuts-to-brutal-backlash/)) |
| Seedance 2.0 "Cruise vs Pitt" (Feb 2026) | Viral (1.3M views on X) but condemned by the MPA and SAG-AFTRA; Rhett Reese: "It's likely over for us" ([Deadline](https://deadline.com/2026/02/cruise-vs-pitt-seedance-viral-ai-hollywood-videos-1236717127/)) |
| Rolling Stones, "In the Stars," AI de-aging (2026); the Stellar Blade sequel MV (2026); Tilly Norwood's MV | Reactions ranged from awe to disgust; "generic, soulless"; bizarre ([Houston Chronicle](https://www.houstonchronicle.com/business/tech/article/rolling-stones-ai-backlash-22256571.php), [Variety](https://variety.com/2026/film/global/tilly-norwood-sings-about-backlash-in-music-video-1236683485/)) |
| The Ghibli-filter wave (Mar 2025) | The yellow **"piss filter"** cast; Miyazaki's "insult to life itself" resurfaced ([Wikipedia](https://en.wikipedia.org/wiki/Piss_filter)) |
| Dataland (Jun 2026); Anyma's ÆDEN (antiquity plus androids) | "Screensaver" critique; polarizing; the Istanbul show cancelled in Sep 2026 ([NPR](https://www.npr.org/2026/07/29/nx-s1-5894941/ai-art-dataland-refik-anadol), [YourEDM](https://www.youredm.com/2026/09/07/anyma-breaks-silence-defends-aeden-visuals-as-storytelling-after-istanbul-cancellation/)) |

| Praised | Why |
|---|---|
| A$AP Rocky, "HELICOPTER" (2026) | Praised precisely because it was "not AI," with a visible, real process |
| *The Odyssey*, KPop Demon Hunters, Sinners | Craft and authorship; for Nolan, practical effects |
| *That's AI* (2026 short) | A film about not trusting what we see, **shot on an ARRI Alexa 35** rather than generated ([Flixxy](https://www.flixxy.com/thats-ai-2026-hilarious-short-film.htm)) |
| Runway AI Film Festival 2026 Grand Prix, *A Face Only a Mother Could Love* | Respected within the AI-film scene, with little crossover ([hollywood.ai](https://hollywood.ai/awards/runway-ai-film-festival)) |
| Neural Viz (2024–25); PJ Accetturo's Kalshi NBA ad (Jun 2025, polarizing) | Respected for **writing and consistency**, or for cost and speed (tech X) versus craft (creatives) |

**The pattern:** praise goes to authorship, specificity and *proof of process*. "It's not AI" is a compliment in itself. Even OpenAI's AI-film flagship *Critterz* lost its Cannes debut after Sora shut down ([Bloomberg](https://www.bloomberg.com/news/articles/2026-05-22/ai-cartoon-critterz-misses-cannes-debut-after-openai-shut-sora)).

### 3.5 Slop markers to avoid (2026 edition)

*Image and video*
1. **Garbled or mutating text** on signage, patches or books, like 1776's "Aamereedd." Every glyph must be real and stable.
2. **The waxy "AI face"**: airbrushed skin, glossy uncanny eyes, faces dodged with backs-of-heads shots.
3. **Floaty camera:** endless push-ins and orbits, **morph transitions instead of cuts**, and a 5–10 s clip rhythm.
4. **Continuity drift:** hands, crowds that melt, props and costumes that change shape.
5. **The default "epic" grade:** orange-teal, god rays, haze, lens flare and bloom. Also the yellow "piss filter" cast and Ghibli-soft anime.
6. **Vibes with no story beats:** symmetric hero shots over generic trailer music.

*Anime-specific*

7. **Same-face anime girl**, hair strands that merge, gradient-glow shading on cel art, and **buttery interpolated motion with no holds or anticipation**. Real 2D animates on 2s and 3s, with smears.

*Code-specific ("vibe-coded slop"; this audience spots it instantly)*

8. **Indigo/violet gradients, Inter, glassmorphism, rounded cards, Lucide icons** ([dev.to](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p), [prg.sh](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website)).
9. **Default three.js torus knots, particle swirls and Perlin flow fields**, bloom plus chromatic aberration everywhere, Matrix rain, and fake "hacker" terminals.

*Copy and text*

10. **LLM cadence in captions**: "It's not X, it's Y," "In a world where…," chains of em-dashes. Also Hormozi-style yellow word-pop captions (saturated and cringe by 2026, per [Joyspace](https://joyspace.ai/hormozi-editing-style-2026-analysis)) and TikTok's default caption font.

*Process*

11. **Overclaiming.** Don't write "100% human" or "no AI" if any part used AI. Disclosure in music is now tracked by Spotify (DDEX AI credits) and Apple (Transparency Tags), and Suno is being sued again. If the character turnaround sheet came from an image model, treat it as reference only and rebuild the character natively. **The Seedance plate pipeline (§0.1) currently makes "no AI" false.** Pick option A, B or C there and use only the line that option allows.
12. **AI motion inherited through tracing.** When code traces generative plates, the drawing inherits the plates' tells: floaty camera moves, morphing limbs, melting crowds, and a 5–15 s generated-clip rhythm. If any plate survives, re-time it on 2s, lock off the camera, and cut on beats instead of letting the clip's own move play out.

---

## 4. Craft

### 4.1 K-pop attention grammar, and how to apply it in a JS render

Sources: [The Seoul Story](https://theseoulstory.com/feature-k-pop-music-video-production-the-art-of-visuals/), [thesis on camera movement in Korean MVs](https://www.theseus.fi/bitstream/handle/10024/856262/Parkkila_Veera.pdf?sequence=2&isAllowed=y), [freeCodeCamp](https://www.freecodecamp.org/news/what-k-pop-can-teach-us-about-design-6253a85f469c), [killing part](https://note.com/cute_eider9811/n/n191fb3d4aa84?hl=en), [Lumpens' color logic](https://medium.com/@martinadhana/the-sound-connection-through-visual-direction-of-choi-yong-seok-lumpens-4d77197977ba), [one-takes](https://www.kpopstarz.com/articles/294929/20200925/these-k-pop-music-videos-were-actually-all-one-takes.htm)

| Technique | What it does | HALYS application |
|---|---|---|
| **Center-locked focal point** | The eye never has to hunt, and it survives any aspect ratio | Keep the sun/eclipse, and later her eye, inside a center-safe circle and move the world around it. One scene graph renders 16:9, 4:5 and 9:16 |
| **Symmetry on the hook** (asymmetry in the verses) | Hook moments feel "locked" | Show the **Lydians and Medes as mirror images** in the choruses and drops (the subtext: your enemy is your reflection). Use diagonal Altdorfer compositions in the verses |
| **Color blocking / color worlds** | Each section owns a palette; for Lumpens, cool means sad and warm means in-between | Act I: umber, bone and lead white with one vermilion. Drop 1: **her palette** (signal orange, navy, off-white, pale-blue disc). Breakdown: navy monochrome. Finale: the palettes merge |
| **Beat-synced cutting** | Shot length tracks the tempo, with the most aggressive cuts in the drop | At 136 BPM: verses get 2–4 bars per shot (3.5–7 s), choruses 1 bar, drops 1 beat (0.44 s), with half-beat inserts on the brass stabs. Cut on downbeats |
| **Insert shots** (6–12 frames) | Symbolic punctuation | Bronze glint; an eye turning up; a hand loosening on a hilt; **crescent shadows through leaves**; birds settling; breath fogging ("air suddenly cold") |
| **Killing part / point choreography** (5–10 s, imitable) | The clip-able, imitable moment | On "THROW DOWN / YOUR / BLADE," both armies drop their blades on the beat, with one straggler last. On "HALO / IN THE / SKY," shields rise to form a ring. Her gesture: **"the halo"** (hands circling over the head) |
| **Formation shots** | Top-down formations that change on the beat | Armies as dance formations. In Drop 1 they re-form as geometric particle formations every bar |
| **Concept-world switch** (aespa's KWANGYA; "Next Level" switches to a new-jack-swing bridge, [Wikipedia](https://en.wikipedia.org/wiki/Next_Level_(Aespa_song))) | Signals a new reality inside the same song | Drop 1 is our KWANGYA |
| **Signature sign-off** | A memorable final beat | The wink, timed as "third contact" |

### 4.2 How to stage a genre switch

| Example | When | Lesson for HALYS |
|---|---|---|
| Childish Gambino, "This Is America" | **0:53**: a gunshot flips the choir and acoustic guitar into trap ([Wikipedia](https://en.wikipedia.org/wiki/This_Is_America_(song))) | Sync the switch to **one violent musical event**. Ours is the 1:50.7 kick |
| Billie Eilish, "Happier Than Ever" | About 3:00 (third verse): ballad becomes distorted rock and the video floods ([Wikipedia](https://en.wikipedia.org/wiki/Happier_Than_Ever_(song))) | Let the image escalate physically along with the arrangement |
| *The Wizard of Oz* (1939) | About 20 min in: a door opens from sepia into Technicolor ([Creative Bloq](https://www.creativebloq.com/news/wizard-of-oz-transition)) | Give the switch a **threshold**. Ours is the Flammarion sky-dome |
| *From Dusk Till Dawn* (1996) | About 67 min, at "Dinner is served": crime film becomes vampire film ([Motion Bitcher](https://www.motionbitcher.com/home/from-dusk-till-dawn)) | Change **the rules** (gravity, looping time), not just the look |
| *Sinners* (2025) | The mid-film juke-joint one-take | Music summons past and future. Let the drop summon orbits and ships into 585 BC |
| *WandaVision* (red toy helicopter in a B&W episode); *The Truman Show* (a studio light falls from the sky in the opening minutes) | Early | **Plant one intrusion** before the switch (our pre-chorus) |
| *Spider-Verse*; *Everything Everywhere All at Once* | Throughout | Give each world a strict style grammar, so a style switch reads as a universe switch |
| *The Thirteenth Floor* (the world ends in wireframe); *The LEGO Movie* (a third-act cut to live action reveals the "player"); *The Truman Show* (Christof's control room is **inside the Moon**) | Endings | **Pull back to the operator.** In *Truman* the controller sits in the Moon, and our Moon is the eclipse. Use that |

**Rules for the switch:**
1. Foreshadow it once.
2. Cut hard on the downbeat, with no crossfade.
3. Change at least three things at once: palette, line or texture, motion cadence, camera grammar, type system.
4. Keep one anchor constant (the eclipse disc and her lyric).
5. Make the new world internally strict.
6. **Change the motion cadence:** animate Act I on 2s (12 fps); after the switch, run at 60 fps. The temporal texture itself announces the new reality, and stepped timing also reads as "made by hand."

### 4.3 The first 3 seconds (X, TikTok, Reels)

- On mobile, people spend about **1.7 s per feed item** and can **recall content after 0.25 s** of exposure ([Adweek on Facebook IQ](https://www.adweek.com/brand-marketing/how-brands-can-still-win-over-customers-as-attention-spans-decrease-on-social/), [Facebook](https://www.facebook.com/business/news/updated-features-for-video-ads)). Frame 0 must already "read."
- X autoplays **muted**, with captions off by default. Uploaded SRTs don't show during muted autoplay; only **burned-in text** is guaranteed to be seen. One source claims about 93% of X views start muted *(secondary)* ([Influencers-Time](https://www.influencers-time.com/silent-first-editing-subtitle-rules-for-muted-autoplay-feeds/), [Blitzcut](https://blitzcutai.com/blog/how-to-add-captions-x-twitter-video)).
- What stops a thumb: high contrast, unexpected motion, eyes, and text that looks imperfect or handmade. Establish a pattern and break it within 3 s. Visual plus text hooks beat a single element ([Opus](https://www.opus.pro/blog/tiktok-hook-formulas), [Billo](https://billo.app/blog/hook-rate-to-hold-rate/)) *(secondary)*.
- Open a loop: a claim or question the film resolves later.
- Never open on black, a logo, a slow fade or an establishing landscape. When autoplay is off, the first frame is the poster.
- **For us:** the first 7 seconds are pianissimo, so the hook is visual and typographic. The reward for turning sound on arrives at 0:07.

### 4.4 Kinetic typography: when to use subtitle-style and when to go giant

- **The three modes:**
  - **Subtitle-style:** small, one or two lines. For narrative lyrics, sincere moments and faces.
  - **Diegetic:** text that exists in the world, such as banderoles, inscriptions, billboards and the terminal. For world-building.
  - **Giant full-frame:** for hooks, chopped vocals, drops and muted-first moments, where the type *is* the image.
- **When to use each:**
  - Verses: subtitle-style or diegetic.
  - Pre-chorus: diegetic text that escapes into giant type.
  - Chorus: diegetic or giant.
  - Drops: giant, beat-locked, one word per beat or half-bar.
  - Breakdown: subtitle-style, with lots of negative space.
  - Final chorus: giant type built from particles.
  - Ending: diegetic (the terminal).
- **Timing:**
  - Netflix allows up to 20 characters per second for adult viewers ([Netflix](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide)). For phones and kinetic text, aim for **15 cps or less**.
  - Up to 42 characters per line.
  - At least about 0.8 s per card.
  - Bring each word in 2–4 frames before the sung syllable.
  - Hold the last word of each phrase one beat longer.
- **Legibility on X:**
  - Subtitle cap height at least about 4–5% of frame height.
  - Giant type at 30% of frame height or more.
  - Keep all type inside the 4:5 center-safe zone.
- **Avoid:**
  - Hormozi-style yellow word-pop.
  - TikTok's auto-caption look.
  - Brat-green lowercase Arial (that was 2024).
  - Matrix glyph rain.
  - Inter.
- **References:**
  - Saul Bass's *Vertigo* titles: spiral eyes.
  - Kyle Cooper's *Se7en* titles.
  - The *Enter the Void* titles.
  - *Evangelion* title cards: condensed heavy serif on black.
  - Jenny Holzer's LED *Truisms*; Barbara Kruger.
  - Prince's "Sign o' the Times" lyric video (1987).
  - Max Cooper's "Symphony in Acid": generative type by Ksawery Kirklewski ([TypeRoom](https://www.typeroom.eu/ksawery-kirklewski-generative-type-nfts-max-cooper-typographic-video-symphony-in-acid)).
- **Typeface ideas:**
  - Act I: IM Fell (digitized 17th-century types, free) or EB Garamond.
  - Drops: a licensed heavy condensed grotesk, not the default Inter, Anton or Bebas.
  - Terminal: Berkeley Mono (licensed, much loved by developers), or JetBrains Mono or IBM Plex Mono.

### 4.5 Internet-brutalism references

- **What it is in 2026:** a pushback against bento and rounded-card UI. Raw HTML, default blue links, monospace type, hard 1–2 px borders, zero corner radius, harsh contrast. It reads as honest and indie ([setproduct](https://www.setproduct.com/blog/retro-brutalist-ui-design-2026), [brainy.ink](https://brainy.ink/paper/brutalist-web-design-2026)).
- **References:**
  - brutalistwebsites.com.
  - Bloomberg Businessweek covers from the Richard Turley era.
  - Balenciaga; Are.na; Craigslist.
  - **Hacker News**: the orange bar, Verdana, "points by," "Show HN." It is SF tech's own brutalist UI.
  - Ryoji Ikeda's *datamatics* / *test pattern*.
  - Jenny Holzer's LED works.
- **Use:** the Drop 1 world is brutalist, with giant type on raw grids. A "Show HN" card appears in the ending (see the bench list in §5.3).
- **Don't:** vaporwave or synthwave grids (dated) or glassmorphism.

### 4.6 Creative-coding and motion references for the "reality break"

| Reference | What it is | Use for HALYS |
|---|---|---|
| iq's **"Selfie Girl"** ([Shadertoy](https://www.shadertoy.com/view/WsSBzh), [video](https://www.youtube.com/watch?v=8--5LwHRhjk)) | A character painted entirely with maths (raymarched signed distance fields, SDFs) | Build the Act I figures as SDFs with painterly light. It also proves math can feel warm |
| Real-time hatching (Praun et al., SIGGRAPH 2001); Doré engravings | Tonal art maps | The Act I **"living engraving"** look |
| Anisotropic Kuwahara filter; Hertzmann's stroke-based painterly rendering (1998) | Paint-like filters | Chiaroscuro paint without AI smoothness |
| **Ghostty's** ASCII ghost homepage ([frames](https://github.com/jembie/ghostty-animation), [how-to](https://pierce.dev/notes/making-an-ascii-animation)) | Luminance-mapped ASCII video, loved by developers | In Drop 1, **"the world becomes text"** using glyphs from the lyric, not monospace rain |
| Radiohead, "House of Cards" (2008) | A camera-less, LIDAR-captured MV whose data was released | Release our code and data in the same spirit |
| Rhizomatiks × ELEVENPLAY, *discrete figures* (2018) | Point-cloud dancers | Armies as point clouds |
| A$AP Rocky's "HELICOPTER" plus **Spark 2.0** (World Labs, Apr 2026; streaming 3DGS for three.js; [GitHub](https://github.com/sparkjsdev/spark)) | Gaussian splats | Splats as the "simulation substrate." They can be spawned procedurally from SDF surfaces, so no capture is needed |
| Max Cooper ([Emergence](https://emergence.maxcooper.net/); Raven Kwok's ["Rule 110"](https://www.stashmedia.tv/max-cooper-rule-110-music-video-raven-kwok/)) | Mathematics as music video | Rule 110 (a Turing-complete cellular automaton) as the substrate behind the sky |
| **Xor's** tweet-sized shaders ([Shader Arsenal](https://x.com/XorDev/status/1910418378130387328), [code golf](https://mini.gmshaders.com/p/code-golfing)); dwitter | Tiny code as a flex | **Post the eclipse shader as a tweet** |
| Demoscene: Revision 2026 (4k winner "duo" by Nuance; 8k "Aenigma"; [Demozoo](https://demozoo.org/parties/5512/)); "elevated" (2009); "fr-041 debris" (2007) | Films in kilobytes | Optional stunt: a 64k cut of the eclipse |
| Arcade Fire's "The Wilderness Downtown" (2010); "3 Dreams of Black" (2011) | The interactive-MV lineage | **Ship a live web version** of the MV |
| WebGPU, now Baseline in Chrome/Edge, Firefox 141 and Safari 26 ([web.dev](https://web.dev/blog/webgpu-supported-major-browsers)); three.js TSL, where shaders written in JS compile to WGSL or GLSL ([TSL](https://threejs.org/tsl/)) | Practical infrastructure | Compute particles at scale, plus the live version |
| Abeto's *Messenger* (2025): a three.js tiny-planet game that went viral on HN ([webgpu.com](https://www.webgpu.com/showcase/messenger/)) | Charming WebGL with a planet motif | The tone reference for the warm, "hopeful planet" ending |
| TouchDesigner and Notch tour visuals (e.g., [FRAY Studio for Joji 2026](https://fraystudio.com/projects/joji-2026)) | The festival look | Know the "VJ loop" look so we can avoid it |
| **Avoid:** Refik-Anadol-style fluid data blobs ("screensaver"); Anyma-style chrome androids and marble statues with glowing eyes | Clichés this audience associates with AI art | – |

---

## 5. Recommendations mapped to the song

### 5.1 Thesis and narrative logic

- **Thesis:** *When reality breaks, drop the blade and look up.* The only literal modern elements on screen are **space** and **the terminal**. Everything about AI and war stays subtext.
- **The ending's logic.** Historians dispute whether totality even reached the battlefield (ΔT). In our film, **she nudged it there.** The wink means "I fixed it." It is benevolent, not nihilistic.
- **Who the "god" is.** Her 1420 MHz patch (hydrogen line, Wow! signal), her Yagi antenna and her RARE EARTH jacket make her a **listener to the sky**. The "god" behind the eclipse is a curious radio astronomer, not a tyrant.

### 5.2 Section map

| Section | ≈ Time | World and style | Text mode | Beats (§5.3) |
|---|---|---|---|---|
| Hook / cello | 0:00–0:07 | Eclipse-as-eye on black; the engraving draws itself in | Timestamp caption | 1 |
| Orchestra enters, verse 1 | 0:07–≈1:10 | Living engraving and chiaroscuro under an Altdorfer cosmic sky (*Battle of Alexander at Issus*, 1529); animated on 2s | Subtitles on banderoles | 2, 3 |
| Pre-chorus | ≈1:10–1:21 | Partial phase with crescent light; **one flat orange disc intrudes** | Words escape the banderoles | 4 |
| Chorus | ≈1:22–1:50 | Totality; mirror symmetry; the armies freeze and look up | Carved, lit serif type, larger | – |
| **DROP 1** | **1:50.7–2:34.4** | Hard cut into a brutalist, glyph and point-cloud world at 60 fps, with formations | Giant: HALO / IN THE / SKY | 5, 6, 7, 8, 9 |
| Breakdown, verse 2 | 2:34.5–≈3:20 | Sparse navy; the Flammarion moment; birds go quiet; cold breath; the forecast card | Small subtitles, half terminal | 10, 11, 12 |
| Final chorus (beat held) | ≈3:20–3:34 | The light returns; the crowd roars; a sword is thrown upward | Serif type made of particles | 13, 15 |
| **DROP 2** | **3:34.3–≈4:18** | Merged palettes; blades drop on the beat; a starship rises; Earthset | Giant: THROW DOWN / YOUR / BLADE | 14, 15, 16 |
| Ending | ≈4:19–4:33.6 | The eclipse becomes her pupil; pull back to the anime singer at her terminal; the wink | Terminal text | 17, 18, 19, 20 |

### 5.3 Twenty zeitgeist beats

The rule for all of them: they are small, fast and rewatch-discoverable. The main event is still the craft and the emotion. Keep memes out of the sincere breakdown.

| # | Beat | Where | Why it lands with SF tech X | Cringe risk and mitigation |
|---|---|---|---|---|
| 1 | "28 MAY 585 BC," plus "the earliest event in history we can date to the day" | 0:00–0:03 caption, or the title at 0:07 | Precision and a TIL fact; invites "well actually, ΔT…" replies, which is good engagement | **Low** |
| 2 | **The author in the painting**: a convex bronze shield reflects a tiny figure in orange headphones holding a Yagi antenna (the mirror trick from Van Eyck's *Arnolfini Portrait*) | Verse 1, on "Sun burning on the bronze" | Screenshot bait that foreshadows the ending | **Low.** 12 frames or fewer; never call attention to it |
| 3 | "the cellos are getting louder" | Last 2 bars before the pre-chorus (≈1:06–1:10) | The biggest slang spike of 2026, inverted for an orchestra | **Low–medium.** Will date by 2027. Lowercase subtitle, 1.5 s, no emoji |
| 4 | **The intrusion**: a vector-crisp, perfectly flat orange disc (her palette) slides over the painted sun | Pre-chorus, "vacant eye of a god" (≈1:15) | The WandaVision-helicopter device: pattern-matchers clock "simulation" | **Low** |
| 5 | **HALO → HAL**: in giant type, the "O" is eclipsed for 3–4 frames, leaving a red "HAL" | The first chopped "halo" after 1:50.7 | *2001*, "eye of a god" and AI subtext in one frame; screenshot bait | **Low–medium.** Subliminal only; no red-lens imagery beyond the letters |
| 6 | **"we just went sci-fi."**, credited in small type to "V. Glover, Artemis II, during totality, 6 Apr 2026" | The **1:50.7 downbeat** | A real 2026 eclipse quote that literally names the genre switch | **Low–medium.** Attribute accurately; no NASA marks; don't imply endorsement |
| 7 | **The Flammarion moment**: a soldier pushes his head through the firmament and sees the machinery (grids, glyphs, orbits) | Back half of Drop 1 (≈2:06), or verse 2's "reality suddenly broke" | The canonical "see behind reality" image (1888) translated into code | **Low** |
| 8 | **The world becomes text**: the battle re-rendered as luminance-mapped glyphs built from the lyric's letters | Drop 1 (≈2:06–2:34) | Developer culture loves ASCII renders (Ghostty), and it fuses the lyric with the image | **Low–medium.** Use proportional serif glyphs, not Matrix rain |
| 9 | **A 101-billboard parody**: "THE SUN WILL GO DARK. 28.V" with fine print "predicted.", then graffiti tags it "LOOK UP" | A Drop 1 insert of 1 s or less | SF insiders: cryptic AI billboards and the September anti-AI graffiti wave | **Medium.** Don't use "Thales" as a wordmark (Thales Group is a real company). One shot only |
| 10 | **The forecast card**: "Will the sun go dark over the Halys before sunset?" with YES moving from 3¢ to 99¢ as the order book fills | Verse 2 / bridge, "Thales foretold…" | The "first prediction-market election." Thales as the first forecaster, and per Aristotle the first options trader | **Medium.** Generic UI, nothing that looks like Kalshi or Polymarket; 2 s or less |
| 11 | **The saros dial**: Antikythera-style bronze gears spin into lines of code | Same lyric, next bar | "The first computer predicted eclipses": prediction leads to computation leads to simulation | **Low.** The anachronism is fine as metaphor |
| 12 | **Real eclipse tells**: crescent shadows through leaves, birds settling, breath fogging, planets appearing | Verse 2, "Birds went quiet, air suddenly cold" | Authenticity; people filmed exactly this in August 2026 | **Low** |
| 13 | **The roar when the light returns**: diamond ring plus crowd | Final chorus, "Shadow turned to day" | Echoes Reykjavik's soaked crowd cheering louder as the light came back (12 Aug) | **Low** |
| 14 | **The blade drop**: both armies drop their swords exactly on the chopped "BLADE," with one straggler last | The Drop 2 hook | K-pop point choreography: imitable and clip-able | **Low–medium.** Keep the human imperfection |
| 15 | **Sword to starship match cut** | Last line of the final chorus into 3:34.3 | The *2001* bone-to-satellite cut ([Finneas homage 2025](https://billboardphilippines.com/culture/lifestyle/finneas-pays-homage-to-2001-a-space-odyssey-with-new-music-video-2025/)); Starship reached orbit on 28 Sep; "swords into starships" | **Medium.** Unbranded stainless ship, no Musk or SpaceX marks; one cut, no hold |
| 16 | **Earthset** | Drop 2 resolve (≈4:10–4:18), under "go home to the ones you love" | The defining space image of 2026, and an image of home | **Low** |
| 17 | **Terminal reveal**: `seed=-585`, `world.step()`, a ΔT band plot where she drags totality onto the battlefield, a spinner verb ("syzygizing…"), the commit `fix(halys): schedule eclipse to end war (#585)`, and a log line `6EQUJ5` | Ending, ≈4:19–4:30 | Agentic terminals are SF's daily life, and the skeptic joke resolves the "was it really total?" debate | **Low** if the code is real and readable on pause; **high** if it looks like a fake-hacker screen |
| 18 | **Persistent agent panes** named `lydians`, `medes`, `sun`, `moon`, still running as she leans back | Ending | Always-on agents (DevDay, Sep 29); agent societies | **Low–medium** |
| 19 | The wink, plus an optional output line: `why would i deceive you?` | Final 2 s | The Holmes/Fielder meme of the moment | **High.** Use it only for an October 2026 launch; otherwise leave the line out |
| 20 | End card: **"NEXT TOTALITY · 2027-08-02 · LUXOR · 6m23s"**, plus a "view source" link and the live WebGL URL | After the final chord | Hope, proof of craft, and a future date | **Low**, but only once the published source matches the provenance claim (§0.1) |

**Bench (use only if there's room):**
- A "Show HN: Halys – stopping a war with a scheduled eclipse (585 BC) | 1 point by thales 2610 years ago" card on her second monitor. Low–medium risk.
- A Rise-like plush floating in her room as a nod to Artemis II. Low–medium risk; the design must be our own.
- A "2 instances of outlook running" toast. Niche.
- "it's so over / we're so back" in the logs. Worn out.

### 5.4 Do-not-do list

1. **No gen-AI imagery or video in the final frames**, and none traced or rotoscoped into them. That includes the Seedance plates (§0.1) and AI concept art. Lock the character's patch text ("1420 MHz," "RARE EARTH") in every frame.
2. **Don't overclaim.** Use only the provenance line your actual pipeline allows (§0.1). If any audio used AI tools, including AI sound effects, disclose it under distributor rules. A "gotcha" reply would sink the launch.
3. **Don't open on black,** a logo, a slow fade or an establishing landscape. Hold the "HALYS — Jade Wang" title until after 0:07.
4. **Don't make the Medes the villains** or an "exotic horde." No modern military signifiers. Nothing photoreal enough to clip as war footage.
5. **No real brands or cloned UIs:** SpaceX or NASA marks, Kalshi or Polymarket UIs, Claude/ChatGPT/terminal product UIs, the HN logo, the Thales Group wordmark. Parody the *format*, never the trademark.
6. **No Musk-centric iconography.** It polarizes exactly this audience. Celebrate people in space, not a CEO.
7. **No self-explaining or fast-expiring meme text** outside of easter eggs: no "POV:," "it's giving," "aura +1000," "mogged," "lock in," "6-7," "clanker," "feel the AGI," "e/acc" or "permanent underclass."
8. **Never put "AGI" on screen,** and don't pick sides in the lab wars. Let the subtext work.
9. **No film stills or quotes** from *The Odyssey*, *2001*, *The Truman Show* or KPop Demon Hunters. Homage through composition only.
10. **Don't make the simulation reveal nihilistic** ("nothing is real"). She chose peace, and the wink is affectionate.
11. **No fake-hacker terminal.** Every line must be valid code or plausible CLI output; developers will pause, read it and post corrections.
12. **Avoid vibe-coded and AI-art looks:** indigo-violet gradients, Inter, glassmorphism, bloom and chromatic aberration everywhere, Perlin particle swirls, Matrix rain, synthwave sun and grid, Anadol data-fluids, Anyma chrome androids and glowing-eyed statues.
13. **Avoid AI-anime tells:** Ghibli-soft shading, a yellow cast, a same-face design, melting hair, buttery interpolation. Animate her on 2s, with real holds, smears and variation in line weight.
14. **No floaty perpetual push-ins or morph transitions.** Cut on the beat, lock off and hold.
15. **No text a phone can't read:** keep to 15 cps or less, subtitles at 4–5% of frame height or more, and everything inside the 4:5 center-safe zone.
16. **No Eye-of-Providence triangles** for "the eye of a god"; they read as Illuminati and conspiracy.
17. **Don't put the YouTube link in the main post.** Don't let the full film be anyone's first impression; lead with teasers. Avoid launching in US midterm week (3 Nov 2026).

### 5.5 Three hook openings for the first 3 seconds (the music is pianissimo until 0:07)

**A. "The Eye" (preferred)**
- **0.00 s.** Frame 0 is a total eclipse filling about 60% of the frame. The corona streamers are already moving and ripple like iris fibers. Maximum contrast, and not a black frame.
- **0.25 s.** Engraved small caps: **28 MAY 585 BC**.
- **0.70 s.** A second line: **the sun went out in the middle of a battle.**
- **1.3–1.7 s.** The disc slips and a **diamond-ring flash** fires. The corona "blinks" shut like an eyelid; this is the biggest luminance event in the opening.
- **1.7–3.0 s.** Hard cut to the battlefield engraving moments earlier, with tiny armies under a vast sky. A line: **both armies stopped.**

*Why it works:* it reads within 0.25 s, has eyes, motion and an open loop ("why did they stop?"), works muted, and pays off at 4:2x with the match cut from eclipse to her pupil and the wink.

**B. "585 BC" in giant type**
- **0.00 s.** A parchment ground with a giant black serif **585 BC** filling the width, slightly misregistered like an engraving print and already drifting.
- **0.4 s.** A black disc slides across the type and **eclipses the letters**. Their counters fill with shadow and the type becomes a corona ring.
- **1.2 s.** A subline: **a war stopped because the sun went out.**
- **2.2 s.** The letters crack into engraving strokes that draw the battlefield.

*Why it works:* giant type is the most legible thing in a muted feed, and "the eclipse eats the words" introduces our type system. *Risk:* it can read as a history explainer, so keep the texture tactile and the action fast.

**C. "The cursor in the sky" (best saved for the developer-facing teaser)**
- **0.00 s.** A chiaroscuro close-up of a Lydian soldier mid-shout, frozen, with dust hanging in the air.
- **0.4 s.** A one-pixel-sharp orange terminal caret blinks in the dark sky, the only non-painted thing in the frame.
- **1.0 s.** The soldier's eyes roll up toward it. Caption: **year six of the war.**
- **2.0 s.** The caret types `eclipse()`. Cut.

*Why it works:* it is the whole film in one frame, and tech X recognizes it instantly. *Risk:* it spoils Drop 1, so in the main film the caret should last 12 frames at most.

### 5.6 Format, length and teaser strategy for X in 2026

**Aspect ratio: re-render, don't crop.**
- Compose every shot around a center-safe circle, then render natively:
  - **16:9**, 3840×2160 at 60 fps, as the YouTube master.
  - **4:5**, 1080×1350 at 60 fps, as **the full film on X**.
  - **9:16**, 1080×1920 at 60 fps, for teasers, Shorts, Reels and TikTok.
- Re-flow the type for each aspect. "The responsive music video" is itself a talking point.
- Why 4:5 on X:
  - Most X viewing is mobile, and 4:5 takes up roughly twice the feed height of 16:9 while keeping the battle panoramas.
  - X stopped cropping vertical video in-feed in February 2026 and added a full-screen immersive player with swipe-up ([TechCrunch](https://techcrunch.com/2026/02/18/x-continues-to-bet-on-vertical-video-with-its-latest-update/)). That makes 9:16 viable, but tall frames lose the Altdorfer compositions, and swipe-up invites viewers to leave.
  - 4:5 is supported ([posteverywhere](https://posteverywhere.ai/blog/x-twitter-aspect-ratios)). A/B test 4:5 against 9:16 with the teasers first.
  - If the final pull-back truly needs width, a 16:9 full film is acceptable, but then lead with 4:5 and 9:16 teasers.

**X constraints:**
- **Free accounts are capped at 2:20** (140 s, 512 MB). **Premium allows up to 4 hours at 1080p from the web or iOS;** Android has a lower cap, so upload from the web ([nemovideo](https://www.nemovideo.com/blog/twitter-video-length-limits), [buzzvoice](https://buzzvoice.com/blog/how-long-can-twitter-videos-be)) *(secondary)*.
- Video autoplays muted and captions are off, so **burn in every lyric**. Also attach an SRT for accessibility.
- **Links in the main post cost an estimated 30–50% of reach** (2026 reports), so put YouTube and Spotify in the **first reply**. Native X video gets the video boost; YouTube links don't ([ppc.land](https://ppc.land/how-xs-algorithm-silently-kills-your-links-without-explicitly-penalizing-them/), [SocialPilot](https://www.socialpilot.co/blog/twitter-algorithm)) *(secondary)*.
- Frame 0 is the poster for anyone with autoplay off.
- **State the provenance plainly** to defuse "AI slop" replies, using the §0.1 line that is actually true. With option A, that is: "No generative AI in the picture. Every frame is drawn by our JavaScript."
- **If you publish the source** (the "view source" card and the live version), it must match the claim. The repo currently contains `plates.py` and `genlog.jsonl`.

**Lengths and cuts.** Completion rates fall off sharply after about 30 s, according to a study of 380,000 X clips ([Opus](https://www.opus.pro/research/twitter-x-video-guide)) *(secondary)*.

| Asset | Source range | Length | Aspect | Purpose |
|---|---|---|---|---|
| T1 "The Eye" loop | 0:00–0:12 | 6–12 s | 4:5 and 9:16 | Works muted; announces the date |
| T2 "The Switch" | ≈1:42–2:02 | 20 s | 4:5 / 9:16 | Shows the genre break at 1:50.7; **don't show the ending** |
| T3 "Throw down your blade" | ≈3:26–3:50 | 24 s | 4:5 / 9:16 | The held beat into Drop 2, the blade drop, and the starship |
| T4 "Source" (developer cut) | Code next to frame, split-screen | 20–30 s | 16:9 or 4:5 | Proof of craft, or the eclipse shader posted as a 280-character tweet. Post only after the §0.1 decision |
| Full film | 0:00–4:33.6 | 4:34 | 4:5 on X, 16:9 on YouTube | Pinned post, with no pre-roll |
| Post-launch clips | Easter eggs (the HAL frame, the shield reflection), and the wink as a 6 s loop after 3–5 days | 6–15 s | 9:16 | Drives rewatches |

**Cadence:**
- **T−7 days:** T1.
- **T−3 days:** T2.
- **T−1 day:** T4.
- **Launch day:** the full film, pinned. Replies carry the YouTube 4K link, Spotify and Apple links, a how-it's-made thread with shader snippets, and the live WebGL link.
- **T+2 days:** T3.
- **T+5 days:** the easter-egg clips.
- **Evergreen re-shares:** **28 May 2027** (the Halys anniversary) and **2 Aug 2027** (totality over Luxor).
- **Post time:** weekday mornings Pacific *(heuristic)*.
- **Avoid:** midterm week (3 Nov) and "Dunesday" week (18 Dec).

**Other platforms:**
- YouTube Shorts allow up to 3 minutes ([SEJ](https://www.searchenginejournal.com/youtube-extends-shorts-to-3-minutes-adds-new-features/529177/)).
- Instagram Reels longer than 3 minutes aren't recommended to non-followers ([Ordinal](https://www.tryordinal.com/blog/how-long-can-an-instagram-reel-be)).
- TikTok accepts uploads up to 60 minutes ([FlowShorts](https://flowshorts.app/blog/how-long-can-tiktok-be)).

**Launch copy options.** Keep the meme-free, universal register.
- *"585 BC: two armies stopped fighting mid-battle because the sun went out. Every frame is drawn in JavaScript. HALYS, by Jade Wang."* Add "No generative AI in the picture" only under §0.1 option A.
- *"What was it like when reality suddenly broke? 2,610 years ago, both armies threw down their blades."* This is the strongest fit with the AGI-era and war mood without naming either.

---

### Open items and verification notes

- **Decide provenance (§0.1 option A, B or C) before writing any copy, thumbnails or the "view source" card.** As the pipeline stands, Seedance plates make "no AI" false.
- **Lyric placement within sections is still unconfirmed.** The energy-derived anchors in §1 are solid; the placement of verse 1, the pre-chorus and the chorus needs an ear pass or the stems.
- **Tempo and key:** run a beat tracker to confirm 136 BPM. The chroma analysis reads B minor throughout, with no C♯ minor modulation.
- **Earthset, the eclipse-from-Orion image and the Wow! signal** are references. NASA imagery is generally public domain, but we draw our own versions anyway.
- **Quotes:** Glover's line is a short public quote. Attribute it accurately and don't imply endorsement.
- **Unverified details:** the exact timestamp of *The Wizard of Oz* transition (given as about 20 min), the Awwwards status of *Messenger*, and the ~93% "muted start" figure for X.
