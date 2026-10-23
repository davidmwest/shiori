// Inline text markup: {b}bold{/b}, {ruby=かんじ}漢字{/ruby}, {w=0.5}, {$name} ...

import { didYouMean, isColor } from './util.js';

// paired: needs a closing tag. value: 'none' | 'required' | 'optional'
export const TAGS = {
  b:     { paired: true,  value: 'none',     doc: 'Bold.' },
  i:     { paired: true,  value: 'none',     doc: 'Italic.' },
  u:     { paired: true,  value: 'none',     doc: 'Underline.' },
  s:     { paired: true,  value: 'none',     doc: 'Strikethrough.' },
  color: { paired: true,  value: 'color',    doc: 'Text color: {color=#ff6688}text{/color}.' },
  size:  { paired: true,  value: 'number',   doc: 'Relative size: {size=1.5}big{/size}.' },
  ruby:  { paired: true,  value: 'required', doc: 'Furigana / reading above the text: {ruby=かんじ}漢字{/ruby}.' },
  shake: { paired: true,  value: 'none',     doc: 'Trembling letters (fear, cold, anger).' },
  wave:  { paired: true,  value: 'none',     doc: 'Letters bob in a wave (singing, giddiness).' },
  speed: { paired: true,  value: 'number',   doc: 'Typing speed multiplier: {speed=0.3}slow...{/speed}.' },
  w:     { paired: false, value: 'optional-number', doc: '{w=0.8} pauses typing for 0.8 s. {w} waits for a click, then continues in the same box.' },
  nw:    { paired: false, value: 'none',     doc: 'At the very end of a line: continue to the next line without waiting for a click.' },
  br:    { paired: false, value: 'none',     doc: 'Line break inside one line of text.' },
};

// Own properties only: `{constructor}` is not a tag.
const tagDef = (name) => Object.hasOwn(TAGS, name) ? TAGS[name] : null;

const NUMBER_HINT = {
  w: 'Write `{w=0.5}` to pause for half a second, or `{w}` to wait for a click.',
  size: '1 is normal size: `{size=1.5}…{/size}` is half again as big, `{size=0.8}…{/size}` smaller.',
  speed: '1 is normal speed: `{speed=0.5}…{/speed}` types at half speed, `{speed=2}…{/speed}` twice as fast.',
};

