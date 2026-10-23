// VNDB report: an ADVISORY read of a game against VNDB's inclusion
// guidelines (https://vndb.org/d2#1), plus a draft of its database entry
// (https://vndb.org/d2, https://vndb.org/d3). Tag ids are VNDB's own.
//
// VNDB's editors decide inclusion by looking at the game as a whole; the
// author is responsible for compliance. This report only points at what
// they would look at. The 99% and 50% reading shares come from VNDB's text;
// the narration and segment-length thresholds are Shiori's rules of thumb.
//
// VNDB's rules, in short:
//   * "Visual Novels": choices are the only interaction; mini-games and map
//     movement only if at least 99% of the title is pure reading; told in
//     ADV, NVL or a variation.
//   * "VN / game hybrids": consistently uses novel narrative (narration of
//     visuals, events, actions, thoughts — dialogue alone does not count),
//     at least 50% pure VN-style reading, and reading segments that are not
//     constantly interrupted.

import { analyze } from './analyze.js';
import { PLATFORMS } from './header.js';

const TAG = {
  adv: ['g32', 'ADV'], nvl: ['g43', 'NVL'], mixing: ['g2734', 'ADV/NVL Mixing'], briefNvl: ['g355', 'Brief NVL Scenes'],
  kinetic: ['g709', 'Kinetic Novel'], multi: ['g148', 'Multiple Endings'], single: ['g146', 'Single Ending'],
  branching: ['g606', 'Branching Plot'], unlock: ['g459', 'Unlockable Routes'],
  rt3d: ['g417', 'Realtime 3D'], g3d: ['g3560', '3D Graphics'],
  ai_story: ['g3664', 'AI-generated Story'], ai_sprites: ['g3884', 'AI-generated Sprites'], ai_backgrounds: ['g3883', 'AI-generated Backgrounds'],
  ai_cgs: ['g3885', 'AI-generated CGs'], ai_music: ['g3790', 'AI-generated Music'], ai_voice: ['g3822', 'AI-generated Voice Acting'],
  ai_assets: ['g3684', 'AI-generated Assets'], ai_animation: ['g4210', 'AI-generated Animation'], ai_graphics: ['g3663', 'AI-generated Graphics'],
};

