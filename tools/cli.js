// shiori — command-line tools for Shiori visual novels.
// Run through bin/shiori (uses Node.js if installed, else macOS JavaScriptCore).
// Tests set globalThis.__shioriEmbedded before importing and call runCli(host).

import { createHost } from './host.js';
import { prepareProject } from '../engine/core/compiler.js';
import { VM } from '../engine/core/vm.js';
import { defaultRegistry } from '../engine/core/modules/index.js';
import { checkValue } from '../engine/core/registry.js';
import { formatDiagnostic, summary, CODES, CODE_HELP } from '../engine/core/diagnostics.js';
import { analyze, toMermaid, toDot, LENGTH_CATEGORIES } from '../engine/core/analyze.js';
import { explore, formatPath, choiceList, replayArgs } from '../engine/core/explore.js';
import { exprToString } from '../engine/core/expr.js';
import { vndbReport, formatVndb } from '../engine/core/vndb.js';
import { commandReference, commandDoc, tablesReference, codesReference } from '../engine/core/docs.js';
import { checkAssets } from '../engine/core/assets.js';
import { didYouMean, countWords } from '../engine/core/util.js';
import { plainText } from '../engine/core/markup.js';

const HELP = `shiori — tools for Shiori visual novels

Usage: shiori <command> [game-folder] [options]
       (game-folder defaults to the current folder; it must contain game.story)

Commands
  check      Compile the game and report every problem (errors, warnings). --assets lists every missing file.
  play       Play headlessly and print the transcript.
               --choices 1,2,1      pick these choices in order. Numbers are each option's position in
                                    its menu as written in the script (hidden options still count).
               --from <scene>       start at a scene
               --set name=value,…   set variables first (persistent ones too)
               --seen a,b           act as if these endings were already reached (unlocks)
               --game id=result,…   results for @game, in order (default: the first declared result)
               --rolls 3,true,…     results for random()/chance(), in order (default: --seed)
               --seed <n>           random seed          --state  print the stage after each line
               --quiet              text only            --max <n> stop after n lines
             Repeating a list flag adds to it: --seen a --seen b is --seen a,b.
  explore    Try every route: every combination of choices, @game results and random() outcomes.
             Lists every ending with the shortest route to it and a checked replay command,
             runtime errors, failed @assert checks, dead ends, conditions that never change, and
             content no route reaches.
               --max-states <n>     exploration budget (default 250000)
               --seen a,b / --set   start as if these endings / persistent values already existed
  graph      Print the scene graph (--format mermaid | dot | json).
  stats      Word counts, reading time, VNDB length category, lines per character (--by-scene for each scene).
  assets     Every declared file: does it exist, where is it used (with filter/weather), which expressions are used.
             Add desc="..." to a declaration to keep the brief for the artist next to it.
  vndb       An advisory read of the game against VNDB's inclusion guidelines, plus a draft VNDB
             entry (release fields, length, tags, characters). VNDB's editors decide; this only
             points out what they would look at.
  docs       Reference: shiori docs <command> (e.g. docs show), docs <topic> (choices, conditions,
             text, header, functions, positions, transitions, weather, filters, codes), or
             docs <cli-command> (e.g. docs play). No argument prints everything.
  explain    Explain a diagnostic code and how to fix it, e.g. shiori explain E114
  new        Create a new game folder from the template: shiori new games/my-game
  selftest   Run the engine's own test suite.
  serve      Serve the engine folder and print the browser URL: shiori serve games/my-game
  build      Make a folder ready to upload (index.html + engine + game): shiori build games/my-game dist/my-game

Options for every command: --json (machine-readable output)
`;

let host = null;
let jsonMode = false;
const out = (s = '') => host.print(s);

// ------------------------------------------------------------------ options

// The options each command accepts. Boolean flags stand alone; value flags take
// the next argument (or --flag=value). Every command also takes --json and --help.
const COMMON = ['json', 'help'];
const OPTIONS = {
  check: { bool: ['assets', 'strict'] },
  play: { bool: ['state', 'quiet'], value: ['choices', 'from', 'set', 'seen', 'game', 'rolls', 'seed', 'max', 'game-result'] },
  explore: { value: ['max-states', 'seen', 'set'] },
  graph: { value: ['format'] },
  stats: { bool: ['by-scene'] },
  assets: {},
  vndb: { bool: ['no-explore'], value: ['max-states'] },
  docs: { value: ['game'] },
  explain: {},
  help: {},
};
// Names people reach for that "did you mean" can't guess (scene= is the browser's URL parameter).
const ALIASES = { scene: 'from', start: 'from', choice: 'choices', ending: 'seen', endings: 'seen', var: 'set', vars: 'set', variable: 'set', result: 'game', results: 'game', roll: 'rolls', 'max-lines': 'max', steps: 'max-states' };
const VALUE_HELP = {
  choices: '--choices 1,2,1', from: '--from <scene>', set: '--set name=value', seen: '--seen <ending>,…', game: '--game <id>=<result>',
  rolls: '--rolls 3,true,…', seed: '--seed <n>', max: '--max <n>', 'max-states': '--max-states <n>', format: '--format mermaid|dot|json',
  'game-result': '--game-result <result>',
};
const valueHelp = (cmd, k) => cmd === 'docs' && k === 'game' ? '--game <folder>' : VALUE_HELP[k] || `--${k} <value>`;
const wholeNumber = (v) => /^\d+$/.test(v) && Number(v) > 0 ? null : 'a whole number above 0';
const VALUE_CHECKS = {
  max: wholeNumber,
  'max-states': wholeNumber,
  seed: (v) => v.trim() !== '' && Number.isFinite(Number(v)) ? null : 'a number',
  format: (v) => ['mermaid', 'dot', 'json'].includes(v) ? null : 'mermaid, dot or json',
};
const LIST_FLAGS = new Set(['seen', 'set', 'choices', 'game', 'rolls']);
// What the one positional argument after the command is.
const POSITIONAL = { docs: 'name', explain: 'code', help: null };

function usageError(message, hint) { return { error: { message, hint } }; }

export function parseArgs(args, cmdHint) {
  const o = { _: [] };
  // The command decides which options exist: it is the first word that is not an option.
  const cmd = cmdHint !== undefined ? cmdHint : args.find(a => !a.startsWith('-'));
  const spec = OPTIONS[cmd];
  const bool = new Set(COMMON.concat(spec && spec.bool || []));
  const value = new Set(spec && spec.value || []);
  const known = [...bool, ...value];
  let rest = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (rest || !a.startsWith('-') || a === '-') { o._.push(a); continue; }
    if (a === '--') { rest = true; continue; }
    if (a === '-h') { o.help = true; continue; }
    if (!a.startsWith('--')) {
      if (spec) return usageError(`Unknown option \`${a}\` for \`shiori ${cmd}\`.`, `Options start with two dashes. Options for ${cmd}: ${known.map(k => '--' + k).join(' ')}.`);
      o._.push(a); continue;
    }
    const eq = a.indexOf('=');
    const k = eq > 0 ? a.slice(2, eq) : a.slice(2);
    let v;
    if (!spec) { v = eq > 0 ? a.slice(eq + 1) : true; }         // unknown command: main reports it
    else if (bool.has(k)) {
      if (eq > 0) return usageError(`\`--${k}\` takes no value.`, `Write just \`--${k}\`.`);
      v = true;
    } else if (value.has(k)) {
      if (eq > 0) v = a.slice(eq + 1);
      else if (i + 1 < args.length && !args[i + 1].startsWith('--')) v = args[++i];
      else return usageError(`\`--${k}\` needs a value.`, `Write \`${valueHelp(cmd, k)}\`.`);
      if (v === '') return usageError(`\`--${k}\` needs a value.`, `Write \`${valueHelp(cmd, k)}\`.`);
      const bad = VALUE_CHECKS[k] && VALUE_CHECKS[k](v);
      if (bad) return usageError(`\`--${k} ${v}\` is not valid: ${k === 'format' ? 'use' : 'it takes'} ${bad}.`, `Write \`${valueHelp(cmd, k)}\`.`);
    } else {
      const m = ALIASES[k] && known.includes(ALIASES[k]) ? ALIASES[k] : didYouMean(k, known);
      const elsewhere = Object.keys(OPTIONS).filter(c => c !== cmd && [...(OPTIONS[c].bool || []), ...(OPTIONS[c].value || [])].includes(k));
      const hint = m ? `Did you mean \`--${m}\`?` : elsewhere.length ? `\`--${k}\` is an option of \`shiori ${elsewhere.join('`, `shiori ')}\`.` : `Options for ${cmd}: ${known.map(x => '--' + x).join(' ')}.`;
      return usageError(`Unknown option \`--${k}\` for \`shiori ${cmd}\`.`, hint);
    }
    // List flags add up when repeated.
    if (LIST_FLAGS.has(k) && typeof o[k] === 'string' && typeof v === 'string') o[k] += ',' + v;
    else o[k] = v;
  }
  if (spec && cmd !== 'help') {
    const extra = o._.slice(2);
    if (extra.length) {
      const what = POSITIONAL[cmd] || 'game folder';
      const x = extra[0];
      const hint = cmd === 'play' && /^\d+(,\d+)*$/.test(x) ? `Did you mean \`--choices ${x}\`?` : `\`shiori ${cmd}\` takes one ${what}; options start with --.`;
      return usageError(`Unexpected argument \`${x}\`.`, hint);
    }
  }
  return { o };
}

