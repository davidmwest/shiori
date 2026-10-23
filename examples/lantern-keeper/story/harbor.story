SHIORI 1

# harbor "The Pier"
@chapter "The Pier"
@scene harbor_dusk with=dissolve time=2
@weather fireflies layer=back intensity=0.6
The tide comes in the colour of weak tea. Someone is already sitting at the end of the pier, swinging her legs over the water like a child.
@show mio neutral at=center
She turns before I can decide whether to call out.
mio (surprised): ...Aoi?
mio (smile): You're six years late. I saved you the dry end of the bench.
The bench is a plank nailed across two pilings. She pats the dry end.

* Sit beside her.
  @set trust += 1
  I sit. The wood is still warm from the sun, and her shoulder is an inch from mine.
  mio (blush): You actually sat. You used to say it would collapse.
  aoi: It still might.
* Stay standing. -> standing

mio (neutral): Grandma Sato's house?
aoi: Selling it.
mio: Mm. Everyone sells to the city people now.
She says it without blame, the way you'd remark on the weather.
-> ask_mio

# ask_mio
@camera zoom=1.15 time=2
mio: Go on. You've got the face you get when you're saving up questions.
* [once] Ask about the lighthouse.
  @set asked_lamp = true
  mio (sad): Still dark. Rin says the council won't pay for a keeper. Rin says a lot of things.
  aoi: You could light it.
  mio (neutral): I could. I don't.
  -> ask_mio
* [once] Ask about her father.
  @set asked_father = true
  @set trust += 1
  @camera reset time=1
  She looks at the water for a long time.
  mio (sad): Nine years in March. I still set his place. Rin hates it.
  mio (smile): Isn't that stupid? You can say it's stupid.
  aoi: It isn't stupid.
  -> ask_mio
* [require asked_lamp and asked_father] Ask if she'd climb the lighthouse with you tonight.
  @camera reset time=1
  mio (surprised): Tonight?
  mio (blush): ...After Rin's asleep. Bring a torch.
  -> rin_interlude
* Say goodnight. -> goodnight

# goodnight
@camera reset time=1
mio (smile): Goodnight, then. Don't leave for another six years.
She walks back along the pier, and the fireflies close behind her like a curtain.
@hide mio with=dissolve time=1.2
@ending supper "A Place Set at Supper" kind=normal
-> END

# standing
mio (sad): Suit yourself.
@move mio at=right time=1.5
She shifts to the very end of the plank, as if to make room for someone who isn't coming.
I stand there long enough for it to become a decision.
@scene harbor_night with=fade time=2
@music unlit fade=2
The bus back to the city leaves at nine. I am on it.
@ending dry_end "The Dry End of the Bench" kind=bad
-> END
