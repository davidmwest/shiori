// Route explorer: plays every combination of choices, gameplay results and
// random outcomes with real VM semantics, merging states that can no longer
// differ. Finds every ending with the shortest route to it (and a replay
// command that is checked before it is printed), runtime errors, failed
// assertions, dead ends, choices that can never be picked, conditions that
// never vary, and lines no route shows.

import { VM, newPersistent } from './vm.js';
import { clone, countWords } from './util.js';
import { collectRefs, exprToString } from './expr.js';
import { liveness } from './analyze.js';

const MAX_RANDOM_BRANCHES = 6;

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

export function explore(program, opts = {}) {
  const maxStates = opts.maxStates || 250000;
  const registry = opts.registry;
  const live = liveness(program);
  let usesPersistent = false;
  for (const ins of program.code) {
    const scan = (ast) => {
      if (!ast) return;
      const r = collectRefs(ast);
      if (r.calls.some(c => c.name === 'ending_seen' || c.name === 'endings_seen')) usesPersistent = true;
      if (r.vars.some(v => program.decls.vars[v.name] && program.decls.vars[v.name].persistent)) usesPersistent = true;
    };
    if (ins.op === 'branch') scan(ins.cond);
    if (ins.op === 'set') scan(ins.value);
    if (ins.op === 'menu') ins.options.forEach(o => { scan(o.cond); scan(o.require); });
  }
  const passes = opts.passes || (usesPersistent ? 3 : 1);
  const basePersistent = { ...newPersistent(), ...clone(opts.persistent || {}) };

  const report = {
    states: 0, truncated: false, frontier: 0,
    endings: {}, plainEnds: [], errors: [], assertions: [], warnings: [],
    linesSeen: new Set(), optionsTaken: new Set(), optionsShown: new Set(), menusSeen: new Set(), scenesSeen: new Set(),
    branches: {}, routes: 0, randomUsed: false,
  };

  let persistent = basePersistent;
  for (let pass = 1; pass <= passes; pass++) {
    const endPersistents = [];
    runPass(persistent, pass, endPersistents);
    if (report.truncated) break;
    const merged = clone(persistent);
    for (const p of endPersistents) {
      Object.assign(merged.endings, p.endings);
      for (const [k, v] of Object.entries(p.vars)) {
        const d = program.decls.vars[k];
        if (d && v !== d.init) merged.vars[k] = v;
      }
      merged.playthroughs = Math.max(merged.playthroughs, p.playthroughs);
    }
    if (JSON.stringify(merged.endings) === JSON.stringify(persistent.endings) && JSON.stringify(merged.vars) === JSON.stringify(persistent.vars)) break;
    persistent = merged;
  }

  // Two states at the same choice merge when everything the rest of the story
  // can still read is equal, so asking A-then-B and B-then-A are one state.
  function key(vm, at) {
    const st = vm.state;
    let k = at + '|' + st.calls.join(',') + '|' + (st.lastEnding || '');
    for (const x of live[at] || []) {
      if (x.startsWith('v:')) {
        const n = x.slice(2), d = program.decls.vars[n];
        k += '|' + n + '=' + JSON.stringify(d && d.persistent ? vm.persistent.vars[n] : st.vars[n]);
      } else if (x.startsWith('visit:')) k += '|' + x + '=' + Math.min(st.visits[x.slice(6)] || 0, 8);
      else if (x.startsWith('once:')) k += '|' + x + '=' + (st.chosen[x.slice(5)] ? 1 : 0);
      else if (x === 'endings') k += '|e=' + Object.keys(vm.persistent.endings).sort().join(',');
    }
    return k;
  }

  function recordEnding(id, item, words, rolls, pass, startPersistent) {
    const decl = program.decls.endings[id];
    const e = report.endings[id] = report.endings[id] || { id, title: decl ? decl.title : '(end of story)', kind: decl ? decl.kind : null, routes: 0, shortest: null, pass };
    e.routes++;
    e.pass = Math.min(e.pass, pass);
    const cand = {
      path: item.path, words: Math.round(words), rolls: rolls.slice(), pass,
      seen: Object.keys(startPersistent.endings).sort(),
      persist: Object.fromEntries(Object.entries(startPersistent.vars).filter(([k, v]) => program.decls.vars[k] && v !== program.decls.vars[k].init)),
    };
    const better = (a, b) => a.pass !== b.pass ? a.pass < b.pass : a.path.length !== b.path.length ? a.path.length < b.path.length : a.words < b.words;
    if (!e.shortest || better(cand, e.shortest)) e.shortest = cand;
    e.minWords = Math.min(e.minWords || Infinity, cand.words);
    e.maxWords = Math.max(e.maxWords || 0, cand.words);
  }

  function runPass(startPersistent, pass, endPersistents) {
    const vm = new VM(program, { registry, persistent: startPersistent, maxHistory: 0, strict: true, seed: opts.seed || 1 });
    vm.onBranch = (pc, v) => { const b = report.branches[pc] = report.branches[pc] || { t: 0, f: 0 }; if (v) b.t++; else b.f++; };
    const seen = new Set();
    // Each item re-runs one segment: restore `pre`, perform `action`, then
    // play until the next branching point. `forced` fixes random outcomes.
    const queue = [{ pre: null, action: { type: 'start' }, path: [], words: 0, rolls: [], forced: [] }];
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
      let guard = 0;
      let branchAt = null;
      for (;;) {
        if (++guard > 200000) { pushUnique(report.errors, { code: 'R703', message: 'A route did not finish (too long without a choice).', path: item.path }); break; }
        report.states++;
        for (const e of r.effects) {
          if (e.type === 'error') pushUnique(report.errors, { code: e.code, message: e.message, loc: e.loc, path: item.path });
          if (e.type === 'warning') pushUnique(report.warnings, { code: e.code, message: e.message, loc: e.loc, path: item.path });
        }
        const h = r.halt;
        if (vm.state.scene) report.scenesSeen.add(vm.state.scene);
        if (h.type === 'say') {
          report.linesSeen.add(h.id);
          const c = countWords(h.plain);
          words += c.words + c.cjk / 2;
          r = vm.advance();
          continue;
        }
        if (h.type === 'ending') {
          recordEnding(h.id, item, words, item.rolls.concat(log.map(x => x.v)), pass, startPersistent);
          r = vm.advance();
          continue;
        }
        if (h.type === 'error') {
          const list = h.code === 'R701' ? report.assertions : report.errors;
          pushUnique(list, { code: h.code, message: h.message, loc: h.loc, path: item.path });
          if (h.code === 'R701') { vm.strict = false; r = vm.run(); vm.strict = true; continue; }
          break;
        }
        if (h.type === 'end') {
          report.routes++;
          if (!vm.state.lastEnding) {
            if (Object.keys(program.decls.endings).length) {
              pushUnique(report.plainEnds, { scene: vm.state.scene, path: item.path, implicit: h.implicit, code: 'W603' });
            } else recordEnding('END', item, words, item.rolls.concat(log.map(x => x.v)), pass, startPersistent);
          }
          endPersistents.push(clone(vm.persistent));
          break;
        }
        if (h.type === 'menu' || h.type === 'game') { branchAt = h; break; }
        if (h.type === 'input') { r = vm.submit(h.default || 'Player'); continue; }
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
      const rolls = item.rolls.concat(log.map(x => x.v));
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
          queue.push({ pre, action: { type: 'choose', index: o.index }, path: item.path.concat([{ choice: o.index + 1, text: o.plain, loc: ins.options[o.index].loc }]), words, rolls, forced: [] });
        }
      } else {
        const k = key(vm, vm.state.pc - 1);
        if (seen.has(k)) continue;
        seen.add(k);
        const pre = { state: clone(vm.state), persistent: clone(vm.persistent) };
        const results = h.results && h.results.length ? h.results : [null];
        for (const res of results) queue.push({ pre, action: { type: 'submit', value: res }, path: item.path.concat([{ game: h.id, result: res }]), words, rolls, forced: [] });
      }
    }
  }

  // Check every replay before showing it, and find the smallest --seen list.
  for (const e of Object.values(report.endings)) {
    const s = e.shortest;
    if (!s) continue;
    if (e.id === 'END') { s.verified = true; continue; }
    const tryRun = (seenIds) => replayEnds(program, s.path, { endings: Object.fromEntries(seenIds.map(id => [id, { first: 0, count: 1 }])), vars: s.persist }, registry, s.rolls, e.id);
    s.verified = tryRun(s.seen);
    if (s.verified && s.seen.length > 1) {
      for (const id of s.seen) if (tryRun([id])) { s.seen = [id]; break; }
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
  if (!report.truncated) {
    for (const [pc, b] of Object.entries(report.branches)) {
      const ins = program.code[pc];
      if (!ins || !ins.cond || ins.cond.t === 'bool') continue;
      const cond = exprToString(ins.cond).replace(/^\((.*)\)$/, '$1');
      if (b.t > 0 && b.f === 0) constant.push({ loc: ins.loc, cond, always: true, count: b.t });
      if (b.f > 0 && b.t === 0) constant.push({ loc: ins.loc, cond, always: false, count: b.f });
    }
  }
  const declaredEndings = Object.values(program.decls.endings);
  return {
    states: report.states, truncated: report.truncated, frontier: report.frontier, maxStates, passes,
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

// Replay a route (choices, gameplay results, random rolls) with the given
// persistent data. With `endingId`, returns whether that ending is reached;
// without, returns the last ending reached (or null).
export function replayEnds(program, path, persistent, registry, rolls = [], endingId = null) {
  const vm = new VM(program, { registry, persistent: { ...newPersistent(), ...clone(persistent) }, maxHistory: 0, seed: 1 });
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
      if (!step || step.game || !h.options.some(o => o.index === step.choice - 1 && !o.disabled)) return endingId ? false : null;
      r = vm.choose(step.choice - 1);
      continue;
    }
    if (h.type === 'game') { const step = path[i++]; r = vm.submit(step ? step.result : null); continue; }
    if (h.type === 'input') { r = vm.submit(h.default || 'Player'); continue; }
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

export function formatPath(path) {
  if (!path.length) return '(no choices)';
  return path.map(p => p.game ? `[${p.game} → ${p.result}]` : `${p.choice} ${quote(p.text)}`).join(' → ');
}

export function choiceList(path) {
  return path.filter(p => !p.game).map(p => p.choice).join(',');
}

// The `shiori play` arguments that replay a route found by explore.
export function replayArgs(e) {
  const s = e.shortest;
  if (!s) return '';
  const parts = [];
  const choices = choiceList(s.path);
  if (choices) parts.push('--choices ' + choices);
  const games = s.path.filter(p => p.game).map(p => `${p.game}=${p.result}`);
  if (games.length) parts.push('--game ' + games.join(','));
  if (s.rolls && s.rolls.length) parts.push('--rolls ' + s.rolls.join(','));
  if (s.seen && s.seen.length) parts.push('--seen ' + s.seen.join(','));
  if (s.persist && Object.keys(s.persist).length) parts.push('--set ' + Object.entries(s.persist).map(([k, v]) => k + '=' + v).join(','));
  return parts.join(' ');
}