// Quote a word for pasting into a shell, only when it needs it.
export function shq(s) {
  s = String(s);
  return /^[A-Za-z0-9_.\/@%+=:,-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'";
}

// "TypeError: message" and the stack. JavaScriptCore's stack has only the frames.
export function describeError(e) {
  if (!e || typeof e !== 'object') return String(e);
  const head = e.message !== undefined ? `${e.name || 'Error'}: ${e.message}` : String(e);
  const st = e.stack ? String(e.stack) : '';
  return !st ? head : st.startsWith(head) ? st : head + '\n' + st;
}

// One error, as text or (with --json) as {ok: false, error}. Ends the command.
function fail(message, { hint, code, exit = 1, extra } = {}) {
  if (jsonMode) out(JSON.stringify({ ok: false, error: { ...(code ? { code } : {}), message, ...(hint ? { hint } : {}) }, ...(extra || {}) }, null, 2));
  else { out(message); if (hint) out(`  hint: ${hint}`); }
  host.exit(exit);
}

// --seen / --set as a starting persistent store (and plain variables for play).
function startData(o, program, { forExplore = false } = {}) {
  const persistent = { endings: {}, vars: {} };
  const vars = {};
  const problems = [];
  if (o.seen) for (const raw of String(o.seen).split(',')) {
    const id = raw.trim();
    if (!id) continue;
    if (!program.decls.endings[id]) { const m = didYouMean(id, Object.keys(program.decls.endings)); problems.push(`Unknown ending \`${id}\` in --seen.${m ? ` Did you mean \`${m}\`?` : ''}`); continue; }
    persistent.endings[id] = { title: program.decls.endings[id].title, kind: program.decls.endings[id].kind, first: 0, count: 1 };
  }
  if (o.set) for (const kv of String(o.set).split(',')) {
    if (!kv.trim()) continue;
    const eq = kv.indexOf('=');
    const k = (eq < 0 ? kv : kv.slice(0, eq)).trim();
    const d = program.decls.vars[k];
    if (!d) { const m = didYouMean(k, Object.keys(program.decls.vars)); problems.push(`Unknown variable \`${k}\` in --set.${m ? ` Did you mean \`${m}\`?` : ''}`); continue; }
    const example = d.type === 'number' ? '3' : d.type === 'bool' ? 'true' : 'text';
    if (eq < 0) { problems.push(`\`--set ${k}\` needs a value: --set ${k}=${example}`); continue; }
    const raw = kv.slice(eq + 1).trim();
    // The same conversion as a script argument: numbers must be numbers, true/false (or yes/no, on/off, 1/0).
    const c = d.type === 'number' || d.type === 'bool' ? checkValue(d.type, raw) : { value: raw };
    if (c.error) { problems.push(`\`--set ${k}=${raw}\`: \`${k}\` is a ${d.type === 'bool' ? 'true/false variable, so the value must be true or false' : 'number variable, so the value must be a number'}.`); continue; }
    if (forExplore && !d.persistent) { problems.push(`\`--set ${k}\`: \`${k}\` is not @persistent. explore starts every route at the beginning, so its --set only takes @persistent variables (use \`shiori play --set\` for others).`); continue; }
    if (d.persistent) persistent.vars[k] = c.value; else vars[k] = c.value;
  }
  return { persistent, vars, problems };
}

// ------------------------------------------------------------------ loading

// The folder must exist and hold game.story. Returns a diagnostic, or null.
function folderProblem(base, join) {
  if (host.exists(join('game.story'))) return null;
  const isDir = base === '.' ? true : host.isDir(base);
  if (isDir === false) {
    const slash = base.lastIndexOf('/');
    const parent = slash > 0 ? base.slice(0, slash) : slash === 0 ? '/' : '.';
    const m = didYouMean(base.slice(slash + 1), (host.subdirs && host.subdirs(parent)) || []);
    const hint = m ? `Did you mean \`${parent === '.' ? m : parent.replace(/\/$/, '') + '/' + m}\`?`
      : /\.story$/.test(base) ? 'Pass the folder that holds game.story, not the file: `shiori check games/my-game`.'
      : 'Pass the folder that holds game.story, e.g. `shiori check examples/lantern-keeper`.';
    return { severity: 'error', code: 'E113', message: `No folder \`${base}\`.`, hint };
  }
  return { severity: 'error', code: 'E113', message: base === '.' ? 'The current folder has no game.story.' : `\`${base}\` has no game.story.`,
    hint: 'Every game starts from a game.story file in its folder. Pass the folder that holds it (e.g. `shiori check examples/lantern-keeper`), or start a game with `shiori new games/my-game`.' };
}

async function load(dir, opts = {}) {
  const base = String(dir).replace(/(.)\/+$/, '$1') || '.';
  const join = (p) => base === '.' ? p : base + '/' + p;
  const problem = folderProblem(base, join);
  if (problem) return { base, program: null, diagnostics: [problem], registry: defaultRegistry(), noGame: true };
  const read = new Set();
  const readText = (p) => { const t = host.read(join(p)); if (t != null) read.add(p); return t; };
  const importModule = (p) => import(host.moduleUrl(join(p)));
  let listing = host.list(base);
  let res = await prepareProject({ readText, importModule, listing });
  // A listed file that was included under another name (./story/a.story, or
  // through a symlinked folder) is not "in the folder but not included" (W605).
  if (listing && host.fileId) {
    const ids = new Set([...read].map(p => host.fileId(join(p))).filter(Boolean));
    const kept = listing.filter(p => read.has(p) || !ids.has(host.fileId(join(p))));
    if (kept.length < listing.length) { listing = kept; res = await prepareProject({ readText, importModule, listing }); }
  }
  if (!opts.skipAssets && res.program) {
    const missing = new Set();
    res.diagnostics.push(...checkAssets(res.program, (p) => { const ok = host.exists(join(p)); if (!ok) missing.add(p); return ok; }));
    res.missingFiles = [...missing];
    res.diagnostics.push(...await checkLmn(res.program, (p) => host.read(join(p))));
  }
  res.base = base;
  return res;
}

