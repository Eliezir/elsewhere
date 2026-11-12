import { describe, expect, it } from "vitest";
import { activeOf, addHost, editActive, enabledProfiles, findHostRepo, hostKind, profilesOf, setHostEnabled, removeActive, selectHost, syncActive } from "./hosts";

type Fields = Parameters<typeof profilesOf>[0];

const base: Fields = { hosts: [], activeHostId: "default", host: "adt-dev", user: "dev", vmRepos: "~/a" };

const merge = (state: Fields, patch: Partial<Fields>): Fields => ({ ...state, ...patch });

describe("host profiles", () => {
  it("builds a profile from the existing single host settings", () => {
    expect(profilesOf(base)).toEqual([{ id: "default", name: "VM", host: "adt-dev", user: "dev", vmRepos: "~/a", mac: "" }]);
  });

  it("keeps the active profile in step with the top level fields", () => {
    const synced = syncActive({ ...base, host: "new-host" });
    expect(synced.hosts[0]?.host).toBe("new-host");
  });

  it("adds a host, switches to it and switches back", () => {
    const added = merge(syncActive(base), addHost(syncActive(base), "pc"));
    expect(added.activeHostId).toBe("pc");
    expect(added.host).toBe("");
    const withPc = syncActive(merge(added, { host: "adt-pc", vmRepos: "~/work" }));
    const back = merge(withPc, selectHost(withPc, "default"));
    expect(back.host).toBe("adt-dev");
    expect(syncActive(back).hosts.find((profile) => profile.id === "pc")?.host).toBe("adt-pc");
  });

  it("edits the name and MAC of the active host only", () => {
    const state = syncActive(base);
    const edited = merge(state, editActive(state, { mac: "aa:bb:cc:dd:ee:ff" }));
    expect(activeOf(edited).mac).toBe("aa:bb:cc:dd:ee:ff");
  });

  it("removes the active host but never the last one", () => {
    const single = syncActive(base);
    expect(removeActive(single)).toEqual({});
    const two = syncActive(merge(single, addHost(single, "pc")));
    const after = merge(two, removeActive(two));
    expect(after.activeHostId).toBe("default");
    expect(profilesOf(after)).toHaveLength(1);
  });
});

describe("findHostRepo", () => {
  const repos = "~/Developer/other\n  ~/trabalho/unicef/adt-studio/\n\n/home/u/lip";

  it("finds the clone whose folder name matches the repo, ignoring blanks and trailing slashes", () => {
    expect(findHostRepo(repos, "adt-studio")).toBe("~/trabalho/unicef/adt-studio");
    expect(findHostRepo(repos, "lip")).toBe("/home/u/lip");
  });

  it("returns null when no listed clone matches", () => {
    expect(findHostRepo(repos, "missing")).toBeNull();
    expect(findHostRepo("", "adt-studio")).toBeNull();
  });
});

describe("host kind", () => {
  it("uses the saved kind first", () => {
    expect(hostKind({ kind: "vm", mac: "aa:bb:cc:dd:ee:ff" })).toBe("vm");
    expect(hostKind({ kind: "pc", mac: "" })).toBe("pc");
  });

  it("guesses a PC when a MAC address is saved and a VM when not", () => {
    expect(hostKind({ mac: "aa:bb:cc:dd:ee:ff" })).toBe("pc");
    expect(hostKind({ mac: "  " })).toBe("vm");
  });
});

describe("enabling and disabling machines", () => {
  const two = { host: "pc", user: "u", vmRepos: "", activeHostId: "pc", hosts: [{ id: "pc", name: "PC", host: "pc", user: "u", vmRepos: "", mac: "" }, { id: "vm", name: "VM", host: "vm", user: "u", vmRepos: "", mac: "" }] };

  it("turns a machine off without removing it", () => {
    const off = { ...two, ...setHostEnabled(two, "vm", false) };
    expect(profilesOf(off)).toHaveLength(2);
    expect(enabledProfiles(off).map((profile) => profile.id)).toEqual(["pc"]);
    const on = { ...off, ...setHostEnabled(off, "vm", true) };
    expect(enabledProfiles(on)).toHaveLength(2);
  });

  it("never turns off the primary machine", () => {
    expect(setHostEnabled(two, "pc", false)).toEqual({});
    expect(enabledProfiles(two)).toHaveLength(2);
  });
});
