#!/bin/sh
DIR="${VMC_HOME:-$HOME/.vm-companion}"
SAMPLE_EVERY=300

input=$(cat)

record() {
  mkdir -p "$DIR" || return 0
  now=$(date +%s)
  snap=$(printf '%s' "$input" | jq -c --argjson now "$now" '
    def win: if . == null or .used_percentage == null or .resets_at == null then null else {usedPercentage: .used_percentage, resetsAt: .resets_at} end;
    {updatedAt: $now, fiveHour: (.rate_limits.five_hour | win), sevenDay: (.rate_limits.seven_day | win)}
  ' 2>/dev/null) || return 0
  case "$snap" in
    *'"fiveHour":null,"sevenDay":null'*) return 0 ;;
    '') return 0 ;;
  esac
  printf '%s\n' "$snap" > "$DIR/usage.json.$$" && mv "$DIR/usage.json.$$" "$DIR/usage.json"
  last=$(cat "$DIR/.history-at" 2>/dev/null || echo 0)
  if [ $((now - last)) -ge "$SAMPLE_EVERY" ]; then
    printf '%s' "$snap" | jq -c '{t: .updatedAt, five: .fiveHour.usedPercentage, seven: .sevenDay.usedPercentage}' >> "$DIR/usage-history.jsonl" 2>/dev/null
    printf '%s\n' "$now" > "$DIR/.history-at"
  fi
}

record >/dev/null 2>&1 || :

if [ -f "$DIR/chain-command" ]; then
  printf '%s' "$input" | sh -c "$(cat "$DIR/chain-command")"
fi
exit 0
