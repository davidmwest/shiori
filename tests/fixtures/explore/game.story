SHIORI 1
title: Explore Fixture

@gameplay coin games/coin.js minutes=0.1 results="win lose"
@var roll = 0
@var coin = ""
@var always = true
@var got = 0

# start
The die rolls across the table.
@set roll = random(1, 3)
@if roll == 1
  It shows one.
@elif roll == 2
  It shows two.
@else
  It shows three.
@if always
  This condition never changes.
@game coin into=coin
@if coin == "win"
  You win the toss.
  @ending first "First" kind=good
  -> hub
@else
  You lose the toss.
-> hub

# hub
@set got += 1
* [once] Look again. -> hub
* Leave.
  @if chance(0.5)
    A gull laughs.
  @ending second "Second" kind=normal
  -> END
