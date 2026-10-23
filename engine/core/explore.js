// Route explorer: plays every combination of choices, gameplay results,
// typed answers and random outcomes with real VM semantics, merging states
// that can no longer differ. Finds every ending with the shortest route to
// it (and a replay command that is checked before it is printed), runtime
// errors, failed assertions, dead ends, choices that can never be picked,
// conditions that never vary, and lines no route shows.
//
// Games that read endings or @persistent variables are played again from
// every different unlock state a playthrough can end in (deduplicated on
// what the script can actually read), until no new state appears.

import { VM, newPersistent } from './vm.js';
import { clone, wordWeight } from './util.js';
import { collectRefs, exprToString } from './expr.js';
import { liveness } from './analyze.js';

const MAX_RANDOM_BRANCHES = 6;
// Later playthroughs: at most this many in a row, and at most this many
// different starting unlock states in all.
const MAX_PASSES = 16;
const MAX_UNLOCK_STATES = 64;
// What the explorer types at an @input whose answer the story tests, besides
// the default and the strings the conditions compare it with.
const SAMPLE_INPUTS = ['Player', 'Alex'];
const MAX_INPUT_VALUES = 6;

// The outcomes worth trying for random(a, b) / chance(p).
export function randomOptions(kind, a, b) {
  if (kind === 'chance') return a <= 0 ? [false] : a >= 1 ? [true] : [false, true];
  if (!(b >= a)) return [a];
  const n = b - a + 1;
  if (n <= MAX_RANDOM_BRANCHES) return Array.from({ length: n }, (_, i) => a + i);
  const out = new Set();
  for (let i = 0; i < MAX_RANDOM_BRANCHES; i++) out.add(Math.round(a + (b - a) * i / (MAX_RANDOM_BRANCHES - 1)));
  return [...out];
}

const CMP = new Set(['==', '!=', '<', '<=', '>', '>=']);
const FLIP = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '==': '==', '!=': '!=' };
const isLit = (n) => n && (n.t === 'num' || n.t === 'str' || n.t === 'bool');
const TRUTHY = { kind: 'truthy' }, OTHER = { kind: 'other' };

// The largest count worth telling apart for a value that only grows
// (a visit count, the number of endings seen, a counter only ever raised by
// a constant): above it, every comparison the script makes comes out the
// same. Infinity when the value is used in any other way.
function capFor(use) {
  if (use.kind === 'truthy') return 1;
  if (use.kind === 'cmp' && typeof use.lit === 'number' && isFinite(use.lit)) {
    const c = use.lit;
    return Math.max(0, use.op === '>=' || use.op === '<' ? Math.ceil(c) : Math.floor(c) + 1);
  }
  return Infinity;
}

