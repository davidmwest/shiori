// Static analysis of a compiled Program: reachability, story graph,
// word counts, reading time, narration share, interaction density.

import { plainText } from './markup.js';
import { collectRefs } from './expr.js';
import { wordWeight } from './util.js';

export const LENGTH_CATEGORIES = [
  { id: 1, name: 'Very short', max: 2, doc: '< 2 hours' },
  { id: 2, name: 'Short', max: 10, doc: '2 - 10 hours' },
  { id: 3, name: 'Medium', max: 30, doc: '10 - 30 hours' },
  { id: 4, name: 'Long', max: 50, doc: '30 - 50 hours' },
  { id: 5, name: 'Very long', max: Infinity, doc: '> 50 hours' },
];

export function lengthCategory(hours) {
  return LENGTH_CATEGORIES.find(c => hours < c.max);
}

export function successors(program, pc) {
  const ins = program.code[pc];
  if (!ins) return [];
  switch (ins.op) {
    case 'jump': return ins.pc == null ? [] : [ins.pc];
    case 'goto': return [ins.pc];
    case 'branch': return [pc + 1, ins.else];
    case 'call': return ins.pc == null ? [pc + 1] : [ins.pc, pc + 1];
    case 'return': return [];
    case 'end': return [];
    case 'menu': return ins.options.map(o => o.pc === -1 ? ins.next : o.pc).filter(p => p !== 'END' && p != null);
    default: return [pc + 1];
  }
}

// The scene every instruction belongs to. Compiler-made instructions (the
// gotos that close option bodies and @if branches) carry no scene of their
// own, so this follows the code: each scene's code starts with its `scene` op.
export function sceneOfPc(program) {
  const out = new Array(program.code.length);
  let cur = null;
  program.code.forEach((ins, pc) => {
    if (ins.op === 'scene') cur = ins.id;
    out[pc] = ins.scene || cur;
  });
  return out;
}

// Which state can still matter at each instruction? For every pc, the set
// of things some later instruction may read: 'v:name' (variables),
// 'visit:scene' (visited()), 'once:id' ([once] choices), 'endings'.
// The route explorer merges states that agree on these.
export function liveness(program) {
  const code = program.code, N = code.length;
  const callReturns = [];
  code.forEach((ins, pc) => { if (ins.op === 'call') callReturns.push(pc + 1); });
  const exprReads = (ast, set) => {
    if (!ast) return;
    const r = collectRefs(ast);
    for (const v of r.vars) set.add('v:' + v.name);
    for (const c of r.calls) {
      if (c.name === 'visited' && c.args[0] && c.args[0].t === 'str') set.add('visit:' + c.args[0].v);
      if (c.name === 'ending_seen' || c.name === 'endings_seen') set.add('endings');
    }
  };
  const textReads = (tokens, set) => { for (const t of tokens || []) if (t.t === 'var') set.add('v:' + t.name); };
  const live = code.map((ins) => {
    const s = new Set();
    switch (ins.op) {
      case 'branch': exprReads(ins.cond, s); break;
      case 'set': exprReads(ins.value, s); if (ins.opr !== '=') s.add('v:' + ins.name); break;
      case 'assert': exprReads(ins.cond, s); break;
      case 'say': textReads(ins.text, s); break;
      case 'menu': ins.options.forEach(o => { exprReads(o.cond, s); exprReads(o.require, s); textReads(o.text, s); if (o.once) s.add('once:' + o.id); }); break;
      case 'cmd': if (ins.name === 'log') textReads(ins.args.text, s); break;
    }
    return s;
  });
  const succ = (pc) => code[pc].op === 'return' ? callReturns : successors(program, pc).filter(x => typeof x === 'number' && x >= 0 && x < N);
  const preds = Array.from({ length: N }, () => []);
  for (let pc = 0; pc < N; pc++) for (const t of succ(pc)) preds[t].push(pc);
  const work = [];
  const queued = new Uint8Array(N);
  for (let pc = 0; pc < N; pc++) { work.push(pc); queued[pc] = 1; }
  while (work.length) {
    const pc = work.pop();
    queued[pc] = 0;
    let changed = false;
    for (const t of succ(pc)) for (const x of live[t]) if (!live[pc].has(x)) { live[pc].add(x); changed = true; }
    if (changed) for (const p of preds[pc]) if (!queued[p]) { queued[p] = 1; work.push(p); }
  }
  return live.map(s => [...s].sort());
}

