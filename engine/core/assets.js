// Asset checks: every declared file exists, including every combination a
// character's sprite templates can produce.

export function templateGroups(tpl) {
  return (String(tpl).match(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g) || []).map(s => s.slice(1, -1));
}

export function fillTemplate(tpl, attrs) {
  return String(tpl).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, g) => attrs[g] != null ? attrs[g] : m);
}

export function expandTemplate(tpl, groups, cap = 400) {
  const names = templateGroups(tpl).filter((g, i, a) => a.indexOf(g) === i);
  let combos = [{}];
  for (const g of names) {
    const next = [];
    for (const c of combos) for (const v of (groups[g] || [])) { next.push({ ...c, [g]: v }); if (next.length > cap) break; }
    combos = next;
  }
  return combos.map(c => fillTemplate(tpl, c));
}

// exists(path) -> bool. Returns diagnostics.
export function checkAssets(program, exists) {
  const out = [];
  const warn = (message, loc, hint) => out.push({ severity: 'warning', code: 'W602', message, file: loc && loc.file, line: loc && loc.line, hint });
  for (const a of Object.values(program.decls.assets)) {
    if (!a.path || /^(https?:|data:)/.test(a.path)) continue;
    if (!exists(a.path)) warn(`File not found for ${a.kind} \`${a.id}\`: ${a.path}`, a.loc, 'Paths are relative to the folder that holds game.story.');
  }
  for (const c of Object.values(program.decls.characters)) {
    const tpls = [];
    for (const k of ['sprite', 'side', 'blink', 'mouth']) if (c[k]) tpls.push([k, c[k]]);
    c.layers.forEach((l, i) => tpls.push([`layer ${i + 1}`, l]));
    for (const [k, t] of tpls) {
      const files = expandTemplate(t, c.groups);
      const missing = files.filter(f => !exists(f));
      if (missing.length) {
        warn(`\`${c.id}\` ${k}: ${missing.length} of ${files.length} image${files.length === 1 ? '' : 's'} not found (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? ', …' : ''}).`, c.loc,
          missing.length === files.length ? 'Check the folder and the file extension.' : 'Every value of every attribute group in the template needs its own file.');
      }
    }
    if (c.model && !/^(https?:|data:)/.test(c.model) && !exists(c.model)) warn(`\`${c.id}\` model not found: ${c.model}`, c.loc);
  }
  return out;
}
