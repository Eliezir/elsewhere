import { describe, expect, it } from "vitest";
import { MAC_STORAGE_SCRIPT } from "./macStorage";
import { parseStorage } from "./vmStorage";

describe("mac storage", () => {
  it("reads the disk line and du rows with tab separators", () => {
    const parsed = parseStorage("@@DISK 1000 400\n@@H 2048\t/Users/a/.t3/worktrees\n@@H 512\t/Users/a/Library/Caches\n");
    expect(parsed.diskTotalBytes).toBe(1000 * 1024);
    expect(parsed.diskUsedBytes).toBe(400 * 1024);
    expect(parsed.entries.map((entry) => entry.path)).toEqual(["/Users/a/.t3/worktrees", "/Users/a/Library/Caches"]);
  });

  it("counts what is really available, not total minus used, since APFS volumes share space", () => {
    const parsed = parseStorage("@@DISK 1000 400 150\n");
    expect(parsed.diskTotalBytes).toBe(1000 * 1024);
    expect(parsed.diskUsedBytes).toBe(850 * 1024);
  });

  it("measures the children of .t3 instead of the parent, so nothing is counted twice", () => {
    expect(MAC_STORAGE_SCRIPT).toContain('"$H/.t3"/*');
    expect(MAC_STORAGE_SCRIPT).not.toMatch(/du -sk -x [^\n]*"\$H\/\.t3" /);
  });
});