export function reachable(program) {
  const seen = new Uint8Array(program.code.length + 1);
  const start = program.labels[program.start];
  if (start == null) return seen;
  const stack = [start];
  while (stack.length) {
    const pc = stack.pop();
    if (pc == null || pc < 0 || pc >= program.code.length || seen[pc]) continue;
    seen[pc] = 1;
    for (const s of successors(program, pc)) stack.push(s);
  }
  return seen;
}

function wordsOf(ins) {
  return wordWeight(plainText(ins.text));
}

// Where a menu option leads: walks the option body (through @if branches
// and gotos, staying in the menu's scene) and returns the pcs where it
// leaves the scene, 'END' for `-> END`, and `join: true` when it reaches
// the code after the menu, which every option shares. Nested menus are not
// entered: their own options are walked separately. `visited` lists the
// option body's instructions.
function optionExits(program, sceneOf, menuPc, o) {
  const code = program.code, menu = code[menuPc], from = sceneOf[menuPc];
  const res = { exits: [], join: false, visited: [] };
  if (o.pc === 'END') { res.exits.push('END'); return res; }
  if (o.pc === -1 || o.pc == null) { res.join = true; return res; }
  // `* Text -> target` has no body: it goes straight to the target, even
  // when that target is the scene right after the menu.
  if (o.label) { res.exits.push(o.pc); return res; }
  const seen = new Set();
  const stack = [o.pc];
  while (stack.length && seen.size < 20000) {
    const p = stack.pop();
    if (p == null || seen.has(p)) continue;
    if (p === 'END') { res.exits.push('END'); continue; }
    seen.add(p);
    if (p === menu.next) { res.join = true; continue; }
    const x = code[p];
    if (!x) continue;
    if (sceneOf[p] !== from) { res.exits.push(p); continue; }
    res.visited.push(p);
    if (x.op === 'jump') { if (x.pc != null) res.exits.push(x.pc); continue; }
    if (x.op === 'end') { if (!x.implicit) res.exits.push('END'); continue; }
    if (x.op === 'return' || x.op === 'menu') continue;
    if (x.op === 'call') { stack.push(p + 1); continue; }
    for (const s of successors(program, p)) stack.push(s);
  }
  return res;
}

// Where control goes from `pc` until it leaves the scene: the set of scenes
// (and 'END') it can reach, plus 'menu:<pc>' for a menu on the way (the
// choices there decide what happens next).
function exitsFrom(program, sceneOf, pc) {
  const code = program.code, from = sceneOf[pc];
  const out = new Set();
  const seen = new Set();
  const stack = [pc];
  while (stack.length && seen.size < 20000) {
    const p = stack.pop();
    if (p == null || seen.has(p)) continue;
    if (p === 'END') { out.add('END'); continue; }
    seen.add(p);
    const x = code[p];
    if (!x) { out.add('END'); continue; }
    if (sceneOf[p] !== from) { out.add(sceneOf[p]); continue; }
    if (x.op === 'end') { out.add('END'); continue; }
    if (x.op === 'menu') { out.add('menu:' + p); continue; }
    if (x.op === 'jump') { if (x.pc != null) out.add(sceneOf[x.pc] === from ? 'loop:' + from : sceneOf[x.pc]); continue; }
    if (x.op === 'call') { stack.push(p + 1); continue; }
    for (const s of successors(program, p)) stack.push(s);
  }
  return out;
}

// Scene-level graph: edges are jumps, calls, choices and fall-through
// (including a menu that gathers, the goto that closes an option body, or
// an @if whose other side runs into the next scene).
export function storyGraph(program) {
  const code = program.code;
  const nodes = program.sceneOrder.map(id => ({ id, title: program.scenes[id].title, file: program.scenes[id].file, line: program.scenes[id].line, endings: [], words: 0 }));
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const sceneOf = sceneOfPc(program);
  const edges = [];
  code.forEach((ins, pc) => {
    const from = sceneOf[pc];
    if (!from || !byId[from]) return;
    const add = (to, kind, label) => {
      if (to === 'END') { edges.push({ from, to: 'END', kind, label }); return; }
      const target = typeof to === 'number' ? sceneOf[to] : null;
      if (target && target !== from && byId[target]) edges.push({ from, to: target, kind, label });
    };
    if (ins.op === 'say') byId[from].words += wordsOf(ins);
    if (ins.op === 'cmd' && ins.name === 'ending') byId[from].endings.push(ins.args.id);
    switch (ins.op) {
      case 'jump': if (ins.pc != null) add(ins.pc, 'jump'); break;
      case 'call': if (ins.pc != null) add(ins.pc, 'call'); break;
      case 'end': if (!ins.implicit) add('END', 'end'); break;
      case 'return': break;
      case 'menu':
        ins.options.forEach(o => {
          const label = plainText(o.text);
          for (const to of optionExits(program, sceneOf, pc, o).exits) add(to, 'choice', label);
        });
        // A gathering option continues after the menu, which may be the next scene.
        if (ins.options.some(o => o.pc === -1) && ins.next != null) add(ins.next, 'next');
        break;
      default:
        for (const s of successors(program, pc)) add(s, 'next');
    }
  });
  const seenEdge = new Set();
  const unique = edges.filter(e => { const k = e.from + '>' + e.to + '>' + (e.label || ''); if (seenEdge.has(k)) return false; seenEdge.add(k); return true; });
  return { nodes, edges: unique };
}

