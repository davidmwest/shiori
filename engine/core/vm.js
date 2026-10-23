// The story VM. Host-agnostic: the browser player, the CLI and the route
// explorer all drive it the same way.
//
//   const vm = new VM(program, { seed });  // seed: optional, for reproducible random()
//   let r = vm.start();              // { effects: [...], halt: {...} }
//   apply(r.effects); present(r.halt);
//   r = vm.advance();                // after say / pause / wait / chapter / ending / video
//   r = vm.choose(optionIndex);      // at a menu
//   r = vm.submit(value);            // at input / game
//   r = vm.rollback();               // go back one line
//   const save = vm.save();  vm.load(save);
//
// Effects are applied immediately and in order (stage changes, audio,
// text mode...). The halt is what the player must see or answer next.

import { evaluate, truthy, ExprError } from './expr.js';
import { toRuns, plainText, hasNoWait } from './markup.js';
import { clone, nextRandom, hash } from './util.js';
import { newStage } from './modules/stage.js';
import { newAudio } from './modules/audio.js';
import { defaultRegistry, BUILTIN_MODULES } from './modules/index.js';
import { has } from './registry.js';

// Tables keyed by names from the script (variables, characters, scenes,
// endings, choices) have no prototype, so `@var __proto__` or a character
// called `valueOf` is just a name. JSON (clone(), saves) gives them
// Object.prototype back; dict() takes it away again.
function dict(o) {
  if (o && typeof o === 'object' && Object.getPrototypeOf(o) === null) return o;
  const out = Object.create(null);
  if (o && typeof o === 'object') for (const k of Object.keys(o)) out[k] = o[k];
  return out;
}
const STATE_TABLES = ['vars', 'names', 'charAttrs', 'visits', 'chosen'];
const PERSISTENT_TABLES = ['vars', 'endings', 'read', 'cgs', 'music', 'scenes', 'chosen'];
function withDicts(o, keys) {
  for (const k of keys) o[k] = dict(o[k]);
  return o;
}
// An entry of a program table (decls.*, labels). A program read back from
// JSON has tables with a prototype, where `constructor` would be found too.
const lookup = (table, key) => has(table, key) ? table[key] : undefined;

export function newPersistent() {
  const p = withDicts({}, PERSISTENT_TABLES);
  p.playthroughs = 0;
  return p;
}

const MAX_STEPS = 20000;
const BACKLOG_MAX = 400;

// Halts that a save shows again on load. Waits raised by a transition are
// not among them: they happen in the middle of a @scene or @show.
function representable(h) {
  return !!h && (['input', 'game', 'pause', 'chapter', 'ending', 'video'].includes(h.type) || (h.type === 'wait' && h.reason !== 'transition'));
}

// What kind of instruction this is, for finding it again after an edit.
function kindOf(ins) {
  if (ins.op === 'cmd') return 'cmd:' + ins.name;
  if (ins.op === 'call' || ins.op === 'jump') return ins.op + ':' + ins.label;
  return ins.op;
}

export class VM {
  constructor(program, opts = {}) {
    this.program = program;
    this.registry = opts.registry || defaultRegistry();
    this.persistent = Object.assign(newPersistent(), clone(opts.persistent) || {});
    // A stored value whose type no longer matches the declaration (the author
    // changed `@persistent best = ""` to `= 0`) is reset, as load() does for @var.
    for (const v of Object.values(program.decls.vars)) {
      if (!v.persistent) continue;
      if (!has(this.persistent.vars, v.name) || typeof this.persistent.vars[v.name] !== typeof v.init) this.persistent.vars[v.name] = v.init;
    }
    this.strict = !!opts.strict;
    this.defaultSeed = opts.seed;
    this.maxHistory = opts.maxHistory != null ? opts.maxHistory : 150;
    this.onPersistentChange = opts.onPersistentChange || null;
    this.trackRead = opts.trackRead !== false;
    this.history = [];
    this.future = [];
    this._ahead = null;
    this.backlog = [];
    this.backlogSeq = 0;
    this.warnings = [];
    this.state = null;
    this._effects = [];
    this._halt = null;
    this.env = { get: (n) => this.getVar(n), call: (n, a) => this.callFn(n, a) };
    this._places = null;
  }

