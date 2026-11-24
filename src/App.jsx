import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LayoutGrid, MonitorPlay, FolderUp, BarChart3, Palette, RefreshCw, Search, PanelLeftClose, PanelLeftOpen, LogOut, Gauge, BookMarked, Command,
} from 'lucide-react'
import Background from './components/Background'
import { Glass, Modal, Spinner, pageMotion, spring, useSpecularLight, useToast } from './components/ui'
import { useAuth } from './lib/auth'
import { useSettings } from './lib/settings'
import { go, useRoute } from './lib/router'
import { onRateLimit } from './lib/github'
import Login from './views/Login'
import Repos from './views/Repos'
import RepoDetail from './views/RepoDetail'
import Wall from './views/Wall'
import Push from './views/Push'
import Insights from './views/Insights'
import Customize from './views/Customize'

const NAV = [
  { id: 'repos', label: 'Repositories', icon: LayoutGrid, sub: 'Everything you own on GitHub' },
  { id: 'wall', label: 'Preview Wall', icon: MonitorPlay, sub: 'Every live site, side by side' },
  { id: 'push', label: 'Push Folder', icon: FolderUp, sub: 'From your disk to GitHub in one step' },
  { id: 'insights', label: 'Insights', icon: BarChart3, sub: 'Activity, languages and health' },
  { id: 'customize', label: 'Customize', icon: Palette, sub: 'Make it yours' },
]

export default function App() {
  useSpecularLight()
  const { status, user, refreshRepos, reposLoading, logout, error, setError } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (error && status === 'in') {
      toast(error, 'error')
      setError('')
    }
  }, [error, status, toast, setError])

  if (status === 'loading')
    return (
      <>
        <Background />
        <div className="login-wrap"><Spinner size={30} /></div>
      </>
    )
  if (status === 'out')
    return (
      <>
        <Background />
        <Login />
      </>
    )
  return <Shell user={user} refreshRepos={refreshRepos} reposLoading={reposLoading} logout={logout} />
}

function Shell({ user, refreshRepos, reposLoading, logout }) {
  const route = useRoute()
  const { settings, update } = useSettings()
  const { toast, confirm } = useToast()
  const [palette, setPalette] = useState(false)
  const [rate, setRate] = useState(null)
  useEffect(() => onRateLimit(setRate), [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
      // Alt + 1…5 jumps between pages
      if (e.altKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault()
        go(NAV[+e.key - 1].id)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const page = NAV.some((n) => n.id === route.page) || route.page === 'repo' ? route.page : 'repos'
  const active = page === 'repo' ? 'repos' : page
  const title = page === 'repo' ? route.params[1] : NAV.find((n) => n.id === page)?.label
  const subtitle = page === 'repo' ? `${route.params[0]} / repository` : NAV.find((n) => n.id === page)?.sub
  const collapsed = settings.railCollapsed

  const { demo } = useAuth()
  const doLogout = async () => {
    if (demo) return logout(false)
    const wipe = await confirm({
      title: 'Sign out',
      body: 'Sign out of RepoVerse on this browser?\n\n"Sign out & erase" also deletes your themes, tags, folders and the encryption key from this device.',
      okLabel: 'Sign out & erase everything',
      danger: true,
    })
    if (wipe) logout(true)
  }

  return (
    <>
      <Background />
      <div className="app">
        <Glass as="nav" className={`rail ${collapsed ? 'collapsed' : ''}`} liquid lit={false}>
          <div className="brand">
            <div className="brand-mark" />
            <span className="brand-name">RepoVerse</span>
          </div>
          {NAV.map((n, i) => (
            <div key={n.id} style={{ display: 'contents' }}>
              {i === 0 && <div className="rail-section">Workspace</div>}
              {i === 3 && <div className="rail-section">You</div>}
              <button className={`nav-btn ${active === n.id ? 'active' : ''}`} onClick={() => go(n.id)} title={`${n.label} (Alt+${i + 1})`}>
                {active === n.id && <motion.span layoutId="nav-pill" className="nav-pill" transition={spring} />}
                <n.icon size={19} />
                <span className="nav-label">{n.label}</span>
                <span className="nav-kbd">Alt {i + 1}</span>
              </button>
            </div>
          ))}
          <div className="rail-spacer" />
          <button className="nav-btn rail-collapse" onClick={() => update({ railCollapsed: !collapsed })} title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            <span className="nav-label">Collapse</span>
          </button>
          <div className="rail-foot">
            <span className="avatar-wrap"><img className="avatar" src={user.avatar_url} alt="" /></span>
            <div className="grow rail-foot-text" style={{ lineHeight: 1.25 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || user.login}</div>
              <div className="faint" style={{ fontSize: 12 }}>@{user.login}</div>
            </div>
            <button className="btn ghost sm icon rail-foot-text" onClick={doLogout} title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </Glass>

        <main className="main">
          <Glass className="topbar" lit={false}>
            <div className="crumb">
              <small>{subtitle}</small>
              <h1>{title}</h1>
            </div>
            {demo && <span className="tag" style={{ borderColor: 'var(--c2)', color: 'var(--c2)' }}>Demo mode</span>}
            <div className="grow" />
            <button className="btn jump" onClick={() => setPalette(true)}>
              <Search size={16} /> <span className="grow jump-text" style={{ textAlign: 'left' }}>Jump to…</span> <span className="kbd">Ctrl K</span>
            </button>
            {rate?.remaining != null && (
              <span className="tag" title={`GitHub API calls left this hour. Resets ${new Date(rate.reset * 1000).toLocaleTimeString()}`}>
                <Gauge size={12} /> {rate.remaining.toLocaleString()}/{rate.limit?.toLocaleString()}
              </span>
            )}
            <button
              className="btn icon"
              title="Refresh from GitHub"
              onClick={() => refreshRepos().then(() => toast('Synced with GitHub', 'success')).catch((e) => toast(e.message, 'error'))}
            >
              {reposLoading ? <Spinner /> : <RefreshCw size={17} />}
            </button>
          </Glass>
          <div className="content">
            <motion.div key={page + (route.params[0] || '') + (route.params[1] || '')} {...pageMotion}>
                {page === 'repos' && <Repos />}
                {page === 'repo' && <RepoDetail owner={route.params[0]} name={route.params[1]} tab={route.params[2] || 'overview'} path={route.params.slice(3).join('/')} />}
                {page === 'wall' && <Wall />}
                {page === 'push' && <Push />}
                {page === 'insights' && <Insights />}
                {page === 'customize' && <Customize />}
            </motion.div>
          </div>
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </>
  )
}

function CommandPalette({ open, onClose }) {
  const { repos } = useAuth()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
    }
  }, [open])
  const items = useMemo(() => {
    const pages = NAV.map((n) => ({ key: 'p' + n.id, label: n.label, icon: n.icon, hint: 'Page', run: () => go(n.id) }))
    const rs = repos.map((r) => ({ key: r.full_name, label: r.full_name, icon: BookMarked, hint: r.private ? 'Private' : 'Repo', run: () => go('repo', r.owner.login, r.name) }))
    const all = [...pages, ...rs]
    const t = q.toLowerCase().trim()
    return (t ? all.filter((i) => i.label.toLowerCase().includes(t)) : all).slice(0, 40)
  }, [q, repos])
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
        onChange={(e) => {
          setQ(e.target.value)
          setSel(0)
        }}
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
