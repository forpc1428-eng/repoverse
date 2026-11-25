import { useSettings } from '../lib/settings'
import { HOST_META, hostsFor, useHostLinks } from '../lib/hostmap'

/** Brand-neutral glyphs: ▲ Vercel, ◆ Netlify, ◉ GitHub Pages. */
export function HostIcon({ provider, size = 12 }) {
  const c = HOST_META[provider]?.color || 'currentColor'
  if (provider === 'vercel') return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 23 21H1z" fill={c} /></svg>
  if (provider === 'netlify') return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 22 12 12 22 2 12z" fill="none" stroke={c} strokeWidth="2.6" /><circle cx="12" cy="12" r="2.6" fill={c} /></svg>
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke={c} strokeWidth="2.6" /><circle cx="12" cy="12" r="3.4" fill={c} /></svg>
}

const STATE_COLOR = { ready: '#34d399', building: '#fbbf24', error: '#f87171' }

/**
 * compact: tiny icons for cards/rows. full: labelled chips with live links (repo page).
 */
export default function HostBadges({ repo, compact = true }) {
  const { settings } = useSettings()
  const map = useHostLinks()
  if (settings.fHostBadges === false) return null
  const hosts = hostsFor(repo, map)
  if (!hosts.length) return null
  if (compact)
    return (
      <span className="host-icons" onClick={(e) => e.stopPropagation()}>
        {hosts.map((h) => (
          <a key={h.provider} href={h.url || undefined} target="_blank" rel="noopener noreferrer" className="host-icon" title={`${HOST_META[h.provider].name}${h.account ? ` · ${h.account}` : ''}${h.url ? ` · ${h.url.replace(/^https?:\/\//, '')}` : ''}`}>
            <HostIcon provider={h.provider} size={11} />
          </a>
        ))}
      </span>
    )
  return (
    <span className="row wrap" style={{ gap: 6 }}>
      {hosts.map((h) => (
        <a key={h.provider} className="tag host-chip" href={h.url || undefined} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <HostIcon provider={h.provider} size={11} />
          {HOST_META[h.provider].name}
          {h.state && STATE_COLOR[h.state] && <span className="status-dot" style={{ width: 6, height: 6, background: STATE_COLOR[h.state], boxShadow: `0 0 6px ${STATE_COLOR[h.state]}` }} />}
          {h.account && <span className="faint">· {h.account}</span>}
        </a>
      ))}
    </span>
  )
}
