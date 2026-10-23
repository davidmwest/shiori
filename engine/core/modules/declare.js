// Declarations: compile-time only. They name the things a story uses.

import { parseAssignment, ExprError } from '../expr.js';
import { checkValue, has, POSITIONS } from '../registry.js';
import { isIdent, didYouMean } from '../util.js';
import { assignmentErrorPos } from './story.js';

const CHAR_PROPS = {
  name: 'string', color: 'color', sprite: 'path', layer: 'path', side: 'path', blink: 'path', mouth: 'path',
  model: 'path', scale: 'number', y: 'number', voice: 'path',
  role: 'enum:protagonist|main|side|appears', gender: 'enum:female|male|nonbinary|unknown', age: 'string',
  description: 'string', cv: 'string', original_name: 'string',
};
// Free-text properties: a near-miss key with free text is almost surely a typo
// (`nmae: Mio Tanaka`), never an attribute group.
const TEXT_PROPS = ['name', 'description', 'age', 'cv', 'original_name'];

function literal(ast) {
  if (!ast) return undefined;
  if (ast.t === 'num' || ast.t === 'str' || ast.t === 'bool') return ast.v;
  if (ast.t === 'un' && ast.op === '-' && ast.a.t === 'num') return -ast.a.v;
  return undefined;
}

function declareVar(persistent) {
  return function (cmd, ctx) {
    const kw = persistent ? 'persistent' : 'var';
    if (!cmd.raw) { ctx.diags.error('E402', `\`@${kw}\` needs a name and a starting value, e.g. \`@${kw} trust = 0\`.`, cmd.loc); return; }
    let a;
    try { a = parseAssignment(cmd.raw); }
    catch (e) {
      if (e instanceof ExprError) {
        if (/^\s*[A-Za-z_]\w*\s*$/.test(cmd.raw)) ctx.diags.error('E402', `\`@${kw} ${cmd.raw.trim()}\` needs a starting value.`, cmd.loc, `Write \`@${kw} ${cmd.raw.trim()} = 0\` (or = false, or = "").`);
        else ctx.diags.error(e.code, e.message, { ...cmd.loc, col: cmd.rawCol + assignmentErrorPos(cmd.raw, e) }, e.hint);
        return;
      }
      throw e;
    }
    if (a.op !== '=') { ctx.diags.error('E402', `Declarations use \`=\`, not \`${a.op}\`.`, cmd.loc); return; }
    const v = literal(a.value);
    if (v === undefined) { ctx.diags.error('E402', 'A starting value must be a plain number, string, true or false.', cmd.loc, 'Compute values later with `@set`.'); return; }
    ctx.addVar(a.name, v, persistent, cmd.loc);
  };
}

function templateGroups(tpl) {
  return (String(tpl).match(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g) || []).map(s => s.slice(1, -1));
}

