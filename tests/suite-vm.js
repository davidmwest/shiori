// VM suite: runtime errors in conditions, saves that survive edits, halts
// that a save shows again, rollback/rollforward and the backlog.
import { test, eq, ok, one, many, errors, playThrough } from './harness.js';
import { VM } from '../engine/core/index.js';

const HEAD = 'SHIORI 1\ntitle: T\n';
function prog(text) {
  const r = one(HEAD + text);
  const e = errors(r);
  if (e.length) throw new Error('compile errors: ' + e.map(d => `${d.code} ${d.message}`).join('; '));
  return r.program;
}
function progs(files) {
  const r = many(files);
  const e = errors(r);
  if (e.length) throw new Error('compile errors: ' + e.map(d => `${d.code} ${d.message}`).join('; '));
  return r.program;
}
const vmFor = (program, opts = {}) => new VM(program, { seed: 1, ...opts });
// Advance until pred(halt) holds, stopping at anything that needs an answer.
function until(vm, r, pred) {
  for (let i = 0; i < 2000; i++) {
    if (pred(r.halt)) return r;
    if (['menu', 'end', 'error', 'input', 'game'].includes(r.halt.type)) throw new Error(`stopped at ${r.halt.type} ${r.halt.plain || r.halt.code || ''}`);
    r = vm.advance();
  }
  throw new Error('runaway');
}
const sayIs = (t) => (h) => h.type === 'say' && h.plain === t;
const isType = (t) => (h) => h.type === t;
const errs = (r) => r.effects.filter(e => e.type === 'error').map(e => e.code);
const menuText = (h) => h.options.map(o => o.plain + (o.disabled ? ' (locked)' : ''));

// ---- runtime errors in conditions (findings 8, 11) --------------------------------
const zeroSrc = `@var total = 10
@var n = 0
# a
Start.
@if total / n >= 3
  If body.
@elif total > 50
  Elif body.
@else
  Else body.
Between.
* [if total % n == 0] Even split.
  Option one body.
* [require total / n > 1] Locked door.
  Locked body.
* Walk away.
  Option three body.
After.
-> END
`;
test('a condition that fails at runtime counts as false: @elif/@else run, not the @if body', () => {
  const vm = vmFor(prog(zeroSrc));
  let r = vm.start();
  r = vm.advance();
  eq(r.halt.plain, 'Else body.');
  eq(errs(r), ['R700']);
});
test('a menu option whose [if] fails at runtime is hidden; one whose [require] fails is locked', () => {
  const vm = vmFor(prog(zeroSrc));
  let r = until(vm, vm.start(), sayIs('Between.'));
  r = vm.advance();
  eq(r.halt.type, 'menu', 'the menu is shown, not option 1');
  eq(menuText(r.halt), ['Locked door. (locked)', 'Walk away.']);
  eq(errs(r), ['R700', 'R700']);
  r = vm.choose(2);
  eq(r.halt.plain, 'Option three body.');
  r = vm.rollback();
  eq(r.halt.type, 'menu', 'rollback returns to the menu');
});
test('strict mode: a failing menu condition halts with R700 instead of entering option 1', () => {
  const vm = vmFor(prog(zeroSrc), { strict: true });
  let r = vm.start();
  r = vm.advance();
  eq(r.halt.type, 'error');
  eq(r.halt.code, 'R700');
  vm.strict = false;
  r = vm.run();
  eq(r.halt.plain, 'Else body.', 'going on after the @if error takes the @else');
  r = vm.advance();
  eq(r.halt.plain, 'Between.');
  vm.strict = true;
  r = vm.advance();
  eq(r.halt.type, 'error', 'menu condition error');
  vm.strict = false;
  r = vm.run();
  eq(r.halt.type, 'menu', 'going on shows the menu');
  eq(menuText(r.halt), ['Locked door. (locked)', 'Walk away.']);
});

