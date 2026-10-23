// Image loading, rasterising and character compositing for the stage.
// Images are rasterised once into canvases (SVG is expensive to redraw).
// Missing files become labelled placeholders, so a game is playable
// before its art exists.

import { fillTemplate } from '../core/assets.js';
import { has } from '../core/registry.js';

// An entry of a program table by a name from the script, own properties only
// (a program read back from JSON has tables with a prototype).
export const own = (table, key) => has(table, key) ? table[key] : undefined;
// A character's attribute values: no prototype, so `{group}` placeholders
// only ever match the character's own groups.
export const attrsOf = (c, attrs) => Object.assign(Object.create(null), c.defaults, attrs);

export class Assets {
  constructor(resolveUrl, program) {
    this.resolve = resolveUrl;
    this.program = program;
    this.cache = new Map();      // path -> { promise, canvas, failed }
    this.composites = new Map(); // key -> canvas
    this.warned = new Set();
  }

  load(path) {
    if (!path) return Promise.resolve(null);
    let e = this.cache.get(path);
    if (e) return e.promise;
    e = { canvas: null, failed: false };
    e.promise = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { w = 1920; h = 1080; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        try { c.getContext('2d').drawImage(img, 0, 0, w, h); } catch (err) { console.warn('[shiori] could not draw', path, err); }
        e.canvas = c;
        resolve(c);
      };
      img.onerror = () => {
        e.failed = true;
        if (!this.warned.has(path)) { this.warned.add(path); console.warn(`[shiori] image not found: ${path} (showing a placeholder)`); }
        resolve(null);
      };
      img.src = this.resolve(path);
    });
    this.cache.set(path, e);
    return e.promise;
  }

  get(path) {
    const e = this.cache.get(path);
    if (!e) { this.load(path); return null; }
    return e.canvas;
  }
  failed(path) { const e = this.cache.get(path); return !!(e && e.failed); }
  ready(path) { const e = this.cache.get(path); return !!(e && (e.canvas || e.failed)); }

  // ---- characters ---------------------------------------------------------
  layerPaths(c, attrs) {
    const a = attrsOf(c, attrs);
    if (c.sprite) return [fillTemplate(c.sprite, a)];
    return c.layers.map(l => fillTemplate(l, a));
  }
  overlayPath(c, key, attrs) {
    return c[key] ? fillTemplate(c[key], attrsOf(c, attrs)) : null;
  }

  async loadCharacter(c, attrs) {
    const paths = this.layerPaths(c, attrs);
    const extra = ['blink', 'mouth', 'side'].map(k => this.overlayPath(c, k, attrs)).filter(Boolean);
    await Promise.all(paths.concat(extra).map(p => this.load(p)));
  }

  // Composite of a character's layers for these attributes (sync; null until loaded).
  character(c, attrs) {
    const paths = this.layerPaths(c, attrs);
    const key = 'c:' + paths.join('|');
    if (this.composites.has(key)) return this.composites.get(key);
    if (!paths.length) return this.placeholderSprite(c, attrs);
    if (!paths.every(p => this.ready(p))) { paths.forEach(p => this.load(p)); return null; }
    const layers = paths.map(p => this.get(p)).filter(Boolean);
    let out;
    if (!layers.length) out = this.placeholderSprite(c, attrs);
    else if (layers.length === 1) out = layers[0];
    else {
      const w = Math.max(...layers.map(l => l.width)), h = Math.max(...layers.map(l => l.height));
      out = document.createElement('canvas');
      out.width = w; out.height = h;
      const ctx = out.getContext('2d');
      for (const l of layers) ctx.drawImage(l, 0, 0);
    }
    this.composites.set(key, out);
    return out;
  }

  // A darkened copy, for dimming characters who aren't speaking.
  dimmed(canvas, amount = 0.45) {
    if (!canvas) return null;
    const key = canvas;
    this._dim = this._dim || new WeakMap();
    if (this._dim.has(key)) return this._dim.get(key);
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(12,14,30,${amount})`;
    ctx.fillRect(0, 0, c.width, c.height);
    this._dim.set(key, c);
    return c;
  }

  placeholderSprite(c, attrs) {
    const key = 'ph:' + c.id + ':' + JSON.stringify(attrs || {});
    if (this.composites.has(key)) return this.composites.get(key);
    const w = 560, h = 980;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const col = c.color || '#9aa4c8';
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0.15)');
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(w / 2, 210, 120, 140, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 230, h); ctx.quadraticCurveTo(w / 2 - 250, 420, w / 2, 380); ctx.quadraticCurveTo(w / 2 + 250, 420, w / 2 + 230, h);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(10,12,30,0.75)';
    ctx.font = '600 42px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.name || c.id, w / 2, 640);
    ctx.font = '28px system-ui, sans-serif';
    const a = Object.values(attrsOf(c, attrs)).join(' · ');
    if (a) ctx.fillText(a, w / 2, 690);
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('(placeholder — art missing)', w / 2, 740);
    this.composites.set(key, cv);
    return cv;
  }

  placeholderImage(id, w, h, kind) {
    const key = 'phi:' + id + ':' + w + 'x' + h;
    if (this.composites.has(key)) return this.composites.get(key);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    let hue = 0; for (const ch of id) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `hsl(${hue},45%,22%)`); g.addColorStop(1, `hsl(${(hue + 60) % 360},50%,12%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let x = 0; x < w; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 ${Math.round(h / 14)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(id, w / 2, h / 2);
    ctx.font = `${Math.round(h / 36)}px system-ui, sans-serif`;
    ctx.fillText(`${kind || 'image'} placeholder — file missing`, w / 2, h / 2 + h / 18);
    this.composites.set(key, cv);
    return cv;
  }

  // Image for an asset id (background, CG, prop), or a placeholder.
  asset(id, w, h) {
    const a = own(this.program.decls.assets, id);
    if (!a) return this.placeholderImage(id, w, h);
    const c = this.get(a.path);
    if (c) return c;
    if (this.failed(a.path)) return this.placeholderImage(id, w, h, a.kind);
    return null;
  }

  // Start loading everything an effect needs. Resolves when done (or after `timeout`).
  preloadEffect(e, timeout = 2500) {
    const jobs = [];
    const decls = this.program.decls;
    const addAsset = (id) => { const a = own(decls.assets, id); if (a && a.kind === 'image') jobs.push(this.load(a.path)); };
    const addActor = (actor) => {
      if (!actor) return;
      if (actor.kind === 'character') { const c = own(decls.characters, actor.id); if (c) jobs.push(this.loadCharacter(c, actor.attrs)); }
      else addAsset(actor.id);
    };
    if (e.type === 'stage') {
      if (e.op === 'scene') { if (e.stage.bg && e.stage.bg.id) addAsset(e.stage.bg.id); }
      if (e.op === 'bg' && e.bg && e.bg.id) addAsset(e.bg.id);
      if (e.op === 'cg' && e.cg) addAsset(e.cg);
      if (e.op === 'show' || e.op === 'move') addActor(e.actor);
    }
    if (e.type === 'restore') {
      const s = e.stage;
      if (s.bg && s.bg.id) addAsset(s.bg.id);
      if (s.cg) addAsset(s.cg);
      s.actors.forEach(addActor);
    }
    if (!jobs.length) return Promise.resolve();
    return Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, timeout))]);
  }

  // Look ahead in the program and warm the cache.
  prefetch(pc, count = 60) {
    const code = this.program.code;
    const decls = this.program.decls;
    for (let i = pc; i < Math.min(code.length, pc + count); i++) {
      const ins = code[i];
      if (ins.op !== 'cmd') continue;
      const a = ins.args;
      const bg = (ins.name === 'scene' || ins.name === 'bg') && a.bg && own(decls.assets, a.bg);
      if (bg && bg.kind === 'image') this.load(bg.path);
      const cg = ins.name === 'cg' && a.image && own(decls.assets, a.image);
      if (cg) this.load(cg.path);
      if (ins.name === 'show' && a.kind === 'character') { const c = own(decls.characters, a.who); if (c) this.loadCharacter(c, a.attrs); }
      const prop = ins.name === 'show' && a.kind === 'image' && a.who && own(decls.assets, a.who);
      if (prop) this.load(prop.path);
    }
  }
}
