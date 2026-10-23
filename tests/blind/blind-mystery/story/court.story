SHIORI 1

// ---- Part Two: the accusation and its endings ----

# accuse
@chapter "Part Two — Whom Do You Name?"
@scene inn_hall with=fade time=2
@filter none time=1
@show hester neutral at=farleft
@show ines calm at=center
@show tobias nervous at=farright
@assert clues >= 2 "the hub only opens this scene with two clues"
The whole household is gathered in the hall. The storm drums on the shutters, and the clock behind the desk ticks loud enough to hear.
{$detective_name}, the room is waiting for you to speak.
-> accuse_menu

# accuse_menu
* Accuse Tobias Marr, the boatman.
  @move tobias at=center time=1
  tobias (angry): You've got a boot and a bit of string. Say it properly, or sit down.
  @if clues >= 3
    -> solved
  @else
    -> unproven
* Accuse Hester Gull. -> hester_wrong
* Accuse Dr. Calloway. -> doctor_wrong
* Accuse the gull on the windowsill. -> gull_joke

# solved
@flash color=#ffffff time=0.3
@shake strength=1 time=0.4
@music stop fade=3
@camera zoom=1.15 time=2
@filter noir time=1.5
Tobias had walked the causeway at the lowest tide of the night, his boots full of sea. He came in by the back door and climbed the stair. Lucan opened his door to a knock and a debt, and the argument did not last long.
Afterwards Tobias did the one thing a boatman would think of. He drew a loop of tarred line under the Tern Room door, hooked the bolt through the gap, and pulled it home from the outside. Then he walked back down the stair as though he had only been to fetch a pan.
@if clue_boots
  The salt on his boots was the first thing you noticed, and it had not come from the kitchen.
@if clue_draught
  The pale scrape along the sill marked where the line had run through the gap.
@if clue_thread
  The black thread caught in the keeper was the cord that did the work.
@if clue_debt
  The ledger gave him a reason. Lucan had been threatening to take the boat he lived from.
{b}The room was never sealed.{/b} It was bolted by a man who knew exactly how the bolt would sit.
@set solved_before = true
@ending tide_table "The Tide Table" kind=true
-> END

# unproven
@move tobias at=center time=0.8
tobias (angry): Then go and prove it, detective. Go on.
Nothing comes. You have some of the pieces, but not enough to hang a man on in front of his neighbours.
Tobias straightens his coat, takes his lantern, and walks out into the storm. You will suspect him for the rest of your life, and you cannot prove a word of it.
@ending not_enough "Not Enough Rope" kind=normal
-> END

# hester_wrong
@move hester at=center time=0.8
hester (stern): Me? I locked my own back door at eleven and went to bed with flour on my hands.
hester (worried): The hook was empty because I took the spare to the back door at dusk. I told no one, and that was foolish. It was not murder.
@if clue_hook
  The empty hook is the only thing you have against her, and you have built a whole case on a missing key.
The constable leads her to the cart anyway, which is the last thing a storm-bound inn needs. Somewhere below, a pan is being scraped very clean.
@ending empty_hook "The Empty Hook" kind=bad
-> END

# doctor_wrong
ines (sharp): I certified a death. I did not tie a bolt. If you need a doctor for your theory, you have picked the wrong one.
The room goes quiet in a way the storm cannot explain. You have accused the one person who sat beside the body and told the truth about it.
@ending bad_diagnosis "A Doctor's Diagnosis" kind=bad
-> END

# gull_joke
@sound gull
The gull on the windowsill regards the room with the calm of a creature that has never been asked a question. It considers you, then the lamp, then the storm. Then it flies off, and the hall lamp goes out.
@ending gull_joke "The Gull on the Sill" kind=joke
-> END
