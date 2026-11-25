// Real lunar phase from a date (accurate to a few hours, plenty for visuals).
const SYNODIC = 29.530588853
const REF_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)

/** Moon age in days since new moon (0 … 29.53). */
export function moonAge(date = new Date()) {
  const days = (date.getTime() - REF_NEW_MOON) / 86400000
  return ((days % SYNODIC) + SYNODIC) % SYNODIC
}

/** Phase angle 0 … 1 (0 = new, 0.5 = full). */
export const phaseFromDate = (date) => moonAge(date) / SYNODIC

export const illumination = (phase) => (1 - Math.cos(phase * 2 * Math.PI)) / 2

export function phaseName(phase) {
  const p = ((phase % 1) + 1) % 1
  if (p < 0.03 || p > 0.97) return 'New moon'
  if (p < 0.22) return 'Waxing crescent'
  if (p < 0.28) return 'First quarter'
  if (p < 0.47) return 'Waxing gibbous'
  if (p < 0.53) return 'Full moon'
  if (p < 0.72) return 'Waning gibbous'
  if (p < 0.78) return 'Last quarter'
  return 'Waning crescent'
}

/** Resolve the phase a settings object asks for. */
export function resolvePhase(s) {
  if (s.moonPhaseMode === 'today') return phaseFromDate(new Date())
  if (s.moonPhaseMode === 'date') {
    const d = new Date((s.moonDate || '2008-02-14') + 'T20:00:00Z')
    return isNaN(d) ? phaseFromDate(new Date()) : phaseFromDate(d)
  }
  return s.moonPhase ?? 0.27
}
