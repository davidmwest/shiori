// Easing curves and a small tween manager shared by the stage and UI.

import { has } from '../core/registry.js';

export const EASE = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inout: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  bounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

export const lerp = (a, b, t) => a + (b - a) * t;

// A tween calls step(p) with eased progress 0..1 each frame, and done() once.
export class Tweens {
  constructor() { this.list = []; }
  add(duration, step, opts = {}) {
    const tw = { t: 0, d: Math.max(0, duration || 0), step, ease: has(EASE, opts.ease) ? EASE[opts.ease] : EASE.inout, done: opts.done, key: opts.key };
    if (opts.key) this.cancel(opts.key, true);
    if (tw.d === 0) { step(1); if (tw.done) tw.done(); return tw; }
    step(0);
    this.list.push(tw);
    return tw;
  }
  cancel(key, finish) {
    this.list = this.list.filter(tw => {
      if (tw.key !== key) return true;
      tw.cancelled = true;
      if (finish) { tw.step(1); if (tw.done) tw.done(); }
      return false;
    });
  }
  update(dt) {
    if (!this.list.length) return;
    const current = this.list;
    this.list = [];             // tweens added by callbacks land here
    const keep = [];
    for (const tw of current) {
      if (tw.cancelled) continue;
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.d);
      tw.step(tw.ease(p));
      if (p >= 1) { if (tw.done) tw.done(); } else keep.push(tw);
    }
    this.list = keep.concat(this.list);
  }
  finishAll() {
    const list = this.list;
    this.list = [];
    for (const tw of list) { tw.step(1); if (tw.done) tw.done(); }
  }
  get busy() { return this.list.length > 0; }
}