  // Whatever replaces the state or the persistent data (load, rollback, the
  // explorer restoring a clone) gets prototype-free tables again.
  get state() { return this._state; }
  set state(s) { this._state = s && typeof s === 'object' ? withDicts(s, STATE_TABLES) : s; }
  get persistent() { return this._persistent; }
  set persistent(p) { this._persistent = p && typeof p === 'object' ? withDicts(p, PERSISTENT_TABLES) : p; }

  newState(seed) {
    const vars = Object.create(null);
    for (const v of Object.values(this.program.decls.vars)) if (!v.persistent) vars[v.name] = v.init;
    return {
      pc: 0, calls: [], vars, visits: Object.create(null), rng: (seed != null ? seed : (Date.now() ^ 0x5eed)) >>> 0,
      stage: newStage(), audio: newAudio(), text: { mode: 'adv', page: [] },
      names: Object.create(null), charAttrs: Object.create(null), chosen: Object.create(null),
      chapter: null, scene: null, voice: null, lastEnding: null, halt: null, haltPc: null, pov: null,
    };
  }

  need() {
    if (!this.state) throw new Error('The story has not started yet. Call vm.start() or vm.load(save) first.');
  }

  // Forget the rollforward path (a new playthrough, a load, a jump or a new step).
  dropFuture() { this.future = []; this._ahead = null; }

  // ---- driving ---------------------------------------------------------
  start(label, opts = {}) {
    this.state = this.newState(opts.seed != null ? opts.seed : this.defaultSeed);
    this.history = [];
    this.dropFuture();
    this.backlog = [];
    this.backlogSeq = 0;
    this.warnings = [];
    const target = label || this.program.start;
    const pc = lookup(this.program.labels, target);
    if (pc == null) throw new Error(`Unknown scene \`${target}\`.`);
    this.state.pc = pc;
    if (opts.vars) for (const [k, v] of Object.entries(opts.vars)) this.setVar(k, v);
    return this.run([{ type: 'restore', ...this.view() }]);
  }

  advance() {
    this.need();
    this.dropFuture();
    const h = this.state.halt;
    if (h && (h.type === 'menu' || h.type === 'input' || h.type === 'game')) throw new Error(`The story is waiting for ${h.type === 'menu' ? 'a choice' : 'input'}, not a click.`);
    if (h && h.type === 'end') return { effects: [], halt: h };
    return this.run();
  }

  choose(index) {
    this.need();
    const h = this.state.halt;
    if (!h || h.type !== 'menu') throw new Error('The story is not at a choice.');
    const ins = this.program.code[h.pc];
    const shown = h.options.find(o => o.index === index);
    if (!shown) throw new Error(`Choice ${index} is not available here.`);
    if (shown.disabled) throw new Error(`Choice ${index} is locked.`);
    const o = ins.options[index];
    this.dropFuture();
    this.state.chosen[o.id] = 1;
    if (!this.persistent.chosen[o.id]) { this.persistent.chosen[o.id] = 1; this.persistentChanged(); }
    this.addBacklog({ choice: true, text: shown.plain });
    if (o.pc === 'END') {
      this._effects = []; this._halt = null;
      this.endGame({});
      this.state.halt = this._halt;
      this.state.haltPc = null;
      return { effects: this._effects, halt: this._halt };
    }
    this.state.pc = o.pc === -1 ? ins.next : o.pc;
    return this.run();
  }

  submit(value) {
    this.need();
    const h = this.state.halt;
    if (!h || (h.type !== 'input' && h.type !== 'game')) throw new Error('The story is not waiting for input.');
    this._effects = [];
    if (h.type === 'input') {
      let v = String(value == null ? '' : value).slice(0, h.max || 64).trim();
      if (!v) v = h.default || '';
      this.setVar(h.var, v);
    } else if (h.into) this.gameResult(h, value);
    return this.run(this._effects);
  }

