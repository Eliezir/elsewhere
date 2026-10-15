import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ shell: { openPath: vi.fn(), openExternal: vi.fn() } }));

const { extractLoginUrl, interpretUp, isAllowedLoginUrl } = await import("./tailscaleControl");

describe("login URLs", () => {
  it("finds the sign-in link in the CLI output", () => {
    const output = "\nTo authenticate, visit:\n\n\thttps://login.tailscale.com/a/abc123\n\n";
    expect(extractLoginUrl(output)).toBe("https://login.tailscale.com/a/abc123");
  });

  it("only ever opens Tailscale's own hosts over https", () => {
    expect(isAllowedLoginUrl("https://login.tailscale.com/a/x")).toBe(true);
    expect(isAllowedLoginUrl("https://tailscale.com/start")).toBe(true);
    expect(isAllowedLoginUrl("http://login.tailscale.com/a/x")).toBe(false);
    expect(isAllowedLoginUrl("https://tailscale.com.evil.example/a")).toBe(false);
    expect(isAllowedLoginUrl("https://evil.example/login.tailscale.com")).toBe(false);
    expect(extractLoginUrl("visit https://evil.example/steal")).toBeNull();
  });
});

describe("interpretUp", () => {
  it("succeeds on exit code 0", () => {
    expect(interpretUp("", 0)).toEqual({ ok: true, error: null, signInStarted: false });
  });

  it("reports that sign-in started when a login link was printed", () => {
    expect(interpretUp("visit https://login.tailscale.com/a/abc", null)).toEqual({ ok: false, error: null, signInStarted: true });
  });

  it("explains the custom-flags refusal", () => {
    const text = "Error: changing settings via 'tailscale up' requires mentioning all non-default flags.";
    expect(interpretUp(text, 1).error).toContain("custom settings");
  });

  it("surfaces the last line of an unknown failure", () => {
    expect(interpretUp("something\nbroke badly\n", 1).error).toBe("broke badly");
  });
});
