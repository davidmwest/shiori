// Compiler suite: regression tests for the compiler, the registry and the
// built-in command modules (declare, story, stage, audio, media).
import { test, eq, ok, one, many, codes, errors, playThrough } from './harness.js';
import { VM, compileProject, loadSources, defaultRegistry } from '../engine/core/index.js';
import { canonPath } from '../engine/core/compiler.js';

const H = 'SHIORI 1\ntitle: T\n';
const diag = (r, code) => r.diagnostics.filter(d => d.code === code);
const lineOf = (r, code) => diag(r, code).map(d => d.line);

// Advance a fresh VM until a line with this text is on screen.
function runTo(program, text, opts = {}) {
  const vm = new VM(program, { seed: 1, persistent: opts.persistent });
  let r = vm.start();
  const effects = [...r.effects];
  for (let g = 0; g < 500; g++) {
    if (r.halt.type === 'say' && r.halt.plain === text) return { vm, r, effects };
    if (r.halt.type === 'end' || r.halt.type === 'error') throw new Error(`never reached "${text}" (${r.halt.type})`);
    r = r.halt.type === 'menu' ? vm.choose(0) : vm.advance();
    effects.push(...r.effects);
  }
  throw new Error('runaway');
}

// ---- top level: only declarations before the first scene -------------------
test('non-declaration commands before the first scene are E103, unknown ones E300', () => {
  const r = many({
    'game.story': H + 'include: story/two.story\n@image harbor bg/h.svg\n@imgae lantern p/l.svg\n@audio theme m/t.ogg\n@var trust = 0\n@video op movies/op.webm\n' +
      '@scene harbor\n@music theme\n@set trust = 5\n@bogus 1 2\n@video op\n# start\n@scene harbor\n@music theme\n@video op\nTrust {$trust}.\n@set trust += 1\n-> second\n',
    'story/two.story': 'SHIORI 1\n@jump start\n@sound theme\n# second\nBye.\n-> END\n',
  });
  const e103 = diag(r, 'E103').map(d => d.file + ':' + d.line).sort();
  eq(e103, ['game.story:10', 'game.story:11', 'game.story:13', 'game.story:9', 'story/two.story:2', 'story/two.story:3']);
  ok(/must be inside a scene/.test(diag(r, 'E103')[0].message), 'E103 message');
  const e300 = diag(r, 'E300');
  eq(e300.map(d => d.line), [5, 12]);
  ok(/@image/.test(e300[0].hint), 'did you mean @image: ' + e300[0].hint);
  // The declarations at the top still apply.
  ok(r.program.decls.assets.harbor && r.program.decls.vars.trust && r.program.decls.assets.op, 'declarations kept');
});
test('@note may stand before the first scene and is kept in program.notes', () => {
  const r = one(H + '@note "TODO: name the cat"\n@var x = 0\n# s\n@note "TODO: rewrite after chapter 3"\nHi {$x}.\n-> END\n');
  eq(errors(r).length, 0, codes(r).join(','));
  eq(r.program.notes.map(n => [n.text, n.loc.file, n.loc.line]), [['TODO: name the cat', 'game.story', 3], ['TODO: rewrite after chapter 3', 'game.story', 6]]);
  eq(r.program.notes[1].scene, 's');
});

// ---- @assert ------------------------------------------------------------------
test('@assert keeps a condition that ends in a string literal', () => {
  const r = one(H + '@var route = "rin"\n@var mood = "calm"\n# s\n@assert route == "rin"\n@assert mood != "angry"\n@assert route == "rin" or mood == "calm"\n@assert route == "rin" "only Rin\'s route"\n@assert route != "" "route must be set"\nDone.\n-> END\n');
  eq(errors(r).length, 0, r.diagnostics.map(d => d.code + ' ' + d.message).join(' | '));
  const asserts = r.program.code.filter(i => i.op === 'assert');
  eq(asserts.map(a => a.message), [null, null, null, "only Rin's route", 'route must be set']);
  eq(asserts[0].src, 'route == "rin"');
  const p = playThrough(r.program, []);
  eq([p.stop, p.lines], ['end', ['Done.']]);
});
test('@assert with a plain condition and a message still splits', () => {
  const r = one(H + '@var ok_ = true\n@var trust = 0\n# s\n@assert ok_ "must be ok"\n@assert trust >= 0 "trust went negative"\nX.\n-> END\n');
  eq(errors(r).length, 0);
  eq(r.program.code.filter(i => i.op === 'assert').map(a => [a.src, a.message]), [['ok_', 'must be ok'], ['trust >= 0', 'trust went negative']]);
});

