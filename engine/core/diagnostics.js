// Diagnostics: every problem the toolchain finds is reported with a stable
// code, a location, a plain message and (when possible) a concrete fix.
// Codes are documented in Appendix C of SHIORI-Spec.md and by `shiori explain`.

export const CODES = {
  // Syntax
  E100: 'Missing or invalid version line',
  E101: 'Inconsistent indentation',
  E102: 'Unexpected indentation',
  E103: 'Content outside a scene',
  E104: 'Invalid scene line',
  E105: 'Duplicate scene id',
  E106: 'Invalid jump',
  E107: 'Invalid choice line',
  E108: 'Block is empty',
  E109: 'Misplaced @elif or @else',
  E110: 'Unclosed quote or unknown escape',
  E111: 'Invalid command line',
  E112: 'Invalid header line',
  E113: 'Game folder or story file not found',
  E114: 'Unknown speaker',
  E116: 'Module could not be loaded',

  // References
  E200: 'Unknown scene',
  E201: 'Unknown variable',
  E202: 'Unknown asset or character',
  E203: 'Unknown character attribute',
  E204: 'Duplicate declaration',
  E205: 'Wrong kind of asset',
  E206: 'Unknown function',
  E207: 'Unknown ending',
  // Commands
  E300: 'Unknown command',
  E301: 'Missing required argument',
  E302: 'Unknown argument',
  E303: 'Invalid argument value',
  E304: 'Too many arguments',
  E305: 'Declaration not allowed here',
  E306: 'Command needs an indented block',
  // Expressions
  E400: 'Invalid expression',
  E401: 'Assignment used in a condition',
  E402: 'Invalid assignment',
  E403: 'Type mismatch',
  // Markup
  E500: 'Unknown text tag',
  E501: 'Unbalanced text tag',
  E502: 'Invalid text tag value',
  // Warnings
  W600: 'Unreachable scene',
  W601: 'Unused declaration',
  W602: 'Missing asset file',
  W603: 'Scene falls off the end of its file',
  W604: 'Unknown header field',
  W605: 'Story file not included',
  W606: 'Choice has no visible effect',
  W607: 'Very long line',
  W608: 'Possible undeclared speaker',
  W609: 'Missing version line',
  W610: 'Character shown without being declared with a sprite or model',
  W611: 'Ending never reached',
  W612: 'Variable is never read',
  W613: 'Choice text is empty',
  W614: 'Long run of dialogue without narration',
  W615: 'Block terminator not used in Shiori',
  W616: 'Long stretch with no visual change',
  W617: 'Music (LMN) warning',
  W618: 'Camera looks at itself',
  W619: 'Line too long for the textbox',
  W620: 'Ending followed by more story',
  W621: 'Every option in a menu is conditional',
  W622: 'Code after a jump never runs',
  W623: 'Comparison with a true/false value',
  // Runtime
  R700: 'Runtime error',
  R701: 'Assertion failed',
  R702: 'Return without call',
  R703: 'Infinite loop',
  R704: 'Menu with no available options',
  R705: '3D camera arguments over a 2D background',
  R706: 'Unlock exploration was capped',
  // VNDB
  V800: 'VNDB eligibility problem',
  V801: 'VNDB eligibility warning',
};

