#!/bin/bash
# Prints open backlog and triggers inbox triage at session start
BACKLOG="$(pwd)/.project/backlog/BACKLOG.md"
if [ ! -f "$BACKLOG" ]; then exit 0; fi

echo "=== OPEN BACKLOG ==="
grep "^|" "$BACKLOG" | grep -v -E "^\| *ID *\|" | grep -v -E "^\|[-: |]+\|" | grep -v "| done |"
echo "=== END BACKLOG ==="
echo ""

INBOX_COUNT=$(awk '/^## Inbox/{found=1} found && /^- /{count++} END{print count+0}' "$BACKLOG")
if [ "$INBOX_COUNT" -gt 0 ]; then
  echo "⚠ $INBOX_COUNT unprocessed inbox item(s) found."
  echo "Before starting work: promote each to the backlog table (infer ID/type/priority), remove from Inbox, then briefly confirm what you promoted."
fi
