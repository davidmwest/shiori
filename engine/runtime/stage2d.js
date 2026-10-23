// The stage compositor (Canvas 2D). Draws the VM's stage model: background
// (image, color or 3D world), characters and props, CG, weather, filters,
// tint, and screen-level transitions, flashes and shakes.
//
// Pipeline per frame:  compose picture -> this.frame  ->  visible canvas
// (transitions blend a snapshot of the old picture with the live new one).

import { Tweens, EASE, lerp } from './tween.js';
import { Weather, Burst } from './particles.js';
import { own, blinks } from './assets.js';

const TAU = Math.PI * 2;

export class Stage {
  constructor({ canvas, program, assets, settings, resolveUrl, loadModule }) {
    this.program = program;
    this.assets = assets;
    this.settings = settings;
    this.resolveUrl = resolveUrl;
    this.loadModule = loadModule;
    this.W = program.header.width;
    this.H = program.header.height;
    this.canvas = canvas;
    canvas.width = this.W; canvas.height = this.H;
    this.ctx = canvas.getContext('2d');
    this.frame = this.makeCanvas();
    this.fctx = this.frame.getContext('2d');
    this.prev = this.makeCanvas();
    this.scratch = this.makeCanvas(Math.ceil(this.W / 8), Math.ceil(this.H / 8));
    this.tweens = new Tweens();
    this.t = 0;
    this.reset();
    this.frozen = false;
    this.world = null;
    this.worldError = null;
    this.bursts = [];
    this.onFrame = null;
  }

  makeCanvas(w = this.W, h = this.H) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  reset() {
    this.bg = null;
    this.actors = new Map();
    this.order = 0;
    this.cg = null; this.cgAlpha = 0;
    this.camera = { zoom: 1, x: 0, y: 0, rotate: 0 };
    this.weathers = [];
    this.filters = [];               // [{ name, amount }]
    this.tint = { color: null, alpha: 0 };
    this.flashFx = { color: '#fff', alpha: 0 };
    this.shakeFx = { t: 0, dur: 0, strength: 0 };
    this.transition = null;
    this.speaking = null;
    this.typing = false;
  }

  get reduceMotion() { return !!this.settings.reduceMotion; }

  // ---- async preparation (worlds, images) ------------------------------
  async prepare(e) {
    let stage = null;
    if (e.type === 'restore') stage = e.stage;
    if (e.type === 'stage' && e.op === 'scene') stage = e.stage;
    const bg = stage ? stage.bg : (e.type === 'stage' && e.op === 'bg' ? e.bg : null);
    if (bg && bg.kind === 'world') {
      if (e.type === 'stage' && e.with && e.with !== 'none' && e.with !== 'cut') this.freeze();
      await this.loadWorld(bg.id);
    }
    const needs3D = stage && stage.actors.some(a => this.is3DActor(a, stage.bg));
    if (needs3D) await this.ensureWorld().catch(() => {});
    await this.assets.preloadEffect(e);
  }

  freeze() {
    this.prev.getContext('2d').drawImage(this.frame, 0, 0);
    this.frozen = true;
  }

  async ensureWorld() {
    if (this.world) return this.world;
    if (!this._worldPromise) {
      this._worldPromise = import('./three/world3d.js').then(m => (m.createWorld3D || m.default)({
        width: this.W, height: this.H, resolveUrl: this.resolveUrl, loadModule: this.loadModule, quality: this.settings.quality || 'high',
      })).then(w => { this.world = w; return w; });
    }
    return this._worldPromise;
  }

  async loadWorld(id) {
    const decl = own(this.program.decls.assets, id);
    this.worldError = null;
    try {
      const w = await this.ensureWorld();
      if (this.loadedWorld !== id) {
        await w.setWorld({ id, path: decl.path, opts: decl.opts || {} });
        this.loadedWorld = id;
        // Re-show 3D actors that were already on stage.
        for (const v of this.actors.values()) if (v.is3D) { await w.showActor(v.state, this.declFor(v.state), { time: 0 }); }
      }
    } catch (err) {
      console.error('[shiori] 3D world failed:', err);
      this.worldError = `3D world \`${id}\` could not load: ${err && err.message || err}`;
      this.loadedWorld = null;
    }
  }

