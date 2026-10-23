// The story VM. Host-agnostic: the browser player, the CLI and the route
// explorer all drive it the same way.
//
//   const vm = new VM(program);
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
import { clone, nextRandom } from './util.js';
import { newStage } from './modules/stage.js';
import { newAudio } from './modules/audio.js';
import { defaultRegistry } from './modules/index.js';

export function newPersistent() {
  return { vars: {}, endings: {}, read: {}, cgs: {}, music: {}, scenes: {}, chosen: {}, playthroughs: 0 };
}

const MAX_STEPS = 20000;
const BACKLOG_MAX = 400;

export class VM {
  constructor(program, opts = {}) {
    this.program = program;
    this.registry = opts.registry || defaultRegistry();
    this.persistent = Object.assign(newPersistent(), clone(opts.persistent) || {});
    for (const v of Object.values(program.decls.vars)) {
      if (v.persistent && !(v.name in this.persistent.vars)) this.persistent.vars[v.name] = v.init;
    }
    this.strict = !!opts.strict;
    this.defaultSeed = opts.seed;
    this.maxHistory = opts.maxHistory != null ? opts.maxHistory : 150;
    this.onPersistentChange = opts.onPersistentChange || null;
    this.trackRead = opts.trackRead !== false;
    this.history = [];
    this.future = [];
    this.backlog = [];
    this.warnings = [];
    this.state = null;
    this._effects = [];
    this._halt = null;
    this.env = { get: (n) => this.getVar(n), call: (n, a) => this.callFn(n, a) };
    this._idToPc = null;
  }

  newState(seed) {
    const vars = {};
    for (const v of Object.values(this.program.decls.vars)) if (!v.persistent) vars[v.name] = v.init;
    return {
      pc: 0, calls: [], vars, visits: {}, rng: (seed != null ? seed : (Date.now() ^ 0x5eed)) >>> 0,
      stage: newStage(), audio: newAudio(), text: { mode: 'adv', page: [] },
      names: {}, charAttrs: {}, chosen: {}, chapter: null, scene: null, voice: null, lastEnding: null, halt: null, pov: null,
    };
  }

  // ---- driving ---------------------------------------------------------
  start(label, opts = {}) {
    this.state = this.newState(opts.seed != null ? opts.seed : this.defaultSeed);
    this.history = [];
    this.future = [];
    this.backlog = [];
    const target = label || this.program.start;
    const pc = this.program.labels[target];
    if (pc == null) throw new Error(`Unknown scene \`${target}\`.`);
    this.state.pc = pc;
    if (opts.vars) for (const [k, v] of Object.entries(opts.vars)) this.setVar(k, v);
    return this.run([{ type: 'restore', ...this.view() }]);
  }

  advance() {
    this.future = [];
    const h = this.state && this.state.halt;
    if (h && (h.type === 'menu' || h.type === 'input' || h.type === 'game')) throw new Error(`The story is waiting for ${h.type === 'menu' ? 'a choice' : 'input'}, not a click.`);
    if (h && h.type === 'end') return { effects: [], halt: h };
    return this.run();
  }

  choose(index) {
    const h = this.state.halt;
    if (!h || h.type !== 'menu') throw new Error('The story is not at a choice.');
    const ins = this.program.code[h.pc];
    const shown = h.options.find(o => o.index === index);
    if (!shown) throw new Error(`Choice ${index} is not available here.`);
    if (shown.disabled) throw new Error(`Choice ${index} is locked.`);
    const o = ins.options[index];
    this.future = [];
    this.state.chosen[o.id] = 1;
    this.persistent.chosen[o.id] = 1;
    this.backlog.push({ choice: true, text: shown.plain });
    if (o.pc === 'END') {
      this._effects = []; this._halt = null;
      this.endGame({});
      this.state.halt = this._halt;
      return { effects: this._effects, halt: this._halt };
    }
    this.state.pc = o.pc === -1 ? ins.next : o.pc;
    return this.run();
  }

  submit(value) {
    const h = this.state.halt;
    if (!h || (h.type !== 'input' && h.type !== 'game')) throw new Error('The story is not waiting for input.');
    if (h.type === 'input') {
      let v = String(value == null ? '' : value).slice(0, h.max || 64).trim();
      if (!v) v = h.default || '';
      this.setVar(h.var, v);
    } else if (h.into) this.setVar(h.into, value);
    return this.run();
  }

