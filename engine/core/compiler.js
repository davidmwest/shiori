// Compiler: parsed files -> one Program (flat instruction list + tables).
//
//   const sources = await loadSources(readText);          // follows include:
//   const { program, diagnostics } = compileProject(sources);

import { parseFile } from './parser.js';
import { Diagnostics } from './diagnostics.js';
import { parseExpr, parseAssignment, collectRefs, FUNCTIONS, ExprError, typeOf } from './expr.js';
import { parseMarkup, plainText } from './markup.js';
import { bindArgs, checkValue, has, POSITIONS } from './registry.js';
import { HEADER_FIELDS, AI_PARTS, PLATFORMS } from './header.js';
import { didYouMean, hash, isColor } from './util.js';
import { defaultRegistry } from './modules/index.js';

export const ENTRY = 'game.story';

const COMMAND_HINTS = {
  goto: 'Jump with `-> scene_id`.',
  label: 'Start a scene with `# scene_id` at the beginning of a line.',
  menu: 'Write choices as lines starting with `* `, one per option.',
  choice: 'Write choices as lines starting with `* `, one per option.',
  say: 'Write dialogue as `mio: text`.',
  narrate: 'Narration is just a plain line of text.',
  bgm: 'Use `@music name`.',
  se: 'Use `@sound name`.',
  sfx: 'Use `@sound name`.',
  play: 'Use `@music`, `@sound`, `@ambience` or `@voice`.',
  define: 'Declare things with `@character`, `@image`, `@audio`, `@var` ...',
  let: 'Declare variables with `@var name = value`, change them with `@set`.',
  jump_to: 'Jump with `-> scene_id`.',
  image_show: 'Use `@show`.',
  else_if: 'Use `@elif`.',
  elseif: 'Use `@elif`.',
  endif: 'Blocks end by indentation; delete this line.',
};

// One spelling per file: `./story/a.story`, `story//a.story` and
// `story/x/../a.story` all become `story/a.story`. A leading `..` that climbs
// out of the game folder is kept, so the host can refuse it.
export function canonPath(p) {
  const s = String(p);
  const out = [];
  for (const part of s.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..' && out.length && out[out.length - 1] !== '..') out.pop();
    else out.push(part);
  }
  return (s.startsWith('/') ? '/' : '') + out.join('/');
}

// Read game.story and every file it includes. readText(path) -> string | null
// (may return a Promise). Paths are relative to the game folder.
export async function loadSources(readText, entry = ENTRY) {
  const sources = { entry, files: Object.create(null), order: [], missing: [] };
  const main = await readText(entry);
  if (main == null) { sources.missing.push({ path: entry }); return sources; }
  sources.files[entry] = main;
  sources.order.push(entry);
  const parsed = parseFile(entry, main, { isMain: true, diags: new Diagnostics() });
  for (const inc of parsed.includes) {
    const path = canonPath(inc.path);
    if (sources.files[path] != null) continue;
    const text = await readText(path);
    if (text == null) { sources.missing.push({ path, loc: inc.loc }); continue; }
    sources.files[path] = text;
    sources.order.push(path);
  }
  return sources;
}

// Load sources, import the game's own modules (header `modules:`), compile.
// importModule(path) -> Promise<module>; readText(path) -> string | null.
export async function prepareProject({ readText, importModule, listing, extraModules = [] }) {
  const sources = await loadSources(readText);
  if (listing) sources.listing = listing;
  const loaded = [];
  const errors = [];
  const main = sources.files[ENTRY];
  if (main && importModule) {
    const parsed = parseFile(ENTRY, main, { isMain: true, diags: new Diagnostics() });
    const entry = parsed.header.modules;
    const list = entry ? (Array.isArray(entry) ? entry : [entry]).flatMap(e => e.value.split(/[\s,]+/).filter(Boolean).map(p => ({ p, loc: e.loc }))) : [];
    for (const { p, loc } of list) {
      try {
        const m = await importModule(p);
        const mod = m && (m.default || m);
        if (!mod || !Array.isArray(mod.commands)) throw new Error('a module must `export default { name, commands: [...] }`');
        loaded.push({ path: p, module: mod });
      } catch (e) {
        errors.push({ severity: 'error', code: 'E116', message: `Could not load module \`${p}\`: ${e && e.message || e}`, file: loc.file, line: loc.line, src: loc.src });
      }
    }
  }
  const registry = defaultRegistry([...extraModules, ...loaded.map(m => m.module)]);
  const res = compileProject(sources, { registry });
  res.diagnostics.unshift(...errors);
  res.registry = registry;
  res.modules = loaded;
  res.sources = sources;
  return res;
}

