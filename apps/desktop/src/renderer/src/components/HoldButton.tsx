import { useEffect, useRef, useState, type ReactNode } from "react";

interface HoldButtonProps {
  children: ReactNode;
  holdingLabel?: ReactNode;
  onConfirm: () => void;
  durationMs?: number;
  disabled?: boolean;
  className?: string;
}

export function HoldButton({ children, holdingLabel, onConfirm, durationMs = 1200, disabled = false, className = "" }: HoldButtonProps) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirm = useRef(onConfirm);

  useEffect(() => {
    confirm.current = onConfirm;
  }, [onConfirm]);

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  const start = () => {
    if (disabled || timer.current !== null) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      confirm.current();
    }, durationMs);
  };

  useEffect(() => cancel, []);

  useEffect(() => {
    if (disabled) cancel();
  }, [disabled]);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.button === 0) start();
      }}
      onPointerUp={cancel}
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
        if (event.key === " " || event.key === "Enter") cancel();
      }}
      className={`no-drag relative cursor-default select-none overflow-hidden rounded-full bg-[var(--down)]/85 px-4 py-2 text-white outline-none transition-[filter] duration-200 hover:brightness-110 focus-visible:shadow-[0_0_0_3px_oklch(0.68_0.2_20/0.45)] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-[var(--text-muted)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 origin-left bg-black/35"
        style={{ transform: holding ? "scaleX(1)" : "scaleX(0)", transition: holding ? `transform ${durationMs}ms linear` : "transform 250ms ease-out" }}
      />
      <span className="relative">{holding ? (holdingLabel ?? children) : children}</span>
    </button>
  );
}