  rollback() {
    const h = this.state && this.state.halt;
    if (!this.canRollback()) return null;
    if (h && h.hist) this.future.push(this.history.pop());
    const snap = this.history.pop();
    if (!snap) return null;
    this.state = clone(snap.state);
    this.backlog.length = Math.min(this.backlog.length, snap.backlogLen);
    return this.run([{ type: 'restore', ...this.view(), rollback: true }]);
  }

  // Undo a rollback: return along the same path (until a new choice is made).
  rollforward() {
    const snap = this.future.pop();
    if (!snap) return null;
    const keep = this.future;
    this.state = clone(snap.state);
    this.backlog.length = Math.min(this.backlog.length, snap.backlogLen);
    const r = this.run([{ type: 'restore', ...this.view(), rollforward: true }]);
    this.future = keep;
    return r;
  }

  canRollforward() { return this.future.length > 0; }

  canRollback() {
    const h = this.state && this.state.halt;
    return this.history.length > (h && h.hist ? 1 : 0);
  }

  // Jump straight to a scene (debugging, scene replay).
  jump(label) {
    const pc = this.program.labels[label];
    if (pc == null) throw new Error(`Unknown scene \`${label}\`.`);
    this.state.pc = pc;
    this.state.calls = [];
    return this.run();
  }

