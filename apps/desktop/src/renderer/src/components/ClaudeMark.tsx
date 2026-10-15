const RAYS = [
  { angle: 0, length: 9 },
  { angle: 28, length: 7 },
  { angle: 58, length: 9 },
  { angle: 90, length: 7.5 },
  { angle: 118, length: 9 },
  { angle: 150, length: 7 },
  { angle: 180, length: 9 },
  { angle: 208, length: 7.5 },
  { angle: 238, length: 9 },
  { angle: 270, length: 7 },
  { angle: 298, length: 9 },
  { angle: 330, length: 7.5 },
] as const;

export function ClaudeMark({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="-10 -10 20 20" width={size} height={size} aria-hidden="true" className={`shrink-0 ${className}`}>
      {RAYS.map(({ angle, length }) => (
        <line
          key={angle}
          x1="0"
          y1="0"
          x2={Math.cos((angle * Math.PI) / 180) * length}
          y2={Math.sin((angle * Math.PI) / 180) * length}
          stroke="#d97757"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
