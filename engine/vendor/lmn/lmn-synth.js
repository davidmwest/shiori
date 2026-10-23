/*
 * LMN Synth — every instrument is generated in JavaScript with the Web Audio API.
 * No samples or SoundFonts. Techniques used:
 *   piano ............ additive synthesis with inharmonic partials, rendered to buffers
 *   plucked strings .. Karplus–Strong physical model (guitars, basses, harp, banjo, harpsichord…)
 *   electric piano ... two-operator FM
 *   organ ............ drawbar waveforms (PeriodicWave) with tremolo
 *   mallets, bells ... modal synthesis (decaying sine modes)
 *   bowed, brass, reeds, pipes, synths ... subtractive synthesis with custom waveforms,
 *                      filter envelopes, vibrato and breath noise
 *   voices ........... sawtooth source through vowel formant filters (vowel taken from the lyric)
 *   drums ............ shaped noise, pitch sweeps and metallic oscillator clusters
 */
const LMNSynth = (function () {
'use strict';

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function clampN(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function velGain(v) { return Math.pow(clampN(v, 1, 127) / 127, 1.6); }

// ---------------------------------------------------------------------------
// Per-context resources (noise, waveforms, rendered buffers)
// ---------------------------------------------------------------------------

const RES = new WeakMap();
function res(ctx) {
  let r = RES.get(ctx);
  if (!r) {
    const len = Math.floor(ctx.sampleRate * 2);
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    r = { noise: noise, waves: {}, bufs: {}, curves: {} };
    RES.set(ctx, r);
  }
  return r;
}

function osc(ctx, type, freq, t, detune) {
  const o = ctx.createOscillator();
  if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
  o.frequency.setValueAtTime(freq, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  return o;
}
function gain(ctx, v) { const g = ctx.createGain(); g.gain.value = v; return g; }
function biquad(ctx, type, f, q, g) {
  const b = ctx.createBiquadFilter();
  b.type = type; b.frequency.value = f;
  if (q != null) b.Q.value = q;
  if (g != null) b.gain.value = g;
  return b;
}
function noise(ctx, t, dur) {
  const s = ctx.createBufferSource();
  s.buffer = res(ctx).noise; s.loop = true;
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur);
  return s;
}

// Harmonic waveforms by amplitude list (index 1 = fundamental)
function wave(ctx, name) {
  const r = res(ctx);
  if (r.waves[name]) return r.waves[name];
  const H = WAVES[name];
  const imag = new Float32Array(H.length), real = new Float32Array(H.length);
  for (let i = 1; i < H.length; i++) imag[i] = H[i];
  r.waves[name] = ctx.createPeriodicWave(real, imag);
  return r.waves[name];
}
function series(n, fn) { const a = [0]; for (let k = 1; k <= n; k++) a.push(fn(k)); return a; }
const WAVES = {
  drawbar: [0, 1, 0.72, 0.42, 0.33, 0, 0.18, 0, 0.12],
  rock: [0, 1, 0.85, 0.66, 0.5, 0.05, 0.32, 0, 0.38, 0, 0.12],
  church: [0, 1, 0.95, 0.55, 0.55, 0.3, 0.32, 0.12, 0.28, 0.1, 0.14, 0, 0.1],
  violin: series(28, function (k) { return (1 / k) * (1 + 0.9 * Math.exp(-Math.pow((k * 440 - 3000) / 1400, 2))) * (k % 2 ? 1 : 0.85); }),
  sax: series(26, function (k) { return Math.pow(k, -0.75) * (1 + 1.2 * Math.exp(-Math.pow(k - 4, 2) / 6)); }),
  oboe: series(24, function (k) { return k < 2 ? 0.4 : Math.pow(k, -0.6) * (1 + Math.exp(-Math.pow(k - 4, 2) / 3)); }),
  clarinet: series(23, function (k) { return k % 2 ? 1 / k : 0.04 / k; }),
  accordion: series(20, function (k) { return Math.pow(k, -0.55) * (k % 2 ? 1 : 0.7); }),
  harmonica: series(18, function (k) { return Math.pow(k, -0.5) * (k === 2 ? 1.3 : 1); }),
  brass: series(30, function (k) { return Math.pow(k, -0.65); }),
  glottal: series(40, function (k) { return Math.pow(k, -1.25); }),
  flute: [0, 1, 0.22, 0.09, 0.03, 0.015],
  bell: [0, 1, 0, 0.3, 0, 0.12]
};

function tanhCurve(ctx, amount) {
  const r = res(ctx), key = 'tanh' + amount;
  if (r.curves[key]) return r.curves[key];
  const n = 2048, c = new Float32Array(n), k = amount;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  r.curves[key] = c;
  return c;
}

// Apply an LMN glide path (Extended feature) to a frequency AudioParam.
function pitchTo(param, ev, base, t0, ratio) {
  param.setValueAtTime(base * ratio, t0 + ev.time);
  const P = ev.pitchPath;
  if (!P || P.length < 2) return;
  for (let i = 1; i < P.length; i++) {
    const seg = P[i].time - P[i - 1].time;
    const g = Math.min(0.25 * seg, 0.15);
    param.setValueAtTime(mtof(P[i - 1].midi) * ratio, t0 + P[i].time - g);
    param.exponentialRampToValueAtTime(mtof(P[i].midi) * ratio, t0 + P[i].time);
  }
}

// ---------------------------------------------------------------------------
// Rendered instruments: piano (additive) and plucked strings (Karplus–Strong)
// ---------------------------------------------------------------------------

const PIANO_RATE = 32000;

// Rendered sample data is cached independently of any AudioContext, so it can be
// prepared in the background before playback starts.
const RAW = {};
function toBuffer(ctx, key, raw) {
  const r = res(ctx);
  if (r.bufs[key]) return r.bufs[key];
  const b = ctx.createBuffer(1, raw.data.length, raw.sr);
  b.getChannelData(0).set(raw.data);
  r.bufs[key] = b;
  return b;
}
function pianoBuffer(ctx, midi, bright) { return toBuffer(ctx, 'piano:' + bright + ':' + midi, pianoData(midi, bright)); }
function pluckBuffer(ctx, midi, p) { return toBuffer(ctx, 'ks:' + p.id + ':' + midi, pluckData(midi, p)); }

function pianoData(midi, bright) {
  const key = 'piano:' + bright + ':' + midi;
  if (RAW[key]) return RAW[key];
  const sr = PIANO_RATE, f0 = mtof(midi);
  const B = 0.00008 * Math.pow(2, (midi - 21) / 26);           // string inharmonicity
  const tau1 = clampN(3.0 * Math.pow(261.6 / f0, 0.6), 0.3, 7.5); // fundamental decay constant (s)
  const len = Math.floor(sr * clampN(tau1 * 2.5, 0.9, 5));
  const out = new Float32Array(len);
  const nyq = sr * 0.45, hammer = 0.118;
  const roll = 1.2 - 0.25 * bright;
  const maxP = Math.min(26, Math.floor(nyq / f0));
  for (let n = 1; n <= maxP; n++) {
    const fn = n * f0 * Math.sqrt(1 + B * n * n);
    if (fn > nyq) break;
    let amp = Math.pow(n, -roll) * (0.35 + Math.abs(Math.sin(Math.PI * n * hammer)));
    if (f0 < 130 && n === 1) amp *= 0.6;                      // thin fundamental in the bass
    const tauN = tau1 / (1 + 0.28 * (n - 1));
    const strings = n <= 6 ? 2 : 1;
    for (let s = 0; s < strings; s++) {
      const det = strings === 2 ? (s ? 1 : -1) * (0.0003 + 0.00008 * n) : 0;
      const w = 2 * Math.PI * fn * (1 + det) / sr;
      const c = 2 * Math.cos(w);
      let y1 = -Math.sin(w), y2 = -Math.sin(2 * w);
      const dF = Math.exp(-1 / (sr * tauN * 0.22)), dS = Math.exp(-1 / (sr * tauN));
      let aF = amp * 0.55 / strings, aS = amp * 0.45 / strings;
      const iEnd = Math.min(len, Math.ceil(sr * tauN * Math.log(Math.max(1.0001, amp / 2e-4))));
      for (let i = 0; i < iEnd; i++) {
        const y = c * y1 - y2; y2 = y1; y1 = y;
        out[i] += y * (aF + aS);
        aF *= dF; aS *= dS;
      }
    }
  }
  // hammer thump: low-passed noise burst
  let lp = 0;
  const thumpLen = Math.floor(sr * 0.02), lpk = clampN(f0 * 6 / sr, 0.02, 0.5);
  for (let i = 0; i < thumpLen; i++) {
    lp += lpk * ((Math.random() * 2 - 1) - lp);
    out[i] += lp * 0.5 * Math.exp(-i / (sr * 0.004));
  }
  finishBuffer(out, sr, 0.0015);
  return (RAW[key] = { data: out, sr: sr });
}

const KS_RATE = 44100;

function pluckData(midi, p) {
  const key = 'ks:' + p.id + ':' + midi;
  if (RAW[key]) return RAW[key];
  const sr = KS_RATE, f = mtof(midi);
  const s = p.damp != null ? p.damp : 0.5;
  // The loop mixes delays N and N-1 (weights 1-s, s), so its period is N - s + frac.
  const N = Math.max(4, Math.floor(sr / f + s));
  const frac = sr / f + s - N;                                   // fractional delay for tuning
  const C = (1 - frac) / (1 + frac);                             // first-order allpass coefficient
  const t60 = (p.t60 || 3) * Math.pow(220 / f, p.t60k != null ? p.t60k : 0.35);
  const g = Math.pow(10, -3 / (t60 * f));                        // loop gain per period
  const len = Math.floor(sr * Math.min(p.len || 3, t60 * 1.2 + 0.3));
  const out = new Float32Array(len);
  const ring = new Float32Array(N);
  // excitation: filtered noise, comb-filtered at the pick position
  let lp = 0;
  const bright = p.bright != null ? p.bright : 0.6;
  for (let i = 0; i < N; i++) { lp += bright * ((Math.random() * 2 - 1) - lp); ring[i] = lp; }
  const pk = Math.max(1, Math.round((p.pick || 0.15) * N));
  const tmp = ring.slice();
  for (let i = 0; i < N; i++) ring[i] = tmp[i] - 0.9 * tmp[(i + N - pk) % N];
  let mean = 0;
  for (let i = 0; i < N; i++) mean += ring[i];
  mean /= N;
  for (let i = 0; i < N; i++) ring[i] -= mean;
  let idx = 0, apX = 0, apY = 0;
  for (let i = 0; i < len; i++) {
    const a = ring[idx], b = ring[idx + 1 === N ? 0 : idx + 1];
    const v = g * ((1 - s) * a + s * b);
    const y = C * v + apX - C * apY;                             // allpass fine-tuning
    apX = v; apY = y;
    ring[idx] = y;
    out[i] = a;
    idx = idx + 1 === N ? 0 : idx + 1;
  }
  if (p.slap) { for (let i = 0; i < Math.min(len, sr * 0.006); i++) out[i] += (Math.random() * 2 - 1) * 0.9 * (1 - i / (sr * 0.006)); }
  finishBuffer(out, sr, 0.0008);
  return (RAW[key] = { data: out, sr: sr });
}

// fade in/out, remove DC, normalise
function finishBuffer(out, sr, fadeIn) {
  const len = out.length, fi = Math.max(1, Math.floor(sr * fadeIn)), fo = Math.min(len, Math.floor(sr * 0.05));
  let dc = 0;
  for (let i = 0; i < len; i++) dc += out[i];
  dc /= len;
  let peak = 1e-9;
  for (let i = 0; i < len; i++) {
    let v = out[i] - dc;
    if (i < fi) v *= i / fi;
    if (i > len - fo) v *= (len - i) / fo;
    out[i] = v;
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
  }
  const k = 0.8 / peak;
  for (let i = 0; i < len; i++) out[i] *= k;
}

// Reverb impulse: stereo decaying noise with a few early reflections
function impulse(ctx, seconds) {
  const r = res(ctx);
  if (r.ir) return r.ir;
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      lp += 0.35 * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - t / seconds, 2) * Math.exp(-t * 2.2);
    }
    [0.011, 0.019, 0.027, 0.041].forEach(function (er, k) {
      const i = Math.floor((er + ch * 0.003) * sr);
      if (i < len) d[i] += 0.5 / (k + 1);
    });
  }
  r.ir = buf;
  return buf;
}

