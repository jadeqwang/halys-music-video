// edit.js: the shot list. PLACEHOLDER: section times are rough (from the Whisper transcript) until
// production/SHOTLIST.md and video/data/timing.json lock every cut to the beat grid. Replace this table, keep the
// shape: one shot() per cut, cadence from the world unless a shot overrides it.
//
// Cadence by world (registry.js WORLDS): BRONZE/GOLD 12 (paint boils, held 5 master frames), MARBLE 30 (held 2),
// CORONA/ORBIT 60 (every frame), ROOM 12 ("on twos" anime timing with real holds).

import { shot } from './registry.js';
import { TM } from './time.js';
import './scenes/placeholder.js';

const S = (id, t0, t1, world, params = {}, extra = {}) => shot({ id, t0, t1, world, scene: 'placeholder', params, ...extra });

// C1 · first contact: BRONZE (prestige war epic)
S('cold_open', 0, 5, 'bronze', { label: 'hook', title: ['THE SUN WENT OUT', 'MID-BATTLE'] });
S('rewind', 5, 12, 'bronze', { label: 'rewind', title: ['28 MAY 585 BC', 'THE RIVER HALYS'] });
S('intro', 12, 67, 'bronze', { label: 'intro · cello' });
S('verse1', 67, 89.4, 'bronze', { label: 'verse 1', title: ['THE RIVER HALYS'] });
S('prechorus', 89.4, 96.8, 'bronze', { label: 'pre-chorus', title: ['A HALO IN THE SKY'] });
S('chorus1', 96.8, 110.6, 'bronze', { label: 'chorus 1', title: ['THROW DOWN', 'YOUR BLADE'] });
// C2 · totality: CORONA (sci-fi; reality breaks), drawn on every frame
S('drop1', 110.6, 152, 'corona', { label: 'drop 1', role: 'drop', title: ['HALO', 'IN THE', 'SKY', 'SKY'] });
// mid-totality: MARBLE (time paused)
S('breakdown', 152, 160, 'marble', { label: 'breakdown' });
S('verse2', 160, 187.6, 'marble', { label: 'verse 2', role: 'verse', title: ['What was it like when reality suddenly broke'] });
S('spark', 187.6, 198.7, 'marble', { label: 'C3 · diamond ring', title: ['A SUDDEN SPARK'] });
// C3 → C4: GOLD (triumphant), ORBIT (cosmic montage), ROOM (anime comedy)
S('final_chorus', 198.7, 215.6, 'gold', { label: 'final chorus', title: ['SHADOW TURNED', 'TO DAY'] });
S('drop2', 215.6, 256, 'orbit', { label: 'drop 2', role: 'drop', title: ['THROW DOWN', 'YOUR', 'BLADE', 'BLADE'] });
S('outro_room', 256, TM.dur, 'room', { label: 'outro · the wink', role: 'mono', title: ['$ world.step()  # seed=-585', 'syzygizing…', 'fix(halys): schedule eclipse to end war (#585)'] },
  { plate: { id: 'example_singer_cu', at: 256, speed: 1, loop: true }, framing: { '16:9': { focus: [.5, .35] }, '4:5': { focus: [.5, .3] }, '9:16': { focus: [.5, .3] } } });
