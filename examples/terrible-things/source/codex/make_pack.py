#!/usr/bin/env python3
"""Build the Codex image_gen pack for "All the Terrible Things We Didn't Think".

The pack is a folder the author unzips on the Mac and runs with
`sh shiori-art/run.sh <stage>`. Codex writes PNGs; run.sh zips them to the
Desktop in parts under 25 MB. Post-processing (alpha clean-up, face and blink
overlays, sizing, WebP) happens back in the repo, not on the Mac.

Usage: python3 make_pack.py <out-dir> <stage> [<stage>...]
Stages: stage1 (character bases and backgrounds), stage2 (expressions, blinks
and CGs; needs the chosen bases in bases/).
"""
import os, sys, shutil
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REFS = os.path.join(HERE, 'refs')      # reference images kept with this script
BASES = os.path.join(HERE, 'bases')    # chosen, cleaned character bases (stage 2)

HEAD = ('Generate ONE image with your built-in image_gen tool. Do not run any shell commands '
        'and do not create or edit files. When the image is done, reply with only the absolute '
        'path of the saved PNG.')

MODEST = ('The characters are teenagers (17 and 18). Draw them modestly and non-sexualized: '
          'covered, buttoned clothing, no cleavage, no suggestive pose, natural youthful proportions.')

STYLE = ('Style: polished modern visual-novel art, as in a high-budget Japanese visual novel: clean, '
         'confident coloured line art (never black outlines), soft cel shading with gentle gradients, '
         'bright warm saturated colour, light from the upper left. Glass is perfectly clear with faint '
         'threads of coloured light inside it and a rainbow rim; never grey, cracked or gory.')

SPRITE = ('Use: a character sprite for a commercial-quality anime visual novel. It is layered over '
          'painted backgrounds, so the background must be genuinely transparent (alpha), with no floor '
          'shadow, no frame, no text and no watermark.\n'
          'Framing: portrait canvas, the full figure from the very top of the hair down to mid-thigh, '
          'centred, filling most of the canvas height, nothing cropped at the top or sides.')

BG = ('Use: a background for an anime visual novel, WIDE 16:9 landscape (as close to 1920x1080 as the '
      'tool allows). No people unless stated, no text, no watermark, no signature. Characters stand in '
      'the middle and a text box covers the bottom quarter, so keep the centre fairly open and put the '
      'busiest detail toward the edges and the upper half.')

CG = ('Use: an event CG (a full-screen illustration) for an anime visual novel, WIDE 16:9 landscape '
      '(as close to 1920x1080 as the tool allows). No text, no watermark, no signature.')

EDIT_KEEP = ('Keep EVERYTHING else exactly the same, pixel for pixel where possible: hair and every '
             'hair ornament, head position, size and angle, body, clothes, hands, pose, framing, canvas '
             'size, and the genuinely transparent background. Do not move, tilt or resize the head.')

# ---------------------------------------------------------------- characters

