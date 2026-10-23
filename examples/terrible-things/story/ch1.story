SHIORI 1

// ---- Chapter One: the first day ---------------------------------------------

# bakery "The Asahi Bakery"
@chapter "Chapter One" subtitle="The Bread-Bearer"
@pov nagi
@scene bakery with=fade time=1.5
@music morning_bread fade=2
@weather dust layer=back intensity=0.5
The Asahi bakery opens at five. By the time I get there the queue is out the door, and there's flour in the air like weather.
@show hinata grin at=center
hinata (grin): Nagi! Nagi, Nagi, Nagi. The council's new pet!
Hinata Asahi leans over the counter, elbows in a tray of bean buns. She's eighteen, a head taller than me, and built like someone who carries flour sacks up stairs for a living, which she does.
hinata: Everybody's heard. The Keeper's own bread-bearer. Do you get a hat? You should get a hat.
nagi: I don't get a hat.
hinata (soft): Shame. You'd look nice in a hat.
She has said things like that since we were twelve. I've never known what to do with them, so I take them home and put them on a shelf.
Through the bead curtain to the back room, the baby starts crying. Taichi is seven months old and has opinions about mornings.
hinata (tired): ...And there he goes.
@camera zoom=1.15 time=0.6
For one second her face goes flat and white and far away, like a window after the lamp's been blown out.
@camera reset time=0.6
Then she's grinning again.
hinata (grin): Mame! Your brother's composing!
mame: He's your brother too.
Eight years old and dry as a cracker. Upstairs, their mother coughs, a wet sound that goes on longer than a cough should.
Hinata thumps a covered basket onto the counter.
hinata: Keeper's order. Six melon breads, two curry buns, and the cucumber sandwiches Mrs. Toda always took up.
hinata (soft): She likes the melon bread best. Don't ask me how I know. I just do.
Behind the curtain, Taichi has gone from crying to screaming.

* Offer to hold Taichi while she serves the queue.
  @set held_baby = true
  @set hinata_bond += 1
  I go through the curtain before I can think better of it. Taichi is red and furious and smells of milk. I pick him up, and he stops, mostly out of surprise.
  @move hinata at=midright time=0.5
  hinata (blush): Look at that. He likes you. Nobody likes anybody at five in the morning.
  hinata (tired): Thanks. Really. Some mornings I think if I hear him cry one more time, I'll just—
  She stops, laughs, and wipes her hands on her apron, though they're already clean.
  hinata (grin): I'll go up the hill on Sunday, is what I'll do. Best thing in the world. I come back light as a sponge cake.
* Take the basket and go.
  I take the basket. It isn't my business. In Shiomi it's never anyone's business; that's what the hill is for.
  hinata (soft): Hey. Nagi. Tell her I said hi. The Keeper.
  She says it as if she knows her. Nobody knows the Keeper.

-> nemu_rules

# nemu_rules
The bell over the door clangs.
@show nemu sleepy at=offright
@move nemu at=right time=1.2 ease=out
@move hinata at=left time=0.8
Nemu Kagami shuffles in, wearing a council coat three sizes too big and the expression of a cat that has been asked to move.
nemu (sleepy): Nagi. Good. I'm supposed to brief you. Here is the briefing.
She hands me an iron key on a red cord, still warm from her pocket.
nemu: Rule one. Don't touch the Keeper's bare hands. Rule two. Don't go into the Glasshouse after dark. Rule three. Don't ask her name.
nagi (surprised): Why not?
nemu (smirk): Rule four. Don't ask me why. I'm the mayor's daughter, not the mayor. I carry the keys and then I go back to bed.
hinata (grin): She's been awake since noon yesterday. It's a personal record.
nemu (serious): And yes, it's exactly as creepy as it sounds. Our whole town takes its problems to a girl on a hill, and we've all agreed that's charming. Bye.
She takes a bean bun without paying and leaves. Everyone lets Nemu do things. It's less tiring than stopping her.
@hide nemu
-> hill_climb

