import { useState } from "react";
import { useTools, useVmT3 } from "@/data/hooks";
import type { Worktree } from "@/data/types";
import { describeOpen, t3Status } from "@/lib/t3Messages";
import { useSettings } from "@/lib/settings";
import { Button } from "./controls";

export function OpenVmInT3Button({ tree, vmReachable }: { tree: Worktree; vmReachable: boolean }) {
  const [settings] = useSettings();
  const tools = useTools().data;
  const query = useVmT3([tree.path], vmReachable);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const installed = tools?.t3code.installed ?? false;
  const project = query.data?.projects[tree.path];

  const open = async () => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(describeOpen(await window.api.openVmInT3({ target: { host: settings.host.trim(), user: settings.user.trim() }, path: tree.path })));
    } catch {
      setMessage("T3 Code couldn't be opened.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4">
      <Button onClick={() => void open()} disabled={busy || !vmReachable || !installed} className="flex w-full items-center justify-center gap-2 !py-1.5">
        {tools?.t3code.icon && <img src={tools.t3code.icon} alt="" draggable={false} className="size-4 rounded-[4px]" />}
        {installed ? "Open in T3 Code" : "T3 Code isn't installed"}
      </Button>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-secondary)]">{message ?? (query.data ? t3Status(project, query.data.hasDatabase) : "Checking T3 Code on the VM…")}</p>
    </div>
  );
}