// What each code means and how to fix it (shown by `shiori explain` and in Appendix C).
export const CODE_HELP = {
  E100: 'game.story must begin with the line `SHIORI 1`. Other files should too.',
  E101: 'A line is indented less than the block it is in, but does not line up with any outer block. Indent every line of a block by the same amount (two spaces is usual). A no-break space (U+00A0) or a full-width space (U+3000) is not indentation, so one before a command, choice, jump or dialogue is also E101: replace it with ordinary spaces.',
  E102: 'Only three things take indented lines: the body of a choice (`* ...`), the body of `@if`/`@elif`/`@else`, and the `key: value` properties of a declaration. Remove the indentation, or put the line under one of those.',
  E103: 'Every story line belongs to a scene. Start one with `# scene_id` at the very start of a line before writing narration or dialogue. Before a file\'s first scene only declarations (`@character`, `@image`, `@var` ...) and `@note` may appear; move any other command below the `# scene_id` line of the scene it belongs to.',
  E104: 'A scene heading is `# id` or `# id "Title"` in column 1. Ids use letters, digits, `_` and `.`.',
  E105: 'Two scenes share an id. Scene ids are global across all files; rename one.',
  E106: 'A jump is `-> scene_id` or `-> END`.',
  E107: 'A choice is `* text`, optionally `* [if cond] text -> scene`. Check the brackets and that the line has text.',
  E108: '`@if`, `@elif` and `@else` need their lines indented underneath them.',
  E109: '`@elif` and `@else` must directly follow an `@if`/`@elif` block at the same indentation.',
  E110: 'A quoted string in a command, a scene title or a `key: value` property has no closing quote, or a backslash before a character that is not an escape. Inside quotes only `\\\\`, `\\"` and `\\\'` are escapes. For a line break, put `{br}` in the dialogue or narration line instead of `\\n`. Type the character itself instead of a `\\u` code (`é`, not `\\u00e9`). Write `\\\\` for a backslash, and use `/` between the folders of a path (`bg/dusk.png`, not `bg\\dusk.png`).',
  E111: 'A command is `@name` then arguments, e.g. `@show mio smile at=left`.',
  E112: 'Header fields (`title: ...`) go at the top of game.story only, after `SHIORI 1` and before the first `@` or `#` line. Check the field\'s value against Appendix B.',
  E113: 'A file the game needs is missing: the game folder does not exist, it has no game.story, or a file listed in `include:` does not exist. Pass the folder that holds game.story (`shiori check games/my-game`), and check the spelling. Paths in `include:` are relative to that folder.',
  E114: 'Dialogue must start with a declared character id (`mio: Hello.`), exactly as declared (ids are case-sensitive and use only ASCII letters, digits and `_`, so `O\'Brien` needs an id like `obrien` with `name="O\'Brien"`). For a one-off speaker write `"Old Man": ...`. If the line is narration that happens to contain `Word:`, start it with `| `.',
  E116: 'A file listed in `modules:` could not be imported, or does not `export default { name, commands: [...] }`.',
  E200: 'A jump, `@call`, `start:` or `visited()` names a scene that does not exist. Check the spelling against the `# id` lines.',
  E201: 'A variable is used before being declared. Add `@var name = 0` (or `= false`, `= ""`) outside any block.',
  E202: 'A name is used that was never declared. Declare images with `@image id path`, music with `@audio id path`, characters with `@character id`.',
  E203: 'An attribute in `mio (smile)` or `@show mio smile` is not in any of the character\'s attribute groups. Add it to a group (e.g. `expression: neutral smile`) or fix the spelling.',
  E204: 'Two declarations share a name. Characters and assets share one namespace; variables, `@position` names and endings each have their own. A position can\'t reuse a built-in name (left, center ...). An ending has one title and one kind: a later `@ending id` may repeat them or leave them out, but not change them.',
  E205: 'The name exists but is the wrong kind (e.g. an audio id used as a background).',
  E206: 'An unknown function is used in a condition. See "Functions" in Appendix B.',
  E207: '`ending_seen("x")` names an ending that no `@ending x` creates.',
  E300: 'Unknown command. `shiori docs` lists them all; common mix-ups: `@goto` → `-> scene`, `@bgm` → `@music`, `@se` → `@sound`.',
  E301: 'A required argument is missing. `shiori docs <command>` shows the usage.',
  E302: 'A named argument (`key=`) that the command does not take. `shiori docs <command>` lists them.',
  E303: 'An argument value has the wrong form (a position, number, color, enum value...). The message says what is expected.',
  E304: 'Too many arguments. Most commands take one main argument plus `key=value` options. (`@filter` takes one filter, and a new one replaces the old. Use `@tint` for an extra wash.)',
  E305: 'Declarations (`@character`, `@image`, `@var` ...) apply to the whole game, so they cannot sit inside a choice or `@if` block. Move them to the top of a file.',
  E306: 'This command needs an indented block of properties under it.',
  E400: 'The condition or value could not be parsed. Use `==` to compare, `and`/`or`/`not` to combine, quotes for strings.',
  E401: 'A single `=` inside a condition. Compare with `==`; assign with `@set`.',
  E402: '`@set` and `@var` need `name = value` (also `+=`, `-=`, `*=`, `/=`). `@var` needs a literal starting value.',
  E403: 'A variable keeps the type of its starting value: a number variable cannot be given text, etc.',
  E500: 'Unknown text tag. Tags: {b} {i} {u} {s} {color=#hex} {size=1.5} {ruby=reading} {shake} {wave} {speed=0.5} {w} {w=0.5} {nw} {br} {$var}. Literal braces are {{ and }}.',
  E501: 'A text tag is not closed, or closed out of order. Close inner tags first: {b}{i}x{/i}{/b}.',
  E502: 'A text tag has a bad value or is in the wrong place, e.g. {color=} without a color, {size=0}, or {b} inside {ruby}. {size=…} and {speed=…} need a plain number above 0 and {w=…} a number of seconds; inside {ruby=…}…{/ruby} put only text and {$name}; {nw} goes at the end of the line.',
  W600: 'No jump, choice or fall-through leads to this scene, so players can never see it.',
  W601: 'Declared but never used. Remove it, or use it.',
  W602: 'A declared file does not exist yet. Normal while art and music are being made; `shiori assets` shows where each is used.',
  W603: 'The last scene of a file has no jump at its end, so the game ends there without an `@ending`. End it with `-> next_scene` or `-> END`.',
  W604: 'Unknown or repeated header field. See "Header fields" in Appendix B.',
  W605: 'A .story file in the game folder is not listed in `include:`, so it is ignored.',
  W606: 'None of the options in this menu does anything different. Fine for flavour; VNDB calls these "fake choices".',
  W607: 'A line over 600 characters will not fit even an NVL page well. Split it.',
  W608: 'This line will be shown as narration, but it looks like dialogue (or a quotation looks like a speaker). Use `"Name": ...` for one-off speakers, or start narration with `| `.',
  W609: 'Story files should start with `SHIORI 1`.',
  W610: 'The character has no sprite, layers or model, so `@show` displays nothing.',
  W611: '`shiori explore` found no route that reaches this ending.',
  W612: 'The variable is set but never read, so it cannot change the story.',
  W613: 'A choice with no text.',
  W614: '30+ lines of dialogue in a row with no narration. Counted along the story\'s flow: different choices and `@if` branches are counted separately, and a run continues through jumps and fall-through. Add narration: gestures, setting, thoughts.',
  W615: '`@end`, `@endif` etc. are not used in Shiori: blocks end where their indentation ends. Delete the line.',
  W616: '30+ ADV lines with no visual change, counted along the story\'s flow (choices and `@if` branches separately, through jumps and fall-through). These reset the count: @scene @bg @show @hide @move @cg @camera @weather @filter @tint @shake @flash @video @mode, a menu, or a dialogue line whose attributes change the expression. NVL lines are not counted.',
  W617: 'A warning or note about a song: from the LMN music compiler, or a .txt song whose first line is not `LMN 1` (add that line, or rename the file to .lmn). LMN notes are shown as info and don\'t fail `--strict`. See engine/vendor/lmn/LMN-Spec.md.',
  W618: '`@camera from=` and `look=` name the same mark, so the camera would look at itself.',
  W619: 'An ADV line over ~280 characters overflows a three-line textbox. Split it, or use `@mode nvl`.',
  W620: 'An `@ending` is followed by a jump back into the story. The ending is recorded and its card shown, then play continues. Add `-> END` if the game should stop there.',
  W621: 'Every option in this menu is conditional. If none is available, the menu is skipped (R704). Add an unconditional option.',
  W622: 'These lines can never run: they come after a `->`, `@jump` or `@return` in the same block, or after a menu or `@if`/`@else` whose every path jumps away. Also reported: a choice\'s `-> target` when the lines under it always jump first, and an `@elif` that repeats an earlier condition. Move the lines above the jump (an `@ending` goes before `-> END`) or delete them. Declarations and `@note` may stand anywhere.',
  W623: '`<`, `<=`, `>` or `>=` has a true/false value on one side. `(1 < x) < 5` compares `1 < x` (true or false) with 5, so it is true for every x above 1. Write a range as `1 < x and x < 5`, and test a true/false value directly (`@if met_rin`, `not met_rin`) or with `==`.',
  R700: 'A problem while the story ran: a division by zero, a jump to a missing scene, a module command whose `exec()` threw, a `@game` result that doesn\'t fit its `into=` variable, and the like. The message says what happened. The player reports it and goes on where it can: a condition that fails counts as false, a failed `@set` keeps the old value, and a failed module command is skipped. In `shiori explore` an error ends its route and is listed under Problems, so fix it first: what comes after it shows as not reached.',
  R701: 'An `@assert` condition was false on this route.',
  R702: '`@return` was reached without an `@call`. Scenes reached by a jump should end with a jump, not `@return`.',
  R703: 'The story ran a long time without stopping for the player: a loop of jumps with no text or choice.',
  R704: 'A menu had no available options and was skipped.',
  R705: '`from=`, `look=`, `fov=` and `orbit=` only apply in 3D worlds.',
  R706: '`shiori explore` replays the story from every different set of endings seen and `@persistent` values a playthrough can end in, but it stops after 16 playthroughs in a row or 64 such sets. Endings, lines and choices that need more playthroughs are then listed as not reached yet, though players may still reach them. If the game needs more playthroughs in a row, raise that limit with `--passes 32`. A `@persistent` value that changes on every playthrough never runs out: raise a counter with `+=` and compare it only with numbers (`@if runs >= 3`), so explore stops counting at the largest one.',
  V800: 'Reserved for the VNDB report. `shiori vndb` shows a guideline the game may not meet as a ⚠ item, with what VNDB looks for and what to change. It is advice: VNDB\'s editors decide.',
  V801: 'Reserved for the VNDB report. `shiori vndb` shows things worth checking as ℹ and ☐ items. It is advice: VNDB\'s editors decide.',
};

