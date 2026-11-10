import type { HostAppAction, HostAppResult, HostAppState, VmTarget } from "@vmc/shared";
import { describeSshFailure, runSsh } from "./ssh";

export const TASK_NAME = "Elsewhere Lan Mouse";
const POWERSHELL = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";

const TASK_CHECK = `$task = Get-ScheduledTask -TaskName "${TASK_NAME}" -ErrorAction SilentlyContinue
if (-not $task) { Write-Output "@@STATE not-set-up"; exit }`;

export const POWERSHELL_SCRIPTS: Record<HostAppAction, string> = {
  status: `${TASK_CHECK}
if (Get-Process lan-mouse -ErrorAction SilentlyContinue) { Write-Output "@@STATE running" } else { Write-Output "@@STATE stopped" }`,
  open: `${TASK_CHECK}
if (Get-Process lan-mouse -ErrorAction SilentlyContinue) { Write-Output "@@STATE running"; exit }
Start-ScheduledTask -TaskName "${TASK_NAME}"
Start-Sleep 3
if (Get-Process lan-mouse -ErrorAction SilentlyContinue) { Write-Output "@@STATE started" } else { Write-Output "@@STATE failed" }`,
  close: `${TASK_CHECK}
if (-not (Get-Process lan-mouse -ErrorAction SilentlyContinue)) { Write-Output "@@STATE stopped"; exit }
Stop-Process -Name lan-mouse -Force -ErrorAction SilentlyContinue
Start-Sleep 1
if (Get-Process lan-mouse -ErrorAction SilentlyContinue) { Write-Output "@@STATE failed" } else { Write-Output "@@STATE closed" }`,
  setup: `$exe = Get-ChildItem "$env:LOCALAPPDATA\\Microsoft\\WinGet\\Packages" -Recurse -Filter lan-mouse.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $exe) { Write-Output "@@STATE not-installed"; exit }
$user = "$env:USERDOMAIN\\$env:USERNAME"
$action = New-ScheduledTaskAction -Execute $exe.FullName -WorkingDirectory $exe.DirectoryName
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "${TASK_NAME}" -Action $action -Principal $principal -Settings $settings -Force | Out-Null
if (Get-ScheduledTask -TaskName "${TASK_NAME}" -ErrorAction SilentlyContinue) { Write-Output "@@STATE stopped" } else { Write-Output "@@STATE failed" }`,
};

export function buildHostAppScript(action: HostAppAction): string {
  return `${POWERSHELL} -NoProfile -Command - <<'VMC_PS' | tr -d '\\r'
${POWERSHELL_SCRIPTS[action]}
VMC_PS
`;
}

const STATES: readonly HostAppState[] = ["not-installed", "not-set-up", "running", "stopped", "started", "closed", "failed"];

export function parseHostAppState(output: string): HostAppState {
  const match = /^@@STATE ([a-z-]+)/m.exec(output)?.[1];
  return STATES.find((state) => state === match) ?? "failed";
}

export async function controlHostApp(target: VmTarget, action: HostAppAction): Promise<HostAppResult> {
  const result = await runSsh(target, buildHostAppScript(action), { timeout: 45000 });
  if (result.code !== 0 && !/@@STATE/.test(result.stdout)) return { reachable: false, error: describeSshFailure(result), state: "failed" };
  return { reachable: true, error: null, state: parseHostAppState(result.stdout) };
}
