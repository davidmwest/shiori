// Menu screens: title, save/load, settings, backlog, extras (gallery,
// endings, music room), confirm dialogs.

import { el } from './ui.js';
import { own } from './assets.js';

const SLOTS_PER_PAGE = 9;
const PAGES = 6;

function fmtTime(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export class Screens {
  constructor(root, player) {
    this.root = root;
    this.player = player;
    this.layer = el('div', 'sh-screens', root);
    this.stack = [];
    this.layer.addEventListener('click', (e) => e.stopPropagation());
    this.layer.addEventListener('wheel', (e) => e.stopPropagation());
  }

  get open() { return this.stack.length > 0; }
  get top() { return this.stack[this.stack.length - 1]; }

  push(name, build, opts = {}) {
    const s = el('div', 'sh-screen sh-screen-' + name + (opts.overlay ? ' sh-overlay' : ''), this.layer);
    s.setAttribute('role', 'dialog');
    s.setAttribute('aria-label', opts.label || name);
    const entry = { name, el: s, opts };
    this.stack.push(entry);
    build(s, entry);
    this.layer.classList.add('on');
    this.root.classList.toggle('sh-screen-open', this.stack.some(x => !x.opts.overlay) && name !== 'title');
    const focusable = s.querySelector('button:not([disabled]), [tabindex], input');
    if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 20);
    return entry;
  }

  pop() {
    const e = this.stack.pop();
    if (e) { e.el.remove(); if (e.opts.onClose) e.opts.onClose(); }
    if (!this.stack.length) this.layer.classList.remove('on');
    this.root.classList.toggle('sh-screen-open', this.stack.some(x => !x.opts.overlay && x.name !== 'title'));
  }

  closeAll() { while (this.stack.length) this.pop(); }

  back() {
    const t = this.top;
    if (!t || t.name === 'title') return false;
    this.pop();
    return true;
  }

  header(s, title) {
    const h = el('div', 'sh-screen-head', s);
    el('h2', 'sh-heading', h, title);
    const close = el('button', 'sh-btn sh-close', h, 'Back');
    close.type = 'button';
    close.addEventListener('click', () => this.pop());
    return h;
  }

  // ---- title -------------------------------------------------------------
  title() {
    const p = this.player, h = p.program.header;
    this.push('title', (s) => {
      el('div', 'sh-title-veil', s);
      const box = el('div', 'sh-title-box', s);
      if (h.original_title) el('div', 'sh-title-orig', box, h.original_title);
      el('h1', 'sh-title-name', box, h.title);
      const menu = el('div', 'sh-title-menu', box);
      const btn = (label, fn, disabled) => { const b = el('button', 'sh-title-btn', menu, label); b.type = 'button'; b.disabled = !!disabled; b.addEventListener('click', fn); return b; };
      const latest = p.storage.latest();
      btn('Start', () => p.newGame());
      btn('Continue', () => p.loadSlot(latest.slot), !latest);
      btn('Load', () => this.saveLoad('load'));
      btn('Extras', () => this.extras());
      btn('Settings', () => this.settings());
      const foot = el('div', 'sh-title-foot', s);
      foot.textContent = [h.developer, h.version ? 'v' + h.version : null, 'Shiori engine'].filter(Boolean).join(' · ');
    }, { label: 'Title screen' });
  }

  // ---- save / load ----------------------------------------------------------
  saveLoad(mode, page) {
    const p = this.player;
    this.page = page != null ? page : (this.page || 0);
    this.push('saveload', (s, entry) => {
      this.header(s, mode === 'save' ? 'Save' : 'Load');
      const tabs = el('div', 'sh-tabs', s);
      const grid = el('div', 'sh-slots', s);
      const render = () => {
        tabs.textContent = '';
        const pages = ['auto', 'quick', ...Array.from({ length: PAGES }, (_, i) => String(i + 1))];
        for (const pg of pages) {
          const t = el('button', 'sh-tab' + (String(this.page) === pg ? ' on' : ''), tabs, pg === 'auto' ? 'Auto' : pg === 'quick' ? 'Quick' : pg);
          t.type = 'button';
          t.addEventListener('click', () => { this.page = pg; render(); });
        }
        grid.textContent = '';
        const slots = p.storage.slots();
        let ids;
        if (this.page === 'auto') ids = ['auto1', 'auto2', 'auto3'];
        else if (this.page === 'quick') ids = ['quick'];
        else { const n = Number(this.page) || 1; ids = Array.from({ length: SLOTS_PER_PAGE }, (_, i) => String((n - 1) * SLOTS_PER_PAGE + i + 1)); }
        if (String(this.page) === '0') this.page = '1';
        for (const id of ids) {
          const meta = slots[id];
          const b = el('button', 'sh-slot' + (meta ? '' : ' empty'), grid);
          b.type = 'button';
          const th = el('div', 'sh-slot-thumb', b);
          if (meta && meta.thumb) th.style.backgroundImage = `url(${meta.thumb})`;
          const info = el('div', 'sh-slot-info', b);
          el('div', 'sh-slot-id', info, isNaN(Number(id)) ? id.replace(/\d$/, ' $&') : 'Slot ' + id);
          if (meta) {
            el('div', 'sh-slot-date', info, fmtTime(meta.time));
            if (meta.chapter) el('div', 'sh-slot-chapter', info, meta.chapter);
            el('div', 'sh-slot-preview', info, meta.preview || '');
          } else el('div', 'sh-slot-preview', info, mode === 'save' ? 'Empty — click to save' : 'Empty');
          const canUse = mode === 'save' ? (!id.startsWith('auto') && p.canSave()) : !!meta;
          b.disabled = !canUse;
          b.addEventListener('click', () => {
            if (mode === 'save') {
              const doSave = () => { p.saveSlot(id); render(); };
              if (meta) this.confirm('Overwrite this save?', doSave); else doSave();
            } else {
              const doLoad = () => { this.closeAll(); p.loadSlot(id); };
              if (p.inGame) this.confirm('Load this save? Unsaved progress will be lost.', doLoad); else doLoad();
            }
          });
          if (meta) {
            const del = el('span', 'sh-slot-del', b, '✕');
            del.title = 'Delete';
            del.setAttribute('role', 'button');
            del.addEventListener('click', (ev) => { ev.stopPropagation(); this.confirm('Delete this save?', () => { p.storage.remove(id); render(); }); });
          }
        }
      };
      render();
    }, { label: mode === 'save' ? 'Save game' : 'Load game' });
  }

  confirm(message, onYes) {
    this.push('confirm', (s) => {
      const box = el('div', 'sh-confirm', s);
      el('p', null, box, message);
      const row = el('div', 'sh-row', box);
      const yes = el('button', 'sh-btn sh-primary', row, 'Yes'); yes.type = 'button';
      const no = el('button', 'sh-btn', row, 'No'); no.type = 'button';
      yes.addEventListener('click', () => { this.pop(); onYes(); });
      no.addEventListener('click', () => this.pop());
    }, { overlay: true, label: 'Confirm' });
  }

  // ---- settings ------------------------------------------------------------
  settings() {
    const p = this.player;
    this.push('settings', (s) => {
      this.header(s, 'Settings');
      const body = el('div', 'sh-settings', s);
      const S = p.settings;
      const section = (title) => { const sec = el('section', 'sh-set-section', body); el('h3', null, sec, title); return sec; };
      const slider = (sec, label, key, min, max, step, fmt) => {
        const row = el('label', 'sh-set-row', sec);
        el('span', 'sh-set-label', row, label);
        const input = el('input', 'sh-range', row);
        input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = S[key];
        const val = el('span', 'sh-set-val', row, fmt(S[key]));
        input.addEventListener('input', () => { S[key] = Number(input.value); val.textContent = fmt(S[key]); p.settingsChanged(key); });
      };
      const toggle = (sec, label, key) => {
        const row = el('label', 'sh-set-row sh-toggle', sec);
        el('span', 'sh-set-label', row, label);
        const input = el('input', null, row);
        input.type = 'checkbox'; input.checked = !!S[key];
        input.addEventListener('change', () => { S[key] = input.checked; p.settingsChanged(key); });
      };
      const pct = (v) => Math.round(v * 100) + '%';
      const text = section('Text');
      slider(text, 'Text speed', 'textSpeed', 0, 120, 5, (v) => v === 0 ? 'Instant' : v + ' cps');
      slider(text, 'Auto-forward delay', 'autoDelay', 0.3, 5, 0.1, (v) => v.toFixed(1) + ' s');
      slider(text, 'Text size', 'textScale', 0.8, 1.5, 0.05, pct);
      slider(text, 'Textbox opacity', 'textboxOpacity', 0.3, 1, 0.02, pct);
      toggle(text, 'Skip unread text too', 'skipUnread');
      toggle(text, 'Dim characters who aren\'t speaking', 'dimInactive');
      const snd = section('Sound');
      slider(snd, 'Master', 'master', 0, 1, 0.01, pct);
      slider(snd, 'Music', 'music', 0, 1, 0.01, pct);
      slider(snd, 'Ambience', 'ambience', 0, 1, 0.01, pct);
      slider(snd, 'Sound effects', 'sound', 0, 1, 0.01, pct);
      slider(snd, 'Voices', 'voice', 0, 1, 0.01, pct);
      const acc = section('Accessibility & display');
      toggle(acc, 'Reduce motion (no shakes, flashes or bobbing)', 'reduceMotion');
      toggle(acc, 'Read text aloud (self-voicing)', 'selfVoicing');
      toggle(acc, 'High-contrast text', 'highContrast');
      const row = el('div', 'sh-set-row', acc);
      el('span', 'sh-set-label', row, 'Fullscreen');
      const fs = el('button', 'sh-btn', row, document.fullscreenElement ? 'Exit' : 'Enter');
      fs.type = 'button';
      fs.addEventListener('click', () => { p.toggleFullscreen(); setTimeout(() => { fs.textContent = document.fullscreenElement ? 'Exit' : 'Enter'; }, 200); });
      const q = el('label', 'sh-set-row', acc);
      el('span', 'sh-set-label', q, '3D quality');
      const sel = el('select', 'sh-select', q);
      for (const v of ['high', 'low']) { const o = el('option', null, sel, v); o.value = v; if (S.quality === v) o.selected = true; }
      sel.addEventListener('change', () => { S.quality = sel.value; p.settingsChanged('quality'); });
      const keys = section('Controls');
      el('p', 'sh-keys', keys, 'Click / Space / Enter: next · Wheel up / PageUp: back · Wheel down: forward · Ctrl (hold) or Tab: skip · A: auto · L: backlog · H or right-click: hide text · S or F5: quick save · F9: quick load · Esc: menu · F: fullscreen · 1–9: choose');
    }, { label: 'Settings' });
  }

  // ---- backlog ----------------------------------------------------------------
  backlog() {
    const p = this.player;
    this.push('backlog', (s) => {
      this.header(s, 'History');
      const list = el('div', 'sh-log', s);
      list.tabIndex = 0;
      for (const b of p.vm.backlog) {
        const row = el('div', 'sh-log-row' + (b.choice ? ' sh-log-choice' : ''), list);
        if (b.choice) { el('span', 'sh-log-text', row, '▸ ' + b.text); continue; }
        if (b.name) { const n = el('span', 'sh-log-name', row, b.name); if (b.color) n.style.color = b.color; }
        el('span', 'sh-log-text', row, b.text);
        if (b.voice) {
          const v = el('button', 'sh-btn sh-log-voice', row, '♪'); v.type = 'button';
          v.title = 'Replay voice';
          v.addEventListener('click', () => p.audio.playVoice(b.voice));
        }
      }
      setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
    }, { label: 'History' });
  }

  // ---- extras -------------------------------------------------------------------
  extras(tab = 'gallery') {
    const p = this.player, decls = p.program.decls, per = p.vm.persistent;
    this.push('extras', (s) => {
      this.header(s, 'Extras');
      const tabs = el('div', 'sh-tabs', s);
      const body = el('div', 'sh-extras', s);
      const render = (name) => {
        tabs.textContent = '';
        for (const [k, label] of [['gallery', 'Gallery'], ['endings', 'Endings'], ['music', 'Music'], ['credits', 'About']]) {
          const t = el('button', 'sh-tab' + (k === name ? ' on' : ''), tabs, label); t.type = 'button';
          t.addEventListener('click', () => render(k));
        }
        body.textContent = '';
        if (name === 'gallery') {
          const cgs = Object.values(decls.assets).filter(a => a.kind === 'image' && a.usedAs && a.usedAs.cg);
          const grid = el('div', 'sh-gallery', body);
          if (!cgs.length) el('p', 'sh-empty', body, 'This game has no event CGs.');
          for (const a of cgs) {
            const open = !!own(per.cgs, a.id);
            const b = el('button', 'sh-cg' + (open ? '' : ' locked'), grid); b.type = 'button';
            if (open) b.style.backgroundImage = `url(${p.resolveUrl(a.path)})`;
            el('span', 'sh-cg-title', b, open ? (a.opts.title || a.id) : '???');
            b.disabled = !open;
            b.addEventListener('click', () => this.viewImage(p.resolveUrl(a.path), a.opts.title || a.id));
          }
        }
        if (name === 'endings') {
          const list = el('div', 'sh-endings', body);
          const all = Object.values(decls.endings);
          el('p', 'sh-ending-count', body, `${all.filter(e => own(per.endings, e.id)).length} of ${all.length} endings reached`);
          for (const e of all) {
            const got = own(per.endings, e.id);
            const row = el('div', 'sh-ending' + (got ? '' : ' locked') + ' sh-kind-' + e.kind, list);
            el('span', 'sh-ending-kind', row, got ? e.kind : '?');
            el('span', 'sh-ending-title', row, got ? e.title : '???');
            if (got) el('span', 'sh-ending-date', row, fmtTime(got.first));
          }
        }
        if (name === 'music') {
          const tracks = Object.values(decls.assets).filter(a => a.kind === 'audio' && a.usedAs && a.usedAs.music && a.opts.room !== false);
          const list = el('div', 'sh-music', body);
          if (!tracks.length) el('p', 'sh-empty', body, 'No music yet.');
          for (const a of tracks) {
            const open = !!own(per.music, a.id);
            const b = el('button', 'sh-track' + (open ? '' : ' locked'), list); b.type = 'button';
            el('span', 'sh-track-title', b, open ? (a.opts.title || a.id) : '???');
            b.disabled = !open;
            b.addEventListener('click', () => { p.audio.unlock(); p.audio.preview(a.id); list.querySelectorAll('.sh-track').forEach(x => x.classList.remove('playing')); b.classList.add('playing'); });
          }
          const stop = el('button', 'sh-btn', body, 'Stop'); stop.type = 'button';
          stop.addEventListener('click', () => { p.audio.stopMusic(0.8); list.querySelectorAll('.sh-track').forEach(x => x.classList.remove('playing')); });
        }
        if (name === 'credits') {
          const h = p.program.header;
          const box = el('div', 'sh-about', body);
          el('h3', null, box, h.title);
          if (h.description) el('p', null, box, h.description);
          if (h.developer) el('p', null, box, 'Developer: ' + h.developer);
          if (h.author) el('p', null, box, 'Writing: ' + h.author);
          if (h.credits) el('p', null, box, h.credits);
          if (h.ai_generated && h.ai_generated.length && !h.ai_generated.includes('none')) el('p', 'sh-ai-note', box, 'Made with AI-generated: ' + h.ai_generated.join(', ') + '.');
          el('p', 'sh-muted', box, 'Made with Shiori.');
        }
      };
      render(tab);
    }, { label: 'Extras', onClose: () => { if (!p.inGame) p.playTitleMusic(); } });
  }

  viewImage(url, title) {
    this.push('viewer', (s) => {
      const img = el('img', 'sh-viewer-img', s);
      img.src = url; img.alt = title;
      s.addEventListener('click', () => this.pop());
    }, { overlay: true, label: title });
  }

  // ---- in-game menu -------------------------------------------------------
  gameMenu() {
    const p = this.player;
    this.push('menu', (s) => {
      this.header(s, 'Menu');
      const m = el('div', 'sh-game-menu', s);
      const btn = (label, fn) => { const b = el('button', 'sh-title-btn', m, label); b.type = 'button'; b.addEventListener('click', fn); };
      btn('Resume', () => this.pop());
      btn('Save', () => this.saveLoad('save'));
      btn('Load', () => this.saveLoad('load'));
      btn('History', () => this.backlog());
      btn('Settings', () => this.settings());
      btn('Extras', () => this.extras());
      btn('Title screen', () => this.confirm('Return to the title screen? Unsaved progress will be lost.', () => p.toTitle()));
    }, { label: 'Menu' });
  }

  // ---- errors -------------------------------------------------------------
  diagnostics(list, title = 'This game has errors') {
    this.push('errors', (s) => {
      el('h2', 'sh-heading', s, title);
      el('p', 'sh-muted', s, 'Fix these in the .story files, then reload. `shiori check` prints the same list.');
      const pre = el('pre', 'sh-diag', s);
      pre.textContent = list;
    }, { label: title });
  }
}
