// Follow-up fixes in the parser, markup, audio mixer and browser player
// (cross-area items from the review-fix round).
import { test, eq, ok, one, results } from './harness.js';
import { parseFile, parseMarkup, VM, Diagnostics } from '../engine/core/index.js';
import { tokenizeArgs } from '../engine/core/parser.js';
import { AudioMixer } from '../engine/runtime/audio.js';
import { Player } from '../engine/runtime/player.js';

const HEAD = 'SHIORI 1\ntitle: T\n';
const diag = (r, code) => r.diagnostics.find(d => d.code === code);
const argsOf = (s) => {
  const diags = new Diagnostics();
  const args = tokenizeArgs(s, 0, diags, { file: 'game.story', line: 1, src: s });
  return { args, errors: diags.list.filter(d => d.severity === 'error') };
};

// Some tests need async steps (the mixer awaits its decks).
async function atest(name, fn) {
  try { await fn(); results.passed++; }
  catch (e) { results.failed++; results.fails.push(`✗ ${name}\n    ${e && e.message || e}`); }
}
// Swap globals (window, document, timers, console) for the length of fn.
function withGlobals(vals, fn) {
  const saved = Object.keys(vals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  for (const [k, v] of Object.entries(vals)) globalThis[k] = v;
  try { return fn(); }
  finally { for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } }
}

// ---- parser: escapes in quoted command arguments ------------------------------
test('\\n in a quoted command argument is E110 with a {br} hint', () => {
  const r = one(HEAD + '# a\n@chapter "Part\\none"\n-> END\n');
  const d = diag(r, 'E110');
  ok(d, 'E110 reported');
  eq(d.message, 'Unknown escape `\\n` in a quoted argument.');
  eq([d.line, d.col], [4, 15], 'caret on the backslash');
  ok(/\{br\}/.test(d.hint), d.hint);
});
test('other unknown escapes in quoted arguments are E110', () => {
  const t = argsOf('"a\\tb"');
  eq(t.errors.map(e => e.code), ['E110']);
  ok(/Write `\\\\` for a backslash/.test(t.errors[0].hint), t.errors[0].hint);
  const u = argsOf('name="\\u2014"');
  eq(u.errors.map(e => e.code), ['E110']);
  ok(/Type the character itself/.test(u.errors[0].hint), u.errors[0].hint);
  eq(argsOf("'C:\\games\\x'").errors.length, 2, 'one error per bad escape');
  const h = parseFile('game.story', HEAD + '# a "Night\\tfall"\n-> END\n', { isMain: true });
  const e = h.diags.list.find(x => x.code === 'E110');
  ok(e && e.col === 11, 'scene titles use the same rule');
});
test('\\\\, \\" and \\\' still escape in quoted arguments', () => {
  const t = argsOf('"say \\"hi\\"" sub=\'it\\\'s\' path="a\\\\b"');
  eq(t.errors, []);
  eq(t.args.map(a => a.value), ['say "hi"', "it's", 'a\\b']);
  const r = one(HEAD + '# a\n@chapter "The \\"Salt\\" Road" subtitle="Rin\\\'s"\n-> END\n');
  eq(r.diagnostics.filter(d => d.severity === 'error'), []);
  const vm = new VM(r.program, { seed: 1 });
  const h = vm.start().halt;
  eq([h.type, h.title, h.subtitle], ['chapter', 'The "Salt" Road', "Rin's"]);
});
test('a backslash outside quotes is plain text', () => {
  eq(argsOf('a\\nb').args.map(a => a.value), ['a\\nb']);
  eq(argsOf('a\\nb').errors, []);
});

// ---- markup: only real tags are tags ------------------------------------------
test('Object.prototype names are unknown tags (E500)', () => {
  for (const name of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
    const codes = parseMarkup(`a {${name}}b`).errors.map(e => e.code);
    eq(codes, ['E500'], `{${name}}`);
    eq(parseMarkup(`a {/${name}}b`).errors.map(e => e.code), ['E500'], `{/${name}}`);
  }
  eq(parseMarkup('{constructor=1}x').errors.map(e => e.code), ['E500']);
  eq(parseMarkup('{b}x{/b}{br}y').errors, [], 'real tags still work');
});

// ---- audio mixer: same track, new volume/loop -----------------------------------
class FakeParam {
  constructor(v) { this.value = v; this.events = []; }
  cancelScheduledValues(t) { this.events.push(['cancel', t]); }
  setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]); }
  linearRampToValueAtTime(v, t) { this.value = v; this.events.push(['ramp', v, t]); }
  setTargetAtTime(v, t) { this.events.push(['target', v, t]); }
}
const fakeNode = () => ({ connect(n) { return n; }, disconnect() {} });
function fakeMixer() {
  const program = { decls: { assets: {
    theme: { path: 'theme.ogg', opts: { volume: 0.5 } },
    other: { path: 'other.ogg', opts: {} },
    rain: { path: 'rain.ogg', opts: {} },
  } } };
  const m = new AudioMixer({ program, resolveUrl: (p) => p, settings: {}, engineBase: '' });
  const sources = [];
  m.ctx = {
    currentTime: 10, state: 'running',
    createGain: () => ({ ...fakeNode(), gain: new FakeParam(1) }),
    createBufferSource: () => { const s = { ...fakeNode(), buffer: null, loop: false, start() {}, stop() {} }; sources.push(s); return s; },
  };
  m.bus = { music: fakeNode(), ambience: fakeNode(), sound: fakeNode(), voice: fakeNode() };
  m.duckGain = fakeNode();
  m.buffer = async () => ({ duration: 60 });
  return { m, sources };
}
const lastRamp = (deck) => deck.gain.gain.events.filter(e => e[0] === 'ramp').pop();

