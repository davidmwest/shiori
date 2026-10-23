// Shared test helpers. A suite is a module that calls test() at import time.
import { createHost } from '../tools/host.js';
import { compileProject, loadSources, VM } from '../engine/core/index.js';

export const host = await createHost(typeof arguments !== 'undefined' ? arguments : undefined);
export const results = { passed: 0, failed: 0, fails: [] };
export function test(name, fn) {
  try { fn(); results.passed++; }
  catch (e) { results.failed++; results.fails.push(`✗ ${name}\n    ${e && e.message || e}`); }
}
export function eq(a, b, msg) { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error(`${msg || 'expected'} ${B}, got ${A}`); }
export function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

// Compile one game.story given as text.
export const one = (text) => compileProject({ entry: 'game.story', files: { 'game.story': text }, order: ['game.story'], missing: [] });
// Compile a several-file game: { 'game.story': '...', 'story/a.story': '...' }.
export const many = (files) => compileProject({ entry: 'game.story', files, order: Object.keys(files), missing: [] });
export async function loadDir(dir) {
  const s = await loadSources((p) => host.read(dir + '/' + p));
  return compileProject(s);
}
export const codes = (r) => r.diagnostics.filter(d => d.severity !== 'info').map(d => d.code);
export const errors = (r) => r.diagnostics.filter(d => d.severity === 'error');

// Play with a list of 1-based choice numbers; returns { vm, lines, stop, ending, error }.
export function playThrough(program, choices, opts = {}) {
  const vm = new VM(program, { seed: 1, persistent: opts.persistent });
  let r = vm.start(opts.from || null);
  const lines = [];
  for (let guard = 0; guard < 5000; guard++) {
    const h = r.halt;
    if (h.type === 'say') { lines.push((h.name ? h.name + ': ' : '') + h.plain); r = vm.advance(); continue; }
    if (h.type === 'menu') { const c = choices.shift(); if (c == null) return { vm, lines, stop: 'menu', halt: h }; r = vm.choose(c - 1); continue; }
    if (h.type === 'end') return { vm, lines, stop: 'end', ending: h.ending };
    if (h.type === 'error') return { vm, lines, stop: 'error', error: h };
    if (h.type === 'input') { r = vm.submit(opts.input || ''); continue; }
    r = vm.advance();
  }
  throw new Error('runaway');
}