function declareCharacter(cmd, ctx, args) {
  const id = args.pos.id;
  if (!id) return;
  const c = { id, name: null, color: null, sprite: null, layers: [], side: null, blink: null, mouth: null, model: null, scale: 1, y: 0, groups: Object.create(null), attrIndex: Object.create(null), defaults: Object.create(null), noblink: [], vndb: {} };
  const entries = [];
  for (const a of cmd.args.slice(1)) entries.push({ key: a.key, value: a.value, loc: { ...cmd.loc, col: a.col }, positional: !a.key });
  for (const p of cmd.props) entries.push({ key: p.key, value: p.value, loc: p.loc });
  const noblink = [];
  for (const e of entries) {
    if (e.positional) continue; // reported by bindArgs
    // `noblink: sleepy proud`: checked once every attribute group is known.
    if (e.key === 'noblink') { noblink.push(e); continue; }
    const type = has(CHAR_PROPS, e.key) ? CHAR_PROPS[e.key] : null;
    if (e.key === 'gender') e.value = ({ f: 'female', m: 'male', nb: 'nonbinary', n: 'nonbinary', x: 'nonbinary', '?': 'unknown' })[String(e.value).toLowerCase()] || e.value;
    if (type) {
      const r = checkValue(type, e.value, ctx);
      if (r.error) { ctx.diags.error('E303', `\`${e.key}\`: ${r.error}`, e.loc, r.hint); continue; }
      if (e.key === 'layer') c.layers.push(r.value);
      else if (['role', 'gender', 'age', 'description', 'cv', 'original_name'].includes(e.key)) c.vndb[e.key] = r.value;
      else c[e.key] = r.value;
      continue;
    }
    if (!isIdent(e.key)) { ctx.diags.error('E303', `\`${e.key}\` is not a valid property name.`, e.loc); continue; }
    // Anything else is an attribute group: "expression: neutral smile sad"
    const values = String(e.value).split(/[\s,]+/).filter(Boolean);
    if (!values.length) { ctx.diags.error('E303', `Attribute group \`${e.key}\` lists no values.`, e.loc); continue; }
    // A misspelled property must not silently become an attribute group.
    // It is a typo when the key is close to a property, no image template
    // uses it as {group}, and the value can't be a list of attributes: one
    // value only, words that aren't simple names, or free text for a text
    // property (`nmae: Mio Tanaka`, `descripton: The quiet ...`). Real groups
    // near a property name (`pose:` vs role, `size:` vs side) stay groups.
    if (!templateHasGroup(c, e.key, entries)) {
      const m = didYouMean(e.key, [...Object.keys(CHAR_PROPS), 'noblink']);
      if (m && (values.length === 1 || TEXT_PROPS.includes(m) || values.some(v => !isIdent(v)))) {
        ctx.diags.error('E302', `\`@character\` has no property \`${e.key}\`.`, e.loc, `Did you mean \`${m}\`?`); continue;
      }
    }
    c.groups[e.key] = values;
    c.defaults[e.key] = values[0];
    for (const v of values) {
      if (!isIdent(v)) { ctx.diags.error('E303', `Attribute \`${v}\` must be a simple name (letters, digits, _).`, e.loc); continue; }
      if (c.attrIndex[v]) ctx.diags.error('E204', `Attribute \`${v}\` is in both \`${c.attrIndex[v]}\` and \`${e.key}\`.`, e.loc, 'Each attribute name may belong to one group only.');
      else c.attrIndex[v] = e.key;
    }
  }
  if (!c.name) c.name = id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');
  for (const key of ['sprite', 'side', 'blink', 'mouth']) checkTemplate(c, c[key], key, cmd, ctx);
  c.layers.forEach(l => checkTemplate(c, l, 'layer', cmd, ctx));
  if (c.sprite && c.layers.length) ctx.diags.error('E303', 'Use either `sprite:` (one image per look) or `layer:` lines (stacked images), not both.', cmd.loc);
  for (const e of noblink) checkNoblink(c, e, ctx);
  ctx.addCharacter(c, cmd.loc);
}

// `noblink:` lists attribute values whose art already has the eyes closed: the
// blink overlay is not drawn while the character has one of them.
function checkNoblink(c, e, ctx) {
  const values = String(e.value == null ? '' : e.value).split(/[\s,]+/).filter(Boolean);
  if (!values.length) { ctx.diags.error('E303', '`noblink:` lists no attribute values.', e.loc, 'List the values whose art has the eyes closed, e.g. `noblink: sleepy`.'); return; }
  if (!c.blink) {
    ctx.diags.error('E303', `\`noblink:\` only works with a \`blink:\` overlay, and \`${c.id}\` has none.`, e.loc, 'Add a `blink:` line (e.g. `blink: chars/' + c.id + '/blink.png`), or remove `noblink:`.');
    return;
  }
  const all = Object.keys(c.attrIndex);
  for (const v of values) {
    if (has(c.attrIndex, v)) { if (!c.noblink.includes(v)) c.noblink.push(v); continue; }
    const m = didYouMean(v, all);
    ctx.diags.error('E203', all.length ? `\`noblink:\`: \`${c.id}\` has no attribute \`${v}\`.` : `\`noblink:\`: \`${c.id}\` has no attributes declared, so \`${v}\` can't be used.`, e.loc,
      m ? `Did you mean \`${m}\`?` : all.length ? `${c.id}'s attributes: ${Object.entries(c.groups).map(([g, vs]) => g + ': ' + vs.join(' ')).join('; ')}.` : `Add a line like \`expression: neutral sleepy\` under \`@character ${c.id}\`.`);
  }
}

function templateHasGroup(c, key, entries) {
  return entries.some(e => ['sprite', 'layer', 'side', 'blink', 'mouth'].includes(e.key) && templateGroups(e.value).includes(key));
}

