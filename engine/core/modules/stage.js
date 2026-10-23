// The stage: backgrounds (2D images, 3D worlds or plain colors), characters
// and props, event CGs, camera, weather, filters. Commands change the stage
// model in the VM state; renderers animate the change.

import { POSITIONS, COLOR_BACKGROUNDS } from '../registry.js';
import { clone } from '../util.js';

export const WEATHER = {
  rain: 'Falling rain streaks.',
  storm: 'Heavy slanted rain with occasional lightning.',
  snow: 'Drifting snowflakes.',
  petals: 'Cherry-blossom petals.',
  leaves: 'Autumn leaves.',
  fireflies: 'Slow glowing motes.',
  stars: 'Twinkling stars (for night skies).',
  dust: 'Floating dust in light.',
  embers: 'Rising sparks.',
  fog: 'Drifting fog banks.',
  bubbles: 'Rising bubbles (underwater).',
  none: 'Clear the weather.',
};

export const FILTERS = {
  none: 'No filter.',
  sepia: 'Old photograph (memories, flashbacks).',
  grayscale: 'Black and white.',
  night: 'Dark blue night grading.',
  dusk: 'Warm orange evening grading.',
  dream: 'Soft bright haze.',
  blur: 'Out of focus.',
  vignette: 'Darkened edges.',
  invert: 'Inverted colors (shock, the uncanny).',
  noir: 'High-contrast black and white.',
};

const TRANSITION_ARGS = {
  with: { type: 'transition', doc: 'How the change appears (see Transitions).' },
  time: { type: 'duration', doc: 'Length of the transition in seconds.' },
  wait: { type: 'bool', doc: 'Wait for the transition to finish before continuing.' },
};

export function newStage() {
  return {
    bg: null, actors: [], cg: null,
    camera: { zoom: 1, x: 0, y: 0, rotate: 0, from: null, look: null, fov: null },
    weather: null, filter: 'none', tint: null, textbox: true,
  };
}

function bgValue(id, kind) {
  if (kind === 'color' || COLOR_BACKGROUNDS.includes(id)) return { kind: 'color', color: id, id: null };
  return { kind: kind === 'world' ? 'world' : 'image', id };
}

function autoX(stage) {
  for (const x of [POSITIONS.center, POSITIONS.left, POSITIONS.right, POSITIONS.farleft, POSITIONS.farright]) {
    if (!stage.actors.some(a => typeof a.x === 'number' && Math.abs(a.x - x) < 0.08)) return x;
  }
  return POSITIONS.center;
}

function finishTransition(vm, args, defaultWait, defaultTime) {
  const time = args.time != null ? args.time : defaultTime;
  const wait = args.wait != null ? args.wait : defaultWait;
  if (wait && time > 0 && args.with !== 'none' && args.with !== 'cut') vm.halt({ type: 'wait', seconds: time, skippable: true, reason: 'transition' });
}

