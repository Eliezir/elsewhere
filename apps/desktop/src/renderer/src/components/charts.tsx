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
