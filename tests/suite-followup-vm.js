// Follow-up VM suite: tables keyed by script names have no prototype (and
// stay that way through clone, saves and a program read back from JSON), NVL
// pages keep the POV of their narration, and a module whose exec() throws is
// reported as R700 instead of crashing the player.
import { test, eq, ok, one, errors } from './harness.js';
import { VM, compileProject, defaultRegistry } from '../engine/core/index.js';
import { clone } from '../engine/core/util.js';

const HEAD = 'SHIORI 1\ntitle: T\n';
function prog(text, registry) {
  const src = HEAD + text;
  const r = registry
    ? compileProject({ entry: 'game.story', files: { 'game.story': src }, order: ['game.story'], missing: [] }, { registry })
    : one(src);
  const e = errors(r);
  if (e.length) throw new Error('compile errors: ' + e.map(d => `${d.code} ${d.message}`).join('; '));
  return r.program;
}
const vmFor = (program, opts = {}) => new VM(program, { seed: 1, ...opts });
// Advance until pred(halt) holds, stopping at anything that needs an answer.
function until(vm, r, pred) {
  for (let i = 0; i < 2000; i++) {
    if (pred(r.halt)) return r;
    if (['menu', 'end', 'error', 'input', 'game'].includes(r.halt.type)) throw new Error(`stopped at ${r.halt.type} ${r.halt.plain || r.halt.code || r.halt.message || ''}`);
    r = vm.advance();
  }
  throw new Error('runaway');
}
const sayIs = (t) => (h) => h.type === 'say' && h.plain === t;
const errs = (r) => r.effects.filter(e => e.type === 'error');
const noProto = (o, what) => ok(o && Object.getPrototypeOf(o) === null, `${what} should have no prototype`);
const STATE_TABLES = ['vars', 'names', 'charAttrs', 'visits', 'chosen'];
const PERSISTENT_TABLES = ['vars', 'endings', 'read', 'cgs', 'music', 'scenes', 'chosen'];
function allNoProto(vm, when) {
  for (const k of STATE_TABLES) noProto(vm.state[k], `${when}: state.${k}`);
  for (const k of PERSISTENT_TABLES) noProto(vm.persistent[k], `${when}: persistent.${k}`);
}

// ---- names that are also Object.prototype members ------------------------------
const protoSrc = `@var __proto__ = 3
@var constructor = "c"
@persistent toString = 0
@character valueOf name="Val" color=#88ccff
# hasOwnProperty
@set __proto__ += 1
@set toString += 2
valueOf: I have {$__proto__} and {$constructor}.
@if __proto__ == 4
  Four.
@endif
@rename valueOf "V2"
valueOf: Renamed.
* Go on.
  Went on.
@ending isPrototypeOf "Proto end"
-> END
`;

test('@var __proto__, @var constructor and @persistent toString work at runtime', () => {
  const vm = vmFor(prog(protoSrc));
  let r = vm.start();
  eq(r.halt.plain, 'I have 4 and c.');
  eq(vm.getVar('__proto__'), 4);
  eq(vm.getVar('constructor'), 'c');
  eq(vm.getVar('toString'), 2);
  eq(Object.keys(vm.state.vars).sort(), ['__proto__', 'constructor']);
  r = vm.advance();
  eq(r.halt.plain, 'Four.', 'the @if compares the variable, not Object.prototype');
});

test('a character called valueOf shows its declared name, then its @rename', () => {
  const vm = vmFor(prog(protoSrc));
  let r = vm.start();
  eq(r.halt.name, 'Val');
  eq(r.halt.color, '#88ccff');
  r = until(vm, r, sayIs('Renamed.'));
  eq(r.halt.name, 'V2');
  eq(vm.displayName('valueOf'), 'V2');
  eq(vm.displayName('toString'), 'toString', 'an undeclared id is shown as itself');
});

