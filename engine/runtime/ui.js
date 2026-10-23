// In-game text UI: ADV textbox, NVL page, choices, cards, input, toasts.
// Built from DOM elements over the stage canvas, in game pixels.

export function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = (s) => segmenter ? Array.from(segmenter.segment(s), x => x.segment) : Array.from(s);

function styleSpan(span, style, index) {
  if (style.b) span.style.fontWeight = '700';
  if (style.i) span.style.fontStyle = 'italic';
  const deco = [];
  if (style.u) deco.push('underline');
  if (style.s) deco.push('line-through');
  if (deco.length) span.style.textDecoration = deco.join(' ');
  if (style.color) span.style.color = style.color;
  if (style.size) span.style.fontSize = style.size + 'em';
  if (style.shake) { span.classList.add('sh-shake'); span.style.animationDelay = (-(index * 0.137) % 0.3) + 's'; }
  if (style.wave) { span.classList.add('sh-wave'); span.style.animationDelay = (index * 0.07) + 's'; }
}

// Builds the DOM for styled runs (markup.js toRuns) inside `container`: <ruby>
// for {ruby}, <br> for {br}, styled spans for text. Every place that shows runs
// uses this, so they all render markup the same way.
//   letters (default): one `sh-ch` element per letter, hidden until it gets the
//     class `on` (the typewriter reveals them); `shown` makes them visible at once.
//   letters: false: one visible span per run (choice buttons).
// `per` is seconds per letter. Returns { units, total }: units are { node, at }
// (reveal time in seconds) and { click: true, at } for each {w}.
function renderRuns(container, runs, { quotes = null, per = 0, letters = true, shown = false } = {}) {
  const units = [];
  const cls = letters ? (shown ? 'sh-ch on' : 'sh-ch') : null;
  let t = 0, idx = 0;
  const add = (node, style) => {
    if (cls) node.className = cls;
    styleSpan(node, style || {}, idx++);
    container.appendChild(node);
    units.push({ node, at: t });
  };
  const addText = (text, style) => {
    if (!text) return;
    if (!letters) { const s = document.createElement('span'); s.textContent = text; add(s, style); return; }
    for (const g of graphemes(text)) {
      const s = document.createElement('span');
      s.textContent = g;
      add(s, style);
      const mult = style && style.speed ? style.speed : 1;
      t += per / mult * (/[.!?。！？…]/.test(g) ? 4 : /[,、;:—]/.test(g) ? 2 : 1);
    }
  };
  if (quotes) addText(quotes[0], {});
  for (const r of runs) {
    if (r.br) { container.appendChild(document.createElement('br')); continue; }
    if (r.wait != null) { t += r.wait; continue; }
    if (r.click) { units.push({ click: true, at: t }); continue; }
    if (r.ruby != null) {
      const rb = document.createElement('ruby');
      rb.appendChild(document.createTextNode(r.text));
      const rt = document.createElement('rt'); rt.textContent = r.ruby; rb.appendChild(rt);
      add(rb, r.style);
      t += per * Math.max(1, graphemes(r.text).length);
      continue;
    }
    addText(r.text, r.style);
  }
  if (quotes) addText(quotes[1] || quotes[0], {});
  return { units, total: t };
}

