// Analysis suite: word counts, reading runs, story graph, branching, the
// route explorer (unlocks across playthroughs, @input, visit counts) and
// the VNDB voicing draft.
import { test, eq, ok, one, errors, loadDir } from './harness.js';
import { countWords } from '../engine/core/util.js';
import { analyze, storyGraph } from '../engine/core/analyze.js';
import { explore, replayArgs, formatPath } from '../engine/core/explore.js';
import { vndbReport } from '../engine/core/vndb.js';

const compile = (src) => {
  const r = one(src);
  eq(errors(r).map(e => e.code + ' ' + e.message), [], 'compile errors');
  return r.program;
};
const lk = await loadDir('examples/lantern-keeper');
const say = (who, n, tag) => Array.from({ length: n }, (_, i) => `${who}: ${tag} ${i + 1}.`).join('\n');
const ids = (ex) => ex.endings.map(e => e.id).sort();
const ending = (ex, id) => ex.endings.find(e => e.id === id);

// ---- word counts in every script (finding 1) ----------------------------------
test('countWords counts words in non-Latin scripts', () => {
  eq(countWords('Привет, как дела?').words, 3, 'Russian');
  eq(countWords('Καλημέρα κόσμε').words, 2, 'Greek');
  eq(countWords('مرحبا بالعالم').words, 2, 'Arabic');
  eq(countWords('שלום עולם').words, 2, 'Hebrew');
  eq(countWords('नमस्ते दुनिया').words, 2, 'Hindi');
  eq(countWords('Tiếng Việt').words, 2, 'Vietnamese');
  eq(countWords('안녕하세요 세계').words, 2, 'Korean is written with spaces');
  ok(countWords('สวัสดีครับ ผมชื่อสมชาย').words > 2, 'Thai gets an estimate');
});
test('countWords keeps English and CJK counts', () => {
  eq(countWords("Hello, world — it's me.").words, 4);
  eq(countWords('Wait - what?').words, 2, 'a lone dash is not a word');
  eq(countWords('漢字とかな、カタカナー'), { words: 0, cjk: 10 });
  eq(countWords('mixed 漢字 text'), { words: 2, cjk: 2 });
});
test('a Russian game has words, narration and a VN verdict', () => {
  const lines = Array.from({ length: 40 }, () => 'Дождь стучит по крыше маяка, и море шумит внизу.');
  const p = compile(`SHIORI 1\ntitle: Маяк\nlanguage: ru\n@character mio name="Мио"\n# start\n${lines.join('\nmio: Ты опоздал.\n')}\n-> END\n`);
  const a = analyze(p);
  ok(a.reachableWords > 300, 'words ' + a.reachableWords);
  ok(a.narrationShare > 0.5, 'narration ' + a.narrationShare);
  const v = vndbReport(p, { analysis: a });
  ok(!v.checks.some(c => c.id === 'content'), 'no "No reachable text"');
  eq(v.checks.find(c => c.id === 'narration').status, 'pass');
});

