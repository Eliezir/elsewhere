import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ nativeImage: { createFromPath: () => ({ isEmpty: () => true }) } }));

const { clearCustomIcon, iconFileStem, saveCustomIcon } = await import("./projectIcon");

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>';

async function dir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "vmc-icons-"));
}

describe("iconFileStem", () => {
  it("is safe for any repo name and distinct per name", () => {
    expect(iconFileStem("my repo/../x")).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(iconFileStem("a b")).not.toBe(iconFileStem("a_b"));
  });
});

describe("saveCustomIcon", () => {
  it("stores an svg and clears it again", async () => {
    const store = await dir();
    const source = join(await dir(), "logo.svg");
    await writeFile(source, SVG);
    expect(await saveCustomIcon("adt-studio", source, store)).toEqual({ ok: true, cancelled: false, error: null });
    expect(await readFile(join(store, `${iconFileStem("adt-studio")}.svg`), "utf8")).toBe(SVG);
    await clearCustomIcon("adt-studio", store);
    await expect(readFile(join(store, `${iconFileStem("adt-studio")}.svg`))).rejects.toThrow();
  });

  it("rejects unsupported file types", async () => {
    const source = join(await dir(), "notes.txt");
    await writeFile(source, "hello");
    const result = await saveCustomIcon("adt-studio", source, await dir());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("PNG");
  });

  it("rejects an svg that isn't one", async () => {
    const source = join(await dir(), "fake.svg");
    await writeFile(source, "not an image");
    expect((await saveCustomIcon("adt-studio", source, await dir())).error).toContain("valid SVG");
  });

  it("rejects an image that can't be opened", async () => {
    const source = join(await dir(), "broken.png");
    await writeFile(source, "not a png");
    expect((await saveCustomIcon("adt-studio", source, await dir())).error).toContain("couldn't be opened");
  });

  it("reports a missing file", async () => {
    expect((await saveCustomIcon("adt-studio", "/nope/missing.png", await dir())).ok).toBe(false);
  });
});