# hill_climb "Glass Hill"
@scene hill_path with=dissolve time=1.5
@music glass_hill fade=2
@camera zoom=1.2 y=0.1 time=0
@camera zoom=1 y=0 time=6
Four hundred and twelve steps. I count them.
Below me Shiomi spills down to the harbor like a tipped-over box of sweets: blue roofs, orange roofs, a glass chime under every eave. Beyond the breakwater the sea is one sheet of light.
Halfway up I pass Mr. Imai, the fishmonger. He's climbing slowly with his cap crushed in his hands, the way people climb to a funeral.
At the top there's a long low house with a chimney breathing white, and beyond its garden wall a row of pale shapes, like people waiting for a bus that stopped running years ago.
Statues. I knew there were statues. I didn't know they would be so clear.
-> kiln

# kiln "The Kiln-House"
@scene kiln_house with=fade
@music tamamori fade=2
@rename suzu "???"
The kiln-house is one long room around a brick kiln that glows orange through its little door. Tongs, pipes, a low table, a folding screen painted with cranes. A wind chime hangs in the eaves, not moving.
suzu: Oh ho ho! So the council has finally sent me a fresh one!
The voice comes from behind the screen, high and delighted and absolutely certain of its own importance.
suzu: Approach, bread-bearer! Kneel, if you like. Most people do. I've never asked them to. They simply sense that it's appropriate.
nagi (neutral): Good morning. I'm Nagi. Mrs. Toda's replacement.
suzu: I know who you are.
A pause, as if the voice has said more than it meant to.
suzu: I mean, who else would climb my hill at this hour with six melon breads? My senses are exquisite. Put the basket down and behold me.
@show suzu proud at=center with=dissolve time=0.8
She steps out from behind the screen, and the first thing I notice is the sound.
Her hands are glass. Not gloved, not painted: glass, clear as water, from the fingertips to just past the wrists. When her fingers touch, they chime, like ice in a cup.
Her eyes are glass too, two marbles with a curl of smoke inside each, and they look at a point just past my left ear.
She's my age or near it: a small girl in a white kimono patterned with blue bells, plum-dark hair up in more pins than any head should need, smiling as if she's just won something.
@rename suzu "Tamamori"
suzu (proud): I am Tamamori, Keeper of Glass Hill, Holder of Shiomi's Unmentionables. You may call me Tamamori-sama. Or Your Translucence. I'm not fussy.
nagi: ...Tamamori-sama.
suzu (soft): Good. You'll do.
@move suzu at=midright time=1
She crosses to the basket without feeling her way and sniffs it.
suzu (proud): You walk exactly like— like someone carrying too much bread. And take the cucumber sandwiches back down. You'll only pick the cucumber out.
nagi (surprised): I didn't say I don't like cucumber.
suzu (surprised): ...Nobody likes cucumber. It's water that's given up. Oh ho ho.
She's right: I don't. I've never told anyone; it seemed too small to tell.
Before I can ask how she knew, someone knocks on the open door. Mr. Imai, cap in hands.
"Mr. Imai": Keeper. I'm sorry. I know it's early.
suzu (soft): It's never early. Come in.
The grand lady folds away like a fan. The girl left over kneels on the mat and holds out both glass hands, palms up.
Mr. Imai kneels too, and takes them, and bends his head close. I'm not supposed to listen. The room is very small.
"Mr. Imai": The baby. When I hold him. The soft place on top of his head. I keep thinking how easy it would be to just— to just press—
@music stop fade=0.3
@shake strength=0.4 time=0.4
He can't finish. Her shoulders jerk as if something has gone into her through her hands, and something has: a thread of muddy light, climbing the inside of her glass wrists like ink dropped in water.
@flash color=#ffb347 time=0.5
She puts a long glass pipe to her lips and breathes into the kiln. The fire roars white. At the end of the pipe a bead swells, dull greenish brown, the colour of a pond in winter. It drops hissing into a bowl of water.
Mr. Imai blinks. He looks around the room as if he's just woken up in it.
@music tamamori fade=3
"Mr. Imai": Well! What a lovely morning. Is that melon bread?
He takes one and goes back down the hill whistling. He has a seven-month-old son. He's going home to hold him.
@show suzu sad
Just above the Keeper's left wrist, where the glass ends, there's a new clear patch the size of a thumbprint.
suzu (sad): He'll be a good father. He's terrified of being a bad one. That's all the thought is, really. Fear wearing a mask.
suzu (proud): Oh ho ho! Don't look at me like that. I can hear you looking.
-> ask_keeper

