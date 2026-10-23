SHIORI 1

// ---- The three endings. end_kindest unlocks after either of the others. ----------

// ---- Ending: Nagi takes the Heart. Suzu lives; the town stays the same. -----------

# end_fourteenth "The Fourteenth Keeper"
@show nagi resolute at=midleft
@move suzu at=midright time=0.6
@move nemu at=farright time=0.6
I kneel in front of her before Nemu can.
nagi (resolute): It was supposed to be me. It's nine years overdue.
suzu (angry): No. Nagi, {i}no.{/i} I didn't give it back so you could do this!
nemu (panic): That's my stupid hill. I drew it fair and square.
nagi (smile): You wrote it twenty-nine times. That's cheating.
I put my hands under the Heart. It's warm, and heavy the way a sleeping child is heavy. Suzu's glass hands try to hold on, but they can't feel anymore, so they can't tell when they've let go.
@flash color=#ffe2b0 time=0.8
@shake strength=0.5 time=0.6
Everyone who ever lived in Shiomi moves into me at once, like a family arriving at a house in the dark and opening every door.
My fingertips go clear. When I press them together, they chime.
@show suzu tears
Through Suzu's glass ribs I watch the red shadow of her heart stumble, and catch, and beat faster. Harder.
suzu (tears): You idiot. You stubborn, stubborn— you always did this. You always—
She can't finish. She doesn't have to.
@music glass_hill fade=3
@scene kiln_house with=fade time=3
@mode nvl
It's my second summer on the hill.
The town still climbs. By autumn people were bringing new beads, and by spring the queue was what it had always been. The Glasshouse roof is mended. The census says {i}lots.{/i}
Nemu went to the capital. She writes long furious letters about laws and signs them {i}your lazy idiot.{/i}
Suzu lives. The glass stopped where it was: her hands, her eyes, her throat. She lives above the bakery, sings in the mornings, and is, Hinata says, the worst bread-roller in history.
They come up together on Sundays, Suzu holding Hinata's sleeve on the steps, Hinata pretending it's the other way round. They kneel and put their hands in mine.
Hinata gives me fewer than she used to. She says she keeps some now, to see if she can.
Suzu gives me only one. The same one every week, in a voice so small I have to bend to hear it.
{i}Let it be me instead of her.{/i}
I blow it into glass and keep it in a pocket I've sewn into my sleeve. Every week there's one more. They all ring the same note: the one she never used in her song.
@clear
Under the hill, I'm told, the children have a new game. One sits on a step and holds out her hands, and the others kneel and whisper. Mame is very good at it. She's nine.
The glass is at my elbows. Ten summers, give or take.
I've always been slow. I expect I'll take eleven.
@clear
@mode adv
@ending fourteenth "The Fourteenth Keeper" kind=normal
-> END

// ---- Ending: Nagi runs with Suzu to the sea. Nobody holds the Heart. ---------------

# end_salt "Salt"
@show nagi resolute at=midleft
nagi (resolute): Come on.
suzu (surprised): What?
nagi (resolute): The sea. You were going to marry it, remember?
suzu (proud): Oh ho ho—
She starts to laugh, the dropped-tray laugh I remember from the summer I was eight. And she lets the Heart roll off her lap into the wet grass, and puts her arms round my neck.
@scene black with=fade time=1
@music stop fade=1
@mode nvl
She weighs less than a paper lantern. I run down the back path with her on my back, into the dark.
Behind us, nobody is holding the Heart.
I hear it go: a sound like the whole sky being set down on a table. Then the Glasshouse, eleven thousand beads going home at once. Then the town, four hundred and twelve steps of lanterns, making a sound I don't have a word for.
Suzu has her face against my neck. I can feel that she's smiling. I can feel that she's glad.
That's the part I keep.
@clear
@scene seashore with=fade time=3
@music glass_hill fade=4
@mode adv
@show suzu soft at=center
We reach the beach as the sky turns the colour of the inside of a shell. I carry her into the surf, and the first wave comes up over her bare feet.
suzu (surprised): It's cold.
@if knows_wish
  nagi (tears): I told you.
@else
  nagi (tears): It's always cold.
