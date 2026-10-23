// Round 4, parser: [require] lock hints (escapes, a condition that ends in a
// string), dialogue lookalikes (non-ASCII names, prose with a colon), choice
// bodies indented with odd spaces, `key: value` under a command, bad scene
// headings, and @log comments.
import { test, eq, ok, one, many, errors, playThrough } from './harness.js';
import { parseFile } from '../engine/core/index.js';

const HEAD = 'SHIORI 1\ntitle: T\n@character mio name="Mio"\n@var trust = 0\n';
const parse = (text, opts = {}) => parseFile('game.story', text, { isMain: true, ...opts });
const shown = (r) => r.diagnostics.filter(d => d.severity !== 'info').map(d => `${d.code}@${d.line}`);
const menuOf = (r) => r.program.code.find(i => i.op === 'menu');

// ---- R14 / R27: [require cond "hint"] ------------------------------------------
const require1 = (opt, vars = '') => one(HEAD + vars + `# a\n${opt}\n  Locked.\n* Open.\n  Open. {$trust}\n-> END\n`);

test('R27: [require x == "rin"] keeps its string: a trailing string is the hint only after a complete condition', () => {
  const r = require1('* [require route == "rin"] Climb to the roof.', '@var route = "kai"\n');
  eq(errors(r), []);
  eq(menuOf(r).options[0].hint, undefined, 'no hint');
  const r2 = require1('* [require route == "rin" "Only on Rin\'s route"] Climb.', '@var route = "rin"\n');
  eq(errors(r2), []);
  eq(menuOf(r2).options[0].hint, 'Only on Rin\'s route');
  // the condition is `route == "rin"`: with route = "rin" the option is open
  eq(playThrough(r2.program, [1]).lines.includes('Locked.'), true, 'unlocked');
  const r3 = require1('* [require route == \'rin\' "Rin only"] Climb.', '@var route = "kai"\n');
  eq([errors(r3), menuOf(r3).options[0].hint], [[], 'Rin only']);
});
test('R14: \\" \\\\ and \\\' in a [require] hint are escapes', () => {
  const r = require1('* [require trust > 5 "Say \\"please\\""] Locked.');
  eq(errors(r), []);
  eq(menuOf(r).options[0].hint, 'Say "please"');
  const r2 = require1('* [require trust > 5 "back\\\\slash, Rin\\\'s"] Locked.');
  eq([errors(r2), menuOf(r2).options[0].hint], [[], 'back\\slash, Rin\'s']);
});
test('R14: an unknown escape in a [require] hint is E110 with the caret on the backslash', () => {
  const r = require1('* [require trust > 5 "Need\\ttrust"] Locked.');
  eq(errors(r).map(e => [e.code, e.line, e.col]), [['E110', 6, 27]]);
  eq(errors(r)[0].message, 'Unknown escape `\\t` in a quoted lock hint.');
  eq(errors(r)[0].hint, 'Only `\\"`, `\\\'` and `\\\\` are escapes. Write `\\\\` for a backslash.');
  const r2 = require1('* [require trust > 5 "Two\\nlines"] Locked.');
  eq(errors(r2).map(e => [e.code, e.hint]), [['E110', 'A lock hint is one line of text: remove the `\\n`.']]);
});
test('R14: a `]` inside a quoted [require] hint does not close the bracket', () => {
  const r = require1('* [require trust > 5 "Find the [key] first"] Open the door.');
  eq(errors(r), []);
  const o = menuOf(r).options[0];
  eq(o.hint, 'Find the [key] first');
  eq(o.text.map(t => t.s).join(''), 'Open the door.');
});
test('R27: a condition that is not complete before the string keeps the string (the error names the condition)', () => {
  const r = require1('* [require trust >> 5 "Need trust"] Locked.');
  eq(errors(r).map(e => [e.code, e.col]), [['E400', 19]]);
});

// ---- R15 / R35: dialogue lookalikes -----------------------------------------
const CHARS = 'SHIORI 1\ntitle: T\n@character mio name="Mio"\n@character elodie name="Élodie"\n@character mio_jp name="ミオ"\n';
const lineDiags = (text) => {
  const r = one(CHARS + '# a\n' + text + '\nmio: x\nelodie: x\nmio_jp: x\n-> END\n');
  return r.diagnostics.filter(d => d.line === 7);
};