// ---- saves at a menu after an edit (finding 12) -------------------------------------
const harbor = `@var trust = 0
# harbor
First line of the scene.
@set trust += 1
Will you stay?
* Stay.
  You stay.
* Go.
  You go.
Afterwards.
-> END
`;
function saveAtMenu(program) {
  const vm = vmFor(program);
  const r = until(vm, vm.start(), isType('menu'));
  return vm.save();
}
test('a save at a menu loads at that menu after an edit below it', () => {
  const save = saveAtMenu(prog(harbor));
  const v = vmFor(prog(harbor.replace('Afterwards.', 'Afterward.')));
  const r = v.load(save);
  eq(r.halt.type, 'menu');
  eq(v.state.vars.trust, 1, '@set is not applied twice');
});
test('a save at a menu loads at that menu after a comment-only edit in another file', () => {
  const files = { 'game.story': HEAD + 'include: story/b.story\n' + harbor, 'story/b.story': '# b\nElsewhere.\n-> END\n' };
  const save = saveAtMenu(progs(files));
  const v = vmFor(progs({ ...files, 'story/b.story': '// a note\n' + files['story/b.story'] }));
  eq(v.load(save).halt.type, 'menu');
});
test('a save at a menu loads at that menu after lines are inserted above it', () => {
  const save = saveAtMenu(prog(harbor));
  const v = vmFor(prog(harbor.replace('First line of the scene.', 'A new opening line.\nFirst line of the scene.\nAnother new line.')));
  const r = v.load(save);
  eq(r.halt.type, 'menu');
  eq(menuText(r.halt), ['Stay.', 'Go.']);
  eq(v.state.vars.trust, 1);
});
test('a save at a menu loads at that menu after the line before it was rewritten', () => {
  const save = saveAtMenu(prog(harbor));
  const v = vmFor(prog(harbor.replace('Will you stay?', 'Will you stay here?\nThink about it.')));
  eq(v.load(save).halt.type, 'menu');
});
test('a save at a menu that was deleted loads at the start of its scene, not at an earlier menu', () => {
  const two = harbor.replace('First line of the scene.', 'First line of the scene.\n* Look.\n* Listen.\nThen.');
  const vm = vmFor(prog(two));
  let r = until(vm, vm.start(), isType('menu'));
  r = until(vm, vm.choose(0), isType('menu'));
  const v = vmFor(prog(two.replace(/\* Stay\.\n  You stay\.\n\* Go\.\n  You go\.\n/, '')));
  r = v.load(vm.save());
  eq(r.halt.plain, 'First line of the scene.');
});
test('a save at the second menu of a scene finds it after the line before it and lines above changed', () => {
  const two = harbor.replace('First line of the scene.', 'First line of the scene.\n* Look.\n* Listen.\nThen.');
  const vm = vmFor(prog(two));
  let r = until(vm, vm.start(), isType('menu'));
  r = until(vm, vm.choose(0), isType('menu'));
  const v = vmFor(prog(two.replace('Will you stay?', 'Stay?').replace('Then.', 'Then.\nA new line.')));
  r = v.load(vm.save());
  eq(r.halt.type, 'menu');
  eq(menuText(r.halt), ['Stay.', 'Go.']);
});
test('rolling back to a menu with chance() in a condition shows the same options', () => {
  const p = prog('# a\nHi.\n* [if chance(0.5)] Lucky.\n* [if chance(0.5)] Also lucky.\n* Plain.\nDone.\n-> END\n');
  for (let s = 1; s <= 8; s++) {
    const vm = new VM(p, { seed: s });
    let r = until(vm, vm.start(), isType('menu'));
    const shown = menuText(r.halt);
    vm.choose(r.halt.options[r.halt.options.length - 1].index);
    r = vm.rollback();
    eq(menuText(r.halt), shown);
  }
});
test('a save at an edited text line loads at the line now in its place', () => {
  const p = prog(harbor);
  const vm = vmFor(p);
  until(vm, vm.start(), sayIs('Will you stay?'));
  const v = vmFor(prog(harbor.replace('Will you stay?', 'Will you stay, then?')));
  const r = v.load(vm.save());
  eq(r.halt.plain, 'Will you stay, then?');
  eq(v.state.vars.trust, 1);
});