// Reveals styled runs letter by letter. Supports {w=s} pauses and {w} click-waits.
export class Typewriter {
  constructor(container) {
    this.el = container;
    this.units = [];
    this.raf = null;
  }
  start(runs, { cps = 45, quotes = null, onDone, onClickWait } = {}) {
    this.stop();
    this.el.textContent = '';
    this.onDone = onDone; this.onClickWait = onClickWait;
    const per = cps > 0 ? 1 / cps : 0;
    const { units, total } = renderRuns(this.el, runs, { quotes, per });
    this.units = units;  // { node, at } or { click: true } markers
    this.total = total;
    this.pos = 0;            // index of next unit to reveal
    this.clock = 0;          // seconds since the current segment began
    this.offset = 0;         // 'at' time where the current segment began
    this.waitingClick = false;
    this.finished = false;
    this.last = performance.now();
    this.instant = per === 0;
    if (this.instant) { this.revealUntilClick(); return; }
    const tick = (now) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!this.waitingClick && !this.finished) {
        this.clock += dt;
        this.advanceTo(this.offset + this.clock);
      }
      if (!this.finished) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
  advanceTo(time) {
    while (this.pos < this.units.length && this.units[this.pos].at <= time) {
      const u = this.units[this.pos];
      if (u.click) { this.pos++; this.pauseForClick(u.at); return; }
      u.node.classList.add('on');
      this.pos++;
    }
    if (this.pos >= this.units.length && time >= this.total) this.finish();
  }
  pauseForClick(at) {
    this.waitingClick = true;
    this.offset = at; this.clock = 0;
    if (this.onClickWait) this.onClickWait();
  }
  revealUntilClick() {
    while (this.pos < this.units.length) {
      const u = this.units[this.pos];
      if (u.click) { this.pos++; this.pauseForClick(u.at); return; }
      u.node.classList.add('on');
      this.pos++;
    }
    this.finish();
  }
  // A click while typing: show the rest of this segment (up to the next {w}).
  // A click at a {w}: continue typing. Returns true if the click was used.
  click() {
    if (this.finished) return false;
    if (this.waitingClick) {
      this.waitingClick = false; this.last = performance.now();
      if (this.instant) this.revealUntilClick();  // no ticking: show the next segment now
      return true;
    }
    this.revealUntilClick();
    return true;
  }
  finish() {
    if (this.finished) return;
    this.finished = true;
    this.waitingClick = false;
    for (const u of this.units) if (u.node) u.node.classList.add('on');
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.onDone) this.onDone();
  }
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; this.finished = true; }
  get typing() { return !this.finished && !this.waitingClick; }
  get waiting() { return this.waitingClick; }
}

// Narration under @pov: who and the name shown, so a @rename starts a new run.
const povKey = (entry) => entry.pov && !entry.name ? (entry.pov.who || '') + '\u0000' + (entry.pov.name || '') : null;

export class TextUI {
  constructor(root, player) {
    this.root = root;
    this.player = player;
    const header = player.program.header;
    this.quotes = header.dialogue_quotes ? Array.from(header.dialogue_quotes) : null;

    this.adv = el('div', 'sh-adv', root);
    this.side = el('img', 'sh-side', this.adv);
    this.side.alt = '';
    this.namebox = el('div', 'sh-namebox', this.adv);
    this.name = el('span', 'sh-name', this.namebox);
    this.pov = el('div', 'sh-pov', this.adv);
    this.box = el('div', 'sh-textbox', this.adv);
    this.text = el('div', 'sh-text', this.box);
    this.ctc = el('span', 'sh-ctc', this.box, '▼');
    this.typer = new Typewriter(this.text);

    this.nvl = el('div', 'sh-nvl', root);
    this.nvlPage = el('div', 'sh-nvl-page', this.nvl);
    this.nvlTyper = null;
    this.nvlPov = null;      // POV run of the page's last paragraph

    this.choices = el('div', 'sh-choices', root);
    this.card = el('div', 'sh-card', root);
    this.toastEl = el('div', 'sh-toast', root);
    this.modeEl = el('div', 'sh-modebadge', root);
    this.live = el('div', 'sh-live', root);
    this.live.setAttribute('aria-live', 'polite');
    this.live.setAttribute('role', 'log');
    this.mode = 'adv';
    this.hidden = false;
    this.setMode('adv');
    this.showBox(false);
  }

  setMode(mode) {
    this.mode = mode;
    this.root.classList.toggle('sh-mode-nvl', mode === 'nvl');
    this.root.classList.toggle('sh-mode-adv', mode !== 'nvl');
  }

  showBox(on) {
    this.boxVisible = on;
    this.root.classList.toggle('sh-box-off', !on);
  }

  setHidden(on) { this.hidden = on; this.root.classList.toggle('sh-ui-hidden', on); }

  applyText(e) {
    if (e.op === 'mode') { this.setMode(e.mode); this.clearNvl(); }
    if (e.op === 'clear') this.clearNvl();
    if (e.op === 'textbox') this.showBox(e.visible);
  }

