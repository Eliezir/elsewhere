import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createDaemon } from "./server";

let server: Server;
let base = "";

beforeAll(async () => {
  server = createDaemon({ host: "127.0.0.1", port: 0, token: "secret" });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("daemon", () => {
  it("rejects requests without the token", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(401);
  });

  it("returns health for an authorized request", async () => {
    const res = await fetch(`${base}/health`, { headers: { authorization: "Bearer secret" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("returns 404 for unknown routes", async () => {
    const res = await fetch(`${base}/nope`, { headers: { authorization: "Bearer secret" } });
    expect(res.status).toBe(404);
  });
});
