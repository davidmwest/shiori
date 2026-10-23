// Shiori script parser: text -> syntax tree. Line based; blocks by indentation.
// The parser knows only the syntax. Meaning (which names exist, which
// arguments a command takes) is checked by the compiler.

import { Diagnostics } from './diagnostics.js';
import { isLabelId } from './util.js';

// Commands whose argument text is kept raw (an expression or assignment).
export const RAW_COMMANDS = new Set(['if', 'elif', 'else', 'set', 'var', 'persistent', 'assert', 'log']);

const RE_DIALOGUE = /^([A-Za-z_][A-Za-z0-9_]*)(?:\s*\(([^()]*)\))?\s*:(?:\s+(.*)|\s*)$/;
const RE_ADHOC = /^"([^"]+)"(?:\s*\(([^()]*)\))?\s*:(?:\s+(.*)|\s*)$/;
const RE_LOOKS_LIKE_SPEAKER = /^([A-Z][\w'’.-]*(?: [A-Z][\w'’.-]*){1,3})\s*(?:\([^()]*\))?\s*:\s+\S/;
const RE_HEADER = /^([a-z][a-z0-9_]*)\s*:\s*(.*)$/;
const RE_JUMP_TAIL = /\s->\s*([A-Za-z_][A-Za-z0-9_.]*)\s*$/;

function indentWidth(ws) {
  let w = 0;
  for (const c of ws) w += c === '\t' ? 4 : 1;
  return w;
}

// Split command arguments: words, "quoted strings", key=value, key="quoted".
// A ` //` outside quotes starts a comment.
export function tokenizeArgs(s, baseCol, diags, loc) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
    if (i >= s.length) break;
    if (s.startsWith('//', i)) break;
    const start = i;
    let key = null;
    const km = /^([A-Za-z_][A-Za-z0-9_.-]*)=/.exec(s.slice(i));
    if (km) { key = km[1]; i += km[0].length; }
    let value = '', quoted = false;
    if (s[i] === '"' || s[i] === "'") {
      const q = s[i];
      quoted = true;
      i++;
      let closed = false;
      while (i < s.length) {
        if (s[i] === '\\' && i + 1 < s.length) { value += s[i + 1]; i += 2; continue; }
        if (s[i] === q) { closed = true; i++; break; }
        value += s[i++];
      }
      if (!closed) diags.error('E110', 'This quoted string is never closed.', { ...loc, col: baseCol + start + 1 }, `Add a closing ${q}.`);
    } else {
      while (i < s.length && s[i] !== ' ' && s[i] !== '\t') value += s[i++];
    }
    out.push({ key, value, quoted, col: baseCol + start + 1 });
  }
  return out;
}

