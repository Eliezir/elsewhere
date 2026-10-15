import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { hostname } from "node:os";
import { DaemonHealthSchema } from "@vmc/shared";
import type { DaemonConfig } from "./config";

const VERSION = "0.0.0";

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function isAuthorized(req: IncomingMessage, token: string | null): boolean {
  if (token === null) return true;
  return req.headers.authorization === `Bearer ${token}`;
}

export function createDaemon(config: DaemonConfig): Server {
  return createServer((req, res) => {
    if (!isAuthorized(req, config.token)) {
      send(res, 401, { error: "unauthorized" });
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      const health = DaemonHealthSchema.parse({
        ok: true,
        uptimeSeconds: Math.floor(process.uptime()),
        hostname: hostname(),
        version: VERSION,
      });
      send(res, 200, health);
      return;
    }
    send(res, 404, { error: "not_found" });
  });
}