// ---- reading runs follow the control flow (finding 17) ------------------------
test('W614 does not add up two scenes that only sit next to each other', () => {
  const a = analyze(compile(`SHIORI 1\ntitle: T\n@character mio name="Mio"\n# start\nThe pier.\n* Talk. -> a\n* Walk. -> b\n# a\nMio turns.\n${say('mio', 20, 'A')}\n-> END\n# b\n${say('mio', 20, 'B')}\nThe gulls cry.\n-> END\n`));
  eq(a.dialogueRuns, []);
  eq(a.maxDialogueRun.length, 20);
});
test('W614/W616 do not add up the bodies of different choices or @if sides', () => {
  const a = analyze(compile(`SHIORI 1\ntitle: T\n@character mio name="Mio"\n# start\nThe pier.\nmio: Well?\n* Agree.\n${say('  mio', 12, 'Agree')}\n* Disagree.\n${say('  mio', 12, 'No')}\n* Shrug.\n${say('  mio', 12, 'Shrug')}\nThe lamp flickers.\n-> END\n`));
  eq(a.dialogueRuns, []);
  eq(a.staticRuns, []);
  eq(a.maxDialogueRun.length, 13);
  const b = analyze(compile(`SHIORI 1\ntitle: T\n@var calm = true\n# start\n@if calm\n${Array.from({ length: 16 }, (_, i) => `  Calm ${i}.`).join('\n')}\n@else\n${Array.from({ length: 16 }, (_, i) => `  Rough ${i}.`).join('\n')}\n-> END\n`));
  eq(b.staticRuns, []);
});
test('a run that continues through a jump is still one run', () => {
  const a = analyze(compile(`SHIORI 1\ntitle: T\n@character mio name="Mio"\n# a\nThe pier.\n${say('mio', 20, 'A')}\n-> b\n# b\n${say('mio', 15, 'B')}\nThe gulls cry.\n-> END\n`));
  eq(a.dialogueRuns.map(r => [r.length, r.loc.line]), [[35, 6]]);
  eq(a.maxDialogueRun.length, 35);
});
test('NVL lines and @call do not confuse the run counts', () => {
  const a = analyze(compile(`SHIORI 1\ntitle: T\n@character mio name="Mio"\n# start\n@mode nvl\n${Array.from({ length: 40 }, (_, i) => `Page ${i}.`).join('\n')}\n@mode adv\n@call aside\nmio: Back.\n-> END\n# aside\n${say('mio', 10, 'Aside')}\n@return\n`));
  eq(a.staticRuns, []);
  eq(a.dialogueRuns, []);
  eq(a.maxDialogueRun.length, 11);
});
test('runs through a loop stay bounded', () => {
  const a = analyze(compile(`SHIORI 1\ntitle: T\n@character mio name="Mio"\n# start\nThe pier.\n-> hub\n# hub\nmio: Ask.\n* [once] One.\n  mio: 1a.\n  mio: 1b.\n  -> hub\n* [once] Two.\n  mio: 2a.\n  -> hub\n* Leave.\n  Night falls.\n  -> END\n`));
  ok(a.maxDialogueRun.length >= 4 && a.maxDialogueRun.length <= 6, 'loop run ' + a.maxDialogueRun.length);
});

// ---- story graph (findings 18, 48) ---------------------------------------------
const edges = (p, kind) => [...new Set(storyGraph(p).edges.filter(e => !kind || e.kind === kind).map(e => e.from + '>' + e.to))].sort();
test('graph: a gathering menu falls through into the next scene', () => {
  eq(edges(compile(`SHIORI 1\ntitle: T\n@var trust = 0\n# harbor\nTide.\n* Sit.\n  @set trust += 1\n  I sit.\n* Stand.\n\n# evening\nBoats.\n-> END\n`)), ['evening>END', 'harbor>evening']);
});
test('graph: option bodies that end the scene fall through into the next one', () => {
  eq(edges(compile(`SHIORI 1\ntitle: T\n# harbor\nTide.\n* Sit.\n  I sit.\n* Stand.\n  I stand.\n\n# evening\nBoats.\n-> END\n`)), ['evening>END', 'harbor>evening']);
});
test('graph: an @if whose body jumps also falls through', () => {
  eq(edges(compile(`SHIORI 1\ntitle: T\n@var x = false\n# a\nStart.\n* Go.\n  @set x = true\n* Stay.\n@if x\n  -> c\n# b\nB.\n-> END\n# c\nC.\n-> END\n`)), ['a>b', 'a>c', 'b>END', 'c>END']);
});
test('graph: a direct `* text -> next_scene` choice keeps its edge', () => {
  eq(edges(compile(`SHIORI 1\ntitle: T\n# a\nStart.\n* Ask. -> a\n* Leave. -> b\n# b\nB.\n-> END\n`), 'choice'), ['a>b']);
});
test('graph: a menu whose options all jump has no fall-through edge', () => {
  eq(edges(compile(`SHIORI 1\ntitle: T\n# a\nStart.\n* Left. -> c\n* Right. -> c\n# b\nB.\n-> END\n# c\nC.\n-> END\n`)), ['a>c', 'b>END', 'c>END']);
});
test('lantern-keeper: no run warnings, and the hub keeps its "Say goodnight." edge', () => {
  const p = lk.program;
  const a = analyze(p);
  eq([a.dialogueRuns.length, a.staticRuns.length], [0, 0]);
  ok(a.graph.edges.some(e => e.from === 'ask_mio' && e.to === 'goodnight' && e.label === 'Say goodnight.'));
  eq(a.branching, true);
});
test('graph: a jump inside an @if in an option body is a choice edge', () => {
  const p = compile(`SHIORI 1\ntitle: T\n@var trust = 1\n# start\nDoor.\n* Go in.\n  @if trust > 0\n    -> inside\n  -> outside\n* Leave. -> outside\n# inside\nWarm.\n-> END\n# outside\nCold.\n-> END\n`);
  eq(edges(p, 'choice'), ['start>inside', 'start>outside']);
  ok(storyGraph(p).edges.some(e => e.kind === 'choice' && e.to === 'inside' && e.label === 'Go in.'));
});
test('graph: code shared after a menu is not labelled with one option', () => {
  const p = compile(`SHIORI 1\ntitle: T\n@var helped = false\n# start\nA stranger.\n* Help her.\n  @set helped = true\n* Walk past.\n@if helped\n  -> grateful\n-> alone\n# grateful\nG.\n-> END\n# alone\nA.\n-> END\n`);
  eq(edges(p, 'choice'), []);
  eq(edges(p), ['alone>END', 'grateful>END', 'start>alone', 'start>grateful']);
});
test('Branching Plot: a flag set by a choice, then an @if jump', () => {
  const p = compile(`SHIORI 1\ntitle: T\n@var helped = false\n# start\nA stranger.\n* Help her.\n  @set helped = true\n* Walk past.\n@if helped\n  -> grateful\n-> alone\n# grateful\nG.\n@ending good "Good"\n-> END\n# alone\nA.\n@ending bad "Bad"\n-> END\n`);
  const a = analyze(p);
  eq(a.branching, true);
  ok(vndbReport(p, { analysis: a }).tags.some(t => t.id === 'g606'));
});
test('Branching Plot: not for choices that all lead to the same place', () => {
  const p = compile(`SHIORI 1\ntitle: T\n@var mood = 0\n# start\nMorning.\n* Smile.\n  @set mood += 1\n* Frown.\n@if mood > 0\n  I feel fine.\n-> next\n# next\nNoon.\n* Go on. -> last\n# last\nNight.\n-> END\n`);
  eq(analyze(p).branching, false);
});

