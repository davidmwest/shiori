# Working on this game (for AI coding agents)

This folder is a visual novel for the **Shiori** engine.

- The language is defined in `SHIORI-Spec.md` in the engine folder. Read Parts 1–3 before editing `.story` files.
- If this folder has a `VOICE.md`, it describes the human author's voice and sensibility. Write in that voice: their humor, their sympathies, how their characters argue. It is about the author, not a character: never write a stand-in for the author. An arc that merely echoes theirs is fine only if it is the best choice for the story.
- `game.story` is the entry point. Other `.story` files must be listed in its `include:` header line.
- After every change run, from the engine folder:
  - `bin/shiori check <this-folder>` — must show 0 errors.
  - `bin/shiori explore <this-folder>` — every ending reachable, no runtime errors.
  - `bin/shiori vndb <this-folder>` — must stay "eligible".
- Read a route in the terminal: `bin/shiori play <this-folder> --choices 1,2,1`.
- See it in a browser: `bin/shiori serve <this-folder>` and open the printed URL (`&dev=1` adds live reload).
- Keep narration at 30%+ of the words; change expressions as emotions change; declare everything before use.
