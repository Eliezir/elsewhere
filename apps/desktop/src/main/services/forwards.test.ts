import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOwner, pinKeyFor, setPortPin } from "./forwards";

describe("parseOwner", () => {
  it("names the command and the folder it runs in", () => {
    expect(parseOwner("p15803\ncnode\n", "p15803\nn/Users/me/.t3/worktrees/lip/t3code-1\n")).toBe("node in t3code-1");
  });
  it("falls back to the command alone, or nothing", () => {
    expect(parseOwner("p1\ncnode\n", "")).toBe("node");
    expect(parseOwner("", "")).toBeNull();
  });
});

describe("pinKeyFor", () => {
  it("keys a port by its worktree root, whichever app folder it runs from", () => {
    expect(pinKeyFor("/home/dev/Developer/worktrees/adt-studio/lisbon/apps/studio", 5173)).toBe("/home/dev/Developer/worktrees/adt-studio/lisbon|5173");
    expect(pinKeyFor("/home/dev/.t3/worktrees/adt-studio/t3-1/apps/api", 3001)).toBe("/home/dev/.t3/worktrees/adt-studio/t3-1|3001");
    expect(pinKeyFor("/srv/app", 80)).toBe("/srv/app|80");
    expect(pinKeyFor(null, 80)).toBe("unknown|80");
  });
});

describe("setPortPin", () => {
  it("remembers a pin on disk and forgets it again", async () => {
    const home = await mkdtemp(join(tmpdir(), "vmc-pins-"));
    process.env.VMC_HOME = home;
    await setPortPin({ key: "/w/a|5173", local: 5200 });
    expect(JSON.parse(await readFile(join(home, "port-pins.json"), "utf8"))).toEqual({ "/w/a|5173": 5200 });
    await setPortPin({ key: "/w/a|5173", local: null });
    expect(JSON.parse(await readFile(join(home, "port-pins.json"), "utf8"))).toEqual({});
    delete process.env.VMC_HOME;
  });
});