test('R15: `Élodie:Bonjour.` (no space, non-ASCII name) is W608 with the id to write', () => {
  const d = lineDiags('Élodie:Bonjour.');
  eq(d.map(x => x.code), ['W608']);
  ok(/no space after the colon/.test(d[0].message), d[0].message);
  ok(d[0].hint.startsWith('Write `elodie: Bonjour.`.'), d[0].hint);
});
test('R15: `Élodie "Bonjour."` (Ren\'Py style, non-ASCII name) is W608', () => {
  const d = lineDiags('Élodie "Bonjour."');
  eq(d.map(x => x.code), ['W608']);
  ok(d[0].hint.startsWith('In Shiori write `elodie: Bonjour.`.'), d[0].hint);
  const d2 = lineDiags('Zoë "Salut."');
  eq(d2.map(x => x.code), ['W608']);
  ok(/`"Zoë": Salut\.` for a one-off speaker/.test(d2[0].hint), d2[0].hint);
});
test('R15: `ミオ: こんにちは。` names the id of the character called ミオ', () => {
  const d = lineDiags('ミオ: こんにちは。');
  eq(d.map(x => x.code), ['W608']);
  ok(/write `mio_jp: こんにちは。`/.test(d[0].hint), d[0].hint);
});
test('R35: prose with a colon stays narration with no diagnostic', () => {
  for (const text of ['Re:Zero was on TV.', 'Note:the tide is in.', 'C:\\Windows is a folder.', '時刻：午後三時。', 'c:\\temp', 'Note：the tide is in.']) {
    const r = one(CHARS + '# a\n' + text + '\nmio: x\nelodie: x\nmio_jp: x\n-> END\n');
    eq(r.diagnostics.filter(d => d.line === 7).map(d => d.code), [], text);
    eq(playThrough(r.program, []).lines[0], text, text + ' is shown as typed');
  }
});
test('R35: no-space and full-width forms still get W608 for a character id, display name or kana name', () => {
  const cases = [
    ['mio:Hi.', /^Write `mio: Hi\.`/], ['Mio:Hi.', /^Write `mio: Hi\.`/], ['MIO:Hi.', /^Write `mio: Hi\.`/],
    ['rin:Hi.', /^Write `rin: Hi\.`/], // a lowercase id, even one this file doesn't declare
    ['Mio：やあ。', /^Write `mio: やあ。` with an ASCII colon/], ['ミオ：やあ。', /^Write `mio_jp: やあ。`/],
    ['みお：やあ。', /character id/],
  ];
  for (const [text, hint] of cases) {
    const d = lineDiags(text);
    eq(d.map(x => x.code), ['W608'], text);
    ok(hint.test(d[0].hint), `${text}: ${d[0].hint}`);
  }
});
test('R35: a lookalike the parser cannot place is kept on the node for the compiler (speakerLike)', () => {
  const f = parseFile('story/ch.story', 'SHIORI 1\n# b\nMio:Hi.\n時刻：午後三時。\nC:\\x\n-> END\n', {});
  eq(f.diags.list, []);
  const body = f.scenes[0].body;
  eq(body[0].speakerLike, { who: 'Mio', why: 'there is no space after the colon', attrs: '', text: 'Hi.' });
  eq(body[1].speakerLike.who, '時刻');
  eq(body[2].speakerLike, undefined, 'C:\\ is never a speaker');
});
test('R35: opts.characters lets the parser place names declared in another file', () => {
  const f = parseFile('story/ch.story', 'SHIORI 1\n# b\nMio:Hi.\n美緒：やあ。\n-> END\n', { characters: [{ id: 'mio', name: 'Mio' }, { id: 'mio_jp', name: '美緒' }] });
  eq(f.diags.list.map(d => [d.code, d.line]), [['W608', 3], ['W608', 4]]);
  ok(/^Write `mio_jp: やあ。`/.test(f.diags.list[1].hint), f.diags.list[1].hint);
});

// ---- R16: choice bodies indented with odd spaces -------------------------------
const NB = '\u00A0\u00A0', ID = '\u3000';
test('R16: narration indented with no-break spaces under choices is E101, not two one-option menus', () => {
  const r = one(HEAD + `# a\nmio: Choose. {$trust}\n* Sit.\n${NB}I sit down.\n* Stand.\n${NB}I stand up.\n-> END\n`);
  eq(errors(r).map(e => [e.code, e.line]), [['E101', 8], ['E101', 10]]);
  eq(errors(r)[0].hint, 'To put it under the choice above, indent it with ASCII spaces or tabs.');
});
test('R16: a run of such lines is reported once', () => {
  const r = one(HEAD + `# a\nmio: Choose. {$trust}\n* A\n${NB}one\n${NB}two\n* B\n  mio: b\n-> END\n`);
  eq(errors(r).map(e => [e.code, e.line]), [['E101', 8]]);
  ok(/The line below it at the same indentation has the same problem\./.test(errors(r)[0].hint), errors(r)[0].hint);
});
test('R16: U+3000 narration between choices is E101; after a flavour menu it is a paragraph indent', () => {
  const between = one(HEAD + `# a\nmio: Choose. {$trust}\n* はい\n${ID}彼女は笑った。\n* いいえ\n${ID}彼女は泣いた。\n-> END\n`);
  eq(errors(between).map(e => [e.code, e.line]), [['E101', 8], ['E101', 10]]);
  const after = one(HEAD + `# a\nmio: Choose. {$trust}\n* はい\n* いいえ\n${ID}どちらでも同じだった。\n-> END\n`);
  eq(shown(after), []);
  eq(playThrough(after.program, [2]).lines.slice(-1), [`${ID}どちらでも同じだった。`]);
});
test('R16: choices inside an @if block get the same E101', () => {
  const r = one(HEAD + `# a\nmio: Choose. {$trust}\n@if trust == 0\n  * A\n  ${NB}one\n  * B\n    mio: b\n-> END\n`);
  eq(errors(r).map(e => [e.code, e.line, e.col]), [['E101', 9, 3]]);
});

