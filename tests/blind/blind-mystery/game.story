SHIORI 1
title: The Locked Room at Gullhaven
developer: Shiori Blind Test
language: en
version: 0.1
status: in_development
age_rating: 12
description:
  On the second night of a storm, a guest is found dead in a room that was bolted from the inside. You arrive on the last boat, give your name, walk the inn, weigh what you find, and name the killer.
credits: Story written by an AI model (Claude) as a blind test of the Shiori specification. No human wrote the prose. Art and music paths are placeholders; the files do not exist.
ai_generated: story
reading_speed: 200
include: story/inn.story story/examine.story story/court.story

// ---- Characters ----

@character hester
  name: Hester Gull
  color: #c98a5b
  sprite: chars/hester/{expression}.png
  expression: neutral worried stern
  role: side
  gender: female
  age: 52
  description: Owns Gullhaven Inn and keeps the spare keys on a hook behind the desk.

@character tobias
  name: Tobias Marr
  color: #5b8fb9
  sprite: chars/tobias/{expression}.png
  expression: neutral nervous angry
  role: side
  gender: male
  age: 41
  description: Boatman who ferries guests across the causeway at low tide.

@character ines
  name: Dr. Ines Calloway
  color: #9d8fc9
  sprite: chars/ines/{expression}.png
  expression: calm shaken sharp
  role: side
  gender: female
  age: 36
  description: A physician from the city, staying a quiet week by the sea.

// ---- Assets ----

@image inn_hall bg/inn_hall.png
@image tern_room bg/tern_room.png
@image kitchen bg/kitchen.png
@image office bg/office.png
@image harbour bg/harbour_storm.png
@image cg_body cg/tern_room_body.png title="The Tern Room"
@audio theme music/low_tide.lmn title="Low Tide"
@audio storm sfx/storm_loop.ogg volume=0.5
@audio knock sfx/knock.ogg volume=0.8
@audio gull sfx/gull.ogg volume=0.6

// ---- Variables ----

@var detective_name = "Detective"
@var clues = 0
@var clue_draught = false
@var clue_thread = false
@var clue_boots = false
@var clue_debt = false
@var clue_hook = false
@var flavour = 0
@persistent solved_before = false

// ---- Opening ----

# prologue "Gullhaven"
@scene harbour with=fade time=2
@filter dusk time=2
@weather storm intensity=1.2 wind=0.4
@ambience storm volume=0.5
@music theme fade=2
@chapter "Part One — The Locked Room"
Gullhaven Inn sits on a finger of rock where the causeway floods twice a day. The county put you on the afternoon boat, and the boat has already gone back. You are stuck here until the tide turns.
@if solved_before
  You remember the last case you closed, and how quiet a room becomes when you finally speak.
@else
  This is your first case on the coast. You have not yet learned how loud the sea can be.
@input detective_name "What is your name, detective?" default="Nell Ashby" max=24
Good. {$detective_name}, then. The lamp in the hall flickers, as if it has heard.
-> arrival