// Do choices lead to different routes? True when some reachable menu has
// options that go to different scenes, or when a variable set by a choice
// is tested by an @if whose two sides go to different scenes (the usual
// "choice sets a flag, the story branches on it later" pattern).
function hasBranchingChoices(program, reach, sceneOf) {
  const code = program.code;
  const written = new Set();
  for (let pc = 0; pc < code.length; pc++) {
    const ins = code[pc];
    if (ins.op !== 'menu' || !reach[pc]) continue;
    const dests = new Set();
    let scenes = 0;
    for (const o of ins.options) {
      const r = optionExits(program, sceneOf, pc, o);
      const to = [...new Set(r.exits.filter(x => x !== 'END').map(x => sceneOf[x]).filter(s => s && s !== sceneOf[pc]))].sort();
      scenes += to.length;
      dests.add(to.join(',') + (r.join ? '|join' : '') + (r.exits.includes('END') ? '|end' : ''));
      for (const p of r.visited) if (code[p].op === 'set') written.add(code[p].name);
    }
    if (scenes && dests.size > 1) return true;
  }
  if (!written.size) return false;
  for (let pc = 0; pc < code.length; pc++) {
    const ins = code[pc];
    if (ins.op !== 'branch' || !reach[pc] || !ins.cond) continue;
    if (!collectRefs(ins.cond).vars.some(v => written.has(v.name))) continue;
    const a = exitsFrom(program, sceneOf, pc + 1), b = exitsFrom(program, sceneOf, ins.else);
    const scenesOf = (s) => [...s].filter(x => x !== 'END' && !x.startsWith('menu:') && !x.startsWith('loop:')).sort().join(',');
    const sa = scenesOf(a), sb = scenesOf(b);
    if ((sa || sb) && sa !== sb) return true;
  }
  return false;
}

