SHIORI 1

// ---- The roof, later, all three of them ----------------------------
# true_start "The Roof"
@chapter "All Three" subtitle="Later, when the lights come back"
@assert endings_seen() >= 2 "The roof should only open after two other endings"
@pov none
@scene roof with=fade time=2
@weather rain intensity=0.4 layer=back
@music rain_theme
@show ren tired at=left
@show hana neutral at=center
@show kei smile at=right
Ren arrives first, with a candle in a jam jar and the face of someone who has climbed four flights in the dark.
Hana arrives second, with flour on her sleeve and a tea towel over one shoulder like a flag.
Kei is already there, of course, sitting on the wet edge of the water tank with the torch switched off, waiting to see who else would come up.
ren (tired): I followed the candle. I've been following it all week, if I'm honest.
hana (neutral): I followed the smell of you not being able to light a candle properly.
kei (smile): I came up to look at the street. The rest of you are a happy accident.
"Mrs Okafor": Is that all three of you up there? Keep it down. Some of us are trying to sleep.
@if ending_seen("ren_candles")
  ren (smile): Every time I strike a match now I think about that hallway.
@if ending_seen("hana_dough")
  hana (laugh): The bread rose the next morning. I still haven't forgiven it for being that good.
@if ending_seen("kei_roof")
  kei (focused): I've been up on that roof twice since. The street still looks like a diagram.
@if ending_seen("early_night")
  hana (serious): We went to bed in the dark that time. Nobody is doing that again.
@mode nvl
@clear
Then the street comes back on, one lamp at a time, starting with the shop on the corner and ending with the one outside our door, which has never once worked in the four years we have lived here.
@sound fuse_click
@flash color=#fff4c2 time=0.5
@cg cg_roof with=fade time=2 wait=true
Nobody cheers. Hana laughs, a bit too loudly, and asks who is going to turn the oven off, because the bread has definitely risen.
Ren thinks about the list on the fridge, which nobody has crossed anything off since February. Kei thinks about the substation, and the men who will be up a pole in the rain tomorrow. Hana thinks about nothing at all for almost a full minute, which she later says is the best thing that has happened to her all year.
@mode adv
@cg none with=fade time=1.5
@set saw_true_ending = true
ren (smile): Same time next blackout?
kei (smile): Bring candles. And tell the landlord.
@music stop fade=4
@hide all with=fade time=1
@ending true_roof "The Street, Back On" kind=true
-> END
