SHIORI 1

// ---- Chapter Two: Sunday, the Glasshouse (the game's one 3D scene), the plan ----

# sunday "Sunday"
@chapter "Chapter Two" subtitle="The Glasshouse"
@pov nagi
@scene statue_garden with=fade time=1.5
@music morning_bread fade=2
@weather petals layer=back intensity=0.3 wind=0.4
On Sunday, Hinata climbs the hill with me, talking the whole way up about flour prices and a customer who paid in fish. I'm out of breath for both of us.
@show hinata grin at=center
hinata (soft): Wait out here, okay? It's private. Even from you.
hinata (blush): {i}Especially{/i} from you.
@hide hinata with=dissolve time=0.8
So I wait among the statues.
They're worse up close. Each girl is clear right through, so you can see the hydrangeas bent and blue behind her ribs. The smallest can't have been more than fifteen.
Someone has left a cup of tea at the feet of the nearest. It has gone cold, and a moth has drowned in it.
@wait 1
Hinata comes out after an hour, singing.
@show hinata grin at=center
hinata (grin): {wave}Done!{/wave} God, I feel like a sponge cake.
hinata (soft): Was I long? I'm never sure how long I am in there.
nagi: An hour.
hinata (blush): An hour? Huh. I must've had a lot to say.
She laughs. She has no idea what she said. Behind her, in the kiln-house, something is cooling in a bowl of water. Several somethings.
@hide hinata with=dissolve time=1
-> sunday_inside

# sunday_inside
@scene kiln_house with=dissolve time=1
@music tamamori fade=2
@show suzu tears at=center
The Keeper is sitting very straight beside the kiln, and her face is wet. In the bowl at her knee are seven new beads, all the same warm amber, like light through honey.
suzu (sad): Don't. She's the kindest person in this town. That's why it's so heavy.
The glass on her left arm has reached the elbow.
suzu (proud): Well! Enough of that. I promised you the Glasshouse, and it's daylight. Give me your sleeve. Not your hand. Rule one.
-> glasshouse_tour

# glasshouse_tour "The Glasshouse"
@scene glasshouse with=fade time=1.5
@music glass_hill fade=2
@camera from=door look=heart time=0
@weather dust layer=back intensity=0.5
The Glasshouse is a long greenhouse behind the kiln-house, all glass roof and iron ribs. At first I think it's full of rain.
@camera from=door look=aisle time=5 wait=true
It isn't rain. It's beads, thousands upon thousands on threads from every rafter, so the light comes through in colours: a church window someone has taken apart and hung up to dry.
@show suzu proud at=left
suzu (proud): Eleven thousand, four hundred and thirteen, as of this morning. Mind your head. That thread is the schoolteacher's.
When we walk, they move, and when they move, they ring. It's like standing inside a held breath.
@camera from=aisle look=amber time=3
Near the door there's a shelf with no threads at all, just bowl after bowl of amber beads, all exactly alike.
suzu (sad): Those are Hinata's. Four years of Sundays.
nagi (sad): What are they?
suzu (soft): Not mine to tell. They're still hers, even if she doesn't have them anymore.
@camera from=aisle look=heart time=4 wait=true
From the great central beam hangs a cluster of beads fused into one lump the size of a child's head, dark as plums and very old.
suzu: That's the Heart. The oldest thoughts, whose owners are dead. They can't go home, so somebody has to hold them.
suzu (soft): When a Keeper finishes, the next one takes the Heart from her hands. She has to be clear, someone who's never given a bead, or it won't take. That's why it's always a child.
@camera from=aisle look=statue time=4
At the far end, where the light is greenest, stands one more statue, older and cloudier than those in the garden, holding out her hands to the Heart.
suzu: The first Keeper. The plaque says she took the first thought so that no one else would have to. Nobody remembers what it was. Very tidy of her.
@camera from=roof look=heart time=5 wait=true
@camera orbit=40 time=8
The Keeper runs one glass fingertip along a row of threads, and they ring under it in order: five notes climbing and one falling, like someone starting up a staircase and changing her mind.
nagi (surprised): What's that?
suzu (soft): Nothing. Something I'm working on.
nemu: Ah. Good. Witnesses.
-> plan

# plan "The Plan"
@camera from=door look=aisle time=2
@show nemu sleepy at=right
Nemu is leaning in the doorway with a ledger under her arm and a candied chestnut in her cheek.
nemu (sleepy): Bead census. Every Sunday I'm supposed to come up and count them. Every Sunday I write "lots."
suzu (proud): Kagami's daughter! Have you come to pay homage?
nemu (smirk): I've come to sit down. Different thing, but they look alike from a distance.
@if knows_wish
  I don't decide to say it. It just comes out.
  nagi: She's never been to Lantern Night.
  nemu (serious): ...No. She wouldn't have, would she.
@else
  nemu: Hey. Your Translucence. Ever been to Lantern Night?
  suzu (soft): You know I haven't.
The Keeper has gone very still, like a held note.
Nemu sits on an upturned bucket and opens the ledger. On the back page, in crayon: four stick figures, a hill, and {b}OPERATION PAPER LANTERN.{/b}
nemu (serious): The archive says the Glasshouse holds for an hour without its Keeper. So. Step one: at sundown Hinata takes bread to the council and keeps my mother busy.
nemu (serious): Step two: Nagi walks you down the back path in a disguise. Step three: you hear the festival for one hour. Step four: I have a nap.
suzu (surprised): You read the archive?
nemu (smirk): I was supposed to file it. Reading is a kind of sitting down.
nagi: Why do you get a nap?
nemu (sleepy): Someone has to be well rested in case it all goes wrong. That's leadership.
suzu (sad): If anything happened to the beads...
nemu (serious): One hour. It's in the archive. Probably. The handwriting was bad.
The Keeper turns her glass eyes toward me, the way you'd turn toward a window to check the weather.

* "Count me in."
  @set agreed_plan = true
  @set suzu_bond += 1
  nagi (resolute): Count me in. One hour.
  suzu (tears): ...Oh ho ho. Look at you. Breaking rules in your first week.
* "This is a terrible idea."
  nagi: This is a terrible idea.
  nemu (smirk): Noted. You're in anyway. You're the only one she trusts on stairs.
  suzu (proud): I trust nobody on stairs. Oh ho ho.
  But she doesn't say no. She doesn't say no at all.

nemu (sleepy): Lantern Night is Thursday. Wear something dark. I'll bring snacks.
-> festival
