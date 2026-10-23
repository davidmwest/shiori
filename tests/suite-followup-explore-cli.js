// Follow-up suite (explore + CLI): replay quoting of --set values, the R706
// note when replays stop, and `shiori explore` printing never-unlocked
// choices, partial results, --passes, default-route replays and its help;
// `stats --by-scene` word weights. CLI commands run against in-memory folders.
import { test, eq, ok, one, errors } from './harness.js';
import { normalizePath } from '../tools/host.js';
import { explore, replayArgs } from '../engine/core/explore.js';
import { wordWeight } from '../engine/core/util.js';

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
function json(h) { try { return JSON.parse(h.text()); } catch (e) { throw new Error('not JSON: ' + h.text().slice(0, 200)); } }
const game = (src) => ({ 'g/game.story': src });
const compile = (src) => {
  const r = one(src);
  eq(errors(r).map(e => e.code + ' ' + e.message), [], 'compile errors');
  return r.program;
};
// Split a command line the way a POSIX shell does for '…', "…" and \x.
function shellWords(line) {
  const words = [];
  let cur = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'") { const j = line.indexOf("'", i + 1); cur = (cur || '') + line.slice(i + 1, j); i = j; }
    else if (c === '"') { const j = line.indexOf('"', i + 1); cur = (cur || '') + line.slice(i + 1, j); i = j; }
    else if (c === '\\') { cur = (cur || '') + line[++i]; }
    else if (c === ' ') { if (cur != null) words.push(cur); cur = null; }
    else cur = (cur || '') + c;
  }
  if (cur != null) words.push(cur);
  return words;
}
const replayLine = (h, title) => {
  const lines = h.text().split('\n');
  const i = lines.findIndex(l => l.includes('★ ' + title));
  const r = lines.slice(i + 1).find(l => l.trim().startsWith('replay:'));
  return r ? r.trim().replace(/^replay:\s+/, '').replace(/\s+\(⚠.*$/, '') : null;
};

// ---- replayArgs quotes --set values like every other value ---------------------------
const NICK = `SHIORI 1
title: Nick
@persistent nick = ""

# start
Fork.
* [if nick == "Old Friend's"] Welcome back.
  @ending back "Back"
  -> END
* Meet.
  @set nick = "Old Friend's"
  @ending met "Met"
  -> END
`;
const nickExplore = await cli(game(NICK), ['explore', 'g']);
const nickLine = replayLine(nickExplore, 'Back');
const nickPlay = nickLine ? await cli(game(NICK), shellWords(nickLine).slice(1)) : null;
test('a --set value with spaces and a quote is shell-quoted, and the printed replay works', () => {
  eq(nickLine, "shiori play g --choices 1 --set 'nick=Old Friend'\\''s'");
  eq(shellWords(nickLine), ['shiori', 'play', 'g', '--choices', '1', '--set', "nick=Old Friend's"]);
  eq(nickPlay.code, 0, nickPlay.text());
  ok(nickPlay.text().includes('ending "Back"'), nickPlay.text());
});
test('replayArgs passes every value through the same quoting', () => {
  const e = { shortest: { path: [{ choice: 2 }, { game: 'coin', result: 'heads up' }], rolls: [3, true], seen: ['a'], persist: { nick: 'Ann Lee', runs: 2, met: true } } };
  eq(replayArgs(e), "--choices 2 --game 'coin=heads up' --rolls 3,true --seen a --set 'nick=Ann Lee,runs=2,met=true'");
  eq(replayArgs({ shortest: { path: [], rolls: [], seen: [], persist: { runs: 2 } } }), '--set runs=2');
});

// ---- the note when replays stop (R706) -------------------------------------------
const COUNTER = `SHIORI 1
title: Counter
@persistent runs = 0

# start
@set runs = runs + 1
@if runs >= 20
  Twentieth time.
  @ending far "Far"
  -> END
Again.
@ending again "Again"
-> END
`;
const CHAIN = `SHIORI 1\ntitle: T\n# start\nYear.\n* Spring.\n  @ending spring "Spring"\n  -> END\n* [if ending_seen("spring")] Summer.\n  @ending summer "Summer"\n  -> END\n* [if ending_seen("summer")] Autumn.\n  @ending autumn "Autumn"\n  -> END\n`;
test('the replay-limit note has code R706 and a hint that fits the limit hit', () => {
  const unbounded = explore(compile(COUNTER));
  const w = unbounded.warnings.find(x => x.code === 'R706');
  ok(w, JSON.stringify(unbounded.warnings));
  ok(/Stopped replaying after 16 playthroughs in a row/.test(w.message), w.message);
  ok(w.hint.includes('`--passes 32`'), w.hint);
  ok(w.hint.includes('`+=`'), 'counter advice: ' + w.hint);
  const short = explore(compile(CHAIN), { passes: 1 });
  const s = short.warnings.find(x => x.code === 'R706');
  ok(/after 1 playthrough in a row and 1 different set of endings/.test(s.message), s.message);
  eq(s.hint, 'If the game needs more playthroughs in a row, try `--passes 2`.');
  const opts = Array.from({ length: 8 }, (_, i) => `* E${i}.\n  @if ending_seen("e${i}")\n    Again ${i}.\n  @ending e${i} "E${i}"\n  -> END`).join('\n');
  const many = explore(compile(`SHIORI 1\ntitle: T\n# start\nPick.\n${opts}\n`), { maxUnlockStates: 20 });
  const m = many.warnings.find(x => x.code === 'R706');
  ok(m.hint.includes('shiori play --seen'), m.hint);
  ok(!m.hint.includes('--passes'), 'the passes limit was not hit: ' + m.hint);
  eq(explore(compile(CHAIN)).warnings, [], 'no note when replays run out by themselves');
});

// ---- explore: partial results when replays stop -----------------------------------
const counterText = await cli(game(COUNTER), ['explore', 'g']);
const counterJson = await cli(game(COUNTER), ['explore', 'g', '--json']);
test('explore treats stopped replays as partial: "not reached yet", exit 0, no STOPPED EARLY', () => {
  const t = counterText.text();
  eq(counterText.code, 0, t);
  ok(t.includes('Endings not reached within the budget:') && t.includes('? Far [far]'), t);
  ok(!t.includes('W611'), 'not a W611 claim: ' + t);
  ok(!t.includes('STOPPED EARLY'), 'STOPPED EARLY is for --max-states only: ' + t);
  ok(t.includes('⚠ R706 Stopped replaying'), t);
  ok(t.includes('      hint: If the game needs more playthroughs in a row, try `--passes 32`.'), t);
  ok(t.includes('not shown yet') && !t.includes('never shown'), t);
  eq(counterJson.code, 0);
  eq(json(counterJson).unlocksPartial, true);
});

// ---- explore --passes ------------------------------------------------------------
const chainOne = await cli(game(CHAIN), ['explore', 'g', '--passes', '1', '--json']);
const chainFull = await cli(game(CHAIN), ['explore', 'g', '--passes=8', '--json']);
const passesZero = await cli(game(CHAIN), ['explore', 'g', '--passes', '0']);
const passesWord = await cli(game(CHAIN), ['explore', 'g', '--passes', 'many']);
const passesBare = await cli(game(CHAIN), ['explore', 'g', '--passes']);
const passesPlay = await cli(game(CHAIN), ['play', 'g', '--passes', '2']);
const counterMore = await cli(game(COUNTER), ['explore', 'g', '--passes', '24']);
test('explore --passes sets the most playthroughs in a row', () => {
  const one1 = json(chainOne);
  eq(one1.playthroughs, 1);
  eq(one1.unlocksPartial, true);
  eq(one1.endings.map(e => e.id), ['spring']);
  eq(chainOne.code, 0, 'unreached endings are not reached yet');
  const full = json(chainFull);
  eq(full.endings.map(e => e.id).sort(), ['autumn', 'spring', 'summer']);
  eq(full.unlocksPartial, false);
  eq(full.passes, 3);
  ok(counterMore.text().includes('★ Far [far]'), counterMore.text());
  ok(counterMore.text().includes('try `--passes 48`'), counterMore.text());
});
test('--passes is checked like the other options', () => {
  eq(passesZero.code, 2);
  eq(passesZero.text(), '`--passes 0` is not valid: it takes a whole number above 0.\n  hint: Write `--passes <n>`.');
  eq(passesWord.code, 2);
  ok(passesWord.text().includes('`--passes many` is not valid'), passesWord.text());
  eq(passesBare.code, 2);
  ok(passesBare.text().includes('`--passes` needs a value.'), passesBare.text());
  eq(passesPlay.code, 2);
  ok(passesPlay.text().includes('`--passes` is an option of `shiori explore`'), passesPlay.text());
});

// ---- explore: choices whose [require] is never true (finding 50) ------------------
const LOCKED = `SHIORI 1
title: Locked
@var has_key = false

# start
Door.
* [require has_key "You need the key."] Unlock the door.
* Give up.
Dark.
@ending done "Done"
-> END
`;
const locked = await cli(game(LOCKED), ['explore', 'g']);
const lockedJson = await cli(game(LOCKED), ['explore', 'g', '--json']);
test('explore lists choices that stay locked on every route, exit 0', () => {
  eq(locked.code, 0, locked.text());
  ok(locked.text().includes('  Choice never unlocked: "Unlock the door." (game.story:7) — its [require] is false on every route.'), locked.text());
  eq(lockedJson.code, 0);
  eq(json(lockedJson).options.neverTaken.map(o => o.text), ['Unlock the door.']);
});
const LOCKED_PARTIAL = COUNTER.replace('Again.\n', 'Again.\n* [require runs < 0] Rewind.\n* Go on.\n');
const lockedPartial = await cli(game(LOCKED_PARTIAL), ['explore', 'g']);
test('when the search is partial a locked choice is "not unlocked yet"', () => {
  const t = lockedPartial.text();
  ok(t.includes('  Choice not unlocked yet: "Rewind." (game.story:'), t);
  ok(!t.includes('its [require] is false on every route'), t);
});

// ---- explore: a route that needs no arguments ------------------------------------
const INPUT = `SHIORI 1
title: Input
@var player_name = ""

# start
A form.
@input player_name "Name?"
@if player_name == ""
  Sent away.
  @ending nameless "Nameless"
  -> END
Welcome, {$player_name}.
@ending registered "Registered"
-> END
`;
const inputHere = await cli({ 'game.story': INPUT }, ['explore']);
const inputThere = await cli({ 'my game/game.story': INPUT }, ['explore', 'my game']);
const LINEAR = `SHIORI 1\ntitle: Linear\n\n# start\nOne road.\n-> END\n`;
const linear = await cli(game(LINEAR), ['explore', 'g']);
test('a default route gets a plain `shiori play <folder>` replay line', () => {
  eq(replayLine(inputHere, 'Nameless'), 'shiori play');
  eq(replayLine(inputHere, 'Registered'), 'shiori play --choices Player');
  eq(replayLine(inputThere, 'Nameless'), "shiori play 'my game'");
  eq(replayLine(linear, '(end of story)'), 'shiori play g');
});

// ---- explore help ----------------------------------------------------------------
const help = await cli({}, ['help']);
const docsExplore = await cli({}, ['docs', 'explore']);
test('explore help mentions @input answers, replays and --passes', () => {
  for (const h of [help, docsExplore]) {
    const t = h.text();
    ok(t.includes('@input answers (the default,'), t);
    ok(t.includes('ending_seen(), endings_seen() or @persistent'), t);
    ok(/--passes <n>\s+most playthroughs in a row/.test(t), t);
  }
});

// ---- stats --by-scene word weights ------------------------------------------------
const MIXED = `SHIORI 1
title: Mixed

# start
栞の物語です。
Hello there, friend.
สวัสดีครับ ผมชื่อสมชาย
-> other

# other
Привет, как дела?
-> END
`;
const byScene = await cli(game(MIXED), ['stats', 'g', '--by-scene']);
test('stats --by-scene weighs words with wordWeight (every script)', () => {
  const t = byScene.text();
  const row = (id) => { const m = t.match(new RegExp('\\n\\s+' + id + '\\s+(\\d+) words')); return m ? Number(m[1]) : null; };
  eq(row('start'), Math.round(wordWeight('栞の物語です。') + wordWeight('Hello there, friend.') + wordWeight('สวัสดีครับ ผมชื่อสมชาย')), t);
  eq(row('other'), 3, t);
});