  run(pre = []) {
    this._effects = pre.slice();
    this._halt = null;
    const code = this.program.code;
    let steps = 0;
    while (!this._halt) {
      if (++steps > MAX_STEPS) {
        this.fail('R703', `The story ran ${MAX_STEPS} steps without stopping for the player. A loop of jumps has no text or choice in it.`, code[this.state.pc] && code[this.state.pc].loc, true);
        break;
      }
      const pc = this.state.pc;
      const ins = code[pc];
      if (!ins) { this.halt({ type: 'end', ending: this.state.lastEnding, implicit: true }); break; }
      this.state.pc = pc + 1;
      try { this.exec(ins, pc); }
      catch (e) {
        if (e instanceof ExprError) this.fail(e.code && e.code.startsWith('R') ? e.code : 'R700', e.message, ins.loc);
        else throw e;
      }
    }
    this.state.halt = this._halt;
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
  persistentChanged() { if (this.onPersistentChange) this.onPersistentChange(this.persistent); }

  getVar(name) {
    const d = this.program.decls.vars[name];
    if (d && d.persistent) return this.persistent.vars[name];
    return this.state.vars[name];
  }
  setVar(name, value) {
    const d = this.program.decls.vars[name];
    if (!d) throw new ExprError('R700', `Unknown variable \`${name}\`.`);
    if (d.persistent) { this.persistent.vars[name] = value; this.persistentChanged(); }
    else this.state.vars[name] = value;
  }
  eval(ast) { return evaluate(ast, this.env); }

  displayName(id) {
    const c = this.program.decls.characters[id];
    if (!c) return id;
    return this.state.names[id] != null ? this.state.names[id] : c.name;
  }

  callFn(name, args) {
    switch (name) {
      case 'visited': return this.state.visits[args[0]] || 0;
      case 'ending_seen': return !!this.persistent.endings[args[0]];
      case 'endings_seen': return Object.keys(this.persistent.endings).length;
      case 'random': {
        const a = Math.ceil(Number(args[0])), b = Math.floor(Number(args[1]));
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

  pushHistory(pc) {
    if (this.maxHistory <= 0) return;
    const snap = clone(this.state);
    snap.pc = pc;
    snap.halt = null;
    this.history.push({ state: snap, backlogLen: this.backlog.length });
    if (this.history.length > this.maxHistory) this.history.shift();
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
        const v = truthy(this.eval(ins.cond));
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
        if (def && def.exec) def.exec(ins, this);
        return;
      }
    }
    throw new Error('Unknown instruction ' + ins.op);
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
    this.pushHistory(pc);
    const who = ins.who;
    let attrs = null, color = null, name = ins.name || null;
    if (who) {
      const c = decls.characters[who];
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
    if (this.trackRead && !read) this.persistent.read[ins.id] = 1;
    const voice = st.voice;
    st.voice = null;
    this.backlog.push({ who, name, color, text: plain, voice, id: ins.id });
    if (this.backlog.length > BACKLOG_MAX) this.backlog.splice(0, this.backlog.length - BACKLOG_MAX);
    if (st.text.mode === 'nvl') {
      st.text.page.push({ who, name, color, runs });
      if (st.text.page.length > 40) st.text.page.shift();
    }
    if (!st.stage.textbox) { st.stage.textbox = true; this.emit({ type: 'text', op: 'textbox', visible: true }); }
    const narration = !who && !ins.name;
    const pov = narration && st.pov ? { who: st.pov, name: this.displayName(st.pov), color: (decls.characters[st.pov] || {}).color || null } : null;
    this.halt({
      type: 'say', hist: true, who, name, color, attrs, runs, plain, id: ins.id, read, voice,
      mode: st.text.mode, nw: hasNoWait(ins.text), narration, pov, loc: ins.loc,
    });
  }

  menu(ins, pc) {
    const st = this.state;
    this.pushHistory(pc);
    const getVar = (n) => this.getVar(n);
    const options = [];
    ins.options.forEach((o, i) => {
      if (o.cond && !truthy(this.eval(o.cond))) return;
      if (o.once && st.chosen[o.id]) return;
      options.push({
        index: i, runs: toRuns(o.text, getVar), plain: plainText(o.text, getVar),
        disabled: !!(o.require && !truthy(this.eval(o.require))), seen: !!this.persistent.chosen[o.id], hint: o.hint || null,
      });
    });
    if (!options.some(o => !o.disabled)) {
      this.history.pop();
      this.warn('A menu had no available choices, so the story continued past it.', ins.loc, 'R704');
      st.pc = ins.next;
      return;
    }
    this.halt({ type: 'menu', hist: true, pc, options, loc: ins.loc });
  }

  endGame(ins) {
    const ending = this.state.lastEnding;
    if (ending) { this.persistent.playthroughs++; this.persistentChanged(); }
    this.state.pc = this.program.code.length;
    this.halt({ type: 'end', ending, implicit: !!ins.implicit });
  }

  // ---- saves --------------------------------------------------------------
  position(pc) {
    const code = this.program.code;
    const ins = code[pc];
    if (!ins) return { scene: null, offset: 0, id: null };
    const scene = ins.scene;
    return { scene, offset: pc - (this.program.labels[scene] || 0), id: ins.id || null };
  }

  resolvePosition(pos) {
    if (!pos) return this.program.labels[this.program.start];
    if (pos.id) {
      if (!this._idToPc) {
        this._idToPc = {};
        this.program.code.forEach((ins, i) => { if (ins.id) this._idToPc[ins.id] = i; });
      }
      if (this._idToPc[pos.id] != null) return this._idToPc[pos.id];
    }
    if (pos.scene && this.program.labels[pos.scene] != null) return this.program.labels[pos.scene];
    return this.program.labels[this.program.start];
  }

  // The save is the snapshot of the current line, so loading shows it again.
  save(meta = {}) {
    const h = this.state.halt;
    let snap;
    if (h && h.hist && this.history.length) snap = this.history[this.history.length - 1];
    else snap = { state: { ...clone(this.state), halt: null }, backlogLen: this.backlog.length };
    const st = clone(snap.state);
    return {
      format: 'shiori-save', version: 1,
      game: this.program.header.title,
      programHash: this.program.hash,
      time: Date.now(),
      chapter: st.chapter, scene: st.scene,
      preview: h && h.type === 'say' ? ((h.name ? h.name + ': ' : '') + h.plain).slice(0, 140) : (h && h.type === 'menu' ? h.options.map(o => o.plain).join(' / ').slice(0, 140) : ''),
      position: this.position(st.pc),
      calls: st.calls.map(pc => this.position(pc)),
      state: st,
      backlog: this.backlog.slice(0, snap.backlogLen).slice(-150),
      ...meta,
    };
  }

  load(save) {
    if (!save || save.format !== 'shiori-save') throw new Error('Not a Shiori save.');
    const st = Object.assign(this.newState(), clone(save.state));
    if (save.programHash !== this.program.hash) {
      st.pc = this.resolvePosition(save.position);
      st.calls = (save.calls || []).map(p => this.resolvePosition(p));
      const vars = {};
      for (const v of Object.values(this.program.decls.vars)) {
        if (v.persistent) continue;
        vars[v.name] = (save.state.vars && v.name in save.state.vars && typeof save.state.vars[v.name] === typeof v.init) ? save.state.vars[v.name] : v.init;
      }
      st.vars = vars;
      st.stage.actors = (st.stage.actors || []).filter(a => this.program.decls.characters[a.id] || this.program.decls.assets[a.id]);
    }
    this.state = st;
    this.history = [];
    this.backlog = (save.backlog || []).slice();
    return this.run([{ type: 'restore', ...this.view() }]);
  }
}