// ---- explorer: unlocks across playthroughs (findings 2, 16) ---------------------
test('explore: an ending gated on one ending but not another is reachable', () => {
  const p = compile(`SHIORI 1\ntitle: T\n# start\nFerry.\n* [if ending_seen("drowned") and not ending_seen("home")] Wait.\n  @ending lighthouse "Lighthouse"\n  -> END\n* Board.\n  @ending drowned "Drowned"\n  -> END\n* Walk home.\n  @ending home "Home"\n  -> END\n`);
  const ex = explore(p);
  eq(ids(ex), ['drowned', 'home', 'lighthouse']);
  eq(ex.unreachedEndings, []);
  const l = ending(ex, 'lighthouse');
  eq(l.pass, 2);
  ok(l.shortest.verified, 'replay verified');
  eq(replayArgs(l), '--choices 1 --seen drowned');
  eq(ex.options.neverShown, []);
});
test('explore: a hint shown after exactly one ending is reachable', () => {
  const p = compile(`SHIORI 1\ntitle: T\n# start\nFork.\n* [if endings_seen() == 1] Follow the hint.\n  @ending hint "Hint"\n  -> END\n* Left.\n  @ending left "Left"\n  -> END\n* Right.\n  @ending right "Right"\n  -> END\n`);
  eq(ids(explore(p)), ['hint', 'left', 'right']);
});
test('explore: @persistent values from different routes are each replayed', () => {
  const p = compile(`SHIORI 1\ntitle: T\n@persistent last = ""\n# start\nFork.\n* [if last == "a"] After A.\n  @ending after_a "After A"\n  -> END\n* [if last == "b"] After B.\n  @ending after_b "After B"\n  -> END\n* A.\n  @set last = "a"\n  @ending a "A"\n  -> END\n* B.\n  @set last = "b"\n  @ending b "B"\n  -> END\n`);
  const ex = explore(p);
  eq(ids(ex), ['a', 'after_a', 'after_b', 'b']);
  eq(replayArgs(ending(ex, 'after_b')), '--choices 2 --set last=b');
  ok(ending(ex, 'after_b').shortest.verified);
});
test('explore: a 4-deep unlock chain is followed to the end', () => {
  const p = compile(`SHIORI 1\ntitle: T\n# start\nYear.\n* Spring.\n  @ending spring "Spring"\n  -> END\n* [if ending_seen("spring")] Summer.\n  @ending summer "Summer"\n  -> END\n* [if ending_seen("summer")] Autumn.\n  @ending autumn "Autumn"\n  -> END\n* [if ending_seen("autumn")] Winter.\n  @ending winter "Winter"\n  -> END\n`);
  const ex = explore(p);
  eq(ids(ex), ['autumn', 'spring', 'summer', 'winter']);
  eq(ending(ex, 'winter').pass, 4);
  eq(replayArgs(ending(ex, 'winter')), '--choices 4 --seen autumn');
  eq(ex.passes, 4);
  eq(ex.unlocksPartial, false);
});
test('explore: stops at the fixpoint and counts each route once', () => {
  const p = compile(`SHIORI 1\ntitle: T\n# start\nRoads.\n* Cliff.\n  @ending cliff "Cliff"\n  -> END\n* [if ending_seen("cliff")] Shortcut.\n  @ending home "Home"\n  -> END\n`);
  for (const ex of [explore(p), explore(p, { passes: 10 })]) {
    eq(ending(ex, 'cliff').routes, 1);
    eq(ex.routes, 2);
    eq(ex.passes, 2);
  }
});
test('explore: a persistent counter raised by a constant reaches a fixpoint', () => {
  const p = compile(`SHIORI 1\ntitle: T\n@persistent runs = 0\n# start\n@set runs += 1\n@if runs >= 3\n  Third time.\n  @ending third "Third"\n  -> END\nAgain.\n@ending again "Again"\n-> END\n`);
  const ex = explore(p);
  eq(ids(ex), ['again', 'third']);
  eq(ending(ex, 'third').pass, 3);
  eq(replayArgs(ending(ex, 'third')), '--set runs=2');
  eq(ex.unlocksPartial, false);
  eq(ex.unlockStates, 4);
});
test('explore: an unbounded persistent counter is cut off with a note', () => {
  const p = compile(`SHIORI 1\ntitle: T\n@persistent runs = 0\n# start\n@set runs = runs + 1\n@if runs >= 3\n  Third time.\n  @ending third "Third"\n  -> END\nAgain.\n@ending again "Again"\n-> END\n`);
  const ex = explore(p);
  eq(ids(ex), ['again', 'third']);
  eq(ex.unlocksPartial, true);
  eq(ex.playthroughs, 16);
  ok(ex.warnings.some(w => /Stopped replaying after 16 playthroughs/.test(w.message)), 'note');
  eq(ex.constantConditions, [], 'no "always" claims when partial');
});
test('explore: many unlock states are capped with a note', () => {
  const n = 8;
  const opts = Array.from({ length: n }, (_, i) => `* E${i}.\n  @if ending_seen("e${i}")\n    Again ${i}.\n  @ending e${i} "E${i}"\n  -> END`).join('\n');
  const p = compile(`SHIORI 1\ntitle: T\n# start\nPick.\n${opts}\n`);
  const ex = explore(p, { maxUnlockStates: 20 });
  eq(ex.unlocksPartial, true);
  eq(ex.unlockStates, 20);
  ok(ex.warnings.some(w => /different sets of endings/.test(w.message)), 'note');
  eq(ex.lines.unseen, []);
});
test('explore: games with no unlocks play once', () => {
  const ex = explore(compile(`SHIORI 1\ntitle: T\n# start\nA.\n* X.\n  @ending x "X"\n  -> END\n* Y.\n  @ending y "Y"\n  -> END\n`));
  eq(ex.passes, 1);
  eq(ex.playthroughs, 1);
  eq(ex.routes, 2);
});

