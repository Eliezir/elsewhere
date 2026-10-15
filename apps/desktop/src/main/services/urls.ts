const LOGIN_URL = /https:\/\/[^\s"'<>]+/;

export function isAllowedLoginUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "tailscale.com" || url.hostname.endsWith(".tailscale.com"));
  } catch {
    return false;
  }
}

export function extractLoginUrl(text: string): string | null {
  const match = LOGIN_URL.exec(text);
  if (!match) return null;
  return isAllowedLoginUrl(match[0]) ? match[0] : null;
}

export function extractApprovalUrl(stderr: string): string | null {
  return /requires an additional check/i.test(stderr) ? extractLoginUrl(stderr) : null;
}
