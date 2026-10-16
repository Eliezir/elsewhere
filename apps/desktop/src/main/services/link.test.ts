import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ BrowserWindow: { getAllWindows: () => [] } }));

const { linkTooltip, trayIconName } = await import("./link");

describe("trayIconName", () => {
  it("shows a dot when approval is needed, a ring when offline and the plain crescent otherwise", () => {
    expect(trayIconName("approval")).toBe("trayAlertTemplate");
    expect(trayIconName("offline")).toBe("trayOfflineTemplate");
    expect(trayIconName("ok")).toBe("trayTemplate");
    expect(trayIconName("unknown")).toBe("trayTemplate");
  });
});

describe("linkTooltip", () => {
  it("says what is wrong", () => {
    expect(linkTooltip({ state: "approval", approvalUrl: "https://x", message: null })).toContain("approval");
    expect(linkTooltip({ state: "offline", approvalUrl: null, message: null })).toContain("can't reach");
    expect(linkTooltip({ state: "ok", approvalUrl: null, message: null })).toContain("connected");
  });
});