// The first line of an LMN text that is not blank, a // comment or a ``` fence.
function lmnFirstLine(text) {
  for (const l of text.split('\n')) {
    const t = l.trim();
    if (t && !t.startsWith('//') && !t.startsWith('```')) return t;
  }
  return '';
}

// Compile every LMN song the game declares and report its problems.
async function checkLmn(program, read) {
  const songs = Object.values(program.decls.assets).filter(a => a.kind === 'audio' && /\.(lmn|txt)$/i.test(a.path));
  if (!songs.length) return [];
  if (!globalThis.LMN) { try { await import('../engine/vendor/lmn/lmn-core.js'); } catch (e) { return []; } }
  const out = [];
  const hint = (a) => `In the song for \`${a.id}\`. See engine/vendor/lmn/LMN-Spec.md.`;
  for (const a of songs) {
    const text = read(a.path);
    if (text == null) continue;
    let song;
    try { song = globalThis.LMN.compile(text); } catch (e) { out.push({ severity: 'error', code: 'E303', message: `\`${a.id}\`: LMN could not compile ${a.path}: ${e && e.message || e}`, file: a.loc.file, line: a.loc.line }); continue; }
    // A .lmn file is a song by its extension; a .txt one says so in its version line.
    if (/\.txt$/i.test(a.path) && !/^LMN\s+1\b/.test(lmnFirstLine(text))) {
      if (!song || !song.events || !song.events.length) { out.push({ severity: 'error', code: 'E303', message: `\`${a.id}\`: ${a.path} is not an LMN song (a .txt song starts with the line \`LMN 1\`).`, file: a.loc.file, line: a.loc.line, hint: 'Rename it to .lmn, or add `LMN 1` as its first line.' }); continue; }
      out.push({ severity: 'warning', code: 'W617', message: `\`${a.id}\`: ${a.path} does not start with \`LMN 1\`; a .txt file is an LMN song only with that line.`, file: a.path, line: 1, hint: 'Add `LMN 1` as its first line (comments may come before it), or rename the file to .lmn.' });
    }
    for (const d of (song && song.diagnostics) || []) {
      const severity = d.level === 'error' ? 'error' : d.level === 'info' ? 'info' : 'warning';
      out.push({ severity, code: severity === 'error' ? 'E303' : 'W617', message: `LMN: ${d.message}`, file: a.path, line: d.line, hint: hint(a) });
    }
  }
  return out;
}

function printDiagnostics(list, json) {
  if (json) { out(JSON.stringify(list, null, 2)); return; }
  for (const d of list) { out(formatDiagnostic(d)); out(''); }
}

function failIfErrors(res, json) {
  const errs = res.diagnostics.filter(d => d.severity === 'error');
  if (!errs.length) return false;
  if (json) out(JSON.stringify({ ok: false, diagnostics: errs }, null, 2));
  else {
    printDiagnostics(errs, false);
    if (!res.noGame) out(`The game has ${summary(errs)}. Fix them first (run \`shiori check\` for warnings too).`);
  }
  host.exit(1);
  return true;
}

// ---------------------------------------------------------------- commands

async function cmdCheck(o) {
  const res = await load(o._[0] || '.');
  if (res.noGame) {
    if (o.json) out(JSON.stringify({ ok: false, summary: summary(res.diagnostics), diagnostics: res.diagnostics }, null, 2));
    else printDiagnostics(res.diagnostics, false);
    host.exit(1);
    return;
  }
  if (res.program && !res.diagnostics.some(d => d.severity === 'error')) {
    const a = analyze(res.program);
    for (const id of a.unreachableScenes) {
      const s = res.program.scenes[id] || {};
      res.diagnostics.push({ severity: 'warning', code: 'W600', message: `Scene \`${id}\` is never reached: no jump, choice or fall-through leads to it.`, file: s.file, line: s.line, hint: `Add \`-> ${id}\` (or a choice that leads to it) where it should happen, or delete the scene.` });
    }
    for (const r of a.staticRuns) res.diagnostics.push({ severity: 'warning', code: 'W616', message: `${r.length} lines in a row with no visual change (no expression, movement, camera or effect).`, file: r.loc && r.loc.file, line: r.loc && r.loc.line, hint: 'Readers notice static sprites. Change an expression (`mio (sad): ...`), move someone, or use @camera / @weather / @cg.' });
    for (const r of a.longAdvLines) res.diagnostics.push({ severity: 'warning', code: 'W619', message: `This ADV line is ${r.length} characters; the textbox fits about 250.`, file: r.loc && r.loc.file, line: r.loc && r.loc.line, hint: 'Split it into two lines (each line is one click), or use @mode nvl for long prose.' });
    for (const r of a.dialogueRuns) res.diagnostics.push({ severity: 'warning', code: 'W614', message: `${r.length} lines of dialogue in a row with no narration.`, file: r.loc && r.loc.file, line: r.loc && r.loc.line, hint: 'Add narration between lines: gestures, setting, thoughts. VNDB requires real novel narration, not dialogue alone.' });
  }
  // Gameplay modules must export a play() function.
  if (res.program) {
    const join = (x) => res.base === '.' ? x : res.base + '/' + x;
    for (const a of Object.values(res.program.decls.assets).filter(x => x.kind === 'gameplay')) {
      if (!host.exists(join(a.path))) continue;
      try {
        const m = await import(host.moduleUrl(join(a.path)));
        if (typeof (m.default || m.play) !== 'function') res.diagnostics.push({ severity: 'error', code: 'E116', message: `Gameplay module \`${a.path}\` must \`export default async function play({ container, params })\` that resolves with the result.`, file: a.loc.file, line: a.loc.line });
      } catch (e) { res.diagnostics.push({ severity: 'error', code: 'E116', message: `Gameplay module \`${a.path}\` could not be loaded: ${e && e.message || e}`, file: a.loc.file, line: a.loc.line }); }
    }
  }
  let list = res.diagnostics;
  // Missing art/music is normal while writing: group it unless --assets.
  const missing = list.filter(d => d.code === 'W602');
  if (missing.length > 3 && !o.assets && !o.json) {
    const files = res.missingFiles && res.missingFiles.length ? res.missingFiles : missing.map(d => d.message);
    list = list.filter(d => !missing.includes(d));
    list.push({ severity: 'warning', code: 'W602', message: `${files.length} declared asset files don't exist yet (${files.slice(0, 3).join(', ')}${files.length > 3 ? ', …' : ''}).`, hint: 'That is fine while the art and music are being made. `shiori check --assets` lists them; `shiori assets` shows where each one is used.' });
  }
  if (o.json) {
    out(JSON.stringify({ ok: !res.diagnostics.some(d => d.severity === 'error'), summary: summary(res.diagnostics), diagnostics: list }, null, 2));
  } else {
    printDiagnostics(list, false);
    const p = res.program;
    const words = p ? analyze(p).reachableWords : 0;
    const byCode = {};
    for (const d of res.diagnostics) if (d.severity !== 'info') byCode[d.code] = (byCode[d.code] || 0) + 1;
    const breakdown = Object.entries(byCode).sort().map(([c, n]) => n > 1 ? `${c}×${n}` : c).join(' ');
    out(`${p.header.title || '(untitled)'}: ${p.sceneOrder.length} scenes, ${words.toLocaleString('en-US')} words. ${summary(res.diagnostics)}${breakdown ? ' (' + breakdown + ')' : ''}.`);
    if (!res.diagnostics.some(d => d.severity !== 'info')) out('All clear.');
  }
  if (res.diagnostics.some(d => d.severity === 'error') || (o.strict && res.diagnostics.some(d => d.severity === 'warning'))) host.exit(1);
}