function checkTemplate(c, tpl, key, cmd, ctx) {
  if (!tpl) return;
  for (const g of templateGroups(tpl)) {
    if (!c.groups[g]) {
      const m = didYouMean(g, Object.keys(c.groups));
      ctx.diags.error('E203', `\`${key}:\` uses \`{${g}}\`, but \`${c.id}\` has no \`${g}:\` attribute group.`, cmd.loc,
        m ? `Did you mean \`{${m}}\`?` : `Add a line like \`${g}: neutral smile\` to the character.`);
    }
  }
}

function assetDecl(kind, extraNamed) {
  extraNamed = { ...extraNamed, desc: { type: 'string', doc: 'A brief for whoever makes this file (artist, composer). Listed by `shiori assets`.' } };
  return {
    name: kind,
    decl: true,
    props: true,
    positional: [
      { name: 'id', type: 'ident', required: true, doc: 'A name for this ' + kind },
      { name: 'path', type: 'path', required: true, doc: 'The file path, relative to game.story' },
    ],
    named: extraNamed,
    declare(cmd, ctx, args) {
      if (!args.pos.id || !args.pos.path) return;
      if (kind === 'world') checkWorldCamera(cmd, ctx, args.named);
      ctx.addAsset(args.pos.id, kind, args.pos.path, args.named, cmd.loc);
    },
  };
}

// `@world ... marks="..." camera=x`: the starting mark must be one of the
// world's own marks (a world without marks= accepts any mark).
function checkWorldCamera(cmd, ctx, named) {
  const marks = named.marks || [];
  const cam = named.camera;
  if (!cam || !marks.length || marks.includes(cam)) return;
  const m = didYouMean(cam, marks);
  ctx.diags.error('E303', `\`camera=\`: \`${cam}\` is not one of this world's marks.`, cmd.loc,
    m ? `Did you mean \`${m}\`?` : `Its marks are: ${marks.join(', ')}. Add \`${cam}\` to marks= if it is a new one.`);
}

