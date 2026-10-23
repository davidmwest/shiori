SHIORI 1
title: Three Fourteen
developer: Claude
author: Claude (an AI model by Anthropic)
language: en
description:
  Natsu works nights at the Seaview Mart, the only lit building on a coast road that is always under fog.
  Every night at 3:14 the same man comes in and buys one hot can of milk tea, and every night he leaves it on the counter.

  A short kinetic novel of quiet psychological horror. No choices, one ending.
status: finished
release_type: complete
version: 1.0
age_rating: 15
ero: false
freeware: true
platforms: web
ai_generated: story
dialogue_quotes: “”
title_background: lot_fog
title_music: night_shift

// ---------------------------------------------------------------- cast

@character natsu
  name: Natsu
  color: #9fc6c1
  side: chars/natsu/side_{expression}.png
  expression: neutral tired uneasy afraid calm
  role: protagonist
  gender: female
  age: 24
  description: The night-shift clerk at the Seaview Mart on Route 9. Very good at her job.

@character man
  name: The Regular
  color: #a8a8b3
  sprite: chars/man/{expression}.png
  expression: neutral tired grieving
  role: main
  gender: male
  age: 41
  description: A man in a grey coat who comes in at 3:14 every night and buys one hot can of milk tea.

// ---------------------------------------------------------------- assets

@image store_night bg/store_interior_night.png
@image counter bg/store_counter.png
@image backroom bg/store_backroom.png
@image lot_fog bg/parking_lot_fog.png
@image cg_cans cg/cans_in_rows.png title="Inventory"
@image cg_monitor cg/camera_two.png title="Camera Two"

@audio night_shift music/night_shift.ogg title="Night Shift"
@audio last_customer music/last_customer.ogg title="The Last Customer"
@audio hum sfx/fluorescent_hum.ogg volume=0.5
@audio static sfx/monitor_static.ogg volume=0.6
@audio chime sfx/door_chime.ogg
@audio register sfx/register_drawer.ogg
@audio can_set sfx/can_on_counter.ogg

// ---------------------------------------------------------------- story

# shift "Night 364"
@chapter "Night 364" subtitle="2:40 a.m."
@scene store_night with=fade time=2
@filter night
@weather fog intensity=0.3 layer=back
@ambience hum
@music night_shift fade=3
@mode nvl

The Seaview Mart on Route 9 is the only lit thing for eleven kilometres in either direction. From the road it must look like an aquarium somebody forgot to switch off: white light, white shelves, and me.

I have worked the night shift here for{w=0.6} a long time. Long enough to face the rice balls with my eyes shut. Tuna-mayo at the front, salmon behind, pickled plum at the end where nobody reaches.

The fog comes up off the sea at about one. By two it has eaten the car park, the pumps, the bus stop and the sign. I stopped minding years ago. Or months. The glass doors give back a clean reflection of the shop, and in the reflection I look fine.

@camera zoom=1.1 x=-0.05 time=4

Nobody phones. The manager used to ring at four to ask whether the till balanced. I can't remember when he stopped. It always balances. Every night the drawer holds exactly what it held when I came in, down to the last one-yen coin.

The clock above the door is a cheap one with a sticky second hand. It doesn't tick from 3:13 to 3:14. It jumps, as if somebody has pushed it.

And at 3:14, every night, the door chimes.

@camera reset time=1
@sound chime
@clear
@bg counter with=dissolve time=0.8
@show man neutral at=center with=dissolve time=1

He comes in out of the fog slowly, the shoulders of his grey coat dark with wet. He is forty, maybe. He looks as though he hasn't slept since he was thirty.

He doesn't look at me. He never does. His eyes always land a little to the left of my face, on the cigarette shelf, as though I'm standing next to myself.

@sound can_set
He takes one can of Royal Milk Tea from the hot case and sets it on the counter with both hands, carefully, like an offering.

@mode adv
natsu (neutral): Good evening. Just the one?
man (tired): Just the one.
@sound register
natsu: That's a hundred and forty yen.

He lays the coins on the counter rather than in my palm. A hundred, a fifty. He never waits for change.

man (tired): Keep it. For later.
natsu (tired): You say that every night.
man: I'm sorry.

@hide man with=dissolve time=1
@sound chime
@mode nvl

He says that every night too. The door sighs shut behind him, and the fog closes over him like water over a stone.

@bg backroom with=dissolve time=1.2
@filter vignette

I take the can into the back room. I always do. It doesn't feel right to sell it to somebody else.

@cg cg_cans with=dissolve time=1.5

They stand on the steel shelving where the spare till rolls used to be. Row after row of brown-and-gold cans, labels facing out, the way I'd face them on the shop floor. The oldest ones have gone furry with dust. Not one has ever been opened.

I count them, because counting is part of the job. {w}Three hundred and sixty-four.

It's my brand. I used to drink one on my break, at 3:15, standing at the back door with the fog on my face. I don't know when I stopped taking breaks.

I don't know how he knew.

@cg none with=dissolve
@clear
-> night_365