  declFor(actor) {
    const d = this.program.decls;
    return own(actor.kind === 'character' ? d.characters : d.assets, actor.id) || null;
  }

  is3DActor(actor, bg) {
    const d = this.declFor(actor);
    if (!d) return false;
    if (actor.kind === 'model') return true;
    if (actor.kind === 'character') return !!d.model && !!(bg && bg.kind === 'world') || (!!d.model && !d.sprite && !(d.layers && d.layers.length));
    return false;
  }

  // ---- effects -------------------------------------------------------------
  apply(e) {
    if (e.type === 'restore') return this.sync(e.stage);
    if (e.type !== 'stage') return;
    const fast = !!e.instant;
    const time = fast ? 0 : (e.time != null ? e.time : 0.4);
    switch (e.op) {
      case 'scene': {
        this.beginTransition(fast ? 'none' : e.with, time);
        const s = e.stage;
        for (const v of this.actors.values()) if (v.is3D && this.world) this.world.hideActor(v.state.id, { time: 0 });
        this.actors = new Map();
        this.setBg(s.bg);
        this.cg = null; this.cgAlpha = 0;
        this.weathers = [];
        this.filters = [];
        this.tint = { color: null, alpha: 0 };
        this.setCamera(s.camera, 0);
        return;
      }
      case 'bg':
        this.beginTransition(fast ? 'none' : e.with, time);
        this.setBg(e.bg);
        return;
      case 'show': return this.showActor(e.actor, e.entering, fast ? 'none' : e.with, time);
      case 'hide': return this.hideActor(e.id, fast ? 'none' : e.with, time);
      case 'move': return this.moveActor(e.actor, fast ? 0 : e.time, e.ease);
      case 'cg':
        this.beginTransition(fast ? 'none' : e.with, time);
        this.cg = e.cg; this.cgAlpha = e.cg ? 1 : 0;
        return;
      case 'camera': return this.setCamera(e.camera, fast ? 0 : e.time, e.ease, e.orbit);
      case 'weather': return this.setWeather(e.weather, fast ? 0 : e.time);
      case 'filter': return this.setFilter(e.filter, fast ? 0 : e.time);
      case 'tint': return this.setTint(e.tint, fast ? 0 : e.time);
      case 'shake': if (!fast && !this.reduceMotion) this.shakeFx = { t: 0, dur: e.time || 0.5, strength: e.strength || 1 }; return;
      case 'flash': if (!fast) this.flash(e.color, e.time); return;
    }
  }

  // Make the stage match a state exactly (after load / rollback).
  sync(s) {
    this.transition = null;
    this.frozen = false;
    this.tweens.finishAll();
    if (this.world) for (const v of this.actors.values()) if (v.is3D) this.world.hideActor(v.state.id, { time: 0 });
    this.actors = new Map();
    this.setBg(s.bg);
    for (const a of s.actors) this.showActor(a, true, 'none', 0);
    this.cg = s.cg; this.cgAlpha = s.cg ? 1 : 0;
    this.camera = { zoom: 1, x: 0, y: 0, rotate: 0 };
    this.setCamera(s.camera, 0);
    this.weathers = [];
    if (s.weather) this.setWeather(s.weather, 0);
    this.filters = s.filter && s.filter !== 'none' ? [{ name: s.filter, amount: 1 }] : [];
    this.tint = s.tint ? { color: s.tint.color, alpha: s.tint.alpha } : { color: null, alpha: 0 };
  }

  setBg(bg) {
    this.bg = bg ? { ...bg } : null;
    if (this.world && (!bg || bg.kind !== 'world') && this.loadedWorld) {
      this.world.clear();
      this.loadedWorld = null;
    }
  }

  beginTransition(type, time) {
    if (!type || type === 'none' || type === 'cut' || !(time > 0)) { this.frozen = false; this.transition = null; return; }
    if (!this.frozen) this.prev.getContext('2d').drawImage(this.frame, 0, 0);
    this.frozen = false;
    const tr = { type, p: 0, seed: Math.random() };
    this.transition = tr;
    this.tweens.add(time, (p) => { tr.p = p; }, { ease: type === 'dissolve' || type.startsWith('fade') ? 'linear' : 'inout', key: 'transition', done: () => { if (this.transition === tr) this.transition = null; } });
  }

