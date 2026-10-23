SHIORI 1
title: Smoke Test
start: harbor

@character mio
  name: Mio
  color: #f29bb0
  sprite: chars/mio/{expression}.svg
  expression: neutral smile sad blush

@image harbor bg/harbor.svg
@audio theme music/theme.lmn
@var trust = 0

# harbor "The Harbor"
@scene harbor
@music theme
@show mio smile at=left
mio: The tide's coming in. Stay a little longer?
She doesn't look at me when she asks.

* Stay.
  @set trust += 1
  mio (blush): Good.
* Leave. -> walk_home

@if trust >= 1
  The lighthouse turns its slow eye across the water.
  @ending together "Together" kind=good
@else
  Nothing.
-> END

# walk_home
mio (sad): Right. Of course.
@ending alone "Alone" kind=bad
-> END
