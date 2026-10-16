import { describe, expect, it } from "vitest";
import { parseTailscaleStatus, settleStatus } from "./tailscale";

const sample = {
  BackendState: "Running",
  Self: { HostName: "macbook", DNSName: "macbook.tail.ts.net.", TailscaleIPs: ["100.1.1.1"], Online: true },
  Peer: {
    abc: { HostName: "adt-dev", DNSName: "adt-dev.tail.ts.net.", TailscaleIPs: ["100.2.2.2"], Online: true },
    def: { HostName: "phone", DNSName: "phone.tail.ts.net.", TailscaleIPs: ["100.3.3.3"], Online: false },
  },
};

describe("parseTailscaleStatus", () => {
  it("finds the VM peer and strips the trailing dot from its DNS name", () => {
    const status = parseTailscaleStatus(sample, "adt-dev", 10);
    expect(status.state).toBe("connected");
    expect(status.vm).toEqual({ name: "adt-dev", dnsName: "adt-dev.tail.ts.net", ip: "100.2.2.2", online: true });
  });

  it("lists devices with the VM first, then online ones", () => {
    const status = parseTailscaleStatus(sample, "adt-dev", 10);
    expect(status.peers.map((peer) => peer.name)).toEqual(["adt-dev", "phone"]);
    expect(status.peers[0]?.isVm).toBe(true);
    expect(status.selfIp).toBe("100.1.1.1");
  });

  it("keeps the raw backend state so the UI can tell sign-in from stopped", () => {
    expect(parseTailscaleStatus({ ...sample, BackendState: "Stopped" }, "adt-dev", 10).backend).toBe("Stopped");
  });

  it("reports disconnected when the backend is not running", () => {
    const status = parseTailscaleStatus({ ...sample, BackendState: "NeedsLogin" }, "adt-dev", 10);
    expect(status.state).toBe("disconnected");
  });

  it("returns null for the VM when the peer is missing", () => {
    expect(parseTailscaleStatus(sample, "other", 10).vm).toBeNull();
  });

  it("returns unknown for unparseable input", () => {
    expect(parseTailscaleStatus("nonsense", "adt-dev", 10).state).toBe("unknown");
  });
});

describe("settleStatus", () => {
  const good = parseTailscaleStatus(sample, "adt-dev", 1000);
  const failed = parseTailscaleStatus(null, "adt-dev", 1010);
  const starting = parseTailscaleStatus({ ...sample, BackendState: "Starting" }, "adt-dev", 1010);

  it("keeps showing connected through a failed or transient read", () => {
    expect(settleStatus(failed, good, 1010).state).toBe("connected");
    expect(settleStatus(starting, good, 1010).state).toBe("connected");
  });

  it("reports real changes straight away", () => {
    const stopped = parseTailscaleStatus({ ...sample, BackendState: "Stopped" }, "adt-dev", 1010);
    expect(settleStatus(stopped, good, 1010).state).toBe("disconnected");
  });

  it("gives up on the old reading after a minute", () => {
    expect(settleStatus(failed, good, 1000 + 61_000).state).toBe("unknown");
  });
});