await atest('same music track with a new volume= ramps its deck, times the asset volume', async () => {
  const { m, sources } = fakeMixer();
  await m.playMusic({ id: 'theme', volume: 1, loop: true }, 1.5);
  const deck = m.music;
  eq(lastRamp(deck), ['ramp', 0.5, 11.5], 'initial fade-in');
  m.ctx.currentTime = 20;
  await m.apply({ type: 'audio', op: 'music', same: true, music: { id: 'theme', volume: 0.4, loop: false }, fade: 2 });
  eq(m.music, deck, 'same deck keeps playing');
  eq(sources.length, 1, 'the track is not restarted');
  eq(lastRamp(deck), ['ramp', 0.2, 22]);
  eq([deck.loop, deck.src.loop], [false, false], 'loop= is applied');
});
await atest('same ambience with a new volume= ramps its deck', async () => {
  const { m, sources } = fakeMixer();
  await m.playAmbience({ id: 'rain', volume: 1 }, 1);
  const deck = m.ambience;
  m.ctx.currentTime = 30;
  m.apply({ type: 'audio', op: 'ambience', same: true, ambience: { id: 'rain', volume: 0.3 }, fade: 1 });
  eq(m.ambience, deck);
  eq(sources.length, 1);
  eq(lastRamp(deck), ['ramp', 0.3, 31]);
  eq(deck.src.loop, true, 'ambience still loops');
});
await atest('asking for the playing track again cancels a track still loading', async () => {
  const { m } = fakeMixer();
  await m.playMusic({ id: 'theme', volume: 1, loop: true }, 1);
  const deck = m.music;
  let release;
  m.buffer = (a) => a.path === 'other.ogg' ? new Promise(res => { release = () => res({ duration: 1 }); }) : Promise.resolve({ duration: 60 });
  const pending = m.playMusic({ id: 'other', volume: 1, loop: true }, 1);
  m.playMusic({ id: 'theme', volume: 1, loop: true }, 1);
  await Promise.resolve();
  release();
  await pending;
  eq(m.music, deck, 'the loaded track did not replace the current one');
});

// ---- player: scene effects and persistent writes ----------------------------------
const quietConsole = () => {
  const warns = [];
  return { warns, console: { warn: (...a) => warns.push(a.join(' ')), log() {}, info() {}, error() {} } };
};
test('scene effects need no handler', () => {
  const r = one(HEAD + '# a "Arrival"\nHello.\n-> END\n');
  const effects = new VM(r.program, { seed: 1 }).start().effects.filter(e => e.type === 'scene');
  eq(effects.map(e => [e.id, e.title]), [['a', 'Arrival']]);
  const q = quietConsole();
  withGlobals({ console: q.console }, () => {
    const p = Object.create(Player.prototype);
    p.effectHandlers = {};
    for (const e of effects) p.applyEffect(e);
    eq(q.warns, [], 'no "no handler" warning');
    p.applyEffect({ type: 'mystery' });
    eq(q.warns.length, 1, 'other unknown effects still warn');
    const seen = [];
    p.effectHandlers.scene = (e) => seen.push(e.id);
    p.applyEffect(effects[0]);
    eq(seen, ['a'], 'a module may still listen to scene entries');
  });
});
test('the debounced persistent write is flushed on pagehide and when the page is hidden', () => {
  const r = one(HEAD + '# a\nOne.\nTwo.\n-> END\n');
  const timers = [], winL = {}, docL = {}, saved = [];
  const doc = { visibilityState: 'visible', addEventListener: (t, fn) => { docL[t] = fn; } };
  withGlobals({
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: (id) => { if (id) timers[id - 1] = null; },
    window: { addEventListener: (t, fn) => { winL[t] = fn; } },
    document: doc,
  }, () => {
    const p = Object.create(Player.prototype);
    p.program = r.program;
    p.res = {};
    p.storage = { loadPersistent: () => null, savePersistent: (data) => saved.push(JSON.parse(JSON.stringify(data))) };
    p.root = { addEventListener() {} };
    p.makeVM();
    p.bindInput();
    ok(winL.pagehide && docL.visibilitychange, 'listeners bound');
    p.vm.start();
    eq(saved.length, 0, 'write is debounced');
    docL.visibilitychange();
    eq(saved.length, 0, 'not while the page is visible');
    doc.visibilityState = 'hidden';
    docL.visibilitychange();
    eq(saved.length, 1, 'flushed when hidden');
    ok(saved[0].scenes.a && Object.keys(saved[0].read).length === 1, 'scene and first line marked');
    docL.visibilitychange();
    for (const fn of timers) if (fn) fn();
    eq(saved.length, 1, 'nothing left to write: no second save');
    p.vm.advance();
    winL.pagehide();
    eq(saved.length, 2, 'flushed on pagehide');
    eq(Object.keys(saved[1].read).length, 2);
    for (const fn of timers) if (fn) fn();
    eq(saved.length, 2, 'the cancelled timer does not write again');
  });
});
