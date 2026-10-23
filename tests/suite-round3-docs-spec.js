// Round 3 docs/spec suite: the E110 and E113 titles and help, the Appendix B
// doc strings for random(), endings_seen() and reading_speed:, help for every
// code, generated appendices in sync, and the hand-written spec checked against
// what the engine does for the codes added in the last round.
import { test, eq, ok, one, codes, errors, host } from './harness.js';
import { compileProject, VM, CODES, FUNCTIONS, HEADER_FIELDS, defaultRegistry } from '../engine/core/index.js';
import { CODE_HELP } from '../engine/core/diagnostics.js';
import { commandReference, tablesReference, codesReference } from '../engine/core/docs.js';
import { explore } from '../engine/core/explore.js';
import { wordWeight } from '../engine/core/util.js';

const H = 'SHIORI 1\ntitle: T\n';
const spec = host.read('SHIORI-Spec.md') || '';
// The text of one `## ` section of the spec, from its heading to the next.
function section(title) {
  const i = spec.indexOf('\n## ' + title);
  if (i < 0) throw new Error('spec has no section ' + title);
  const j = spec.indexOf('\n## ', i + 1);
  return spec.slice(i, j < 0 ? spec.length : j);
}
const appendixD = spec.slice(spec.indexOf('\n# Appendix D'));
const diag = (r, code) => r.diagnostics.filter(d => d.code === code);
const ESCAPES = 'only `\\"`, `\\\'` and `\\\\`';   // as the spec and the help write them
const compile = (src) => {
  const r = one(src);
  eq(errors(r).map(e => e.code + ' ' + e.message), [], 'compile errors');
  return r.program;
};

// ---- 1. E110: unclosed quotes and unknown escapes ----------------------------------
test('E110 title and help cover an unclosed quote and an unknown escape, and say what to write', () => {
  eq(CODES.E110, 'Unclosed quote or unknown escape');
  const h = CODE_HELP.E110;
  for (const s of ['closing quote', 'scene title', '`key: value` property', 'Inside quotes only `\\\\`, `\\"` and `\\\'` are escapes',
    '`{br}`', '`\\u`', 'Write `\\\\` for a backslash', '`/` between the folders of a path']) ok(h.includes(s), 'E110 help lacks ' + s + ': ' + h);
});
test('E110 fires for an unknown escape in a scene title and a command argument, and for an unclosed quote', () => {
  const r = one(H + '# s "The\\tHarbor"\n@chapter "Part\\none"\n@chapter "a \\"b\\" \\\\ \\\'c\\\'"\n@chapter "never closed\nHi.\n-> END\n');
  eq(diag(r, 'E110').map(d => d.line), [3, 4, 6]);
  ok(diag(r, 'E110')[1].hint.includes('{br}'), diag(r, 'E110')[1].hint);
});

// ---- 2. E113: missing folder, game.story or include ---------------------------------
test('E113 title covers a missing game folder, game.story or included file', () => {
  eq(CODES.E113, 'Game folder or story file not found');
  const h = CODE_HELP.E113;
  for (const s of ['the game folder does not exist', 'it has no game.story', '`include:`']) ok(h.includes(s), 'E113 help lacks ' + s);
  const r = compileProject({ entry: 'game.story', files: { 'game.story': H + 'include: story/gone.story\n# s\nHi.\n-> END\n' }, order: ['game.story'], missing: ['story/gone.story'] });
  ok(codes(r).includes('E113'), codes(r).join(' '));
});