suzu (proud): Don't spoil it.
She stands in the sea with her glass hands held out to it, palms up, as if it might kneel. The glass is climbing her face now. She has time for one more thing.
suzu (soft): Oh. Listen. It's so loud down here.
And then she's still.
@shake strength=0.4 time=1
The next wave takes her at the knees, and she breaks the way glass breaks in water, almost gently, into a thousand bright pieces that the sea pulls out and pushes back.
@flash color=#fff4d6 time=1.2
And everything that was hers, every thought she kept because there was no Keeper for the Keeper, comes to the only person on the beach.
@mode nvl
Her anger first. Nine years of it, at the town and the council and her mother, and at me, red and roaring. I take it, because it's owed.
Her loneliness, which is worse.
Her song, five notes climbing and one falling, made out of the worst thoughts of four hundred people and more beautiful than anything I've ever heard.
And under everything, very quiet, like the bead in her sleeve: {i}I know you. I know all of it. I love you anyway.{/i}
Kneeling in the surf, I think how much of that could have gone to everyone, if everyone had been there.
@clear
I went back to Shiomi that afternoon. That was a year ago.
The four people nearest the Heart took a hundred years of it between them. The mayor hasn't spoken since. Nemu left for the capital and doesn't write. Mame is nine. She hardly talks; she draws the same picture over and over, a hill and a house and a girl made of light walking away from it.
Hinata won't see me. She was standing next to the Heart with her arms round her sister while I ran, and I don't blame her.
In the evenings I walk down to the beach and stand in the cold water until I can't feel my feet. It's the closest I can get.
@clear
@mode adv
@ending salt "Salt" kind=bad
-> END

// ---- True ending: the Night of Saying. -----------------------------------------

# end_kindest "The Kindest Town on the Coast"
@music stop fade=2
@hide all with=dissolve time=1
I let go of Suzu's hand and walk to the garden wall, and look down at four hundred and twelve lanterns and every face under them.
I have never spoken to more than three people at once in my life.
@show nagi resolute at=center
nagi (resolute): When I was eight, the lot fell on me. And I thought: let it be Suzu Hoshino instead of me.
@camera zoom=1.15 time=4
nagi (tears): And it was. She stepped out of the row because she heard me. I gave her that thought a week later, and her with it, and I forgot her for nine years.
Nobody moves. The fireflies go on doing what fireflies do.
@camera reset time=1
@if said_worst
  @show hinata soft at=left
  Hinata is beside me before the silence can close. She has said it once already, in a kitchen. It's always easier the second time, she tells me later.
  hinata (soft): Every Sunday for four years I took the same thing up this hill. That if my family were all gone, I could finally sleep. I love them more than bread. I thought it anyway.
@else
  @show hinata scared at=left
  For a long time nobody answers. Then Hinata comes and stands beside me, shaking so hard I can hear her teeth, and says it to her shoes, and then makes herself say it again, to the steps.
  hinata (tears): Every Sunday for four years. That if my family were all gone, I could finally sleep. I love them more than bread. I thought it anyway.
kagami: When I drew the slip and saw my daughter's name, I thought: anyone's child but mine.
The mayor is still sitting in the grass. Her voice carries anyway.
kagami: And nine years ago, when the Hoshino girl stepped forward, I thought: thank God. It's her, and she wants it, and I won't have to choose.
@show nemu sad at=right
nemu (sad): Last night, writing my name on the slips, I thought about stopping at fifteen. Leaving the rest blank. Letting it be someone else's kid. I nearly did.
Then someone halfway down the steps says his. Mr. Imai, his son asleep on his shoulder: the soft place on the baby's head.
His wife says hers. The schoolteacher says hers, and it has fire in it. A fisherman. Master Sekiguchi. A girl of fifteen who wishes her best friend would die so she could have her life.
It goes on for an hour. It goes on until the lanterns gutter.
Nobody faints. Nobody dies. People cry, and swear, and one man hits another and is held back by his neighbours. Every terrible thing stays in the air over Glass Hill, said out loud, and the town stands in it.
@show suzu tears at=center
@move nagi at=midleft time=0.6
suzu (tears): Oh. Oh, listen to them. I've only ever heard them through glass. It's so loud.
nagi (sad): Those aren't even the worst ones.
suzu (soft): It doesn't matter. They {i}said{/i} them.
-> kindest_chain

# kindest_chain
suzu (soft): Here's the only rule I've ever been sure of: you can't give anyone a thought they won't hold. If the Heart breaks with me, the old ones have to go somewhere, and nobody can carry them alone.
suzu (proud): But if all of you were holding on...
She lifts her voice, the Countess voice, so it rolls down the steps.
suzu (proud): Everyone who's willing! Take the hand of someone who's touching me! Oh ho ho. Don't be shy. You've all done worse tonight.
I go back to her and take her left hand. Hinata takes her right.
@if hinata_bond >= 2
  Hinata doesn't hesitate. She never did, with Suzu. She was holding those hands every Sunday for four years before I'd ever climbed the hill.
