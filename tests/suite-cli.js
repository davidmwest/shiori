// CLI suite: tools/host.js (the jsc host) and tools/cli.js, run against an
// in-memory game folder. Commands are async, so each is run first and the
// tests check the captured output.
import { test, eq, ok } from './harness.js';
import { fromLatin1, normalizePath, jscPath, parseHostInfo, createJscHost } from '../tools/host.js';

globalThis.__shioriEmbedded = true;
const { runCli, shq, describeError, parseArgs } = await import('../tools/cli.js');

// ---- an in-memory host ------------------------------------------------------
// files: { 'g/game.story': '...' } relative to the current folder. ids: optional
// file ids, to stand for two paths of one file (a symlink).
function vhost(files, args, opts = {}) {
  const norm = (p) => normalizePath(p);
  const has = (p) => Object.prototype.hasOwnProperty.call(files, norm(p));
  const dirs = new Set(['.']);
  for (const f of Object.keys(files)) { const parts = f.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/')); }
  const lines = [];
  const h = {
    kind: 'test', args, cwd: '/virtual', code: 0,
    print: (s) => lines.push(String(s)), printErr: (s) => lines.push(String(s)),
    read: opts.read || ((p) => has(p) ? files[norm(p)] : null),
    exists: (p) => has(p),
    isDir: (p) => dirs.has(norm(p)),
    subdirs: (p) => { const k = norm(p), pre = k === '.' ? '' : k + '/'; return [...dirs].filter(d => d !== '.' && d.startsWith(pre) && !d.slice(pre.length).includes('/')).map(d => d.slice(pre.length)); },
    list: (dir) => { const k = norm(dir), pre = k === '.' ? '' : k + '/'; return dirs.has(k) ? Object.keys(files).filter(f => f.startsWith(pre)).map(f => f.slice(pre.length)) : null; },
    fileId: (p) => has(p) ? (opts.ids && opts.ids[norm(p)]) || norm(p) : null,
    moduleUrl: (p) => '/nonexistent-shiori-test/' + norm(p),
    exit: (c) => { h.code = c; },
  };
  h.text = () => lines.join('\n');
  return h;
}
async function cli(files, args, opts) { const h = vhost(files, args, opts); await runCli(h); return h; }
function json(h) { try { return JSON.parse(h.text()); } catch (e) { throw new Error('not JSON: ' + h.text().slice(0, 200)); } }

// ---- host.js: jsc arguments and paths ----------------------------------------
test('fromLatin1 restores UTF-8 arguments that jsc decoded as Latin-1', () => {
  eq(fromLatin1('æ \u009e'), '栞');
  eq(fromLatin1('cafÃ©'), 'café');
  eq(fromLatin1('JosÃ©=1,name=æ \u009e'), 'José=1,name=栞');
  eq(fromLatin1('plain ascii'), 'plain ascii');
  eq(fromLatin1('栞'), '栞', 'already decoded');
  eq(fromLatin1('café'), 'café', 'real Latin-1 that is not UTF-8 stays');
});
test('normalizePath collapses ./ and x/.. and keeps leading ..', () => {
  eq(normalizePath('g/./story/ch1.story'), 'g/story/ch1.story');
  eq(normalizePath('./story/a'), 'story/a');
  eq(normalizePath('g/../shared/x'), 'shared/x');
  eq(normalizePath('g/../../shared'), '../shared');
  eq(normalizePath('/a/b/../c//d/'), '/a/c/d');
  eq(normalizePath('.'), '.');
  eq(normalizePath('a/..'), '.');
});
test('jscPath escapes the characters jsc reads as URL syntax', () => {
  eq(jscPath('/x/h#a/p%41c/q?b/栞 x'), '/x/h%23a/p%2541c/q%3Fb/栞 x');
});
test('parseHostInfo reads the wrapper file and skips junk', () => {
  const i = parseHostInfo('cwd /a b\ndir g\nf 1:2 ./game.story\nf 1:3 ./has space/x.story\njunk\nparent .\nsub g\nsub h i\n');
  eq(i.cwd, '/a b');
  eq(i.dirs[0].files, ['game.story', 'has space/x.story']);
  eq(i.dirs[0].ids.get('game.story'), '1:2');
  eq(i.parents[0].subdirs, ['g', 'h i']);
});

{
  const CWD = '/home/u/栞';
  const disk = {
    [CWD + '/games/g/game.story']: 'MAIN',
    [CWD + '/games/g/story/ch1.story']: 'CH1',
    [CWD + '/games/g/Story/CH1.story']: 'CH1 (case-insensitive disk)',
    [CWD + '/games/shared/common.story']: 'COMMON',
    [jscPath(CWD + '/h#x/m.js')]: 'MODULE',
  };
  const info = `cwd ${CWD}\ndir games/g\nf 1:10 ./game.story\nf 1:11 ./story/ch1.story\nf 1:11 ./link/ch1.story\nparent games\nsub g\nsub other\n`;
  const calls = [];
  const sys = {
    readFile(p) { if (p === '/tmp/info') return info; calls.push(p); if (p in disk) return disk[p]; throw new Error('Could not open file: ' + p); },
    print() {}, readline: () => 'cafÃ©',
  };
  // jsc hands over UTF-8 arguments as Latin-1.
  const h = createJscHost(['--host-info', '/tmp/info', 'play', 'games/g', '--set', 'name=JosÃ©', '--choices', 'æ \u009e'], sys);
  test('jsc host: arguments are UTF-8 and the cwd comes from the info file', () => {
    eq(h.args, ['play', 'games/g', '--set', 'name=José', '--choices', '栞']);
    eq(h.cwd, CWD);
    eq(h.readLine(), 'café');
  });
  test('jsc host: ./ and x/.. paths find listed files', () => {
    eq(h.read('games/g/./story/ch1.story'), 'CH1');
    eq(h.read('games/g/story/../game.story'), 'MAIN');
    ok(h.exists('games/g/./story/ch1.story'));
    eq(h.list('games/g/'), ['game.story', 'story/ch1.story', 'link/ch1.story']);
    eq(h.list('games/other'), null);
  });
  test('jsc host: inside a listed folder the listing decides (case matters, no readFile noise)', () => {
    calls.length = 0;
    eq(h.read('games/g/Story/CH1.story'), null);
    eq(h.exists('games/g/missing.png'), false);
    eq(calls, []);
  });
  test('jsc host: paths outside the listed folder are read from disk', () => {
    eq(h.read('games/g/../shared/common.story'), 'COMMON');
    eq(h.read('games/shared/nope.story'), null);
  });
  test('jsc host: folders, siblings and file ids', () => {
    eq(h.isDir('games/g'), true);
    eq(h.isDir('.'), true);
    eq(h.isDir('games/other'), true);
    eq(h.isDir('games/othr'), false);
    eq(h.subdirs('games'), ['g', 'other']);
    eq(h.fileId('games/g/link/ch1.story'), h.fileId('games/g/./story/ch1.story'));
  });
  test('jsc host: module URLs are absolute and escaped', () => {
    eq(h.moduleUrl('h#x/m.js'), jscPath(CWD + '/h#x/m.js'));
    eq(h.moduleUrl('/abs/p%41.js'), '/abs/p%2541.js');
  });
}

// ---- fixtures ------------------------------------------------------------------
const RETRY = `SHIORI 1
title: Retry
@gameplay coin games/coin.js minutes=0.2 results="lose win"
@var result = ""

# start
The ferryman offers a coin toss.
-> toss

# toss
@game coin into=result
@if result == "lose"
  -> toss
You win the toss.
@ending free "Free" kind=good
-> END
`;
const WAIT = `SHIORI 1
title: Wait

# start
The clock ticks.
-> tick

# tick
@wait 1
-> tick
`;
const ORPHAN = `SHIORI 1
title: Orphan

# start
Hello.
-> END

# confession
Nobody gets here.
-> END
`;
const VARS = `SHIORI 1
title: Vars
@var trust = 0
@var asked = false
@persistent met = false
@var name = "Mio"

# start
Hello {$name}.
* Stay.
  You stay.
  @ending stay "Stay" kind=good
  -> END
* Leave.
  You leave.
  @ending leave "Leave" kind=bad
  -> END
`;
const files = (game, extra = {}) => ({ 'g/game.story': game, ...extra });

// ---- play: loops without a line (finding 5) -------------------------------------
const retry = await cli(files(RETRY), ['play', 'g']);
const retryJson = await cli(files(RETRY), ['play', 'g', '--json']);
const retryWin = await cli(files(RETRY), ['play', 'g', '--game', 'coin=lose,coin=win', '--quiet']);
const wait = await cli(files(WAIT), ['play', 'g', '--max', '50']);
test('play stops a @game retry loop with R703 and suggests the other result', () => {
  eq(retry.code, 1);
  ok(/ERROR R703: The story looped \d+ times without showing a line or a choice/.test(retry.text()), retry.text().slice(-300));
  ok(retry.text().includes('--game coin=win'), 'hint');
  ok(retry.text().split('\n').length < 200, 'repeats are not all printed');
  const t = json(retryJson).transcript;
  eq(t[t.length - 1].code, 'R703');
  eq(retryJson.code, 1);
});
test('play with the right --game results still finishes', () => {
  eq(retryWin.code, 0);
  ok(retryWin.text().includes('Ending: Free'), retryWin.text());
});
test('play stops a @wait loop with R703 (it used to hang)', () => {
  eq(wait.code, 1);
  ok(wait.text().includes('R703') && wait.text().includes('@wait'), wait.text().slice(-300));
});

// ---- check: W600 (findings 19, 27) ---------------------------------------------
const orphan = await cli(files(ORPHAN), ['check', 'g']);
const orphanStrict = await cli(files(ORPHAN), ['check', 'g', '--strict', '--json']);
test('check warns W600 for a scene nothing leads to', () => {
  ok(/game\.story:8: warning\[W600\] Scene `confession` is never reached/.test(orphan.text()), orphan.text());
  eq(orphan.code, 0);
  ok(!orphan.text().includes('All clear'));
  eq(orphanStrict.code, 1);
  ok(json(orphanStrict).diagnostics.some(d => d.code === 'W600' && d.line === 8));
});

// ---- options (finding 20) --------------------------------------------------------
const optCases = {
  scene: await cli(files(VARS), ['play', 'g', '--scene', 'start']),
  choice: await cli(files(VARS), ['play', 'g', '--choice', '1']),
  verbose: await cli(files(VARS), ['check', '--verbose', 'g']),
  format: await cli(files(VARS), ['graph', 'g', '--format', 'svg']),
  noValue: await cli(files(VARS), ['play', 'g', '--from']),
  docsGame: await cli(files(VARS), ['docs', '--game']),
  extra: await cli(files(VARS), ['play', 'g', '1,2']),
  max: await cli(files(VARS), ['play', 'g', '--max', 'many']),
  json: await cli(files(VARS), ['play', 'g', '--choise', '1', '--json']),
  fromStory: await cli({ 'game.story': VARS, 'story/a.story': '' }, ['play', '--from', 'story']),
};
test('a value that names a folder is a value, not the game folder', () => {
  eq(optCases.fromStory.code, 1);
  ok(optCases.fromStory.text().includes('Unknown scene `story` in --from'), optCases.fromStory.text());
});
test('unknown options are rejected with a suggestion (exit 2)', () => {
  eq(optCases.scene.code, 2);
  ok(optCases.scene.text().includes('Unknown option `--scene`') && optCases.scene.text().includes('--from'), optCases.scene.text());
  ok(optCases.choice.text().includes('Did you mean `--choices`?'), optCases.choice.text());
  eq(optCases.verbose.code, 2);
  ok(optCases.verbose.text().includes('Unknown option `--verbose`'), optCases.verbose.text());
  eq(json(optCases.json).ok, false);
});
test('value options need a valid value', () => {
  for (const k of ['format', 'noValue', 'docsGame', 'max']) eq(optCases[k].code, 2, k);
  ok(optCases.format.text().includes('mermaid, dot or json'));
  ok(optCases.noValue.text().includes('`--from` needs a value'));
  ok(optCases.docsGame.text().includes('--game <folder>'));
});
test('a stray argument is an error, with a hint for choice lists', () => {
  eq(optCases.extra.code, 2);
  ok(optCases.extra.text().includes('--choices 1,2'), optCases.extra.text());
});
test('parseArgs: a value flag takes its value even when it names a folder', () => {
  const { o } = parseArgs(['play', '--from', 'story', '--set', 'a=1', '--set=b=2', '--quiet']);
  eq(o._, ['play']);
  eq(o.from, 'story');
  eq(o.set, 'a=1,b=2');
  eq(o.quiet, true);
});

// ---- missing folder (finding 21) ------------------------------------------------
const lk = { 'examples/lantern-keeper/game.story': VARS, 'examples/other/game.story': VARS };
const typo = await cli(lk, ['check', 'examples/lantern-keper']);
const typoJson = await cli(lk, ['check', 'examples/lantern-keper', '--json']);
const noStory = await cli(lk, ['play', 'examples']);
test('a mistyped folder gives one error with a suggestion, never W605', () => {
  eq(typo.code, 1);
  ok(typo.text().includes('No folder `examples/lantern-keper`') && typo.text().includes('Did you mean `examples/lantern-keeper`?'), typo.text());
  ok(!typo.text().includes('W605'));
  const j = json(typoJson);
  eq(j.ok, false);
  eq(j.diagnostics.length, 1);
  ok(noStory.text().includes('`examples` has no game.story'), noStory.text());
  eq(noStory.code, 1);
});

// ---- --json everywhere (finding 23) ---------------------------------------------
const js = {
  explain: await cli({}, ['explain', 'E113', '--json']),
  explainBad: await cli({}, ['explain', 'E999', '--json']),
  docs: await cli({}, ['docs', 'nosuch', '--json']),
  topic: await cli({}, ['docs', 'choices', '--json']),
  from: await cli(files(VARS), ['play', 'g', '--from', 'nosuch', '--json']),
  set: await cli(files(VARS), ['play', 'g', '--set', 'nosuch=1', '--json']),
  seen: await cli(files(VARS), ['explore', 'g', '--seen', 'nosuch', '--json']),
  command: await cli({}, ['frobnicate', '--json']),
  state: await cli(files(VARS), ['play', 'g', '--state', '--json']),
};
test('--json errors are JSON', () => {
  eq(json(js.explain).code, 'E113');
  for (const k of ['explainBad', 'docs', 'from', 'set', 'seen', 'command']) { const j = json(js[k]); eq(j.ok, false, k); ok(j.error && j.error.message, k); }
  eq(js.command.code, 2);
  eq(json(js.topic).topic, 'choices');
});
test('play --state --json puts the stage on each line, never null', () => {
  const t = json(js.state).transcript;
  ok(t.every(x => x && x.type), 'no null entries');
  ok(t.filter(x => x.type === 'say').every(x => x.stage && 'actors' in x.stage));
});

// ---- LMN check (finding 22) --------------------------------------------------------
const LMN_GAME = `SHIORI 1
title: LMN
@audio planned music/planned.lmn
@audio low music/low.lmn
@audio notes music/notes.txt

# start
@music planned
Soft.
@music low
Low.
@music notes
Notes.
-> END
`;
const PLANNED = '// Plan: gentle piano, 4/4 at 80 BPM.\n// form A*2\nLMN 1\ntitle: Planned\ntempo: 80\ntime: 4/4\nkey: C major\n\ntrack keys piano\n\nsection A bars=1\nkeys | {C}w |\n\nform: A*2\n';
const LOW = 'LMN 1\ntitle: Low\ntempo: 80\ntime: 4/4\nkey: C major\n\ntrack lead flute\n\nsection A bars=1\nlead | C2w |\n\nform: A\n';
const lmn = await cli(files(LMN_GAME, { 'g/music/planned.lmn': PLANNED, 'g/music/low.lmn': LOW, 'g/music/notes.txt': 'Buy milk.\n' }), ['check', 'g', '--json']);
const lmnStrict = await cli(files(LMN_GAME.replace(/^@audio notes.*\n/m, '').replace('@music notes\nNotes.\n', ''), { 'g/music/planned.lmn': PLANNED, 'g/music/low.lmn': LOW }), ['check', 'g', '--strict']);
test('LMN: a song that starts with // comments is a song; range notes are info', () => {
  const d = json(lmn).diagnostics;
  ok(!d.some(x => x.code === 'E303' && /planned/.test(x.message)), JSON.stringify(d));
  ok(d.some(x => x.code === 'W617' && x.severity === 'info' && /C2/.test(x.message)), JSON.stringify(d));
  ok(d.some(x => x.code === 'E303' && /notes\.txt is not an LMN song/.test(x.message)), 'a .txt that is not a song');
  eq(lmnStrict.code, 0, lmnStrict.text());
});

// ---- --set, --rolls, --game and leftover choices (finding 54) -----------------------
const pv = {
  badNum: await cli(files(VARS), ['play', 'g', '--set', 'trust=three']),
  noEq: await cli(files(VARS), ['play', 'g', '--set', 'trust']),
  ok: await cli(files(VARS), ['play', 'g', '--set', 'trust=2, asked=yes,name=Ann', '--json']),
  badBool: await cli(files(VARS), ['play', 'g', '--set', 'asked=maybe']),
  rolls: await cli(files(VARS), ['play', 'g', '--rolls', 'three']),
  explore: await cli(files(VARS), ['explore', 'g', '--set', 'trust=2']),
  exploreOk: await cli(files(VARS), ['explore', 'g', '--set', 'met=true']),
  unused: await cli(files(VARS), ['play', 'g', '--choices', '1,2,1']),
  unusedJson: await cli(files(VARS), ['play', 'g', '--choices', '1,2', '--json']),
  exact: await cli(files(VARS), ['play', 'g', '--choices', '1']),
  gameTypo: await cli(files(RETRY), ['play', 'g', '--game', 'cion=win']),
  resultTypo: await cli(files(RETRY), ['play', 'g', '--game', 'coin=wni']),
};
test('--set checks values against the variable type', () => {
  eq(pv.badNum.code, 1);
  ok(pv.badNum.text().includes('`trust` is a number variable'), pv.badNum.text());
  eq(pv.noEq.code, 1);
  ok(pv.noEq.text().includes('needs a value'));
  eq(pv.badBool.code, 1);
  eq(json(pv.ok).vars.trust, 2);
  eq(json(pv.ok).vars.asked, true);
  eq(json(pv.ok).vars.name, 'Ann');
  eq(pv.rolls.code, 1);
});
test('explore --set only takes @persistent variables', () => {
  eq(pv.explore.code, 1);
  ok(pv.explore.text().includes('not @persistent'), pv.explore.text());
  ok(pv.exploreOk.text().includes('Endings'), pv.exploreOk.text());
});
test('leftover --choices are reported (exit 1)', () => {
  eq(pv.unused.code, 1);
  ok(pv.unused.text().includes('Unused --choices: 2,1'), pv.unused.text());
  eq(json(pv.unusedJson).unusedChoices, ['2']);
  eq(pv.exact.code, 0);
});
test('--game names a declared gameplay and result', () => {
  ok(pv.gameTypo.text().includes('Did you mean `coin`?'), pv.gameTypo.text());
  ok(pv.resultTypo.text().includes('Did you mean `win`?'), pv.resultTypo.text());
  eq(pv.resultTypo.code, 1);
});

// ---- internal errors (finding 24) --------------------------------------------------
const crash = await cli(files(VARS), ['check', 'g'], { read: () => { null.boom(); } });
test('Internal error shows the error itself, not only the stack', () => {
  eq(crash.code, 70);
  ok(/Internal error: TypeError: /.test(crash.text()), crash.text());
  const jscStyle = { name: 'TypeError', message: 'vm.emitt is not a function', stack: 'exec@mods/sparkle.js:8:29' };
  eq(describeError(jscStyle), 'TypeError: vm.emitt is not a function\nexec@mods/sparkle.js:8:29');
  const v8Style = { name: 'TypeError', message: 'x', stack: 'TypeError: x\n    at f (a.js:1:1)' };
  eq(describeError(v8Style), v8Style.stack);
});

// ---- docs --game (finding 55) ------------------------------------------------------
const BROKEN = `SHIORI 1\ntitle: Broken\nmodules: mods/broken.js\n\n# start\nHi.\n-> END\n`;
const docsBroken = await cli(files(BROKEN, { 'g/mods/broken.js': 'syntax error (' }), ['docs', 'broken', '--game', 'g']);
const docsNoFolder = await cli(lk, ['docs', 'confetti', '--game', 'examples/lantern-keepr']);
test('docs --game reports modules that failed to load and missing folders', () => {
  ok(docsBroken.text().includes('error[E116]') && docsBroken.text().includes('could not be loaded'), docsBroken.text());
  eq(docsBroken.code, 1);
  ok(docsNoFolder.text().includes('No folder `examples/lantern-keepr`'), docsNoFolder.text());
  eq(docsNoFolder.code, 1);
});

// ---- explore replay quoting (finding 53) ---------------------------------------------
const spaced = await cli({ 'my game/game.story': VARS }, ['explore', 'my game']);
test('explore quotes a folder with spaces in its replay commands', () => {
  ok(spaced.text().includes("replay:   shiori play 'my game' --choices 1"), spaced.text());
  eq(shq('examples/x'), 'examples/x');
  eq(shq("it's here"), "'it'\\''s here'");
});

// ---- assets (finding 57) -----------------------------------------------------------
const ASSETS = `SHIORI 1
title: Assets
@image sky https://example.com/sky.png
@image dot data:image/svg+xml,%3Csvg%2F%3E
@image a bg/a.png
@image b bg/b.png
@image c bg/c.png
@character mio name="Mio" sprite=chars/mio/{expression}.png expression="neutral smile sad"

# start
@scene sky
@show mio
mio: Hi.
@bg dot
@bg a
@bg b
@bg c
-> END
`;
const assets = await cli(files(ASSETS), ['assets', 'g']);
const assetsJson = await cli(files(ASSETS), ['assets', 'g', '--json']);
const grouped = await cli(files(ASSETS), ['check', 'g']);
test('assets: remote and inline files are not shown as missing', () => {
  ok(/↗ sky {2}https:\/\/example\.com\/sky\.png {2}\(remote, not checked\)/.test(assets.text()), assets.text());
  ok(/✓ dot/.test(assets.text()));
  const a = json(assetsJson).assets;
  eq(a.find(x => x.id === 'sky').exists, true);
  eq(a.find(x => x.id === 'sky').remote, true);
  eq(a.find(x => x.id === 'a').exists, false);
});
test('check groups missing assets by file count', () => {
  ok(grouped.text().includes("6 declared asset files don't exist yet (bg/a.png, bg/b.png, bg/c.png, …)"), grouped.text());
});

// ---- paths: ./ includes and symlinked copies (finding 4) ------------------------------
const DOTSLASH = `SHIORI 1\ntitle: Dot\ninclude: ./story/ch1.story\n\n# start\nOne.\n-> next\n`;
const dot = await cli(files(DOTSLASH, { 'g/story/ch1.story': 'SHIORI 1\n# next\nTwo.\n-> END\n' }), ['check', 'g']);
const SYM = `SHIORI 1\ntitle: Sym\ninclude: story/ch1.story\n\n# start\nOne.\n-> next\n`;
const sym = await cli(files(SYM, { 'g/story/ch1.story': 'SHIORI 1\n# next\nTwo.\n-> END\n', 'g/realstory/ch1.story': 'SHIORI 1\n# next\nTwo.\n-> END\n' }), ['check', 'g'], { ids: { 'g/story/ch1.story': 'same', 'g/realstory/ch1.story': 'same' } });
const unlisted = await cli(files(SYM, { 'g/story/ch1.story': 'SHIORI 1\n# next\nTwo.\n-> END\n', 'g/story/old.story': 'SHIORI 1\n# old\nOld.\n' }), ['check', 'g']);
test('an included file is not W605 under another name (./x, symlink)', () => {
  ok(dot.text().includes('All clear'), dot.text());
  ok(sym.text().includes('All clear'), sym.text());
  ok(unlisted.text().includes('W605') && unlisted.text().includes('story/old.story'), 'a really unlisted file still warns');
});

// ---- stats lists @note notes (when the compiler provides program.notes) ----------------
const stats = await cli(files(`SHIORI 1\ntitle: Notes\n\n# start\n@note "TODO: rewrite"\nHi.\n-> END\n`), ['stats', 'g', '--json']);
test('stats --json has a notes list', () => {
  const j = json(stats);
  ok(Array.isArray(j.notes));
  if (j.notes.length) ok(j.notes[0].text.includes('TODO'), JSON.stringify(j.notes));
});
