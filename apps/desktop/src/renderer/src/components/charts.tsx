import { motion } from "motion/react";

export function BigNumber({ value, unit, tone }: { value: string; unit?: string; tone?: "warn" }) {
  return (
    <div className={`text-[44px] font-medium leading-none tracking-tight ${tone === "warn" ? "text-[var(--warn)]" : ""}`}>
      {value}
      {unit && <span className="ml-1 text-xl text-[var(--text-secondary)]">{unit}</span>}
    </div>
  );
}

export function Meter({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

export function AreaChart({ values, color = "var(--ok)" }: { values: readonly number[]; color?: string }) {
  const max = Math.max(...values, 1);
  const step = 100 / (values.length - 1);
  const points = values.map((value, i) => `${(i * step).toFixed(2)},${(38 - (value / max) * 34).toFixed(2)}`);
  const line = `M${points.join(" L")}`;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Load over the last 12 hours">
      <title>Load over the last 12 hours</title>
      {[10, 20, 30].map((y) => (
        <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="white" strokeOpacity="0.06" vectorEffect="non-scaling-stroke" />
      ))}
      <motion.path d={`${line} L100,40 L0,40 Z`} fill={color} fillOpacity="0.16" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
    </svg>
  );
}

export function HalfGauge({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  const arc = "M10 62 A50 50 0 0 1 110 62";
  return (
    <svg viewBox="0 0 120 70" className="w-full max-w-[260px]" role="img" aria-label={`${value} percent used`}>
      <title>{`${value} percent used`}</title>
      <path d={arc} fill="none" stroke="white" strokeOpacity="0.1" strokeWidth="10" strokeLinecap="round" />
      <motion.path
        d={arc}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: value / 100 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  );
}

export function DayBars({ days }: { days: readonly number[] }) {
  return (
    <div className="flex items-end gap-1.5">
      {days.map((active, i) => (
        <motion.span
          key={i}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.4, delay: i * 0.05 }}
          style={{ originY: 1 }}
          className={`h-8 flex-1 rounded-[5px] ${active ? "bg-[var(--warn)]" : "bg-white/12"}`}
        />
      ))}
    </div>
  );
}

export function ColumnChart({ items, highlight }: { items: readonly { label: string; value: number }[]; highlight?: number }) {
  return (
    <div className="flex h-full min-h-0 items-end gap-3">
      {items.map((item, i) => (
        <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
          <div className="flex min-h-0 w-full flex-1 items-end pt-6">
            <motion.div
              className={`relative w-full rounded-[10px] ${i === highlight ? "bg-[var(--accent)]" : "bg-white/15"}`}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(item.value, 2)}%` }}
              transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.05 }}
            >
              <span className="absolute inset-x-0 -top-5 text-center text-xs tabular-nums text-[var(--text-secondary)]">{item.value}%</span>
            </motion.div>
          </div>
          <span className="text-xs text-[var(--text-muted)]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