test('a scene, choice and ending named after Object.prototype members are counted', () => {
  const vm = vmFor(prog(protoSrc));
  let r = until(vm, vm.start(), (h) => h.type === 'menu');
  r = vm.choose(0);
  eq(r.halt.plain, 'Went on.');
  eq(vm.callFn('visited', ['hasOwnProperty']), 1);
  eq(vm.callFn('visited', ['toString']), 0);
  eq(vm.callFn('ending_seen', ['constructor']), false);
  r = until(vm, r, (h) => h.type === 'end' || h.type === 'ending');
  if (r.halt.type === 'ending') r = until(vm, vm.advance(), (h) => h.type === 'end');
  eq(r.halt.ending, 'isPrototypeOf');
  eq(vm.callFn('ending_seen', ['isPrototypeOf']), true);
  eq(vm.callFn('endings_seen', []), 1);
  eq(Object.keys(vm.persistent.scenes), ['hasOwnProperty']);
  eq(Object.keys(vm.persistent.endings), ['isPrototypeOf']);
});

test('state and persistent tables have no prototype after start, rollback, save/load and a direct assignment', () => {
  const program = prog(protoSrc);
  const vm = vmFor(program, { persistent: { vars: { toString: 5 }, endings: {}, read: {}, cgs: {}, music: {}, scenes: {}, chosen: {}, playthroughs: 0 } });
  let r = vm.start();
  allNoProto(vm, 'start');
  eq(vm.getVar('toString'), 7, 'a stored @persistent value is kept');
  r = until(vm, r, sayIs('Renamed.'));
  r = vm.rollback();
  allNoProto(vm, 'rollback');
  r = vm.rollforward();
  allNoProto(vm, 'rollforward');
  const save = JSON.parse(JSON.stringify(vm.save()));
  const vm2 = vmFor(program, { persistent: JSON.parse(JSON.stringify(vm.persistent)) });
  r = vm2.load(save);
  allNoProto(vm2, 'load');
  eq(r.halt.plain, 'Renamed.');
  eq(vm2.getVar('__proto__'), 4);
  eq(vm2.state.names.valueOf, 'V2');
  eq(vm2.displayName('valueOf'), 'V2');
  // An edited script: the variables are rebuilt from the declarations.
  const edited = prog(protoSrc.replace('Four.', 'Four!'));
  const vm3 = vmFor(edited);
  r = vm3.load(save);
  allNoProto(vm3, 'load after an edit');
  eq(vm3.getVar('__proto__'), 4, 'the saved value survives an edit');
  // The explorer restores clones by assigning them.
  vm.state = clone(vm.state);
  vm.persistent = clone(vm.persistent);
  allNoProto(vm, 'assignment');
  eq(vm.getVar('__proto__'), 4);
});

test('a save keeps a variable called __proto__ through JSON', () => {
  const vm = vmFor(prog(protoSrc));
  vm.start();
  const text = JSON.stringify(vm.save());
  ok(text.includes('"__proto__":4'), 'the save lists __proto__ as a variable');
});

// ---- a program read back from JSON -----------------------------------------------
const plainSrc = `@var trust = 0
@character mio name="Mio"
# start
mio: Hello.
@ending good "Good"
-> END
`;
test('a program read back from JSON does not find Object.prototype members as scenes, variables or characters', () => {
  const program = JSON.parse(JSON.stringify(prog(plainSrc)));
  ok(Object.getPrototypeOf(program.labels) === Object.prototype, 'the JSON program has plain tables');
  const vm = vmFor(program);
  let threw = null;
  try { vm.start('constructor'); } catch (e) { threw = e.message; }
  eq(threw, 'Unknown scene `constructor`.');
  let r = vm.start();
  eq(r.halt.plain, 'Hello.');
  threw = null;
  try { vm.jump('toString'); } catch (e) { threw = e.message; }
  eq(threw, 'Unknown scene `toString`.');
  eq(vm.getVar('constructor'), undefined);
  threw = null;
  try { vm.setVar('valueOf', 1); } catch (e) { threw = e.message; }
  eq(threw, 'Unknown variable `valueOf`.');
  eq(vm.displayName('hasOwnProperty'), 'hasOwnProperty');
  eq(vm.callFn('endings_seen', []), 0);
  // Saves still name and find their place.
  const save = vm.save();
  eq(save.position.scene, 'start');
  r = vmFor(program).load(save);
  eq(r.halt.plain, 'Hello.');
});

