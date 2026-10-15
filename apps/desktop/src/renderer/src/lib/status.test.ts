import { describe as suite, expect, it } from "vitest";
import type { TailscaleStatus } from "@vmc/shared";
import { describe, healthOf } from "./status";

const base: TailscaleStatus = {
  state: "connected",
  selfName: "mac",
  vm: { name: "adt-dev", dnsName: "adt-dev.ts.net", ip: "100.2.2.2", online: true },
  checkedAt: 1,
};

suite("status helpers", () => {
  it("is ok when connected and the VM is online", () => {
    expect(healthOf(base)).toBe("ok");
    expect(describe(base)).toContain("100.2.2.2");
  });

  it("is down when the VM is offline", () => {
    expect(healthOf({ ...base, vm: { ...base.vm!, online: false } })).toBe("down");
  });

  it("warns when the VM is missing from the tailnet", () => {
    expect(healthOf({ ...base, vm: null })).toBe("warn");
  });

  it("is unknown before the first result", () => {
    expect(healthOf(undefined)).toBe("unknown");
  });
});