// ---- explorer: @input (finding 14) ----------------------------------------------
test('explore: @input tries the default answer and a typed one', () => {
  const p = compile(`SHIORI 1\ntitle: T\n@var player_name = ""\n# start\nA form.\n@input player_name "Name?"\n@if player_name == ""\n  Sent away.\n  @ending nameless "Nameless"\n  -> END\nWelcome, {$player_name}.\n@ending registered "Registered"\n-> END\n`);
  const ex = explore(p);
  eq(ids(ex), ['nameless', 'registered']);
  eq(ex.unreachedEndings, []);
  for (const e of ex.endings) ok(e.shortest.verified, 'verified ' + e.id);
  eq(replayArgs(ending(ex, 'nameless')), '');
  eq(replayArgs(ending(ex, 'registered')), '--choices Player');
  eq(formatPath(ending(ex, 'registered').shortest.path), '[player_name = "Player"]');
});
test('explore: @input tries the names the conditions compare it with', () => {
  const p = compile(`SHIORI 1\ntitle: T\n@var who = ""\n# start\nA door.\n* Knock.\n  @input who "Who goes there?" default="Aoi"\n  @if who == "Mio Sato"\n    It opens.\n    @ending secret "Secret"\n    -> END\n  Nothing.\n  @ending plain "Plain"\n  -> END\n`);
  const ex = explore(p);
  eq(ids(ex), ['plain', 'secret']);
  eq(replayArgs(ending(ex, 'secret')), "--choices '1,Mio Sato'");
  ok(ending(ex, 'secret').shortest.verified);
});
test('explore: an @input only shown in text does not multiply routes', () => {
  const ex = explore(compile(`SHIORI 1\ntitle: T\n@var nm = ""\n# start\n@input nm "Name?" default="Aoi"\nHello, {$nm}.\n@ending e "E"\n-> END\n`));
  eq(ex.routes, 1);
  eq(formatPath(ending(ex, 'e').shortest.path), '(no choices)');
});