// Longest runs of dialogue without narration (W614) and of ADV lines with
// no visual change (W616), measured along the story's control flow: the
// bodies of different choices, the two sides of an @if, and scenes that
// merely sit next to each other in a file are never added together, while a
// run that really continues through a jump or a fall-through is.
// Each instruction gets the longest run that can reach it (the maximum over
// its predecessors). Inside a loop, a run is capped at the lines entering
// the loop plus every line of the loop once.
const VISUAL = new Set(['scene', 'bg', 'show', 'hide', 'move', 'cg', 'camera', 'weather', 'filter', 'tint', 'shake', 'flash', 'video', 'mode']);
function readingRuns(program, reach, sceneOf) {
  const code = program.code, N = code.length;
  // A @call runs the called scene, and its @return comes back after a call.
  const callReturns = [];
  code.forEach((ins, pc) => { if (ins.op === 'call' && ins.pc != null) callReturns.push(pc + 1); });
  const succ = code.map((ins, pc) => (ins.op === 'return' ? callReturns : ins.op === 'call' && ins.pc != null ? [ins.pc] : successors(program, pc))
    .filter(s => typeof s === 'number' && s >= 0 && s < N));
  const inD =new Int32Array(N).fill(-1), inDs = new Int32Array(N), inS = new Int32Array(N).fill(-1), inSs = new Int32Array(N);
  const inM = new Uint8Array(N); // modes that can be active: 1 = adv, 2 = nvl
  const seed = (pc) => { if (pc == null || pc < 0 || pc >= N) return; if (inD[pc] < 0) { inD[pc] = 0; inDs[pc] = pc; } if (inS[pc] < 0) { inS[pc] = 0; inSs[pc] = pc; } inM[pc] |= 1; };
  seed(program.labels[program.start]);
  code.forEach((ins, pc) => { if (ins.op === 'scene' && !reach[pc]) seed(pc); });

  const isNarration = (ins) => !ins.who && !ins.name;
  const resetsStill = (ins, m) => (ins.op === 'say' && ((ins.attrs && Object.keys(ins.attrs).length) || m === 2)) || ins.op === 'menu' || (ins.op === 'cmd' && VISUAL.has(ins.name));
  // Transfer: the run lengths after `pc` given the ones before it.
  const transfer = (pc) => {
    const ins = code[pc];
    let d = inD[pc], ds = inDs[pc], s = inS[pc], ss = inSs[pc], m = inM[pc];
    if (ins.op === 'cmd' && ins.name === 'mode') m = ins.args.mode === 'nvl' ? 2 : 1;
    if (ins.op === 'say') {
      if (isNarration(ins)) d = 0; else { if (d === 0) ds = pc; d++; }
    }
    if (resetsStill(ins, m)) s = 0;
    else if (ins.op === 'say') { if (s === 0) ss = pc; s++; }
    return { d, ds, s, ss, m };
  };

  // Strongly connected components (iterative Tarjan), in topological order.
  const index = new Int32Array(N).fill(-1), low = new Int32Array(N), onStack = new Uint8Array(N), comp = new Int32Array(N).fill(-1);
  const sccs = [];
  const stack = [];
  let counter = 0;
  for (let root = 0; root < N; root++) {
    if (index[root] >= 0) continue;
    const work = [[root, 0]];
    index[root] = low[root] = counter++; stack.push(root); onStack[root] = 1;
    while (work.length) {
      const top = work[work.length - 1];
      const v = top[0];
      if (top[1] < succ[v].length) {
        const w = succ[v][top[1]++];
        if (index[w] < 0) { index[w] = low[w] = counter++; stack.push(w); onStack[w] = 1; work.push([w, 0]); }
        else if (onStack[w]) low[v] = Math.min(low[v], index[w]);
        continue;
      }
      work.pop();
      if (work.length) { const u = work[work.length - 1][0]; low[u] = Math.min(low[u], low[v]); }
      if (low[v] === index[v]) {
        const c = [];
        let w;
        do { w = stack.pop(); onStack[w] = 0; comp[w] = sccs.length; c.push(w); } while (w !== v);
        sccs.push(c);
      }
    }
  }
  sccs.reverse();
  const nComp = comp.map(c => sccs.length - 1 - c);

  const join = (t, out, cap) => {
    let changed = false;
    const d = Math.min(out.d, cap.d), s = Math.min(out.s, cap.s);
    if (d > inD[t]) { inD[t] = d; inDs[t] = out.ds; changed = true; }
    if (s > inS[t]) { inS[t] = s; inSs[t] = out.ss; changed = true; }
    if ((inM[t] | out.m) !== inM[t]) { inM[t] |= out.m; changed = true; }
    return changed;
  };
  const NO_CAP = { d: Infinity, s: Infinity };
  sccs.forEach((c, ci) => {
    const members = c.filter(pc => inD[pc] >= 0);
    if (!members.length) return;
    const loop = c.length > 1 || succ[c[0]].includes(c[0]);
    let cap = NO_CAP;
    if (loop) {
      // Every line of the loop at most once: dialogue lines for W614, and
      // lines that do not themselves change the picture for W616.
      const talk = c.filter(pc => code[pc].op === 'say' && !isNarration(code[pc])).length;
      const plain = c.filter(pc => code[pc].op === 'say' && !(code[pc].attrs && Object.keys(code[pc].attrs).length)).length;
      cap = { d: members.reduce((m, pc) => Math.max(m, inD[pc]), 0) + talk, s: members.reduce((m, pc) => Math.max(m, inS[pc]), 0) + plain };
    }
    const work = members.slice();
    const queued = new Set(work);
    let guard = 0;
    while (work.length && guard++ < 1e6) {
      const pc = work.pop();
      queued.delete(pc);
      const out = transfer(pc);
      for (const t of succ[pc]) {
        const inside = nComp[t] === ci;
        if (join(t, out, inside ? cap : NO_CAP) && inside && !queued.has(t)) { queued.add(t); work.push(t); }
      }
    }
  });

  // Read the runs off the converged values.
  const dialogue = new Map(), still = new Map();
  let longest = { length: 0, pc: null };
  const note = (map, len, startPc) => { if (len >= 30 && (!map.has(startPc) || map.get(startPc) < len)) map.set(startPc, len); };
  for (let pc = 0; pc < N; pc++) {
    if (inD[pc] < 0) continue;
    const ins = code[pc];
    const out = transfer(pc);
    if (ins.op === 'say' && isNarration(ins)) note(dialogue, inD[pc], inDs[pc]);
    if (ins.op === 'say' && !isNarration(ins) && out.d > longest.length) longest = { length: out.d, pc: out.ds };
    if (resetsStill(ins, out.m)) note(still, inS[pc], inSs[pc]);
    if (!succ[pc].length) { note(dialogue, out.d, out.ds); note(still, out.s, out.ss); }
  }
  const list = (map) => [...map.entries()].sort((a, b) => a[0] - b[0]).map(([pc, length]) => ({ length, scene: sceneOf[pc], loc: code[pc].loc }));
  return {
    dialogueRuns: list(dialogue),
    staticRuns: list(still),
    maxDialogueRun: longest.pc == null ? { length: 0, scene: null, loc: null } : { length: longest.length, scene: sceneOf[longest.pc], loc: code[longest.pc].loc },
  };
}

