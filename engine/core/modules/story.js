// Story flow: variables, calls, endings, chapters, input, waits, gameplay.

import { parseAssignment, parseExpr, ExprError, trailingString } from '../expr.js';
import { parseMarkup, plainText } from '../markup.js';
import { tokenizeArgs } from '../parser.js';

// Where the value starts in `name = value` (0-based offset into raw), or -1.
export function assignmentValueStart(raw) {
  const m = /^\s*[A-Za-z_][A-Za-z0-9_]*\s*(?:\+=|-=|\*=|\/=|=(?!=))\s*/.exec(raw);
  return m ? m[0].length : -1;
}

// Offset into raw of an error thrown by parseAssignment(raw). Errors about
// the assignment's shape (E402) are already measured from the start; errors
// in the value are re-measured here, so the caret lands inside the value.
export function assignmentErrorPos(raw, e) {
  const off = e.code === 'E402' ? -1 : assignmentValueStart(raw);
  if (off >= 0) {
    try { parseExpr(raw.slice(off)); } catch (e2) { if (e2 instanceof ExprError) return off + (e2.pos || 0); }
  }
  return e.pos || 0;
}

export default {
  name: 'story',
  commands: [
    {
      name: 'set', raw: true,
      summary: 'Change a variable.',
      syntax: '@set <name> = <expr>   (also +=, -=, *=, /=)',
      examples: ['@set trust += 1', '@set met_rin = true', '@set mood = "wary"'],
      compile(cmd, ctx) {
        if (!cmd.raw) { ctx.diags.error('E402', '`@set` needs an assignment, e.g. `@set trust += 1`.', cmd.loc); return null; }
        let a;
        try { a = parseAssignment(cmd.raw); }
        catch (e) {
          if (e instanceof ExprError) { ctx.diags.error(e.code, e.message, { ...cmd.loc, col: cmd.rawCol + assignmentErrorPos(cmd.raw, e) }, e.hint); return null; }
          throw e;
        }
        const v = ctx.decls.vars[a.name];
        if (!v) {
          const r = ctx.checkVar(a.name);
          ctx.diags.error('E201', r.error, { ...cmd.loc, col: cmd.rawCol }, r.hint);
          return null;
        }
        v.written = true;
        const valueCol = cmd.rawCol + Math.max(0, assignmentValueStart(cmd.raw));
        // `@set trust = trust + 1` reads trust only to change it: that alone
        // doesn't count as a read (W612), any more than `@set trust += 1` does.
        const wasRead = v.read;
        ctx.checkRefs(a.value, cmd.loc, valueCol);
        v.read = wasRead;
        const t = ctx.typeOf(a.value);
        const typeName = (x) => x === 'bool' ? 'true/false value' : x;
        // A variable whose declaration failed has no known type (v.failed).
        if (v.failed) return { op: 'set', name: a.name, opr: a.op, value: a.value };
        if (a.op === '=' && t !== 'any' && t !== v.type) {
          ctx.diags.error('E403', `\`${a.name}\` holds a ${typeName(v.type)}, but this assigns a ${typeName(t)}.`, cmd.loc,
            `It was declared as \`@var ${a.name} = ${JSON.stringify(v.init)}\`.`);
        }
        if (a.op !== '=' && v.type !== 'number' && !(a.op === '+=' && v.type === 'string')) {
          ctx.diags.error('E403', `\`${a.op}\` needs a number variable, and \`${a.name}\` is a ${v.type}.`, cmd.loc);
        } else if (a.op !== '=' && v.type === 'number' && t !== 'number' && t !== 'any') {
          ctx.diags.error('E403', `\`${a.op}\` on the number variable \`${a.name}\` needs a number, but this is a ${typeName(t)}.`, { ...cmd.loc, col: valueCol },
            `Write a number, e.g. \`@set ${a.name} ${a.op} 1\`.`);
        }
        return { op: 'set', name: a.name, opr: a.op, value: a.value };
      },
    },
    {
      name: 'jump', aliases: [],
      summary: 'Jump to a scene (same as `-> scene`).',
      syntax: '@jump <scene>',
      positional: [{ name: 'target', type: 'label', required: true, doc: 'The scene to go to' }],
      examples: ['@jump harbor_night'],
      compile(cmd, ctx, args) {
        if (args.pos.target === 'END') return { op: 'end' };
        return { op: 'jump', label: args.pos.target, pc: null };
      },
    },
    {
      name: 'call',
      summary: 'Run a scene, then come back here when it reaches `@return`.',
      syntax: '@call <scene>',
      positional: [{ name: 'target', type: 'label', required: true, doc: 'The scene to run' }],
      examples: ['@call flashback_rain'],
      compile(cmd, ctx, args) { return { op: 'call', label: args.pos.target, pc: null }; },
    },
    {
      name: 'return',
      summary: 'Go back to just after the `@call` that started this scene.',
      syntax: '@return',
      examples: ['@return'],
      compile() { return { op: 'return' }; },
    },
    {
      name: 'ending',
      summary: 'Mark that the player reached an ending. Records it permanently and shows an ending card.',
      syntax: '@ending <id> ["Title"] [kind=true|good|normal|bad|joke]',
      positional: [
        { name: 'id', type: 'ident', required: true, doc: 'An id for this ending' },
        { name: 'title', type: 'string', doc: 'The ending\'s title' },
      ],
      named: { kind: { type: 'enum:true|good|normal|bad|joke', default: 'normal', doc: 'What kind of ending it is.' } },
      examples: ['@ending lanterns_home "Lanterns Home" kind=true', '@ending drowned "Undertow" kind=bad'],
      compile(cmd, ctx, args) {
        const given = { title: args.pos.title != null && args.pos.title !== '', kind: cmd.args.some(x => x.key === 'kind') };
        ctx.defineEnding(args.pos.id, args.pos.title, args.named.kind, cmd.loc, given);
        return { op: 'cmd', name: 'ending', args: { id: args.pos.id, title: args.pos.title || args.pos.id, kind: args.named.kind } };
      },
      exec(ins, vm) {
        // Every site of an ending records the declared title and kind, so the
        // card, the persistent record, explore and the VNDB report agree.
        const a = { ...ins.args };
        const endings = vm.program.decls && vm.program.decls.endings;
        const d = endings && Object.prototype.hasOwnProperty.call(endings, a.id) ? endings[a.id] : null;
        if (d) { a.title = d.title; a.kind = d.kind; }
        const now = Date.now();
        const rec = vm.persistent.endings[a.id];
        if (rec) rec.count++; else vm.persistent.endings[a.id] = { title: a.title, kind: a.kind, first: now, count: 1 };
        vm.state.lastEnding = a.id;
        vm.persistentChanged();
        vm.halt({ type: 'ending', id: a.id, title: a.title, kind: a.kind, first: !rec });
      },
    },
    {
      name: 'chapter',
      summary: 'Start a chapter: shows a title card and names save files.',
      syntax: '@chapter "Title" [subtitle="..."]',
      positional: [{ name: 'title', type: 'string', required: true, doc: 'The chapter title' }],
      named: { subtitle: { type: 'string', doc: 'A smaller line under the title.' }, card: { type: 'bool', default: true, doc: 'Show the title card.' } },
      examples: ['@chapter "Chapter 1: Salt"', '@chapter "Interlude" subtitle="Rin"'],
      exec(ins, vm) {
        vm.state.chapter = ins.args.title;
        if (ins.args.card) vm.halt({ type: 'chapter', title: ins.args.title, subtitle: ins.args.subtitle || null, seconds: 2.5 });
      },
    },
    {
      name: 'assert', raw: true,
      summary: 'Check a condition while testing. `shiori explore` reports every assertion that can fail.',
      syntax: '@assert <condition> ["message"]',
      examples: ['@assert trust >= 0', '@assert visited("harbor") > 0', '@assert route == "rin" "Only Rin\'s route reaches the roof"'],
      compile(cmd, ctx) {
        // A trailing "string" is the message only when the text before it is
        // already a complete condition, so `@assert route == "rin"` keeps
        // its last operand.
        // The message follows the escape rule of every quoted argument: only
        // \\, \" and \' (anything else is E110, reported by tokenizeArgs).
        let src = cmd.raw || '', message = null;
        if (!parses(src)) {
          const t = trailingString(src);
          if (t && parses(src.slice(0, t.start))) {
            const [tok] = tokenizeArgs(src.slice(t.start, t.end), (cmd.rawCol || 1) - 1 + t.start, ctx.diags, cmd.loc);
            src = src.slice(0, t.start).trimEnd();
            message = tok.value;
          }
        }
        const cond = ctx.compileExpr(src, cmd.loc, cmd.rawCol);
        return cond ? { op: 'assert', cond, message, src } : null;
      },
    },
    {
      name: 'log', raw: true,
      summary: 'Print a debugging message (shown by `shiori play` and in the browser console).',
      syntax: '@log <text with {$vars}>',
      examples: ['@log trust is now {$trust}'],
      compile(cmd, ctx) {
        return { op: 'cmd', name: 'log', args: { text: ctx.compileText(cmd.raw || '', cmd.loc, cmd.rawCol) } };
      },
      exec(ins, vm) {
        vm.emit({ type: 'log', text: plainText(ins.args.text, n => vm.getVar(n)), loc: ins.loc });
      },
    },
    {
      name: 'note', topLevel: true,
      summary: 'An author\'s note. Ignored by the game; listed by `shiori stats`.',
      syntax: '@note "text"',
      positional: [{ name: 'text', type: 'string', rest: true }],
      examples: ['@note "TODO: rewrite this scene after chapter 3 changes"'],
      compile(cmd, ctx, args) {
        const text = (args && args.rest || []).map(r => r.value).join(' ').trim();
        if (text && ctx.addNote) ctx.addNote(text, cmd.loc);
        return null;
      },
    },
    {
      name: 'input',
      summary: 'Ask the player to type text (such as a name) into a variable.',
      syntax: '@input <variable> ["Prompt"] [default="..."] [max=20]',
      positional: [
        { name: 'var', type: 'var', required: true, doc: 'A declared string variable' },
        { name: 'prompt', type: 'string', doc: 'The question shown' },
      ],
      named: { default: { type: 'string', doc: 'Pre-filled answer.' }, max: { type: 'int', default: 24, doc: 'Maximum length.' } },
      examples: ['@input player_name "What is your name?" default="Aoi"'],
      compile(cmd, ctx, args) {
        const v = ctx.decls.vars[args.pos.var];
        if (v) {
          v.written = true;
          if (v.type !== 'string' && !v.failed) ctx.diags.error('E403', `\`@input\` stores text, but \`${v.name}\` holds a ${v.type}.`, cmd.loc, `Declare it as \`@var ${v.name} = ""\`.`);
        }
        return { op: 'cmd', name: 'input', args: { var: args.pos.var, prompt: args.pos.prompt || '', default: args.named.default != null ? args.named.default : (v ? v.init : ''), max: args.named.max } };
      },
      exec(ins, vm) {
        vm.halt({ type: 'input', var: ins.args.var, prompt: ins.args.prompt, default: ins.args.default, max: ins.args.max });
      },
      vndb: { interaction: 'input' },
    },
    {
      name: 'rename',
      summary: 'Change the name shown for a character from now on (e.g. "???" until introduced). No name resets it.',
      syntax: '@rename <character> ["New name"]',
      positional: [
        { name: 'who', type: 'character', required: true, doc: 'The character' },
        { name: 'name', type: 'string', doc: 'The name to show' },
      ],
      examples: ['@rename rin "???"', '@rename rin'],
      exec(ins, vm) {
        if (ins.args.name) vm.state.names[ins.args.who] = ins.args.name;
        else delete vm.state.names[ins.args.who];
      },
    },
    {
      name: 'pov',
      summary: 'Say whose point of view the narration follows from now on (for stories told from several perspectives). `@pov none` clears it.',
      syntax: '@pov <character | none>',
      positional: [{ name: 'who', type: 'asset:character|none', required: true, doc: 'The character whose eyes we see through, or none' }],
      examples: ['@pov rin', '@pov none'],
      compile(cmd, ctx, args) { return { op: 'cmd', name: 'pov', args: { who: args.pos.who || null } }; },
      exec(ins, vm) {
        vm.state.pov = ins.args.who;
        vm.emit({ type: 'text', op: 'pov', who: ins.args.who, name: ins.args.who ? vm.displayName(ins.args.who) : null });
      },
    },
    {
      name: 'wait',
      summary: 'Pause for a number of seconds (the player can click to skip).',
      syntax: '@wait <seconds>',
      positional: [{ name: 'seconds', type: 'duration', required: true, doc: 'How long to wait' }],
      examples: ['@wait 1.5'],
      exec(ins, vm) { vm.halt({ type: 'wait', seconds: ins.args.seconds, skippable: true }); },
    },
    {
      name: 'pause',
      summary: 'Wait for a click with no text on screen (e.g. to let a CG sink in).',
      syntax: '@pause',
      examples: ['@textbox hide\n@pause'],
      exec(ins, vm) { vm.halt({ type: 'pause' }); },
    },
    {
      name: 'game',
      summary: 'Run a gameplay module and store its result. Gameplay is limited by VNDB\'s inclusion rules.',
      syntax: '@game <gameplay id> [into=variable] [any other key=value is passed to the module]',
      positional: [{ name: 'id', type: 'asset:gameplay', required: true, doc: 'A declared @gameplay module' }],
      named: { into: { type: 'var', doc: 'Variable that receives the result.' } },
      extraNamed: true,
      examples: ['@game cards into=card_result difficulty=2'],
      compile(cmd, ctx, args) {
        if (args.named.into && ctx.decls.vars[args.named.into]) ctx.decls.vars[args.named.into].written = true;
        return { op: 'cmd', name: 'game', args: { id: args.pos.id, into: args.named.into || null, params: args.extra } };
      },
      exec(ins, vm) {
        const a = vm.program.decls.assets[ins.args.id];
        vm.halt({ type: 'game', id: ins.args.id, path: a && a.path, into: ins.args.into, params: ins.args.params, results: a && a.opts.results || null });
      },
      vndb: { gameplay: true },
    },
  ],
};

function parses(src) {
  try { parseExpr(src); return true; } catch (e) { if (e instanceof ExprError) return false; throw e; }
}

export function textPlain(tokens) { return plainText(tokens); }
export { parseMarkup };