function fmtEffect(e, program) {
  switch (e.type) {
    case 'stage':
      switch (e.op) {
        case 'scene': return `scene ${e.stage.bg ? (e.stage.bg.id || e.stage.bg.color) : '?'}${e.stage.bg && e.stage.bg.kind === 'world' ? ' (3D)' : ''}${e.with ? ' · ' + e.with : ''}`;
        case 'bg': return `bg ${e.bg.id || e.bg.color}`;
        case 'show': {
          const attrs = Object.values(e.actor.attrs || {}).join(' ');
          return `${e.entering ? 'show' : 'change'} ${e.id}${attrs ? ' ' + attrs : ''}${e.entering ? ' at ' + (e.actor.mark || pos(e.actor.x)) : ''}`;
        }
        case 'hide': return `hide ${e.id}`;
        case 'move': return `move ${e.id} to ${e.actor.mark || pos(e.actor.x)}`;
        case 'cg': return e.cg ? `CG ${e.cg}` : 'CG closed';
        case 'camera': return `camera ${Object.entries(e.camera).filter(([k, v]) => v != null && !(k === 'zoom' && v === 1) && v !== 0).map(([k, v]) => k + '=' + v).join(' ') || 'reset'}${e.orbit ? ' orbit=' + e.orbit : ''}`;
        case 'weather': return e.weather ? `weather ${e.weather.type}` : 'weather cleared';
        case 'filter': return `filter ${e.filter}`;
        case 'tint': return e.tint ? `tint ${e.tint.color}` : 'tint cleared';
        case 'shake': return 'shake';
        case 'flash': return `flash ${e.color}`;
      }
      return e.op;
    case 'audio':
      if (e.op === 'music') return e.music ? `music ${e.music.id}` : 'music stops';
      if (e.op === 'ambience') return e.ambience ? `ambience ${e.ambience.id}` : 'ambience stops';
      if (e.op === 'sound') return `sound ${e.id}`;
      if (e.op === 'stop') return `stop ${e.what}`;
      return e.op;
    case 'text':
      if (e.op === 'mode') return `mode ${e.mode}`;
      if (e.op === 'clear') return 'new page';
      if (e.op === 'textbox') return e.visible ? 'textbox shown' : 'textbox hidden';
      if (e.op === 'pov') return e.who ? `pov ${e.who}${e.name && e.name !== e.who ? ' (' + e.name + ')' : ''}` : 'pov cleared';
      return e.op;
    case 'log': return `log: ${e.text}`;
    case 'error': case 'warning': return `${e.type.toUpperCase()} ${e.code}: ${e.message}${e.loc ? ` (${e.loc.file}:${e.loc.line})` : ''}`;
  }
  return null;
}
function pos(x) {
  const names = { 0.12: 'farleft', 0.27: 'left', 0.38: 'midleft', 0.5: 'center', 0.62: 'midright', 0.73: 'right', 0.88: 'farright' };
  return names[x] || String(x);
}

// --rolls 3,true,… : numbers for random(), true/false for chance().
function parseRolls(raw, problems) {
  if (!raw) return null;
  const rolls = [];
  for (const x of String(raw).split(',').map(s => s.trim()).filter(Boolean)) {
    if (x === 'true' || x === 'false') rolls.push(x === 'true');
    else if (Number.isFinite(Number(x))) rolls.push(Number(x));
    else problems.push(`\`--rolls ${x}\`: each roll is a number (for random()) or true/false (for chance()).`);
  }
  return rolls;
}

