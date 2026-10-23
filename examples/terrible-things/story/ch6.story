SHIORI 1

// ---- Chapter Six: the changed town, the lottery, and the garden. -----------------

# changed_town "The Morning After"
@chapter "Chapter Six" subtitle="The Choosing"
@pov nagi
@scene hill_path with=fade time=2
@music small_hours fade=2 volume=0.7
@weather rain intensity=0.8 wind=-0.2
@tint #4a5a78 alpha=0.35 time=0
It rains. It almost never rains in Shiomi in summer.
Half the shutters in town are down. On the noodle shop door someone has chalked {b}I'M SORRY{/b} and nothing else. Mr. Imai slept in his boat. His wife told the whole market, then sat down on a fish crate and wept.
Only this year's beads broke. A few months of thoughts, for a few hundred people. That's all it took.
And the steps of Glass Hill are full: a queue from the harbor to the top, collars up in the rain, waiting to give it all back. At the gate, council men with a rope say the Keeper is resting. Nobody leaves the line.
@show nemu sad at=center
I find Nemu halfway up, under a paper umbrella, with a ledger bound in blue cloth swelling in the damp on her knees.
nemu (serious): The archive. Since you're going to ask.
nemu (serious): Twelve Keepers, and twelve nights like last night. The book calls them Long Evenings. When a Keeper's nearly finished, the newest shelf cracks, and the town goes mad for a night.
nemu (sad): Then everybody climbs the hill and gives the new girl the memory of it. We've forgotten this twelve times. Very tidy of us.
She holds out a page. Nine years ago, in a neat hand I know from every council notice, someone has written in the margin: {i}The Hoshino girl volunteered. A mercy.{/i}
nemu (sad): I found that a year ago. People started calling me lazy right after. They were right. I'd just found out what effort was {i}for{/i} in this town.
nemu (serious): I'm going to the capital in the autumn. Law school. I applied without telling her. I want to be the kind of person who can make things illegal.
nagi (resolute): They're drawing tonight.
nemu (smirk): I know. I have a plan.
nagi: Your last plan—
nemu (sad): I know what my last plan did.
nemu (serious): This one's lazy, and nobody's child goes up that hill. Trust me. I'm doing it either way. It's less effort than arguing.
-> lottery

# lottery "The Lots"
@scene square with=fade time=2
@filter dusk time=0
@music small_hours fade=2
The festival lanterns are still up. Somebody has lit them out of habit, and they swing in the wet wind like bells with no clappers.
The lot is drawn from the clear: every child under ten, and anyone older who has never climbed the hill, which in Shiomi means no one. Twenty-nine children stand in a row in their good clothes. Their parents stand behind a rope.
@show hinata scared at=left
Mame is fourth from the end in a borrowed kimono, glaring at the mayor. Hinata is behind the rope, holding it in both fists.
Mayor Kagami stands by the fountain with a lacquer box. She looks as if she hasn't slept. She looks kind. She always has.
kagami: I'm sorry. I know what we're asking. The Glasshouse must be kept, or every night will be like last night, forever. One child keeps it for all of us. It is the oldest kindness in Shiomi.
She draws a slip from the box and unfolds it.
@camera zoom=1.2 time=3
And stops.
I watch her read it. I watch her read it again. Her face does nothing at all, for much too long.
kagami: Mame Asahi.
@camera reset time=0.4
@shake strength=0.8 time=0.5
For one second Hinata's face goes flat and white and far away, the lamp blown out.
I know exactly which thought just went through her. I know now. {i}One fewer.{/i}
@show hinata tears at=left
And then she's moving. She's under the rope and through the row, she has Mame behind her and both arms out, and she's screaming {i}no{/i} at the whole of Shiomi, as if it's the only word she owns.
The thought went through her and out the other side, and it didn't move her hands an inch.
@show nemu serious at=right
nemu (serious): Liar.
Nemu walks out of the crowd, takes the box from her mother's hands, and turns it upside down. Twenty-nine slips flutter onto the wet stones. She reads them aloud, one by one.
nemu (serious): Kagami Nemu. Kagami Nemu. Kagami Nemu.
nemu (sad): I wrote every one. I'm clear, Mother. I never climbed your hill. Too many stairs. I thought you'd call it off. I thought you'd rather burn the hill down than put me on it.
nemu (sad): You'd have let it be Mame. You'd have let it be anyone.
-> lottery_two

# lottery_two
The mayor doesn't deny it. She sits down on the rim of the fountain as if her strings have been cut.
A sound goes through the crowd like wind starting in a field. Someone says, not loudly, {i}Is that how they did it last time?{/i} Someone else: {i}Who was the Hoshino girl?{/i} One of the council men lets his end of the rope drop into a puddle.
But every slip says the same name, and the town is frightened. A man at the back shouts that the lot is the lot. Others agree, without quite looking at Nemu.
nemu (panic): Fine. {w=0.4}Fine! It's my name. It was my plan. I'll go up the stupid hill.
That was Nemu's plan, and it worked perfectly. No child is going up the hill tonight.
@hide all with=dissolve time=1
-> garden

# garden "The Garden"
@assert asked <= 4 "only four questions can be asked in the keeper hub"
@scene statue_garden with=fade time=2
@filter night time=0
@weather fireflies layer=back intensity=1.2
@music glass_hill fade=3
They carry the Heart out of the broken Glasshouse and lay it in Suzu's lap, among her predecessors. The whole town follows us up and stands on the steps with lanterns, all the way down to the harbor, so the hill looks strung with beads.
@show suzu soft at=center
The glass has reached her heart. I can see it through her: a slow red shadow behind clear ribs, beating more slowly than a heart should. Only her face is still her own.
@show nemu panic at=right
@show hinata tears at=left
suzu (proud): Oh ho ho. Quite a turnout. Who's the lucky winner?
nemu (panic): Me.
suzu (sad): ...Nemu. You lazy idiot.
nemu (sad): I know.
suzu (soft): I finished my song. Last night, while the shelves were cracking, I tapped it out on what was left. It's a stupid song. It's made of everything you all didn't want.
@if knows_wish
  suzu (sad): I never did get my feet in the sea.
@if touched
  She reaches out without looking and finds my hand on the first try, the way she did on the first day.
@else
  She reaches out, and I give her my hand, not my sleeve.
suzu (soft): If the Heart breaks while I'm holding it, so do I. By the end it's all one glass. So somebody take it, please. Before I lose my nerve and you all lose yours.
Nemu takes one step forward, white to the lips.
My only bead came home last night. I'm clear again. I think about a row of children nine years ago, and a girl who stepped out of it. I think about the rope lying in the puddle.
@if ending_seen("salt")
  I think about running. I can almost see it: a beach at dawn, her feet in the surf, and whatever a Keeper leaves behind when she breaks, with only one person there to catch it.
@if ending_seen("fourteenth")
  I think about the Heart going into one body, a hundred years of strangers moving in like a family into a house. I think about how much lighter it would be if there were more houses.

* Take the Heart yourself. It was always supposed to be you. -> end_fourteenth
* Take Suzu's hand and run for the sea. -> end_salt
* [require endings_seen() >= 1] Turn to the town on the steps, and say your thought out loud. -> end_kindest
