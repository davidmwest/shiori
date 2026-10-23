// The command registry. Every @command is defined once, with a schema that
// drives argument checking, error messages, generated docs and the runtime.
//
// A module is a plain object: { name, commands: [CommandDef, ...] }.
// CommandDef fields:
//   name        'show'
//   module      'stage'
//   summary     one-line description
//   syntax      '@show <who> [attributes...] [at=position] ...'
//   positional  [{ name, type, required, rest, doc }]
//   named       { key: { type, default, doc } }
//   props       true if the command takes an indented `key: value` block
//   decl        true for compile-time declarations (no runtime effect)
//   examples    ['@show mio smile at=left']
//   compile(cmd, ctx) -> instruction | null   (optional; default builds {op:'cmd'})
//   exec(ins, vm)                              (runtime; may emit effects / halt)
//   vndb        notes for the VNDB report (e.g. { gameplay: true })

import { didYouMean, parseDuration, isColor, isIdent } from './util.js';

export class Registry {
  constructor() { this.commands = new Map(); this.modules = []; this.aliases = new Map(); }
  use(mod) {
    this.modules.push(mod);
    for (const c of mod.commands) {
      c.module = c.module || mod.name;
      this.commands.set(c.name, c);
      for (const a of c.aliases || []) this.aliases.set(a, c.name);
    }
    return this;
  }
  get(name) {
    return this.commands.get(name) || this.commands.get(this.aliases.get(name));
  }
  names() { return [...this.commands.keys()]; }
}

export const POSITIONS = {
  offleft: -0.3, farleft: 0.12, left: 0.27, midleft: 0.38, center: 0.5, midright: 0.62, right: 0.73, farright: 0.88, offright: 1.3,
};

export const TRANSITIONS = {
  none: 'Instant change.',
  cut: 'Same as none.',
  fade: 'Fade to black, then fade in.',
  fade_white: 'Fade to white, then fade in.',
  dissolve: 'Cross-dissolve from the old picture to the new one.',
  flash: 'White flash, then the new picture.',
  wipe_left: 'The new picture wipes in from the right edge towards the left.',
  wipe_right: 'The new picture wipes in from the left edge towards the right.',
  wipe_up: 'Wipes in from the bottom upwards.',
  wipe_down: 'Wipes in from the top downwards.',
  iris_in: 'A circle closes on the old picture to reveal the new one.',
  iris_out: 'A circle opens from the centre to reveal the new picture.',
  slide_left: 'The new picture pushes the old one out to the left.',
  slide_right: 'The new picture pushes the old one out to the right.',
  slide_up: 'Pushes upwards.',
  slide_down: 'Pushes downwards.',
  pixelate: 'Old picture pixelates away and the new one resolves.',
  blinds: 'Horizontal blinds close and reopen on the new picture.',
};

export const EASES = ['linear', 'in', 'out', 'inout', 'back', 'bounce'];

export const COLOR_BACKGROUNDS = ['black', 'white'];

// Convert and check one argument value against a type. Returns
// { value } or { error, hint }. ctx gives access to declarations.
export function checkValue(type, raw, ctx, info = {}) {
  const s = raw == null ? '' : String(raw);
  const [base, extra] = type.split(':');
  switch (base) {
    case 'string': case 'text': case 'path': return { value: s };
    case 'number': {
      const n = Number(s.endsWith('%') ? s.slice(0, -1) / 100 : s);
      return s !== '' && isFinite(n) ? { value: n } : { error: `\`${s}\` is not a number.` };
    }
    case 'int': {
      const n = Number(s);
      return Number.isInteger(n) ? { value: n } : { error: `\`${s}\` is not a whole number.` };
    }
    case 'bool': {
      if (/^(true|yes|on|1)$/i.test(s)) return { value: true };
      if (/^(false|no|off|0)$/i.test(s)) return { value: false };
      return { error: `\`${s}\` is not true or false.` };
    }
    case 'duration': {
      const d = parseDuration(s);
      return isFinite(d) && d >= 0 ? { value: d } : { error: `\`${s}\` is not a duration. Use seconds like \`1.5\` or \`500ms\`.` };
    }
    case 'color': return isColor(s) ? { value: s } : { error: `\`${s}\` is not a color. Use #rrggbb or a basic name like black.` };
    case 'enum': {
      const opts = extra.split('|');
      if (opts.includes(s)) return { value: s };
      const m = didYouMean(s, opts);
      return { error: `\`${s}\` is not one of: ${opts.join(', ')}.`, hint: m ? `Did you mean \`${m}\`?` : undefined };
    }
    case 'ident': return isIdent(s) ? { value: s } : { error: `\`${s}\` is not a valid name (letters, digits and _).` };
    case 'label': return ctx.checkLabel(s);
    case 'ending': return isIdent(s) ? { value: s } : { error: `\`${s}\` is not a valid ending id.` };
    case 'position': {
      if (POSITIONS[s] != null) return { value: POSITIONS[s] };
      if (ctx.positions && ctx.positions[s]) return { value: ctx.positions[s].x, named: s };
      const n = s.endsWith('%') ? Number(s.slice(0, -1)) / 100 : Number(s);
      if (s !== '' && isFinite(n)) return { value: n };
      // In 3D worlds, any other name is a mark in the world.
      if (isIdent(s) && ctx.checkMark) return ctx.checkMark(s);
      if (isIdent(s)) return { value: s, mark: true };
      const m = didYouMean(s, Object.keys(POSITIONS));
      return { error: `\`${s}\` is not a position.`, hint: m ? `Did you mean \`${m}\`?` : 'Use left, center, right, farleft, farright, or a number from 0 (left edge) to 1 (right edge).' };
    }
    case 'transition': {
      if (TRANSITIONS[s]) return { value: s };
      const m = didYouMean(s, Object.keys(TRANSITIONS));
      return { error: `\`${s}\` is not a transition.`, hint: m ? `Did you mean \`${m}\`?` : `Transitions: ${Object.keys(TRANSITIONS).join(', ')}.` };
    }
    case 'ease': {
      if (EASES.includes(s)) return { value: s };
      return { error: `\`${s}\` is not an easing.`, hint: `Use one of: ${EASES.join(', ')}.` };
    }
    case 'asset': return ctx.checkAsset(s, extra ? extra.split('|') : null, info);
    case 'character': return ctx.checkCharacter(s);
    case 'var': return ctx.checkVar(s);
    case 'list': return { value: s.split(/[\s,]+/).filter(Boolean) };
  }
  return { error: `Internal: unknown type ${type}.` };
}