  showActor(st, entering, withT, time) {
    const decl = this.declFor(st);
    if (!decl) return;
    let v = this.actors.get(st.id);
    const is3D = this.is3DActor(st, this.bg);
    if (!v) {
      v = { state: { ...st }, x: st.x, y: st.y || 0, scale: st.scale || 1, alpha: 0, flip: st.flip ? -1 : 1, z: st.z || 0, order: this.order++,
        img: null, prevImg: null, xfade: 1, dim: 0, phase: Math.random() * TAU, nextBlink: this.t + 1 + Math.random() * 3, blinkUntil: 0, is3D };
      this.actors.set(st.id, v);
      if (is3D) {
        this.ensureWorld().then(w => w.showActor(st, decl, { time: withT === 'none' ? 0 : time })).catch(err => console.warn('[shiori] 3D actor failed', err));
        v.alpha = 1;
      } else if (withT === 'none' || !(time > 0)) v.alpha = 1;
      else this.tweens.add(time, (p) => { v.alpha = p; }, { ease: 'linear', key: 'alpha:' + st.id });
      v.img = this.actorImage(st);
      return;
    }
    const old = v.state;
    const attrsChanged = JSON.stringify(old.attrs || {}) !== JSON.stringify(st.attrs || {});
    v.state = { ...st };
    if (v.leaving) { v.leaving = false; this.tweens.cancel('alpha:' + st.id); this.tweens.add(time || 0.3, (p) => { v.alpha = lerp(v.alpha, 1, p); }, { key: 'alpha:' + st.id }); }
    if (is3D) { if (this.world) this.world.updateActor(st, { time, ease: 'inout' }); return; }
    if (attrsChanged) {
      const cur = this.actorImage(old);
      v.prevImg = cur;
      v.xfade = 0;
      this.tweens.add(withT === 'none' ? 0 : Math.min(time || 0.25, 0.35), (p) => { v.xfade = p; }, { ease: 'linear', key: 'xfade:' + st.id, done: () => { v.prevImg = null; } });
    }
    const fromX = v.x, fromY = v.y, fromS = v.scale, fromF = v.flip;
    const toX = st.x, toY = st.y || 0, toS = st.scale || 1, toF = st.flip ? -1 : 1, toZ = st.z || 0;
    v.z = toZ;
    if (fromX !== toX || fromY !== toY || fromS !== toS || fromF !== toF) {
      this.tweens.add(withT === 'none' ? 0 : Math.max(time || 0.4, 0.3), (p) => { v.x = lerp(fromX, toX, p); v.y = lerp(fromY, toY, p); v.scale = lerp(fromS, toS, p); v.flip = lerp(fromF, toF, p); }, { key: 'move:' + st.id });
    }
  }

  moveActor(st, time, ease) {
    const v = this.actors.get(st.id);
    if (!v) return this.showActor(st, true, 'none', 0);
    v.state = { ...st };
    if (v.is3D) { if (this.world) this.world.updateActor(st, { time, ease }); return; }
    const fromX = v.x, fromY = v.y, fromS = v.scale, fromF = v.flip;
    const toX = st.x, toY = st.y || 0, toS = st.scale || 1, toF = st.flip ? -1 : 1;
    v.z = st.z || 0;
    this.tweens.add(time, (p) => { v.x = lerp(fromX, toX, p); v.y = lerp(fromY, toY, p); v.scale = lerp(fromS, toS, p); v.flip = lerp(fromF, toF, p); }, { ease: ease || 'inout', key: 'move:' + st.id });
  }

  hideActor(id, withT, time) {
    const v = this.actors.get(id);
    if (!v) return;
    if (v.is3D) {
      if (this.world) this.world.hideActor(id, { time: withT === 'none' ? 0 : time });
      this.actors.delete(id);
      return;
    }
    if (withT === 'none' || !(time > 0)) { this.actors.delete(id); return; }
    v.leaving = true;
    const from = v.alpha;
    this.tweens.add(time, (p) => { v.alpha = from * (1 - p); }, { ease: 'linear', key: 'alpha:' + id, done: () => { if (v.leaving) this.actors.delete(id); } });
  }

