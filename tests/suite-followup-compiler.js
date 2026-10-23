// Follow-up compiler suite: the cross-area items from the review-fix round
// (registry in parseFile, BOM, E114 ids, dead code W622, W623, help texts).
import { test, eq, ok, one, many, codes, errors, loadDir } from './harness.js';
import { compileProject, prepareProject, loadSources, defaultRegistry, CODES } from '../engine/core/index.js';
import { CODE_HELP } from '../engine/core/diagnostics.js';

const H = 'SHIORI 1\ntitle: T\n';
const diag = (r, code) => r.diagnostics.filter(d => d.code === code);
const lineOf = (r, code) => diag(r, code).map(d => d.line);
const only = (files, opts) => compileProject({ entry: 'game.story', files, order: Object.keys(files), missing: [] }, opts);

// ---- module commands with props: true keep their property block -------------------
const sparkle = {
  name: 'fx',
  commands: [{
    name: 'sparkle', props: true, syntax: '@sparkle [color=white]',
    named: { color: { type: 'string', default: 'white' }, amount: { type: 'number', default: 1 } },
    compile(cmd, ctx, args) { return { op: 'cmd', name: 'sparkle', args: { ...args.named } }; },
    exec() {},
  }],
};
const SPARKLE_SRC = H + 'modules: mods/sparkle.js\n# s\n@sparkle\n  color: red\n  amount: 3\nHi.\n-> END\n';
test('compileProject parses a module command\'s property block with its registry', () => {
  const r = only({ 'game.story': SPARKLE_SRC }, { registry: defaultRegistry([sparkle]) });
  eq(codes(r).filter(c => c !== 'W604'), [], r.diagnostics.map(d => d.code + ' ' + d.message).join(' | '));
  eq(r.program.code.filter(i => i.name === 'sparkle').map(i => [i.args.color, i.args.amount]), [['red', 3]]);
});
const prepared = await prepareProject({
  readText: (p) => p === 'game.story' ? SPARKLE_SRC : null,
  importModule: async () => ({ default: sparkle }),
});
test('prepareProject (loadSources + compile) keeps a module command\'s property block', () => {
  eq(errors(prepared).length, 0, prepared.diagnostics.map(d => d.code + ' ' + d.message).join(' | '));
  ok(!codes(prepared).includes('E102'), 'no E102');
  eq(prepared.program.code.filter(i => i.name === 'sparkle').map(i => i.args.color), ['red']);
});

// ---- a byte order mark is not part of the stored text -------------------------------
const BOM_SRC = { 'game.story': '﻿' + H + 'include: story/a.story\n# s\nHi.\n-> a\n', 'story/a.story': '﻿SHIORI 1\n# a\nBye.\n-> END\n' };
const withBom = await loadSources((p) => BOM_SRC[p] ?? null);
const noBom = await loadSources((p) => BOM_SRC[p] == null ? null : BOM_SRC[p].slice(1));
test('loadSources drops a leading BOM, so the program hash matches the browser\'s', () => {
  eq(withBom.order, ['game.story', 'story/a.story']);
  for (const p of withBom.order) ok(withBom.files[p].charCodeAt(0) !== 0xFEFF, 'BOM kept in ' + p);
  eq(withBom.files, noBom.files);
  eq(compileProject(withBom).program.hash, compileProject(noBom).program.hash);
  eq(errors(compileProject(withBom)).length, 0);
});
const withRegistry = await loadSources((p) => p === 'game.story' ? SPARKLE_SRC : null, 'game.story', { registry: defaultRegistry([sparkle]) });
test('loadSources still accepts (readText, entry) and an optional registry', () => {
  eq(withRegistry.order, ['game.story']);
  eq(withRegistry.missing, []);
});

