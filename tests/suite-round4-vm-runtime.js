// Round 4, VM and browser runtime: attribute fix-up when an old save is
// loaded into an edited story (R18), the @character `noblink:` property, and
// the POV name on NVL narration (live, restored, rolled back, page turns).
import { test, eq, ok, one, errors } from './harness.js';
import { VM } from '../engine/core/index.js';
import { TextUI } from '../engine/runtime/ui.js';
import { Stage } from '../engine/runtime/stage2d.js';
import { Assets } from '../engine/runtime/assets.js';

const HEAD = 'SHIORI 1\ntitle: T\n';
const J = (x) => JSON.parse(JSON.stringify(x));
function prog(text) {
  const r = one(HEAD + text);
  const e = errors(r);
  if (e.length) throw new Error('compile errors: ' + e.map(d => `${d.code} ${d.message}`).join('; '));
  return r.program;
}
// Advance until a say with this plain text.
function until(vm, r, plain) {
  for (let i = 0; i < 200; i++) {
    if (r.halt.type === 'say' && r.halt.plain === plain) return r;
    if (r.halt.type === 'end' || r.halt.type === 'error') throw new Error('never reached: ' + plain);
    r = vm.advance();
  }
  throw new Error('runaway');
}

// ---- 1. R18: attribute fix-up in load() ------------------------------------------
const MIO = '@character mio\n  name: Mio\n  sprite: m/{outfit}_{expression}.svg\n  expression: neutral smile blush\n  outfit: school casual\n';
const STORY = '# a\n@scene black with=none\n@show mio blush casual at=center\nmio: Oh.\nmio: Hello again.\n-> END\n';
// Save at "Oh." under v1, load under v2. `order` rewrites the saved attrs with
// their keys in that order. Returns [actor attrs after load, attrs on the next line].
function reload(v1, v2, order) {
  const vm = new VM(prog(v1), { seed: 1 });
  until(vm, vm.start(), 'Oh.');
  const save = J(vm.save());
  if (order) {
    const re = (a) => Object.fromEntries(order.filter(k => k in a).map(k => [k, a[k]]));
    save.state.charAttrs.mio = re(save.state.charAttrs.mio);
    for (const a of save.state.stage.actors) if (a.id === 'mio') a.attrs = re(a.attrs);
  }
  const v = new VM(prog(v2), { seed: 1 });
  v.load(save);
  const actor = v.state.stage.actors.find(a => a.id === 'mio');
  const next = until(v, v.advance(), 'Hello again.').halt.attrs;
  return [J(actor.attrs), J(next)];
}
// casual is now an expression; outfit keeps school.
const MOVED = MIO.replace('expression: neutral smile blush', 'expression: neutral smile blush casual').replace('outfit: school casual', 'outfit: school uniform');
const MOVED_STORY = STORY.replace('@show mio blush casual', '@show mio blush');

