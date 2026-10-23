// Audio: music (with crossfades), ambience loops, sound effects, voices.
// LMN songs (plain-text music) and audio files are both supported.

import { clone } from '../util.js';

export function newAudio() { return { music: null, ambience: null }; }

export default {
  name: 'audio',
  commands: [
    {
      name: 'music',
      summary: 'Play a music track (crossfading from the current one), or `@music stop`.',
      syntax: '@music <audio | stop> [fade=1.5] [volume=1] [loop=true]',
      positional: [{ name: 'track', type: 'asset:audio|stop', required: true, doc: 'A declared @audio, or stop' }],
      named: {
        fade: { type: 'duration', default: 1.5, doc: 'Crossfade seconds.' },
        volume: { type: 'number', default: 1 },
        loop: { type: 'bool', default: true },
      },
      examples: ['@music theme', '@music storm_cue fade=0.5', '@music stop fade=3'],
      compile(cmd, ctx, args) {
        const a = ctx.decls.assets[args.pos.track];
        if (a) (a.usedAs = a.usedAs || {}).music = true;
        return { op: 'cmd', name: 'music', args: { track: args.pos.track, ...args.named } };
      },
      exec(ins, vm) {
        const a = ins.args;
        if (a.track === 'stop') vm.state.audio.music = null;
        else {
          const cur = vm.state.audio.music;
          if (cur && cur.id === a.track) return; // already playing: keep going
          vm.state.audio.music = { id: a.track, volume: a.volume, loop: a.loop };
          vm.persistent.music[a.track] = 1;
          vm.persistentChanged();
        }
        vm.emit({ type: 'audio', op: 'music', music: clone(vm.state.audio.music), fade: a.fade });
      },
    },
    {
      name: 'ambience',
      summary: 'A looping background sound (rain, waves, crowd), separate from music. `@ambience stop` to end it.',
      syntax: '@ambience <audio | stop> [fade=1] [volume=1]',
      positional: [{ name: 'track', type: 'asset:audio|stop', required: true, doc: 'A declared @audio, or stop' }],
      named: { fade: { type: 'duration', default: 1 }, volume: { type: 'number', default: 1 } },
      examples: ['@ambience waves volume=0.6', '@ambience stop fade=2'],
      exec(ins, vm) {
        const a = ins.args;
        vm.state.audio.ambience = a.track === 'stop' ? null : { id: a.track, volume: a.volume };
        vm.emit({ type: 'audio', op: 'ambience', ambience: clone(vm.state.audio.ambience), fade: a.fade });
      },
    },
    {
      name: 'sound',
      summary: 'Play a sound effect once.',
      syntax: '@sound <audio> [volume=1]',
      positional: [{ name: 'sound', type: 'asset:audio', required: true, doc: 'A declared @audio' }],
      named: { volume: { type: 'number', default: 1 } },
      examples: ['@sound door_slam', '@sound bell volume=0.5'],
      exec(ins, vm) { vm.emit({ type: 'audio', op: 'sound', id: ins.args.sound, volume: ins.args.volume }); },
    },
    {
      name: 'voice',
      summary: 'Attach a voice clip to the next line of dialogue.',
      syntax: '@voice <audio>',
      positional: [{ name: 'clip', type: 'asset:audio', required: true, doc: 'A declared @audio' }],
      examples: ['@voice mio_0012\nmio: You came back.'],
      compile(cmd, ctx, args) {
        const a = ctx.decls.assets[args.pos.clip];
        if (a) (a.usedAs = a.usedAs || {}).voice = true;
        return { op: 'cmd', name: 'voice', args: { clip: args.pos.clip } };
      },
      exec(ins, vm) { vm.state.voice = ins.args.clip; },
    },
    {
      name: 'stop',
      summary: 'Stop music, ambience, sounds, or all audio.',
      syntax: '@stop <music | ambience | sound | all> [fade=1]',
      positional: [{ name: 'what', type: 'enum:music|ambience|sound|voice|all', required: true, doc: 'What to stop' }],
      named: { fade: { type: 'duration', default: 1 } },
      examples: ['@stop music fade=3', '@stop all'],
      exec(ins, vm) {
        const w = ins.args.what;
        if (w === 'music' || w === 'all') vm.state.audio.music = null;
        if (w === 'ambience' || w === 'all') vm.state.audio.ambience = null;
        vm.emit({ type: 'audio', op: 'stop', what: w, fade: ins.args.fade });
      },
    },
  ],
};
