SHIORI 1
title: The Quiet Spoke
developer: Blind Test Circle
author: Claude (AI)
description:
  Halcyon Ring turns above a storm-banded gas giant: three thousand people on a wheel of steel. On the night shift, comms officer Teo Marsh picks up a distress beacon from Spoke C, sealed since the accident nine years ago.

  The beacon's call sign belongs to a dead man. His daughter is the engineer on call.
language: en
status: finished
release_type: complete
version: 1.0
age_rating: 12
ero: false
freeware: true
platforms: web
resolution: 1920x1080
ai_generated: story
title_music: theme
title_background: bg_observation
include: story/spoke.story

// ── Cast ─────────────────────────────────────────────

@character teo
  name: Teo Marsh
  color: #6fc3df
  sprite: chars/teo/{expression}.png
  expression: neutral smile tense sad
  role: protagonist
  gender: male
  age: 29
  description: Night-shift communications officer on Halcyon Ring. Good at listening; bad at saying the hard thing.

@character ines
  name: Ines Calder
  color: #f0a35e
  sprite: chars/ines/{expression}.png
  expression: neutral smile worried determined shocked
  role: protagonist
  gender: female
  age: 34
  description: Station engineer. Her father, the chief engineer, died when Spoke C was sealed nine years ago.

@character halvorsen
  name: Director Halvorsen
  color: #b8b8d0
  sprite: chars/halvorsen/{expression}.png
  expression: neutral stern tired
  role: side
  gender: female
  age: 58
  description: Station director. She signed the inquiry report on Spoke C.

// ── Assets ───────────────────────────────────────────

@image bg_ops bg/ops_deck.png
@image bg_lock bg/spoke_lock.png
@image bg_observation bg/observation_lounge.png
@image cg_ring cg/ring_dawn.png title="Ring Dawn"
@video op movies/opening.webm title="Opening"
@world spoke worlds/station.js marks="airlock corridor hub viewport beacon" camera=airlock animated=true
@model beacon_unit models/beacon.glb

@audio theme music/quiet_spoke_theme.lmn title="The Quiet Spoke (Main Theme)"
@audio ops_loop music/night_shift.lmn title="Night Shift"
@audio spoke_cue music/cold_spoke.lmn title="Cold Spoke"
@audio resolve music/open_channel.lmn title="Open Channel"
@audio hum sfx/station_hum.ogg volume=0.5
@audio ping sfx/beacon_ping.ogg
@audio hiss sfx/airlock_hiss.ogg

// ── State ────────────────────────────────────────────

@var trust = 0
@var told_director = false

// ── Part One: Teo ────────────────────────────────────

# opening "Night Shift"
@scene black
@video op kind=opening
@chapter "Part One — Signal" subtitle="Teo"
@scene bg_ops with=fade time=2
@music ops_loop fade=2
@ambience hum
@pov teo
Halcyon Ring turns once every ninety seconds, and at three in the morning the ops deck turns with it in near silence.
Twelve consoles, eleven of them asleep. Mine glows green beside a cup of tea I forgot to drink an hour ago.
Through the long window under my feet, the gas giant rolls past in bands of rust and cream.
@show teo neutral at=center
teo: Ops to Hydroponics, your humidity alarm is a sensor fault again. Go back to bed.
Nobody answers. Nobody ever answers at three in the morning. That is most of what I like about the job.
@sound ping
@camera zoom=1.15 time=1.5
Then a tone I have only ever heard in training. Three short, three long, three short.
teo (tense): That's not possible.
The source tag reads SPOKE C. Spoke C has been sealed for nine years, since the night it lost pressure with the chief engineer inside it.
Operator error, the inquiry said. I was a cadet then. I remember the memorial, and the daughter who did not cry at it.
The beacon carries a call sign. I read it twice, then a third time, because surely the third time it will be different.
| CALDER-ONE.
@camera reset time=1
I call the engineer on duty. It takes her four minutes to reach the deck, hair still wet, jacket half zipped.
@move teo at=left
@show ines neutral at=right
ines: You said urgent. You never say urgent.
teo (tense): There's a beacon transmitting. Inside the sealed spoke.
ines (worried): The old relay. It squeals when the ring flexes. I've asked them to pull it a hundred times.
She leans over my shoulder. I watch her read the source tag, and I watch her not read the call sign yet.
teo (sad): Ines...

* Tell her whose call sign it is.
  @set trust += 1
  teo (sad): It's broadcasting as Calder-One.
  For a long moment she does not move at all. Then she sets one hand flat on the console, as if the deck might tilt.
  ines (shocked): That was Dad's suit.
  ines (determined): Thank you. For not making me find it on my own.
* Tell her it's probably the relay.
  teo (neutral): You're right. Probably the relay.
  ines (neutral): Probably.
  Then her eyes reach the end of the line on the screen. Her mouth goes thin, and for a while she will not look at me.
  ines (worried): Calder-One. You were going to let me walk in there blind.

The protocol card is taped to the side of my console, yellow with age. Any signal from a sealed section goes to the Director, immediately.
ines (determined): I'm going over there. Give me an hour before you wake her.

* Wake the Director now.
  @set told_director = true
  teo (tense): I can't. It's the rules, Ines. They're there for a reason.
  She is already at the door when the Director answers, voice thick with sleep and then suddenly not.
  ines (worried): Fine. Then I'd better be quick.
* Give her the hour.
  @set trust += 1
  teo (smile): One hour. Then I wake everyone.
  ines (smile): That's all I need.
  She squeezes my shoulder on her way out. I log the signal as "under investigation" and feel like a thief.

@hide ines
The door sighs shut. On my screen the beacon keeps calling, patient as a heartbeat.
-> ines_lock
