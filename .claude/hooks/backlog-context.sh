#!/bin/bash
# Prints open backlog items into Claude's context at session start
BACKLOG_DIR="$(pwd)/docs/backlog"
if [ ! -d "$BACKLOG_DIR" ]; then exit 0; fi
echo "=== OPEN BACKLOG ==="
echo ""
for file in $(find "$BACKLOG_DIR" -name "*.md" -not -name "TEMPLATE_*"); do
  [ -f "$file" ] || continue
  grep -q "status.*done" "$file" && continue
  grep -E "^#|Status|Priority" "$file" | head -4
  echo "---"
done
echo "=== END BACKLOG ==="
