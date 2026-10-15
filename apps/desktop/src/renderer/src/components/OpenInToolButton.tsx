import { useState } from "react";
import type { ToolInfo } from "@vmc/shared";
import type { Worktree } from "@/data/types";
import { toolFor, type Origin } from "@/lib/origin";
import { Button } from "./controls";

interface OpenInToolButtonProps {
  tree: Worktree;
  origin: Origin;
  tools: Record<"conductor" | "t3code", ToolInfo> | undefined;
  threadTitle: string | null;
}

export function OpenInToolButton({ tree, origin, tools, threadTitle }: OpenInToolButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tool = toolFor(origin);
  if (tool === null) return null;

  const info = tools?.[tool];
  const name = tool === "conductor" ? "Conductor" : "T3 Code";
  const installed = info?.installed ?? false;

  const open = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await window.api.openInTool({ tool, path: tree.path });
      if (!result.ok) setMessage(result.error ?? `${name} couldn't be opened.`);
      else if (tool === "conductor") setMessage(`Conductor is open. Select the workspace “${tree.name}” in its sidebar. Conductor can't be pointed at one directly.`);
      else if (result.opened === "thread") setMessage(`Opened its thread${threadTitle ? `: ${threadTitle}` : ""}.`);
      else setMessage("T3 Code is open. It has no thread for this worktree yet.");
    } catch {
      setMessage(`${name} couldn't be opened.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0">
      <Button onClick={() => void open()} disabled={busy || !installed} className="flex w-full items-center justify-center gap-2 whitespace-nowrap !py-1.5">
        {info?.icon && <img src={info.icon} alt="" draggable={false} className="size-4 rounded-[4px]" />}
        {installed ? `Open in ${name}` : `${name} isn't installed`}
      </Button>
      {message && <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-secondary)]">{message}</p>}
    </div>
  );
}