// ---- rollforward after start / load / jump (finding 13) --------------------------------
const lines3 = `@var gold = 0
# a
Line one.
@set gold = 99
Line two.
Line three, gold {$gold}.
-> END
# b
Scene b.
-> END
`;
test('rollforward is forgotten by start(), load() and jump()', () => {
  const p = prog(lines3);
  const setup = () => { const vm = vmFor(p); const s = until(vm, vm.start(), sayIs('Line one.')) && vm.save(); until(vm, vm.advance(), sayIs('Line three, gold 99.')); vm.rollback(); ok(vm.canRollforward()); return { vm, s }; };
  let { vm, s } = setup();
  vm.start(); eq(vm.canRollforward(), false, 'after start'); eq(vm.rollforward(), null);
  ({ vm, s } = setup());
  vm.load(s); eq(vm.canRollforward(), false, 'after load'); eq(vm.rollforward(), null);
  ({ vm } = setup());
  vm.jump('b'); eq(vm.canRollforward(), false, 'after jump');
});

// ---- @call return addresses after an edit (finding 41) ----------------------------------
const town = `@var coins = 0
# town
You walk into town with {$coins} coins.
@set coins += 10
@call flashback
-> market
# flashback
A memory.
@return
# market
The market. You have {$coins} coins.
* Remember again.
  @call flashback
* Leave.
Bye with {$coins}.
-> END
`;
test('@return from an old save continues after the @call, even after an edit', () => {
  const vm = vmFor(prog(town));
  until(vm, vm.start(), sayIs('A memory.'));
  const v = vmFor(prog(town.replace('The market.', 'The busy market.')));
  let r = v.load(vm.save());
  r = v.advance();
  eq(r.halt.plain, 'The busy market. You have 10 coins.');
});
test('a @call inside a menu option returns into that option after an edit', () => {
  const vm = vmFor(prog(town));
  let r = until(vm, vm.start(), isType('menu'));
  r = vm.choose(0);
  eq(r.halt.plain, 'A memory.');
  const v = vmFor(prog(town.replace('A memory.', 'A faded memory.')));
  r = v.load(vm.save());
  eq(r.halt.plain, 'A faded memory.');
  r = v.advance();
  eq(r.halt.plain, 'Bye with 10.');
});