// --game id=result,… : a queue of results per gameplay id.
function parseGames(raw, program, problems) {
  const queue = {};
  if (typeof raw !== 'string') return queue;
  const games = Object.values(program.decls.assets).filter(a => a.kind === 'gameplay');
  for (const kv of raw.split(',').map(s => s.trim()).filter(Boolean)) {
    const eq = kv.indexOf('=');
    const k = (eq < 0 ? kv : kv.slice(0, eq)).trim(), v = eq < 0 ? '' : kv.slice(eq + 1).trim();
    const g = games.find(a => a.id === k);
    if (!g) { const m = didYouMean(k, games.map(a => a.id)); problems.push(`Unknown gameplay \`${k}\` in --game.${m ? ` Did you mean \`${m}\`?` : games.length ? ` Declared: ${games.map(a => a.id).join(', ')}.` : ' The game declares no @gameplay.'}`); continue; }
    const results = Array.isArray(g.opts.results) ? g.opts.results : null;
    if (!v) { problems.push(`\`--game ${k}\` needs a result: --game ${k}=${results ? results[0] : 'win'}`); continue; }
    if (results && results.length && !results.includes(v)) {
      const m = didYouMean(v, results);
      problems.push(`\`--game ${k}=${v}\`: \`${k}\` declares the results ${results.join(', ')}.${m ? ` Did you mean \`${m}\`?` : ` If the module can return \`${v}\`, add it to \`results=\` of @gameplay ${k}.`}`);
      continue;
    }
    (queue[k] = queue[k] || []).push(v);
  }
  return queue;
}

// Stops (@wait, @pause, @game, @chapter, @video...) in a row without a line or a
// choice before play gives up: a loop the reader could never leave.
const STALL_LIMIT = 1000;
const STALL_SHOWN = 20;

async function cmdPlay(o) {
  const res = await load(o._[0] || '.', { skipAssets: true });
  if (failIfErrors(res, o.json)) return;
  const program = res.program;
  const { persistent, vars, problems } = startData(o, program);
  const rolls = parseRolls(o.rolls, problems);
  const gameQueue = parseGames(o.game, program, problems);
  if (o.from && !program.labels[o.from]) {
    const m = didYouMean(o.from, program.sceneOrder);
    problems.push(`Unknown scene \`${o.from}\` in --from.${m ? ` Did you mean \`${m}\`?` : ''}`);
  }
  if (problems.length) return fail(problems.join('\n'));
  const seed = o.seed != null ? Number(o.seed) : 1;
  const vm = new VM(program, { registry: res.registry, seed, maxHistory: 0, persistent });
  // Scripted random outcomes and gameplay results.
  if (rolls) { let ri = 0; vm.randomHook = (kind, a, b) => { if (ri < rolls.length) return rolls[ri++]; return kind === 'chance' ? false : a; }; }
  const choices = o.choices ? String(o.choices).split(',').map(s => s.trim()).filter(Boolean) : [];
  const taken = [];
  const max = o.max ? Number(o.max) : 5000;
  const json = [];
  // stall: stops since the last line or choice; stallGame: an @game in that stretch that got its default result.
  let lines = 0, stall = 0, stop = null, stallGame = null;
  let r = vm.start(o.from || null, { vars, seed });
  const emit = (obj, text) => { if (o.json) json.push(obj); else if (text != null) out(text); };
  const quiet = () => stall > STALL_SHOWN;
  for (;;) {
    const h = r.halt;
    if (h.type === 'say' || h.type === 'menu' || h.type === 'input') { stall = 0; stallGame = null; }
    else if (h.type !== 'end' && h.type !== 'error') stall++;
    if (stall === STALL_SHOWN + 1) emit({ type: 'note', message: `${STALL_SHOWN} stops in a row without a line; the next ones are not shown until a line or a choice` }, `  · … (${STALL_SHOWN} stops in a row without a line; the next ones are not shown until a line or a choice)`);
    for (const e of r.effects) {
      if (e.type === 'restore') continue;
      if (quiet() && e.type !== 'error') continue;
      if (e.type === 'scene') { emit({ type: 'scene', id: e.id, title: e.title }, `\n── ${e.id}${e.title ? ' "' + e.title + '"' : ''} ──`); continue; }
      const f = fmtEffect(e, program);
      if (f && (!o.quiet || e.type === 'error' || e.type === 'log')) emit({ type: 'effect', effect: e }, `  · ${f}`);
    }
    if (stall > STALL_LIMIT) {
      const ins = program.code[vm.state.pc - 1];
      const loc = ins && ins.loc;
      const what = h.type === 'game' ? `@game ${h.id}` : '@' + h.type;
      const message = `The story looped ${STALL_LIMIT} times without showing a line or a choice (it keeps stopping at ${what}${loc ? ` in ${loc.file}:${loc.line}` : ''}).`;
      const hint = stallGame
        ? `Every @game ${stallGame.id} got the first declared result "${stallGame.value}". Give the results in order, e.g. --game ${stallGame.id}=${stallGame.others[0]}.`
        : 'A loop of jumps that only passes @wait, @pause, @game, @chapter or @video never lets the reader out. Add a line or a choice to it, or a way out.';
      emit({ type: 'error', code: 'R703', message, hint, loc }, `\nERROR R703: ${message}\n  hint: ${hint}`);
      host.exit(1);
      stop = 'error';
      break;
    }
    if (h.type === 'say') {
      lines++;
      const text = h.name ? `${h.name}${Object.keys(h.attrs || {}).length && !o.quiet ? ' (' + Object.values(h.attrs).join(', ') + ')' : ''}: ${h.plain}` : h.plain;
      const stage = o.state ? stageSummary(vm.state.stage) : null;
      emit({ type: 'say', who: h.who, name: h.name, text: h.plain, id: h.id, loc: h.loc, mode: h.mode, ...(stage ? { stage } : {}) }, (h.mode === 'nvl' ? '¶ ' : '') + text);
      if (stage && !o.json) out('    stage: ' + JSON.stringify(stage));
      if (lines >= max) { emit({ type: 'stopped', reason: 'max' }, `\n(stopped after ${max} lines)`); stop = 'max'; break; }
      r = vm.advance();
      continue;
    }
    if (h.type === 'menu') {
      const ins = program.code[h.pc];
      emit({ type: 'menu', options: h.options.map(x => ({ n: x.index + 1, text: x.plain, locked: x.disabled })) }, '? Choose:');
      if (!o.json) {
        ins.options.forEach((opt, i) => {
          const sh = h.options.find(x => x.index === i);
          if (sh) out(`    ${i + 1}) ${sh.plain}${sh.disabled ? `   [locked${sh.hint ? ': ' + sh.hint : ''}]` : ''}`);
          else if (!o.quiet) {
            const text = plainText(opt.text);
            if (opt.once && vm.state.chosen[opt.id]) out(`    ${i + 1}) (already picked: ${text})`);
            else out(`    ${i + 1}) (hidden: [if ${opt.cond ? exprToString(opt.cond).replace(/^\((.*)\)$/, '$1') : '…'}] ${text})`);
          }
        });
      }
      if (!choices.length) {
        const avail = h.options.filter(x => !x.disabled).map(x => x.index + 1);
        const so = taken.length ? taken.join(',') + ',' : '';
        emit({ type: 'stopped', reason: 'choice', available: avail, rerun: `--choices ${so}<n>` },
          `\nStopped at a choice. To continue, rerun with --choices ${so}<n>  (n = ${avail.join(' or ')})`);
        stop = 'choice';
        break;
      }
      const c = choices.shift();
      const n = Number(c);
      const sh = h.options.find(x => x.index === n - 1);
      if (!sh || sh.disabled) {
        emit({ type: 'error', message: `Choice ${c} is not available here.` }, `Choice ${c} is not available here (available: ${h.options.filter(x => !x.disabled).map(x => x.index + 1).join(', ')}).`);
        host.exit(1);
        stop = 'bad-choice';
        break;
      }
      taken.push(n);
      emit({ type: 'choice', n, text: sh.plain }, `  → ${n}) ${sh.plain}`);
      r = vm.choose(n - 1);
      continue;
    }
    if (h.type === 'end') {
      const e = h.ending ? program.decls.endings[h.ending] : null;
      emit({ type: 'end', ending: h.ending }, `\n■ END${e ? ` — ending "${e.title}" (${e.kind})` : ''}`);
      stop = 'end';
      break;
    }
    if (h.type === 'error') {
      emit({ type: 'error', code: h.code, message: h.message, loc: h.loc }, `\nERROR ${h.code}: ${h.message}${h.loc ? ` (${h.loc.file}:${h.loc.line})` : ''}`);
      host.exit(1);
      stop = 'error';
      break;
    }
    if (h.type === 'input') {
      const v = choices.length && isNaN(Number(choices[0])) ? choices.shift() : h.default;
      emit({ type: 'input', var: h.var, value: v }, `? ${h.prompt || 'Input'} → "${v}"`);
      r = vm.submit(v);
      continue;
    }
    if (h.type === 'game') {
      const q = gameQueue[h.id];
      const scripted = q && q.length ? q.shift() : (o['game-result'] != null ? o['game-result'] : undefined);
      const v = scripted !== undefined ? scripted : (h.results && h.results[0]) || null;
      if (scripted === undefined && h.results && h.results.length > 1) stallGame = { id: h.id, value: v, others: h.results.filter(x => x !== v) };
      if (!quiet()) emit({ type: 'game', id: h.id, result: v }, `  · gameplay ${h.id} → ${v}${scripted === undefined && h.results && h.results.length > 1 ? `  (first declared result; try --game ${h.id}=${h.results[1]})` : ''}`);
      r = vm.submit(v);
      continue;
    }
    if (h.type === 'ending') emit({ type: 'ending', id: h.id, title: h.title, kind: h.kind }, `\n★ Ending: ${h.title} (${h.kind})`);
    if (!quiet()) {
      if (h.type === 'chapter') emit({ type: 'chapter', title: h.title }, `\n=== ${h.title}${h.subtitle ? ' — ' + h.subtitle : ''} ===`);
      if (h.type === 'video') emit({ type: 'video', id: h.id }, `  · video ${h.id}`);
      if ((h.type === 'wait' || h.type === 'pause') && !o.quiet && h.reason !== 'transition') emit({ type: h.type }, `  · ${h.type}${h.seconds ? ' ' + h.seconds + 's' : ''}`);
    }
    r = vm.advance();
  }
  // Choices and @game results the route never used: the route asked for was not the one played.
  const unusedGames = Object.entries(gameQueue).flatMap(([k, q]) => q.map(v => `${k}=${v}`));
  const unused = (stop === 'end' || stop === 'error') && (choices.length || unusedGames.length);
  const unusedText = !unused ? '' : [
    choices.length ? `Unused --choices: ${choices.join(',')} (the story ${stop === 'end' ? 'ended' : 'stopped'} after ${taken.length ? `${taken.length} choice${taken.length > 1 ? 's' : ''}: ${taken.join(',')}` : 'no choice'}).` : '',
    unusedGames.length ? `Unused --game results: ${unusedGames.join(',')} (the route did not reach that many @game).` : '',
  ].filter(Boolean).join('\n') + '\n  hint: This is not the route you asked for. Check the numbers against the menus above, or see the routes with `shiori explore`.';
  if (unused) host.exit(1);
  if (o.json) out(JSON.stringify({ transcript: json, vars: vm.state.vars, choices: taken, ...(unused && choices.length ? { unusedChoices: choices } : {}), ...(unused && unusedGames.length ? { unusedGames } : {}) }, null, 2));
  else {
    if (!o.quiet) out(`\nvariables: ${Object.entries(vm.state.vars).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ') || '(none)'}`);
    if (unused) out('\n' + unusedText);
  }
}

function stageSummary(s) {
  return { bg: s.bg && (s.bg.id || s.bg.color), actors: s.actors.map(a => `${a.id}${Object.keys(a.attrs).length ? '(' + Object.values(a.attrs).join(',') + ')' : ''}@${a.mark || pos(a.x)}`), cg: s.cg, weather: s.weather && s.weather.type, filter: s.filter !== 'none' ? s.filter : undefined };
}