// ---------------------------------------------------------------------------
// Voices. Signature: fn(ctx, out, ev, t, dur, g, p, x)
//   t: start (context time), dur: sounding seconds, g: loudness, p: preset,
//   x: { t0: context time of song time 0, vowel }
// ---------------------------------------------------------------------------

function rateTo(param, ev, t0) {
  const P = ev.pitchPath;
  if (!P || P.length < 2) return;
  const f0 = mtof(ev.midi);
  for (let i = 1; i < P.length; i++) {
    const seg = P[i].time - P[i - 1].time, gl = Math.min(0.25 * seg, 0.15);
    param.setValueAtTime(mtof(P[i - 1].midi) / f0, t0 + P[i].time - gl);
    param.exponentialRampToValueAtTime(mtof(P[i].midi) / f0, t0 + P[i].time);
  }
}

function vibrato(ctx, t, depth, delay, rate, stopAt) {
  const l = osc(ctx, 'sine', rate || (5.2 + Math.random() * 0.5), t);
  const d = gain(ctx, 0);
  d.gain.setValueAtTime(0, t);
  d.gain.linearRampToValueAtTime(0, t + (delay || 0.25));
  d.gain.linearRampToValueAtTime(depth, t + (delay || 0.25) + 0.3);
  l.connect(d);
  l.start(t); l.stop(stopAt);
  return d;                                     // connect to oscillator .detune params
}

// sustained amplitude envelope; returns the time after which the voice is silent
function sustainEnv(param, t, end, peak, attack, sus, decay, rel) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + attack);
  if (sus < 1) param.setTargetAtTime(peak * sus, t + attack, decay || 0.3);
  param.setTargetAtTime(0, end, rel);
  return end + rel * 7;
}

const FORMANTS = {
  a: [[730, 1], [1090, 0.5], [2440, 0.28]],
  e: [[530, 1], [1840, 0.45], [2480, 0.28]],
  i: [[300, 1], [2290, 0.38], [3010, 0.24]],
  o: [[570, 1], [840, 0.62], [2410, 0.18]],
  u: [[320, 1], [870, 0.35], [2240, 0.12]]
};
function vowelOf(text) {
  const m = /[aeiouy]/i.exec(text || '');
  if (!m) return 'a';
  const c = m[0].toLowerCase();
  return c === 'y' ? 'i' : c;
}

const V = {};

V.piano = function (ctx, out, ev, t, dur, g, p) {
  const buf = pianoBuffer(ctx, ev.midi, p.bright || 1);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const v = ev.velocity / 127;
  const lp = biquad(ctx, 'lowpass', 1400 + Math.pow(v, 1.3) * (p.bright > 1 ? 13000 : 8500), 0.5);
  const a = gain(ctx, g);
  const end = t + Math.max(dur, 0.08);
  a.gain.setValueAtTime(g, end);
  a.gain.setTargetAtTime(0, end, 0.1);
  s.connect(lp).connect(a).connect(out);
  s.start(t);
  s.stop(Math.min(t + buf.duration, end + 0.8));
};

V.pluck = function (ctx, out, ev, t, dur, g, p, x) {
  const buf = pluckBuffer(ctx, ev.midi, p);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  rateTo(s.playbackRate, ev, x.t0);
  const v = ev.velocity / 127;
  let node = s;
  if (p.body) { const b = biquad(ctx, 'peaking', p.body, 1.1, 5); node.connect(b); node = b; }
  const lp = biquad(ctx, 'lowpass', (p.tone || 5000) * (0.45 + 0.55 * v), p.q || 0.7);
  node.connect(lp);
  const a = gain(ctx, g);
  lp.connect(a).connect(out);
  const rel = p.rel || 0.2, end = t + Math.max(dur, 0.04);
  a.gain.setValueAtTime(g, end);
  a.gain.setTargetAtTime(0, end, rel);
  s.start(t);
  s.stop(Math.min(t + buf.duration, end + rel * 6));
};

V.epiano = function (ctx, out, ev, t, dur, g, p) {
  const f = mtof(ev.midi), v = ev.velocity / 127, end = t + Math.max(dur, 0.06);
  const car = osc(ctx, 'sine', f, t), mod = osc(ctx, 'sine', f * (p.ratio || 1), t);
  const mg = gain(ctx, 0), idx = (p.index || 1.8) * (0.45 + v);
  mg.gain.setValueAtTime(f * idx, t);
  mg.gain.setTargetAtTime(f * idx * 0.22, t, p.dx ? 0.25 : 0.4);
  mod.connect(mg).connect(car.frequency);
  const tine = osc(ctx, 'sine', f * (p.dx ? 9.02 : 14.03), t), tg = gain(ctx, 0);
  tg.gain.setValueAtTime(g * (p.tine || 0.1) * (0.3 + v), t);
  tg.gain.setTargetAtTime(0, t, p.dx ? 0.12 : 0.035);
  tine.connect(tg).connect(out);
  const a = gain(ctx, 0), tau = clampN(2.1 * Math.pow(261.6 / f, 0.5), 0.35, 3.6);
  a.gain.setValueAtTime(0, t);
  a.gain.linearRampToValueAtTime(g, t + 0.003);
  a.gain.setTargetAtTime(0, t + 0.003, tau);
  a.gain.setTargetAtTime(0, end, 0.12);
  car.connect(a).connect(out);
  const stop = end + 0.9;
  [car, mod, tine].forEach(function (o) { o.start(t); o.stop(stop); });
};

