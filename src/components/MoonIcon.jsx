import { useId } from 'react'
import { illumination } from '../scene/phase'

/**
 * A crisp vector moon showing a given phase (0 = new, 0.5 = full).
 * Waxing moons are lit on the right, waning on the left — like the real sky.
 */
export default function MoonIcon({ phase = 0.27, size = 40, tint = '#f3eee6', glow = true, className = '' }) {
  const id = useId().replace(/:/g, '')
  const p = ((phase % 1) + 1) % 1
  const k = illumination(p)
  const r = size / 2 - 1
  const c = size / 2
  const rx = Math.max(0.01, r * Math.abs(1 - 2 * k))
  const sweep = k > 0.5 ? 1 : 0
  const lit = `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} A ${rx} ${r} 0 0 ${sweep} ${c} ${c - r} Z`
  const craters = [[0.62, 0.36, 0.09], [0.7, 0.62, 0.07], [0.45, 0.68, 0.06], [0.55, 0.5, 0.05], [0.33, 0.4, 0.07], [0.4, 0.25, 0.045]]
  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={glow ? { filter: `drop-shadow(0 0 ${size / 6}px ${tint}55)` } : undefined}>
      <defs>
        <radialGradient id={`g${id}`} cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="55%" stopColor={tint} />
          <stop offset="100%" stopColor="#8d877d" />
        </radialGradient>
        <clipPath id={`c${id}`}>
          <path d={lit} transform={p > 0.5 ? `translate(${size} 0) scale(-1 1)` : undefined} />
        </clipPath>
      </defs>
      <circle cx={c} cy={c} r={r} fill="#141519" stroke="rgba(255,255,255,.12)" strokeWidth=".6" />
      <g clipPath={`url(#c${id})`}>
        <circle cx={c} cy={c} r={r} fill={`url(#g${id})`} />
        {craters.map(([x, y, s], i) => (
          <circle key={i} cx={x * size} cy={y * size} r={s * size} fill="rgba(80,74,66,.32)" />
        ))}
      </g>
    </svg>
  )
}