// ---- menus that can be skipped (R704) ------------------------------------------
test('a skipped menu ending an @if branch continues after the whole @if', () => {
  const r = one(H + '@var key = false\n# start\n@if true\n  * [if key] Open the door. -> door\n@else\n  ELSE BRANCH\nAfter the if.\n-> END\n# door\nDoor.\n-> END\n');
  eq(playThrough(r.program, []).lines, ['After the if.']);
});
test('a skipped menu ending an option body does not run the next option', () => {
  const r = one(H + '@var key = false\n# start\n* Go upstairs.\n  Upstairs.\n  * [if key] Unlock the attic. -> attic\n* Go downstairs.\n  DOWNSTAIRS\nAfter the menu.\n-> END\n# attic\nAttic.\n-> END\n');
  eq(playThrough(r.program, [1]).lines, ['Upstairs.', 'After the menu.']);
});
test('an all-[require] or used-up [once] menu skips the @elif/@else bodies', () => {
  const r = one(H + '@var a = 0\n# start\n@if a == 0\n  * [require a > 5] Locked. -> x\n@elif a == 0\n  ELIF\n@else\n  ELSE\nTail.\n-> END\n# x\nX.\n-> END\n');
  eq(playThrough(r.program, []).lines, ['Tail.']);
  const hub = one(H + '@var calm = true\n# hub\n@if calm\n  * [once] Ask A. -> hub\n  * [once] Ask B. -> hub\n@else\n  PANIC\nOut.\n-> END\n');
  eq(playThrough(hub.program, [1, 2]).lines, ['Out.']);
});
test('W603 when a file ends in a menu that can be skipped', () => {
  const r = one(H + '@var k = false\n# s\nHi.\n* [if k] Go. -> END\n');
  ok(codes(r).includes('W603'), codes(r).join(','));
  const r2 = one(H + '@var k = false\n# s\nHi.\n* [if k] Go. -> END\n* Stay. -> END\n');
  ok(!codes(r2).includes('W603'), codes(r2).join(','));
});

// ---- stable choice ids -----------------------------------------------------------
const HUB = (above) => H + '@var n = 0\n# intro\nHello.\n' + above + '-> hub\n# hub\nThe keeper waits.\n* [once] Ask about the lighthouse.\n  @set n += 1\n  -> hub\n* Leave. -> END\n';
test('choice ids do not depend on line numbers or edits above the menu', () => {
  const ids = (r) => r.program.code.filter(i => i.op === 'menu').flatMap(m => m.options.map(o => o.id));
  const a = ids(one(HUB(''))), b = ids(one(HUB('A new line.\n// a comment\n')));
  eq(b, a);
  ok(a.every(id => /^hub:c[0-9a-z]+$/.test(id)), a.join(','));
});
test('an old save keeps [once] and seen state after an edit above the menu', () => {
  const v1 = one(HUB('')).program;
  const vm = new VM(v1, { seed: 1 });
  let r = vm.start(); r = vm.advance(); r = vm.advance();
  eq(r.halt.type, 'menu');
  r = vm.choose(0); // Ask about the lighthouse (once) -> back to the hub
  while (r.halt.type !== 'menu') r = vm.advance();
  const save = vm.save();
  const v2 = one(HUB('Inserted line.\n')).program;
  const vm2 = new VM(v2, { seed: 1, persistent: vm.persistent });
  let res = vm2.load(save);
  for (let g = 0; g < 20 && res.halt.type !== 'menu'; g++) res = vm2.advance();
  eq(res.halt.options.map(o => [o.plain, o.seen]), [['Leave.', false]]);
  // The edited program's hub still knows which option was picked before.
  const hubMenu = v2.code.find(i => i.op === 'menu');
  ok(vm2.persistent.chosen[hubMenu.options[0].id], 'seen mark kept');
});
test('identical options in one scene get distinct ids; reordering keeps ids', () => {
  const r = one(H + '# s\n* Yes.\n* No.\nMid.\n* Yes.\n* No.\nEnd.\n-> END\n');
  const ids = r.program.code.filter(i => i.op === 'menu').flatMap(m => m.options.map(o => o.id));
  eq(new Set(ids).size, 4);
  const swapped = one(H + '# s\n* No.\n* Yes.\nMid.\n* Yes.\n* No.\nEnd.\n-> END\n');
  const ids2 = swapped.program.code.filter(i => i.op === 'menu')[0].options.map(o => o.id);
  eq(ids2, [ids[1], ids[0]]);
});

