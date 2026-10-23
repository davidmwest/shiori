# All the Terrible Things We Didn't Think: asset brief

Everything below is declared in `game.story`. All paths are relative to this folder. Nothing exists yet; `shiori check` lists every missing file as W602.

**Style:** colourful and beautiful, not realism. Anime / visual-novel art with clean line work, saturated skies, and glass everywhere: things that catch light, split it into colours and glow from inside. The town is **Shiomi**, a small Japanese-flavoured harbour town on a steep coast. Its houses have blue and orange tiled roofs, and a glass wind chime hangs under every eave. Above the town rises **Glass Hill**: 412 stone steps up to a kiln-house, a garden of glass statues, and a long greenhouse full of hanging beads. The season is early summer (hydrangeas, long evenings, one rainy day).

Recurring visual motifs to keep consistent:
- **Glass on bodies** is perfectly clear, with faint threads of coloured light moving inside it, like ink in water. It is never cracked or gory.
- **Beads** are fingernail-sized glass beads, each its own colour. Hinata's beads are all the same warm amber.
- **Palms up**: the Keeper and every statue hold their hands out, palms up, as if waiting for someone to kneel and take them.

Resolution: 1920×1080. Sprites are full-height, transparent background, drawn to the same scale (Hinata is the tallest, Suzu the smallest).

---

## Characters (4 with sprites)

Each sprite has **one pose and one outfit**. Only the face changes between expression files. Each also has a `blink.svg` overlay: closed eyelids only, aligned to the face, drawn so it sits correctly over every expression. Silhouettes must be easy to tell apart at a glance: neat and vertical (Nagi), tiny with huge hair (Suzu), tall and broad with a bun (Hinata), long and slouched in a big coat (Nemu).

### Nagi (protagonist, the narrator): `chars/nagi/{expression}.svg`, `chars/nagi/blink.svg`
- **Age 17, about 155 cm, slim, neat posture.** She's a calm girl with something missing: composed, a little blank, watchful.
- **Hair:** straight blue-black bob to the jaw with blunt bangs, the blue of deep sea water where the light hits it. A single thin plait behind her left ear, tied with red cord (the same red cord as the Keeper's key).
- **Eyes:** pale grey-blue, the colour of a still sea.
- **Clothes:** indigo work jacket (a short samue top) over a white high-collared shirt, dark grey work trousers, straw sandals. The iron key on a red cord hangs around her neck.
- **Palette:** indigo, slate, white, one red accent.
- **Pose:** standing straight, facing three-quarters toward screen-right, her right hand holding her left elbow across her body (reserved, self-contained).
- **Expressions:**
  - `neutral`: calm, faintly blank, mouth closed, eyes level. The default.
  - `smile`: a small, surprised-at-itself smile. Barely there.
  - `sad`: eyes lowered, brows drawn slightly together, lips pressed.
  - `surprised`: eyes wide, lips parted, eyebrows up.
  - `tears`: openly crying, flushed cheeks, tears running, mouth trembling. This is the first time in nine years she has cried, so it should look raw.
  - `resolute`: brows set, jaw firm, eyes bright and wet but steady.
- **Used:** on stage in Chapter 5 (Hinata sees her: `tears`) and in all three endings (`resolute`, `tears`, `sad`).

### Suzu, the Keeper: `chars/suzu/{expression}.svg`, `chars/suzu/blink.svg`
- **Age 17 but tiny, about 145 cm.** She plays the grand lady ("Oh ho ho!"), but she's a blind girl who is slowly turning to glass. She's theatrical, imperious and warm.
- **Hair:** plum-dark (deep red-violet) hair in an elaborate, almost ridiculous updo stuck with a dozen glass hairpins in different colours, so the silhouette reads as a small body under a crown of glinting pins. Two long loose locks frame her face.
- **Eyes:** glass. Two clear marbles, each with a curl of violet smoke inside. No pupils. Her gaze lands just past the viewer, never on them.
- **Glass:** both hands are clear glass from the fingertips to just past the wrists, where the glass clouds and blurs into skin. Faint threads of coloured light move inside the glass. There's a thin clear "collar" of glass at the base of her throat and collarbones, half hidden by her kimono. (The script describes the glass spreading to her elbows and heart; narration carries that, so the sprite doesn't need to change.)
- **Clothes:** a white kimono patterned with blue bellflowers (*suzu* means bell), with very long sleeves. The left sleeve has a small sewn pocket on its inner side. Pale violet obi tied in a big showy bow at the back.
- **Palette:** white, bellflower blue, plum, violet, clear glass with rainbow edges.
- **Pose:** standing, chin slightly raised, both glass hands held loosely in front of her at waist height, palms turned a little upward. That's her motif.
- **Expressions:**
  - `proud`: the "Oh ho ho" face. Chin up, eyes closed in delight, wide smug smile, cheeks pink. The default.
  - `soft`: a gentle, private smile with the act dropped.
  - `sad`: mouth small, brows tilted up, head bowed a little.
  - `surprised`: glass eyes wide, mouth a small "o".
  - `angry`: real anger, brows down, teeth showing, flushed. Also used for comic indignation ("Don't spoil it!").
  - `tears`: crying from glass eyes. The tears are ordinary and catch the light like the glass.
