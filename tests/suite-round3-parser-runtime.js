// Round 3, parser and browser runtime: escapes in quoted property values, a
// finished one-shot track starting again, own-property lookups for script
// names in engine/runtime/, and the choice / NVL restore paths of ui.js.
import { test, eq, ok, one, errors, results } from './harness.js';
import { parseFile, tokenizeArgs, VM, Diagnostics } from '../engine/core/index.js';
import { clone } from '../engine/core/util.js';
import { AudioMixer } from '../engine/runtime/audio.js';
import { Player } from '../engine/runtime/player.js';
import { TextUI } from '../engine/runtime/ui.js';
import { Stage } from '../engine/runtime/stage2d.js';
import { Assets } from '../engine/runtime/assets.js';
import { Screens } from '../engine/runtime/screens.js';
import { Weather } from '../engine/runtime/particles.js';
import { Tweens, EASE } from '../engine/runtime/tween.js';

const HEAD = 'SHIORI 1\ntitle: T\n';
const PROTO_NAMES = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'];
function prog(text) {
  const r = one(HEAD + text);
  const e = errors(r);
  if (e.length) throw new Error('compile errors: ' + e.map(d => `${d.code} ${d.message}`).join('; '));
  return r.program;
}
// Some tests need async steps (the mixer awaits its decks).
async function atest(name, fn) {
  try { await fn(); results.passed++; }
  catch (e) { results.failed++; results.fails.push(`✗ ${name}\n    ${e && e.message || e}`); }
}
// Swap globals (window, document, timers, console) for the length of fn.
function withGlobals(vals, fn) {
  const saved = Object.keys(vals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  for (const [k, v] of Object.entries(vals)) globalThis[k] = v;
  const restore = () => { for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } };
  let out;
  try { out = fn(); } catch (e) { restore(); throw e; }
  if (out && typeof out.then === 'function') return out.finally(restore);
  restore();
  return out;
}
const quietConsole = () => {
  const warns = [];
  return { warns, console: { warn: (...a) => warns.push(a.join(' ')), log() {}, info() {}, error() {} } };
};

// ---- 1. parser: escapes in quoted property values --------------------------------
const propsOf = (lines) => {
  const f = parseFile('game.story', HEAD + '@character mio\n' + lines, { isMain: true });
  return { props: f.decls[0].props, diags: f.diags.list };
};
const argHint = (s) => {
  const diags = new Diagnostics();
  tokenizeArgs(s, 0, diags, { file: 'game.story', line: 1, src: s });
  return diags.list[0].hint;
};

