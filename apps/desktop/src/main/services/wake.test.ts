import { describe, expect, it } from "vitest";
import { broadcastAddresses, macBytes, magicPacket } from "./wake";

describe("magicPacket", () => {
  it("is six 0xff bytes followed by the MAC repeated sixteen times", () => {
    const packet = magicPacket("aa:bb:cc:dd:ee:ff");
    expect(packet?.length).toBe(102);
    expect(packet?.subarray(0, 6).every((byte) => byte === 0xff)).toBe(true);
    expect(packet?.subarray(6, 12).toString("hex")).toBe("aabbccddeeff");
    expect(packet?.subarray(96, 102).toString("hex")).toBe("aabbccddeeff");
  });

  it("accepts dashes and rejects malformed addresses", () => {
    expect(macBytes("AA-BB-CC-DD-EE-FF")?.toString("hex")).toBe("aabbccddeeff");
    expect(magicPacket("aa:bb:cc")).toBeNull();
    expect(magicPacket("zz:bb:cc:dd:ee:ff")).toBeNull();
  });
});

describe("broadcastAddresses", () => {
  it("derives each interface's directed broadcast and skips loopback and IPv6", () => {
    const interfaces = {
      lo0: [{ address: "127.0.0.1", netmask: "255.0.0.0", family: "IPv4", internal: true }],
      en0: [
        { address: "192.168.1.42", netmask: "255.255.255.0", family: "IPv4", internal: false },
        { address: "fe80::1", netmask: "ffff:ffff:ffff:ffff::", family: "IPv6", internal: false },
      ],
    } as unknown as Parameters<typeof broadcastAddresses>[0];
    expect(broadcastAddresses(interfaces)).toEqual(["255.255.255.255", "192.168.1.255"]);
  });
});