// ---- line ids --------------------------------------------------------------------
test('a repeated line and a line ending in "#2" get different ids', () => {
  const r = one(H + '# start\nRoom\nRoom#2\nRoom\nX.\n-> END\n');
  const ids = r.program.code.filter(i => i.op === 'say').map(i => i.id);
  eq(new Set(ids).size, 4, ids.join(','));
  eq(Object.keys(r.program.lines).length, 4);
  eq(ids[2], ids[0] + '.2');
});

// ---- positions ----------------------------------------------------------------------
const POS = H + '@character mio sprite=m.svg\n@position crouch x=0.5 y=0.3 scale=0.6\n@position far x=0.5 y=-0.1 scale=0.7\n@position near x=0.5 y=0.15 scale=1.4\n@position doorway x=0.82 scale=0.8\n';
test('@show at= a built-in name or number never picks up a @position by x', () => {
  const r = one(POS + '# s\n@show mio at=center\nA.\n@hide mio\n@show mio at=0.5\nB.\n-> END\n');
  eq(errors(r).length, 0);
  let { vm } = runTo(r.program, 'A.');
  const pick = (vm) => { const a = vm.state.stage.actors[0]; return [a.x, a.y, a.scale]; };
  eq(pick(vm), [0.5, 0, 1]);
  vm = runTo(r.program, 'B.').vm;
  eq(pick(vm), [0.5, 0, 1]);
});
test('@show/@move at= a @position apply that position by name', () => {
  const r = one(POS + '# s\n@show mio at=far\nA.\n@show mio at=near\nB.\n@move mio at=doorway time=0\nC.\n@move mio at=far scale=2 time=0\nD.\n-> END\n');
  eq(errors(r).length, 0);
  const show = r.program.code.find(i => i.op === 'cmd' && i.name === 'show');
  eq(show.args.atName, 'far');
  const at = (t) => { const a = runTo(r.program, t).vm.state.stage.actors[0]; return [a.x, a.y, a.scale]; };
  eq(at('A.'), [0.5, -0.1, 0.7]);
  eq(at('B.'), [0.5, 0.15, 1.4]);
  eq(at('C.'), [0.82, 0, 0.8]);
  eq(at('D.'), [0.5, -0.1, 2]);
});
test('@position: duplicates and built-in names are E204', () => {
  const r = one(H + '@character mio sprite=m.svg\n@position door x=0.8\n@position door x=0.9\n@position left x=0.05\n# s\n@show mio at=door\nHi.\n-> END\n');
  eq(lineOf(r, 'E204'), [5, 6]);
  ok(/already declared \(at game\.story:4\)/.test(diag(r, 'E204')[0].message));
  ok(/built-in position/.test(diag(r, 'E204')[1].message));
  eq(runTo(r.program, 'Hi.').vm.state.stage.actors[0].x, 0.8);
});