test('\\n in a quoted property value is E110 with the caret on the backslash', () => {
  const { props, diags } = propsOf('  name: Mio\n  description: "Two\\nlines"\n');
  eq(diags.map(d => d.code), ['E110']);
  const d = diags[0];
  eq(d.message, 'Unknown escape `\\n` in a quoted property value.');
  eq([d.line, d.col], [5, 20], 'caret on the backslash');
  eq(d.hint, 'A quoted property value cannot hold a line break. For a break in dialogue or narration, put `{br}` in the text line instead.');
  eq(props[1].value, 'Two\\nlines', 'the text keeps the escape as typed');
});
test('other unknown escapes in property values get the same hints as in arguments', () => {
  const { diags } = propsOf('  name: "Mio\\tT"\n  description: "a \\u2014 b"\n  cv: "C:\\games\\x"\n');
  eq(diags.map(d => [d.code, d.line, d.col]), [['E110', 4, 13], ['E110', 5, 19], ['E110', 6, 10], ['E110', 6, 16]], 'one error per bad escape');
  eq(diags[0].hint, argHint('"a\\tb"'));
  eq(diags[1].hint, argHint('"\\u2014"'));
  ok(/Type the character itself/.test(diags[1].hint), diags[1].hint);
});
test('\\\\, \\" and \\\' escape in quoted property values, as in arguments', () => {
  const { props, diags } = propsOf('  name: "Rin\\\'s \\\\ \\"cat\\""\n  description: "a\\\\b"\n');
  eq(diags, []);
  eq(props.map(p => [p.value, p.quoted]), [['Rin\'s \\ "cat"', true], ['a\\b', true]]);
  const r = one(HEAD + '@character mio\n  name: "Rin\\\'s \\\\ \\"cat\\""\n\n# a\nmio: Hi.\n-> END\n');
  eq(errors(r), []);
  eq(new VM(r.program, { seed: 1 }).start().halt.name, 'Rin\'s \\ "cat"', 'the displayed name');
});
test('an unquoted property value keeps its backslashes, like an unquoted argument', () => {
  const { props, diags } = propsOf('  name: Mio\\nT\n  cv: C:\\x\\y\n');
  eq(diags, []);
  eq(props.map(p => [p.value, p.quoted]), [['Mio\\nT', false], ['C:\\x\\y', false]]);
  const diags2 = new Diagnostics();
  eq(tokenizeArgs('Mio\\nT', 0, diags2, {}).map(a => a.value), ['Mio\\nT']);
  eq(diags2.list, []);
});
test('a quoted property value still runs from the first quote to the last', () => {
  const { props, diags } = propsOf('  name: "a" and "b"\n  description: "Hello," she said.\n  cv: "\n');
  eq(diags, []);
  eq(props.map(p => [p.value, p.quoted]), [['a" and "b', true], ['"Hello," she said.', false], ['"', false]]);
});
test('a quoted property value whose last quote is escaped is never closed (E110)', () => {
  const { props, diags } = propsOf('  name:   "abc\\"\n');
  eq(diags.map(d => [d.code, d.line, d.col, d.message, d.hint]), [['E110', 4, 11, 'This quoted string is never closed.', 'Add a closing ".']]);
  eq(props[0].value, 'abc"');
  const diags2 = new Diagnostics();
  tokenizeArgs('"abc\\"', 0, diags2, {});
  eq(diags2.list.map(d => d.message), ['This quoted string is never closed.'], 'the same as an argument');
});
test('quoted command arguments keep their messages', () => {
  const diags = new Diagnostics();
  tokenizeArgs('"a\\nb"', 0, diags, {});
  eq(diags.list.map(d => [d.message, d.hint]), [['Unknown escape `\\n` in a quoted argument.', 'A quoted argument cannot hold a line break. For a break in dialogue or narration, put `{br}` in the text line instead.']]);
});

// ---- 2. audio: a finished one-shot track starts again ----------------------------
class FakeParam {
  constructor(v) { this.value = v; this.events = []; }
  cancelScheduledValues(t) { this.events.push(['cancel', t]); }
  setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]); }
  linearRampToValueAtTime(v, t) { this.value = v; this.events.push(['ramp', v, t]); }
  setTargetAtTime(v, t) { this.events.push(['target', v, t]); }
}
const fakeNode = () => ({ connect(n) { return n; }, disconnect() {} });
function fakeMixer(program) {
  program = program || { decls: { assets: {
    sting: { path: 'sting.ogg', opts: {} },
    rain: { path: 'rain.ogg', opts: { loop: false } },
    song: { path: 'song.lmn', opts: {} },
  } } };
  const m = new AudioMixer({ program, resolveUrl: (p) => p, settings: {}, engineBase: '' });
  const sources = [];
  m.ctx = {
    currentTime: 10, state: 'running',
    createGain: () => ({ ...fakeNode(), gain: new FakeParam(1) }),
    createBufferSource: () => { const s = { ...fakeNode(), buffer: null, loop: false, started: 0, start() { this.started++; }, stop() {} }; sources.push(s); return s; },
  };
  m.bus = { music: fakeNode(), ambience: fakeNode(), sound: fakeNode(), voice: fakeNode() };
  m.duckGain = fakeNode();
  m.buffer = async () => ({ duration: 3 });
  return { m, sources };
}
// Let the mixer's awaits run (timers are stubbed out).
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const audioOf = (r) => r.effects.filter(e => e.type === 'audio');
const noTimers = { setTimeout: () => 0 };

