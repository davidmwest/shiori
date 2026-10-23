SHIORI 1
title: The Fuse Box
developer: Shiori blind test (written by an AI)
language: en
description:
  On a rainy Thursday the power goes out in a shared flat. Three housemates
  spend the same evening three different ways. Each of them misses part of the
  story, and the roof is where they finally see the whole street.
status: in_development
version: 0.1
age_rating: 0
freeware: true
platforms: web
ai_generated: story
reading_speed: 200
include: story/perspectives.story story/true_ending.story

// ---- Variables -----------------------------------------------------
@var asked_hana = false
@var fuse_checked = false
@persistent saw_true_ending = false

// ---- Characters ----------------------------------------------------
@character ren
  name: Ren
  color: #8fb8de
  sprite: chars/ren/{expression}.png
  expression: neutral smile worried tired
  role: main
  gender: male
  age: 20
  description: A second-year student who loses things and finds them again later.

@character hana
  name: Hana
  color: #f2a7a0
  sprite: chars/hana/{expression}.png
  expression: neutral tired laugh serious
  role: main
  gender: female
  age: 24
  description: Works early bakery shifts and runs the flat from a list on the fridge.

@character kei
  name: Kei
  color: #b5d99c
  sprite: chars/kei/{expression}.png
  expression: neutral focused smile
  role: main
  gender: male
  age: 26
  description: An electrician's apprentice who knows where every fuse in the building goes.

// ---- Assets --------------------------------------------------------
@image flat_hall bg/flat_hall.png title="The Hallway"
@image stairwell bg/stairwell.png
@image roof bg/roof_night.png
@image cg_candles cg/candles_hallway.png title="Candles in the Hallway"
@image cg_roof cg/roof_lights.png title="The Street, Back On"
@audio rain_theme music/rain_theme.lmn title="Thursday Rain"
@audio fridge sfx/fridge_hum.ogg volume=0.3
@audio fuse_click sfx/fuse_click.ogg volume=0.7
@position doorway x=0.82 scale=0.8

// ---- Opening -------------------------------------------------------
# open "Thursday"
@chapter "The Fuse Box" subtitle="A Thursday in March"
@scene flat_hall with=fade time=2
@music rain_theme fade=2
@ambience fridge
@weather rain intensity=1 layer=back
It rained all Thursday, the thin kind that gets under the stairwell door and stays.
At 7:42 in the evening the fridge stopped humming, and the flat went quiet in a way that felt personal.
@sound fuse_click
@ambience stop fade=1
@show ren worried at=left
@show hana neutral at=center
@show kei neutral at=right
ren (worried): Is it just us?
hana (neutral): It's the whole street. Mrs Okafor is already banging on the wall.
"Mrs Okafor": Hana! Is that you, or has the building finally got ghosts?
kei (focused): The fuse box is under the stairs. It isn't ours to fix, but I know where the spare fuses are kept.
hana (tired): Of course you do. Nobody else in this flat has ever opened that cupboard on purpose.
kei (smile): Give me ten minutes and a torch. Then you can all be annoyed at me properly.
-> hub

// ---- Hub: whose evening? -------------------------------------------
# hub "The Hallway"
@pov none
@if saw_true_ending
  Somebody has scratched LIGHTS BACK ON into the roof door since last time. You remember who.
@else
  Three doors, one hallway, and a power cut that each of them is going to blame on someone else.
* Ren's evening. -> ren_start
* Hana's evening. -> hana_start
* Kei's evening. -> kei_start
* [require endings_seen() >= 2] The roof door, which sticks. -> true_start
* Go to bed. -> early_night

# early_night "Lights Out"
@music stop fade=3
Hana gives up on finding the candles and says they will sort it all out in the morning. Nobody argues. The flat goes dark room by room, and everyone pretends they were going to sleep anyway.
@ending early_night "Lights Out" kind=normal
-> END
