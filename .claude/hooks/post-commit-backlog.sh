#!/bin/bash
# After a git commit, parse [NNN] IDs from commit message and mark matching BACKLOG rows as done

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

MSG=$(git -C "$(pwd)" log -1 --pretty=%B 2>/dev/null)
IDS=$(echo "$MSG" | grep -oE '\[([0-9]{3})\]' | grep -oE '[0-9]{3}' | tr '\n' ' ')

if [ -z "$IDS" ]; then
  exit 0
fi

BACKLOG="$(pwd)/.project/backlog/BACKLOG.md"

if [ ! -f "$BACKLOG" ]; then
  exit 0
fi

python3 - "$BACKLOG" "$IDS" <<'EOF'
import sys, re

backlog_path = sys.argv[1]
ids = set(sys.argv[2].split())

with open(backlog_path, "r") as f:
    lines = f.readlines()

new_lines = []
matched = set()
for line in lines:
    stripped = line.rstrip()
    if stripped.startswith("|") and not stripped.startswith("| ID") \
       and not all(c in "| -:" for c in stripped):
        parts = [p.strip() for p in stripped.split("|")]
        row_id = parts[1] if len(parts) > 1 else ""
        if row_id in ids:
            # Replace status (last non-empty field) with 'done'
            # Status is parts[-2] (last cell before trailing empty)
            status_idx = len(parts) - 2
            if status_idx > 0:
                old_status = parts[status_idx]
                new_line = line.rstrip()
                # Replace last occurrence of the status value
                new_line = re.sub(
                    r'\|\s*' + re.escape(old_status) + r'\s*\|(\s*)$',
                    '| done |\\1',
                    new_line
                )
                new_lines.append(new_line + "\n" if not line.endswith("\n") else new_line + "\n")
                matched.add(row_id)
                print(f"✅ [{row_id}] marked done")
                continue
    new_lines.append(line)

with open(backlog_path, "w") as f:
    f.writelines(new_lines)

for id_ in ids:
    if id_ not in matched:
        print(f"ℹ️  [{id_}] not found in BACKLOG.md (may already be in DONE.md)")
EOF