// What the script reads, and how: the explorer merges states (and unlock
// states between playthroughs) on exactly this.
export function scanReads(program) {
  const decls = program.decls.vars;
  const visitCap = {}, varCap = {}, strLits = {};
  const varOther = new Set(), notMonotone = new Set(), exprVars = new Set();
  const endingIds = new Set();
  let allEndings = false, countUsed = false, countCap = 0;
  const raise = (obj, k, v) => { obj[k] = Math.max(obj[k] == null ? 0 : obj[k], v); };
  const visit = (node, use) => {
    if (node.t === 'call') {
      if (node.name === 'visited') { const a = node.args[0]; if (a && a.t === 'str') raise(visitCap, a.v, capFor(use)); }
      else if (node.name === 'endings_seen') { countUsed = true; countCap = Math.max(countCap, capFor(use)); }
      else if (node.name === 'ending_seen') { const a = node.args[0]; if (a && a.t === 'str') endingIds.add(a.v); else allEndings = true; }
      return;
    }
    exprVars.add(node.name);
    const c = capFor(use);
    if (c === Infinity) varOther.add(node.name); else raise(varCap, node.name, c);
    if (use.kind === 'cmp' && typeof use.lit === 'string' && (use.op === '==' || use.op === '!=')) (strLits[node.name] = strLits[node.name] || new Set()).add(use.lit);
  };
  const walk = (node, use) => {
    if (!node) return;
    switch (node.t) {
      case 'var': visit(node, use); break;
      case 'call': visit(node, use); for (const a of node.args) walk(a, node.name === 'count' ? TRUTHY : OTHER); break;
      case 'un': walk(node.a, node.op === '!' ? TRUTHY : OTHER); break;
      case 'bin':
        if (node.op === '&&' || node.op === '||') { walk(node.a, TRUTHY); walk(node.b, TRUTHY); }
        else if (CMP.has(node.op) && isLit(node.b) && !isLit(node.a)) walk(node.a, { kind: 'cmp', op: node.op, lit: node.b.v });
        else if (CMP.has(node.op) && isLit(node.a) && !isLit(node.b)) walk(node.b, { kind: 'cmp', op: FLIP[node.op], lit: node.a.v });
        else { walk(node.a, OTHER); walk(node.b, OTHER); }
    }
  };
  // Variables that decide what happens: read by a condition, or feeding one.
  const condVars = new Set();
  const feeds = {};
  for (const ins of program.code) {
    const cond = (ast) => { if (!ast) return; walk(ast, TRUTHY); for (const v of collectRefs(ast).vars) condVars.add(v.name); };
    if (ins.op === 'branch' || ins.op === 'assert') cond(ins.cond);
    else if (ins.op === 'menu') for (const o of ins.options) { cond(o.cond); cond(o.require); }
    else if (ins.op === 'set') {
      walk(ins.value, OTHER);
      const step = ins.value && ins.value.t === 'num' ? ins.value.v : NaN;
      if (!((ins.opr === '+=' && step >= 0) || (ins.opr === '-=' && step <= 0))) notMonotone.add(ins.name);
      const f = feeds[ins.name] = feeds[ins.name] || new Set();
      for (const v of collectRefs(ins.value).vars) f.add(v.name);
    } else if (ins.op === 'cmd' && ins.name === 'input') notMonotone.add(ins.args.var);
    else if (ins.op === 'cmd' && ins.name === 'game' && ins.args.into) notMonotone.add(ins.args.into);
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const v of [...condVars]) for (const w of feeds[v] || []) if (!condVars.has(w)) { condVars.add(w); changed = true; }
  }
  const monotoneCap = {};
  for (const [n, c] of Object.entries(varCap)) {
    const d = decls[n];
    if (d && typeof d.init === 'number' && !varOther.has(n) && !notMonotone.has(n)) monotoneCap[n] = c;
  }
  const persistentVars = [...exprVars].filter(n => decls[n] && decls[n].persistent).sort();
  return { visitCap, monotoneCap, strLits, condVars, endingIds, allEndings, countUsed, countCap, persistentVars };
}

