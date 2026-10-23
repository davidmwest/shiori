// Core suite (original tests).
import { host, test, eq, ok, one, loadDir, codes, errors, playThrough } from './harness.js';
import { VM, parseExpr, evaluate, parseMarkup, toRuns, CODES, defaultRegistry } from '../engine/core/index.js';
import { explore } from '../engine/core/explore.js';
import { analyze } from '../engine/core/analyze.js';
import { vndbReport } from '../engine/core/vndb.js';

// ---- expressions ----------------------------------------------------------
test('expressions evaluate', () => {
  const env = { get: (n) => ({ a: 3, b: 'x', t: true })[n], call: (n, a) => n === 'max' ? Math.max(...a) : 0 };
  eq(evaluate(parseExpr('a * 2 + 1'), env), 7);
  eq(evaluate(parseExpr('a >= 3 and not (b == "y")'), env), true);
  eq(evaluate(parseExpr('t && a < 2 || b + "y" == "xy"'), env), true);
  eq(evaluate(parseExpr('-a + max(1, 5)'), env), 2);
  eq(evaluate(parseExpr('7 % 4'), env), 3);
});
test('single = in a condition is E401', () => {
  try { parseExpr('a = 2'); throw new Error('no error'); } catch (e) { eq(e.code, 'E401'); }
});

// ---- markup ----------------------------------------------------------------
test('markup parses tags, ruby, waits and variables', () => {
  const { tokens, errors } = parseMarkup('A {b}bold{/b} {ruby=かんじ}漢字{/ruby}{w=0.5}{$name}{w} end{{x}}');
  eq(errors.length, 0);
  const runs = toRuns(tokens, () => 'Mio');
  ok(runs.some(r => r.ruby === 'かんじ' && r.text === '漢字'), 'ruby run');
  ok(runs.some(r => r.wait === 0.5) && runs.some(r => r.click), 'waits');
  ok(runs.some(r => r.text === 'Mio'), 'variable');
  ok(runs.some(r => r.text && r.text.includes('{x}')), 'escaped braces');
});
test('markup reports unknown and unbalanced tags', () => {
  const { errors } = parseMarkup('{bold}x{/bold} {i}never closed');
  ok(errors.some(e => e.code === 'E500'), 'E500');
  ok(errors.some(e => e.code === 'E501'), 'E501');
});

// ---- compiler diagnostics ----------------------------------------------------
test('broken script reports the right codes', () => {
  const r = one(`SHIORI 1
title: Broken
tittle: oops
@character mio name="Mio" sprite=chars/{expresion}.svg expression="neutral smile"
@var trust = 0
# a
@scene nowhere
@show mio smiel at=lefft
Mio: Hello.
Old Man: Who goes there?
mio: {b}open {$trsut}
@set trsut += 1
@if trust = 2
  mio: no
@endif
* Go -> b_typo
@goto a
-> END
`);
  const c = codes(r);
  for (const want of ['W604', 'E203', 'E202', 'E303', 'E114', 'W608', 'E501', 'E201', 'E401', 'W615', 'E200', 'E300']) ok(c.includes(want), `missing ${want} in ${c.join(',')}`);
});
test('did-you-mean suggestions', () => {
  const r = one(`SHIORI 1\ntitle: T\n@character mio expression="neutral smile"\n# a\nmio (smiel): hi\n-> END\n`);
  const d = r.diagnostics.find(x => x.code === 'E203');
  ok(d && /smile/.test(d.hint), 'suggests smile');
});
test('choices, gather, [if], [require], [once]', () => {
  const r = one(`SHIORI 1
title: T
@var k = false
@var n = 0
# hub
Menu.
* [once] One.
  @set n += 1
  -> hub
* [if n >= 1] Two.
  @set k = true
* [require k] Locked.
  -> END
* Leave. -> out
After gather {$n}.
-> hub
# out
Bye.
-> END
`);
  eq(errors(r).length, 0, 'errors');
  const p = r.program;
  const a = playThrough(p, [1, 2, 3]);
  eq(a.stop, 'end');
  ok(a.lines.includes('After gather 1.'), 'gather line');
  const vm = new VM(p, { seed: 1 });
  let res = vm.start(); res = vm.advance();
  eq(res.halt.options.map(o => [o.index, o.disabled]), [[0, false], [2, true], [3, false]]);
});