export class Diagnostics {
  constructor() { this.list = []; }
  add(severity, code, message, loc, hint) {
    const d = { severity, code, message };
    if (loc) { d.file = loc.file; d.line = loc.line; if (loc.col) d.col = loc.col; if (loc.src != null) d.src = loc.src; }
    if (hint) d.hint = hint;
    this.list.push(d);
    return d;
  }
  error(code, message, loc, hint) { return this.add('error', code, message, loc, hint); }
  warn(code, message, loc, hint) { return this.add('warning', code, message, loc, hint); }
  info(code, message, loc, hint) { return this.add('info', code, message, loc, hint); }
  get errors() { return this.list.filter(d => d.severity === 'error'); }
  get warnings() { return this.list.filter(d => d.severity === 'warning'); }
  hasErrors() { return this.list.some(d => d.severity === 'error'); }
  merge(other) { for (const d of (other.list || other)) this.list.push(d); return this; }
  sorted() {
    const rank = { error: 0, warning: 1, info: 2 };
    return this.list.slice().sort((a, b) =>
      (a.file || '').localeCompare(b.file || '') || (a.line || 0) - (b.line || 0) || rank[a.severity] - rank[b.severity]);
  }
}

// Human-readable rendering, modelled on compiler output:
//   story/ch1.story:12:3: error[E201] Unknown variable `trsut`.
//      12 |   @set trsut += 1
//         |        ^^^^^
//     hint: Did you mean `trust`?
export function formatDiagnostic(d) {
  const where = d.file ? `${d.file}${d.line ? ':' + d.line : ''}${d.col ? ':' + d.col : ''}: ` : '';
  let out = `${where}${d.severity}[${d.code}] ${d.message}`;
  if (d.src != null && d.line) {
    const num = String(d.line);
    out += `\n  ${num} | ${d.src}`;
    if (d.col) out += `\n  ${' '.repeat(num.length)} | ${' '.repeat(Math.max(0, d.col - 1))}^`;
  }
  if (d.hint) out += `\n  hint: ${d.hint}`;
  return out;
}

export function formatAll(list) {
  return list.map(formatDiagnostic).join('\n\n');
}

export function summary(list) {
  const e = list.filter(d => d.severity === 'error').length;
  const w = list.filter(d => d.severity === 'warning').length;
  return `${e} error${e === 1 ? '' : 's'}, ${w} warning${w === 1 ? '' : 's'}`;
}
