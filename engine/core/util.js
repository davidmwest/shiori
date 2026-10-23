// Small helpers shared by every part of the core. No DOM, no Node APIs.

// Edit distance where swapping two neighbouring letters counts as one edit
// (optimal string alignment), so "smiel" is one edit from "smile".
export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = [];
  for (let i = 0; i <= m; i++) { d.push(new Array(n + 1).fill(0)); d[i][0] = i; }
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

// Best match for a misspelled name, or null when nothing is close.
export function didYouMean(word, candidates) {
  if (!word) return null;
  const w = String(word).toLowerCase();
  let best = null, bestScore = Infinity;
  for (const c of candidates) {
    const cl = String(c).toLowerCase();
    if (cl === w) return c;
    let d = levenshtein(w, cl);
    if (cl.startsWith(w) || w.startsWith(cl)) d = Math.min(d, 1);
    if (d < bestScore) { bestScore = d; best = c; }
  }
  const limit = Math.max(1, Math.floor(w.length / 3));
  return bestScore <= limit ? best : null;
}

export function suggest(word, candidates) {
  const m = didYouMean(word, candidates);
  return m ? `Did you mean \`${m}\`?` : null;
}

// FNV-1a 32-bit hash, rendered in base 36. Used for stable line ids.
export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, '0');
}

export function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

// Deterministic PRNG (mulberry32). The seed lives in the save state, so
// random results survive save/load and rollback.
export function nextRandom(seed) {
  let t = (seed + 0x6D2B79F5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { seed: t, value: ((r ^ (r >>> 14)) >>> 0) / 4294967296 };
}

export function isIdent(s) { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s); }
export function isLabelId(s) { return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(s); }

// Parse "1.5", "1.5s", "500ms" into seconds. Returns NaN when invalid.
export function parseDuration(v) {
  if (typeof v === 'number') return v;
  const m = /^(-?\d*\.?\d+)(ms|s)?$/.exec(String(v).trim());
  if (!m) return NaN;
  const n = parseFloat(m[1]);
  return m[2] === 'ms' ? n / 1000 : n;
}

export function isColor(v) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v)) ||
    /^(black|white|red|green|blue|yellow|cyan|magenta|gray|grey|orange|pink|purple|transparent)$/.test(String(v));
}

export function plural(n, word, pl) { return n + ' ' + (n === 1 ? word : (pl || word + 's')); }

export function dirname(p) {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

export function joinPath(base, rel) {
  if (!base || rel.startsWith('/') || /^[a-z]+:/i.test(rel)) return rel;
  const parts = (base + '/' + rel).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') out.pop(); else out.push(p);
  }
  return out.join('/');
}

// Count words for reading-time estimates. CJK characters count as
// ~0.5 word each (a common rule of thumb for mixed text).
export function countWords(text) {
  const cjk = (text.match(/[぀-ヿ㐀-鿿가-힯]/g) || []).length;
  const rest = text.replace(/[぀-ヿ㐀-鿿가-힯]/g, ' ');
  const words = (rest.match(/[A-Za-z0-9À-ɏ'’-]+/g) || []).length;
  return { words, cjk };
}
