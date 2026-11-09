import { useState } from "react";
import { Button } from "@/components/controls";
import { useTools } from "@/data/hooks";
import type { Worktree } from "@/data/types";
import { useSettings } from "@/lib/settings";
import { useHostName } from "@/lib/useHost";

export function OpenInRemoteT3Button({ tree, reachable }: { tree: Worktree; reachable: boolean }) {
  const [settings] = useSettings();
  const host = useHostName();
  const info = useTools().data?.t3code;
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const installed = info?.installed ?? false;

  const open = async () => {
    setBusy(true);
    setMessage(`Contacting ${host}…`);
    try {
      const result = await window.api.openInRemoteT3({ target: { host: settings.host.trim(), user: settings.user.trim() }, path: tree.path, branch: tree.branch });
      if (!result.ok) setMessage(result.error ?? "T3 Code couldn't be opened.");
      else if (result.opened === "thread") setMessage(`Opened its thread${result.title ? `: ${result.title}` : ""}.`);
      else if (result.copied === "branch") setMessage(`T3 Code is open and the branch name “${tree.branch}” is copied. In the ${host} project, start a thread and paste it as the branch. Next time this button opens that thread.`);
      else setMessage(`T3 Code is open and the path is copied. In the ${host} environment, add it as a project and start a thread. Next time this button opens that thread.`);
    } catch {
      setMessage("T3 Code couldn't be opened.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-2 min-w-0">
      <Button onClick={() => void open()} disabled={busy || !installed || !reachable} className="flex w-full items-center justify-center gap-2 whitespace-nowrap !py-1.5">
        {info?.icon && <img src={info.icon} alt="" draggable={false} className="size-4 rounded-[4px]" />}
        {installed ? `Open in T3 Code on ${host}` : "T3 Code isn't installed"}
      </Button>
      {!reachable && <p className="mt-1.5 text-[11px] leading-snug text-[var(--warn)]">{`Can't reach ${host} right now, so there's nothing to open yet.`}</p>}
      {message && reachable && <p className="mt-1.5 rounded-xl bg-[var(--inset)] px-3 py-2 text-xs leading-relaxed text-[var(--text-primary)]">{message}</p>}
    </div>
  );
}
