// Text presentation: ADV (textbox) and NVL (full-screen pages).

export default {
  name: 'text',
  commands: [
    {
      name: 'mode',
      summary: 'Switch text presentation: `adv` (a textbox at the bottom) or `nvl` (full-screen pages of prose).',
      syntax: '@mode <adv | nvl>',
      positional: [{ name: 'mode', type: 'enum:adv|nvl', required: true, doc: 'adv or nvl' }],
      examples: ['@mode nvl', '@mode adv'],
      exec(ins, vm) {
        const t = vm.state.text;
        if (t.mode === ins.args.mode) return;
        t.mode = ins.args.mode;
        t.page = [];
        vm.emit({ type: 'text', op: 'mode', mode: t.mode });
      },
    },
    {
      name: 'clear',
      summary: 'NVL mode: start a fresh page.',
      syntax: '@clear',
      examples: ['@clear'],
      exec(ins, vm) {
        vm.state.text.page = [];
        vm.emit({ type: 'text', op: 'clear' });
      },
    },
    {
      name: 'textbox',
      summary: 'Hide or show the textbox (it reappears by itself at the next line of text).',
      syntax: '@textbox <hide | show>',
      positional: [{ name: 'state', type: 'enum:hide|show', required: true, doc: 'hide or show' }],
      examples: ['@textbox hide\n@pause'],
      exec(ins, vm) {
        vm.state.stage.textbox = ins.args.state === 'show';
        vm.emit({ type: 'text', op: 'textbox', visible: vm.state.stage.textbox });
      },
    },
  ],
};
