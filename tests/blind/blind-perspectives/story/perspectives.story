SHIORI 1

// ---- Ren: candles --------------------------------------------------
# ren_start "Ren"
@chapter "Ren" subtitle="8:00 p.m."
@pov ren
@scene flat_hall with=fade time=1
@weather rain intensity=0.8 layer=back
@show ren worried at=left
@show hana serious at=doorway
My phone is at four percent. Everything else in the flat is at zero.
The candles live in the drawer under the microwave, which is where Hana keeps things she has decided to deal with later. The matches are not there.
ren (worried): Hana? Where are the matches?
hana (serious): In the bread bin. Where else would they be?
* Ask Hana to come down to the stairwell with you.
  @set asked_hana = true
  ren (smile): Come with me? Mrs Okafor says the lights are out on every floor.
  hana (tired): I've been on my feet since five this morning. Take the torch and go.
* Light the candles yourself and say nothing.
  ren (neutral): Fine. I'll do it on my own, then.
  hana (laugh): Don't set the magnets on fire.
@mode nvl
@clear
The first candle takes three matches and most of my patience. Once it catches, the flame leans toward the stairwell, as if it wants to go and see what is down there.
There is a particular quiet in a flat when the fridge stops. You only notice the hum once it has gone.
Hana's list is still on the fridge door under a magnet shaped like a lemon. BIN DAY. CALL DAD. {i}FIX BATHROOM LIGHT (KEI){/i}. Nobody has crossed anything off since February.
@mode adv
@cg cg_candles with=fade time=1.5
ren (smile): Look. Three candles and this almost looks like a house.
hana (laugh): It's always been a house. Put that down before you set fire to the magnets.
@if asked_hana
  ren (worried): You said no when I asked you to come down.
  hana (serious): I did. I'm glad I was here for the candles anyway.
@pause
@cg none with=fade time=1.5
The flat settles into candle colours. For the first time since Monday, Ren stops checking his phone and leaves it face down on the kitchen table.
@hide all with=fade time=0.5
@ending ren_candles "Candles in the Hallway" kind=good
-> END

// ---- Hana: dough ---------------------------------------------------
# hana_start "Hana"
@chapter "Hana" subtitle="8:20 p.m."
@pov hana
@scene stairwell with=fade time=1
@show hana tired at=left
@show kei focused at=right
The stairwell smells of wet coats and the cold pipes that climb past every flat. Somebody left a torch on the landing, pointing at the ceiling like a question nobody wants to answer.
hana (tired): Kei. Are you here to help, or to stand in the dark looking clever?
kei (focused): The main fuse under the stairs blew with a hiss. I heard it from the top step.
hana (serious): So it's ours.
kei (neutral): It's the whole street's. Ours just happened to go first.
* Ask what it would take to fix it tonight.
  kei (smile): A new fuse, a torch in my teeth and somebody brave enough to hold it steady.
  hana (laugh): Tomorrow, then. Bread first.
* Say nothing and go back upstairs.
  hana (serious): Don't get electrocuted on my account, Kei.
  kei (smile): Noted. I'll keep both hands on the wall.
@filter sepia time=1.5
@mode nvl
@clear
When I was nine the power went during my grandmother's birthday. We ate cake by torchlight while my brother held the torch in his teeth and grumbled about the frosting.
That was the first time I understood that a house is not the walls. A house is whoever is still at the table.
@mode adv
@filter none time=1.5
hana (serious): Kei, I'm going to bake at midnight if I have to do it by candle.
kei (smile): You'll knead in the dark and call it rustic.
hana (laugh): I'll call it breakfast.
The dough goes onto the windowsill under a tea towel. Hana sets an alarm for four and, for once, does not write it on the list.
@hide all with=fade time=0.5
@ending hana_dough "Dough Rising" kind=normal
-> END

// ---- Kei: the roof -------------------------------------------------
# kei_start "Kei"
@chapter "Kei" subtitle="9:10 p.m."
@pov kei
@scene roof with=dissolve time=2
@weather rain intensity=0.6 layer=back
@show kei focused at=center
The roof is wet, and the door sticks in the middle of its swing, the way it has for a year. Nobody has told the landlord. Nobody has needed to, until tonight.
From up here the whole street is laid out like a wiring diagram. Three streetlights are dark in a row. The church clock has stopped at 8:16. On the corner one shop window glows yellow from a generator, and it looks almost cheerful.
Every fault has a shape. You only have to be high enough to see it.
kei (neutral): It isn't our fuse. The surge came from the substation two streets over. Hours, probably.
* Tell them the truth when you go back down.
  @set fuse_checked = true
  kei (smile): Telling people the truth is the hardest repair I know.
* Let them keep blaming the fuse box. It keeps them busy.
  kei (neutral): Nobody needs the whole street on their conscience tonight.
The church clock stays stopped. Kei starts down the stairs one step at a time, counting them out loud the way his father taught him, and the torch wobbles on every landing.
@if fuse_checked
  At the bottom of the stairs he tells Hana the truth: the whole street, not the fuse. She listens to the end, then puts the kettle on without a word.
@else
  At the bottom of the stairs he tells Hana it was the fuse box. She nods, and he watches her decide not to believe him.
@hide all with=fade time=0.5
@ending kei_roof "The Street from Above" kind=good
-> END
