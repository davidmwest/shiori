// Shiori script parser: text -> syntax tree. Line based; blocks by indentation.
// The parser knows only the syntax. Meaning (which names exist, which
// arguments a command takes) is checked by the compiler.

import { Diagnostics } from './diagnostics.js';
import { isLabelId } from './util.js';
import { HEADER_FIELDS } from './header.js';
import { parseExpr, ExprError } from './expr.js';

// Commands whose argument text is kept raw (an expression or assignment).
export const RAW_COMMANDS = new Set(['if', 'elif', 'else', 'set', 'var', 'persistent', 'assert', 'log']);
// Raw commands whose text is an expression: strings in it may use ' or ".
const EXPR_COMMANDS = new Set(['if', 'elif', 'else', 'set', 'var', 'persistent', 'assert']);

// Declarations that take an indented block of `key: value` properties
// (spec 2.9). Under any other command, deeper lines are not swallowed: they
// get E102 and are still parsed as statements, so no dialogue is lost.
// `opts.registry` adds module commands that set `props: true`.
const PROP_COMMANDS = new Map([
  ['character', true], ['image', true], ['audio', true], ['world', true],
  ['model', true], ['gameplay', true], ['position', true],
  ['video', (node) => node.args.filter(a => !a.key).length >= 2], // `@video id path` declares
]);

const RE_DIALOGUE = /^([A-Za-z_][A-Za-z0-9_]*)(?:\s*\(([^()]*)\))?\s*:(?:\s+(.*)|\s*)$/;
const RE_ADHOC = /^"([^"]+)"(?:\s*\(([^()]*)\))?\s*:(?:\s+(.*)|\s*)$/;
// One word that can't be an id (`Élodie: ...`, `O'Brien: ...`, `ミオ: ...`).
const RE_WORD_SPEAKER = /^([\p{L}\p{M}][\p{L}\p{M}\p{N}_'’-]*)(?:\s*\(([^()]*)\))?\s*:\s+(\S.*)$/u;
// Scripts written without spaces: a "word" there may be half a sentence.
const RE_UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;
const RE_LOOKS_LIKE_SPEAKER = /^(\p{Lu}[\p{L}\p{M}\p{N}_'’.-]*(?: \p{Lu}[\p{L}\p{M}\p{N}_'’.-]*){1,3})\s*(?:\([^()]*\))?\s*[:：]\s*\S/u;
const RE_HEADER = /^([a-z][a-z0-9_]*)\s*:\s*(.*)$/;
const RE_JUMP_TAIL = /\s->\s*([A-Za-z_][A-Za-z0-9_.]*)\s*$/;
// Spaces that look like indentation but are not (no-break, full-width, ...).
const RE_ODD_SPACE = /^[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]+/;
// After odd spaces, the start of a line that parseStatement reports as E101.
const RE_ODD_STATEMENT = /^(@|->|\*|#|\|)/;
// A speaker-like word: letters first, then letters, digits, _ ' ’ -.
const SPEAKER_WORD = "[\\p{L}_][\\p{L}\\p{M}\\p{N}_'\u2019-]*";
// `word:text` with no space after the colon. Not before /, \, a digit or a
// second colon (`http://`, `C:\`, `C:/`, `10:30`, `std::`).
const RE_NO_SPACE_COLON = new RegExp(`^(${SPEAKER_WORD})((?:\\s*\\([^()]*\\))?)\\s*:(?![\\/\\\\\\d:])(\\S.*)$`, 'u');
// Ren'Py dialogue: `word "text"`.
const RE_RENPY = new RegExp(`^(${SPEAKER_WORD})\\s+"(.*)"$`, 'u');
// A name written only in kana (ミオ, みお): before `：` it is taken for a speaker
// even when undeclared. A kanji word (時刻：) may be a label, so it must be declared.
const RE_KANA_NAME = /^(?=.*[\p{Script=Hiragana}\p{Script=Katakana}])[\p{Script=Hiragana}\p{Script=Katakana}\u30FC\u30FB]+$/u;
const isLowerId = (w) => w.length >= 2 && /^[a-z_][a-z0-9_]*$/.test(w);
// Commands kept from the lines under a bad scene heading (see the E104 below)
// when no registry is given: the declarations and `@note`.
const DECL_COMMANDS = new Set(['character', 'image', 'audio', 'world', 'model', 'gameplay', 'position', 'var', 'persistent', 'note']);

// Does src parse as an expression? The compiler reports the error if not.
function parses(src) {
  try { parseExpr(src); return true; } catch (e) { if (e instanceof ExprError) return false; throw e; }
}

// Where a "double-quoted string" that ends src starts, or -1. Strings are
// found as in expressions (' or ", backslash escapes), so `\"` doesn't end
// one and a quote inside the other kind is plain text. The string must
// follow a space: `x "hint"`, not `x"hint"`.
export function trailingStringAt(src) {
  let q = null, start = -1, last = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '\\') i++;
      else if (c === q) { if (q === '"') last = { start, end: i + 1 }; q = null; }
      continue;
    }
    if (c === '"' || c === "'") { q = c; start = i; }
  }
  if (q || !last || last.end !== src.length || last.start === 0 || !/\s/.test(src[last.start - 1])) return -1;
  return last.start;
}