export function explore(program, opts = {}) {
  const maxStates = opts.maxStates || 250000;
  const registry = opts.registry;
  const live = liveness(program);
  const reads = scanReads(program);
  const declaredEndings = Object.values(program.decls.endings);
  const usesPersistent = reads.endingIds.size > 0 || reads.allEndings || reads.countUsed || reads.persistentVars.length > 0;
  const maxPasses = opts.passes || (usesPersistent ? MAX_PASSES : 1);
  const maxUnlockStates = opts.maxUnlockStates || MAX_UNLOCK_STATES;
  const basePersistent = { ...newPersistent(), ...clone(opts.persistent || {}) };

  const clampVar = (n, v) => (typeof v === 'number' && reads.monotoneCap[n] != null) ? Math.min(v, reads.monotoneCap[n]) : v;
  // The part of the unlock state (endings seen, @persistent values) that the
  // script can tell apart.
  const relevantIds = reads.allEndings ? declaredEndings.map(e => e.id) : [...reads.endingIds];
  relevantIds.sort();
  function persistentKey(p) {
    if (!usesPersistent) return '';
    let k = 'e=' + relevantIds.filter(id => p.endings[id]).join(',');
    if (reads.countUsed) k += '|n=' + Math.min(Object.keys(p.endings).filter(id => program.decls.endings[id]).length, reads.countCap);
    for (const n of reads.persistentVars) {
      const v = p.vars && n in p.vars ? p.vars[n] : program.decls.vars[n].init;
      k += '|' + n + '=' + JSON.stringify(clampVar(n, v));
    }
    return k;
  }

  const report = {
    states: 0, truncated: false, frontier: 0,
    endings: {}, plainEnds: [], errors: [], assertions: [], warnings: [],
    linesSeen: new Set(), optionsTaken: new Set(), optionsShown: new Set(), menusSeen: new Set(), scenesSeen: new Set(),
    branches: {}, routes: 0, randomUsed: false,
  };
  const routeKeys = new Set(), endingRoutes = {};

  // Play once from the given unlock state, then again from every new unlock
  // state those playthroughs end in, breadth first, until nothing new
  // appears.
  const startKeys = new Set([persistentKey(basePersistent)]);
  const starts = [{ persistent: basePersistent, pass: 1 }];
  // passes: the last playthrough (in a row) that showed something new;
  // deepest: the most playthroughs in a row explored.
  let passes = 1, deepest = 0, unlocksPartial = false;
  const coverage = () => Object.keys(report.endings).length + report.linesSeen.size + report.optionsShown.size + report.optionsTaken.size +
    report.scenesSeen.size + report.errors.length + report.assertions.length + report.plainEnds.length +
    Object.values(report.branches).reduce((n, b) => n + (b.t > 0) + (b.f > 0), 0);
  for (let i = 0; i < starts.length; i++) {
    const { persistent, pass } = starts[i];
    starts[i] = null;
    deepest = Math.max(deepest, pass);
    const before = coverage();
    const ends = new Map();
    runPass(persistent, pass, ends);
    if (coverage() > before) passes = Math.max(passes, pass);
    if (report.truncated) break;
    for (const [k, p] of ends) {
      if (startKeys.has(k)) continue;
      if (pass >= maxPasses || startKeys.size >= maxUnlockStates) { unlocksPartial = true; continue; }
      startKeys.add(k);
      starts.push({ persistent: p, pass: pass + 1 });
    }
  }
  if (unlocksPartial) {
    pushUnique(report.warnings, {
      code: null,
      message: `Stopped replaying after ${deepest} playthroughs in a row and ${startKeys.size} different sets of endings seen and @persistent values, with more still to try. Endings, lines and choices that need more playthroughs show up as not reached.`,
    });
  }

  // Two states at the same choice merge when everything the rest of the story
  // can still read is equal, so asking A-then-B and B-then-A are one state.
  // Counts that only grow are compared up to the largest value the script
  // tells apart. The unlock state always counts: a later playthrough reads it.
  function key(vm, at) {
    const st = vm.state;
    let k = at + '|' + st.calls.join(',') + '|' + (st.lastEnding || '');
    if (usesPersistent) k += '|P:' + persistentKey(vm.persistent);
    for (const x of live[at] || []) {
      if (x.startsWith('v:')) {
        const n = x.slice(2), d = program.decls.vars[n];
        k += '|' + n + '=' + JSON.stringify(clampVar(n, d && d.persistent ? vm.persistent.vars[n] : st.vars[n]));
      } else if (x.startsWith('visit:')) {
        const s = x.slice(6), cap = reads.visitCap[s];
        k += '|' + x + '=' + Math.min(st.visits[s] || 0, cap == null ? Infinity : cap);
      } else if (x.startsWith('once:')) k += '|' + x + '=' + (st.chosen[x.slice(5)] ? 1 : 0);
      else if (x === 'endings' && !usesPersistent) k += '|e=' + Object.keys(vm.persistent.endings).sort().join(',');
    }
    return k;
  }

  function routeKey(path, rolls) {
    return path.map(p => p.game ? 'g' + p.game + '=' + p.result : p.input != null ? 'i' + p.value : p.choice).join(',') + '|' + rolls.join(',');
  }

  function recordEnding(id, path, words, rolls, pass, startPersistent) {
    const decl = program.decls.endings[id];
    const e = report.endings[id] = report.endings[id] || { id, title: decl ? decl.title : '(end of story)', kind: decl ? decl.kind : null, routes: 0, shortest: null, pass };
    const rk = routeKey(path, rolls);
    const seenRoutes = endingRoutes[id] = endingRoutes[id] || new Set();
    if (!seenRoutes.has(rk)) { seenRoutes.add(rk); e.routes++; }
    e.pass = Math.min(e.pass, pass);
    const cand = {
      path, words: Math.round(words), rolls: rolls.slice(), pass,
      seen: Object.keys(startPersistent.endings).sort(),
      persist: Object.fromEntries(Object.entries(startPersistent.vars).filter(([k, v]) => program.decls.vars[k] && v !== program.decls.vars[k].init)),
    };
    const better = (a, b) => a.pass !== b.pass ? a.pass < b.pass : a.path.length !== b.path.length ? a.path.length < b.path.length : a.words < b.words;
    if (!e.shortest || better(cand, e.shortest)) e.shortest = cand;
    e.minWords = Math.min(e.minWords || Infinity, cand.words);
    e.maxWords = Math.max(e.maxWords || 0, cand.words);
  }

  // What to type at an @input: the default (what a player who just presses
  // Enter gets), and, when the answer decides something, the strings the
  // conditions compare it with and one ordinary name.
  function inputValues(h) {
    const def = h.default == null ? '' : String(h.default);
    const out = [def];
    if (!reads.condVars.has(h.var)) return out;
    const norm = (v) => String(v).slice(0, h.max || 64).trim() || def;
    const add = (v) => {
      const s = String(v);
      // Values `shiori play --choices` can type: not empty, not a number, no comma.
      if (!s.trim() || !isNaN(Number(s)) || s.includes(',')) return;
      if (out.length < MAX_INPUT_VALUES && !out.some(x => norm(x) === norm(s))) out.push(s);
    };
    const lits = reads.strLits[h.var] || new Set();
    for (const s of lits) add(s);
    const sample = SAMPLE_INPUTS.find(s => !lits.has(s) && norm(s) !== norm(def));
    if (sample) add(sample);
    return out;
  }

  function runPass(startPersistent, pass, endStates) {
    const vm = new VM(program, { registry, persistent: startPersistent, maxHistory: 0, strict: true, seed: opts.seed || 1, trackRead: false });
    vm.onBranch = (pc, v) => { const b = report.branches[pc] = report.branches[pc] || { t: 0, f: 0 }; if (v) b.t++; else b.f++; };
    const seen = new Set();
    // Each item re-runs one segment: restore `pre`, perform `action`, then
    // play until the next branching point. `forced` fixes random outcomes;
    // `got` lists the endings reached earlier on the route.
    const queue = [{ pre: null, action: { type: 'start' }, path: [], words: 0, rolls: [], forced: [], got: [] }];
    let head = 0;
    while (head < queue.length) {
      if (report.states >= maxStates) { report.truncated = true; report.frontier = queue.length - head; return; }
      const item = queue[head];
      queue[head++] = null;
      const log = [];
      vm.randomHook = (kind, a, b) => {
        report.randomUsed = true;
        const options = randomOptions(kind, a, b);
        const i = log.length;
        const v = i < item.forced.length ? item.forced[i] : options[0];
        log.push({ options, v });
        return v;
      };
      let r;
      if (!item.pre) r = vm.start(null, { seed: opts.seed || 1 });
      else {
        vm.state = clone(item.pre.state);
        vm.persistent = clone(item.pre.persistent);
        vm.history = []; vm.backlog = [];
        r = item.action.type === 'choose' ? vm.choose(item.action.index) : vm.submit(item.action.value);
      }
      let words = item.words;
      let path = item.path, got = item.got;
      let guard = 0;
      let branchAt = null;
      const rollsNow = () => item.rolls.concat(log.map(x => x.v));
      for (;;) {
        if (++guard > 200000) { pushUnique(report.errors, { code: 'R703', message: 'A route did not finish (too long without a choice).', path }); break; }
        report.states++;
        for (const e of r.effects) {
          if (e.type === 'scene') report.scenesSeen.add(e.id);
          else if (e.type === 'error') pushUnique(report.errors, { code: e.code, message: e.message, loc: e.loc, path });
          else if (e.type === 'warning') pushUnique(report.warnings, { code: e.code, message: e.message, loc: e.loc, path });
        }
        const h = r.halt;
        if (vm.state.scene) report.scenesSeen.add(vm.state.scene);
        if (h.type === 'say') {
          report.linesSeen.add(h.id);
          words += wordWeight(h.plain);
          r = vm.advance();
          continue;
        }
        if (h.type === 'ending') {
          recordEnding(h.id, path, words, rollsNow(), pass, startPersistent);
          got = got.concat([h.id]);
          r = vm.advance();
          continue;
        }
        if (h.type === 'error') {
          const list = h.code === 'R701' ? report.assertions : report.errors;
          pushUnique(list, { code: h.code, message: h.message, loc: h.loc, path });
          if (h.code === 'R701') { vm.strict = false; r = vm.run(); vm.strict = true; continue; }
          break;
        }
        if (h.type === 'end') {
          const rk = routeKey(path, rollsNow()) + '|' + got.join(',');
          if (!routeKeys.has(rk)) { routeKeys.add(rk); report.routes++; }
          if (!vm.state.lastEnding) {
            if (declaredEndings.length) {
              pushUnique(report.plainEnds, { scene: vm.state.scene, path, implicit: h.implicit, code: 'W603' });
            } else recordEnding('END', path, words, rollsNow(), pass, startPersistent);
          }
          const pk = persistentKey(vm.persistent);
          if (!endStates.has(pk)) endStates.set(pk, clone(vm.persistent));
          break;
        }
        if (h.type === 'menu' || h.type === 'game') { branchAt = h; break; }
        if (h.type === 'input') {
          const values = inputValues(h);
          if (values.length > 1) { branchAt = h; break; }
          path = path.concat([{ input: h.var, value: values[0], default: values[0] }]);
          r = vm.submit(values[0]);
          continue;
        }
        r = vm.advance();
      }
      // Try the other outcomes of any random() / chance() met in this segment.
      for (let j = item.forced.length; j < log.length; j++) {
        for (const alt of log[j].options) {
          if (alt === log[j].v) continue;
          queue.push({ ...item, forced: log.slice(0, j).map(x => x.v).concat([alt]) });
        }
      }
      if (!branchAt) continue;
      const rolls = rollsNow();
      const h = branchAt;
      if (h.type === 'menu') {
        const ins = program.code[h.pc];
        report.menusSeen.add(h.pc);
        const k = key(vm, h.pc);
        if (seen.has(k)) continue;
        seen.add(k);
        const pre = { state: clone(vm.state), persistent: clone(vm.persistent) };
        for (const o of h.options) {
          report.optionsShown.add(h.pc + ':' + o.index);
          if (o.disabled) continue;
          report.optionsTaken.add(h.pc + ':' + o.index);
          queue.push({ pre, action: { type: 'choose', index: o.index }, path: path.concat([{ choice: o.index + 1, text: o.plain, loc: ins.options[o.index].loc }]), words, rolls, forced: [], got });
        }
      } else {
        const k = key(vm, vm.state.pc - 1);
        if (seen.has(k)) continue;
        seen.add(k);
        const pre = { state: clone(vm.state), persistent: clone(vm.persistent) };
        if (h.type === 'input') {
          const def = h.default == null ? '' : String(h.default);
          for (const v of inputValues(h)) queue.push({ pre, action: { type: 'submit', value: v }, path: path.concat([{ input: h.var, value: v, default: def, branch: true }]), words, rolls, forced: [], got });
        } else {
          const results = h.results && h.results.length ? h.results : [null];
          for (const res of results) queue.push({ pre, action: { type: 'submit', value: res }, path: path.concat([{ game: h.id, result: res }]), words, rolls, forced: [], got });
        }
      }
    }
  }

  // Check every replay before showing it, and keep only the --seen endings
  // it needs.
  for (const e of Object.values(report.endings)) {
    const s = e.shortest;
    if (!s) continue;
    if (e.id === 'END') { s.verified = true; continue; }
    const tryRun = (seenIds) => replayEnds(program, s.path, { endings: Object.fromEntries(seenIds.map(id => [id, { first: 0, count: 1 }])), vars: s.persist }, registry, s.rolls, e.id);
    s.verified = tryRun(s.seen);
    if (s.verified) {
      for (const id of s.seen.slice()) {
        const fewer = s.seen.filter(x => x !== id);
        if (tryRun(fewer)) s.seen = fewer;
      }
    }
  }

  const allLines = Object.keys(program.lines);
  const unseenLines = allLines.filter(id => !report.linesSeen.has(id)).map(id => ({ id, ...program.lines[id] }));
  const neverShown = [], neverTaken = [];
  program.code.forEach((ins, pc) => {
    if (ins.op !== 'menu' || !report.menusSeen.has(pc)) return;
    ins.options.forEach((o, i) => {
      const k = pc + ':' + i;
      const text = o.text.map(t => t.s || '').join('');
      if (!report.optionsShown.has(k)) neverShown.push({ loc: o.loc, text });
      else if (!report.optionsTaken.has(k)) neverTaken.push({ loc: o.loc, text });
    });
  });
  // Conditions that came out the same on every explored route.
  const constant = [];
  if (!report.truncated && !unlocksPartial) {
    for (const [pc, b] of Object.entries(report.branches)) {
      const ins = program.code[pc];
      if (!ins || !ins.cond || ins.cond.t === 'bool') continue;
      const cond = exprToString(ins.cond).replace(/^\((.*)\)$/, '$1');
      if (b.t > 0 && b.f === 0) constant.push({ loc: ins.loc, cond, always: true, count: b.t });
      if (b.f > 0 && b.t === 0) constant.push({ loc: ins.loc, cond, always: false, count: b.f });
    }
  }
  return {
    states: report.states, truncated: report.truncated, frontier: report.frontier, maxStates,
    // passes: playthroughs in a row needed to see everything that was found;
    // playthroughs: the most in a row explored; unlockStates: how many
    // different starting unlock states were played from; unlocksPartial: the
    // limits on either stopped the search before it ran out of new states.
    passes, playthroughs: deepest, unlockStates: startKeys.size, unlocksPartial,
    routes: report.routes, randomUsed: report.randomUsed,
    endings: Object.values(report.endings),
    unreachedEndings: declaredEndings.filter(e => !report.endings[e.id]).map(e => ({ id: e.id, title: e.title, loc: e.loc, code: 'W611' })),
    plainEnds: report.plainEnds,
    errors: report.errors, assertions: report.assertions, warnings: report.warnings,
    lines: { total: allLines.length, seen: report.linesSeen.size, unseen: unseenLines },
    scenes: { total: program.sceneOrder.length, seen: report.scenesSeen.size, unseen: program.sceneOrder.filter(s => !report.scenesSeen.has(s)) },
    options: { neverShown, neverTaken },
    constantConditions: constant,
  };
}

