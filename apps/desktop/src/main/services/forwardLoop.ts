import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ForwardConfigSchema, type ForwardConfig, type LinkStatus } from "@vmc/shared";
import { stopStaleForwards } from "./forwards";
import { getLinkStatus, setLinkStatus } from "./link";
import { getVmPorts } from "./vmPorts";

const POLL_MS = 6000;

let config: ForwardConfig = { target: null, autoForward: true };
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;

function configFile(): string {
  return join(process.env.VMC_HOME ?? join(homedir(), ".vm-companion"), "forward-config.json");
}

export async function setForwardConfig(next: ForwardConfig): Promise<void> {
  config = next;
  await mkdir(join(configFile(), ".."), { recursive: true });
  await writeFile(configFile(), `${JSON.stringify(next)}\n`).catch(() => undefined);
}

async function loadConfig(): Promise<void> {
  const text = await readFile(configFile(), "utf8").catch(() => null);
  if (text === null) return;
  const parsed = ForwardConfigSchema.safeParse(JSON.parse(text));
  if (parsed.success) config = parsed.data;
}

export function linkFromPorts(result: { reachable: boolean; error: string | null; approvalUrl: string | null }): LinkStatus {
  if (result.reachable) return { state: "ok", approvalUrl: null, message: null };
  if (result.approvalUrl) return { state: "approval", approvalUrl: result.approvalUrl, message: result.error };
  return { state: "offline", approvalUrl: null, message: result.error };
}

function forcedLink(): LinkStatus | null {
  const forced = process.env.VMC_DEBUG_LINK;
  if (forced === "approval") return { state: "approval", approvalUrl: "https://login.tailscale.com/a/example", message: "Tailscale SSH needs your approval before it lets this Mac in." };
  if (forced === "offline") return { state: "offline", approvalUrl: null, message: "Can't reach the VM. Is Tailscale connected?" };
  return null;
}

async function tick(): Promise<void> {
  const forced = forcedLink();
  if (forced) {
    setLinkStatus(forced);
    return;
  }
  if (config.target === null) {
    setLinkStatus({ state: "unknown", approvalUrl: null, message: null });
    return;
  }
  if (running) return;
  running = true;
  try {
    setLinkStatus(linkFromPorts(await getVmPorts(config.target, config.autoForward)));
  } catch {
    return;
  } finally {
    running = false;
  }
}

export async function refreshLink(): Promise<LinkStatus> {
  await tick();
  return getLinkStatus();
}

export function startForwardLoop(): void {
  if (timer !== null) return;
  void stopStaleForwards().catch(() => undefined).then(() => loadConfig()).catch(() => undefined).then(() => tick());
  timer = setInterval(() => void tick(), POLL_MS);
}

export function stopForwardLoop(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}
