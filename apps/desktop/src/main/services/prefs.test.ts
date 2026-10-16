import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { isPackaged: false, setLoginItemSettings: vi.fn() } }));

const { keepsRunningInBackground } = await import("./prefs");

describe("keepsRunningInBackground", () => {
  it("only hides the app when there is a menu bar icon to get back in through", () => {
    expect(keepsRunningInBackground({ startAtLogin: false, runInBackground: true, showInMenuBar: true })).toBe(true);
    expect(keepsRunningInBackground({ startAtLogin: false, runInBackground: true, showInMenuBar: false })).toBe(false);
    expect(keepsRunningInBackground({ startAtLogin: false, runInBackground: false, showInMenuBar: true })).toBe(false);
  });
});
