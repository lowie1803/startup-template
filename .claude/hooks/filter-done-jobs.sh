#!/bin/bash
# Migrates | done | rows from BACKLOG.md to DONE.md at session start

BACKLOG="$(pwd)/.project/backlog/BACKLOG.md"
DONE="$(pwd)/.project/backlog/DONE.md"

if [ ! -f "$BACKLOG" ]; then exit 0; fi

DONE_ROWS=$(grep "^|" "$BACKLOG" \
  | grep -v -E "^\| *ID *\|" \
  | grep -v -E "^\|[-: |]+\|" \
  | grep "| done |")

if [ -z "$DONE_ROWS" ]; then exit 0; fi

python3 - "$BACKLOG" "$DONE" <<'EOF'
import sys, os

backlog_path = sys.argv[1]
done_path = sys.argv[2]

with open(backlog_path, "r") as f:
    backlog_lines = f.readlines()

done_rows = []
new_backlog = []
for line in backlog_lines:
    stripped = line.rstrip()
    if stripped.startswith("|") and "| done |" in stripped \
       and not stripped.startswith("| ID") \
       and not all(c in "| -:" for c in stripped):
        done_rows.append(line)
    else:
        new_backlog.append(line)

if not done_rows:
    sys.exit(0)

# Write BACKLOG without done rows
with open(backlog_path, "w") as f:
    f.writelines(new_backlog)

# Read or create DONE.md
if os.path.exists(done_path):
    with open(done_path, "r") as f:
        done_lines = f.readlines()
else:
    done_lines = [
        "# Done\n",
        "\n",
        "| ID | Type | Title | Priority | Status |\n",
        "|----|------|-------|----------|--------|\n",
    ]

# Append migrated rows
with open(done_path, "w") as f:
    f.writelines(done_lines)
    for row in done_rows:
        f.write(row)

for row in done_rows:
    parts = [p.strip() for p in row.split("|")]
    row_id = parts[1] if len(parts) > 1 else "???"
    print(f"🗂  [{row_id}] moved to DONE.md")
EOF
