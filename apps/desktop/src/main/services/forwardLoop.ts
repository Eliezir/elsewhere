import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ForwardConfigSchema, type ForwardConfig } from "@vmc/shared";
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

async function tick(): Promise<void> {
  if (running || config.target === null || !config.autoForward) return;
  running = true;
  try {
    await getVmPorts(config.target, true);
  } catch {
    return;
  } finally {
    running = false;
  }
}

export function startForwardLoop(): void {
  if (timer !== null) return;
  void loadConfig().catch(() => undefined).then(() => tick());
  timer = setInterval(() => void tick(), POLL_MS);
}

export function stopForwardLoop(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}
