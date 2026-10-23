# Shiori — a visual novel engine for language models

**Specification v1.0** · story files are plain text (`.story`) · the name means *bookmark* (栞)

Shiori is a visual novel engine whose scripts are designed to be **written by language models** and **read by people**. A game is a folder of plain-text `.story` files plus its art and music. The same files run in the browser player, in a headless command-line player, and in a route explorer that plays every branch for you. The engine checks everything it can before the game runs and explains each problem with a fix, so a model can write, check and repair a whole game on its own.

It does ordinary visual novels very well (ADV and NVL text, sprites with expressions, CGs, choices, saves, rollback, backlog, auto and skip modes, galleries) and adds 3D worlds, plain-text music (LMN), multiple points of view, and an advisory report that reads a game against [VNDB](https://vndb.org/d2)'s inclusion guidelines and drafts its database entry.

**If you are an AI model reading this document:**

- **To write a game:** read Part 1 (quick reference), Part 2 (the rules), Part 3 (writing guide) and the example in Part 5. Then run `shiori check` and fix everything it reports, run `shiori explore` to see every ending, and `shiori vndb` to confirm the game qualifies as a visual novel.
- **To extend the engine** (new commands, effects, gameplay, 3D content): read Part 4 as well.
- Appendix A (commands), B (tables) and C (diagnostic codes) are generated from the engine itself, so they are always exact. `shiori docs <command>` prints the same entry.

## Contents

- Part 1 — Quick reference
- Part 2 — Format specification
- Part 3 — Writing guide for language models
- Part 4 — Engine guide: architecture, modules, runtime
- Part 5 — Complete example game
- Appendix A — Command reference
- Appendix B — Tables (transitions, positions, weather, filters, text tags, functions, header fields)
- Appendix C — Diagnostic codes
- Appendix D — Grammar

## Design principles

1. **One line, one thing.** Every line is a line of narration, a line of dialogue, a command (`@...`), a choice (`* ...`), a jump (`-> ...`) or a scene heading (`# ...`). You can tell which from its first characters.
2. **Plain prose is narration.** A line with no marker is narration. Dialogue is `speaker: text`. This keeps the script readable as a story.
3. **Blocks are indentation**, as in Python or a Markdown list. There is no `end` keyword.
4. **Everything is declared once.** Characters, images, sounds and variables are declared by name; using an undeclared name is an error with a "did you mean" fix, never a silent mistake.
5. **The story is data.** The interpreter owns the whole state (stage, audio, variables). Renderers only draw it. That gives exact saves, rollback, and command-line testing of any route.
6. **2D and 3D share one vocabulary.** `@scene`, `@show`, `@camera` work the same whether the background is a painted image or a 3D world, and whether a character is a sprite or a model.
7. **Visual novel first, not visual novel only.** Text is always shown in ADV (textbox) or NVL (full-screen page) style, and the defaults favour reading. Gameplay modules can do anything; the tools tell you how much of the game they take up, and whether the result still reads like a visual novel is your call.

---

# Part 1 — Quick reference

## A complete small game

A game is a folder with a `game.story` file:

```shiori
SHIORI 1
title: The Lantern Keeper
developer: Example Circle
description: A lighthouse keeper's daughter waits for a boat that is three days late.
ai_generated: none

@character mio
  name: Mio
  color: #f29bb0
  sprite: chars/mio/{expression}.svg
  expression: neutral smile sad blush

@image harbor_dusk bg/harbor_dusk.svg
@audio theme music/theme.lmn title="The Lantern Keeper"
@var trust = 0

# harbor "The Harbor"
@scene harbor_dusk with=fade
@music theme
@weather fireflies layer=back
The tide comes in the colour of weak tea. Mio is already at the end of the pier.
@show mio neutral at=center
mio: You're late.
mio (smile): I saved you the dry end of the bench.

* Sit beside her.
  @set trust += 1
  I sit. The wood is warm from a day of sun.
  mio (blush): ...You actually sat.
* Stay standing. -> standing

The lighthouse turns its slow eye across the water.
-> END

# standing
mio (sad): Suit yourself.
@ending alone "The Dry End of the Bench" kind=bad
-> END
```

Run it:

```bash
shiori check my-game              # every error and warning, with fixes
shiori play my-game --choices 1   # read it in the terminal
shiori explore my-game            # every route, every ending
shiori vndb my-game               # does it qualify for VNDB?
shiori serve my-game              # play it in a browser (Part 4.6)
```

`shiori new games/my-game` starts a new game from a template. Run `shiori` with no arguments for the full list of commands and options.

## Cheat sheet

| You write | It means |
|---|---|
| `SHIORI 1` | Version line. First line of `game.story`. |
| `title: My Game` | Header field (only at the top of `game.story`). |
| `# harbor "The Harbor"` | Start a scene with id `harbor` and an optional title. |
| `The rain stopped.` | Narration. |
| `mio: Hello.` | Dialogue by the declared character `mio`. |
| `mio (smile): Hello.` | Dialogue that also changes her expression. |
| `"Old man": Who's there?` | Dialogue by a one-off speaker. |
| `\| Note: this is narration` | Force narration (when a line would look like something else). |
| `* Stay.` | A choice option. Indented lines under it run when it is picked. |
| `* Leave. -> walk_home` | A choice that jumps to a scene. |
| `* [if trust >= 2] Confess.` | Only offered when the condition is true. |
| `* [require key] Open the door.` | Shown, but locked until the condition is true. |
| `* [once] Ask about the lighthouse.` | Disappears after it has been picked. |
| `-> harbor` / `-> END` | Jump to a scene / end the game. |
| `@var trust = 0` | Declare a variable (with its starting value). |
| `@set trust += 1` | Change a variable. |
| `@if trust >= 2` / `@elif ...` / `@else` | Conditional block (indent the body). |
| `{b}bold{/b} {i}italic{/i} {$name}` | Inline text markup and variables. |
| `{ruby=かんじ}漢字{/ruby}` | Furigana. |
| `{w=0.5}` / `{w}` | Pause typing / wait for a click mid-line. |
| `@scene harbor with=fade` | New scene: background, cleared stage. |
| `@show mio smile at=left` | Show or change a character. |
| `@hide mio` / `@move mio at=right` | Hide / move. |
| `@cg kiss` / `@cg none` | Full-screen event CG. |
| `@music theme` / `@sound door` / `@ambience rain` | Audio. |
| `@weather rain` · `@filter sepia` · `@shake` · `@flash` | Effects. |
| `@camera zoom=1.3 x=0.1 time=2` | Camera (2D pan/zoom, or 3D flight). |
| `@mode nvl` / `@clear` / `@mode adv` | Full-screen prose pages / new page / textbox. |
| `@chapter "Chapter 1"` | Title card. |
| `@ending true_end "Title" kind=true` | Record an ending. |
| `@pov rin` | Narration now follows Rin's point of view. |
| `// comment` | A comment (whole line). |

## The twelve rules that matter most

1. `game.story` starts with `SHIORI 1` and a `title:` line. Other files are listed with `include:`.
2. Every story line belongs to a scene. A scene starts with `# id` at the very start of a line.
3. Declare every character, image, sound and variable you use. Declarations can go anywhere outside choice/`@if` blocks and their order doesn't matter, but the top of a file is clearest. Before a file's first scene, only declarations and `@note` may appear.
4. Dialogue uses the character's **id**, exactly: `mio:`, not `Mio:`.
5. A line that is not a command, choice, jump, scene or dialogue is narration. Write plenty of it (Part 3.2).
6. Choices are consecutive `* ` lines at the same indentation. Their bodies are indented under them.
7. After a choice body ends, the story continues after the whole menu, unless the body jumps.
8. `@if` / `@elif` / `@else` bodies are indented. Never write `@end` or `@endif`.
9. Conditions compare with `==`. `=` only appears in `@var` and `@set`.
10. Attributes in `(...)` and after `@show` must be declared in the character's attribute groups.
11. Every scene path must end: jump with `-> scene` or finish with `-> END`. Mark real endings with `@ending`.
12. Run `shiori check`. It names the line, explains the problem, and almost always says the fix.

---

# Part 2 — Format specification

## 2.1 Files and folders

A game is a folder. Its entry point is always `game.story`.

```
my-game/
  game.story          header, declarations, first scenes
  story/
    ch1.story         more scenes (listed in include:)
    ch2.story
  bg/  chars/  cg/  music/  sfx/  worlds/   (any layout you like)
```

- All paths in a game (`include:`, image files, music) are **relative to the folder that holds `game.story`**.
- Story files are UTF-8 text (a leading byte-order mark is ignored). Line endings may be `\n` or `\r\n`.
- `game.story` must start with the version line `SHIORI 1`. Other `.story` files should start with it too (a warning otherwise).
- List other story files in the header: `include: story/ch1.story story/ch2.story` (several per line, or several `include:` lines). `./story/ch1.story` and `story/ch1.story` are the same file, and a file listed twice is loaded once. `shiori check` warns about `.story` files in the folder that are not included.
- Scene ids, character ids, asset ids and variable names are global across all files.

## 2.2 Lines, comments and indentation

Each line is classified by its first non-space characters:

| Starts with | Line type |
|---|---|
| `//` | Comment (ignored). Comments take a whole line, except after commands, where ` // ...` at the end is also a comment. |
| `#` (at column 1) | Scene heading. |
| `@` | Command. |
| `* ` | Choice option. |
| `->` | Jump. |
| `\|` | Narration, forced. The `\|` and one space are removed. |
| `"Name":` | Dialogue by a one-off speaker. |
| `id:` or `id (attrs):` | Dialogue by a declared character. |
| anything else | Narration. |

Blank lines are ignored everywhere. They never end a block.

**Indentation** creates blocks, and only three things open one:

1. a choice option (`* ...`) — its body;
2. `@if`, `@elif`, `@else` — their bodies;
3. a declaration — its properties (`key: value` lines, see 2.9).

Indent with spaces (two is conventional) or tabs (counted as four). All lines of one block must line up. Any other indentation is an error (E102), including lines indented under any other command (`@set`, `@show`...).

No-break spaces (U+00A0) and full-width spaces (U+3000) are not indentation. One at the start of a command, choice, jump or dialogue line is an error (E101); at the start of narration it is kept as part of the text. The exception is narration right under a choice that has no indented lines: it can only be meant as that choice's lines, so it is E101 too. After the last choice of a menu, a full-width space is read as a paragraph indent, unless the choice above had such a line as well.

## 2.3 Version line and header

`game.story` begins with `SHIORI 1`, then header fields, one per line, until the first `@` or `#` line:

```shiori
SHIORI 1
title: Lanterns Over the Harbor
original_title: 港の灯籠
developer: Circle Name
language: en
description:
  A harbor town, a lighthouse, two sisters and the boat that never came back.
  Indented lines continue a field; a blank line makes a new paragraph.
status: in_development
age_rating: 15
resolution: 1920x1080
ai_generated: story music
include: story/ch1.story story/ch2.story
```

Indented lines continue a field, also after a value on the key line (`include: story/ch1.story` with `story/ch2.story` indented on the next line). Comment lines inside a field are skipped. A header field after the first `@` or `#` line, or in a file other than `game.story`, is an error (E112).

Field names are lowercase. Unknown fields are a warning with a suggestion (W604). The full list, with defaults, is in Appendix B ("Header fields"). The fields that feed the VNDB report are explained in Part 3.2.

## 2.4 Scenes and jumps

```shiori
# harbor_night "The Harbor at Night"
```

- `#`, a space, the scene id, then optionally a title in double quotes, and nothing else: `# harbor bg=dusk` is an error (E104); put `@scene dusk` on the next line. The `#` must be in column 1.
- In the title, as in every quoted command argument (2.9), a backslash escapes only `\"`, `\'` and `\\`. Anything else, such as `\n` or `\u00e9`, is error E110: type the character itself (`é`), and for a line break put `{br}` in a dialogue or narration line.
- Ids use letters, digits, `_` and `.`, and start with a letter or `_`: `ch1.harbor` is fine.
- A scene runs from its heading to the next heading.
- **Jumps:** `-> scene_id` goes to a scene. `-> END`, in capitals, ends the game (back to the title screen). `@jump scene_id` is the same as `->`.
- **Code after a jump never runs:** lines after `->`, `@jump` or `@return` in the same block, and lines after a menu or an `@if`/`@else` whose every path jumps away. `shiori check` warns about them (W622). Declarations and `@note` may stand anywhere. Put an `@ending` above its `-> END`, or it is never recorded.
- **Fall-through:** if a scene ends without a jump, the story continues into the next scene *in the same file*. At the end of a file there is nothing to continue into, so the game ends there; `shiori check` warns (W603). End the last scene of each file with an explicit jump or `-> END`.
- **Calls:** `@call flashback` runs the scene `flashback` until it reaches `@return`, then continues after the `@call`. Use it for scenes reused from several places. A called scene may contain menus and jump to other scenes; whichever reaches `@return` first returns to the caller.
- The game starts at the scene named by the header field `start:`, or else at the first scene in `game.story`.
- `visited("harbor")` in a condition is the number of times the scene has been entered in this playthrough, **including the current visit**: inside `harbor`, it is at least 1. `@if visited("harbor") == 1` means "the first time we are here".

## 2.5 Narration and dialogue

**Narration** is any plain line:

```shiori
Rain needles the harbor. Somewhere a halyard knocks against a mast, patient as a clock.
```

**Dialogue** is a declared character's id, a colon, a space and the text:

```shiori
mio: You're soaked.
mio (smile): Come in before you catch your death.
mio (smile, arms_crossed): Well? In.
```

- The id must be declared with `@character` (2.9) and is case-sensitive.
- Parentheses after the id hold **attributes** (expression, pose, outfit...). They change the character's look from this line on, on stage or not. Separate several with commas or spaces.
- The name shown in the textbox is the character's `name:` (or a name set with `@rename`).

**One-off speakers** have their name in double quotes and no sprite:

```shiori
"Ferryman": Last boat's gone, miss.
```

**Forced narration.** A narration line that happens to look like dialogue (`Note: ...`) or like a command must start with `| `:

```shiori
| Note: the lighthouse has not been lit in nine years.
| # of boats lost that winter: eleven.
```

A line like `Old Man: Who goes there?` (capitalised words before a colon) is shown as narration and gets warning W608, because it was probably meant as dialogue: write `"Old Man": ...` instead.

**Renaming.** `@rename rin "???"` shows "???" for Rin until `@rename rin` restores her name — across scenes, and in saves. Everything that shows her name uses the current one: the name plate, the backlog, and the `@pov` label.

**Unknown speakers.** A single word before the colon (`Mayor: ...`, `Élodie: ...`, `O'Brien: ...`; any letters count, not only ASCII) must be a declared character id, or it is error E114. The hint names the character it most likely means (the same id in other letter case, the display name, or a word of it), or else an id to declare. Ids are ASCII letters, digits and `_`: declare `@character elodie name="Élodie"` and write `elodie: ...`; for `O'Brien:` the hint suggests the id `obrien`. Several capitalised words (`Old Man: ...`, `José Luis: ...`) are taken as narration with warning W608.

W608 also flags other lines that look like dialogue but will be shown as narration: `mio：…` (a full-width colon), `mio:Hi` (no space after the colon), `“Ferryman”: …` (curly quotes), Ren'Py's `mio "Hi"` (any one word, `Élodie "Bonjour."` too), and a short Chinese, Japanese, Korean or Thai name before the colon (`ミオ: …`). Ordinary prose has the first two shapes too, so they get W608 only when the word is a lowercase id (`mio`), the id or display name of a character declared in the same file (`Mio:Hi`, `Élodie:Bonjour.`), or, before `：`, a name written in kana (`ミオ：…`). `Note:the tide is in.`, `Re:Zero`, `C:\Windows` and `時刻：午後三時。` stay plain narration. The hint gives the line with the character's id.

**Point of view.** `@pov rin` marks the following narration as seen through Rin's eyes; the player shows her current name (after any `@rename`) and color on narration, and the backlog records it. `@pov none` clears it. It lasts until changed — `@scene` does not reset it. Use it when the narrator changes (Part 3.3).

**Each line is one click.** Long paragraphs are fine in NVL mode; in ADV mode keep a line to what fits the textbox (about 3 lines, ~250 characters). `shiori check` warns about ADV lines over 280 characters (W619) and any line over 600 (W607).

## 2.6 Text markup

Inside narration, dialogue and choice text:

| Markup | Effect |
|---|---|
| `{b}…{/b}` `{i}…{/i}` `{u}…{/u}` `{s}…{/s}` | Bold, italic, underline, strikethrough. |
| `{color=#ff6688}…{/color}` | Color. |
| `{size=1.5}…{/size}` | Relative size. |
| `{ruby=かんじ}漢字{/ruby}` | Reading (furigana) above the text. |
| `{shake}…{/shake}` `{wave}…{/wave}` | Animated letters. |
| `{speed=0.3}…{/speed}` | Type this part slower (or faster, > 1). |
| `{w=0.8}` | Pause typing for 0.8 s. |
| `{w}` | Wait for a click, then continue in the same textbox. |
| `{nw}` | At the end of a line: continue to the next line without a click. |
| `{br}` | Line break. |
| `{$name}` | The value of a variable. |
| `{{` and `}}` | Literal braces. |

Tags must be closed in order: `{b}{i}x{/i}{/b}`. The same tag may be nested; closing the inner one restores the outer value (in `{color=#ff6688}a {color=#ffffff}b{/color} c{/color}`, `c` is pink again). Unknown tags are errors with a suggestion (E500).

Breaking any of these rules is error E502:

- `{size=…}` and `{speed=…}` need a plain number above 0; `{w=…}` a plain number of seconds, 0 or more.
- Inside `{ruby=…}…{/ruby}` put only text and `{$name}`. Put other tags around the whole ruby: `{b}{ruby=かんじ}漢字{/ruby}{/b}`.
- `{nw}` must end the line.

## 2.7 Choices

A **menu** is a run of `* ` lines at the same indentation. Each option's indented lines run when it is picked:

```shiori
mio: Will you stay for supper?
* Stay.
  @set trust += 1
  mio (smile): Good. I made too much anyway.
* Make an excuse.
  mio (sad): ...Another time, then.
* Leave without a word. -> walk_home

We sit, or we don't. Either way the kettle sings.
```

- The line before the menu stays on screen as the prompt.
- After an option's body, the story continues **after the whole menu** (the "gather" point), unless the body jumps.
- An option with `-> scene` at the end of its line jumps there after its body (or straight away if it has none).
- An option with no body and no jump just continues after the menu (a flavour choice).

**Option modifiers** go in square brackets at the start of the option text:

| Modifier | Meaning |
|---|---|
| `[if condition]` | Only offered when the condition is true. |
| `[require condition]` | Always shown, but locked (greyed out) until the condition is true. Add a hint in quotes to tell the player how to unlock it: `[require endings_seen() >= 1 "Unlocks after any ending"]`. The last quoted string is the hint only when the text before it is already a complete condition, so `[require route == "rin"]` compares with `"rin"`. In the hint, as in a quoted argument (2.9), `\"`, `\'` and `\\` are escapes and any other is E110. |
| `[once]` | Hidden after it has been picked once in this playthrough. |

They combine: `* [once] [if met_rin] Ask about Rin.`

**Hub menus** (ask several questions in any order) are a scene that jumps back to itself, with `[once]` options and a way out. Use `visited()` so the prompt changes after the first time:

```shiori
# ask_mio
@if visited("ask_mio") == 1
  mio: What do you want to know?
@else
  mio: Anything else?
* [once] The lighthouse?
  mio: Dad kept it. Then he didn't.
  -> ask_mio
* [once] The boat?
  mio: Don't.
  -> ask_mio
* That's all. -> evening
```

If every option is hidden or locked, the menu is skipped with runtime warning R704 and the story continues after it, so always keep one unconditional option.

**Choice numbers** in the tools (`shiori play --choices`, `shiori explore` routes) are each option's position as written in the script (1 = the first `*` line of the menu), not its position among the options currently visible. If options 1–4 are `[once]` questions already asked, "Say goodbye" is still `5`. `shiori play` prints every option with its number, marking hidden ones as "already picked" or "hidden: [if …]". (In the browser player, the 1–9 keys pick the *visible* options in order, as players expect.)

## 2.8 Variables and conditions

```shiori
@var trust = 0                // number
@var met_rin = false          // true/false
@var nickname = "Lighthouse"  // string
@persistent saw_true_end = false   // survives across playthroughs
```

- `@var` declares a story variable. It resets on New Game. `@persistent` declares one that keeps its value across all playthroughs and saves (for unlocks).
- The starting value must be a literal. Its type is fixed: `@set` must assign the same type (E403). A declaration whose value has an error still declares the name, so only that line is reported, not every use.
- `@set name = value`, `+=`, `-=`, `*=`, `/=` (and `+=` appends to strings).

**Conditions** (in `@if`, `@elif`, `[if ...]`, `[require ...]`, `@assert`):

| Operators | |
|---|---|
| `==` `!=` `<` `<=` `>` `>=` | Compare. |
| `and` `or` `not` (also `&&` `\|\|` `!`) | Combine. |
| `+` `-` `*` `/` `%` `( )` | Arithmetic (`+` also joins strings). |
| `"text"`, `12`, `true`, `false` | Literals. |

Comparisons don't chain: write `1 < x and x < 5`, not `1 < x < 5` (E400). `=>` and `=<` are not operators: write `>=` and `<=` (E400). Comparing a true/false value with `<`, `<=`, `>` or `>=`, as in `(1 < x) < 5`, is warning W623. In a string in a condition or value, a backslash escapes only `\"`, `\'` and `\\`; any other, such as `\n`, is an error (E400). For a line break, put `{br}` in the text line. Quoted command arguments follow the same rule, with error E110 (2.9).

Functions: `visited("scene")`, `ending_seen("id")`, `endings_seen()`, `random(1, 6)`, `chance(0.3)`, `min`, `max`, `clamp`, `abs`, `floor`, `ceil`, `round`, `len`, `upper`, `lower` (Appendix B). Random numbers come from a seed stored in the save, so they are reproducible on load and in `shiori play --seed`.

```shiori
@if trust >= 3 and met_rin
  mio (blush): ...Fine. I'll tell you.
@elif trust >= 1
  mio: Maybe tomorrow.
@else
  mio: No.
```

An `@elif` that tests the same condition as an earlier branch of its `@if` never runs (W622). Conditions with `random()` or `chance()` are not reported, because they roll again.

Variables appear in text as `{$nickname}`. `@assert trust >= 0` checks an invariant: `shiori explore` reports every route where an assertion fails. A message in quotes may follow the condition: `@assert ran_to == "hinata" or ran_to == "suzu" "ran_to must be set before the finale"` (a trailing quoted string is the message only when the text before it is already a complete condition, so `@assert route == "rin"` compares with `"rin"`). The message is a quoted argument (2.9): `\"` puts a quote in it, and an escape other than `\"`, `\'` or `\\` is E110.

## 2.9 Declarations

Declarations are compile-time: they apply to the whole game wherever they appear (but not inside choice or `@if` blocks, E305). Only declarations and `@note` may come before a file's first `# scene_id`; any other command there is an error (E103; an unknown one, E300). Any declaration except `@var` and `@persistent` may take its properties inline (`key=value`) or as an indented block of `key: value` lines (`@video` only in its declaring form, `@video id path`).

**Quoted values.** A command argument with spaces goes in quotes: `title="Lanterns (Main Theme)"`. In a property block quotes are optional: `name: Mio Tanaka` and `name: "Mio Tanaka"` are the same. Inside quotes a backslash escapes only `\"`, `\'` and `\\`, in command arguments, scene titles and quoted property values alike (strings in conditions follow the same rule, 2.8). Anything else, such as `\n` or `\u00e9`, is error E110. Write `\\` for a backslash, `/` between the folders of a path (`bg/dusk.png`, not `bg\dusk.png`), and type any other character as itself.

### Characters

```shiori
@character mio
  name: Mio
  color: #f29bb0
  sprite: chars/mio/{pose}_{expression}.png
  expression: neutral smile sad angry blush surprised
  pose: stand arms_crossed
  blink: chars/mio/blink_{pose}.png
  mouth: chars/mio/mouth_{pose}.png
  role: main
  description: The lighthouse keeper's younger daughter.
```

- `name`, `color` (name-plate color).
- **Attribute groups.** Every key that is not a known property is an attribute group: `expression: neutral smile sad` declares the group `expression` with three values; the first is the default. Attribute names must be unique across a character's groups. A misspelt property given a single value or free text (`nmae: Mio Tanaka`) is error E302, not a new group.
- **Images.** `sprite:` is a path template; `{group}` is replaced by the current value of that group. `sprite: chars/mio/{pose}_{expression}.png` needs one file per combination. For layered art, use several `layer:` lines instead (drawn bottom to top), each with its own placeholders:

  ```shiori
    layer: chars/mio/body_{pose}.png
    layer: chars/mio/face_{expression}.png
  ```

- `blink:` — an overlay drawn for a moment every few seconds (eyes closed). `mouth:` — an overlay toggled while the character's line is typing (mouth open). Both are optional. `sprite:`, `layer:`, `side:`, `blink:` and `mouth:` all accept `{group}` placeholders.
- `side:` — a side portrait shown next to the textbox when the character speaks.
- `model:` — a 3D model for 3D worlds (`.glb`, `.gltf`, `.vrm`, or a `.js` module; 2.11). A character may have both a sprite and a model; the stage picks the right one.
- `scale:`, `y:` — size and vertical offset of the sprite.
- **VNDB character sheet** (used by `shiori vndb`): `role` (`protagonist`, `main`, `side`, `appears`), `gender` (`female`, `male`, `nonbinary`, `unknown`; VNDB's `f`, `m`, `nb` also work), `age`, `description`, `cv` (voice actor), `original_name`.

### Assets

```shiori
@image harbor_dusk bg/harbor_dusk.png
@image cg_lanterns cg/lanterns.png title="Lantern Night"
@audio theme music/theme.lmn title="Lanterns (Main Theme)"
@audio waves sfx/waves.ogg volume=0.6
@video op movies/opening.webm
@world lighthouse worlds/lighthouse.js marks="door lamp cliff sea"
@model boat models/boat.glb
@gameplay cards games/cards.js minutes=3 results="win lose"
@position doorway x=0.82 scale=0.8
```

- One namespace holds characters and assets, so ids must be unique among them. `all`, `none`, `stop`, `black`, `white`, `cg` are reserved.
- `@position` names are their own namespace. Each is declared once and can't reuse a built-in position name such as `left` (E204).
- Images: SVG, PNG, JPG, WebP, GIF, AVIF. A background image is scaled to cover the screen (`fit=contain` or `fit=none` to change that). An image shown with `@show` is a prop, positioned like a character.
- Audio: OGG, MP3, WAV, M4A, or an **LMN song** (`.lmn`, or `.txt` whose first line is `LMN 1`): plain-text music that the player synthesises live (2.13).
- `@video id path` declares; `@video id` plays.
- `@world`, `@model`: 2.11. `@gameplay`: 2.14.
- `shiori check` reports missing files, including every file a sprite template needs (W602).

## 2.10 The stage

The stage has a background, characters and props, an optional full-screen CG on top, a camera, weather, a color filter and a tint.

| Command | Does | Waits? |
|---|---|---|
| `@scene bg` | New background **and a clean stage**: removes characters, CG, weather, filter, tint, camera moves. `bg` is an image, a 3D world, `black`, `white` or `#rrggbb`. Default `with=fade time=1`. | yes |
| `@bg bg` | Changes only the background. Default `with=dissolve time=0.8`. | yes |
| `@show who attrs… at=…` | Shows a character or prop, or changes one already shown (attributes, position, `flip=`, `scale=`, `y=`, `z=`). Default `with=dissolve time=0.4`. | no |
| `@hide who` / `@hide all` | Removes from the stage. | no |
| `@move who at=… time=…` | Slides to a new position/height/size (`ease=`). | no |
| `@cg image` / `@cg none` | Shows / closes a full-screen event CG (and unlocks it in the gallery). | yes |
| `@camera zoom= x= y= rotate= time=` | 2D: zoom and pan the stage. `@camera reset`. | no |
| `@shake` `@flash` | Screen shake / color flash. | no |
| `@weather rain …` | Animated effects: rain, storm, snow, petals, leaves, fireflies, stars, dust, embers, fog, bubbles. `layer=back` puts them behind characters. | no |
| `@filter sepia` | Grade the whole picture: sepia, grayscale, night, dusk, dream, blur, vignette, invert, noir, none. | no |
| `@tint #ff8844 alpha=0.3` | Color wash; `@tint none`. | no |

- **Waiting.** "Waits" means the next line appears only after the transition finishes. Override with `wait=true` or `wait=false`. The player can click to finish any transition early.
- **`@show` vs `@move`.** `@show` on someone already on stage changes her attributes with a quick dissolve and repositions her in that time; `@move` slides her over `time=` with `ease=`.
- **Filters don't stack.** A new `@filter` replaces the current one (`@filter none` clears it). For an extra colour wash on top, use `@tint`.
- **`@camera` keeps what you leave out.** Each `@camera` changes only the arguments you give; `@camera reset` returns to zoom 1, no pan and no 3D marks (in a 3D world, to the world's `camera=` mark). `from=`, `look=`, `fov=` and `orbit=` only apply in 3D worlds (runtime warning R705 otherwise).
- **Positions** (`at=`): `farleft` `left` `midleft` `center` `midright` `right` `farright` (and `offleft`/`offright` for entering from off-screen), a number from 0 (left edge) to 1 (right edge), a percentage (`40%`), or a name declared with `@position`, which also applies its `y=` and `scale=` (the other forms set only the horizontal position). If `at=` is omitted, a new character takes the first free spot of center, left, right, farleft, farright.
- **Attributes are remembered.** A character keeps her last attributes when hidden and shown again, across scenes — including attributes given on dialogue lines while she was off stage (`nagi (surprised): ...` with no sprite shown still sets her expression for the next `@show`). Give attributes on every `@show` when it matters.
- **What `@scene` resets:** background, characters, CG, weather, filter, tint and camera. It does **not** change music, text mode (ADV/NVL), `@pov`, `@rename`d names or variables.
- **Transitions** (`with=`): `none` `fade` `fade_white` `dissolve` `flash` `wipe_left` `wipe_right` `wipe_up` `wipe_down` `iris_in` `iris_out` `slide_left` `slide_right` `slide_up` `slide_down` `pixelate` `blinds`. Times are seconds (`time=1.5`) or milliseconds (`time=300ms`).
- **Liveliness.** Characters breathe slightly, blink and move their mouths if those overlays exist, and the speaker can be highlighted (header `dim_inactive:`). Change attributes often: a new expression on a line costs nothing.

## 2.11 3D worlds

A background can be a real-time 3D world instead of a picture:

```shiori
@world lighthouse worlds/lighthouse.js marks="door lamp cliff sea" camera=cliff
@scene lighthouse
@camera from=cliff look=lamp time=4 wait=true
@show mio smile at=left            // 2D sprite in front of the 3D world
@show boat at=sea                   // a 3D prop placed at a mark
```

- A world is a `.glb`/`.gltf` file, or a JavaScript module that builds the scene with three.js (Part 4.4). Worlds move: water, particles and lights animate on their own.
- **Marks** are named places in a world (empties named `mark_<name>` in a glTF file, or names a module defines). List them with `marks="..."` so `shiori check` can catch typos; then use them in `at=`, and in `@camera from=` (where the camera stands) and `look=` (what it looks at).
- `camera=` on `@world` names the mark the camera starts at, and must be one of its `marks=` (E303). `@scene` and `@bg` into a world start there, and `@camera reset` goes back to it. `@bg` from a world to a 2D background resets the camera.
- `@camera` in 3D: `from=`, `look=`, `fov=`, `zoom=`, `orbit=degrees`, `time=`, `ease=`.
  - `from=mark` moves the camera to that mark; with no `look=`, it looks where the mark itself faces (its default `look`).
  - `look=mark` (or a character id shown in 3D) turns the camera to face it, from wherever it stands.
  - `orbit=40` circles 40° around the current look target during the move; it combines with `from=` and `look=`.
  - `from=` and `look=` naming the same mark is warning W618 (the camera would look at itself).
- **Characters in 3D.** A character with a `model:` appears as a 3D model; its attributes become model expressions (VRM expressions such as happy, sad, angry, surprised, relaxed are mapped from common attribute names). A character with only a sprite is drawn as a 2D sprite over the 3D world, exactly as over a painted background.
- `@model` props appear with `@show` at a mark.
- 3D needs WebGL; the player loads three.js only when a game uses a world.

## 2.12 Text presentation: ADV and NVL

- **ADV** (default): a textbox at the bottom with a name plate. One line per click.
- **NVL**: `@mode nvl` fills the screen with a page of prose; each line adds a paragraph. `@clear` starts a new page (the player also turns the page by itself when it is full). `@mode adv` returns to the textbox.
- `@textbox hide` hides the textbox — and the NVL page, if one is showing — to let a CG breathe (with `@pause`); it comes back at the next line.
- The NVL page is a dark translucent panel over the stage: characters and backgrounds stay faintly visible behind it.
- Header `dialogue_quotes: “”` wraps dialogue in those quote marks (use `「」` for Japanese style).

## 2.13 Audio

```shiori
@music theme fade=2          // crossfades from the current track; same track = keeps playing
@music stop fade=3
@ambience rain volume=0.5    // a second loop, independent of music
@sound door_slam
@voice mio_0012              // attaches to the next dialogue line
mio: You came back.
@stop all
```

`@music` with the track that is already playing keeps it playing and applies only the `volume=` and `loop=` written on that line: `@music theme volume=0.4 fade=3` lowers it over 3 seconds, and a bare `@music theme` leaves the volume as it was.

**LMN music.** An `@audio` whose file is an LMN song (`.lmn`, or a `.txt` starting with `LMN 1`) is synthesised live by the player: strings, piano, harp, brass, drums and sung lyrics, with no audio files. Language models can write LMN directly; see `LMN-Spec.md`. Leitmotifs are easy: write a character's theme once and re-arrange it for each mood.

## 2.14 Chapters, endings, input, waits, gameplay, video

```shiori
@chapter "Chapter 2 — Salt" subtitle="Rin"
@ending lanterns_home "Lanterns Home" kind=true
@input player_name "What should Mio call you?" default="Aoi"
@wait 1.5
@pause
@video op kind=opening
@game cards into=card_result difficulty=2
```

- `@chapter` shows a title card and names save files.
- `@ending id "Title" kind=…` records the ending **when it is reached** (permanently: `ending_seen("id")` becomes true in every later playthrough) and shows an ending card. Then the story simply continues: follow it with an epilogue or credits and `-> END`. If it jumps back into the story (for example `-> hub`), `shiori check` warns (W620) in case that was a slip. Kinds: `true`, `good`, `normal`, `bad`, `joke`. An ending has one title and one kind: a later `@ending` with the same id may repeat them or leave them out (`@ending lanterns_home`), but a different title or kind is an error (E204). Ending ids are their own namespace (they may share names with scenes). A kinetic novel can still mark its single ending (`kind=normal` or `true`) so it shows in the endings list.
- `@input` asks for text (a string variable).
- `@wait` pauses for seconds; `@pause` waits for a click.
- `@video` plays a declared video. `kind=opening|ending` are not counted as "cutscenes" by VNDB.
- `@game` runs a gameplay module and stores its result in the `into=` variable, converted to that variable's type: a string variable gets the text (`@var r = ""`; test it with `@if r == "win"`), a number variable a number, a true/false variable `true` or `false`. A result that doesn't fit is reported (R700) and leaves the variable unchanged. Declare the module's typical length with `@gameplay … minutes=` (the VNDB report compares it with reading time) and its possible results with `results=` so `shiori explore` tries each one; replay a specific result with `shiori play --game id=result`. The module itself is a small JavaScript file (Part 4.5); `shiori check` confirms it exports a `play()` function.

## 2.15 Errors and robustness

- `shiori check` (and the player's developer overlay) report every problem with file, line, column, a code, the source line and usually a fix. Errors stop the game from running; warnings don't.
- Saves store a stable position (scene, line or menu id, and the nearest line before it), so a save made before you edit the script still loads afterwards: at the same line, menu or command if it can still be found (an edited line is found in its place), otherwise at the start of its scene. A save made at `@input`, `@game`, `@pause`, `@wait`, `@video`, `@chapter` or `@ending` shows it again on load.
- At runtime the player never crashes on a story problem: a bad jump or failed assertion is logged and shown in developer mode, and the story continues where possible. A condition that can't be evaluated (for example, division by zero) is reported (R700) and counts as false: `@if` moves on to its `@elif` or `@else`, an option's `[if]` hides it and its `[require]` locks it. A module command whose `exec()` throws is reported (R700, naming the module and the command) and skipped.

---

# Part 3 — Writing guide for language models

## 3.1 Workflow

1. **Plan** the cast (ids, names, colors, attribute groups), the scenes (ids and one-line summaries), the variables, and the endings. Write the declarations first.
2. **Write** scene by scene. Keep each file to a chapter or a route; list files in `include:`.
3. **Check:** `shiori check`. Fix every error; read every warning. Repeat until clean. It also warns about scenes that no jump, choice or fall-through leads to (W600) and lines after a jump that can never run (W622).
4. **Explore:** `shiori explore`. It plays every combination of choices, `@game` results, `@input` answers (the default and, when a condition tests the answer, the strings it is compared with and a sample name) and `random()`/`chance()` outcomes. Games whose conditions use `ending_seen()`, `endings_seen()` or a `@persistent` variable are played again from every different set of endings and persistent values a playthrough can end in, up to 16 playthroughs in a row and 64 different sets; past that it stops replaying and says so (R706). If your unlocks need more playthroughs in a row, raise the first limit with `--passes 32`. Make sure every ending is reachable, no route ends without an `@ending` (unless the game is a kinetic novel), there are no runtime errors, no condition is "always true" by mistake, and no lines are unreachable by accident. A route stops at its first runtime error (R700), so fix those first: whatever comes after one shows as not reached. Under Coverage it also lists each choice that is never offered (its `[if]` is never true) and each one that is never unlocked (its `[require]` is false on every route). Each ending comes with a checked, ready-made `shiori play` command that replays it (with `--seen` for unlocks, `--set` for `@persistent` values, `--game` for gameplay results, `--rolls` for random outcomes, and typed answers in `--choices`). Big hub menus and loops multiply routes; if it says STOPPED EARLY, raise `--max-states` (default 250000). After STOPPED EARLY or R706, "not reached" only means "not reached yet".
5. **Read** a route with `shiori play --choices 1,2,1` (or `--from scene`, `--set trust=3`, `--seen a,b` — each id counts toward `endings_seen()`; `--set` also sets `@persistent` variables). At an `@input`, the next `--choices` entry is typed as the answer if it isn't a number (`--choices 1,Aoi,2`); otherwise the default is used. Reading your own transcript catches continuity and pacing problems that no checker can — especially inside `@if` branches you didn't take. When it stops at a choice, it prints the exact command to continue. Repeating a list flag adds to it (`--seen a --seen b`).
6. **VNDB (if you want an entry):** `shiori vndb` reads the game against VNDB's guidelines and drafts the entry. It is advice, not a gate: VNDB's editors judge each game as a whole, and whether your game should be a visual novel at all is your decision.
7. **Look:** `shiori serve` and open the printed URL (Part 4.6). `player.html?game=…&scene=…&dev=1` jumps straight to a scene with the developer panel; with live reload on, saving a `.story` file updates the running game at the same line.

`shiori check` also warns about things readers notice: 30+ lines in a row with no visual change at all (W616), 30+ lines of dialogue with no narration (W614), and ADV lines too long for the textbox (W619). Both runs are counted along the story's flow: each choice and `@if` branch separately, and on through jumps and fall-through. While art and music don't exist yet, it groups the "file not found" warnings into one line; `shiori check --assets` lists them, and `shiori assets` shows where every file is used (with the filter and weather around it) and which expressions each character actually uses. Add `desc="..."` to any `@image`, `@audio`, `@world`… declaration to keep the brief for the artist or composer next to it.

`shiori stats --by-scene` gives word counts per scene, for trimming to a length.

## 3.2 Writing a game VNDB will list

This only matters if you want the game on VNDB. Shiori will happily build things that aren't visual novels; complying is the author's responsibility, and VNDB's editors decide by looking at the whole game. `shiori vndb` is a second pair of eyes, not a judge.

VNDB ([vndb.org/d2](https://vndb.org/d2), section 1) lists a game in one of two ways:

1. **A visual novel:** choices are the only interaction (optional), with no other gameplay. Mini-games or map movement are allowed only if they play a very minimal role: at least 99% of the game is pure reading. The story is told with a known presentation (ADV, NVL or a variation).
2. **A VN / game hybrid:** at least 50% is pure VN-style reading, the story consistently uses *novel narrative* (narration of what is seen, done and thought — dialogue alone, however much, does not count), and reading segments run for a long time without frequent prompts to interact.

VNDB has removed games for having no narration at all (Persona 3/4, Ghost Trick, To The Moon, 13 Sentinels). So:

- **Narrate.** Describe places, actions, gestures, sounds and inner thoughts in plain lines. Visual novels commonly run 30–70% narration by words; `shiori stats` shows yours. VNDB gives no number: the report's notes at 15% and 5% are Shiori's rules of thumb. There is no upper limit; above ~70%, just check that conversations still read as conversations.
- **Choices are the classic interaction.** `@input` (e.g. a name) is fine. If you add `@game` modules, be honest about `minutes=`: the report compares gameplay time with reading time against VNDB's 99% (pure VN) and 50% (hybrid) guidelines.
- **Hidden stats are fine; visible stat-raising is gameplay.** Affection variables that steer routes are normal. A raising-sim screen is not a visual novel.
- **Shiori's text is always ADV or NVL**, which VNDB recognises. Mixing both is fine (tag "ADV/NVL Mixing").
- **Disclose AI content honestly.** VNDB accepts AI-made games and tags them (AI-generated Story, Music, Sprites, Backgrounds, CGs, Voice Acting, Assets). Fill the header field `ai_generated:` (for example `ai_generated: story music`); `shiori vndb` turns it into the right tags, and `translation` sets the release's machine-translation flag.
- **Fill the header** so the report can draft your entry: `title`, `original_title`, `developer`, `description`, `language`, `status`, `release_type`, `release_date`, `age_rating`, `ero`, `freeware`, `platforms`. Give characters `role`, `gender`, `age`, `description`.
- VNDB's **length** is the time to finish all endings; the report estimates it from your word count at `reading_speed:` words per minute (Very short < 2 h, Short 2–10 h, Medium 10–30 h, Long 30–50 h, Very long > 50 h). Words are counted by spaces in any script, Korean included; each Han or kana character counts as half a word, and Thai, Lao, Khmer or Myanmar text as about one word per 4 letters.
- Release flags the report fills in for you: resolution, voiced (from `@voice` coverage per character, not counting the protagonist and minor speakers, as VNDB does), animation (VNDB does **not** count zooms, shakes or sprite movement as animation; lip/eye movement and background effects are separate checkboxes), engine name ("Shiori").

## 3.3 Craft

**Narration carries the novel.** Use it for the senses, for gesture between lines of dialogue, and for the narrator's thoughts. Alternate: a line of dialogue, a beat of narration, dialogue.

**Every line can move the picture.** Change expressions with `mio (sad):` as feelings change; move people with `@move`; use `@camera` for emphasis, `@weather` and `@filter` for mood, `@cg` for the big moments. Readers notice static sprites and long text dumps over one background.

**Make choices matter, and let them cost something.** A choice should change a variable, a relationship, a scene or an ending, and a big reveal should change what happens next, at least for a while. Use `[require …]` to show the player a door they can't yet open; use `@persistent` and `ending_seen()` to change later playthroughs.

**Escalate.** Each chapter should raise the stakes of the last. Plant details early that mean something different on a second read.

**Several points of view.** Use `@pov` when narration moves to another character's eyes, and `@chapter` cards to mark the change. Let other characters have goals that exist without the protagonist.

**Endings** should fit the themes. Mark each with `@ending`, give it a title, and choose its `kind`. A `true` ending that unlocks after others (`* [if endings_seen() >= 2] ...`) rewards replaying.

**Music** sets the scene before a word is read: start each scene's cue with `@music`, keep ambience separate, and save silence (`@music stop fade=3`) for when it hurts most.

**NVL** suits introspection, flashbacks and dense prose; **ADV** suits conversation. Switching between them is a strong signal; use it on purpose.

## 3.4 Common mistakes

| Wrong | Right | Why |
|---|---|---|
| `Mio: Hello.` | `mio: Hello.` | Speakers are character ids (E114). |
| `Old Man: Hi.` | `"Old Man": Hi.` | One-off speakers need quotes (W608). |
| `mio：Hello.` | `mio: Hello.` | An ASCII colon and a space (W608). |
| `@if trust = 2` | `@if trust == 2` | `=` assigns (E401). |
| `@if 0 <= trust <= 3` | `@if 0 <= trust and trust <= 3` | Comparisons don't chain (E400). |
| `@set trust == 2` | `@set trust = 2` | `==` compares (E402). |
| `@set trust++` | `@set trust += 1` | No `++` (E402). |
| `@endif` / `@end` | *(delete it)* | Blocks end by indentation (W615). |
| `@goto harbor` / `@jump_to harbor` | `-> harbor` | (E300) |
| `-> end` | `-> END` | `END` is in capitals (E200). |
| `@menu` + `@option` | `* option` lines | Choices are `*` lines. |
| `@show Mio happy` | `@show mio smile` | Ids and attributes as declared (E202, E203). |
| `@scene harbor` before `@image harbor ...` exists | declare first | (E202) |
| Choice body not indented | indent it under `*` | Otherwise it runs after the menu. |
| `@var trust` | `@var trust = 0` | Needs a starting value (E402). |
| `visited(harbor)` | `visited("harbor")` | Scene ids are strings there. |
| `{bold}x{/bold}` | `{b}x{/b}` | (E500) |
| A scene that just stops at the end of a file | end it with `-> next` or `-> END` | (W603) |
| A menu where every option has `[if ...]` | add one unconditional option | (R704) |
| Dialogue-only scenes | add narration | VNDB (Part 3.2). |

## 3.5 Final checklist

- [ ] `shiori check` shows 0 errors, and every warning is understood.
- [ ] `shiori explore` reaches every ending, with no runtime errors or failed assertions, and no route ends without an `@ending` (unless kinetic).
- [ ] If you want a VNDB entry: `shiori vndb` reads it as a visual novel (or a hybrid you meant), and its draft entry is filled in.
- [ ] Narration is at least ~30% of the words; no long stretches of dialogue without it.
- [ ] Expressions change with the emotion of the lines; every scene has a background and, usually, music.
- [ ] Every choice changes something.
- [ ] The header is filled in, including `description:` and `ai_generated:`.
- [ ] You read at least one full route with `shiori play`.

---

# Part 4 — Engine guide: architecture, modules, runtime

## 4.1 Architecture

```
            .story files ──► parser ──► compiler ──► Program (instructions, tables)
                                ▲           │
             registry of commands (modules) │
                                            ▼
   browser player ◄── effects + halts ── VM (state: stage, audio, variables, history)
   (2D canvas, 3D layer, UI, audio)            ▲
   CLI: check · play · explore · stats · vndb ─┘
```

- **engine/core/** — host-agnostic JavaScript (ES modules, no dependencies): `parser.js`, `compiler.js`, `vm.js`, `registry.js` + `modules/` (every built-in command), `expr.js` (conditions), `markup.js` (text tags), `analyze.js`, `explore.js`, `vndb.js`, `docs.js`, `diagnostics.js`. Runs in browsers, Node.js and JavaScriptCore.
- **engine/runtime/** — the browser player: stage compositor (Canvas 2D), 3D layer (three.js, loaded on demand), UI (textbox, NVL page, choices, backlog, saves, settings, gallery, music room, title screen), audio mixer (Web Audio, LMN synthesis), input, storage, developer overlay.
- **tools/** — the CLI (`bin/shiori`). **tests/** — the engine's test suite (`shiori selftest`).

## 4.2 The VM protocol

The VM runs the program until the player is needed and returns `{ effects, halt }`:

- **effects** are applied in order, immediately: `{type:'stage', op:'scene'|'bg'|'show'|'hide'|'move'|'cg'|'camera'|'weather'|'filter'|'tint'|'shake'|'flash', ...}`, `{type:'audio', op:'music'|'ambience'|'sound'|'stop', ...}`, `{type:'text', op:'mode'|'clear'|'textbox'|'pov', ...}`, `{type:'restore', stage, audio, text}` (sync everything, after load/rollback), `{type:'log'|'warning'|'error', ...}`, plus any type a module defines.
- **halt** is what the player must show or answer: `say` (`who`, `name`, `color`, `attrs`, `runs` — styled text, `plain`, `id`, `read`, `voice`, `mode`, `nw`, `pov`), `menu` (`options` with `index`, `runs`, `plain`, `disabled`, `seen`), `wait` (`seconds`), `pause`, `chapter`, `ending`, `input`, `game`, `video`, `end`, `error`.
- The host answers with `vm.advance()`, `vm.choose(index)`, `vm.submit(value)`; `vm.rollback()`, `vm.save()`, `vm.load(save)`, `vm.jump(scene)`.

The stage model (`vm.state.stage`) is plain JSON: `{ bg: {kind:'image'|'world'|'color', id, color}, actors: [{id, kind, attrs, x, y, scale, z, flip, mark}], cg, camera: {zoom, x, y, rotate, from, look, fov}, weather, filter, tint, textbox }`.

## 4.3 Writing a module

A module adds commands to the language (with full checking and docs) and, optionally, behaviour to the browser player. List your modules in the header: `modules: mods/confetti.js`.

```js
// mods/confetti.js
export default {
  name: 'confetti',
  commands: [{
    name: 'confetti',
    summary: 'Throw confetti.',
    syntax: '@confetti [amount=100] [color=#ffdd88]',
    named: {
      amount: { type: 'int', default: 100, doc: 'How many pieces.' },
      color: { type: 'color', default: '#ffdd88' },
    },
    examples: ['@confetti amount=300'],
    // Runs in the VM (browser and CLI). Change vm.state, emit effects, or halt.
    exec(ins, vm) { vm.emit({ type: 'confetti', amount: ins.args.amount, color: ins.args.color }); },
  }],
  // Browser only: how the player shows this module's effects.
  runtime: {
    effects: {
      confetti(effect, player) { player.particles.burst({ count: effect.amount, color: effect.color }); },
    },
  },
};
```

- Argument types: `string`, `text`, `number`, `int`, `bool`, `duration`, `color`, `ident`, `label` (a scene), `var`, `list`, `position`, `transition`, `ease`, `enum:a|b|c`, `asset:image|audio|world|model|video|gameplay|character` (any combination, plus `none`, `all`, `stop`, `color`).
- `positional: [{ name, type, required, rest }]`, `named: { key: { type, default, doc } }`, `extraNamed: true` to accept any other `key=value`.
- Optional `compile(cmd, ctx, args)` returns a custom instruction and may report errors through `ctx.diags`; `decl: true` with `declare(cmd, ctx, args)` makes a compile-time declaration.
- `exec(ins, vm)` can use `vm.state`, `vm.persistent`, `vm.getVar/setVar`, `vm.emit(effect)`, `vm.halt(h)`, `vm.warn(msg)`. If it throws, the player skips the command and reports R700 at the script line, naming the module, the command and the error; the story goes on. `shiori explore` stops that route there and lists it under Problems.
- `shiori docs <name> --game <folder>` shows your module's commands, generated from the schema.

## 4.4 3D content

**World modules** build a three.js scene:

```js
// worlds/cove.js
export default function build({ THREE, scene, camera, marks, onUpdate, quality }) {
  scene.background = new THREE.Color('#0b1020');
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 64, 64), new THREE.MeshStandardMaterial({ color: '#1b3b5a' }));
  sea.rotation.x = -Math.PI / 2;
  scene.add(sea, new THREE.HemisphereLight('#8fb4ff', '#202030', 1.2));
  marks.shore = { position: [0, 1.6, 8], look: [0, 1, 0] };   // camera position + default look target
  marks.rock  = { position: [3, 0, -2] };
  onUpdate((dt, t) => { /* animate water, lights ... */ });
}
```

- A mark is `{ position: [x,y,z], look?: [x,y,z] }` or a `THREE.Vector3`/`THREE.Object3D`.
- glTF worlds: any object named `mark_<name>` becomes a mark; animations in the file loop.
- **Model modules** (`model: chars/mio.js` or `@model … x.js`) export `build({ THREE, group, attrs })` returning `{ setAttrs(attrs), setSpeaking(bool), update(dt, t) }`.
- **VRM** models (`.vrm`) load through `@pixiv/three-vrm` when it is in the page's import map; attributes map to VRM expressions (`smile`/`happy` → happy, `sad`, `angry`, `surprised`, `relaxed`, `neutral`), and the mouth moves while the character speaks.

## 4.5 Gameplay modules

```js
// games/cards.js — must resolve with the result value.
export default async function play({ container, params, width, height, signal }) {
  // Build any DOM/canvas UI inside `container`; resolve when done.
  return 'win';
}
```

## 4.6 Running a game in the browser

Run `shiori serve games/my-game`, or `shiori serve` inside the game folder (the game folder must be inside the engine folder), and open the URL it prints, or serve the engine folder with any static web server (for example `python3 -m http.server 8777`) and open:

`http://localhost:8777/player.html?game=examples/lantern-keeper`

| URL parameter | Effect |
|---|---|
| `game=path` | The game folder (relative to the engine folder). |
| `scene=id` | Skip the title screen and start at a scene. |
| `set=trust:2,met_rin:true` | Set variables at the start. |
| `choices=1,2,1` | Pick these choices automatically. |
| `skip=1` | Fast-forward until the first choice that isn't scripted. |
| `autostart=1` | Skip the title screen and start a new game (after a "click to start" button, because browsers only allow sound after a click). |
| `dev=1` | Developer panel beside the game: where you are (file:line), variables, stage, warnings, jump to scene, live reload when files change. Press `` ` `` to toggle it. |

`window.shiori` exposes the running player for automation: `shiori.state()`, `shiori.advance()`, `shiori.choose(n)`, `shiori.jump('scene')`, `shiori.screenshot()`.

To publish, copy the engine's `player.html`, `engine/` and your game folder to any static host (itch.io, GitHub Pages...). Everything is static files.

**Player controls:** click / Space / Enter: advance · mouse wheel up or PageUp: roll back · wheel down: roll forward · Ctrl (hold): skip · Tab: toggle skip · A: auto mode · L: backlog · H or right-click: hide the interface · S / F5: quick save · F9: quick load · Esc: menu · F: fullscreen · 1–9: pick a choice.

## 4.7 Save format

A save is JSON: `{ format: 'shiori-save', version: 1, game, programHash, time, chapter, scene, preview, position, calls, state, backlog, halt }` plus a thumbnail in the browser.

- `position` is `{scene, offset, id, op, after, n, k}`: the scene, the offset into it, the line or menu id, the kind of instruction (`op`), the id of the nearest instruction before it that has one (`after`), and which instruction of that kind it is after `after` (`n`) and in the scene (`k`). This is how a save finds its place in an edited script.
- `calls` holds one position per `@call` still to return from, with the position of the `@call` itself as `call`.
- `halt` is only there for saves made at `@input`, `@game`, `@pause`, `@wait`, `@video`, `@chapter` or `@ending`.

Persistent data (endings, read lines, unlocked CGs, music, persistent variables) is stored separately per game.

---

# Part 5 — Complete example game

The folder `examples/lantern-keeper/` is a complete small game in four files that uses most features: two points of view, ADV and NVL, choices with consequences, a hub menu, a locked choice, an ending that unlocks after the others, weather, filters, a CG, LMN music and a 3D scene. All four files follow.

### `game.story`

<!-- EXAMPLE:examples/lantern-keeper/game.story -->

```shiori
SHIORI 1
title: The Lantern Keeper
developer: Shiori examples
description:
  Aoi comes back to the harbor town she left at fourteen. The lighthouse on the
  point has been dark for nine years, ever since the keeper's boat failed to come
  home, and his daughter Mio still sets a place for him at supper.
language: en
status: finished
release_type: complete
age_rating: 12
freeware: true
platforms: web
dialogue_quotes: “”
title_background: harbor_dusk
title_music: theme
ai_generated: story music backgrounds sprites cgs
include: story/harbor.story story/rin.story story/lighthouse.story

// ---- cast ------------------------------------------------------------------

@character aoi
  name: Aoi
  color: #8fb8ff
  role: protagonist
  gender: female
  description: Back in town for the first time in six years.

@character mio
  name: Mio
  color: #f29bb0
  sprite: chars/mio/{expression}.svg
  blink: chars/mio/blink.svg
  expression: neutral smile sad blush surprised
  role: main
  gender: female
  age: 19
  description: The lighthouse keeper's younger daughter. Still sets his place at supper.

@character rin
  name: Rin
  color: #c9a0ff
  sprite: chars/rin/{expression}.svg
  expression: neutral smirk sad angry
  role: main
  gender: female
  age: 24
  description: Mio's older sister. Runs the ferry office and says what everyone is thinking.

// ---- places, pictures, music -------------------------------------------------

@image harbor_dusk bg/harbor_dusk.svg
@image harbor_night bg/harbor_night.svg
@image kitchen bg/kitchen.svg
@image cg_lamplight cg/lamplight.svg title="Lamplight"
@world lighthouse worlds/lighthouse.js marks="cliff lamp door sea pier" camera=cliff
@audio theme music/theme.lmn title="The Lantern Keeper"
@audio unlit music/unlit.lmn title="Unlit"
@audio two_lanterns music/two_lanterns.lmn title="Two Lanterns"

// ---- state ------------------------------------------------------------------

@var trust = 0
@var asked_lamp = false
@var asked_father = false

// ---- prologue ---------------------------------------------------------------

# prologue "Prologue"
@scene black
@mode nvl
@music theme fade=3
The bus lets me off where the road gives up and becomes gravel.
Six years. The harbor smells the same: diesel, salt, and the sweet rot of kelp drying on the breakwater.
I tell myself I came back for my grandmother's house, which needs selling. That is true, the way a map is true.
On the point, the lighthouse stands with its lamp-room dark, a lid on an empty jar.
@clear
@mode adv
-> harbor
```

<!-- /EXAMPLE -->

### `story/harbor.story`

<!-- EXAMPLE:examples/lantern-keeper/story/harbor.story -->

```shiori
SHIORI 1

# harbor "The Pier"
@chapter "The Pier"
@scene harbor_dusk with=dissolve time=2
@weather fireflies layer=back intensity=0.6
The tide comes in the colour of weak tea. Someone is already sitting at the end of the pier, swinging her legs over the water like a child.
@show mio neutral at=center
She turns before I can decide whether to call out.
mio (surprised): ...Aoi?
mio (smile): You're six years late. I saved you the dry end of the bench.
The bench is a plank nailed across two pilings. She pats the dry end.

* Sit beside her.
  @set trust += 1
  I sit. The wood is still warm from the sun, and her shoulder is an inch from mine.
  mio (blush): You actually sat. You used to say it would collapse.
  aoi: It still might.
* Stay standing. -> standing

mio (neutral): Grandma Sato's house?
aoi: Selling it.
mio: Mm. Everyone sells to the city people now.
She says it without blame, the way you'd remark on the weather.
-> ask_mio

# ask_mio
@camera zoom=1.15 time=2
mio: Go on. You've got the face you get when you're saving up questions.
* [once] Ask about the lighthouse.
  @set asked_lamp = true
  mio (sad): Still dark. Rin says the council won't pay for a keeper. Rin says a lot of things.
  aoi: You could light it.
  mio (neutral): I could. I don't.
  -> ask_mio
* [once] Ask about her father.
  @set asked_father = true
  @set trust += 1
  @camera reset time=1
  She looks at the water for a long time.
  mio (sad): Nine years in March. I still set his place. Rin hates it.
  mio (smile): Isn't that stupid? You can say it's stupid.
  aoi: It isn't stupid.
  -> ask_mio
* [require asked_lamp and asked_father] Ask if she'd climb the lighthouse with you tonight.
  @camera reset time=1
  mio (surprised): Tonight?
  mio (blush): ...After Rin's asleep. Bring a torch.
  -> rin_interlude
* Say goodnight. -> goodnight

# goodnight
@camera reset time=1
mio (smile): Goodnight, then. Don't leave for another six years.
She walks back along the pier, and the fireflies close behind her like a curtain.
@hide mio with=dissolve time=1.2
@ending supper "A Place Set at Supper" kind=normal
-> END

# standing
mio (sad): Suit yourself.
@move mio at=right time=1.5
She shifts to the very end of the plank, as if to make room for someone who isn't coming.
I stand there long enough for it to become a decision.
@scene harbor_night with=fade time=2
@music unlit fade=2
The bus back to the city leaves at nine. I am on it.
@ending dry_end "The Dry End of the Bench" kind=bad
-> END
```

<!-- /EXAMPLE -->

### `story/rin.story`

<!-- EXAMPLE:examples/lantern-keeper/story/rin.story -->

```shiori
SHIORI 1

# rin_interlude "Rin"
@chapter "Interlude" subtitle="Rin"
@pov rin
@scene kitchen with=fade
@music unlit fade=2
@filter dusk time=0
Rin Kurose washes three plates and leaves the fourth on the rack, clean and dry and unused, the way it has been every night for nine years.
@show rin neutral at=left
She hears her sister humming upstairs. She hasn't heard that in a while.
rin (smirk): So the Sato girl came back.
She says it to the plate. The plate, as usual, has no opinion.
@shake strength=0.4 time=0.3
The window rattles in its frame. Wind off the point.
rin (sad): If she takes Mio up there...
Rin has a key to the lamp-room in her apron pocket. She has carried it for nine years, ever since she climbed up alone on the night the boat didn't come back and put the lamp out with her own hands.
@if ending_seen("lamplight")
  rin (angry): Then let her. Let them both find out.
  She leaves the key on the table, next to the fourth plate.
  @set trust += 1
-> lighthouse_climb
```

<!-- /EXAMPLE -->

### `story/lighthouse.story`

<!-- EXAMPLE:examples/lantern-keeper/story/lighthouse.story -->

```shiori
SHIORI 1

# lighthouse_climb "The Point"
@pov none
@scene lighthouse with=fade time=2
@music theme fade=3
@weather stars layer=back
@camera from=pier look=lamp time=0
The path up the point is a ribbon of chalk in the dark. Mio walks ahead with the torch, and the sea breathes on both sides of us.
@camera from=cliff look=lamp time=5 wait=true
@show mio neutral at=left
mio: Dad used to say a lighthouse isn't for the boats that are lost. It's for the ones that are nearly home.
@if trust >= 3
  mio (blush): I'm glad it's you up here. I don't think I'd have come with anyone else.
@camera from=door look=lamp time=3
The door at the top is locked. Of course it is.

@if ending_seen("lamplight")
  The key is in my pocket. I don't remember Rin giving it to me; I remember a fourth plate, and a key beside it, and understanding.
  -> two_lanterns
mio (sad): Rin has the key. She's always had it.
mio (smile): Doesn't matter. The window at the side doesn't latch.
-> lamplight

# lamplight "Lamplight"
@scene black with=fade
@cg cg_lamplight with=dissolve time=2
We climb through the window into nine years of dust. The great lens is still there, waiting, a glass beehive.
It takes both of us to turn the old brass valve. The flame catches on the third try.
@flash color=#fff3c4 time=0.6
Light goes out over the water like a held breath let go.
mio: There. Now he can't say he couldn't find the way.
She is smiling. She is crying. Below us a door bangs, and someone runs up the path calling Mio's name in a voice I have never heard Rin use.
@textbox hide
@pause
@ending lamplight "Lamplight" kind=good
-> END

# two_lanterns "Two Lanterns"
@scene harbor_night with=fade time=2
@music two_lanterns fade=2
@show rin sad at=right
@show mio neutral at=left
Rin is waiting at the foot of the stairs. She doesn't stop us. She came to say it before we do.
rin (sad): He didn't sink, Mio. He sailed for the mainland with a woman from the cannery. He wrote once. I burned it.
@shake strength=0.6
rin (angry): I put the lamp out so you'd stop waiting. You never stopped. So I kept it dark.
mio (sad): ...
For a long moment nobody moves, and the sea goes on breathing.
mio (neutral): Then we're not lighting it for him.
She takes her sister's hand, and then mine, and we climb the stairs together, three of us in a space made for one.
@cg cg_lamplight with=dissolve time=2
The light swings out over the water. It isn't for anyone who is lost. It is for the ones who are nearly home.
@ending two_lanterns "Two Lanterns" kind=true
-> END
```

<!-- /EXAMPLE -->

---

# Appendix A — Command reference

Generated from the engine by `shiori docs`. Every command, with its arguments and defaults.

<!-- BEGIN GENERATED REFERENCE -->

## Declarations (compile time)

### `@character`

Declare a character: display name, color, sprites or 3D model, and attribute groups.

```shiori
@character <id> [name="Display Name"] [color=#hex] — or an indented block of `key: value` lines
```

- Properties: name, color, sprite, layer (repeatable), side, blink, mouth, model, scale, y.
- VNDB character sheet: role (protagonist|main|side|appears), gender, age, description, cv (voice actor), original_name.
- Any other key is an attribute group: `expression: neutral smile sad` (the first value is the default).
- Image paths can use `{group}` placeholders: `sprite: chars/mio/{expression}.png`.

| Argument | | Type | Meaning |
|---|---|---|---|
| `id` | required | ident | The character id used in scripts (e.g. mio) |

```shiori
@character mio
  name: Mio
  color: #f29bb0
  sprite: chars/mio/{expression}.png
  expression: neutral smile sad angry blush
@character narrator_cat name="Cat" color=#c9a227
```

### `@image`

Declare an image (background, CG, or prop). SVG, PNG, JPG, WebP, GIF and AVIF work.

```shiori
@image <id> <path> [fit=cover|contain|none] [title="Gallery name"]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `id` | required | ident | A name for this image |
| `path` | required | path | The file path, relative to game.story |
| `fit=` | default `cover` | cover \| contain \| none | How a background fills the screen. |
| `title=` | optional | string | Name shown in the CG gallery. |
| `x=` | optional | number | Default horizontal position when shown as a prop (0–1). |
| `y=` | optional | number | Vertical offset when shown as a prop. |
| `scale=` | optional | number | Scale when shown as a prop. |
| `animated=` | optional | bool | Mark an animated background or CG (for the VNDB report). |
| `desc=` | optional | string | A brief for whoever makes this file (artist, composer). Listed by `shiori assets`. |

```shiori
@image harbor_dusk bg/harbor_dusk.png
@image cg_lanterns cg/lanterns.png title="Lantern Night"
```

### `@audio`

Declare a sound file (OGG, MP3, WAV) or an LMN song (.lmn / .txt starting with `LMN 1`).

```shiori
@audio <id> <path> [title="Track name"] [volume=0.8]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `id` | required | ident | A name for this audio |
| `path` | required | path | The file path, relative to game.story |
| `volume=` | optional | number | Base volume 0–1. |
| `loop=` | optional | bool | Loop when used as music or ambience (default true). |
| `title=` | optional | string | Track name for the music room. |
| `room=` | optional | bool | List in the music room (default: true for music). |
| `desc=` | optional | string | A brief for whoever makes this file (artist, composer). Listed by `shiori assets`. |

```shiori
@audio theme music/theme.lmn title="Lanterns (Main Theme)"
@audio waves sfx/waves.ogg volume=0.6
```

### `@world`

Declare a 3D world: a .glb/.gltf file, or a .js module that builds the scene with three.js.

```shiori
@world <id> <path> [marks="pier cliff lamp"]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `id` | required | ident | A name for this world |
| `path` | required | path | The file path, relative to game.story |
| `marks=` | optional | list | Named positions in the world (for at= and @camera from=/look=). |
| `camera=` | optional | string | Mark the camera starts at. |
| `animated=` | optional | bool | The world has moving parts (waves, particles...). |
| `desc=` | optional | string | A brief for whoever makes this file (artist, composer). Listed by `shiori assets`. |

```shiori
@world lighthouse worlds/lighthouse.js marks="door lamp cliff sea"
@world town worlds/town.glb
```

### `@model`

Declare a 3D prop model (.glb/.gltf/.vrm, or a .js module).

```shiori
@model <id> <path> [scale=1]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `id` | required | ident | A name for this model |
| `path` | required | path | The file path, relative to game.story |
| `scale=` | optional | number | Scale. |
| `desc=` | optional | string | A brief for whoever makes this file (artist, composer). Listed by `shiori assets`. |

```shiori
@model boat models/boat.glb
```

### `@gameplay`

Declare a gameplay module (a .js file). Gameplay counts against VNDB's reading-share rule.

```shiori
@gameplay <id> <path.js> [minutes=2] [results="win lose"]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `id` | required | ident | A name for this gameplay |
| `path` | required | path | The file path, relative to game.story |
| `minutes=` | default `1` | number | Typical time a player spends in it (for the VNDB reading-share estimate). |
| `results=` | optional | list | Possible results, so `shiori explore` can try each one. |
| `desc=` | optional | string | A brief for whoever makes this file (artist, composer). Listed by `shiori assets`. |

```shiori
@gameplay cards games/cards.js minutes=3 results="win lose"
```

### `@var`

Declare a story variable with its starting value. Variables reset on New Game.

```shiori
@var <name> = <number | "string" | true | false>
```

```shiori
@var trust = 0
@var met_rin = false
@var player_name = "Aoi"
```

### `@persistent`

Declare a variable that survives across playthroughs (e.g. unlocks after an ending).

```shiori
@persistent <name> = <value>
```

```shiori
@persistent saw_true_end = false
```

### `@position`

Name a horizontal stage position for 2D scenes.

```shiori
@position <name> x=<0..1> [y=0] [scale=1]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `name` | required | ident | The position name |
| `x=` | optional | number | 0 = left edge, 1 = right edge. |
| `y=` | default `0` | number |  |
| `scale=` | default `1` | number |  |

```shiori
@position doorway x=0.82 scale=0.8
```

## Story flow

### `@set`

Change a variable.

```shiori
@set <name> = <expr>   (also +=, -=, *=, /=)
```

```shiori
@set trust += 1
@set met_rin = true
@set mood = "wary"
```

### `@jump`

Jump to a scene (same as `-> scene`).

```shiori
@jump <scene>
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `target` | required | label | The scene to go to |

```shiori
@jump harbor_night
```

### `@call`

Run a scene, then come back here when it reaches `@return`.

```shiori
@call <scene>
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `target` | required | label | The scene to run |

```shiori
@call flashback_rain
```

### `@return`

Go back to just after the `@call` that started this scene.

```shiori
@return
```

```shiori
@return
```

### `@ending`

Mark that the player reached an ending. Records it permanently and shows an ending card.

```shiori
@ending <id> ["Title"] [kind=true|good|normal|bad|joke]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `id` | required | ident | An id for this ending |
| `title` | optional | string | The ending's title |
| `kind=` | default `normal` | true \| good \| normal \| bad \| joke | What kind of ending it is. |

```shiori
@ending lanterns_home "Lanterns Home" kind=true
@ending drowned "Undertow" kind=bad
```

### `@chapter`

Start a chapter: shows a title card and names save files.

```shiori
@chapter "Title" [subtitle="..."]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `title` | required | string | The chapter title |
| `subtitle=` | optional | string | A smaller line under the title. |
| `card=` | default `true` | bool | Show the title card. |

```shiori
@chapter "Chapter 1 — Salt"
@chapter "Interlude" subtitle="Rin"
```

### `@assert`

Check a condition while testing. `shiori explore` reports every assertion that can fail.

```shiori
@assert <condition> ["message"]
```

```shiori
@assert trust >= 0
@assert visited("harbor") > 0
@assert route == "rin" "Only Rin's route reaches the roof"
```

### `@log`

Print a debugging message (shown by `shiori play` and in the browser console).

```shiori
@log <text with {$vars}>
```

```shiori
@log trust is now {$trust}
```

### `@note`

An author's note. Ignored by the game; listed by `shiori stats`.

```shiori
@note "text"
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `text`… | optional | string |  |

```shiori
@note "TODO: rewrite this scene after chapter 3 changes"
```

### `@input`

Ask the player to type text (such as a name) into a variable.

```shiori
@input <variable> ["Prompt"] [default="..."] [max=20]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `var` | required | var | A declared string variable |
| `prompt` | optional | string | The question shown |
| `default=` | optional | string | Pre-filled answer. |
| `max=` | default `24` | int | Maximum length. |

```shiori
@input player_name "What is your name?" default="Aoi"
```

### `@rename`

Change the name shown for a character from now on (e.g. "???" until introduced). No name resets it.

```shiori
@rename <character> ["New name"]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `who` | required | character | The character |
| `name` | optional | string | The name to show |

```shiori
@rename rin "???"
@rename rin
```

### `@pov`

Say whose point of view the narration follows from now on (for stories told from several perspectives). `@pov none` clears it.

```shiori
@pov <character | none>
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `who` | required | character \| none id | The character whose eyes we see through, or none |

```shiori
@pov rin
@pov none
```

### `@wait`

Pause for a number of seconds (the player can click to skip).

```shiori
@wait <seconds>
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `seconds` | required | duration | How long to wait |

```shiori
@wait 1.5
```

### `@pause`

Wait for a click with no text on screen (e.g. to let a CG sink in).

```shiori
@pause
```

```shiori
@textbox hide
@pause
```

### `@game`

Run a gameplay module and store its result. Gameplay is limited by VNDB's inclusion rules.

```shiori
@game <gameplay id> [into=variable] [any other key=value is passed to the module]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `id` | required | gameplay id | A declared @gameplay module |
| `into=` | optional | var | Variable that receives the result. |

```shiori
@game cards into=card_result difficulty=2
```

## Stage (2D and 3D)

### `@scene`

Start a new scene: set the background and clear characters, CG, camera, weather, filter and tint.

```shiori
@scene <image | world | black | white | #color> [with=fade] [time=1]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `bg` | required | image \| world \| color id | A background image, 3D world, or color |
| `with=` | default `fade` | transition | Default: fade. |
| `time=` | optional | duration | Length of the transition in seconds. |
| `wait=` | optional | bool | Wait for the transition to finish before continuing. |

```shiori
@scene harbor_dusk
@scene lighthouse with=dissolve time=2
@scene black
```

### `@bg`

Change only the background; characters stay.

```shiori
@bg <image | world | color> [with=dissolve] [time=0.8]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `bg` | required | image \| world \| color id | A background image, 3D world, or color |
| `with=` | default `dissolve` | transition |  |
| `time=` | optional | duration | Length of the transition in seconds. |
| `wait=` | optional | bool | Wait for the transition to finish before continuing. |

```shiori
@bg harbor_night with=dissolve time=2
```

### `@show`

Show a character (with attributes) or an image/model prop, or change one already on stage.

```shiori
@show <who> [attributes...] [at=position] [with=dissolve] [time=0.4] [z=0] [flip=false] [scale=1] [y=0]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `who` | required | character \| image \| model id | A character, image or model |
| `attrs`… | optional | attr | Character attributes such as smile |
| `at=` | optional | position | left, center, right, farleft, farright, a number 0–1, a @position name, or a 3D mark. |
| `with=` | default `dissolve` | transition |  |
| `time=` | optional | duration | Default 0.4 s. |
| `wait=` | optional | bool | Wait for the fade-in (default false). |
| `z=` | optional | number | Stacking order; higher is in front. |
| `flip=` | optional | bool | Mirror horizontally. |
| `scale=` | optional | number | Size multiplier. |
| `y=` | optional | number | Vertical offset as a fraction of screen height (negative is up). |

```shiori
@show mio smile at=left
@show rin angry arms_crossed at=right flip=true
@show lantern at=0.6 z=5
```

### `@hide`

Remove a character or prop from the stage (or `all`).

```shiori
@hide <who | all> [with=dissolve] [time=0.4]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `who` | required | character \| image \| model \| all id | Who to hide, or all |
| `with=` | default `dissolve` | transition |  |
| `time=` | optional | duration | Length of the transition in seconds. |
| `wait=` | optional | bool | Wait for the transition to finish before continuing. |

```shiori
@hide mio
@hide all with=fade
```

### `@move`

Slide a character or prop to a new position, height or size.

```shiori
@move <who> [at=position] [y=0] [scale=1] [time=0.6] [ease=inout] [wait=false]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `who` | required | character \| image \| model id | Who to move |
| `at=` | optional | position |  |
| `y=` | optional | number |  |
| `scale=` | optional | number |  |
| `flip=` | optional | bool |  |
| `z=` | optional | number |  |
| `time=` | default `0.6` | duration |  |
| `ease=` | default `inout` | ease |  |
| `wait=` | default `false` | bool |  |

```shiori
@move mio at=center time=1
@move rin scale=1.15 y=0.05 time=0.3
```

### `@cg`

Show a full-screen event CG (unlocks it in the gallery), or `@cg none` to close it.

```shiori
@cg <image | none> [with=dissolve] [time=1]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `image` | required | image \| none id | The CG image, or none |
| `with=` | default `dissolve` | transition |  |
| `time=` | optional | duration | Length of the transition in seconds. |
| `wait=` | optional | bool | Wait for the transition to finish before continuing. |

```shiori
@cg cg_lanterns
@cg none with=fade
```

### `@camera`

Move the camera. 2D: zoom and pan the stage. 3D: fly between marks and look at things.

```shiori
@camera [zoom=1] [x=0] [y=0] [rotate=0] [from=mark] [look=mark] [fov=50] [time=1] [ease=inout] [wait=false]  — or @camera reset
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `action` | optional | reset | reset |
| `zoom=` | optional | number | 2D/3D zoom (1 = normal). |
| `x=` | optional | number | 2D: pan, as a fraction of screen width (positive looks right). |
| `y=` | optional | number | 2D: pan, as a fraction of screen height (positive looks down). |
| `rotate=` | optional | number | Roll in degrees. |
| `from=` | optional | string | 3D: mark to place the camera at. |
| `look=` | optional | string | 3D: mark (or character) to look at. |
| `fov=` | optional | number | 3D: field of view in degrees. |
| `orbit=` | optional | number | 3D: orbit around the look target by this many degrees. |
| `time=` | default `1` | duration |  |
| `ease=` | default `inout` | ease |  |
| `wait=` | default `false` | bool |  |

```shiori
@camera zoom=1.3 x=0.1 time=2
@camera from=cliff look=lamp time=3 wait=true
@camera reset time=1
```

### `@shake`

Shake the screen (impacts, shock, earthquakes).

```shiori
@shake [strength=1] [time=0.5]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `strength=` | default `1` | number |  |
| `time=` | default `0.5` | duration |  |

```shiori
@shake
@shake strength=2 time=1
```

### `@flash`

Flash the screen with a color.

```shiori
@flash [color=white] [time=0.4]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `color=` | default `white` | color |  |
| `time=` | default `0.4` | duration |  |

```shiori
@flash
@flash color=#ff2244 time=0.2
```

### `@weather`

Animated background effects: rain, snow, petals, fireflies, stars, fog... (`none` to clear).

```shiori
@weather <type> [intensity=1] [wind=0] [layer=front|back] [time=1]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `type` | required | rain \| storm \| snow \| petals \| leaves \| fireflies \| stars \| dust \| embers \| fog \| bubbles \| none | The effect |
| `intensity=` | default `1` | number | 0.2 = light, 1 = normal, 2 = heavy. |
| `wind=` | default `0` | number | -1 (blows left) to 1 (blows right). |
| `layer=` | default `front` | front \| back | In front of or behind the characters. |
| `time=` | default `1` | duration | Fade-in time. |

```shiori
@weather rain intensity=1.5 wind=0.3
@weather fireflies layer=back
@weather none
```

### `@filter`

Color-grade the whole picture (flashbacks, night, dreams).

```shiori
@filter <sepia | grayscale | night | dusk | dream | blur | vignette | invert | noir | none> [time=1]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `type` | required | none \| sepia \| grayscale \| night \| dusk \| dream \| blur \| vignette \| invert \| noir | The filter |
| `time=` | default `1` | duration |  |

```shiori
@filter sepia
@filter none time=2
```

### `@tint`

Wash the picture with a color, or `@tint none`.

```shiori
@tint <color | none> [alpha=0.3] [time=1]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `color` | required | string | A color (#rrggbb or a basic name like orange), or none |
| `alpha=` | default `0.3` | number |  |
| `time=` | default `1` | duration |  |

```shiori
@tint #ff6a00 alpha=0.25
@tint none
```

## Text presentation

### `@mode`

Switch text presentation: `adv` (a textbox at the bottom) or `nvl` (full-screen pages of prose).

```shiori
@mode <adv | nvl>
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `mode` | required | adv \| nvl | adv or nvl |

```shiori
@mode nvl
@mode adv
```

### `@clear`

NVL mode: start a fresh page.

```shiori
@clear
```

```shiori
@clear
```

### `@textbox`

Hide or show the textbox (it reappears by itself at the next line of text).

```shiori
@textbox <hide | show>
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `state` | required | hide \| show | hide or show |

```shiori
@textbox hide
@pause
```

## Audio

### `@music`

Play a music track (crossfading from the current one), or `@music stop`.

```shiori
@music <audio | stop> [fade=1.5] [volume=1] [loop=true]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `track` | required | audio \| stop id | A declared @audio, or stop |
| `fade=` | default `1.5` | duration | Crossfade seconds. |
| `volume=` | default `1` | number |  |
| `loop=` | default `true` | bool |  |

```shiori
@music theme
@music storm_cue fade=0.5
@music stop fade=3
```

### `@ambience`

A looping background sound (rain, waves, crowd), separate from music. `@ambience stop` to end it.

```shiori
@ambience <audio | stop> [fade=1] [volume=1]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `track` | required | audio \| stop id | A declared @audio, or stop |
| `fade=` | default `1` | duration |  |
| `volume=` | default `1` | number |  |

```shiori
@ambience waves volume=0.6
@ambience stop fade=2
```

### `@sound`

Play a sound effect once.

```shiori
@sound <audio> [volume=1]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `sound` | required | audio id | A declared @audio |
| `volume=` | default `1` | number |  |

```shiori
@sound door_slam
@sound bell volume=0.5
```

### `@voice`

Attach a voice clip to the next line of dialogue.

```shiori
@voice <audio>
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `clip` | required | audio id | A declared @audio |

```shiori
@voice mio_0012
mio: You came back.
```

### `@stop`

Stop music, ambience, sounds, or all audio.

```shiori
@stop <music | ambience | sound | all> [fade=1]
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `what` | required | music \| ambience \| sound \| voice \| all | What to stop |
| `fade=` | default `1` | duration |  |

```shiori
@stop music fade=3
@stop all
```

## Video

### `@video`

Declare a video (`@video id path`) or play one (`@video id`).

```shiori
@video <id> <path>  (declare)   ·   @video <id> [kind=opening|cutscene|ending] [skippable=true]  (play)
```

| Argument | | Type | Meaning |
|---|---|---|---|
| `id` | required | raw | The video id |
| `path` | optional | raw | File path (only when declaring) |
| `kind=` | default `cutscene` | opening \| cutscene \| ending | For the VNDB report: opening and ending movies are not "cutscenes". |
| `skippable=` | default `true` | bool |  |
| `loop=` | optional | bool | When declaring: loop as a moving background. |
| `title=` | optional | string | When declaring: title in the gallery. |

```shiori
@video op movies/opening.webm
@video op kind=opening
```

# Appendix B — Tables

## Transitions (`with=`)

| Name | Meaning |
|---|---|
| `none` | Instant change. |
| `cut` | Same as none. |
| `fade` | Fade to black, then fade in. |
| `fade_white` | Fade to white, then fade in. |
| `dissolve` | Cross-dissolve from the old picture to the new one. |
| `flash` | White flash, then the new picture. |
| `wipe_left` | The new picture wipes in from the right edge towards the left. |
| `wipe_right` | The new picture wipes in from the left edge towards the right. |
| `wipe_up` | Wipes in from the bottom upwards. |
| `wipe_down` | Wipes in from the top downwards. |
| `iris_in` | A circle closes on the old picture to reveal the new one. |
| `iris_out` | A circle opens from the centre to reveal the new picture. |
| `slide_left` | The new picture pushes the old one out to the left. |
| `slide_right` | The new picture pushes the old one out to the right. |
| `slide_up` | Pushes upwards. |
| `slide_down` | Pushes downwards. |
| `pixelate` | Old picture pixelates away and the new one resolves. |
| `blinds` | Horizontal blinds close and reopen on the new picture. |

## Positions (`at=`)

| Name | x (0 = left edge, 1 = right edge) |
|---|---|
| `offleft` | -0.3 |
| `farleft` | 0.12 |
| `left` | 0.27 |
| `midleft` | 0.38 |
| `center` | 0.5 |
| `midright` | 0.62 |
| `right` | 0.73 |
| `farright` | 0.88 |
| `offright` | 1.3 |

Numbers (`at=0.4`) and percentages (`at=40%`) also work, as do names from `@position` and, in 3D worlds, mark names.

## Easing (`ease=`)

`linear`, `in`, `out`, `inout`, `back`, `bounce`

## Weather (`@weather`)

| Type | Meaning |
|---|---|
| `rain` | Falling rain streaks. |
| `storm` | Heavy slanted rain with occasional lightning. |
| `snow` | Drifting snowflakes. |
| `petals` | Cherry-blossom petals. |
| `leaves` | Autumn leaves. |
| `fireflies` | Slow glowing motes. |
| `stars` | Twinkling stars (for night skies). |
| `dust` | Floating dust in light. |
| `embers` | Rising sparks. |
| `fog` | Drifting fog banks. |
| `bubbles` | Rising bubbles (underwater). |
| `none` | Clear the weather. |

## Filters (`@filter`)

| Filter | Meaning |
|---|---|
| `none` | No filter. |
| `sepia` | Old photograph (memories, flashbacks). |
| `grayscale` | Black and white. |
| `night` | Dark blue night grading. |
| `dusk` | Warm orange evening grading. |
| `dream` | Soft bright haze. |
| `blur` | Out of focus. |
| `vignette` | Darkened edges. |
| `invert` | Inverted colors (shock, the uncanny). |
| `noir` | High-contrast black and white. |

## Text tags

| Tag | Meaning |
|---|---|
| `{b}…{/b}` | Bold. |
| `{i}…{/i}` | Italic. |
| `{u}…{/u}` | Underline. |
| `{s}…{/s}` | Strikethrough. |
| `{color}…{/color}` | Text color: {color=#ff6688}text{/color}. |
| `{size}…{/size}` | Relative size: {size=1.5}big{/size}. |
| `{ruby}…{/ruby}` | Furigana / reading above the text: {ruby=かんじ}漢字{/ruby}. |
| `{shake}…{/shake}` | Trembling letters (fear, cold, anger). |
| `{wave}…{/wave}` | Letters bob in a wave (singing, giddiness). |
| `{speed}…{/speed}` | Typing speed multiplier: {speed=0.3}slow...{/speed}. |
| `{w}` | {w=0.8} pauses typing for 0.8 s. {w} waits for a click, then continues in the same box. |
| `{nw}` | At the very end of a line: continue to the next line without waiting for a click. |
| `{br}` | Line break inside one line of text. |

Also: `{$name}` inserts a variable; `{{` and `}}` are literal braces.

## Functions (in conditions)

| Function | Meaning |
|---|---|
| `visited(label)` | How many times the scene has been entered in this playthrough (0 if never). |
| `ending_seen(ending)` | True if this ending has been reached in any playthrough (persistent). |
| `endings_seen()` | How many of this game's endings have been reached across all playthroughs. Endings that are no longer in the game don't count. |
| `random(number, number)` | A whole number from a to b, inclusive, with the bounds in either order: random(6, 1) is the same as random(1, 6). Deterministic per save. |
| `chance(number)` | True with probability p (0 to 1). Deterministic per save. |
| `count(bool, …)` | How many of the conditions are true: count(clue_a, clue_b, clue_c) >= 2. |
| `min(number, number, …)` | Smallest value. |
| `max(number, number, …)` | Largest value. |
| `clamp(number, number, number)` | clamp(x, lo, hi). |
| `abs(number)` | Absolute value. |
| `floor(number)` | Round down. |
| `ceil(number)` | Round up. |
| `round(number)` | Round to nearest whole number. |
| `len(string)` | Length of a string. |
| `upper(string)` | Uppercase copy of a string. |
| `lower(string)` | Lowercase copy of a string. |

## Header fields (game.story)

| Field | Default | Meaning |
|---|---|---|
| `title:` | required | The game's title, as shown on the title screen. |
| `original_title:` |  | Title in its original script (e.g. Japanese), if different. |
| `romanized_title:` |  | Romanization of the original title. |
| `aliases:` |  | Other names or abbreviations, comma separated. |
| `description:` |  | A short description of the main story (spoiler-free). Used for VNDB and store pages. |
| `developer:` |  | Developer (person or circle). |
| `publisher:` |  | Publisher, if different from the developer. |
| `language:` | `en` | Language the script was written in (ISO code: en, ja, zh-Hans, ...). |
| `release_date:` |  | YYYY-MM-DD, YYYY-MM or YYYY. Leave out if unreleased. |
| `status:` | `in_development` | Development status, as VNDB defines it. Values: `finished`, `in_development`, `cancelled`. |
| `release_type:` | `complete` | Whether this build is the complete game, a partial release or a trial. Values: `complete`, `partial`, `trial`. |
| `version:` | `0.1` | Your version number. |
| `age_rating:` |  | Minimum age (0 for all ages, 12, 15, 18 ...). |
| `ero:` | `false` | Whether the game contains erotic scenes (VNDB "Contains erotic scenes"). `true` or `false`. |
| `censored:` | `unknown` | Optical censoring of erotic graphics, if any. Values: `none`, `mosaic`, `bars`, `other`, `unknown`. |
| `freeware:` | `false` | Free to download and play. `true` or `false`. |
| `doujin:` | `true` | Self-published / independent (doujin). `true` or `false`. |
| `official:` | `true` | Made or sanctioned by the original developer. `true` or `false`. |
| `platforms:` | `web` | Platforms you release on: web, win, mac, lin, and (Android), ios. |
| `resolution:` | `1920x1080` | Native resolution, WIDTHxHEIGHT. All positions scale to it. |
| `start:` |  | Scene to start the game at. Defaults to the first scene in game.story. |
| `author:` |  | Writer(s), for credits. |
| `website:` |  | Official website URL. |
| `ai_generated:` |  | Honest disclosure of AI-generated parts that ship in the game: story, sprites, backgrounds, cgs, music, voice, sound, animation, translation, assets, or all / none. Drives the VNDB AI tags. |
| `reading_speed:` | `200` | Words per minute used for length estimates. Words are counted by spaces in any script; each Han or kana character counts as half a word, and Thai, Lao, Khmer or Myanmar text as about one word per 4 letters. |
| `text_speed:` | `45` | Default typing speed in characters per second (players can change it). |
| `auto_delay:` | `1.2` | Default auto-mode pause after a line, in seconds. |
| `dialogue_quotes:` |  | Quote marks the textbox adds around dialogue, e.g. “” or 「」. Leave out for none. |
| `dim_inactive:` | `true` | Dim characters who are not speaking. `true` or `false`. |
| `theme:` |  | Path to a CSS file that restyles the player. |
| `title_background:` |  | Image or world id shown behind the title screen. |
| `title_music:` |  | Audio id that plays on the title screen. |
| `font:` |  | CSS font-family for story text. |
| `credits:` |  | Free text credits shown in Extras. |
| `include:` |  | Other .story files to load, relative to game.story. One or more per line. |
| `modules:` |  | Your own JavaScript modules (paths relative to game.story) that add commands, effects or gameplay. |

# Appendix C — Diagnostic codes

Every message from `shiori check`, `shiori explore` and the player carries one of these codes. E = error (the game will not run), W = warning, R = runtime problem, V = VNDB report.

| Code | Meaning | What to do |
|---|---|---|
| E100 | Missing or invalid version line | game.story must begin with the line `SHIORI 1`. Other files should too. |
| E101 | Inconsistent indentation | A line is indented less than the block it is in, but does not line up with any outer block. Indent every line of a block by the same amount (two spaces is usual). A no-break space (U+00A0) or a full-width space (U+3000) is not indentation, so one before a command, choice, jump or dialogue is also E101: replace it with ordinary spaces. |
| E102 | Unexpected indentation | Only three things take indented lines: the body of a choice (`* ...`), the body of `@if`/`@elif`/`@else`, and the `key: value` properties of a declaration. Remove the indentation, or put the line under one of those. |
| E103 | Content outside a scene | Every story line belongs to a scene. Start one with `# scene_id` at the very start of a line before writing narration or dialogue. Before a file's first scene only declarations (`@character`, `@image`, `@var` ...) and `@note` may appear; move any other command below the `# scene_id` line of the scene it belongs to. |
| E104 | Invalid scene line | A scene heading is `# id` or `# id "Title"` in column 1. Ids use letters, digits, `_` and `.`. |
| E105 | Duplicate scene id | Two scenes share an id. Scene ids are global across all files; rename one. |
| E106 | Invalid jump | A jump is `-> scene_id` or `-> END`. |
| E107 | Invalid choice line | A choice is `* text`, optionally `* [if cond] text -> scene`. Check the brackets and that the line has text. |
| E108 | Block is empty | `@if`, `@elif` and `@else` need their lines indented underneath them. |
| E109 | Misplaced @elif or @else | `@elif` and `@else` must directly follow an `@if`/`@elif` block at the same indentation. |
| E110 | Unclosed quote or unknown escape | A quoted string in a command, a scene title or a `key: value` property has no closing quote, or a backslash before a character that is not an escape. Inside quotes only `\\`, `\"` and `\'` are escapes. For a line break, put `{br}` in the dialogue or narration line instead of `\n`. Type the character itself instead of a `\u` code (`é`, not `\u00e9`). Write `\\` for a backslash, and use `/` between the folders of a path (`bg/dusk.png`, not `bg\dusk.png`). |
| E111 | Invalid command line | A command is `@name` then arguments, e.g. `@show mio smile at=left`. |
| E112 | Invalid header line | Header fields (`title: ...`) go at the top of game.story only, after `SHIORI 1` and before the first `@` or `#` line. Check the field's value against Appendix B. |
| E113 | Game folder or story file not found | A file the game needs is missing: the game folder does not exist, it has no game.story, or a file listed in `include:` does not exist. Pass the folder that holds game.story (`shiori check games/my-game`), and check the spelling. Paths in `include:` are relative to that folder. |
| E114 | Unknown speaker | Dialogue must start with a declared character id (`mio: Hello.`), exactly as declared (ids are case-sensitive and use only ASCII letters, digits and `_`, so `O'Brien` needs an id like `obrien` with `name="O'Brien"`). For a one-off speaker write `"Old Man": ...`. If the line is narration that happens to contain `Word:`, start it with `\| `. |
| E116 | Module could not be loaded | A file listed in `modules:` could not be imported, or does not `export default { name, commands: [...] }`. |
| E200 | Unknown scene | A jump, `@call`, `start:` or `visited()` names a scene that does not exist. Check the spelling against the `# id` lines. |
| E201 | Unknown variable | A variable is used before being declared. Add `@var name = 0` (or `= false`, `= ""`) outside any block. |
| E202 | Unknown asset or character | A name is used that was never declared. Declare images with `@image id path`, music with `@audio id path`, characters with `@character id`. |
| E203 | Unknown character attribute | An attribute in `mio (smile)` or `@show mio smile` is not in any of the character's attribute groups. Add it to a group (e.g. `expression: neutral smile`) or fix the spelling. |
| E204 | Duplicate declaration | Two declarations share a name. Characters and assets share one namespace; variables, `@position` names and endings each have their own. A position can't reuse a built-in name (left, center ...). An ending has one title and one kind: a later `@ending id` may repeat them or leave them out, but not change them. |
| E205 | Wrong kind of asset | The name exists but is the wrong kind (e.g. an audio id used as a background). |
| E206 | Unknown function | An unknown function is used in a condition. See "Functions" in Appendix B. |
| E207 | Unknown ending | `ending_seen("x")` names an ending that no `@ending x` creates. |
| E300 | Unknown command | Unknown command. `shiori docs` lists them all; common mix-ups: `@goto` → `-> scene`, `@bgm` → `@music`, `@se` → `@sound`. |
| E301 | Missing required argument | A required argument is missing. `shiori docs <command>` shows the usage. |
| E302 | Unknown argument | A named argument (`key=`) that the command does not take. `shiori docs <command>` lists them. |
| E303 | Invalid argument value | An argument value has the wrong form (a position, number, color, enum value...). The message says what is expected. |
| E304 | Too many arguments | Too many arguments. Most commands take one main argument plus `key=value` options. (`@filter` takes one filter, and a new one replaces the old. Use `@tint` for an extra wash.) |
| E305 | Declaration not allowed here | Declarations (`@character`, `@image`, `@var` ...) apply to the whole game, so they cannot sit inside a choice or `@if` block. Move them to the top of a file. |
| E306 | Command needs an indented block | This command needs an indented block of properties under it. |
| E400 | Invalid expression | The condition or value could not be parsed. Use `==` to compare, `and`/`or`/`not` to combine, quotes for strings. |
| E401 | Assignment used in a condition | A single `=` inside a condition. Compare with `==`; assign with `@set`. |
| E402 | Invalid assignment | `@set` and `@var` need `name = value` (also `+=`, `-=`, `*=`, `/=`). `@var` needs a literal starting value. |
| E403 | Type mismatch | A variable keeps the type of its starting value: a number variable cannot be given text, etc. |
| E500 | Unknown text tag | Unknown text tag. Tags: {b} {i} {u} {s} {color=#hex} {size=1.5} {ruby=reading} {shake} {wave} {speed=0.5} {w} {w=0.5} {nw} {br} {$var}. Literal braces are {{ and }}. |
| E501 | Unbalanced text tag | A text tag is not closed, or closed out of order. Close inner tags first: {b}{i}x{/i}{/b}. |
| E502 | Invalid text tag value | A text tag has a bad value or is in the wrong place, e.g. {color=} without a color, {size=0}, or {b} inside {ruby}. {size=…} and {speed=…} need a plain number above 0 and {w=…} a number of seconds; inside {ruby=…}…{/ruby} put only text and {$name}; {nw} goes at the end of the line. |
| W600 | Unreachable scene | No jump, choice or fall-through leads to this scene, so players can never see it. |
| W601 | Unused declaration | Declared but never used. Remove it, or use it. |
| W602 | Missing asset file | A declared file does not exist yet. Normal while art and music are being made; `shiori assets` shows where each is used. |
| W603 | Scene falls off the end of its file | The last scene of a file has no jump at its end, so the game ends there without an `@ending`. End it with `-> next_scene` or `-> END`. |
| W604 | Unknown header field | Unknown or repeated header field. See "Header fields" in Appendix B. |
| W605 | Story file not included | A .story file in the game folder is not listed in `include:`, so it is ignored. |
| W606 | Choice has no visible effect | None of the options in this menu does anything different. Fine for flavour; VNDB calls these "fake choices". |
| W607 | Very long line | A line over 600 characters will not fit even an NVL page well. Split it. |
| W608 | Possible undeclared speaker | This line will be shown as narration, but it looks like dialogue (or a quotation looks like a speaker). Use `"Name": ...` for one-off speakers, or start narration with `\| `. |
| W609 | Missing version line | Story files should start with `SHIORI 1`. |
| W610 | Character shown without being declared with a sprite or model | The character has no sprite, layers or model, so `@show` displays nothing. |
| W611 | Ending never reached | `shiori explore` found no route that reaches this ending. |
| W612 | Variable is never read | The variable is set but never read, so it cannot change the story. |
| W613 | Choice text is empty | A choice with no text. |
| W614 | Long run of dialogue without narration | 30+ lines of dialogue in a row with no narration. Counted along the story's flow: different choices and `@if` branches are counted separately, and a run continues through jumps and fall-through. Add narration: gestures, setting, thoughts. |
| W615 | Block terminator not used in Shiori | `@end`, `@endif` etc. are not used in Shiori: blocks end where their indentation ends. Delete the line. |
| W616 | Long stretch with no visual change | 30+ ADV lines with no visual change, counted along the story's flow (choices and `@if` branches separately, through jumps and fall-through). These reset the count: @scene @bg @show @hide @move @cg @camera @weather @filter @tint @shake @flash @video @mode, a menu, or a dialogue line whose attributes change the expression. NVL lines are not counted. |
| W617 | Music (LMN) warning | A warning or note about a song: from the LMN music compiler, or a .txt song whose first line is not `LMN 1` (add that line, or rename the file to .lmn). LMN notes are shown as info and don't fail `--strict`. See engine/vendor/lmn/LMN-Spec.md. |
| W618 | Camera looks at itself | `@camera from=` and `look=` name the same mark, so the camera would look at itself. |
| W619 | Line too long for the textbox | An ADV line over ~280 characters overflows a three-line textbox. Split it, or use `@mode nvl`. |
| W620 | Ending followed by more story | An `@ending` is followed by a jump back into the story. The ending is recorded and its card shown, then play continues. Add `-> END` if the game should stop there. |
| W621 | Every option in a menu is conditional | Every option in this menu is conditional. If none is available, the menu is skipped (R704). Add an unconditional option. |
| W622 | Code after a jump never runs | These lines can never run: they come after a `->`, `@jump` or `@return` in the same block, or after a menu or `@if`/`@else` whose every path jumps away. Also reported: a choice's `-> target` when the lines under it always jump first, and an `@elif` that repeats an earlier condition. Move the lines above the jump (an `@ending` goes before `-> END`) or delete them. Declarations and `@note` may stand anywhere. |
| W623 | Comparison with a true/false value | `<`, `<=`, `>` or `>=` has a true/false value on one side. `(1 < x) < 5` compares `1 < x` (true or false) with 5, so it is true for every x above 1. Write a range as `1 < x and x < 5`, and test a true/false value directly (`@if met_rin`, `not met_rin`) or with `==`. |
| R700 | Runtime error | A problem while the story ran: a division by zero, a jump to a missing scene, a module command whose `exec()` threw, a `@game` result that doesn't fit its `into=` variable, and the like. The message says what happened. The player reports it and goes on where it can: a condition that fails counts as false, a failed `@set` keeps the old value, and a failed module command is skipped. In `shiori explore` an error ends its route and is listed under Problems, so fix it first: what comes after it shows as not reached. |
| R701 | Assertion failed | An `@assert` condition was false on this route. |
| R702 | Return without call | `@return` was reached without an `@call`. Scenes reached by a jump should end with a jump, not `@return`. |
| R703 | Infinite loop | The story ran a long time without stopping for the player: a loop of jumps with no text or choice. |
| R704 | Menu with no available options | A menu had no available options and was skipped. |
| R705 | 3D camera arguments over a 2D background | `from=`, `look=`, `fov=` and `orbit=` only apply in 3D worlds. |
| R706 | Unlock exploration was capped | `shiori explore` replays the story from every different set of endings seen and `@persistent` values a playthrough can end in, but it stops after 16 playthroughs in a row or 64 such sets. Endings, lines and choices that need more playthroughs are then listed as not reached yet, though players may still reach them. If the game needs more playthroughs in a row, raise that limit with `--passes 32`. A `@persistent` value that changes on every playthrough never runs out: raise a counter with `+=` and compare it only with numbers (`@if runs >= 3`), so explore stops counting at the largest one. |
| V800 | VNDB eligibility problem | Reserved for the VNDB report. `shiori vndb` shows a guideline the game may not meet as a ⚠ item, with what VNDB looks for and what to change. It is advice: VNDB's editors decide. |
| V801 | VNDB eligibility warning | Reserved for the VNDB report. `shiori vndb` shows things worth checking as ℹ and ☐ items. It is advice: VNDB's editors decide. |

Codes are not contiguous; gaps are unused numbers.

<!-- END GENERATED REFERENCE -->

# Appendix D — Grammar

```
file        := version? header? body
version     := "SHIORI" SP "1" NL
header      := (field NL)*                      ; game.story only, before the first "@" or "#"
field       := key ":" SP? value (NL INDENT text)*
body        := (decl | note | comment | blank)* scene*   ; only declarations and @note before the first scene
scene       := "#" SP id (SP quoted)? NL block   ; nothing may follow the title
block       := statement*                       ; all at one indentation
statement   := comment | command | jump | menu | narration | dialogue
command     := "@" name (SP arg)* (SP "//" text)? NL props? body?
arg         := value | key "=" value
value       := word | quoted
props       := (INDENT key ":" SP? text NL)+    ; @character @image @audio @world @model @gameplay @position, @video id path
body        := INDENT block                     ; @if, @elif, @else
jump        := "->" SP? (id | "END") NL
menu        := option+
option      := "*" SP modifier* text (SP "->" SP? id)? NL (INDENT block)?
modifier    := "[" ("if" SP expr | "require" SP expr | "once") "]" SP?
dialogue    := (id | '"' [^"]+ '"') (SP? "(" attr ("," | SP)* ")")? ":" SP text NL
narration   := ("|" SP?)? text NL
id          := [A-Za-z_][A-Za-z0-9_.]*
name        := [A-Za-z_][A-Za-z0-9_]*
expr        := or ; or := and ("or" and)* ; and := not ("and" not)* ; not := "not"? cmp
cmp         := sum (("=="|"!="|"<"|"<="|">"|">=") sum)?
sum         := term (("+"|"-") term)* ; term := unary (("*"|"/"|"%") unary)* ; unary := "-"? atom
atom        := number | string | "true" | "false" | name | name "(" (expr ("," expr)*)? ")" | "(" expr ")"
string      := '"' ([^"\\] | "\\" ["'\\])* '"' | "'" ([^'\\] | "\\" ["'\\])* "'"
quoted      := string                           ; arguments, scene titles, quoted property values; another escape is E110
```
