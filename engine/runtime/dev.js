// Developer overlay (player.html?dev=1, or press ` in game): where you are
// in the script, variables, stage, diagnostics, jump to any scene, and live
// reload when story files change.

import { formatDiagnostic } from '../core/diagnostics.js';
import { el } from './ui.js';

export class DevTools {
  constructor(player) {
    this.p = player;
    this.panel = el('div', 'sh-dev', document.body);
    document.body.classList.add('sh-dev-docked');
    window.dispatchEvent(new Event('resize'));
    this.panel.innerHTML = '';
    const head = el('div', 'sh-dev-head', this.panel);
    el('strong', null, head, 'Shiori dev');
    this.fps = el('span', 'sh-dev-fps', head, '');
    const hide = el('button', 'sh-dev-btn', head, '×'); hide.type = 'button';
    hide.title = 'Hide (press ` to show again)';
    hide.addEventListener('click', () => this.toggle(false));
    const bar = el('div', 'sh-dev-bar', this.panel);
    const reload = el('button', 'sh-dev-btn', bar, 'Reload'); reload.type = 'button';
    reload.addEventListener('click', () => this.p.reload());
    const live = el('label', 'sh-dev-live', bar);
    this.liveBox = el('input', null, live); this.liveBox.type = 'checkbox'; this.liveBox.checked = true;
    live.appendChild(document.createTextNode(' live reload'));
    this.jump = el('select', 'sh-dev-select', bar);
    const opt0 = el('option', null, this.jump, 'Jump to scene…'); opt0.value = '';
    this.jump.addEventListener('change', () => {
      const id = this.jump.value;
      this.jump.value = '';
      if (id) window.shiori.jump(id);
    });
    this.where = el('div', 'sh-dev-where', this.panel);
    this.errors = el('pre', 'sh-dev-errors', this.panel);
    el('div', 'sh-dev-h', this.panel, 'Variables');
    this.vars = el('div', 'sh-dev-vars', this.panel);
    el('div', 'sh-dev-h', this.panel, 'Stage');
    this.stageEl = el('pre', 'sh-dev-stage', this.panel);
    el('div', 'sh-dev-h', this.panel, 'Warnings & log');
    this.logEl = el('div', 'sh-dev-log', this.panel);
    this.fillScenes();
    const warns = player.res.diagnostics.filter(d => d.severity === 'warning');
    for (const w of warns.slice(0, 40)) this.log({ type: 'warning', code: w.code, message: w.message, loc: w.file ? { file: w.file, line: w.line } : null });
    this.frames = 0; this.acc = 0;
    this.poll();
    this.update();
  }

  toggle(on) {
    const show = on != null ? on : this.panel.style.display === 'none';
    this.panel.style.display = show ? '' : 'none';
    document.body.classList.toggle('sh-dev-docked', show);
    window.dispatchEvent(new Event('resize'));
  }

  fillScenes() {
    while (this.jump.options.length > 1) this.jump.remove(1);
    for (const id of this.p.program.sceneOrder) {
      const sc = this.p.program.scenes[id];
      const o = el('option', null, this.jump, id + (sc.title ? ' — ' + sc.title : ''));
      o.value = id;
    }
  }

  frame(dt) {
    this.frames++; this.acc += dt;
    if (this.acc >= 1) { this.fps.textContent = Math.round(this.frames / this.acc) + ' fps'; this.frames = 0; this.acc = 0; }
  }

  update() {
    const p = this.p, vm = p.vm, h = p.halt;
    if (!vm || !vm.state) { this.where.textContent = 'Title screen'; return; }
    const st = vm.state;
    const loc = h && h.loc ? `${h.loc.file}:${h.loc.line}` : '';
    this.where.textContent = `scene ${st.scene || '?'}${loc ? ' · ' + loc : ''} · ${h ? h.type : 'running'}${st.chapter ? ' · ' + st.chapter : ''}`;
    this.vars.textContent = '';
    const decls = p.program.decls.vars;
    for (const [k, d] of Object.entries(decls)) {
      const row = el('div', 'sh-dev-var', this.vars);
      el('span', null, row, k + (d.persistent ? ' (persistent)' : ''));
      el('code', null, row, JSON.stringify(vm.getVar(k)));
    }
    const endings = Object.keys(vm.persistent.endings);
    if (endings.length) { const row = el('div', 'sh-dev-var', this.vars); el('span', null, row, 'endings seen'); el('code', null, row, endings.join(', ')); }
    const s = st.stage;
    this.stageEl.textContent = [
      `bg: ${s.bg ? (s.bg.id || s.bg.color) + (s.bg.kind === 'world' ? ' (3D)' : '') : '—'}`,
      `actors: ${s.actors.map(a => a.id + (Object.keys(a.attrs).length ? '(' + Object.values(a.attrs).join(',') + ')' : '') + '@' + (a.mark || a.x)).join('  ') || '—'}`,
      s.cg ? `cg: ${s.cg}` : null, s.weather ? `weather: ${s.weather.type}` : null, s.filter !== 'none' ? `filter: ${s.filter}` : null,
      st.audio.music ? `music: ${st.audio.music.id}` : null, `mode: ${st.text.mode}`, st.pov ? `pov: ${st.pov}` : null,
    ].filter(Boolean).join('\n');
  }

  log(e) {
    const row = el('div', 'sh-dev-logrow sh-dev-' + (e.type || 'log'), this.logEl);
    row.textContent = (e.code ? e.code + ' ' : '') + (e.message || e.text || '') + (e.loc ? ` (${e.loc.file}:${e.loc.line})` : '');
    while (this.logEl.children.length > 120) this.logEl.firstChild.remove();
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  showErrors(list) {
    this.errors.textContent = list.length ? list.map(formatDiagnostic).join('\n\n') : '';
    this.errors.style.display = list.length ? '' : 'none';
    this.fillScenes();
  }

  async poll() {
    const p = this.p;
    const snapshot = async () => {
      const files = (p.res.sources && p.res.sources.order) || [];
      const mods = (p.res.modules || []).map(m => m.path);
      const texts = await Promise.all(files.concat(mods).map(f => p.readText(f)));
      return texts.join('\u0000');
    };
    let last = await snapshot();
    const tick = async () => {
      if (this.liveBox.checked) {
        try {
          const now = await snapshot();
          if (now !== last) { last = now; await p.reload(); this.fillScenes(); this.update(); }
        } catch {}
      }
      this.timer = setTimeout(tick, 1500);
    };
    this.timer = setTimeout(tick, 1500);
  }
}