CHARS = {
    'nagi': dict(
        name='Nagi', default='neutral',
        design=('Nagi, 17, about 155 cm, slim, with neat posture. The protagonist and narrator: a calm girl '
                'with something missing, composed, a little blank, watchful. Straight blue-black bob to the '
                'jaw with blunt bangs, deep-sea blue where the light hits it; a single thin plait behind her '
                'left ear tied with a red cord. Pale grey-blue eyes, the colour of a still sea. An indigo '
                'work jacket (a short samue top) over a white high-collared shirt buttoned to the neck, dark '
                'grey work trousers. An old iron key on a red cord hangs around her neck.'),
        pose=('Standing straight, body turned three-quarters toward screen right, face toward the viewer; '
              'her right hand holds her left elbow across her body (reserved, self-contained). Hands drawn '
              'with care.'),
        exprs={
            'neutral': 'calm and faintly blank, mouth closed, eyes open and level',
            'smile': 'a small smile that seems surprised at itself, barely there, eyes open',
            'sad': 'eyes lowered, brows drawn slightly together, lips pressed',
            'surprised': 'eyes wide, lips parted, eyebrows raised',
            'tears': ('openly crying for the first time in nine years: flushed cheeks, tears running down, '
                      'mouth trembling, eyes open and wet. It should look raw'),
            'resolute': 'brows set, jaw firm, eyes bright and wet but steady',
        },
        closed=set(),
    ),
    'suzu': dict(
        name='Suzu', default='proud',
        design=('Suzu, 17 but tiny (about 145 cm), the Keeper of Glass Hill: a blind girl slowly turning to '
                'glass who plays a grand theatrical lady. Plum-dark (deep red-violet) hair in an elaborate, '
                'almost ridiculous updo stuck with a dozen glass hairpins of different colours; two long '
                'loose locks frame her face. Her eyes are glass: two clear marbles, each with a curl of '
                'violet smoke inside, no pupils, and her gaze lands just past the viewer. Both hands are '
                'clear glass from the fingertips to just past the wrists, where the glass clouds into skin, '
                'with faint threads of coloured light inside. A thin clear glass collar at the base of her '
                'throat, half hidden by the kimono. White kimono with blue bellflowers, very long sleeves, '
                'pale violet obi.'),
        pose='Standing, chin slightly raised, both glass hands held loosely in front of her at waist height, palms turned a little upward.',
        exprs={
            'proud': 'her "Oh ho ho!" face: chin up, eyes closed in delight, wide smug smile, pink cheeks',
            'soft': 'a gentle, private smile with the act dropped, brows relaxed, glass eyes open',
            'sad': 'mouth small, brows tilted up, eyelids lowered as if her head were bowed a little, glass eyes open',
            'surprised': 'glass eyes wide open, mouth a small round "o", brows raised',
            'angry': 'real anger: brows down, teeth showing, flushed cheeks, glass eyes open and narrowed',
            'tears': ('crying from her glass eyes: ordinary tears that catch the light like glass, '
                      'brows tilted up, mouth unsteady, glass eyes open'),
        },
        closed={'proud'},
    ),
    'hinata': dict(
        name='Hinata', default='grin',
        design=('Hinata Asahi, the baker, 18, about 172 cm, sturdy and broad-shouldered with strong '
                'forearms; sunny and teasing, exhausted underneath. Warm orange-blonde hair piled in a big '
                'messy bun on top of her head with a red-and-white polka-dot bandana tied round it, loose '
                'strands everywhere. Amber eyes, faint freckles across the nose, a smudge of flour on one '
                'cheek. A tomato-red short-sleeved work shirt with a modest collar buttoned up to the neck '
                '(no open neckline), sleeves rolled up; a long cream apron dusted with flour with a small '
                'bread logo on the bib, its strings long and trailing; knee-length dark brown work skirt '
                'under the apron.'),
        pose='Standing facing the viewer, weight on one hip, one fist on that hip, the other arm hanging loose, one long apron string trailing. No baking props.',
        exprs={
            'grin': 'a big open grin, eyes crinkled shut with laughter',
            'soft': 'a fond, quiet smile, eyes half-lidded but open',
            'tired': 'dark circles under her eyes, a smile that does not reach the eyes, eyes open and a little blank',
            'scared': 'eyes wide and wet, mouth open, face pale',
            'blush': 'pink cheeks, a sheepish crooked smile, eyes open and sliding away to one side',
            'tears': 'crying hard, face crumpled, tears running, eyes squeezed nearly shut',
        },
        closed={'grin'},
    ),
    'nemu': dict(
        name='Nemu', default='sleepy',
        design=('Nemu Kagami, the mayor\'s daughter, 17, about 162 cm but slouched, thin: a lazy, sardonic '
                'schemer who says what everyone is thinking. Very long, messy mint-silver hair down past her '
                'waist with one stubborn cowlick sticking straight up; it looks slept on. Heavy-lidded pale '
                'green eyes, perpetually half-closed. A dark bottle-green council coat (haori) three sizes '
                'too big, with a small round mirror crest; the sleeves hang past her hands. Under it a plain '
                'grey school-style dress with a high neckline, buttoned wrong. A paper bag of candied '
                'chestnuts sticks out of one sleeve.'),
        pose='Slouched, head tilted a little, hands lost in her sleeves, a ledger clamped under one arm.',
        exprs={
            'sleepy': 'eyes nearly shut, mouth a flat line',
            'smirk': 'one corner of the mouth up, eyes still half-lidded',
            'surprised': 'eyes actually wide open, which is alarming, mouth a small "o"',
            'serious': 'eyes open and level, no smile: the real Nemu',
            'sad': 'eyes down, mouth pulled tight',
            'panic': 'wide eyes, a sweat drop, the cowlick and a few strands standing on end, mouth wobbling',
        },
        closed={'sleepy'},
    ),
}