test('R18: a saved value still valid in its own group is kept when another value moves into that group', () => {
  const want = { expression: 'blush', outfit: 'school' };
  eq(reload(MIO + STORY, MOVED + MOVED_STORY), [want, want]);
});
test('R18: the result does not depend on the order of the saved keys', () => {
  const want = { expression: 'blush', outfit: 'school' };
  eq(reload(MIO + STORY, MOVED + MOVED_STORY, ['outfit', 'expression']), [want, want], 'outfit first');
  eq(reload(MIO + STORY, MOVED + MOVED_STORY, ['expression', 'outfit']), [want, want], 'expression first');
});
test('R18: a stale value moves into a group that kept no valid saved value of its own', () => {
  // blush was removed, casual moved to expression: expression takes casual.
  const v2 = MIO.replace('expression: neutral smile blush', 'expression: neutral smile casual').replace('outfit: school casual', 'outfit: school uniform');
  const want = { expression: 'casual', outfit: 'school' };
  for (const order of [['outfit', 'expression'], ['expression', 'outfit']]) eq(reload(MIO + STORY, v2 + MOVED_STORY.replace('blush', 'smile'), order), [want, want], order.join(','));
  // A renamed group: outfit is now clothes, with the same values.
  const v3 = MIO.replace('{outfit}', '{clothes}').replace('outfit: school casual', 'clothes: school casual');
  const want3 = { expression: 'blush', clothes: 'casual' };
  eq(reload(MIO + STORY, v3 + STORY), [want3, want3]);
});
test('R18: two stale values that claim the same group are both dropped, in any key order', () => {
  const v1 = '@character mio\n  name: Mio\n  mood: calm sad\n  look: tidy wild\n';
  const story = '# a\n@scene black with=none\n@show mio sad wild at=center\nmio: Oh.\nmio: Hello again.\n-> END\n';
  const v2 = '@character mio\n  name: Mio\n  expression: neutral sad wild\n';
  const story2 = story.replace('@show mio sad wild', '@show mio');
  const want = { expression: 'neutral' };
  eq(reload(v1 + story, v2 + story2, ['mood', 'look']), [want, want], 'mood first');
  eq(reload(v1 + story, v2 + story2, ['look', 'mood']), [want, want], 'look first');
});
test('R18: a removed group and an unchanged program keep their old results', () => {
  const v2 = MIO.replace('  outfit: school casual\n', '').replace('{outfit}_', '');
  eq(reload(MIO + STORY, v2 + STORY.replace('blush casual', 'blush')), [{ expression: 'blush' }, { expression: 'blush' }]);
  const vm = new VM(prog(MIO + STORY), { seed: 1 });
  until(vm, vm.start(), 'Oh.');
  const v = new VM(prog(MIO + STORY), { seed: 1 });
  v.load(J(vm.save()));
  eq(v.state.stage.actors.find(a => a.id === 'mio').attrs, { expression: 'blush', outfit: 'casual' });
});

// ---- 2. noblink: compile-time checks ---------------------------------------------
const SLEEPY = '@character mio\n  sprite: m/{pose}_{expression}.png\n  blink: m/blink_{pose}.png\n  expression: neutral smile sleepy proud\n  pose: stand lying\n';
const BODY = '\n# a\nmio: Hi.\n-> END\n';
const diag = (text) => one(HEAD + text).diagnostics.filter(d => d.severity === 'error').map(d => [d.code, d.message, d.hint]);

test('noblink: lists attribute values of the character, in any order of lines', () => {
  const r = one(HEAD + SLEEPY + '  noblink: sleepy proud lying\n' + BODY);
  eq(errors(r), []);
  eq(r.program.decls.characters.mio.noblink, ['sleepy', 'proud', 'lying']);
  eq(Object.keys(r.program.decls.characters.mio.groups), ['expression', 'pose'], 'noblink is not an attribute group');
  // Before the groups it names, with commas, and repeated.
  const r2 = one(HEAD + '@character mio\n  noblink: sleepy, sleepy\n  blink: m/blink.png\n  expression: neutral sleepy\n' + BODY);
  eq(errors(r2), []);
  eq(r2.program.decls.characters.mio.noblink, ['sleepy']);
  // Inline form.
  const r3 = one(HEAD + '@character mio blink=m/b.png expression="neutral sleepy" noblink=sleepy\n' + BODY);
  eq(errors(r3), []);
  eq(r3.program.decls.characters.mio.noblink, ['sleepy']);
  // A character without noblink: has an empty list.
  eq(one(HEAD + SLEEPY + BODY).program.decls.characters.mio.noblink, []);
});
test('noblink: with a value the character does not have is E203 with a did-you-mean hint', () => {
  eq(diag(SLEEPY + '  noblink: sleepyy\n' + BODY), [['E203', '`noblink:`: `mio` has no attribute `sleepyy`.', 'Did you mean `sleepy`?']]);
  eq(diag(SLEEPY + '  noblink: sleepy zzz\n' + BODY), [['E203', '`noblink:`: `mio` has no attribute `zzz`.', 'mio\'s attributes: expression: neutral smile sleepy proud; pose: stand lying.']]);
  const r = one(HEAD + SLEEPY + '  noblink: sleepyy\n' + BODY);
  eq(errors(r)[0].line, 8, 'on the noblink line');
});
test('noblink: needs a blink: line (E303), and a character with no attributes gets a plain E203', () => {
  eq(diag('@character mio\n  sprite: m/{expression}.png\n  expression: neutral sleepy\n  noblink: sleepy\n' + BODY),
    [['E303', '`noblink:` only works with a `blink:` overlay, and `mio` has none.', 'Add a `blink:` line (e.g. `blink: chars/mio/blink.png`), or remove `noblink:`.']]);
  eq(diag('@character mio\n  blink: m/b.png\n  noblink: sleepy\n' + BODY),
    [['E203', '`noblink:`: `mio` has no attributes declared, so `sleepy` can\'t be used.', 'Add a line like `expression: neutral sleepy` under `@character mio`.']]);
  eq(diag('@character mio\n  blink: ""\n  expression: neutral sleepy\n  noblink: sleepy\n' + BODY).map(d => d[0]), ['E303'], 'an empty blink: is no blink');
});
test('a misspelt noblink is E302 with a hint, not a new attribute group', () => {
  eq(diag(SLEEPY + '  noblnk: sleepy\n' + BODY), [['E302', '`@character` has no property `noblnk`.', 'Did you mean `noblink`?']]);
});