export function vndbReport(program, opts = {}) {
  const a = opts.analysis || analyze(program);
  const ex = opts.exploration || null;
  const h = program.header;
  const checks = [];
  const add = (id, status, title, detail, fix) => checks.push({ id, status, title, detail, fix });

  // 1. Interactivity
  const gameplayUses = a.games.filter(g => g.reachable);
  const share = a.readingShare;
  let classification;
  if (!gameplayUses.length) {
    classification = 'vn';
    add('interactivity', 'pass', a.menus ? 'Choices are the only interaction' : 'No interaction at all (kinetic novel)',
      a.menus ? `${a.menus} choice menu${a.menus === 1 ? '' : 's'}${a.inputs ? `, ${a.inputs} text input${a.inputs === 1 ? '' : 's'} (e.g. name entry)` : ''}, no gameplay — the shape of VNDB's "Visual Novels" category.` : 'No choices and no gameplay.');
  } else if (share >= 0.99) {
    classification = 'vn';
    add('interactivity', 'pass', 'Gameplay plays a very minimal role',
      `About ${(share * 100).toFixed(1)}% of the estimated play time is reading (VNDB's guideline for a pure visual novel is at least 99%). Gameplay: ${summGames(gameplayUses)}. The estimate uses the minutes you declared on @gameplay.`);
  } else if (share >= 0.5) {
    classification = 'hybrid';
    add('interactivity', 'info', 'Reads as a visual novel / game hybrid',
      `About ${(share * 100).toFixed(1)}% of the estimated play time is reading (VNDB's guidelines: 99% for a pure VN, at least 50% for a hybrid). Gameplay: ${summGames(gameplayUses)}.`,
      'For hybrids VNDB also looks for real narration and long, uninterrupted reading (see below).');
  } else {
    classification = 'none';
    add('interactivity', 'warn', 'Mostly gameplay',
      `About ${(share * 100).toFixed(1)}% of the estimated play time is reading; VNDB's guideline for hybrids is at least 50%. Gameplay: ${summGames(gameplayUses)}.`,
      'Fine if this is the game you want; it may just not be a visual novel by VNDB\'s definition.');
  }

  // 2. Presentation
  const modes = [];
  if (a.modes.adv) modes.push('ADV (textbox)');
  if (a.modes.nvl) modes.push('NVL (full-screen text)');
  add('presentation', 'pass', 'Uses a recognised VN presentation',
    `All text is shown ${modes.join(' and ') || 'in ADV'}. Shiori never uses speech bubbles (VNDB rejected 13 Sentinels partly for its speech bubbles).`);

  // 3. Novel narrative
  const ns = a.narrationShare;
  const nsText = `${(ns * 100).toFixed(0)}% of the words are narration (${a.narrationLines} of ${a.lines} lines).`;
  // VNDB gives no number here; 15% and 5% are rules of thumb.
  if (ns >= 0.15) add('narration', 'pass', 'Tells the story through narration as well as dialogue', nsText);
  else if (ns >= 0.05) add('narration', 'info', 'Narration is thin', nsText + ' VNDB stresses that dialogue alone does not make a visual novel (no fixed share; 15% is a rule of thumb).', 'Describe places, actions and thoughts in plain narration lines.');
  else add('narration', 'warn', 'Almost no narration', nsText + ' VNDB removed games with no narration (Persona 3/4, Ghost Trick, To The Moon).', 'Add narration: plain lines describing what is seen, done and felt.');
  if (a.maxDialogueRun.length >= 40) {
    add('dialogue_run', 'info', 'Long stretch of dialogue with no narration',
      `${a.maxDialogueRun.length} dialogue lines in a row in scene \`${a.maxDialogueRun.scene}\`${a.maxDialogueRun.loc ? ` (from ${a.maxDialogueRun.loc.file}:${a.maxDialogueRun.loc.line})` : ''}.`,
      'Break it up with narration of gestures, setting and inner thoughts.');
  }

  // 4. Uninterrupted reading
  const med = a.medianLinesBetweenInteractions;
  if (classification === 'hybrid') {
    // "A significant amount of time" — 15 lines is a rule of thumb.
    if (med < 15) add('segments', 'info', 'Reading is interrupted often', `The median reading segment is ${med} lines between interactions.`, 'VNDB wants storytelling segments that run uninterrupted for a significant time (15+ lines is a rule of thumb).');
    else add('segments', 'pass', 'Reading segments are long', `The median reading segment is ${med} lines between interactions.`);
  } else if (a.menus || a.inputs) {
    add('segments', 'info', 'Reading segments', `Median of ${med} lines between choices${a.inputs ? '/inputs' : ''}.`);
  }

  // 5. Things only a person can check
  add('stats', 'manual', 'No stats-based gameplay',
    'Hidden affection points are fine. Visible stat-raising (dating/raising-sim style) counts as gameplay under VNDB rules. Check that no @gameplay module is a stat raiser.');
  if (!a.reachableWords) add('content', 'warn', 'No reachable text', 'The game shows no text from its start scene.');
  if (ex) {
    if (ex.errors.length) add('runtime', 'warn', 'Runtime errors on some routes', `${ex.errors.length} problem(s); run \`shiori explore\` for details.`);
    if (ex.truncated) add('explore', 'info', 'Route exploration was cut short', `The story has too many states to explore within --max-states ${ex.maxStates}; ending counts come from the @ending declarations instead.`);
    else if (ex.unreachedEndings.length) add('endings', 'warn', 'Some endings can never be reached', ex.unreachedEndings.map(e => `${e.title} [${e.id}]`).join(', ') + '.', 'Run `shiori explore` to see why.');
  }

  // 6. AI disclosure
  const ai = (h.ai_generated || []).filter(x => x !== 'none');
  if (!h.ai_generated) add('ai', 'manual', 'Declare AI-generated content',
    'VNDB accepts AI-made games but tags them (AI-generated Story, Music, Sprites ...). If any part was generated, add `ai_generated: story music ...` to game.story.');
  else if (!ai.length) add('ai', 'info', 'No AI-generated content declared', '`ai_generated: none`.');
  else add('ai', 'info', 'AI-generated content is disclosed', `Declared: ${ai.join(', ')}. Matching VNDB tags are listed below.`);

  // ---- release draft ------------------------------------------------------
  const chars = Object.values(program.decls.characters);
  const lipEye = chars.some(c => c.blink || c.mouth);
  const usesModels = a.threeD && chars.some(c => c.model);
  const animatedImages = Object.values(program.decls.assets).some(x => (x.kind === 'image' && x.opts.animated && x.usedAs && x.usedAs.cg));
  const bgEffects = a.weather.length > 0 || Object.values(program.decls.assets).some(x => (x.kind === 'world' && x.used && x.opts.animated !== false) || (x.kind === 'image' && x.opts.animated && !(x.usedAs && x.usedAs.cg)) || (x.kind === 'video' && x.opts.loop));
  const cutscenes = a.videos.filter(v => v.kind === 'cutscene').length;
  const voiced = a.voicedDialogueShare === 0 ? 'Not voiced' : a.voicedDialogueShare >= 0.9 ? 'Fully voiced' : 'Partially voiced';
  const release = {
    title: h.title, original_title: h.original_title || null, romanized: h.romanized_title || null,
    type: h.release_type, status: h.status, released: h.release_date || 'TBA',
    language: h.language, machine_translation: ai.includes('translation') || ai.includes('all'),
    platforms: (h.platforms || []).map(p => PLATFORMS[p] || p),
    engine: 'Shiori', resolution: `${h.width}x${h.height}`,
    voiced, has_ero: !!h.ero, min_age: h.age_rating != null ? h.age_rating : (h.ero ? 18 : null),
    freeware: !!h.freeware, doujin: !!h.doujin, official: !!h.official, censoring: h.ero ? h.censored : 'n/a',
    animation: {
      story_sprites: usesModels ? '3D (realtime models)' : 'No animation',
      story_cgs: animatedImages ? 'Animated (set the type: hand drawn / vectorial / 3D)' : (a.cgs.length ? 'No animation' : 'No CGs'),
      cutscenes: cutscenes ? `${cutscenes} cutscene video(s) (set the type)` : 'None',
      lip_eye_movement: lipEye, background_effects: bgEffects,
      note: 'Zooms, shakes and sprite movement are not "animation" by VNDB rules; Shiori\'s idle breathing counts as none.',
    },
    website: h.website || null,
    developer: h.developer || null, publisher: h.publisher || h.developer || null,
  };

  // ---- tags ----------------------------------------------------------------
  const tags = [];
  const tag = (k, why) => tags.push({ id: TAG[k][0], name: TAG[k][1], why });
  if (a.modes.adv && a.modes.nvl) {
    tag('mixing', 'Uses both ADV and NVL modes.');
    if (a.modes.nvl / (a.modes.adv + a.modes.nvl) < 0.1) tag('briefNvl', 'NVL is under 10% of the text.');
  } else if (a.modes.nvl) tag('nvl', 'All text is NVL.');
  else tag('adv', 'All text is ADV.');
  if (!a.menus && !gameplayUses.length) tag('kinetic', 'No choices.');
  // Endings are declared statically; exploration can only confirm them.
  const nEnd = ex && !ex.truncated ? Math.max(ex.endings.filter(e => e.id !== 'END').length, a.endings.length - ex.unreachedEndings.length) : a.endings.length;
  if (nEnd >= 2) tag('multi', `${nEnd} endings.`);
  else if (a.menus) tag('single', 'Choices but one ending.');
  if (a.branching) tag('branching', 'Choices lead to different scenes.');
  if (a.usesPersistentConditions.ending_seen || a.usesPersistentConditions.persistent) tag('unlock', 'Some content depends on endings or other playthroughs.');
  if (a.threeD) { tag('rt3d', 'Uses real-time 3D worlds.'); tag('g3d', 'Uses 3D graphics.'); }
  const aiMap = { story: 'ai_story', sprites: 'ai_sprites', backgrounds: 'ai_backgrounds', cgs: 'ai_cgs', music: 'ai_music', voice: 'ai_voice', assets: 'ai_assets', animation: 'ai_animation' };
  const aiAll = ai.includes('all');
  for (const [part, k] of Object.entries(aiMap)) if (aiAll || ai.includes(part)) tag(k, `Declared in ai_generated: ${aiAll ? 'all' : part}.`);
  if (aiAll || ai.some(p => ['sprites', 'backgrounds', 'cgs'].includes(p))) tag('ai_graphics', 'Some graphics are AI-generated.');

  const hours = a.readingHours;
  const vn = {
    title: h.title, original_title: h.original_title || null, aliases: h.aliases || null,
    description: h.description || null, devstatus: h.status === 'finished' ? 'Finished' : h.status === 'cancelled' ? 'Cancelled' : 'In development',
    length: (h.release_type === 'complete')
      ? { estimate_hours: Math.round(hours * 10) / 10, category: a.lengthCategory.name, words: a.reachableWords, note: `Estimated at ${h.reading_speed} words/minute for all reachable text; VNDB's length is voted by players.` }
      : { note: 'VNDB leaves Length empty for partial and trial releases.' },
    original_language: h.language,
  };
  const characters = chars.map(c => ({ id: c.id, name: c.name, original: c.vndb.original_name || null, role: c.vndb.role || (c.spoke ? 'side' : 'appears'), gender: c.vndb.gender || null, age: c.vndb.age || null, description: c.vndb.description || null, voice: c.vndb.cv || null, lines: (a.perCharacter[c.id] || {}).lines || 0 }));

  const worst = checks.some(c => c.status === 'warn');
  const verdict = classification === 'none' ? 'may fall outside VNDB\'s definition of a visual novel'
    : classification === 'hybrid' ? 'reads like a visual novel / game hybrid' + (worst ? ', with notes' : '')
    : 'reads like a visual novel' + (worst ? ', with notes' : '');
  return {
    verdict,
    likely: classification !== 'none',
    classification: classification === 'vn' ? 'Visual novel' : classification === 'hybrid' ? 'Visual novel / game hybrid' : 'Possibly not a visual novel (by VNDB\'s guidelines)',
    checks, release, vn, tags, characters,
    manual: [
      'A VNDB entry needs a real, public game: released, or announced with official information (VNDB status "In development").',
      'Cover image: only official art (box art, store header or official promotional image).',
      'Screenshots: from the game itself, not edited.',
      'Producer entry: create one for the developer (you or your circle) if it does not exist.',
      'Do not add an edition for an unreleased project unless a partial build was actually distributed.',
    ],
    stats: { words: a.reachableWords, lines: a.lines, scenes: a.scenes, menus: a.menus, endings: nEnd, hours: Math.round(hours * 10) / 10 },
  };
}

