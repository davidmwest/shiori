// Regenerates the generated parts of SHIORI-Spec.md:
//   <!-- BEGIN GENERATED REFERENCE --> ... <!-- END GENERATED REFERENCE -->
//   <!-- EXAMPLE:path --> ... <!-- /EXAMPLE -->
// Usage (from the engine folder): bin/shiori-dev gen-spec
import { createHost } from './host.js';
import { defaultRegistry } from '../engine/core/modules/index.js';
import { commandReference, tablesReference, codesReference } from '../engine/core/docs.js';

const host = await createHost(typeof arguments !== 'undefined' ? arguments : undefined);
const path = host.args[0] || 'SHIORI-Spec.md';
let spec = host.read(path);
if (spec == null) throw new Error('Cannot read ' + path);
const reg = defaultRegistry();
const gen = [
  commandReference(reg).replace(/^## /gm, '## A.' ).replace(/^## A\./gm, (m, i) => m),
  '# Appendix B — Tables',
  '',
  tablesReference(),
  '# Appendix C — Diagnostic codes',
  '',
  'Every message from `shiori check`, `shiori explore` and the player carries one of these codes. E = error (the game will not run), W = warning, R = runtime problem, V = VNDB report.',
  '',
  codesReference(),
  '',
].join('\n');
spec = spec.replace(/<!-- BEGIN GENERATED REFERENCE -->[\s\S]*?<!-- END GENERATED REFERENCE -->/,
  '<!-- BEGIN GENERATED REFERENCE -->\n\n' + gen.replace(/^## A\./gm, '## ') + '\n<!-- END GENERATED REFERENCE -->');
spec = spec.replace(/<!-- EXAMPLE:([^ ]+) -->(?:[\s\S]*?<!-- \/EXAMPLE -->)?/g, (m, p) => {
  const text = host.read(p);
  if (text == null) return m;
  return `<!-- EXAMPLE:${p} -->\n\n\`\`\`shiori\n${text.replace(/\n+$/, '')}\n\`\`\`\n\n<!-- /EXAMPLE -->`;
});
host.write(path, spec);
host.print('Updated ' + path + ' (' + spec.split('\n').length + ' lines)');