await atest('a one-shot track that has finished starts again when the script asks for it with loop=true', () => withGlobals(noTimers, async () => {
  const program = prog('@audio sting sting.ogg\n\n# a\n@music sting loop=false\nOne.\n@music sting loop=true\nTwo.\n-> END\n');
  const vm = new VM(program, { seed: 1 });
  const { m, sources } = fakeMixer(program);
  for (const e of audioOf(vm.start())) m.apply(e);
  await settle();
  const first = m.music;
  eq([sources.length, first.loop], [1, false]);
  sources[0].onended();                // the track plays to its end
  const fx = audioOf(vm.advance());
  eq(fx.map(e => [e.op, e.same, e.music.loop]), [['music', true, true]], 'the VM asks for the same track');
  for (const e of fx) m.apply(e);
  await settle();
  eq(sources.length, 2, 'a new source plays the track from the start');
  ok(m.music !== first && m.music.loop && sources[1].loop, 'the new deck loops');
  ok(first.stopped, 'the finished deck is let go');
}));
await atest('a finished one-shot track asked for again without loop= plays once more', () => withGlobals(noTimers, async () => {
  const { m, sources } = fakeMixer();
  await m.playMusic({ id: 'sting', volume: 1, loop: false }, 1);
  sources[0].onended();
  await m.apply({ type: 'audio', op: 'music', same: true, music: { id: 'sting', volume: 1, loop: false }, fade: 1 });
  await settle();
  eq(sources.length, 2);
  eq([m.music.loop, m.music.ended, sources[1].started], [false, false, 1]);
}));
await atest('a one-shot track that is still playing is not restarted', () => withGlobals(noTimers, async () => {
  const { m, sources } = fakeMixer();
  await m.playMusic({ id: 'sting', volume: 1, loop: false }, 1);
  const deck = m.music;
  await m.playMusic({ id: 'sting', volume: 0.5, loop: true }, 1);
  eq([sources.length, m.music === deck, deck.src.loop], [1, true, true]);
  m.stopMusic(0);
  sources[0].onended();                // fires when a track is stopped, too
  await m.playMusic({ id: 'sting', volume: 1, loop: true }, 1);
  eq(sources.length, 2, 'a stopped track starts over as before');
}));
await atest('ambience that does not loop starts again once it has finished', () => withGlobals(noTimers, async () => {
  const program = prog('@audio rain rain.ogg loop=false\n\n# a\n@ambience rain\nOne.\n@ambience rain\nTwo.\n@ambience rain\nThree.\n-> END\n');
  const vm = new VM(program, { seed: 1 });
  const { m, sources } = fakeMixer(program);
  for (const e of audioOf(vm.start())) m.apply(e);
  await settle();
  eq([sources.length, m.ambience.loop], [1, false], 'the asset says loop=false');
  for (const e of audioOf(vm.advance())) m.apply(e);
  await settle();
  eq(sources.length, 1, 'still playing: kept');
  sources[0].onended();
  for (const e of audioOf(vm.advance())) m.apply(e);
  await settle();
  eq(sources.length, 2, 'finished: played again');
}));
await atest('an LMN song that does not loop starts again once it has finished', () => {
  const players = [];
  class FakeLmn { constructor() { this.plays = 0; players.push(this); } setSong() {} play() { this.plays++; } stop() {} }
  return withGlobals({ ...noTimers, window: { LMNSynth: { Player: FakeLmn } } }, async () => {
    const { m } = fakeMixer();
    m.song = async () => ({});
    await m.playMusic({ id: 'song', volume: 1, loop: false }, 1);
    players[0].onEnd();
    eq([players[0].plays, m.music.ended], [1, true], 'not looped');
    await m.playMusic({ id: 'song', volume: 1, loop: false }, 1);
    eq([players.length, players[1].plays], [2, 1]);
    const looping = m.music;
    looping.loop = true;
    players[1].onEnd();
    eq([players[1].plays, looping.ended], [2, false], 'a looping song plays on');
  });
});
await atest('rollback keeps a finished one-shot track silent; loading a save starts it again', () => withGlobals(noTimers, async () => {
  const { m, sources } = fakeMixer();
  const p = Object.create(Player.prototype);
  p.audio = m;
  p.stage = { sync() {} };
  p.ui = { sync() {}, showBox() {} };
  const restore = (extra) => ({ type: 'restore', stage: {}, text: { mode: 'adv', page: [] }, audio: { music: { id: 'sting', volume: 1, loop: false }, ambience: null }, ...extra });
  p.applyEffect(restore());
  await settle();
  sources[0].onended();
  p.applyEffect(restore({ rollback: true }));
  p.applyEffect(restore({ rollforward: true }));
  await settle();
  eq(sources.length, 1, 'rollback and rollforward do not replay it');
  p.applyEffect(restore());
  await settle();
  eq(sources.length, 2, 'a load plays it as a fresh session would');
}));