export function parseFile(path, text, opts = {}) {
  const diags = opts.diags || new Diagnostics();
  const isMain = !!opts.isMain;
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const file = { path, version: null, header: {}, includes: [], decls: [], scenes: [], diags };
  const L = lines.map((raw, idx) => {
    const m = /^([ \t]*)(.*?)\s*$/.exec(raw);
    return { raw: raw.replace(/\s+$/, ''), ws: m[1], text: m[2], indent: indentWidth(m[1]), n: idx + 1 };
  });
  const loc = (ln, col) => ({ file: path, line: ln.n, col: col || (ln.ws.length + 1), src: ln.raw });
  const isSkippable = (ln) => !ln.text || ln.text.startsWith('//');

  let p = 0;
  // Version line
  while (p < L.length && isSkippable(L[p])) p++;
  if (p < L.length && /^SHIORI\b/i.test(L[p].text)) {
    const m = /^SHIORI\s+(\d+)$/.exec(L[p].text);
    if (!m) diags.error('E100', 'The version line must be exactly `SHIORI 1`.', loc(L[p]));
    else {
      file.version = Number(m[1]);
      if (file.version !== 1) diags.error('E100', `This engine reads SHIORI 1 files, not SHIORI ${m[1]}.`, loc(L[p]));
    }
    p++;
  } else if (isMain) {
    diags.error('E100', 'game.story must start with the line `SHIORI 1`.', p < L.length ? loc(L[p]) : { file: path, line: 1 }, 'Add `SHIORI 1` as the first line.');
  } else {
    diags.warn('W609', 'Story files should start with the line `SHIORI 1`.', { file: path, line: 1 });
  }

  // Header (game.story only): key: value lines until the first @ or # line.
  while (p < L.length) {
    const ln = L[p];
    if (isSkippable(ln)) { p++; continue; }
    if (ln.text.startsWith('@') || ln.text.startsWith('#')) break;
    const m = RE_HEADER.exec(ln.text);
    if (!m || ln.indent > 0) {
      if (isMain) diags.error('E112', 'Expected a header field like `title: My Game`, a declaration (`@...`) or a scene (`# id`).', loc(ln));
      else diags.error('E103', 'Story content must be inside a scene. Start one with `# scene_id`.', loc(ln));
      p++;
      continue;
    }
    if (!isMain) {
      diags.error('E112', `Header fields like \`${m[1]}:\` belong in game.story only.`, loc(ln));
      p++;
      continue;
    }
    let value = m[2];
    p++;
    if (!value) {
      // indented continuation block
      const parts = [];
      while (p < L.length && (L[p].indent > 0 || !L[p].text)) {
        if (L[p].text) parts.push(L[p].text);
        else if (parts.length) parts.push('');
        p++;
      }
      value = parts.join('\n').replace(/\n+$/, '').replace(/([^\n])\n(?=[^\n])/g, '$1 ').replace(/\n\n+/g, '\n\n');
    }
    const entry = { value, loc: loc(ln) };
    if (m[1] === 'include') {
      for (const part of value.split(/[\s,]+/).filter(Boolean)) file.includes.push({ path: part, loc: loc(ln) });
    } else if (file.header[m[1]]) {
      const prev = file.header[m[1]];
      file.header[m[1]] = Array.isArray(prev) ? prev.concat(entry) : [prev, entry];
    } else file.header[m[1]] = entry;
  }

  // Body: top-level declarations, then scenes.
  let scene = null;
  const top = [];

  function parseCommand(ln, text, col) {
    const m = /^@([A-Za-z_][A-Za-z0-9_]*)\s*(.*)$/.exec(text);
    if (!m) { diags.error('E111', 'A command is `@name` followed by arguments, e.g. `@show mio smile at=left`.', loc(ln, col)); return null; }
    const name = m[1].toLowerCase();
    const rest = m[2];
    const restCol = col - 1 + text.indexOf(rest, m[1].length + 1);
    const node = { type: 'cmd', name, loc: loc(ln, col), args: [], props: [] };
    if (RAW_COMMANDS.has(name)) {
      let raw = rest;
      // strip trailing comment outside quotes
      const cm = /\s\/\/(?=(?:[^"]*"[^"]*")*[^"]*$)/.exec(raw);
      if (cm) raw = raw.slice(0, cm.index);
      node.raw = raw.trim();
      node.rawCol = restCol + 1;
    } else {
      node.args = tokenizeArgs(rest, restCol, diags, loc(ln));
    }
    return node;
  }

  // Parse the indented lines under `parentIndent` (all deeper than it).
  function parseBlock(minIndent) {
    const nodes = [];
    let blockIndent = null;
    while (p < L.length) {
      const ln = L[p];
      if (isSkippable(ln)) { p++; continue; }
      if (ln.indent < minIndent) break;
      if (ln.text.startsWith('#') && ln.indent === 0 && minIndent === 0 && scene) break; // next scene
      if (blockIndent == null) blockIndent = ln.indent;
      if (ln.indent < blockIndent) {
        diags.error('E101', 'This line is indented less than the lines above it but doesn\'t line up with any outer block.', loc(ln), 'Indent with the same number of spaces as the block it belongs to.');
        blockIndent = ln.indent;
      }
      if (ln.indent > blockIndent) {
        diags.error('E102', 'Unexpected indentation. Only lines under a choice (`* ...`), `@if`/`@elif`/`@else`, or a declaration\'s properties are indented.', loc(ln), 'Remove the extra indentation.');
        // recover: treat as same level
      }
      const node = parseStatement(ln, blockIndent);
      if (node) nodes.push(node);
    }
    return groupMenus(nodes);
  }

  // Lines indented more deeply than `indent` that follow the current line.
  function childIndent(indent) {
    let q = p;
    while (q < L.length && isSkippable(L[q])) q++;
    if (q < L.length && L[q].indent > indent && !(L[q].indent === 0)) return L[q].indent;
    return null;
  }

  function parseProps(node, indent) {
    const ci = childIndent(indent);
    if (ci == null) return;
    while (p < L.length) {
      const ln = L[p];
      if (isSkippable(ln)) { p++; continue; }
      if (ln.indent < ci) break;
      const m = /^([A-Za-z_][A-Za-z0-9_.-]*)\s*:\s*(.*)$/.exec(ln.text);
      if (!m || ln.indent !== ci) {
        diags.error('E102', `Lines indented under \`@${node.name}\` must be properties like \`name: Mio\`.`, loc(ln));
        p++;
        continue;
      }
      let value = m[2];
      let quoted = false;
      const qm = /^"(.*)"$/.exec(value);
      if (qm) { value = qm[1].replace(/\\"/g, '"'); quoted = true; }
      node.props.push({ key: m[1], value, quoted, loc: loc(ln, ln.ws.length + 1) });
      p++;
    }
  }

  function parseStatement(ln, indent) {
    const t = ln.text;
    const col = ln.ws.length + 1;
    p++;
    if (t.startsWith('#')) {
      diags.error('E104', 'Scenes (`# id`) must start at the beginning of a line, not inside a block.', loc(ln));
      return null;
    }
    if (t.startsWith('@')) {
      const node = parseCommand(ln, t, col);
      if (!node) return null;
      if (node.name === 'end' || node.name === 'endif' || node.name === 'endchoice' || node.name === 'endmenu') {
        diags.warn('W615', `\`@${node.name}\` isn't needed: in Shiori a block ends where its indentation ends.`, loc(ln), 'Delete this line, and make sure the block\'s lines are indented under it.');
        return null;
      }
      if (node.name === 'if' || node.name === 'elif' || node.name === 'else') {
        const ci = childIndent(indent);
        node.body = ci == null ? [] : parseBlock(ci);
        if (ci == null) diags.error('E108', `\`@${node.name}\` needs an indented block of lines under it.`, loc(ln), 'Indent the lines that belong to this branch by two spaces.');
        return node;
      }
      parseProps(node, indent);
      return node;
    }
    if (t.startsWith('->')) {
      const target = t.slice(2).trim();
      if (!target || !(isLabelId(target) || target === 'END')) {
        diags.error('E106', 'A jump is `-> scene_id` (or `-> END`).', loc(ln));
        return null;
      }
      return { type: 'jump', target, loc: loc(ln, col) };
    }
    if (t.startsWith('*')) {
      return parseChoice(ln, indent);
    }
    if (t.startsWith('|')) {
      const text = t.slice(1).replace(/^ /, '');
      return { type: 'narrate', text, loc: loc(ln, col + 1 + (t[1] === ' ' ? 1 : 0)) };
    }
    let m = RE_ADHOC.exec(t);
    if (m) {
      if (!m[3]) { diags.error('E107', 'This dialogue line has no text after the colon.', loc(ln)); return null; }
      // "Keep it": that's all he ever says.  <- a quotation, not a speaker
      if (/^[a-z]/.test(m[3]) && (/\s[a-z]/.test(' ' + m[1].replace(/\b(of|the|and|de|no|von|van)\b/g, '')) || /[.!?,…]$/.test(m[1]))) {
        diags.warn('W608', `\`"${m[1]}"\` will be shown as a speaker's name.`, loc(ln), 'If this is narration that starts with a quotation, begin the line with `| `.');
      }
      return { type: 'say', speaker: null, name: m[1], attrs: splitAttrs(m[2]), text: m[3], loc: loc(ln, col), textCol: col + t.indexOf(m[3]) };
    }
    m = RE_DIALOGUE.exec(t);
    if (m) {
      if (!m[3]) {
        diags.error('E107', 'This dialogue line has no text after the colon.', loc(ln), 'Write the line on the same line: `mio: Hello.`');
        return null;
      }
      return { type: 'say', speaker: m[1], attrs: splitAttrs(m[2]), text: m[3], loc: loc(ln, col), textCol: col + t.indexOf(m[3], m[1].length) };
    }
    if (RE_LOOKS_LIKE_SPEAKER.test(t)) {
      const who = RE_LOOKS_LIKE_SPEAKER.exec(t)[1];
      diags.warn('W608', `This looks like dialogue from "${who}", but it will be shown as narration.`, loc(ln),
        `For a one-off speaker write \`"${who}": ...\`; for a recurring one declare \`@character\`. If it really is narration, start the line with \`| \`.`);
    }
    return { type: 'narrate', text: t, loc: loc(ln, col), textCol: col };
  }

  function parseChoice(ln, indent) {
    const t = ln.text;
    const col = ln.ws.length + 1;
    let s = t.slice(1);
    if (s && s[0] !== ' ' && s[0] !== '[') {
      diags.error('E107', 'A choice is `* text` (a star, then a space).', loc(ln));
    }
    s = s.trim();
    const mods = {};
    let offset = t.indexOf(s);
    while (s.startsWith('[')) {
      const close = s.indexOf(']');
      if (close < 0) { diags.error('E107', 'This `[` is never closed with `]`.', loc(ln, col + offset)); break; }
      const inner = s.slice(1, close).trim();
      const mm = /^(if|require|once)\b\s*(.*)$/.exec(inner);
      if (!mm) {
        diags.error('E107', `Unknown choice option \`[${inner}]\`. Use \`[if condition]\`, \`[require condition]\` or \`[once]\`.`, loc(ln, col + offset));
      } else if (mm[1] === 'once') {
        if (mm[2]) diags.error('E107', '`[once]` takes no condition.', loc(ln, col + offset));
        mods.once = true;
      } else {
        if (!mm[2]) diags.error('E107', `\`[${mm[1]}]\` needs a condition, e.g. \`[${mm[1]} trust >= 2]\`.`, loc(ln, col + offset));
        let src = mm[2], hint = null;
        const hm = mm[1] === 'require' ? /^(.*?)\s+"([^"]*)"\s*$/.exec(src) : null;
        if (hm) { src = hm[1]; hint = hm[2]; }
        mods[mm[1]] = { src, hint, col: col + offset + 1 + inner.indexOf(mm[2]) + 1 };
      }
      const after = s.slice(close + 1);
      offset += close + 1 + (after.length - after.trimStart().length);
      s = after.trim();
    }
    let target = null;
    const jm = RE_JUMP_TAIL.exec(' ' + s);
    if (jm) { target = jm[1]; s = (' ' + s).slice(0, jm.index).trim(); }
    else if (/->\s*$/.test(s)) diags.error('E106', 'This choice ends with `->` but no scene id.', loc(ln));
    if (!s) diags.warn('W613', 'This choice has no text.', loc(ln));
    const node = { type: 'option', mods, text: s, target, loc: loc(ln, col), textCol: col + offset, body: [] };
    const ci = childIndent(indent);
    if (ci != null) node.body = parseBlock(ci);
    return node;
  }

  function splitAttrs(s) {
    if (!s) return [];
    return s.split(/[\s,]+/).filter(Boolean);
  }

  // Turn consecutive options into menus and @if/@elif/@else into chains.
  function groupMenus(nodes) {
    const out = [];
    for (const n of nodes) {
      const last = out[out.length - 1];
      if (n.type === 'option') {
        if (last && last.type === 'menu' && !last.closed) last.options.push(n);
        else out.push({ type: 'menu', options: [n], loc: n.loc });
        continue;
      }
      if (last && last.type === 'menu') last.closed = true;
      if (n.type === 'cmd' && (n.name === 'elif' || n.name === 'else')) {
        if (!last || last.type !== 'if' || last.hasElse) {
          diags.error('E109', `\`@${n.name}\` must directly follow an \`@if\` or \`@elif\` block at the same indentation.`, n.loc);
          continue;
        }
        if (n.name === 'else') {
          if (n.raw) diags.error('E109', '`@else` takes no condition. Use `@elif condition`.', n.loc);
          last.elseBody = n.body;
          last.hasElse = true;
        } else {
          if (!n.raw) diags.error('E400', '`@elif` needs a condition.', n.loc);
          last.branches.push({ cond: n.raw, condCol: n.rawCol, body: n.body, loc: n.loc });
        }
        continue;
      }
      if (n.type === 'cmd' && n.name === 'if') {
        if (!n.raw) diags.error('E400', '`@if` needs a condition, e.g. `@if trust >= 2`.', n.loc);
        out.push({ type: 'if', branches: [{ cond: n.raw, condCol: n.rawCol, body: n.body, loc: n.loc }], elseBody: null, loc: n.loc });
        continue;
      }
      out.push(n);
    }
    for (const n of out) if (n.type === 'menu') delete n.closed;
    return out;
  }

  while (p < L.length) {
    const ln = L[p];
    if (isSkippable(ln)) { p++; continue; }
    if (ln.text.startsWith('#') && ln.indent === 0) {
      const m = /^#\s*([^\s"]+)\s*(.*)$/.exec(ln.text);
      p++;
      if (!m || !isLabelId(m[1]) || ln.text.startsWith('##')) {
        diags.error('E104', 'A scene starts with `# scene_id`, optionally followed by a title in quotes: `# harbor "The Harbor"`.', loc(ln),
          'Scene ids use letters, digits, `_` and `.`, and start with a letter.');
        continue;
      }
      const args = tokenizeArgs(m[2], ln.text.indexOf(m[2]), diags, loc(ln));
      let title = null;
      const named = {};
      for (const a of args) {
        if (a.key) named[a.key] = a.value;
        else if (title == null && a.quoted) title = a.value;
        else diags.error('E104', `Unexpected \`${a.value}\` after the scene id. Put the title in quotes.`, loc(ln, a.col));
      }
      scene = { id: m[1], title, args: named, loc: loc(ln, 1), file: path, body: [] };
      file.scenes.push(scene);
      scene.body = parseBlock(0);
      continue;
    }
    if (ln.indent > 0) {
      diags.error('E102', 'Unexpected indentation before the first scene.', loc(ln));
      p++;
      continue;
    }
    if (ln.text.startsWith('@')) {
      p++;
      const node = parseCommand(ln, ln.text, 1);
      if (node) {
        if (node.name === 'if' || node.name === 'elif' || node.name === 'else') {
          diags.error('E103', `\`@${node.name}\` must be inside a scene.`, node.loc);
          const ci = childIndent(0);
          if (ci != null) parseBlock(ci);
        } else {
          parseProps(node, 0);
          top.push(node);
        }
      }
      continue;
    }
    diags.error('E103', 'Story content must be inside a scene. Start one with `# scene_id`.', loc(ln));
    p++;
  }
  file.decls = top;
  return file;
}
