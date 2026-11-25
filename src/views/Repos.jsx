import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Search, Star, GitFork, Lock, Globe, LayoutGrid, List, Columns3, CalendarClock, Pin, PinOff, CheckSquare, Tag, Archive, ArchiveRestore,
  Eye, EyeOff, X, Plus, Code2, ExternalLink, FolderPlus, Trash2, BookMarked, FolderUp, MonitorPlay, Moon, Copy, Wand2,
} from 'lucide-react'
import { Glass, Modal, Ring, Seg, Spinner, TiltCard, useToast } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { go } from '../lib/router'
import { fmt, health, healthColor, langColor, siteUrl, timeAgo } from '../lib/util'
import { autoDetails } from '../lib/auto'
import { createClient } from '../lib/github'
import HostBadges from '../components/HostBadges'
import { hostsFor, useHostLinks } from '../lib/hostmap'

const FILTERS = [
  ['all', 'All'], ['pinned', 'Pinned'], ['public', 'Public'], ['private', 'Private'], ['sites', 'Has site'], ['vercel', 'Vercel'], ['netlify', 'Netlify'], ['forks', 'Forks'], ['archived', 'Archived'],
]
const SORTS = [['pushed', 'Last pushed'], ['updated', 'Last updated'], ['created', 'Newest'], ['stars', 'Most stars'], ['name', 'Name'], ['health', 'Health']]

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function Hero({ repos, mobile }) {
  const { user } = useAuth()
  const { settings: S } = useSettings()
  const first = (user.name || user.login).split(' ')[0]
  const stars = repos.reduce((n, r) => n + r.stargazers_count, 0)
  const sites = repos.filter((r) => siteUrl(r)).length
  const recent = repos.filter((r) => Date.now() - new Date(r.pushed_at) < 7 * 86400000).length
  if (mobile)
    return (
      <div className="m-hero">
        <div className="eyebrow"><Moon size={12} /> {greeting()}</div>
        <h2>{first}</h2>
        <p>{repos.length} repos · {fmt(stars)} stars · {sites} live</p>
      </div>
    )
  return (
    <section className="hero">
      <div className="eyebrow"><Moon size={13} /> {greeting()}</div>
      <h1>Hello, <span className="grad-text">{first}</span>.</h1>
      <p>{recent ? `You pushed to ${recent} ${recent === 1 ? 'repo' : 'repos'} this week. ` : ''}Your whole GitHub, under one moon.</p>
      {S.fHeroStats !== false && <div className="hero-stats">
        <span className="hero-stat"><BookMarked size={13} /><b>{repos.length}</b> repos</span>
        <span className="hero-stat"><Star size={13} /><b>{fmt(stars)}</b> stars</span>
        <span className="hero-stat"><Globe size={13} /><b>{sites}</b> live sites</span>
      </div>}
      {S.fHeroActions !== false && <div className="hero-actions">
        <button className="btn primary" onClick={() => go('push')}><FolderUp size={16} /> Push a folder</button>
        <button className="glass btn" onClick={() => go('wall')}><MonitorPlay size={16} /> Preview wall</button>
      </div>}
    </section>
  )
}

