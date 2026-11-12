import type { GamingResult, PowerAction, VmTarget } from "@vmc/shared";
import { BUSY_SCRIPT, parseBusy } from "./pcMode";
import { lanMouse } from "./lanMouse";
import { describeSshFailure, runSsh } from "./ssh";

const POWERSHELL = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
const SHUTDOWN = "/mnt/c/Windows/System32/shutdown.exe";
const GRACE_SECONDS = 30;

export function powerJob(action: PowerAction): string {
  if (action === "sleep") return `${POWERSHELL} -NoProfile -Command 'Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.Application]::SetSuspendState("Suspend", $false, $false)'\n`;
  const flag = action === "restart" ? "/r" : "/s";
  const word = action === "restart" ? "Restarting" : "Shutting down";
  return `${SHUTDOWN} ${flag} /t ${GRACE_SECONDS} /c "Elsewhere: ${word} in ${GRACE_SECONDS} seconds. Run shutdown /a to cancel."\n`;
}

export function launchScript(action: PowerAction): string {
  return `cat > /tmp/vmc-power.sh <<'VMC_JOB'
${powerJob(action)}VMC_JOB
setsid nohup sh -c 'sleep 3; sh /tmp/vmc-power.sh' >/dev/null 2>&1 </dev/null &
echo "@@STARTED"
`;
}

export interface PowerDeps {
  checkBusy: (target: VmTarget) => Promise<{ reachable: boolean; reasons: string[]; error: string | null }>;
  stopSharing: () => Promise<void>;
  launch: (target: VmTarget, action: PowerAction) => Promise<boolean>;
}

export async function powerAction(target: VmTarget, action: PowerAction, force: boolean, deps: PowerDeps = REAL_DEPS): Promise<GamingResult> {
  const check = await deps.checkBusy(target);
  if (!check.reachable) return { ok: false, busy: false, reason: null, error: check.error ?? "Can't reach the host." };
  if (check.reasons.length > 0 && !force) return { ok: false, busy: true, reason: check.reasons.join(", "), error: null };
  await deps.stopSharing();
  const started = await deps.launch(target, action);
  return started ? { ok: true, busy: false, reason: null, error: null } : { ok: false, busy: false, reason: null, error: "The host didn't confirm it started." };
}

const REAL_DEPS: PowerDeps = {
  checkBusy: async (target) => {
    const result = await runSsh(target, BUSY_SCRIPT, { timeout: 20000 });
    if (result.code !== 0 || !result.stdout.includes("@@DONE")) return { reachable: false, reasons: [], error: describeSshFailure(result) };
    return { reachable: true, reasons: parseBusy(result.stdout), error: null };
  },
  stopSharing: async () => {
    await lanMouse.control({ action: "stop" }).catch(() => undefined);
  },
  launch: async (target, action) => {
    const result = await runSsh(target, launchScript(action), { timeout: 20000 });
    return result.stdout.includes("@@STARTED");
  },
};