async function cmdExplore(o) {
  const res = await load(o._[0] || '.', { skipAssets: true });
  if (failIfErrors(res, o.json)) return;
  const program = res.program;
  const { persistent, problems } = startData(o, program, { forExplore: true });
  if (problems.length) return fail(problems.join('\n'));
  const ex = explore(program, { registry: res.registry, maxStates: o['max-states'] ? Number(o['max-states']) : undefined, persistent });
  const partial = ex.truncated;
  if (ex.errors.length || ex.assertions.length || (!partial && ex.unreachedEndings.length)) host.exit(1);
  if (o.json) { out(JSON.stringify(ex, null, 2)); return; }
  out(`Explored ${ex.routes.toLocaleString('en-US')} route${ex.routes === 1 ? '' : 's'} (${ex.states.toLocaleString('en-US')} states${ex.passes > 1 ? `, ${ex.passes} playthroughs to cover unlocks` : ''}${ex.randomUsed ? ', including random() outcomes' : ''}).`);
  if (partial) out(`STOPPED EARLY at --max-states ${ex.maxStates} with ${ex.frontier.toLocaleString('en-US')} branches still unexplored, so everything below is partial: "not reached" means "not reached yet". Try --max-states ${ex.maxStates * 8}.`);
  out('');
  out(`Endings (${ex.endings.length}):`);
  for (const e of ex.endings) {
    out(`  ★ ${e.title}${e.id !== 'END' ? ` [${e.id}]` : ''} — ${e.routes} route${e.routes === 1 ? '' : 's'}${e.pass > 1 ? ` (needs playthrough ${e.pass})` : ''}`);
    if (!e.shortest) continue;
    out(`      shortest: ${formatPath(e.shortest.path)}${e.shortest.rolls && e.shortest.rolls.length ? `  (random: ${e.shortest.rolls.join(',')})` : ''}`);
    const args = replayArgs(e);
    if (args) out(`      replay:   shiori play ${res.base === '.' ? '' : shq(res.base) + ' '}${args}${e.shortest.verified === false ? '   (⚠ could not confirm this replay)' : ''}`);
  }
  if (ex.unreachedEndings.length) {
    out('');
    out(partial ? 'Endings not reached within the budget:' : 'Endings no route reaches (W611):');
    for (const e of ex.unreachedEndings) out(`  ${partial ? '?' : '✗'} ${e.title} [${e.id}] (${e.loc.file}:${e.loc.line})`);
  }
  if (ex.plainEnds.length) {
    out('');
    out('Routes that end without an @ending:');
    for (const p of ex.plainEnds.slice(0, 10)) out(`  ⚠ in scene ${p.scene}${p.implicit ? ' (fell off the end of its file)' : ''}: ${formatPath(p.path)}`);
  }
  const probs = ex.errors.concat(ex.assertions);
  if (probs.length) {
    out('');
    out('Problems:');
    for (const p of probs.slice(0, 30)) out(`  ✗ ${p.code} ${p.message}${p.loc ? ` (${p.loc.file}:${p.loc.line})` : ''}\n      via: ${formatPath(p.path)}`);
  }
  if (ex.warnings.length) {
    out('');
    out('Warnings:');
    for (const p of ex.warnings.slice(0, 20)) out(`  ⚠ ${p.message}${p.loc ? ` (${p.loc.file}:${p.loc.line})` : ''}`);
  }
  out('');
  if (ex.constantConditions.length) {
    out('');
    out('Conditions that never change (true or false on every route — often a logic slip):');
    for (const c of ex.constantConditions.slice(0, 20)) out(`  ⚠ ${c.loc.file}:${c.loc.line}  @if ${c.cond}  is always ${c.always ? 'true' : 'false'}`);
  }
  out('');
  const unseenWord = partial ? 'not shown yet' : 'never shown';
  out(`Coverage: ${ex.lines.seen}/${ex.lines.total} lines, ${ex.scenes.seen}/${ex.scenes.total} scenes.`);
  if (ex.scenes.unseen.length) out(`  Scenes ${partial ? 'not entered yet' : 'no route enters'}: ${ex.scenes.unseen.join(', ')}`);
  if (ex.lines.unseen.length && ex.lines.unseen.length <= 15) for (const l of ex.lines.unseen) out(`  Line ${unseenWord}: ${l.file}:${l.line}`);
  else if (ex.lines.unseen.length) out(`  ${ex.lines.unseen.length} lines are ${unseenWord} (first: ${ex.lines.unseen.slice(0, 5).map(l => l.file + ':' + l.line).join(', ')}).`);
  for (const c of ex.options.neverShown) out(`  Choice ${partial ? 'not offered yet' : 'never offered'}: "${c.text}" (${c.loc.file}:${c.loc.line})${partial ? '' : ' — its condition is never true.'}`);
}

async function cmdGraph(o) {
  const res = await load(o._[0] || '.', { skipAssets: true });
  if (failIfErrors(res, o.json)) return;
  const a = analyze(res.program);
  const fmt = o.json ? 'json' : (o.format || 'mermaid');
  if (fmt === 'json') out(JSON.stringify(a.graph, null, 2));
  else if (fmt === 'dot') out(toDot(a.graph, res.program));
  else out(toMermaid(a.graph, res.program));
}

async function cmdStats(o) {
  const res = await load(o._[0] || '.', { skipAssets: true });
  if (failIfErrors(res, o.json)) return;
  const a = analyze(res.program);
  const notes = Array.isArray(res.program.notes) ? res.program.notes : [];
  if (o.json) { const { graph, ...rest } = a; out(JSON.stringify({ ...rest, notes }, null, 2)); return; }
  const h = res.program.header;
  out(`${h.title}`);
  out(`  ${a.scenes} scenes · ${a.lines.toLocaleString('en-US')} lines · ${a.reachableWords.toLocaleString('en-US')} words (reachable)`);
  out(`  Reading time ≈ ${fmtHours(a.readingHours)} at ${h.reading_speed} words/min → VNDB length: ${a.lengthCategory.name} (${a.lengthCategory.doc})`);
  out(`  Narration: ${(a.narrationShare * 100).toFixed(0)}% of words · Dialogue lines: ${a.dialogueLines} · Narration lines: ${a.narrationLines}`);
  out(`  Choices: ${a.menus} menus, ${a.options} options · Endings: ${a.endings.length} · Text modes: ADV ${a.modes.adv} lines, NVL ${a.modes.nvl} lines`);
  if (a.games.length) out(`  Gameplay: ${a.games.length} uses, ~${a.gameMinutes} min → reading share ${(a.readingShare * 100).toFixed(1)}%`);
  out(`  Median lines between choices: ${a.medianLinesBetweenInteractions} · Longest dialogue run without narration: ${a.maxDialogueRun.length} lines`);
  out('');
  out('  Lines per speaker:');
  for (const [k, v] of Object.entries(a.perCharacter)) out(`    ${v.name.padEnd(16)} ${String(v.lines).padStart(5)} lines ${String(v.words).padStart(7)} words`);
  out(`    ${'(narration)'.padEnd(16)} ${String(a.narrationLines).padStart(5)} lines`);
  if (a.unreachableScenes.length) { out(''); out(`  Unreachable scenes (W600): ${a.unreachableScenes.join(', ')}`); }
  if (notes.length) {
    out('');
    out(`  Notes (${notes.length}):`);
    for (const n of notes) out(`    ${n.loc && n.loc.file ? `${n.loc.file}:${n.loc.line}  ` : ''}${n.text}`);
  }
  if (o['by-scene']) {
    out('');
    out('  Words per scene (narration / dialogue):');
    const per = {};
    for (const ins of res.program.code) {
      if (ins.op !== 'say') continue;
      const p = per[ins.scene] = per[ins.scene] || { n: 0, d: 0, lines: 0 };
      const c = countWords(plainText(ins.text));
      const w = c.words + c.cjk / 2;
      if (ins.who || ins.name) p.d += w; else p.n += w;
      p.lines++;
    }
    for (const id of res.program.sceneOrder) {
      const p = per[id] || { n: 0, d: 0, lines: 0 };
      const sc = res.program.scenes[id];
      out(`    ${(id + (sc.title ? ' "' + sc.title + '"' : '')).slice(0, 44).padEnd(44)} ${String(Math.round(p.n + p.d)).padStart(6)} words  (${Math.round(p.n)} / ${Math.round(p.d)})  ${sc.file}:${sc.line}`);
    }
  }
}