// ---- saves at non-line halts (finding 42) ----------------------------------------------
const halts = `@var player_name = ""
@var result = "none"
@gameplay coin games/coin.js results="heads tails"
# a
A stranger looks up.
@input player_name "Your name?" default="Aoi"
Nice to meet you, {$player_name}.
@game coin into=result
The coin says {$result}.
@chapter "Two"
After the card.
@pause
@ending home "Home" kind=good
-> END
`;
function haltAt(program, type) {
  const vm = vmFor(program);
  let r = vm.start();
  for (let i = 0; i < 50 && r.halt.type !== type; i++) {
    r = r.halt.type === 'input' ? vm.submit('Kai') : r.halt.type === 'game' ? vm.submit('heads') : vm.advance();
  }
  eq(r.halt.type, type);
  return vm;
}
test('a save at @input, @game, @chapter, @pause or @ending loads at that halt', () => {
  const p = prog(halts);
  for (const type of ['input', 'game', 'chapter', 'pause', 'ending']) {
    const vm = haltAt(p, type);
    const v = vmFor(p, { persistent: vm.persistent });
    const r = v.load(vm.save());
    eq(r.halt.type, type, `load at ${type}`);
  }
});
test('after loading at @input or @game, answering goes on as usual', () => {
  const p = prog(halts);
  let v = vmFor(p);
  let r = v.load(haltAt(p, 'input').save());
  r = v.submit('Rin');
  eq(r.halt.plain, 'Nice to meet you, Rin.');
  v = vmFor(p);
  r = v.load(haltAt(p, 'game').save());
  r = v.submit('tails');
  eq(r.halt.plain, 'The coin says tails.');
});
test('loading at an @ending card does not count the ending twice', () => {
  const p = prog(halts);
  const vm = haltAt(p, 'ending');
  const v = vmFor(p, { persistent: vm.persistent });
  const r = v.load(vm.save());
  eq(r.halt.type, 'ending');
  eq(v.persistent.endings.home.count, 1);
  eq(v.advance().halt.type, 'end');
});
test('dev live reload (edited script) at @input, @chapter or @ending shows it again', () => {
  const p = prog(halts);
  const p2 = prog(halts.replace('A stranger looks up.', 'A stranger looks up slowly.\nAn added line.').replace('"Your name?"', '"Name?"'));
  let r = vmFor(p2).load(haltAt(p, 'input').save());
  eq(r.halt.type, 'input');
  eq(r.halt.prompt, 'Name?', 'the prompt as now written');
  r = vmFor(p2).load(haltAt(p, 'chapter').save());
  eq(r.halt.type, 'chapter');
  const vm = haltAt(p, 'ending');
  const v = vmFor(p2, { persistent: vm.persistent });
  eq(v.load(vm.save()).halt.type, 'ending');
  eq(v.persistent.endings.home.count, 1);
});

// ---- backlog past 400 lines (finding 43) ----------------------------------------------
const many430 = '# a\n' + Array.from({ length: 430 }, (_, i) => `Line ${i + 1}.`).join('\n') + '\n-> END\n';
test('rollback and save/load keep the backlog in order past 400 lines', () => {
  const p = prog(many430);
  const vm = vmFor(p);
  until(vm, vm.start(), sayIs('Line 420.'));
  vm.rollback();
  eq(vm.backlog.slice(-3).map(b => b.text), ['Line 417.', 'Line 418.', 'Line 419.']);
  vm.advance();
  const v = vmFor(p);
  v.load(vm.save());
  eq(v.backlog.slice(-3).map(b => b.text), ['Line 418.', 'Line 419.', 'Line 420.']);
});

// ---- read lines and choices reach storage (finding 46) ----------------------------------
test('reading a line or making a choice tells the host persistent data changed', () => {
  const p = prog(harbor);
  let calls = 0;
  const vm = vmFor(p, { persistent: { scenes: { harbor: 1 } }, onPersistentChange: () => calls++ });
  let r = until(vm, vm.start(), isType('menu'));
  ok(calls >= 2, `called ${calls} times for 2 new lines`);
  const before = calls;
  vm.choose(0);
  ok(calls > before, 'called for the new choice');
});

// ---- @persistent type change (finding 47) -----------------------------------------------
test('a stored @persistent value of the wrong type is reset to the new initial value', () => {
  const p = prog('@persistent best = 0\n# a\n@set best += 5\n@set best += 5\nBest so far: {$best}.\n-> END\n');
  const lines = playThrough(p, [], { persistent: { vars: { best: '' } } }).lines;
  eq(lines, ['Best so far: 10.']);
});

