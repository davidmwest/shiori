SHIORI 1
title: The Lantern Princess
developer: Claude (AI-written blind test game)
author: Claude
language: en
description:
  Two weeks before the school festival, Aoi is drafted to play the knight in Rin's play, a story Rin wrote for herself and cannot say out loud. Rehearsals, small confessions and one rooftop evening decide what the last scene will mean.
status: finished
release_type: complete
version: 1.0
age_rating: 12
ero: false
freeware: true
doujin: true
platforms: web
ai_generated: story

@character aoi
  name: Aoi
  color: #6aa5d8
  sprite: chars/aoi/{pose}_{expression}.png
  expression: neutral smile worried blush surprised
  pose: stand arms_folded
  blink: chars/aoi/blink_{pose}.png
  role: protagonist
  gender: female
  age: 17
  description: A second-year who joined the drama club to help with props and ended up on stage.

@character rin
  name: Rin
  color: #e68aa6
  sprite: chars/rin/{pose}_{expression}.png
  expression: neutral smile sad blush surprised
  pose: stand holding_script
  blink: chars/rin/blink_{pose}.png
  role: main
  gender: female
  age: 17
  description: The club's playwright. She writes brave princesses and cannot say their lines out loud.

@image auditorium bg/auditorium.png
@image corridor bg/corridor_evening.png
@image rooftop_dusk bg/rooftop_dusk.png
@image stage_night bg/stage_night.png
@image cg_lanterns cg/two_lanterns.png title="Two Lanterns"

@audio theme_rehearsal music/rehearsal.lmn title="Dust in the Work Lights"
@audio theme_night music/rooftop_night.lmn title="The Night Before"
@audio theme_curtain music/curtain.lmn title="Lantern Princess"
@audio crowd sfx/crowd_murmur.ogg volume=0.5
@audio applause sfx/applause.ogg
@audio school_bell sfx/school_bell.ogg

@var warmth = 0          // how much Rin has come to care for Aoi
@var nerve = 0           // how honest Aoi dares to be
@var knows_fear = false  // Aoi has learned that Rin's hands shake
@var ending_cut = false  // Rin cut the last scene of her play
@var confessed = false   // Aoi said it out loud
@var said_oath = false   // Aoi spoke the knight's oath to Rin's face

# opening "After the Bell"
@chapter "Act One" subtitle="The Princess Needs a Knight"
@scene auditorium with=fade
@music theme_rehearsal
@sound school_bell
@pov aoi
The last bell has rung, but the old auditorium still smells of floor wax and stage paint. Aoi only came in to return a borrowed stapler.
@show rin neutral holding_script at=right
Rin is alone in the middle of the stage, a bundle of pages pressed to her chest as if the script might try to escape.
rin (neutral): Aoi. Good. You're here.
@show aoi surprised stand at=left
aoi (surprised): I just came for the stapler...
rin (sad): Our knight quit this morning. Kana said the lines were too embarrassing to say out loud.
Aoi has watched Rin write this play since April, always in the back row with her hood up and her pencil flying. Nobody has ever been allowed to read a page.
rin (neutral): The festival is in two weeks. I know you can't act. You don't have to be good. You just have to be there.
Under the work lights the dust turns to slow gold. Rin holds the script out in both hands, the way people offer something they have already half given up on getting back.
aoi (worried): Why me?
rin (blush): ...Because you listened when I read the first scene. You didn't laugh.

* Take the script.
  @set warmth += 1
  aoi (smile): Okay. I'll try. But if I forget a line, you're prompting me.
  rin (smile): Deal.
* Ask to read it properly first.
  @set nerve += 1
  aoi (neutral): If I'm going to be your knight, I want to know what I'm swearing to.
  rin (surprised): ...That is exactly what the knight would say.

Rin lets out a breath she seems to have held since morning. The pages change hands, still warm from her fingers.
-> between_takes

# between_takes "Between Takes"
Rin sits on the lip of the stage with her legs dangling over the dark orchestra pit, and pats the boards beside her. Aoi sits close enough to hear her breathe.
@show rin smile stand at=midright
@move aoi at=midleft
rin (smile): Ask me anything about the play. One question at a time. Then we start.
-> ask_rin

# ask_rin "Questions"
rin (neutral): So. What do you want to know?
* [once] Why a play about lanterns?
  rin (smile): My grandmother made them, paper ones for the river festival. She said a lantern is a promise you let go of, and trust someone downstream to catch.
  Rin looks at her hands while she says it, the way she always does when something is true.
  @set warmth += 1
  -> ask_rin
