import { describe, expect, it } from "vitest";
import { extractApprovalUrl, extractLoginUrl, isAllowedLoginUrl } from "./urls";

describe("login URLs", () => {
  it("finds the sign-in link in the CLI output", () => {
    expect(extractLoginUrl("\nTo authenticate, visit:\n\n\thttps://login.tailscale.com/a/abc123\n\n")).toBe("https://login.tailscale.com/a/abc123");
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

describe("extractApprovalUrl", () => {
  it("reads the approval link from Tailscale SSH's check message", () => {
    const stderr = "# Tailscale SSH requires an additional check.\n# To authenticate, visit: https://login.tailscale.com/a/l5c0b6842b6d6e\n";
    expect(extractApprovalUrl(stderr)).toBe("https://login.tailscale.com/a/l5c0b6842b6d6e");
  });

  it("ignores ordinary SSH errors", () => {
    expect(extractApprovalUrl("ssh: connect to host x port 22: Operation timed out")).toBeNull();
  });
});
