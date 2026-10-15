import { useState } from "react";
import { Button } from "./controls";

export function OpenTailscaleButton({ className = "" }: { className?: string }) {
  const [problem, setProblem] = useState<string | null>(null);

  const open = () => {
    setProblem(null);
    void window.api.openTailscale().then((error) => {
      if (error) setProblem("Tailscale isn't installed in Applications.");
    });
  };

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Button onClick={open} className="!px-3 !py-1 text-xs">
        Open Tailscale
      </Button>
      {problem && <span className="text-[11px] text-[var(--warn)]">{problem}</span>}
    </span>
  );
}
