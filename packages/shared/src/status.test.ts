import { describe, expect, it } from "vitest";
import { TailscaleStatusSchema } from "./status";

describe("TailscaleStatusSchema", () => {
  it("accepts a connected status with the VM online", () => {
    const parsed = TailscaleStatusSchema.parse({
      state: "connected",
      selfName: "macbook",
      vm: { name: "adt-dev", dnsName: "adt-dev.tail.ts.net", ip: "100.1.2.3", online: true },
      checkedAt: 1,
    });
    expect(parsed.vm?.online).toBe(true);
  });

  it("rejects an unknown connection state", () => {
    expect(() =>
      TailscaleStatusSchema.parse({ state: "weird", selfName: null, vm: null, checkedAt: 1 }),
    ).toThrow();
  });
});