@else
  Hinata hesitates for one second, then takes it as though it were a hot pan she has decided she will not drop.
Nemu takes my other hand. Mame takes Nemu's. The mayor gets up off the grass and takes Mame's. And down it goes, hand into hand, down the four hundred and twelve steps, a chain of people and lanterns all the way to the harbor.
@cg cg_breaking with=dissolve time=2.5
suzu: I've heard both your hearts. Every rotten thing in them. I love you both anyway.
suzu: Don't you dare make it a contest when I'm gone. I'll know.
I kiss her. Rule one, broken for the last time. For one second I hear everything in her, and under it all her own thoughts, rough and furious and tender and entirely hers.
Then Hinata kisses her too, on the cheek, clumsily, flour still in her hair, and Suzu laughs the dropped-tray laugh.
suzu: Oh ho ho. Quite a turnout.
She lets go.
@music suzu_song fade=0.5
@flash color=#ffffff time=1.5
@shake strength=1 time=1.2
@weather fireflies intensity=2.5
She breaks the way a wave breaks: not into pieces, into light.
Above us the Glasshouse goes, eleven thousand beads lifting off their threads like sparks from a bonfire and scattering over the town, every one of them going home.
The Heart goes down the chain. I feel it pass through my hand into Nemu's, a current of old cold strangers, and it thins as it goes, a little to each of us, until by the harbor it's no heavier than rain.
And last of all, Suzu. Everything she kept for herself.
Her rage comes down the hill like a slap, and four hundred people feel what it was to be kept up here for ten summers, and take it, because it's owed.
Then her loneliness.
Then her song. The whole town hears it at once, five notes climbing and one falling, made of all our worst thoughts, and it's the most beautiful thing any of us has ever heard.
And under all of it, quiet as the bead in her sleeve: {i}I know. I know all of it. I love you anyway.{/i}
@cg none with=fade time=3
@weather fireflies intensity=0.6 time=4
In the grass where she was sitting, there's nothing. No statue. Somebody has left a wreath of morning glories there anyway, closed up for the night. Nobody will say who.
-> kindest_epilogue

# kindest_epilogue
@scene hill_path with=fade time=3
@weather petals layer=back intensity=0.4 wind=0.5
@mode nvl
It's been a year.
Shiomi isn't the kindest town on the coast anymore. The tourists say we've let ourselves go. A couple on our street separated in the spring. Mr. Imai sees a doctor in the next town every Tuesday and talks to her about his son. He says it's slower than the hill.
There's a bench in the square now where people sit and say things out loud to whoever sits down next to them. Nobody organised it. We call it the Saying Bench. Usually there's a queue.
Each of us carries a little of the Heart: a thought or two that isn't ours, from someone who lived here a hundred years ago. We call them lodgers, and talk about them like weather. {i}My lodger's bad today. Mine too.{/i}
The statues broke with her. The garden is only hydrangeas now. The former mayor weeds it every morning, alone. Nobody asks her to. Nobody stops her.
Nemu is at law school in the capital. She writes that she's going to make it illegal to build a glasshouse anywhere in the prefecture, that she hates working this hard, and that she's top of her year.
@clear
Where Suzu's hands were, our fingertips are clear now, Hinata's and mine. You can see the bones inside, like the shadow of a twig under ice. When we hold hands, they chime.
@if hinata_bond >= 2
  I live above the bakery. Hinata still has thoughts, and so do I. We tell each other at night, in the dark, like weather. {i}Bad one today.{/i} {i}Me too.{/i} It's enough. It's almost always enough.
@else
  I'm at the bakery most days, and more nights than I'd admit to. Hinata still has thoughts, and so do I. We're learning to tell each other, slowly, the way you learn to swim. Most days it's enough.
@if held_baby
  Taichi is walking. He prefers me, which Hinata says is treason.
Mame is nine. She has never once been afraid of anybody.
In the spring Hinata finally posted one of her letters. The school in the capital wrote back. She hasn't decided. She says she's allowed to think about it now.
Nobody climbs the hill on Sundays. The kiln is cold. Hinata and I go up anyway, sometimes, and sit on the step, and she hums it: five notes climbing and one falling. Everybody in Shiomi can hum it. Nobody was ever taught.
@clear
This morning there was wind on my side of the hill, for the first time I can remember.
The chime on my window rang. It's lopsided, and a little flat, and a girl made it for me when she was eight, so that I'd hear her when she wasn't there. It's the most honest sound in Shiomi.
I said her name out loud. That's how we keep things here now.
@clear
@mode adv
@ending kindest "The Kindest Town on the Coast" kind=true
-> END
