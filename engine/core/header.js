// Header fields of game.story. They describe the game itself and feed the
// VNDB report, the title screen and the player defaults.

export const HEADER_FIELDS = {
  title:          { type: 'string', required: true, doc: 'The game\'s title, as shown on the title screen.' },
  original_title: { type: 'string', doc: 'Title in its original script (e.g. Japanese), if different.' },
  romanized_title:{ type: 'string', doc: 'Romanization of the original title.' },
  aliases:        { type: 'string', doc: 'Other names or abbreviations, comma separated.' },
  description:    { type: 'string', doc: 'A short description of the main story (spoiler-free). Used for VNDB and store pages.' },
  developer:      { type: 'string', doc: 'Developer (person or circle).' },
  publisher:      { type: 'string', doc: 'Publisher, if different from the developer.' },
  language:       { type: 'string', default: 'en', doc: 'Language the script was written in (ISO code: en, ja, zh-Hans, ...).' },
  release_date:   { type: 'string', doc: 'YYYY-MM-DD, YYYY-MM or YYYY. Leave out if unreleased.' },
  status:         { type: 'enum:finished|in_development|cancelled', default: 'in_development', doc: 'Development status, as VNDB defines it.' },
  release_type:   { type: 'enum:complete|partial|trial', default: 'complete', doc: 'Whether this build is the complete game, a partial release or a trial.' },
  version:        { type: 'string', default: '0.1', doc: 'Your version number.' },
  age_rating:     { type: 'number', doc: 'Minimum age (0 for all ages, 12, 15, 18 ...).' },
  ero:            { type: 'bool', default: false, doc: 'Whether the game contains erotic scenes (VNDB "Contains erotic scenes").' },
  censored:       { type: 'enum:none|mosaic|bars|other|unknown', default: 'unknown', doc: 'Optical censoring of erotic graphics, if any.' },
  freeware:       { type: 'bool', default: false, doc: 'Free to download and play.' },
  doujin:         { type: 'bool', default: true, doc: 'Self-published / independent (doujin).' },
  official:       { type: 'bool', default: true, doc: 'Made or sanctioned by the original developer.' },
  platforms:      { type: 'list', default: 'web', doc: 'Platforms you release on: web, win, mac, lin, and (Android), ios.' },
  resolution:     { type: 'string', default: '1920x1080', doc: 'Native resolution, WIDTHxHEIGHT. All positions scale to it.' },
  start:          { type: 'string', doc: 'Scene to start the game at. Defaults to the first scene in game.story.' },
  author:         { type: 'string', doc: 'Writer(s), for credits.' },
  website:        { type: 'string', doc: 'Official website URL.' },
  ai_generated:   { type: 'list', doc: 'Honest disclosure of AI-generated parts that ship in the game: story, sprites, backgrounds, cgs, music, voice, sound, animation, translation, assets, or all / none. Drives the VNDB AI tags.' },
  reading_speed:  { type: 'number', default: 200, doc: 'Words per minute used for length estimates. Words are counted by spaces in any script; each Han or kana character counts as half a word, and Thai, Lao, Khmer or Myanmar text as about one word per 4 letters.' },
  text_speed:     { type: 'number', default: 45, doc: 'Default typing speed in characters per second (players can change it).' },
  auto_delay:     { type: 'number', default: 1.2, doc: 'Default auto-mode pause after a line, in seconds.' },
  dialogue_quotes:{ type: 'string', doc: 'Quote marks the textbox adds around dialogue, e.g. “” or 「」. Leave out for none.' },
  dim_inactive:   { type: 'bool', default: true, doc: 'Dim characters who are not speaking.' },
  theme:          { type: 'string', doc: 'Path to a CSS file that restyles the player.' },
  title_background:{ type: 'string', doc: 'Image or world id shown behind the title screen.' },
  title_music:    { type: 'string', doc: 'Audio id that plays on the title screen.' },
  font:           { type: 'string', doc: 'CSS font-family for story text.' },
  credits:        { type: 'string', doc: 'Free text credits shown in Extras.' },
  include:        { type: 'list', doc: 'Other .story files to load, relative to game.story. One or more per line.' },
  modules:        { type: 'list', doc: 'Your own JavaScript modules (paths relative to game.story) that add commands, effects or gameplay.' },
};

export const AI_PARTS = ['story', 'sprites', 'backgrounds', 'cgs', 'music', 'voice', 'sound', 'translation', 'assets', 'animation'];

export const PLATFORMS = { web: 'Website', win: 'Windows', mac: 'Mac OS', lin: 'Linux', and: 'Android', ios: 'Apple iProduct' };
