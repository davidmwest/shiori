// Round 3 suite (explore, analysis, CLI): script names that exist on
// Object.prototype (`__proto__`, `constructor`, `toString` ...) are ordinary
// names in explore, analyze, vndb, assets, docs and every CLI command;
// `shiori vndb --passes`; `shiori explain` for R706, W622 and W623.
// CLI commands run against in-memory folders.
import { test, eq, ok, one, errors } from './harness.js';
import { normalizePath } from '../tools/host.js';
import { explore, scanReads } from '../engine/core/explore.js';
import { analyze } from '../engine/core/analyze.js';
import { vndbReport } from '../engine/core/vndb.js';
import { fillTemplate, expandTemplate, checkAssets } from '../engine/core/assets.js';
import { commandReference } from '../engine/core/docs.js';
import { defaultRegistry } from '../engine/core/modules/index.js';

globalThis.__shioriEmbedded = true;
const { runCli } = await import('../tools/cli.js');

// ---- an in-memory host (as in suite-cli.js) ------------------------------------
function vhost(files, args) {
  const norm = (p) => normalizePath(p);
  const has = (p) => Object.prototype.hasOwnProperty.call(files, norm(p));
  const dirs = new Set(['.']);
  for (const f of Object.keys(files)) { const parts = f.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/')); }
  const lines = [];
  const h = {
    kind: 'test', args, cwd: '/virtual', code: 0,
    print: (s) => lines.push(String(s)), printErr: (s) => lines.push(String(s)),
    read: (p) => has(p) ? files[norm(p)] : null,
    exists: (p) => has(p),
    isDir: (p) => dirs.has(norm(p)),
    subdirs: (p) => { const k = norm(p), pre = k === '.' ? '' : k + '/'; return [...dirs].filter(d => d !== '.' && d.startsWith(pre) && !d.slice(pre.length).includes('/')).map(d => d.slice(pre.length)); },
    list: (dir) => { const k = norm(dir), pre = k === '.' ? '' : k + '/'; return dirs.has(k) ? Object.keys(files).filter(f => f.startsWith(pre)).map(f => f.slice(pre.length)) : null; },
    fileId: (p) => has(p) ? norm(p) : null,
    moduleUrl: (p) => '/nonexistent-shiori-test/' + norm(p),
    exit: (c) => { h.code = c; },
  };
  h.text = () => lines.join('\n');
  return h;
}
async function cli(files, args) { const h = vhost(files, args); await runCli(h); return h; }
function json(h) { try { return JSON.parse(h.text()); } catch (e) { throw new Error('not JSON: ' + h.text().slice(0, 300)); } }
const game = (src) => ({ 'g/game.story': src });
const compile = (src) => {
  const r = one(src);
  eq(errors(r).map(e => e.code + ' ' + e.message), [], 'compile errors');
  return r.program;
};

// ---- games that use a prototype name for one kind of thing -----------------------
const NAMES = ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf'];
const GAMES = {
  'a story variable read in a condition': (n) => `SHIORI 1\ntitle: Var ${n}\n@var ${n} = 0\n\n# start\nHello.\n* One.\n  @set ${n} = 1\n* Two.\n  @set ${n} = 2\n@if ${n} > 1\n  Big.\n  @ending big "Big"\n  -> END\nSmall.\n@ending small "Small"\n-> END\n`,
  'a variable compared with strings': (n) => `SHIORI 1\ntitle: Str ${n}\n@var ${n} = ""\n\n# start\nHello.\n* One.\n  @set ${n} = "one"\n* Two.\n  @set ${n} = "two"\n@if ${n} == "one"\n  One it is.\n  @ending one "One"\n  -> END\nTwo it is.\n@ending two "Two"\n-> END\n`,
  'an @input variable': (n) => `SHIORI 1\ntitle: Input ${n}\n@var ${n} = "Sam"\n\n# start\n@input ${n} "Name?"\n@if ${n} == "Bob"\n  Hi Bob.\n  @ending bob "Bob"\n  -> END\nHi {$${n}}.\n@ending other "Other"\n-> END\n`,
  'a @persistent counter': (n) => `SHIORI 1\ntitle: Persistent ${n}\n@persistent ${n} = 0\n\n# start\n@set ${n} += 1\n@if ${n} >= 2\n  Second time.\n  @ending again "Again"\n  -> END\nFirst time.\n@ending first "First"\n-> END\n`,
  'a character, its attribute group and a position': (n) => `SHIORI 1\ntitle: Char ${n}\n@character ${n} name=Ann\n  sprite: c/{${n}}.png\n  ${n}: a b\n@position ${n} x=0.3\n\n# start\n@show ${n} a at=${n}\n${n} (b): Hi.\nNarration here.\n@ending done "Done"\n-> END\n`,
  'a one-off speaker': (n) => `SHIORI 1\ntitle: Speaker ${n}\n\n# start\n"${n}": Hello there.\nNarration here.\n@ending done "Done"\n-> END\n`,
  'a scene and visited()': (n) => `SHIORI 1\ntitle: Scene ${n}\n\n# start\nHello.\n* Go.\n  -> ${n}\n* Stay.\n  @ending stay "Stay"\n  -> END\n\n# ${n}\nThere.\n@if visited("${n}") >= 2\n  Twice.\n  @ending twice "Twice"\n  -> END\n* Again.\n  -> ${n}\n* Leave.\n  @ending left "Left"\n  -> END\n`,
  'visited() tested after a menu': (n) => `SHIORI 1\ntitle: Loop ${n}\n\n# start\nIn.\n-> ${n}\n\n# ${n}\nRound.\n* Again.\n  -> ${n}\n* Check.\n  @if visited("${n}") >= 3\n    Third.\n    @ending third "Third"\n    -> END\n  @ending early "Early"\n  -> END\n`,
  'an ending read by ending_seen()': (n) => `SHIORI 1\ntitle: Ending ${n}\n\n# start\nHello.\n@if ending_seen("${n}")\n  Welcome back.\n  @ending back "Back"\n  -> END\n* Finish.\n  @ending ${n} "The End"\n  -> END\n* Other.\n  @ending other "Other"\n  -> END\n`,
  'an ending counted by endings_seen()': (n) => `SHIORI 1\ntitle: Count ${n}\n\n# start\nHello.\n@if endings_seen() >= 1\n  Again.\n* Finish.\n  @ending ${n} "The End"\n  -> END\n* [if ending_seen("${n}")] Bonus.\n  @ending bonus "Bonus"\n  -> END\n`,
  'an image': (n) => `SHIORI 1\ntitle: Image ${n}\n@image ${n} bg/x.png\n\n# start\n@scene ${n}\nHello.\n@cg ${n}\nA picture.\n@ending done "Done"\n-> END\n`,
  'an audio track': (n) => `SHIORI 1\ntitle: Audio ${n}\n@audio ${n} a/x.ogg\n\n# start\n@music ${n}\nHello.\n@sound ${n}\nA sound.\n@ending done "Done"\n-> END\n`,
  'a @gameplay': (n) => `SHIORI 1\ntitle: Game ${n}\n@gameplay ${n} g/x.js results="win lose" minutes=2\n\n# start\nHello.\n@game ${n}\n@ending done "Done"\n-> END\n`,
  'a variable raised by a [once] choice': (n) => `SHIORI 1\ntitle: Once ${n}\n@var ${n} = 0\n\n# start\nHello.\n* [once] Ask.\n  @set ${n} += 1\n  -> start\n* Leave.\n  @ending done "Done"\n  -> END\n`,
};
const COMMANDS = [['check', 'g'], ['explore', 'g'], ['stats', 'g', '--by-scene'], ['vndb', 'g'], ['graph', 'g'], ['graph', 'g', '--format', 'dot'], ['assets', 'g'], ['play', 'g', '--choices', '1,1,1']];

// Every command must print for a prototype name exactly what it prints for an
// ordinary one (padding aside), with the same exit code.
const squash = (s) => s.replace(/ +/g, ' ');
const sameAsPlain = {};
for (const [what, make] of Object.entries(GAMES)) {
  const problems = [];
  for (const args of COMMANDS) {
    const plain = await cli(game(make('zed')), args);
    for (const n of NAMES) {
      const h = await cli(game(make(n)), args);
      const got = squash(h.text().split(n).join('zed')), want = squash(plain.text());
      if (got === want && h.code === plain.code) continue;
      const a = got.split('\n'), b = want.split('\n');
      const i = a.findIndex((l, j) => l !== b[j]);
      problems.push(`\`${n}\`, shiori ${args.join(' ')}: exit ${h.code} (want ${plain.code}); got "${a[i]}", want "${b[i]}"`);
    }
  }
  sameAsPlain[what] = problems;
}
for (const what of Object.keys(GAMES)) {
  test(`${what} named like an Object.prototype member: every command treats it as an ordinary name`, () => {
    eq(sameAsPlain[what].slice(0, 3), []);
  });
}

// ---- the three crashes that were reported ---------------------------------------
const make = (what, n) => game(GAMES[what](n));
const protoVar = await cli(make('a story variable read in a condition', '__proto__'), ['explore', 'g', '--json']);
const ctorStr = await cli(make('a variable compared with strings', 'constructor'), ['explore', 'g', '--json']);
const ctorInput = await cli(make('an @input variable', 'constructor'), ['explore', 'g']);
const isProtoEnding = await cli(make('an ending read by ending_seen()', 'isPrototypeOf'), ['explore', 'g', '--json']);
const isProtoText = await cli(make('an ending read by ending_seen()', 'isPrototypeOf'), ['explore', 'g']);
test('@var __proto__ set with @set and read in a condition: explore finds both endings', () => {
  eq(protoVar.code, 0, protoVar.text().slice(0, 300));
  const r = json(protoVar);
  eq(r.endings.map(e => e.id).sort(), ['big', 'small']);
  eq(r.errors, []);
  eq(r.constantConditions, []);
});
test('@var constructor compared with a string: explore tries the strings', () => {
  eq(ctorStr.code, 0, ctorStr.text().slice(0, 300));
  eq(json(ctorStr).endings.map(e => e.id).sort(), ['one', 'two']);
  eq(ctorInput.code, 0, ctorInput.text());
  ok(ctorInput.text().includes('replay:   shiori play g --choices Bob'), ctorInput.text());
});
test('@ending isPrototypeOf: explore finds it, and the ending that needs it on the next playthrough', () => {
  eq(isProtoEnding.code, 0, isProtoEnding.text().slice(0, 300));
  const r = json(isProtoEnding);
  eq(r.endings.map(e => e.id).sort(), ['back', 'isPrototypeOf', 'other']);
  eq(r.endings.find(e => e.id === 'back').pass, 2);
  eq(r.unreachedEndings, []);
  ok(isProtoText.text().includes('replay:   shiori play g --seen isPrototypeOf'), isProtoText.text());
});

// ---- explore: what the script reads, keyed by name ---------------------------------
test('scanReads keys its tables by name only (no inherited entries)', () => {
  const r = scanReads(compile(GAMES['a @persistent counter']('constructor')));
  eq(r.monotoneCap.constructor, 2);
  eq(r.persistentVars, ['constructor']);
  const s = scanReads(compile(GAMES['visited() tested after a menu']('toString')));
  eq(s.visitCap.toString, 3);
  eq(s.monotoneCap.toString, undefined);
  eq(scanReads(compile(GAMES['a story variable read in a condition']('valueOf'))).strLits.valueOf, undefined);
});
test('a @persistent counter named like a prototype member stops at its largest comparison', () => {
  for (const n of ['__proto__', 'constructor', 'hasOwnProperty']) {
    const r = explore(compile(GAMES['a @persistent counter'](n)));
    eq(r.endings.map(e => e.id + '@' + e.pass), ['first@1', 'again@2'], n);
    eq(r.unlocksPartial, false, n);
    eq(r.warnings, [], n);
  }
});
test('visited() of a scene named like a prototype member tells the visits apart', () => {
  for (const n of NAMES) {
    const r = explore(compile(GAMES['visited() tested after a menu'](n)));
    eq(r.endings.map(e => e.id).sort(), ['early', 'third'], n);
    eq(r.unreachedEndings, [], n);
  }
});

// ---- the command line: --seen, --set, --game, --from with these names -----------------
const playSeen = await cli(make('an ending read by ending_seen()', '__proto__'), ['play', 'g', '--seen', '__proto__']);
const playSet = await cli(make('a @persistent counter', '__proto__'), ['play', 'g', '--set', '__proto__=1']);
const exploreSeen = await cli(make('an ending read by ending_seen()', '__proto__'), ['explore', 'g', '--seen', '__proto__', '--json']);
const exploreSet = await cli(make('a @persistent counter', '__proto__'), ['explore', 'g', '--set', '__proto__=1', '--json']);
const playGame = await cli(make('a @gameplay', 'constructor'), ['play', 'g', '--game', 'constructor=lose']);
const playFrom = await cli(make('a scene and visited()', 'toString'), ['play', 'g', '--from', 'toString', '--choices', '2']);
test('play --seen and --set take endings and variables called __proto__', () => {
  eq(playSeen.code, 0, playSeen.text());
  ok(playSeen.text().includes('Welcome back.'), playSeen.text());
  eq(playSet.code, 0, playSet.text());
  ok(playSet.text().includes('Second time.'), playSet.text());
});
test('explore --seen and --set take endings and variables called __proto__', () => {
  const s = json(exploreSeen);
  eq(s.endings.find(e => e.id === 'back').pass, 1);
  const p = json(exploreSet);
  eq(p.endings.map(e => e.id + '@' + e.pass), ['again@1']);
  eq(JSON.stringify(p.endings[0].shortest.persist), '{"__proto__":1}');
});
test('play --game and --from take a gameplay and a scene named like prototype members', () => {
  eq(playGame.code, 0, playGame.text());
  ok(playGame.text().includes('gameplay constructor → lose'), playGame.text());
  eq(playFrom.code, 0, playFrom.text());
  ok(playFrom.text().includes('── toString ──') && playFrom.text().includes('ending "Left"'), playFrom.text());
});

// ---- the command line: command, topic and code names ----------------------------------
const cmdCtor = await cli({}, ['constructor']);
const cmdProto = await cli({}, ['__proto__']);
const cmdToString = await cli({}, ['toString', '--json']);
const docsCtor = await cli({}, ['docs', 'constructor']);
const docsProto = await cli({}, ['docs', '__proto__', '--json']);
const explainCtor = await cli({}, ['explain', 'hasOwnProperty']);
test('`shiori constructor` is an unknown command, not a silent success or a crash', () => {
  for (const h of [cmdCtor, cmdProto]) {
    eq(h.code, 2, h.text());
    ok(h.text().startsWith('Unknown command `'), h.text());
  }
  eq(cmdToString.code, 2);
  eq(json(cmdToString).error.message, 'Unknown command `toString`.');
});
test('`shiori docs constructor` says nothing is called that', () => {
  eq(docsCtor.code, 1, docsCtor.text());
  ok(docsCtor.text().startsWith('Nothing called `constructor`.'), docsCtor.text());
  eq(docsProto.code, 1);
  eq(json(docsProto).error.message, 'Nothing called `__proto__`.');
  eq(explainCtor.code, 1);
  ok(explainCtor.text().startsWith('Unknown code HASOWNPROPERTY.'), explainCtor.text());
});

// ---- the core modules called directly ---------------------------------------------
test('docs: a module called constructor gets its own section', () => {
  const reg = defaultRegistry([{ name: 'constructor', commands: [{ name: 'zap', summary: 'Zaps.', syntax: '@zap', exec() {} }] }]);
  const ref = commandReference(reg);
  ok(ref.includes('## Module: constructor\n\n### `@zap`'), ref.slice(-300));
});
test('assets: template placeholders are looked up as own properties', () => {
  eq(fillTemplate('c/{toString}_{pose}.png', { pose: 'stand' }), 'c/{toString}_stand.png');
  eq(fillTemplate('c/{constructor}.png', { constructor: 'a' }), 'c/a.png');
  eq(expandTemplate('c/{valueOf}.png', {}), []);
  const groups = Object.create(null);
  groups.__proto__ = ['a', 'b'];
  eq(expandTemplate('c/{__proto__}.png', groups), ['c/a.png', 'c/b.png']);
  const p = compile(GAMES['a character, its attribute group and a position']('__proto__'));
  eq(checkAssets(p, () => false).map(d => d.message), ['`__proto__` sprite: 2 of 2 images not found (c/a.png, c/b.png).']);
});
test('analyze and vndb count speakers and gameplay by name', () => {
  const a = analyze(compile(GAMES['a character, its attribute group and a position']('constructor')));
  eq(Object.keys(a.perCharacter), ['constructor']);
  eq([a.perCharacter.constructor.name, a.perCharacter.constructor.lines], ['Ann', 1]);
  const s = analyze(compile(GAMES['a one-off speaker']('toString')));
  eq([s.perCharacter.toString.name, s.perCharacter.toString.lines], ['toString', 1]);
  const v = vndbReport(compile(GAMES['a @gameplay']('valueOf')));
  ok(v.checks.find(c => c.id === 'interactivity').detail.includes('Gameplay: valueOf (~2 min).'), JSON.stringify(v.checks[0]));
});
test('explore, analyze and vndb give the same results for a program read back from JSON', () => {
  for (const what of ['an ending read by ending_seen()', 'a @persistent counter', 'a character, its attribute group and a position', 'a one-off speaker']) {
    for (const n of ['constructor', '__proto__']) {
      const p = compile(GAMES[what](n));
      const back = JSON.parse(JSON.stringify(p));
      eq(JSON.stringify(explore(back)), JSON.stringify(explore(p)), what + ' ' + n);
      eq(JSON.stringify(analyze(back)), JSON.stringify(analyze(p)), what + ' ' + n);
      eq(JSON.stringify(vndbReport(back)), JSON.stringify(vndbReport(p)), what + ' ' + n);
    }
  }
});

// ---- shiori vndb --passes -----------------------------------------------------------
const CHAIN = `SHIORI 1\ntitle: T\n# start\nYear.\n* Spring.\n  @ending spring "Spring"\n  -> END\n* [if ending_seen("spring")] Summer.\n  @ending summer "Summer"\n  -> END\n* [if ending_seen("summer")] Autumn.\n  @ending autumn "Autumn"\n  -> END\n`;
const vndbOne = await cli(game(CHAIN), ['vndb', 'g', '--passes', '1', '--json']);
const vndbFull = await cli(game(CHAIN), ['vndb', 'g', '--passes=8', '--json']);
const vndbOneText = await cli(game(CHAIN), ['vndb', 'g', '--passes', '1']);
const vndbStates = await cli(game(CHAIN), ['vndb', 'g', '--max-states', '1', '--json']);
const vndbZero = await cli(game(CHAIN), ['vndb', 'g', '--passes', '0']);
const vndbWord = await cli(game(CHAIN), ['vndb', 'g', '--passes', 'many']);
const vndbBare = await cli(game(CHAIN), ['vndb', 'g', '--passes']);
const vndbHelp = await cli({}, ['help']);
const vndbDocs = await cli({}, ['docs', 'vndb']);
test('vndb --passes sets the most playthroughs in a row for its explore run', () => {
  eq(vndbOne.code, 0, vndbOne.text().slice(0, 300));
  const short = json(vndbOne).checks.find(c => c.id === 'explore');
  ok(short && short.detail.startsWith('After 1 playthrough in a row from 1 different set of endings seen'), JSON.stringify(json(vndbOne).checks));
  eq(short.fix, 'If the game needs more playthroughs in a row, try `--passes 2`.');
  ok(vndbOneText.text().includes('  - If the game needs more playthroughs in a row, try `--passes 2`.'), vndbOneText.text());
  eq(vndbFull.code, 0);
  const full = json(vndbFull);
  eq(full.checks.filter(c => c.id === 'explore'), []);
  eq(full.stats.endings, 3);
  ok(full.tags.some(t => t.name === 'Multiple Endings'));
  const cut = json(vndbStates).checks.find(c => c.id === 'explore');
  eq(cut.fix, 'To explore further, run `shiori vndb --max-states 8`.');
});
test('vndb --passes is checked like explore --passes (exit 2)', () => {
  eq(vndbZero.code, 2);
  eq(vndbZero.text(), '`--passes 0` is not valid: it takes a whole number above 0.\n  hint: Write `--passes <n>`.');
  eq(vndbWord.code, 2);
  eq(vndbWord.text(), '`--passes many` is not valid: it takes a whole number above 0.\n  hint: Write `--passes <n>`.');
  eq(vndbBare.code, 2);
  eq(vndbBare.text(), '`--passes` needs a value.\n  hint: Write `--passes <n>`.');
});
test('vndb help lists --passes', () => {
  const h = vndbHelp.text();
  const section = h.slice(h.indexOf('\n  vndb '), h.indexOf('\n  docs '));
  ok(/--passes <n>\s+most playthroughs in a row/.test(section), section);
  ok(/--max-states <n>/.test(section) && /--no-explore/.test(section), section);
  const d = vndbDocs.text();
  ok(d.startsWith('shiori vndb <folder> [--no-explore] [--max-states n] [--passes n] [--json]'), d);
  ok(d.includes('--max-states and --passes work as in `shiori explore`'), d);
});

// ---- shiori explain for the codes added last round ---------------------------------
const explains = {};
for (const code of ['R706', 'W622', 'W623']) {
  explains[code] = { text: await cli({}, ['explain', code]), json: await cli({}, ['explain', code.toLowerCase(), '--json']) };
}
test('shiori explain R706, W622 and W623 print a title and help', () => {
  for (const [code, { text, json: j }] of Object.entries(explains)) {
    eq(text.code, 0, code);
    const lines = text.text().split('\n');
    ok(lines[0].startsWith(code + ': ') && lines[0].length > code.length + 4, lines[0]);
    ok(lines.length >= 3 && lines[2].length > 20, text.text());
    eq(j.code, 0, code);
    const r = json(j);
    eq(r.code, code);
    ok(r.title && r.help, JSON.stringify(r));
  }
});