- **Used:** Chapters 1–4, 6 and all endings. The busiest sprite.

### Hinata Asahi, the baker: `chars/hinata/{expression}.svg`, `chars/hinata/blink.svg`
- **Age 18, about 172 cm, sturdy and broad-shouldered,** strong forearms. Sunny and teasing, and exhausted underneath.
- **Hair:** warm orange-blonde, piled in a big messy bun on top of her head with a red-and-white bandana tied round it. Loose strands everywhere.
- **Eyes:** amber, like her beads. Faint freckles across the nose. A smudge of flour on one cheek.
- **Clothes:** tomato-red short-sleeved shirt with the sleeves rolled up, a long cream apron dusted with flour, its strings long enough to tie round her wrists (the script uses this), and sturdy brown boots.
- **Palette:** tomato red, cream, amber, sunny orange.
- **Pose:** weight on one hip, one fist on that hip, the other arm hanging loose, one long apron string trailing. (She appears in the lottery and the finale as well as the bakery, so don't give her a baking prop.)
- **Expressions:**
  - `grin`: a big open grin, eyes crinkled. The default.
  - `soft`: a fond, quiet smile, eyes half-lidded.
  - `tired`: dark circles, a smile that doesn't reach the eyes, and one moment of blankness.
  - `scared`: eyes wide and wet, mouth open, pale.
  - `blush`: pink cheeks, a sheepish crooked smile, eyes sliding away.
  - `tears`: crying hard, face crumpled.
- **Used:** Chapters 1, 2, 3, 5, 6 and the endings.

### Nemu Kagami, the mayor's daughter: `chars/nemu/{expression}.svg`, `chars/nemu/blink.svg`
- **Age 17, about 162 cm but slouched, thin.** A lazy, sardonic schemer and the person who says what everyone is thinking.
- **Hair:** very long, messy mint-silver hair down past her waist, with one stubborn cowlick sticking up. It looks like she slept on it, because she did.
- **Eyes:** heavy-lidded, pale green, perpetually half-closed.
- **Clothes:** a dark green council coat (haori) three sizes too big, with a small round mirror crest (*kagami* means mirror). The sleeves hang past her hands. Under it is a plain grey school-style dress, buttoned wrong. A paper bag of candied chestnuts sticks out of a sleeve.
- **Palette:** bottle green, mint, grey, chestnut brown.
- **Pose:** slouched, head tilted, hands lost in her sleeves, a ledger clamped under one arm.
- **Expressions:**
  - `sleepy`: eyes nearly shut, mouth a flat line. The default.
  - `smirk`: one corner of the mouth up, eyes still half-lidded.
  - `surprised`: eyes actually open, which is alarming.
  - `serious`: eyes open and level, no smile. This is the real Nemu.
  - `sad`: eyes down, mouth pulled tight, shoulders up.
  - `panic`: wide eyes, sweat drop, hair standing on end, mouth wobbling.
- **Used:** Chapters 1, 2, 3, 4, 6 and the endings.

### Characters without sprites (they appear only in the CGs)
- **Mayor Kagami:** about 45, Nemu's mother. Neat greying bun, the same green council coat in her own size, worn correctly. A kind, tired face.
- **Mame Asahi:** Hinata's sister, 8. Short orange bob, scowling, wearing a borrowed kimono at the lottery and finale.

---

## Backgrounds (6): `bg/*.svg`

Each background is reused under different `@filter`, `@tint` and `@weather` settings, so paint it in clear, neutral daylight or golden light with a strong composition. Leave the lower third fairly calm for the textbox, and leave room at centre/left/right for sprites.

### `bg/bakery.svg`, the Asahi bakery
- **Composition:** a small, warm shop interior seen from the customer side. A wooden counter crosses the lower third with trays of bean buns and round melon breads. Behind it are shelves of loaves, and on the right a bead curtain into the back room with the edge of a crib just visible. Steep narrow stairs go up on the far left. The window is top right.
- **Time:** about 5 a.m. at dawn. The window shows a pink-gold sky, and slanting light catches flour hanging in the air.
- **Palette:** ochre, butter yellow, warm wood, cream, with a dawn-pink window.
- **Mood:** cosy, busy, lived-in. There's a child's crayon drawing pinned to the wall.
- **Used:** Chapter 1 (as painted, with `@weather dust`) and Chapter 5 at 4 a.m. (with `@filter night`).

### `bg/hill_path.svg`, Glass Hill steps over Shiomi
- **Composition:** a view from about halfway up Glass Hill, looking down the winding stone steps. They curve from the bottom-left corner down into the town. Hydrangeas line them in blue and violet. Below, Shiomi spills down to a harbour, with rooftops in blue and orange tile and tiny glints of glass chimes under the eaves. Beyond the breakwater the sea is one bright sheet, under a huge saturated sky going from cobalt to peach with towering cumulus.
- **Time:** early morning in summer.
- **Mood:** wide, beautiful, a little vertiginous.
- **Used:** the title screen, the prologue (the camera slowly pulls back from a zoom), Chapter 1's climb, Chapter 6's rainy morning (with `@weather rain` and a slate-blue `@tint`), and the true ending's epilogue (with petals).

### `bg/kiln_house.svg`, inside the Keeper's house
- **Composition:** one long tatami room. A round brick kiln sits centre-left, its little iron door glowing orange. A rack of long glass pipes and tongs stands beside it, with a bowl of water holding a few coloured beads. There's a low table, and on the right a folding screen painted with white cranes. At the back, sliding doors stand open onto a garden of blue hydrangeas, with two or three clear glass statues just visible. A glass wind chime hangs in the eaves.
- **Time:** daytime, with bright garden light through the back doors and warm kiln light in front.
- **Palette:** warm brick orange against cool garden blue-green, honey tatami, white screen.
- **Used:** Chapter 1 (day, and at dusk with `@filter dusk`), Chapter 2, Chapter 4 at night (with `@filter night`; the script says the kiln has gone out), and the "Fourteenth Keeper" epilogue.

### `bg/square.svg`, Shiomi's town square on Lantern Night
- **Composition:** a stone-paved square with a round fountain in the centre. Strings of coloured-glass lanterns (ruby, cobalt, emerald, amber) criss-cross overhead between the eaves, all lit. There's a goldfish-scooping stall on the left and a shaved-ice stall on the right. Centre-back stands a bamboo frame hung with dozens of wind chimes. Over the rooftops at the top of the frame is Glass Hill, with the long glass roof of the Glasshouse catching the last light at its summit.
- **Time:** blue-violet evening with the first stars.
- **Mood:** a jewellery box: festive, glowing, crowded with colour. Leave the crowd implied (a few silhouettes) so the sprites stand out.
- **Used:** Chapter 3, the festival and the moment the glass cracks (with `@weather fireflies` and later `embers`, plus a purple `@tint`), and the Chapter 6 lottery (with `@filter dusk`; the script says the lanterns are lit "out of habit" the next evening).

### `bg/statue_garden.svg`, the hilltop garden of glass statues
- **Composition:** a walled garden at the top of the hill, full of blue and violet hydrangeas. Eleven life-size glass statues of girls aged about 15 to 18 stand among the flowers. Each is perfectly clear, so the hydrangeas show through her body, and each holds her hands out palms up. A low stone wall runs across the foreground with a wooden gate at the right where the 412 steps begin. Behind, the kiln-house roof and the long Glasshouse, and beyond, the sea and sky.
- **Time:** late golden afternoon, so it grades well into sepia and into night.
- **Mood:** beautiful and wrong. The statues' faces are calm, the way faces are calm in photographs.
- **Used:** Chapter 2 (as painted, with petals), Chapter 4's memory (with `@filter sepia`), and the finale in Chapter 6 and the endings (with `@filter night` and heavy fireflies).

### `bg/seashore.svg`, the beach at dawn
- **Composition:** a small curved beach below the town. Low surf rolls in diagonally from the right, and wet sand mirrors the sky. Far off on the left, Glass Hill is a small dark shape with the town at its foot.
- **Time:** dawn. The sky runs from deep teal through green to the pink of the inside of a shell, and the sea holds all of it.
- **Mood:** quiet, cold, enormous and tender.
- **Used:** only the "Salt" ending, where Suzu puts her feet in the sea.

---

## CGs (3): `cg/*.svg`

### `cg/countess.svg`, "Countess Fluorite of the Capital"
- **Moment:** Chapter 3, the comic set-piece. Suzu is disguised for Lantern Night.
- **Composition:** Suzu in the centre in a grand pose, one oven-mitted hand raised to her mouth mid-"Oh ho ho!". She wears Mayor Kagami's spare kimono (bright purple, with white ducks), a white fox mask over her eyes, and a straw hat the size of a cartwheel. Her glass hands are hidden in quilted oven mitts with pink ribbons tied round the cuffs. Behind her: Nagi (left) with a hand over her face, Hinata (right) doubled over laughing with flour on her cheek, and Nemu (far right) eating a candied chestnut and looking dead inside. Lanterns overhead and a goldfish tank glowing in the foreground.
- **Palette:** purple and white against lantern jewel-tones.

### `cg/hands.svg`, "What She Kept"
- **Moment:** Chapter 4, the twist. Suzu gives back the bead she kept in her sleeve.
- **Composition:** a close-up. Suzu's two clear glass hands are cupped round Nagi's hand. Between their fingers, a plum-pink light glows from the melting bead. Threads of pink light run up inside the glass of Suzu's wrists and into Nagi's fingers. Suzu's face is at the top edge, out of focus, tears on her cheeks, glass eyes lit pink. The dark kiln-house behind is in night blues.
- **Palette:** midnight blue, plum-pink core light, clear glass highlights.

### `cg/breaking.svg`, "All the Terrible Things"
- **Moment:** the true ending. Suzu lets go of the Heart and breaks into light.
- **Composition:** night in the statue garden. Suzu kneels in the centre, almost entirely glass, dissolving upward into light and thousands of small coloured beads that rise like sparks from a bonfire into a starry violet sky. Nagi holds her left hand, Hinata her right, and both are crying and looking at her. From them a chain of joined hands runs: Nemu holding Nagi's other hand, Mame, the Mayor. Behind them, through the gate, a line of lanterns and hands snakes all the way down the 412 steps to the harbour. Beads drift down over the town like warm snow.
- **Palette:** violet night, gold and amber light, rose, and many tiny bead colours.

---

## The 3D world (the one 3D scene): `worlds/glasshouse.js`

Declared as `@world glasshouse worlds/glasshouse.js marks="door aisle amber heart statue roof" camera=door animated=true`. It's used in Chapter 2, `glasshouse_tour` and `plan`, on a sunny Sunday afternoon. Suzu (and later Nemu) appear as 2D sprites over it.

**Geometry** (units are metres, Y is up, and the hall runs along the Z axis):
- A long Victorian-style greenhouse about 8 m wide, 30 m long and 6 m high at the ridge. It has a pitched glass roof on thin iron ribs, glass walls above a knee-high brick base, and a double door at the near end (z ≈ +14).
- A central aisle of worn brick. On both sides are wooden shelves and racks, and from every rafter hang thousands of threads, each strung with fingernail-sized glass beads in every colour (ruby, cobalt, sea green, honey, violet, smoke). Make it dense enough that light comes through in colours like a dismantled stained-glass window. Use instancing.
- **The amber shelf:** near the door on the left, a shelf with no threads, just a row of shallow bowls heaped with identical warm amber beads (Hinata's).
- **The Heart:** hanging from the great central beam at about z = 0, a fist-of-beads cluster the size of a child's head, fused into one lump, dark plum with a faint slow inner pulse of red light.
- **The first Keeper:** at the far end (z ≈ −13), a cloudy, greenish, old glass statue of a girl standing on a low plinth with a small brass plaque, holding both hands out palms up toward the Heart.
- **Optional:** a small bead-kiln in a corner, cold.

**Marks** (positions are suggestions; `look` is the default target):

| Mark | Where | What the camera sees from / at it |
|---|---|---|
| `door` | just inside the doors, eye height: position [0, 1.6, 13], look [0, 2.6, 0] | The establishing view down the whole aisle: beads to the vanishing point, the Heart hanging dark in the middle distance, the statue a pale shape at the end. |
| `aisle` | mid-aisle, a little right of centre: position [0.6, 1.6, 4], look [0, 2.8, 0] | Surrounded by hanging beads close to the lens, with bokeh. Used as a camera spot and also as a look target from `door`. |
| `amber` | the amber shelf near the door, left side: position [−3, 1.1, 11] | A look target. From `aisle`, the camera turns back toward the door-side shelf of identical amber bowls, glowing in a sunbeam. |
| `heart` | the Heart under the central beam: position [0, 3.6, 0] | A look target (from `aisle` and from `roof`, and the orbit centre). |
| `statue` | the first Keeper at the far end: position [0, 1.4, −12.5] | A look target. From `aisle`, the camera turns to the statue in green light at the end. |
| `roof` | high near the ridge: position [2.5, 5.4, 6], look [0, 3.2, 0] | A high angle looking down on the whole hall and the Heart, with beads below like a field of coloured rain. |

**The camera moves in the script, in order:** `from=door look=heart` (instant) → `from=door look=aisle` (5 s) → `from=aisle look=amber` (3 s) → `from=aisle look=heart` (4 s) → `from=aisle look=statue` (4 s) → `from=roof look=heart` (5 s) → `orbit=40` round the Heart (8 s, while Suzu plays her motif on the beads) → `from=door look=aisle` (2 s, Nemu arrives at the door).

**Lighting:** warm afternoon sun through the glass roof in visible shafts, with dust motes drifting in them. Coloured caustics from the beads fall on the brick floor. A soft hemisphere light (warm sky, cool ground). The Heart has a faint emissive plum-red pulse at about 40 beats a minute. The statue is lit cool green from behind.

**What animates:** threads sway gently as if someone just walked past, and beads twinkle when the sun hits them. The light shafts drift slowly. Dust floats. The Heart pulses. Tiny glints run along the iron ribs.

---

## Music (6 LMN songs): `music/*.lmn`

There are no sound effects, ambience or voices. Everything is synthesised from LMN.

### Leitmotif plan
- **Suzu's figure** ("five notes climbing and one falling, like someone starting up a staircase and changing her mind"; the script describes it in these words several times, so it must be audible): **D5 E5 F♯5 A5 B5 then E5**. Four quarter notes, a dotted half on B, then a long falling E. Suzu plays it on the beads in the Glasshouse, it is "her song", and in the true ending the whole town can hum it. It returns transformed in every cue:
  - in `glass_hill`, hidden as a celesta counter-melody,
  - in `tamamori`, as the opening of a pompous waltz,
  - in `paper_lantern`, as a jaunty brass march,
  - in `small_hours`, broken: only the first three notes, never completed, then a detuned fall,
  - in `suzu_song`, complete at last, as a hymn.
- **Hinata's "kitchen chord":** Suzu says Hinata's beads "ring together in a chord, always the same warm chord, like a kitchen." Build `morning_bread` on **F major add9 (F–A–C–G)**, and let that exact chord sound under the climax of `suzu_song`, where Hinata's tune becomes the counter-melody. The two loves are braided together and neither wins.

### `music/glass_hill.lmn`, "The Glass Hill" (overture / main theme)
- **Mood:** wide, luminous, bittersweet wonder with a thread of unease.
- **Tempo / metre:** about 76 bpm, 4/4. D major, leaning toward B minor.
- **Instruments:** piano arpeggios, warm strings, glass harmonica or celesta, a soft harp. The celesta plays Suzu's figure from bar 9 as a counter-line, easy to miss on first listen.
- **Used:** title screen, Prologue, the Chapter 1 climb, the Interlude (at 0.6 volume under Suzu's monologue), the Glasshouse tour, the twist's aftermath, the finale garden, the "Fourteenth Keeper" epilogue, and the "Salt" beach.
- Must loop cleanly. It's the most-heard cue, so it needs the strongest, most hummable melody.

### `music/tamamori.lmn`, "Tamamori the Magnificent" (Suzu's theme)
- **Mood:** A section: mock-baroque grandeur, pompous and delighted with itself, the "Oh ho ho" in music. B section: the same melody on a lone music box, slow and lonely, the real girl under the act.
- **Tempo / metre:** waltz, 3/4, about 132 bpm. G major; the B section drops to E minor.
- **Instruments:** harpsichord, pizzicato strings, glockenspiel, a cheeky bassoon; solo music box for the B section.
- **Used:** every scene in the kiln-house (Chapters 1 and 2), and the sepia memory of the choosing in Chapter 4 at 0.5 volume, where the childish, playful version works as something eight-year-old Suzu used to hum.

### `music/morning_bread.lmn`, "Morning Bread" (Hinata's theme)
- **Mood:** sunny, bustling, flirtatious, flour in the air. One recurring bar of an unresolved minor chord stands for her exhaustion showing through.
- **Tempo / metre:** 6/8, about 104 bpm. F major, built on the Fadd9 "kitchen chord".
- **Instruments:** acoustic guitar, accordion, wooden flute, hand claps, upright bass.
- **Used:** the bakery in Chapter 1 and the Sunday climb in Chapter 2.

### `music/paper_lantern.lmn`, "Operation Paper Lantern" (festival / comic heist)
- **Mood:** a caper. Fast, cheeky, increasingly out of control, with a big grand finish for the Countess's triumph.
- **Tempo / metre:** 4/4, about 144 bpm. C major.
- **Instruments:** taiko and shime-daiko, shamisen, brass section, woodblock, piccolo, festival flute. Suzu's figure is the main march tune on trumpets, and Hinata's tune pops up on accordion in the bridge.
- **Used:** Chapter 3, from the opening of Lantern Night to the handshake. The script cuts it off with `@music stop fade=0.2` the moment the oven mitt slides off, so give it plenty of momentum to cut.

### `music/small_hours.lmn`, "Small Hours" (dread)
- **Mood:** uneasy, intimate horror. The sound of a thought you can't stop having. Uneasy without becoming noise.
- **Tempo / metre:** slow and nearly free, about 60 bpm, heartbeat-like.
- **Instruments:** a low string drone, bowed glass and detuned glass tones, sparse piano clusters in the low register, a soft low drum like a heartbeat, occasional high glass harmonics. Suzu's figure appears only as its first three notes (D E F♯), never finished, followed by a falling, slightly flat note.
- **Used:** the cracking of the Glasshouse in Chapter 3, Hinata's 4 a.m. chapter, the rainy morning after, and the lottery.

### `music/suzu_song.lmn`, "All the Terrible Things (Suzu's Song)" (finale)
- **Mood:** the culmination. A hymn made of everyone's worst thoughts that turns out to be the most beautiful thing in the town. Grief and release.
- **Tempo / metre:** about 66 bpm, 4/4. D major.
- **Structure:** it opens with solo glass harmonica (the beads) playing Suzu's full figure, completed for the first time. Wordless choir ("ah") enters, then strings and piano. In the second verse Hinata's tune enters as the counter-melody over the Fadd9 chord. It builds to full orchestra with chimes. The ending holds on the falling note, then resolves to D with a single lopsided, slightly flat wind chime as the last sound.
- **Used:** only in the true ending, from the moment Suzu lets go through the whole epilogue (about 4 minutes, looping gracefully if the player reads slowly).
