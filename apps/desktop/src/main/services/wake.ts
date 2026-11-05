import { createSocket } from "node:dgram";
import { networkInterfaces } from "node:os";
import type { WakeResult } from "@vmc/shared";

const PORTS = [9, 7];

export function macBytes(mac: string): Buffer | null {
  const parts = mac.split(/[:-]/);
  if (parts.length !== 6 || !parts.every((part) => /^[0-9a-fA-F]{2}$/.test(part))) return null;
  return Buffer.from(parts.map((part) => Number.parseInt(part, 16)));
}

export function magicPacket(mac: string): Buffer | null {
  const bytes = macBytes(mac);
  if (bytes === null) return null;
  return Buffer.concat([Buffer.alloc(6, 0xff), ...Array.from({ length: 16 }, () => bytes)]);
}

export function broadcastAddresses(interfaces: ReturnType<typeof networkInterfaces>): string[] {
  const found = new Set<string>(["255.255.255.255"]);
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const address = entry.address.split(".").map(Number);
      const mask = entry.netmask.split(".").map(Number);
      found.add(address.map((octet, index) => (octet | (~(mask[index] ?? 0) & 255)) & 255).join("."));
    }
  }
  return [...found];
}

function sendOnce(packet: Buffer, address: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createSocket("udp4");
    const done = (ok: boolean) => {
      socket.close();
      resolve(ok);
    };
    socket.once("error", () => done(false));
    socket.bind(0, () => {
      socket.setBroadcast(true);
      socket.send(packet, port, address, (error) => done(error === null));
    });
  });
}

export async function wakeHost(mac: string): Promise<WakeResult> {
  const packet = magicPacket(mac);
  if (packet === null) return { ok: false, sent: 0, error: "That MAC address isn't valid." };
  const targets = broadcastAddresses(networkInterfaces());
  const results = await Promise.all(targets.flatMap((address) => PORTS.map((port) => sendOnce(packet, address, port))));
  const sent = results.filter(Boolean).length;
  return sent > 0 ? { ok: true, sent, error: null } : { ok: false, sent: 0, error: "Couldn't send the wake packet. Is this Mac on a network?" };
}