// ---- explorer: visit counts (finding 15) ----------------------------------------
test('explore: visited() compared with a large number is not cut off', () => {
  const p = compile(`SHIORI 1\ntitle: T\n# hub\n@if visited("hub") >= 10\n  Patience.\n  @ending patience "Patience"\n  -> END\nTick.\n* Wait. -> hub\n* Leave.\n  @ending gave_up "Gave up"\n  -> END\n`);
  const ex = explore(p);
  eq(ids(ex), ['gave_up', 'patience']);
  eq(replayArgs(ending(ex, 'patience')), '--choices 1,1,1,1,1,1,1,1,1');
  eq(ex.constantConditions, []);
});
test('explore: visited() used in arithmetic is not clamped (search stops early instead)', () => {
  const p = compile(`SHIORI 1\ntitle: T\n# hub\n@if visited("hub") % 50 == 0\n  Rare.\n  @ending rare "Rare"\n  -> END\nTick.\n* Wait. -> hub\n* Leave.\n  @ending gave_up "Gave up"\n  -> END\n`);
  const ex = explore(p, { maxStates: 400 });
  ok(ex.truncated || ex.endings.some(e => e.id === 'rare'), 'either honest truncation or found');
  const full = explore(p);
  ok(ids(full).includes('rare'), 'found with the default budget');
});

// ---- explorer: scene coverage (finding 49) --------------------------------------
test('explore: a routing scene with no text counts as entered', () => {
  const ex = explore(compile(`SHIORI 1\ntitle: T\n@var trust = 0\n# start\nPier.\n* Sit.\n  @set trust += 1\n* Stand.\n-> decide\n\n# decide\n@if trust > 0\n  -> together\n-> alone\n\n# together\nTogether.\n@ending together "Together"\n-> END\n\n# alone\nAlone.\n@ending alone "Alone"\n-> END\n`));
  eq(ex.scenes.unseen, []);
  eq(ex.scenes.seen, 4);
});
test('explore: choices that are locked on every route are listed', () => {
  const ex = explore(compile(`SHIORI 1\ntitle: T\n@var has_key = false\n# start\nDoor.\n* [require has_key] Unlock the door.\n* Give up.\nDark.\n@ending done "Done"\n-> END\n`));
  eq(ex.options.neverTaken.map(o => o.text), ['Unlock the door.']);
});
test('replayArgs quotes values that need it', () => {
  eq(replayArgs({ shortest: { path: [{ choice: 1 }], rolls: [], seen: ['a'], persist: { nick: 'Old Friend' } } }), "--choices 1 --seen a --set 'nick=Old Friend'");
});

// ---- VNDB voicing (finding 51) ----------------------------------------------------
const voicedGame = (heroineVoiced) => {
  let body = '';
  for (let i = 0; i < 20; i++) {
    body += `The wind shifts, ${i}.\n${i < heroineVoiced ? `@voice v${i}\n` : ''}mio: Heroine line ${i}.\n`;
    if (i % 2 === 0) body += `aoi: Protagonist line ${i}.\n`;
  }
  body += '"Ferryman": All aboard.\n';
  const decl = Array.from({ length: 20 }, (_, i) => `@audio v${i} voice/v${i}.ogg`).join('\n');
  return compile(`SHIORI 1\ntitle: T\n@character mio\n  name: Mio\n  role: main\n@character aoi\n  name: Aoi\n  role: protagonist\n${decl}\n# start\n${body}-> END\n`);
};
test('VNDB: fully voiced leaves out the protagonist and one-off speakers', () => {
  const r = vndbReport(voicedGame(20)).release;
  eq(r.voiced, 'Fully voiced');
  ok(/protagonist/.test(r.voiced_note), r.voiced_note);
});
test('VNDB: partly voiced characters give "Partially voiced"', () => {
  const r = vndbReport(voicedGame(10)).release;
  eq(r.voiced, 'Partially voiced');
  ok(/Mio \(10 of 20 lines\)/.test(r.voiced_note), r.voiced_note);
  eq(vndbReport(voicedGame(0)).release.voiced, 'Not voiced');
});
