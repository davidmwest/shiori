Showcase art for "All the Terrible Things We Didn't Think", made with Codex image_gen.

Run one stage at a time:

  sh run.sh stage1

It makes each image with your Codex CLI (about a minute each, 4 at a time),
then puts zip files named shiori-art-<stage>-partN.zip on your Desktop.
Upload those to the Claude session. If some images fail, run the same command
again: it only redoes the missing ones.

prompts/  one prompt per image (plain text, safe to edit before running)
refs/     reference sheets the prompts point to
bases/    (stage 2) the chosen character bases that expressions are edited from
out/      the generated PNGs
logs/     Codex output for each image
