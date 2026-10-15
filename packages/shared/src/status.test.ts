import { describe, expect, it } from "vitest";
import { TailscaleStatusSchema } from "./status";

describe("TailscaleStatusSchema", () => {
  it("accepts a connected status with the VM online", () => {
    const parsed = TailscaleStatusSchema.parse({
      state: "connected",
      backend: "Running",
      selfName: "macbook",
      selfIp: "100.1.1.1",
      tailnet: null,
      peers: [],
      vm: { name: "adt-dev", dnsName: "adt-dev.tail.ts.net", ip: "100.1.2.3", online: true },
      checkedAt: 1,
    });
    expect(parsed.vm?.online).toBe(true);
  });

  it("rejects an unknown connection state", () => {
    expect(() =>
      TailscaleStatusSchema.parse({ state: "weird", backend: "x", selfName: null, selfIp: null, tailnet: null, peers: [], vm: null, checkedAt: 1 }),
    ).toThrow();
  });
});
