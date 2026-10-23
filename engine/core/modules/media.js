// Video: opening movies, cutscenes, ending movies.
// `@video id path` declares a video; `@video id` plays it.

export default {
  name: 'media',
  commands: [
    {
      name: 'video',
      summary: 'Declare a video (`@video id path`) or play one (`@video id`).',
      syntax: '@video <id> <path>  (declare)   ·   @video <id> [kind=opening|cutscene|ending] [skippable=true]  (play)',
      positional: [
        { name: 'id', type: 'raw', required: true, doc: 'The video id' },
        { name: 'path', type: 'raw', doc: 'File path (only when declaring)' },
      ],
      named: {
        kind: { type: 'enum:opening|cutscene|ending', default: 'cutscene', doc: 'For the VNDB report: opening and ending movies are not "cutscenes".' },
        skippable: { type: 'bool', default: true },
        loop: { type: 'bool', doc: 'When declaring: loop as a moving background.' },
        title: { type: 'string', doc: 'When declaring: title in the gallery.' },
      },
      examples: ['@video op movies/opening.webm', '@video op kind=opening'],
      declareIf(cmd) { return cmd.args.filter(a => !a.key).length >= 2; },
      declare(cmd, ctx, args) {
        const id = args.pos.id, path = args.pos.path;
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id || '')) { ctx.diags.error('E303', `\`${id}\` is not a valid name.`, cmd.loc); return; }
        ctx.addAsset(id, 'video', path, { loop: args.named.loop, title: args.named.title }, cmd.loc);
      },
      compile(cmd, ctx, args) {
        if (args.pos.path != null) return null; // declaration form
        const r = ctx.checkAsset(args.pos.id, ['video']);
        if (r.error) { ctx.diags.error(r.code || 'E202', r.error, cmd.loc, r.hint); return null; }
        const a = ctx.decls.assets[args.pos.id];
        (a.usedAs = a.usedAs || {})[args.named.kind] = true;
        return { op: 'cmd', name: 'video', args: { id: args.pos.id, kind: args.named.kind, skippable: args.named.skippable } };
      },
      exec(ins, vm) {
        vm.halt({ type: 'video', id: ins.args.id, kind: ins.args.kind, skippable: ins.args.skippable });
      },
    },
  ],
};
