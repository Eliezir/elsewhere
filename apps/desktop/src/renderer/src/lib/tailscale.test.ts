import { describe, expect, it } from "vitest";
import { messageFor } from "./tailscale";

describe("messageFor", () => {
  it("says nothing on success", () => {
    expect(messageFor({ ok: true, error: null, signInStarted: false }, "connect")).toBeNull();
  });

  it("points to the browser when sign-in started", () => {
    expect(messageFor({ ok: false, error: null, signInStarted: true }, "connect")).toContain("browser");
  });

  it("passes through a specific error, with a generic fallback", () => {
    expect(messageFor({ ok: false, error: "boom", signInStarted: false }, "connect")).toBe("boom");
    expect(messageFor({ ok: false, error: null, signInStarted: false }, "disconnect")).toBe("Tailscale didn't disconnect.");
  });
});
