import { motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface HoldButtonProps {
  children: ReactNode;
  holdingLabel?: ReactNode;
  onConfirm: () => void;
  durationMs?: number;
  disabled?: boolean;
  className?: string;
  tone?: "neutral" | "danger";
}

const NUDGE_MS = 1400;

export function HoldButton({ children, holdingLabel, onConfirm, durationMs = 1200, disabled = false, className = "", tone = "neutral" }: HoldButtonProps) {
  const [holding, setHolding] = useState(false);
  const [nudge, setNudge] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirm = useRef(onConfirm);

  useEffect(() => {
    confirm.current = onConfirm;
  }, [onConfirm]);

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  const release = () => {
    const early = timer.current !== null;
    cancel();
    if (!early) return;
    setNudge(true);
    if (nudgeTimer.current !== null) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudge(false), NUDGE_MS);
  };

  const start = () => {
    if (disabled || timer.current !== null) return;
    setNudge(false);
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      confirm.current();
    }, durationMs);
  };

  useEffect(
    () => () => {
      cancel();
      if (nudgeTimer.current !== null) clearTimeout(nudgeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (disabled) cancel();
  }, [disabled]);

  const fill = tone === "danger" ? "bg-black/35" : "bg-[var(--accent)]/45";
  const track = tone === "danger" ? "bg-white/25" : "bg-[var(--accent)]/35";

  return (
    <button
      type="button"
      disabled={disabled}
      title="Press and hold"
      onPointerDown={(event) => {
        if (event.button === 0) start();
      }}
      onPointerUp={release}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onBlur={cancel}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") release();
      }}
      className={`no-drag relative cursor-default select-none overflow-hidden rounded-full px-4 py-2 outline-none transition-[background-color,filter] duration-200 focus-visible:shadow-[0_0_0_3px_oklch(0.62_0.24_285/0.45)] disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-[var(--text-muted)] ${tone === "danger" ? "bg-[var(--down)]/85 text-white hover:brightness-110" : "border border-[var(--hairline)] bg-white/5 text-[var(--text-primary)] hover:bg-white/10"} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-0 origin-left ${fill}`}
        style={{ transform: holding ? "scaleX(1)" : "scaleX(0)", transition: holding ? `transform ${durationMs}ms linear` : "transform 250ms ease-out" }}
      />
      <span aria-hidden="true" className={`absolute inset-x-3 bottom-[3px] h-[2px] rounded-full ${track}`} />
      <motion.span className="relative block" animate={nudge ? { x: [0, -5, 5, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.42, ease: "easeOut" }}>
        {nudge ? "Keep holding" : holding ? (holdingLabel ?? children) : children}
      </motion.span>
    </button>
  );
}
