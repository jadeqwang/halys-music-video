"""Reference boards and generation jobs for the HALYS art department (see boards.py)."""

G = "greek_ionian/"
L = "lydian/"
M = "median_persian_scythian/"
A = "assyrian_babylonian/"
S = "sculpture/"
P = "painting/"
T = "thales/"
E = "eclipse/"
LS = "landscape/"

# name -> [(ref path under production/refs or repo, crop box as fractions (x0, y0, x1, y1) or None)]
REFBOARDS = {
    # Lydian infantry: hoplite kit on an East-Greek-generation vase, the Lydian lion, the kouros' beaded long hair
    "lyd_inf": [(G + "met_247238_amasis-painter_amphora-warriors_c550BC.jpg", (0.24, 0.27, 0.80, 0.53)),
                (L + "met_252454_lydian_gold-stater-lion-and-bull_c560-546BC.jpg", (0.37, 0.36, 0.67, 0.63)),
                (S + "met_253370_new-york-kouros_c590-580BC.jpg", (0.22, 0.0, 0.78, 0.36))],
    "lyd_helmet": [(G + "met_247983_corinthian-helmet_late7th-6thC_BC.jpg", None)],
    # Median spearman: Persepolis 'Median dress' cap/curls/beard, the Khorsabad groom (earliest Mede type), the hood
    "med_sp": [(M + "met_323723_persepolis_mede-in-felt-cap_relief.jpg", (0.0, 0.08, 1.0, 0.75)),
               (M + "met_322895_khorsabad_tribute-groom-fleece-cloak-horses_c715BC.jpg", (0.08, 0.1, 0.62, 0.95)),
               (M + "met_323178_persepolis_servants-bashlyk-hood_relief.jpg", (0.02, 0.1, 0.52, 0.95))],
    "med_arch": [(M + "met_255955_scythian-mounted-archer_statuette.jpg", (0.15, 0.0, 0.9, 1.0)),
                 (M + "met_323178_persepolis_servants-bashlyk-hood_relief.jpg", (0.02, 0.1, 0.52, 0.95)),
                 (M + "met_323723_persepolis_mede-in-felt-cap_relief.jpg", (0.0, 0.08, 1.0, 0.75))],
    "lyd_cav": [(G + "met_248678_corinthian_cavalcade-painter_horsemen-krater_c590-570BC.jpg", (0.02, 0.12, 0.98, 0.62)),
                (A + "met_322623_sennacherib_cavalry-along-stream_relief.jpg", None)],
    "horse_art": [(P + "met_437888_vernet_start-of-the-race-of-the-riderless-horses_1820.jpg", None)],
    "thales": [(S + "met_253370_new-york-kouros_c590-580BC.jpg", (0.22, 0.0, 0.78, 0.36)),
               (G + "met_247955_affecter_neck-amphora-warriors_c550BC.jpg", (0.20, 0.27, 0.80, 0.55)),
               (G + "met_239950_milesian-fikellura_oinochoe-fragment_c555BC.jpg", (0.05, 0.25, 0.95, 0.85))],
    "thales_mood": [(T + "met_437394_rembrandt_aristotle-with-a-bust-of-homer_1653.jpg", None)],
    "alyattes": [(L + "met_252454_lydian_gold-stater-lion-and-bull_c560-546BC.jpg", (0.37, 0.36, 0.67, 0.63)),
                 (S + "met_242401_cypriot_bearded-head-conical-helmet_c600BC.jpg", None),
                 (G + "met_247238_amasis-painter_amphora-warriors_c550BC.jpg", (0.24, 0.27, 0.80, 0.53))],
    "royal_silk": [(P + "met_436453_gentileschi_esther-before-ahasuerus_1620s.jpg", None)],
    "cyaxares": [(M + "met_323723_persepolis_mede-in-felt-cap_relief.jpg", (0.0, 0.08, 1.0, 0.75)),
                 (M + "met_324293_iran_gold-plaque-winged-creatures_8th-7thC_BC.jpg", None),
                 (M + "met_327364_iran_gold-lion-hunt-panel_8th-7thC_BC.jpg", None)],
    "aryenis": [(S + "met_242092_cypriot_limestone-woman-necklaces_early6thC_BC.jpg", (0.2, 0.0, 0.8, 0.62)),
                (G + "met_254843_amasis-painter_wedding-procession-lekythos_c550-530BC.jpg", (0.12, 0.30, 0.88, 0.60)),
                (L + "met_249085_lydian_lydion-perfume-jar.jpg", (0.2, 0.05, 0.8, 0.95))],
    "labynetus": [(A + "met_322620_assyrian_crown-prince-court-dress_relief_704-681BC.jpg", None),
                  (E + "met_321969_seleucid_eclipse-ephemeris-tablet.jpg", None)],
    "syennesis": [("neo_hittite/met_322140_neo-hittite_bearded-ruler-with-staff_relief_early1stM_BC.jpg", None),
                  (S + "met_242401_cypriot_bearded-head-conical-helmet_c600BC.jpg", None)],
    "halys_land": [(LS + "landsat8_2021-05-21_kizilirmak-halys-bend-avanos-cappadocia.jpg", None)],
    "riverlight": [(P + "met_437191_van-der-neer_landscape-at-sunset_1650s.jpg", None)],
    "sky_chart": [(E + "computed_sky-at-totality-585BC-looking-WNW.png", None)],
}

JOBS = {}


def job(jid, model, folder, prompt, refs=(), **params):
    JOBS[jid] = {"model": model, "folder": folder, "prompt": prompt, "refs": list(refs), "params": params}


import jobs_chars  # noqa: E402,F401  (registers character jobs)
import jobs_sets  # noqa: E402,F401
import jobs_frames  # noqa: E402,F401
