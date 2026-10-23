SHIORI 1

// ── Part Two: Ines ───────────────────────────────────

# ines_lock "The Lock"
@chapter "Part Two — Spoke C" subtitle="Ines"
@scene bg_lock with=fade
@pov ines
@ambience stop fade=2
@music spoke_cue fade=3
The lock to Spoke C is painted over with nine years of warning stripes.
I know the override code. Everyone in engineering knows it. Nobody has said it aloud since the memorial.
@show ines determined at=center
ines: Teo, I'm at the lock. Pressure on the far side reads... normal. Breathable.
teo (tense): It shouldn't be. They vented it.
ines (worried): I know what they did.
@if told_director
  halvorsen (stern): Engineer Calder. You will look, and you will touch nothing. Is that understood?
  The Director's voice comes thin over the channel. Behind it I can hear Teo breathing carefully, like a man trying not to be in the room.
  ines (neutral): Understood, Director.
@else
  teo (smile): Fifty minutes left on your hour. Go carefully.
  ines (smile): I always go carefully. That's the whole job.
I type the code. My fingers remember it better than I do.
@sound hiss
@shake strength=0.4 time=0.6
The seal lets go with a long, tired sigh, and cold air pours past my ankles.
-> ines_spoke

// The one 3D sequence: the inside of the sealed spoke.
# ines_spoke "Inside the Spoke"
@scene spoke with=fade time=2
@weather dust intensity=0.4
@camera from=airlock look=corridor time=3 wait=true
The corridor runs ahead of me, straight up toward the hub. Up, because the spoke points at the station's heart, and the weight drains out of you with every rung.
Emergency strips still glow along the floor. Nobody turned them off. Nobody came back to.
@camera from=corridor look=hub time=4 wait=true
I climb. Somewhere past the halfway mark my boots stop wanting the floor, and I pull myself along the rail hand over hand.
@show ines worried at=left
ines: Teo, there are handprints in the frost. Old ones. Going the wrong way.
teo (tense): Which way is the wrong way?
ines (worried): Toward the hub. Away from the lock.
@camera from=hub look=viewport fov=70 time=3 wait=true
The hub opens around me, a drum of dark panels. On the far wall the viewport is full of the giant's storm, slow and endless.
Dad used to bring me up here when I was small. He said the storm was older than the station, older than Earth's oceans, and it would never stop. Somehow that was a comfort.
@camera orbit=40 time=4
@show beacon_unit at=beacon
I turn slowly in the dark, and then I see it, clamped to the maintenance spar: a suit beacon, its little red eye opening and closing.
@camera from=hub look=beacon zoom=1.3 time=2 wait=true
@sound ping
ines (shocked): It's his. The casing's dented where he dropped it at Mars Dock, the day he came late to my birthday. I was nine.
The beacon has a playback port. One press, and it will say whatever it was left here to say.
@if told_director
  The Director told me to touch nothing. My thumb hovers over the port anyway.
@else
  Teo is quiet on the channel. He is letting me decide. I can't tell if that's kindness or cowardice, and right now I don't care.

* Open the beacon.
  I press the port. My glove is shaking. I let it shake.
  -> ines_log
* Leave it. Some doors should stay shut.
  ines (neutral): I'm coming back, Teo. I'm leaving it where it is.
  -> end_dead_air

# ines_log "Calder-One"
@music stop fade=3
@hide all
@mode nvl
@filter vignette time=2
The recording begins with breathing. Then my father's voice, younger than I remember it. Tired. Very calm.
"Calder-One": Log. Calder, chief engineer. If this is playing, my clamp on the gyro is slipping, and the ring is drifting again.
"Calder-One": The stabiliser in Spoke C failed tonight. If it keeps failing, the ring goes out of true and tears itself apart inside an hour.
"Calder-One": I can clamp the gyro by hand, but only from in here, and the spoke has to be vented after, or the cascade spreads to B and D.
"Calder-One": So I've sent the others down, and I'm staying. It isn't anyone's fault. Make sure the report says that.
It doesn't. I have read it a hundred times. It says {i}operator error{/i}.
"Calder-One": The clamp should hold ten years, give or take. The gyro is behind panel H-9. It needs two people. Don't let anyone do it alone.
"Calder-One": And if it's you listening, Ines... I'm sorry about Mars Dock. I'll make it up to you.
The recording clicks off. The storm goes on turning in the window, older than all of us.
@clear
@mode adv
@filter none time=2
-> teo_choice

