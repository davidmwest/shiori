SHIORI 1

# lighthouse_climb "The Point"
@pov none
@scene lighthouse with=fade time=2
@music theme fade=3
@weather stars layer=back
@camera from=pier look=lamp time=0
The path up the point is a ribbon of chalk in the dark. Mio walks ahead with the torch, and the sea breathes on both sides of us.
@camera from=cliff look=lamp time=5 wait=true
@show mio neutral at=left
mio: Dad used to say a lighthouse isn't for the boats that are lost. It's for the ones that are nearly home.
@if trust >= 3
  mio (blush): I'm glad it's you up here. I don't think I'd have come with anyone else.
@camera from=door look=lamp time=3
The door at the top is locked. Of course it is.

@if ending_seen("lamplight")
  The key is in my pocket. I don't remember Rin giving it to me; I remember a fourth plate, and a key beside it, and understanding.
  -> two_lanterns
mio (sad): Rin has the key. She's always had it.
mio (smile): Doesn't matter. The window at the side doesn't latch.
-> lamplight

# lamplight "Lamplight"
@scene black with=fade
@cg cg_lamplight with=dissolve time=2
We climb through the window into nine years of dust. The great lens is still there, waiting, a glass beehive.
It takes both of us to turn the old brass valve. The flame catches on the third try.
@flash color=#fff3c4 time=0.6
Light goes out over the water like a held breath let go.
mio: There. Now he can't say he couldn't find the way.
She is smiling. She is crying. Below us a door bangs, and someone runs up the path calling Mio's name in a voice I have never heard Rin use.
@textbox hide
@pause
@ending lamplight "Lamplight" kind=good
-> END

# two_lanterns "Two Lanterns"
@scene harbor_night with=fade time=2
@music two_lanterns fade=2
@show rin sad at=right
@show mio neutral at=left
Rin is waiting at the foot of the stairs. She doesn't stop us. She came to say it before we do.
rin (sad): He didn't sink, Mio. He sailed for the mainland with a woman from the cannery. He wrote once. I burned it.
@shake strength=0.6
rin (angry): I put the lamp out so you'd stop waiting. You never stopped. So I kept it dark.
mio (sad): ...
For a long moment nobody moves, and the sea goes on breathing.
mio (neutral): Then we're not lighting it for him.
She takes her sister's hand, and then mine, and we climb the stairs together, three of us in a space made for one.
@cg cg_lamplight with=dissolve time=2
The light swings out over the water. It isn't for anyone who is lost. It is for the ones who are nearly home.
@ending two_lanterns "Two Lanterns" kind=true
-> END
