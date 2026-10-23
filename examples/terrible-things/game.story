SHIORI 1
title: All the Terrible Things We Didn't Think
developer: Shiori examples
author: Shiori examples
description:
  In Shiomi, the kindest town on the coast, nobody has to keep a terrible thought.
  You climb Glass Hill, put your hands in the Keeper's hands and tell her the thought,
  and she breathes it into the kiln. It comes out as a glass bead, and you walk home
  having forgotten you ever thought it.

  Nagi is seventeen and has never climbed the hill. Then the old attendant dies, and
  the Keeper (a blind girl whose hands have turned to glass) asks for Nagi by name.
  Nagi has never met her. Nobody ever told her Nagi's name.

  A short yuri drama with horror and comedy, told from three points of view, with three endings.
language: en
status: finished
release_type: complete
version: 1.0
age_rating: 15
ero: false
freeware: true
platforms: web
dialogue_quotes: “”
title_background: hill_path
title_music: glass_hill
ai_generated: story music backgrounds sprites cgs
credits:
  Written for the Shiori engine as its showcase example.
  Story, art and music are AI-generated.
include: story/ch1.story story/interlude.story story/ch2.story story/ch3.story
include: story/ch4.story story/ch5.story story/ch6.story story/endings.story

// ---- cast -------------------------------------------------------------------
// Four characters have sprites (nagi, suzu, hinata, nemu). Kagami and Mame
// speak but are never drawn.

@character nagi
  name: Nagi
  color: #7fb7d9
  sprite: chars/nagi/{expression}.svg
  blink: chars/nagi/blink.svg
  expression: neutral smile sad surprised tears resolute
  role: protagonist
  gender: female
  age: 17
  description: The narrator. A calm girl who has never had a thought worth taking up the hill. Shiomi's new bread-bearer.

@character suzu
  name: Suzu
  color: #b48ae0
  sprite: chars/suzu/{expression}.svg
  blink: chars/suzu/blink.svg
  expression: proud soft sad surprised angry tears
  role: main
  gender: female
  age: 17
  description: The Keeper of Glass Hill, who calls herself Tamamori. Blind, theatrical, and turning to glass from the fingertips in. She is writing a song.

@character hinata
  name: Hinata
  color: #f2a541
  sprite: chars/hinata/{expression}.svg
  blink: chars/hinata/blink.svg
  expression: grin soft tired scared blush tears
  role: main
  gender: female
  age: 18
  description: Runs the Asahi bakery and raises her brother and sister. The sunniest girl in town, and the Keeper's most faithful Sunday visitor.

@character nemu
  name: Nemu
  color: #8fcf9a
  sprite: chars/nemu/{expression}.svg
  blink: chars/nemu/blink.svg
  expression: sleepy smirk surprised serious sad panic
  role: main
  gender: female
  age: 17
  description: The mayor's daughter and the council's least willing clerk. Lazy, sardonic, and a schemer whose plans always work, though never the way she meant.

@character kagami
  name: Mayor Kagami
  color: #c7c7d6
  role: side
  gender: female
  description: Nemu's mother. Kind, tired, and the keeper of the Keeper.

@character mame
  name: Mame
  color: #f7c9a0
  role: side
  gender: female
  age: 8
  description: Hinata's little sister. Has never once been afraid of anybody.

// ---- places and pictures ------------------------------------------------------

@image bakery bg/bakery.svg
@image hill_path bg/hill_path.svg
@image kiln_house bg/kiln_house.svg
@image square bg/square.svg
@image statue_garden bg/statue_garden.svg
@image seashore bg/seashore.svg
@image cg_countess cg/countess.svg title="Countess Fluorite of the Capital"
@image cg_hands cg/hands.svg title="What She Kept"
@image cg_breaking cg/breaking.svg title="All the Terrible Things"
@world glasshouse worlds/glasshouse.js marks="door aisle amber heart statue roof" camera=door animated=true

// ---- music (LMN, synthesised by the player) -------------------------------------
// Leitmotif: "Suzu's figure", five notes rising and one falling. It is hidden
// in glass_hill, a waltz in tamamori, a march in paper_lantern, broken up in
// small_hours, and complete in suzu_song. Hinata's tune from morning_bread
// comes back as the counter-melody in suzu_song.

@audio glass_hill music/glass_hill.lmn title="The Glass Hill"
@audio tamamori music/tamamori.lmn title="Tamamori the Magnificent"
@audio morning_bread music/morning_bread.lmn title="Morning Bread"
@audio paper_lantern music/paper_lantern.lmn title="Operation Paper Lantern"
@audio small_hours music/small_hours.lmn title="Small Hours"
@audio suzu_song music/suzu_song.lmn title="All the Terrible Things (Suzu's Song)"

// ---- state ------------------------------------------------------------------

@var held_baby = false       // chapter 1: Nagi held Taichi at the bakery
@var touched = false         // chapter 1: Nagi broke rule one and took the Keeper's bare hand
@var asked = 0               // questions asked in the keeper hub
@var knows_wish = false      // Nagi learned what Suzu would do if she could leave the hill
@var agreed_plan = false     // Nagi agreed to Operation Paper Lantern
@var ran_to = ""             // "hinata" or "suzu": where Nagi ran when the glass cracked
@var said_worst = false      // chapter 5: Hinata said her worst thought out loud
@var suzu_bond = 0
@var hinata_bond = 0

// ---- prologue ---------------------------------------------------------------

# prologue "Take It Up the Hill"
@chapter "Prologue" subtitle="Take It Up the Hill"
@pov nagi
@scene hill_path with=fade time=2
@music glass_hill fade=3
@camera zoom=1.25 y=0.08 time=0
@camera zoom=1 y=0 time=12
@mode nvl
In Shiomi we have a saying: {i}take it up the hill.{/i}
You say it to a friend who has been looking at the kitchen knives too long. You say it to the young mother who can't stop picturing the baby slipping under the bathwater. You say it gently, the way you'd tell someone their collar is turned up.
Because everybody has them: the thought that sits down at your table uninvited. {i}What if I pushed him. What if I let go of the pram. What if I turned the wheel and drove into the sea.{/i} In other towns people carry those thoughts for life.
In Shiomi you climb the four hundred and twelve steps of Glass Hill to the kiln-house at the top. You kneel, put your hands in the Keeper's hands, and tell her the thought. She breathes it into the fire, and it comes out of the kiln as a glass bead the size of a fingernail.
Then you walk back down the hill, and you have forgotten you ever thought it. That's the gift.
It's why the tourists call us the kindest town on the coast. Nobody here shouts. Nobody here hits their children. The fishermen hold doors open for the cats.
@clear
I'm seventeen, and I have never climbed the hill.
It isn't a principle. I've just never had a thought worth giving. Mother says I was a crier when I was small, and then one summer I stopped. {i}Like the sea on a still day,{/i} she says. That's my name, more or less: Nagi, the lull when the wind drops.
There's a summer missing from my childhood, my eighth. Mother says children don't keep summers. I've never minded. You can't miss what you don't remember. That's the whole point of the hill.
On my window hangs a glass wind chime I don't remember buying. It has never rung. My room faces the hill, and the hill keeps off the wind.
@clear
On the first morning of summer, a council clerk came to our door. Old Mrs. Toda, who had carried bread up the hill for forty years, had died, and the Keeper wanted a new attendant.
She had asked for me, by name.
I had never met the Keeper. Nobody had ever told her my name.
@if endings_seen() >= 1
  That is what I believed, that morning. I believed a great many restful things.
@clear
@mode adv
-> bakery
