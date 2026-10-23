SHIORI 1
title: The Nap of Alaric Nodd
developer: Lantern Pot Studio
author: Claude (AI)
description:
  Alaric Nodd is the court wizard of Pumbleton, and he has not cast a useful spell in nine years. Today a Guild inspector arrives. Every shortcut Alaric takes leads, firmly and wetly, somewhere else.
language: en
status: finished
release_type: complete
version: 1.0
age_rating: 0
ero: false
freeware: true
doujin: true
platforms: web
ai_generated: story
reading_speed: 200

@character alaric
  name: Alaric Nodd
  color: #9b8cf0
  sprite: chars/alaric/{expression}.png
  expression: neutral smug panicked sheepish dazed
  role: protagonist
  gender: male
  age: 47
  description: Court wizard of Pumbleton. Talented, tired, and always one nap away from a better plan.

@character humphrey
  name: King Humphrey
  color: #e6b94a
  sprite: chars/humphrey/{expression}.png
  expression: neutral booming delighted furious
  role: main
  gender: male
  age: 60
  description: Ruler of Pumbleton. Loud, kind, and convinced that magic is mostly volume.

@character quill
  name: Inspector Quill
  color: #6fc3b2
  sprite: chars/quill/{expression}.png
  expression: neutral stern soaked impressed
  role: main
  gender: female
  age: 55
  description: Guild Inspector of Wizards, third class. Arrives in a hood and leaves with notes.

@image throne_room bg/throne_room.png
@image tower_study bg/tower_study.png
@image courtyard bg/courtyard.png
@image broom props/broom.png scale=0.8
@image cg_flood cg/great_soggening.png title="The Great Soggening"
@audio court_jig music/court_jig.ogg title="Court Jig in B-Flat Minor-ish"
@audio scheme_theme music/scheming.ogg title="Scheming, Lightly"
@audio poof sfx/poof.ogg
@audio splash sfx/splash.ogg
@audio gong sfx/gong.ogg
@gameplay broom_rodeo games/broom_rodeo.js minutes=2 results="win lose"
@position dais x=0.8 scale=1.1
@position doorway x=0.92 scale=0.85

@var favour = 0
@var rodeo_result = ""
@var biscuit = false

# throne "The Throne Room"
@scene throne_room with=fade
@music court_jig
@show humphrey neutral at=dais
The throne room of Pumbleton smells of floor polish, cold soup and mild panic. King Humphrey is pacing, which is hard on the carpet.
Pumbleton is a small kingdom. Its borders are mostly suggestions, its army is mostly the king's cousin, and its court wizard is mostly asleep.
humphrey (booming): ALARIC! WHERE IS MY COURT WIZARD?
The king glares at the empty chair beside his throne. Then at the carpet. The carpet is snoring.
@show alaric dazed at=left
Alaric Nodd unrolls himself from the rug, pointed hat first, with great dignity, which is to say very, very slowly.
alaric (dazed): Present, Majesty. Present and extremely vigilant.
humphrey (neutral): The Wizards' Guild is sending an inspector. Today. If you have done nothing useful in nine years, you are dismissed.
alaric (sheepish): Define "useful".
@shake strength=1.5 time=0.4
humphrey (furious): THE LAST SPELL ON RECORD IS "PIGEON, LARGER"!
High in the rafters, the pigeon in question shifts its terrier-sized bulk. It has not forgiven anybody.
Nine years ago the king asked for a slightly larger pigeon, to carry heavier letters. Alaric, who had been meaning to nap, rounded up.
alaric (smug): Majesty, I have a plan. A long-term plan.
A chamberlain drops a tray of cups. Nobody picks it up. In Pumbleton nobody picks anything up; it is a matter of local pride.
humphrey (neutral): Is the plan a nap?
* "It is a very advanced nap."
  @set favour += 1
  humphrey (delighted): Ha! Honest, at least. I like that in a wizard.
* "It is a miracle, and I need until noon."
  @set favour += 2
  humphrey (booming): NOON! Hear that, court? A MIRACLE BY NOON!
  The court, which has heard this before, applauds with the enthusiasm of wet laundry.

