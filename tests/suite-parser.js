// Parser suite: regression tests for the parser review findings.
import { test, eq, ok, one, many, codes, errors, playThrough } from './harness.js';
import { parseFile, loadSources, compileProject, defaultRegistry } from '../engine/core/index.js';

const HEAD = 'SHIORI 1\ntitle: T\n@character mio name="Mio"\n@var trust = 0\n';
const at = (r, code) => r.diagnostics.filter(d => d.code === code).map(d => d.line);
const diag = (r, code) => r.diagnostics.find(d => d.code === code);
const parse = (text, opts = {}) => parseFile('game.story', text, { isMain: true, ...opts });

// ---- finding 10: only declarations take an indented property block --------
test('dialogue indented under @set is E102 and still played', () => {
  const r = one(HEAD + `# a
* Sit.
  @set trust += 1
    mio: You actually sat. {$trust}
  I sit.
-> END
`);
  eq(at(r, 'E102'), [8]);
  ok(/`@set` doesn't take an indented block/.test(diag(r, 'E102').message), diag(r, 'E102').message);
  ok(/same level as `@set`/.test(diag(r, 'E102').hint), diag(r, 'E102').hint);
  ok(playThrough(r.program, [1]).lines.includes('Mio: You actually sat. 1'), 'dialogue kept');
});
test('lines indented under @log, @assert and @var are E102', () => {
  for (const cmd of ['@log hello', '@assert trust == 0']) {
    const r = one(HEAD + `# a\n${cmd}\n  mio: Still here. {$trust}\n-> END\n`);
    eq(at(r, 'E102'), [7], cmd);
    ok(playThrough(r.program, []).lines.includes('Mio: Still here. 0'), cmd + ' keeps the line');
  }
  const r = one(HEAD + `@var x = 1\n  name: nope\n# a\nmio: {$x} {$trust}\n-> END\n`);
  eq(at(r, 'E102'), [6]);
  ok(/`@var` doesn't take an indented block/.test(diag(r, 'E102').message));
});
test('dialogue under @game does not become a module parameter', () => {
  const r = one(HEAD + `@var res = ""\n@gameplay cards games/cards.js\n# a\n@game cards into=res\n  mio: You actually sat. {$trust} {$res}\n-> END\n`);
  eq(at(r, 'E102'), [9]);
  const g = r.program.code.find(i => i.name === 'game');
  ok(g && !JSON.stringify(g).includes('actually'), 'no mio parameter');
});
test('a key: value line under @show is E102 (not E302) with an argument hint', () => {
  const r = one(HEAD + `# a\n@show mio\n  at: left\nmio: {$trust}\n-> END\n`);
  ok(!codes(r).includes('E302'), codes(r).join(','));
  eq(at(r, 'E102'), [7]);
  ok(/`at=left` on the `@show` line/.test(diag(r, 'E102').hint), diag(r, 'E102').hint);
});
test('declarations still take property blocks', () => {
  const r = one(`SHIORI 1
title: T
@character rin
  name: Rin
  color: #88aaff
@image harbor bg/harbor.png
  fit: contain
@video op movies/op.webm
  title: Opening
@position door
  x: 0.8
# a
@scene harbor
@show rin at=door
rin: Hi.
@video op
-> END
`);
  eq(errors(r).map(e => e.code), []);
  eq(r.program.decls.characters.rin.name, 'Rin');
  eq(r.program.decls.positions.door.x, 0.8);
  eq(r.program.decls.assets.op.opts.title, 'Opening');
});
test('@video in its play form takes no property block', () => {
  const r = one(HEAD + `@video op movies/op.webm\n# a\n@video op\n  kind: opening\nmio: {$trust}\n-> END\n`);
  eq(at(r, 'E102'), [8]);
});
test('a module command with props: true gets its block through opts.registry', () => {
  const registry = defaultRegistry([{ name: 'm', commands: [{ name: 'palette', decl: true, props: true, extraNamed: true, positional: [], named: {}, declare() {} }] }]);
  const src = 'SHIORI 1\ntitle: T\n@palette\n  sky: blue\n# a\nHi.\n-> END\n';
  const f = parse(src, { registry });
  eq(f.decls[0].props.map(p => p.key), ['sky']);
  eq(f.diags.list.map(d => d.code), []);
  ok(parse(src).diags.list.some(d => d.code === 'E102'), 'without the registry the block is E102');
});

// ---- finding 37: dialogue spellings that would silently become narration ---
test('a single non-ASCII word before the colon is a speaker (E114 with the id)', () => {
  const r = one('SHIORI 1\ntitle: T\n@character elodie name="Élodie"\n# a\nÉlodie: Bonjour.\n-> END\n');
  const d = diag(r, 'E114');
  ok(d && /`elodie:`/.test(d.hint), d && d.hint);
});
test('several capitalised non-ASCII words get W608', () => {
  const r = one(HEAD + '# a\nJosé Luis: Hola. {$trust}\nÉlodie Dupont: Bonjour.\n-> END\n');
  eq(at(r, 'W608'), [6, 7]);
});
test('dialogue lookalikes get W608 with the corrected line', () => {
  const cases = [
    ['mio：最終便はもう出たよ。', /`mio: 最終便はもう出たよ。`/],
    ['mio:You\'re late.', /`mio: You're late.`/],
    ['"Ferryman":Last boat\'s gone.', /`"Ferryman": Last boat's gone.`/],
    ['“Ferryman”: Last boat\'s gone.', /`"Ferryman": Last boat's gone.`/],
    ['mio "You\'re late."', /`mio: You're late.`/],
    ['ミオ：こんにちは。', /character id/],
    ['ミオ: こんにちは。', /character id/],
  ];
  for (const [line, hint] of cases) {
    const r = one(HEAD + `# a\n${line}\nmio: {$trust}\n-> END\n`);
    const d = diag(r, 'W608');
    ok(d && d.line === 6, `${line}: ${codes(r).join(',')}`);
    ok(hint.test(d.hint), `${line}: ${d.hint}`);
  }
});
test('narration that only contains a colon is left alone', () => {
  const r = one(HEAD + `# a
See http://example.com for more. {$trust}
At 10:30 the boat left.
それは彼がいつも言っていた口癖だった: 「またね」
\u3000港の灯りが、ゆっくりと揺れていた。
She whispered "goodbye"
-> END
`);
  eq(codes(r).filter(c => c !== 'W601'), []);
});

// ---- finding 38: UTF-8 byte order mark --------------------------------------
test('a UTF-8 BOM at the start of a file is ignored', () => {
  const r = many({ 'game.story': '\uFEFFSHIORI 1\ntitle: T\ninclude: story/b.story\n# a\nHi.\n-> b\n', 'story/b.story': '\uFEFFSHIORI 1\n# b\nThere.\n-> END\n' });
  eq(codes(r), []);
});

// ---- finding 39: header fields continue on indented lines -------------------
test('a header field with an inline value continues on indented lines', () => {
  const r = many({
    'game.story': `SHIORI 1
title: T
description: A harbor town, a lighthouse, two sisters
  and the boat that never came back.
// a note between lines
  Still the first paragraph.

  Second paragraph.
include: story/ch1.story
  story/ch2.story
# a
Hi.
-> ch1
`,
    'story/ch1.story': 'SHIORI 1\n# ch1\nOne.\n-> ch2\n',
    'story/ch2.story': 'SHIORI 1\n# ch2\nTwo.\n-> END\n',
  });
  eq(codes(r), []);
  eq(r.program.header.description, 'A harbor town, a lighthouse, two sisters and the boat that never came back. Still the first paragraph.\n\nSecond paragraph.');
  eq(r.program.header.include, ['story/ch1.story', 'story/ch2.story']);
  eq(r.parsed[0].includes[1].loc.line, 10);
});
test('an indented header line with no field above it says so', () => {
  const d = parse('SHIORI 1\n  title: T\n# a\nHi.\n').diags.list.find(x => x.code === 'E112');
  ok(d && /no field above it/.test(d.message), d && d.message);
});

// ---- finding 40: indentation ------------------------------------------------
test('an indented scene body is one E102', () => {
  const r = one(HEAD + `# a
  mio: Hello. {$trust}
  * A
    mio: in A
  * B
  -> END
`);
  eq(at(r, 'E102'), [6]);
  ok(/3 lines below it/.test(diag(r, 'E102').hint), diag(r, 'E102').hint);
  ok(!codes(r).includes('E101'));
});
test('only the over-indented first scene line is reported', () => {
  const r = one(HEAD + `# a\n  mio: Hello. {$trust}\nmio: Second.\n-> END\n`);
  eq(r.diagnostics.filter(d => d.severity === 'error').map(d => d.code + '@' + d.line), ['E102@6']);
});
test('a dedent that matches no block is E101 and keeps the menu whole', () => {
  const r = one(HEAD + `# a
* A
    mio: one {$trust}
  mio: two
* B
  mio: b
-> END
`);
  eq(errors(r).map(e => e.code + '@' + e.line), ['E101@8']);
  const menus = r.parsed[0].scenes[0].body.filter(n => n.type === 'menu');
  eq(menus.length, 1);
  eq(menus[0].options.map(o => o.text), ['A', 'B']);
});
test('a no-break or full-width space before dialogue is E101, not narration', () => {
  const r = one(HEAD + '# a\nmio: Choose. {$trust}\n* Sit.\n\u00A0\u00A0mio: You sat.\n* Stand.\n\u3000mio: You stood.\n\u3000@set trust += 1\n-> END\n');
  eq(at(r, 'E101'), [8, 10, 11]);
  const ok2 = one(HEAD + '# a\n\u3000港の灯りが、ゆっくりと揺れていた。{$trust}\n-> END\n');
  eq(errors(ok2), []);
});

// ---- finding 70: column of a choice condition -------------------------------
test('errors in [if] / [require] point at the condition', () => {
  const r = one(HEAD + `# a
* [if trust = 2] Pick me.
* [if trsut > 1] Two.
* [require trsut > 1] Three.
* [  if trsut > 1] Four.
* Five.
-> END
`);
  eq(r.diagnostics.filter(d => d.code === 'E401' || d.code === 'E201').map(d => `${d.code}@${d.line}:${d.col}`), ['E401@6:13', 'E201@7:7', 'E201@8:12', 'E201@9:9']);
});

// ---- finding 76: diagnostics for content in the wrong place -----------------
test('a header field after the first declaration is E112 and still applies', () => {
  const r = many({ 'game.story': 'SHIORI 1\ntitle: T\n@character mio name="Mio"\ninclude: story/b.story\n# a\nmio: hi\n-> b\n', 'story/b.story': 'SHIORI 1\n# b\nmio: there\n-> END\n' });
  eq(codes(r), ['E112']);
  ok(/before the first `@` declaration/.test(diag(r, 'E112').message));
});
test('in an included file, dialogue before a scene is E103 and header fields are E112', () => {
  const r = many({ 'game.story': 'SHIORI 1\ntitle: T\ninclude: story/b.story\n@character mio name="Mio"\n# a\nmio: hi\n-> b\n', 'story/b.story': 'SHIORI 1\ntitle: B\nmio: hello\n# b\nmio: there\n-> END\n' });
  eq(r.diagnostics.map(d => `${d.code}@${d.line}`), ['E112@2', 'E103@3']);
});
test('one bad scene heading is one E104, not an E103 per line', () => {
  const r = one(HEAD + `# a
mio: one {$trust}
-> b
## b
mio: two
* x
  mio: three
-> END
`);
  eq(errors(r).map(e => e.code).sort(), ['E104', 'E200']);
  const r2 = one('SHIORI 1\ntitle: T\n# 1st\n@character mio name="Mio"\nOne.\nTwo.\n# b\nmio: Three.\n-> END\n');
  eq(errors(r2).map(e => e.code), ['E104']);
});

// ---- finding 77: include paths are normalised -------------------------------
const files77 = { 'game.story': 'SHIORI 1\ntitle: T\ninclude: ./story/ch1.story story/ch1.story story/x/../ch1.story\n# a\nHi.\n-> ch1\n', 'story/ch1.story': 'SHIORI 1\n# ch1\nOne.\n-> END\n' };
const sources77 = await loadSources((p) => files77[p] ?? null);
test('include paths are normalised and each file is loaded once', () => {
  eq(sources77.order, ['game.story', 'story/ch1.story']);
  eq(sources77.missing, []);
  const r = compileProject({ ...sources77, listing: ['game.story', 'story/ch1.story'] });
  eq(codes(r), []);
  eq(r.program.header.include, ['story/ch1.story']);
});

// ---- finding 78: scene headings take no key=value words ---------------------
test('key=value after a scene title is E104 with the command to use', () => {
  const r = one(HEAD + '@image harbor_dusk bg/h.png\n# a "The Harbor" bg=harbor_dusk bogus=1\nmio: {$trust}\n-> END\n');
  const e = r.diagnostics.filter(d => d.code === 'E104');
  eq(e.length, 2);
  ok(/`@scene harbor_dusk`/.test(e[0].hint), e[0].hint);
  eq(r.parsed[0].scenes[0].title, 'The Harbor');
});

// ---- finding 79: comments after expression commands -------------------------
test('` //` inside a single-quoted string is not a comment', () => {
  const r = one(HEAD + `@var motto = ""
# a
@set motto = 'Lights // on' // set it
@if motto == 'Lights // on' // it's a comment
  mio: {$motto} {$trust}
@else // otherwise
  mio: no
-> END
`);
  eq(errors(r), []);
  eq(playThrough(r.program, []).lines, ['Mio: Lights // on 0']);
});
test('@log text keeps apostrophes and still drops its comment', () => {
  const f = parse('SHIORI 1\ntitle: T\n# a\n@log Mio\'s lamp is lit // debug note\n-> END\n');
  eq(f.scenes[0].body[0].raw, 'Mio\'s lamp is lit');
});