  setCamera(cam, time, ease, orbit) {
    if (this.bg && this.bg.kind === 'world') {
      if (this.world) this.world.setCamera(cam, { time: time || 0, ease: ease || 'inout', orbit: orbit || 0 });
      return;
    }
    const from = { ...this.camera };
    const to = { zoom: cam.zoom || 1, x: cam.x || 0, y: cam.y || 0, rotate: cam.rotate || 0 };
    this.tweens.add(time || 0, (p) => {
      this.camera.zoom = lerp(from.zoom, to.zoom, p);
      this.camera.x = lerp(from.x, to.x, p);
      this.camera.y = lerp(from.y, to.y, p);
      this.camera.rotate = lerp(from.rotate, to.rotate, p);
    }, { ease: ease || 'inout', key: 'camera' });
  }

  setWeather(spec, time) {
    for (const w of this.weathers) {
      if (spec && w.type === spec.type && !w.leaving) { w.setSpec(spec); return; }
    }
    for (const w of this.weathers) {
      if (w.leaving) continue;
      w.leaving = true;
      const a0 = w.alpha;
      this.tweens.add(time || 0, (p) => { w.alpha = a0 * (1 - p); }, { ease: 'linear', done: () => { this.weathers = this.weathers.filter(x => x !== w); } });
    }
    if (spec) {
      const w = new Weather(spec, this.W, this.H);
      this.weathers.push(w);
      this.tweens.add(time || 0, (p) => { w.alpha = p; }, { ease: 'linear' });
    }
  }

  setFilter(name, time) {
    for (const f of this.filters) {
      const a0 = f.amount;
      this.tweens.add(time || 0, (p) => { f.amount = a0 * (1 - p); }, { ease: 'linear', done: () => { this.filters = this.filters.filter(x => x !== f || x.amount > 0.001); } });
    }
    if (name && name !== 'none') {
      const f = { name, amount: 0 };
      this.filters.push(f);
      this.tweens.add(time || 0, (p) => { f.amount = p; }, { ease: 'linear' });
    }
  }

  setTint(tint, time) {
    const from = { ...this.tint };
    const toA = tint ? tint.alpha : 0;
    if (tint) this.tint.color = tint.color;
    this.tweens.add(time || 0, (p) => { this.tint.alpha = lerp(from.alpha || 0, toA, p); }, { ease: 'linear', key: 'tint', done: () => { if (!tint) this.tint.color = null; } });
  }

  flash(color, time) {
    this.flashFx = { color: color || '#fff', alpha: this.reduceMotion ? 0.35 : 1 };
    const a0 = this.flashFx.alpha;
    this.tweens.add(time || 0.4, (p) => { this.flashFx.alpha = a0 * (1 - p); }, { ease: 'out', key: 'flash' });
  }

  burst(opts) { this.bursts.push(new Burst({ W: this.W, H: this.H, ...opts })); }

  setSpeaking(id, typing) {
    this.speaking = id;
    this.typing = !!typing;
    if (this.world) this.world.setSpeaking(typing ? id : null);
  }

  finishAll() {
    this.tweens.finishAll();
    if (this.world && this.world.skipTweens) this.world.skipTweens();
    this.transition = null;
    this.frozen = false;
  }

  get busy() { return this.tweens.busy; }

  // ---- drawing ----------------------------------------------------------
  actorImage(st) {
    const d = this.declFor(st);
    if (!d) return null;
    if (st.kind === 'character') return this.assets.character(d, st.attrs) || null;
    if (st.kind === 'image') return this.assets.asset(st.id, 600, 600);
    return null;
  }

