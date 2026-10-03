/** Circular gauge; `value / max` fills the ring (capped at full). */
export function Gauge({ value, max, color, size = 88 }: { value: number; max: number; color: string; size?: number }) {
  const r = 34, c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--panel-2)" strokeWidth="8" />
      <circle
        cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.2,0.8,0.2,1)', filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  )
}
