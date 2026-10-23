#!/bin/sh
# Run one Codex worker for Shiori on the author's Mac: a fresh worktree on
# branch codex/<task>, one `codex exec` run, then commit and push the result.
# The lead agent reviews the branch before anything is merged.
#
#   sh tools/codex-worker.sh <task> <model> <effort> <prompt-file> [<path to commit>...]
#
# Start it detached so it outlives the shell that launched it:
#   nohup sh tools/codex-worker.sh story-audit gpt-6.1-sol ultra /path/prompt.txt reviews >/dev/null 2>&1 &
# Files: $WORKERS_DIR/<task>/ (worktree), <task>.log, <task>.last.md (Codex's final
# message), <task>.jsonl, <task>.err, <task>.done (written last, holds the exit code).
# Env: WORKERS_DIR (default ~/Documents/Codex/shiori-workers), BASE_BRANCH,
# CODEX_BIN, SANDBOX (default workspace-write).
# Command mode runs a shell command in the worktree instead of `codex exec`
# (for jobs such as the art pack's run.sh, which calls Codex per image itself):
#   sh tools/codex-worker.sh --cmd <task> '<command>' [<path to commit>...]
set -u
CMD=""
if [ "${1:-}" = "--cmd" ] && [ $# -ge 3 ]; then
  TASK=$2; CMD=$3; MODEL=command; EFFORT=n/a; PROMPT=/dev/null; shift 3
elif [ $# -ge 4 ]; then
  TASK=$1; MODEL=$2; EFFORT=$3; PROMPT=$4; shift 4
else
  echo "Usage: sh tools/codex-worker.sh <task> <model> <effort> <prompt-file> [<path to commit>...]" >&2
  echo "       sh tools/codex-worker.sh --cmd <task> '<command>' [<path to commit>...]" >&2
  exit 2
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
BASE="${BASE_BRANCH:-claude/dazzling-meitner-uz8dhg}"
WD="${WORKERS_DIR:-$HOME/Documents/Codex/shiori-workers}"
W="$WD/$TASK"
mkdir -p "$WD" || exit 1
exec >> "$WD/$TASK.log" 2>&1
echo "== $(date -u '+%Y-%m-%dT%H:%M:%SZ') codex/$TASK: $MODEL, effort $EFFORT"

CODEX=""
for c in "${CODEX_BIN:-}" /Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex \
         /Applications/Codex.app/Contents/Resources/codex "$(command -v codex 2>/dev/null || true)"; do
  if [ -n "$c" ] && [ -x "$c" ]; then CODEX="$c"; break; fi
done
[ -n "$CODEX" ] || { echo "codex CLI not found"; echo "exit=127" > "$WD/$TASK.done"; exit 1; }
[ -f "$PROMPT" ] || { echo "no prompt file $PROMPT"; echo "exit=2" > "$WD/$TASK.done"; exit 1; }

git -C "$ROOT" fetch -q origin || { echo "fetch failed"; echo "exit=1" > "$WD/$TASK.done"; exit 1; }
if [ ! -d "$W" ]; then
  git -C "$ROOT" worktree add -q "$W" -b "codex/$TASK" "origin/$BASE" || { echo "worktree add failed"; echo "exit=1" > "$WD/$TASK.done"; exit 1; }
fi

if [ -n "$CMD" ]; then
  (cd "$W" && CODEX_BIN="$CODEX" sh -c "$CMD") > "$WD/$TASK.last.md" 2>&1
  status=$?
else
  "$CODEX" exec -m "$MODEL" -c "model_reasoning_effort=\"$EFFORT\"" -s "${SANDBOX:-workspace-write}" \
    --skip-git-repo-check -C "$W" -o "$WD/$TASK.last.md" --json - < "$PROMPT" > "$WD/$TASK.jsonl" 2> "$WD/$TASK.err"
  status=$?
fi
echo "codex exit $status"

cd "$W" || exit 1
if [ $# -gt 0 ]; then git add -A -- "$@"; else git add -A; fi
cp "$WD/$TASK.last.md" ".codex-last-message.md" 2>/dev/null && git add -f .codex-last-message.md
if git commit -q -m "Codex worker $TASK ($MODEL, effort $EFFORT)"; then echo "committed"; else echo "nothing to commit"; fi
if git push -q -u origin "codex/$TASK"; then push=ok; else push=failed; fi
echo "push $push"
echo "exit=$status push=$push" > "$WD/$TASK.done"