  update(dt) {
    this.t += dt;
    this.dtLast = dt;
    this.tweens.update(dt);
    for (const w of this.weathers) w.update(dt);
    for (const b of this.bursts) b.update(dt);
    this.bursts = this.bursts.filter(b => !b.done);
    if (this.shakeFx.dur) { this.shakeFx.t += dt; if (this.shakeFx.t >= this.shakeFx.dur) this.shakeFx = { t: 0, dur: 0, strength: 0 }; }
    const dimOn = this.settings.dimInactive && this.program.header.dim_inactive !== false;
    const speakerOnStage = this.speaking && this.actors.has(this.speaking);
    for (const v of this.actors.values()) {
      const target = dimOn && speakerOnStage && v.state.kind === 'character' && v.state.id !== this.speaking ? 1 : 0;
      v.dim += (target - v.dim) * Math.min(1, dt * 7);
      if (this.t > v.nextBlink) { v.blinkUntil = this.t + 0.13; v.nextBlink = this.t + (Math.random() < 0.2 ? 0.28 : 2.2 + Math.random() * 4); }
    }
  }

  render() {
    const { W, H } = this;
    this.composePicture();
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (this.shakeFx.dur && !this.reduceMotion) {
      const k = 1 - this.shakeFx.t / this.shakeFx.dur;
      const s = 22 * this.shakeFx.strength * k;
      ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s * 0.7);
    }
    if (this.frozen) ctx.drawImage(this.prev, 0, 0);
    else if (this.transition) this.drawTransition(ctx, this.transition);
    else ctx.drawImage(this.frame, 0, 0);
    if (this.flashFx.alpha > 0.001) { ctx.globalAlpha = this.flashFx.alpha; ctx.fillStyle = this.flashFx.color; ctx.fillRect(-50, -50, W + 100, H + 100); ctx.globalAlpha = 1; }
    ctx.restore();
    if (this.onFrame) this.onFrame();
  }

  composePicture() {
    const { W, H } = this;
    const ctx = this.fctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const isWorld = this.bg && this.bg.kind === 'world';
    const cam = this.camera;
    const use2DCam = !isWorld && (cam.zoom !== 1 || cam.x || cam.y || cam.rotate);
    ctx.save();
    if (use2DCam) {
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.rotate(cam.rotate * Math.PI / 180);
      ctx.translate(-W / 2 - cam.x * W, -H / 2 - cam.y * H);
    }
    // background
    if (this.bg) {
      if (this.bg.kind === 'color') { ctx.fillStyle = this.bg.color; ctx.fillRect(-W, -H, W * 3, H * 3); }
      else if (this.bg.kind === 'image') this.drawCover(ctx, this.assets.asset(this.bg.id, W, H), own(this.program.decls.assets, this.bg.id));
    }
    if (isWorld) {
      if (this.world && this.loadedWorld === this.bg.id) {
        try { this.world.update(this.dtLast || 0.016, this.t); this.world.render(); ctx.drawImage(this.world.canvas, 0, 0, W, H); }
        catch (err) { this.worldError = String(err && err.message || err); }
      } else if (this.worldError) this.drawCover(ctx, this.assets.placeholderImage(this.bg.id, W, H, '3D world (failed)'));
    }
    for (const w of this.weathers) if (w.layer === 'back') w.draw(ctx, this.reduceMotion);
    // actors
    const list = [...this.actors.values()].sort((a, b) => (a.z - b.z) || (a.order - b.order));
    for (const v of list) if (!v.is3D) this.drawActor(ctx, v);
    // 3D actors over a 2D background
    if (!isWorld && this.world && list.some(v => v.is3D)) {
      try { this.world.update(this.dtLast || 0.016, this.t); this.world.render(); ctx.drawImage(this.world.canvas, 0, 0, W, H); } catch {}
    }
    ctx.restore();
    // CG covers the stage (not affected by the 2D camera)
    if (this.cg) this.drawCover(ctx, this.assets.asset(this.cg, W, H), own(this.program.decls.assets, this.cg));
    for (const w of this.weathers) if (w.layer !== 'back') w.draw(ctx, this.reduceMotion);
    for (const b of this.bursts) b.draw(ctx);
    for (const f of this.filters) if (f.amount > 0.001) this.drawFilter(ctx, f.name, f.amount);
    if (this.tint.color && this.tint.alpha > 0.001) {
      ctx.globalAlpha = this.tint.alpha; ctx.fillStyle = this.tint.color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }
    if (this.worldError && isWorld) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, 76);
      ctx.fillStyle = '#ffb4b4'; ctx.font = '28px system-ui, sans-serif'; ctx.fillText(this.worldError, 40, 48);
    }
  }

  drawCover(ctx, img, decl) {
    if (!img) return;
    const { W, H } = this;
    const fit = decl && decl.opts && decl.opts.fit || 'cover';
    let w = img.width, h = img.height;
    if (fit === 'cover') { const k = Math.max(W / w, H / h); w *= k; h *= k; }
    else if (fit === 'contain') { const k = Math.min(W / w, H / h); w *= k; h *= k; }
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }

  drawActor(ctx, v) {
    const st = v.state;
    const decl = this.declFor(st);
    if (!decl) return;
    const img = this.actorImage(st);
    if (img) v.img = img;
    const cur = v.img;
    if (!cur || v.alpha <= 0.001) return;
    const { W, H } = this;
    const baseScale = (v.scale || 1) * (decl.scale || (decl.opts && decl.opts.scale) || 1);
    const breathe = this.reduceMotion || st.kind !== 'character' ? 1 : 1 + 0.0045 * Math.sin(this.t * TAU / 4.2 + v.phase);
    const cx = v.x * W;
    const bottom = H + ((v.y || 0) + (decl.y || 0)) * H;
    ctx.save();
    ctx.translate(cx, bottom);
    ctx.scale(v.flip * baseScale, baseScale * breathe);
    const draw = (im, alpha) => {
      if (!im || alpha <= 0.001) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(im, -im.width / 2, -im.height);
    };
    const a = v.alpha;
    if (v.prevImg && v.xfade < 1) { draw(v.prevImg, a * (1 - v.xfade)); draw(cur, a * v.xfade); }
    else draw(cur, a);
    if (st.kind === 'character') {
      // No blink while the current look already has the eyes closed (`noblink:`).
      const blink = this.t < v.blinkUntil && blinks(decl, st.attrs) ? this.assets.get(this.assets.overlayPath(decl, 'blink', st.attrs)) : null;
      if (blink) draw(blink, a);
      if (decl.mouth && this.speaking === st.id && this.typing && Math.floor(this.t * 9) % 2 === 0) {
        const m = this.assets.get(this.assets.overlayPath(decl, 'mouth', st.attrs));
        if (m) draw(m, a);
      }
      if (v.dim > 0.01) draw(this.assets.dimmed(cur), a * v.dim);
    }
    ctx.restore();
  }

  drawFilter(ctx, name, a) {
    const { W, H } = this;
    ctx.save();
    const fill = (op, color, alpha) => { ctx.globalCompositeOperation = op; ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); };
    const vignette = (alpha, color = '0,0,0') => {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(1, `rgba(${color},0.85)`);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    };
    const blur = (alpha, op = 'source-over') => {
      const s = this.scratch, sc = s.getContext('2d');
      sc.globalCompositeOperation = 'copy';
      sc.drawImage(this.frame, 0, 0, s.width, s.height);
      ctx.globalCompositeOperation = op; ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(s, 0, 0, W, H);
    };
    switch (name) {
      case 'grayscale': fill('saturation', '#808080', a); break;
      case 'sepia': fill('saturation', '#808080', a); fill('multiply', '#e8cfa0', a * 0.85); fill('soft-light', '#6b4520', a * 0.35); break;
      case 'noir': fill('saturation', '#808080', a); fill('multiply', '#b8b8b8', a * 0.6); vignette(a * 0.9); break;
      case 'night': fill('multiply', '#304890', a * 0.75); fill('saturation', '#808080', a * 0.3); vignette(a * 0.5, '5,8,30'); break;
      case 'dusk': fill('multiply', '#ffb27a', a * 0.45); fill('soft-light', '#ff5e3a', a * 0.35); break;
      case 'dream': blur(a * 0.55, 'screen'); fill('screen', '#fff1f8', a * 0.22); vignette(a * 0.6, '255,246,252'); break;
      case 'blur': blur(a); break;
      case 'vignette': vignette(a); break;
      case 'invert': fill('difference', '#ffffff', a); break;
    }
    ctx.restore();
  }

  drawTransition(ctx, tr) {
    const { W, H } = this;
    const p = tr.p, old = this.prev, cur = this.frame;
    switch (tr.type) {
      case 'fade': case 'fade_white': {
        const col = tr.type === 'fade' ? '#000' : '#fff';
        if (p < 0.5) { ctx.drawImage(old, 0, 0); ctx.globalAlpha = p * 2; }
        else { ctx.drawImage(cur, 0, 0); ctx.globalAlpha = (1 - p) * 2; }
        ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
        return;
      }
      case 'flash':
        ctx.drawImage(p < 0.25 ? old : cur, 0, 0);
        ctx.globalAlpha = p < 0.25 ? p * 4 : Math.max(0, 1 - (p - 0.25) / 0.75);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
        return;
      case 'wipe_left': case 'wipe_right': case 'wipe_up': case 'wipe_down': {
        ctx.drawImage(cur, 0, 0);
        ctx.save(); ctx.beginPath();
        if (tr.type === 'wipe_left') ctx.rect(0, 0, W * (1 - p), H);
        if (tr.type === 'wipe_right') ctx.rect(W * p, 0, W * (1 - p), H);
        if (tr.type === 'wipe_up') ctx.rect(0, 0, W, H * (1 - p));
        if (tr.type === 'wipe_down') ctx.rect(0, H * p, W, H * (1 - p));
        ctx.clip(); ctx.drawImage(old, 0, 0); ctx.restore();
        return;
      }
      case 'iris_in': case 'iris_out': {
        const R = Math.hypot(W, H) / 2;
        const inner = tr.type === 'iris_out' ? cur : old, outer = tr.type === 'iris_out' ? old : cur;
        const r = tr.type === 'iris_out' ? p * R : (1 - p) * R;
        ctx.drawImage(outer, 0, 0);
        ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(0.1, r), 0, Math.PI * 2); ctx.clip(); ctx.drawImage(inner, 0, 0); ctx.restore();
        return;
      }
      case 'slide_left': ctx.drawImage(old, -p * W, 0); ctx.drawImage(cur, W - p * W, 0); return;
      case 'slide_right': ctx.drawImage(old, p * W, 0); ctx.drawImage(cur, -W + p * W, 0); return;
      case 'slide_up': ctx.drawImage(old, 0, -p * H); ctx.drawImage(cur, 0, H - p * H); return;
      case 'slide_down': ctx.drawImage(old, 0, p * H); ctx.drawImage(cur, 0, -H + p * H); return;
      case 'pixelate': {
        const src = p < 0.5 ? old : cur;
        const k = p < 0.5 ? p * 2 : (1 - p) * 2;
        const block = Math.max(1, Math.round(1 + k * 48));
        const s = this.scratch, sc = s.getContext('2d');
        const sw = Math.max(1, Math.round(W / block)), sh = Math.max(1, Math.round(H / block));
        sc.imageSmoothingEnabled = false;
        sc.globalCompositeOperation = 'copy';
        sc.drawImage(src, 0, 0, Math.min(sw, s.width), Math.min(sh, s.height));
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(s, 0, 0, Math.min(sw, s.width), Math.min(sh, s.height), 0, 0, W, H);
        ctx.imageSmoothingEnabled = true;
        return;
      }
      case 'blinds': {
        const n = 12, bh = H / n;
        const closing = p < 0.5;
        ctx.drawImage(closing ? old : cur, 0, 0);
        const k = closing ? p * 2 : (1 - p) * 2;
        ctx.fillStyle = '#000';
        for (let i = 0; i < n; i++) ctx.fillRect(0, i * bh, W, bh * k);
        return;
      }
      case 'dissolve': default:
        ctx.drawImage(cur, 0, 0);
        ctx.globalAlpha = 1 - p; ctx.drawImage(old, 0, 0); ctx.globalAlpha = 1;
        return;
    }
  }

  thumbnail(w = 384, h = 216) {
    const c = this.makeCanvas(w, h);
    c.getContext('2d').drawImage(this.frame, 0, 0, w, h);
    try { return c.toDataURL('image/jpeg', 0.72); } catch { return null; }
  }

  screenshot() {
    try { return this.canvas.toDataURL('image/png'); } catch { return null; }
  }
}
