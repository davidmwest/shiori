// A small, safe expression language for conditions and assignments.
// Never uses eval. Supports numbers, strings, booleans, variables,
// + - * / %, comparisons, and/or/not (also && || !), parentheses and
// a fixed set of functions.

export const FUNCTIONS = {
  visited:     { args: ['label'], doc: 'How many times the scene has been entered in this playthrough (0 if never).' },
  ending_seen: { args: ['ending'], doc: 'True if this ending has been reached in any playthrough (persistent).' },
  endings_seen:{ args: [], doc: 'How many different endings have been reached across all playthroughs.' },
  random:      { args: ['number', 'number'], doc: 'A whole number from a to b, inclusive. Deterministic per save.' },
  chance:      { args: ['number'], doc: 'True with probability p (0 to 1). Deterministic per save.' },
  count:       { args: ['bool'], variadic: true, doc: 'How many of the conditions are true: count(clue_a, clue_b, clue_c) >= 2.' },
  min:         { args: ['number', 'number'], variadic: true, doc: 'Smallest value.' },
  max:         { args: ['number', 'number'], variadic: true, doc: 'Largest value.' },
  clamp:       { args: ['number', 'number', 'number'], doc: 'clamp(x, lo, hi).' },
  abs:         { args: ['number'], doc: 'Absolute value.' },
  floor:       { args: ['number'], doc: 'Round down.' },
  ceil:        { args: ['number'], doc: 'Round up.' },
  round:       { args: ['number'], doc: 'Round to nearest whole number.' },
  len:         { args: ['string'], doc: 'Length of a string.' },
  upper:       { args: ['string'], doc: 'Uppercase copy of a string.' },
  lower:       { args: ['string'], doc: 'Lowercase copy of a string.' },
};

export class ExprError extends Error {
  constructor(code, message, pos, hint) { super(message); this.code = code; this.pos = pos; this.hint = hint; }
}

const OPS = ['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '<', '>', '+', '-', '*', '/', '%', '(', ')', ',', '!', '='];

// Inside quotes a backslash escapes only \\, \" and \'. Anything else (\n, \t,
// a \u code) is an error: dropping the backslash would silently change the text.
const ESCAPES = ['\\', '"', "'"];
function escapeHint(e) {
  if (e === 'n' || e === 'r') return 'A string cannot hold a line break. Put `{br}` in the text line instead, e.g. `{$first}{br}{$second}`.';
  if (e === 'u' || e === 'x') return 'Type the character itself, e.g. `—` rather than `\\u2014`.';
  return 'Only `\\"`, `\\\'` and `\\\\` are escapes. Write `\\\\` for a backslash.';
}

export function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^\d*\.?\d+/.exec(src.slice(i));
      toks.push({ t: 'num', v: parseFloat(m[0]), pos: i });
      i += m[0].length;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < src.length) {
          const e = src[j + 1];
          if (!ESCAPES.includes(e)) throw new ExprError('E400', `Unknown escape \`\\${e}\` in a string.`, j, escapeHint(e));
          s += e; j += 2;
        } else s += src[j++];
      }
      if (j >= src.length) throw new ExprError('E400', 'Unterminated string in expression.', i, `Close the string with ${c}.`);
      toks.push({ t: 'str', v: s, pos: i });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      const w = m[0];
      if (w === 'true' || w === 'false') toks.push({ t: 'bool', v: w === 'true', pos: i });
      else if (w === 'and' || w === 'or' || w === 'not') toks.push({ t: 'op', v: w === 'and' ? '&&' : w === 'or' ? '||' : '!', pos: i, word: w });
      else toks.push({ t: 'id', v: w, pos: i });
      i += w.length;
      continue;
    }
    const op = OPS.find(o => src.startsWith(o, i));
    if (op) { toks.push({ t: 'op', v: op, pos: i }); i += op.length; continue; }
    throw new ExprError('E400', `Unexpected character \`${c}\` in expression.`, i);
  }
  toks.push({ t: 'eof', pos: src.length });
  return toks;
}

const BIN = {
  '||': 1, '&&': 2,
  '==': 4, '!=': 4, '<': 4, '<=': 4, '>': 4, '>=': 4,
  '+': 5, '-': 5,
  '*': 6, '/': 6, '%': 6,
};