// ---- 3. Appendix B doc strings --------------------------------------------------------
test('random() doc: the bounds may come in either order, as the VM allows', () => {
  ok(FUNCTIONS.random.doc.includes('either order') && FUNCTIONS.random.doc.includes('random(6, 1) is the same as random(1, 6)'), FUNCTIONS.random.doc);
  const p = compile(H + '# s\nHi.\n-> END\n');
  const a = new VM(p, { seed: 7 }), b = new VM(p, { seed: 7 });
  a.start(); b.start();
  const ra = [], rb = [];
  for (let i = 0; i < 30; i++) { ra.push(a.callFn('random', [6, 1])); rb.push(b.callFn('random', [1, 6])); }
  eq(ra, rb);
  ok(ra.every(x => x >= 1 && x <= 6) && new Set(ra).size > 1, ra.join(','));
});
test('endings_seen() doc: only this game\'s endings count, as the VM does', () => {
  const d = FUNCTIONS.endings_seen.doc;
  ok(d.includes('this game\'s endings') && d.includes('no longer in the game don\'t count'), d);
  const p = compile(H + '# s\n@ending e1 "One" kind=good\n-> END\n');
  const vm = new VM(p, { seed: 1, persistent: { endings: { e1: 1, removed_in_v2: 1 } } });
  vm.start();
  eq(vm.callFn('endings_seen', []), 1);
});
test('reading_speed doc describes the word count that countWords uses', () => {
  const d = HEADER_FIELDS.reading_speed.doc;
  ok(!d.includes('÷') && !d.includes('CJK'), d);
  for (const s of ['by spaces in any script', 'Han or kana character counts as half a word', 'Thai, Lao, Khmer or Myanmar', 'one word per 4 letters']) ok(d.includes(s), 'doc lacks ' + s);
  eq(wordWeight('the tide comes in'), 4);
  eq(wordWeight('안녕 하세요'), 2);                 // Korean: by spaces
  eq(wordWeight('漢字かな'), 2);                     // Han and kana: half a word each
  eq(wordWeight('ภาษาไทย'), 7 / 4);                 // Thai: letters / 4
  ok(section('3.2 ').includes('each Han or kana character counts as half a word, and Thai, Lao, Khmer or Myanmar text as about one word per 4 letters'), '§3.2 word count');
});

// ---- 6. every code has help, and Appendix C is current ---------------------------------
test('every code in CODES has help, and CODE_HELP has no stray codes', () => {
  for (const k of Object.keys(CODES)) ok(typeof CODE_HELP[k] === 'string' && CODE_HELP[k].length > 20, 'no help for ' + k);
  for (const k of Object.keys(CODE_HELP)) ok(k in CODES, 'help for unknown code ' + k);
});
test('Appendix C lists every code with its current title and help', () => {
  for (const [k, v] of Object.entries(CODES)) {
    const row = `| ${k} | ${v} | ${(CODE_HELP[k] || '').replace(/\|/g, '\\|')} |`;
    ok(spec.includes(row), 'Appendix C row out of date for ' + k + ' (run tools/gen-spec.js)');
  }
});
test('Appendix B lists the current random(), endings_seen() and reading_speed: docs', () => {
  ok(spec.includes('| `random(number, number)` | ' + FUNCTIONS.random.doc + ' |'), 'random row');
  ok(spec.includes('| `endings_seen()` | ' + FUNCTIONS.endings_seen.doc + ' |'), 'endings_seen row');
  ok(spec.includes('| `reading_speed:` | `200` | ' + HEADER_FIELDS.reading_speed.doc + ' |'), 'reading_speed row');
});
test('the generated Appendix A, B and C are exactly what the engine generates (run tools/gen-spec.js)', () => {
  ok(spec.includes(commandReference(defaultRegistry())), 'Appendix A');
  ok(spec.includes(tablesReference()), 'Appendix B');
  ok(spec.includes(codesReference()), 'Appendix C');
});
test('no em dashes in code titles, help, function docs or header docs', () => {
  const texts = [...Object.entries(CODES), ...Object.entries(CODE_HELP),
    ...Object.entries(FUNCTIONS).map(([k, v]) => [k, v.doc]), ...Object.entries(HEADER_FIELDS).map(([k, v]) => [k, v.doc])];
  for (const [k, t] of texts) ok(!t.includes('—'), 'em dash in ' + k + ': ' + t);
});