// Returns { tokens, errors } — never throws.
export function parseMarkup(text) {
  const tokens = [];
  const errors = [];
  const stack = [];
  let buf = '';
  const flush = () => { if (buf) { tokens.push({ t: 'text', s: buf }); buf = ''; } };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{' && text[i + 1] === '{') { buf += '{'; i++; continue; }
    if (c === '}' && text[i + 1] === '}') { buf += '}'; i++; continue; }
    if (c === '}') { buf += '}'; continue; }
    if (c !== '{') { buf += c; continue; }
    const end = text.indexOf('}', i);
    if (end < 0) {
      errors.push({ code: 'E501', message: 'A `{` is never closed with `}`.', col: i, hint: 'Write `{{` for a literal brace.' });
      buf += text.slice(i);
      break;
    }
    const body = text.slice(i + 1, end).trim();
    const col = i;
    i = end;
    if (body.startsWith('$')) {
      const name = body.slice(1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        errors.push({ code: 'E502', message: `\`{${body}}\` is not a valid variable reference.`, col, hint: 'Write `{$name}` with a declared variable name.' });
        continue;
      }
      flush();
      tokens.push({ t: 'var', name, col });
      continue;
    }
    if (body.startsWith('/')) {
      const name = body.slice(1).trim();
      if (!tagDef(name) || !tagDef(name).paired) {
        const s = didYouMean(name, Object.keys(TAGS).filter(k => TAGS[k].paired));
        errors.push({ code: 'E500', message: `Unknown closing tag \`{/${name}}\`.`, col, hint: s ? `Did you mean \`{/${s}}\`?` : undefined });
        continue;
      }
      const top = stack.lastIndexOf(name);
      if (top < 0) {
        errors.push({ code: 'E501', message: `\`{/${name}}\` closes a tag that was never opened.`, col });
        continue;
      }
      if (top !== stack.length - 1) {
        errors.push({ code: 'E501', message: `\`{/${name}}\` closes tags out of order (open: ${stack.map(s => '{' + s + '}').join(' ')}).`, col, hint: 'Close the innermost tag first.' });
      }
      stack.splice(top, 1);
      flush();
      tokens.push({ t: 'close', tag: name });
      continue;
    }
    const m = /^([A-Za-z_]+)\s*(?:=\s*(.*))?$/.exec(body);
    if (!m) {
      errors.push({ code: 'E500', message: `\`{${body}}\` is not a text tag.`, col, hint: 'Write `{{` and `}}` for literal braces.' });
      continue;
    }
    const name = m[1], value = m[2] != null ? m[2].trim().replace(/^"(.*)"$/, '$1') : null;
    const def = tagDef(name);
    if (!def) {
      const s = didYouMean(name, Object.keys(TAGS));
      errors.push({ code: 'E500', message: `Unknown text tag \`{${name}}\`.`, col, hint: s ? `Did you mean \`{${s}}\`?` : 'See "Text markup" in the spec for the list of tags.' });
      continue;
    }
    let v = null;
    const numeric = def.value === 'number' || def.value === 'optional-number';
    const errorCount = errors.length;
    if (def.value === 'none' && value != null) {
      errors.push({ code: 'E502', message: `\`{${name}}\` takes no value.`, col });
    } else if (def.value === 'required' && !value) {
      errors.push({ code: 'E502', message: `\`{${name}=...}\` needs a value.`, col });
    } else if (def.value === 'color' && (!value || !isColor(value))) {
      errors.push({ code: 'E502', message: `\`{color=${value || ''}}\` needs a color like #ff6688.`, col });
    } else if (numeric && value === '') {
      errors.push({ code: 'E502', message: `\`{${name}=}\` is missing its number.`, col, hint: NUMBER_HINT[name] });
    } else if (numeric && value != null && !/^(\d+\.?\d*|\.\d+)$/.test(value)) {
      errors.push({ code: 'E502', message: `\`{${name}=${value}}\` needs a plain number like 0.5.`, col, hint: NUMBER_HINT[name] });
    } else if (def.value === 'number' && value == null) {
      errors.push({ code: 'E502', message: `\`{${name}=...}\` needs a number.`, col, hint: NUMBER_HINT[name] });
    } else if (def.value === 'number' && !(Number(value) > 0)) {
      errors.push({ code: 'E502', message: `\`{${name}=${value}}\` needs a number above 0.`, col, hint: NUMBER_HINT[name] });
    } else {
      v = numeric && value != null ? Number(value) : value;
    }
    // A ruby is drawn as one piece with one style, so its base may hold only
    // text and {$var}.
    if (stack.includes('ruby') && errors.length === errorCount) {
      if (name === 'ruby') errors.push({ code: 'E502', message: 'A `{ruby}` cannot go inside another `{ruby}`.', col, hint: 'Close the first one with `{/ruby}` before the next `{ruby=...}`.' });
      else if (def.paired) errors.push({ code: 'E502', message: `\`{${name}}\` cannot go inside \`{ruby}…{/ruby}\`.`, col, hint: `Put it around the whole ruby: \`{${name}${value != null ? '=' + value : ''}}{ruby=...}…{/ruby}{/${name}}\`.` });
      else errors.push({ code: 'E502', message: `\`{${name}${value != null ? '=' + value : ''}}\` cannot go inside \`{ruby}…{/ruby}\`.`, col, hint: 'Put it before `{ruby=...}` or after `{/ruby}`.' });
    }
    flush();
    if (name === 'w') tokens.push({ t: 'wait', seconds: v });
    else if (name === 'nw') tokens.push({ t: 'nw' });
    else if (name === 'br') tokens.push({ t: 'br' });
    else { tokens.push({ t: 'open', tag: name, value: v }); stack.push(name); }
  }
  flush();
  for (const open of stack) errors.push({ code: 'E501', message: `\`{${open}}\` is never closed.`, col: text.length, hint: `Add \`{/${open}}\`.` });
  // {nw} must be last
  const nwIndex = tokens.findIndex(t => t.t === 'nw');
  if (nwIndex >= 0 && tokens.slice(nwIndex + 1).some(t => (t.t === 'text' && t.s.trim()) || t.t === 'var')) {
    errors.push({ code: 'E502', message: '`{nw}` must come at the end of the line.', col: text.length });
  }
  return { tokens, errors };
}

// Plain text with variables substituted (backlog, search, word counts, TTS).
export function plainText(tokens, getVar) {
  let s = '';
  for (const t of tokens) {
    if (t.t === 'text') s += t.s;
    else if (t.t === 'var') s += getVar ? String(getVar(t.name)) : `{$${t.name}}`;
    else if (t.t === 'br') s += '\n';
  }
  return s;
}

// Styled runs for renderers.
// Each run: { text, style: {b,i,u,s,color,size,shake,wave,speed}, ruby } or
// { wait: seconds } / { click: true } / { br: true }.
// A closing tag restores the value its opening tag replaced, so nested tags of
// the same kind work: {color=#f00}a{color=#fff}b{/color}c{/color} -> c is red.
export function toRuns(tokens, getVar) {
  const runs = [];
  const style = {};
  const saved = [];  // [tag, value before it was opened], innermost last
  let ruby = null, rubyText = '';
  const pushText = (text) => {
    if (!text) return;
    if (ruby != null) { rubyText += text; return; }
    runs.push({ text, style: { ...style } });
  };
  for (const t of tokens) {
    if (t.t === 'text') pushText(t.s);
    else if (t.t === 'var') pushText(String(getVar ? getVar(t.name) : ''));
    else if (t.t === 'br') runs.push({ br: true });
    else if (t.t === 'wait') runs.push(t.seconds == null ? { click: true } : { wait: t.seconds });
    else if (t.t === 'open') {
      // A nested {ruby} is E502; keep the outer one so no base text is lost.
      if (t.tag === 'ruby') { if (ruby == null) { ruby = t.value; rubyText = ''; } }
      else { saved.push([t.tag, style[t.tag]]); style[t.tag] = t.value == null ? true : t.value; }
    } else if (t.t === 'close') {
      if (t.tag === 'ruby') {
        if (ruby != null) runs.push({ text: rubyText, ruby, style: { ...style } });
        ruby = null; rubyText = '';
      } else {
        let k = saved.length - 1;
        while (k >= 0 && saved[k][0] !== t.tag) k--;
        const prev = k >= 0 ? saved.splice(k, 1)[0][1] : undefined;
        if (prev === undefined) delete style[t.tag]; else style[t.tag] = prev;
      }
    }
  }
  return runs;
}

export function hasNoWait(tokens) { return tokens.some(t => t.t === 'nw'); }
