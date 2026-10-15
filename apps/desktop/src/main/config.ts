export const VM_NAME = "adt-dev";
export const MAIN_WINDOW_SIZE = { width: 1120, height: 720 } as const;
export const POPOVER_SIZE = { width: 380, height: 640 } as const;
export const TAILSCALE_APP = "/Applications/Tailscale.app";
export const TAILSCALE_CLI_CANDIDATES = [
  "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
  "/opt/homebrew/bin/tailscale",
  "/usr/local/bin/tailscale",
] as const;