// ---- @game results (finding 81) -------------------------------------------------------
const gameSrc = `@var result = "none"
@var score = 0
@gameplay cards games/cards.js
@gameplay darts games/darts.js
# a
Let's play.
@game cards into=result
The cards say: {$result}.
@game darts into=score
@set score += 10
Your score is {$score}.
-> END
`;
test('@game results are converted to the variable\'s type; no result keeps its value', () => {
  const vm = vmFor(prog(gameSrc));
  let r = until(vm, vm.start(), isType('game'));
  r = vm.submit(null);
  eq(r.halt.plain, 'The cards say: none.');
  r = vm.advance();
  r = vm.submit('12');
  eq(r.halt.plain, 'Your score is 22.');
});
test('a @game result that does not fit the variable keeps its value and warns', () => {
  const vm = vmFor(prog(gameSrc));
  let r = until(vm, vm.start(), isType('game'));
  r = vm.submit('win');
  r = vm.advance();
  r = vm.submit('lots');
  eq(r.halt.plain, 'Your score is 10.');
  ok(r.effects.some(e => e.type === 'warning' && e.code === 'R700' && /not a number/.test(e.message) && e.loc), 'R700 warning with a location');
});

// ---- removed character attributes (finding 82) --------------------------------------------
test('loading into a script without an attribute value falls back to the default', () => {
  const v1 = `@character mio
  name: Mio
  sprite: chars/mio/{expression}.svg
  expression: neutral smile blush
# a
@show mio blush at=center
mio: Oh.
mio: Hello again.
@hide mio
@show mio at=left
Later.
-> END
`;
  const vm = vmFor(prog(v1));
  until(vm, vm.start(), sayIs('Oh.'));
  const v = vmFor(prog(v1.replace('neutral smile blush', 'neutral smile').replace('@show mio blush', '@show mio smile')));
  v.load(vm.save());
  eq(v.state.stage.actors.find(a => a.id === 'mio').attrs, { expression: 'neutral' });
  eq(v.advance().halt.attrs, { expression: 'neutral' });
  until(v, v.advance(), sayIs('Later.'));
  eq(v.state.stage.actors.find(a => a.id === 'mio').attrs, { expression: 'neutral' });
});

// ---- random(), seeds, calls before start (findings 83, 84) ---------------------------------
test('random(6, 1) gives every number from 1 to 6', () => {
  const p = prog('@var x = 0\n# a\n@set x = random(6, 1)\n{$x}\n-> END\n');
  const seen = new Set();
  for (let s = 1; s <= 200; s++) { const vm = new VM(p, { seed: s }); seen.add(vm.start().halt.plain); }
  eq([...seen].sort(), ['1', '2', '3', '4', '5', '6']);
});
test('VMs built with the same seed roll the same numbers', () => {
  const p = prog('@var x = 0\n# a\n@set x = random(1, 1000000)\nRolled {$x}.\n-> END\n');
  const roll = () => { const vm = new VM(p, { seed: 7 }); return vm.start().halt.plain; };
  eq(roll(), roll());
});
test('driving the VM before start() gives a clear error', () => {
  const vm = vmFor(prog(lines3));
  for (const f of [() => vm.advance(), () => vm.save(), () => vm.choose(0), () => vm.submit('x'), () => vm.jump('b')]) {
    let msg = null;
    try { f(); } catch (e) { msg = e.message; }
    ok(msg && /has not started/.test(msg), `got: ${msg}`);
  }
});

// ---- rollforward over a menu (finding 85) ---------------------------------------------------
test('rolling forward over a menu keeps the choice in the backlog', () => {
  const vm = vmFor(prog(harbor));
  let r = until(vm, vm.start(), isType('menu'));
  vm.choose(0);
  const before = vm.backlog.map(b => b.text);
  vm.rollback();
  r = vm.rollforward();
  eq(r.halt.plain, 'You stay.');
  eq(vm.backlog.map(b => b.text), before);
});

// ---- endings_seen() (finding 86) --------------------------------------------------------------
test('endings_seen() counts only endings this game declares', () => {
  const p = prog(`# a
@if endings_seen() >= 2
  The true path opens.
  -> END
Only one ending so far.
@ending alone "Alone"
-> END
`);
  const lines = playThrough(p, [], { persistent: { endings: { lonely: { count: 1 }, alone: { count: 1 } } } }).lines;
  eq(lines, ['Only one ending so far.']);
});