* [once] Why does the princess have so few lines?
  rin (sad): Because I wrote her the way I talk. Mostly not.
  aoi (smile): I like how you talk.
  rin (blush): ...That isn't an answer. That's just a nice thing.
  @set warmth += 1
  -> ask_rin
* [once] Are you nervous about the festival?
  rin (sad, holding_script): My hands shake. Every time I stand on this stage. I hide them in the script.
  Aoi remembers now: the pages always trembling, their corners gone soft from being gripped.
  @set knows_fear = true
  @set warmth += 1
  -> ask_rin
* That's enough. Let's start. -> rehearsal

# rehearsal "The Knight's Oath"
@camera zoom=1.15 time=2
@move rin at=right time=0.8
@move aoi at=left
The last scene is only eleven lines long. The princess must cross the river by lantern. The knight must stay on the shore, keeping the other lantern lit until she is safely across.
rin (neutral, stand): "Sir Knight. The river is wide and the night is long. Will you wait for me?"
Her voice is steadier than Aoi expected. It is the voice of someone reading from very far away.
rin (smile): Your line. Don't look at me, look at the lantern.
aoi (worried): "I will wait... for as long as the lantern burns."
Rin stops. Aoi looks up from the page and finds Rin looking at her, the way you look at a stranger who has just said your own name.

* Put the page down and say it to her face.
  @set nerve += 1
  @set warmth += 1
  @set said_oath = true
  aoi (blush, stand): "For as long as the lantern burns. And then I will light another."
  Silence. In the wings a loose rope taps against the wall, once, twice.
  rin (blush): That isn't in the script.
  aoi (smile): It is now.
* Keep reading, flat, hiding behind the page.
  @set warmth -= 1
  aoi (neutral): "As long as the lantern burns."
  rin (sad): ...Right. That's fine. That's how a knight would say it.
  The light goes out of Rin's face so quietly that Aoi almost misses it.

@camera reset time=1
Rin takes a long moment to find her place again. Then they run the scene a second time, and a third, until the windows go dark.
-> interlude

# interlude "Rin, Afterwards"
@chapter "Intermission" subtitle="Rin"
@pov rin
@scene corridor with=fade
@filter dusk
Rin walks home the long way, past the dark classrooms, her script folded into her bag. Her hands have stopped shaking, which is strange. They never stop on their own.
@if said_oath
  She keeps hearing it: {i}for as long as the lantern burns.{/i} Nobody has ever promised her a thing like that, not even as a line. Her chest feels like a paper lantern, thin and lit from inside.
@else
  She keeps hearing the flat voice behind the page. It is not Aoi's fault. Rin wrote a knight who promises everything, and no one should have to say that to someone they barely know.
Whatever happens at the festival, she thinks, the knight will be Aoi. She cannot imagine anyone else standing on that shore.
-> rooftop

# rooftop "The Night Before"
@chapter "Act Two" subtitle="The Night Before"
@pov aoi
@scene rooftop_dusk with=fade
@filter dusk
@music theme_night
@weather fireflies layer=back
Thursday evening, and the rooftop is empty except for a coil of fairy lights, a thermos of tea, and Rin, sitting against the water tank with her script open and a red pen in her fist.
@show rin sad holding_script at=right
@show aoi neutral stand at=left
aoi (neutral): You're supposed to be resting.
rin (sad): I'm cutting the ending.
aoi (surprised): What? You can't. That's the best part!
rin (sad): The princess crosses the river and never looks back. Everyone will think it's about something. Someone. I'd rather they think it's about a river.
The pen hovers over the last page. Below them the festival stalls are being strung with lanterns, one pale bulb at a time, and the whole school looks like it is quietly getting ready to be brave.

* [require knows_fear] Tell her you've noticed her hands, and that you'll stand where she can see you.
  @set warmth += 1
  @set nerve += 1
  aoi (smile): Your hands shake before every scene. I noticed. So I'll stand where you can see me. That's all a knight has to do.
  rin (blush): ...You noticed that.
  The pen slips from Rin's fingers and rolls across the concrete. Neither of them goes after it.
* Tell her the ending is the best thing she has written.
  @set nerve += 1
  aoi (smile): It's the only part that sounds exactly like you. Don't cut it.
  rin (surprised): ...Okay. Okay, I won't.
* Tell her to cut it if it scares her.
  @set warmth -= 1
  @set ending_cut = true
  aoi (neutral): It's your play. Do whatever keeps you safe.
  rin (sad): ...Right. Safe.
  Rin's pen moves. One red line goes through the last page.

