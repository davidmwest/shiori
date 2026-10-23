SHIORI 1
title: Untitled Visual Novel
developer: Your Name
description:
  One or two spoiler-free sentences about the story.
language: en
status: in_development
age_rating: 12
platforms: web
dialogue_quotes: “”
// Be honest about AI-made parts (story, sprites, backgrounds, cgs, music, voice), or write: none
ai_generated: none

// ---- cast (sprites are optional: missing art shows as a labelled placeholder) ----

@character hero
  name: Hana
  color: #f2a7c3
  sprite: chars/hana/{expression}.png
  expression: neutral smile sad surprised
  role: protagonist

@character friend
  name: Yui
  color: #a9b8ff
  sprite: chars/yui/{expression}.png
  expression: neutral smile worried
  role: main

// ---- places and music ----

@image classroom bg/classroom.png
@image rooftop bg/rooftop.png
@var courage = 0

# start "Prologue"
@scene classroom with=fade
@weather dust layer=back intensity=0.5
The last bell has already rung. Dust turns slowly in the light from the windows.
@show friend neutral at=right
friend: You're still here?
@show hero neutral at=left
hero (smile): So are you.

* Ask her to come to the roof.
  @set courage += 1
  hero: Want to see something?
  friend (smile): ...Okay.
  -> rooftop
* Say goodbye.
  friend (worried): See you tomorrow, then.
  @ending tomorrow "See You Tomorrow" kind=normal
  -> END

# rooftop "The Roof"
@scene rooftop with=dissolve time=1.5
The wind up here smells of rain that hasn't arrived yet.
@show friend smile at=center
friend: It's beautiful.
@if courage >= 1
  hero (smile): I almost didn't ask.
@ending roof "The Roof" kind=good
-> END