// Bind tokenized arguments (and property-block lines) to a command schema.
// Returns { pos: [values...], named: {key: value}, rest: [...] }.
export function bindArgs(def, cmd, ctx) {
  const out = { pos: {}, named: {}, extra: {}, rest: [] };
  const positional = def.positional || [];
  const named = def.named || {};
  let pi = 0;
  const all = cmd.args.slice();
  for (const pr of cmd.props || []) all.push({ key: pr.key, value: pr.value, quoted: pr.quoted, col: pr.loc.col, loc: pr.loc, prop: true });
  for (const a of all) {
    const at = a.loc || { ...cmd.loc, col: a.col };
    if (a.key) {
      const spec = named[a.key];
      if (!spec) {
        if (def.extraNamed) { out.extra[a.key] = a.value; continue; }
        const m = didYouMean(a.key, Object.keys(named));
        ctx.diags.error('E302', `\`@${def.name}\` has no argument \`${a.key}\`.`, at,
          m ? `Did you mean \`${m}=\`?` : (Object.keys(named).length ? `Its named arguments are: ${Object.keys(named).map(k => k + '=').join(' ')}` : `\`@${def.name}\` takes no named arguments.`));
        continue;
      }
      const r = checkValue(spec.type, a.value, ctx, { arg: a.key });
      if (r.error) { ctx.diags.error(r.code || 'E303', `\`${a.key}=\`: ${r.error}`, at, r.hint); continue; }
      if (spec.repeat) (out.named[a.key] = out.named[a.key] || []).push(r.value);
      else out.named[a.key] = r.value;
      if (r.mark) out.named[a.key + 'Mark'] = true;
      continue;
    }
    const spec = positional[pi];
    if (!spec) {
      ctx.diags.error('E304', `Too many arguments for \`@${def.name}\`: \`${a.value}\`.`, at, `Usage: ${def.syntax}`);
      continue;
    }
    if (spec.rest) { out.rest.push({ value: a.value, col: a.col, loc: at }); continue; }
    pi++;
    if (spec.type === 'raw') { out.pos[spec.name] = a.value; continue; }
    const r = checkValue(spec.type, a.value, ctx, { arg: spec.name, quoted: a.quoted });
    if (r.error) { ctx.diags.error(r.code || 'E303', r.error, at, r.hint); out.pos[spec.name] = undefined; out.bad = true; continue; }
    out.pos[spec.name] = r.value;
    if (r.kind) out.pos[spec.name + 'Kind'] = r.kind;
  }
  for (let i = 0; i < positional.length; i++) {
    const spec = positional[i];
    if (spec.required && !spec.rest && !(spec.name in out.pos)) {
      ctx.diags.error('E301', `\`@${def.name}\` needs ${spec.doc ? spec.doc.replace(/\.$/, '').toLowerCase() : 'a ' + spec.name}.`, cmd.loc, `Usage: ${def.syntax}`);
      out.bad = true;
    }
  }
  for (const [k, spec] of Object.entries(named)) if (!(k in out.named) && spec.default !== undefined) out.named[k] = spec.default;
  return out;
}
