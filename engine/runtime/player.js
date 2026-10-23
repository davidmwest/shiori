// The browser player: loads a game folder, compiles it, and drives the VM
// with the stage, UI, audio, saves and input.

import { prepareProject } from '../core/compiler.js';
import { VM } from '../core/vm.js';
import { formatDiagnostic, summary } from '../core/diagnostics.js';
import { fillTemplate } from '../core/assets.js';
import { Stage } from './stage2d.js';
import { Assets } from './assets.js';
import { AudioMixer } from './audio.js';
import { TextUI, el } from './ui.js';
import { Screens } from './screens.js';
import { Storage } from './storage.js';
import { DevTools } from './dev.js';

const slug = (s) => String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';

export class Player {
  constructor({ mount, gamePath, engineBase, params = {} }) {
    this.mount = mount;
    this.gamePath = gamePath.replace(/\/?$/, '/');
    this.engineBase = engineBase;
    this.params = params;
    this.gameBase = new URL(this.gamePath, location.href);
    this.halt = null;
    this.inGame = false;
    this.skipping = false;
    this.ctrlSkip = false;
    this.auto = false;
    this.token = 0;
    this.scriptedChoices = params.choices ? String(params.choices).split(',').map(Number).filter(n => n > 0) : [];
    this.effectHandlers = {};
  }

  resolveUrl = (p) => /^(https?:|data:|blob:)/.test(p) ? p : new URL(p, this.gameBase).href;

  async readText(p) {
    try {
      const r = await fetch(new URL(p, this.gameBase), { cache: 'no-store' });
      return r.ok ? await r.text() : null;
    } catch { return null; }
  }

  importModule = (p) => import(new URL(p, this.gameBase).href + (this.devMode ? '?t=' + Date.now() : ''));

  async compile() {
    return prepareProject({ readText: (p) => this.readText(p), importModule: (p) => this.importModule(p) });
  }

  async boot() {
    this.devMode = !!this.params.dev;
    const res = await this.compile();
    this.res = res;
    const errors = res.diagnostics.filter(d => d.severity === 'error');
    if (!res.program || errors.length) {
      this.bootError(errors.length ? errors : [{ severity: 'error', code: 'E113', message: 'Could not load game.story from ' + this.gameBase.href }]);
      return;
    }
    this.program = res.program;
    const h = this.program.header;
    document.title = h.title + (h.original_title ? ' — ' + h.original_title : '');
    this.storage = new Storage(slug(h.title));
    this.settings = this.storage.loadSettings();
    if (this.settings._fromHeader !== h.title) {
      if (h.text_speed != null && this.storage.json('settings', null) == null) this.settings.textSpeed = h.text_speed;
      if (h.auto_delay != null && this.storage.json('settings', null) == null) this.settings.autoDelay = h.auto_delay;
    }
    this.buildDom();
    this.assets = new Assets(this.resolveUrl, this.program);
    this.stage = new Stage({ canvas: this.canvas, program: this.program, assets: this.assets, settings: this.settings, resolveUrl: this.resolveUrl, loadModule: this.importModule });
    this.audio = new AudioMixer({ program: this.program, resolveUrl: this.resolveUrl, settings: this.settings, engineBase: this.engineBase });
    this.ui = new TextUI(this.root, this);
    this.buildQuickMenu();
    this.screens = new Screens(this.root, this);
    for (const m of res.modules || []) {
      const fx = m.module.runtime && m.module.runtime.effects;
      if (fx) Object.assign(this.effectHandlers, fx);
      if (m.module.runtime && m.module.runtime.init) { try { m.module.runtime.init(this); } catch (e) { console.warn('[shiori] module init failed', m.path, e); } }
    }
    this.makeVM();
    this.bindInput();
    this.applySettingsToDom();
    this.startLoop();
    this.exposeApi();
    if (this.devMode) this.dev = new DevTools(this);
    const warnings = res.diagnostics.filter(d => d.severity === 'warning');
    if (warnings.length) console.info(`[shiori] ${summary(res.diagnostics)}\n` + warnings.map(formatDiagnostic).join('\n\n'));
    if (this.params.scene || this.params.autostart) this.gateThen(() => this.newGame(this.params.scene || null));
    else this.toTitle();
  }