// The `]` that closes the `[` at s[0]: the first one outside quotes (a lock
// hint may hold one: `[require key "Find the [key]"]`), else the first one.
function closeBracketAt(s) {
  let q = null;
  for (let i = 1; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === ']') return i;
  }
  return s.indexOf(']');
}

// Where a ` // comment` starts in @log text, or -1. The text is free, so an
// apostrophe is not a quote; a "..." pair hides a `//`, a lone " does not.
function logCommentAt(s) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') {
      const close = s.indexOf('"', i + 1);
      if (close > 0) i = close;
    } else if (s[i] === '/' && s[i + 1] === '/' && (i === 0 || s[i - 1] === ' ' || s[i - 1] === '\t')) return i;
  }
  return -1;
}

// Does this node always leave its block (a jump, `@return`, or a menu or
// `@if` whose every path leaves)? The same test as leaves() in compiler.js.
function alwaysLeaves(n) {
  if (n.type === 'jump') return true;
  if (n.type === 'cmd') return n.name === 'return' || (n.name === 'jump' && n.args.length > 0);
  if (n.type === 'menu') return !n.options.every(o => o.mods.if || o.mods.require || o.mods.once) && n.options.every(o => o.target || o.body.some(alwaysLeaves));
  if (n.type === 'if') return !!n.elseBody && n.elseBody.some(alwaysLeaves) && n.branches.every(b => b.body.some(alwaysLeaves));
  return false;
}

// Heading words people write instead of a command on the next line.
const HEADING_KEY_COMMANDS = {
  bg: 'scene', background: 'scene', scene: 'scene', image: 'scene', world: 'scene',
  music: 'music', bgm: 'music', ambience: 'ambience', ambient: 'ambience',
  sound: 'sound', sfx: 'sound', chapter: 'chapter', mode: 'mode', weather: 'weather',
};

function indentWidth(ws) {
  let w = 0;
  for (const c of ws) w += c === '\t' ? 4 : 1;
  return w;
}

// Normalise an include path: drop `.` segments and fold `dir/..`, so that
// `./story/ch1.story` and `story/ch1.story` name the same file. A `..` that
// climbs out of the game folder is kept. Absolute paths and URLs are left alone.
function normalizePath(path) {
  if (path.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  const out = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..' && out.length && out[out.length - 1] !== '..') out.pop();
    else out.push(seg);
  }
  return out.length ? out.join('/') : path;
}

// Where a trailing ` // comment` starts in an expression, or -1. Strings use
// ' or " with backslash escapes, as in expr.js.
function exprCommentAt(s) {
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '/' && s[i + 1] === '/' && (i === 0 || s[i - 1] === ' ' || s[i - 1] === '\t')) return i;
  }
  return -1;
}

// Inside quotes a backslash escapes only \\, \" and \', as in expressions
// (expr.js). Anything else (\n, \t, a \u code) is E110: dropping the backslash
// would silently change the text.
const ARG_ESCAPES = ['\\', '"', "'"];
function argEscapeHint(e, what) {
  const hint = what === 'lock hint';
  if ((e === 'n' || e === 'r') && hint) return `A lock hint is one line of text: remove the \`\\${e}\`.`;
  if (e === 'n' || e === 'r') return `A quoted ${what} cannot hold a line break. For a break in dialogue or narration, put \`{br}\` in the text line instead.`;
  if (e === 'u' || e === 'x') return 'Type the character itself, e.g. `—` rather than `\\u2014`.';
  if (hint) return 'Only `\\"`, `\\\'` and `\\\\` are escapes. Write `\\\\` for a backslash.';
  return 'Only `\\"`, `\\\'` and `\\\\` are escapes. Write `\\\\` for a backslash, and `/` between the folders of a path.';
}