# night_365 "Night 365"
@scene black with=fade time=1.5
@chapter "Night 365" subtitle="3:05 a.m."
@scene store_night with=fade time=2
@filter night
@weather fog intensity=1.2 layer=back
@ambience hum
@music night_shift fade=3
@mode nvl

The fog is thicker tonight. It has come right up to the doors and rests its forehead against the glass.

I notice the monitor at five past three.

It lives under the counter, by my knees: a little black-and-white screen split into four, one square for each camera. For as long as I've worked here it has shown nothing but snow. I had forgotten it was plugged in.

@sound static
@camera zoom=1.15 y=0.08 time=3

Tonight one square is clear. Camera Two, the one above the register.

I don't look at it. I tell myself I'll look at it after.

@camera reset time=1

At 3:14 the clock jumps, and the door chimes.

@sound chime
@clear
@bg counter with=dissolve time=0.8
@show man grieving at=center with=dissolve time=1

He has flowers tonight. White chrysanthemums in cellophane, the kind they sell at petrol stations, held the way you'd hold something that might spill.

@sound can_set
He takes the can from the hot case and puts it on the counter. He lays the flowers down beside it.

@mode adv
natsu (uneasy): Good evening. ...Is it somebody's birthday?
man (grieving): It's been a year.
natsu (uneasy): Sorry?
man (grieving): A year tonight. {w}I thought it would get easier, coming in.

His hands are shaking, and not from the cold. The coins rattle on the counter like teeth.

natsu (afraid): Sir, I don't{w=0.4} —
man (grieving): {shake}I'm sorry.{/shake} {w=0.6}I'm so sorry.

@clear
@mode nvl
He is talking to the cigarette shelf. He is crying at the cigarette shelf.

And because I don't know what else to do with my eyes, I look down at Camera Two.

@music stop fade=0.3
@ambience stop fade=0.3
@textbox hide
@flash color=white time=0.8
@shake strength=0.8 time=0.6
@filter noir time=0.2
@cg cg_monitor with=none
@pause
-> camera_two

# camera_two "Camera Two"
@mode nvl
@ambience static

On the monitor, the shop is dark.

The shelves are bare. The hot case is unplugged, its little door hanging open. A sheet of plywood has been screwed over the place where the front window used to be, and the fog leaks in around its edges in grey threads.

A man in a wet coat stands at the counter with a torch tucked under his arm. He has put down a can. He has put down flowers. The counter in front of him is covered, {w}every centimetre of it, {w}in cans of milk tea. Three hundred and sixty-four of them, brown and gold and furred with dust.

In the middle of them, in a cheap frame, there is a photograph of a girl in a Seaview Mart uniform, squinting at whoever held the camera.

On the monitor, there is nobody behind the counter.

{shake}There is nobody behind the counter.{/shake}

@cg none with=dissolve time=0.6
@filter night time=0.4
@ambience hum

I look up.

The lights are on. The shelves are full. The rice balls are faced, tuna-mayo at the front. The man is right there, close enough to touch, and he is looking a little to the left of my face. {w}At the place where the girl in the photograph would be standing, if she were standing next to herself.

@clear
@mode adv
man (grieving): The fog was like this. I didn't see the bend. I didn't see your lights until I was inside them.
man (grieving): They told me you wouldn't have felt anything. {w}I come here so I don't have to believe them.
natsu (afraid): {shake}I'm right here.{/shake}

He doesn't hear me. He has never heard me. Three hundred and sixty-five nights of “Good evening” and “Just the one?”, and he has been answering a dark room.

natsu (calm): ...You can stop coming. {w}It's all right. You can stop now.

For a moment his eyes move. Not to me. Past me, to the clock above the door, which says 3:14. Which has always said 3:14.

man (tired): Goodnight, Natsu.

@hide man with=dissolve time=2
@sound chime
-> after

# after "After"
@mode nvl
@bg lot_fog with=dissolve time=2
@music last_customer fade=4
@filter vignette time=2
@weather fog intensity=1.6 layer=front

The door sighs shut. The fog closes over him like water over a stone, and this time I watch until there is nothing left to watch.

Nobody has ever said my name in here before. I didn't know I had been waiting for it.

@bg backroom with=dissolve time=1.5

I carry the can into the back room, because it wouldn't feel right to sell it to somebody else, and I set it at the end of the row with the label facing out.

Three hundred and sixty-five.

I stand there a long time with my hand on the cold metal. I think about the back door, and the break I stopped taking, and what is on the other side of the fog if you walk into it far enough.

Then I go back out to the register.

@bg store_night with=dissolve time=1.5

Because the shift isn't over. Because the till has to balance. Because the clock above the door has just jumped{w=1.0} from 3:13 to 3:14.

@camera zoom=1.2 time=4

Out in the fog, the door chimes.

@sound chime

I straighten my name badge. I am very good at my job.

@mode adv
natsu (calm): Good evening. {w=0.8}Just the one?

@music stop fade=4
@scene black with=fade time=3
@ending three_fourteen "Three Fourteen" kind=normal
-> END