export function analyze(program) {
  const reach = reachable(program);
  const sceneOf = sceneOfPc(program);
  const header = program.header;
  const wpm = header.reading_speed || 200;
  const perChar = {};
  let words = 0, narrationWords = 0, dialogueWords = 0, lines = 0, narrationLines = 0, reachableWords = 0;
  let menus = 0, options = 0, inputs = 0, games = [], gameMinutes = 0, videos = [], voiced = 0, dialogueLines = 0;
  let nvlLines = 0, advLines = 0, mode = 'adv';
  const longAdvLines = [];
  const gaps = []; let sinceInteraction = 0;
  let pendingVoice = false;
  const usesPersistentConditions = { ending_seen: false, persistent: false };
  const unreachableScenes = [];
  const weather = new Set(), filters = new Set();
  let threeD = false, cgs = new Set();
  const conditionRefs = [];

  program.code.forEach((ins, pc) => {
    const isReach = !!reach[pc];
    const scan = (ast) => { if (!ast) return; const r = collectRefs(ast); conditionRefs.push(r); };
    if (ins.op === 'branch') scan(ins.cond);
    if (ins.op === 'menu') ins.options.forEach(o => { scan(o.cond); scan(o.require); });
    if (ins.op === 'set') scan(ins.value);
    if (ins.op === 'scene' && !isReach) unreachableScenes.push(ins.id);
    if (ins.op === 'cmd') {
      if (ins.name === 'mode') mode = ins.args.mode;
      if (ins.name === 'voice') pendingVoice = true;
      if (ins.name === 'input') { inputs++; gaps.push(sinceInteraction); sinceInteraction = 0; }
      if (ins.name === 'game') {
        const a = program.decls.assets[ins.args.id];
        const m = a && a.opts.minutes != null ? a.opts.minutes : 1;
        games.push({ id: ins.args.id, minutes: m, reachable: isReach, loc: ins.loc });
        if (isReach) gameMinutes += m;
        gaps.push(sinceInteraction); sinceInteraction = 0;
      }
      if (ins.name === 'video') videos.push({ id: ins.args.id, kind: ins.args.kind });
      if (ins.name === 'weather' && ins.args.type !== 'none') weather.add(ins.args.type);
      if (ins.name === 'filter' && ins.args.type !== 'none') filters.add(ins.args.type);
      if ((ins.name === 'scene' || ins.name === 'bg') && ins.args.kind === 'world') threeD = true;
      if (ins.name === 'cg' && ins.args.image) cgs.add(ins.args.image);
    }
    if (ins.op === 'menu') { menus++; options += ins.options.length; gaps.push(sinceInteraction); sinceInteraction = 0; }
    if (ins.op !== 'say') return;
    if (mode !== 'nvl') { const len = plainText(ins.text).length; if (len > 280 && len <= 600) longAdvLines.push({ length: len, loc: ins.loc, scene: ins.scene }); }
    const w = wordsOf(ins);
    words += w; lines++;
    if (isReach) reachableWords += w;
    sinceInteraction++;
    if (mode === 'nvl') nvlLines++; else advLines++;
    const who = ins.who || (ins.name ? '"' + ins.name + '"' : null);
    if (!who) {
      narrationWords += w; narrationLines++;
    } else {
      dialogueWords += w; dialogueLines++;
      const k = ins.who || ins.name;
      perChar[k] = perChar[k] || { lines: 0, words: 0, voiced: 0, name: ins.who ? program.decls.characters[ins.who].name : ins.name };
      perChar[k].lines++; perChar[k].words += w;
      if (pendingVoice) { voiced++; perChar[k].voiced++; }
    }
    pendingVoice = false;
  });
  if (sinceInteraction) gaps.push(sinceInteraction);
  const { dialogueRuns, staticRuns, maxDialogueRun } = readingRuns(program, reach, sceneOf);
  for (const r of conditionRefs) {
    for (const c of r.calls) if (c.name === 'ending_seen' || c.name === 'endings_seen') usesPersistentConditions.ending_seen = true;
    for (const v of r.vars) { const d = program.decls.vars[v.name]; if (d && d.persistent) usesPersistentConditions.persistent = true; }
  }
  const sorted = gaps.slice().sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const readingMinutes = reachableWords / wpm;
  const endings = Object.values(program.decls.endings);
  const graph = storyGraph(program);
  return {
    words: Math.round(words), reachableWords: Math.round(reachableWords), lines, narrationLines, dialogueLines,
    narrationShare: words ? narrationWords / words : 0,
    narrationLineShare: lines ? narrationLines / lines : 0,
    perCharacter: Object.fromEntries(Object.entries(perChar).sort((a, b) => b[1].words - a[1].words).map(([k, v]) => [k, { ...v, words: Math.round(v.words) }])),
    scenes: program.sceneOrder.length, unreachableScenes,
    menus, options, inputs, games, gameMinutes, videos,
    endings: endings.map(e => ({ id: e.id, title: e.title, kind: e.kind, scene: e.scene })),
    readingMinutes, readingHours: readingMinutes / 60,
    lengthCategory: lengthCategory(readingMinutes / 60),
    readingShare: readingMinutes + gameMinutes ? readingMinutes / (readingMinutes + gameMinutes) : 1,
    medianLinesBetweenInteractions: median,
    maxDialogueRun, dialogueRuns, staticRuns, longAdvLines,
    modes: { adv: advLines, nvl: nvlLines },
    voicedDialogueShare: dialogueLines ? voiced / dialogueLines : 0,
    weather: [...weather], filters: [...filters], threeD, cgs: [...cgs],
    usesPersistentConditions,
    branching: hasBranchingChoices(program, reach, sceneOf),
    graph,
  };
}

