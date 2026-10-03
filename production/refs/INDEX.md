# Reference library index

48 files, all ≤1600 px on the long side. Each one is public domain (CC0) or our own computed output.
Character and set briefs say which files to attach: see `production/RESEARCH.md` §3–4.

**Sources and licences**

- **`met_<id>_…`**: The Metropolitan Museum of Art, Open Access. Every file is marked "Is Public Domain = True" and released under **CC0 1.0**.
  - The images were fetched from the Met's mirror in the Google Cloud Public Datasets (`gs://gcs-public-data--met/<id>/0.jpg`) and downscaled.
  - The object page is `https://www.metmuseum.org/art/collection/search/<id>`.
  - Credit as "The Metropolitan Museum of Art, <credit line>". Credit is not required, but it is good practice.
- **`landsat8_…`**: USGS/NASA Landsat 8 OLI, scene `LC08_L1TP_176033_20210521_20210529_01_T1`.
  - Bands 4-3-2 in true colour, with one shared stretch so the colour balance holds.
  - Fetched from the Google Cloud public dataset `gcp-public-data-landsat`.
  - Landsat data carry no copyright. Credit "USGS/NASA Landsat".
  - The date, 21 May, is a near-exact seasonal match: 28 May 585 BC (Julian) is 22 May on the proleptic Gregorian calendar.
- **`computed_…`**: our own output.
  - Made with JPL DE422 and Skyfield, using our adapter, with Natural Earth vectors (public domain). See RESEARCH.md §8.
  - Free to use in the film.

> Caution for prompts: some refs are deliberately *later* or *neighbouring* material, standing in where nothing from 585 BC survives (Persepolis is 515–330 BC; Assyrian reliefs are 8th–7th c. BC). RESEARCH.md §3 says what to borrow from each and what not to.

## eclipse/