// Paths the engine loads as they are (checkAssets skips them too).
const isRemote = (p) => /^(https?:|blob:)/i.test(p);
const isInline = (p) => /^data:/i.test(p);

async function cmdAssets(o) {
  const res = await load(o._[0] || '.', { skipAssets: true });
  if (failIfErrors(res, o.json)) return;
  const p = res.program, decls = p.decls;
  const join = (x) => res.base === '.' ? x : res.base + '/' + x;
  // Where is each asset used, and under which filter / weather / tint?
  const uses = {}, charUse = {};
  let ctx = { filter: null, weather: null, tint: null };
  const use = (id, as, ins) => { (uses[id] = uses[id] || []).push({ as, scene: ins.scene, line: ins.loc && ins.loc.line, file: ins.loc && ins.loc.file, ...ctx }); };
  for (const ins of p.code) {
    if (ins.op === 'scene') ctx = { filter: null, weather: null, tint: null };
    if (ins.op === 'say' && ins.who) {
      const c = charUse[ins.who] = charUse[ins.who] || { attrs: {}, scenes: new Set() };
      c.scenes.add(ins.scene);
      for (const [g, v] of Object.entries(ins.attrs || {})) (c.attrs[g] = c.attrs[g] || new Set()).add(v);
    }
    if (ins.op !== 'cmd') continue;
    const a = ins.args;
    switch (ins.name) {
      case 'scene': ctx = { filter: null, weather: null, tint: null }; if (a.bg && decls.assets[a.bg]) use(a.bg, 'background', ins); break;
      case 'bg': if (a.bg && decls.assets[a.bg]) use(a.bg, 'background', ins); break;
      case 'cg': if (a.image) use(a.image, 'CG', ins); break;
      case 'show':
        if (a.kind === 'character') { const c = charUse[a.who] = charUse[a.who] || { attrs: {}, scenes: new Set() }; c.scenes.add(ins.scene); for (const [g, v] of Object.entries(a.attrs || {})) (c.attrs[g] = c.attrs[g] || new Set()).add(v); }
        else use(a.who, 'prop', ins);
        break;
      case 'music': if (a.track !== 'stop') use(a.track, 'music', ins); break;
      case 'ambience': if (a.track !== 'stop') use(a.track, 'ambience', ins); break;
      case 'sound': use(a.sound, 'sound', ins); break;
      case 'voice': use(a.clip, 'voice', ins); break;
      case 'video': use(a.id, 'video', ins); break;
      case 'game': use(a.id, 'gameplay', ins); break;
      case 'filter': ctx = { ...ctx, filter: a.type === 'none' ? null : a.type }; break;
      case 'weather': ctx = { ...ctx, weather: a.type === 'none' ? null : a.type }; break;
      case 'tint': ctx = { ...ctx, tint: a.color === 'none' ? null : a.color }; break;
    }
  }
  const report = { assets: [], characters: [] };
  for (const a of Object.values(decls.assets)) {
    const remote = isRemote(a.path);
    report.assets.push({ id: a.id, kind: a.kind, path: a.path, exists: remote || isInline(a.path) || host.exists(join(a.path)), ...(remote ? { remote: true } : {}), desc: a.opts.desc || a.opts.title || null, uses: uses[a.id] || [] });
  }
  for (const c of Object.values(decls.characters)) {
    const u = charUse[c.id] || { attrs: {}, scenes: new Set() };
    const groups = {};
    for (const [g, vals] of Object.entries(c.groups)) groups[g] = { declared: vals, used: vals.filter(v => (u.attrs[g] && u.attrs[g].has(v)) || c.defaults[g] === v), unused: vals.filter(v => !((u.attrs[g] && u.attrs[g].has(v)) || c.defaults[g] === v)) };
    report.characters.push({ id: c.id, name: c.name, sprite: c.sprite || (c.layers.length ? c.layers : null), model: c.model, blink: c.blink, mouth: c.mouth, groups, scenes: [...u.scenes], description: c.vndb.description || null });
  }
  if (o.json) { out(JSON.stringify(report, null, 2)); return; }
  out(`${p.header.title}: ${report.assets.length} assets, ${report.characters.length} characters`);
  const kinds = ['image', 'world', 'model', 'audio', 'video', 'gameplay'];
  for (const k of kinds) {
    const list = report.assets.filter(a => a.kind === k);
    if (!list.length) continue;
    out(`\n${k.toUpperCase()}`);
    for (const a of list) {
      const shown = isInline(a.path) ? a.path.slice(0, 40) + (a.path.length > 40 ? '…' : '') + '  (inline data)' : a.path + (a.remote ? '  (remote, not checked)' : '');
      out(`  ${a.remote ? '↗' : a.exists ? '✓' : '✗'} ${a.id}  ${shown}${a.desc ? '  — ' + a.desc : ''}`);
      if (!a.uses.length) out('      (never used)');
      const seen = new Set();
      for (const u of a.uses) {
        const extra = [u.filter && 'filter ' + u.filter, u.weather && 'weather ' + u.weather, u.tint && 'tint ' + u.tint].filter(Boolean).join(', ');
        const line = `      ${u.as} in ${u.scene} (${u.file}:${u.line})${extra ? ' — ' + extra : ''}`;
        if (!seen.has(line)) { seen.add(line); out(line); }
      }
    }
  }
  out('\nCHARACTERS');
  for (const c of report.characters) {
    out(`  ${c.id} (${c.name})${c.sprite ? '  sprite: ' + [].concat(c.sprite).join(' + ') : ''}${c.model ? '  model: ' + c.model : ''}${!c.sprite && !c.model ? '  (no sprite)' : ''}`);
    for (const [g, v] of Object.entries(c.groups)) out(`      ${g}: used ${v.used.join(' ') || '—'}${v.unused.length ? '   · never used: ' + v.unused.join(' ') : ''}`);
    if (c.scenes.length) out(`      in: ${c.scenes.join(', ')}`);
  }
}