V.organ = function (ctx, out, ev, t, dur, g, p, x) {
  const f = mtof(ev.midi), atk = p.attack || 0.008, end = t + Math.max(dur, atk + 0.02);
  const o = osc(ctx, wave(ctx, p.wave || 'drawbar'), f, t);
  pitchTo(o.frequency, ev, f, x.t0, 1);
  const a = gain(ctx, 0);
  const stop = sustainEnv(a.gain, t, end, g * 0.42, atk, 1, 0, p.rel || 0.03);
  let node = o;
  if (p.drive) { const ws = ctx.createWaveShaper(); ws.curve = tanhCurve(ctx, 2.2); o.connect(ws); node = ws; }
  const trem = gain(ctx, 1);
  if (p.leslie) {
    const l = osc(ctx, 'sine', 6.3, t), lg = gain(ctx, 0.18), dv = gain(ctx, 7);
    l.connect(lg).connect(trem.gain); l.connect(dv).connect(o.detune);
    l.start(t); l.stop(stop);
  }
  if (p.perc) {
    const po = osc(ctx, 'sine', f * 3, t), pg = gain(ctx, 0);
    pg.gain.setValueAtTime(g * 0.35, t); pg.gain.setTargetAtTime(0, t, 0.12);
    po.connect(pg).connect(out); po.start(t); po.stop(t + 1);
  }
  node.connect(a).connect(trem).connect(out);
  o.start(t); o.stop(stop);
};

V.mallet = function (ctx, out, ev, t, dur, g, p) {
  const f = mtof(ev.midi), v = ev.velocity / 127;
  const bus = gain(ctx, 1), trem = gain(ctx, 1);
  bus.connect(trem).connect(out);
  let stopAt = t + 0.2;
  p.modes.forEach(function (m, i) {
    const fr = f * m[0];
    if (fr > 15000) return;
    const o = osc(ctx, 'sine', fr, t), mg = gain(ctx, 0);
    const amp = g * m[1] * (i ? 0.35 + 0.65 * v : 1);
    const tau = m[2] * Math.pow(523 / f, 0.25);
    mg.gain.setValueAtTime(0, t);
    mg.gain.linearRampToValueAtTime(amp, t + 0.0015);
    mg.gain.setTargetAtTime(0, t + 0.0015, tau);
    if (p.drop && i === 0) o.frequency.exponentialRampToValueAtTime(fr * p.drop, t + 0.4);
    o.connect(mg).connect(bus);
    const st = t + tau * 6 + 0.05;
    o.start(t); o.stop(st);
    stopAt = Math.max(stopAt, st);
  });
  if (p.thump) {
    const n = noise(ctx, t, 0.06), bp = biquad(ctx, 'bandpass', Math.min(4000, f * 2), 1), ng = gain(ctx, 0);
    ng.gain.setValueAtTime(g * 0.25, t); ng.gain.setTargetAtTime(0, t, 0.008);
    n.connect(bp).connect(ng).connect(bus);
  }
  if (p.trem) {
    const l = osc(ctx, 'sine', p.trem, t), lg = gain(ctx, 0.3);
    l.connect(lg).connect(trem.gain); l.start(t); l.stop(stopAt);
  }
  const end = t + Math.max(dur, 0.12);
  bus.gain.setValueAtTime(1, end);
  bus.gain.setTargetAtTime(0, end, p.ring || 0.5);
};

V.drive = function (ctx, out, ev, t, dur, g, p, x) {
  const f = mtof(ev.midi), end = t + Math.max(dur, 0.05);
  const pre = gain(ctx, 0.5 * (p.drive || 4));
  const a = gain(ctx, 0);
  const stop = sustainEnv(a.gain, t, end, g * 0.3, 0.004, 0.7, 0.5, 0.06);
  [-7, 7].forEach(function (d) {
    const o = osc(ctx, 'sawtooth', f, t, d);
    pitchTo(o.frequency, ev, f, x.t0, 1);
    o.connect(pre); o.start(t); o.stop(stop);
  });
  const ws = ctx.createWaveShaper();
  ws.curve = tanhCurve(ctx, 3); ws.oversample = '4x';
  const hp = biquad(ctx, 'highpass', 90, 0.7), lp = biquad(ctx, 'lowpass', 3600, 0.9);
  const mid = biquad(ctx, 'peaking', 1700, 1.2, 5), mud = biquad(ctx, 'peaking', 380, 1, -4);
  pre.connect(ws).connect(hp).connect(lp).connect(mid).connect(mud).connect(a).connect(out);
};

V.synthbass = function (ctx, out, ev, t, dur, g, p, x) {
  const f = mtof(ev.midi), end = t + Math.max(dur, 0.03);
  const a = gain(ctx, 0);
  const stop = sustainEnv(a.gain, t, end, g * 0.55, 0.003, 0.8, 0.25, 0.04);
  const o = osc(ctx, p.wave || 'sawtooth', f, t);
  pitchTo(o.frequency, ev, f, x.t0, 1);
  const lp = biquad(ctx, 'lowpass', 0, p.q || 4);
  const top = Math.min(p.top || 2000, f * 24), base = Math.min(p.base || 400, f * 6);
  lp.frequency.setValueAtTime(top, t);
  lp.frequency.setTargetAtTime(base, t + 0.003, p.fdecay || 0.15);
  o.connect(lp).connect(a).connect(out);
  o.start(t); o.stop(stop);
  if (p.sub) {                                  // a quiet 2nd harmonic keeps a sine bass audible on small speakers
    const h = osc(ctx, 'sine', f * 2, t), hg = gain(ctx, 0.18);
    pitchTo(h.frequency, ev, f, x.t0, 2);
    h.connect(hg).connect(a); h.start(t); h.stop(stop);
  }
};

V.synthpluck = function (ctx, out, ev, t, dur, g, p, x) {
  const f = mtof(ev.midi), v = ev.velocity / 127, end = t + Math.max(dur, 0.05);
  const a = gain(ctx, 0);
  a.gain.setValueAtTime(0, t);
  a.gain.linearRampToValueAtTime(g * 0.5, t + 0.002);
  a.gain.setTargetAtTime(0, t + 0.002, 0.28);
  a.gain.setTargetAtTime(0, end, 0.12);
  const lp = biquad(ctx, 'lowpass', 0, 5);
  lp.frequency.setValueAtTime(Math.min(9000, f * (10 + 14 * v)), t);
  lp.frequency.setTargetAtTime(Math.min(3000, f * 1.6), t, 0.08);
  [['sawtooth', -6], ['square', 6]].forEach(function (w) {
    const o = osc(ctx, w[0], f, t, w[1]);
    pitchTo(o.frequency, ev, f, x.t0, 1);
    o.connect(lp); o.start(t); o.stop(end + 0.9);
  });
  lp.connect(a).connect(out);
};

V.strings = function (ctx, out, ev, t, dur, g, p, x) {
  const f = mtof(ev.midi), n = p.voices || 3, atk = p.attack || 0.12, end = t + Math.max(dur, atk + 0.02);
  const a = gain(ctx, 0);
  const stop = sustainEnv(a.gain, t, end, g * 0.5, atk, 1, 0, p.rel || 0.16);
  const mix = gain(ctx, 1 / Math.sqrt(n));
  const vib = vibrato(ctx, t, p.vib || 8, 0.2, null, stop);
  const w = p.wave === 'sawtooth' ? 'sawtooth' : wave(ctx, 'violin');
  for (let i = 0; i < n; i++) {
    const det = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * (p.spread || 9);
    const o = osc(ctx, w, f, t, det);
    pitchTo(o.frequency, ev, f, x.t0, 1);
    vib.connect(o.detune);
    o.connect(mix); o.start(t); o.stop(stop);
  }
  const lp = biquad(ctx, 'lowpass', Math.min(p.cut || 3500, f * 10), 0.6);
  const hp = biquad(ctx, 'highpass', Math.max(40, f * 0.5), 0.5);
  const trem = gain(ctx, 1);
  if (p.trem) {
    const l = osc(ctx, 'sine', p.trem, t), lg = gain(ctx, 0.45);
    l.connect(lg).connect(trem.gain); l.start(t); l.stop(stop);
  }
  const bow = noise(ctx, t, stop - t), bf = biquad(ctx, 'bandpass', Math.min(5000, f * 5), 1.4), bg = gain(ctx, 0.05);
  bow.connect(bf).connect(bg).connect(lp);
  mix.connect(lp).connect(hp).connect(a).connect(trem).connect(out);
};

