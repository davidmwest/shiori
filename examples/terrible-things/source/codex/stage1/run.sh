#!/bin/sh
# Make the showcase art with the Codex CLI (image_gen), a few images at a time,
# then zip the results to the Desktop in parts under 25 MB (the upload limit is 30 MB).
#   sh run.sh stage1        Running it again skips images that already exist,
#                           so it also retries any that failed.
# Optional: PAR=2 sh run.sh stage1   (fewer at once), CODEX_BIN=/path/to/codex.
set -u
D="$(cd "$(dirname "$0")" && pwd -P)"

find_codex() {
  for c in "${CODEX_BIN:-}" /Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex \
           /Applications/Codex.app/Contents/Resources/codex "$(command -v codex 2>/dev/null || true)"; do
    if [ -n "$c" ] && [ -x "$c" ]; then echo "$c"; return 0; fi
  done
  return 1
}

# Worker: one image. Called by xargs below as: run.sh --one <name> <input|->
if [ "${1:-}" = "--one" ]; then
  NAME="${2:-}"; SRC="${3:--}"
  [ -n "$NAME" ] || exit 0
  OUT="$D/out/$NAME.png"
  if [ -s "$OUT" ]; then echo "skip  $NAME (already done)"; exit 0; fi
  if [ "$SRC" != "-" ] && [ ! -s "$D/$SRC" ]; then echo "FAIL  $NAME: its input $SRC is missing"; exit 0; fi
  for try in 1 2; do
    rm -f "$D/logs/$NAME.last"
    if [ "$SRC" = "-" ]; then
      "$CODEX" exec --skip-git-repo-check -s read-only -c 'model_reasoning_effort="low"' \
        -o "$D/logs/$NAME.last" --json - < "$D/prompts/$NAME.txt" > "$D/logs/$NAME.jsonl" 2> "$D/logs/$NAME.err"
    else
      "$CODEX" exec --skip-git-repo-check -s read-only -c 'model_reasoning_effort="low"' -i "$D/$SRC" \
        -o "$D/logs/$NAME.last" --json - < "$D/prompts/$NAME.txt" > "$D/logs/$NAME.jsonl" 2> "$D/logs/$NAME.err"
    fi
    P="$(tr -d '\r' < "$D/logs/$NAME.last" 2>/dev/null | grep -o '/[^ `]*\.png' | tail -1)"
    [ -n "$P" ] || P="$(grep -o '/[^" ]*generated_images/[^" ]*\.png' "$D/logs/$NAME.jsonl" 2>/dev/null | tail -1)"
    if [ -n "$P" ] && [ -s "$P" ]; then cp "$P" "$OUT" && echo "ok    $NAME" && exit 0; fi
    echo "retry $NAME (attempt $try did not produce an image)"
  done
  echo "FAIL  $NAME (details in logs/$NAME.err)"
  exit 0
fi

STAGE="${1:-}"
JOBS="$D/jobs/$STAGE.txt"
if [ -z "$STAGE" ] || [ ! -f "$JOBS" ]; then
  echo "Usage: sh run.sh <stage>   Stages in this pack: $(ls "$D/jobs" | sed 's/\.txt$//' | tr '\n' ' ')" >&2
  exit 2
fi
CODEX="$(find_codex)" || { echo "Can't find the codex CLI. Run again with CODEX_BIN=/path/to/codex." >&2; exit 1; }
export CODEX
PAR="${PAR:-4}"
mkdir -p "$D/out" "$D/logs"
TOTAL=$(grep -c . "$JOBS" | tr -d ' ')
echo "Making $TOTAL images with $CODEX, $PAR at a time (about a minute each)."

# Jobs whose input is another job's output (out/...) run after the first pass.
if grep -v '|out/' "$JOBS" | grep -q .; then
  grep -v '|out/' "$JOBS" | tr '|' ' ' | xargs -P "$PAR" -L 1 sh "$D/run.sh" --one
fi
if grep -q '|out/' "$JOBS"; then
  grep '|out/' "$JOBS" | tr '|' ' ' | xargs -P "$PAR" -L 1 sh "$D/run.sh" --one
fi

DONE=0; MISSING=""
for NAME in $(cut -d'|' -f1 "$JOBS"); do
  if [ -s "$D/out/$NAME.png" ]; then DONE=$((DONE + 1)); else MISSING="$MISSING $NAME"; fi
done
echo
echo "$DONE of $TOTAL images done."
[ -n "$MISSING" ] && echo "Missing:$MISSING. Run the same command again to retry them."
[ "${NOZIP:-0}" = 1 ] && exit 0

DEST="$HOME/Desktop/shiori-art-$STAGE"
rm -f "$DEST-part"*.zip
cd "$D/out" || exit 1
part=1; size=0; list=""
for NAME in $(cut -d'|' -f1 "$JOBS"); do
  f="$NAME.png"
  [ -s "$f" ] || continue
  s=$(wc -c < "$f" | tr -d ' ')
  if [ -n "$list" ] && [ $((size + s)) -gt 24000000 ]; then
    zip -q "$DEST-part$part.zip" $list; part=$((part + 1)); size=0; list=""
  fi
  list="$list $f"; size=$((size + s))
done
[ -n "$list" ] && zip -q "$DEST-part$part.zip" $list
echo
ls -lh "$DEST-part"*.zip 2>/dev/null
echo "Upload these zip files to the Claude session."