export function parseExpr(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];

  function primary() {
    const t = next();
    if (t.t === 'num') return { t: 'num', v: t.v };
    if (t.t === 'str') return { t: 'str', v: t.v };
    if (t.t === 'bool') return { t: 'bool', v: t.v };
    if (t.t === 'id') {
      if (peek().t === 'op' && peek().v === '(') {
        next();
        const args = [];
        if (!(peek().t === 'op' && peek().v === ')')) {
          for (;;) {
            args.push(expr(0));
            if (peek().t === 'op' && peek().v === ',') { next(); continue; }
            break;
          }
        }
        const close = next();
        if (!(close.t === 'op' && close.v === ')')) throw new ExprError('E400', `Expected \`)\` to close the call to ${t.v}().`, close.pos);
        return { t: 'call', name: t.v, args, pos: t.pos };
      }
      return { t: 'var', name: t.v, pos: t.pos };
    }
    if (t.t === 'op' && t.v === '(') {
      const e = expr(0);
      const close = next();
      if (!(close.t === 'op' && close.v === ')')) throw new ExprError('E400', 'Expected `)`.', close.pos);
      return e;
    }
    if (t.t === 'op' && (t.v === '!' )) return { t: 'un', op: '!', a: expr(3, t.word || '!') };
    if (t.t === 'op' && t.v === '-') return { t: 'un', op: '-', a: expr(7) };
    if (t.t === 'eof') throw new ExprError('E400', 'Expression ends too early.', t.pos);
    throw new ExprError('E400', `Unexpected \`${t.v}\` in expression.`, t.pos);
  }

  // negated: this is the operand of `not` / `!` (kept in the chained-comparison hint).
  function expr(minPrec, negated) {
    let left = primary();
    for (;;) {
      const t = peek();
      if (t.t !== 'op') break;
      if (t.v === '=') throw new ExprError('E401', 'A single `=` assigns; conditions compare with `==`.', t.pos, 'Write `==` to compare, or use `@set` to assign.');
      const prec = BIN[t.v];
      if (!prec || prec < minPrec) break;
      next();
      const right = expr(prec + 1);
      left = { t: 'bin', op: t.v, a: left, b: right };
      // The grammar allows one comparison here: `1 < x < 5` would mean
      // `(1 < x) < 5`, which is true for every x > 1.
      if (prec === 4 && peek().t === 'op' && BIN[peek().v] === 4) chained(left, negated);
    }
    return left;
  }

  function chained(first, negated) {
    const t = next();
    let hint = 'Write `1 < x and x < 5`.';
    try {
      const mid = exprToString(first.b);
      const both = `${exprToString(first.a)} ${first.op} ${mid} and ${mid} ${t.v} ${exprToString(expr(5))}`;
      hint = `Write \`${negated ? `${negated === '!' ? '!' : 'not '}(${both})` : both}\`.`;
    } catch (e) { if (!(e instanceof ExprError)) throw e; }
    throw new ExprError('E400', "Comparisons can't be chained.", t.pos, hint);
  }

  const ast = expr(0);
  if (peek().t !== 'eof') {
    const t = peek();
    if (t.t === 'op' && /^[+\-*/]=$/.test(t.v)) throw new ExprError('E401', `\`${t.v}\` is an assignment and can't be used here.`, t.pos, 'Use `@set` to change a variable.');
    throw new ExprError('E400', `Unexpected \`${t.v === undefined ? t.t : t.v}\` after the end of the expression.`, t.pos, 'Join conditions with `and` / `or`.');
  }
  return ast;
}

// Assignment statement used by @set and @var: "name = expr", "name += expr", etc.
// Error positions are offsets into `src`.
export function parseAssignment(src) {
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|=(?!=))\s*(.*)$/.exec(src);
  if (!m) {
    if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*(\+\+|--)\s*$/.test(src)) {
      throw new ExprError('E402', '`++` and `--` are not supported.', 0, 'Write `@set name += 1`.');
    }
    const eq = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*===?\s*(.*)$/.exec(src);
    if (eq) throw new ExprError('E402', '`==` compares; an assignment uses a single `=`.', src.indexOf('=='), `Write \`${eq[1]} = ${eq[2].trim() || '…'}\`.`);
    throw new ExprError('E402', 'Expected `name = value` (or +=, -=, *=, /=).', 0, 'Example: `@set trust += 1`.');
  }
  if (!m[3].trim()) throw new ExprError('E402', `Missing value after \`${m[2]}\`.`, m[0].length);
  const valueOffset = m[0].length - m[3].length;
  let value;
  try { value = parseExpr(m[3]); }
  catch (e) {
    if (e instanceof ExprError && e.pos != null) e.pos += valueOffset;
    throw e;
  }
  return { name: m[1], op: m[2], value, valueOffset };
}

