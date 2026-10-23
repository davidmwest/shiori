SHIORI 1

// ---- Reusable scene: examine the Tern Room ----
// Called with @call from two places. Its clue options are [once], so every visit
// offers only what is left, and "That will do." is always there to return.

# examine_room
The Tern Room is cold, and the storm has found its way in under the sash. The bolt on the inside of the door is shot home.
@set flavour = random(1, 3)
@if flavour == 1
  A gull has been nesting in the eaves above the bed, and its feathers drift across the boards.
@elif flavour == 2
  The mantel clock has stopped at twenty past eleven. Nobody has wound it since.
@else
  A brass lamp still burns low on the chest, its glass black with soot.
-> examine_menu

# examine_menu
Where do you look?
* [once] The draught gap under the door.
  @set clue_draught = true
  @set clues += 1
  A pale scrape runs along the sill, as if something thin was dragged through the gap and then drawn back.
  -> examine_menu
* [once] The bolt and its keeper.
  @set clue_thread = true
  @set clues += 1
  The keeper is bright with fresh wear, and a black tarred thread is caught in its groove. It is the cord boatmen use to rig a hull.
  -> examine_menu
* [once] The window.
  The window is latched from within. Below it is nothing but black rock and the sea, and the sill is dry.
  -> examine_menu
* That will do.
@return
