import { Popover } from "@base-ui/react/popover";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ProjectIconInfo } from "@vmc/shared";
import { Button } from "./controls";
import { ProjectIcon } from "./ProjectIcon";

export function ProjectIconEditor({ repo, info }: { repo: string; info: ProjectIconInfo | undefined }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["project-icons"] });

  const choose = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.api.chooseProjectIcon(repo);
      if (result.ok) {
        await refresh();
        setOpen(false);
      } else if (!result.cancelled) {
        setError(result.error ?? "That image couldn't be used.");
      }
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    await window.api.clearProjectIcon(repo);
    await refresh();
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <Popover.Trigger aria-label={`Change the icon for ${repo}`} className="no-drag group relative shrink-0 cursor-default rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
        <ProjectIcon repo={repo} icon={info?.icon} size="lg" />
        <span className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-black/60 text-[11px] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">Edit</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start" className="z-50">
          <Popover.Popup className="w-64 rounded-2xl border border-[var(--hairline)] bg-[oklch(0.15_0.05_285)] p-3 shadow-2xl outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            <div className="mb-2.5 flex items-center gap-2.5">
              <ProjectIcon repo={repo} icon={info?.icon} size="md" />
              <div className="min-w-0">
                <div className="truncate">{repo}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">{info?.custom ? "Custom icon" : info?.icon ? "Found in the project" : "Letter tile"}</div>
              </div>
            </div>
            <Button onClick={() => void choose()} disabled={busy} className="w-full !py-1.5">
              {busy ? "Choosing…" : "Choose image…"}
            </Button>
            {info?.custom && (
              <Button onClick={() => void clear()} className="mt-2 w-full !py-1.5">
                Use the automatic icon
              </Button>
            )}
            {error && <p className="mt-2 text-[11px] leading-snug text-[var(--warn)]">{error}</p>}
            <p className="mt-2.5 text-[11px] leading-snug text-[var(--text-muted)]">PNG, JPG, WebP or SVG. It applies to every worktree of this project.</p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