export function collectRefs(ast, out = { vars: [], calls: [] }) {
  if (!ast) return out;
  switch (ast.t) {
    case 'var': out.vars.push(ast); break;
    case 'call': out.calls.push(ast); ast.args.forEach(a => collectRefs(a, out)); break;
    case 'un': collectRefs(ast.a, out); break;
    case 'bin': collectRefs(ast.a, out); collectRefs(ast.b, out); break;
  }
  return out;
}

// Static type of an expression: 'number' | 'string' | 'bool' | 'any'.
export function typeOf(ast, varType) {
  switch (ast.t) {
    case 'num': return 'number';
    case 'str': return 'string';
    case 'bool': return 'bool';
    case 'var': return varType(ast.name) || 'any';
    case 'un': return ast.op === '!' ? 'bool' : 'number';
    case 'call': {
      const n = ast.name;
      if (n === 'ending_seen' || n === 'chance') return 'bool';
      if (n === 'upper' || n === 'lower') return 'string';
      return 'number';
    }
    case 'bin': {
      if (['==', '!=', '<', '<=', '>', '>=', '&&', '||'].includes(ast.op)) return 'bool';
      const a = typeOf(ast.a, varType), b = typeOf(ast.b, varType);
      if (ast.op === '+' && (a === 'string' || b === 'string')) return 'string';
      return 'number';
    }
  }
  return 'any';
}

export function truthy(v) { return !!v; }

// env: { get(name), call(name, args) }
export function evaluate(ast, env) {
  switch (ast.t) {
    case 'num': case 'str': case 'bool': return ast.v;
    case 'var': return env.get(ast.name);
    case 'call': return env.call(ast.name, ast.args.map(a => evaluate(a, env)));
    case 'un': {
      const v = evaluate(ast.a, env);
      return ast.op === '!' ? !v : -Number(v);
    }
    case 'bin': {
      if (ast.op === '&&') return truthy(evaluate(ast.a, env)) && truthy(evaluate(ast.b, env));
      if (ast.op === '||') return truthy(evaluate(ast.a, env)) || truthy(evaluate(ast.b, env));
      const a = evaluate(ast.a, env), b = evaluate(ast.b, env);
      switch (ast.op) {
        case '+': return (typeof a === 'string' || typeof b === 'string') ? String(a) + String(b) : Number(a) + Number(b);
        case '-': return Number(a) - Number(b);
        case '*': return Number(a) * Number(b);
        case '/': if (Number(b) === 0) throw new ExprError('R700', 'Division by zero.'); return Number(a) / Number(b);
        case '%': if (Number(b) === 0) throw new ExprError('R700', 'Division by zero.'); return Number(a) % Number(b);
        case '==': return a === b;
        case '!=': return a !== b;
        case '<': return a < b;
        case '<=': return a <= b;
        case '>': return a > b;
        case '>=': return a >= b;
      }
    }
  }
  throw new ExprError('R700', 'Bad expression node.');
}

export function exprToString(ast) {
  switch (ast.t) {
    case 'num': return String(ast.v);
    case 'str': return JSON.stringify(ast.v);
    case 'bool': return String(ast.v);
    case 'var': return ast.name;
    case 'call': return `${ast.name}(${ast.args.map(exprToString).join(', ')})`;
    case 'un': return ast.op === '!' ? `not ${exprToString(ast.a)}` : `-${exprToString(ast.a)}`;
    case 'bin': {
      const op = ast.op === '&&' ? 'and' : ast.op === '||' ? 'or' : ast.op;
      return `(${exprToString(ast.a)} ${op} ${exprToString(ast.b)})`;
    }
  }
  return '?';
}
