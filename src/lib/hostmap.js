// Which repo is hosted where: Vercel, Netlify or GitHub Pages.
// Sources: your connected Hosting accounts (exact) + each repo's website address (hint).
import { useSyncExternalStore } from 'react'
import { getSecure, setSecure } from './store'
import { loadHostAccounts, listProjects } from './hosting'
import { siteUrl } from './util'

let links = {} // "owner/repo" (lowercase) → [{ provider, url, state, name }]
const subs = new Set()
const emit = () => subs.forEach((f) => f())

export function useHostLinks() {
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => links
  )
}

export async function loadHostLinks() {
  links = await getSecure('hostLinks', {})
  emit()
  return links
}

/** Ask every connected Vercel/Netlify account which repos it deploys. */
export async function refreshHostLinks() {
  const accounts = await loadHostAccounts()
  if (!accounts.length) return links
  const next = {}
  for (const acc of accounts) {
    for (const sc of acc.scopes || [{ id: '' }]) {
      const projects = await listProjects(acc, sc.id).catch(() => [])
      projects.forEach((p) => {
        if (!p.repo) return
        const k = p.repo.toLowerCase()
        ;(next[k] = next[k] || []).push({ provider: p.provider, url: p.url, state: p.state, name: p.name, account: acc.username })
      })
    }
  }
  links = next
  emit()
  await setSecure('hostLinks', next)
  return links
}

/** Merge exact links with what the repo's own website address tells us. */
export function hostsFor(repo, map = links) {
  const out = []
  const add = (provider, url, state, extra = {}) => !out.some((o) => o.provider === provider) && out.push({ provider, url, state, ...extra })
  ;(map[repo.full_name.toLowerCase()] || []).forEach((l) => add(l.provider, l.url, l.state, { account: l.account, name: l.name }))
  const hp = repo.homepage || ''
  if (/\.vercel\.app/i.test(hp)) add('vercel', hp)
  if (/\.netlify\.app/i.test(hp)) add('netlify', hp)
  if (repo.has_pages || /\.github\.io/i.test(hp)) add('pages', siteUrl(repo) || hp)
  return out
}

export const HOST_META = {
  vercel: { name: 'Vercel', color: '#f5f5f5' },
  netlify: { name: 'Netlify', color: '#32e6e2' },
  pages: { name: 'GitHub Pages', color: '#b4a2ff' },
}