function fmtHours(h) { return h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`; }

async function cmdVndb(o) {
  const res = await load(o._[0] || '.', { skipAssets: true });
  if (failIfErrors(res, o.json)) return;
  const a = analyze(res.program);
  const ex = o['no-explore'] ? null : explore(res.program, { registry: res.registry, maxStates: o['max-states'] ? Number(o['max-states']) : undefined });
  const r = vndbReport(res.program, { analysis: a, exploration: ex });
  if (o.json) out(JSON.stringify(r, null, 2));
  else out(formatVndb(r));
}

const TOPICS = {
  choices: ['Choices', 'Write options as `* text` lines; indent each option\'s body under it. After a body the story continues after the whole menu, unless the body jumps. `* text -> scene` jumps. Modifiers go first: `[if cond]` (hidden when false), `[require cond "hint"]` (shown locked, with an optional hint), `[once]` (gone after it is picked). In `shiori play --choices`, numbers are each option\'s position as written (hidden options still count). Keep one option with no condition.'],
  conditions: ['Conditions', 'Used in `@if`/`@elif`, `[if]`, `[require]`, `@assert`. Compare with == != < <= > >=, combine with and / or / not (also && || !), arithmetic + - * / %, strings in quotes, true/false. Functions: see `shiori docs functions`. `=` alone is an error; assign with `@set`.'],
  text: ['Text markup', null],
  header: ['Header fields', null],
  functions: ['Functions', null],
  positions: ['Positions', null],
  transitions: ['Transitions', null],
  weather: ['Weather', null],
  filters: ['Filters', null],
  codes: ['Diagnostic codes', null],
};
const CLI_HELP = {
  check: 'shiori check <folder> [--assets] [--strict] [--json]\n  Compile and lint. --assets lists every missing file instead of one summary line; --strict exits 1 on warnings too.',
  play: HELP.split('\n  play')[1] ? 'shiori play <folder> [options]\n  ' + HELP.split('\n  play')[1].split('\n  explore')[0].trim() : '',
  explore: HELP.split('\n  explore')[1] ? 'shiori explore <folder> [options]\n  ' + HELP.split('\n  explore')[1].split('\n  graph')[0].trim() : '',
  graph: 'shiori graph <folder> [--format mermaid|dot|json]\n  The scene graph: jumps, calls, choices and fall-through between scenes; endings are marked.',
  stats: 'shiori stats <folder> [--by-scene] [--json]\n  Words, reading time and VNDB length category, narration share, lines per speaker, unreachable scenes and @note notes; --by-scene adds a per-scene word table.',
  assets: 'shiori assets <folder> [--json]\n  Every declared file: exists?, where it is used (with filter/weather/tint), and which expressions each character actually uses.',
  vndb: 'shiori vndb <folder> [--no-explore] [--max-states n] [--json]\n  Advisory read against VNDB\'s guidelines plus a draft entry. Never fails the command: VNDB\'s editors and the author decide.',
  new: 'shiori new <folder>\n  Copy the starter game into a new folder (inside the engine folder if you want `shiori serve`).',
  serve: 'shiori serve [folder]\n  Serve the engine folder on localhost:8777 (PORT=… to change) and print the URL of the game (with &dev=1). The folder defaults to the current one when it holds game.story.',
  explain: 'shiori explain <CODE>\n  What a diagnostic code means and how to fix it.',
  selftest: 'shiori selftest\n  Run the engine\'s own test suite.',
};

async function cmdDocs(o) {
  let reg = defaultRegistry();
  let moduleErrors = [];
  if (o.game) {
    const res = await load(o.game, { skipAssets: true });
    // Without its game.story the folder's modules are unknown: say so instead of "nothing called".
    if (res.noGame) return failIfErrors(res, o.json);
    reg = res.registry;
    moduleErrors = res.diagnostics.filter(d => d.code === 'E116');
    if (moduleErrors.length && !o.json) printDiagnostics(moduleErrors, false);
  }
  const extra = moduleErrors.length ? { diagnostics: moduleErrors } : {};
  const name = o._[0];
  if (name && TOPICS[name]) {
    const [title, text] = TOPICS[name];
    let body = text;
    if (!body) {
      const tables = tablesReference() + '\n## Diagnostic codes\n\n' + codesReference();
      const want = { text: 'Text tags', header: 'Header fields', functions: 'Functions', positions: 'Positions', transitions: 'Transitions', weather: 'Weather', filters: 'Filters', codes: 'Diagnostic codes' }[name];
      const part = tables.split(/\n(?=## )/).find(p => p.startsWith('## ' + want));
      body = part ? part.trim() : tables;
      if (!o.json) { out(body); return; }
    } else if (!o.json) { out(`# ${title}\n\n${text}`); return; }
    out(JSON.stringify({ topic: name, title, text: body }, null, 2));
    return;
  }
  if (name && CLI_HELP[name] && !reg.get(name)) { out(o.json ? JSON.stringify({ command: name, help: CLI_HELP[name] }, null, 2) : CLI_HELP[name]); return; }
  if (name) {
    const c = reg.get(name.replace(/^@/, ''));
    if (!c) {
      const m = didYouMean(name.replace(/^@/, ''), reg.names().concat(Object.keys(TOPICS), Object.keys(CLI_HELP)));
      const failed = moduleErrors.length ? `\n(${moduleErrors.length} module${moduleErrors.length === 1 ? '' : 's'} of ${o.game} could not be loaded, see above; \`${name}\` may be one of their commands.)` : '';
      if (o.json) return fail(`Nothing called \`${name}\`.`, { hint: m ? `Did you mean \`${m}\`?` : undefined, extra: { ...extra, topics: Object.keys(TOPICS), cliCommands: Object.keys(CLI_HELP), scriptCommands: reg.names() } });
      out(`Nothing called \`${name}\`.${m ? ` Did you mean \`${m}\`?` : ''}${failed}\nTopics: ${Object.keys(TOPICS).join(', ')}\nCLI commands: ${Object.keys(CLI_HELP).join(', ')}\nScript commands: ${reg.names().map(n => '@' + n).join(' ')}`);
      host.exit(1);
      return;
    }
    out(o.json ? JSON.stringify({ name: c.name, module: c.module, summary: c.summary, syntax: c.syntax, positional: c.positional, named: c.named, examples: c.examples, ...extra }, null, 2) : commandDoc(c));
    return;
  }
  if (o.json) { out(JSON.stringify(reg.names().map(n => { const c = reg.get(n); return { name: n, module: c.module, summary: c.summary, syntax: c.syntax }; }), null, 2)); return; }
  out('# Shiori command reference\n');
  out(commandReference(reg));
  out(tablesReference());
  out('## Diagnostic codes\n');
  out(codesReference());
}

function cmdExplain(o) {
  const code = (o._[0] || '').toUpperCase();
  if (!code) return fail('Which code? For example: shiori explain E113', { hint: `Codes: ${Object.keys(CODES).join(' ')}`, exit: 2 });
  if (!CODES[code]) {
    const m = didYouMean(code, Object.keys(CODES));
    return fail(`Unknown code ${code}.${m ? ` Did you mean ${m}?` : ''}`, { hint: `Codes: ${Object.keys(CODES).join(' ')}` });
  }
  if (o.json) { out(JSON.stringify({ code, title: CODES[code], help: CODE_HELP[code] || null }, null, 2)); return; }
  out(`${code}: ${CODES[code]}`);
  if (CODE_HELP[code]) out('\n' + CODE_HELP[code]);
}

// ------------------------------------------------------------------- main

const COMMANDS = { assets: cmdAssets, check: cmdCheck, play: cmdPlay, explore: cmdExplore, graph: cmdGraph, stats: cmdStats, vndb: cmdVndb, docs: cmdDocs, explain: cmdExplain };

async function main(args) {
  const cmd = args.find(a => !a.startsWith('-'));
  if (cmd && !COMMANDS[cmd] && cmd !== 'help') {
    const m = didYouMean(cmd, Object.keys(COMMANDS).concat('new', 'serve', 'build', 'selftest'));
    if (jsonMode) return fail(`Unknown command \`${cmd}\`.`, { hint: m ? `Did you mean \`${m}\`?` : 'Run `shiori help` for the commands.', exit: 2 });
    out(`Unknown command \`${cmd}\`.${m ? ` Did you mean \`${m}\`?` : ''}\n`);
    out(HELP);
    host.exit(2);
    return;
  }
  const { o, error } = parseArgs(args, cmd);
  if (error) return fail(error.message, { hint: error.hint, exit: 2 });
  o._.shift();
  if (!cmd || cmd === 'help' || o.help) { out(jsonMode ? JSON.stringify({ usage: HELP }, null, 2) : HELP); return; }
  await COMMANDS[cmd](o);
}

// Run the CLI with a host (tools/host.js, or a test double).
export async function runCli(h) {
  host = h;
  jsonMode = h.args.includes('--json');
  try { await main(h.args); }
  catch (e) { fail(`Internal error: ${describeError(e)}`, { exit: 70 }); }
}

if (!globalThis.__shioriEmbedded) {
  await runCli(await createHost(typeof arguments !== 'undefined' ? arguments : undefined));
  if (host.kind === 'jsc' && globalThis.__shioriExit) throw new Error('__shiori_exit_' + globalThis.__shioriExit);
}
