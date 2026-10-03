// edit.js: the shot list. PLACEHOLDER until production/SHOTLIST.md exists: one shot per song section, cut on the
// bar lines measured by tools/audio/ (video/data/timing.json sections). Without timing.json a rough fallback table
// is used. Replace this file with the real edit and keep the shape: one shot() per cut, cadence from the world
// unless a shot overrides it.
//
// Cadence by world (registry.js WORLDS): BRONZE/GOLD 12 (paint boils, held 5 master frames), MARBLE 30 (held 2),
// CORONA/ORBIT 60 (every frame), ROOM 12 ("on twos" anime timing with real holds).
// This module is imported after timing.json has loaded, so cuts can use TM.sections, beatTime(n), TM.events, ...

import { shot } from './registry.js';
import { TM } from './time.js';
import './scenes/placeholder.js';

// per section: world + placeholder title (the treatment's beat sheet); role: carved (default) | drop | verse | mono
const LOOK = {
  cold_open: { world: 'bronze', label: 'hook', title: ['THE SUN WENT OUT', 'MID-BATTLE'] },
  intro_a: { world: 'bronze', label: 'rewind', title: ['28 MAY 585 BC', 'THE RIVER HALYS'] },
  intro_b: { world: 'bronze', label: 'intro · the boom' },
  verse1: { world: 'bronze', label: 'verse 1', title: ['THE RIVER HALYS'] },
  pre1: { world: 'bronze', label: 'pre-chorus', title: ['A HALO IN THE SKY'] },
  chorus1: { world: 'bronze', label: 'chorus 1', title: ['THROW DOWN', 'YOUR BLADE'] },
  drop1_a: { world: 'corona', label: 'drop 1 · C2 totality', role: 'drop', title: ['HALO', 'IN THE', 'SKY', 'SKY'] },
  drop1_break: { world: 'corona', label: 'drop 1 · break', role: 'drop', title: ['HALO'] },
  drop1_b: { world: 'corona', label: 'drop 1', role: 'drop', title: ['HALO', 'IN THE', 'SKY', 'SKY'] },
  breakdown: { world: 'marble', label: 'breakdown' },
  verse2: { world: 'marble', label: 'verse 2', role: 'verse', title: ['What was it like when reality suddenly broke'] },
  shadow: { world: 'marble', label: 'a shadow crossed the hills', role: 'verse', title: ['a shadow crossed the hills'] },
  thales: { world: 'marble', label: 'Thales · C3 diamond ring', title: ['A SUDDEN SPARK'] },
  chorus2: { world: 'gold', label: 'final chorus', title: ['SHADOW TURNED', 'TO DAY'] },
  drop2: { world: 'orbit', label: 'drop 2 · C4', role: 'drop', title: ['THROW DOWN', 'YOUR', 'BLADE', 'BLADE'] },
  outro: { world: 'room', label: 'outro · the wink', role: 'mono', title: ['$ world.step()  # seed=-585', 'syzygizing…', 'fix(halys): schedule eclipse to end war (#585)'] },
};
const ROOM_PLATE = { id: 'example_singer_cu', speed: 1, loop: true };
const ROOM_FRAMING = { '16:9': { focus: [.5, .35] }, '4:5': { focus: [.5, .3] }, '9:16': { focus: [.5, .3] } };

// fallback section table (from the 2026-10-02 audio analysis) for when video/data/timing.json is missing
const FALLBACK = [['cold_open', 0, 7.18], ['intro_a', 7.18, 27.24], ['intro_b', 27.24, 67.42], ['verse1', 67.42, 90.03],
  ['pre1', 90.03, 96.89], ['chorus1', 96.89, 110.58], ['drop1_a', 110.58, 124.47], ['drop1_break', 124.47, 126.21],
  ['drop1_b', 126.21, 153.83], ['breakdown', 153.83, 160.7], ['verse2', 160.7, 174.39], ['shadow', 174.39, 181.23],
  ['thales', 181.23, 199.98], ['chorus2', 199.98, 215.29], ['drop2', 215.29, 257.68], ['outro', 257.68, 273.6]];

const secs = TM.sections.length ? TM.sections.map(s => [s.id, s.t0, s.t1]) : FALLBACK;
secs.forEach(([id, t0, t1], k) => {
  const look = LOOK[id] || { world: 'bronze', label: id };
  const last = k === secs.length - 1;               // run the last shot to the end of the actual audio file
  shot({
    id, t0, t1: last ? Math.max(t1, TM.dur) : t1, world: look.world, scene: 'placeholder',
    params: { label: look.label, title: look.title, role: look.role },
    ...(look.world === 'room' ? { plate: { ...ROOM_PLATE, at: t0 }, framing: ROOM_FRAMING } : {}),
  });
});
