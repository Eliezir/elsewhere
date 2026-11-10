import type { GamingResult, VmTarget } from "@vmc/shared";
import { controlHostApp } from "./hostApp";
import { lanMouse } from "./lanMouse";
import { describeSshFailure, runSsh } from "./ssh";

export const BUSY_SCRIPT = `H="$HOME"
if [ -n "$(find "$H/.claude/projects" "$H/.codex/sessions" -type f -mmin -10 2>/dev/null | head -n 1)" ]; then echo "@@BUSY an agent wrote something in the last 10 minutes"; fi
if [ -r /proc/loadavg ] && awk '{ exit !($1 >= 0.8) }' /proc/loadavg; then echo "@@BUSY the machine is under load"; fi
if pgrep -f 'vitest|playwright test|pnpm (run )?(build|test|e2e)|cargo build|tsc ' >/dev/null 2>&1; then echo "@@BUSY a build or test is running"; fi
echo "@@DONE"
`;

export const STOP_JOB = String.raw`W=/mnt/c/Windows/System32/wsl.exe
running=$($W -l --running 2>/dev/null | tr -d '\000\r' | tail -n +2 | sed 's/ (Default)//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$')
docker=$(printf '%s\n' "$running" | grep -c '^docker-desktop')
if [ "$docker" -eq 0 ]; then
  $W --shutdown
else
  printf '%s\n' "$running" | grep -v '^docker-desktop' | while read -r d; do $W --terminate "$d"; done
fi
`;

export const LAUNCH_SCRIPT = `cat > /tmp/vmc-gaming.sh <<'VMC_JOB'
${STOP_JOB}VMC_JOB
setsid nohup sh -c 'sleep 3; sh /tmp/vmc-gaming.sh' >/dev/null 2>&1 </dev/null &
echo "@@STARTED"
`;

export function parseBusy(output: string): string[] {
  return [...output.matchAll(/^@@BUSY (.+)$/gm)].map((match) => match[1] ?? "").filter((reason) => reason !== "");
}

export interface GamingDeps {
  checkBusy: (target: VmTarget) => Promise<{ reachable: boolean; reasons: string[]; error: string | null }>;
  stopSharing: () => Promise<void>;
  closeLanMouse: (target: VmTarget) => Promise<void>;
  launch: (target: VmTarget) => Promise<boolean>;
}

export async function startGamingMode(target: VmTarget, force: boolean, deps: GamingDeps = REAL_DEPS): Promise<GamingResult> {
  const check = await deps.checkBusy(target);
  if (!check.reachable) return { ok: false, busy: false, reason: null, error: check.error ?? "Can't reach the host." };
  if (check.reasons.length > 0 && !force) return { ok: false, busy: true, reason: check.reasons.join(", "), error: null };
  await deps.stopSharing();
  await deps.closeLanMouse(target);
  const started = await deps.launch(target);
  return started ? { ok: true, busy: false, reason: null, error: null } : { ok: false, busy: false, reason: null, error: "The host didn't confirm it started stopping WSL." };
}

const REAL_DEPS: GamingDeps = {
  checkBusy: async (target) => {
    const result = await runSsh(target, BUSY_SCRIPT, { timeout: 20000 });
    if (result.code !== 0 || !result.stdout.includes("@@DONE")) return { reachable: false, reasons: [], error: describeSshFailure(result) };
    return { reachable: true, reasons: parseBusy(result.stdout), error: null };
  },
  stopSharing: async () => {
    await lanMouse.control({ action: "stop" }).catch(() => undefined);
  },
  closeLanMouse: async (target) => {
    await controlHostApp(target, "close").catch(() => undefined);
  },
  launch: async (target) => {
    const result = await runSsh(target, LAUNCH_SCRIPT, { timeout: 20000 });
    return result.stdout.includes("@@STARTED");
  },
};
