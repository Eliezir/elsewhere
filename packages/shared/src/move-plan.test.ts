import { describe, expect, it } from "vitest";
import { planMove } from "./move-plan";

const base = { branch: "feature/x", modified: 2, sessions: 1, includeEnv: false, removeSource: false, hasEnv: false };

describe("planMove", () => {
  it("names the VM by default", () => {
    const labels = planMove({ ...base, direction: "to-vm" }).map((step) => step.label);
    expect(labels).toContain("Check the VM connection");
    expect(labels).toContain("Push feature/x to the VM over SSH");
  });

  it("uses the host name in both directions", () => {
    const out = planMove({ ...base, direction: "to-vm", host: "PC", removeSource: true }).map((step) => step.label);
    expect(out).toContain("Check the PC connection");
    expect(out).toContain("Remove the Mac copy once the PC copy is verified");
    const back = planMove({ ...base, direction: "to-mac", host: "PC", removeSource: true }).map((step) => step.label);
    expect(back).toContain("Fetch feature/x from the PC");
    expect(back).toContain("Remove the PC copy once the Mac is updated");
  });

  it("plans a branch-only send into the host project", () => {
    const labels = planMove({ ...base, direction: "to-vm", host: "WSL PC", branchOnly: true, removeSource: true }).map((step) => step.label);
    expect(labels).toEqual([
      "Check the WSL PC connection",
      "Commit 2 modified files as a WIP commit",
      "Push feature/x to the WSL PC over SSH",
      "Create feature/x in the WSL PC project",
      "Remove the Mac copy once feature/x is on the WSL PC",
    ]);
  });
});
