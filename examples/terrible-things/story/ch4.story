SHIORI 1

// ---- Chapter Four: the bead in her sleeve. The twist. ---------------------------

# sleeve "The Bead in Her Sleeve"
@chapter "Chapter Four" subtitle="The Bead in Her Sleeve"
@pov nagi
@assert ran_to == "hinata" or ran_to == "suzu" "ran_to is set by the Lantern Night choice"
@scene kiln_house with=fade time=2
@filter night time=0
@music stop fade=2
@show nemu sad at=right
Nemu is sitting on the kiln-house step with the iron key in her lap. Her coat is buttoned wrong.
nemu (sad): One hour. The archive said one hour.
nemu (sad): I went back and read it again. It says one hour for a Keeper in her {i}first{/i} summer. It's her tenth.
@if agreed_plan
  {i}Count me in,{/i} I said. {i}One hour.{/i} I said it as if I knew anything.
@else
  I told her it was a terrible idea. Then I walked the Keeper down the hill anyway. Saying so didn't make it anyone else's fault.
She holds the key out without looking at me.
nemu (serious): They're choosing a new one tomorrow night. By lot, from the children. Mother's already had the slips cut.
nemu (sad): I'm going to go and be sick somewhere private.
@hide nemu with=dissolve time=1
Inside, the kiln has gone out. Through the back doors, the Glasshouse roof is starred with cracks, its floor glittering like spilled sugar.
@show suzu sad at=center
The Keeper sits by the dead kiln. In one night the glass has climbed past her collarbones. It rings her throat like a collar of ice.
suzu (soft): Sit down. No, closer. I have to give you something, and neither of my hands knows where anything is anymore.
I sit. She turns her face toward me, a little to my left.
suzu (soft): You asked why I asked for you by name. I told you I picked it out of a hat.
suzu (sad): That's true, in a way. Somebody else did the picking. A long time ago.
From the pocket in her sleeve she takes a single bead, small and round, the deep pink of plum candy. I can feel its warmth before it touches me.
She puts it in my palm. Then she closes both her glass hands over mine.
@cg cg_hands with=dissolve time=2
The bead is warm. Then it's hot. Then it isn't there at all, and something comes up my arm like a held breath let go.
@flash color=#ffd6e8 time=1
@cg none with=fade time=1
-> memory

# memory "The Eighth Summer"
@scene statue_garden with=fade time=1.5
@filter sepia time=0
@music tamamori fade=2 volume=0.5
@mode nvl
The summer I was eight, the twelfth Keeper finished.
I remember {i}now{/i}: the garden full of people in their good clothes, and the twelfth Keeper sitting very straight among the statues, clear as water from her hair to her heels, with a wreath of morning glories on her head. It was the first time I understood that the statues had been girls.
I remember Suzu.
Suzu Hoshino from two doors down, with the gap in her teeth and a voice like a dropped tray. Suzu, who announced everything (I am going to climb that tree, I am going to marry the sea, I am going to make a bell so loud it wakes the dead) and then did most of it. Her hand in mine, sticky with plum candy, because that summer we held hands everywhere, as if it were a rule.
That spring she had made me a wind chime at the glassworks, lopsided, with a crooked clapper. {i}So you can hear me when I'm not there,{/i} she said.
I remember the council lady with a box of folded papers: the name of every child under ten. Thirty-one of us in a row.
I remember my name, read out.
@clear
Here is the thought. I can hear it in my own voice now, small and very clear, as if it never left:
{i}Not me. Not me. Let it be Suzu. Let it be Suzu instead of me.{/i}
I didn't say it. I thought it, with my whole body, the way you can only think things when you're eight. And Suzu squeezed my hand as if she'd heard, and let go, and stepped out of the row.
“I'll do it,” she said, very loud, so that everybody turned. “I want to. I like glass. It's pretty.”
The council lady looked at her, and at me, and at the box. I watched her face go soft with relief, because one of the children {i}wanted{/i} it, and that turned a terrible thing into a kind one.
Suzu walked up to the twelfth Keeper and took the Heart out of her clear hands. The twelfth Keeper smiled (I'm sure she smiled) and was still.
@clear
A week later, Mother walked me up the hill. I hadn't eaten. I hadn't slept. I kept seeing Suzu's hands.
I knelt in front of the new Keeper, who was eight years old and wearing a kimono much too big for her, and put my hands in hers, and told her what I'd thought.
I was her first. She was mine.
And because the thought was made of Suzu (because there was no way to pull out {i}let it be her{/i} without pulling out {i}her{/i}), all of her came out with it. The gap tooth. The tray voice. The plum candy. The bell she was going to make.
I went home lighter. I slept for two days. When I woke up it was autumn, the house two doors down had always been empty, and I was a calm girl who didn't cry.
Her parents moved to the capital that winter. Her mother had climbed the hill too.
@if touched
  {i}Not me, not me, not me.{/i} The voice I heard the day I took her hand wasn't a stranger's. It was mine.
@clear
@mode adv
-> sleeve_after

# sleeve_after
@scene kiln_house with=fade time=1.5
@filter night time=0
@music glass_hill fade=3 volume=0.7
@show suzu tears at=center
@rename suzu
I'm crying. I didn't know I still knew how. It comes up out of me like the tide coming in under a door.
nagi (tears): Suzu.
suzu (tears): ...There it is.
She says it like someone who has waited nine years for a train and just heard it on the rails.
nagi (tears): I wished it on you.
suzu (soft): I know. I've listened to it every night for nine years. It's a very small bead. You'd be surprised how small.
nagi (sad): Why did you ask for me? Why now?
suzu (sad): Because the shelves are breaking, and tomorrow they'll choose somebody, and I'm nearly done. And because I'm selfish.
suzu (tears): I wanted one person in this town to remember me before I'm a statue somebody puts morning glories on. That's my thought. I can't give it to anyone, so I gave it to you.
nagi: You stepped out of the row.
suzu (proud): You'd have said yes and hated it. I said yes and liked it. I was right, mostly. Oh ho ho. I've liked a lot of it.
suzu (sad): Not all of it.
I lift her left hand, glass to the elbow and cold now, and put my mouth to her knuckles. They ring faintly, like a glass set down in another room.
suzu (surprised): ...Rule one.
nagi (resolute): I've broken worse.
@if suzu_bond >= 2
  suzu (soft): You always did. I used to tell your mother it was my idea. It never was.
-> sourdough
