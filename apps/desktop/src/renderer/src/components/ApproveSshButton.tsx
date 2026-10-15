import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "./controls";

export function ApproveSshButton({ url, className = "" }: { url: string; className?: string }) {
  const queryClient = useQueryClient();
  const [waiting, setWaiting] = useState(false);

  const approve = () => {
    setWaiting(true);
    void window.api.openApproval(url);
    for (const delay of [6000, 12000, 20000]) {
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["vm-snapshot"] }), delay);
    }
    setTimeout(() => setWaiting(false), 20000);
  };

  return (
    <span className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      <Button onClick={approve} disabled={waiting} className="!px-3 !py-1 text-xs whitespace-nowrap">
        {waiting ? "Waiting for approval…" : "Approve SSH access"}
      </Button>
      <span className="basis-full text-[11px] leading-snug text-[var(--text-muted)]">Approve in the browser. It stays valid for a while.</span>
    </span>
  );
}
