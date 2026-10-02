"""The true lyric text (from "Halys lyrics & music.md"), grouped by section.

Whisper mishears; these words are what goes on screen. Suno sang from its own phonetic
spellings (embedded in the MP3's lyrics tag): "Hailys" (Halys), "warriors odd" (awed),
"Thaylees" (Thales); the alignment maps the sung sounds back to these true words.
"""

# (section key, line text). The word list of each line is line.split() with the
# hyphenated "exchange- / ing" kept exactly as written on the sheet.
LINES = [
    ("verse1", "The River Halys, on the sixth year of the war"),
    ("verse1", "Lydians and Medes, slew each other on the shore"),
    ("verse1", "Sun burning on the bronze exchange-"),
    ("verse1", "ing turns and strikes when light went strange."),
    ("pre1", "A halo in the sky warriors awed"),
    ("pre1", "by the vacant eye of a god"),
    ("chorus1", "Daylight turned to shade"),
    ("chorus1", "eye of gods above"),
    ("chorus1", "Throw down your blade"),
    ("chorus1", "Go home to the ones you love"),
    ("verse2", "What was it like when reality suddenly broke"),
    ("verse2", "the silent eye, how the gods suddenly spoke"),
    ("verse2", "Birds went quiet, air suddenly cold"),
    ("verse2", "what we do next is how history unfolds"),
    ("shadow", "a shadow crossed the hills"),
    ("shadow", "the wind picked up a chill"),
    ("thales", "Thales foretold the sun would go dark"),
    ("thales", "Warriors behold … a sudden spark"),
    ("chorus2", "Shadow turned to day"),
    ("chorus2", "Sunlight from above"),
    ("chorus2", "Throw down your blade"),
    ("chorus2", "Home to the ones you love"),
]

# chopped-vocal fragments in the drops (each occurrence is listed separately in timing.json)
CHOPS = {
    "drop1": ["halo", "in the", "sky", "sky"],
    "drop2": ["throw down", "your", "blade", "blade"],
}

# what Whisper is told to expect (helps it keep the proper nouns)
PROMPT = ("The River Halys, on the sixth year of the war. Lydians and Medes slew each other on the shore. "
          "A halo in the sky, warriors awed by the vacant eye of a god. Throw down your blade. "
          "Thales foretold the sun would go dark.")


def words(text):
    return [w for w in text.replace("…", " ").split() if w]