  // Restore (load, rollback, rollforward): rebuild the NVL page with its text shown.
  sync(text) {
    this.setMode(text.mode || 'adv');
    this.clearNvl();
    if (text.mode === 'nvl') for (const p of text.page || []) this.appendNvl(p, true);
  }

  clearNvl() {
    if (this.nvlTyper) this.nvlTyper.stop();
    this.nvlPage.textContent = '';
    this.nvlPov = null;
  }

  // One NVL paragraph: the speaker's name, then the text. instant: the text is
  // shown at once (a restored page); otherwise its letters are laid out hidden,
  // ready for the typewriter, so the page can be measured.
  // Narration under @pov gets a bar in the POV character's colour. The first
  // paragraph of each run of narration under the same POV (and shown name) on
  // a page also shows that name, so colour is never the only cue.
  addNvlParagraph(entry, instant) {
    const p = el('p', 'sh-nvl-p' + (entry.who || entry.name ? ' sh-nvl-dialogue' : ''), this.nvlPage);
    const pov = povKey(entry);
    let povName = null;
    if (pov) {
      p.classList.add('sh-nvl-pov'); p.style.setProperty('--pov', entry.pov.color || '#aab');
      if (pov !== this.nvlPov) { povName = entry.pov.name; el('span', 'sh-nvl-povname', p, povName); }
    }
    this.nvlPov = pov;
    if (entry.name) {
      const n = el('span', 'sh-nvl-name', p, entry.name);
      if (entry.color) n.style.color = entry.color;
    }
    const body = el('span', 'sh-nvl-text', p);
    renderRuns(body, entry.runs || [], { quotes: entry.name && this.quotes ? this.quotes : null, shown: !!instant });
    return { p, body, povName };
  }

  // Adds a paragraph, first turning the page when it would not fit.
  appendNvl(entry, instant) {
    let r = this.addNvlParagraph(entry, instant);
    if (this.nvlPage.scrollHeight > this.nvlPage.clientHeight + 2 && this.nvlPage.children.length > 1) {
      this.clearNvl();
      r = this.addNvlParagraph(entry, instant);
    }
    return r;
  }

  // Show a line. Calls onDone when fully revealed; onClickWait at {w}.
  say(h, { cps, onDone, onClickWait }) {
    const isDialogue = !!h.name;
    const quotes = isDialogue && this.quotes ? this.quotes : null;
    // Screen readers hear the POV name where it is shown: on every ADV line,
    // on the first paragraph of a POV run in NVL.
    const announce = (povName) => { this.live.textContent = (h.name ? h.name + ': ' : povName != null ? '(' + povName + ') ' : '') + h.plain; };
    this.ctc.classList.remove('on');
    this.choices.classList.remove('on');
    this.showBox(true);
    if (h.mode === 'nvl') {
      this.setMode('nvl');
      const { p, body, povName } = this.appendNvl(h);  // turns the page when it is full
      announce(povName);
      this.nvlTyper = new Typewriter(body);
      this.nvlCtc = el('span', 'sh-ctc sh-nvl-ctc', p, '▼');
      this.nvlTyper.start(h.runs, { cps, quotes, onDone: () => { this.nvlCtc.classList.add('on'); onDone && onDone(); }, onClickWait: () => { this.nvlCtc.classList.add('on'); onClickWait && onClickWait(); } });
      this.activeTyper = this.nvlTyper;
      return;
    }
    this.setMode('adv');
    announce(h.pov && !isDialogue ? h.pov.name : null);
    this.root.classList.toggle('sh-narration', !isDialogue);
    this.namebox.classList.toggle('on', isDialogue);
    this.name.textContent = h.name || '';
    this.namebox.style.setProperty('--name-color', h.color || 'var(--sh-accent)');
    if (h.pov && !isDialogue) {
      this.pov.textContent = h.pov.name;
      this.pov.style.setProperty('--pov', h.pov.color || 'var(--sh-accent)');
      this.pov.classList.add('on');
    } else this.pov.classList.remove('on');
    const sideUrl = this.player.sidePortrait(h);
    if (sideUrl) { this.side.src = sideUrl; this.side.classList.add('on'); this.root.classList.add('sh-has-side'); }
    else { this.side.classList.remove('on'); this.root.classList.remove('sh-has-side'); }
    const showCtc = () => { this.text.appendChild(this.ctc); this.ctc.classList.add('on'); };
    this.typer.start(h.runs, {
      cps, quotes,
      onDone: () => { showCtc(); onDone && onDone(); },
      onClickWait: () => { showCtc(); onClickWait && onClickWait(); },
    });
    this.activeTyper = this.typer;
  }

