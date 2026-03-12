#!/bin/bash
# Prints open backlog and auto-processes inbox items at session start

BACKLOG="$(pwd)/.project/backlog/BACKLOG.md"
if [ ! -f "$BACKLOG" ]; then exit 0; fi

# --- Auto-process inbox items ---
INBOX_ITEMS=$(awk '/^## Inbox/{found=1; next} found && /^- /{print} found && /^#{1,}[^#]/{exit}' "$BACKLOG")

if [ -n "$INBOX_ITEMS" ]; then
  LAST_ID=$(grep "^|" "$BACKLOG" \
    | grep -v -E "^\| *ID *\|" \
    | grep -v -E "^\|[-: |]+\|" \
    | awk -F'|' '{print $2}' | tr -d ' ' \
    | grep -E '^[0-9]+$' | sort -n | tail -1)
  NEXT_ID=$(( 10#${LAST_ID:-0} + 1 ))

  # Write new rows to a temp file instead of passing via argument
  TMPFILE=$(mktemp)

  while IFS= read -r line; do
    TASK=$(echo "$line" | sed 's/^- //')
    [ -z "$TASK" ] && continue

    # Parse type prefix
    case "${TASK:0:1}" in
      b) TYPE="bug";          TASK="${TASK:1}" ;;
      e) TYPE="experimental"; TASK="${TASK:1}" ;;
      *)  TYPE="feature" ;;
    esac

    # Parse priority prefix
    case "${TASK:0:1}" in
      ^) PRIORITY="high"; TASK="${TASK:1}" ;;
      _) PRIORITY="low";  TASK="${TASK:1}" ;;
      *)  PRIORITY="med" ;;
    esac

    TASK=$(echo "$TASK" | sed 's/^ *//')
    ID=$(printf "%03d" $NEXT_ID)
    echo "| $ID | $TYPE | $TASK | $PRIORITY | todo |" >> "$TMPFILE"

    echo "✅ [$ID] ($TYPE, $PRIORITY) $TASK"
    NEXT_ID=$(( NEXT_ID + 1 ))
  done <<< "$INBOX_ITEMS"

  # Use Python to safely insert rows and clean inbox
  python3 - "$BACKLOG" "$TMPFILE" <<'EOF'
import sys

filepath = sys.argv[1]
tmpfile = sys.argv[2]

with open(tmpfile, "r") as f:
    new_rows = [line.rstrip("\n") for line in f.readlines() if line.strip()]

with open(filepath, "r") as f:
    lines = f.readlines()

result = []
in_table = False
table_ended = False
in_inbox = False

for line in lines:
    stripped = line.rstrip()
    is_table_row = stripped.startswith("|")

    if is_table_row and not table_ended:
        in_table = True
        result.append(line)
        continue

    if in_table and not is_table_row and not table_ended:
        for row in new_rows:
            result.append(row + "\n")
        table_ended = True
        in_table = False

    if stripped.startswith("## Inbox"):
        in_inbox = True
        result.append(line)
        continue

    if in_inbox and stripped.startswith("- "):
        continue

    result.append(line)

with open(filepath, "w") as f:
    f.writelines(result)
EOF

  rm -f "$TMPFILE"
  echo ""
fi

# --- Print open backlog ---
echo "=== OPEN BACKLOG ==="
grep "^|" "$BACKLOG" \
  | grep -v -E "^\| *ID *\|" \
  | grep -v -E "^\|[-: |]+\|" \
  | grep -v "| done |"
echo "=== END BACKLOG ==="
echo "Inbox sigils: [b=bug|e=experimental][^=high|_=low] Title  e.g. '- b^Critical bug'"
