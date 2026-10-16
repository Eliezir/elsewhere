import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { isPackaged: false, setLoginItemSettings: vi.fn() } }));

const { hidesFromDock, keepsRunningInBackground } = await import("./prefs");

describe("keepsRunningInBackground", () => {
  it("only hides the app when there is a menu bar icon to get back in through", () => {
    expect(keepsRunningInBackground({ startAtLogin: false, runInBackground: true, showInMenuBar: true, hideFromDock: false })).toBe(true);
    expect(keepsRunningInBackground({ startAtLogin: false, runInBackground: true, showInMenuBar: false, hideFromDock: false })).toBe(false);
    expect(keepsRunningInBackground({ startAtLogin: false, runInBackground: false, showInMenuBar: true, hideFromDock: false })).toBe(false);
  });
});

describe("hidesFromDock", () => {
  it("needs the menu bar icon, otherwise nothing could reopen the app", () => {
    const base = { startAtLogin: false, runInBackground: true, hideFromDock: true };
    expect(hidesFromDock({ ...base, showInMenuBar: true })).toBe(true);
    expect(hidesFromDock({ ...base, showInMenuBar: false })).toBe(false);
    expect(hidesFromDock({ ...base, hideFromDock: false, showInMenuBar: true })).toBe(false);
  });
});
