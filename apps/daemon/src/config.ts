export interface DaemonConfig {
  host: string;
  port: number;
  token: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DaemonConfig {
  const port = Number(env.VMC_PORT ?? 7878);
  return {
    host: env.VMC_HOST ?? "127.0.0.1",
    port: Number.isInteger(port) && port > 0 ? port : 7878,
    token: env.VMC_TOKEN ?? null,
  };
}