The king claps his hands once. Somewhere a gong shivers.
@sound gong
humphrey (neutral): Go. Do something. Anything. Preferably dry.
-> tower

# tower "The Wizard's Tower"
@scene tower_study with=fade
@music scheme_theme
@show alaric smug at=center
The tower study has not been tidied since the old queen's funeral. Dust sits on the dust. A crystal ball holds down a stack of unpaid bills, and does it well.
On the wall hangs the Scheme Board, a slate listing every plan Alaric has made to avoid work. Be out. Be ill. Be a different wizard. Hire an apprentice, on the grounds that apprentices are free. All of them are crossed out.
alaric (smug): Which leaves scheme five. Make something else do the work, and take the credit.
He chalks a small tick beside scheme five, which he considers the same thing as finishing it.
alaric (smug): Why clean when I can {i}delegate{/i}? Enchantment is just housework with better branding.
@show broom at=right
@sound poof
A broom hops out of the cupboard and hovers before him like a nervous intern.
alaric (smug): Sweep. Dust. File the bills. Look busy. That is all I ask of you.
@rename quill "???"
@show quill neutral at=doorway
A knock, and the door opens before Alaric can pretend to be out. A figure in a grey hood stands there, clutching a clipboard and showing no expression at all.
quill: Court Wizard Nodd?
alaric (sheepish): You're early. Delivery? Apprentice? Either way, don't stand there like a coat rack.
Nobody has seen the figure's face. Nobody has thought to ask, which is Alaric's first mistake of the day, and it is not even noon.
* Offer the stranger a chair and a biscuit.
  @set favour += 1
  @set biscuit = true
  alaric (neutral): Sit, sit. Biscuit? They are only slightly enchanted.
  The biscuit squeaks. The stranger sets it down with enormous restraint.
* Hand the stranger a mop.
  alaric (smug): That corner, please. And thank you.
  The stranger holds the mop at arm's length, like a dead fish that has filed a complaint.

@wait 1
@camera zoom=1.6 y=0.1 time=0.3
The broom shivers. It looks at the stranger. It looks at Alaric. It looks, he thinks, very hungry for work.
@move broom at=farleft y=-0.15 scale=1.3 time=0.2 ease=back
@shake strength=2 time=0.6
@camera reset time=0.3
alaric (panicked): I said {i}sweep{/i}, not {i}conquer{/i}!
@sound splash
There are four brooms now, then eleven. They carry buckets from somewhere that is not the well, and water climbs the stairs one polite step at a time.
alaric (panicked): Stranger! Hold my hat! I have a rodeo to attend!
-> rodeo

# rodeo "Broom Rodeo"
@bg courtyard
@hide quill
@move alaric at=left time=0.5
@show broom at=center scale=1.5 y=0.05
Alaric chases the flood down the stairs and out into the courtyard, where eleven brooms are doing something unspeakable to a flower bed. He rolls up his sleeves. Out of habit, they roll back down.
alaric (panicked): Right. Nobody panic. I will panic for all of us.
The rules of broom rodeo, as Alaric understands them, are three. Hold on. Do not let go. Do not look at the king's roses. He has never read the rules, because he is making them up on the way down the stairs.
The nearest broom rears, bristles bristling, and the whole courtyard seems to take a breath.
@game broom_rodeo into=rodeo_result
@if rodeo_result == "win"
  @sound gong
  The last broom goes still in his arms. Alaric stands over the wreckage, triumphant, one sandal missing, a petunia in his hair.
  alaric (smug): ...Ha. Ha! Never in doubt.
  The other ten brooms notice, one by one, that their leader has stopped. They stop too, with the guilty air of dogs caught on a sofa.
@else
  @sound splash
  @shake strength=2 time=0.8
  The brooms win. They always win. A wave lifts Alaric off his feet and carries him, dignity first, through the great doors.
  @cg cg_flood
  The Great Soggening of Pumbleton lasts four minutes. It will be mentioned in songs, none of them kind.
  The brooms, delighted, form an honour guard and escort him all the way to the throne room, bristles clapping.
  @cg none
-> reveal