| File | What it shows | Source | Licence |
|---|---|---|---|
| `computed_eclipse-path-585BC-anatolia_DE422.png` | Path of totality across Anatolia on 28 May 585 BC for three ΔT values: 18,213 s (Stephenson–Morrison–Hohenkerk spline), 18,384 s (NASA canon) and 19,000 s. Grey shading gives the duration (canonical ΔT). Red line: the Kızılırmak/Halys. Labelled sites include Sardis, Miletus, Gordion, Ankara, Hattusa, Kerkenes, Kültepe, Konya, Tyana, Tarsus and the Avanos bend. | Own computation (JPL DE422, Skyfield, Natural Earth) | Own work, free to use |
| `computed_sky-at-totality-585BC-looking-WNW.png` | The sky at mid-totality looking WNW from central Anatolia (38.4°N 33.9°E). Eclipsed Sun at alt 8.4°, az 289°. Jupiter −1.8, Mars, Saturn, Mercury (lost in glow); Pollux and Castor above the Sun; Procyon, Capella, Regulus. Venus is *below* the horizon. Sky colours are schematic. | Own computation | Own work, free to use |
| `met_283180_langenheim_eclipse-of-the-sun_daguerreotypes_1854.jpg` | W. & F. Langenheim, *Eclipse of the Sun*, 1854: seven daguerreotypes of the 26 May 1854 annular eclipse in sequence. Reference for a phase sequence read like a strip. | [Met 283180](https://www.metmuseum.org/art/collection/search/283180) | CC0 |
| `met_321969_seleucid_eclipse-ephemeris-tablet.jpg` | Cuneiform tablet: an ephemeris of eclipses (Seleucid, c. 4th–2nd c. BC). The Babylonian eclipse-cycle tradition behind any "how did Thales know" scene; good as a prop or texture. | [Met 321969](https://www.metmuseum.org/art/collection/search/321969) | CC0 |

## landscape/

| File | What it shows | Source | Licence |
|---|---|---|---|
| `landsat8_2021-05-21_kizilirmak-halys-bend-avanos-cappadocia.jpg` | True-colour satellite view of the Kızılırmak's southern bend near Avanos (Cappadocia) in late May. Note the brownish, sediment-laden river, the thin green riparian strip, the ochre-tan steppe, irrigated fields and the tuff badlands. | USGS/NASA Landsat 8, scene above | Public domain |
| `landsat8_2021-05-21_central-anatolia-halys-arc-tuz-golu.jpg` | Wider view of the central plateau: the Halys arc, Hirfanlı reservoir (modern), and the edge of the Tuz Gölü salt lake. Scale and colour reference for the "strategy-board" relief map. | USGS/NASA Landsat 8, scene above | Public domain |

## lydian/

| File | What it shows | Source | Licence |
|---|---|---|---|
| `met_252454_lydian_gold-stater-lion-and-bull_c560-546BC.jpg` | Lydian gold stater with confronted lion and bull foreparts, c. 560–546 BC (Croesus era). The lion is the Lydian royal emblem: use it for shield blazons, standards and Alyattes' seal. | [Met 252454](https://www.metmuseum.org/art/collection/search/252454) | CC0 |
| `met_252461_lydian-or-east-greek_marble-seated-lion_c500BC.jpg` | Marble seated lion, Lydian or East Greek, c. 500 BC, from Sardis. Sculptural lion for Sardis sets and the MARBLE world. | [Met 252461](https://www.metmuseum.org/art/collection/search/252461) | CC0 |
| `met_249085_lydian_lydion-perfume-jar.jpg` | A *lydion*, the Lydian perfume/unguent jar: a footed, round-bellied flask with dark horizontal bands on orange clay, from Sardis. Prop and colour reference (Lydian luxury goods). | [Met 249085](https://www.metmuseum.org/art/collection/search/249085) | CC0 |
| `met_252459_lydian_inscribed-marble-stele.jpg` | Marble stele with a Lydian-script inscription, from Sardis. Real Lydian letterforms, usable for set dressing. Do not invent pseudo-script. | [Met 252459](https://www.metmuseum.org/art/collection/search/252459) | CC0 |

## greek_ionian/

| File | What it shows | Source | Licence |
|---|---|---|---|
| `met_247983_corinthian-helmet_late7th-6thC_BC.jpg` | Bronze Corinthian helmet, late 7th–6th c. BC. Period-correct closed helmet for Greek and Carian mercenaries and Greek-style Lydian infantry. | [Met 247983](https://www.metmuseum.org/art/collection/search/247983) | CC0 |
| `met_247238_amasis-painter_amphora-warriors_c550BC.jpg` | Attic black-figure amphora by the Amasis Painter, c. 550 BC, with armed warriors. Hoplite kit: round shield with blazon, crested helmet, greaves, spears. | [Met 247238](https://www.metmuseum.org/art/collection/search/247238) | CC0 |
| `met_247955_affecter_neck-amphora-warriors_c550BC.jpg` | Attic neck-amphora by the Affecter, c. 550–540 BC: warriors, horsemen and draped figures. Silhouette language and patterned cloaks. | [Met 247955](https://www.metmuseum.org/art/collection/search/247955) | CC0 |
| `met_239950_milesian-fikellura_oinochoe-fragment_c555BC.jpg` | Fikellura-style oinochoe fragment, East Greek (Milesian), c. 560–550 BC (Altenburg Painter): a winged hybrid chasing a spotted deer above a band of square meanders, in red-brown on cream slip. **Pottery of Thales' own city and generation**: dressing and pattern source for the Miletus set. | [Met 239950](https://www.metmuseum.org/art/collection/search/239950) | CC0 |
| `met_248678_corinthian_cavalcade-painter_horsemen-krater_c590-570BC.jpg` | Corinthian column-krater fragment by the Cavalcade Painter, **c. 590–570 BC** (the eclipse generation): a frieze of riders and horses. Bridles, riding seat and horse type for cavalry. | [Met 248678](https://www.metmuseum.org/art/collection/search/248678) | CC0 |
| `met_254843_amasis-painter_wedding-procession-lekythos_c550-530BC.jpg` | Lekythos by the Amasis Painter, c. 550–530 BC: a **wedding procession**, with bride and groom in a cart and attendants with torches and gifts. Staging for the Aryenis–Astyages marriage. | [Met 254843](https://www.metmuseum.org/art/collection/search/254843) | CC0 |
| `met_253348_amasis-painter_women-weaving-lekythos_c550-530BC.jpg` | Lekythos by the Amasis Painter, c. 550–530 BC: **women weaving at a warp-weighted loom**, spinning and folding cloth. Women's dress (patterned peploi) and the textile economy of Ionia and Lydia. | [Met 253348](https://www.metmuseum.org/art/collection/search/253348) | CC0 |

## median_persian_scythian/

| File | What it shows | Source | Licence |
|---|---|---|---|
| `met_323723_persepolis_mede-in-felt-cap_relief.jpg` | Achaemenid relief, Persepolis (c. 405–359 BC), profile figure in "Median" dress: rounded felt cap, hair bunched in curls at the nape, curled beard, belted tunic. Later than 585 BC, but Herodotus 7.62 says this dress *is* Median. | [Met 323723](https://www.metmuseum.org/art/collection/search/323723) | CC0 |
| `met_323178_persepolis_servants-bashlyk-hood_relief.jpg` | Achaemenid relief (c. 358–338 BC): two servants carrying food and drink, wearing the hood (bashlyk) wrapped over chin and mouth. The hood type for Median riders on a dusty field. | [Met 323178](https://www.metmuseum.org/art/collection/search/323178) | CC0 |
| `met_324433_persepolis_head-of-persian-guard.jpg` | Head of a Persian guard, Persepolis (c. 486–465 BC): curled beard, profile, spear. The *fluted* tiara is **Persian court dress: do NOT put it on Medes**. Use only for beard and face carving. | [Met 324433](https://www.metmuseum.org/art/collection/search/324433) | CC0 |
| `met_322895_khorsabad_tribute-groom-fleece-cloak-horses_c715BC.jpg` | Khorsabad relief, Sargon II (c. 721–705 BC): a foreign groom leading horses, with headband, curly hair and beard, and a fleece cloak. **The earliest depictions of Medes are of this type**: the best pre-Achaemenid anchor for Median soldiers. | [Met 322895](https://www.metmuseum.org/art/collection/search/322895) | CC0 |
| `met_255955_scythian-mounted-archer_statuette.jpg` | Bronze statuette of a "Scythian" mounted archer (Etruscan/Campanian, early 5th c. BC). Twisting shot from horseback. Herodotus 1.73 says Scythians taught Median boys archery. | [Met 255955](https://www.metmuseum.org/art/collection/search/255955) | CC0 |
| `met_324669_iran_horse-bit-horse-cheekpieces_8th-7thC_BC.jpg` | Bronze horse bit with cheekpieces cast as horses, Iran, 8th–7th c. BC. Period Iranian horse tack. | [Met 324669](https://www.metmuseum.org/art/collection/search/324669) | CC0 |
| `met_324293_iran_gold-plaque-winged-creatures_8th-7thC_BC.jpg` | Gold plaque, Iran, 8th–7th c. BC (Ziwiye style): registers of winged creatures approaching stylised trees. **Contemporary Iranian royal ornament**: belt, pectoral and collar patterns for Cyaxares and Astyages. | [Met 324293](https://www.metmuseum.org/art/collection/search/324293) | CC0 |
| `met_327364_iran_gold-lion-hunt-panel_8th-7thC_BC.jpg` | Gold panel fragment, Iran, 8th–7th c. BC: a hero or king in a long patterned robe stabbing a rearing lion. A rare image of an Iranian figure of the period, for royal costume and motifs. | [Met 327364](https://www.metmuseum.org/art/collection/search/327364) | CC0 |

## assyrian_babylonian/

| File | What it shows | Source | Licence |
|---|---|---|---|
| `met_322623_sennacherib_cavalry-along-stream_relief.jpg` | Relief from Sennacherib's palace, Nineveh (c. 704–681 BC): cavalrymen in mountainous terrain beside a stream. Riding posture, saddle-cloths, horses in water, scale patterns for terrain. | [Met 322623](https://www.metmuseum.org/art/collection/search/322623) | CC0 |
| `met_322625_sennacherib_cavalryman-leading-horse_relief.jpg` | Same palace: a cavalryman leading his horse beside a stream with fish. Horse at rest, plus a water convention for the MARBLE world. | [Met 322625](https://www.metmuseum.org/art/collection/search/322625) | CC0 |
| `met_322620_assyrian_crown-prince-court-dress_relief_704-681BC.jpg` | "Assyrian Crown-Prince" relief (c. 704–681 BC): long fringed robe, diadem band, square-cut curled beard, hands clasped. **Mesopotamian court dress**, the anchor for Labynetus of Babylon (Neo-Babylonian dress followed this tradition). | [Met 322620](https://www.metmuseum.org/art/collection/search/322620) | CC0 |
| `met_322585_babylon_striding-lion-glazed-brick_604-562BC.jpg` | Glazed-brick striding lion from Babylon's Processional Way (Nebuchadnezzar II, 604–562 BC), **exactly contemporary**. Babylonian colour (turquoise, white, yellow) for Labynetus' world. | [Met 322585](https://www.metmuseum.org/art/collection/search/322585) | CC0 |

## neo_hittite/

| File | What it shows | Source | Licence |
|---|---|---|---|
| `met_322140_neo-hittite_bearded-ruler-with-staff_relief_early1stM_BC.jpg` | Basalt relief (Anatolia, early 1st millennium BC): a bearded figure in a long robe holding a staff, with a Luwian hieroglyphic inscription. Neo-Hittite ruler iconography for **Syennesis of Cilicia**. The relief is worn, so read it for silhouette only. | [Met 322140](https://www.metmuseum.org/art/collection/search/322140) | CC0 |

## sculpture/

| File | What it shows | Source | Licence |
|---|---|---|---|
| `met_253370_new-york-kouros_c590-580BC.jpg` | The New York Kouros, Attic marble, **c. 590–580 BC**. The ideal young male body of the eclipse generation: long beaded hair and frontal stance. The MARBLE-world template for frozen warriors. | [Met 253370](https://www.metmuseum.org/art/collection/search/253370) | CC0 |
| `met_242401_cypriot_bearded-head-conical-helmet_c600BC.jpg` | Over-lifesize Cypriot limestone head, late 7th–early 6th c. BC: conical helmet, long stylised beard, archaic smile. East Mediterranean ruler and warrior face of c. 600 BC (Syennesis, eastern contingents). | [Met 242401](https://www.metmuseum.org/art/collection/search/242401) | CC0 |
| `met_242092_cypriot_limestone-woman-necklaces_early6thC_BC.jpg` | Cypriot limestone statue of a woman, **early 6th c. BC**: long garment, veil or headband, and stacked necklaces. A contemporary East Mediterranean noblewoman: the jewellery anchor for Aryenis. | [Met 242092](https://www.metmuseum.org/art/collection/search/242092) | CC0 |
| `met_204758_canova_perseus-with-the-head-of-medusa_1804.jpg` | Canova, *Perseus with the Head of Medusa*, 1804–06. Polished white-marble finish and specular look for MARBLE (finish only, not anatomy style). | [Met 204758](https://www.metmuseum.org/art/collection/search/204758) | CC0 |
| `met_436483_gerome_pygmalion-and-galatea_c1890.jpg` | Gérôme, *Pygmalion and Galatea*, c. 1890: marble turning to flesh from the feet up. **The exact transition for the final chorus** (MARBLE → GOLD). | [Met 436483](https://www.metmuseum.org/art/collection/search/436483) | CC0 |

## painting/

| File | What it shows | Source | Licence |
|---|---|---|---|
| `met_437986_caravaggio_denial-of-saint-peter_1610.jpg` | Caravaggio, *The Denial of Saint Peter*, 1610: three half-length figures in raking light out of black. The tenebrist lighting key for BRONZE close-ups. | [Met 437986](https://www.metmuseum.org/art/collection/search/437986) | CC0 |
| `met_436839_la-tour_penitent-magdalen_c1640.jpg` | Georges de La Tour, *The Penitent Magdalen*, c. 1640: a single candle, a mirror, stillness. Night-interior key for Thales' study and the "time paused" mood. | [Met 436839](https://www.metmuseum.org/art/collection/search/436839) | CC0 |
| `met_436453_gentileschi_esther-before-ahasuerus_1620s.jpg` | Artemisia Gentileschi, *Esther before Ahasuerus*, 1620s: a queen before a king, in silk and brocade. Costume rendering and female presence for Aryenis. | [Met 436453](https://www.metmuseum.org/art/collection/search/436453) | CC0 |
| `met_437536_rubens_wolf-and-fox-hunt_c1616.jpg` | Rubens, *Wolf and Fox Hunt*, c. 1616: a spiral tangle of horses, riders and animals. Composition engine for the mêlée. | [Met 437536](https://www.metmuseum.org/art/collection/search/437536) | CC0 |
| `met_437969_zurbaran_battle-at-el-sotillo_c1637.jpg` | Zurbarán, *Battle between Christians and Muslims at El Sotillo*, c. 1637–39: a night battle lit by a celestial apparition. A precedent for a sky-light event stopping a fight. **Avoid its religious "us vs. them" framing.** | [Met 437969](https://www.metmuseum.org/art/collection/search/437969) | CC0 |
| `met_437329_poussin_abduction-of-the-sabine-women_c1633.jpg` | Poussin, *The Abduction of the Sabine Women*, c. 1633–34: classical architecture with crowd choreography. (The Sabines later stopped a war between their kin: a thematic echo.) | [Met 437329](https://www.metmuseum.org/art/collection/search/437329) | CC0 |
| `met_436575_el-greco_view-of-toledo_c1600.jpg` | El Greco, *View of Toledo*, c. 1599–1600: storm-green landscape under an unnatural, ominous sky. Light "going strange" over terrain. | [Met 436575](https://www.metmuseum.org/art/collection/search/436575) | CC0 |
| `met_437191_van-der-neer_landscape-at-sunset_1650s.jpg` | Aert van der Neer, *Landscape at Sunset*, 1650s: a river at dusk with a low sun and silhouettes. Key for the post-totality golden hour by the river. | [Met 437191](https://www.metmuseum.org/art/collection/search/437191) | CC0 |
| `met_437888_vernet_start-of-the-race-of-the-riderless-horses_1820.jpg` | Horace Vernet, *Start of the Race of the Riderless Horses*, 1820: rearing horses restrained by grooms. Horse anatomy under tension. | [Met 437888](https://www.metmuseum.org/art/collection/search/437888) | CC0 |
| `met_439631_delacroix_ovid-among-the-scythians_1862.jpg` | Delacroix, *Ovid among the Scythians*, 1862: a steppe people shown hospitably, not as a horde, in a green valley. Tone model for depicting the "other side" with warmth. | [Met 439631](https://www.metmuseum.org/art/collection/search/439631) | CC0 |

## thales/

| File | What it shows | Source | Licence |
|---|---|---|---|
| `met_437394_rembrandt_aristotle-with-a-bust-of-homer_1653.jpg` | Rembrandt, *Aristotle with a Bust of Homer*, 1653: a philosopher in golden light and contemplation. Mood and light for Thales (not his costume: this is 17th-c. fantasy dress). | [Met 437394](https://www.metmuseum.org/art/collection/search/437394) | CC0 |
| `met_436105_david_death-of-socrates_1787.jpg` | David, *The Death of Socrates*, 1787: Greek philosopher iconography of himation and gesture. Classical pose vocabulary. Socrates here is old; **Thales in 585 BC was about 40**. | [Met 436105](https://www.metmuseum.org/art/collection/search/436105) | CC0 |
| `met_334340_brebiette_two-philosophers-watching-an-eclipse.jpg` | Pierre Brebiette, *Two Philosophers Watching an Eclipse*, etching, 1615–42. Historical depiction of eclipse-watching. Its armillary sphere is **anachronistic for Thales**. | [Met 334340](https://www.metmuseum.org/art/collection/search/334340) | CC0 |
