// Expressions, text markup and the browser text UI (regression tests for review fixes).
import { test, eq, ok, one, codes, errors, playThrough } from './harness.js';
import { VM, parseExpr, evaluate, parseMarkup, toRuns } from '../engine/core/index.js';
import { parseAssignment, exprToString } from '../engine/core/expr.js';
import { TextUI, Typewriter } from '../engine/runtime/ui.js';

const game = (body) => one('SHIORI 1\ntitle: T\n\n' + body);
const exprError = (src, parse = parseExpr) => {
  try { parse(src); } catch (e) { return e; }
  throw new Error(`no error for ${src}`);
};
const markupCodes = (text) => parseMarkup(text).errors.map(e => e.code);
const runsOf = (text, getVar = () => '') => toRuns(parseMarkup(text).tokens, getVar);

// ---- chained comparisons ------------------------------------------------------
test('chained comparisons are E400 with a rewrite hint', () => {
  const e = exprError('0 <= trust <= 3');
  eq(e.code, 'E400');
  eq(e.pos, 11, 'caret on the second comparison');
  ok(/can't be chained/.test(e.message), e.message);
  eq(e.hint, 'Write `0 <= trust and trust <= 3`.');
  eq(exprError('a == b == c').code, 'E400');
  eq(exprError('a < b != c').code, 'E400');
  eq(exprError('ok and 1 < x < 5').hint, 'Write `1 < x and x < 5`.');
  eq(exprError('not a == b == c').hint, 'Write `not (a == b and b == c)`.');
  eq(exprError('a + 1 < x < 5').hint, 'Write `(a + 1) < x and x < 5`.');
  eq(exprError('1 < x < ').hint, 'Write `1 < x and x < 5`.', 'generic hint when the rest does not parse');
});
test('single comparisons and parenthesised ones still parse', () => {
  const env = { get: (n) => ({ x: 10, flag: true })[n], call: () => 0 };
  eq(evaluate(parseExpr('1 < x and x < 5'), env), false);
  eq(evaluate(parseExpr('(1 < x) == flag'), env), true);
  eq(evaluate(parseExpr('not x == 3'), env), true);
  eq(evaluate(parseExpr('x + 1 > 2 * 3 or x < 0'), env), true);
});
test('`@if 1 < x < 5` is a compile error, not a wrong branch', () => {
  const r = game('@var x = 10\n\n# start\n@if 1 < x < 5\n  In range.\n-> END\n');
  const e = errors(r);
  eq(e.map(d => d.code), ['E400']);
  eq([e[0].line, e[0].col], [7, 11]);
});

// ---- nested tags of the same kind -----------------------------------------------
test('closing a nested tag restores the outer value', () => {
  const last = (text) => runsOf(text).filter(r => r.text).pop().style;
  eq(last('{color=#ff0000}a{color=#ffffff}b{/color} c{/color}'), { color: '#ff0000' });
  eq(last('{size=1.5}a{size=2}b{/size} c{/size}'), { size: 1.5 });
  eq(last('{speed=0.3}a{speed=2}b{/speed} c{/speed}'), { speed: 0.3 });
  eq(last('{b}a{b}b{/b} c{/b}'), { b: true });
  eq(last('{b}a{b}b{/b}{/b} c'), {});
  eq(last('{color=#ff0000}{b}a{color=#00ff00}b{/color}{/b} c{/color}'), { color: '#ff0000' });
});
test('out-of-order closes behave as before', () => {
  const { tokens, errors } = parseMarkup('{b}{i}x{/b}y{/i}z');
  eq(errors.map(e => e.code), ['E501']);
  eq(toRuns(tokens).map(r => [r.text, r.style]), [['x', { b: true, i: true }], ['y', { i: true }], ['z', {}]]);
});
test('a nested color survives into the VM say runs', () => {
  const r = game('# start\nShe hissed, {color=#ff0000}"Get {color=#ffffff}out{/color} now."{/color}\n-> END\n');
  eq(errors(r), []);
  const vm = new VM(r.program, { seed: 1 });
  const h = vm.start().halt;
  eq(h.runs.map(x => [x.text, x.style.color || null]), [['She hissed, ', null], ['"Get ', '#ff0000'], ['out', '#ffffff'], [' now."', '#ff0000']]);
});

// ---- `==` in assignments -------------------------------------------------------
test('`name == value` in @set / @var gets the dedicated E402', () => {
  const e = exprError('trust == 2', parseAssignment);
  eq([e.code, e.pos, e.hint], ['E402', 6, 'Write `trust = 2`.']);
  ok(/single `=`/.test(e.message), e.message);
  eq(exprError('trust==2', parseAssignment).pos, 5);
  eq(exprError('trust === 2', parseAssignment).hint, 'Write `trust = 2`.');
  const r = game('@var trust = 0\n@var bonus == 2\n\n# start\n@set trust == 2\nHi.\n-> END\n');
  eq(errors(r).map(d => [d.code, d.line, d.col]), [['E402', 5, 12], ['E402', 8, 12]]);
});
test('assignments still parse, and value errors point into the value', () => {
  const a = parseAssignment('flag = trust == 2');
  eq([a.name, a.op, exprToString(a.value), a.valueOffset], ['flag', '=', '(trust == 2)', 7]);
  eq(parseAssignment('x = x').valueOffset, 4);
  eq(parseAssignment('  n += 1').op, '+=');
  eq(exprError('x = x +', parseAssignment).pos, 7);
  eq(exprError('x = 1 < x < 5', parseAssignment).pos, 10);
  const r = game('@var trust = 0\n\n# start\n@set trust = trust + )\n{$trust}\n-> END\n');
  eq(errors(r).map(d => [d.code, d.col]), [['E400', 22]]);
});

// ---- numeric tag values and {nw} ------------------------------------------------
test('empty, zero and non-decimal tag numbers are E502', () => {
  for (const t of ['{w=}', '{size=}x{/size}', '{speed=}x{/speed}', '{size=0}x{/size}', '{speed=0}x{/speed}',
    '{speed=0.0}x{/speed}', '{w=0x10}', '{w=1e3}', '{speed=-1}x{/speed}', '{w=abc}', '{size}x{/size}']) {
    eq(markupCodes('Hi ' + t), ['E502'], t);
  }
  ok(parseMarkup('{w=}').errors[0].hint.includes('{w}'), 'hint mentions {w}');
});
test('valid tag numbers still pass', () => {
  for (const t of ['{w=0}', '{w=0.5}', '{w=2}', '{w}', '{size=.5}x{/size}', '{size=1.5}x{/size}', '{speed=2}x{/speed}', '{w=1.}']) {
    eq(markupCodes('Hi ' + t), [], t);
  }
  eq(runsOf('a{w=.25}b').find(r => r.wait != null).wait, 0.25);
});
test('{nw} followed by a variable is E502', () => {
  eq(markupCodes('Hello{nw}{$name}'), ['E502']);
  eq(markupCodes('Hello {$name}{nw}'), []);
  eq(markupCodes('Hello{nw}  '), []);
});

// ---- tags inside {ruby} ---------------------------------------------------------
test('only text and {$var} may go inside {ruby}', () => {
  for (const t of ['{ruby=とうきょう}{b}東京{/b}{/ruby}', '{ruby=r}ab{w}cd{/ruby}', '{ruby=r}ab{w=0.5}cd{/ruby}',
    '{ruby=r}ab{br}cd{/ruby}', '{ruby=r}ab{nw}{/ruby}', '{ruby=a}x{ruby=b}y{/ruby}{/ruby}', '{ruby=a}{color=#ff0000}x{/color}{/ruby}']) {
    eq(markupCodes(t), ['E502'], t);
  }
  const e = parseMarkup('{ruby=とうきょう}{b}東京{/b}{/ruby}').errors[0];
  eq(e.hint, 'Put it around the whole ruby: `{b}{ruby=...}…{/ruby}{/b}`.');
  eq(markupCodes('{b}{ruby=とうきょう}東京{/ruby}{/b} {ruby=x}{$v}!{/ruby}'), []);
  eq(runsOf('{b}{ruby=とうきょう}東京{/ruby}{/b}'), [{ text: '東京', ruby: 'とうきょう', style: { b: true } }]);
  eq(runsOf('{ruby=x}{$v}!{/ruby}', () => 'Mio'), [{ text: 'Mio!', ruby: 'x', style: {} }]);
});
test('toRuns keeps the base text of a nested ruby', () => {
  eq(runsOf('{ruby=a}x{ruby=b}y{/ruby}{/ruby}z').map(r => [r.text, r.ruby]), [['xy', 'a'], ['z', undefined]]);
  const stray = toRuns([{ t: 'text', s: 'a' }, { t: 'close', tag: 'ruby' }, { t: 'text', s: 'b' }]);
  eq(stray.map(r => r.text), ['a', 'b'], 'a stray close adds no empty ruby');
});

// ---- backslash escapes in strings ----------------------------------------------
test('unknown backslash escapes in strings are E400', () => {
  const e = exprError('"Line one\\nLine two"');
  eq([e.code, e.pos], ['E400', 9]);
  ok(/Unknown escape `\\n`/.test(e.message), e.message);
  ok(e.hint.includes('{br}'), e.hint);
  ok(exprError('"wait\\u2014what"').hint.includes('—'), 'hint for \\u');
  eq(exprError("'C:\\temp'").code, 'E400');
  const r = game('@var note = "Line one\\nLine two"\n\n# start\n{$note}\n-> END\n');
  eq(errors(r).filter(d => d.code === 'E400').map(d => [d.line, d.col]), [[4, 22]]);
});
test('\\" \\\' and \\\\ still work in strings', () => {
  const v = (src) => parseExpr(src).v;
  eq(v('"say \\"hi\\""'), 'say "hi"');
  eq(v("'it\\'s'"), "it's");
  eq(v('"a\\\\b"'), 'a\\b');
  eq(v('"don\\\'t"'), "don't");
  const r = game('@var path = "C:\\\\temp"\n\n# start\nThe path is {$path}\n-> END\n');
  eq(errors(r), []);
  eq(playThrough(r.program, []).lines, ['The path is C:\\temp']);
});

// ---- browser text UI (engine/runtime/ui.js) with a tiny DOM stub ---------------
class FakeNode {
  constructor(tag) {
    this.tagName = tag; this.children = []; this._text = ''; this.attrs = {}; this.classes = new Set();
    this.style = { setProperty: (k, v) => { this.style[k] = v; } };
    const self = this;
    this.classList = {
      add: (...c) => c.forEach(x => self.classes.add(x)), remove: (...c) => c.forEach(x => self.classes.delete(x)),
      toggle: (c, on) => { if (on === undefined ? !self.classes.has(c) : on) self.classes.add(c); else self.classes.delete(c); },
      contains: (c) => self.classes.has(c),
    };
  }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(' '); }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener() {}
  focus() {}
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  get scrollHeight() { return 0; }
  get clientHeight() { return 0; }
}
const html = (n) => n.tagName === '#text' ? n._text : `<${n.tagName}>${n._text}${n.children.map(html).join('')}</${n.tagName}>`;
const all = (n, out = []) => { out.push(n); n.children.forEach(c => all(c, out)); return out; };
function withDom(fn) {
  const keys = ['document', 'setTimeout', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const saved = keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]);
  globalThis.document = { createElement: (t) => new FakeNode(t), createTextNode: (s) => { const n = new FakeNode('#text'); n._text = s; return n; } };
  globalThis.setTimeout = () => 0;
  globalThis.performance = { now: () => 0 };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  try { return fn(); }
  finally { for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } }
}
const newUI = (header = {}) => new TextUI(new FakeNode('div'), { program: { header }, sidePortrait: () => null });