// ---- 3. own-property lookups for script names in engine/runtime/ ------------------
// A program read back from JSON has tables with a prototype, where `toString`
// or `constructor` would be found too.
const jsonProgram = (text) => clone(prog(text));

// Tiny DOM and canvas stubs.
class FakeNode {
  constructor(tag) {
    this.tagName = tag; this.children = []; this._text = ''; this.attrs = {}; this.classes = new Set(); this.listeners = {};
    this.style = { setProperty: (k, v) => { this.style[k] = v; } };
    const self = this;
    this.classList = {
      add: (...c) => c.forEach(x => self.classes.add(x)), remove: (...c) => c.forEach(x => self.classes.delete(x)),
      toggle: (c, on) => { if (on === undefined ? !self.classes.has(c) : on) self.classes.add(c); else self.classes.delete(c); },
      contains: (c) => self.classes.has(c),
    };
  }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(' '); }
  appendChild(c) { this.children.push(c); c.parent = this; return c; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(t, fn) { this.listeners[t] = fn; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  focus() {}
  getContext() { return fakeCtx(); }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  get scrollHeight() { return 0; }
  get clientHeight() { return 0; }
}
// A 2D context that accepts any call.
function fakeCtx() {
  const t = { canvas: null };
  return new Proxy(t, { get: (o, k) => (k in o ? o[k] : () => ({ addColorStop() {} })), set: (o, k, v) => { o[k] = v; return true; } });
}
const fakeDocument = () => ({
  createElement: (t) => { const n = new FakeNode(t); if (t === 'canvas') { n.width = 0; n.height = 0; } return n; },
  createTextNode: (s) => { const n = new FakeNode('#text'); n._text = s; return n; },
});
const domGlobals = () => ({
  document: fakeDocument(), setTimeout: () => 0, performance: { now: () => 0 },
  requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
  Image: class { set src(v) { this._src = v; } },
});
const all = (n, out = []) => { out.push(n); n.children.forEach(c => all(c, out)); return out; };
const html = (n) => n.tagName === '#text' ? n._text : `<${n.tagName}>${n._text}${n.children.map(html).join('')}</${n.tagName}>`;

const CAST = '@character constructor name=Con\n@image valueOf bg/v.png\n@audio toString t.ogg\n\n# a\nHi.\n-> END\n';

await atest('the mixer finds only declared tracks, also in a program read back from JSON', () => withGlobals(noTimers, async () => {
  const program = jsonProgram(CAST);
  const { m, sources } = fakeMixer(program);
  for (const id of ['constructor', 'hasOwnProperty', '__proto__']) eq(m.asset(id), null, id);
  ok(m.asset('toString') && m.asset('toString').path === 't.ogg', 'a track named toString is found');
  await m.playMusic({ id: 'hasOwnProperty', volume: 1, loop: true }, 1);
  eq(sources.length, 0, 'nothing plays for an undeclared name');
  await m.playMusic({ id: 'toString', volume: 1, loop: true }, 1);
  eq([sources.length, m.music.id], [1, 'toString']);
}));
test('the stage shows only declared characters and props (JSON program)', () => withGlobals(domGlobals(), () => {
  const program = jsonProgram(CAST);
  const assets = new Assets((p) => p, program);
  const stage = new Stage({ canvas: new FakeNode('canvas'), program, assets, settings: {}, resolveUrl: (p) => p, loadModule: null });
  const actor = (kind, id) => ({ kind, id, attrs: {}, x: 0.5, y: 0, scale: 1 });
  stage.sync({ bg: { kind: 'image', id: 'toString' }, cg: 'hasOwnProperty', camera: {}, weather: null, filter: 'none', tint: null,
    actors: [actor('character', 'toString'), actor('character', 'constructor'), actor('image', 'valueOf'), actor('image', 'hasOwnProperty')] });
  eq([...stage.actors.keys()], ['constructor', 'valueOf']);
  eq(stage.declFor(actor('character', 'valueOf')), null, 'valueOf is an image, not a character');
  eq(stage.declFor(actor('image', 'toString')).kind, 'audio');
  stage.composePicture();
}));
test('asset images, preloading and prefetch use own properties only (JSON program)', () => withGlobals(domGlobals(), () => {
  const program = jsonProgram(CAST);
  const assets = new Assets((p) => p, program);
  const ph = assets.asset('constructor', 64, 36);
  ok(ph && assets.composites.has('phi:constructor:64x36'), 'an undeclared image id gets a placeholder');
  assets.preloadEffect({ type: 'restore', stage: { bg: { kind: 'image', id: 'toString' }, cg: 'valueOf', actors: [{ kind: 'character', id: 'valueOf', attrs: {} }, { kind: 'image', id: 'hasOwnProperty' }] } });
  assets.preloadEffect({ type: 'stage', op: 'show', actor: { kind: 'character', id: 'toString', attrs: {} } });
  program.code = [
    { op: 'cmd', name: 'show', args: { kind: 'character', who: 'toString', attrs: {} } },
    { op: 'cmd', name: 'show', args: { kind: 'image', who: 'hasOwnProperty' } },
    { op: 'cmd', name: 'bg', args: { bg: 'constructor' } },
    { op: 'cmd', name: 'cg', args: { image: 'hasOwnProperty' } },
  ];
  assets.prefetch(0);
  eq([...assets.cache.keys()], ['bg/v.png'], 'only the declared image loads');
}));
test('side portraits and character composites fill templates from own groups only', () => withGlobals(domGlobals(), () => {
  const program = prog('@character mio\n  side: side/{constructor}_{pose}.png\n  sprite: m/{constructor}.png\n  constructor: calm cross\n  pose: up\n\n# a\nmio (cross): Hi.\n-> END\n');
  const p = Object.create(Player.prototype);
  p.program = program;
  p.resolveUrl = (x) => x;
  eq(p.sidePortrait({ who: 'mio', attrs: { constructor: 'cross' } }), 'side/cross_up.png');
  eq(p.sidePortrait({ who: 'mio' }), 'side/calm_up.png');
  eq(p.sidePortrait({ who: 'toString' }), null);
  p.program = clone(program);
  eq(p.sidePortrait({ who: 'valueOf' }), null, 'JSON program');
  const assets = new Assets((x) => x, program);
  eq(assets.layerPaths(program.decls.characters.mio, { constructor: 'cross' }), ['m/cross.png']);
}));
test('?set= sets a variable named __proto__ and ignores undeclared names', () => {
  const program = prog('@var __proto__ = 0\n@var trust = 0\n\n# a\nHi {$__proto__} {$trust}.\n-> END\n');
  for (const program2 of [program, clone(program)]) {
    const p = Object.create(Player.prototype);
    p.program = program2;
    p.params = { set: '__proto__=5,trust=2,constructor=1,toString=3' };
    p.screens = { closeAll() {} };
    p.audio = { unlock() {} };
    p.stopModes = () => {};
    let halt = null;
    p.handle = (r) => { halt = r.halt; };
    p.vm = new VM(program2, { seed: 1 });
    p.newGame();
    eq(halt.plain, 'Hi 5 2.');
  }
});
test('effect types named like Object.prototype members have no handler', () => {
  const q = quietConsole();
  withGlobals({ console: q.console }, () => {
    const p = Object.create(Player.prototype);
    p.effectHandlers = {};
    for (const type of PROTO_NAMES) p.applyEffect({ type });
    eq(q.warns, PROTO_NAMES.map(t => `[shiori] no handler for effect ${t}`));
    const seen = [];
    p.effectHandlers.toString = (e) => seen.push(e.type);
    p.applyEffect({ type: 'toString' });
    eq(seen, ['toString'], 'a module may still handle such a type');
  });
});
test('the extras screen counts only what the persistent tables really hold', () => withGlobals(domGlobals(), () => {
  const root = new FakeNode('div');
  const player = {
    program: { header: { title: 'T' }, decls: {
      assets: { constructor: { id: 'constructor', kind: 'image', path: 'cg/c.png', usedAs: { cg: true }, opts: {} },
        valueOf: { id: 'valueOf', kind: 'audio', path: 'm.ogg', usedAs: { music: true }, opts: {} } },
      endings: { toString: { id: 'toString', title: 'Odd', kind: 'normal' } },
    } },
    vm: { persistent: { cgs: {}, endings: {}, music: {} } },   // tables with a prototype
    resolveUrl: (x) => x, inGame: true,
  };
  const screens = new Screens(root, player);
  const body = (tab) => { screens.extras(tab); return screens.top.el.children[2]; };
  const gallery = all(body('gallery')).find(n => n.classes.has('sh-cg'));
  ok(gallery.classes.has('locked') && gallery.disabled, 'CG `constructor` is locked');
  const endings = body('endings');
  eq(endings.children[1].textContent, '0 of 1 endings reached');
  ok(all(endings).find(n => n.classes.has('sh-ending')).classes.has('locked'), 'ending `toString` is not reached');
  const track = all(body('music')).find(n => n.classes.has('sh-track'));
  ok(track.classes.has('locked'), 'track `valueOf` is locked');
  player.vm.persistent.cgs.constructor = 1;
  ok(!all(body('gallery')).find(n => n.classes.has('sh-cg')).classes.has('locked'), 'unlocked once seen');
}));
test('a weather type that is not a built-in one draws nothing and does not crash', () => withGlobals(domGlobals(), () => {
  for (const type of ['constructor', 'toString', '__proto__']) {
    const w = new Weather({ type, intensity: 1 }, 100, 100);
    eq(w.parts, [], type);
    w.alpha = 1;
    w.update(0.1);
    w.draw(fakeCtx(), false);
    w.setSpec({ type, intensity: 2 });
  }
  const rain = new Weather({ type: 'rain', intensity: 0.5 }, 100, 100);
  eq(rain.parts.length, 140, 'built-in types still work');
}));
test('tweens with an ease named like an Object.prototype member use inout', () => {
  for (const ease of ['constructor', 'toString', 'valueOf']) {
    const vals = [];
    const tw = new Tweens();
    tw.add(1, (p) => vals.push(p), { ease });
    tw.update(0.25);
    eq(vals, [0, EASE.inout(0.25)], ease);
  }
  const vals = [];
  const tw = new Tweens();
  tw.add(1, (p) => vals.push(p), { ease: 'linear' });
  tw.update(0.25);
  eq(vals, [0, 0.25], 'a real ease still works');
});

// ---- 4. ui.js: choices with ruby and {br}, NVL pages restored ---------------------
const newUI = (header = {}) => new TextUI(new FakeNode('div'), { program: { header }, sidePortrait: () => null });

test('a choice with a ruby reading and {br} renders both, with its text visible', () => withGlobals(domGlobals(), () => {
  const program = prog('# a\nWhere?\n* Go to {ruby=かんじ}漢字{/ruby} town{br}tonight\n  -> END\n* Stay\n  -> END\n');
  const vm = new VM(program, { seed: 1 });
  vm.start();
  const h = vm.advance().halt;
  eq(h.type, 'menu');
  const ui = newUI();
  let chosen = null;
  ui.menu(h, (i) => { chosen = i; });
  const [b1, b2] = ui.choices.children;
  const label = b1.children[1];
  eq(html(label), '<span><span>Go to </span><ruby>漢字<rt>かんじ</rt></ruby><span> town</span><br></br><span>tonight</span></span>');
  ok(all(ui.choices).every(n => !n.classes.has('sh-ch')), 'no letter is hidden for a typewriter');
  eq(html(b2.children[1]), '<span><span>Stay</span></span>');
  eq(ui.live.textContent, 'Choice: Go to 漢字 town\ntonight / Stay');
  b1.listeners.click({ stopPropagation() {} });
  eq(chosen, 0);
}));

// A restored NVL page: narration with ruby and {br}, dialogue with a {w},
// and narration under @pov.
const NVL = '@character mio name=Mio color=#f68\n@character rin name=Rin color=#8af\n\n# a\n@mode nvl\n' +
  'The {ruby=かぜ}風{/ruby} rises.{br}Night.\nmio: Hello{w} there.\n@pov rin\nI watched the lamp.\nLast line.\n-> END\n';
function nvlRestore() {
  const program = one('SHIORI 1\ntitle: T\ndialogue_quotes: 「」\n' + NVL).program;
  const vm = new VM(program, { seed: 1 });
  let r = vm.start();
  while (r.halt.plain !== 'Last line.') r = vm.advance();
  return vm.load(vm.save());            // the save is the state before "Last line."
}
const paragraphs = (ui) => ui.nvlPage.children.map(p => [p.className, p.textContent]);
const PAGE = [
  ['sh-nvl-p', 'The 風かぜ rises.Night.'],
  ['sh-nvl-p sh-nvl-dialogue', 'Mio「Hello there.」'],
  ['sh-nvl-p sh-nvl-pov', 'RinI watched the lamp.'],
];

test('restoring an NVL page shows its three paragraphs, with the speaker and the POV', () => withGlobals(domGlobals(), () => {
  const r = nvlRestore();
  const restore = r.effects.find(e => e.type === 'restore');
  eq(restore.text.page.length, 3);
  const ui = new TextUI(new FakeNode('div'), { program: { header: { dialogue_quotes: '「」' } }, sidePortrait: () => null });
  ui.sync(restore.text);
  eq(ui.mode, 'nvl');
  eq(paragraphs(ui), PAGE);
  const [p1, p2, p3] = ui.nvlPage.children;
  ok(all(p1).some(n => n.tagName === 'rt') && all(p1).some(n => n.tagName === 'br'), 'ruby and br restored');
  eq([p2.children[0].className, p2.children[0].textContent, p2.children[0].style.color], ['sh-nvl-name', 'Mio', '#f68']);
  eq(p3.style['--pov'], '#8af', 'the POV character\'s colour');
  eq(p3.children.map(c => [c.className, c.textContent]), [['sh-nvl-povname', 'Rin'], ['sh-nvl-text', 'I watched the lamp.']], 'the first POV paragraph shows the POV name');
  const letters = all(ui.nvlPage).filter(n => n.classes.has('sh-ch'));
  ok(letters.length > 30 && letters.every(n => n.classes.has('on')), 'every restored letter is visible');
}));
test('two restores in a row show the page once, and the next line adds one paragraph', () => withGlobals(domGlobals(), () => {
  const r = nvlRestore();
  const restore = r.effects.find(e => e.type === 'restore');
  const ui = new TextUI(new FakeNode('div'), { program: { header: { dialogue_quotes: '「」' } }, sidePortrait: () => null });
  ui.sync(restore.text);
  const count = all(ui.nvlPage).length;
  ui.sync(restore.text);
  eq(paragraphs(ui), PAGE);
  eq(all(ui.nvlPage).length, count, 'no node is rendered twice');
  let done = 0;
  ui.say(r.halt, { cps: 0, onDone: () => done++ });
  eq(done, 1);
  eq(paragraphs(ui), [...PAGE, ['sh-nvl-p sh-nvl-pov', 'Last line.▼']], 'the line after the restore');
  ui.sync(restore.text);
  eq(paragraphs(ui), PAGE, 'a rollback to the same point shows the same page');
  ui.sync({ mode: 'adv', page: [] });
  eq([ui.mode, ui.nvlPage.children.length], ['adv', 0]);
}));