# ask_keeper
@if visited("ask_keeper") == 1
  suzu (proud): Well? You've got the face of someone hoarding questions. Ask. I'm magnanimous in the mornings.
@else
  suzu (proud): What else? I remain magnanimous until noon.
* [once] Ask about the statues in the garden.
  @set asked += 1
  Through the open doors I can see them now: eleven girls of glass among the hydrangeas, each holding out her hands, palms up, as if waiting for someone to kneel.
  suzu (soft): My predecessors. Twelve Keepers, if you count the one in the Glasshouse. Terribly rude. They never say good morning.
  suzu (sad): That's what happens at the end. You go clear all the way through, and then you're very still and very pretty, and people put flowers on you.
  nagi: How long does it take?
  suzu (proud): Keepers get about ten summers. This is my tenth. I've always been punctual.
  She says it the way you'd announce the weather. I wait for the punchline. There isn't one.
  -> ask_keeper
* [once] Ask what happens to the beads.
  @set asked += 1
  suzu: To the Glasshouse out the back, on threads, on shelves, on every nail I could find. I'll show you in daylight. Rule two.
  nagi: What if one breaks?
  suzu (soft): Then the thought goes home to whoever had it. So they mustn't break. That's my whole job, really. I'm a very glamorous shelf.
  -> ask_keeper
* [once] Ask about her eyes.
  @set asked += 1
  suzu (soft): Colour went first. Then shapes. Then I stopped missing them.
  @move suzu at=center time=0.8
  suzu (proud): Now I hear things instead. The kiln ticks a quarter-tone flat. You breathe through your mouth when you're working something out. And every thought rings, if you listen. Every bead has its note.
  -> ask_keeper
* [once] Ask why she asked for you by name.
  @set asked += 1
  suzu (proud): I picked it out of a hat.
  She says it too fast.
  nagi: There are four hundred people in Shiomi.
  suzu (proud): It was a very large hat.
  -> ask_keeper
* [require asked >= 3] Ask what she'd do, if she could leave the hill.
  @set knows_wish = true
  @set suzu_bond += 1
  For a long moment she doesn't answer. The kiln ticks its quarter-tone.
  suzu (soft): Two things. I'd go to Lantern Night. Every year I hear the whole town laughing at the bottom of the hill. I'd like to hear it from the inside. Just once.
  suzu (sad): And I'd go down to the sea and put my feet in it. I've listened to it every day for ten years. I'd like to know if it's cold.
  nagi (smile): It's cold.
  suzu (angry): Don't spoil it! Oh ho ho.
  -> day_end
* Say you'll see her tomorrow. -> day_end

# day_end
@scene kiln_house with=dissolve time=1
@filter dusk time=2
@show suzu soft at=center
The day goes. I sweep. I carry water. Three more people climb the hill, and each comes out smiling and asks me if it isn't a lovely afternoon.
By evening the Keeper is grey under the eyes. When I say goodnight, she tries to stand and sits down hard.
suzu (sad): ...Help me up.
She holds out one hand. Bare glass, palm up.

* Take her bare hand.
  @set touched = true
  @set suzu_bond += 1
  Rule one. I take her hand anyway. The glass isn't cold. It's warm, like a cup someone has just drunk from.
  @shake strength=0.3 time=0.3
  @flash color=#e8d8ff time=0.3
  For one second I hear a sound like a struck bell, and under the bell a child's voice, very small and very far away: {i}not me, not me, not me.{/i}
  suzu (surprised): ...You're not supposed to do that.
  nagi: You asked.
  suzu (soft): I did, didn't I.
  She doesn't let go for slightly longer than she needs to.
* Offer your sleeve instead.
  I hold out my sleeve. She finds it by sound and hauls herself up. She weighs less than she should.
  suzu (proud): Rule one. Very good. Mrs. Toda broke it on her second day. You're a model employee.
  suzu (sad): ...Very good.

@hide suzu with=dissolve time=1
I go down the four hundred and twelve steps in the blue dusk with an empty basket.
@if touched
  The child's voice comes down with me. It sounded like nobody I know.
I'm calm. I'm always calm. But that night I lie awake a long time, listening to the chime on my window not ringing.
-> interlude_glass