SVG_DESIGN_NOTE = ('The attached image has two panels. LEFT, labelled DESIGN: the game\'s simple placeholder '
                   'art for this character. Keep her design from it (hair, colours, clothes, accessories, '
                   'pose) but nothing of its flat drawing style. RIGHT, labelled STYLE: a finished sprite of '
                   'a different character from the same game. Match its art style, line quality, shading, '
                   'level of finish and canvas framing exactly, but take nothing else from it.')

def base_prompt(c, variant_note=''):
    ch = CHARS[c]
    expr = ch['exprs'][ch['default']]
    lines = [HEAD, '', 'Image spec:', '- ' + SPRITE.replace('\n', '\n- ')]
    if c == 'hinata':
        lines.append('- Reference: the attached image is an earlier sprite of Hinata from this game. Keep its '
                     'design, pose, framing and art style, and redraw her with these corrections: the shirt has '
                     'a modest collar buttoned up to the neck (no open neckline or cleavage), and a knee-length '
                     'work skirt under the apron.')
    else:
        lines.append('- Reference: ' + SVG_DESIGN_NOTE)
    lines += [f'- Character: {ch["design"]}', f'- Pose: {ch["pose"]}',
              f'- Expression "{ch["default"]}": {expr}.', '- ' + MODEST, '- ' + STYLE]
    if variant_note:
        lines.append('- ' + variant_note)
    return '\n'.join(lines) + '\n'

def expr_prompt(c, e):
    ch = CHARS[c]
    return '\n'.join([HEAD, '',
        f'This is an EDIT. The attached image is the edit target: a visual-novel sprite of {ch["name"]} with '
        'a transparent background. Change ONLY her facial expression (eyes, eyelids, brows, mouth, blush and '
        f'tears) to "{e}": {ch["exprs"][e]}.',
        EDIT_KEEP] + ([MODEST] if c != 'hinata' else [])) + '\n'

def blink_prompt(c, e):
    ch = CHARS[c]
    return '\n'.join([HEAD, '',
        f'This is an EDIT. The attached image is the edit target: a visual-novel sprite of {ch["name"]} with '
        'a transparent background. Close her eyes as in the middle of a natural blink: the upper lids come '
        'down to meet the lower lids, and the lashes curve gently downward. Change NOTHING else: the same '
        'brows, mouth, blush and tears, the same hair (including locks that cross the eyes), and the same '
        'head position.',
        EDIT_KEEP]) + '\n'

# ---------------------------------------------------------------- backgrounds

BGS = {
    'hill_path': ('Glass Hill steps over the town of Shiomi, a small Japanese-flavoured harbour town on a '
        'steep coast. A view from about halfway up the hill, looking down the winding stone steps, which '
        'curve from the bottom-left corner down into the town. Blue and violet hydrangeas line the steps. '
        'Below, the town spills down to a harbour: rooftops of blue and orange tile with tiny glints of '
        'glass wind chimes under the eaves. Beyond the breakwater the sea is one bright sheet under a huge, '
        'saturated sky going from cobalt to peach, with towering cumulus. Early summer morning. Mood: wide, '
        'beautiful, a little vertiginous. Palette: cobalt, peach, hydrangea blue and violet, warm tile orange.'),
    'kiln_house': ('Inside the Keeper\'s house on Glass Hill: one long tatami room. A round brick kiln sits '
        'centre-left with its little iron door glowing orange. Beside it a rack of long glass-blowing pipes '
        'and tongs, and a bowl of water holding a few coloured glass beads. A low table. On the right, a '
        'folding screen painted with white cranes. At the back, sliding doors stand open onto a garden of '
        'blue hydrangeas with two or three clear glass statues of girls just visible among them. A glass '
        'wind chime hangs in the eaves. Daytime: bright garden light through the back doors and warm kiln '
        'light in front. Palette: warm brick orange against cool garden blue-green, honey tatami, white screen.'),
    'square': ('Shiomi\'s stone-paved town square on Lantern Night, a summer festival. A round fountain in the '
        'centre. Strings of coloured-glass lanterns (ruby, cobalt, emerald, amber) criss-cross overhead '
        'between the eaves, all lit. A goldfish-scooping stall on the left and a shaved-ice stall on the '
        'right. Centre back, a bamboo frame hung with dozens of glass wind chimes. Over the rooftops at the '
        'top of the frame rises Glass Hill, with the long glass roof of a greenhouse catching the last light '
        'at its summit. Blue-violet evening with the first stars. Mood: a jewellery box, festive and '
        'glowing, crowded with colour. The crowd is only implied by a few small distant silhouettes.'),
    'statue_garden': ('A walled garden at the top of Glass Hill, full of blue and violet hydrangeas. Eleven '
        'life-size statues of girls aged about 15 to 18 stand among the flowers, each made of perfectly '
        'clear glass so the hydrangeas show through her body, each fully clothed in a simple glass kimono '
        'and holding both hands out, palms up, as if waiting for someone to take them. Their faces are calm, '
        'the way faces are calm in photographs. A low stone wall runs across the foreground with a wooden '
        'gate on the right where stone steps begin. Behind, the roof of a kiln-house and a long glass '
        'greenhouse, and beyond them the sea and sky. Late golden afternoon. Mood: beautiful and wrong.'),
    'seashore': ('A small curved beach below a Japanese-flavoured harbour town at dawn. Low surf rolls in '
        'diagonally from the right, and the wet sand mirrors the sky. Far off on the left, a hill is a small '
        'dark shape with the town at its foot. The sky runs from deep teal through green to the pink of the '
        'inside of a shell, and the sea holds all of it. Mood: quiet, cold, enormous and tender.'),
}