V.brass = function (ctx, out, ev, t, dur, g, p, x) {
  const f = mtof(ev.midi), v = ev.velocity / 127, n = p.voices || 1, atk = p.attack || 0.035;
  const end = t + Math.max(dur, atk + 0.02);
  const a = gain(ctx, 0);
  const stop = sustainEnv(a.gain, t, end, g * 0.5, atk, 0.85, 0.3, 0.07);
  const lp = biquad(ctx, 'lowpass', 300, p.mute ? 5 : 1.3);
  const peak = Math.min(p.cut || 4000, f * (p.mellow ? 4.5 : 9)) * (0.55 + 0.45 * v);
  lp.frequency.setValueAtTime(Math.min(260, peak), t);
  lp.frequency.linearRampToValueAtTime(peak, t + atk + 0.02);
  lp.frequency.setTargetAtTime(peak * 0.65, t + atk + 0.05, 0.35);
  const vib = vibrato(ctx, t, 7, 0.3, null, stop);
  const w = p.synth ? 'sawtooth' : wave(ctx, 'brass');
  for (let i = 0; i < n; i++) {
    const det = n === 1 ? 0 : (i / (n - 1) - 0.5) * 14;
    const o = osc(ctx, w, f, t, det);
    pitchTo(o.frequency, ev, f, x.t0, 1);
    vib.connect(o.detune);
    o.connect(lp); o.start(t); o.stop(stop);
  }
  let node = lp;
  if (p.mute) { const bp = biquad(ctx, 'bandpass', 1500, 2.2); lp.connect(bp); node = bp; }
  node.connect(a).connect(out);
};

V.hit = function (ctx, out, ev, t, dur, g) {
  const f = mtof(ev.midi);
  const a = gain(ctx, 0);
  a.gain.setValueAtTime(0, t);
  a.gain.linearRampToValueAtTime(g * 0.5, t + 0.005);
  a.gain.setTargetAtTime(0, t + 0.005, 0.12);
  const lp = biquad(ctx, 'lowpass', 4500, 0.8);
  [1, 1.5, 2, 3].forEach(function (r, i) {
    [-8, 8].forEach(function (d) {
      const o = osc(ctx, 'sawtooth', f * r, t, d), og = gain(ctx, 1 / (i + 2));
      o.connect(og).connect(lp); o.start(t); o.stop(t + 0.9);
    });
  });
  lp.connect(a).connect(out);
};

V.reed = function (ctx, out, ev, t, dur, g, p, x) {
  const f = mtof(ev.midi), atk = p.attack || 0.04, end = t + Math.max(dur, atk + 0.02);
  const a = gain(ctx, 0);
  const stop = sustainEnv(a.gain, t, end, g * 0.45, atk, 0.9, 0.3, 0.06);
  const vib = vibrato(ctx, t, p.vib != null ? p.vib : 10, 0.25, null, stop);
  const w = wave(ctx, p.wave || 'sax');
  const dets = p.musette ? [-9, 9] : [0];
  const mix = gain(ctx, 1 / Math.sqrt(dets.length));
  dets.forEach(function (d) {
    const o = osc(ctx, w, f, t, d);
    pitchTo(o.frequency, ev, f, x.t0, 1);
    vib.connect(o.detune);
    o.connect(mix); o.start(t); o.stop(stop);
  });
  const peak = biquad(ctx, 'peaking', p.formant || 1200, 1.1, 6);
  const lp = biquad(ctx, 'lowpass', Math.min(p.cut || 4000, f * 12), 0.7);
  const br = noise(ctx, t, stop - t), bf = biquad(ctx, 'bandpass', Math.min(6000, f * 3), 0.9), bg = gain(ctx, p.breath || 0.04);
  br.connect(bf).connect(bg).connect(lp);
  mix.connect(peak).connect(lp).connect(a).connect(out);
};

V.pipe = function (ctx, out, ev, t, dur, g, p, x) {
  const f = mtof(ev.midi), atk = 0.05, end = t + Math.max(dur, atk + 0.02);
  const a = gain(ctx, 0);
  const stop = sustainEnv(a.gain, t, end, g * 0.5, atk, 0.92, 0.3, 0.08);
  const o = osc(ctx, p.pure ? 'sine' : wave(ctx, 'flute'), f, t);
  pitchTo(o.frequency, ev, f, x.t0, 1);
  vibrato(ctx, t, p.vib != null ? p.vib : 10, 0.3, null, stop).connect(o.detune);
  const lp = biquad(ctx, 'lowpass', Math.min(9000, f * 7), 0.5);
  o.connect(lp).connect(a).connect(out);
  o.start(t); o.stop(stop);
  const br = noise(ctx, t, stop - t), bf = biquad(ctx, 'bandpass', Math.min(8000, f * 2), 0.8), bg = gain(ctx, 0);
  const b = p.breath || 0.1;
  bg.gain.setValueAtTime(0, t);
  bg.gain.linearRampToValueAtTime(g * b * (p.chiff ? 3 : 2), t + 0.012);
  bg.gain.setTargetAtTime(g * b * 0.35, t + 0.012, 0.05);
  bg.gain.setTargetAtTime(0, end, 0.06);
  br.connect(bf).connect(bg).connect(out);
};

V.voice = function (ctx, out, ev, t, dur, g, p, x) {
  const f = mtof(ev.midi), n = p.voices || 1, atk = p.attack || 0.045, end = t + Math.max(dur, atk + 0.02);
  const a = gain(ctx, 0);
  const stop = sustainEnv(a.gain, t, end, g * 0.55, atk, 0.92, 0.4, 0.1);
  const src = gain(ctx, 1 / Math.sqrt(n));
  const vib = vibrato(ctx, t, p.vib || 15, 0.22, null, stop);
  const w = wave(ctx, 'glottal');
  for (let i = 0; i < n; i++) {
    const det = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * 11;
    const o = osc(ctx, w, f, t, det);
    pitchTo(o.frequency, ev, f, x.t0, 1);
    vib.connect(o.detune);
    o.connect(src); o.start(t); o.stop(stop);
  }
  const bus = gain(ctx, 1);
  const fm = FORMANTS[x.vowel] || FORMANTS.a;
  fm.forEach(function (fa, k) {
    const bp = biquad(ctx, 'bandpass', fa[0], k === 0 ? 5 : 8), bg = gain(ctx, fa[1] * 3);
    src.connect(bp).connect(bg).connect(bus);
  });
  const body = biquad(ctx, 'lowpass', Math.min(1400, f * 3), 0.5), bodyG = gain(ctx, 0.3);
  src.connect(body).connect(bodyG).connect(bus);
  bus.connect(a).connect(out);
};

V.lead = function (ctx, out, ev, t, dur, g, p, x) {
  const f = mtof(ev.midi), end = t + Math.max(dur, 0.03);
  const a = gain(ctx, 0);
  const stop = sustainEnv(a.gain, t, end, g * 0.4, 0.006, 0.85, 0.3, 0.05);
  const lp = biquad(ctx, 'lowpass', 0, 2.5);
  lp.frequency.setValueAtTime(Math.min(12000, f * 16), t);
  lp.frequency.setTargetAtTime(Math.min(7000, f * 7), t + 0.005, 0.2);
  const vib = vibrato(ctx, t, 9, 0.35, 5.5, stop);
  const pair = p.wave === 'square' ? [['square', 0, 1], ['square', 7, 0.5]] : [['sawtooth', -9, 1], ['sawtooth', 9, 1]];
  pair.forEach(function (w) {
    const o = osc(ctx, w[0], f, t, w[1]), og = gain(ctx, w[2] * 0.7);
    pitchTo(o.frequency, ev, f, x.t0, 1);
    vib.connect(o.detune);
    o.connect(og).connect(lp); o.start(t); o.stop(stop);
  });
  lp.connect(a).connect(out);
};

V.pad = function (ctx, out, ev, t, dur, g, p, x) {
  const f = mtof(ev.midi), atk = p.attack || 0.6, end = t + Math.max(dur, atk);
  const a = gain(ctx, 0);
  const stop = sustainEnv(a.gain, t, end, g * 0.38, atk, 1, 0, p.rel || 0.5);
  const lp = biquad(ctx, 'lowpass', Math.min(p.cut || 1600, f * 8), 0.7);
  if (p.sweep) {
    const l = osc(ctx, 'sine', 0.13, t), lg = gain(ctx, (p.cut || 1200) * 0.6);
    l.connect(lg).connect(lp.frequency); l.start(t); l.stop(stop);
  }
  const w = p.bowed ? wave(ctx, 'violin') : p.choir ? wave(ctx, 'glottal') : 'sawtooth';
  [-14, -5, 5, 14].forEach(function (d) {
    const o = osc(ctx, w, f, t, d), og = gain(ctx, 0.3);
    pitchTo(o.frequency, ev, f, x.t0, 1);
    o.connect(og).connect(lp); o.start(t); o.stop(stop);
  });
  if (p.halo) {
    const h = osc(ctx, 'sine', f * 2, t), hg = gain(ctx, 0.22);
    pitchTo(h.frequency, ev, f, x.t0, 2);
    h.connect(hg).connect(lp); h.start(t); h.stop(stop);
  }
  let node = lp;
  if (p.choir) {
    const bus = gain(ctx, 1);
    FORMANTS.a.forEach(function (fa) { const bp = biquad(ctx, 'bandpass', fa[0], 4), bg = gain(ctx, fa[1] * 2.2); lp.connect(bp).connect(bg).connect(bus); });
    node = bus;
  }
  node.connect(a).connect(out);
};

