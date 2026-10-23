// Static analysis of a compiled Program: reachability, story graph,
// word counts, reading time, narration share, interaction density.

import { plainText } from './markup.js';
import { collectRefs } from './expr.js';
import { countWords } from './util.js';

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
  const t = plainText(ins.text);
  const c = countWords(t);
  return c.words + c.cjk / 2;
}

// Scene-level graph: edges are jumps, calls, choices and fall-through.
export function storyGraph(program) {
  const nodes = program.sceneOrder.map(id => ({ id, title: program.scenes[id].title, file: program.scenes[id].file, line: program.scenes[id].line, endings: [], words: 0 }));
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const edges = [];
  const sceneAt = (pc) => { const ins = program.code[pc]; return ins ? ins.scene : null; };
  program.code.forEach((ins, pc) => {
    const from = ins.scene;
    if (!from || !byId[from]) return;
    if (ins.op === 'say') byId[from].words += wordsOf(ins);
    if (ins.op === 'cmd' && ins.name === 'ending') byId[from].endings.push(ins.args.id);
    const add = (to, kind, label) => {
      if (to === 'END') { edges.push({ from, to: 'END', kind, label }); return; }
      const target = sceneAt(to);
      if (target && target !== from) edges.push({ from, to: target, kind, label });
    };
    if (ins.op === 'jump') add(ins.pc, 'jump');
    if (ins.op === 'call') add(ins.pc, 'call');
    if (ins.op === 'end' && !ins.implicit) edges.push({ from, to: 'END', kind: 'end' });
    if (ins.op === 'menu') ins.options.forEach(o => {
      const label = plainText(o.text);
      if (o.pc === 'END') edges.push({ from, to: 'END', kind: 'choice', label });
      else if (o.pc !== -1) {
        // follow the option body to its first jump
        let p = o.pc, guard = 0;
        while (p != null && p < program.code.length && guard++ < 5000) {
          const x = program.code[p];
          if (x.scene !== from) { add(p, 'choice', label); break; }
          if (x.op === 'jump') { add(x.pc, 'choice', label); break; }
          if (x.op === 'end') { edges.push({ from, to: 'END', kind: 'choice', label }); break; }
          if (x.op === 'goto' || x.op === 'menu' || x.op === 'branch' || x.op === 'return') break;
          p++;
        }
      }
    });
    // fall-through into the next scene
    const next = program.code[pc + 1];
    if (next && next.op === 'scene' && next.scene !== from && !['jump', 'goto', 'end', 'return'].includes(ins.op)) add(pc + 1, 'next');
  });
  const seenEdge = new Set();
  const unique = edges.filter(e => { const k = e.from + '>' + e.to + '>' + (e.label || ''); if (seenEdge.has(k)) return false; seenEdge.add(k); return true; });
  return { nodes, edges: unique };
}

export function analyze(program) {
  const reach = reachable(program);
  const header = program.header;
  const wpm = header.reading_speed || 200;
  const perChar = {};
  let words = 0, narrationWords = 0, dialogueWords = 0, lines = 0, narrationLines = 0, reachableWords = 0;
  let menus = 0, options = 0, inputs = 0, games = [], gameMinutes = 0, videos = [], voiced = 0, dialogueLines = 0;
  let nvlLines = 0, advLines = 0, mode = 'adv';
  let maxDialogueRun = { length: 0, scene: null, line: null }, run = 0, runStart = null;
  const dialogueRuns = [];
  const longAdvLines = [];
  // Static stretches: many lines in a row with no visual change at all.
  const staticRuns = []; let still = 0, stillStart = null, stillScene = null;
  const VISUAL = new Set(['scene', 'bg', 'show', 'hide', 'move', 'cg', 'camera', 'weather', 'filter', 'tint', 'shake', 'flash', 'video', 'mode']);
  const endStill = () => { if (still >= 30) staticRuns.push({ length: still, scene: stillScene, loc: stillStart }); still = 0; stillStart = null; };
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
    if (ins.op === 'menu') { menus++; options += ins.options.length; gaps.push(sinceInteraction); sinceInteraction = 0; endStill(); }
    if (ins.op === 'scene' || (ins.op === 'cmd' && VISUAL.has(ins.name))) endStill();
    if (ins.op !== 'say') return;
    if (mode !== 'nvl') { const len = plainText(ins.text).length; if (len > 280 && len <= 600) longAdvLines.push({ length: len, loc: ins.loc, scene: ins.scene }); }
    if ((ins.attrs && Object.keys(ins.attrs).length) || mode === 'nvl') endStill();
    else { if (!still) { stillStart = ins.loc; stillScene = ins.scene; } still++; }
    const w = wordsOf(ins);
    words += w; lines++;
    if (isReach) reachableWords += w;
    sinceInteraction++;
    if (mode === 'nvl') nvlLines++; else advLines++;
    const who = ins.who || (ins.name ? '"' + ins.name + '"' : null);
    if (!who) {
      narrationWords += w; narrationLines++;
      if (run >= 30) dialogueRuns.push({ length: run, scene: ins.scene, loc: runStart });
      run = 0;
    } else {
      dialogueWords += w; dialogueLines++;
      if (pendingVoice) voiced++;
      const k = ins.who || ins.name;
      perChar[k] = perChar[k] || { lines: 0, words: 0, name: ins.who ? program.decls.characters[ins.who].name : ins.name };
      perChar[k].lines++; perChar[k].words += w;
      if (run === 0) runStart = ins.loc;
      run++;
      if (run > maxDialogueRun.length) maxDialogueRun = { length: run, scene: ins.scene, loc: runStart };
    }
    pendingVoice = false;
  });
  if (sinceInteraction) gaps.push(sinceInteraction);
  endStill();
  if (run >= 30) dialogueRuns.push({ length: run, scene: maxDialogueRun.scene, loc: runStart });
  for (const r of conditionRefs) {
    for (const c of r.calls) if (c.name === 'ending_seen' || c.name === 'endings_seen') usesPersistentConditions.ending_seen = true;
    for (const v of r.vars) { const d = program.decls.vars[v.name]; if (d && d.persistent) usesPersistentConditions.persistent = true; }
  }
  const sorted = gaps.slice().sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const readingMinutes = reachableWords / wpm;
  const endings = Object.values(program.decls.endings);
  const graph = storyGraph(program);
  const branchingScenes = new Set(graph.edges.filter(e => e.kind === 'choice' && e.to !== 'END').map(e => e.from));
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
    branching: branchingScenes.size > 0,
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
