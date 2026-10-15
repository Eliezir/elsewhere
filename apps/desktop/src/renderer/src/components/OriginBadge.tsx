import type { ToolsInfo } from "@vmc/shared";
import { toolFor, type Origin } from "@/lib/origin";

export function OriginBadge({ origin, tools, size = "sm" }: { origin: Origin; tools: ToolsInfo | undefined; size?: "sm" | "md" }) {
  const tool = toolFor(origin);
  const icon = tool ? tools?.[tool].icon : null;
  const text = size === "md" ? "text-xs" : "text-[11px]";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--inset)] px-2 py-0.5 text-[var(--text-secondary)] ${text}`} title={origin.detail ? `${origin.label} · ${origin.detail}` : origin.label}>
      {icon && <img src={icon} alt="" draggable={false} className="size-3.5 rounded-[3px]" />}
      {origin.label}
    </span>
  );
}
