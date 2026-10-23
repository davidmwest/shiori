// Generates the command reference from the registry, so the documentation
// always matches the engine (including commands added by your own modules).

import { TRANSITIONS, EASES, POSITIONS, has } from './registry.js';
import { TAGS } from './markup.js';
import { FUNCTIONS } from './expr.js';
import { HEADER_FIELDS } from './header.js';
import { CODES, CODE_HELP } from './diagnostics.js';
import { WEATHER, FILTERS } from './modules/stage.js';

const MODULE_TITLES = {
  declare: 'Declarations (compile time)',
  story: 'Story flow',
  stage: 'Stage (2D and 3D)',
  text: 'Text presentation',
  audio: 'Audio',
  media: 'Video',
};

function typeName(t) {
  if (!t) return '';
  if (t.startsWith('enum:')) return t.slice(5).split('|').join(' \\| ');
  if (t.startsWith('asset:')) return t.slice(6).split('|').join(' \\| ') + ' id';
  return t;
}

export function commandDoc(c) {
  const out = [];
  out.push(`### \`@${c.name}\``);
  out.push('');
  out.push(c.summary || '');
  out.push('');
  out.push('```shiori');
  out.push(c.syntax || '@' + c.name);
  out.push('```');
  if (c.doc) { out.push(''); for (const d of c.doc) out.push(`- ${d}`); }
  const rows = [];
  for (const p of c.positional || []) rows.push(`| \`${p.name}\`${p.rest ? '…' : ''} | ${p.required ? 'required' : 'optional'} | ${typeName(p.type)} | ${p.doc || ''} |`);
  for (const [k, v] of Object.entries(c.named || {})) rows.push(`| \`${k}=\` | ${v.default !== undefined ? 'default `' + v.default + '`' : 'optional'} | ${typeName(v.type)} | ${v.doc || ''} |`);
  if (rows.length) {
    out.push('');
    out.push('| Argument | | Type | Meaning |');
    out.push('|---|---|---|---|');
    out.push(...rows);
  }
  if (c.examples && c.examples.length) {
    out.push('');
    out.push('```shiori');
    out.push(c.examples.join('\n'));
    out.push('```');
  }
  return out.join('\n');
}

export function commandReference(registry) {
  const out = [];
  // Module names come from the game's own modules too: a Map, so a module
  // called `constructor` is just a name.
  const byModule = new Map();
  for (const c of registry.commands.values()) { if (!byModule.has(c.module)) byModule.set(c.module, []); byModule.get(c.module).push(c); }
  for (const [mod, list] of byModule) {
    out.push(`## ${has(MODULE_TITLES, mod) ? MODULE_TITLES[mod] : 'Module: ' + mod}`);
    out.push('');
    for (const c of list) { out.push(commandDoc(c)); out.push(''); }
  }
  return out.join('\n');
}

export function tablesReference() {
  const out = [];
  const table = (title, obj, col) => {
    out.push(`## ${title}`, '', `| ${col} | Meaning |`, '|---|---|');
    for (const [k, v] of Object.entries(obj)) out.push(`| \`${k}\` | ${typeof v === 'string' ? v : v.doc} |`);
    out.push('');
  };
  table('Transitions (`with=`)', TRANSITIONS, 'Name');
  out.push('## Positions (`at=`)', '', '| Name | x (0 = left edge, 1 = right edge) |', '|---|---|');
  for (const [k, v] of Object.entries(POSITIONS)) out.push(`| \`${k}\` | ${v} |`);
  out.push('', 'Numbers (`at=0.4`) and percentages (`at=40%`) also work, as do names from `@position` and, in 3D worlds, mark names.', '');
  out.push('## Easing (`ease=`)', '', EASES.map(e => '`' + e + '`').join(', '), '');
  table('Weather (`@weather`)', WEATHER, 'Type');
  table('Filters (`@filter`)', FILTERS, 'Filter');
  table('Text tags', Object.fromEntries(Object.entries(TAGS).map(([k, v]) => [v.paired ? `{${k}}…{/${k}}` : `{${k}}`, v.doc])), 'Tag');
  out.push('Also: `{$name}` inserts a variable; `{{` and `}}` are literal braces.', '');
  table('Functions (in conditions)', Object.fromEntries(Object.entries(FUNCTIONS).map(([k, v]) => [`${k}(${v.args.join(', ')}${v.variadic ? ', …' : ''})`, v.doc])), 'Function');
  out.push('## Header fields (game.story)', '', '| Field | Default | Meaning |', '|---|---|---|');
  for (const [k, v] of Object.entries(HEADER_FIELDS)) {
    const values = v.type.startsWith('enum:') ? ' Values: ' + v.type.slice(5).split('|').map(x => '`' + x + '`').join(', ') + '.' : v.type === 'bool' ? ' `true` or `false`.' : '';
    out.push(`| \`${k}:\` | ${v.default !== undefined ? '`' + v.default + '`' : (v.required ? 'required' : '')} | ${v.doc}${values} |`);
  }
  out.push('');
  return out.join('\n');
}

export function codesReference() {
  const out = ['| Code | Meaning | What to do |', '|---|---|---|'];
  for (const [k, v] of Object.entries(CODES)) out.push(`| ${k} | ${v} | ${(CODE_HELP[k] || '').replace(/\|/g, '\\|')} |`);
  out.push('', 'Codes are not contiguous; gaps are unused numbers.');
  return out.join('\n');
}
