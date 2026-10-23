// Audio mixer: music (two decks for crossfades), ambience, sound effects and
// voice, each on its own bus. Music can be an audio file or an LMN song,
// which is synthesised live by the vendored LMN player.

import { has } from '../core/registry.js';

export class AudioMixer {
  constructor({ program, resolveUrl, settings, engineBase }) {
    this.program = program;
    this.resolve = resolveUrl;
    this.settings = settings;
    this.engineBase = engineBase;
    this.ctx = null;
    this.buffers = new Map();
    this.songs = new Map();
    this.music = null;       // current deck
    this.ambience = null;
    this.voiceSrc = null;
    this.wanted = { music: null, ambience: null };
    this.lmnLoading = null;
  }

  get unlocked() { return !!this.ctx && this.ctx.state === 'running'; }

  // Must be called from a user gesture the first time.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const c = this.ctx;
      this.master = c.createGain();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
      this.master.connect(comp).connect(c.destination);
      this.bus = {};
      for (const k of ['music', 'ambience', 'sound', 'voice']) { this.bus[k] = c.createGain(); this.bus[k].connect(this.master); }
      this.duckGain = c.createGain();
      this.duckGain.connect(this.bus.music);
      this.applySettings(this.settings);
      const wanted = this.wanted;
      if (wanted.music) this.playMusic(wanted.music, 1.2);
      if (wanted.ambience) this.playAmbience(wanted.ambience, 1.2);
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  applySettings(s) {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master != null ? s.master : 1, t, 0.03);
    for (const k of ['music', 'ambience', 'sound', 'voice']) this.bus[k].gain.setTargetAtTime(s[k] != null ? s[k] : 1, t, 0.03);
  }

  // Own properties only: an id like `constructor` is never an Object.prototype member.
  asset(id) { const t = this.program.decls.assets; return has(t, id) ? t[id] : null; }
  isLmn(a) { return a && /\.(lmn|txt)$/i.test(a.path); }

  async buffer(a) {
    if (this.buffers.has(a.path)) return this.buffers.get(a.path);
    const p = fetch(this.resolve(a.path)).then(r => { if (!r.ok) throw new Error(`${a.path}: HTTP ${r.status}`); return r.arrayBuffer(); })
      .then(data => new Promise((res, rej) => this.ctx.decodeAudioData(data, res, rej)))
      .catch(err => { console.warn('[shiori] audio failed:', err.message || err); return null; });
    this.buffers.set(a.path, p);
    return p;
  }

  loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('could not load ' + src));
      document.head.appendChild(s);
    });
  }

  async ensureLmn() {
    if (window.LMN && window.LMNSynth) return;
    if (!this.lmnLoading) {
      const base = this.engineBase + 'vendor/lmn/';
      this.lmnLoading = (window.LMN ? Promise.resolve() : this.loadScript(base + 'lmn-core.js'))
        .then(() => window.LMNSynth ? null : this.loadScript(base + 'lmn-synth.js'))
        .then(() => {
          // lmn-synth.js declares `const LMNSynth` (a global lexical binding,
          // not a window property); expose it to this module.
          if (!window.LMNSynth) {
            const s = document.createElement('script');
            s.textContent = 'if (typeof LMNSynth !== "undefined") window.LMNSynth = LMNSynth;';
            document.head.appendChild(s);
          }
          if (!window.LMNSynth) throw new Error('LMN synthesizer did not load');
        });
    }
    await this.lmnLoading;
  }

  async song(a) {
    if (this.songs.has(a.path)) return this.songs.get(a.path);
    const p = (async () => {
      await this.ensureLmn();
      const r = await fetch(this.resolve(a.path));
      if (!r.ok) throw new Error(`${a.path}: HTTP ${r.status}`);
      const song = window.LMN.compile(await r.text());
      const errs = (song.diagnostics || []).filter(d => d.level === 'error');
      if (errs.length) console.warn(`[shiori] LMN errors in ${a.path}:`, errs.map(e => `line ${e.line}: ${e.message}`).join('; '));
      return song;
    })().catch(err => { console.warn('[shiori] LMN song failed:', err.message || err); return null; });
    this.songs.set(a.path, p);
    return p;
  }

  // ---- decks ---------------------------------------------------------------
  // A deck's level is the script's volume= times the asset's own volume.
  level(spec, a) { return (spec.volume != null ? spec.volume : 1) * (a.opts.volume != null ? a.opts.volume : 1); }
  looping(spec, a, loopDefault) { return spec.loop != null ? spec.loop : (a.opts.loop != null ? a.opts.loop : loopDefault); }

  async makeDeck(spec, bus, loopDefault) {
    const a = this.asset(spec.id);
    if (!a) return null;
    const c = this.ctx;
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(bus);
    // ended: a track that doesn't loop has played to its end. The deck is
    // then silent, and asking for the track again starts it over.
    const deck = { id: spec.id, gain, vol: this.level(spec, a), loop: this.looping(spec, a, loopDefault), stopped: false, ended: false };
    if (this.isLmn(a)) {
      const song = await this.song(a);
      if (!song || deck.stopped) return deck;
      const p = new window.LMNSynth.Player();
      p.ctx = c;
      p.master = { input: gain };
      p.setSong(song);
      p.onEnd = () => { if (deck.loop && !deck.stopped) p.play(0); else deck.ended = true; };
      deck.lmn = p;
      p.play(0);
    } else {
      const buf = await this.buffer(a);
      if (!buf || deck.stopped) return deck;
      const src = c.createBufferSource();
      src.buffer = buf; src.loop = deck.loop;
      src.connect(gain);
      src.onended = () => { deck.ended = true; };
      src.start();
      deck.src = src;
    }
    return deck;
  }

  // Is this deck still playing track `id`? A finished one-shot track is not,
  // unless `keepEnded` (a rollback must not start it over).
  playing(deck, id, keepEnded) { return !!deck && deck.id === id && !deck.stopped && (keepEnded || !deck.ended); }

  // The track on this deck is asked for again (a new volume= or loop=, or a
  // sync after loading): it keeps playing and moves to the new level.
  retune(deck, spec, fade, loopDefault) {
    const a = this.asset(spec.id);
    if (!a) return;
    deck.vol = this.level(spec, a);
    deck.loop = this.looping(spec, a, loopDefault);
    if (deck.src) deck.src.loop = deck.loop;
    this.fadeIn(deck, fade);
  }

  fadeIn(deck, fade) {
    if (!deck) return;
    const t = this.ctx.currentTime;
    deck.gain.gain.cancelScheduledValues(t);
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, t);
    deck.gain.gain.linearRampToValueAtTime(deck.vol, t + Math.max(0.02, fade));
  }

  fadeOut(deck, fade) {
    if (!deck) return;
    deck.stopped = true;
    const c = this.ctx, t = c.currentTime, f = Math.max(0.02, fade || 0);
    deck.gain.gain.cancelScheduledValues(t);
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, t);
    deck.gain.gain.linearRampToValueAtTime(0, t + f);
    setTimeout(() => {
      try { if (deck.src) deck.src.stop(); } catch {}
      try { if (deck.lmn) deck.lmn.stop(); } catch {}
      try { deck.gain.disconnect(); } catch {}
    }, f * 1000 + 80);
  }

  // keepEnded: a restore after rollback or rollforward, where a one-shot
  // track that has finished stays silent instead of starting over.
  async playMusic(spec, fade = 1.5, keepEnded = false) {
    this.wanted.music = spec;
    if (!this.ctx) return;
    if (this.playing(this.music, spec.id, keepEnded)) {
      this.musicToken = (this.musicToken || 0) + 1; // a track still loading must not replace it
      this.retune(this.music, spec, fade, true);
      return;
    }
    const old = this.music;
    const token = this.musicToken = (this.musicToken || 0) + 1;
    const deck = await this.makeDeck(spec, this.duckGain, true);
    if (token !== this.musicToken) { this.fadeOut(deck, 0); return; }
    this.fadeOut(old, fade);
    this.music = deck;
    this.fadeIn(deck, fade);
  }

  stopMusic(fade = 1.5) {
    this.wanted.music = null;
    this.musicToken = (this.musicToken || 0) + 1;
    if (this.ctx) this.fadeOut(this.music, fade);
    this.music = null;
  }

  async playAmbience(spec, fade = 1, keepEnded = false) {
    this.wanted.ambience = spec;
    if (!this.ctx) return;
    if (this.playing(this.ambience, spec.id, keepEnded)) {
      this.ambToken = (this.ambToken || 0) + 1;
      this.retune(this.ambience, spec, fade, true);
      return;
    }
    const old = this.ambience;
    const token = this.ambToken = (this.ambToken || 0) + 1;
    const deck = await this.makeDeck(spec, this.bus.ambience, true);
    if (token !== this.ambToken) { this.fadeOut(deck, 0); return; }
    this.fadeOut(old, fade);
    this.ambience = deck;
    this.fadeIn(deck, fade);
  }

  stopAmbience(fade = 1) {
    this.wanted.ambience = null;
    this.ambToken = (this.ambToken || 0) + 1;
    if (this.ctx) this.fadeOut(this.ambience, fade);
    this.ambience = null;
  }

  async playSound(id, volume = 1) {
    if (!this.ctx) return;
    const a = this.asset(id);
    if (!a) return;
    if (this.isLmn(a)) {
      const deck = await this.makeDeck({ id, volume, loop: false }, this.bus.sound, false);
      this.fadeIn(deck, 0.01);
      return;
    }
    const buf = await this.buffer(a);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = volume * (a.opts.volume != null ? a.opts.volume : 1);
    src.buffer = buf;
    src.connect(g).connect(this.bus.sound);
    src.start();
  }

  // Returns the clip's duration in seconds (0 if none).
  async playVoice(id) {
    this.stopVoice();
    if (!this.ctx || !id) return 0;
    const a = this.asset(id);
    if (!a) return 0;
    const buf = await this.buffer(a);
    if (!buf) return 0;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.bus.voice);
    src.start();
    this.voiceSrc = src;
    this.duck(true);
    src.onended = () => { if (this.voiceSrc === src) { this.voiceSrc = null; this.duck(false); } };
    return buf.duration;
  }

  stopVoice() {
    if (this.voiceSrc) { try { this.voiceSrc.stop(); } catch {} this.voiceSrc = null; this.duck(false); }
  }

  get voicePlaying() { return !!this.voiceSrc; }

  duck(on) {
    if (!this.ctx) return;
    this.duckGain.gain.setTargetAtTime(on ? 0.55 : 1, this.ctx.currentTime, 0.12);
  }

  apply(e) {
    switch (e.op) {
      case 'music': if (e.music) this.playMusic(e.music, e.fade); else this.stopMusic(e.fade); break;
      case 'ambience': if (e.ambience) this.playAmbience(e.ambience, e.fade); else this.stopAmbience(e.fade); break;
      case 'sound': this.playSound(e.id, e.volume); break;
      case 'stop':
        if (e.what === 'music' || e.what === 'all') this.stopMusic(e.fade);
        if (e.what === 'ambience' || e.what === 'all') this.stopAmbience(e.fade);
        if (e.what === 'voice' || e.what === 'all') this.stopVoice();
        break;
    }
  }

  // Make the audio match a restored state. After a load the state's tracks
  // play as in a fresh session; `keepEnded` (rollback, rollforward) leaves a
  // finished one-shot track silent.
  sync(audio, { keepEnded = false } = {}) {
    if (audio.music) this.playMusic(audio.music, 0.6, keepEnded); else this.stopMusic(0.6);
    if (audio.ambience) this.playAmbience(audio.ambience, 0.6, keepEnded); else this.stopAmbience(0.6);
  }

  // Music room: play a track directly.
  preview(id) { return this.playMusic({ id, volume: 1, loop: true }, 0.8); }
}