// ---- VM ---------------------------------------------------------------------
const smoke = await loadDir('tests/fixtures/smoke');
test('smoke fixture compiles', () => eq(errors(smoke).length, 0));
test('smoke: choice 1 reaches together', () => eq(playThrough(smoke.program, [1]).ending, 'together'));
test('smoke: choice 2 reaches alone', () => eq(playThrough(smoke.program, [2]).ending, 'alone'));
test('rollback and rollforward', () => {
  const vm = new VM(smoke.program, { seed: 1 });
  let r = vm.start(); r = vm.advance();
  const a = r.halt.plain; r = vm.advance(); const b = r.halt.plain;
  r = vm.rollback(); eq(r.halt.plain, a);
  r = vm.rollforward(); eq(r.halt.plain, b);
  r = vm.advance(); eq(r.halt.type, 'menu');
  r = vm.choose(0); r = vm.rollback(); eq(r.halt.type, 'menu', 'rollback to the menu');
});
test('save survives a script edit', () => {
  const vm = new VM(smoke.program, { seed: 1 });
  let r = vm.start(); r = vm.advance(); r = vm.advance();
  const before = r.halt.plain;
  const save = vm.save();
  const edited = host.read('tests/fixtures/smoke/game.story').replace('@var trust = 0', '@var trust = 0\n@var extra = 5').replace('# harbor "The Harbor"', '# harbor "The Harbor"\nA brand new first line.');
  const r2 = one(edited);
  const vm2 = new VM(r2.program, { seed: 1 });
  const res = vm2.load(save);
  eq(res.halt.plain, before);
  eq(vm2.state.vars.extra, 5);
});
test('runtime errors: @return without @call is R702', () => {
  const r = one(`SHIORI 1\ntitle: T\n# a\nHi.\n@return\n`);
  eq(playThrough(r.program, []).error.code, 'R702');
});
test('random is deterministic per seed', () => {
  const r = one(`SHIORI 1\ntitle: T\n@var x = 0\n# a\n@set x = random(1, 1000)\n{$x}\n-> END\n`);
  eq(playThrough(r.program, []).lines, playThrough(r.program, []).lines);
});

