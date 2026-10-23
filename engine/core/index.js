// Public entry point of the Shiori core (host-agnostic).

export { parseFile, tokenizeArgs } from './parser.js';
export { compileProject, prepareProject, loadSources, ENTRY, lineText } from './compiler.js';
export { VM, newPersistent } from './vm.js';
export { Registry, POSITIONS, TRANSITIONS, EASES } from './registry.js';
export { defaultRegistry, BUILTIN_MODULES } from './modules/index.js';
export { Diagnostics, CODES, formatDiagnostic, formatAll, summary } from './diagnostics.js';
export { parseExpr, evaluate, FUNCTIONS } from './expr.js';
export { parseMarkup, toRuns, plainText, TAGS } from './markup.js';
export { HEADER_FIELDS, AI_PARTS, PLATFORMS } from './header.js';
export { WEATHER, FILTERS } from './modules/stage.js';

export const ENGINE_NAME = 'Shiori';
export const ENGINE_VERSION = '1.0.0';