  // A @game result, converted to the type of its `into=` variable (a
  // variable's type is fixed). No result keeps the variable's value; a result
  // that can't be converted is reported and keeps it too.
  gameResult(h, value) {
    const d = lookup(this.program.decls.vars, h.into);
    if (!d || value == null) return;
    const ins = this.program.code[this.state.haltPc];
    const loc = ins && ins.loc;
    let v;
    if (d.type === 'number') {
      if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) v = Number(value);
      if (!Number.isFinite(v)) v = undefined;
    } else if (d.type === 'bool') {
      if (value === true || value === 'true' || value === 1) v = true;
      else if (value === false || value === 'false' || value === 0) v = false;
    } else if (typeof value !== 'object') v = String(value);
    if (v === undefined) {
      const want = d.type === 'bool' ? 'true/false value' : d.type;
      this.warn(`The gameplay module \`${h.id}\` returned ${JSON.stringify(value)}, which is not a ${want}, so \`${h.into}\` keeps its value. Make the module resolve with a ${want}${h.results ? ` (one of: ${h.results.join(', ')})` : ''}.`, loc);
      return;
    }
    if (h.results && h.results.length && !h.results.map(String).includes(String(v))) {
      this.warn(`The gameplay module \`${h.id}\` returned ${JSON.stringify(value)}, which is not in its \`results=\` list (${h.results.join(', ')}). Add it to the list, so \`shiori explore\` tries that result too.`, loc);
    }
    this.setVar(h.into, v);
  }

  rollback() {
    const h = this.state && this.state.halt;
    if (!this.canRollback()) return null;
    // Keep the furthest backlog, so rolling forward can put back entries
    // (such as the choice made) that only appear between two lines.
    if (!this.future.length) this._ahead = { entries: this.backlog.slice(), seq: this.backlogSeq };
    if (h && h.hist) this.future.push(this.history.pop());
    const snap = this.history.pop();
    if (!snap) return null;
    this.state = clone(snap.state);
    this.truncateBacklog(snap.backlogSeq);
    return this.run([{ type: 'restore', ...this.view(), rollback: true }]);
  }

  // Undo a rollback: return along the same path (until a new choice is made).
  rollforward() {
    const snap = this.future.pop();
    if (!snap) return null;
    const keep = this.future, ahead = this._ahead;
    this.state = clone(snap.state);
    if (ahead) {
      this.backlog = ahead.entries.slice(0, Math.max(0, ahead.entries.length - (ahead.seq - snap.backlogSeq)));
      this.backlogSeq = snap.backlogSeq;
    } else this.truncateBacklog(snap.backlogSeq);
    const r = this.run([{ type: 'restore', ...this.view(), rollforward: true }]);
    this.future = keep;
    this._ahead = ahead;
    return r;
  }

  canRollforward() { return this.future.length > 0; }

  canRollback() {
    const h = this.state && this.state.halt;
    return this.history.length > (h && h.hist ? 1 : 0);
  }

  // Jump straight to a scene (debugging, scene replay).
  jump(label) {
    this.need();
    const pc = lookup(this.program.labels, label);
    if (pc == null) throw new Error(`Unknown scene \`${label}\`.`);
    this.dropFuture();
    this.state.pc = pc;
    this.state.calls = [];
    return this.run();
  }

  run(pre = []) {
    this._effects = pre.slice();
    this._halt = null;
    const code = this.program.code;
    let steps = 0, at = null;
    while (!this._halt) {
      if (++steps > MAX_STEPS) {
        this.fail('R703', `The story ran ${MAX_STEPS} steps without stopping for the player. A loop of jumps has no text or choice in it.`, code[this.state.pc] && code[this.state.pc].loc, true);
        at = null;
        break;
      }
      const pc = this.state.pc;
      const ins = code[pc];
      if (!ins) { at = null; this.halt({ type: 'end', ending: this.state.lastEnding, implicit: true }); break; }
      this.state.pc = pc + 1;
      at = pc;
      try { this.exec(ins, pc); }
      catch (e) {
        if (!(e instanceof ExprError)) throw e;
        this.exprFail(e, ins.loc);
        // A condition that can't be evaluated counts as false: never fall
        // into a body that nobody chose.
        if (ins.op === 'branch') this.state.pc = ins.else;
        else if (ins.op === 'menu') this.state.pc = ins.next;
      }
    }
    this.state.halt = this._halt;
    this.state.haltPc = at;
    return { effects: this._effects, halt: this._halt };
  }

  // ---- for commands -----------------------------------------------------
  emit(effect) { this._effects.push(effect); }
  halt(h) { this._halt = h; }
  warn(message, loc, code = 'R700') {
    const w = { code, message, loc };
    this.warnings.push(w);
    this.emit({ type: 'warning', ...w });
  }
  fail(code, message, loc, force) {
    const err = { code, message, loc };
    this.warnings.push(err);
    if (this.strict || force) this.halt({ type: 'error', ...err });
    else this.emit({ type: 'error', ...err });
  }
  exprFail(e, loc) { this.fail(e.code && e.code.startsWith('R') ? e.code : 'R700', e.message, loc); }
  persistentChanged() { if (this.onPersistentChange) this.onPersistentChange(this.persistent); }

  // A condition; one that fails at runtime (division by zero...) is reported and counts as false.
  holds(ast, loc) {
    try { return truthy(this.eval(ast)); }
    catch (e) { if (!(e instanceof ExprError)) throw e; this.exprFail(e, loc); return false; }
  }

  getVar(name) {
    const d = lookup(this.program.decls.vars, name);
    if (d && d.persistent) return this.persistent.vars[name];
    return this.state.vars[name];
  }
  setVar(name, value) {
    const d = lookup(this.program.decls.vars, name);
    if (!d) throw new ExprError('R700', `Unknown variable \`${name}\`.`);
    if (d.persistent) { this.persistent.vars[name] = value; this.persistentChanged(); }
    else this.state.vars[name] = value;
  }
  eval(ast) { return evaluate(ast, this.env); }

  displayName(id) {
    const c = lookup(this.program.decls.characters, id);
    if (!c) return id;
    return this.state.names[id] != null ? this.state.names[id] : c.name;
  }

  callFn(name, args) {
    switch (name) {
      case 'visited': return this.state.visits[args[0]] || 0;
      case 'ending_seen': return !!this.persistent.endings[args[0]];
      // Only this game's endings: ids from an earlier build don't count.
      case 'endings_seen': return Object.keys(this.persistent.endings).filter(id => has(this.program.decls.endings, id)).length;
      case 'random': {
        // Either order of bounds means the same range; with no whole number in it, the lower bound rounded up.
        const x = Number(args[0]), y = Number(args[1]);
        const a = Math.ceil(Math.min(x, y)), b = Math.max(a, Math.floor(Math.max(x, y)));
        if (this.randomHook) return this.randomHook('random', a, b);
        const r = nextRandom(this.state.rng); this.state.rng = r.seed;
        return a + Math.floor(r.value * (b - a + 1));
      }
      case 'chance': {
        if (this.randomHook) return this.randomHook('chance', Number(args[0]));
        const r = nextRandom(this.state.rng); this.state.rng = r.seed; return r.value < Number(args[0]);
      }
      case 'count': return args.filter(Boolean).length;
      case 'min': return Math.min(...args.map(Number));
      case 'max': return Math.max(...args.map(Number));
      case 'clamp': return Math.min(Math.max(Number(args[0]), Number(args[1])), Number(args[2]));
      case 'abs': return Math.abs(Number(args[0]));
      case 'floor': return Math.floor(Number(args[0]));
      case 'ceil': return Math.ceil(Number(args[0]));
      case 'round': return Math.round(Number(args[0]));
      case 'len': return String(args[0]).length;
      case 'upper': return String(args[0]).toUpperCase();
      case 'lower': return String(args[0]).toLowerCase();
    }
    throw new ExprError('R700', `Unknown function ${name}().`);
  }

  view() {
    return { stage: clone(this.state.stage), audio: clone(this.state.audio), text: clone(this.state.text), names: clone(this.state.names), pov: this.state.pov || null };
  }

  // ---- history and backlog ---------------------------------------------------
  // The snapshot is taken before the line runs; keep() records it.
  snapshot(pc) {
    if (this.maxHistory <= 0) return null;
    const snap = clone(this.state);
    snap.pc = pc;
    snap.halt = null;
    snap.haltPc = null;
    return { state: snap, backlogSeq: this.backlogSeq };
  }
  keep(snap) {
    if (!snap) return;
    this.history.push(snap);
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  // The backlog keeps the last BACKLOG_MAX entries. backlogSeq counts every
  // entry ever added, so a snapshot's backlogSeq still says where to cut
  // after old entries were dropped from the front.
  addBacklog(entry) {
    this.backlog.push(entry);
    this.backlogSeq++;
    if (this.backlog.length > BACKLOG_MAX) this.backlog.splice(0, this.backlog.length - BACKLOG_MAX);
  }
  backlogUntil(seq) {
    return this.backlog.slice(0, Math.max(0, this.backlog.length - Math.max(0, this.backlogSeq - seq)));
  }
  truncateBacklog(seq) {
    const drop = this.backlogSeq - seq;
    if (drop <= 0) return;
    this.backlog.length = Math.max(0, this.backlog.length - drop);
    this.backlogSeq = seq;
  }

  // ---- instructions -------------------------------------------------------
  exec(ins, pc) {
    const st = this.state;
    switch (ins.op) {
      case 'scene':
        st.visits[ins.id] = (st.visits[ins.id] || 0) + 1;
        st.scene = ins.id;
        if (!this.persistent.scenes[ins.id]) { this.persistent.scenes[ins.id] = 1; this.persistentChanged(); }
        this.emit({ type: 'scene', id: ins.id, title: ins.title || null });
        return;
      case 'say': return this.say(ins, pc);
      case 'menu': return this.menu(ins, pc);
      case 'jump':
        if (ins.pc == null) { this.fail('R700', `Jump to unknown scene \`${ins.label}\`.`, ins.loc, true); return; }
        st.pc = ins.pc;
        return;
      case 'goto': st.pc = ins.pc; return;
      case 'branch': {
        const v = truthy(this.eval(ins.cond)); // a throw counts as false (see run())
        if (this.onBranch) this.onBranch(pc, v);
        if (!v) st.pc = ins.else;
        return;
      }
      case 'call':
        if (ins.pc == null) { this.fail('R700', `Call to unknown scene \`${ins.label}\`.`, ins.loc, true); return; }
        if (st.calls.length > 200) { this.fail('R703', 'More than 200 nested @call without @return.', ins.loc, true); return; }
        st.calls.push(st.pc);
        st.pc = ins.pc;
        return;
      case 'return':
        if (!st.calls.length) { this.fail('R702', '`@return` was reached, but no `@call` is waiting for it.', ins.loc, true); return; }
        st.pc = st.calls.pop();
        return;
      case 'set': return this.assign(ins);
      case 'assert':
        if (!truthy(this.eval(ins.cond))) this.fail('R701', `Assertion failed: ${ins.message || ins.src}`, ins.loc);
        return;
      case 'end': return this.endGame(ins);
      case 'cmd': {
        const def = this.registry.get(ins.name);
        if (!def || !def.exec) return;
        try { def.exec(ins, this); }
        catch (e) {
          // A bad expression or an unknown variable is reported by run(), as for any line.
          if (e instanceof ExprError) throw e;
          this.moduleFailed(def, ins, e);
        }
        return;
      }
    }
    throw new Error('Unknown instruction ' + ins.op);
  }

  // A module's exec() threw: report it at the script line and go on with the
  // next instruction (strict mode halts, as for other runtime errors).
  moduleFailed(def, ins, e) {
    const detail = String(e && e.message != null ? e.message : e).trim().replace(/\.+$/, '') || 'no message';
    const mod = def.module || 'unknown';
    const builtin = BUILTIN_MODULES.some(m => m.commands.includes(def));
    const hint = builtin
      ? 'This is a bug in Shiori, not in the script: report it with this line, and meanwhile write the line another way.'
      : `Fix \`exec()\` for \`${ins.name}\` in that module (listed under \`modules:\` in the header).`;
    this.fail('R700', `The \`${mod}\` module failed while running \`@${ins.name}\` (${detail}), so the command was skipped. ${hint}`, ins.loc);
  }

  assign(ins) {
    const v = this.eval(ins.value);
    const cur = this.getVar(ins.name);
    let next;
    switch (ins.opr) {
      case '=': next = v; break;
      case '+=': next = typeof cur === 'string' ? cur + String(v) : Number(cur) + Number(v); break;
      case '-=': next = Number(cur) - Number(v); break;
      case '*=': next = Number(cur) * Number(v); break;
      case '/=': if (Number(v) === 0) throw new ExprError('R700', 'Division by zero.'); next = Number(cur) / Number(v); break;
    }
    this.setVar(ins.name, next);
  }

  say(ins, pc) {
    const st = this.state;
    const decls = this.program.decls;
    this.keep(this.snapshot(pc));
    const who = ins.who;
    let attrs = null, color = null, name = ins.name || null;
    if (who) {
      const c = lookup(decls.characters, who);
      if (ins.attrs) {
        const before = JSON.stringify(st.charAttrs[who] || c.defaults);
        st.charAttrs[who] = { ...c.defaults, ...(st.charAttrs[who] || {}), ...ins.attrs };
        const actor = st.stage.actors.find(a => a.id === who);
        if (actor && JSON.stringify(st.charAttrs[who]) !== before) {
          actor.attrs = { ...st.charAttrs[who] };
          this.emit({ type: 'stage', op: 'show', id: who, actor: clone(actor), entering: false, with: 'dissolve', time: 0.2 });
        }
      }
      attrs = st.charAttrs[who] || { ...c.defaults };
      name = st.names[who] != null ? st.names[who] : c.name;
      color = c.color;
    }
    const getVar = (n) => this.getVar(n);
    const runs = toRuns(ins.text, getVar);
    const plain = plainText(ins.text, getVar);
    const read = !!this.persistent.read[ins.id];
    if (this.trackRead && !read) { this.persistent.read[ins.id] = 1; this.persistentChanged(); }
    const voice = st.voice;
    st.voice = null;
    const narration = !who && !ins.name;
    const pov = narration && st.pov ? { who: st.pov, name: this.displayName(st.pov), color: (lookup(decls.characters, st.pov) || {}).color || null } : null;
    this.addBacklog({ who, name, color, text: plain, voice, id: ins.id });
    if (st.text.mode === 'nvl') {
      // pov: a restored page draws narration with its POV border again.
      st.text.page.push({ who, name, color, runs, pov });
      if (st.text.page.length > 40) st.text.page.shift();
    }
    if (!st.stage.textbox) { st.stage.textbox = true; this.emit({ type: 'text', op: 'textbox', visible: true }); }
    this.halt({
      type: 'say', hist: true, who, name, color, attrs, runs, plain, id: ins.id, read, voice,
      mode: st.text.mode, nw: hasNoWait(ins.text), narration, pov, loc: ins.loc,
    });
  }

  menu(ins, pc) {
    const st = this.state;
    // Before the conditions run: random() in them replays the same after a rollback.
    const snap = this.snapshot(pc);
    const getVar = (n) => this.getVar(n);
    const options = [];
    ins.options.forEach((o, i) => {
      // A condition that fails at runtime hides its option ([if]) or locks it ([require]).
      if (o.cond && !this.holds(o.cond, o.loc || ins.loc)) return;
      if (o.once && st.chosen[o.id]) return;
      options.push({
        index: i, runs: toRuns(o.text, getVar), plain: plainText(o.text, getVar),
        disabled: !!(o.require && !this.holds(o.require, o.loc || ins.loc)), seen: !!this.persistent.chosen[o.id], hint: o.hint || null,
      });
    });
    // In strict mode a failed condition halts with the error; going on shows the menu again.
    if (this._halt) { st.pc = pc; return; }
    if (!options.some(o => !o.disabled)) {
      this.warn('A menu had no available choices, so the story continued past it.', ins.loc, 'R704');
      st.pc = ins.next;
      return;
    }
    this.keep(snap);
    this.halt({ type: 'menu', hist: true, pc, options, loc: ins.loc });
  }

  endGame(ins) {
    const ending = this.state.lastEnding;
    if (ending) { this.persistent.playthroughs++; this.persistentChanged(); }
    this.state.pc = this.program.code.length;
    this.halt({ type: 'end', ending, implicit: !!ins.implicit });
  }

  // ---- saves --------------------------------------------------------------
  // A save names its place in a way that survives edits to the script. Say
  // lines and scene headings have ids from the compiler, and a menu is named
  // after its options' ids. Any instruction is also found as "the n-th
  // instruction of its kind after the nearest named one before it" (`after`,
  // `op`, `n`), and as "the k-th of its kind in its scene" (`k`).
  places() {
    if (this._places) return this._places;
    const code = this.program.code;
    const keys = [], scenes = [], index = Object.create(null);
    let scene = null;
    code.forEach((ins, i) => {
      scene = ins.scene || scene;
      scenes.push(scene);
      let k = ins.op === 'menu' ? scene + ':menu:' + hash(ins.options.map(o => o.id).join(' ')) : ins.id || null;
      if (k != null && index[k] != null) { let n = 2; while (index[k + '#' + n] != null) n++; k += '#' + n; }
      keys.push(k);
      if (k != null) index[k] = i;
    });
    return (this._places = { keys, scenes, index });
  }

  position(pc) {
    const code = this.program.code;
    const ins = code[pc];
    if (!ins) return { scene: null, offset: 0, id: null };
    const { keys, scenes } = this.places();
    const scene = scenes[pc];
    const label = lookup(this.program.labels, scene);
    const start = label != null ? label : 0;
    const pos = { scene, offset: pc - start, id: keys[pc] };
    if (pc <= start) return pos;
    const op = kindOf(ins);
    let a = pc - 1;
    while (a > start && keys[a] == null) a--;
    let n = 0, k = 0;
    for (let i = start + 1; i <= pc; i++) {
      if (kindOf(code[i]) !== op) continue;
      k++;
      if (i > a) n++;
    }
    return { ...pos, op, after: keys[a], n, k };
  }

  // The instruction a saved position names, or null if it is gone.
  locate(pos) {
    if (!pos) return null;
    const { index, scenes } = this.places();
    const code = this.program.code;
    if (pos.id && index[pos.id] != null) return index[pos.id];
    if (!pos.op) return null;
    // The n-th instruction of the saved kind after `from`, in the same scene.
    // `orLast` settles for the last one there is (one before it was deleted).
    const nth = (from, n, orLast) => {
      let found = null, seen = 0;
      for (let i = from + 1; i < code.length && scenes[i] === scenes[from]; i++) {
        if (kindOf(code[i]) !== pos.op) continue;
        found = i;
        if (++seen >= n) return i;
      }
      return orLast ? found : null;
    };
    if (pos.after && index[pos.after] != null) return nth(index[pos.after], pos.n || 1, true);
    // The line before it was edited too. Counting from the scene heading is a
    // poor guess for text lines (any inserted line shifts it), but a good one
    // for menus, commands and @call.
    const heading = pos.scene ? lookup(this.program.labels, pos.scene) : undefined;
    if (pos.op !== 'say' && pos.k && heading != null) return nth(heading, pos.k, false);
    return null;
  }

  resolvePosition(pos) {
    const label = (id) => lookup(this.program.labels, id);
    if (!pos) return label(this.program.start);
    const pc = this.locate(pos);
    if (pc != null) return pc;
    if (pos.scene && label(pos.scene) != null) return label(pos.scene);
    return label(this.program.start);
  }

  // The save is the snapshot of the current line, so loading shows it again.
  // At an input, a gameplay module, a pause, a chapter or ending card, a
  // video or a @wait, the save keeps that halt and loading shows it again.
  save(meta = {}) {
    this.need();
    const h = this.state.halt;
    const again = !(h && h.hist) && representable(h) && this.state.haltPc != null;
    let snap;
    if (h && h.hist && this.history.length) snap = this.history[this.history.length - 1];
    else snap = { state: { ...clone(this.state), halt: null }, backlogSeq: this.backlogSeq };
    const st = clone(snap.state);
    const save = {
      format: 'shiori-save', version: 1,
      game: this.program.header.title,
      programHash: this.program.hash,
      time: Date.now(),
      chapter: st.chapter, scene: st.scene,
      preview: h && h.type === 'say' ? ((h.name ? h.name + ': ' : '') + h.plain).slice(0, 140) : (h && h.type === 'menu' ? h.options.map(o => o.plain).join(' / ').slice(0, 140) : ''),
      position: this.position(again ? this.state.haltPc : st.pc),
      // Each return address is saved as the @call it returns to.
      calls: st.calls.map(pc => ({ ...this.position(pc), call: this.position(pc - 1) })),
      state: st,
      backlog: this.backlogUntil(snap.backlogSeq).slice(-150),
      ...meta,
    };
    if (again) save.halt = clone(h);
    return save;
  }

  load(save) {
    if (!save || save.format !== 'shiori-save') throw new Error('Not a Shiori save.');
    const st = Object.assign(this.newState(), clone(save.state));
    const code = this.program.code;
    const decls = this.program.decls;
    let halt = save.halt ? clone(save.halt) : null;
    if (save.programHash !== this.program.hash) {
      if (halt) {
        const at = this.locate(save.position);
        if (at != null && halt.type === 'ending') {
          // Shown again from the save, so the ending isn't counted twice.
          const e = lookup(decls.endings, halt.id);
          if (e) Object.assign(halt, { title: e.title, kind: e.kind });
          st.pc = at + 1;
          st.haltPc = at;
        } else {
          // Run the instruction again: it shows the prompt or card as now written.
          st.pc = at != null ? at : this.resolvePosition(save.position);
          halt = null;
        }
      } else st.pc = this.resolvePosition(save.position);
      st.calls = (save.calls || []).map(p => {
        const c = p.call ? this.locate(p.call) : null;
        return c != null && code[c].op === 'call' ? c + 1 : this.resolvePosition(p);
      });
      const vars = Object.create(null);
      for (const v of Object.values(decls.vars)) {
        if (v.persistent) continue;
        vars[v.name] = (has(save.state.vars, v.name) && typeof save.state.vars[v.name] === typeof v.init) ? save.state.vars[v.name] : v.init;
      }
      st.vars = vars;
      st.stage.actors = (st.stage.actors || []).filter(a => has(decls.characters, a.id) || has(decls.assets, a.id));
      // Attribute values the character no longer declares go back to the group's default.
      // A value still in its own group is kept. A value that now belongs to another
      // group moves there only when that group kept no saved value of its own and no
      // other moved value claims it; otherwise it is dropped. Key order never matters.
      const fix = (id, attrs) => {
        const c = decls.characters[id], out = { ...c.defaults };
        const valid = (g, v) => has(c.groups, g) && c.groups[g].includes(v);
        const entries = Object.entries(attrs || {});
        const kept = new Set();
        for (const [g, v] of entries) if (valid(g, v)) { out[g] = v; kept.add(g); }
        const moved = new Map();
        for (const [g, v] of entries) {
          if (valid(g, v) || !has(c.attrIndex, v)) continue;
          const to = c.attrIndex[v];
          if (kept.has(to)) continue;
          if (!moved.has(to)) moved.set(to, new Set());
          moved.get(to).add(v);
        }
        for (const [to, vs] of moved) if (vs.size === 1) out[to] = [...vs][0];
        return out;
      };
      const charAttrs = Object.create(null);
      for (const [id, attrs] of Object.entries(st.charAttrs || {})) if (has(decls.characters, id)) charAttrs[id] = fix(id, attrs);
      st.charAttrs = charAttrs;
      for (const a of st.stage.actors) if (a.kind === 'character' && has(decls.characters, a.id)) a.attrs = fix(a.id, a.attrs);
    }
    this.state = st;
    this.history = [];
    this.dropFuture();
    this.warnings = [];
    this.backlog = (save.backlog || []).slice();
    this.backlogSeq = this.backlog.length;
    const restore = { type: 'restore', ...this.view() };
    if (halt) {
      // Show the saved halt again without running its instruction a second time.
      st.halt = halt;
      this._effects = [restore];
      this._halt = halt;
      return { effects: this._effects, halt };
    }
    return this.run([restore]);
  }
}
