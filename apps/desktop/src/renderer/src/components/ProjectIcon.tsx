const SIZES = {
  sm: "size-6 rounded-md text-[11px]",
  md: "size-9 rounded-[10px] text-sm",
  lg: "size-12 rounded-[14px] text-xl",
} as const;

export function hueFor(name: string): number {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return hash;
}

export function ProjectIcon({ repo, icon, size = "md" }: { repo: string; icon: string | null | undefined; size?: keyof typeof SIZES }) {
  if (icon) {
    return <img src={icon} alt="" draggable={false} className={`${SIZES[size]} shrink-0 bg-white/5 object-contain p-[3px]`} />;
  }
  const hue = hueFor(repo);
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} flex shrink-0 items-center justify-center font-medium uppercase`}
      style={{ background: `oklch(0.34 0.1 ${hue})`, color: `oklch(0.88 0.08 ${hue})` }}
    >
      {repo.charAt(0)}
    </span>
  );
}