// ---- 5. the hand-written spec against the engine ----------------------------------------
test('§2.4 and §2.9 state the escape rule for scene titles, command arguments and quoted property values', () => {
  const s24 = section('2.4 '), s29 = section('2.9 ');
  ok(s24.includes('In the title, as in every quoted command argument') && s24.includes(ESCAPES) && s24.includes('E110'), '§2.4');
  ok(s29.includes('**Quoted values.**') && s29.includes(ESCAPES) && s29.includes('quoted property values') && s29.includes('E110'), '§2.9');
  ok(s29.includes('`bg/dusk.png`, not `bg\\dusk.png`'), '§2.9 path hint');
  ok(appendixD.includes('string      := \'"\' ([^"\\\\] | "\\\\" ["\'\\\\])* \'"\''), 'Appendix D string rule');
  ok(appendixD.includes('quoted      := string'), 'Appendix D quoted := string');
});
test('§2.4 and §2.8 describe W622 as the compiler reports it', () => {
  const s24 = section('2.4 '), s28 = section('2.8 ');
  ok(s24.includes('lines after `->`, `@jump` or `@return` in the same block, and lines after a menu or an `@if`/`@else` whose every path jumps away'), '§2.4 W622');
  ok(s24.includes('Put an `@ending` above its `-> END`'), '§2.4 @ending');
  ok(s28.includes('An `@elif` that tests the same condition as an earlier branch of its `@if` never runs (W622)') && s28.includes('`random()` or `chance()`'), '§2.8 @elif');
  const r = one(H + '@var met = false\n# a\n@call c\n* One. -> b\n* Two.\n  -> b\nAfter the menu.\n# b\n@if met\n  A.\n@elif met\n  B.\n@elif random(1, 2) == 1\n  C.\n@elif random(1, 2) == 1\n  D.\n-> END\n@ending late "Late" kind=bad\n# c\n@return\n@note fine\nNever.\n');
  // after the menu, the repeated `@elif met` (not the random ones), `@ending` after `-> END`, after `@return`
  eq(diag(r, 'W622').map(d => d.line), [9, 13, 20, 24]);
  ok(diag(r, 'W622')[2].hint.includes('Put the `@ending` line above `-> END`'), diag(r, 'W622')[2].hint);
});
test('§2.8: chained comparisons are E400, a true/false side is W623', () => {
  ok(section('2.8 ').includes('not `1 < x < 5` (E400)') && section('2.8 ').includes('as in `(1 < x) < 5`, is warning W623'), '§2.8');
  const r = one(H + '@var x = 3\n# a\n@if 1 < x < 5\n  A.\n-> END\n');
  eq(codes(r).filter(c => c[0] === 'E'), ['E400']);
  const w = one(H + '@var x = 3\n# a\n@if (1 < x) < 5\n  A.\n-> END\n');
  eq(codes(w), ['W623']);
});
test('§2.5: the E114 hint gives an ASCII id for O\'Brien', () => {
  ok(section('2.5 ').includes('for `O\'Brien:` the hint suggests the id `obrien`'), '§2.5');
  const r = one(H + '# a\nO\'Brien: Hi.\n-> END\n');
  ok(diag(r, 'E114')[0].hint.includes('`@character obrien name="O\'Brien"`'), diag(r, 'E114')[0].hint);
});
test('§2.13: @music on the playing track changes only what the line writes, over fade=', () => {
  ok(section('2.13 ').includes('`@music theme volume=0.4 fade=3` lowers it over 3 seconds, and a bare `@music theme` leaves the volume as it was'), '§2.13');
  const p = compile(H + '@audio theme music/theme.ogg\n# a\n@music theme volume=0.8\nOne.\n@music theme volume=0.4 fade=3\nTwo.\n@music theme\nThree.\n-> END\n');
  const vm = new VM(p, { seed: 1 });
  vm.start();
  const music = (res) => res.effects.filter(e => e.type === 'audio' && e.op === 'music');
  const two = vm.advance();
  eq(music(two).map(e => [e.music.volume, e.fade, !!e.same]), [[0.4, 3, true]]);
  const three = vm.advance();
  eq(music(three), []);
  eq(vm.state.audio.music.volume, 0.4);
});
const boom = { name: 'fx', commands: [{ name: 'boom', summary: 'Throws.', syntax: '@boom', positional: [], named: {}, exec() { throw new Error('the fuse is wet'); } }] };
test('§2.15 and §4.3: a module exec() that throws is R700 naming the module and command, and is skipped', () => {
  ok(section('2.15 ').includes('A module command whose `exec()` throws is reported (R700, naming the module and the command) and skipped.'), '§2.15');
  ok(section('4.3 ').includes('If it throws, the player skips the command and reports R700 at the script line'), '§4.3');
  const registry = defaultRegistry([boom]);
  const r = compileProject({ entry: 'game.story', files: { 'game.story': H + 'modules: mods/fx.js\n# a\nBefore.\n@boom\nAfter.\n-> END\n' }, order: ['game.story'], missing: [] }, { registry });
  eq(errors(r), []);
  const vm = new VM(r.program, { seed: 1, registry });
  vm.start();
  const res = vm.advance();
  eq(res.halt.plain, 'After.');
  const e = vm.warnings.filter(w => w.code === 'R700');
  eq(e.length, 1);
  ok(e[0].message.includes('`fx` module failed while running `@boom` (the fuse is wet)') && e[0].loc.line === 6, e[0].message);
});
test('§3.1: explore stops a route at a runtime error, so what follows is not reached', () => {
  ok(section('3.1 ').includes('A route stops at its first runtime error (R700)'), '§3.1');
  const ex = explore(compile(H + '@var n = 0\n# a\nBefore.\n@if 1 / n > 1\n  In.\nAfter.\n@ending e "E" kind=good\n-> END\n'));
  eq(ex.errors.map(x => x.code), ['R700']);
  eq(ex.unreachedEndings.map(x => x.id), ['e']);
});
const R706_SRC = H + '@persistent runs = 0\n# a\n@set runs += 1\nAnother night.\n* [require runs >= 20 "After twenty nights"] Open the door.\n  @ending door "The Door" kind=true\n  -> END\n* Sleep.\n  @ending sleep "Sleep" kind=normal\n  -> END\n';
test('§3.1: the replay limits, --passes and R706 match explore()', () => {
  const s = section('3.1 ');
  ok(s.includes('up to 16 playthroughs in a row and 64 different sets; past that it stops replaying and says so (R706)'), '§3.1 limits');
  ok(s.includes('raise the first limit with `--passes 32`'), '§3.1 --passes');
  ok(CODE_HELP.R706.includes('16 playthroughs in a row or 64 such sets') && CODE_HELP.R706.includes('`--passes 32`'), 'R706 help');
  const p = compile(R706_SRC);
  const ex = explore(p);
  const w = ex.warnings.find(x => x.code === 'R706');
  ok(w && w.message.includes('after 16 playthroughs in a row') && w.hint.includes('--passes 32'), JSON.stringify(ex.warnings));
  eq(ex.endings.map(e => e.id).sort(), ['sleep']);
  const more = explore(p, { passes: 32 });
  eq(more.endings.map(e => e.id).sort(), ['door', 'sleep']);
  eq(more.warnings.filter(x => x.code === 'R706'), []);
});
test('§3.1: explore lists choices never offered and never unlocked', () => {
  ok(section('3.1 ').includes('each choice that is never offered (its `[if]` is never true) and each one that is never unlocked (its `[require]` is false on every route)'), '§3.1');
  const ex = explore(compile(H + '@var key = false\n@var gold = 0\n# a\nA door.\n* [require key] Open it.\n  -> END\n* [if gold > 5] Bribe the guard.\n  -> END\n* Leave.\n  @ending leave "Leave" kind=normal\n  -> END\n'));
  eq(ex.options.neverTaken.map(o => o.text), ['Open it.']);
  eq(ex.options.neverShown.map(o => o.text), ['Bribe the guard.']);
});
test('§2.1: a leading byte-order mark is ignored', () => {
  ok(section('2.1 ').includes('a leading byte-order mark is ignored'), '§2.1');
  const r = one('\uFEFF' + H + '# a\nHi.\n-> END\n');
  eq(codes(r), []);
  eq(r.program.header.title, 'T');
});