// ---- 3. noblink: the stage skips the blink overlay -------------------------------
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
  getContext() { return fakeCtx([]); }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  get scrollHeight() { return 0; }
  get clientHeight() { return 0; }
}
// A 2D context that accepts any call and records drawImage.
function fakeCtx(drawn) {
  const t = { canvas: null, drawImage: (im) => drawn.push(im && im.path) };
  return new Proxy(t, { get: (o, k) => (k in o ? o[k] : () => ({ addColorStop() {} })), set: (o, k, v) => { o[k] = v; return true; } });
}
function withGlobals(vals, fn) {
  const saved = Object.keys(vals).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  for (const [k, v] of Object.entries(vals)) globalThis[k] = v;
  try { return fn(); }
  finally { for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } }
}
const domGlobals = () => ({
  document: {
    createElement: (t) => { const n = new FakeNode(t); if (t === 'canvas') { n.width = 0; n.height = 0; } return n; },
    createTextNode: (s) => { const n = new FakeNode('#text'); n._text = s; return n; },
  },
  setTimeout: () => 0, clearTimeout: () => {}, performance: { now: () => 0 },
  requestAnimationFrame: () => 1, cancelAnimationFrame: () => {},
  Image: class { set src(v) { this._src = v; } },
});

// Draw mio once mid-blink with these attrs; returns the image paths drawn.
function drawMio(program, attrs) {
  return withGlobals(domGlobals(), () => {
    const assets = new Assets((p) => p, program);
    const img = (p) => ({ width: 10, height: 20, path: p });
    assets.get = (p) => img(p);                       // every file is loaded
    assets.character = (c, a) => img('sprite');
    const stage = new Stage({ canvas: new FakeNode('canvas'), program, assets, settings: {}, resolveUrl: (p) => p, loadModule: null });
    stage.showActor({ kind: 'character', id: 'mio', attrs, x: 0.5, y: 0 }, true, 'none', 0);
    const v = stage.actors.get('mio');
    v.blinkUntil = stage.t + 1;                       // in the middle of a blink
    const drawn = [];
    stage.drawActor(fakeCtx(drawn), v);
    return drawn;
  });
}
test('the blink overlay is not drawn while a noblink: value is current', () => {
  const program = prog(SLEEPY + '  noblink: sleepy proud lying\n' + BODY);
  eq(drawMio(program, { expression: 'neutral', pose: 'stand' }), ['sprite', 'm/blink_stand.png'], 'eyes open: blink drawn');
  eq(drawMio(program, { expression: 'sleepy', pose: 'stand' }), ['sprite'], 'sleepy: no blink');
  eq(drawMio(program, { expression: 'proud', pose: 'stand' }), ['sprite'], 'proud: no blink');
  eq(drawMio(program, { expression: 'smile', pose: 'lying' }), ['sprite'], 'a value of a group the blink template does not use');
  const plain = prog(SLEEPY + BODY);
  eq(drawMio(plain, { expression: 'sleepy', pose: 'stand' }), ['sprite', 'm/blink_stand.png'], 'without noblink: the blink is drawn');
});
test('noblink: also covers default values and programs read back from JSON', () => {
  const program = prog('@character mio\n  sprite: m/{expression}.png\n  blink: m/blink.png\n  expression: sleepy neutral\n  noblink: sleepy\n' + BODY);
  eq(drawMio(program, {}), ['sprite'], 'the default expression is sleepy');
  eq(drawMio(J(program), { expression: 'neutral' }), ['sprite', 'm/blink.png']);
  eq(drawMio(J(program), { expression: 'sleepy' }), ['sprite']);
});
test('a noblink: look does not preload the blink overlay', () => withGlobals(domGlobals(), () => {
  const program = prog(SLEEPY + '  noblink: sleepy\n' + BODY);
  const assets = new Assets((p) => p, program);
  const loaded = [];
  assets.load = (p) => { loaded.push(p); return Promise.resolve(null); };
  const mio = program.decls.characters.mio;
  assets.loadCharacter(mio, { expression: 'sleepy' });
  eq(loaded, ['m/stand_sleepy.png']);
  loaded.length = 0;
  assets.loadCharacter(mio, { expression: 'smile' });
  eq(loaded, ['m/stand_smile.png', 'm/blink_stand.png']);
}));