export default {
  name: 'stage',
  commands: [
    {
      name: 'scene',
      summary: 'Start a new scene: set the background and clear characters, CG, camera, weather, filter and tint.',
      syntax: '@scene <image | world | black | white | #color> [with=fade] [time=1]',
      positional: [{ name: 'bg', type: 'asset:image|world|color', required: true, doc: 'A background image, 3D world, or color' }],
      named: { ...TRANSITION_ARGS, with: { type: 'transition', default: 'fade', doc: 'Default: fade.' } },
      examples: ['@scene harbor_dusk', '@scene lighthouse with=dissolve time=2', '@scene black'],
      compile(cmd, ctx, args) { return { op: 'cmd', name: 'scene', args: { bg: args.pos.bg, kind: args.pos.bgKind, ...args.named } }; },
      exec(ins, vm) {
        const a = ins.args, s = vm.state.stage;
        const old = clone(s);
        s.bg = bgValue(a.bg, a.kind);
        s.actors = []; s.cg = null; s.weather = null; s.filter = 'none'; s.tint = null;
        s.camera = newStage().camera;
        const world = s.bg.kind === 'world' ? vm.program.decls.assets[s.bg.id] : null;
        if (world && world.opts.camera) s.camera.from = world.opts.camera;
        vm.emit({ type: 'stage', op: 'scene', stage: clone(s), from: old, with: a.with, time: a.time != null ? a.time : 1 });
        finishTransition(vm, a, true, 1);
      },
    },
    {
      name: 'bg',
      summary: 'Change only the background; characters stay.',
      syntax: '@bg <image | world | color> [with=dissolve] [time=0.8]',
      positional: [{ name: 'bg', type: 'asset:image|world|color', required: true, doc: 'A background image, 3D world, or color' }],
      named: { ...TRANSITION_ARGS, with: { type: 'transition', default: 'dissolve' } },
      examples: ['@bg harbor_night with=dissolve time=2'],
      compile(cmd, ctx, args) { return { op: 'cmd', name: 'bg', args: { bg: args.pos.bg, kind: args.pos.bgKind, ...args.named } }; },
      exec(ins, vm) {
        const a = ins.args, s = vm.state.stage;
        s.bg = bgValue(a.bg, a.kind);
        vm.emit({ type: 'stage', op: 'bg', bg: clone(s.bg), with: a.with, time: a.time != null ? a.time : 0.8 });
        finishTransition(vm, a, true, 0.8);
      },
    },
    {
      name: 'show',
      summary: 'Show a character (with attributes) or an image/model prop, or change one already on stage.',
      syntax: '@show <who> [attributes...] [at=position] [with=dissolve] [time=0.4] [z=0] [flip=false] [scale=1] [y=0]',
      positional: [
        { name: 'who', type: 'asset:character|image|model', required: true, doc: 'A character, image or model' },
        { name: 'attrs', type: 'attr', rest: true, doc: 'Character attributes such as smile' },
      ],
      named: {
        at: { type: 'position', doc: 'left, center, right, farleft, farright, a number 0–1, a @position name, or a 3D mark.' },
        with: { type: 'transition', default: 'dissolve' },
        time: { type: 'duration', doc: 'Default 0.4 s.' },
        wait: { type: 'bool', doc: 'Wait for the fade-in (default false).' },
        z: { type: 'number', doc: 'Stacking order; higher is in front.' },
        flip: { type: 'bool', doc: 'Mirror horizontally.' },
        scale: { type: 'number', doc: 'Size multiplier.' },
        y: { type: 'number', doc: 'Vertical offset as a fraction of screen height (negative is up).' },
      },
      examples: ['@show mio smile at=left', '@show rin angry arms_crossed at=right flip=true', '@show lantern at=0.6 z=5'],
      compile(cmd, ctx, args) {
        const who = args.pos.who, kind = args.pos.whoKind;
        let attrs = null;
        if (args.rest.length) {
          if (kind !== 'character') ctx.diags.error('E203', `Only characters take attributes; \`${who}\` is ${kind === 'image' ? 'an image' : 'a ' + kind}.`, args.rest[0].loc);
          else attrs = ctx.resolveAttrs(who, args.rest, cmd.loc);
        }
        if (kind === 'character') {
          const c = ctx.decls.characters[who];
          if (!c.sprite && !c.layers.length && !c.model) ctx.diags.warn('W610', `\`${who}\` has no \`sprite:\`, \`layer:\` or \`model:\`, so nothing will appear.`, cmd.loc);
        }
        return { op: 'cmd', name: 'show', args: { who, kind, attrs, ...args.named, atMark: !!args.named.atMark } };
      },
      exec(ins, vm) {
        const a = ins.args, s = vm.state.stage;
        let actor = s.actors.find(x => x.id === a.who);
        const entering = !actor;
        if (!actor) {
          const decl = a.kind === 'image' ? vm.program.decls.assets[a.who] : null;
          actor = { id: a.who, kind: a.kind, attrs: {}, x: decl && decl.opts.x != null ? decl.opts.x : null, y: decl && decl.opts.y || 0, scale: decl && decl.opts.scale || 1, z: 0, flip: false, mark: null };
          if (actor.x == null) actor.x = autoX(s);
          s.actors.push(actor);
        }
        if (a.kind === 'character') {
          const remembered = vm.state.charAttrs[a.who] || {};
          const c = vm.program.decls.characters[a.who];
          actor.attrs = { ...c.defaults, ...remembered, ...(a.attrs || {}) };
          vm.state.charAttrs[a.who] = { ...actor.attrs };
        }
        if (a.at != null) {
          if (a.atMark) { actor.mark = a.at; }
          else { actor.x = a.at; actor.mark = null; const p = vm.program.decls.positions; for (const [n, v] of Object.entries(p)) if (v.x === a.at) { if (v.y != null) actor.y = v.y; if (v.scale != null) actor.scale = v.scale; } }
        }
        if (a.y != null) actor.y = a.y;
        if (a.scale != null) actor.scale = a.scale;
        if (a.z != null) actor.z = a.z;
        if (a.flip != null) actor.flip = a.flip;
        vm.emit({ type: 'stage', op: 'show', id: a.who, actor: clone(actor), entering, with: a.with, time: a.time != null ? a.time : 0.4 });
        if (s.cg && entering) { /* shown under the CG; visible after it closes */ }
        finishTransition(vm, a, false, 0.4);
      },
    },
    {
      name: 'hide',
      summary: 'Remove a character or prop from the stage (or `all`).',
      syntax: '@hide <who | all> [with=dissolve] [time=0.4]',
      positional: [{ name: 'who', type: 'asset:character|image|model|all', required: true, doc: 'Who to hide, or all' }],
      named: { ...TRANSITION_ARGS, with: { type: 'transition', default: 'dissolve' } },
      examples: ['@hide mio', '@hide all with=fade'],
      compile(cmd, ctx, args) {
        return { op: 'cmd', name: 'hide', args: { who: args.pos.who, ...args.named } };
      },
      exec(ins, vm) {
        const a = ins.args, s = vm.state.stage;
        const ids = a.who === 'all' ? s.actors.map(x => x.id) : [a.who];
        for (const id of ids) {
          const i = s.actors.findIndex(x => x.id === id);
          if (i < 0) continue;
          s.actors.splice(i, 1);
          vm.emit({ type: 'stage', op: 'hide', id, with: a.with, time: a.time != null ? a.time : 0.4 });
        }
        finishTransition(vm, a, false, 0.4);
      },
    },
    {
      name: 'move',
      summary: 'Slide a character or prop to a new position, height or size.',
      syntax: '@move <who> [at=position] [y=0] [scale=1] [time=0.6] [ease=inout] [wait=false]',
      positional: [{ name: 'who', type: 'asset:character|image|model', required: true, doc: 'Who to move' }],
      named: {
        at: { type: 'position' }, y: { type: 'number' }, scale: { type: 'number' }, flip: { type: 'bool' }, z: { type: 'number' },
        time: { type: 'duration', default: 0.6 }, ease: { type: 'ease', default: 'inout' }, wait: { type: 'bool', default: false },
      },
      examples: ['@move mio at=center time=1', '@move rin scale=1.15 y=0.05 time=0.3'],
      compile(cmd, ctx, args) { return { op: 'cmd', name: 'move', args: { who: args.pos.who, ...args.named } }; },
      exec(ins, vm) {
        const a = ins.args, s = vm.state.stage;
        const actor = s.actors.find(x => x.id === a.who);
        if (!actor) { vm.warn(`@move: \`${a.who}\` is not on stage.`, ins.loc); return; }
        if (a.at != null) { if (a.atMark) actor.mark = a.at; else { actor.x = a.at; actor.mark = null; } }
        for (const k of ['y', 'scale', 'flip', 'z']) if (a[k] != null) actor[k] = a[k];
        vm.emit({ type: 'stage', op: 'move', id: a.who, actor: clone(actor), time: a.time, ease: a.ease });
        if (a.wait && a.time > 0) vm.halt({ type: 'wait', seconds: a.time, skippable: true, reason: 'transition' });
      },
    },
    {
      name: 'cg',
      summary: 'Show a full-screen event CG (unlocks it in the gallery), or `@cg none` to close it.',
      syntax: '@cg <image | none> [with=dissolve] [time=1]',
      positional: [{ name: 'image', type: 'asset:image|none', required: true, doc: 'The CG image, or none' }],
      named: { ...TRANSITION_ARGS, with: { type: 'transition', default: 'dissolve' } },
      examples: ['@cg cg_lanterns', '@cg none with=fade'],
      compile(cmd, ctx, args) {
        if (args.pos.image && ctx.decls.assets[args.pos.image]) (ctx.decls.assets[args.pos.image].usedAs = ctx.decls.assets[args.pos.image].usedAs || {}).cg = true;
        return { op: 'cmd', name: 'cg', args: { image: args.pos.image, ...args.named } };
      },
      exec(ins, vm) {
        const a = ins.args, s = vm.state.stage;
        s.cg = a.image || null;
        if (a.image) { vm.persistent.cgs[a.image] = 1; vm.persistentChanged(); }
        vm.emit({ type: 'stage', op: 'cg', cg: s.cg, with: a.with, time: a.time != null ? a.time : 1 });
        finishTransition(vm, a, true, 1);
      },
    },
    {
      name: 'camera',
      summary: 'Move the camera. 2D: zoom and pan the stage. 3D: fly between marks and look at things.',
      syntax: '@camera [zoom=1] [x=0] [y=0] [rotate=0] [from=mark] [look=mark] [fov=50] [time=1] [ease=inout] [wait=false]  — or @camera reset',
      positional: [{ name: 'action', type: 'enum:reset', doc: 'reset' }],
      named: {
        zoom: { type: 'number', doc: '2D/3D zoom (1 = normal).' },
        x: { type: 'number', doc: '2D: pan, as a fraction of screen width (positive looks right).' },
        y: { type: 'number', doc: '2D: pan, as a fraction of screen height (positive looks down).' },
        rotate: { type: 'number', doc: 'Roll in degrees.' },
        from: { type: 'string', doc: '3D: mark to place the camera at.' },
        look: { type: 'string', doc: '3D: mark (or character) to look at.' },
        fov: { type: 'number', doc: '3D: field of view in degrees.' },
        orbit: { type: 'number', doc: '3D: orbit around the look target by this many degrees.' },
        time: { type: 'duration', default: 1 }, ease: { type: 'ease', default: 'inout' }, wait: { type: 'bool', default: false },
      },
      examples: ['@camera zoom=1.3 x=0.1 time=2', '@camera from=cliff look=lamp time=3 wait=true', '@camera reset time=1'],
      compile(cmd, ctx, args) {
        const n = args.named;
        if (n.from && n.look && n.from === n.look) ctx.diags.warn('W618', `\`from=${n.from}\` and \`look=${n.look}\` are the same mark, so the camera would look at itself.`, cmd.loc, 'Stand at one mark and look at another, e.g. `@camera from=door look=lamp`.');
        for (const k of ['from', 'look']) if (n[k] && ctx.checkMark) { const r = ctx.checkMark(n[k]); if (r.error && !ctx.decls.characters[n[k]]) ctx.diags.error('E303', `\`${k}=\`: ${r.error}`, cmd.loc, r.hint); }
        return { op: 'cmd', name: 'camera', args: { ...args.pos, ...n } };
      },
      exec(ins, vm) {
        const a = ins.args, cam = vm.state.stage.camera;
        const bg = vm.state.stage.bg;
        if ((!bg || bg.kind !== 'world') && ['from', 'look', 'fov', 'orbit'].some(k => a[k] != null)) {
          vm.warn('`@camera from=/look=/fov=/orbit=` only work in 3D worlds; the background here is 2D, so they are ignored.', ins.loc, 'R705');
        }
        if (a.action === 'reset') Object.assign(cam, newStage().camera);
        for (const k of ['zoom', 'x', 'y', 'rotate', 'from', 'look', 'fov']) if (a[k] != null) cam[k] = a[k];
        vm.emit({ type: 'stage', op: 'camera', camera: clone(cam), orbit: a.orbit || 0, time: a.time, ease: a.ease });
        if (a.wait && a.time > 0) vm.halt({ type: 'wait', seconds: a.time, skippable: true, reason: 'transition' });
      },
    },
    {
      name: 'shake',
      summary: 'Shake the screen (impacts, shock, earthquakes).',
      syntax: '@shake [strength=1] [time=0.5]',
      named: { strength: { type: 'number', default: 1 }, time: { type: 'duration', default: 0.5 } },
      examples: ['@shake', '@shake strength=2 time=1'],
      exec(ins, vm) { vm.emit({ type: 'stage', op: 'shake', strength: ins.args.strength, time: ins.args.time }); },
    },
    {
      name: 'flash',
      summary: 'Flash the screen with a color.',
      syntax: '@flash [color=white] [time=0.4]',
      named: { color: { type: 'color', default: 'white' }, time: { type: 'duration', default: 0.4 } },
      examples: ['@flash', '@flash color=#ff2244 time=0.2'],
      exec(ins, vm) { vm.emit({ type: 'stage', op: 'flash', color: ins.args.color, time: ins.args.time }); },
    },
    {
      name: 'weather',
      summary: 'Animated background effects: rain, snow, petals, fireflies, stars, fog... (`none` to clear).',
      syntax: '@weather <type> [intensity=1] [wind=0] [layer=front|back] [time=1]',
      positional: [{ name: 'type', type: 'enum:' + Object.keys(WEATHER).join('|'), required: true, doc: 'The effect' }],
      named: {
        intensity: { type: 'number', default: 1, doc: '0.2 = light, 1 = normal, 2 = heavy.' },
        wind: { type: 'number', default: 0, doc: '-1 (blows left) to 1 (blows right).' },
        layer: { type: 'enum:front|back', default: 'front', doc: 'In front of or behind the characters.' },
        time: { type: 'duration', default: 1, doc: 'Fade-in time.' },
      },
      examples: ['@weather rain intensity=1.5 wind=0.3', '@weather fireflies layer=back', '@weather none'],
      exec(ins, vm) {
        const a = ins.args;
        vm.state.stage.weather = a.type === 'none' ? null : { type: a.type, intensity: a.intensity, wind: a.wind, layer: a.layer };
        vm.emit({ type: 'stage', op: 'weather', weather: clone(vm.state.stage.weather), time: a.time });
      },
    },
    {
      name: 'filter',
      summary: 'Color-grade the whole picture (flashbacks, night, dreams).',
      syntax: '@filter <sepia | grayscale | night | dusk | dream | blur | vignette | invert | noir | none> [time=1]',
      positional: [{ name: 'type', type: 'enum:' + Object.keys(FILTERS).join('|'), required: true, doc: 'The filter' }],
      named: { time: { type: 'duration', default: 1 } },
      examples: ['@filter sepia', '@filter none time=2'],
      exec(ins, vm) {
        vm.state.stage.filter = ins.args.type;
        vm.emit({ type: 'stage', op: 'filter', filter: ins.args.type, time: ins.args.time });
      },
    },
    {
      name: 'tint',
      summary: 'Wash the picture with a color, or `@tint none`.',
      syntax: '@tint <color | none> [alpha=0.3] [time=1]',
      positional: [{ name: 'color', type: 'string', required: true, doc: 'A color like #ff8844, or none' }],
      named: { alpha: { type: 'number', default: 0.3 }, time: { type: 'duration', default: 1 } },
      examples: ['@tint #ff6a00 alpha=0.25', '@tint none'],
      compile(cmd, ctx, args) {
        const c = args.pos.color;
        if (c !== 'none' && !/^#|^[a-z]+$/.test(c)) ctx.diags.error('E303', `\`${c}\` is not a color.`, cmd.loc);
        return { op: 'cmd', name: 'tint', args: { color: c, ...args.named } };
      },
      exec(ins, vm) {
        const a = ins.args;
        vm.state.stage.tint = a.color === 'none' ? null : { color: a.color, alpha: a.alpha };
        vm.emit({ type: 'stage', op: 'tint', tint: clone(vm.state.stage.tint), time: a.time });
      },
    },
  ],
};