def bg_prompt(b):
    return '\n'.join([HEAD, '', 'Image spec:', '- ' + BG, '- Scene: ' + BGS[b],
        '- ' + STYLE + ' Painterly background finish with crisp detail, like a high-end visual-novel background.']) + '\n'

# ---------------------------------------------------------------- CGs

CGS = {
    'countess': ('Chapter 3, the comic set-piece on Lantern Night. Suzu is in disguise as "Countess Fluorite '
        'of the Capital": centre, in a grand pose, one oven-mitted hand raised to her mouth mid "Oh ho ho!". '
        'She wears a borrowed bright purple kimono patterned with white ducks, a white fox mask over her '
        'eyes, and a straw hat the size of a cartwheel; her glass hands are hidden in quilted oven mitts with '
        'pink ribbons tied round the cuffs (her plum hair and glass hairpins still poke out under the hat). '
        'Behind her: Nagi on the left with a hand over her face; Hinata on the right doubled over laughing, '
        'flour on her cheek; Nemu at the far right eating a candied chestnut and looking dead inside. Glass '
        'lanterns overhead and a goldfish tank glowing in the foreground. Palette: purple and white against '
        'lantern jewel tones. Funny and warm.'),
    'breaking': ('The true ending. Night in a hilltop garden of glass statues and hydrangeas under a starry '
        'violet sky. Suzu kneels in the centre, almost entirely glass now, dissolving gently upward into '
        'light and thousands of small coloured glass beads that rise like sparks from a bonfire. Nagi holds '
        'her left hand and Hinata her right; both are crying and looking at her. From them a chain of joined '
        'hands runs outward: Nemu holding Nagi\'s other hand, then Mame (Hinata\'s 8-year-old sister, short '
        'orange bob, scowling, in a borrowed kimono), then Mayor Kagami (about 45, neat greying bun, the '
        'same bottle-green council coat as Nemu in her own size). Behind them, through the garden gate, a '
        'line of lanterns and joined hands snakes all the way down the stone steps to the harbour town far '
        'below. Beads drift down over the town like warm snow. Grief and release, luminous, not gory. '
        'Palette: violet night, gold and amber light, rose, and many tiny bead colours.'),
}

def cg_prompt(k):
    return '\n'.join([HEAD, '', 'Image spec:', '- ' + CG, '- Moment: ' + CGS[k],
        '- Reference: the attached sheet shows the finished character sprites from this game, labelled with '
        'their names. Keep every character exactly on-model (hair, eyes, clothes, glass hands).',
        '- ' + MODEST, '- ' + STYLE + ' Emotional, intimate, luminous.']) + '\n'

# ---------------------------------------------------------------- reference sheets

def font(size):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()

