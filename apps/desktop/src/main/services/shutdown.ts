import type { ShutdownArm, ShutdownStatus, VmTarget } from "@vmc/shared";
import { describeSshFailure, runSsh } from "./ssh";

export const WATCHER_SCRIPT = String.raw`D="$HOME/.vmc/shutdown"
IDLE_MIN="$1"
GRACE="$2"
POLL="$VMC_POLL"
[ -n "$POLL" ] || POLL=30
LOAD_LIMIT="$VMC_LOAD_LIMIT"
[ -n "$LOAD_LIMIT" ] || LOAD_LIMIT=0.8
PATTERN="$VMC_BUSY_PATTERN"
[ -n "$PATTERN" ] || PATTERN='vitest|playwright test|pnpm (run )?(build|test|e2e)|cargo build|tsc '
mkdir -p "$D"
echo $$ > "$D/pid"
write_state() {
  printf 'state=%s\nidle_since=%s\nidle_min=%s\ngrace=%s\nends=%s\n' "$1" "$2" "$IDLE_MIN" "$GRACE" "$3" > "$D/state"
}
busy() {
  if [ -n "$(find "$HOME/.claude/projects" "$HOME/.codex/sessions" -type f -mmin -"$IDLE_MIN" 2>/dev/null | head -n 1)" ]; then return 0; fi
  if [ -r /proc/loadavg ]; then
    awk -v limit="$LOAD_LIMIT" '{ exit !($1 >= limit) }' /proc/loadavg && return 0
  fi
  pgrep -f "$PATTERN" >/dev/null 2>&1 && return 0
  return 1
}
idle_since=""
write_state watching 0 0
while :; do
  now=$(date +%s)
  if busy; then
    idle_since=""
    write_state watching 0 0
  else
    [ -n "$idle_since" ] || idle_since=$now
    write_state watching "$idle_since" 0
    if [ $((now - idle_since)) -ge $((IDLE_MIN * 60)) ]; then
      write_state counting-down "$idle_since" $((now + GRACE))
      if [ -n "$VMC_SHUTDOWN_CMD" ]; then
        sh -c "$VMC_SHUTDOWN_CMD"
      else
        /mnt/c/Windows/System32/shutdown.exe /s /t "$GRACE" /c "Elsewhere: nothing has run for $IDLE_MIN minutes. Shutting down in $GRACE seconds. Run shutdown /a to cancel."
      fi
      sleep $((GRACE + POLL * 2))
      idle_since=""
      write_state watching 0 0
    fi
  fi
  sleep "$POLL"
done
`;

export const STATUS_SCRIPT = `D="$HOME/.vmc/shutdown"
echo "@@NOW $(date +%s)"
if [ -f "$D/pid" ] && kill -0 "$(cat "$D/pid")" 2>/dev/null; then
  echo "@@ALIVE 1"
  cat "$D/state" 2>/dev/null
else
  echo "@@ALIVE 0"
fi
`;

export const DISARM_SCRIPT = `D="$HOME/.vmc/shutdown"
if [ -f "$D/pid" ]; then kill "$(cat "$D/pid")" 2>/dev/null; fi
/mnt/c/Windows/System32/shutdown.exe /a >/dev/null 2>&1
rm -f "$D/pid" "$D/state"
${STATUS_SCRIPT}`;

export function buildArmScript(input: Pick<ShutdownArm, "idleMinutes" | "graceSeconds">): string {
  const idle = Math.trunc(input.idleMinutes);
  const grace = Math.trunc(input.graceSeconds);
  if (!Number.isFinite(idle) || !Number.isFinite(grace)) throw new Error("Invalid shutdown settings");
  return `D="$HOME/.vmc/shutdown"
mkdir -p "$D"
if [ -f "$D/pid" ] && kill -0 "$(cat "$D/pid")" 2>/dev/null; then kill "$(cat "$D/pid")" 2>/dev/null; fi
cat > "$D/watch.sh" <<'VMC_WATCHER'
${WATCHER_SCRIPT}VMC_WATCHER
if command -v setsid >/dev/null 2>&1; then
  setsid nohup sh "$D/watch.sh" ${idle} ${grace} >"$D/log" 2>&1 </dev/null &
else
  nohup sh "$D/watch.sh" ${idle} ${grace} >"$D/log" 2>&1 </dev/null &
fi
sleep 2
${STATUS_SCRIPT}`;
}

function field(output: string, key: string): string | null {
  const match = new RegExp(`^${key}=(.*)$`, "m").exec(output);
  return match?.[1] ?? null;
}

function numberField(output: string, key: string): number | null {
  const value = field(output, key);
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const OFF: Omit<ShutdownStatus, "reachable" | "error"> = { state: "off", idleMinutes: null, graceSeconds: null, idleForMinutes: null, secondsLeft: null };

export function parseShutdownStatus(output: string): Omit<ShutdownStatus, "reachable" | "error"> {
  const now = Number(/^@@NOW (\d+)/m.exec(output)?.[1] ?? 0);
  if (!/^@@ALIVE 1/m.test(output)) return OFF;
  const state = field(output, "state") === "counting-down" ? "counting-down" : "watching";
  const idleSince = numberField(output, "idle_since") ?? 0;
  const ends = numberField(output, "ends") ?? 0;
  return {
    state,
    idleMinutes: numberField(output, "idle_min"),
    graceSeconds: numberField(output, "grace"),
    idleForMinutes: idleSince > 0 && now > 0 ? Math.max(0, Math.floor((now - idleSince) / 60)) : 0,
    secondsLeft: state === "counting-down" && ends > 0 && now > 0 ? Math.max(0, ends - now) : null,
  };
}

async function run(target: VmTarget, script: string): Promise<ShutdownStatus> {
  const result = await runSsh(target, script, { timeout: 30000 });
  if (result.code !== 0) return { reachable: false, error: describeSshFailure(result), ...OFF };
  return { reachable: true, error: null, ...parseShutdownStatus(result.stdout) };
}

export const getShutdownStatus = (target: VmTarget) => run(target, STATUS_SCRIPT);
export const armShutdown = (target: VmTarget, input: Pick<ShutdownArm, "idleMinutes" | "graceSeconds">) => run(target, buildArmScript(input));
export const disarmShutdown = (target: VmTarget) => run(target, DISARM_SCRIPT);