// ---- NVL pages keep the POV --------------------------------------------------------
const nvlSrc = `@character rin name="Rin" color=#ff6688
# a
@mode nvl
@pov rin
The rain kept falling.
rin: Hello.
@pov none
Plain narration.
Last.
-> END
`;
test('NVL page entries keep the POV of their narration, also after a load', () => {
  const program = prog(nvlSrc);
  const vm = vmFor(program);
  let r = until(vm, vm.start(), sayIs('Plain narration.'));
  const page = vm.state.text.page;
  eq(page.map(e => e.pov), [{ who: 'rin', name: 'Rin', color: '#ff6688' }, null, null]);
  eq(r.halt.pov, null);
  r = vm.advance();
  const save = JSON.parse(JSON.stringify(vm.save()));
  r = vmFor(program).load(save);
  const restore = r.effects.find(e => e.type === 'restore');
  eq(restore.text.page[0].pov, { who: 'rin', name: 'Rin', color: '#ff6688' });
  eq(restore.text.page[0].name, null);
  eq(restore.text.page[1].pov, null, 'dialogue has no POV border');
});

// ---- a module whose exec() throws ----------------------------------------------
const boomModule = {
  name: 'fx',
  commands: [
    { name: 'boom', summary: 'Throws.', syntax: '@boom', positional: [], named: {}, exec() { const o = null; return o.x; } },
    { name: 'oops', summary: 'Throws a string.', syntax: '@oops', positional: [], named: {}, exec() { throw 'bad state.'; } },
    { name: 'setnope', summary: 'Sets an unknown variable.', syntax: '@setnope', positional: [], named: {}, exec(ins, vm) { vm.setVar('nope', 1); } },
  ],
};
const boomSrc = `# a
Before.
@boom
After boom.
@oops
After oops.
@setnope
After setnope.
-> END
`;
test('a module exec() that throws is R700 at the script line, naming the module and command, and the story goes on', () => {
  const registry = defaultRegistry([boomModule]);
  const vm = vmFor(prog(boomSrc, registry), { registry });
  let r = vm.start();
  eq(r.halt.plain, 'Before.');
  r = vm.advance();
  eq(r.halt.plain, 'After boom.');
  const e = errs(r);
  eq(e.length, 1);
  eq(e[0].code, 'R700');
  eq(e[0].loc.line, 5);
  ok(e[0].message.startsWith('The `fx` module failed while running `@boom` ('), e[0].message);
  ok(e[0].message.includes('Fix `exec()` for `boom` in that module'), e[0].message);
  r = vm.advance();
  eq(r.halt.plain, 'After oops.');
  eq(errs(r).map(x => x.message), ['The `fx` module failed while running `@oops` (bad state), so the command was skipped. Fix `exec()` for `oops` in that module (listed under `modules:` in the header).']);
  r = vm.advance();
  eq(r.halt.plain, 'After setnope.');
  eq(errs(r).map(x => [x.code, x.message]), [['R700', 'Unknown variable `nope`.']], 'an expression error keeps its own message');
  eq(vm.warnings.length, 3);
});

test('strict mode: a module exec() that throws halts with R700; advancing goes on after it', () => {
  const registry = defaultRegistry([boomModule]);
  const vm = vmFor(prog(boomSrc, registry), { registry, strict: true });
  let r = vm.start();
  r = vm.advance();
  eq(r.halt.type, 'error');
  eq(r.halt.code, 'R700');
  ok(r.halt.message.includes('`@boom`'), r.halt.message);
  r = vm.advance();
  eq(r.halt.plain, 'After boom.');
});

test('a built-in command that throws is reported as a Shiori bug', () => {
  const registry = defaultRegistry();
  const def = registry.get('pause');
  const saved = def.exec;
  try {
    def.exec = () => { throw new TypeError('broken.'); };
    const vm = vmFor(prog('# a\nBefore.\n@pause\nAfter.\n-> END\n'), { registry });
    let r = vm.start();
    r = vm.advance();
    eq(r.halt.plain, 'After.');
    const e = errs(r);
    eq(e.length, 1);
    ok(e[0].message.startsWith('The `story` module failed while running `@pause` (broken), so the command was skipped. This is a bug in Shiori'), e[0].message);
  } finally { def.exec = saved; }
});