export function compileProject(sources, opts = {}) {
  const registry = opts.registry || defaultRegistry();
  const diags = new Diagnostics();
  const entry = sources.entry || ENTRY;
  const parsed = [];
  for (const path of sources.order) {
    parsed.push(parseFile(path, sources.files[path], { isMain: path === entry, diags }));
  }
  for (const m of sources.missing || []) {
    if (m.path === entry) diags.error('E113', `Could not find ${entry}. Every game starts from a game.story file in its folder.`, { file: entry, line: 1 });
    else diags.error('E113', `Included file \`${m.path}\` was not found.`, m.loc, 'Paths in `include:` are relative to the folder that holds game.story.');
  }
  const main = parsed.find(f => f.path === entry);

  // ---- header ---------------------------------------------------------
  const header = {};
  const headerLocs = {};
  if (main) {
    for (const [key, entryVal] of Object.entries(main.header)) {
      const spec = has(HEADER_FIELDS, key) ? HEADER_FIELDS[key] : null;
      const e = Array.isArray(entryVal) ? entryVal[entryVal.length - 1] : entryVal;
      if (!spec) {
        const m = didYouMean(key, Object.keys(HEADER_FIELDS));
        diags.warn('W604', `Unknown header field \`${key}:\`.`, e.loc, m ? `Did you mean \`${m}:\`?` : 'See "Header fields" in the spec.');
        continue;
      }
      if (Array.isArray(entryVal) && spec.type !== 'list') diags.warn('W604', `\`${key}:\` is given more than once; the last one wins.`, e.loc);
      const value = Array.isArray(entryVal) && spec.type === 'list' ? entryVal.map(x => x.value).join(' ') : e.value;
      const r = checkValue(spec.type, value, {});
      if (r.error) { diags.error('E112', `\`${key}:\` ${r.error}`, e.loc, r.hint); continue; }
      header[key] = r.value;
      headerLocs[key] = e.loc;
    }
    if (main.includes.length) header.include = main.includes.map(i => canonPath(i.path));
    if (!header.title) diags.error('E112', 'game.story needs a `title:` header field.', { file: entry, line: 2 }, 'Add a line like `title: Lanterns Over the Harbor` right after `SHIORI 1`.');
  }
  for (const [k, spec] of Object.entries(HEADER_FIELDS)) {
    if (header[k] === undefined && spec.default !== undefined) header[k] = checkValue(spec.type, spec.default, {}).value;
  }
  if (header.ai_generated) {
    for (const part of header.ai_generated) {
      if (part === 'none') continue;
      if (part === 'all') continue;
      if (!AI_PARTS.includes(part)) {
        const m = didYouMean(part, AI_PARTS);
        diags.warn('W604', `\`ai_generated:\` does not know \`${part}\`.`, headerLocs.ai_generated, m ? `Did you mean \`${m}\`?` : `Known parts: ${AI_PARTS.join(', ')}, all, none.`);
      }
    }
  }
  if (header.platforms) {
    for (const p of header.platforms) {
      if (!has(PLATFORMS, p)) {
        const m = didYouMean(p, Object.keys(PLATFORMS));
        diags.warn('W604', `\`platforms:\` does not know \`${p}\`.`, headerLocs.platforms, m ? `Did you mean \`${m}\`?` : `Known platforms: ${Object.keys(PLATFORMS).join(', ')}.`);
      }
    }
  }
  const res = /^(\d+)x(\d+)$/.exec(header.resolution || '');
  if (!res) diags.error('E112', '`resolution:` must look like 1920x1080.', headerLocs.resolution);
  header.width = res ? Number(res[1]) : 1920;
  header.height = res ? Number(res[2]) : 1080;

  // ---- scenes ---------------------------------------------------------
  const sceneMap = Object.create(null);
  const sceneOrder = [];
  for (const f of parsed) {
    for (const sc of f.scenes) {
      if (sceneMap[sc.id]) {
        const prev = sceneMap[sc.id];
        diags.error('E105', `Scene \`${sc.id}\` is defined twice (first at ${prev.file}:${prev.loc.line}).`, sc.loc, 'Scene ids must be unique across all files.');
        continue;
      }
      if (sc.id === 'END') { diags.error('E104', '`END` is reserved for `-> END`.', sc.loc); continue; }
      sceneMap[sc.id] = sc;
      sceneOrder.push(sc.id);
    }
  }

  // ---- declarations ---------------------------------------------------
  // Name-keyed tables have no prototype, so ids like `constructor` are
  // ordinary names and never match Object.prototype members.
  const table = () => Object.create(null);
  const decls = { characters: table(), assets: table(), vars: table(), positions: table(), endings: table() };
  const endingRefs = [];
  const notes = [];
  const ctx = makeContext({ diags, registry, decls, header, sceneMap, sceneOrder, endingRefs, notes });

  const isDecl = (def, n) => !!(def && (def.decl || (def.declareIf && def.declareIf(n))));
  function declareOne(n, def, file) {
    ctx.loc = n.loc; ctx.file = file;
    const args = def.raw ? null : bindArgs(def, n, ctx);
    if (def.declare) def.declare(n, ctx, args);
  }
  function declarePass(nodes, depth, file) {
    for (const n of nodes) {
      if (n.type === 'cmd') {
        const def = registry.get(n.name);
        if (isDecl(def, n)) {
          if (depth > 0) { diags.error('E305', `\`@${n.name}\` is a declaration and can't go inside a choice or @if block.`, n.loc, 'Move it to the top of the file, before the first scene. Declarations always apply to the whole game.'); continue; }
          declareOne(n, def, file);
        }
      } else if (n.type === 'menu') n.options.forEach(o => declarePass(o.body, depth + 1, file));
      else if (n.type === 'if') { n.branches.forEach(b => declarePass(b.body, depth + 1, file)); if (n.elseBody) declarePass(n.elseBody, depth + 1, file); }
    }
  }
  // Before the first scene only declarations (and author-only commands such
  // as @note) may stand; anything else would silently never run.
  function topLevelPass(nodes, file) {
    for (const n of nodes) {
      if (n.type !== 'cmd') continue;
      const def = registry.get(n.name);
      if (!def) { unknownCommand(n); continue; }
      if (isDecl(def, n)) { declareOne(n, def, file); continue; }
      if (def.topLevel) {
        ctx.loc = n.loc; ctx.file = file; ctx.scene = null;
        const args = def.raw ? null : bindArgs(def, n, ctx);
        if (def.compile && !(args && args.bad)) def.compile(n, ctx, args, null);
        continue;
      }
      diags.error('E103', `\`@${n.name}\` must be inside a scene; only declarations may come before the first \`# scene_id\`.`, n.loc,
        'Move it below the `# scene_id` line of the scene it belongs to, so it runs when that scene plays.');
    }
  }
  function unknownCommand(n) {
    const m = didYouMean(n.name, registry.names());
    const hint = (has(COMMAND_HINTS, n.name) && COMMAND_HINTS[n.name]) || (m ? `Did you mean \`@${m}\`?` : 'Run `shiori docs` for the list of commands.');
    diags.error('E300', `Unknown command \`@${n.name}\`.`, n.loc, hint);
  }
  for (const f of parsed) {
    topLevelPass(f.decls, f.path);
    for (const sc of f.scenes) declarePass(sc.body, 0, f.path);
  }

  // ---- code -----------------------------------------------------------
  const code = [];
  const labels = table();
  const lines = table();
  const jumps = [];
  const emit = (ins) => { code.push(ins); return ins; };
  const L = (loc) => loc ? { file: loc.file, line: loc.line } : undefined;
  const lineCounts = table();
  const choiceCounts = table();

  // Ids depend only on the scene, the text and how many times that same
  // text came before it in the scene, so saves survive edits elsewhere. The
  // occurrence count stays outside the hash ('.' never appears in hash()
  // output), so a repeat can't collide with a line whose text ends in "#2".
  function lineId(scene, text) {
    const key = scene + '\u0000' + text;
    const n = lineCounts[key] = (lineCounts[key] || 0) + 1;
    return scene + ':' + hash(text) + (n > 1 ? '.' + n : '');
  }
  // Choice ids work the same way (they key [once] state and the "already
  // chosen" marks), never the menu's line number or the option's position.
  function choiceId(scene, text) {
    const key = scene + '\u0000' + text;
    const n = choiceCounts[key] = (choiceCounts[key] || 0) + 1;
    return scene + ':c' + hash(text) + (n > 1 ? '.' + n : '');
  }

  function compileBody(nodes, sc, depth) {
    nodes.forEach((n, i) => {
      compileNode(n, sc, depth);
      // An ending that jumps straight back into the story is usually a slip.
      if (n.type === 'cmd' && n.name === 'ending') {
        let j = i + 1;
        while (j < nodes.length && nodes[j].type === 'cmd' && /^(log|note|music|stop|wait|pause|textbox)$/.test(nodes[j].name)) j++;
        const next = nodes[j];
        const target = next && (next.type === 'jump' ? next.target : next.type === 'cmd' && next.name === 'jump' && next.args[0] ? next.args[0].value : null);
        if (target && target !== 'END') diags.warn('W620', `\`@ending\` is followed by \`-> ${target}\`: the ending is recorded and its card shown, then the story goes on.`, n.loc, 'Add `-> END` after it if the game should stop here.');
      }
    });
  }

  function compileSay(n, sc) {
    let who = null, name = null, attrs = null;
    if (n.type === 'say') {
      if (n.speaker) {
        if (decls.characters[n.speaker]) {
          who = n.speaker;
          decls.characters[who].spoke = (decls.characters[who].spoke || 0) + 1;
          attrs = ctx.resolveAttrs(who, n.attrs, n.loc);
        } else {
          const ids = Object.keys(decls.characters);
          const lower = n.speaker.toLowerCase();
          const byId = ids.find(k => k.toLowerCase() === lower);
          const byName = Object.values(decls.characters).find(c => (c.name || '').toLowerCase() === lower);
          const byWord = Object.values(decls.characters).find(c => (c.name || '').toLowerCase().split(/[\s.,'’-]+/).includes(lower));
          let hint;
          if (byId) hint = `Character ids are case-sensitive: write \`${byId}:\`.`;
          else if (byName) hint = `Use the character's id, not their display name: \`${byName.id}:\`.`;
          else if (byWord) hint = `Did you mean \`${byWord.id}\` (${byWord.name})? Dialogue uses the character's id.`;
          else {
            const m = didYouMean(n.speaker, ids);
            hint = m ? `Did you mean \`${m}\`?` : `Declare the character with \`@character ${n.speaker} name="..."\`, write \`"${n.speaker}": ...\` for a one-off speaker, or start the line with \`| \` if it is narration.`;
          }
          diags.error('E114', `Unknown speaker \`${n.speaker}\`.`, n.loc, hint);
          name = n.speaker;
        }
      } else {
        name = n.name;
        if (n.attrs.length) diags.error('E203', 'One-off speakers ("Name": ...) have no sprite, so they take no attributes.', n.loc);
      }
    }
    const tokens = ctx.compileText(n.text, n.loc, n.textCol);
    const id = lineId(sc.id, (who || name || '') + ':' + n.text);
    lines[id] = { file: n.loc.file, line: n.loc.line, scene: sc.id };
    return emit({ op: 'say', who, name, attrs, text: tokens, id, loc: L(n.loc), scene: sc.id, narration: n.type === 'narrate' });
  }

  function compileMenu(n, sc, depth) {
    const ins = emit({ op: 'menu', options: [], next: null, loc: L(n.loc), scene: sc.id });
    if (menuCanBeSkipped(n)) {
      diags.warn('W621', 'Every option in this menu is conditional; if none is available, the menu is skipped (R704).', n.loc, 'Add an option with no condition, e.g. `* Leave. -> next_scene`.');
    }
    const ends = [];
    n.options.forEach((opt, i) => {
      const o = {
        text: ctx.compileText(opt.text, opt.loc, opt.textCol),
        id: choiceId(sc.id, opt.text),
        loc: L(opt.loc),
        pc: -1,
      };
      if (opt.mods.if) o.cond = ctx.compileExpr(opt.mods.if.src, opt.loc, opt.mods.if.col);
      if (opt.mods.require) { o.require = ctx.compileExpr(opt.mods.require.src, opt.loc, opt.mods.require.col); if (opt.mods.require.hint) o.hint = opt.mods.require.hint; }
      if (opt.mods.once) o.once = true;
      ins.options.push(o);
      if (!opt.body.length && opt.target) {
        o.label = opt.target;
        if (opt.target !== 'END') checkJump(opt.target, opt.loc);
        jumps.push({ ins: o, label: opt.target, loc: opt.loc, field: 'pc' });
        return;
      }
      if (!opt.body.length) return; // gather: continue after the menu
      o.pc = code.length;
      compileBody(opt.body, sc, depth + 1);
      if (opt.target) emitJump(opt.target, opt.loc, sc);
      else if (!terminates(opt.body)) ends.push(emit({ op: 'goto', pc: null }));
    });
    ins.next = code.length;
    ends.forEach(g => { g.pc = code.length; });
    if (n.options.every(o => !o.body.length && !o.target)) {
      diags.info('W606', 'None of these choices changes anything (no body, no jump).', n.loc, 'That is fine for flavour choices; VNDB calls them "fake choices".');
    }
  }

  function compileIf(n, sc, depth) {
    const ends = [];
    n.branches.forEach((b, i) => {
      const cond = ctx.compileExpr(b.cond || 'false', b.loc, b.condCol);
      const br = emit({ op: 'branch', cond, else: null, loc: L(b.loc), scene: sc.id });
      compileBody(b.body, sc, depth + 1);
      const more = i < n.branches.length - 1 || n.elseBody;
      if (more && !terminates(b.body)) ends.push(emit({ op: 'goto', pc: null }));
      br.else = code.length;
    });
    if (n.elseBody) compileBody(n.elseBody, sc, depth + 1);
    ends.forEach(g => { g.pc = code.length; });
  }

  function checkJump(target, loc) {
    const r = ctx.checkLabel(target);
    if (!r.error) return true;
    diags.error(r.code, r.error, loc, r.hint);
    return false;
  }

  function emitJump(target, loc, sc, op = 'jump') {
    if (target === 'END') { emit({ op: 'end', loc: L(loc), scene: sc.id }); return; }
    checkJump(target, loc);
    const ins = emit({ op, label: target, pc: null, loc: L(loc), scene: sc.id });
    jumps.push({ ins, label: target, loc, field: 'pc' });
  }
  ctx.emitJump = emitJump;

  function compileNode(n, sc, depth) {
    ctx.loc = n.loc;
    switch (n.type) {
      case 'say': case 'narrate': compileSay(n, sc); return;
      case 'jump': emitJump(n.target, n.loc, sc); return;
      case 'menu': compileMenu(n, sc, depth); return;
      case 'if': compileIf(n, sc, depth); return;
      case 'cmd': {
        const def = registry.get(n.name);
        if (!def) { unknownCommand(n); return; }
        if (def.decl) return;
        const args = def.raw ? null : bindArgs(def, n, ctx);
        if (args && args.bad) return;
        const out = def.compile ? def.compile(n, ctx, args, sc) : { op: 'cmd', name: def.name, args: { ...args.pos, ...args.named } };
        const list = Array.isArray(out) ? out : out ? [out] : [];
        for (const ins of list) {
          if (!ins) continue;
          ins.loc = ins.loc || L(n.loc);
          ins.scene = sc.id;
          if (ins.op === 'cmd' && !ins.name) ins.name = def.name;
          emit(ins);
          if (ins.label && (ins.op === 'jump' || ins.op === 'call')) {
            checkJump(ins.label, n.loc);
            jumps.push({ ins, label: ins.label, loc: n.loc, field: 'pc' });
          }
        }
        return;
      }
    }
  }

  const fileEnds = table();
  for (const f of parsed) {
    if (!f.scenes.length) continue;
    for (const sc of f.scenes) {
      if (sceneMap[sc.id] !== sc) continue;
      ctx.scene = sc.id;
      ctx.file = f.path;
      labels[sc.id] = code.length;
      emit({ op: 'scene', id: sc.id, title: sc.title, loc: L(sc.loc), scene: sc.id });
      compileBody(sc.body, sc, 0);
    }
    const last = f.scenes[f.scenes.length - 1];
    if (!terminates(last.body)) {
      diags.warn('W603', `Scene \`${last.id}\` is the last in ${f.path} and does not end with a jump, so the game ends there.`, last.loc,
        'End it with `-> next_scene`, or with `-> END` if the game is meant to end here.');
    }
    fileEnds[f.path] = code.length;
    emit({ op: 'end', implicit: true, loc: { file: f.path, line: last.loc.line }, scene: last.id });
  }

  for (const j of jumps) {
    if (j.label === 'END') { j.ins[j.field] = 'END'; continue; }
    const pc = labels[j.label];
    j.ins[j.field] = pc == null ? null : pc;
  }

  // ---- references that needed everything ----------------------------
  for (const r of endingRefs) {
    if (!decls.endings[r.id]) {
      const m = didYouMean(r.id, Object.keys(decls.endings));
      diags.error('E207', `Unknown ending \`${r.id}\`.`, r.loc, m ? `Did you mean \`${m}\`?` : 'Endings are created by `@ending id "Title"` lines.');
    }
  }

  let start = header.start;
  if (start && !sceneMap[start]) {
    const m = didYouMean(start, sceneOrder);
    diags.error('E200', `\`start:\` names an unknown scene \`${start}\`.`, headerLocs.start, m ? `Did you mean \`${m}\`?` : undefined);
    start = null;
  }
  if (!start) {
    const firstMain = main && main.scenes[0];
    start = firstMain ? firstMain.id : sceneOrder[0];
  }
  if (!start && !diags.hasErrors()) diags.error('E104', 'The game has no scenes. Add one with `# scene_id`.', { file: entry, line: 1 });

  // ---- title screen assets (count as uses when the kind is right) -----
  const TITLE_KINDS = { title_background: ['image', 'world'], title_music: ['audio'] };
  for (const [k, kinds] of Object.entries(TITLE_KINDS)) {
    if (!header[k]) continue;
    const id = header[k];
    const r = ctx.checkAsset(id, kinds);
    if (!r.error) continue;
    const need = kinds.map(x => article(x) + ' ' + x).join(' or ');
    if (r.code === 'E205') {
      const got = has(decls.assets, id) ? decls.assets[id].kind : 'character';
      diags.error('E205', `\`${k}:\` needs ${need}, but \`${id}\` is ${article(got)} ${got}.`, headerLocs[k]);
    } else diags.error('E202', `\`${k}:\` names an unknown ${kinds.join(' or ')} \`${id}\`.`, headerLocs[k], r.hint);
  }

  // ---- unused declarations -------------------------------------------
  for (const c of Object.values(decls.characters)) {
    if (!c.spoke && !c.shown) diags.warn('W601', `Character \`${c.id}\` is declared but never speaks or appears.`, c.loc);
  }
  for (const a of Object.values(decls.assets)) {
    if (!a.used && !a.opts.unused_ok) {
      diags.warn('W601', `${cap(a.kind)} \`${a.id}\` is declared but never used.`, a.loc);
    }
  }
  for (const v of Object.values(decls.vars)) {
    if (!v.read && v.written) diags.warn('W612', `Variable \`${v.name}\` is set but never read, so it can't affect the story.`, v.loc, 'Read it in an `@if`, a `[if ...]` choice, or `{$name}` in text — or remove it.');
    else if (!v.read && !v.written) diags.warn('W601', `Variable \`${v.name}\` is declared but never used.`, v.loc);
  }

  // ---- files that exist but were never included ----------------------
  if (sources.listing) {
    const loaded = new Set(sources.order.map(canonPath));
    for (const raw of sources.listing) {
      const p = canonPath(raw);
      if (p.endsWith('.story') && !loaded.has(p) && !p.startsWith('tests/')) {
        diags.warn('W605', `\`${p}\` is in the game folder but not listed in \`include:\`, so it is ignored.`, { file: entry, line: 1 }, `Add \`include: ${p}\` to the header of game.story.`);
      }
    }
  }

  const program = {
    format: 'shiori-program', version: 1,
    hash: hash(sources.order.map(p => p + '\n' + sources.files[p]).join('\n\u0000')),
    header, start, code, labels,
    scenes: Object.assign(table(), Object.fromEntries(sceneOrder.map(id => [id, { id, title: sceneMap[id].title, file: sceneMap[id].file, line: sceneMap[id].loc.line, pc: labels[id], args: sceneMap[id].args }]))),
    sceneOrder, decls, lines, files: sources.order.slice(),
    notes,
  };
  return { program, diagnostics: diags.sorted(), parsed };
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Can every option of this menu be unavailable (hidden by [if], locked by
// [require], or used up by [once])? Then the VM skips the menu (R704).
export function menuCanBeSkipped(menu) {
  return menu.options.every(o => o.mods.if || o.mods.require || o.mods.once);
}

// Does this block always leave (jump/end) instead of continuing? A menu
// leaves only if it can't be skipped and every option leaves.
export function terminates(nodes) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.type === 'jump') return true;
    if (n.type === 'cmd' && (n.name === 'jump' || n.name === 'return')) return true;
    if (n.type === 'menu') return !menuCanBeSkipped(n) && n.options.every(o => o.target || terminates(o.body));
    if (n.type === 'if') return !!n.elseBody && terminates(n.elseBody) && n.branches.every(b => terminates(b.body));
    if (n.type === 'cmd' && /^(ending|log|note|character|image|audio|world|model|gameplay|var|persistent|position)$/.test(n.name)) continue;
    if (n.type === 'cmd' && n.name === 'video' && n.args.filter(a => !a.key).length >= 2) continue;
    return false;
  }
  return false;
}

// Example calls for hints when a function is used like a variable.
const CALL_EXAMPLES = {
  visited: 'visited("scene_id") > 0', ending_seen: 'ending_seen("ending_id")', endings_seen: 'endings_seen() >= 2',
  random: 'random(1, 6)', chance: 'chance(0.5)', count: 'count(clue_a, clue_b) >= 2', min: 'min(a, b)', max: 'max(a, b)',
  clamp: 'clamp(x, 0, 10)', abs: 'abs(x)', floor: 'floor(x)', ceil: 'ceil(x)', round: 'round(x)',
  len: 'len(name)', upper: 'upper(name)', lower: 'lower(name)',
};
const KEYWORDS = ['true', 'false', 'and', 'or', 'not'];

function makeContext({ diags, registry, decls, header, sceneMap, sceneOrder, endingRefs, notes }) {
  const kindsOf = (kinds) => kinds && kinds.length ? kinds : null;
  const ctx = {
    diags, registry, decls, header, scene: null, file: null, loc: null,
    get positions() { return decls.positions; },

    // Jump targets (`-> x`, choice targets, @jump/@call): a scene or END.
    checkLabel(s) {
      if (s === 'END') return { value: s };
      if (sceneMap[s]) return { value: s };
      if (String(s).toUpperCase() === 'END') {
        return { error: `Unknown scene \`${s}\`.`, code: 'E200', hint: '`END` is written in capitals: `-> END` ends the game.' };
      }
      const m = didYouMean(s, sceneOrder);
      return { error: `Unknown scene \`${s}\`.`, code: 'E200', hint: m ? `Did you mean \`${m}\`?` : 'Scenes are declared with `# scene_id` lines.' };
    },

    checkAsset(s, kinds, info = {}) {
      kinds = kindsOf(kinds);
      // Declared ids come first, so an image called `orange` is never read
      // as the color orange. (black and white are reserved ids.)
      const a = decls.assets[s];
      const c = decls.characters[s];
      if (a && (!kinds || kinds.includes(a.kind))) { a.used = (a.used || 0) + 1; if (info.as) (a.usedAs = a.usedAs || {})[info.as] = true; return { value: s, kind: a.kind }; }
      // No kind list means "any asset or character" (they share one namespace).
      if (c && (!kinds || kinds.includes('character'))) { c.shown = (c.shown || 0) + 1; return { value: s, kind: 'character' }; }
      if (kinds && kinds.includes('color') && (isColor(s))) return { value: s, kind: 'color' };
      if (kinds && kinds.includes('none') && s === 'none') return { value: null, kind: 'none' };
      if (kinds && kinds.includes('all') && s === 'all') return { value: 'all', kind: 'all' };
      if (kinds && kinds.includes('stop') && s === 'stop') return { value: 'stop', kind: 'stop' };
      const want = kinds ? kinds.filter(k => !['color', 'none', 'all', 'stop'].includes(k)) : null;
      if (a || c) {
        const kind = a ? a.kind : 'character';
        const need = want && want.length ? want.map(k => article(k) + ' ' + k).join(' or ') : 'something else';
        return { code: 'E205', error: `\`${s}\` is ${article(kind)} ${kind}, but this needs ${need}.` };
      }
      const pool = Object.values(decls.assets).filter(x => !want || want.includes(x.kind)).map(x => x.id)
        .concat(want && want.includes('character') ? Object.keys(decls.characters) : []);
      const m = didYouMean(s, pool);
      const k0 = want && want.length ? want[0] : 'image';
      const declHint = k0 === 'character' ? `@character ${s} name="..."` : `@${k0 === 'gameplay' ? 'gameplay' : k0} ${s} path/to/file`;
      return { code: 'E202', error: `Unknown ${want && want.length ? want.join(' or ') : 'asset'} \`${s}\`.`, hint: m ? `Did you mean \`${m}\`?` : `Declare it first: \`${declHint}\`.` };
    },

    // A name that isn't a 2D position must be a mark in some 3D world.
    checkMark(s) {
      const worlds = Object.values(decls.assets).filter(a => a.kind === 'world');
      const marks = new Set();
      let open = false;
      for (const w of worlds) { if (w.opts.marks && w.opts.marks.length) w.opts.marks.forEach(m => marks.add(m)); else open = true; }
      if (marks.has(s)) return { value: s, mark: true };
      const near = didYouMean(s, Object.keys(POSITIONS).concat(Object.keys(decls.positions), [...marks]));
      if (open && !near) return { value: s, mark: true };
      if (!worlds.length) {
        return { error: `\`${s}\` is not a position.`, hint: near ? `Did you mean \`${near}\`?` : 'Use left, center, right, farleft, farright, midleft, midright, a number from 0 (left edge) to 1 (right edge), or a name declared with @position.' };
      }
      return { error: `\`${s}\` is not a position or a mark in any 3D world.`, hint: near ? `Did you mean \`${near}\`?` : 'List 3D marks with `marks="..."` on the @world declaration.' };
    },

    checkCharacter(s) {
      if (decls.characters[s]) { decls.characters[s].shown = (decls.characters[s].shown || 0) + 1; return { value: s }; }
      const m = didYouMean(s, Object.keys(decls.characters));
      return { code: 'E202', error: `Unknown character \`${s}\`.`, hint: m ? `Did you mean \`${m}\`?` : `Declare it: \`@character ${s} name="..."\`.` };
    },

    checkVar(s) {
      if (decls.vars[s]) return { value: s };
      const m = didYouMean(s, Object.keys(decls.vars));
      return { code: 'E201', error: `Unknown variable \`${s}\`.`, hint: m ? `Did you mean \`${m}\`?` : `Declare it first: \`@var ${s} = 0\`.` };
    },

    compileExpr(src, loc, col) {
      let ast;
      try { ast = parseExpr(src); }
      catch (e) {
        if (e instanceof ExprError) { diags.error(e.code, e.message, { ...loc, col: (col || loc.col) + (e.pos || 0) }, e.hint); return null; }
        throw e;
      }
      ctx.checkRefs(ast, loc, col);
      return ast;
    },

    checkRefs(ast, loc, col) {
      const refs = collectRefs(ast);
      // A bare name passed where a quoted scene or ending id belongs
      // (`ending_seen(true_end)`) is reported once, by the call check below.
      const idArgs = new Set();
      for (const c of refs.calls) {
        const f = has(FUNCTIONS, c.name) ? FUNCTIONS[c.name] : null;
        if (f) f.args.forEach((kind, i) => { const a = c.args[i]; if (a && a.t === 'var' && (kind === 'label' || kind === 'ending')) idArgs.add(a); });
      }
      for (const v of refs.vars) {
        const d = decls.vars[v.name];
        if (d) { d.read = true; continue; }
        if (idArgs.has(v)) continue;
        const at = { ...loc, col: (col || loc.col) + v.pos };
        if (has(FUNCTIONS, v.name)) {
          diags.error('E201', `\`${v.name}\` is a function, not a variable.`, at, `Call it with parentheses: \`${CALL_EXAMPLES[v.name] || v.name + '(...)'}\`.`);
          continue;
        }
        if (KEYWORDS.includes(v.name.toLowerCase())) {
          diags.error('E201', `\`${v.name}\` is not a variable.`, at, `Write \`${v.name.toLowerCase()}\` in lowercase.`);
          continue;
        }
        if (sceneMap[v.name]) { diags.error('E201', `\`${v.name}\` is a scene, not a variable.`, at, `To test whether the player has been there, write \`visited("${v.name}") > 0\`.`); continue; }
        const m = didYouMean(v.name, Object.keys(decls.vars));
        diags.error('E201', `Unknown variable \`${v.name}\`.`, at, m ? `Did you mean \`${m}\`?` : `Declare it first: \`@var ${v.name} = 0\`.`);
      }
      for (const c of refs.calls) {
        const f = has(FUNCTIONS, c.name) ? FUNCTIONS[c.name] : null;
        const at = { ...loc, col: (col || loc.col) + c.pos };
        if (!f) {
          const m = didYouMean(c.name, Object.keys(FUNCTIONS));
          diags.error('E206', `Unknown function \`${c.name}()\`.`, at, m ? `Did you mean \`${m}()\`?` : `Functions: ${Object.keys(FUNCTIONS).join(', ')}.`);
          continue;
        }
        const n = c.args.length, need = f.args.length;
        if (f.variadic ? n < 1 : n !== need) {
          diags.error('E400', `\`${c.name}()\` takes ${f.variadic ? 'one or more' : need} argument${need === 1 ? '' : 's'}, not ${n}.`, at);
          continue;
        }
        f.args.forEach((kind, i) => {
          const a = c.args[i];
          if (!a) return;
          if (kind === 'label') {
            if (a.t !== 'str') diags.error('E400', `\`${c.name}()\` needs a scene id in quotes.`, at, `Write \`${c.name}("${a.t === 'var' ? a.name : 'harbor'}")\`.`);
            else if (!sceneMap[a.v]) {
              const m = didYouMean(a.v, Object.keys(sceneMap));
              diags.error('E200', `Unknown scene \`${a.v}\` in \`${c.name}()\`.`, at, m ? `Did you mean \`${m}\`?` : undefined);
            }
          }
          if (kind === 'ending') {
            if (a.t !== 'str') diags.error('E400', `\`${c.name}()\` needs an ending id in quotes.`, at, `Write \`${c.name}("${a.t === 'var' ? a.name : 'ending_id'}")\`.`);
            else endingRefs.push({ id: a.v, loc: at });
          }
        });
      }
    },

    varType(name) { const v = decls.vars[name]; return v ? v.type : null; },

    compileText(text, loc, col) {
      const { tokens, errors } = parseMarkup(text);
      for (const e of errors) diags.error(e.code, e.message, { ...loc, col: (col || loc.col) + (e.col || 0) }, e.hint);
      for (const t of tokens) {
        if (t.t !== 'var') continue;
        const d = decls.vars[t.name];
        if (d) { d.read = true; continue; }
        const m = didYouMean(t.name, Object.keys(decls.vars));
        diags.error('E201', `Unknown variable \`{$${t.name}}\` in text.`, { ...loc, col: (col || loc.col) + (t.col || 0) }, m ? `Did you mean \`{$${m}}\`?` : `Declare it: \`@var ${t.name} = ""\`.`);
      }
      if (text.length > 600) diags.warn('W607', `This line is ${text.length} characters long; it may not fit in the textbox.`, loc, 'Split it into several lines. Each line is one click.');
      return tokens;
    },

    // ['smile', 'arms_crossed'] -> { expression: 'smile', pose: 'arms_crossed' }
    resolveAttrs(charId, list, loc) {
      const ch = decls.characters[charId];
      const out = Object.create(null);
      if (!list || !list.length) return null;
      for (const item of list) {
        const a = typeof item === 'string' ? item : item.value;
        if (typeof item !== 'string' && item.loc) loc = item.loc;
        const group = ch.attrIndex[a];
        if (!group) {
          const all = Object.keys(ch.attrIndex);
          const m = didYouMean(a, all);
          diags.error('E203', all.length ? `\`${charId}\` has no attribute \`${a}\`.` : `\`${charId}\` has no attributes declared, so \`${a}\` can't be used.`, loc,
            m ? `Did you mean \`${m}\`?` : all.length ? `${charId}'s attributes: ${Object.entries(ch.groups).map(([g, v]) => g + ': ' + v.join(' ')).join('; ')}.` : `Add a line like \`expression: neutral smile sad\` under \`@character ${charId}\`.`);
          continue;
        }
        if (out[group] && out[group] !== a) diags.error('E203', `\`${a}\` and \`${out[group]}\` are both ${group}s; pick one.`, loc);
        out[group] = a;
      }
      return out;
    },

    addName(id, loc) {
      const prev = decls.assets[id] || decls.characters[id];
      if (prev) {
        diags.error('E204', `\`${id}\` is already declared (at ${prev.loc.file}:${prev.loc.line}).`, loc, 'Characters and assets share one set of names; pick a different id.');
        return false;
      }
      if (id === 'all' || id === 'none' || id === 'stop' || id === 'cg' || id === 'black' || id === 'white') {
        diags.error('E204', `\`${id}\` is a reserved word and can't be used as a name.`, loc);
        return false;
      }
      return true;
    },

    addAsset(id, kind, path, opts, loc) {
      if (!ctx.addName(id, loc)) return null;
      const a = { id, kind, path, opts: opts || {}, loc, used: 0 };
      decls.assets[id] = a;
      return a;
    },

    addCharacter(c, loc) {
      if (!ctx.addName(c.id, loc)) return null;
      c.loc = loc;
      decls.characters[c.id] = c;
      return c;
    },

    addVar(name, init, persistent, loc) {
      if (decls.vars[name]) {
        diags.error('E204', `Variable \`${name}\` is already declared (at ${decls.vars[name].loc.file}:${decls.vars[name].loc.line}).`, loc);
        return;
      }
      if (has(FUNCTIONS, name)) {
        diags.error('E204', `\`${name}\` is a reserved word: it is a built-in function.`, loc, `Pick another name; call the function as \`${CALL_EXAMPLES[name] || name + '(...)'}\`.`);
        return;
      }
      if (KEYWORDS.includes(name)) {
        diags.error('E204', `\`${name}\` is a reserved word.`, loc, 'Pick another name.');
        return;
      }
      const type = typeof init === 'number' ? 'number' : typeof init === 'boolean' ? 'bool' : 'string';
      decls.vars[name] = { name, init, type, persistent: !!persistent, loc, read: false, written: false };
    },

    // An ending has one title and one kind. Later `@ending id` lines may
    // repeat them or leave them out (a bare `@ending id` refers back), but
    // may not change them: the runtime records the declared ones.
    // given = { title, kind }: which of them this line wrote explicitly.
    defineEnding(id, title, kind, loc, given = { title: !!title, kind: kind != null && kind !== 'normal' }) {
      const prev = decls.endings[id];
      if (!prev) {
        decls.endings[id] = { id, title: given.title ? title : id, kind: given.kind ? kind : 'normal', loc, uses: 1, scene: ctx.scene, titleGiven: !!given.title, kindGiven: !!given.kind };
        return;
      }
      prev.uses++;
      const clash = [];
      if (given.title) {
        if (!prev.titleGiven) { prev.title = title; prev.titleGiven = true; }
        else if (prev.title !== title) clash.push(`the title "${prev.title}"`);
      }
      if (given.kind) {
        if (!prev.kindGiven) { prev.kind = kind; prev.kindGiven = true; }
        else if (prev.kind !== kind) clash.push(`kind=${prev.kind}`);
      }
      if (clash.length) {
        diags.error('E204', `Ending \`${id}\` is already defined with ${clash.join(' and ')} (at ${prev.loc.file}:${prev.loc.line}).`, loc,
          `An ending has one title and one kind. To record the same ending here, write just \`@ending ${id}\`; for a different ending, give it its own id.`);
      }
    },

    // @note text, kept for `shiori stats` (program.notes).
    addNote(text, loc) {
      notes.push({ text, loc: { file: loc.file, line: loc.line }, scene: ctx.scene || null });
    },

    typeOf(ast) { return typeOf(ast, (n) => ctx.varType(n)); },
  };
  return ctx;
}

function article(word) { return /^[aeiou]/i.test(word) ? 'an' : 'a'; }

// Plain text of a compiled line (for tools).
export function lineText(ins, vars) {
  return plainText(ins.text, vars ? (n) => vars[n] : null);
}