  makeVM() {
    const persistent = this.storage.loadPersistent();
    this.vm = new VM(this.program, {
      registry: this.res.registry,
      persistent,
      onPersistentChange: () => {
        clearTimeout(this._pt);
        this._pt = setTimeout(() => this.flushPersistent(), 400);
      },
    });
  }

  // Write persistent data (read lines, seen choices, endings) now if a write
  // is waiting: the tab may be closing.
  flushPersistent() {
    if (this._pt == null) return;
    clearTimeout(this._pt);
    this._pt = null;
    this.storage.savePersistent(this.vm.persistent);
  }

  bootError(list) {
    this.mount.textContent = '';
    const box = el('div', 'sh-boot-error', this.mount);
    el('h1', null, box, 'This game has errors');
    el('p', null, box, 'Fix them in the .story files and reload. `shiori check` prints the same list.');
    el('pre', null, box, list.map(formatDiagnostic).join('\n\n'));
    console.error('[shiori] ' + summary(list) + '\n' + list.map(formatDiagnostic).join('\n\n'));
    window.shiori = { errors: list };
  }

  // ---- DOM --------------------------------------------------------------
  buildDom() {
    const { width: W, height: H } = this.program.header;
    this.mount.textContent = '';
    this.mount.classList.add('sh-mount');
    this.root = el('div', 'shiori', this.mount);
    this.root.style.width = W + 'px';
    this.root.style.height = H + 'px';
    this.root.tabIndex = 0;
    this.canvas = el('canvas', 'sh-stage', this.root);
    this.canvas.setAttribute('aria-hidden', 'true');
    this.gameLayer = el('div', 'sh-game', this.root);
    this.videoLayer = el('div', 'sh-video', this.root);
    const theme = this.program.header.theme;
    if (theme) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = this.resolveUrl(theme); document.head.appendChild(link); }
    if (this.program.header.font) this.root.style.setProperty('--sh-font', this.program.header.font);
    const fit = () => {
      const mw = this.mount.clientWidth || window.innerWidth, mh = this.mount.clientHeight || window.innerHeight;
      const k = Math.min(mw / W, mh / H);
      this.scale = k;
      this.root.style.transform = `translate(${Math.round((mw - W * k) / 2)}px, ${Math.round((mh - H * k) / 2)}px) scale(${k})`;
    };
    window.addEventListener('resize', fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(this.mount);
    fit();
  }