// Read quoted text from s[i] on (just after the opening quote) until
// isClose(i) says s[i] is the closing quote. Escapes follow ARG_ESCAPES; any
// other `\x` is E110 with the caret on the backslash, and stays as typed.
// `col0` is the 0-based column of s[0] in its line; `what` names the thing
// in messages ("argument", "property value").
// Returns { value, end (index after the closing quote), closed }.
function readQuoted(s, i, isClose, col0, diags, loc, what) {
  let value = '';
  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const e = s[i + 1];
      if (ARG_ESCAPES.includes(e)) value += e;
      else {
        diags.error('E110', `Unknown escape \`\\${e}\` in a quoted ${what}.`, { ...loc, col: col0 + i + 1 }, argEscapeHint(e, what));
        value += '\\' + e;
      }
      i += 2;
      continue;
    }
    if (isClose(i)) return { value, end: i + 1, closed: true };
    value += s[i++];
  }
  return { value, end: i, closed: false };
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
      const r = readQuoted(s, i + 1, (j) => s[j] === q, baseCol, diags, loc, 'argument');
      value = r.value;
      i = r.end;
      if (!r.closed) diags.error('E110', 'This quoted string is never closed.', { ...loc, col: baseCol + start + 1 }, `Add a closing ${q}.`);
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
  const registry = opts.registry && typeof opts.registry.get === 'function' ? opts.registry : null;
  // A UTF-8 byte order mark is not part of the text (browsers drop it too).
  const lines = (text == null ? '' : String(text)).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const file = { path, version: null, header: {}, includes: [], decls: [], scenes: [], orphans: [], diags };
  const L = lines.map((raw, idx) => {
    const m = /^([ \t]*)(.*?)\s*$/.exec(raw);
    return { raw: raw.replace(/\s+$/, ''), ws: m[1], text: m[2], indent: indentWidth(m[1]), n: idx + 1 };
  });
  const loc = (ln, col) => ({ file: path, line: ln.n, col: col || (ln.ws.length + 1), src: ln.raw });
  const isSkippable = (ln) => !ln.text || ln.text.startsWith('//');
  const isHeaderField = (key) => Object.prototype.hasOwnProperty.call(HEADER_FIELDS, key);

  function takesProps(node) {
    const rule = PROP_COMMANDS.get(node.name);
    if (rule) return rule === true || rule(node);
    const def = registry && registry.get(node.name);
    return !!(def && def.props && (!def.declareIf || def.declareIf(node)));
  }

  // A declaration or `@note`: a command that may stand anywhere.
  function isDeclaration(n) {
    if (n.type !== 'cmd') return false;
    const def = registry && registry.get(n.name);
    if (def) return !!(def.decl || def.topLevel || (def.declareIf && def.declareIf(n)));
    return DECL_COMMANDS.has(n.name) || (n.name === 'video' && takesProps(n));
  }

  // How many lines of a block, from L[from] on, sit at exactly `depth`: the
  // run that parseBlock reports once. It ends at a line indented `parent` or
  // less, at a line back at the block's own `indent`, or at the next scene.
  function runLength(from, depth, indent, parent) {
    let n = 0;
    for (let q = from; q < L.length; q++) {
      const c = L[q];
      if (isSkippable(c)) continue;
      if (c.indent <= parent || c.indent === indent || (c.indent === 0 && c.text.startsWith('#'))) break;
      if (c.indent === depth) n++;
    }
    return n;
  }
  const alsoNote = (n, top) => {
    const k = n - 1;
    if (k < 1) return '';
    if (top) return ` The next ${k === 1 ? 'indented line has' : k + ' indented lines have'} the same problem.`;
    return ` The ${k === 1 ? 'line' : k + ' lines'} below it at the same indentation ${k === 1 ? 'has' : 'have'} the same problem.`;
  };

  // The characters this file declares at the top, plus any the caller
  // passes as opts.characters ([{ id, name }]). The parser uses them to tell
  // a mistyped dialogue line from narration.
  let chars = null, charsSeen = -1;
  function knownCharacters() {
    if (charsSeen === top.length) return chars;
    chars = [];
    for (const c of (opts.characters || [])) if (c && c.id) chars.push({ id: String(c.id), name: c.name ? String(c.name) : null });
    for (const n of top) {
      if (n.type !== 'cmd' || n.name !== 'character') continue;
      const id = n.args.find(a => !a.key);
      if (!id) continue;
      const name = n.props.find(pr => pr.key === 'name') || n.args.find(a => a.key === 'name');
      chars.push({ id: id.value, name: name ? name.value : null });
    }
    charsSeen = top.length;
    return chars;
  }
  // The known character whose id (in any case) or display name is `word`.
  function characterFor(word) {
    const w = word.toLowerCase();
    const list = knownCharacters();
    return list.find(c => c.id.toLowerCase() === w) || list.find(c => c.name && c.name.toLowerCase() === w) || null;
  }
  // The id to write for a speaker-like word: a known character's, or the
  // word itself when it is a lowercase id like `mio` (a capitalised word
  // before a colon is as likely prose: `Note:`, `Re:`).
  function speakerId(word) {
    const c = characterFor(word);
    return c ? c.id : isLowerId(word) ? word : null;
  }

  // A `key: value` line under a command that takes no property block may be
  // meant as an argument (`@show mio` + `  at: left`). Returns its match, or
  // null for a raw command or when the key is a character (then it is
  // dialogue).
  function argLine(ln, cmd) {
    if (RAW_COMMANDS.has(cmd.name)) return null;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(\S+)$/.exec(ln.text);
    return m && !characterFor(m[1]) ? m : null;
  }
  const argNote = (ln, cmd) => {
    const m = argLine(ln, cmd);
    return m ? ` If it is meant as an argument, write \`${m[1]}=${m[2]}\` on the \`@${cmd.name}\` line instead.` : '';
  };

  // A header field's value: the rest of its line plus the indented lines
  // that follow it (spec 2.3). A blank line starts a new paragraph; comment
  // lines are skipped. Leaves p after the field.
  function readField(ln, m) {
    const segs = m[2] ? [{ text: m[2], ln, col: ln.ws.length + 1 + ln.text.length - m[2].length }] : [];
    const parts = m[2] ? [m[2]] : [];
    p++;
    while (p < L.length && (L[p].indent > 0 || isSkippable(L[p]))) {
      const c = L[p];
      if (c.text.startsWith('//')) { p++; continue; }
      if (c.text) { parts.push(c.text); segs.push({ text: c.text, ln: c, col: c.ws.length + 1 }); }
      else if (parts.length) parts.push('');
      p++;
    }
    const value = parts.join('\n').replace(/\n+$/, '').replace(/([^\n])\n(?=[^\n])/g, '$1 ').replace(/\n\n+/g, '\n\n');
    return { value, segs };
  }

  function addField(ln, key, field) {
    const entry = { value: field.value, loc: loc(ln) };
    if (key === 'include') {
      for (const seg of field.segs) {
        const re = /[^\s,]+/g;
        let mm;
        while ((mm = re.exec(seg.text))) {
          const inc = normalizePath(mm[0]);
          if (!file.includes.some(i => i.path === inc)) file.includes.push({ path: inc, loc: loc(seg.ln, seg.col + mm.index) });
        }
      }
    } else if (file.header[key]) {
      const prev = file.header[key];
      file.header[key] = Array.isArray(prev) ? prev.concat(entry) : [prev, entry];
    } else file.header[key] = entry;
  }

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
      if (!isMain) diags.error('E103', 'Story content must be inside a scene. Start one with `# scene_id`.', loc(ln));
      else if (ln.indent > 0) diags.error('E112', 'This header line is indented, but there is no field above it for it to continue.', loc(ln), 'Start header fields at the beginning of the line: `title: My Game`.');
      else diags.error('E112', 'Expected a header field like `title: My Game`, a declaration (`@...`) or a scene (`# id`).', loc(ln));
      p++;
      continue;
    }
    if (!isMain) {
      if (isHeaderField(m[1])) {
        diags.error('E112', `Header fields like \`${m[1]}:\` belong in game.story only.`, loc(ln), 'Move this line to the header of game.story.');
        readField(ln, m);
      } else {
        diags.error('E103', 'Story content must be inside a scene. Start one with `# scene_id`.', loc(ln), 'Dialogue and narration go after a `# scene_id` line.');
        p++;
      }
      continue;
    }
    addField(ln, m[1], readField(ln, m));
  }

  // Body: top-level declarations, then scenes.
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
      // strip a trailing comment outside quotes
      if (EXPR_COMMANDS.has(name)) {
        const at = exprCommentAt(raw);
        if (at >= 0) raw = raw.slice(0, at);
      } else {
        const at = logCommentAt(raw);
        if (at >= 0) raw = raw.slice(0, at);
      }
      node.raw = raw.trim();
      node.rawCol = restCol + 1;
    } else {
      node.args = tokenizeArgs(rest, restCol, diags, loc(ln));
    }
    return node;
  }

  // Parse one block: its lines sit at `indent`, deeper than `parent` (the
  // indentation of the line that opened it; -1 for a scene body). The block
  // ends at the first line indented `parent` or less, or at the next scene.
  // A deeper line that nothing opened is E102; a line between `parent` and
  // `indent` is E101. Both are still parsed as part of this block, and a run
  // of lines with the same problem is reported once.
  function parseBlock(indent, parent) {
    const nodes = [];
    const reported = new Set();
    let prev = null, seen = false;
    let argCmd = null; // the command over a reported run of indented lines
    while (p < L.length) {
      const ln = L[p];
      if (isSkippable(ln)) { p++; continue; }
      if (ln.indent <= parent) break;
      if (ln.indent === 0 && ln.text.startsWith('#')) break; // next scene
      if (ln.indent === indent) { reported.clear(); argCmd = null; }
      else if (!reported.has(ln.indent)) {
        reported.add(ln.indent);
        argCmd = null;
        const also = alsoNote(runLength(p, ln.indent, indent, parent));
        if (ln.indent < indent) {
          diags.error('E101', 'This line is indented less than the lines above it but doesn\'t line up with any outer block.', loc(ln), 'Indent with the same number of spaces as the block it belongs to.' + also);
        } else if (prev && prev.type === 'cmd' && !takesProps(prev) && !['if', 'elif', 'else'].includes(prev.name)) {
          diags.error('E102', `Unexpected indentation: \`@${prev.name}\` doesn't take an indented block.`, loc(ln), `Indent this line at the same level as \`@${prev.name}\`.` + argNote(ln, prev) + also);
          argCmd = prev;
        } else if (prev && prev.type === 'cmd' && takesProps(prev)) {
          diags.error('E102', `Unexpected indentation: this line doesn't line up with the properties of \`@${prev.name}\` above it.`, loc(ln), `Indent it like the other \`key: value\` lines, or at the same level as \`@${prev.name}\`.` + also);
        } else if (parent < 0 && !seen) {
          diags.error('E102', 'Unexpected indentation: the lines of a scene start at the beginning of the line. Only lines under a choice (`* ...`), `@if`/`@elif`/`@else`, or a declaration\'s properties are indented.', loc(ln), 'Remove the extra indentation.' + also);
        } else {
          diags.error('E102', 'Unexpected indentation. Only lines under a choice (`* ...`), `@if`/`@elif`/`@else`, or a declaration\'s properties are indented.', loc(ln), 'Remove the extra indentation.' + also);
        }
      }
      // `@show mio` + `  at: left`: the E102 above names the argument. Read as
      // dialogue, `at` would also be an unknown speaker (E114), so drop it.
      if (argCmd && ln.indent > indent && argLine(ln, argCmd)) { p++; seen = true; continue; }
      const node = parseStatement(ln);
      if (node) nodes.push(node);
      prev = node;
      seen = true;
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
      if (!m) {
        diags.error('E102', `Lines indented under \`@${node.name}\` must be properties like \`name: Mio\`.`, loc(ln));
        p++;
        continue;
      }
      if (ln.indent !== ci) {
        // a property that doesn't line up: report it, but keep it
        diags.error('E102', 'This property is indented more than the ones above it.', loc(ln), `Line it up with the other properties of \`@${node.name}\`.`);
      }
      let value = m[2];
      let quoted = false;
      // `key: "text"`: the value runs from the first quote to the last one,
      // so a bare " inside it is kept. Escapes follow the rule for quoted
      // command arguments; an unquoted value keeps its backslashes as typed.
      if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
        const col0 = ln.ws.length + ln.text.length - value.length; // 0-based column of the opening quote
        const r = readQuoted(value, 1, (j) => j === value.length - 1, col0, diags, loc(ln), 'property value');
        if (!r.closed) diags.error('E110', 'This quoted string is never closed.', loc(ln, col0 + 1), 'Add a closing ".');
        value = r.value;
        quoted = true;
      }
      node.props.push({ key: m[1], value, quoted, loc: loc(ln, ln.ws.length + 1) });
      p++;
    }
  }

  // In scripts without spaces a "word" before a colon may be half a sentence;
  // only a short one (names are 1-8 characters) is taken for a speaker.
  const isShortName = (w) => [...w].length <= 8;

  // Lines that look like dialogue but don't match its syntax. Returns
  // { who, why, fix } for a W608, or null. The `word：text` and `word:text`
  // forms are also ordinary prose (`時刻：午後三時。`, `Note:the tide`), so they
  // get a W608 only when the word is a known character, a lowercase id, or
  // (before `：`) a name in kana. Otherwise the result has `weak` set and
  // the line stays narration with no diagnostic.
  function dialogueLookalike(t) {
    const FULL_WIDTH = '`：` (a full-width colon) doesn\'t start dialogue';
    const NO_SPACE = 'there is no space after the colon';
    let m = /^([\p{L}\p{M}\p{N}_'’.-]+)\s*((?:[(（][^()（）]*[)）])?)\s*：\s*(\S.*)$/u.exec(t);
    if (m) {
      const attrs = m[2] ? ' ' + m[2].replace('（', '(').replace('）', ')') : '';
      const id = speakerId(m[1]);
      if (id) return { who: m[1], why: FULL_WIDTH, fix: `Write \`${id}${attrs}: ${m[3]}\` with an ASCII colon and a space.` };
      if (RE_KANA_NAME.test(m[1]) && isShortName(m[1])) return { who: m[1], why: FULL_WIDTH, fix: 'Dialogue is a character id, an ASCII colon and a space: `id: ...` (the id, not the display name).' };
      return { who: m[1], why: FULL_WIDTH, attrs, text: m[3], weak: true };
    }
    m = RE_NO_SPACE_COLON.exec(t);
    if (m) {
      const id = speakerId(m[1]);
      if (id) return { who: m[1], why: NO_SPACE, fix: `Write \`${id}${m[2]}: ${m[3]}\`.` };
      return { who: m[1], why: NO_SPACE, attrs: m[2], text: m[3], weak: true };
    }
    m = /^"([^"]+)"((?:\s*\([^()]*\))?)\s*:(\S.*)$/.exec(t);
    if (m) return { who: m[1], why: NO_SPACE, fix: `Write \`"${m[1]}"${m[2]}: ${m[3]}\`.` };
    m = /^[“”„«「『]([^“”"»」』]+)[”“"»」』]\s*(?:\([^()]*\))?\s*[:：]\s*(\S.*)$/u.exec(t);
    if (m) return { who: m[1], why: 'a one-off speaker\'s name needs straight double quotes', fix: `Write \`"${m[1]}": ${m[2]}\`.` };
    const RENPY = 'this is Ren\'Py-style dialogue';
    m = /^"([^"]+)"\s+"(.*)"$/.exec(t);
    if (m) return { who: m[1], why: RENPY, fix: `In Shiori write \`"${m[1]}": ${m[2]}\`.` };
    m = RE_RENPY.exec(t);
    if (m) {
      const c = characterFor(m[1]);
      const id = c ? c.id : /^[A-Za-z_][A-Za-z0-9_]*$/.test(m[1]) ? m[1] : null;
      if (id) return { who: m[1], why: RENPY, fix: `In Shiori write \`${id}: ${m[2]}\`.` };
      // A word in a script written without spaces may be half a sentence.
      if (RE_UNSPACED_SCRIPT.test(m[1])) return null;
      return { who: m[1], why: RENPY, fix: `In Shiori write \`"${m[1]}": ${m[2]}\` for a one-off speaker, or \`id: ${m[2]}\` with the id of a declared character.` };
    }
    return null;
  }

  function parseStatement(ln) {
    let t = ln.text;
    p++;
    const odd = RE_ODD_SPACE.exec(t);
    if (odd && t.length > odd[0].length) {
      const rest = t.slice(odd[0].length);
      if (/^(@|->|\*|#|\|)/.test(rest) || RE_DIALOGUE.test(rest) || RE_ADHOC.test(rest)) {
        diags.error('E101', 'This line starts with a non-breaking or full-width space, which is not indentation.', loc(ln),
          'Indent with ASCII spaces or tabs. If the line is narration, start it with `| `.');
        ln = { ...ln, text: rest, ws: ln.ws + odd[0] };
        t = rest;
      }
    }
    const col = ln.ws.length + 1;
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
        const ci = childIndent(ln.indent);
        node.body = ci == null ? [] : parseBlock(ci, ln.indent);
        if (ci == null) diags.error('E108', `\`@${node.name}\` needs an indented block of lines under it.`, loc(ln), 'Indent the lines that belong to this branch by two spaces.');
        return node;
      }
      if (takesProps(node)) parseProps(node, ln.indent);
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
      return parseChoice(ln);
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
    m = RE_WORD_SPEAKER.exec(t);
    if (m && !RE_UNSPACED_SCRIPT.test(m[1])) {
      // A single word before the colon is a speaker (spec 2.5); this one can't
      // be an id, so the compiler reports E114 with the right id as its hint.
      return { type: 'say', speaker: m[1], attrs: splitAttrs(m[2]), text: m[3], loc: loc(ln, col), textCol: col + t.indexOf(m[3], m[1].length) };
    }
    const look = dialogueLookalike(t);
    if (m && isShortName(m[1])) {
      // Japanese, Chinese...: no spaces, so only a short "word" looks like a name
      const c = characterFor(m[1]);
      diags.warn('W608', `This looks like dialogue from "${m[1]}", but it will be shown as narration.`, loc(ln), c
        ? `Dialogue starts with the character's id, not the display name: write \`${c.id}${m[2] ? ` (${m[2]})` : ''}: ${m[3]}\`. If it really is narration, start the line with \`| \`.`
        : `Dialogue starts with the character's id (ASCII letters, digits and _), not the display name: declare \`@character id name="${m[1]}"\` and write \`id: ...\`. If it really is narration, start the line with \`| \`.`);
    } else if (look && !look.weak) {
      diags.warn('W608', `This looks like dialogue from "${look.who}", but ${look.why}, so it will be shown as narration.`, loc(ln),
        `${look.fix} If it really is narration, start the line with \`| \`.`);
    } else if (RE_LOOKS_LIKE_SPEAKER.test(t)) {
      const who = RE_LOOKS_LIKE_SPEAKER.exec(t)[1];
      diags.warn('W608', `This looks like dialogue from "${who}", but it will be shown as narration.`, loc(ln),
        `For a one-off speaker write \`"${who}": ...\`; for a recurring one declare \`@character\`. If it really is narration, start the line with \`| \`.`);
    }
    const node = { type: 'narrate', text: t, loc: loc(ln, col), textCol: col };
    // `Rin:Hi.` in a chapter file, where the parser can't see `@character rin`:
    // keep what it saw, so the compiler can check it against every character.
    if (look && look.weak) node.speakerLike = { who: look.who, why: look.why, attrs: look.attrs, text: look.text };
    return node;
  }

  function parseChoice(ln) {
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
      const close = closeBracketAt(s);
      if (close < 0) { diags.error('E107', 'This `[` is never closed with `]`.', loc(ln, col + offset)); break; }
      const rawInner = s.slice(1, close);
      const inner = rawInner.trim();
      const mm = /^(if|require|once)\b\s*(.*)$/.exec(inner);
      if (!mm) {
        diags.error('E107', `Unknown choice option \`[${inner}]\`. Use \`[if condition]\`, \`[require condition]\` or \`[once]\`.`, loc(ln, col + offset));
      } else if (mm[1] === 'once') {
        if (mm[2]) diags.error('E107', '`[once]` takes no condition.', loc(ln, col + offset));
        mods.once = true;
      } else {
        if (!mm[2]) diags.error('E107', `\`[${mm[1]}]\` needs a condition, e.g. \`[${mm[1]} trust >= 2]\`.`, loc(ln, col + offset));
        // column of the condition's first character: after `[`, any spaces and the keyword
        const kwAt = rawInner.length - rawInner.trimStart().length;
        const condAt = mm[2] ? rawInner.indexOf(mm[2], kwAt + mm[1].length) : kwAt + mm[1].length;
        const condCol = col + offset + 1 + condAt;
        let src = mm[2], hint = null;
        // `[require cond "hint"]`: a trailing "string" is the hint only when the
        // text before it is already a complete condition (as for @assert), so
        // `[require route == "rin"]` keeps its last operand. The hint follows
        // the escape rule of quoted arguments.
        const at = mm[1] === 'require' && !parses(src) ? trailingStringAt(src) : -1;
        if (at > 0 && parses(src.slice(0, at))) {
          const r = readQuoted(src, at + 1, (j) => j === src.length - 1, condCol - 1, diags, loc(ln), 'lock hint');
          src = src.slice(0, at).trimEnd();
          hint = r.value;
        }
        mods[mm[1]] = { src, hint, col: condCol };
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
    const ci = childIndent(ln.indent);
    if (ci != null) node.body = parseBlock(ci, ln.indent);
    else checkOddBody(ln, p - 1);
    return node;
  }

  // A choice's lines indented with no-break or full-width spaces are not
  // under it: those spaces are not indentation, so the lines end the menu.
  // parseStatement reports such a line when it is a command, choice, jump or
  // dialogue; narration is reported here, where it can only be meant as the
  // choice's body. A U+3000 is also a Japanese paragraph indent, so after the
  // last choice of a menu it is reported only when the choice above had such
  // a body too. `at` is the index of the choice's line.
  let oddBody = null; // { indent, next }: the last run reported, and the line after it
  function checkOddBody(ln, at) {
    let q = p;
    while (q < L.length && isSkippable(L[q])) q++;
    const first = L[q];
    const odd = first && first.indent === ln.indent && RE_ODD_SPACE.exec(first.text);
    if (!odd || first.text.length === odd[0].length) return;
    const isNarration = (c) => { const rest = c.text.replace(RE_ODD_SPACE, ''); return !RE_ODD_STATEMENT.test(rest) && !RE_DIALOGUE.test(rest) && !RE_ADHOC.test(rest); };
    if (!isNarration(first)) return;
    let r = q, n = 0;
    while (r < L.length && (isSkippable(L[r]) || (L[r].indent === ln.indent && RE_ODD_SPACE.test(L[r].text)))) {
      if (!isSkippable(L[r]) && isNarration(L[r])) n++;
      r++;
    }
    const next = L[r];
    const menuGoesOn = !!next && next.indent === ln.indent && next.text.startsWith('*');
    const afterOddBody = !!oddBody && oddBody.indent === ln.indent && oddBody.next === at;
    if (/^\u3000+$/.test(odd[0]) && !menuGoesOn && !afterOddBody) return;
    diags.error('E101', 'This line starts with a non-breaking or full-width space, which is not indentation.', loc(first),
      'To put it under the choice above, indent it with ASCII spaces or tabs.' + alsoNote(n));
    oddBody = { indent: ln.indent, next: r };
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

  let scene = null;
  let prevTop = null;     // the last top-level declaration, for hints
  let topReported = false; // a run of indented top-level lines was reported
  while (p < L.length) {
    const ln = L[p];
    if (isSkippable(ln)) { p++; continue; }
    if (ln.text.startsWith('#') && ln.indent === 0) {
      const m = /^#\s*([^\s"]+)\s*(.*)$/.exec(ln.text);
      p++;
      topReported = false;
      if (!m || !isLabelId(m[1]) || ln.text.startsWith('##')) {
        diags.error('E104', 'A scene starts with `# scene_id`, optionally followed by a title in quotes: `# harbor "The Harbor"`.', loc(ln),
          'Scene ids use letters, digits, `_` and `.`, and start with a letter. If this line is narration, start it with `| `.');
        // The lines under a bad heading belong to no scene. Parse them, so
        // their syntax is checked, but compile them only where they would
        // run anyway: when the scene above runs on into them, they join it.
        // After a scene that always jumps away they would be dead code
        // (W622), so keep only their declarations, which apply wherever
        // they stand; before the first scene, the same. The rest goes to
        // file.orphans, for a compiler that wants to check it.
        const body = parseBlock(0, -1);
        if (scene && !scene.body.some(alwaysLeaves)) { scene.body = scene.body.concat(body); continue; }
        const keep = body.filter(isDeclaration), rest = body.filter(n => !isDeclaration(n));
        if (scene) scene.body = scene.body.concat(keep);
        else top.push(...keep);
        if (rest.length) file.orphans.push({ loc: loc(ln, 1), body: rest });
        continue;
      }
      const args = tokenizeArgs(m[2], ln.text.indexOf(m[2]), diags, loc(ln));
      let title = null;
      for (const a of args) {
        if (a.key) {
          const k = a.key.toLowerCase();
          const def = registry && registry.get(k);
          const cmd = HEADING_KEY_COMMANDS[k] || (def && !def.decl ? def.name : null);
          diags.error('E104', `Unexpected \`${a.key}=${a.value}\` after the scene ${title == null ? 'id' : 'title'}. A scene heading takes only an id and a title in quotes.`, loc(ln, a.col),
            k === 'title' ? `Write the title in quotes: \`# ${m[1]} "${a.value}"\`.` : cmd ? `Put \`@${cmd} ${a.value}\` on the line after the heading.` : 'Put commands on the lines after the heading.');
        } else if (title == null && a.quoted) title = a.value;
        else diags.error('E104', `Unexpected \`${a.value}\` after the scene ${title == null ? 'id' : 'title'}. Put the title in quotes.`, loc(ln, a.col));
      }
      scene = { id: m[1], title, args: {}, loc: loc(ln, 1), file: path, body: [] };
      file.scenes.push(scene);
      scene.body = parseBlock(0, -1);
      continue;
    }
    if (ln.indent > 0) {
      if (!topReported) {
        topReported = true;
        let n = 0;
        for (let q = p; q < L.length && (isSkippable(L[q]) || L[q].indent > 0); q++) if (!isSkippable(L[q])) n++;
        const also = alsoNote(n, true);
        if (prevTop && prevTop.type === 'cmd' && !takesProps(prevTop)) {
          diags.error('E102', `Unexpected indentation: \`@${prevTop.name}\` doesn't take an indented block.`, loc(ln), 'Start this line at the beginning of the line.' + argNote(ln, prevTop) + also);
        } else if (prevTop && prevTop.type === 'cmd') {
          diags.error('E102', `Unexpected indentation: this line doesn't line up with the properties of \`@${prevTop.name}\` above it.`, loc(ln), `Indent it like the other \`key: value\` lines, or start it at the beginning of the line.` + also);
        } else {
          diags.error('E102', 'Unexpected indentation before the first scene.', loc(ln), 'Remove the extra indentation.' + also);
        }
      }
      p++;
      continue;
    }
    topReported = false;
    if (ln.text.startsWith('@')) {
      p++;
      const node = parseCommand(ln, ln.text, 1);
      prevTop = node;
      if (node) {
        if (node.name === 'if' || node.name === 'elif' || node.name === 'else') {
          diags.error('E103', `\`@${node.name}\` must be inside a scene.`, node.loc);
          const ci = childIndent(0);
          if (ci != null) parseBlock(ci, 0);
        } else {
          if (takesProps(node)) parseProps(node, 0);
          top.push(node);
        }
      }
      continue;
    }
    prevTop = null;
    const hm = RE_HEADER.exec(ln.text);
    if (hm && isHeaderField(hm[1])) {
      const field = readField(ln, hm);
      if (isMain) {
        diags.error('E112', 'Header fields must come before the first `@` declaration or `#` scene.', loc(ln), 'Move this line up, next to the other header fields after `SHIORI 1`.');
        addField(ln, hm[1], field); // keep it, so nothing else breaks because of it
      } else {
        diags.error('E112', `Header fields like \`${hm[1]}:\` belong in game.story only.`, loc(ln), 'Move this line to the header of game.story.');
      }
      continue;
    }
    const odd = RE_ODD_SPACE.exec(ln.text);
    if (odd && /^[@#]/.test(ln.text.slice(odd[0].length))) {
      diags.error('E101', 'This line starts with a non-breaking or full-width space, which is not indentation.', loc(ln), 'Start declarations and scene headings at the beginning of the line.');
      p++;
      continue;
    }
    diags.error('E103', 'Story content must be inside a scene. Start one with `# scene_id`.', loc(ln),
      RE_DIALOGUE.test(ln.text) || RE_ADHOC.test(ln.text) ? 'Dialogue and narration go after a `# scene_id` line.' : undefined);
    p++;
  }
  file.decls = top;
  return file;
}