# reveal "The Inspection"
@scene throne_room with=dissolve
@show humphrey neutral at=dais
@show alaric neutral at=left
@show quill neutral at=doorway
@if rodeo_result == "win"
  The court gathers round, dripping a little. The stranger in the grey hood has followed every step, taking notes at a steady pace.
@else
  The court stands ankle-deep. The grey-hooded stranger waits in the middle of it, notebook held high, perfectly still.
The throne room is full of people who would rather be anywhere else, and one pigeon who would not.
humphrey (neutral): Wizard Nodd. This is the Guild's inspector, who has been so good as to follow you around all morning.
alaric (panicked): The {i}what{/i}?
@camera zoom=1.4 time=0.3
@rename quill
@show quill stern
The hood falls back. Under it is a woman who has failed three dragons and a duke, and enjoyed both.
@camera reset time=0.6
quill (stern): Inspector Quill, Wizards' Guild, third class.
@if biscuit
  quill (stern): You gave me a biscuit. It squeaked. I have notes.
@else
  quill (stern): You gave me a mop. I have never been given a mop. I have notes.
She opens her clipboard and reads from it in a voice like a tax form.
quill (stern): Punctuality, asleep under a rug. Initiative, delegated to a broom. Disaster management, see attached flood.
Alaric tries to read the clipboard upside down. It does not help. The ink is red, and there is a great deal of it.
@if rodeo_result == "win"
  @show quill impressed
  quill (impressed): You wrestled eleven enchanted brooms in one sandal. It is the most spellwork this Guild has seen from you in nine years.
@else
  @show quill soaked
  quill (soaked): I am wet to the knee, Wizard Nodd. I am recording this as a {shake}deeply personal experience{/shake}.
Quill clicks her pen. The whole court holds its breath, including the pigeon.
quill (stern): You have one chance to speak before I write my report. Choose carefully.
* [if rodeo_result == "win"] Take full credit.
  alaric (smug): Obviously, I planned all of it.
  -> end_promoted
* [if rodeo_result == "lose"] Blame the broom.
  alaric (panicked): It was the broom's idea! It was already enchanted when I found it!
  -> end_moat
* [require favour >= 2] Ask the king to vouch for you.
  alaric (sheepish): Majesty? A word? Any word?
  -> end_royal
* Confess everything.
  alaric (sheepish): I have done nothing useful in nine years. I was rather hoping you would not ask.
  -> end_honest

# end_promoted "Employee of the Month, Somehow"
quill (impressed): Nobody plans that. But nobody has ever managed it, either. Report: chaotic, effective, do not ask him to repeat it.
The Guild promotes Alaric to Chief Wrangler of Brooms. He is given a bigger office, a smaller pigeon, and a strict instruction never to say "sweep" within a mile of a cupboard.
alaric (smug): Technically, this is a nap with a title.
@ending promoted "Employee of the Month, Somehow" kind=good
-> END

# end_moat "Moat Duty"
quill (stern): The broom, Wizard Nodd, was enchanted by you. It has also, I note, filed no paperwork.
humphrey (furious): MOAT DUTY! Until further notice! Until the moat is full!
The moat is very large and the bucket is very small. Alaric fills it a little every day, while the pigeon watches from the bank with deep, dark joy.
@ending moat_duty "Moat Duty" kind=joke
-> END

# end_honest "The Honest Nap"
Quill lowers her pen. For the first time, the corner of her mouth moves, though it may have been a draught.
quill (neutral): Nobody has told me the truth in the field in eleven years. Probation, then: one useful spell a month.
alaric (sheepish): Could it be a small one? Or a nap?
quill (stern): Do not push your luck, Wizard Nodd.
Alaric does not push his luck. He is far too tired to push anything. He keeps his job, and a very small spell, due Friday.
@ending honest_nap "The Honest Nap" kind=normal
-> END

# end_royal "A Restful Decree"
humphrey (delighted): Inspector! Nine years he has not troubled me with a single spell. Do you know how restful that has been?
The court nods slowly. Even the pigeon nods, a little.
quill (impressed): ...Restful. I will note that.
In the end the Guild issues its ruling: Alaric Nodd is declared adequate, in a restful way. He sleeps well. The pigeon is made Royal Pigeon, Larger.
@ending royal_decree "A Restful Decree" kind=true
-> END
