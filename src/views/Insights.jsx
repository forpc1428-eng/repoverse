import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Star, GitFork, BookMarked, Lock, Globe, GripVertical, EyeOff, Eye, Maximize, Minimize, Flame, TrendingUp, Wand2, LayoutDashboard } from 'lucide-react'
import { Glass, Counter, Ring, Spinner, Modal } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useSettings, WIDGETS } from '../lib/settings'
import { go } from '../lib/router'
import { fmt, health, healthColor, langColor, timeAgo, pool } from '../lib/util'
import { loadGrowth } from '../lib/growth'

export default function Insights() {
  const { repos } = useAuth()
  const { settings, update } = useSettings()
  const [dragId, setDragId] = useState(null)
  const [manage, setManage] = useState(false)
  const own = useMemo(() => repos.filter((r) => !r.fork), [repos])

  const move = (from, to) => {
    if (from === to) return
    const w = [...settings.widgets]
    const fi = w.findIndex((x) => x.id === from)
    const ti = w.findIndex((x) => x.id === to)
    const [item] = w.splice(fi, 1)
    w.splice(ti, 0, item)
    update({ widgets: w })
  }
  const patchW = (id, p) => update({ widgets: settings.widgets.map((w) => (w.id === id ? { ...w, ...p } : w)) })

  const render = (id) => {
    switch (id) {
      case 'stats': return <Stats repos={repos} />
      case 'heatmap': return <Heatmap />
      case 'languages': return <Languages repos={own} />
      case 'stars': return <TopStars repos={own} />
      case 'health': return <HealthTable repos={own} />
      case 'recent': return <Recent repos={repos} />
      case 'traffic': return <Traffic repos={own} />
      case 'growth': return <Growth />
      default: return null
    }
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="faint" style={{ fontSize: 13 }}>Drag widgets by their handle to rearrange.</span>
        <div className="grow" />
        <button className="btn" onClick={() => setManage(true)}><LayoutDashboard size={16} /> Manage widgets</button>
      </div>
      <div className="widgets">
        {settings.widgets.filter((w) => !w.hidden).map((w, i) => {
          const meta = WIDGETS.find((x) => x.id === w.id)
          return (
            <motion.div
              key={w.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, delay: i * 0.04 }}
              className={`widget ${dragId === w.id ? 'dragging' : ''}`}
              style={{ '--span': w.span }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => (e.preventDefault(), move(dragId, w.id), setDragId(null))}
            >
              <Glass className="section" style={{ height: '100%' }}>
                <h3>
                  <span className="widget-handle" draggable onDragStart={() => setDragId(w.id)} onDragEnd={() => setDragId(null)} title="Drag to move"><GripVertical size={16} /></span>
                  {meta.name}
                  <span className="grow" />
                  <button className="btn ghost sm icon" title={w.span >= 12 ? 'Make narrower' : 'Make wider'} onClick={() => patchW(w.id, { span: w.span >= 12 ? 6 : Math.min(12, w.span + 3) })}>
                    {w.span >= 12 ? <Minimize size={14} /> : <Maximize size={14} />}
                  </button>
                  <button className="btn ghost sm icon" title="Hide" onClick={() => patchW(w.id, { hidden: true })}><EyeOff size={14} /></button>
                </h3>
                {render(w.id)}
              </Glass>
            </motion.div>
          )
        })}
      </div>
      <Modal open={manage} onClose={() => setManage(false)}>
        <h2>Widgets</h2>
        <p className="muted" style={{ marginTop: 0 }}>Show or hide widgets. Layout is saved on this device.</p>
        {settings.widgets.map((w) => (
          <div key={w.id} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--stroke-soft)' }}>
            <span>{WIDGETS.find((x) => x.id === w.id).name}</span>
            <button className="btn sm" onClick={() => patchW(w.id, { hidden: !w.hidden })}>{w.hidden ? <><Eye size={14} /> Show</> : <><EyeOff size={14} /> Hide</>}</button>
          </div>
        ))}
      </Modal>
    </div>
  )
}

function Stats({ repos }) {
  const s = useMemo(() => ({
    total: repos.length,
    stars: repos.reduce((n, r) => n + r.stargazers_count, 0),
    forks: repos.reduce((n, r) => n + r.forks_count, 0),
    pub: repos.filter((r) => !r.private).length,
    priv: repos.filter((r) => r.private).length,
    avgHealth: repos.length ? Math.round(repos.reduce((n, r) => n + health(r).score, 0) / repos.length) : 0,
  }), [repos])
  const items = [
    [BookMarked, 'Repositories', s.total], [Star, 'Total stars', s.stars], [GitFork, 'Total forks', s.forks],
    [Globe, 'Public', s.pub], [Lock, 'Private', s.priv], [TrendingUp, 'Avg. health', s.avgHealth],
  ]
  return (
    <div className="stats">
      {items.map(([I, k, v]) => (
        <div key={k} className="stat glass glass-flat lit" style={{ borderRadius: 18 }}>
          <div className="row" style={{ gap: 10 }}><span className="stat-icon"><I size={15} /></span><span className="k">{k}</span></div>
          <div className="v grad-text"><Counter value={v} />{k === 'Avg. health' ? '%' : ''}</div>
        </div>
      ))}
    </div>
  )
}