// ---- explorer, stats, VNDB ------------------------------------------------------
const lk = await loadDir('examples/lantern-keeper');
test('lantern-keeper compiles', () => eq(errors(lk).length, 0));
test('explorer finds all four endings including the unlock', () => {
  const ex = explore(lk.program);
  eq(ex.endings.map(e => e.id).sort(), ['dry_end', 'lamplight', 'supper', 'two_lanterns']);
  eq(ex.endings.find(e => e.id === 'two_lanterns').pass > 1, true);
  eq(ex.lines.unseen.length, 0);
  eq(ex.errors.length, 0);
});
test('VNDB: lantern-keeper reads as a VN with the right tags', () => {
  const v = vndbReport(lk.program, { exploration: explore(lk.program) });
  eq(v.verdict, 'reads like a visual novel');
  const tags = v.tags.map(t => t.id);
  for (const t of ['g2734', 'g148', 'g606', 'g459', 'g3664', 'g3790']) ok(tags.includes(t), 'tag ' + t);
});
test('VNDB: heavy gameplay and no narration is flagged (advisory)', () => {
  const r = one(`SHIORI 1
title: Game
@gameplay battle games/b.js minutes=30 results="win lose"
@character a
@var res = ""
# s
a: Fight!
@game battle into=res
a: Done.
-> END
`);
  const v = vndbReport(r.program);
  eq(v.likely, false);
  ok(v.checks.some(c => c.id === 'narration' && c.status !== 'pass'));
});
test('analysis counts narration share', () => {
  const a = analyze(smoke.program);
  ok(a.narrationShare > 0.4 && a.narrationShare < 0.8, 'share ' + a.narrationShare);
});
// ---- explorer: endings mid-route, random(), gameplay, constant conditions ----
const exf = await loadDir('tests/fixtures/explore');
test('explore credits an @ending followed by more story', () => {
  const ex = explore(exf.program);
  eq(ex.endings.map(e => e.id).sort(), ['first', 'second']);
  eq(ex.unreachedEndings.length, 0);
});
test('explore branches on random() and chance()', () => {
  const ex = explore(exf.program);
  eq(ex.lines.unseen.length, 0, 'unseen lines');
  ok(ex.randomUsed);
});
test('explore replays are verified and carry --game / --rolls', () => {
  const ex = explore(exf.program);
  for (const e of ex.endings) ok(e.shortest.verified, 'verified ' + e.id);
  const first = ex.endings.find(e => e.id === 'first');
  ok(first.shortest.path.some(p => p.game === 'coin' && p.result === 'win'));
});
test('explore reports conditions that never change', () => {
  const ex = explore(exf.program);
  ok(ex.constantConditions.some(c => c.cond === 'always' && c.always));
});
test('W620 for an ending that jumps back into the story', () => ok(codes(exf).includes('W620')));
test('W621 when every option is conditional; R704 does not stop explore', () => {
  const r = one(`SHIORI 1\ntitle: T\n@var a = false\n# s\nHi.\n* [if a] Only.\n  -> END\nAfter.\n@ending e "E"\n-> END\n`);
  ok(codes(r).includes('W621'));
  const ex = explore(r.program);
  eq(ex.endings.map(e => e.id), ['e']);
});
test('gender accepts VNDB shorthand; unknown platforms warn', () => {
  const r = one(`SHIORI 1\ntitle: T\nplatforms: web toaster\n@character a gender=f\n@character b gender=m\n# s\na: hi\nb: hi\n-> END\n`);
  eq(errors(r).length, 0);
  eq(r.program.decls.characters.a.vndb.gender, 'female');
  ok(r.diagnostics.some(d => d.code === 'W604' && /toaster/.test(d.message)));
});
test('a quotation at the start of narration is flagged (W608)', () => {
  const r = one(`SHIORI 1\ntitle: T\n# s\n"Keep it": that's all he ever says.\n-> END\n`);
  ok(codes(r).includes('W608'));
});
test('W603 ignores declarations after the last jump', () => {
  const r = one(`SHIORI 1\ntitle: T\n# s\nHi {$x}.\n-> END\n@var x = 1\n`);
  ok(!codes(r).includes('W603'), codes(r).join(','));
});
test('count() counts true conditions', () => {
  const r = one(`SHIORI 1\ntitle: T\n@var a = true\n@var b = false\n@var c = true\n# s\n@if count(a, b, c) == 2\n  Two.\n-> END\n`);
  eq(errors(r).length, 0);
  eq(playThrough(r.program, []).lines, ['Two.']);
});
test('locked option hints reach the menu', () => {
  const r = one(`SHIORI 1\ntitle: T\n@var k = false\n# s\nDoor.\n* [require k "Find the key first"] Open it.\n  -> END\n* Leave. -> END\n`);
  eq(errors(r).length, 0);
  const vm = new VM(r.program, { seed: 1 }); let res = vm.start(); res = vm.advance();
  eq(res.halt.options[0].hint, 'Find the key first');
});

test('spec is in sync with the engine (run tools/gen-spec.js if this fails)', () => {
  const spec = host.read('SHIORI-Spec.md');
  const markers = (spec.match(/<!-- EXAMPLE:[^ ]+ -->/g) || []).length;
  const blocks = (spec.match(/<!-- EXAMPLE:[^ ]+ -->\s*```shiori/g) || []).length;
  eq(blocks, markers, 'expanded examples');
  for (const code of Object.keys(CODES)) ok(spec.includes('| ' + code + ' |'), 'Appendix C lacks ' + code);
  for (const name of defaultRegistry().names()) ok(spec.includes('### `@' + name + '`'), 'Appendix A lacks @' + name);
});

const tpl = await loadDir('templates/new-game');
test('new-game template compiles cleanly', () => eq(errors(tpl).length, 0));