// Replay a route (choices, gameplay results, typed answers, random rolls)
// with the given persistent data. With `endingId`, returns whether that
// ending is reached; without, returns the last ending reached (or null).
export function replayEnds(program, path, persistent, registry, rolls = [], endingId = null) {
  const vm = new VM(program, { registry, persistent: { ...newPersistent(), ...clone(persistent) }, maxHistory: 0, seed: 1, trackRead: false });
  let ri = 0;
  vm.randomHook = (kind, a, b) => ri < rolls.length ? rolls[ri++] : randomOptions(kind, a, b)[0];
  let r = vm.start(null, { seed: 1 });
  let i = 0;
  for (let guard = 0; guard < 400000; guard++) {
    const h = r.halt;
    if (h.type === 'ending' && endingId && h.id === endingId) return true;
    if (h.type === 'end') return endingId ? false : vm.state.lastEnding;
    if (h.type === 'error') return endingId ? false : null;
    if (h.type === 'menu') {
      const step = path[i++];
      if (!step || step.game || step.input != null || !h.options.some(o => o.index === step.choice - 1 && !o.disabled)) return endingId ? false : null;
      r = vm.choose(step.choice - 1);
      continue;
    }
    if (h.type === 'game') { const step = path[i++]; r = vm.submit(step ? step.result : null); continue; }
    if (h.type === 'input') {
      const step = path[i];
      if (step && step.input != null) { i++; r = vm.submit(step.value); } else r = vm.submit(h.default);
      continue;
    }
    r = vm.advance();
  }
  return endingId ? false : null;
}

