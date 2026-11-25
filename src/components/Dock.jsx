import { motion } from 'framer-motion'
import { Glass, spring } from './ui'
import MoonIcon from './MoonIcon'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { go } from '../lib/router'
import { resolvePhase } from '../scene/phase'
import { langColor } from '../lib/util'

const initials = (name) => name.split(/[-_.\s]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || name.slice(0, 2).toUpperCase()

/** Apply the user's dock order and hidden items (Customize can never be hidden). */
export function orderNav(nav, settings) {
  const order = settings.dockOrder || []
  const sorted = [...order.map((id) => nav.find((n) => n.id === id)).filter(Boolean), ...nav.filter((n) => !order.includes(n.id))]
  const hidden = settings.dockHidden || []
  return sorted.filter((n) => n.id === 'customize' || !hidden.includes(n.id))
}

export default function Dock({ nav, active, openAccounts }) {
  const { settings: s, userData } = useSettings()
  const { user, accounts, demo, repos } = useAuth()
  const items = orderNav(nav, s)
  const pins = s.dockPins ? userData.pins.map((full) => repos.find((r) => r.full_name === full)).filter(Boolean).slice(0, s.dockPinCount || 5) : []
  const iconSize = { sm: 18, md: 20, lg: 23 }[s.dockSize] || 20

  return (
    <Glass as="nav" className={`dock size-${s.dockSize || 'md'} ${s.dockLabels ? 'labels' : ''} ${s.dockCompact ? 'compact' : ''}`} aria-label="Main">
      {s.dockLogo !== false && (
        <button className="dock-logo" onClick={() => go('repos')} aria-label="RepoVerse home" data-tip="RepoVerse">
          <MoonIcon phase={resolvePhase(s)} size={{ sm: 32, md: 36, lg: 42 }[s.dockSize] || 36} tint={s.moonTint} />
        </button>
      )}
      {items.map((n, i) => (
        <button
          key={n.id}
          className={`dock-btn ${active === n.id ? 'active' : ''}`}
          onClick={() => go(n.id)}
          data-tip={s.dockLabels ? undefined : s.fShortcuts !== false ? `${n.label}  ·  Alt ${i + 1}` : n.label}
          aria-label={n.label}
          aria-current={active === n.id ? 'page' : undefined}
        >
          {active === n.id && <motion.span layoutId="dock-pill" className="dock-pill" transition={spring} />}
          <n.icon size={iconSize} />
          {s.dockLabels && <span className="dock-label">{n.short}</span>}
        </button>
      ))}
      {pins.length > 0 && <div className="dock-rule" />}
      {pins.map((r) => (
        <button key={r.id} className="dock-btn" onClick={() => go('repo', r.owner.login, r.name)} data-tip={r.name} aria-label={`Open ${r.name}`}>
          <span className="monogram dock-mono" style={{ '--accent': r.language ? langColor(r.language) : 'var(--c1)' }}>{initials(r.name)}</span>
          {s.dockLabels && <span className="dock-label">{r.name.slice(0, 8)}</span>}
        </button>
      ))}
      <div className="dock-sep" />
      {s.dockAccount !== false && (
        <button className="dock-btn" onClick={openAccounts} data-tip={demo ? 'Demo account' : `@${user.login}${accounts.length > 1 ? `  ·  ${accounts.length} accounts` : ''}`} aria-label="Accounts">
          <img className="avatar dock-avatar" src={user.avatar_url} alt="" />
          {accounts.length > 1 && <span className="acc-count">{accounts.length}</span>}
        </button>
      )}
    </Glass>
  )
}