// ---- assets, colors, header ------------------------------------------------------------
test('a declared image named like a color is the image', () => {
  const r = one(H + '@image orange bg/orange.png\n@image blue bg/blue.png\n# s\n@scene orange\n@bg blue\n@bg red\nHi.\n-> END\n');
  eq(codes(r).filter(c => c !== 'W602'), []);
  const bgs = r.program.code.filter(i => i.op === 'cmd' && (i.name === 'scene' || i.name === 'bg')).map(i => i.args.kind);
  eq(bgs, ['image', 'image', 'color']);
});
test('title_background:/title_music: need the right kind of asset', () => {
  const bad = one('SHIORI 1\ntitle: T\ntitle_background: theme\ntitle_music: harbor\n@image harbor bg/h.png\n@audio theme m/t.ogg\n# s\nHi.\n-> END\n');
  eq(lineOf(bad, 'E205'), [3, 4]);
  ok(/needs an image or a world, but `theme` is an audio/.test(diag(bad, 'E205')[0].message), diag(bad, 'E205')[0].message);
  const good = one('SHIORI 1\ntitle: T\ntitle_background: harbor\ntitle_music: theme\n@image harbor bg/h.png\n@audio theme m/t.ogg\n# s\nHi.\n-> END\n');
  eq(codes(good), []);
  const unknown = one('SHIORI 1\ntitle: T\ntitle_music: thme\n@audio theme m/t.ogg\n# s\nHi.\n@music theme\n-> END\n');
  eq(lineOf(unknown, 'E202'), [3]);
  ok(/theme/.test(diag(unknown, 'E202')[0].hint));
});
test('a module argument of type `asset` accepts a character id', () => {
  const mod = { name: 'fx', commands: [{ name: 'spotlight', positional: [{ name: 'who', type: 'asset', required: true }], syntax: '@spotlight <who>', exec() {} }] };
  const src = H + '@character mio sprite=m.svg\n@image lamp p/l.png\n# s\n@spotlight mio\n@spotlight lamp\n@spotlight nobody\nHi.\n-> END\n';
  const r = compileProject({ entry: 'game.story', files: { 'game.story': src }, order: ['game.story'], missing: [] }, { registry: defaultRegistry([mod]) });
  eq(lineOf(r, 'E202'), [8]);
  eq(r.program.code.filter(i => i.name === 'spotlight').map(i => i.args.who), ['mio', 'lamp']);
});
test('@tint takes a color or none', () => {
  const r = one(H + '# s\n@tint sepia\n@tint nonee\n@tint #12345z\n@tint #ff8844 alpha=0.2\n@tint orange\n@tint none\nHi.\n-> END\n');
  eq(lineOf(r, 'E303'), [4, 5, 6]);
  ok(/@filter sepia/.test(diag(r, 'E303')[0].hint), 'filter hint');
  ok(/none/.test(diag(r, 'E303')[1].hint), 'none hint');
});

// ---- @set and @var ------------------------------------------------------------------------
test('compound assignments check the value type', () => {
  const r = one(H + '@var trust = 0\n@var name = "A"\n@var met = false\n# s\n@set trust += "one"\n@set trust *= met\n@set trust -= name\n@set trust += 2\n@set name += 1\n@set name += "b"\n{$trust} {$name} {$met}\n-> END\n');
  eq(lineOf(r, 'E403'), [7, 8, 9]);
  ok(/`\+=` on the number variable `trust` needs a number, but this is a string/.test(diag(r, 'E403')[0].message), diag(r, 'E403')[0].message);
});
test('W612 is not silenced by a variable reading itself in its own @set', () => {
  const r = one(H + '@var trust = 0\n@var bonus = 1\n@var other = 0\n# s\n@set trust = trust + bonus\n@set other = other + 1\nThe end {$other}.\n-> END\n');
  eq(diag(r, 'W612').map(d => d.message.match(/`(\w+)`/)[1]), ['trust']);
});
test('errors inside an @set or @var value point into the value', () => {
  const col = (src, code) => { const d = diag(one(H + '@var trust = 0\n' + src + '\n# s\n{$trust}\n-> END\n'), code)[0]; return d && d.col; };
  const set = (line, code) => { const d = diag(one(H + '@var trust = 0\n# s\n' + line + '\n{$trust}\n-> END\n'), code)[0]; return d && d.col; };
  eq(set('@set trust = trust +', 'E400'), 21);
  eq(set('@set trust = 1 + )', 'E400'), 18);
  eq(set('@set trust = 1 = 2', 'E401'), 16);
  eq(set('@set trust = t', 'E201'), 14);
  eq(col('@var bonus = 1 +', 'E400'), 17);
});

