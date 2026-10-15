import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { NavId } from "@/lib/nav";
import { useNavigate } from "@/lib/nav-context";

interface TileProps {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "dark" | "light";
  index?: number;
  to?: NavId;
}

const TONE = {
  dark: "bg-[var(--glass)]",
  light: "bg-[oklch(0.5_0.2_290/0.2)]",
} as const;

export function Tile({ title, icon, action, children, className = "", tone = "dark", index = 0, to }: TileProps) {
  const go = useNavigate();
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.05 }}
      className={`flex min-h-0 flex-col rounded-[22px] border border-[var(--hairline)] p-4 shadow-[inset_0_1px_0_oklch(1_0_0/0.06)] ${TONE[tone]} ${className}`}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs text-[var(--text-secondary)]">
            {icon}
            {to ? (
              <button
                type="button"
                onClick={() => go(to)}
                className="no-drag group flex cursor-default items-center gap-1 outline-none transition-colors duration-200 hover:text-[var(--text-primary)]"
              >
                {title}
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
                  ›
                </span>
              </button>
            ) : (
              title
            )}
          </h2>
          {action}
        </div>
      )}
      {children}
    </motion.section>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "ok" }) {
  const color = { neutral: "text-[var(--text-secondary)]", warn: "text-[var(--warn)]", ok: "text-[var(--ok)]" }[tone];
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full border border-[var(--hairline)] bg-[var(--inset)] px-2 py-0.5 text-[11px] ${color}`}>
      {children}
    </span>
  );
}
