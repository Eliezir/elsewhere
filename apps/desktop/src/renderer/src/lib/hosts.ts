import type { HostProfile, Settings } from "./settings";

type HostFields = Pick<Settings, "hosts" | "activeHostId" | "host" | "user" | "vmRepos">;

export function profilesOf(settings: HostFields): HostProfile[] {
  if (settings.hosts.length > 0) return settings.hosts;
  return [{ id: settings.activeHostId, name: "VM", host: settings.host, user: settings.user, vmRepos: settings.vmRepos, mac: "" }];
}

export function activeOf(settings: HostFields): HostProfile {
  const profiles = profilesOf(settings);
  return profiles.find((profile) => profile.id === settings.activeHostId) ?? profiles[0] ?? { id: "default", name: "VM", host: "", user: "dev", vmRepos: "", mac: "" };
}

export function syncActive<T extends HostFields>(settings: T): T {
  const profiles = profilesOf(settings);
  const activeId = profiles.some((profile) => profile.id === settings.activeHostId) ? settings.activeHostId : (profiles[0]?.id ?? settings.activeHostId);
  const hosts = profiles.map((profile) => (profile.id === activeId ? { ...profile, host: settings.host, user: settings.user, vmRepos: settings.vmRepos } : profile));
  return { ...settings, hosts, activeHostId: activeId };
}

export function findHostRepo(vmRepos: string, repo: string): string | null {
  for (const line of vmRepos.split("\n")) {
    const path = line.trim().replace(/\/+$/, "");
    if (path !== "" && path.split("/").pop() === repo) return path;
  }
  return null;
}

export function selectHost(settings: HostFields, id: string): Partial<Settings> {
  const target = profilesOf(settings).find((profile) => profile.id === id);
  if (!target) return {};
  return { activeHostId: id, host: target.host, user: target.user, vmRepos: target.vmRepos };
}

export type HostKind = "vm" | "pc";

export function hostKind(profile: Pick<HostProfile, "kind" | "mac">): HostKind {
  return profile.kind ?? (profile.mac.trim() !== "" ? "pc" : "vm");
}

export function editActive(settings: HostFields, patch: Partial<Pick<HostProfile, "name" | "mac" | "kind">>): Partial<Settings> {
  const profiles = profilesOf(settings);
  const activeId = activeOf(settings).id;
  return { hosts: profiles.map((profile) => (profile.id === activeId ? { ...profile, ...patch } : profile)) };
}

export function addHost(settings: HostFields, id: string): Partial<Settings> {
  const profiles = profilesOf(settings);
  const created: HostProfile = { id, name: `Host ${profiles.length + 1}`, host: "", user: activeOf(settings).user, vmRepos: "", mac: "" };
  return { hosts: [...profiles, created], activeHostId: id, host: "", user: created.user, vmRepos: "" };
}

export function removeActive(settings: HostFields): Partial<Settings> {
  const profiles = profilesOf(settings);
  if (profiles.length < 2) return {};
  const activeId = activeOf(settings).id;
  const hosts = profiles.filter((profile) => profile.id !== activeId);
  const next = hosts[0];
  return next ? { hosts, activeHostId: next.id, host: next.host, user: next.user, vmRepos: next.vmRepos } : {};
}
