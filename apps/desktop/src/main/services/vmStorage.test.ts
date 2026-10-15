import { describe, expect, it } from "vitest";
import { parseStorage } from "./vmStorage";

describe("parseStorage", () => {
  it("reads the disk line and sorts entries by size", () => {
    const parsed = parseStorage(`@@DISK 100000 40000
@@H 2048 /home/dev/.npm
@@H 900000 /home/dev/Developer
@@W 500000 /home/dev/Developer/worktrees/adt-studio/cayenne
@@V 1000 /home/dev/Developer/.vmc/adt-studio.git
noise`);
    expect(parsed.diskTotalBytes).toBe(100000 * 1024);
    expect(parsed.diskUsedBytes).toBe(40000 * 1024);
    expect(parsed.entries.map((entry) => [entry.kind, entry.path])).toEqual([
      ["home", "/home/dev/Developer"],
      ["worktree", "/home/dev/Developer/worktrees/adt-studio/cayenne"],
      ["home", "/home/dev/.npm"],
      ["hub", "/home/dev/Developer/.vmc/adt-studio.git"],
    ]);
  });
});
