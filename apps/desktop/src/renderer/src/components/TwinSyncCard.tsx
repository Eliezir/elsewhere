import { MoveRequestSchema } from "@vmc/shared";
import { useState } from "react";
import type { Worktree } from "@/data/types";
import { useTwinSync } from "@/data/hooks";
import { syncPlan } from "@/lib/sync";
import { useSettings } from "@/lib/settings";
import { Button } from "./controls";

interface TwinSyncCardProps {
  mac: Worktree;
  vm: Worktree;
  vmReachable: boolean;
  onSynced: () => void;
}

export function TwinSyncCard({ mac, vm, vmReachable, onSynced }: TwinSyncCardProps) {
  const [settings] = useSettings();
  const comparison = useTwinSync(mac, vm, vmReachable);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const data = comparison.data;
  const plan = data?.ok ? syncPlan({ macOnly: data.macOnly, vmOnly: data.vmOnly, macModified: mac.modified, vmModified: vm.modified }) : null;
  const direction = plan?.kind === "mac-ahead" ? "to-vm" : plan?.kind === "vm-ahead" ? "to-mac" : null;

  const sync = async () => {
    if (direction === null || mac.branch === null) return;
    const parsed = MoveRequestSchema.safeParse({
      direction,
      target: { host: settings.host.trim(), user: settings.user.trim() },
      repo: mac.repo,
      name: direction === "to-vm" ? vm.name : mac.name,
      branch: mac.branch,
      macPath: mac.path,
      vmPath: vm.path,
      includeEnv: false,
      removeSource: false,
    });
    if (!parsed.success) {
      setMessage("This worktree's name or branch has characters the sync can't handle safely.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await window.api.startMove(parsed.data);
      setMessage(result.ok ? (result.note ?? "Synced.") : (result.error ?? "The sync failed."));
      onSynced();
      void comparison.refetch();
    } catch {
      setMessage("The sync couldn't start.");
    } finally {
      setBusy(false);
    }
  };

  const tone = plan?.kind === "in-sync" ? "text-[var(--ok)]" : plan?.kind === "both-changed" ? "text-[var(--warn)]" : "text-[var(--text-primary)]";

  return (
    <div className="mt-3 flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--inset)] px-3.5 py-2.5">
      <div className="min-w-0 text-xs leading-snug">
        {!vmReachable ? (
          <span className="text-[var(--text-secondary)]">Connect to the VM to compare the two copies.</span>
        ) : comparison.isPending || comparison.isFetching ? (
          <span className="text-[var(--text-secondary)]">Comparing the Mac and VM copies…</span>
        ) : data && !data.ok ? (
          <span className="text-[var(--warn)]">{data.error}</span>
        ) : plan ? (
          <>
            <span className={tone}>{message ?? plan.message}</span>
            {direction !== null && !message && ((direction === "to-vm" && mac.modified > 0) || (direction === "to-mac" && vm.modified > 0)) && (
              <span className="mt-0.5 block text-[var(--text-secondary)]">{`Unsaved changes are saved as a WIP commit on the ${direction === "to-vm" ? "Mac" : "VM"} first.`}</span>
            )}
          </>
        ) : (
          <span className="text-[var(--text-secondary)]">Couldn't compare the two copies.</span>
        )}
      </div>
      {direction !== null && !comparison.isFetching && (
        <Button variant="primary" onClick={() => void sync()} disabled={busy} className="shrink-0 !px-4 !py-1.5">
          {busy ? "Syncing…" : direction === "to-vm" ? "Sync to the VM" : "Sync to the Mac"}
        </Button>
      )}
    </div>
  );
}