They stay there until the fairy lights flicker on by themselves. Somewhere below, a class is singing off key, and for a while neither of them says anything at all.
-> festival_night

# festival_night "Curtain"
@chapter "Act Three" subtitle="The Lantern Princess"
@scene stage_night with=fade
@music theme_curtain
@ambience crowd
The auditorium has never been this full. Parents crowd the aisles, little siblings kneel on the seats, and the curtain breathes in and out with the audience. In the wings Aoi's armor, made of cardboard and silver tape, is already coming unstuck at one shoulder.
@show rin sad holding_script at=right
@show aoi worried stand at=left
rin (sad): My hands are doing it again.
aoi (worried): Look at me, not at them.
rin (neutral): ...Okay. Okay. Eleven lines. I can do eleven lines.
The curtain rises. For forty minutes the world is only the stage: the painted river, the paper lanterns swaying on their wires, Rin's voice growing steadier with every scene, as though she were walking out onto ice and finding that it holds.
@ambience stop fade=2
Then comes the last scene. The shore. The two lanterns.
@if ending_cut
  Rin has cut the ending. The princess steps into the boat and the lights go down before the knight can speak. The audience applauds politely, never knowing that it missed anything.
@else
  Rin speaks the final line exactly as she wrote it. It is the only line she ever wrote for herself.
  rin (blush): "I will cross. But look back, and you will see me looking back too."
  aoi (smile): "Then I will keep the lantern lit, and I will not stop looking."
@sound applause
The applause goes on and on. Afterwards the cast streams out to the courtyard, but Rin stays behind in the wings, holding the second lantern, waiting without admitting she is waiting.
@show rin neutral holding_script at=center
rin (neutral): ...Thank you for standing where I could see you.
Aoi knows there are words for this. Several. All of them are too big to carry in a single breath.

* [require warmth >= 4 and nerve >= 2] Take her hand and say it plainly.
  @set confessed = true
  aoi (blush): It was never the knight who was waiting, Rin. It was me. It has been me since April.
  rin (blush): ...Aoi.
* Tell her the play was wonderful, and leave it there.
  aoi (smile): It was wonderful. You were wonderful.
  rin (smile): Thank you. Really.
* Slip away with the crowd.
  @set warmth -= 1
  aoi (worried): I should find my parents.
  rin (sad): Of course.

@if confessed
  -> curtain_call
@elif warmth >= 3
  -> quiet_friends
@else
  -> empty_seat

# curtain_call "Curtain Call"
@cg cg_lanterns
The second lantern is cold in Rin's hand, and then it is not. Aoi lights it from her own, flame to flame, the way a promise passes from one person to another.
rin (blush): I wrote the princess so she would never have to say it.
rin (smile): Say it again.
aoi (smile): I'll wait as long as the lantern burns. And then I'll light another.
Outside, the river festival has begun. Paper lanterns drift down the dark water, hundreds of them, each one a promise let go. Two girls stand at the railing with their hands joined, and trust whoever is downstream to catch them.
@ending curtain_call "Curtain Call" kind=good
-> END

# quiet_friends "The Unlit Lantern"
@scene corridor with=fade
The festival ends the way festivals do, in a litter of paper cups and fading lights. Aoi and Rin carry the cardboard armor back to the club room side by side, the second lantern swinging unlit between them.
@show rin smile stand at=right
rin (smile): Same time next year? I'm writing a ghost story.
@show aoi smile stand at=left
aoi (smile): ...I'll be there. Write me a part with no armor.
rin (blush): Deal.
It is a good answer. It is also, Aoi thinks, only the first half of the sentence she meant to say. Maybe next year the knight will finish it.
@ending quiet_friends "The Unlit Lantern" kind=normal
-> END

# empty_seat "The Empty Seat"
@scene corridor with=fade
By Monday the posters are down and the auditorium is locked. Aoi finds a folded page in her locker: the final scene of the play.
@if ending_cut
  One red line runs through its last word, the way a pen goes through something it was never meant to keep.
@else
  It is whole and untouched, and there is no note, which is somehow worse.
Rin's chair in the club room stays empty. Aoi stops at the door longer than she means to.
"Kana": Rin quit the club. Said she was finished with plays.
aoi (worried): Did she say why?
"Kana": Only that the knight did a good job.
Aoi nods as though that settles something. It settles nothing.
The knight kept to the shore, and the lantern burned down, and there was no one there to light another.
@ending empty_seat "The Empty Seat" kind=bad
-> END