// ---- hints for common slips -----------------------------------------------------------------
test('E201/E400 hints for functions without (), True, and unquoted ids', () => {
  const first = (cond) => { const r = one(H + '@var met = false\n@var trust = 0\n# harbor\n@if ' + cond + '\n  Yes.\n@ending true_end "T"\n-> END\n'); return errors(r).map(d => [d.code, d.hint]); };
  let e = first('endings_seen > 0');
  eq(e.length, 1); ok(/endings_seen\(\)/.test(e[0][1]) && !/@var/.test(e[0][1]), e[0][1]);
  e = first('visited > 0'); ok(/visited\("/.test(e[0][1]), e[0][1]);
  e = first('met == True'); eq(e[0][0], 'E201'); ok(/`true`/.test(e[0][1]), e[0][1]);
  e = first('ending_seen(true_end)'); eq(e.map(x => x[0]), ['E400']); ok(/ending_seen\("true_end"\)/.test(e[0][1]), e[0][1]);
  e = first('visited(harbor) > 0'); eq(e.map(x => x[0]), ['E400']); ok(/visited\("harbor"\)/.test(e[0][1]), e[0][1]);
});
test('`-> end` and `@jump End` are told to write END', () => {
  const r = one(H + '# start\n* Go. -> end\nHi.\n-> End\n# ending\n@jump end\n');
  const e = diag(r, 'E200');
  eq(e.length, 3);
  ok(e.every(d => /-> END/.test(d.hint)), e.map(d => d.hint).join(' | '));
});

// ---- @character property typos ---------------------------------------------------------------
test('misspelled @character properties are E302, real groups stay groups', () => {
  const r = one(H + '@character mio\n  nmae: Mio Tanaka\n  descripton: The quiet daughter of the keeper\n  colour: #fff\n  pose: stand sit\n  size: small big\n  sprite: m/{pose}_{size}.png\n# s\nmio (sit big): Hello.\n-> END\n');
  eq(diag(r, 'E302').map(d => [d.line, d.hint]), [[4, 'Did you mean `name`?'], [5, 'Did you mean `description`?'], [6, 'Did you mean `color`?']]);
  const c = r.program.decls.characters.mio;
  eq(Object.keys(c.groups), ['pose', 'size']);
  eq(errors(r).length, 3);
});

// ---- endings ---------------------------------------------------------------------------------
test('@ending: a conflicting title or kind is E204; a bare @ending refers back', () => {
  const r = one(H + '# s\n* A.\n  @ending home "Home" kind=good\n  -> END\n* B.\n  @ending home kind=bad\n  -> END\n* C.\n  @ending home "Back Home"\n  -> END\n* D.\n  @ending home\n  -> END\n');
  eq(lineOf(r, 'E204'), [8, 11]);
  ok(!codes(r).includes('W604'));
  const ok2 = one(H + '# s\n* A.\n  @ending home "Home" kind=good\n  -> END\n* B.\n  @ending home\n  -> END\n');
  eq(errors(ok2).length, 0);
  const p = playThrough(ok2.program, [2]);
  eq([p.vm.persistent.endings.home.title, p.vm.persistent.endings.home.kind], ['Home', 'good']);
  // A later site may give the title the first one left out.
  const late = one(H + '# s\n* A.\n  @ending home\n  -> END\n* B.\n  @ending home "Home" kind=true\n  -> END\n');
  eq(errors(late).length, 0);
  eq([late.program.decls.endings.home.title, late.program.decls.endings.home.kind], ['Home', 'true']);
  const p2 = playThrough(late.program, [1]);
  eq(p2.vm.persistent.endings.home.kind, 'true');
});

// ---- includes ----------------------------------------------------------------------------------
test('include paths are canonical: no W605 for ./story/ch1.story', () => {
  eq([canonPath('./story/ch1.story'), canonPath('story//ch1.story'), canonPath('story/x/../ch1.story'), canonPath('../up.story')], ['story/ch1.story', 'story/ch1.story', 'story/ch1.story', '../up.story']);
  const files = { 'game.story': H + 'include: ./story/ch1.story\n# start\nHello.\n-> next\n', 'story/ch1.story': 'SHIORI 1\n# next\nThe end.\n-> END\n' };
  const r = compileProject({ entry: 'game.story', files: { 'game.story': files['game.story'], './story/ch1.story': files['story/ch1.story'] }, order: ['game.story', './story/ch1.story'], missing: [], listing: ['game.story', 'story/ch1.story', 'story/extra.story'] });
  eq(diag(r, 'W605').map(d => d.message.match(/`([^`]+)`/)[1]), ['story/extra.story']);
});
const SRC = { 'game.story': H + 'include: ./story/ch1.story story//ch1.story\n# start\nHi.\n-> next\n', 'story/ch1.story': 'SHIORI 1\n# next\nBye.\n-> END\n' };
const loaded = await loadSources((p) => SRC[p] ?? null);
test('loadSources reads each included file once, under its canonical path', () => {
  ok(loaded, 'loaded');
  eq(loaded.order, ['game.story', 'story/ch1.story']);
  eq(loaded.missing, []);
  eq(errors(compileProject(loaded)).length, 0);
});

// ---- names that exist on Object.prototype -------------------------------------------------------
test('names like constructor / toString / __proto__ are ordinary names', () => {
  const r = one(H + '@var constructor = 0\n@var toString = 1\n@character valueOf sprite=v.svg expression="neutral"\n@character mio sprite=m.svg\n# s\n@show valueOf\n@show mio\nmio: {$constructor} {$toString}\n-> hasOwnProperty\n# hasOwnProperty\nThere.\n-> END\n');
  eq(errors(r).length, 0, r.diagnostics.map(d => d.code + ' ' + d.message).join(' | '));
  eq(playThrough(r.program, []).lines, ['Mio: 0 1', 'There.']);
  const proto = one(H + '@var __proto__ = 2\n# s\n{$__proto__}\n-> END\n');
  eq(errors(proto).length, 0);
  ok(Object.keys(proto.program.decls.vars).includes('__proto__') && proto.program.decls.vars.__proto__.init === 2, '__proto__ is a variable');
});
test('undeclared prototype names are reported, never accepted or crashing', () => {
  const r = one(H + 'constructor: x\n@character mio sprite=m.svg expression="neutral"\n# s\nmio (toString): Hi {$constructor}.\n@if toString() > 0\n  X.\n@show mio at=constructor with=constructor\n@show mio constructor=1\n-> constructor\n');
  const c = codes(r);
  for (const want of ['W604', 'E203', 'E201', 'E206', 'E303', 'E302', 'E200']) ok(c.includes(want), `missing ${want} in ${c.join(',')}`);
});

// ---- worlds and camera ----------------------------------------------------------------------------
test('@world camera= must be one of its marks', () => {
  const r = one(H + '@world cove w/cove.js marks="door lamp cliff" camera=clif\n@world open w/o.js camera=anything\n# s\n@scene cove\nHi.\n@scene open\n-> END\n');
  eq(lineOf(r, 'E303'), [3]);
  eq(diag(r, 'E303')[0].hint, 'Did you mean `cliff`?');
});
test('@bg into a world starts at its camera= mark; @camera reset returns there', () => {
  const r = one(H + '@world cove w/cove.js marks="cliff shore" camera=cliff\n@world town w/town.js marks="gate well" camera=gate\n@image street bg/s.svg\n# a\n@scene cove with=none\n@camera from=shore time=0\nOne.\n@camera reset time=0\nTwo.\n@bg town with=none\nThree.\n@bg street with=none\nFour.\n@scene street with=none\n@camera zoom=1.3 time=0\n@bg street with=none\nFive.\n@bg cove with=none\nSix.\n-> END\n');
  eq(errors(r).length, 0);
  const cam = (t) => runTo(r.program, t).vm.state.stage.camera;
  eq(cam('One.').from, 'shore');
  eq(cam('Two.').from, 'cliff');
  eq(cam('Three.').from, 'gate');
  eq([cam('Four.').from, cam('Four.').zoom], [null, 1]);
  eq(cam('Five.').zoom, 1.3, '2D -> 2D keeps the camera');
  eq(cam('Six.').from, 'cliff');
  const fx = runTo(r.program, 'Four.').effects.filter(e => e.type === 'stage' && e.op === 'camera');
  ok(fx.length >= 3 && fx[fx.length - 1].camera.from === null, 'leaving the world resets the 2D camera');
});

// ---- audio ----------------------------------------------------------------------------------------
test('@music on the playing track applies written volume=, keeps a bare restatement', () => {
  const r = one(H + '@audio theme m/t.ogg\n# s\n@music theme\nOne.\n@music theme volume=0.3 fade=2\nTwo.\n@music theme\nThree.\n-> END\n');
  eq(errors(r).length, 0);
  const two = runTo(r.program, 'Two.');
  eq(two.vm.state.audio.music.volume, 0.3);
  const music = two.effects.filter(e => e.type === 'audio' && e.op === 'music');
  eq(music.length, 2);
  eq([music[1].music.volume, music[1].fade, music[1].same], [0.3, 2, true]);
  const three = runTo(r.program, 'Three.');
  eq(three.vm.state.audio.music.volume, 0.3);
  eq(three.effects.filter(e => e.type === 'audio' && e.op === 'music').length, 2);
});
