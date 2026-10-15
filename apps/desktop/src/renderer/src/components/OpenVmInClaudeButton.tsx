import { useState } from "react";
import type { Worktree } from "@/data/types";
import { useSettings } from "@/lib/settings";
import { ClaudeMark } from "./ClaudeMark";
import { Button } from "./controls";

export function OpenVmInClaudeButton({ tree, vmReachable }: { tree: Worktree; vmReachable: boolean }) {
  const [settings] = useSettings();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await window.api.openInClaudeDesktop({ target: { host: settings.host.trim(), user: settings.user.trim() }, path: tree.path, sessionId: tree.sessions[0]?.id });
      setMessage(result.ok ? tree.sessions.length > 0 ? "Confirm the connection in Claude Desktop. The prompt box is pre-filled to read where the earlier conversation stopped: check it, then press Enter. If it asks for a folder, paste: the path is on your clipboard." : "Confirm the connection in Claude Desktop. If it asks for a folder, paste: the path is on your clipboard." : result.error);
    } catch {
      setMessage("Claude Desktop couldn't be opened.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4">
      <Button onClick={() => void open()} disabled={busy || !vmReachable} className="flex w-full items-center justify-center gap-2 !py-1.5">
        <ClaudeMark size={14} />
        Open in Claude Desktop
        <span className="rounded-full border border-[var(--hairline)] px-1.5 text-[10px] text-[var(--text-secondary)]">Test</span>
      </Button>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-secondary)]">{message ?? "Runs Claude on the VM in this folder, over SSH. Needs Claude Desktop 2.110 or newer. It starts a new conversation, pre-filled to catch up from the copied one."}</p>
    </div>
  );
}
