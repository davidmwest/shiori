SHIORI 1
title: Gameplay Test
modules: mods/confetti.js

@gameplay coin games/coin.js minutes=0.2 results="win lose"
@var result = ""

# start
The ferryman flips a coin and covers it with his hand.
@game coin into=result
@if result == "win"
  @confetti amount=200
  You called it. The crossing is free.
@else
  Wrong. You pay the full fare.
-> END