export default {
  name: 'declare',
  commands: [
    {
      name: 'character', decl: true, props: true, extraNamed: true,
      summary: 'Declare a character: display name, color, sprites or 3D model, and attribute groups.',
      syntax: '@character <id> [name="Display Name"] [color=#hex] — or an indented block of `key: value` lines',
      positional: [{ name: 'id', type: 'ident', required: true, doc: 'The character id used in scripts (e.g. mio)' }],
      named: {},
      doc: [
        'Properties: name, color, sprite, layer (repeatable), side, blink, mouth, model, scale, y.',
        'VNDB character sheet: role (protagonist|main|side|appears), gender, age, description, cv (voice actor), original_name.',
        'Any other key is an attribute group: `expression: neutral smile sad` (the first value is the default).',
        'Image paths can use `{group}` placeholders: `sprite: chars/mio/{expression}.png`.',
      ],
      examples: [
        '@character mio\n  name: Mio\n  color: #f29bb0\n  sprite: chars/mio/{expression}.png\n  expression: neutral smile sad angry blush',
        '@character narrator_cat name="Cat" color=#c9a227',
      ],
      declare: declareCharacter,
    },
    Object.assign(assetDecl('image', {
      fit: { type: 'enum:cover|contain|none', default: 'cover', doc: 'How a background fills the screen.' },
      title: { type: 'string', doc: 'Name shown in the CG gallery.' },
      x: { type: 'number', doc: 'Default horizontal position when shown as a prop (0–1).' },
      y: { type: 'number', doc: 'Vertical offset when shown as a prop.' },
      scale: { type: 'number', doc: 'Scale when shown as a prop.' },
      animated: { type: 'bool', doc: 'Mark an animated background or CG (for the VNDB report).' },
    }), {
      summary: 'Declare an image (background, CG, or prop). SVG, PNG, JPG, WebP, GIF and AVIF work.',
      syntax: '@image <id> <path> [fit=cover|contain|none] [title="Gallery name"]',
      examples: ['@image harbor_dusk bg/harbor_dusk.png', '@image cg_lanterns cg/lanterns.png title="Lantern Night"'],
    }),
    Object.assign(assetDecl('audio', {
      volume: { type: 'number', doc: 'Base volume 0–1.' },
      loop: { type: 'bool', doc: 'Loop when used as music or ambience (default true).' },
      title: { type: 'string', doc: 'Track name for the music room.' },
      room: { type: 'bool', doc: 'List in the music room (default: true for music).' },
    }), {
      summary: 'Declare a sound file (OGG, MP3, WAV) or an LMN song (.lmn / .txt starting with `LMN 1`).',
      syntax: '@audio <id> <path> [title="Track name"] [volume=0.8]',
      examples: ['@audio theme music/theme.lmn title="Lanterns (Main Theme)"', '@audio waves sfx/waves.ogg volume=0.6'],
    }),
    Object.assign(assetDecl('world', {
      marks: { type: 'list', doc: 'Named positions in the world (for at= and @camera from=/look=).' },
      camera: { type: 'string', doc: 'Mark the camera starts at.' },
      animated: { type: 'bool', doc: 'The world has moving parts (waves, particles...).' },
    }), {
      summary: 'Declare a 3D world: a .glb/.gltf file, or a .js module that builds the scene with three.js.',
      syntax: '@world <id> <path> [marks="pier cliff lamp"]',
      examples: ['@world lighthouse worlds/lighthouse.js marks="door lamp cliff sea"', '@world town worlds/town.glb'],
    }),
    Object.assign(assetDecl('model', {
      scale: { type: 'number', doc: 'Scale.' },
    }), {
      summary: 'Declare a 3D prop model (.glb/.gltf/.vrm, or a .js module).',
      syntax: '@model <id> <path> [scale=1]',
      examples: ['@model boat models/boat.glb'],
    }),
    Object.assign(assetDecl('gameplay', {
      minutes: { type: 'number', default: 1, doc: 'Typical time a player spends in it (for the VNDB reading-share estimate).' },
      results: { type: 'list', doc: 'Possible results, so `shiori explore` can try each one.' },
    }), {
      summary: 'Declare a gameplay module (a .js file). Gameplay counts against VNDB\'s reading-share rule.',
      syntax: '@gameplay <id> <path.js> [minutes=2] [results="win lose"]',
      examples: ['@gameplay cards games/cards.js minutes=3 results="win lose"'],
    }),
    {
      name: 'var', decl: true, raw: true,
      summary: 'Declare a story variable with its starting value. Variables reset on New Game.',
      syntax: '@var <name> = <number | "string" | true | false>',
      examples: ['@var trust = 0', '@var met_rin = false', '@var player_name = "Aoi"'],
      declare: declareVar(false),
    },
    {
      name: 'persistent', decl: true, raw: true,
      summary: 'Declare a variable that survives across playthroughs (e.g. unlocks after an ending).',
      syntax: '@persistent <name> = <value>',
      examples: ['@persistent saw_true_end = false'],
      declare: declareVar(true),
    },
    {
      name: 'position', decl: true, props: true,
      summary: 'Name a horizontal stage position for 2D scenes.',
      syntax: '@position <name> x=<0..1> [y=0] [scale=1]',
      positional: [{ name: 'name', type: 'ident', required: true, doc: 'The position name' }],
      named: { x: { type: 'number', doc: '0 = left edge, 1 = right edge.' }, y: { type: 'number', default: 0 }, scale: { type: 'number', default: 1 } },
      examples: ['@position doorway x=0.82 scale=0.8'],
      declare(cmd, ctx, args) {
        const name = args.pos.name;
        if (!name) return;
        if (args.named.x == null) { ctx.diags.error('E301', '`@position` needs x=.', cmd.loc); return; }
        if (has(POSITIONS, name)) {
          ctx.diags.error('E204', `\`${name}\` is a built-in position (x=${POSITIONS[name]}) and can't be redeclared.`, cmd.loc, `Pick another name, e.g. \`@position ${name}_near x=${args.named.x}\`.`);
          return;
        }
        const prev = has(ctx.decls.positions, name) ? ctx.decls.positions[name] : null;
        if (prev) {
          ctx.diags.error('E204', `Position \`${name}\` is already declared${prev.loc ? ` (at ${prev.loc.file}:${prev.loc.line})` : ''}.`, cmd.loc, 'Each @position name is declared once; pick a different name.');
          return;
        }
        ctx.decls.positions[name] = { x: args.named.x, y: args.named.y, scale: args.named.scale, loc: cmd.loc };
      },
    },
  ],
};