function Heatmap() {
  const { gh, user } = useAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    gh.graphql(`query($login:String!){ user(login:$login){ contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`, { login: user.login })
      .then((d) => setData(d.user.contributionsCollection.contributionCalendar))
      .catch((e) => setErr(e.message))
  }, [gh, user.login])
  if (err) return <div className="faint">{err}</div>
  if (!data) return <div className="shimmer" style={{ height: 110 }} />
  const days = data.weeks.flatMap((w) => w.contributionDays)
  const max = Math.max(1, ...days.map((d) => d.contributionCount))
  const best = days.reduce((a, b) => (b.contributionCount > a.contributionCount ? b : a), days[0])
  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) streak++
    else if (i !== days.length - 1) break
  }
  return (
    <>
      <div className="row wrap" style={{ gap: 18, marginBottom: 12 }}>
        <span><b className="grad-text" style={{ fontSize: 22 }}>{data.totalContributions.toLocaleString()}</b> <span className="faint">contributions this year</span></span>
        <span className="tag"><Flame size={12} /> {streak}-day streak</span>
        <span className="tag">Best day: {best.contributionCount} on {new Date(best.date).toLocaleDateString()}</span>
      </div>
      <div className="heat">
        {days.map((d) => {
          const lvl = d.contributionCount / max
          return (
            <i key={d.date} title={`${d.contributionCount} on ${d.date}`}
              style={d.contributionCount ? { background: `color-mix(in srgb, var(--c2) ${20 + lvl * 80}%, transparent)`, boxShadow: lvl > 0.6 ? '0 0 8px var(--c2)' : 'none' } : undefined} />
          )
        })}
      </div>
    </>
  )
}