// ── Part Three: Teo ──────────────────────────────────

# teo_choice "Broadcast"
@chapter "Part Three — Broadcast" subtitle="Teo"
@scene bg_ops with=dissolve
@pov teo
@music ops_loop fade=2
@ambience hum
The playback came through Ines's suit channel, so I heard every word of it. So did the deck recorder.
@show teo sad at=center
I pull up the stabiliser telemetry. It has been sliding for a week, a tenth of a degree a day, too small for any alarm.
Forty hours, maybe. Then the ring goes out of true.
@assert trust >= 0 and trust <= 2
@if told_director
  @move teo at=left
  @show halvorsen tired at=right
  The Director has been standing behind me for the whole recording, one hand over her mouth.
  halvorsen (tired): I signed that report. Operator error. I had a station to keep calm.
  halvorsen (stern): Give me the file, Marsh. We fix the gyro quietly. No panic, no inquiry.
@else
  The deck is still empty. The broadcast key sits under its plastic hood, the one that reaches every speaker on the ring.
  Ten minutes left on Ines's hour. It feels like a joke now.
ines (determined): Teo. Whatever you do with that file, do it now. I'm going for panel H-9.

* [require trust >= 2] Open every channel on the ring and play it.
  -> end_open_channel
* Hand the file to the Director.
  -> end_procedure

// ── Endings ──────────────────────────────────────────

# end_dead_air "Dead Air"
@pov ines
@hide all
@camera from=hub look=airlock zoom=1 fov=55 time=3 wait=true
I leave it blinking on the spar and climb back down toward the weight of the world.
@scene bg_lock with=fade
@music stop fade=3
The seal closes behind me. I tell Teo it was the relay after all, and he lets me say it.
@if told_director
  By morning the Director has filed it the same way. Relay fault. Nobody asks me twice.
Forty hours later the ring begins to shudder. It takes the engineers six days to find panel H-9.
The ring holds, mostly. It has never quite run true since, and neither have I.
@pov none
@ending dead_air "Dead Air" kind=bad
-> END

# end_procedure "Procedure"
@if not told_director
  @move teo at=left
  @show halvorsen stern at=right
  I wake the Director. She arrives in six minutes and listens to the whole file with her eyes closed.
halvorsen (tired): Thank you, Marsh. This stays between us until the gyro is fixed.
@hide halvorsen
Two engineers go up to panel H-9 at dawn. Ines is one of them. The ring holds.
The inquiry is never reopened. Officially, the signal from Spoke C was a relay fault.
@show teo sad at=center
Ines stops coming up to the ops deck for tea. I don't blame her. I keep a second cup on the console anyway.
@music theme fade=3
@pov none
@ending procedure "Procedure" kind=normal
-> END

# end_open_channel "Open Channel"
I lift the plastic hood. My hand is perfectly steady, which surprises me.
@music resolve fade=2
@flash color=#6fc3df time=0.3
On every deck of Halcyon Ring, in the galleys and the hydroponics bays and the dark bunk rows, a dead man's calm voice begins to speak.
@show teo smile at=center
teo: All hands, this is ops. Panel H-9, Spoke C. I need two volunteers. Nobody goes alone.
Eleven people answer before the recording has finished. Then thirty. Then I stop counting.
@scene bg_observation with=dissolve time=2
@pov ines
By the time the ring's dawn comes round, the gyro is clamped, the spoke is warm, and somebody has hung a light in the hub.
@cg cg_ring
The giant's rim catches fire with sunlight. From here you can see the whole wheel of the station at once, turning true.
@cg none
@show ines smile at=left
@show teo smile at=right
Teo finds me at the observation window with two cups of tea. Neither of us drinks them.
ines (neutral): He said he'd make it up to me.
teo: Did he?
ines (smile): He's getting close.
@pov none
@ending open_channel "Open Channel" kind=good
-> END