// ---- R33: `key: value` under a command that takes no block ----------------------
test('R33: `  at: left` under @show is one E102, with no E114 for `at`', () => {
  const r = one(HEAD + `# a\n@show mio\n  at: left\n  zoom: 2\nmio: {$trust}\n-> END\n`);
  eq(errors(r).map(e => [e.code, e.line]), [['E102', 7]]);
  ok(/write `at=left` on the `@show` line/.test(errors(r)[0].hint), errors(r)[0].hint);
});
test('R33: an indented line under @show that names a character stays dialogue, with no argument hint', () => {
  const r = one(HEAD + `# a\n@show mio\n  mio: Hi.\nmio: {$trust}\n-> END\n`);
  eq(errors(r).map(e => [e.code, e.line]), [['E102', 7]]);
  ok(!/argument/.test(errors(r)[0].hint), errors(r)[0].hint);
  const f = parse(HEAD + `# a\n@show mio\n  mio: Hi.\n-> END\n`);
  eq(f.scenes[0].body.map(n => n.type), ['cmd', 'say', 'jump']);
});

// ---- R34: the lines under a bad scene heading ---------------------------------
test('R34: after a scene that ends with a jump, a bad heading is one E104 (no W622 on its lines)', () => {
  const r = one('SHIORI 1\ntitle: T\n@character mio name="Mio"\n\n# a\nmio: One.\n-> b\n\n# b\nmio: Two.\n-> END\n\n# c-1\nmio: Three.\n* Go on.\n  mio: Four.\n-> END\n');
  eq(shown(r), ['E104@13']);
  const r2 = one('SHIORI 1\ntitle: T\n# a\n-> END\n# 1b\nHello.\nWorld.\n');
  eq(shown(r2), ['E104@5']);
  // the dropped lines are kept aside in file.orphans, not in scene a
  const f = parse('SHIORI 1\ntitle: T\n# a\n-> END\n# 1b\nHello.\n@var met = false\nWorld.\n');
  eq(f.scenes.map(s => [s.id, s.body.map(n => n.type + (n.name ? ':' + n.name : ''))]), [['a', ['jump', 'cmd:var']]]);
  eq(f.orphans.map(o => [o.loc.line, o.body.map(n => n.text)]), [[5, ['Hello.', 'World.']]]);
});
test('R34: after a scene that runs on, the lines join it, so they are still checked and no W603 appears', () => {
  const r = one(HEAD + '# a\nmio: One. {$trust}\n\n# c-1\nmio: Two.\n-> END\n');
  eq(shown(r), ['E104@8']);
  const r2 = one(HEAD + '# a\nmio: One. {$trust}\n\n# c-1\nrin: Two.\n-> END\n');
  eq(shown(r2), ['E104@8', 'E114@9']);
});
test('R34: before the first scene, only the declarations under a bad heading are kept', () => {
  const r = one('SHIORI 1\ntitle: T\n# 1intro\n@scene black\n@character kai name="Kai"\nOne.\n# a\nkai: Yo.\n-> END\n');
  eq(shown(r), ['E104@3']);
  const r2 = one(HEAD + '# a\nmio: One. {$trust}\n-> END\n# c-1\n@var met = false\n-> END\n');
  eq(r2.program.decls.vars.met.name, 'met', 'a declaration under the heading still counts');
});

// ---- R36: @log comments ----------------------------------------------------
test('R36: an @log comment with a lone double quote is still cut off', () => {
  const raw = (l) => parse('SHIORI 1\ntitle: T\n# a\n' + l + '\n-> END\n').scenes[0].body[0].raw;
  eq(raw('@log trust ok // he said "hi'), 'trust ok');
  eq(raw('@log a "b // c" d // e "f'), 'a "b // c" d');
  eq(raw('@log Mio\'s lamp // it\'s lit'), 'Mio\'s lamp');
  eq(raw('@log see http://x.com'), 'see http://x.com');
});
