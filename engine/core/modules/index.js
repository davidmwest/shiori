// The built-in modules. Add your own with registry.use(myModule).

import { Registry } from '../registry.js';
import declare from './declare.js';
import story from './story.js';
import stage from './stage.js';
import text from './text.js';
import audio from './audio.js';
import media from './media.js';

export const BUILTIN_MODULES = [declare, story, stage, text, audio, media];

export function defaultRegistry(extra = []) {
  const r = new Registry();
  for (const m of BUILTIN_MODULES) r.use(m);
  for (const m of extra) r.use(m);
  return r;
}
