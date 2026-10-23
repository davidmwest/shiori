// Example game module: adds @confetti.
export default {
  name: 'confetti',
  commands: [{
    name: 'confetti',
    summary: 'Throw confetti.',
    syntax: '@confetti [amount=100]',
    named: { amount: { type: 'int', default: 100, doc: 'How many pieces.' } },
    exec(ins, vm) { vm.emit({ type: 'confetti', amount: ins.args.amount }); },
  }],
  // Browser side: how the player shows the effect.
  runtime: { effects: { confetti(effect, player) { player.particles.burst({ count: effect.amount }); } } },
};
