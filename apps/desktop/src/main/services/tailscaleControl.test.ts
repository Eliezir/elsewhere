import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ shell: { openPath: vi.fn(), openExternal: vi.fn() } }));

const { extractSuggestedFlags, interpretUp, needsExplicitFlags } = await import("./tailscaleControl");

describe("suggested flags", () => {
  const message = [
    "Error: changing settings via 'tailscale up' requires mentioning all",
    "non-default flags. To proceed, either re-run your command with --reset or",
    "use the command below to explicitly mention the current value of",
    "all non-default settings:",
    "",
    "\ttailscale up --ssh=false --accept-routes --hostname=my-mac",
    "",
  ].join("\n");

  it("recognises the refusal and reads the command Tailscale suggests", () => {
    expect(needsExplicitFlags(message)).toBe(true);
    expect(extractSuggestedFlags(message)).toEqual(["--ssh=false", "--accept-routes", "--hostname=my-mac"]);
  });

  it("refuses flags that would reset or re-authenticate", () => {
    expect(extractSuggestedFlags("\ttailscale up --reset --ssh")).toBeNull();
    expect(extractSuggestedFlags("\ttailscale up --authkey=tskey-abc")).toBeNull();
  });

  it("refuses anything that isn't a plain flag", () => {
    expect(extractSuggestedFlags("\ttailscale up --hostname=a;rm -rf /")).toBeNull();
    expect(extractSuggestedFlags("\ttailscale up $(whoami)")).toBeNull();
  });

  it("returns null when no command is present", () => {
    expect(extractSuggestedFlags("Error: something else")).toBeNull();
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
