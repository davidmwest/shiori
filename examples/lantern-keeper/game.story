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
