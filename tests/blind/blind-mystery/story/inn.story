SHIORI 1

// ---- The inn: arrival, the Tern Room, the hub and its rooms ----

# arrival
@scene inn_hall with=fade time=1.5
@show hester worried at=left
Hester Gull is wringing a tea towel the way other people wring their hands. The hall smells of wet coats, and the storm leans on every window at once.
hester: You'll be the detective. I'm sorry it's you that had to come on a night like this.
hester (stern): Lucan Pryce took the top room, the Tern Room, and paid a week in advance. He took the key himself, the way he took everything.
hester (worried): The spare key hangs on that hook behind the desk, and the hook is empty now. I haven't moved it. I haven't.
@set clue_hook = true
The constable went up the third-floor stair an hour ago and has not come down. You can hear him moving about overhead, and then not moving at all.
-> discovery

# discovery
@scene tern_room with=fade time=1.5
@sound knock
@cg cg_body with=fade time=1.2
Lucan Pryce lies on the boards beside the window. One hand is still open, as if he had been reaching for the bell rope.
The constable had to put his shoulder to the door at seven. The bolt on the inside was still shot home. No key was found in the room. {w}Nobody has been in or out since.
@cg none with=fade
{i}A locked room.{/i} That is the first thing everyone says, and the last thing you should believe.
@call examine_room
@scene inn_hall with=fade time=1
-> hub

# hub
@scene inn_hall with=dissolve time=0.6
Where do you go next, {$detective_name}?
* The kitchen, where the boatman keeps his ropes. -> kitchen
* The office behind the desk. -> office
* Dr. Calloway, who sat with the body until the constable came. -> ines_talk
* Go back up to the Tern Room for another look. -> review
* [require clues >= 2] Name the person you believe did it. -> accuse

# kitchen
@scene kitchen with=fade time=1
@show tobias nervous at=right
The kitchen is warm and smells of fish stock. Tobias Marr is scraping a pan that is already clean.
tobias: Storm's keeping everyone in tonight. Can I get you something?
-> kitchen_menu

# kitchen_menu
* [once] Ask where he was last night.
  tobias (angry): Out on the rocks, same as every night. The tide doesn't check whose business it is.
  The answer comes too quickly, and he does not look up from the pan.
  -> kitchen_menu
* [once] Check the boots by the back door.
  @set clue_boots = true
  @set clues += 1
  The boots are dark with seawater to the ankle, and salt has crusted white along the seams. Nobody walks the causeway at low tide and comes back dry.
  tobias (nervous): Those are mine. I was out on the causeway, that's all. I'm no murderer, detective.
  -> kitchen_menu
* Leave the kitchen. -> hub

# office
@scene office with=fade time=1
Lucan Pryce's desk is buried in paper. A ledger lies open under the lamp, its last column still tacky with ink.
-> office_menu

# office_menu
* [once] Read the ledger.
  @set clue_debt = true
  @set clues += 1
  | {i}Marr, boat hire. Six weeks behind. Ten pounds by Friday, or the boat is mine.{/i}
  | Tobias owes Lucan money, and Lucan had been threatening to take the boat he works from.
  -> office_menu
* [once] Look through the drawers.
  Receipts, a letter from a bank, a child's drawing of a lighthouse. Nothing in them points at anyone.
  -> office_menu
* Leave the office. -> hub

# ines_talk
@scene inn_hall with=fade time=1
@show ines calm at=center
Dr. Calloway has the stillness of someone who has seen a great many bad nights. She holds a cup of tea she has not touched.
ines: I certified the death at a quarter to eight. He had been dead for hours, and the cold in that room is not only the sea.
ines (shaken): I sat with him until the constable came. I didn't touch the window.
-> ines_menu

# ines_menu
* [once] Ask whether she heard anyone on the stairs.
  ines (sharp): I took a sleeping draught at ten. Nothing woke me but the storm, and the storm woke everyone.
  -> ines_menu
* [once] Ask about the bolt.
  ines (calm): The bolt is old and stiff. You would need two hands and a reason to shoot it from the inside. Shooting it from the outside is another question, and not mine.
  -> ines_menu
* Thank her and leave. -> hub

# review
@scene tern_room with=fade time=1
@call examine_room
@scene inn_hall with=fade time=1
-> hub