test('choice buttons render ruby readings and {br}', () => withDom(() => {
  const ui = newUI();
  const runs = runsOf('Visit {b}{ruby=とうきょう}東京{/ruby}{/b}{br}tonight');
  ui.menu({ options: [{ index: 0, runs, plain: 'Visit 東京\ntonight', disabled: false, seen: false }] }, () => {});
  const label = ui.choices.children[0].children[1];
  eq(html(label), '<span><span>Visit </span><ruby>東京<rt>とうきょう</rt></ruby><br></br><span>tonight</span></span>');
  eq(label.children[1].style.fontWeight, '700', 'ruby keeps its style');
  ok(all(label).every(n => !n.classes.has('sh-ch')), 'choice text is not hidden for a typewriter');
}));
test('restoring an NVL page shows each paragraph\'s text', () => withDom(() => {
  const ui = newUI({ dialogue_quotes: '「」' });
  ui.sync({ mode: 'nvl', page: [
    { who: 'mio', name: 'Mio', color: '#f68', runs: runsOf('Hello{w} there.') },
    { who: null, name: null, color: null, runs: runsOf('The {ruby=かぜ}風{/ruby} rises.{br}Night.') },
  ] });
  const paras = ui.nvlPage.children;
  eq(paras.map(p => p.textContent), ['Mio「Hello there.」', 'The 風かぜ rises.Night.']);
  const letters = all(ui.nvlPage).filter(n => n.classes.has('sh-ch'));
  ok(letters.length > 10 && letters.every(n => n.classes.has('on')), 'every restored letter is visible, also after a {w}');
  ok(all(paras[1]).some(n => n.tagName === 'br') && all(paras[1]).some(n => n.tagName === 'rt'), 'br and ruby restored');
  ui.sync({ mode: 'adv', page: [] });
  eq(ui.nvlPage.children.length, 0);
}));
test('instant text stops at a {w}, and one click shows the rest', () => withDom(() => {
  const box = new FakeNode('div');
  const tw = new Typewriter(box);
  let done = 0, waits = 0;
  tw.start(runsOf('ab{w}{ruby=r}c{/ruby}d'), { cps: 0, onDone: () => done++, onClickWait: () => waits++ });
  const on = () => all(box).filter(n => n.classes.has('sh-ch') && n.classes.has('on')).length;
  eq([on(), waits, done], [2, 1, 0]);
  eq(box.textContent, 'abcrd');
  ok(tw.waiting && tw.click(), 'the click is used');
  eq([on(), done, tw.typing], [4, 1, false]);
  eq(tw.click(), false, 'a finished line does not use clicks');
}));
test('typed text stops at a {w} and continues after the click', () => withDom(() => {
  const box = new FakeNode('div');
  const tw = new Typewriter(box);
  let done = 0;
  tw.start(runsOf('ab{w}cd'), { cps: 10, onDone: () => done++ });
  tw.advanceTo(1);
  eq([tw.waiting, done], [true, 0]);
  tw.click();
  eq([tw.waiting, tw.typing], [false, true]);
  tw.click();
  eq(done, 1);
}));
test('a live NVL line is typed into its paragraph', () => withDom(() => {
  const ui = newUI();
  let done = 0;
  ui.say({ name: 'Mio', color: null, runs: runsOf('Hi {b}there{/b}.'), plain: 'Hi there.', mode: 'nvl' }, { cps: 0, onDone: () => done++ });
  eq(done, 1);
  eq(ui.nvlPage.children.map(p => p.textContent), ['MioHi there.▼']);
  eq(all(ui.nvlPage).filter(n => n.classes.has('sh-ch')).length, 'Hi there.'.length, 'letters are not duplicated');
}));
