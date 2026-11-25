import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LayoutGrid, MonitorPlay, FolderUp, BarChart3, SlidersHorizontal, RefreshCw, Search, BookMarked, Command, ArrowLeft, Gauge, Inbox as InboxIcon, Cloud, Wrench, MoreHorizontal,
} from 'lucide-react'
import Background from './components/Background'
import { Glass, Modal, Spinner, spring, useToast } from './components/ui'
import { useAuth } from './lib/auth'
import { useIsMobile, useSettings } from './lib/settings'
import { go, useRoute } from './lib/router'
import { onRateLimit, setSmartCache } from './lib/github'
import { recordSnapshot } from './lib/growth'
import Login from './views/Login'
import Repos from './views/Repos'
import RepoDetail from './views/RepoDetail'
import Wall from './views/Wall'
import Push from './views/Push'
import Insights from './views/Insights'
import Customize from './views/Customize'
import Inbox from './views/Inbox'
import Hosting from './views/Hosting'
import Tools from './views/Tools'
import AccountMenu from './components/AccountMenu'
import Credit from './components/Credit'
import Dock, { orderNav } from './components/Dock'
import Intro from './components/Intro'
import { loadHostLinks, refreshHostLinks } from './lib/hostmap'

export const NAV = [
  { id: 'repos', label: 'Repositories', short: 'Repos', icon: LayoutGrid, sub: 'Everything you own on GitHub' },
  { id: 'inbox', label: 'Inbox', short: 'Inbox', icon: InboxIcon, sub: 'Notifications, reviews and new stars' },
  { id: 'wall', label: 'Preview Wall', short: 'Sites', icon: MonitorPlay, sub: 'Every live site, side by side' },
  { id: 'hosting', label: 'Hosting', short: 'Hosting', icon: Cloud, sub: 'Your Vercel and Netlify projects' },
  { id: 'push', label: 'Push Folder', short: 'Push', icon: FolderUp, sub: 'From your disk to GitHub in one step' },
  { id: 'tools', label: 'Tools', short: 'Tools', icon: Wrench, sub: 'Portfolio, profile, templates, sweep' },
  { id: 'insights', label: 'Insights', short: 'Insights', icon: BarChart3, sub: 'Activity, languages, health and growth' },
  { id: 'customize', label: 'Customize', short: 'Style', icon: SlidersHorizontal, sub: 'Your moon, your sky, your space' },
]

export default function App() {
  const { status, error, setError } = useAuth()
  const { toast } = useToast()
  useEffect(() => {
    if (error && status === 'in') {
      toast(error, 'error')
      setError('')
    }
  }, [error, status, toast, setError])

  return (
    <>
      <Background />
      <Intro />
      {status === 'loading' ? (
        <div className="login-wrap" style={{ justifyContent: 'center' }}><Spinner size={30} /></div>
      ) : status === 'out' ? (
        <Login />
      ) : (
        <Shell />
      )}
    </>
  )
}

const FEATURE_OF = { wall: 'fWall', push: 'fPush', insights: 'fInsights', inbox: 'fInbox', tools: 'fTools', hosting: 'fHosting' }
export function useNav() {
  const { settings } = useSettings()
  return NAV.filter((n) => !FEATURE_OF[n.id] || settings[FEATURE_OF[n.id]] !== false)
}

function usePage() {
  const route = useRoute()
  const nav = useNav()
  const page = nav.some((n) => n.id === route.page) || route.page === 'repo' ? route.page : 'repos'
  return { route, page, active: page === 'repo' ? 'repos' : page, nav }
}

