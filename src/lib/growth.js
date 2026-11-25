// Growth history: one small snapshot per day, stored encrypted on this device.
// GitHub itself only keeps 14 days of traffic — this keeps up to a year of stars.
import { getSecure, setSecure } from './store'

const key = (login) => `growth:${login}`
const today = () => new Date().toISOString().slice(0, 10)

export async function recordSnapshot(login, repos) {
  if (!login || !repos.length) return
  const hist = await getSecure(key(login), [])
  const snap = {
    date: today(),
    stars: repos.reduce((n, r) => n + (r.stargazers_count || 0), 0),
    forks: repos.reduce((n, r) => n + (r.forks_count || 0), 0),
    repos: repos.length,
    perRepo: Object.fromEntries(repos.filter((r) => r.stargazers_count > 0).map((r) => [r.full_name, r.stargazers_count])),
  }
  const next = [...hist.filter((h) => h.date !== snap.date), snap].slice(-365)
  await setSecure(key(login), next)
  return next
}

export const loadGrowth = (login) => getSecure(key(login), [])

/** Stars gained since the previous visit, per repo. */
export async function starGains(login, repos) {
  const prev = await getSecure(`starsSeen:${login}`, null)
  const now = Object.fromEntries(repos.map((r) => [r.full_name, r.stargazers_count]))
  const gains = prev
    ? repos.map((r) => ({ repo: r, gained: (now[r.full_name] || 0) - (prev[r.full_name] ?? now[r.full_name]) })).filter((g) => g.gained > 0)
    : []
  return { gains, markSeen: () => setSecure(`starsSeen:${login}`, now) }
}