// ---- 4. the POV name on NVL narration --------------------------------------------
const CAST = '@character mio name=Mio color=#f68\n@character rin name=Rin color=#8af\n\n';
const NVL = CAST + '# a\n@mode nvl\nPlain narration.\n@pov rin\nRin one.\nRin two.\nmio: Hello.\nRin three.\n@pov mio\nMio one.\n@rename mio "???"\nMio two.\n@pov none\nAfter.\n-> END\n';
// What each paragraph of the page shows: its kind and the POV name label, if any.
const labels = (ui) => ui.nvlPage.children.map(p => {
  const kind = p.classes.has('sh-nvl-pov') ? 'pov' : p.classes.has('sh-nvl-dialogue') ? 'dialogue' : 'narration';
  const n = p.children.find(c => c.classes.has('sh-nvl-povname'));
  return n ? [kind, n.textContent] : [kind];
});
const FULL = [['narration'], ['pov', 'Rin'], ['pov'], ['dialogue'], ['pov', 'Rin'], ['pov', 'Mio'], ['pov', '???'], ['narration']];
const newUI = () => new TextUI(new FakeNode('div'), { program: { header: {} }, sidePortrait: () => null });
// Play every line into the UI as the player does; stop after the line `stop`.
function playInto(ui, vm, r, stop, lives) {
  for (let i = 0; i < 200; i++) {
    for (const e of r.effects || []) {
      if (e.type === 'text') ui.applyText(e);
      if (e.type === 'restore') ui.sync(e.text);
    }
    const h = r.halt;
    if (h.type === 'end') return r;
    if (h.type === 'say') {
      ui.say(h, { cps: 0 });
      if (lives) lives.push(ui.live.textContent);
      if (h.plain === stop) return r;
    }
    r = vm.advance();
  }
  throw new Error('runaway');
}

