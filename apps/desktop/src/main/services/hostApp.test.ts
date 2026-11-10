import { describe, expect, it } from "vitest";
import { buildHostAppScript, parseHostAppState, POWERSHELL_SCRIPTS, TASK_NAME } from "./hostApp";

describe("host app control", () => {
  it("reads the state marker and falls back to failed", () => {
    expect(parseHostAppState("noise\n@@STATE running\n")).toBe("running");
    expect(parseHostAppState("@@STATE not-set-up")).toBe("not-set-up");
    expect(parseHostAppState("@@STATE something-else")).toBe("failed");
    expect(parseHostAppState("")).toBe("failed");
  });

  it("calls PowerShell by its full path with the script as a quoted heredoc", () => {
    const script = buildHostAppScript("open");
    expect(script).toContain("/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe");
    expect(script).toContain("<<'VMC_PS'");
    expect(script).toContain("Start-ScheduledTask");
  });

  it("only touches the one task and the one process, with nothing taken from input", () => {
    for (const script of Object.values(POWERSHELL_SCRIPTS)) {
      expect(script).not.toMatch(/Invoke-Expression|iex |DownloadString/);
    }
    expect(POWERSHELL_SCRIPTS.open).toContain(TASK_NAME);
    expect(POWERSHELL_SCRIPTS.close).toContain("Stop-Process -Name lan-mouse");
  });

  it("sets the task up as interactive, on demand only, and not elevated", () => {
    expect(POWERSHELL_SCRIPTS.setup).toContain("-LogonType Interactive");
    expect(POWERSHELL_SCRIPTS.setup).toContain("-RunLevel Limited");
    expect(POWERSHELL_SCRIPTS.setup).not.toContain("New-ScheduledTaskTrigger");
  });
});