// ---------------------------------------------------------------------------
// Presets: instrument name -> voice + parameters. `gain` balances loudness.
// ---------------------------------------------------------------------------

function ks(o) { return Object.assign({ v: 'pluck' }, o); }
const PRESETS = {
  piano: { v: 'piano', bright: 1 },
  bright_piano: { v: 'piano', bright: 1.6 },
  electric_piano: { v: 'epiano', index: 1.7, tine: 0.12 },
  electric_piano2: { v: 'epiano', index: 3.2, ratio: 1, tine: 0.22, dx: true },
  harpsichord: ks({ bright: 0.95, damp: 0.42, t60: 2.2, len: 2.4, pick: 0.13, tone: 8000, rel: 0.35 }),
  clavinet: ks({ bright: 0.92, damp: 0.45, t60: 1.0, len: 1.2, pick: 0.07, tone: 5200, q: 3.5, rel: 0.04 }),
  organ: { v: 'organ', wave: 'drawbar' },
  percussive_organ: { v: 'organ', wave: 'drawbar', perc: true },
  rock_organ: { v: 'organ', wave: 'rock', leslie: true, drive: true },
  church_organ: { v: 'organ', wave: 'church', attack: 0.07, rel: 0.3 },
  accordion: { v: 'reed', wave: 'accordion', musette: true, attack: 0.03, cut: 3600, vib: 0, formant: 1200 },
  harmonica: { v: 'reed', wave: 'harmonica', attack: 0.04, cut: 3200, vib: 9, formant: 1500, breath: 0.08 },
  celesta: { v: 'mallet', modes: [[1, 1, 0.9], [2, 0.3, 0.35], [3, 0.12, 0.15], [4.2, 0.06, 0.08]], ring: 0.8 },
  glockenspiel: { v: 'mallet', modes: [[1, 1, 1.3], [2.71, 0.4, 0.5], [5.15, 0.22, 0.2], [8.2, 0.1, 0.1]], ring: 1.2 },
  music_box: { v: 'mallet', modes: [[1, 1, 0.9], [3.1, 0.25, 0.3], [5.9, 0.12, 0.12]], ring: 1 },
  vibraphone: { v: 'mallet', modes: [[1, 1, 1.6], [4, 0.28, 0.45], [10, 0.05, 0.1]], trem: 5.5, ring: 0.7 },
  marimba: { v: 'mallet', modes: [[1, 1, 0.45], [4, 0.32, 0.12], [9.9, 0.1, 0.04]], thump: true, ring: 0.4 },
  xylophone: { v: 'mallet', modes: [[1, 1, 0.28], [3, 0.45, 0.12], [6, 0.18, 0.05]], ring: 0.3 },
  tubular_bells: { v: 'mallet', modes: [[1, 1, 2.4], [2.76, 0.55, 1.6], [5.4, 0.35, 1.0], [8.93, 0.22, 0.7], [13.3, 0.1, 0.4]], ring: 2 },
  timpani: { v: 'mallet', modes: [[1, 1, 0.9], [1.5, 0.45, 0.6], [1.98, 0.3, 0.5], [2.44, 0.18, 0.4]], thump: true, drop: 0.985, ring: 0.8 },
  kalimba: { v: 'mallet', modes: [[1, 1, 0.65], [5.9, 0.22, 0.06], [14.9, 0.07, 0.02]], ring: 0.7 },
  steel_drums: { v: 'mallet', modes: [[1, 1, 0.7], [2, 0.6, 0.5], [3, 0.28, 0.3], [4.07, 0.14, 0.2]], ring: 0.6 },
  nylon_guitar: ks({ bright: 0.35, t60: 3.2, len: 3, pick: 0.2, tone: 3200, body: 115, rel: 0.4 }),
  acoustic_guitar: ks({ bright: 0.72, t60: 3.6, len: 3.2, pick: 0.14, tone: 6000, body: 105, rel: 0.45 }),
  jazz_guitar: ks({ bright: 0.3, t60: 2.6, len: 2.6, pick: 0.25, tone: 2300, body: 150, rel: 0.25 }),
  clean_guitar: ks({ bright: 0.62, t60: 3.4, len: 3.2, pick: 0.12, tone: 4800, rel: 0.3 }),
  muted_guitar: ks({ bright: 0.5, t60: 0.35, len: 0.6, pick: 0.15, tone: 2600, rel: 0.04 }),
  harp: ks({ bright: 0.45, damp: 0.47, t60: 4.5, len: 4.5, pick: 0.48, tone: 5200, rel: 1.4 }),
  pizzicato: ks({ bright: 0.35, t60: 0.9, len: 1.2, pick: 0.3, tone: 3200, body: 260, rel: 0.15 }),
  banjo: ks({ bright: 0.96, damp: 0.38, t60: 1.6, len: 1.8, pick: 0.09, tone: 7500, body: 420, rel: 0.25 }),
  sitar: ks({ bright: 0.92, damp: 0.33, t60: 3.6, len: 3.4, pick: 0.08, tone: 6500, body: 900, q: 2, rel: 0.4 }),
  koto: ks({ bright: 0.82, damp: 0.42, t60: 2.6, len: 2.6, pick: 0.1, tone: 6200, rel: 0.4 }),
  synth_pluck: { v: 'synthpluck' },
  overdrive_guitar: { v: 'drive', drive: 3 },
  distortion_guitar: { v: 'drive', drive: 9 },
  bass: ks({ bright: 0.4, t60: 3.2, t60k: 0.15, len: 2.6, pick: 0.2, tone: 1900, rel: 0.06 }),
  upright_bass: ks({ bright: 0.25, t60: 1.8, t60k: 0.15, len: 1.8, pick: 0.24, tone: 1200, body: 95, rel: 0.08 }),
  pick_bass: ks({ bright: 0.72, t60: 3.0, t60k: 0.15, len: 2.6, pick: 0.1, tone: 3200, rel: 0.05 }),
  fretless_bass: ks({ bright: 0.25, t60: 3.8, t60k: 0.15, len: 3, pick: 0.3, tone: 1500, rel: 0.08 }),
  slap_bass: ks({ bright: 1, t60: 2.2, t60k: 0.15, len: 2, pick: 0.06, tone: 5200, rel: 0.05, slap: true }),
  synth_bass: { v: 'synthbass', wave: 'sawtooth', top: 2400, base: 380, q: 6, fdecay: 0.14 },
  synth_bass2: { v: 'synthbass', wave: 'square', top: 1600, base: 320, q: 3, fdecay: 0.25 },
  sub_bass: { v: 'synthbass', wave: 'sine', top: 400, base: 300, q: 0.5, sub: true },
  violin: { v: 'strings', voices: 1, attack: 0.07, vib: 14, cut: 6500 },
  viola: { v: 'strings', voices: 1, attack: 0.08, vib: 12, cut: 4800 },
  cello: { v: 'strings', voices: 1, attack: 0.09, vib: 11, cut: 3600 },
  contrabass: { v: 'strings', voices: 1, attack: 0.1, vib: 8, cut: 2200 },
  fiddle: { v: 'strings', voices: 1, attack: 0.03, vib: 16, cut: 7000, rel: 0.1 },
  tremolo_strings: { v: 'strings', voices: 4, attack: 0.08, trem: 12, cut: 4000 },
  strings: { v: 'strings', voices: 4, attack: 0.18, cut: 3800 },
  slow_strings: { v: 'strings', voices: 4, attack: 0.55, cut: 3000, rel: 0.35 },
  synth_strings: { v: 'strings', voices: 3, wave: 'sawtooth', attack: 0.25, cut: 2600, spread: 14 },
  voice: { v: 'voice', voices: 1, vib: 18 },
  choir: { v: 'voice', voices: 4, vib: 10, attack: 0.15 },
  synth_voice: { v: 'voice', voices: 2, vib: 6, attack: 0.08 },
  trumpet: { v: 'brass', cut: 5200, attack: 0.03 },
  muted_trumpet: { v: 'brass', cut: 3200, mute: true },
  trombone: { v: 'brass', cut: 3300, attack: 0.045 },
  french_horn: { v: 'brass', cut: 1900, attack: 0.06, mellow: true },
  tuba: { v: 'brass', cut: 1300, attack: 0.06, mellow: true },
  brass: { v: 'brass', cut: 4300, voices: 3, attack: 0.04 },
  synth_brass: { v: 'brass', cut: 3600, voices: 2, attack: 0.02, synth: true },
  orchestra_hit: { v: 'hit' },
  soprano_sax: { v: 'reed', wave: 'sax', formant: 1700, cut: 5200, vib: 12 },
  alto_sax: { v: 'reed', wave: 'sax', formant: 1300, cut: 4600, vib: 12 },
  tenor_sax: { v: 'reed', wave: 'sax', formant: 1000, cut: 3900, vib: 12, breath: 0.07 },
  baritone_sax: { v: 'reed', wave: 'sax', formant: 700, cut: 3000, vib: 10 },
  oboe: { v: 'reed', wave: 'oboe', formant: 1400, cut: 5200, vib: 8 },
  english_horn: { v: 'reed', wave: 'oboe', formant: 1000, cut: 4200, vib: 8 },
  bassoon: { v: 'reed', wave: 'oboe', formant: 500, cut: 2600, vib: 6 },
  clarinet: { v: 'reed', wave: 'clarinet', formant: 1500, cut: 4200, vib: 4 },
  bagpipe: { v: 'reed', wave: 'oboe', formant: 1800, cut: 6500, vib: 0 },
  piccolo: { v: 'pipe', breath: 0.1, vib: 10 },
  flute: { v: 'pipe', breath: 0.13, vib: 12 },
  recorder: { v: 'pipe', breath: 0.07, vib: 4 },
  pan_flute: { v: 'pipe', breath: 0.28, vib: 8, chiff: true },
  whistle: { v: 'pipe', breath: 0.09, vib: 14 },
  ocarina: { v: 'pipe', breath: 0.05, vib: 6, pure: true },
  square_lead: { v: 'lead', wave: 'square' },
  saw_lead: { v: 'lead', wave: 'sawtooth' },
  pad: { v: 'pad', cut: 1600, attack: 0.6 },
  poly_pad: { v: 'pad', cut: 2600, attack: 0.15, rel: 0.35 },
  choir_pad: { v: 'pad', cut: 1800, attack: 0.5, choir: true },
  bowed_pad: { v: 'pad', cut: 2000, attack: 0.9, bowed: true },
  halo_pad: { v: 'pad', cut: 2200, attack: 1.0, halo: true },
  sweep_pad: { v: 'pad', cut: 1200, attack: 0.5, sweep: true }
};
Object.keys(PRESETS).forEach(function (k) { PRESETS[k].id = k; });