function pushUnique(list, item) {
  const id = (x) => x.code + '|' + x.message + '|' + (x.loc ? x.loc.file + ':' + x.loc.line : '') + '|' + (x.scene || '');
  const k = id(item);
  if (list.some(x => id(x) === k)) return;
  list.push(item);
}

const quote = (t) => /^["“'‘]/.test(t) ? t : `"${t}"`;
// Quote a value for a shell command line when it needs it.
const shq = (s) => /^[\w.\/@%+=:,-]+$/.test(s) ? s : "'" + String(s).replace(/'/g, "'\\''") + "'";

// An @input step is worth showing when the explorer tried several answers there.
const shown = (p) => p.input == null || p.branch;

export function formatPath(path) {
  const steps = path.filter(shown);
  if (!steps.length) return '(no choices)';
  return steps.map(p => p.game ? `[${p.game} → ${p.result}]` : p.input != null ? `[${p.input} = ${JSON.stringify(p.value)}${p.value === p.default ? ' (default)' : ''}]` : `${p.choice} ${quote(p.text)}`).join(' → ');
}

// The --choices list for `shiori play`: choice numbers, plus the text typed
// at an @input when it is not the default.
export function choiceList(path) {
  return path.filter(p => !p.game && (p.input == null || p.value !== p.default)).map(p => p.input != null ? p.value : p.choice).join(',');
}

// The `shiori play` arguments that replay a route found by explore.
export function replayArgs(e) {
  const s = e.shortest;
  if (!s) return '';
  const parts = [];
  const choices = choiceList(s.path);
  if (choices) parts.push('--choices ' + shq(choices));
  const games = s.path.filter(p => p.game).map(p => `${p.game}=${p.result}`);
  if (games.length) parts.push('--game ' + shq(games.join(',')));
  if (s.rolls && s.rolls.length) parts.push('--rolls ' + s.rolls.join(','));
  if (s.seen && s.seen.length) parts.push('--seen ' + shq(s.seen.join(',')));
  if (s.persist && Object.keys(s.persist).length) parts.push('--set ' + shq(Object.entries(s.persist).map(([k, v]) => k + '=' + v).join(',')));
  return parts.join(' ');
}
