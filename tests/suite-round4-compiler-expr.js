// Round 4, compiler and expressions: a declared id of the wrong kind that is
// also a color name (E205), `=>` / `=<`, the @assert message's escapes, a
// failed @var/@persistent still declaring its name, E205 saying what a module
// argument accepts, no em dashes in hints and command docs, and the R706 help.
import { test, eq, ok, one, codes, errors } from './harness.js';
import { compileProject, defaultRegistry } from '../engine/core/index.js';
import { parseExpr, ExprError } from '../engine/core/expr.js';
import { CODES, CODE_HELP } from '../engine/core/diagnostics.js';

const H = 'SHIORI 1\ntitle: T\n';
const diag = (r, code) => r.diagnostics.filter(d => d.code === code);
const at = (r, code) => diag(r, code).map(d => [d.line, d.col]);
const exprError = (src) => { try { parseExpr(src); } catch (e) { if (e instanceof ExprError) return e; throw e; } return null; };
const ins = (r, op) => r.program.code.filter(i => i.op === op);
const withModule = (mod, text) => compileProject({ entry: 'game.story', files: { 'game.story': text }, order: ['game.story'], missing: [] }, { registry: defaultRegistry([mod]) });

// ---- R10: a declared id of the wrong kind wins over the color name ----------------
test('R10: an audio called `orange` used as a background is E205, not the color orange', () => {
  const r = one(H + '@audio orange music/orange.ogg\n@audio theme music/theme.ogg\n# start\n@scene orange\n@scene theme\nHi.\n-> END\n');
  eq(at(r, 'E205'), [[6, 8], [7, 8]]);
  const d = diag(r, 'E205')[0];
  eq(d.message, '`orange` is an audio, but this needs an image, a world or a color.');
  eq(d.hint, 'For the color orange, write `#ffa500` instead.');
  eq(ins(r, 'cmd').filter(i => i.name === 'scene').length, 0, 'no flat-orange scene is compiled');
});
test('R10: a character called `pink` in @bg is E205; undeclared color names and a declared image still work', () => {
  const r = one(H + '@character pink name="Pink"\n@image orange bg/orange.png\n# start\n@bg pink\n@scene orange\n@scene purple\npink: Hi.\n-> END\n');
  eq(at(r, 'E205'), [[6, 5]]);
  eq(diag(r, 'E205')[0].hint, 'For the color pink, write `#ffc0cb` instead.');
  eq(ins(r, 'cmd').filter(i => i.name === 'scene').map(i => [i.args.bg, i.args.kind]), [['orange', 'image'], ['purple', 'color']]);
});

// ---- R11: `=>` and `=<` ------------------------------------------------------------
test('R11: `=>` and `=<` say "Did you mean `>=`?" / "`<=`?" with the caret on the `=`', () => {
  const r = one(H + '@var trust = 0\n# start\n@if trust => 2\n  A.\n@if trust =< 2\n  B.\n* [if trust=>1] C.\n  C.\n* D.\n-> END\n');
  eq(diag(r, 'E401'), []);
  eq(at(r, 'E400'), [[5, 11], [7, 11], [9, 12]]);
  eq(diag(r, 'E400').map(d => [d.message, d.hint]), [
    ['`=>` is not an operator.', 'Did you mean `>=`?'],
    ['`=<` is not an operator.', 'Did you mean `<=`?'],
    ['`=>` is not an operator.', 'Did you mean `>=`?'],
  ]);
});
test('R11: a single `=` in a condition is still E401 with the `==` hint', () => {
  const e = exprError('trust = 2');
  eq([e.code, e.pos, e.hint], ['E401', 6, 'Write `==` to compare, or use `@set` to assign.']);
  const e2 = exprError('trust = >2');
  eq(e2.code, 'E401', 'a space between = and > is not the reversed operator');
});

// ---- R14: the @assert message follows the escape rule -----------------------------
test('R14: \\" inside an @assert message does not break the split', () => {
  const r = one(H + '@var trust = 0\n# start\n@assert trust >= 0 "Say \\"never\\" below zero"\nHi {$trust}.\n-> END\n');
  eq(errors(r), []);
  const a = ins(r, 'assert')[0];
  eq([a.src, a.message], ['trust >= 0', 'Say "never" below zero']);
});
test('R14: \\\\ and \\\' are escapes in an @assert message; \\n, \\t and \\u are E110 with the caret on the backslash', () => {
  const ok1 = one(H + '@var trust = 0\n# start\n@assert trust >= 0 "a\\\\b it\\\'s"\nHi {$trust}.\n-> END\n');
  eq(errors(ok1), []);
  eq(ins(ok1, 'assert')[0].message, "a\\b it's");
  const r = one(H + '@var trust = 0\n# start\n@assert trust >= 0 "trust\\nmust not be negative"\n@assert trust >= 0 "a\\tb"\n@assert trust < 9 "wait\\u2014no"\nHi {$trust}.\n-> END\n');
  eq(codes(r), ['E110', 'E110', 'E110']);
  eq(at(r, 'E110'), [[5, 26], [6, 22], [7, 24]]);
  eq(diag(r, 'E110')[0].message, 'Unknown escape `\\n` in a quoted argument.');
  ok(diag(r, 'E110')[0].hint.includes('{br}'), diag(r, 'E110')[0].hint);
  ok(/Type the character itself/.test(diag(r, 'E110')[2].hint), diag(r, 'E110')[2].hint);
  eq(ins(r, 'assert').map(a => a.src), ['trust >= 0', 'trust >= 0', 'trust < 9'], 'the conditions are kept');
});
test('R14: a condition that ends in a string keeps it; a string in the condition and a message both work', () => {
  const r = one(H + '@var route = ""\n# start\n@assert route == "rin"\n@assert route == "rin" "Only Rin\'s route"\n@assert route != "a\\"b" "Not \\"a\\"b\\""\nHi {$route}.\n-> END\n');
  eq(errors(r), []);
  eq(ins(r, 'assert').map(a => [a.src, a.message]), [
    ['route == "rin"', null],
    ['route == "rin"', "Only Rin's route"],
    ['route != "a\\"b"', 'Not "a"b"'],
  ]);
});

