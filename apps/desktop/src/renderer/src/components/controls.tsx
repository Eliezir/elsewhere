import { Input } from "@base-ui/react/input";
import { Slider } from "@base-ui/react/slider";
import { Switch } from "@base-ui/react/switch";
import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

interface SegmentedProps<T extends string> {
  id: string;
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ id, label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="no-drag flex gap-0.5 rounded-full border border-[var(--hairline)] bg-[var(--inset)] p-0.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`relative cursor-default rounded-full px-3 py-1 text-[11px] outline-none transition-colors duration-200 ${selected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {selected && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-[var(--accent)]/35"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleRow({ label, hint, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div>{label}</div>
        {hint && <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{hint}</div>}
      </div>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={label}
        className="relative flex h-6 w-[42px] shrink-0 items-center cursor-default rounded-full bg-white/10 shadow-[inset_0_0_0_1px_oklch(1_0_0/0.12)] outline-none transition-[background-color,box-shadow] duration-300 focus-visible:shadow-[0_0_0_3px_oklch(0.62_0.24_285/0.45)] data-[checked]:bg-[var(--accent)] data-[checked]:shadow-[inset_0_0_0_1px_oklch(1_0_0/0.28),inset_0_-6px_10px_oklch(0.4_0.25_285/0.5)] data-[disabled]:opacity-40"
      >
        <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_oklch(0_0_0/0.45)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] data-[checked]:translate-x-[20px]" />
      </Switch.Root>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function SliderRow({ label, hint, value, min = 0, max = 100, unit = "%", onChange }: SliderRowProps) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--text-secondary)]">
          {value}
          {unit}
        </span>
      </div>
      {hint && <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{hint}</div>}
      <Slider.Root
        value={value}
        min={min}
        max={max}
        onValueChange={(next) => onChange(Array.isArray(next) ? (next[0] ?? value) : next)}
        aria-label={label}
        className="mt-2.5"
      >
        <Slider.Control className="flex h-5 w-full items-center">
          <Slider.Track className="h-1.5 w-full rounded-full bg-white/10">
            <Slider.Indicator className="rounded-full bg-[var(--accent)]" />
            <Slider.Thumb className="size-[18px] rounded-full bg-white shadow-[0_1px_3px_oklch(0_0_0/0.45)] outline-none transition-shadow duration-200 hover:shadow-[0_0_0_5px_oklch(0.62_0.24_285/0.25)] focus-visible:shadow-[0_0_0_5px_oklch(0.62_0.24_285/0.4)]" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}

export const FIELD =
  "w-full rounded-2xl border border-[var(--hairline)] bg-[var(--inset)] px-3.5 py-2.5 caret-[var(--accent)] outline-none transition-[border-color,box-shadow] duration-200 hover:border-[oklch(0.82_0.12_295/0.28)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_oklch(0.62_0.24_285/0.28)]";

export function TextField({ label, className = "", ...props }: { label: string } & ComponentProps<typeof Input>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--text-secondary)]">{label}</span>
      <Input
        {...props}
        className={`${FIELD} placeholder:text-[var(--text-muted)] ${className}`}
      />
    </label>
  );
}

export function SelectField({ label, children, ...props }: { label: string } & ComponentProps<"select">) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--text-secondary)]">{label}</span>
      <span className="relative block">
        <select {...props} className={`${FIELD} cursor-default appearance-none pr-9`}>
          {children}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
          ⌄
        </span>
      </span>
    </label>
  );
}

export function Button({
  children,
  variant = "ghost",
  className = "",
  ...props
}: { children: ReactNode; variant?: "primary" | "ghost" | "danger" } & ComponentProps<"button">) {
  const style =
    variant === "primary"
      ? "bg-[var(--accent)] text-white hover:brightness-110 disabled:bg-white/10 disabled:text-[var(--text-muted)]"
      : variant === "danger"
        ? "bg-[var(--down)]/85 text-white hover:brightness-110 disabled:bg-white/10 disabled:text-[var(--text-muted)]"
        : "border border-[var(--hairline)] bg-white/5 hover:bg-white/10 disabled:text-[var(--text-muted)]";
  return (
    <button
      type="button"
      {...props}
      className={`no-drag cursor-default rounded-full px-4 py-2 outline-none transition-[background-color,filter] duration-200 disabled:cursor-not-allowed ${style} ${className}`}
    >
      {children}
    </button>
  );
}
