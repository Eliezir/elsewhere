import { getForwardConfig } from "./forwardLoop";
import { notifier } from "./notifications";
import { usedPercentFromDf } from "./notifier";
import { runLocal, runSsh } from "./ssh";

const FIRST_CHECK_MS = 45 * 1000;
const CHECK_MS = 5 * 60 * 1000;

async function checkOnce(): Promise<void> {
  if (process.platform === "darwin") {
    const mac = await runLocal("df", ["-kP", "/System/Volumes/Data"], { timeout: 15000 });
    const percent = usedPercentFromDf(mac.stdout);
    if (percent !== null) notifier.handleDisk("This Mac", percent);
  }
  const config = getForwardConfig();
  if (config.target === null) return;
  const remote = await runSsh(config.target, "df -kP / 2>/dev/null", { timeout: 20000 });
  const percent = usedPercentFromDf(remote.stdout);
  if (percent !== null) notifier.handleDisk(config.name ?? "The host", percent);
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startDiskWatch(): void {
  if (timer !== null) return;
  setTimeout(() => void checkOnce().catch(() => undefined), FIRST_CHECK_MS);
  timer = setInterval(() => void checkOnce().catch(() => undefined), CHECK_MS);
}

export function stopDiskWatch(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}
