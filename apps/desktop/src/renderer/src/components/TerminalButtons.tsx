import { useState } from "react";
import { Button } from "@/components/controls";
import { useSettings } from "@/lib/settings";

export function VmTerminalButton({ path = null, mode = "shell", label = "Open a terminal on the VM", disabled = false, className = "" }: { path?: string | null; mode?: "shell" | "claude"; label?: string; disabled?: boolean; className?: string }) {
  const [settings] = useSettings();
  const [problem, setProblem] = useState<string | null>(null);

  const open = () => {
    setProblem(null);
    void window.api.openVmTerminal({ target: { host: settings.host.trim(), user: settings.user.trim() }, path, mode }).then((error) => {
      if (error) setProblem("Couldn't open Terminal.");
    });
  };

  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <Button onClick={open} disabled={disabled} className="!py-1.5">
        {label}
      </Button>
      {problem && <span className="text-[11px] text-[var(--warn)]">{problem}</span>}
    </span>
  );
}

export function MacTerminalButton({ path, label = "Open terminal here", className = "" }: { path: string; label?: string; className?: string }) {
  const [problem, setProblem] = useState<string | null>(null);

  const open = () => {
    setProblem(null);
    void window.api.openMacTerminal(path).then((error) => {
      if (error) setProblem(error);
    });
  };

  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <Button onClick={open} className="!py-1.5">
        {label}
      </Button>
      {problem && <span className="text-[11px] text-[var(--warn)]">{problem}</span>}
    </span>
  );
}