// Loudness corrections, measured by rendering each instrument at velocity 80 and
// matching its RMS to a target for its role (quieter for pads and mallets).
const LEVELS = {
  piano: 0.93, bright_piano: 1.08, electric_piano: 0.29, electric_piano2: 0.25, harpsichord: 2.16, clavinet: 2.95,
  organ: 0.78, percussive_organ: 0.72, rock_organ: 0.64, church_organ: 0.99, accordion: 1.05, harmonica: 1.05,
  celesta: 0.28, glockenspiel: 0.26, music_box: 0.28, vibraphone: 0.25, marimba: 0.33, xylophone: 0.47,
  tubular_bells: 0.25, timpani: 0.25, kalimba: 0.3, steel_drums: 0.27, nylon_guitar: 1.63, acoustic_guitar: 1.94,
  jazz_guitar: 1.24, clean_guitar: 1.77, muted_guitar: 3.8, harp: 1.66, pizzicato: 2.72, banjo: 2.65,
  sitar: 1.8, koto: 2.63, synth_pluck: 0.66, overdrive_guitar: 0.88, distortion_guitar: 0.78, bass: 2.73,
  upright_bass: 2.48, pick_bass: 2.46, fretless_bass: 1.63, slap_bass: 3.51, synth_bass: 0.83, synth_bass2: 0.51,
  sub_bass: 0.61, violin: 0.72, viola: 0.72, cello: 0.73, contrabass: 0.73, fiddle: 0.71,
  tremolo_strings: 0.86, strings: 1, slow_strings: 1.26, synth_strings: 0.79, voice: 0.75, choir: 0.88,
  synth_voice: 1.01, trumpet: 1.5, muted_trumpet: 2.55, trombone: 1.51, french_horn: 1.62, tuba: 1.62,
  brass: 0.95, synth_brass: 0.59, orchestra_hit: 2.67, soprano_sax: 0.71, alto_sax: 0.73, tenor_sax: 0.73,
  baritone_sax: 0.74, oboe: 0.94, english_horn: 0.93, bassoon: 1.07, clarinet: 0.43, bagpipe: 0.91,
  piccolo: 0.53, flute: 0.53, recorder: 0.53, pan_flute: 0.53, whistle: 0.53, ocarina: 0.54,
  square_lead: 0.72, saw_lead: 1.01, pad: 1.74, poly_pad: 1.43, choir_pad: 1.88, bowed_pad: 2.15,
  halo_pad: 2.02, sweep_pad: 1.66
};
Object.keys(LEVELS).forEach(function (k) { if (PRESETS[k]) PRESETS[k].gain = LEVELS[k]; });

// Loudness balance per voice type (measured by rendering each voice at velocity 80).
const VOICE_GAIN = {
  piano: 1, pluck: 1, epiano: 1, organ: 1, mallet: 1, drive: 1, synthbass: 1, synthpluck: 1,
  strings: 1, brass: 1, hit: 1, reed: 1, pipe: 1, voice: 1, lead: 1, pad: 1, drums: 1
};

function presetFor(track) {
  return PRESETS[track.instrument] || PRESETS.piano;
}

// ---------------------------------------------------------------------------
// Drums: every lane is synthesized (no samples)
// ---------------------------------------------------------------------------

const KIT_OF = { drums: 'acoustic', percussion: 'acoustic', drums_rock: 'rock', drums_electronic: 'electronic', drums_808: '808', drums_jazz: 'jazz', drums_brush: 'brush' };

function env1(ctx, t, peak, attack, tau) {
  const a = gain(ctx, 0);
  a.gain.setValueAtTime(0, t);
  a.gain.linearRampToValueAtTime(peak, t + attack);
  a.gain.setTargetAtTime(0, t + attack, tau);
  return a;
}
function tone(ctx, out, t, g, type, f0, f1, sweep, tau) {
  const o = osc(ctx, type, f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + sweep);
  const a = env1(ctx, t, g, 0.0015, tau);
  o.connect(a).connect(out);
  o.start(t); o.stop(t + tau * 8 + 0.02);
  return a;
}
function hiss(ctx, out, t, g, filters, attack, tau) {
  const n = noise(ctx, t, attack + tau * 8 + 0.02);
  let node = n;
  filters.forEach(function (f) { const b = biquad(ctx, f[0], f[1], f[2] != null ? f[2] : 0.7, f[3]); node.connect(b); node = b; });
  const a = env1(ctx, t, g, attack, tau);
  node.connect(a).connect(out);
  return a;
}
// six detuned square waves, the classic recipe for metallic cymbal tone
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];
function metal(ctx, out, t, g, scale, filters, tau) {
  const bus = gain(ctx, 1 / 6);
  METAL.forEach(function (f) { const o = osc(ctx, 'square', f * scale, t); o.connect(bus); o.start(t); o.stop(t + tau * 8 + 0.02); });
  let node = bus;
  filters.forEach(function (f) { const b = biquad(ctx, f[0], f[1], f[2] != null ? f[2] : 0.7, f[3]); node.connect(b); node = b; });
  const a = env1(ctx, t, g, 0.001, tau);
  node.connect(a).connect(out);
  return a;
}