export default function Repos({ mobile }) {
  const { repos, reposLoading, gh, patchRepo, accounts, switchAccount, user: me } = useAuth()
  const { settings, update, userData, setUserData } = useSettings()
  const { toast, confirm } = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [lang, setLang] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [codeSearch, setCodeSearch] = useState(false)
  const [tagEditor, setTagEditor] = useState(null)
  const [bulkBusy, setBulkBusy] = useState('')

  // "All accounts in one view": also list repos from your other signed-in accounts
  const [others, setOthers] = useState([])
  useEffect(() => {
    if (settings.fMergeAccounts !== true || accounts.length < 2) return setOthers([])
    let alive = true
    Promise.all(accounts.filter((a) => a.login !== me.login).map((a) => createClient(a.token).repos().then((rs) => rs.map((r) => ({ ...r, _acct: a.login }))).catch(() => [])))
      .then((lists) => alive && setOthers(lists.flat()))
    return () => {
      alive = false
    }
  }, [settings.fMergeAccounts, accounts, me.login])
  const hostMap = useHostLinks()
  const allRepos = useMemo(() => {
    const seen = new Set(repos.map((r) => r.id))
    return [...repos, ...others.filter((r) => !seen.has(r.id))]
  }, [repos, others])

  const langs = useMemo(() => [...new Set(repos.map((r) => r.language).filter(Boolean))].sort(), [repos])
  const allTags = useMemo(() => [...new Set(Object.values(userData.tags).flat())].sort(), [userData.tags])

  const list = useMemo(() => {
    const t = q.toLowerCase().trim()
    let l = allRepos.filter((r) => {
      if (filter === 'pinned' && !userData.pins.includes(r.full_name)) return false
      if (filter === 'public' && r.private) return false
      if (filter === 'private' && !r.private) return false
      if (filter === 'sites' && !siteUrl(r)) return false
      if ((filter === 'vercel' || filter === 'netlify') && !hostsFor(r, hostMap).some((h) => h.provider === filter)) return false
      if (filter === 'forks' && !r.fork) return false
      if (settings.fForks === false && r.fork && filter !== 'forks') return false
      if (filter === 'archived' ? !r.archived : filter !== 'all' && filter !== 'pinned' && r.archived) return false
      if (lang && r.language !== lang) return false
      if (tagFilter && !(userData.tags[r.full_name] || []).includes(tagFilter)) return false
      if (t) {
        const hay = `${r.name} ${r.description || ''} ${(r.topics || []).join(' ')} ${(userData.tags[r.full_name] || []).join(' ')}`.toLowerCase()
        if (!hay.includes(t)) return false
      }
      return true
    })
    const by = {
      pushed: (a, b) => new Date(b.pushed_at) - new Date(a.pushed_at),
      updated: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
      created: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      stars: (a, b) => b.stargazers_count - a.stargazers_count,
      name: (a, b) => a.name.localeCompare(b.name),
      health: (a, b) => health(b).score - health(a).score,
    }[settings.sort] || (() => 0)
    l = [...l].sort(by)
    // pinned always first
    return [...l.filter((r) => userData.pins.includes(r.full_name)), ...l.filter((r) => !userData.pins.includes(r.full_name))]
  }, [allRepos, q, filter, lang, tagFilter, settings.sort, settings.fForks, userData, hostMap])

  const togglePin = (full) =>
    setUserData((u) => ({ ...u, pins: u.pins.includes(full) ? u.pins.filter((p) => p !== full) : [full, ...u.pins] }))
  const toggleSel = (full) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(full) ? n.delete(full) : n.add(full)
      return n
    })
  const open = async (r) => {
    if (selecting) return toggleSel(r.full_name)
    if (r._acct) await switchAccount(r._acct) // repo from another account: switch to it first
    go('repo', r.owner.login, r.name)
  }

  // ---------- bulk ----------
  const selRepos = repos.filter((r) => selected.has(r.full_name))
  async function bulk(label, fn, { danger, body } = {}) {
    if (body && !(await confirm({ title: label, body, danger, okLabel: label }))) return
    setBulkBusy(label)
    let ok = 0
    for (const r of selRepos) {
      try {
        await fn(r)
        ok++
      } catch (e) {
        toast(`${r.name}: ${e.message}`, 'error')
      }
    }
    setBulkBusy('')
    toast(`${label}: ${ok}/${selRepos.length} done`, ok ? 'success' : 'error')
  }
  const bulkTopic = async (add) => {
    const topic = prompt(add ? 'Topic to add (lowercase, hyphens):' : 'Topic to remove:')?.trim().toLowerCase().replace(/\s+/g, '-')
    if (!topic) return
    bulk(add ? 'Add topic' : 'Remove topic', async (r) => {
      const cur = r.topics || []
      const names = add ? [...new Set([...cur, topic])] : cur.filter((t) => t !== topic)
      const res = await gh.setTopics(r.full_name, names)
      patchRepo(r.full_name, { topics: res.names })
    })
  }
  const bulkTag = () => {
    const tag = prompt('Local tag to add to selected repos:')?.trim()
    if (!tag) return
    setUserData((u) => {
      const tags = { ...u.tags }
      selRepos.forEach((r) => (tags[r.full_name] = [...new Set([...(tags[r.full_name] || []), tag])]))
      return { ...u, tags }
    })
    toast(`Tagged ${selRepos.length} repos with "${tag}"`, 'success')
  }

  const viewOptions = [
    { value: 'grid', icon: <LayoutGrid size={15} />, title: 'Grid' },
    { value: 'list', icon: <List size={15} />, title: 'List' },
    settings.fBoard !== false && { value: 'board', icon: <Columns3 size={15} />, title: 'Board' },
    settings.fTimeline !== false && { value: 'timeline', icon: <CalendarClock size={15} />, title: 'Timeline' },
  ].filter(Boolean)
  const view = viewOptions.some((o) => o.value === settings.view) ? settings.view : 'grid'

  const counts = useMemo(() => ({
    all: repos.filter((r) => !r.archived).length,
    pinned: userData.pins.length,
    public: repos.filter((r) => !r.private && !r.archived).length,
    private: repos.filter((r) => r.private && !r.archived).length,
    sites: repos.filter((r) => siteUrl(r) && !r.archived).length,
    forks: repos.filter((r) => r.fork && !r.archived).length,
    archived: repos.filter((r) => r.archived).length,
    vercel: repos.filter((r) => hostsFor(r, hostMap).some((h) => h.provider === 'vercel')).length,
    netlify: repos.filter((r) => hostsFor(r, hostMap).some((h) => h.provider === 'netlify')).length,
  }), [repos, userData.pins, hostMap])

  if (mobile)
    return (
      <div>
        {repos.length > 0 && <Hero repos={repos} mobile />}
        <div className="m-search">
          <div className="search">
            <Search size={16} />
            <input className="input glass" style={{ height: 46, borderRadius: 16 }} placeholder={`Search ${repos.length} repos`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {settings.fFilters !== false && <div className="filters">
          {FILTERS.filter(([v]) => !['vercel', 'netlify'].includes(v) || counts[v] > 0).map(([v, l]) => (
            <button key={v} className={`chip ${filter === v ? 'on' : ''}`} onClick={() => setFilter(v)}>{l}<span className="n">{counts[v]}</span></button>
          ))}
        </div>}
        {reposLoading && !repos.length ? (
          <div className="m-list">{Array.from({ length: 8 }, (_, i) => <div key={i} className="shimmer" style={{ height: 66 }} />)}</div>
        ) : !list.length ? (
          <div className="empty"><Search size={26} /><div>No repositories match.</div></div>
        ) : (
          <div className="m-list">
            {list.map((r, i) => {
              const accent = r.language ? langColor(r.language) : 'var(--c1)'
              const pinned = userData.pins.includes(r.full_name)
              return (
                <div key={r.id} className="m-row" style={{ '--i': i, '--accent': accent }} onClick={() => open(r)}>
                  <div className="monogram">{initials(r.name)}</div>
                  <div className="grow">
                    <div className="row" style={{ gap: 6 }}>
                      <span className="name">{r.name}</span>
                      {r.private && <Lock size={12} className="faint" />}
                      <HostBadges repo={r} />
                    </div>
                    <div className="desc">{r.description || (r.language ? r.language : 'No description')}</div>
                    <div className="meta" style={{ marginTop: 3, gap: 10 }}>
                      {r.language && <span><i className="lang-dot" style={{ background: accent }} />{r.language}</span>}
                      <span><Star size={12} />{fmt(r.stargazers_count)}</span>
                      <span>{timeAgo(r.pushed_at)}</span>
                    </div>
                  </div>
                  <button className="btn ghost icon" aria-label={pinned ? 'Unpin' : 'Pin'} onClick={(e) => (e.stopPropagation(), togglePin(r.full_name))} style={pinned ? { color: 'var(--c3)' } : { color: 'var(--text-3)' }}>
                    <Pin size={17} fill={pinned ? 'currentColor' : 'none'} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )

  return (
    <div>
      {repos.length > 0 && settings.fHero !== false && <Hero repos={repos} />}
      <Glass className="toolbar">
        <div className="search">
          <Search size={16} />
          <input className="input" placeholder={`Search ${repos.length} repositories…`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {settings.fCodeSearch !== false && (
          <button className="btn ghost icon" onClick={() => setCodeSearch(true)} title="Search inside the code of all your repos" aria-label="Code search">
            <Code2 size={17} />
          </button>
        )}
        <select className="select" style={{ width: 'auto' }} value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
          <option value="">All languages</option>
          {langs.map((l) => <option key={l}>{l}</option>)}
        </select>
        {allTags.length > 0 && (
          <select className="select" style={{ width: 'auto' }} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} aria-label="Tag">
            <option value="">All tags</option>
            {allTags.map((l) => <option key={l}>{l}</option>)}
          </select>
        )}
        <select className="select" style={{ width: 'auto' }} value={settings.sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div className="grow" />
        {settings.fBulk !== false && (
          <button className={`btn ${selecting ? 'primary' : ''}`} onClick={() => (setSelecting(!selecting), setSelected(new Set()))}>
            <CheckSquare size={16} /> {selecting ? 'Done' : 'Select'}
          </button>
        )}
        <Seg id="view" value={view} onChange={(v) => update({ view: v })} options={viewOptions} />
      </Glass>

      {settings.fFilters !== false && <div className="filters">
        {FILTERS.filter(([v]) => !['vercel', 'netlify'].includes(v) || counts[v] > 0).map(([v, l]) => (
          <button key={v} className={`chip ${filter === v ? 'on' : ''}`} onClick={() => setFilter(v)}>{l}<span className="n">{counts[v]}</span></button>
        ))}
      </div>}

      {reposLoading && !repos.length ? (
        <div className="grid">{Array.from({ length: 9 }, (_, i) => <div key={i} className="shimmer" style={{ height: 170 }} />)}</div>
      ) : !list.length ? (
        <div className="empty"><Search size={28} /><div>No repositories match.</div></div>
      ) : view === 'list' ? (
        <ListView list={list} open={open} selecting={selecting} selected={selected} userData={userData} togglePin={togglePin} />
      ) : view === 'board' ? (
        <Board list={list} open={open} />
      ) : view === 'timeline' ? (
        <Timeline list={list} open={open} selecting={selecting} selected={selected} userData={userData} togglePin={togglePin} setTagEditor={setTagEditor} />
      ) : (
        <div className="grid">
          {list.map((r, i) => (
            <RepoCard key={r.id} r={r} i={i} open={open} selecting={selecting} selected={selected.has(r.full_name)} pinned={userData.pins.includes(r.full_name)} tags={userData.tags[r.full_name]} togglePin={togglePin} setTagEditor={setTagEditor} />
          ))}
        </div>
      )}

      {selecting && (
        <Glass className="bulk-bar glass-strong">
          <b>{selected.size} selected</b>
          <button className="btn sm" onClick={() => setSelected(new Set(list.map((r) => r.full_name)))}>Select all</button>
          <button className="btn sm" onClick={() => setSelected(new Set())}>Clear</button>
          <div className="grow" />
          {bulkBusy ? (
            <span className="row"><Spinner /> {bulkBusy}…</span>
          ) : (
            <>
              <button
                className="btn sm primary"
                disabled={!selected.size}
                title="Fill missing descriptions, topics and websites for the selected repos (free). Existing values are kept."
                onClick={() =>
                  bulk('Auto-fill details', async (r) => {
                    const a = await autoDetails(gh, r)
                    const patch = {}
                    if (!r.description && a.description) patch.description = a.description
                    if (!r.homepage && a.homepage) patch.homepage = a.homepage
                    if (Object.keys(patch).length) patchRepo(r.full_name, await gh.updateRepo(r.full_name, patch))
                    if (!(r.topics || []).length && a.topics.length) patchRepo(r.full_name, { topics: (await gh.setTopics(r.full_name, a.topics)).names })
                  }, { body: `Fill in missing descriptions, topics and websites for ${selected.size} repositories?\nOnly empty fields are filled; nothing you wrote is replaced.` })
                }
              >
                <Wand2 size={14} /> Auto-fill
              </button>
              <button className="btn sm" disabled={!selected.size} onClick={bulkTag}><Tag size={14} /> Local tag</button>
              <button className="btn sm" disabled={!selected.size} onClick={() => bulkTopic(true)}><Plus size={14} /> Topic</button>
              <button className="btn sm" disabled={!selected.size} onClick={() => bulkTopic(false)}><X size={14} /> Topic</button>
              <button className="btn sm" disabled={!selected.size} onClick={() => bulk('Make private', async (r) => patchRepo(r.full_name, await gh.updateRepo(r.full_name, { private: true })), { body: `Make ${selected.size} repositories private?` })}><EyeOff size={14} /> Private</button>
              <button className="btn sm" disabled={!selected.size} onClick={() => bulk('Make public', async (r) => patchRepo(r.full_name, await gh.updateRepo(r.full_name, { private: false })), { danger: true, body: `Make ${selected.size} repositories PUBLIC?\nAnyone on the internet will be able to see their code.` })}><Eye size={14} /> Public</button>
              <button className="btn sm" disabled={!selected.size} onClick={() => bulk('Archive', async (r) => patchRepo(r.full_name, await gh.updateRepo(r.full_name, { archived: true })), { body: `Archive ${selected.size} repositories? They become read-only (you can unarchive later).` })}><Archive size={14} /> Archive</button>
              <button className="btn sm" disabled={!selected.size} onClick={() => bulk('Unarchive', async (r) => patchRepo(r.full_name, await gh.updateRepo(r.full_name, { archived: false })))}><ArchiveRestore size={14} /> Unarchive</button>
            </>
          )}
        </Glass>
      )}

      <CodeSearch open={codeSearch} onClose={() => setCodeSearch(false)} />
      <TagEditor full={tagEditor} onClose={() => setTagEditor(null)} />
    </div>
  )
}

export const initials = (name) =>
  name.split(/[-_.\s]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || name.slice(0, 2).toUpperCase()

function RepoCard({ r, i, open, selecting, selected, pinned, tags = [], togglePin, setTagEditor }) {
  const { settings } = useSettings()
  const h = health(r)
  const site = siteUrl(r)
  const accent = r.language ? langColor(r.language) : 'var(--c1)'
  return (
    <TiltCard className={`glass ${selected ? 'sel' : ''}`} onClick={() => open(r)} style={{ '--accent': accent, '--i': i }}>
      <div className="card-head">
        {selecting && <input type="checkbox" checked={selected} readOnly aria-label="Select" />}
        <div className="monogram">{initials(r.name)}</div>
        <div className="grow">
          <div className="card-title">
            <span className="name">{r.name}</span>
            {pinned && <Pin size={12} fill="currentColor" className="pin-flag" />}
            <HostBadges repo={r} />
          </div>
          <div className="card-sub">
            {r.private ? <Lock size={11} /> : <Globe size={11} />} {r.private ? 'Private' : 'Public'}
            {r.fork && ' · Fork'}{r.archived && ' · Archived'} · {timeAgo(r.pushed_at)}{r._acct ? ` · @${r._acct}` : ''}
          </div>
        </div>
        {settings.showHealth && <span className="health-dot" style={{ color: healthColor(h.score) }} title={`Health ${h.score}%`} />}
      </div>
      {settings.fCardDesc !== false && <p className="card-desc">{r.description || <span className="faint">No description yet</span>}</p>}
      {settings.fCardTags !== false && tags.length > 0 && <div className="row wrap" style={{ gap: 6 }}>{tags.map((t) => <span key={t} className="tag local">#{t}</span>)}</div>}
      <div className="card-foot">
        <div className="meta" style={settings.fCardMeta === false ? { visibility: 'hidden' } : undefined}>
          {r.language && <span><i className="lang-dot" style={{ background: accent }} />{r.language}</span>}
          <span><Star size={13} />{fmt(r.stargazers_count)}</span>
          {r.forks_count > 0 && <span><GitFork size={13} />{fmt(r.forks_count)}</span>}
        </div>
        <div className="card-actions" style={settings.fCardActions === false ? { display: 'none' } : undefined} onClick={(e) => e.stopPropagation()}>
          {site && <a className="btn ghost sm icon" href={site} target="_blank" rel="noopener noreferrer" title="Open site" aria-label="Open site"><ExternalLink size={14} /></a>}
          <button className="btn ghost sm icon" title="Copy clone URL" aria-label="Copy clone URL" onClick={() => navigator.clipboard.writeText(r.clone_url)}><Copy size={14} /></button>
          <button className="btn ghost sm icon" title="Local tags" aria-label="Local tags" onClick={() => setTagEditor(r.full_name)}><Tag size={14} /></button>
          <button className="btn ghost sm icon" title={pinned ? 'Unpin' : 'Pin'} aria-label={pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(r.full_name)} style={pinned ? { color: 'var(--c3)' } : undefined}>
            <Pin size={14} fill={pinned ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </TiltCard>
  )
}

function ListView({ list, open, selecting, selected, userData, togglePin }) {
  return (
    <Glass lit={false} style={{ overflow: 'hidden' }}>
      {list.map((r) => {
        const h = health(r)
        const pinned = userData.pins.includes(r.full_name)
        return (
          <div key={r.id} className="list-row" onClick={() => open(r)}>
            {selecting && <input type="checkbox" checked={selected.has(r.full_name)} readOnly />}
            <Ring value={h.score} color={healthColor(h.score)} />
            <div className="grow">
              <div className="row" style={{ gap: 8 }}>
                <b>{r.name}</b>
                {r.private && <span className="badge">private</span>}
                {r.archived && <span className="badge">archived</span>}
                {(userData.tags[r.full_name] || []).map((t) => <span key={t} className="tag">#{t}</span>)}
              </div>
              <div className="faint" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div>
            </div>
            <div className="meta" style={{ flex: 'none' }}>
              {r.language && <span><i className="lang-dot" style={{ background: langColor(r.language), color: langColor(r.language) }} />{r.language}</span>}
              <span><Star size={13} />{fmt(r.stargazers_count)}</span>
              <span style={{ width: 70 }}>{timeAgo(r.pushed_at)}</span>
            </div>
            <button className="btn ghost sm icon" onClick={(e) => (e.stopPropagation(), togglePin(r.full_name))} style={pinned ? { color: 'var(--c2)' } : undefined}>
              {pinned ? <Pin size={14} fill="currentColor" /> : <Pin size={14} />}
            </button>
          </div>
        )
      })}
    </Glass>
  )
}

function Board({ list, open }) {
  const { userData, setUserData } = useSettings()
  const [over, setOver] = useState(null)
  const cols = ['Unsorted', ...userData.folders]
  const colOf = (r) => (userData.folders.includes(userData.folderOf[r.full_name]) ? userData.folderOf[r.full_name] : 'Unsorted')
  const move = (full, folder) => setUserData((u) => ({ ...u, folderOf: { ...u.folderOf, [full]: folder === 'Unsorted' ? undefined : folder } }))
  const addCol = () => {
    const n = prompt('New column name:')?.trim()
    if (n && !userData.folders.includes(n)) setUserData((u) => ({ ...u, folders: [...u.folders, n] }))
  }
  const delCol = (c) => setUserData((u) => ({ ...u, folders: u.folders.filter((f) => f !== c) }))
  return (
    <div className="board">
      {cols.map((c) => {
        const items = list.filter((r) => colOf(r) === c)
        return (
          <Glass key={c} lit={false} className={`board-col ${over === c ? 'drop' : ''}`}
            onDragOver={(e) => (e.preventDefault(), setOver(c))}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              move(e.dataTransfer.getData('text/plain'), c)
            }}>
            <h4>
              <span>{c} <span className="faint">· {items.length}</span></span>
              {c !== 'Unsorted' && <button className="btn ghost sm icon" style={{ padding: 2 }} onClick={() => delCol(c)} title="Delete column"><Trash2 size={13} /></button>}
            </h4>
            {items.map((r) => (
              <motion.div layout key={r.id} className="mini-card" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', r.full_name)} onClick={() => open(r)}>
                <div className="row" style={{ gap: 6, fontWeight: 600 }}>{r.private && <Lock size={13} className="faint" />}{r.name}</div>
                <div className="meta" style={{ marginTop: 4 }}>
                  {r.language && <span><i className="lang-dot" style={{ background: langColor(r.language) }} />{r.language}</span>}
                  <span>{timeAgo(r.pushed_at)}</span>
                </div>
              </motion.div>
            ))}
          </Glass>
        )
      })}
      <button className="btn" style={{ alignSelf: 'start', height: 52 }} onClick={addCol}><FolderPlus size={16} /> Add column</button>
    </div>
  )
}

function Timeline({ list, ...rest }) {
  const groups = useMemo(() => {
    const m = new Map()
    ;[...list].sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at)).forEach((r) => {
      const k = new Date(r.pushed_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(r)
    })
    return [...m]
  }, [list])
  return (
    <div className="timeline">
      {groups.map(([month, rs]) => (
        <div key={month} style={{ marginBottom: 22 }}>
          <div className="tl-month">{month}</div>
          <div className="grid">
            {rs.map((r, i) => (
              <RepoCard key={r.id} r={r} i={i} open={rest.open} selecting={rest.selecting} selected={rest.selected.has(r.full_name)} pinned={rest.userData.pins.includes(r.full_name)} tags={rest.userData.tags[r.full_name]} togglePin={rest.togglePin} setTagEditor={rest.setTagEditor} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TagEditor({ full, onClose }) {
  const { userData, setUserData } = useSettings()
  const [v, setV] = useState('')
  const tags = (full && userData.tags[full]) || []
  const set = (next) => setUserData((u) => ({ ...u, tags: { ...u.tags, [full]: next } }))
  const allTags = [...new Set(Object.values(userData.tags).flat())].filter((t) => !tags.includes(t))
  return (
    <Modal open={!!full} onClose={onClose}>
      <h2>Local tags</h2>
      <p className="muted" style={{ marginTop: 0 }}>{full} · stored only in this browser, encrypted</p>
      <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
        {tags.map((t) => (
          <span key={t} className="tag" style={{ fontSize: 13 }}>#{t}<button className="btn ghost sm icon" style={{ padding: 0 }} onClick={() => set(tags.filter((x) => x !== t))}><X size={12} /></button></span>
        ))}
        {!tags.length && <span className="faint">No tags yet</span>}
      </div>
      <form className="row" onSubmit={(e) => (e.preventDefault(), v.trim() && set([...new Set([...tags, v.trim()])]), setV(''))}>
        <input className="input" autoFocus placeholder="Add a tag…" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="btn primary"><Plus size={16} /></button>
      </form>
      {allTags.length > 0 && (
        <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
          {allTags.map((t) => <button key={t} className="chip" onClick={() => set([...tags, t])}>+ {t}</button>)}
        </div>
      )}
    </Modal>
  )
}

function CodeSearch({ open, onClose }) {
  const { gh, user } = useAuth()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const run = async (e) => {
    e.preventDefault()
    if (!q.trim()) return
    setBusy(true)
    setErr('')
    try {
      setRes(await gh.searchCode(`${q} user:${user.login}`))
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} size="wide">
      <h2>Search code across all your repos</h2>
      <form className="row" onSubmit={run} style={{ margin: '14px 0' }}>
        <div className="search" style={{ maxWidth: 'none' }}>
          <Search size={16} />
          <input className="input" autoFocus placeholder="e.g. useEffect, TODO, apiKey…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn primary" disabled={busy}>{busy ? <Spinner /> : 'Search'}</button>
      </form>
      {err && <div className="finding block">{err}</div>}
      {res && (
        <>
          <div className="faint" style={{ marginBottom: 8 }}>{res.total_count} results</div>
          <Glass lit={false}>
            {res.items.map((it) => (
              <div key={it.sha + it.path + it.repository.full_name} className="list-row" onClick={() => (onClose(), go('repo', it.repository.owner.login, it.repository.name, 'files', it.path))}>
                <Code2 size={16} className="faint" />
                <div className="grow">
                  <b>{it.repository.name}</b> <span className="mono faint" style={{ fontSize: 12.5 }}>/{it.path}</span>
                </div>
              </div>
            ))}
          </Glass>
        </>
      )}
    </Modal>
  )
}