// ---- E114: speakers that can't be ids get an ASCII id hint ----------------------------
const e114 = (r) => diag(r, 'E114').map(d => d.hint);
test('E114 for O\'Brien / Élodie / Jean-Luc suggests an ASCII id', () => {
  const r = one(H + '# s\nO\'Brien: Hi.\nÉlodie: Bonjour.\nJean-Luc: Salut.\nMoß: Moin.\n-> END\n');
  const [obrien, elodie, jean, moss] = e114(r);
  ok(obrien.includes('`@character obrien name="O\'Brien"`') && obrien.includes('`obrien: ...`'), obrien);
  ok(elodie.includes('`@character elodie name="Élodie"`'), elodie);
  ok(jean.includes('`@character jean_luc name="Jean-Luc"`'), jean);
  ok(moss.includes('`@character moss name="Moß"`'), moss);
  for (const h of e114(r)) ok(!/@character [^`]*['’É-][^`]* name/.test(h.replace(/name="[^"]*"/g, '')), 'invalid id in ' + h);
  ok(/"O'Brien": \.\.\./.test(obrien), 'one-off speaker form kept');
});
test('E114 for a name with no ASCII letters suggests a placeholder id', () => {
  const r = one(H + '@character c1 name="Ana"\n# s\nc1: Hi.\nМария: Привет.\n-> END\n');
  const [h] = e114(r);
  ok(h.includes('`@character c2 name="Мария"`') && h.includes('`c2: ...`'), h);
});
test('E114 points at the declared id when the ASCII spelling matches it', () => {
  const r = one(H + '@character elodie name="Elodie"\n# s\nelodie: Hi.\nÉlodie: Bonjour.\n-> END\n');
  ok(/write `elodie:`/.test(e114(r)[0]), e114(r)[0]);
});
test('E114 for a valid but undeclared id keeps the @character hint', () => {
  const r = one(H + '# s\nbob: Hi.\n-> END\n');
  ok(e114(r)[0].includes('`@character bob name="..."`'), e114(r)[0]);
});

// ---- program.scenes has no args -------------------------------------------------------
test('program.scenes entries carry no args field', () => {
  const r = one(H + '# s "Start"\nHi.\n-> END\n');
  eq(r.program.scenes.s, { id: 's', title: 'Start', file: 'game.story', line: 3, pc: 0 });
});

// ---- W622: code that can never run ---------------------------------------------------
test('W622 for a line after a jump, END, @jump or @return', () => {
  const r = one(H + '# s\nHi.\n-> t\nNever shown.\n# t\n@if true\n  -> END\n  Not this.\n@call u\nBye.\n@jump END\n@sound x\n# u\nIn u.\n@return\nAfter return.\n');
  eq(lineOf(r, 'W622'), [6, 10, 14, 18]);
  ok(/comes after `-> t`/.test(diag(r, 'W622')[0].message), diag(r, 'W622')[0].message);
  ok(/comes after `@return`/.test(diag(r, 'W622')[3].message));
});
test('W622 does not count declarations and @note after a jump', () => {
  const r = one(H + '# s\nHi {$x}.\n-> END\n@var x = 1\n@note Rewrite this scene later.\n@image lamp p/l.png\n# t\n@scene lamp\nT.\n-> END\n');
  ok(!codes(r).includes('W622'), codes(r).join(','));
});
test('W622 for an @ending after -> END says to move it up', () => {
  const r = one(H + '# s\nAlone.\n-> END\n@ending alone "Alone"\n');
  eq(lineOf(r, 'W622'), [6]);
  ok(/Put the `@ending` line above `-> END`/.test(diag(r, 'W622')[0].hint), diag(r, 'W622')[0].hint);
});
test('W622 after a menu or @if/@else whose every path jumps away', () => {
  const r = one(H + '@var a = 0\n# s\nPick.\n* One. -> t\n* Two.\n  -> t\nDead after menu.\n# t\n@if a > 1\n  -> END\n@else\n  -> s\nDead after if.\n');
  eq(lineOf(r, 'W622'), [9, 15]);
  ok(/every choice in the menu above jumps away/.test(diag(r, 'W622')[0].message));
  ok(/every branch of the `@if` above jumps away/.test(diag(r, 'W622')[1].message));
});
test('no W622 when a menu or @if can continue', () => {
  const r = one(H + '@var a = 0\n# s\n* One. -> t\n* Two.\nGathered.\n* [if a > 0] Three. -> t\n* [once] Four. -> t\nSkipped menu continues.\n@if a > 1\n  -> END\nNo else.\n@if a > 2\n  -> END\n@else\n  Stays.\nAfter.\n-> t\n# t\n-> END\n');
  ok(!codes(r).includes('W622'), r.diagnostics.filter(d => d.code === 'W622').map(d => d.line + ' ' + d.message).join(' | '));
});
test('W622 for a choice\'s -> target when its lines always jump first', () => {
  const r = one(H + '# s\n* Stay for supper. -> supper\n  Not tonight.\n  -> walk\n* Wait. -> supper\n  A moment.\n# supper\nWarm.\n-> END\n# walk\nDark.\n-> END\n');
  eq(lineOf(r, 'W622'), [4]);
  ok(/`-> supper` on this choice never runs/.test(diag(r, 'W622')[0].message), diag(r, 'W622')[0].message);
});
test('W622 for an @elif that repeats an earlier condition (not for random/chance)', () => {
  const r = one(H + '@var trust = 0\n# s\n@if trust >= 3\n  A.\n@elif trust>=3\n  B.\n@elif chance(0.5)\n  C.\n@elif chance(0.5)\n  D.\n@else\n  E.\n-> END\n');
  eq(lineOf(r, 'W622'), [7]);
  ok(/the `@if` at line 5 tests the same condition/.test(diag(r, 'W622')[0].message), diag(r, 'W622')[0].message);
});

// ---- W623: ordering comparisons with a true/false side ---------------------------------
test('W623 for (1 < x) < 5, with a range hint', () => {
  const r = one(H + '@var x = 0\n# s\n@if (1 < x) < 5\n  In range.\n-> END\n');
  eq(lineOf(r, 'W623'), [5]);
  const d = diag(r, 'W623')[0];
  ok(/`\(1 < x\) < 5` compares a true\/false value with `<`/.test(d.message), d.message);
  ok(d.hint.includes('`1 < x and x < 5`'), d.hint);
  eq(d.col, 5);
});
test('W623 for a true/false variable or function in [if], [require] and @set', () => {
  const r = one(H + '@var met = false\n@var ok = false\n@var x = 0\n# s\n@set ok = met > 0\n* [if ending_seen("e") >= 1] A. -> END\n* [require 5 > (x < 3)] B. -> END\n* C.\n@if ok and x <= 2\n  {$ok}\n@ending e\n-> END\n');
  eq(lineOf(r, 'W623'), [7, 8, 9]);
  ok(/`met` is true or false/.test(diag(r, 'W623')[0].hint), diag(r, 'W623')[0].hint);
});
test('no W623 for number comparisons or == on true/false values', () => {
  const r = one(H + '@var a = true\n@var b = false\n@var x = 0\n# s\n@if count(a, b) >= 2 and visited("s") > 0 and len("ab") < x\n  Yes.\n@if (1 < x) == a\n  Eq.\n-> END\n');
  ok(!codes(r).includes('W623'), codes(r).join(','));
});

// ---- @position takes a property block ---------------------------------------------------
test('@position is a props command and its block sets x/y/scale', () => {
  eq(defaultRegistry().get('position').props, true);
  const r = one(H + '@position doorway\n  x: 0.82\n  scale: 0.8\n@character mio sprite=m.svg\n# s\n@show mio at=doorway\nmio: Hi.\n-> END\n');
  eq(errors(r).length, 0, r.diagnostics.map(d => d.code + ' ' + d.message).join(' | '));
  eq([r.program.decls.positions.doorway.x, r.program.decls.positions.doorway.scale], [0.82, 0.8]);
});

// ---- missing game.story: E113 alone ------------------------------------------------------
test('no W605 flood when game.story itself is missing', () => {
  const r = compileProject({ entry: 'game.story', files: {}, order: [], missing: [{ path: 'game.story' }], listing: ['story/a.story', 'story/b.story'] });
  eq(codes(r), ['E113']);
});
test('E103 says @note may come before the first scene', () => {
  const r = one(H + '@show mio\n@note fine here\n# s\nHi.\n-> END\n');
  eq(lineOf(r, 'E103'), [3]);
  ok(/declarations and `@note`/.test(diag(r, 'E103')[0].message), diag(r, 'E103')[0].message);
});

// ---- codes and help texts ----------------------------------------------------------------
test('W622, W623 and R706 are documented codes', () => {
  eq([CODES.W622, CODES.W623, CODES.R706], ['Code after a jump never runs', 'Comparison with a true/false value', 'Unlock exploration was capped']);
  for (const c of ['W622', 'W623', 'R706']) ok(CODE_HELP[c] && CODE_HELP[c].length > 40, 'help for ' + c);
});
test('help texts cover the cases the fixes added', () => {
  ok(/U\+00A0/.test(CODE_HELP.E101) && /U\+3000/.test(CODE_HELP.E101), 'E101 non-ASCII spaces');
  ok(/`@note`/.test(CODE_HELP.E103), 'E103 @note');
  ok(/folder/.test(CODE_HELP.E113) && /game\.story/.test(CODE_HELP.E113), 'E113 folder / game.story');
  ok(/`@position`/.test(CODE_HELP.E204) && /ending/.test(CODE_HELP.E204), 'E204 namespaces');
  ok(/\{size=0\}/.test(CODE_HELP.E502) && /inside \{ruby\}/.test(CODE_HELP.E502), 'E502 value or place');
  ok(/story's flow/.test(CODE_HELP.W614) && /story's flow/.test(CODE_HELP.W616), 'W614/W616 flow');
  ok(/LMN notes/.test(CODE_HELP.W617) && /`LMN 1`/.test(CODE_HELP.W617), 'W617 notes');
});

// ---- the examples stay clean --------------------------------------------------------------
const lk = await loadDir('examples/lantern-keeper');
const tt = await loadDir('examples/terrible-things');
test('the examples have no W622 / W623 and no errors', () => {
  for (const r of [lk, tt]) {
    eq(errors(r).length, 0);
    eq(codes(r).filter(c => c === 'W622' || c === 'W623'), []);
  }
});