  // Returns true if the click was consumed by the typewriter.
  click() {
    const t = this.activeTyper;
    if (!t) return false;
    const used = t.click();
    if (used) { this.ctc.classList.remove('on'); if (this.nvlCtc) this.nvlCtc.classList.remove('on'); }
    return used;
  }
  get typing() { return !!(this.activeTyper && this.activeTyper.typing); }
  get waitingInLine() { return !!(this.activeTyper && this.activeTyper.waiting); }
  finishLine() { if (this.activeTyper) this.activeTyper.finish(); }
  endLine() { if (this.nvlCtc) this.nvlCtc.classList.remove('on'); this.ctc.classList.remove('on'); }

  menu(h, onChoose) {
    this.choices.textContent = '';
    this.choices.classList.add('on');
    const buttons = [];
    h.options.forEach((o, i) => {
      const b = el('button', 'sh-choice' + (o.disabled ? ' locked' : '') + (o.seen ? ' seen' : ''), this.choices);
      b.type = 'button';
      const num = el('span', 'sh-choice-n', b, String(i + 1));
      num.setAttribute('aria-hidden', 'true');
      const label = el('span', 'sh-choice-t', b);
      renderRuns(label, o.runs, { letters: false });
      if (o.disabled) { b.disabled = true; b.title = o.hint || 'Locked'; el('span', 'sh-lock', b, '🔒'); if (o.hint) el('span', 'sh-choice-hint', label, o.hint); }
      b.addEventListener('click', (ev) => { ev.stopPropagation(); if (!o.disabled) { this.choices.classList.remove('on'); onChoose(o.index); } });
      buttons.push({ b, o });
    });
    this.menuButtons = buttons;
    const first = buttons.find(x => !x.o.disabled);
    if (first) setTimeout(() => first.b.focus({ preventScroll: true }), 30);
    this.live.textContent = 'Choice: ' + h.options.filter(o => !o.disabled).map(o => o.plain).join(' / ');
  }

  chooseByNumber(n) {
    const x = this.menuButtons && this.menuButtons[n - 1];
    if (x && !x.o.disabled && this.choices.classList.contains('on')) { x.b.click(); return true; }
    return false;
  }

  hideMenu() { this.choices.classList.remove('on'); this.choices.textContent = ''; this.menuButtons = null; }

  showCard(kind, title, subtitle) {
    this.card.className = 'sh-card on sh-card-' + kind;
    this.card.textContent = '';
    if (kind === 'ending') el('div', 'sh-card-kicker', this.card, 'Ending');
    el('div', 'sh-card-title', this.card, title);
    if (subtitle) el('div', 'sh-card-sub', this.card, subtitle);
    this.live.textContent = (kind === 'ending' ? 'Ending: ' : '') + title + (subtitle ? ' — ' + subtitle : '');
  }
  hideCard() { this.card.className = 'sh-card'; }

  input(h, onSubmit) {
    const wrap = el('div', 'sh-input', this.root);
    const form = el('form', 'sh-input-form', wrap);
    el('label', 'sh-input-label', form, h.prompt || 'Enter text');
    const field = el('input', 'sh-input-field', form);
    field.value = h.default || '';
    field.maxLength = h.max || 24;
    const ok = el('button', 'sh-btn', form, 'OK');
    ok.type = 'submit';
    form.addEventListener('submit', (ev) => { ev.preventDefault(); wrap.remove(); onSubmit(field.value); });
    wrap.addEventListener('click', (ev) => ev.stopPropagation());
    setTimeout(() => { field.focus(); field.select(); }, 30);
  }

  toast(msg, ms = 1800) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('on');
    clearTimeout(this._toast);
    this._toast = setTimeout(() => this.toastEl.classList.remove('on'), ms);
  }

  setModeBadge(text) {
    this.modeEl.textContent = text || '';
    this.modeEl.classList.toggle('on', !!text);
  }
}
