import { Tabs } from "@base-ui/react/tabs";
import { motion } from "motion/react";
import mark from "@/assets/mark.png";
import { NAV_ITEMS, type NavId } from "@/lib/nav";
import { IS_SAMPLE_DATA } from "@/data/mock";
import { Pill } from "./Tile";
import { StatusPill } from "./StatusPill";

interface TopBarProps {
  active: NavId;
}

export function TopBar({ active }: TopBarProps) {
  return (
    <header className="drag grid h-[52px] shrink-0 grid-cols-[1fr_auto_1fr] items-center pl-[84px] pr-4">
      <span className="flex items-center gap-2 text-[13px] font-medium">
        <img src={mark} alt="" className="size-5 rounded-[6px]" />
        VM Companion
      </span>
      <Tabs.List
        aria-label="Sections"
        className="no-drag flex gap-1 rounded-full border border-[var(--hairline)] bg-[var(--glass-strong)] p-1"
      >
        {NAV_ITEMS.map((item) => {
          const selected = item.id === active;
          return (
            <Tabs.Tab
              key={item.id}
              value={item.id}
              className="relative cursor-default rounded-full px-3.5 py-1 text-[var(--text-secondary)] outline-none transition-colors duration-200 aria-selected:text-[var(--text-primary)]"
            >
              {selected && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full bg-[var(--accent)]/35 shadow-[0_0_18px_oklch(0.62_0.24_285/0.45)]"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative">{item.label}</span>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
      <div className="no-drag flex items-center justify-end gap-2">
        {IS_SAMPLE_DATA && <Pill>sample data</Pill>}
        <StatusPill />
      </div>
    </header>
  );
}