def panel(img, w, h, bg=(205, 215, 228, 255)):
    p = Image.new('RGBA', (w, h), bg)
    im = img.convert('RGBA')
    s = min(w / im.width, (h - 60) / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    p.alpha_composite(im, ((w - im.width) // 2, 60 + (h - 60 - im.height) // 2))
    return p

def labelled(panels, labels, out):
    w, h = panels[0].size
    sheet = Image.new('RGBA', (w * len(panels), h), (255, 255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for i, (p, lab) in enumerate(zip(panels, labels)):
        sheet.alpha_composite(p, (i * w, 0))
        d.text((i * w + 20, 14), lab, fill=(20, 20, 30, 255), font=font(36))
    sheet.convert('RGB').save(out)

def build_refs(dst):
    os.makedirs(dst, exist_ok=True)
    style = Image.open(os.path.join(REFS, 'style_suzu.png'))
    for c in ('nagi', 'nemu'):
        design = Image.open(os.path.join(REFS, f'svg_{c}.png'))
        labelled([panel(design, 1024, 1536), panel(style, 1024, 1536)],
                 [f'DESIGN: {CHARS[c]["name"]} (placeholder art)', 'STYLE: match this finish only'],
                 os.path.join(dst, f'ref_{c}.png'))

def build_cast_sheet(dst):
    order = ['nagi', 'suzu', 'hinata', 'nemu']
    labelled([panel(Image.open(os.path.join(BASES, f'{c}.png')), 768, 1152) for c in order],
             [CHARS[c]['name'] for c in order], os.path.join(dst, 'ref_cast.png'))

# ---------------------------------------------------------------- jobs

def stage1(pack):
    build_refs(os.path.join(pack, 'refs'))
    jobs = []
    for c in ('nagi', 'nemu'):  # Suzu and Hinata keep their approved Codex test sprites
        for v, note in (('a', ''), ('b', 'Variation: give the drawing a slightly different, equally on-model take on her face and hair.')):
            name = f'{c}_{CHARS[c]["default"]}_{v}'
            write(pack, name, base_prompt(c, note))
            jobs.append((name, f'refs/ref_{c}.png'))
    for b in BGS:
        write(pack, f'bg_{b}', bg_prompt(b))
        jobs.append((f'bg_{b}', '-'))
    return jobs

def stage2(pack):
    os.makedirs(os.path.join(pack, 'bases'), exist_ok=True)
    for c in CHARS:
        shutil.copy(os.path.join(BASES, f'{c}.png'), os.path.join(pack, 'bases', f'{c}.png'))
    build_cast_sheet(os.path.join(pack, 'refs'))
    jobs = []
    for c, ch in CHARS.items():
        for e in ch['exprs']:
            if e != ch['default']:
                write(pack, f'{c}_{e}', expr_prompt(c, e))
                jobs.append((f'{c}_{e}', f'bases/{c}.png'))
            if e not in ch['closed']:
                write(pack, f'{c}_{e}_blink', blink_prompt(c, e))
                src = f'bases/{c}.png' if e == ch['default'] else f'out/{c}_{e}.png'
                jobs.append((f'{c}_{e}_blink', src))
    for k in CGS:
        write(pack, f'cg_{k}', cg_prompt(k))
        jobs.append((f'cg_{k}', 'refs/ref_cast.png'))
    return jobs

def write(pack, name, text):
    os.makedirs(os.path.join(pack, 'prompts'), exist_ok=True)
    with open(os.path.join(pack, 'prompts', name + '.txt'), 'w') as f:
        f.write(text)

def main():
    pack, stages = sys.argv[1], sys.argv[2:]
    os.makedirs(pack, exist_ok=True)
    shutil.copy(os.path.join(HERE, 'run.sh'), os.path.join(pack, 'run.sh'))
    shutil.copy(os.path.join(HERE, 'README.txt'), os.path.join(pack, 'README.txt'))
    os.makedirs(os.path.join(pack, 'jobs'), exist_ok=True)
    for st in stages:
        jobs = {'stage1': stage1, 'stage2': stage2}[st](pack)
        with open(os.path.join(pack, 'jobs', st + '.txt'), 'w') as f:
            for name, src in jobs:
                f.write(f'{name}|{src}\n')
        print(st, len(jobs), 'jobs')

if __name__ == '__main__':
    main()