test('NVL: the first paragraph of each POV run shows the POV name, after @rename too', () => withGlobals(domGlobals(), () => {
  const vm = new VM(prog(NVL), { seed: 1 });
  const ui = newUI();
  playInto(ui, vm, vm.start(), 'After.');
  eq(labels(ui), FULL);
  const rin = ui.nvlPage.children[1];
  eq([rin.style['--pov'], rin.children.slice(0, 2).map(c => c.className), rin.children[0].textContent], ['#8af', ['sh-nvl-povname', 'sh-nvl-text'], 'Rin']);
}));
test('NVL: a loaded save shows the same POV names, and the next line continues the run', () => withGlobals(domGlobals(), () => {
  for (const [stop, upto] of [['Rin two.', 3], ['Rin three.', 5], ['Mio two.', 7], ['After.', 8]]) {
    const vm = new VM(prog(NVL), { seed: 1 });
    until(vm, vm.start(), stop);
    const v = new VM(prog(NVL), { seed: 1 });
    const ui = newUI();
    playInto(ui, v, v.load(J(vm.save())), stop);
    eq(labels(ui), FULL.slice(0, upto), 'load at ' + stop);
  }
}));
test('NVL: rollback and rollforward rebuild the page with the same POV names', () => withGlobals(domGlobals(), () => {
  const vm = new VM(prog(NVL), { seed: 1 });
  const ui = newUI();
  playInto(ui, vm, vm.start(), 'After.');
  playInto(ui, vm, vm.rollback(), 'Mio two.');
  eq(labels(ui), FULL.slice(0, 7), 'back to Mio two.');
  playInto(ui, vm, vm.rollback(), 'Mio one.');
  playInto(ui, vm, vm.rollback(), 'Rin three.');
  playInto(ui, vm, vm.rollback(), 'Hello.');
  playInto(ui, vm, vm.rollback(), 'Rin two.');
  eq(labels(ui), FULL.slice(0, 3), 'back to Rin two.');
  playInto(ui, vm, vm.rollforward(), 'Hello.');
  playInto(ui, vm, vm.rollforward(), 'Rin three.');
  eq(labels(ui), FULL.slice(0, 5), 'forward to Rin three.');
}));
test('NVL: after a page turn the POV name is shown again, live and restored', () => withGlobals(domGlobals(), () => {
  const text = CAST + '# a\n@mode nvl\n@pov rin\nL1.\nL2.\nL3.\nL4.\nL5.\nL6.\nL7.\n-> END\n';
  // A page holds three paragraphs.
  const small = (ui) => { Object.defineProperty(ui.nvlPage, 'scrollHeight', { get: () => ui.nvlPage.children.length * 100 }); Object.defineProperty(ui.nvlPage, 'clientHeight', { get: () => 350 }); return ui; };
  const vm = new VM(prog(text), { seed: 1 });
  const ui = small(newUI());
  const lives = [];
  playInto(ui, vm, vm.start(), 'L4.', lives);
  eq(labels(ui), [['pov', 'Rin']], 'L4 starts a new page');
  eq(lives, ['(Rin) L1.', 'L2.', 'L3.', '(Rin) L4.'], 'screen readers hear the name where it is shown');
  playInto(ui, vm, vm.advance(), 'L6.');
  eq(labels(ui), [['pov', 'Rin'], ['pov'], ['pov']]);
  const v = new VM(prog(text), { seed: 1 });
  const ui2 = small(newUI());
  playInto(ui2, v, v.load(J(vm.save())), 'L6.');
  eq(labels(ui2), [['pov', 'Rin'], ['pov'], ['pov']], 'restored page');
  playInto(ui2, v, v.advance(), 'L7.');
  eq(labels(ui2), [['pov', 'Rin']], 'the next page');
}));
test('the live region names the POV: on every ADV line, on the first paragraph of an NVL run', () => withGlobals(domGlobals(), () => {
  const vm = new VM(prog(NVL), { seed: 1 });
  const lives = [];
  playInto(newUI(), vm, vm.start(), 'After.', lives);
  eq(lives, ['Plain narration.', '(Rin) Rin one.', 'Rin two.', 'Mio: Hello.', '(Rin) Rin three.', '(Mio) Mio one.', '(???) Mio two.', 'After.']);
  const adv = new VM(prog(NVL.replace('@mode nvl\n', '')), { seed: 1 });
  const ui = newUI();
  const advLives = [];
  const povs = [];
  let r = adv.start();
  while (r.halt.type !== 'end') {
    if (r.halt.type === 'say') { ui.say(r.halt, { cps: 0 }); advLives.push(ui.live.textContent); povs.push(ui.pov.classes.has('on') ? ui.pov.textContent : null); }
    r = adv.advance();
  }
  eq(advLives, ['Plain narration.', '(Rin) Rin one.', '(Rin) Rin two.', 'Mio: Hello.', '(Rin) Rin three.', '(Mio) Mio one.', '(???) Mio two.', 'After.']);
  eq(povs, [null, 'Rin', 'Rin', null, 'Rin', 'Mio', '???', null], 'the ADV label shows the same names');
}));
