export const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "worktrees", label: "Worktrees" },
  { id: "vm", label: "VM" },
  { id: "usage", label: "Usage" },
  { id: "queue", label: "Queue" },
  { id: "settings", label: "Settings" },
] as const;

export type NavId = (typeof NAV_ITEMS)[number]["id"];

export function isNavId(value: string): value is NavId {
  return NAV_ITEMS.some((item) => item.id === value);
}