// ---- R28 / R32: a failed @var / @persistent still declares its name -----------------
test('R28: `@var bonus = 1 + 1` is one E402; its uses get no E201 "Declare it first"', () => {
  const r = one(H + '@var bonus = 1 + 1\n\n# start\n@if bonus > 0\n  Bonus {$bonus}.\n@set bonus += 1\n-> END\n');
  eq(codes(r), ['E402']);
  eq(r.program.decls.vars.bonus.type, 'any');
  ok(r.program.decls.vars.bonus.failed, 'marked failed');
});
test('R28/R32: an E400 or E402 in the value, a missing value and `+=` all still declare the name', () => {
  const r = one(H + '@var a = (1\n@persistent best == 0\n@var mood === "calm"\n@var lonely\n@var plus += 1\n\n# start\n'
    + '@if a > 0 and best > 0 and lonely\n  {$mood} {$best} {$plus}.\n@set mood = 3\n@set plus += "x"\n@input mood\n-> END\n');
  eq(codes(r), ['E400', 'E402', 'E402', 'E402', 'E402'], 'one error per declaration and nothing else');
  eq(errors(r).map(d => d.line), [3, 4, 5, 6, 7]);
  ok(!r.diagnostics.some(d => d.code === 'W601' || d.code === 'W612'), 'no unused warnings for a failed declaration');
});
test('R28: a failed declaration never takes a reserved name or replaces an earlier one', () => {
  const r = one(H + '@var trust = 0\n@var trust = (1\n@var random = (2\n# start\n@if trust > 0\n  Hi.\n-> END\n');
  eq(codes(r), ['E400', 'E400']);
  eq(r.program.decls.vars.trust.type, 'number', 'the first declaration stays');
  ok(!r.program.decls.vars.random, 'random() stays a function');
});

// ---- R29: E205 says what a module argument accepts -------------------------------
test('R29: E205 for `asset:color|none` says "needs a color or `none`"; built-in lists name every kind', () => {
  const mod = { name: 'probe', commands: [{ name: 'a3', positional: [{ name: 't', type: 'asset:color|none', required: true }], exec() {} }] };
  const r = withModule(mod, H + '@image bg bg.png\n@audio theme theme.ogg\n# start\n@a3 bg\n@hide theme\n@music bg\n@cg theme\nHi.\n-> END\n');
  eq(diag(r, 'E205').map(d => d.message), [
    '`bg` is an image, but this needs a color or `none`.',
    '`theme` is an audio, but this needs a character, an image, a model or `all`.',
    '`bg` is an image, but this needs an audio or `stop`.',
    '`theme` is an audio, but this needs an image or `none`.',
  ]);
});

// ---- R30: no em dashes in hints and command docs -----------------------------------
test('R30: the W612 hint has no em dash', () => {
  const r = one(H + '@var trust = 0\n# start\n@set trust += 1\nHi.\n-> END\n');
  eq(diag(r, 'W612')[0].hint, 'Read it in an `@if`, a `[if ...]` choice, or `{$name}` in text. Or remove it.');
});
test('R30: no em dash in any built-in command summary, syntax, doc or example', () => {
  for (const mod of defaultRegistry().modules) {
    for (const c of mod.commands) {
      const texts = [c.summary, c.syntax, ...(c.doc || []), ...(c.examples || []),
        ...(c.positional || []).map(p => p.doc), ...Object.values(c.named || {}).map(n => n.doc)].filter(Boolean);
      for (const t of texts) ok(!t.includes('—'), `em dash in @${c.name}: ${t}`);
    }
  }
});
test('R30: the \\u hint shows the character typed; with no usable code it uses an example without an em dash', () => {
  eq(exprError('"caf\\u00e9"').hint, 'Type the character itself: `é` rather than `\\u00e9`.');
  eq(exprError('"\\x41"').hint, 'Type the character itself: `A` rather than `\\x41`.');
  const bare = exprError('"\\u"').hint;
  eq(bare, 'Type the character itself, e.g. `é` rather than `\\u00e9`.');
  ok(!bare.includes('—'), bare);
});

// ---- R31: E110 covers unknown escapes (checked, no change needed) -----------------
test('R31: the E110 title and help cover unknown escapes as well as unclosed quotes', () => {
  eq(CODES.E110, 'Unclosed quote or unknown escape');
  ok(CODE_HELP.E110.includes('no closing quote') && CODE_HELP.E110.includes('a backslash before a character that is not an escape'), CODE_HELP.E110);
});

// ---- R706: how to raise the playthrough limit -------------------------------------
test('R706 help says to pass `--passes <n>` to shiori explore or shiori vndb', () => {
  const h = CODE_HELP.R706;
  ok(h.includes('`--passes <n>` on `shiori explore` or `shiori vndb`'), h);
  ok(h.includes('`--passes 32`') && h.includes('16 playthroughs in a row or 64 such sets'), h);
  ok(!h.includes('—'), h);
});
