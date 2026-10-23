// Saves, persistent data and settings in localStorage. Every access is
// guarded: private windows and blocked storage just mean nothing persists.

export const DEFAULT_SETTINGS = {
  textSpeed: 45,          // characters per second; 0 = instant
  autoDelay: 1.2,         // seconds after a line in auto mode
  music: 0.8, sound: 0.9, voice: 1, ambience: 0.8, master: 1,
  skipUnread: false,
  dimInactive: true,
  textScale: 1,
  textboxOpacity: 0.86,
  reduceMotion: false,
  selfVoicing: false,
  highContrast: false,
  quality: 'high',
};

export class Storage {
  constructor(gameKey) {
    this.prefix = 'shiori:' + gameKey + ':';
    this.ok = true;
    try { const k = '__shiori_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); }
    catch { this.ok = false; this.mem = {}; }
  }
  _get(key) {
    try { return this.ok ? localStorage.getItem(this.prefix + key) : (this.mem[key] ?? null); } catch { return null; }
  }
  _set(key, value) {
    try {
      if (this.ok) localStorage.setItem(this.prefix + key, value); else this.mem[key] = value;
      return true;
    } catch (e) { console.warn('[shiori] could not store', key, e); return false; }
  }
  _del(key) { try { if (this.ok) localStorage.removeItem(this.prefix + key); else delete this.mem[key]; } catch {} }
  json(key, fallback) { const s = this._get(key); if (s == null) return fallback; try { return JSON.parse(s); } catch { return fallback; } }

  loadPersistent() { return this.json('persistent', null); }
  savePersistent(p) { this._set('persistent', JSON.stringify(p)); }

  loadSettings() {
    let global = {};
    try { global = JSON.parse(localStorage.getItem('shiori:settings') || '{}'); } catch {}
    return { ...DEFAULT_SETTINGS, ...global, ...this.json('settings', {}) };
  }
  saveSettings(s) { this._set('settings', JSON.stringify(s)); }

  slots() {
    const out = {};
    const keys = [];
    try {
      if (this.ok) for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(this.prefix + 'save:')) keys.push(k.slice(this.prefix.length + 5)); }
      else keys.push(...Object.keys(this.mem).filter(k => k.startsWith('save:')).map(k => k.slice(5)));
    } catch {}
    for (const slot of keys) {
      const meta = this.json('meta:' + slot, null);
      if (meta) out[slot] = meta;
    }
    return out;
  }
  save(slot, save, thumb) {
    const meta = { slot, time: save.time, chapter: save.chapter, scene: save.scene, preview: save.preview, thumb };
    const ok = this._set('save:' + slot, JSON.stringify(save)) && this._set('meta:' + slot, JSON.stringify(meta));
    return ok;
  }
  load(slot) { return this.json('save:' + slot, null); }
  remove(slot) { this._del('save:' + slot); this._del('meta:' + slot); }
  latest() {
    const s = Object.values(this.slots());
    s.sort((a, b) => b.time - a.time);
    return s[0] || null;
  }
}
