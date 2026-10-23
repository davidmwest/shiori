// Shiori test suite. Run from the engine folder: bin/shiori selftest
// Each tests/suite-*.js file registers tests through tests/harness.js.
import { host, results } from './harness.js';
import { SUITES } from './suites.js';

for (const s of SUITES) {
  try { await import('./' + s); }
  catch (e) { results.failed++; results.fails.push(`✗ suite ${s} failed to load\n    ${e && e.message || e}`); }
}
if (results.fails.length) host.print(results.fails.join('\n'));
host.print(`${results.passed} passed, ${results.failed} failed`);
if (results.failed) host.exit(1);
if (host.kind === 'jsc' && globalThis.__shioriExit) throw new Error('__shiori_exit_' + globalThis.__shioriExit);