// loudness balance per lane (measured), applied before synthesis
const LANE_GAIN = {
  kick: 1, snare: 1, rim: 1.4, clap: 2.8, hat: 1.1, pedalhat: 1.1, openhat: 1, crash: 0.7, crash2: 0.7,
  splash: 0.8, china: 0.7, ride: 1.4, ridebell: 0.9, tom_hi: 0.85, tom_mid: 0.85, tom_low: 0.85,
  tamb: 1.2, shaker: 1.6, cowbell: 1.3, clave: 1.4, woodblock: 1.3, triangle: 0.9
};
function playDrum(ctx, out, lane, t, g, kit, st) {
  const soft = kit === 'jazz' || kit === 'brush';
  g *= (LANE_GAIN[lane] || 1) * (kit === '808' && lane === 'kick' ? 0.55 : 1);
  switch (lane) {
    case 'kick': {
      const k = { acoustic: [150, 47, 0.09, 0.15, 0.35], rock: [138, 44, 0.1, 0.19, 0.45], electronic: [165, 45, 0.07, 0.2, 0.3],
        '808': [118, 41, 0.28, 0.42, 0.05], jazz: [105, 62, 0.06, 0.12, 0.25], brush: [96, 56, 0.06, 0.1, 0.12] }[kit];
      const a = tone(ctx, out, t, g * 1.25, 'sine', k[0], k[1], k[2], k[3]);
      if (kit === '808') { const ws = ctx.createWaveShaper(); ws.curve = tanhCurve(ctx, 1.6); a.disconnect(); a.connect(ws).connect(out); }
      hiss(ctx, out, t, g * k[4], [['highpass', 2500]], 0.001, 0.004);
      return;
    }
    case 'snare': {
      if (kit === 'brush') { hiss(ctx, out, t, g * 0.55, [['bandpass', 3200, 0.6]], 0.012, 0.09); return; }
      const k = { acoustic: [190, 0.075], rock: [180, 0.1], electronic: [210, 0.06], '808': [238, 0.055], jazz: [210, 0.06] }[kit] || [190, 0.075];
      tone(ctx, out, t, g * 0.5, 'triangle', k[0] * 1.15, k[0], 0.04, 0.045);
      hiss(ctx, out, t, g * 0.75, [['highpass', 1300], ['peaking', 5200, 1, 4]], 0.001, k[1]);
      return;
    }
    case 'rim':
      tone(ctx, out, t, g * 0.5, 'triangle', 1750, 1700, 0.01, 0.012);
      hiss(ctx, out, t, g * 0.35, [['bandpass', 2500, 2]], 0.0005, 0.008);
      return;
    case 'clap': {
      const n = noise(ctx, t, 0.5), bp = biquad(ctx, 'bandpass', 1150, 0.9), a = gain(ctx, 0);
      [0, 0.011, 0.022].forEach(function (d) { a.gain.setValueAtTime(g * 0.8, t + d); a.gain.setTargetAtTime(0, t + d + 0.001, 0.004); });
      a.gain.setValueAtTime(g * 0.75, t + 0.033);
      a.gain.setTargetAtTime(0, t + 0.034, 0.055);
      n.connect(bp).connect(a).connect(out);
      return;
    }
    case 'hat': case 'pedalhat': case 'openhat': {
      // any hi-hat hit cuts off a ringing open hi-hat (choke)
      if (st.open && t < st.open.until) { st.open.nodes.forEach(function (n) { n.gain.setTargetAtTime(0, t, 0.008); }); st.open = null; }
      const tau = lane === 'hat' ? 0.016 : lane === 'pedalhat' ? 0.022 : 0.13;
      const lvl = (lane === 'pedalhat' ? 0.45 : 0.6) * (soft ? 0.6 : 1);
      const hp = soft ? 5200 : kit === '808' ? 7600 : 7000;
      const a = metal(ctx, out, t, g * lvl, kit === '808' ? 1.25 : 1, [['highpass', hp], ['peaking', 10000, 1, 3]], tau);
      const b = hiss(ctx, out, t, g * lvl * 0.55, [['highpass', hp + 1000]], 0.0008, tau);
      if (lane === 'openhat') st.open = { nodes: [a, b], until: t + tau * 8 };
      return;
    }
    case 'crash': case 'crash2': case 'splash': case 'china': {
      const tau = { crash: 0.55, crash2: 0.48, splash: 0.2, china: 0.38 }[lane] * (soft ? 0.8 : 1);
      const sc = { crash: 1.6, crash2: 1.75, splash: 2.1, china: 1.35 }[lane];
      metal(ctx, out, t, g * 0.35, sc, [['highpass', 4200], lane === 'china' ? ['bandpass', 3300, 2] : ['peaking', 7500, 0.8, 3]], tau);
      hiss(ctx, out, t, g * 0.45, [['highpass', 5000], ['peaking', 9000, 0.7, 4]], 0.002, tau * 1.1);
      return;
    }
    case 'ride':
      metal(ctx, out, t, g * 0.28, 2.3, [['highpass', 5000], ['peaking', 8500, 1.5, 6]], 0.3);
      hiss(ctx, out, t, g * 0.18, [['bandpass', 9000, 1]], 0.001, 0.28);
      tone(ctx, out, t, g * 0.06, 'sine', 3400, 3400, 0, 0.25);
      return;
    case 'ridebell':
      [2100, 3170, 4650].forEach(function (f, i) { tone(ctx, out, t, g * 0.22 / (i + 1), 'sine', f, f, 0, 0.42); });
      metal(ctx, out, t, g * 0.12, 2.6, [['highpass', 6000]], 0.2);
      return;
    case 'tom_hi': case 'tom_mid': case 'tom_low': {
      const f = { tom_hi: 220, tom_mid: 165, tom_low: 115 }[lane];
      const tau = (kit === '808' || kit === 'electronic' ? 0.22 : 0.14) * (lane === 'tom_low' ? 1.25 : 1);
      tone(ctx, out, t, g * 0.95, 'sine', f * 1.35, f, 0.12, tau);
      hiss(ctx, out, t, g * 0.18, [['lowpass', 3000]], 0.001, 0.012);
      return;
    }
    case 'tamb': {
      const n = noise(ctx, t, 0.4), hp = biquad(ctx, 'highpass', 6500, 0.7), bp = biquad(ctx, 'peaking', 10500, 1, 6), a = gain(ctx, 0);
      [0, 0.009, 0.018].forEach(function (d, i) { a.gain.setValueAtTime(g * 0.45 / (i + 1), t + d); a.gain.setTargetAtTime(0, t + d + 0.001, 0.006); });
      a.gain.setValueAtTime(g * 0.3, t + 0.026);
      a.gain.setTargetAtTime(0, t + 0.027, 0.05);
      n.connect(hp).connect(bp).connect(a).connect(out);
      return;
    }
    case 'shaker':
      hiss(ctx, out, t, g * 0.4, [['bandpass', 6500, 1.2]], 0.012, 0.025);
      return;
    case 'cowbell': {
      const bus = gain(ctx, 0.5), bp = biquad(ctx, 'bandpass', 900, 1.6);
      [545, 815].forEach(function (f) { const o = osc(ctx, 'square', f, t); o.connect(bus); o.start(t); o.stop(t + 0.8); });
      const a = gain(ctx, 0);
      a.gain.setValueAtTime(0, t);
      a.gain.linearRampToValueAtTime(g * 0.6, t + 0.001);
      a.gain.setTargetAtTime(g * 0.2, t + 0.001, 0.015);
      a.gain.setTargetAtTime(0, t + 0.03, 0.09);
      bus.connect(bp).connect(a).connect(out);
      return;
    }
    case 'conga_hi': case 'conga_lo': case 'bongo_hi': case 'bongo_lo': {
      const f = { conga_hi: 330, conga_lo: 225, bongo_hi: 480, bongo_lo: 340 }[lane];
      tone(ctx, out, t, g * 0.8, 'sine', f * 1.05, f, 0.04, lane.indexOf('bongo') === 0 ? 0.05 : 0.075);
      hiss(ctx, out, t, g * 0.2, [['bandpass', 2200, 1.5]], 0.0005, 0.005);
      return;
    }
    case 'clave':
      tone(ctx, out, t, g * 0.55, 'sine', 2500, 2500, 0, 0.012);
      return;
    case 'woodblock':
      tone(ctx, out, t, g * 0.55, 'sine', 1050, 1000, 0.01, 0.016);
      tone(ctx, out, t, g * 0.2, 'triangle', 1580, 1580, 0, 0.01);
      return;
    case 'triangle':
      [4000, 6250, 8300].forEach(function (f, i) { tone(ctx, out, t, g * 0.16 / (i + 1), 'sine', f, f, 0, 0.6); });
      return;
    default:
      hiss(ctx, out, t, g * 0.3, [['bandpass', 3000, 1]], 0.001, 0.03);
  }
}

// ---------------------------------------------------------------------------
// Mixing, scheduling, rendering and export
// ---------------------------------------------------------------------------

function masterChain(ctx, dest) {
  const input = gain(ctx, 0.9);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 3.5;
  comp.attack.value = 0.004; comp.release.value = 0.2;
  const lim = ctx.createWaveShaper();
  lim.curve = tanhCurve(ctx, 1.1);
  input.connect(comp).connect(lim).connect(dest);
  return { input: input };
}