  buildQuickMenu() {
    const qm = el('div', 'sh-qm', this.ui.adv);
    const add = (label, title, fn, cls) => {
      const b = el('button', 'sh-qm-btn' + (cls ? ' ' + cls : ''), qm, label);
      b.type = 'button'; b.title = title;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); b.blur(); });
      return b;
    };
    add('Back', 'Roll back (wheel up)', () => this.back());
    add('Log', 'History (L)', () => this.openScreen('backlog'));
    this.autoBtn = add('Auto', 'Auto mode (A)', () => this.toggleAuto());
    this.skipBtn = add('Skip', 'Skip (Tab / hold Ctrl)', () => this.toggleSkip());
    add('Save', 'Save', () => this.openScreen('save'));
    add('Load', 'Load', () => this.openScreen('load'));
    add('Q.Save', 'Quick save (S)', () => this.quickSave());
    add('Q.Load', 'Quick load (F9)', () => this.quickLoad());
    add('Settings', 'Settings', () => this.openScreen('settings'));
    add('Menu', 'Menu (Esc)', () => this.openScreen('menu'));
    // NVL gets the same bar
    this.ui.nvl.appendChild(qm.cloneNode(true));
    const clone = this.ui.nvl.lastChild;
    const btns = clone.querySelectorAll('button');
    const orig = qm.querySelectorAll('button');
    btns.forEach((b, i) => b.addEventListener('click', (e) => { e.stopPropagation(); orig[i].click(); }));
    this.nvlSkipBtn = btns[3]; this.nvlAutoBtn = btns[2];
  }

  applySettingsToDom() {
    const s = this.settings;
    this.root.style.setProperty('--sh-text-scale', s.textScale);
    this.root.style.setProperty('--sh-box-alpha', s.textboxOpacity);
    this.root.classList.toggle('sh-contrast', !!s.highContrast);
    this.root.classList.toggle('sh-reduce-motion', !!s.reduceMotion);
  }

  settingsChanged(key) {
    this.storage.saveSettings(this.settings);
    this.applySettingsToDom();
    if (['master', 'music', 'sound', 'voice', 'ambience'].includes(key)) this.audio.applySettings(this.settings);
    if (key === 'selfVoicing' && !this.settings.selfVoicing && window.speechSynthesis) speechSynthesis.cancel();
  }

  openScreen(name) {
    if (name === 'save') return this.screens.saveLoad('save');
    if (name === 'load') return this.screens.saveLoad('load');
    if (name === 'backlog') return this.screens.backlog();
    if (name === 'settings') return this.screens.settings();
    if (name === 'menu') return this.screens.gameMenu();
    if (name === 'extras') return this.screens.extras();
  }

  // A one-time "click to start" so audio is allowed to play.
  gateThen(fn) {
    if (this.audio.unlocked) return fn();
    const gate = el('button', 'sh-gate', this.root, '▶  Click to start');
    gate.type = 'button';
    const go = (e) => { e.stopPropagation(); gate.remove(); this.audio.unlock(); fn(); };
    gate.addEventListener('click', go);
    gate.focus();
  }

  // ---- loop -------------------------------------------------------------
  startLoop() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      try { this.stage.update(dt); this.stage.render(); } catch (err) { console.error('[shiori] render error', err); }
      if (this.dev) this.dev.frame(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  // ---- game flow ----------------------------------------------------------
  newGame(scene) {
    this.screens.closeAll();
    this.audio.unlock();
    this.inGame = true;
    this.stopModes();
    if (this.params.skip) this.setSkip(true);
    const vars = {};
    if (this.params.set) for (const kv of String(this.params.set).split(',')) {
      const [k, v] = kv.split(/[:=]/);
      const d = this.program.decls.vars[k];
      if (d) vars[k] = d.type === 'number' ? Number(v) : d.type === 'bool' ? v === 'true' : v;
    }
    this.handle(this.vm.start(scene || null, { vars }));
  }

  async handle(r) {
    if (!r) return;
    const token = ++this.token;
    this.halt = null;
    clearTimeout(this.waitTimer); clearTimeout(this.autoTimer); clearTimeout(this.skipTimer);
    this.ui.hideMenu();
    for (const e of r.effects) {
      if (this.skipping && e.type === 'stage') e.instant = true;
      if (e.type === 'restore' || (e.type === 'stage' && ['scene', 'bg', 'cg', 'show', 'move'].includes(e.op))) {
        await this.stage.prepare(e);
        if (token !== this.token) return;
      }
      this.applyEffect(e);
    }
    if (token !== this.token) return;
    this.present(r.halt);
  }

  applyEffect(e) {
    switch (e.type) {
      case 'restore':
        this.stage.sync(e.stage);
        this.audio.sync(e.audio);
        this.ui.sync(e.text);
        this.ui.showBox(e.stage.textbox !== false);
        return;
      case 'stage': return this.stage.apply(e);
      case 'audio': return this.audio.apply(e);
      case 'text': if (e.op !== 'pov') this.ui.applyText(e); return;
      case 'log': console.log('[story]', e.text, e.loc ? `(${e.loc.file}:${e.loc.line})` : ''); if (this.dev) this.dev.log(e); return;
      case 'warning': case 'error':
        console.warn(`[shiori] ${e.code} ${e.message}`, e.loc ? `(${e.loc.file}:${e.loc.line})` : '');
        if (this.dev) this.dev.log(e);
        return;
      default: {
        const fn = this.effectHandlers[e.type];
        if (fn) { try { fn(e, this); } catch (err) { console.warn('[shiori] effect handler failed', e.type, err); } }
        // `scene` marks each scene entry, for modules and tools; the player has nothing to do.
        else if (e.type !== 'scene') console.warn('[shiori] no handler for effect', e.type);
      }
    }
  }

  present(h) {
    this.halt = h;
    if (this.dev) this.dev.update();
    switch (h.type) {
      case 'say': return this.presentSay(h);
      case 'menu': return this.presentMenu(h);
      case 'wait': {
        const secs = this.skipping ? 0 : h.seconds;
        this.waitTimer = setTimeout(() => { if (this.halt === h) { this.stage.finishAll(); this.advance(); } }, secs * 1000);
        return;
      }
      case 'pause':
        this.stage.setSpeaking(null, false);
        if (this.skipping || this.auto) this.skipTimer = setTimeout(() => { if (this.halt === h) this.advance(); }, this.skipping ? 50 : this.settings.autoDelay * 1000 + 600);
        return;
      case 'chapter':
        this.ui.showCard('chapter', h.title, h.subtitle);
        this.autosave();
        this.waitTimer = setTimeout(() => { if (this.halt === h) this.next(); }, (this.skipping ? 0.4 : h.seconds) * 1000);
        return;
      case 'ending':
        this.ui.showCard('ending', h.title, h.first ? 'New ending reached' : null);
        this.stopModes();
        return;
      case 'input':
        this.stopModes();
        this.ui.input(h, (v) => this.handle(this.vm.submit(v)));
        return;
      case 'game': return this.runGame(h);
      case 'video': return this.playVideo(h);
      case 'end': return this.endGame(h);
      case 'error':
        console.error(`[shiori] ${h.code} ${h.message}`, h.loc || '');
        if (this.dev) this.dev.log(h);
        this.ui.toast(`Story error ${h.code}: ${h.message}`, 6000);
        this.stopModes();
        this.halt = { type: 'end' };
        setTimeout(() => this.toTitle(), 4000);
        return;
    }
  }

  presentSay(h) {
    this.lineDone = false;
    const speaking = h.who && this.stage.actors.has(h.who) ? h.who : null;
    this.stage.setSpeaking(h.who, !!speaking);
    if (this.skipping && !h.read && !this.settings.skipUnread && !this.params.skip) this.setSkip(false);
    if (h.voice && !this.skipping) this.audio.playVoice(h.voice); else if (!h.voice) this.audio.stopVoice();
    if (this.settings.selfVoicing && window.speechSynthesis && !this.skipping) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance((h.name ? h.name + '. ' : '') + h.plain);
      u.lang = this.program.header.language || 'en';
      speechSynthesis.speak(u);
    }
    this.ui.say(h, {
      cps: this.skipping ? 0 : this.settings.textSpeed,
      onDone: () => this.lineFinished(h),
      onClickWait: () => { this.stage.setSpeaking(h.who, false); this.scheduleAuto(h, true); },
    });
    this.assets.prefetch(this.vm.state.pc);
  }

  lineFinished(h) {
    if (this.halt !== h) return;
    this.lineDone = true;
    this.stage.setSpeaking(h.who, false);
    if (h.nw) { this.skipTimer = setTimeout(() => { if (this.halt === h) this.next(); }, 120); return; }
    if (this.skipping) { this.skipTimer = setTimeout(() => { if (this.halt === h) this.next(); }, 45); return; }
    this.scheduleAuto(h);
  }

  scheduleAuto(h, midLine) {
    if (!this.auto) return;
    clearTimeout(this.autoTimer);
    const wait = () => {
      if (this.halt !== h) return;
      if (this.audio.voicePlaying || (window.speechSynthesis && speechSynthesis.speaking && this.settings.selfVoicing)) { this.autoTimer = setTimeout(wait, 200); return; }
      this.next();
    };
    const len = h.plain.length;
    this.autoTimer = setTimeout(wait, (this.settings.autoDelay + Math.min(4, len * 0.018)) * 1000);
  }

  presentMenu(h) {
    this.stage.setSpeaking(null, false);
    this.autosave();
    if (this.scriptedChoices.length) {
      const n = this.scriptedChoices.shift();
      const o = h.options.find(x => x.index === n - 1 && !x.disabled);
      if (o) { setTimeout(() => this.choose(o.index), this.skipping ? 30 : 400); return; }
      console.warn(`[shiori] scripted choice ${n} is not available here`);
      this.scriptedChoices = [];
    }
    this.setSkip(false);
    this.params.skip = false;
    this.ui.menu(h, (i) => this.choose(i));
  }

  choose(i) {
    if (!this.halt || this.halt.type !== 'menu') return;
    this.ui.hideMenu();
    this.handle(this.vm.choose(i));
  }

  advance() {
    this.halt = null;
    this.handle(this.vm.advance());
  }

  // Click / Space / Enter / auto / skip.
  next() {
    if (this.screens.open) return;
    if (this.ui.hidden) { this.ui.setHidden(false); return; }
    const h = this.halt;
    if (!h) { if (this.stage.busy) this.stage.finishAll(); return; }
    switch (h.type) {
      case 'say':
        if (this.ui.typing || this.ui.waitingInLine) { this.ui.click(); if (!this.ui.waitingInLine && !this.ui.typing) this.stage.setSpeaking(h.who, false); return; }
        this.ui.endLine();
        if (this.settings.selfVoicing && window.speechSynthesis) speechSynthesis.cancel();
        this.advance();
        return;
      case 'pause': this.advance(); return;
      case 'wait': clearTimeout(this.waitTimer); this.stage.finishAll(); this.advance(); return;
      case 'chapter': case 'ending':
        clearTimeout(this.waitTimer);
        this.ui.hideCard();
        this.advance();
        return;
      case 'end': this.toTitle(); return;
    }
  }

  back() {
    if (!this.inGame || !this.vm.canRollback() || this.screens.open) return;
    this.stopModes();
    this.audio.stopVoice();
    this.ui.hideCard();
    const r = this.vm.rollback();
    if (r) this.handle(r);
  }

  forward() {
    if (!this.inGame || this.screens.open) return false;
    if (!this.vm.canRollforward()) return false;
    this.audio.stopVoice();
    const r = this.vm.rollforward();
    if (r) this.handle(r);
    return true;
  }

  stopModes() { this.setSkip(false); this.setAuto(false); }

  setSkip(on) {
    this.skipping = !!on;
    this.skipBtn && this.skipBtn.classList.toggle('on', this.skipping);
    this.nvlSkipBtn && this.nvlSkipBtn.classList.toggle('on', this.skipping);
    this.ui && this.ui.setModeBadge(this.skipping ? 'Skip ▸▸' : this.auto ? 'Auto ▸' : '');
    if (on && this.halt) {
      if (this.halt.type === 'say') { if (this.lineDone) this.next(); else this.ui.finishLine(); }
      else if (this.halt.type === 'wait' || this.halt.type === 'pause' || this.halt.type === 'chapter') this.next();
      this.stage.finishAll();
    }
  }
  toggleSkip() { if (this.inGame) this.setSkip(!this.skipping); }

  setAuto(on) {
    this.auto = !!on;
    this.autoBtn && this.autoBtn.classList.toggle('on', this.auto);
    this.nvlAutoBtn && this.nvlAutoBtn.classList.toggle('on', this.auto);
    this.ui && this.ui.setModeBadge(this.skipping ? 'Skip ▸▸' : this.auto ? 'Auto ▸' : '');
    if (on && this.halt && this.halt.type === 'say' && this.lineDone) this.scheduleAuto(this.halt);
    if (!on) clearTimeout(this.autoTimer);
  }
  toggleAuto() { if (this.inGame) this.setAuto(!this.auto); }

  // ---- saves --------------------------------------------------------------
  canSave() { return this.inGame && this.halt && ['say', 'menu', 'pause', 'chapter', 'ending'].includes(this.halt.type); }

  saveSlot(slot, quiet) {
    if (!this.canSave()) { if (!quiet) this.ui.toast('You can\'t save right now.'); return false; }
    const save = this.vm.save();
    const ok = this.storage.save(slot, save, this.stage.thumbnail());
    if (!quiet) this.ui.toast(ok ? 'Saved.' : 'Saving failed (storage full or blocked).');
    return ok;
  }

  loadSlot(slot) {
    const save = this.storage.load(slot);
    if (!save) { this.ui.toast('That slot is empty.'); return; }
    this.screens.closeAll();
    this.audio.unlock();
    this.inGame = true;
    this.stopModes();
    this.ui.hideCard();
    try { this.handle(this.vm.load(save)); }
    catch (e) { this.ui.toast('Could not load: ' + e.message, 4000); }
  }

  quickSave() { if (this.saveSlot('quick', true)) this.ui.toast('Quick saved.'); else this.ui.toast('You can\'t save right now.'); }
  quickLoad() { if (this.storage.load('quick')) this.loadSlot('quick'); else this.ui.toast('No quick save yet.'); }

  autosave() {
    if (!this.inGame) return;
    const now = Date.now();
    if (this._lastAuto && now - this._lastAuto < 20000) return;
    this._lastAuto = now;
    const slots = this.storage.slots();
    const ids = ['auto1', 'auto2', 'auto3'];
    const oldest = ids.slice().sort((a, b) => ((slots[a] && slots[a].time) || 0) - ((slots[b] && slots[b].time) || 0))[0];
    this.saveSlot(oldest, true);
  }

  // ---- title / end -----------------------------------------------------
  async toTitle() {
    ++this.token;
    clearTimeout(this.waitTimer); clearTimeout(this.autoTimer); clearTimeout(this.skipTimer);
    this.inGame = false;
    this.halt = null;
    this.stopModes();
    this.ui.hideMenu(); this.ui.hideCard(); this.ui.showBox(false); this.ui.clearNvl(); this.ui.setMode('adv');
    this.audio.stopVoice();
    const h = this.program.header;
    const id = h.title_background;
    const a = id && this.program.decls.assets[id];
    const stage = { bg: a ? { kind: a.kind === 'world' ? 'world' : 'image', id } : { kind: 'color', color: '#0b0e1c' }, actors: [], cg: null,
      camera: { zoom: 1, x: 0, y: 0, rotate: 0, from: a && a.opts.camera || null, look: null, fov: null },
      weather: a ? null : { type: 'stars', intensity: 1, wind: 0, layer: 'front' }, filter: 'none', tint: null, textbox: false };
    await this.stage.prepare({ type: 'restore', stage });
    this.stage.sync(stage);
    this.screens.closeAll();
    this.screens.title();
    this.playTitleMusic();
    if (!this.audio.unlocked) {
      const unlock = () => { this.audio.unlock(); this.playTitleMusic(); this.root.removeEventListener('pointerdown', unlock, true); this.root.removeEventListener('keydown', unlock, true); };
      this.root.addEventListener('pointerdown', unlock, true);
      this.root.addEventListener('keydown', unlock, true);
    }
  }

  playTitleMusic() {
    const t = this.program.header.title_music;
    if (t && this.program.decls.assets[t]) this.audio.playMusic({ id: t, volume: 1, loop: true }, 1.5);
    else this.audio.stopMusic(1.5);
  }

  endGame(h) {
    this.stopModes();
    this.ui.showBox(false);
    this.audio.stopMusic(3);
    this.stage.beginTransition('fade', 2.5);
    this.stage.setBg({ kind: 'color', color: '#000' });
    this.stage.actors = new Map(); this.stage.cg = null; this.stage.weathers = [];
    this.endTimer = setTimeout(() => { if (this.halt === h) this.toTitle(); }, 3200);
  }

  // ---- gameplay & video -------------------------------------------------
  async runGame(h) {
    this.stopModes();
    this.ui.showBox(false);
    const layer = this.gameLayer;
    layer.textContent = '';
    layer.classList.add('on');
    const container = el('div', 'sh-game-inner', layer);
    const ctl = new AbortController();
    let result = null;
    try {
      const mod = await this.importModule(h.path);
      const play = mod.default || mod.play;
      if (typeof play !== 'function') throw new Error('a gameplay module must export default async function play({ container, params })');
      result = await play({ container, params: h.params || {}, width: this.program.header.width, height: this.program.header.height, signal: ctl.signal, player: this });
    } catch (e) {
      console.error('[shiori] gameplay failed', e);
      this.ui.toast('Gameplay module failed: ' + e.message, 5000);
      result = h.results && h.results[0] || null;
    }
    layer.classList.remove('on');
    layer.textContent = '';
    if (this.halt === h) this.handle(this.vm.submit(result));
  }

  playVideo(h) {
    this.ui.showBox(false);
    const a = this.program.decls.assets[h.id];
    const layer = this.videoLayer;
    layer.textContent = '';
    layer.classList.add('on');
    const v = el('video', 'sh-video-el', layer);
    v.src = this.resolveUrl(a.path);
    v.playsInline = true;
    v.autoplay = true;
    const done = () => { layer.classList.remove('on'); layer.textContent = ''; if (this.halt === h) this.advance(); };
    v.addEventListener('ended', done);
    v.addEventListener('error', () => { console.warn('[shiori] video failed', a.path); done(); });
    if (h.skippable) layer.addEventListener('click', (e) => { e.stopPropagation(); v.pause(); done(); }, { once: true });
    v.play().catch(() => {});
  }

  sidePortrait(h) {
    if (!h.who) return null;
    const c = this.program.decls.characters[h.who];
    if (!c || !c.side) return null;
    return this.resolveUrl(fillTemplate(c.side, { ...c.defaults, ...(h.attrs || {}) }));
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else (this.mount.requestFullscreen || this.mount.webkitRequestFullscreen).call(this.mount);
  }

  // Effects other modules can call.
  flash(color, time) { this.stage.flash(color, time); }
  get particles() { return { burst: (o) => this.stage.burst(o) }; }

  // ---- input --------------------------------------------------------------
  bindInput() {
    const root = this.root;
    root.addEventListener('click', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button, input, select, a, .sh-input')) return;
      this.next();
    });
    root.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.screens.open) { this.screens.back(); return; }
      if (this.inGame) this.ui.setHidden(!this.ui.hidden);
    });
    root.addEventListener('wheel', (e) => {
      if (this.screens.open || !this.inGame) return;
      if (e.deltaY < -10) { e.preventDefault(); this.back(); }
      else if (e.deltaY > 10) { e.preventDefault(); if (!this.forward() && this.halt && this.halt.type !== 'menu') this.next(); }
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (typing) return;
      const onButton = tag === 'BUTTON';
      if (e.key === 'Control') { if (this.inGame && !this.ctrlSkip && !this.screens.open) { this.ctrlSkip = true; this.setSkip(true); } return; }
      if (e.key === 'Escape') { e.preventDefault(); if (this.screens.open) this.screens.back(); else if (this.ui.hidden) this.ui.setHidden(false); else if (this.inGame) this.openScreen('menu'); return; }
      if (this.screens.open) return;
      if ((e.key === ' ' || e.key === 'Enter') && !onButton) { e.preventDefault(); this.next(); return; }
      if (e.key === 'PageUp' || (e.key === 'ArrowUp' && !(this.halt && this.halt.type === 'menu'))) { e.preventDefault(); this.back(); return; }
      if (e.key === 'PageDown') { e.preventDefault(); this.forward(); return; }
      if (e.key === 'Tab') { e.preventDefault(); this.toggleSkip(); return; }
      if (e.key === 'F5' || e.key === 's' || e.key === 'S') { e.preventDefault(); if (this.inGame) this.quickSave(); return; }
      if (e.key === 'F9') { e.preventDefault(); this.quickLoad(); return; }
      if (e.key === 'a' || e.key === 'A') { this.toggleAuto(); return; }
      if (e.key === 'l' || e.key === 'L') { if (this.inGame) this.openScreen('backlog'); return; }
      if (e.key === 'h' || e.key === 'H') { if (this.inGame) this.ui.setHidden(!this.ui.hidden); return; }
      if (e.key === 'f' || e.key === 'F') { this.toggleFullscreen(); return; }
      if (e.key === '`' || e.key === '~') { if (!this.dev) this.dev = new DevTools(this); else this.dev.toggle(); return; }
      if (/^[1-9]$/.test(e.key) && this.halt && this.halt.type === 'menu') { this.ui.chooseByNumber(Number(e.key)); return; }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && this.halt && this.halt.type === 'menu') {
        e.preventDefault();
        const btns = [...this.root.querySelectorAll('.sh-choice:not(.locked)')];
        const i = btns.indexOf(document.activeElement);
        const n = e.key === 'ArrowDown' ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length;
        if (btns[n]) btns[n].focus();
      }
    });
    window.addEventListener('keyup', (e) => { if (e.key === 'Control' && this.ctrlSkip) { this.ctrlSkip = false; this.setSkip(false); } });
    window.addEventListener('blur', () => { if (this.ctrlSkip) { this.ctrlSkip = false; this.setSkip(false); } });
    // Persistent writes wait 400 ms; don't lose the last ones when the tab closes or is hidden.
    window.addEventListener('pagehide', () => this.flushPersistent());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flushPersistent(); });
  }

  // ---- automation / dev -----------------------------------------------
  exposeApi() {
    const p = this;
    window.shiori = {
      player: p,
      get vm() { return p.vm; },
      get program() { return p.program; },
      state: () => p.vm.state,
      halt: () => p.halt,
      advance: () => p.next(),
      choose: (n) => p.choose(n - 1),
      jump: (scene) => { p.screens.closeAll(); p.inGame = true; p.audio.unlock(); if (!p.vm.state) return p.newGame(scene); return p.handle(p.vm.jump(scene)); },
      start: (scene) => p.newGame(scene),
      screenshot: () => p.stage.screenshot(),
      save: () => p.vm.save(),
      load: (save) => p.handle(p.vm.load(save)),
      skip: (on = true) => p.setSkip(on),
      diagnostics: () => p.res.diagnostics,
      reload: () => p.reload(),
    };
  }

  // Recompile from disk and continue at the same line (dev live reload).
  async reload() {
    const res = await this.compile();
    const errors = res.diagnostics.filter(d => d.severity === 'error');
    if (errors.length) {
      if (this.dev) this.dev.showErrors(errors);
      else this.screens.diagnostics(errors.map(formatDiagnostic).join('\n\n'));
      return false;
    }
    if (this.dev) this.dev.showErrors([]);
    const save = this.inGame && this.vm.state ? this.vm.save() : null;
    const persistent = this.vm.persistent;
    this.res = res;
    this.program = res.program;
    this.stage.program = this.program;
    this.assets.program = this.program;
    this.audio.program = this.program;
    this.storage.savePersistent(persistent);
    this.makeVM();
    if (save) this.handle(this.vm.load(save));
    this.ui.toast('Reloaded.');
    return true;
  }
}
