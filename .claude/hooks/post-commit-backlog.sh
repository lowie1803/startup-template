#!/bin/bash
# After a git commit, remind Claude to update backlog item status
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)
if echo "$COMMAND" | grep -q "git commit"; then
  echo "A commit was just made. Check .project/backlog/BACKLOG.md — if this commit completes or progresses any open item, update its status field accordingly."
fi