function Session(ctx, song, dest) {
  this.ctx = ctx;
  this.out = gain(ctx, 1);
  this.out.connect(dest);
  this.rev = ctx.createConvolver();
  this.rev.buffer = impulse(ctx, 2.4);
  const rg = gain(ctx, 0.5);
  this.rev.connect(rg).connect(this.out);
  this.tracks = {};
  const self = this;
  song.tracks.forEach(function (tr) {
    const input = gain(ctx, 1), vol = gain(ctx, tr.vol / 100);
    input.connect(vol);
    let last = vol;
    if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); pan.pan.value = tr.pan / 100; vol.connect(pan); last = pan; }
    last.connect(self.out);
    const send = gain(ctx, tr.reverb / 100);
    last.connect(send).connect(self.rev);
    const preset = tr.isDrum ? null : presetFor(tr);
    self.tracks[tr.name] = {
      input: input, preset: preset, kit: KIT_OF[tr.instrument] || 'acoustic', drum: {}, vowel: 'a',
      level: tr.isDrum ? VOICE_GAIN.drums : (VOICE_GAIN[preset.v] || 1) * (preset.gain || 1)
    };
  });
}
Session.prototype.schedule = function (ev, t0) {
  const T = this.tracks[ev.track];
  if (!T) return;
  const t = Math.max(t0 + ev.time, this.ctx.currentTime);
  const g = velGain(ev.velocity) * T.level;
  if (ev.kind === 'drum') { playDrum(this.ctx, T.input, ev.drum, t, g, T.kit, T.drum); return; }
  if (ev.lyric != null && T.preset.v === 'voice') T.vowel = vowelOf(ev.lyric);
  (V[T.preset.v] || V.piano)(this.ctx, T.input, ev, t, ev.duration, g, T.preset, { t0: t0, vowel: T.vowel });
};
Session.prototype.setLevel = function (name, v, instant) {
  const T = this.tracks[name];
  if (!T) return;
  if (instant) T.input.gain.value = v; else T.input.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015);
};
Session.prototype.close = function () {
  const o = this.out;
  o.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
  setTimeout(function () { try { o.disconnect(); } catch (e) { /* already gone */ } }, 400);
};

// Render the sample-based instruments (piano, plucked strings) a song needs, in small
// slices so the page stays responsive. Safe to call repeatedly; work is cached.
function needed(song) {
  const list = [], seen = {}, byName = {};
  song.tracks.forEach(function (t) { byName[t.name] = t; });
  song.events.forEach(function (ev) {
    if (ev.kind !== 'note') return;
    const p = presetFor(byName[ev.track]);
    if (p.v !== 'piano' && p.v !== 'pluck') return;
    const k = p.id + ':' + ev.midi;
    if (seen[k]) return;
    seen[k] = 1;
    list.push([p, ev.midi]);
  });
  return list;
}
// Yield to the event loop without timers (background tabs throttle setTimeout to ~1 s).
const yieldNow = (function () {
  if (typeof MessageChannel === 'undefined') return function (f) { setTimeout(f, 0); };
  const ch = new MessageChannel(), q = [];
  ch.port1.onmessage = function () { const f = q.shift(); if (f) f(); };
  return function (f) { q.push(f); ch.port2.postMessage(0); };
})();

function prepare(song, onProgress) {
  const list = needed(song);
  let i = 0;
  return new Promise(function (resolve) {
    function step() {
      const t = Date.now();
      while (i < list.length && Date.now() - t < 24) {
        const p = list[i][0], m = list[i][1];
        if (p.v === 'piano') pianoData(m, p.bright || 1); else pluckData(m, p);
        i++;
      }
      if (onProgress) onProgress(list.length ? i / list.length : 1);
      if (i < list.length) yieldNow(step); else resolve();
    }
    step();
  });
}

function lowerBound(events, time) {
  let lo = 0, hi = events.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (events[mid].time < time) lo = mid + 1; else hi = mid; }
  return lo;
}

function Player() {
  this.ctx = null; this.song = null; this.session = null;
  this.playing = false; this.pos = 0; this.levels = {}; this.volume = 0.8;
  this.onEnd = null; this.token = 0;
}
Player.prototype.ensure = function () {
  if (!this.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.volNode = gain(this.ctx, this.volume);
    this.volNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.master = masterChain(this.ctx, this.volNode);
    this.scope = new Float32Array(this.analyser.fftSize);
  }
  return this.ctx;
};
Player.prototype.setSong = function (song) {
  const resume = this.playing ? this.position() : null;
  this.song = song;
  if (resume != null) this.play(Math.min(resume, song.duration));
  else this.pos = Math.min(this.pos, song.duration);
};
// Call from a click handler: the audio context must be started by a user gesture.
Player.prototype.play = function (from, onProgress) {
  const ctx = this.ensure();
  if (ctx.state !== 'running') ctx.resume();
  const song = this.song;
  if (!song) return Promise.resolve();
  const start = from != null ? from : this.pos;
  this.halt();
  const token = ++this.token, self = this;
  return prepare(song, onProgress).then(function () {
    if (token !== self.token || self.song !== song) return;
    self.session = new Session(ctx, song, self.master.input);
    self.applyLevels(true);
    self.t0 = ctx.currentTime + 0.08 - start;
    self.idx = lowerBound(song.events, start - 1e-4);
    self.playing = true;
    self.timer = setInterval(function () { self.tick(); }, 25);
    self.tick();
  });
};
Player.prototype.tick = function () {
  if (!this.playing) return;
  const evs = this.song.events, horizon = this.ctx.currentTime + (document.hidden ? 1.6 : 0.2);
  while (this.idx < evs.length && this.t0 + evs[this.idx].time < horizon) {
    this.session.schedule(evs[this.idx], this.t0);
    this.idx++;
  }
  if (this.position() >= this.song.duration + 0.6) {
    this.halt();
    this.pos = 0;
    if (this.onEnd) this.onEnd();
  }
};
Player.prototype.position = function () { return this.playing ? Math.max(0, this.ctx.currentTime - this.t0) : this.pos; };
Player.prototype.halt = function () {
  if (this.playing) this.pos = this.position();
  this.playing = false;
  this.token++;
  clearInterval(this.timer);
  if (this.session) { this.session.close(); this.session = null; }
};
Player.prototype.pause = function () { this.halt(); };
Player.prototype.stop = function () { this.halt(); this.pos = 0; };
Player.prototype.seek = function (t) {
  t = Math.max(0, Math.min(t, this.song ? this.song.duration : 0));
  if (this.playing) this.play(t); else this.pos = t;
};
// levels: { trackName: 0..1 } used for mute and solo
Player.prototype.setLevels = function (levels) { this.levels = levels; this.applyLevels(false); };
Player.prototype.applyLevels = function (instant) {
  if (!this.session) return;
  const s = this.session, L = this.levels;
  Object.keys(s.tracks).forEach(function (n) { s.setLevel(n, L[n] == null ? 1 : L[n], instant); });
};
Player.prototype.setVolume = function (v) {
  this.volume = v;
  if (this.volNode) this.volNode.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
};
Player.prototype.meter = function () {
  if (!this.analyser || !this.playing) return 0;
  this.analyser.getFloatTimeDomainData(this.scope);
  let peak = 0;
  for (let i = 0; i < this.scope.length; i++) { const a = Math.abs(this.scope[i]); if (a > peak) peak = a; }
  return peak;
};

// Offline render of the whole song (same synthesis as playback) -> AudioBuffer
function render(song, levels, onProgress) {
  return prepare(song, function (f) { if (onProgress) onProgress(f * 0.3); }).then(function () {
    const sr = 44100, len = Math.ceil((song.duration + 3) * sr);
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(2, len, sr);
    const m = masterChain(ctx, ctx.destination);
    const s = new Session(ctx, song, m.input);
    Object.keys(s.tracks).forEach(function (n) { s.setLevel(n, levels && levels[n] != null ? levels[n] : 1, true); });
    // Schedule in one-second slices while rendering (suspend/resume), so only the notes
    // near the render position exist in the graph. Scheduling everything up front would
    // create tens of thousands of nodes that the renderer has to process on every block.
    const evs = song.events, total = len / sr, step = 1;
    let idx = 0;
    function until(tEnd) { while (idx < evs.length && evs[idx].time < tEnd) { s.schedule(evs[idx], 0); idx++; } }
    until(step + 0.5);
    for (let k = 1; k * step < total - 0.01; k++) {
      const at = k * step;
      ctx.suspend(at).then(function () {
        until(at + step + 0.5);
        if (onProgress) onProgress(0.3 + 0.7 * at / total);
        ctx.resume();
      });
    }
    return ctx.startRendering();
  });
}

function encodeWav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length, bytes = n * ch * 2;
  const dv = new DataView(new ArrayBuffer(44 + bytes));
  function str(o, s) { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); }
  str(0, 'RIFF'); dv.setUint32(4, 36 + bytes, true); str(8, 'WAVE');
  str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, bytes, true);
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7FFF, true);
      o += 2;
    }
  }
  return new Uint8Array(dv.buffer);
}

function saveFile(name, data, mime) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
}

return {
  Player: Player, render: render, encodeWav: encodeWav, saveFile: saveFile, prepare: prepare,
  PRESETS: PRESETS, VOICE_GAIN: VOICE_GAIN, V: V, playDrum: playDrum, velGain: velGain, mtof: mtof
};
})();