function Languages({ repos }) {
  const data = useMemo(() => {
    const m = {}
    repos.forEach((r) => r.language && (m[r.language] = (m[r.language] || 0) + 1))
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [repos])
  const total = data.reduce((n, [, v]) => n + v, 0)
  if (!total) return <div className="faint">No language data</div>
  let acc = 0
  const R = 60
  const C = 2 * Math.PI * R
  return (
    <div className="row" style={{ gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width="160" height="160" viewBox="0 0 160 160" style={{ flex: 'none' }}>
        <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="20" />
        {data.slice(0, 8).map(([l, v]) => {
          const len = (v / total) * C
          const el = <circle key={l} cx="80" cy="80" r={R} fill="none" stroke={langColor(l)} strokeWidth="20" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 80 80)" />
          acc += len
          return el
        })}
        <text x="80" y="76" textAnchor="middle" fill="var(--text)" fontSize="26" fontWeight="700">{data.length}</text>
        <text x="80" y="96" textAnchor="middle" fill="var(--text-3)" fontSize="11">languages</text>
      </svg>
      <div className="col grow" style={{ gap: 7, minWidth: 160 }}>
        {data.slice(0, 8).map(([l, v]) => (
          <div key={l} className="row" style={{ fontSize: 13.5 }}>
            <i className="lang-dot" style={{ background: langColor(l) }} /><span className="grow">{l}</span><span className="faint">{v} · {Math.round((v / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopStars({ repos }) {
  const top = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 7)
  const max = Math.max(1, top[0]?.stargazers_count || 0)
  return (
    <div className="col" style={{ gap: 10 }}>
      {top.map((r) => (
        <div key={r.id} style={{ cursor: 'pointer' }} onClick={() => go('repo', r.owner.login, r.name)}>
          <div className="row between" style={{ fontSize: 13.5, marginBottom: 4 }}><span>{r.name}</span><span className="faint"><Star size={12} /> {fmt(r.stargazers_count)}</span></div>
          <div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: `${(r.stargazers_count / max) * 100}%` }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} style={{ background: 'var(--grad)' }} /></div>
        </div>
      ))}
    </div>
  )
}

function HealthTable({ repos }) {
  const rows = [...repos].filter((r) => !r.archived).map((r) => ({ r, h: health(r) })).sort((a, b) => a.h.score - b.h.score).slice(0, 8)
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="faint" style={{ fontSize: 12.5, marginBottom: 4 }}>Repos that need the most love:</div>
      {rows.map(({ r, h }) => (
        <div key={r.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--stroke-soft)' }}>
          <Ring value={h.score} color={healthColor(h.score)} />
          <div className="grow">
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
            <div className="faint" style={{ fontSize: 12 }}>Missing: {h.checks.filter((c) => !c.ok).map((c) => c.key).join(', ') || 'nothing 🎉'}</div>
          </div>
          <button className="btn sm" onClick={() => go('repo', r.owner.login, r.name)}><Wand2 size={13} /> Fix</button>
        </div>
      ))}
    </div>
  )
}

function Recent({ repos }) {
  return (
    <div className="col" style={{ gap: 2 }}>
      {[...repos].sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at)).slice(0, 8).map((r) => (
        <div key={r.id} className="row list-row" style={{ padding: '8px 4px' }} onClick={() => go('repo', r.owner.login, r.name)}>
          <i className="lang-dot" style={{ background: langColor(r.language) }} />
          <span className="grow" style={{ fontSize: 13.5 }}>{r.name}</span>
          <span className="faint" style={{ fontSize: 12 }}>{timeAgo(r.pushed_at)}</span>
        </div>
      ))}
    </div>
  )
}

function Traffic({ repos }) {
  const { gh } = useAuth()
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = async () => {
    setBusy(true)
    const list = repos.filter((r) => r.permissions?.push).sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at)).slice(0, 12)
    const res = await pool(list, 4, async (r) => {
      try {
        const [v, c] = await Promise.all([gh.views(r.full_name), gh.clones(r.full_name)])
        return { r, views: v.count, uniques: v.uniques, clones: c.count, series: v.views }
      } catch {
        return { r, views: 0, uniques: 0, clones: 0, series: [] }
      }
    })
    setRows(res.sort((a, b) => b.views - a.views))
    setBusy(false)
  }
  if (!rows)
    return (
      <div className="row">
        <span className="muted grow">Views and clones for your 12 most recent repos (last 14 days). Uses 24 API calls.</span>
        <button className="btn primary" onClick={load} disabled={busy}>{busy ? <Spinner /> : <TrendingUp size={16} />} Load traffic</button>
      </div>
    )
  const max = Math.max(1, ...rows.flatMap((x) => x.series.map((s) => s.count)))
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
      {rows.map(({ r, views, uniques, clones, series }) => (
        <div key={r.id} className="mini-card" style={{ cursor: 'pointer' }} onClick={() => go('repo', r.owner.login, r.name)}>
          <div className="row between"><b style={{ fontSize: 13.5 }}>{r.name}</b><span className="faint" style={{ fontSize: 12 }}>{clones} clones</span></div>
          <div style={{ fontSize: 22, fontWeight: 700 }} className="grad-text">{views} <span className="faint" style={{ fontSize: 12, fontWeight: 400 }}>views · {uniques} unique</span></div>
          <svg viewBox="0 0 140 30" width="100%" height="30" preserveAspectRatio="none">
            <polyline fill="none" stroke="var(--c2)" strokeWidth="2" points={series.map((s, i) => `${(i / Math.max(1, series.length - 1)) * 140},${30 - (s.count / max) * 28}`).join(' ')} />
          </svg>
        </div>
      ))}
    </div>
  )
}

function Growth() {
  const { user, demo } = useAuth()
  const { settings } = useSettings()
  const [hist, setHist] = useState(null)
  useEffect(() => {
    if (demo) {
      const d = Date.now()
      return setHist(Array.from({ length: 30 }, (_, i) => ({ date: new Date(d - (29 - i) * 86400000).toISOString().slice(0, 10), stars: 700 + Math.round(i * 3 + Math.sin(i) * 4) })))
    }
    loadGrowth(user.login).then(setHist)
  }, [user.login, demo])
  if (settings.fGrowth === false) return <div className="faint">Growth tracking is off (Customize → Features → Insights).</div>
  if (!hist) return <div className="shimmer" style={{ height: 120 }} />
  if (hist.length < 2) return <div className="muted">Tracking started. RepoVerse saves one small snapshot a day on this device, so your star history builds up from today.</div>
  const W = 600, H = 120
  const min = Math.min(...hist.map((h) => h.stars)), max = Math.max(...hist.map((h) => h.stars))
  const pts = hist.map((h, i) => [(i / (hist.length - 1)) * W, H - 8 - ((h.stars - min) / Math.max(1, max - min)) * (H - 20)])
  const line = pts.map((p) => p.join(',')).join(' ')
  const gain = hist[hist.length - 1].stars - hist[0].stars
  return (
    <>
      <div className="row" style={{ gap: 14, marginBottom: 8 }}>
        <b className="grad-text" style={{ fontSize: 22 }}>{hist[hist.length - 1].stars.toLocaleString()} ★</b>
        <span className="tag" style={{ color: gain >= 0 ? '#6ee7b7' : '#fca5a5' }}>{gain >= 0 ? '+' : ''}{gain} since {new Date(hist[0].date).toLocaleDateString()}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-label="Stars over time">
        <defs><linearGradient id="gfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--c2)" stopOpacity=".35" /><stop offset="1" stopColor="var(--c2)" stopOpacity="0" /></linearGradient></defs>
        <polygon points={`0,${H} ${line} ${W},${H}`} fill="url(#gfill)" />
        <polyline points={line} fill="none" stroke="var(--c2)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </>
  )
}