function summGames(list) {
  const by = {};
  for (const g of list) by[g.id] = (by[g.id] || 0) + g.minutes;
  return Object.entries(by).map(([k, m]) => `${k} (~${m} min)`).join(', ');
}

const ICON = { pass: '✓', warn: '⚠', fail: '✗', info: 'ℹ', manual: '☐' };

export function formatVndb(r) {
  const out = [];
  out.push(`# VNDB report — ${r.release.title}`);
  out.push('');
  out.push(`**Advisory reading:** ${r.verdict}.`);
  out.push('');
  out.push('_VNDB\'s editors decide what is included by looking at the whole game, and complying is the author\'s call. This report only points at what they would look at, and drafts the entry for you._');
  out.push('');
  out.push('## Against VNDB\'s guidelines (vndb.org/d2 §1)');
  for (const c of r.checks) {
    out.push(`- ${ICON[c.status]} **${c.title}.** ${c.detail}${c.fix ? `\n  - ${c.fix}` : ''}`);
  }
  out.push('');
  out.push('## Visual novel entry (draft)');
  out.push(`- Title: ${r.vn.title}${r.vn.original_title ? ` / ${r.vn.original_title}` : ''}`);
  if (r.vn.aliases) out.push(`- Aliases: ${r.vn.aliases}`);
  out.push(`- Original language: ${r.vn.original_language}`);
  out.push(`- Development status: ${r.vn.devstatus}`);
  out.push(r.vn.length.category ? `- Length: ${r.vn.length.category} (≈${r.vn.length.estimate_hours} h, ${r.vn.length.words.toLocaleString('en-US')} words). ${r.vn.length.note}` : `- Length: ${r.vn.length.note}`);
  out.push(`- Description: ${r.vn.description || '(add `description:` to game.story)'}`);
  out.push('');
  out.push('## Release entry (draft)');
  const rel = r.release;
  out.push(`- Type: ${rel.type} · Released: ${rel.released} · Language: ${rel.language}${rel.machine_translation ? ' (machine/AI translation)' : ''}`);
  out.push(`- Platforms: ${rel.platforms.join(', ') || '—'} · Engine: ${rel.engine} · Resolution: ${rel.resolution}`);
  out.push(`- Voiced: ${rel.voiced} · Contains erotic scenes: ${rel.has_ero ? 'yes' : 'no'} · Minimum age: ${rel.min_age != null ? rel.min_age + '+' : 'not set (add `age_rating:`)'}`);
  out.push(`- Freeware: ${rel.freeware ? 'yes' : 'no'} · Doujin: ${rel.doujin ? 'yes' : 'no'} · Official: ${rel.official ? 'yes' : 'no'}${rel.has_ero ? ` · Censoring: ${rel.censoring}` : ''}`);
  out.push(`- Animation — story sprites: ${rel.animation.story_sprites}; CGs: ${rel.animation.story_cgs}; cutscenes: ${rel.animation.cutscenes}; lip/eye movement: ${rel.animation.lip_eye_movement ? 'yes' : 'no'}; background effects: ${rel.animation.background_effects ? 'yes' : 'no'}.`);
  out.push(`  - ${rel.animation.note}`);
  if (rel.developer) out.push(`- Developer: ${rel.developer}${rel.publisher && rel.publisher !== rel.developer ? ` · Publisher: ${rel.publisher}` : ''}`);
  out.push('');
  out.push('## Suggested tags');
  for (const t of r.tags) out.push(`- [${t.name}](https://vndb.org/${t.id}) — ${t.why}`);
  out.push('');
  if (r.characters.length) {
    out.push('## Characters');
    for (const c of r.characters) out.push(`- **${c.name}**${c.original ? ` (${c.original})` : ''} — role: ${c.role}${c.gender ? `, ${c.gender}` : ''}${c.age ? `, age ${c.age}` : ''}${c.voice ? `, CV ${c.voice}` : ''}, ${c.lines} lines${c.description ? `. ${c.description}` : ''}`);
    out.push('');
  }
  out.push('## Still to do by hand');
  for (const m of r.manual) out.push(`- ☐ ${m}`);
  return out.join('\n');
}
