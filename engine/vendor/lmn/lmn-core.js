/*!
 * lmn-core.js — reference parser, compiler and MIDI writer for LMN v1
 * (LLM Music Notation). No DOM dependencies: runs in browsers, Node and JavaScriptCore.
 *
 *   const song = LMN.compile(text);   // { events, lyrics, sections, diagnostics, duration, ... }
 *   const bytes = LMN.toMidi(song);    // Uint8Array, Standard MIDI File (format 1)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LMN = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

// ---------------------------------------------------------------------------
// Tables (Appendix A, B, C of the spec)
// ---------------------------------------------------------------------------

// name  gm  family  low  high
const INSTRUMENT_TABLE = `
piano 0 piano A0 C8
bright_piano 1 piano A0 C8
electric_piano 4 epiano E1 E7
electric_piano2 5 epiano E1 E7
harpsichord 6 pluck F1 F6
clavinet 7 pluck F1 E6
organ 16 organ C2 C7
percussive_organ 17 organ C2 C7
rock_organ 18 organ C2 C7
church_organ 19 organ C1 C7
accordion 21 reed F2 A6
harmonica 22 reed C4 C7
celesta 8 mallet C4 C8
glockenspiel 9 mallet G5 C8
music_box 10 mallet C4 C8
vibraphone 11 mallet F3 F6
marimba 12 mallet C2 C7
xylophone 13 mallet F4 C8
tubular_bells 14 mallet C4 F5
timpani 47 mallet D2 C4
kalimba 108 mallet C4 E6
steel_drums 114 mallet C4 E6
nylon_guitar 24 pluck E2 B5
acoustic_guitar 25 pluck E2 B5
jazz_guitar 26 pluck E2 B5
clean_guitar 27 pluck E2 B5
muted_guitar 28 pluck E2 B4
overdrive_guitar 29 drive E2 B5
distortion_guitar 30 drive E2 B5
harp 46 pluck C1 G7
pizzicato 45 pluck C2 C7
banjo 105 pluck C3 A5
sitar 104 pluck C3 C6
koto 107 pluck C3 C6
synth_pluck 45 pluck C2 C7
bass 33 bass E1 G3
upright_bass 32 bass E1 G3
pick_bass 34 bass E1 G3
fretless_bass 35 bass E1 G3
slap_bass 36 bass E1 G3
synth_bass 38 bass C1 C4
synth_bass2 39 bass C1 C4
sub_bass 38 bass C1 C3
violin 40 strings G3 E7
viola 41 strings C3 E6
cello 42 strings C2 A5
contrabass 43 strings E1 G4
tremolo_strings 44 strings C2 C7
strings 48 strings C2 C7
slow_strings 49 strings C2 C7
synth_strings 50 strings C2 C7
fiddle 110 strings G3 E6
voice 53 voice A2 F5
choir 52 voice E2 C6
synth_voice 54 voice C2 C6
trumpet 56 brass F#3 D6
muted_trumpet 59 brass F#3 D6
trombone 57 brass E2 F5
french_horn 60 brass B1 F5
tuba 58 brass D1 F4
brass 61 brass E2 C6
synth_brass 62 brass C2 C6
orchestra_hit 55 brass C3 C6
soprano_sax 64 reed Ab3 E6
alto_sax 65 reed Db3 Ab5
tenor_sax 66 reed Ab2 E5
baritone_sax 67 reed Db2 Ab4
oboe 68 reed Bb3 A6
english_horn 69 reed E3 C6
bassoon 70 reed Bb1 E5
clarinet 71 reed E3 C7
bagpipe 109 reed G4 A5
piccolo 72 pipe D5 C8
flute 73 pipe C4 C7
recorder 74 pipe C5 D7
pan_flute 75 pipe C4 C7
whistle 78 pipe C5 C7
ocarina 79 pipe C4 F6
square_lead 80 lead C3 C7
saw_lead 81 lead C3 C7
pad 89 pad C2 C6
poly_pad 90 pad C2 C6
choir_pad 91 pad C2 C6
bowed_pad 92 pad C2 C6
halo_pad 94 pad C2 C6
sweep_pad 95 pad C2 C6
drums 0 kit
drums_rock 16 kit
drums_electronic 24 kit
drums_808 25 kit
drums_jazz 32 kit
drums_brush 40 kit
percussion 0 kit
`;

// lane  gm-note  description
const DRUM_TABLE = `
kick 36 Bass drum
snare 38 Snare drum
rim 37 Side stick
clap 39 Hand clap
hat 42 Closed hi-hat
pedalhat 44 Pedal hi-hat
openhat 46 Open hi-hat
crash 49 Crash cymbal
crash2 57 Second crash cymbal
ride 51 Ride cymbal
ridebell 53 Ride bell
splash 55 Splash cymbal
china 52 China cymbal
tom_hi 50 High tom
tom_mid 47 Middle tom
tom_low 43 Floor tom
tamb 54 Tambourine
cowbell 56 Cowbell
shaker 70 Shaker
conga_hi 63 High conga
conga_lo 64 Low conga
bongo_hi 60 High bongo
bongo_lo 61 Low bongo
clave 75 Claves
woodblock 76 Wood block
triangle 81 Triangle
`;

const DRUM_ALIASES = {
  bd: 'kick', sd: 'snare', hh: 'hat', hihat: 'hat', closedhat: 'hat',
  oh: 'openhat', open_hat: 'openhat', ph: 'pedalhat', pedal_hat: 'pedalhat',
  cymbal: 'crash', tambourine: 'tamb', sidestick: 'rim',
  tom1: 'tom_hi', tom2: 'tom_mid', tom3: 'tom_low', floortom: 'tom_low'
};

// [quality, aliases, intervals]
const CHORD_TABLE = [
  ['', ['maj'], [0, 4, 7]],
  ['m', ['min', '-'], [0, 3, 7]],
  ['dim', ['°', 'o'], [0, 3, 6]],
  ['aug', ['+'], [0, 4, 8]],
  ['sus2', [], [0, 2, 7]],
  ['sus4', ['sus'], [0, 5, 7]],
  ['5', [], [0, 7]],
  ['6', [], [0, 4, 7, 9]],
  ['m6', ['min6'], [0, 3, 7, 9]],
  ['7', ['dom7'], [0, 4, 7, 10]],
  ['maj7', ['M7', 'Δ', 'Δ7'], [0, 4, 7, 11]],
  ['m7', ['min7', '-7'], [0, 3, 7, 10]],
  ['mMaj7', ['mM7', 'm(maj7)'], [0, 3, 7, 11]],
  ['dim7', ['°7', 'o7'], [0, 3, 6, 9]],
  ['m7b5', ['ø', 'ø7', 'min7b5'], [0, 3, 6, 10]],
  ['7sus4', ['7sus'], [0, 5, 7, 10]],
  ['aug7', ['7#5', '+7'], [0, 4, 8, 10]],
  ['7b5', [], [0, 4, 6, 10]],
  ['add9', ['add2'], [0, 4, 7, 14]],
  ['madd9', ['m(add9)'], [0, 3, 7, 14]],
  ['69', [], [0, 4, 7, 9, 14]],
  ['9', [], [0, 4, 7, 10, 14]],
  ['maj9', ['M9'], [0, 4, 7, 11, 14]],
  ['m9', ['min9', '-9'], [0, 3, 7, 10, 14]],
  ['9sus4', ['9sus'], [0, 5, 7, 10, 14]],
  ['7b9', [], [0, 4, 7, 10, 13]],
  ['7#9', [], [0, 4, 7, 10, 15]],
  ['7#11', [], [0, 4, 7, 10, 18]],
  ['11', [], [0, 7, 10, 14, 17]],
  ['m11', ['min11'], [0, 3, 7, 10, 14, 17]],
  ['13', [], [0, 4, 7, 10, 14, 21]],
  ['maj13', ['M13'], [0, 4, 7, 11, 14, 21]],
  ['m13', ['min13'], [0, 3, 7, 10, 14, 21]]
];

const DURATIONS = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25, t: 0.125 };
const DYNAMICS = { ppp: 16, pp: 33, p: 49, mp: 64, mf: 80, f: 96, ff: 112, fff: 127 };
const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ALTER = { '': 0, '#': 1, 'b': -1, '##': 2, 'bb': -2 };
const RESERVED = { tempo: 1, track: 1, section: 1, form: 1 };
const EPS = 1e-6;

const INSTRUMENTS = {};
INSTRUMENT_TABLE.trim().split('\n').forEach(function (row) {
  const f = row.trim().split(/\s+/);
  INSTRUMENTS[f[0]] = {
    name: f[0], gm: +f[1], family: f[2], isDrum: f[2] === 'kit',
    low: f[3] ? pitchToMidi(f[3]) : null, high: f[4] ? pitchToMidi(f[4]) : null
  };
});

const DRUM_LANES = {};
DRUM_TABLE.trim().split('\n').forEach(function (row) {
  const m = row.trim().match(/^(\S+)\s+(\d+)\s+(.*)$/);
  DRUM_LANES[m[1]] = { name: m[1], note: +m[2], label: m[3] };
});

const CHORD_QUALITIES = {};
CHORD_TABLE.forEach(function (row) {
  CHORD_QUALITIES[row[0]] = row[2];
  row[1].forEach(function (alias) { CHORD_QUALITIES[alias] = row[2]; });
});

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function pitchToMidi(p) {
  const m = /^([A-G])(##|bb|#|b)?(-?[0-9])$/.exec(p);
  if (!m) return null;
  return 12 * (parseInt(m[3], 10) + 1) + STEPS[m[1]] + ALTER[m[2] || ''];
}

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function midiToName(n) { return NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); }

function durationBeats(letter, dots, triplet) {
  let b = DURATIONS[letter];
  if (dots === '.') b *= 1.5; else if (dots === '..') b *= 1.75;
  if (triplet === '3') b *= 2 / 3;
  return b;
}

function stripComment(line) {
  const m = /(^|\s)\/\//.exec(line);
  return m ? line.slice(0, m.index) : line;
}

function parseTime(v) {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(String(v));
  if (!m) return null;
  const n = +m[1], d = +m[2];
  if (n < 1 || n > 32 || [1, 2, 4, 8, 16].indexOf(d) < 0) return null;
  return [n, d];
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round3(x) { return Math.round(x * 1000) / 1000; }
function isNum(v) { return v !== '' && v != null && isFinite(Number(v)); }

// ---------------------------------------------------------------------------
// Parsing: text -> song structure (spec 2.1–2.5, 4.2)
// ---------------------------------------------------------------------------

function fallbackInstrument(name) {
  const n = name.toLowerCase();
  if (/drum|kit|perc/.test(n)) return 'drums';
  if (/bass/.test(n)) return 'bass';
  if (/pad/.test(n)) return 'pad';
  if (/string|violin|cello/.test(n)) return 'strings';
  if (/guitar|gtr/.test(n)) return 'clean_guitar';
  if (/vox|vocal|voice|sing/.test(n)) return 'voice';
  if (/organ/.test(n)) return 'organ';
  if (/synth|lead/.test(n)) return 'saw_lead';
  return 'piano';
}

function parseAttrs(tokens, line, report, where) {
  const attrs = {};
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const eq = tok.indexOf('=');
    if (eq > 0) {
      attrs[tok.slice(0, eq).toLowerCase()] = tok.slice(eq + 1);
    } else if (i > 0 && /^key=/i.test(tokens[i - 1]) || (attrs.key != null && /^(major|minor|maj|min|dorian|mixolydian|lydian|phrygian|locrian|aeolian|ionian|blues|\(blues\))$/i.test(tok))) {
      attrs.key = (attrs.key || '') + ' ' + tok;
    } else if (tok === 'extends' && tokens[i + 1] && tokens[i + 1].indexOf('=') < 0) {
      attrs.extends = tokens[++i];
      report('warning', line, 'Write "extends=' + attrs.extends + '" (with "=")');
    } else {
      report('warning', line, 'Ignoring "' + tok + '" in ' + where + ' (attributes look like name=value)');
    }
  }
  return attrs;
}

function parse(text) {
  const diagnostics = [];
  function report(level, line, message) { diagnostics.push({ level: level, line: line, message: message }); }

  const song = {
    version: null,
    header: { title: 'Untitled', artist: null, key: null, tempo: 120, time: [4, 4], swing: 50, swingUnit: 8, transpose: 0 },
    meta: {},
    tracks: [], trackMap: {},
    sections: [], sectionMap: {},
    form: null,
    diagnostics: diagnostics
  };

  let current = null;
  let seenSection = false;
  const lines = String(text == null ? '' : text).replace(/^﻿/, '').split(/\r\n|\r|\n/);

  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1;
    const t = stripComment(lines[i]).trim();
    if (!t || /^(```|~~~)/.test(t)) continue;          // blank, or a Markdown code fence pasted from a chat
    let m;

    if ((m = /^LMN\s+(\S+)/.exec(t))) {
      song.version = m[1];
      if (!/^1(\.\d+)*$/.test(m[1])) report('warning', ln, 'File says LMN ' + m[1] + '; this player implements LMN 1');
      continue;
    }
    if (/^track\s/.test(t)) { parseTrack(t, ln); continue; }
    if (/^section\s/.test(t)) { current = parseSection(t, ln); seenSection = true; continue; }
    if (/^form\s*:/i.test(t)) { parseForm(t.replace(/^form\s*:/i, ''), ln); continue; }
    m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(t);
    if (t.indexOf('|') >= 0 && !(m && m[2].charAt(0) !== '|' && !song.trackMap[m[1]])) {
      if (!current) { report('error', ln, 'Body line before any "section" line'); continue; }
      parseBody(current, t, ln);
      continue;
    }
    if (m) {
      if (seenSection) report('warning', ln, 'Header field "' + m[1] + '" should come before the first section');
      setHeader(m[1].toLowerCase(), m[2].trim(), ln);
      continue;
    }
    report('error', ln, 'Unrecognized line: "' + (t.length > 48 ? t.slice(0, 48) + '…' : t) + '"');
  }

  if (!song.tracks.length) report('error', 0, 'No tracks declared');
  if (!song.sections.length) report('error', 0, 'No sections defined');
  return song;

  // -- line handlers --------------------------------------------------------

  function setHeader(name, value, ln) {
    const h = song.header;
    switch (name) {
      case 'title': h.title = value; return;
      case 'artist': h.artist = value; return;
      case 'key': h.key = value; return;
      case 'tempo': {
        const v = parseFloat(value);
        if (!(v >= 20 && v <= 400)) { report('error', ln, 'tempo must be a number from 20 to 400'); return; }
        h.tempo = v; return;
      }
      case 'time': {
        const ts = parseTime(value);
        if (!ts) { report('error', ln, 'time must look like 4/4, 3/4 or 6/8'); return; }
        h.time = ts; return;
      }
      case 'swing': {
        const v = parseFloat(value);
        if (!isFinite(v)) { report('error', ln, 'swing must be a number from 50 to 75'); return; }
        if (v < 50 || v > 75) report('warning', ln, 'swing is clamped to 50–75');
        h.swing = clamp(v, 50, 75); return;
      }
      case 'swing_unit': {
        const v = parseInt(value, 10);
        if (v !== 8 && v !== 16) { report('error', ln, 'swing_unit must be 8 or 16'); return; }
        h.swingUnit = v; return;
      }
      case 'transpose': {
        const v = parseInt(value, 10);
        if (!isFinite(v)) { report('error', ln, 'transpose must be a whole number of semitones'); return; }
        h.transpose = v; return;
      }
      default: song.meta[name] = value;
    }
  }

  function parseTrack(t, ln) {
    const tok = t.split(/\s+/);
    const name = tok[1];
    let inst = (tok[2] || '').toLowerCase();
    if (!name || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) { report('error', ln, 'Bad track name "' + (name || '') + '" (use lowercase letters, digits and _)'); return; }
    if (RESERVED[name]) { report('error', ln, '"' + name + '" is a reserved word and cannot be a track name'); return; }
    if (song.trackMap[name]) { report('error', ln, 'Track "' + name + '" is declared twice'); return; }
    if (name !== name.toLowerCase()) report('warning', ln, 'Track names should be lowercase ("' + name.toLowerCase() + '")');
    if (!inst) { report('error', ln, 'Track "' + name + '" needs an instrument'); inst = 'piano'; }
    if (inst.indexOf('=') >= 0) { report('error', ln, 'Track "' + name + '": the instrument comes right after the name'); tok.splice(2, 0, 'piano'); inst = 'piano'; }
    if (!INSTRUMENTS[inst]) {
      const fb = fallbackInstrument(inst);
      report('warning', ln, 'Unknown instrument "' + inst + '"; using "' + fb + '"');
      inst = fb;
    }
    const a = parseAttrs(tok.slice(3), ln, report, 'track "' + name + '"');
    const info = INSTRUMENTS[inst];
    const track = {
      name: name, instrument: inst, gm: info.gm, family: info.family, isDrum: info.isDrum,
      vol: 80, pan: 0, octave: 4, reverb: 20, line: ln, index: song.tracks.length
    };
    num('vol', 0, 100); num('pan', -100, 100); num('octave', 0, 8); num('reverb', 0, 100);
    Object.keys(a).forEach(function (k) {
      if (['vol', 'pan', 'octave', 'reverb'].indexOf(k) < 0) report('warning', ln, 'Unknown track attribute "' + k + '"');
    });
    song.tracks.push(track);
    song.trackMap[name] = track;

    function num(k, lo, hi) {
      if (!(k in a)) return;
      const v = Number(a[k]);
      if (!isNum(a[k])) { report('error', ln, k + ' must be a number'); return; }
      if (v < lo || v > hi) report('warning', ln, k + ' is clamped to ' + lo + '…' + hi);
      track[k] = k === 'octave' ? Math.round(clamp(v, lo, hi)) : clamp(v, lo, hi);
    }
  }

  function parseSection(t, ln) {
    const tok = t.split(/\s+/);
    const name = tok[1] || '';
    const sec = { name: name, attrs: {}, lines: {}, order: [], line: ln, ignored: false };
    if (!/^[A-Za-z][\w-]*$/.test(name)) {
      report('error', ln, 'Bad section name "' + name + '" (letters, digits, _ and -, starting with a letter)');
      sec.ignored = true;
      return sec;
    }
    sec.attrs = parseAttrs(tok.slice(2), ln, report, 'section "' + name + '"');
    const known = ['bars', 'extends', 'tempo', 'time', 'swing', 'swing_unit', 'transpose', 'mute', 'key'];
    Object.keys(sec.attrs).forEach(function (k) {
      if (known.indexOf(k) < 0) report('warning', ln, 'Unknown section attribute "' + k + '"');
    });
    const A = sec.attrs;
    if ('bars' in A && !(parseInt(A.bars, 10) > 0)) { report('error', ln, 'bars must be a positive whole number'); delete A.bars; }
    if ('tempo' in A && !(parseFloat(A.tempo) >= 20 && parseFloat(A.tempo) <= 400)) { report('error', ln, 'tempo must be 20–400'); delete A.tempo; }
    if ('time' in A && !parseTime(A.time)) { report('error', ln, 'time must look like 4/4'); delete A.time; }
    if ('swing' in A && !isNum(A.swing)) { report('error', ln, 'swing must be a number'); delete A.swing; }
    if ('swing_unit' in A && A.swing_unit !== '8' && A.swing_unit !== '16') { report('error', ln, 'swing_unit must be 8 or 16'); delete A.swing_unit; }
    if ('transpose' in A && !/^[+-]?\d+$/.test(A.transpose)) { report('error', ln, 'transpose must be a whole number'); delete A.transpose; }
    if (song.sectionMap[name]) {
      report('error', ln, 'Section "' + name + '" is defined twice; the first definition is used');
      sec.ignored = true;
      return sec;
    }
    song.sections.push(sec);
    song.sectionMap[name] = sec;
    return sec;
  }

  function parseBody(sec, t, ln) {
    const bar = t.indexOf('|');
    const target = t.slice(0, bar).trim().replace(/:$/, '').trim();
    if (!target) { report('error', ln, 'Body line has no target before the first "|"'); return; }
    if (/\s/.test(target)) { report('error', ln, 'Bad target "' + target + '" (one word, like bass or drums.kick)'); return; }
    const bars = t.slice(bar + 1).split('|').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!bars.length) { report('warning', ln, 'Line for "' + target + '" has no bars'); return; }
    if (sec.ignored) return;
    if (!sec.lines[target]) { sec.lines[target] = []; sec.order.push(target); }
    bars.forEach(function (b) { sec.lines[target].push({ text: b, line: ln }); });
  }

  function parseForm(t, ln) {
    const items = song.form || (song.form = []);
    t.trim().split(/[\s,]+/).filter(Boolean).forEach(function (tok) {
      let m;
      if ((m = /^[x×*](\d+)$/i.exec(tok)) && items.length && !song.sectionMap[tok]) {
        items[items.length - 1].count = Math.max(1, parseInt(m[1], 10));
        report('warning', ln, 'Write repeats as ' + items[items.length - 1].name + '*' + m[1]);
      } else if ((m = /^([A-Za-z][\w-]*)(?:\*(\d+))?$/.exec(tok))) {
        items.push({ name: m[1], count: m[2] ? Math.max(1, parseInt(m[2], 10)) : 1, line: ln });
      } else {
        report('error', ln, 'Bad form item "' + tok + '"');
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Tokens inside bars (spec 2.6–2.8, Appendix D)
// ---------------------------------------------------------------------------

const RE_TOKENIZE = /\([^()]*\)\*\d+|\[[^\]]*\]\S*|\S+/g;
const RE_TOKEN = /\[[^\]]*\]\S*|\S+/g;

// Split a bar into tokens and expand repeats: `C2e*8` is eight C2e tokens and
// `(A3s C4s E4s C4s)*4` repeats the group four times. Drum groups work the same way.
function barTokens(text) {
  const out = [];
  (text.match(RE_TOKENIZE) || []).forEach(function (tok) {
    let m = /^\(([^()]*)\)\*(\d+)$/.exec(tok);
    if (m) {
      const inner = m[1].match(RE_TOKEN) || [], n = Math.min(64, +m[2]);
      for (let k = 0; k < n; k++) inner.forEach(function (t) { pushRepeat(out, t); });
      return;
    }
    pushRepeat(out, tok);
  });
  return out;
}
function pushRepeat(out, tok) {
  const m = /^(.*[^*])\*(\d+)$/.exec(tok);
  if (m && tok !== '%' && tok !== 'R') { for (let k = 0, n = Math.min(64, +m[2]); k < n; k++) out.push(m[1]); }
  else out.push(tok);
}
const RE_NOTE = /^([A-G])(##|bb|#|b)?([0-9])([whqest])(\.{0,2})(3?)([~>'^]*)(?::(\S+))?$/;
const RE_REST = /^r([whqest])(\.{0,2})(3?)([~>'^]*)(?::(\S+))?$/;
const RE_STACK = /^\[([^\]]+)\]([whqest])(\.{0,2})(3?)([~>'^]*)(?::(\S+))?$/;
const RE_CHORD = /^\{([^}]+)\}([whqest])(\.{0,2})(3?)([~>'^]*)(?::(\S+))?$/;
const RE_DYN = /^!(ppp|pp|p|mp|mf|f|ff|fff)$/;
const RE_SYMBOL = /^([A-G])(#|b)?([^/]*)(?:\/([A-G])(#|b)?)?$/;
const RE_PITCH = /^([A-G])(##|bb|#|b)?([0-9])$/;
const RE_GROUP = /^[xXo.\-]+$/;

const tokenCache = {};
function parsePitchedToken(tok) {
  if (tokenCache[tok]) return tokenCache[tok];
  return (tokenCache[tok] = parseTokenUncached(tok));
}

function parseTokenUncached(tok) {
  let m;
  if ((m = RE_NOTE.exec(tok))) {
    return sounding('note', [12 * (+m[3] + 1) + STEPS[m[1]] + ALTER[m[2] || '']], null, m.slice(4));
  }
  if ((m = RE_REST.exec(tok))) return { kind: 'rest', beats: durationBeats(m[1], m[2], m[3]), junk: !!(m[4] || m[5]) };
  if ((m = RE_STACK.exec(tok))) {
    const parts = m[1].split(/[\s,]+/).filter(Boolean);
    const pitches = [], bad = [];
    for (let i = 0; i < parts.length; i++) {
      const p = RE_PITCH.exec(parts[i]);
      if (p) pitches.push(12 * (+p[3] + 1) + STEPS[p[1]] + ALTER[p[2] || '']); else bad.push(parts[i]);
    }
    const s = sounding('stack', pitches, null, m.slice(2));
    if (bad.length) s.badPitches = bad;
    if (!pitches.length) return { kind: 'rest', beats: s.beats, junk: false, badPitches: bad };
    return s;
  }
  if ((m = RE_CHORD.exec(tok))) return sounding('chord', null, m[1], m.slice(2));
  if ((m = RE_DYN.exec(tok))) return { kind: 'dyn', velocity: DYNAMICS[m[1]] };
  return { kind: 'bad', reason: tokenHint(tok) };
}

function sounding(kind, pitches, symbol, d) {
  const mods = d[3] || '';
  return {
    kind: kind, pitches: pitches, symbol: symbol, beats: durationBeats(d[0], d[1], d[2]),
    tie: mods.indexOf('~') >= 0, accent: mods.indexOf('>') >= 0,
    staccato: mods.indexOf("'") >= 0, glide: mods.indexOf('^') >= 0, lyric: d[4] || null
  };
}

function tokenHint(tok) {
  if (/^[A-G](##|bb|#|b)?[0-9]$/.test(tok)) return 'missing duration; write ' + tok + 'q for a quarter note';
  if (/^[a-g](##|bb|#|b)?[0-9]/.test(tok)) return 'note letters are uppercase: ' + tok[0].toUpperCase() + tok.slice(1);
  if (/^[A-G](#|b)?(maj|min|m|dim|aug|sus|add|-)/.test(tok)) return 'chord symbols go in braces, e.g. {' + tok.replace(/[whqest]\.*3?$/, '') + '}h';
  if (/^\{[^}]*\}$/.test(tok)) return 'chord symbol needs a duration, e.g. ' + tok + 'h';
  if (/^\[[^\]]*\]$/.test(tok)) return 'note stack needs a duration, e.g. ' + tok + 'q';
  if (tok === 'R' || tok === '%') return '"' + tok + '" must be the only thing in its bar';
  if (/^[A-G](##|bb|#|b)?[0-9][:/]/.test(tok)) return 'write the duration letter right after the octave, e.g. ' + tok.slice(0, tok.search(/[0-9]/) + 1) + 'q';
  if (/^[A-G](##|bb|#|b)?[0-9][whqest]/.test(tok)) return 'check the modifiers and lyric (order: duration, dots, 3, then ~ > \' ^, then :lyric)';
  if (/^[xXo.\-]+$/.test(tok)) return 'drum steps belong on a drum lane such as drums.kick';
  return 'unrecognized token';
}

// Appendix C voicing rule
function voiceChord(symbol, octave) {
  const m = RE_SYMBOL.exec(symbol);
  if (!m) return { notes: null, error: 'bad chord symbol {' + symbol + '}' };
  const r = (STEPS[m[1]] + ALTER[m[2] || ''] + 12) % 12;
  const q = m[3];
  let iv = CHORD_QUALITIES[q] || CHORD_QUALITIES[q.replace(/[()]/g, '')];
  let error = null;
  if (!iv) {
    const minor = /^(m(?!aj)|min|-)/.test(q);
    iv = minor ? [0, 3, 7] : [0, 4, 7];
    error = 'unknown chord quality "' + q + '" in {' + symbol + '}; playing a ' + (minor ? 'minor' : 'major') + ' triad';
  }
  let R = 12 * (octave + 1) + r;
  if (r >= 7) R -= 12;
  const notes = iv.map(function (i) { return R + i; });
  if (m[4]) {
    const x = (STEPS[m[4]] + ALTER[m[5] || ''] + 12) % 12;
    let d = ((r - x) % 12 + 12) % 12;
    if (d === 0) d = 12;
    notes.unshift(R - d);
  }
  return { notes: notes, error: error };
}

// ---------------------------------------------------------------------------
// Compile: song -> timed events (spec 2.9–2.12, Part 4)
// ---------------------------------------------------------------------------

function compile(input) {
  const song = typeof input === 'string' ? parse(input) : input;
  const H = song.header;
  const diags = song.diagnostics;
  const seen = {};
  function report(level, line, message, key) {
    if (key) { if (seen[key]) return; seen[key] = 1; }
    diags.push({ level: level, line: line, message: message });
  }

  // 1. inheritance
  const resolved = {};
  function resolve(name, stack) {
    if (resolved[name]) return resolved[name];
    const raw = song.sectionMap[name];
    if (!raw) return null;
    let res = { name: name, attrs: Object.assign({}, raw.attrs), lines: Object.assign({}, raw.lines), order: raw.order.slice(), line: raw.line };
    const parentName = raw.attrs.extends;
    if (parentName) {
      let parent = null;
      if (stack.indexOf(name) >= 0 || parentName === name) report('error', raw.line, 'Circular extends involving "' + name + '"', 'cyc:' + name);
      else {
        parent = resolve(parentName, stack.concat(name));
        if (!parent) report('error', raw.line, 'Section "' + name + '" extends unknown section "' + parentName + '"', 'ext:' + name);
      }
      if (parent) {
        res.attrs = Object.assign({}, parent.attrs, raw.attrs);
        res.lines = Object.assign({}, parent.lines, raw.lines);
        res.order = parent.order.concat(raw.order.filter(function (t) { return parent.order.indexOf(t) < 0; }));
      }
    }
    delete res.attrs.extends;
    resolved[name] = res;
    return res;
  }

  // 2. form -> instances
  let items = song.form && song.form.length ? song.form : song.sections.map(function (s) { return { name: s.name, count: 1, line: s.line }; });
  const instances = [];
  items.forEach(function (it) {
    const sec = resolve(it.name, []);
    if (!sec) { report('error', it.line, 'form: unknown section "' + it.name + '"', 'form:' + it.name); return; }
    for (let k = 0; k < it.count; k++) instances.push(sec);
  });
  if (!instances.length) report('error', 0, 'Nothing to play: no sections in the form', 'empty');

  // 3. layout
  let cursor = 0;
  const layout = instances.map(function (sec, idx) {
    const A = sec.attrs;
    const time = A.time ? parseTime(A.time) : H.time;
    const barBeats = 4 * time[0] / time[1];
    const groups = (time[1] >= 8 && time[0] % 3 === 0) ? time[0] / 3 : time[0];
    const targets = [];
    sec.order.forEach(function (tg) {
      const info = classifyTarget(tg, sec);
      if (info) targets.push(info);
    });
    let bars = 0;
    targets.forEach(function (t) { if (!t.isTempo) bars = Math.max(bars, t.bars.length); });
    if (!bars) bars = A.bars ? parseInt(A.bars, 10) : 1;
    if (A.bars && parseInt(A.bars, 10) !== bars) {
      report('warning', sec.line, 'Section "' + sec.name + '" says bars=' + A.bars + ' but its longest line has ' + bars + ' bars', 'bars:' + sec.name);
    }
    targets.forEach(function (t) {
      if (t.bars.length < bars) {
        report('warning', t.bars.length ? t.bars[t.bars.length - 1].line : sec.line,
          '"' + t.raw + '" has ' + t.bars.length + ' bars but section "' + sec.name + '" has ' + bars + '; the missing bars are silent', 'len:' + sec.name + ':' + t.raw);
      }
    });
    const mute = {};
    if (A.mute && A.mute !== 'none') A.mute.split(',').forEach(function (x) { if (x.trim()) mute[x.trim()] = 1; });
    const inst = {
      index: idx, name: sec.name, sec: sec, startBeat: cursor, bars: bars, barBeats: barBeats, time: time, groups: groups,
      tempo: A.tempo ? parseFloat(A.tempo) : H.tempo,
      swing: A.swing != null ? clamp(parseFloat(A.swing), 50, 75) : H.swing,
      swingUnit: A.swing_unit ? parseInt(A.swing_unit, 10) : H.swingUnit,
      transpose: H.transpose + (A.transpose ? parseInt(A.transpose, 10) : 0),
      mute: mute, targets: targets
    };
    cursor += bars * barBeats;
    return inst;
  });
  const endBeat = cursor;

  function classifyTarget(tg, sec) {
    const bars = sec.lines[tg];
    const line = bars.length ? bars[0].line : sec.line;
    if (tg === 'tempo') return { raw: tg, key: 'tempo', isTempo: true, bars: bars };
    const dot = tg.indexOf('.');
    const name = dot < 0 ? tg : tg.slice(0, dot);
    const sub = dot < 0 ? '' : tg.slice(dot + 1);
    const track = song.trackMap[name];
    if (!track) {
      report('error', line, 'Line for undeclared track "' + name + '" (add "track ' + name + ' <instrument>")', 'trk:' + sec.name + ':' + tg);
      return null;
    }
    if (track.isDrum) {
      if (!sub) { report('error', line, 'Drum track "' + name + '" needs a lane, e.g. ' + name + '.kick', 'lane:' + sec.name + ':' + tg); return null; }
      const lane = DRUM_ALIASES[sub.toLowerCase()] || sub.toLowerCase();
      if (!DRUM_LANES[lane]) { report('error', line, 'Unknown drum lane "' + sub + '" (see Appendix B: kick, snare, hat, openhat, crash, ride, tom_hi, …)', 'lane:' + sec.name + ':' + tg); return null; }
      return { raw: tg, key: name + '.' + lane, track: track, lane: lane, bars: bars };
    }
    if (sub && !/^[A-Za-z0-9_]+$/.test(sub)) report('warning', line, 'Voice names use letters, digits and _: "' + sub + '"', 'voice:' + sec.name + ':' + tg);
    return { raw: tg, key: sub ? name + '.' + sub : name, track: track, voice: sub, bars: bars };
  }

  function isMuted(inst, t) { return !!(inst.mute[t.track.name] || inst.mute[t.key] || inst.mute[t.raw]); }

  function warp(x, inst) {
    if (!(inst.swing > 50)) return x;
    const span = inst.swingUnit === 16 ? 0.5 : 1;
    const s = inst.swing / 100;
    if (x >= Math.floor(inst.barBeats / span + 1e-9) * span - 1e-9) return x;
    const q = x / span;
    const n = Math.floor(q + 1e-9);
    const p = Math.max(0, q - n);
    const p2 = p < 0.5 ? p * 2 * s : s + (p - 0.5) * 2 * (1 - s);
    return (n + p2) * span;
  }

  // 4. tempo map
  const segments = [];
  layout.forEach(function (inst) {
    const lane = inst.targets.filter(function (t) { return t.isTempo; })[0];
    let bpm = inst.tempo;
    if (!lane) {
      segments.push({ beat0: inst.startBeat, beat1: inst.startBeat + inst.bars * inst.barBeats, bpm0: bpm, bpm1: bpm });
      return;
    }
    for (let b = 0; b < inst.bars; b++) {
      const e = lane.bars[b];
      const txt = e ? e.text : '.';
      const b0 = inst.startBeat + b * inst.barBeats, b1 = b0 + inst.barBeats;
      let m;
      if (txt === '.' || txt === '%') segments.push({ beat0: b0, beat1: b1, bpm0: bpm, bpm1: bpm });
      else if ((m = /^(\d+(?:\.\d+)?)$/.exec(txt)) && +m[1] >= 20 && +m[1] <= 400) { bpm = +m[1]; segments.push({ beat0: b0, beat1: b1, bpm0: bpm, bpm1: bpm }); }
      else if ((m = /^>\s*(\d+(?:\.\d+)?)$/.exec(txt)) && +m[1] >= 20 && +m[1] <= 400) { segments.push({ beat0: b0, beat1: b1, bpm0: bpm, bpm1: +m[1] }); bpm = +m[1]; }
      else {
        report('error', e.line, 'Bad tempo entry "' + txt + '" (use a number, >number or .)', 'tmp:' + inst.name + ':' + b);
        segments.push({ beat0: b0, beat1: b1, bpm0: bpm, bpm1: bpm });
      }
    }
  });
  if (!segments.length) segments.push({ beat0: 0, beat1: 0, bpm0: H.tempo, bpm1: H.tempo });
  let sec0 = 0;
  segments.forEach(function (g) { g.sec0 = sec0; sec0 += segDuration(g, g.beat1); });

  function segDuration(g, b) {
    const db = b - g.beat0;
    if (Math.abs(g.bpm1 - g.bpm0) < 1e-9 || g.beat1 - g.beat0 < 1e-9) return db * 60 / g.bpm0;
    const k = (g.bpm1 - g.bpm0) / (g.beat1 - g.beat0);
    return (60 / k) * Math.log((g.bpm0 + k * db) / g.bpm0);
  }
  function findSeg(b) {
    let lo = 0, hi = segments.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segments[mid].beat0 <= b + 1e-9) lo = mid; else hi = mid - 1; }
    return segments[lo];
  }
  function secAt(b) {
    const g = findSeg(b);
    if (b > g.beat1) return g.sec0 + segDuration(g, g.beat1) + (b - g.beat1) * 60 / g.bpm1;
    return g.sec0 + segDuration(g, b);
  }
  function beatAt(t) {
    let lo = 0, hi = segments.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segments[mid].sec0 <= t + 1e-9) lo = mid; else hi = mid - 1; }
    const g = segments[lo];
    const dt = t - g.sec0;
    const len = segDuration(g, g.beat1);
    if (dt > len) return g.beat1 + (dt - len) * g.bpm1 / 60;
    if (Math.abs(g.bpm1 - g.bpm0) < 1e-9 || g.beat1 - g.beat0 < 1e-9) return g.beat0 + dt * g.bpm0 / 60;
    const k = (g.bpm1 - g.bpm0) / (g.beat1 - g.beat0);
    return g.beat0 + g.bpm0 * (Math.exp(k * dt / 60) - 1) / k;
  }

  // 5. events
  const events = [];
  const lyrics = [];
  const ties = {};

  layout.forEach(function (inst) {
    const present = {};
    inst.targets.forEach(function (t) { if (!t.isTempo && !isMuted(inst, t)) present[t.key] = 1; });
    Object.keys(ties).forEach(function (k) { if (!present[k]) { ties[k].open = {}; ties[k].glide = null; } });
    inst.targets.forEach(function (t) {
      if (t.isTempo || !present[t.key]) return;
      if (t.track.isDrum) compileDrums(inst, t); else compilePitched(inst, t);
    });
  });

  function barText(t, b, prev, inst) {
    const e = t.bars[b];
    let text = e ? e.text : 'R';
    if (text === '%') {
      if (prev == null) { report('warning', e.line, '"%" in the first bar of "' + t.raw + '" has nothing to repeat; treated as R', 'pct:' + inst.name + ':' + t.raw); text = 'R'; }
      else text = prev;
    }
    return { text: text, line: e ? e.line : inst.sec.line };
  }

  function compilePitched(inst, t) {
    const st = ties[t.key] || (ties[t.key] = { open: {}, glide: null });
    const info = INSTRUMENTS[t.track.instrument];
    let vel = 80, prev = null;
    for (let b = 0; b < inst.bars; b++) {
      const bt = barText(t, b, prev, inst);
      prev = bt.text;
      const key = inst.name + ':' + t.raw + ':' + b;
      const barStart = inst.startBeat + b * inst.barBeats;
      if (bt.text === 'R') { closeTies(st, bt.line, key); continue; }
      const toks = barTokens(bt.text);
      let pos = 0, dropped = 0;
      for (let i = 0; i < toks.length; i++) {
        const tok = toks[i];
        if (tok === 'R' || tok === '%') { report('error', bt.line, '"' + tok + '" must be the only thing in its bar (bar ' + (b + 1) + ' of ' + t.raw + ' in ' + inst.name + ')', key + ':alone'); continue; }
        const p = parsePitchedToken(tok);
        if (p.kind === 'bad') { report('error', bt.line, 'Bad token "' + tok + '" in ' + t.raw + ', ' + inst.name + ' bar ' + (b + 1) + ': ' + p.reason, key + ':bad:' + i); continue; }
        if (p.kind === 'dyn') { vel = p.velocity; continue; }
        const start = pos, end = pos + p.beats;
        pos = end;
        if (start >= inst.barBeats - EPS) { if (p.kind !== 'rest') dropped++; continue; }
        if (p.badPitches) report('error', bt.line, 'Bad pitch ' + p.badPitches.map(function (x) { return '"' + x + '"'; }).join(', ') + ' inside [ ] in ' + t.raw + ', ' + inst.name + ' bar ' + (b + 1) + ' (write pitches like C4, F#3, Bb2)', key + ':bp:' + i);
        if (p.kind === 'rest') {
          if (p.junk) report('warning', bt.line, 'Rests ignore modifiers and lyrics: "' + tok + '"', key + ':rl:' + i);
          closeTies(st, bt.line, key);
          continue;
        }
        let pitches = p.pitches;
        if (p.kind === 'chord') {
          const v = voiceChord(p.symbol, t.track.octave);
          if (v.error) report(v.notes ? 'warning' : 'error', bt.line, v.error, key + ':ch:' + i);
          if (!v.notes) continue;
          pitches = v.notes;
        }
        pitches = pitches.map(function (n) { return clamp(n + inst.transpose, 0, 127); })
          .filter(function (n, k, arr) { return arr.indexOf(n) === k; });
        if (info && info.low != null) {
          pitches.forEach(function (n) {
            if (n < info.low || n > info.high) report('info', bt.line, midiToName(n) + ' is outside the usual range of ' + t.track.instrument + ' (' + midiToName(info.low) + '–' + midiToName(info.high) + ') in ' + t.raw + ', ' + inst.name, 'rng:' + inst.name + ':' + t.raw);
          });
        }
        const a = barStart + warp(start, inst);
        const z = barStart + warp(Math.min(end, inst.barBeats), inst);
        emit(st, t, inst, pitches, a, z, Math.min(end, inst.barBeats) - start, p, vel, bt.line, key);
      }
      const total = round3(pos);
      if (pos < inst.barBeats - EPS) report('warning', bt.line, 'Bar ' + (b + 1) + ' of ' + t.raw + ' in ' + inst.name + ' adds up to ' + total + ' beats; ' + inst.time.join('/') + ' needs ' + round3(inst.barBeats) + ' (rest of bar is silent)', key + ':len');
      else if (pos > inst.barBeats + EPS) report('warning', bt.line, 'Bar ' + (b + 1) + ' of ' + t.raw + ' in ' + inst.name + ' adds up to ' + total + ' beats; ' + inst.time.join('/') + ' needs ' + round3(inst.barBeats) + ' (cut at the bar line' + (dropped ? ', ' + dropped + ' note(s) dropped' : '') + ')', key + ':len');
    }
  }

  function closeTies(st, line, key) {
    if (Object.keys(st.open).length) report('warning', line, 'A tie (~) is followed by a rest; the tie is ignored', key + ':tierest');
    st.open = {};
    st.glide = null;
  }

  function emit(st, t, inst, pitches, a, z, wlen, p, vel, line, key) {
    const velocity = clamp(p.accent ? vel + 20 : vel, 1, 127);
    // glide (Extended): the previous note slides into this one
    if (st.glide) {
      const g = st.glide;
      st.glide = null;
      if (pitches.length === 1 && Math.abs(g.endBeat - a) < EPS && !Object.keys(st.open).length) {
        g.path.push({ beat: a, midi: pitches[0] });
        g.endBeat = z; g.lastStart = a; g.lastEnd = z; g.staccato = p.staccato; g.wb += wlen;
        if (p.lyric) addLyric(t, inst, a, p.lyric, line, g);
        if (p.glide) st.glide = g;
        return;
      }
    }
    const open = st.open, next = {}, byPitch = {};
    let first = null;
    pitches.forEach(function (n) {
      let ev = open[n];
      if (ev && Math.abs(ev.endBeat - a) < EPS) {
        ev.endBeat = z; ev.lastStart = a; ev.lastEnd = z; ev.staccato = p.staccato; ev.wb += wlen;
        delete open[n];
      } else {
        ev = {
          kind: 'note', track: t.track.name, target: t.key, trackIndex: t.track.index, midi: n, velocity: velocity,
          drum: null, lyric: null, beat: a, endBeat: z, lastStart: a, lastEnd: z, staccato: p.staccato,
          wb: wlen, section: inst.name, instance: inst.index, path: null
        };
        events.push(ev);
      }
      if (p.tie) next[n] = ev;
      byPitch[n] = ev;
      if (!first) first = ev;
    });
    if (Object.keys(open).length) report('warning', line, 'A tie (~) in ' + t.raw + ' leads to a different pitch; the tie is ignored', key + ':tiepitch');
    st.open = next;
    if (p.lyric) addLyric(t, inst, a, p.lyric, line, first);
    if (p.glide && pitches.length === 1 && !p.tie) {
      const g = byPitch[pitches[0]];
      g.path = g.path || [{ beat: g.beat, midi: g.midi }];
      st.glide = g;
    }
  }

  function addLyric(t, inst, beat, raw, line, ev) {
    let text = raw, lineEnd = false, continues = false;
    if (/^".*"$/.test(text)) text = text.slice(1, -1);
    if (text.slice(-1) === '/') { lineEnd = true; text = text.slice(0, -1); }
    if (text.slice(-1) === '-') { continues = true; text = text.slice(0, -1); }
    text = text.replace(/_/g, ' ');
    if (ev && ev.lyric == null) ev.lyric = text;
    lyrics.push({ beat: beat, track: t.track.name, target: t.key, text: text, continues: continues, lineEnd: lineEnd, section: inst.name, instance: inst.index, line: line });
  }

  function compileDrums(inst, t) {
    const lane = DRUM_LANES[t.lane];
    const span = inst.barBeats / inst.groups;
    let vel = 80, prev = null;
    for (let b = 0; b < inst.bars; b++) {
      const bt = barText(t, b, prev, inst);
      prev = bt.text;
      if (bt.text === 'R') continue;
      const key = inst.name + ':' + t.raw + ':' + b;
      const barStart = inst.startBeat + b * inst.barBeats;
      const toks = barTokens(bt.text);
      let g = 0;
      for (let i = 0; i < toks.length; i++) {
        const tok = toks[i];
        const dm = RE_DYN.exec(tok);
        if (dm) { vel = DYNAMICS[dm[1]]; continue; }
        if (tok === 'R' || tok === '%') { report('error', bt.line, '"' + tok + '" must be the only thing in its bar', key + ':alone'); continue; }
        if (!RE_GROUP.test(tok)) { report('error', bt.line, 'Bad drum group "' + tok + '" in ' + t.raw + ', ' + inst.name + ' bar ' + (b + 1) + ' (use x X o .)', key + ':bad:' + i); g++; continue; }
        if (g >= inst.groups) { g++; continue; }
        const L = tok.length;
        for (let k = 0; k < L; k++) {
          const c = tok[k];
          if (c !== 'x' && c !== 'X' && c !== 'o') continue;
          const v = c === 'X' ? Math.min(127, vel + 20) : c === 'o' ? Math.max(1, Math.round(0.4 * vel)) : vel;
          const pos = g * span + k * span / L;
          const a = barStart + warp(pos, inst);
          events.push({
            kind: 'drum', track: t.track.name, target: t.key, trackIndex: t.track.index, midi: lane.note, velocity: v,
            drum: lane.name, lyric: null, beat: a, endBeat: a + 0.25, section: inst.name, instance: inst.index
          });
        }
        g++;
      }
      if (g !== inst.groups) {
        report('warning', bt.line, 'Bar ' + (b + 1) + ' of ' + t.raw + ' in ' + inst.name + ' has ' + g + ' groups; ' + inst.time.join('/') + ' needs ' + inst.groups + ' (one per pulse)', key + ':groups');
      }
    }
  }

  // 6. seconds
  events.forEach(function (ev) {
    ev.time = secAt(ev.beat);
    const endSec = secAt(ev.endBeat);
    ev.beats = ev.kind === 'drum' ? 0.25 : ev.wb;
    delete ev.wb;
    if (ev.kind === 'drum') { ev.duration = endSec - ev.time; return; }
    const written = endSec - ev.time;
    let soundEnd;
    if (ev.staccato) { const ls = secAt(ev.lastStart), le = secAt(ev.lastEnd); soundEnd = ls + 0.5 * (le - ls); }
    else soundEnd = endSec - Math.min(0.05 * written, 0.06);
    ev.duration = Math.max(0.01, soundEnd - ev.time);
    ev.soundEndBeat = beatAt(ev.time + ev.duration);
    if (ev.path) ev.pitchPath = ev.path.map(function (q) { return { time: secAt(q.beat), beat: q.beat, midi: q.midi }; });
  });
  events.sort(function (x, y) { return x.time - y.time || x.trackIndex - y.trackIndex || x.midi - y.midi; });
  lyrics.forEach(function (l) { l.time = secAt(l.beat); });
  lyrics.sort(function (x, y) { return x.time - y.time; });

  const sections = layout.map(function (inst) {
    const b1 = inst.startBeat + inst.bars * inst.barBeats;
    return {
      name: inst.name, instance: inst.index, beat: inst.startBeat, endBeat: b1, time: secAt(inst.startBeat), endTime: secAt(b1),
      bars: inst.bars, timeSignature: inst.time, barBeats: inst.barBeats, tempo: inst.tempo, swing: inst.swing, transpose: inst.transpose
    };
  });

  let lyricTrack = null;
  for (let i = 0; i < song.tracks.length && !lyricTrack; i++) {
    for (let j = 0; j < lyrics.length; j++) if (lyrics[j].track === song.tracks[i].name) { lyricTrack = song.tracks[i].name; break; }
  }

  diags.sort(function (x, y) { return (x.line || 0) - (y.line || 0); });

  return {
    title: H.title, header: H, meta: song.meta, version: song.version, tracks: song.tracks,
    events: events, lyrics: lyrics, lyricTrack: lyricTrack, sections: sections, tempoSegments: segments,
    endBeat: endBeat, duration: secAt(endBeat), diagnostics: diags,
    secAt: secAt, beatAt: beatAt
  };
}

// ---------------------------------------------------------------------------
// MIDI export: compiled song -> Standard MIDI File, format 1 (spec 4.8)
// ---------------------------------------------------------------------------

const PITCHED_CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];

function utf8(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c >= 0xD800 && c < 0xDC00 && i + 1 < str.length) {
      const d = str.charCodeAt(i + 1);
      if (d >= 0xDC00 && d < 0xE000) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

function vlq(n) {
  n = Math.max(0, Math.round(n));
  const bytes = [n & 0x7F];
  while ((n >>= 7) > 0) bytes.unshift((n & 0x7F) | 0x80);
  return bytes;
}

function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }

function metaEvent(type, data) { return [0xFF, type].concat(vlq(data.length), data); }

function toMidi(c) {
  const PPQ = 480;
  function tick(b) { return Math.max(0, Math.round(b * PPQ)); }
  const chunks = [];

  // Track 0: conductor (title, time signatures, tempo map, section markers)
  const cond = [{ t: 0, o: 0, b: metaEvent(0x03, utf8(c.title || 'Untitled')) }];
  let lastTS = null;
  c.sections.forEach(function (s) {
    const ts = s.timeSignature;
    if (ts.join('/') !== lastTS) {
      cond.push({ t: tick(s.beat), o: 0, b: [0xFF, 0x58, 4, ts[0], Math.round(Math.log(ts[1]) / Math.LN2), 24, 8] });
      lastTS = ts.join('/');
    }
    cond.push({ t: tick(s.beat), o: 1, b: metaEvent(0x06, utf8(s.name)) });
  });
  let lastBpm = null;
  function tempoAt(b, bpm) {
    const us = Math.round(60000000 / bpm);
    cond.push({ t: tick(b), o: 0, b: [0xFF, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] });
    lastBpm = bpm;
  }
  c.tempoSegments.forEach(function (g) {
    if (Math.abs(g.bpm1 - g.bpm0) < 1e-9) { if (g.bpm0 !== lastBpm) tempoAt(g.beat0, g.bpm0); return; }
    for (let b = g.beat0; b < g.beat1 - 1e-9; b += 0.25) {
      const mid = Math.min(b + 0.125, g.beat1);
      tempoAt(b, g.bpm0 + (g.bpm1 - g.bpm0) * (mid - g.beat0) / (g.beat1 - g.beat0));
    }
  });
  chunks.push(trackChunk(cond));

  // One MIDI track per LMN track
  let next = 0;
  c.tracks.forEach(function (tr) {
    const ch = tr.isDrum ? 9 : PITCHED_CHANNELS[(next++) % PITCHED_CHANNELS.length];
    const list = [
      { t: 0, o: 0, b: metaEvent(0x03, utf8(tr.name + ' (' + tr.instrument + ')')) },
      { t: 0, o: 0, b: [0xC0 | ch, tr.gm & 127] },
      { t: 0, o: 0, b: [0xB0 | ch, 7, clamp(Math.round(tr.vol * 1.27), 0, 127)] },
      { t: 0, o: 0, b: [0xB0 | ch, 10, clamp(Math.round(64 + tr.pan * 0.63), 0, 127)] }
    ];
    function note(b0, b1, midi, vel) {
      const t0 = tick(b0);
      const t1 = Math.max(t0 + 1, tick(b1));
      list.push({ t: t0, o: 3, b: [0x90 | ch, midi & 127, clamp(vel, 1, 127)] });
      list.push({ t: t1, o: 1, b: [0x80 | ch, midi & 127, 0] });
    }
    c.events.forEach(function (ev) {
      if (ev.track !== tr.name) return;
      if (ev.kind === 'drum') { note(ev.beat, ev.beat + 0.25, ev.midi, ev.velocity); return; }
      if (ev.pitchPath && ev.pitchPath.length > 1) {
        for (let i = 0; i < ev.pitchPath.length; i++) {
          const p = ev.pitchPath[i];
          const end = i + 1 < ev.pitchPath.length ? ev.pitchPath[i + 1].beat : ev.soundEndBeat;
          note(p.beat, end, p.midi, ev.velocity);
        }
        return;
      }
      note(ev.beat, ev.soundEndBeat, ev.midi, ev.velocity);
    });
    c.lyrics.forEach(function (l) {
      if (l.track !== tr.name) return;
      const txt = l.text + (l.lineEnd ? '\r' : (l.continues ? '' : ' '));
      list.push({ t: tick(l.beat), o: 2, b: metaEvent(0x05, utf8(txt)) });
    });
    chunks.push(trackChunk(list));
  });

  const header = [0x4D, 0x54, 0x68, 0x64].concat(u32(6), [0, 1], [(chunks.length >> 8) & 255, chunks.length & 255], [(PPQ >> 8) & 255, PPQ & 255]);
  let size = header.length;
  chunks.forEach(function (ch) { size += ch.length; });
  const out = new Uint8Array(size);
  out.set(header, 0);
  let off = header.length;
  chunks.forEach(function (ch) { out.set(ch, off); off += ch.length; });
  return out;

  function trackChunk(list) {
    list.sort(function (a, b) { return a.t - b.t || a.o - b.o; });
    const data = [];
    let last = 0;
    list.forEach(function (e) {
      const d = vlq(e.t - last);
      for (let i = 0; i < d.length; i++) data.push(d[i]);
      for (let i = 0; i < e.b.length; i++) data.push(e.b[i]);
      last = e.t;
    });
    data.push(0x00, 0xFF, 0x2F, 0x00);
    return [0x4D, 0x54, 0x72, 0x6B].concat(u32(data.length), data);
  }
}

// ---------------------------------------------------------------------------

return {
  version: '1.0',
  parse: parse,
  compile: compile,
  toMidi: toMidi,
  voiceChord: voiceChord,
  pitchToMidi: pitchToMidi,
  midiToName: midiToName,
  durationBeats: durationBeats,
  INSTRUMENTS: INSTRUMENTS,
  DRUM_LANES: DRUM_LANES,
  DRUM_ALIASES: DRUM_ALIASES,
  CHORD_QUALITIES: CHORD_QUALITIES,
  DYNAMICS: DYNAMICS,
  DURATIONS: DURATIONS
};
}));
