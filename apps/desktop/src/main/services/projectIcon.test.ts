import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ nativeImage: {} }));

const { candidatePaths, findProjectIcon, isFlat } = await import("./projectIcon");

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>';

function deps(files: Record<string, number>, apps: string[] = [], svg = SVG) {
  const rasterized: string[] = [];
  return {
    rasterized,
    deps: {
      listApps: async () => apps,
      fileSize: async (path: string) => files[path] ?? null,
      readSvg: async () => svg,
      rasterize: (path: string) => {
        rasterized.push(path);
        return `png:${path}`;
      },
    },
  };
}

describe("candidatePaths", () => {
  it("prefers root icons, then each app's own icon, then common folders", () => {
    const paths = candidatePaths(["desktop", "studio"]);
    expect(paths[0]).toBe("icon.png");
    expect(paths.indexOf("apps/desktop/src-tauri/icons/icon.png")).toBeLessThan(paths.indexOf("assets/icon.png"));
    expect(paths).toContain("apps/studio/public/favicon.svg");
  });
});

describe("findProjectIcon", () => {
  it("uses a Tauri app icon when the repo has one", async () => {
    const { deps: d } = deps({ "/r/apps/desktop/src-tauri/icons/icon.png": 4000 }, ["desktop", "studio"]);
    expect(await findProjectIcon("/r", d)).toBe("png:/r/apps/desktop/src-tauri/icons/icon.png");
  });

  it("turns an svg favicon into a data URL without rasterizing", async () => {
    const { deps: d, rasterized } = deps({ "/r/apps/studio/public/favicon.svg": 300 }, ["studio"]);
    const icon = await findProjectIcon("/r", d);
    expect(icon?.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(rasterized).toEqual([]);
  });

  it("skips empty and oversized files, and files that aren't svg", async () => {
    const { deps: d } = deps({ "/r/icon.png": 0, "/r/logo.png": 9_999_999, "/r/icon.svg": 100 }, [], "not an image");
    expect(await findProjectIcon("/r", d)).toBeNull();
  });

  it("returns null when nothing matches", async () => {
    expect(await findProjectIcon("/r", deps({}).deps)).toBeNull();
  });
});

describe("isFlat", () => {
  const solid = (r: number, g: number, b: number, a = 255) => Uint8Array.from(Array.from({ length: 16 }, () => [b, g, r, a]).flat());

  it("treats a single-colour image as flat", () => {
    expect(isFlat(solid(28, 170, 228))).toBe(true);
  });

  it("does not treat a picture with detail as flat", () => {
    const picture = solid(28, 170, 228);
    picture.set([255, 255, 255, 255], 8);
    expect(isFlat(picture)).toBe(false);
  });

  it("treats an empty bitmap as flat", () => {
    expect(isFlat(new Uint8Array())).toBe(true);
  });
});