export function toMermaid(graph, program) {
  const esc = (s) => String(s || '').replace(/"/g, "'").replace(/[\n\r]/g, ' ').slice(0, 48);
  const id = (s) => 's_' + s.replace(/[^A-Za-z0-9_]/g, '_');
  const out = ['flowchart TD'];
  const start = program.start;
  for (const n of graph.nodes) {
    const label = esc(n.title ? `${n.id}: ${n.title}` : n.id) + (n.endings.length ? ' ★ ' + n.endings.map(e => esc(program.decls.endings[e] ? program.decls.endings[e].title : e)).join(', ') : '');
    out.push(`  ${id(n.id)}${n.endings.length ? '(["' + label + '"])' : '["' + label + '"]'}`);
  }
  out.push('  END_((END))');
  for (const e of graph.edges) {
    const to = e.to === 'END' ? 'END_' : id(e.to);
    const arrow = e.kind === 'call' ? '-.->' : e.kind === 'next' ? '-->' : '-->';
    out.push(`  ${id(e.from)} ${arrow}${e.label ? '|"' + esc(e.label) + '"|' : e.kind === 'call' ? '|call|' : ''} ${to}`);
  }
  if (start) out.push(`  style ${id(start)} stroke-width:3px`);
  return out.join('\n');
}

export function toDot(graph, program) {
  const q = (s) => '"' + String(s).replace(/"/g, '\\"') + '"';
  const out = ['digraph story {', '  rankdir=TB; node [shape=box, fontname="Helvetica"];'];
  for (const n of graph.nodes) out.push(`  ${q(n.id)} [label=${q(n.title ? n.id + '\\n' + n.title : n.id)}${n.endings.length ? ', shape=doubleoctagon' : ''}${n.id === program.start ? ', penwidth=3' : ''}];`);
  out.push('  END [shape=doublecircle];');
  for (const e of graph.edges) out.push(`  ${q(e.from)} -> ${q(e.to)}${e.label ? ' [label=' + q(e.label.slice(0, 40)) + ']' : e.kind === 'call' ? ' [style=dashed]' : ''};`);
  out.push('}');
  return out.join('\n');
}