function useShortcuts(setPalette) {
  const { settings } = useSettings()
  const nav = orderNav(useNav(), settings)
  useEffect(() => {
    const onKey = (e) => {
      if (settings.fPalette !== false && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
      if (settings.fShortcuts !== false && e.altKey && /^[1-9]$/.test(e.key) && nav[+e.key - 1]) {
        e.preventDefault()
        go(nav[+e.key - 1].id)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [setPalette, settings.fPalette, settings.fShortcuts, nav])
}

/** Background services: auto-refresh, smart cache switch, daily growth snapshot. */
function useServices() {
  const { settings } = useSettings()
  const { refreshRepos, repos, user, demo } = useAuth()
  useEffect(() => {
    const min = settings.autoRefresh
    if (!min) return
    const t = setInterval(() => !document.hidden && refreshRepos().catch(() => {}), min * 60000)
    return () => clearInterval(t)
  }, [settings.autoRefresh, refreshRepos])
  useEffect(() => setSmartCache(settings.fSmartCache !== false), [settings.fSmartCache])
  // where each repo is hosted (Vercel / Netlify / Pages)
  useEffect(() => {
    if (settings.fHostBadges === false) return
    loadHostLinks().then(() => refreshHostLinks()).catch(() => {})
  }, [settings.fHostBadges])
  useEffect(() => {
    if (!demo && settings.fGrowth !== false && repos.length) recordSnapshot(user.login, repos).catch(() => {})
  }, [repos, user?.login, demo, settings.fGrowth])
}

function Shell() {
  const mobile = useIsMobile()
  const [palette, setPalette] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)
  useShortcuts(setPalette)
  useServices()
  const props = { openPalette: () => setPalette(true), openAccounts: () => setAccountsOpen(true) }
  return (
    <>
      {mobile ? <MobileShell {...props} /> : <DesktopShell {...props} />}
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <AccountMenu open={accountsOpen} onClose={() => setAccountsOpen(false)} />
    </>
  )
}

function PageBody({ route, page, mobile }) {
  return (
    <>
      {page === 'repos' && <Repos mobile={mobile} />}
      {page === 'repo' && <RepoDetail owner={route.params[0]} name={route.params[1]} tab={route.params[2] || 'overview'} path={route.params.slice(3).join('/')} />}
      {page === 'inbox' && <Inbox />}
      {page === 'wall' && <Wall />}
      {page === 'hosting' && <Hosting />}
      {page === 'push' && <Push />}
      {page === 'tools' && <Tools />}
      {page === 'insights' && <Insights />}
      {page === 'customize' && <Customize />}
    </>
  )
}

const refreshWith = (refreshRepos, toast) => () => refreshRepos().then(() => toast('Synced with GitHub', 'success')).catch((e) => toast(e.message, 'error'))

// ======================================================================= desktop
function DesktopShell({ openPalette, openAccounts }) {
  const { route, page, active, nav: NAVS } = usePage()
  const { refreshRepos, reposLoading, demo } = useAuth()
  const { settings } = useSettings()
  const { toast } = useToast()
  const [rate, setRate] = useState(null)
  useEffect(() => onRateLimit(setRate), [])
  const nav = NAVS.find((n) => n.id === active) || NAV[0]
  const actions = (
    <HeadActions
      openPalette={settings.fPalette !== false ? openPalette : null}
      rate={settings.fRateBadge !== false ? rate : null}
      reposLoading={reposLoading}
      onRefresh={refreshWith(refreshRepos, toast)}
    />
  )

  return (
    <div className="app">
      <Dock nav={NAVS} active={active} openAccounts={openAccounts} />
      <main className="main" id="main">
        <div className="page" key={page + (route.params[0] || '') + (route.params[1] || '')}>
          {page === 'repos' ? (
            <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
              {demo && <span className="tag" style={{ color: 'var(--c3)' }}>Demo mode</span>}
              {actions}
            </div>
          ) : (
            <header className="page-head" style={{ animation: 'rise .5s var(--ease) both' }}>
              <div className="titles">
                {page === 'repo' ? (
                  <button className="btn ghost sm" style={{ marginLeft: -10 }} onClick={() => go('repos')}><ArrowLeft size={15} /> All repositories</button>
                ) : (
                  <div className="eyebrow">{nav.sub}</div>
                )}
                <h1>{page === 'repo' ? route.params[1] : nav.label}</h1>
              </div>
              {actions}
            </header>
          )}
          <PageBody route={route} page={page} />
        </div>
      </main>
      <Credit />
    </div>
  )
}

function HeadActions({ openPalette, rate, reposLoading, onRefresh }) {
  return (
    <div className="head-actions">
      {openPalette && (
        <button className="glass pill-search" onClick={openPalette}>
          <Search size={16} /> <span className="grow" style={{ textAlign: 'left' }}>Jump to…</span> <span className="kbd">Ctrl K</span>
        </button>
      )}
      {rate?.remaining != null && (
        <span className="tag" title={`GitHub API calls left this hour (resets ${new Date(rate.reset * 1000).toLocaleTimeString()})`}>
          <Gauge size={12} /> {rate.remaining.toLocaleString()}
        </span>
      )}
      <button className="glass btn icon" title="Refresh from GitHub" aria-label="Refresh" onClick={onRefresh}>
        {reposLoading ? <Spinner /> : <RefreshCw size={17} />}
      </button>
    </div>
  )
}

// ======================================================================= mobile
function MobileShell({ openPalette, openAccounts }) {
  const { route, page, active, nav: NAVS } = usePage()
  const { user, refreshRepos, reposLoading, accounts } = useAuth()
  const { settings } = useSettings()
  const { toast } = useToast()
  const [more, setMore] = useState(false)
  const nav = NAVS.find((n) => n.id === active) || NAV[0]
  // phones show 4 tabs + "More" when there are more than 5 pages
  const ordered = orderNav(NAVS, settings)
  const tabs = ordered.length > 5 ? ordered.slice(0, 4) : ordered
  const rest = ordered.length > 5 ? ordered.slice(4) : []
  const restActive = rest.some((n) => n.id === active)

  return (
    <div className="m-app">
      <header className="m-head">
        {page === 'repo' && <button className="glass btn icon" onClick={() => go('repos')} aria-label="Back"><ArrowLeft size={18} /></button>}
        <h1>{page === 'repo' ? route.params[1] : page === 'repos' ? 'RepoVerse' : nav.label}</h1>
        {settings.fPalette !== false && <button className="glass btn icon" onClick={openPalette} aria-label="Search"><Search size={18} /></button>}
        {page === 'repos' && (
          <button className="glass btn icon" onClick={refreshWith(refreshRepos, toast)} aria-label="Refresh">
            {reposLoading ? <Spinner /> : <RefreshCw size={17} />}
          </button>
        )}
        <button className="btn ghost icon" onClick={openAccounts} aria-label="Accounts" style={{ position: 'relative' }}>
          <img className="avatar" src={user.avatar_url} alt="" />
          {accounts.length > 1 && <span className="acc-count">{accounts.length}</span>}
        </button>
      </header>
      <main className="m-main" key={page + (route.params[1] || '')}>
        <PageBody route={route} page={page} mobile />
        <Credit inline />
      </main>
      <Glass as="nav" className="m-tabs" aria-label="Main">
        {tabs.map((n) => (
          <button key={n.id} className={`m-tab ${active === n.id ? 'on' : ''}`} onClick={() => go(n.id)} aria-label={n.label}>
            {active === n.id && <motion.span layoutId="m-pill" className="dock-pill" transition={spring} />}
            <n.icon size={21} />
            {n.short}
          </button>
        ))}
        {rest.length > 0 && (
          <button className={`m-tab ${restActive ? 'on' : ''}`} onClick={() => setMore(true)} aria-label="More pages">
            {restActive && <motion.span layoutId="m-pill" className="dock-pill" transition={spring} />}
            <MoreHorizontal size={21} />
            More
          </button>
        )}
      </Glass>
      <Modal open={more} onClose={() => setMore(false)}>
        <h2>More</h2>
        <div className="more-grid">
          {rest.map((n) => (
            <button key={n.id} className={active === n.id ? 'on' : ''} onClick={() => (go(n.id), setMore(false))}>
              <n.icon size={22} />
              {n.short}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

// ======================================================================= palette
function CommandPalette({ open, onClose }) {
  const { repos } = useAuth()
  const nav = useNav()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
    }
  }, [open])
  const items = useMemo(() => {
    const pages = nav.map((n) => ({ key: 'p' + n.id, label: n.label, icon: n.icon, hint: 'Page', run: () => go(n.id) }))
    const rs = repos.map((r) => ({ key: r.full_name, label: r.full_name, icon: BookMarked, hint: r.private ? 'Private' : 'Repo', run: () => go('repo', r.owner.login, r.name) }))
    const t = q.toLowerCase().trim()
    const all = [...pages, ...rs]
    return (t ? all.filter((i) => i.label.toLowerCase().includes(t)) : all).slice(0, 40)
  }, [q, repos, nav])
  const run = (i) => {
    i?.run()
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} className="palette">
      <input
        className="input"
        autoFocus
        placeholder="Search pages and repositories…"
        value={q}
        onChange={(e) => (setQ(e.target.value), setSel(0))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(items.length - 1, s + 1)))
          if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)))
          if (e.key === 'Enter') run(items[sel])
        }}
      />
      <div className="palette-list">
        {items.map((i, idx) => (
          <div key={i.key} className={`palette-item ${idx === sel ? 'on' : ''}`} onMouseEnter={() => setSel(idx)} onClick={() => run(i)}>
            <i.icon size={17} />
            <span className="grow">{i.label}</span>
            <span className="faint" style={{ fontSize: 12 }}>{i.hint}</span>
          </div>
        ))}
        {!items.length && <div className="empty" style={{ padding: 30 }}><Command size={22} /><div>No matches</div></div>}
      </div>
    </Modal>
  )
}
