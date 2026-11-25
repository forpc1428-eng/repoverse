import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Monitor, Tablet, Smartphone, Maximize2, ExternalLink, Activity, Search, Image as ImageIcon, Radio, MonitorPlay, Settings2, X, Link2 } from 'lucide-react'
import { Glass, Modal, Seg, Spinner } from '../components/ui'
import ScaledFrame from '../components/ScaledFrame'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { go } from '../lib/router'
import { siteUrl } from '../lib/util'

const DEVICES = {
  desktop: { width: 1440, aspect: '16 / 10' },
  tablet: { width: 820, aspect: '3 / 4' },
  mobile: { width: 390, aspect: '9 / 17' },
}

async function ping(url) {
  const t0 = performance.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    // no-cors: we only learn "reachable or not" + timing, never the page content
    await fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal, referrerPolicy: 'no-referrer' })
    const ms = Math.round(performance.now() - t0)
    return { state: ms > 2500 ? 'slow' : 'up', ms }
  } catch {
    return { state: 'down', ms: null }
  } finally {
    clearTimeout(timer)
  }
}

export default function Wall() {
  const { repos } = useAuth()
  const { settings, update } = useSettings()
  const [device, setDevice] = useState('desktop')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState({})
  const [checking, setChecking] = useState(false)
  const [full, setFull] = useState(null)

  const sites = useMemo(
    () =>
      repos
        .map((r) => ({ repo: r, url: siteUrl(r) }))
        .filter((s) => s.url && (!q || s.repo.name.toLowerCase().includes(q.toLowerCase()) || s.url.includes(q.toLowerCase())))
        .sort((a, b) => new Date(b.repo.pushed_at) - new Date(a.repo.pushed_at)),
    [repos, q]
  )

  const checkAll = useCallback(async () => {
    setChecking(true)
    await Promise.all(
      sites.map(async (s) => {
        const r = await ping(s.url)
        setStatus((st) => ({ ...st, [s.url]: r }))
      })
    )
    setChecking(false)
  }, [sites])

  useEffect(() => {
    if (settings.fHealthCheck !== false && sites.length && !Object.keys(status).length) checkAll()
  }, [sites.length]) // eslint-disable-line

  const openFull = (s) => {
    setFull(s)
    enterFullscreen()
  }

  const up = Object.values(status).filter((s) => s.state === 'up').length
  const down = Object.values(status).filter((s) => s.state === 'down').length
  const minByDevice = device === 'mobile' ? Math.min(settings.wallMin, 260) : settings.wallMin

  if (!sites.length && !q)
    return (
      <Glass className="empty">
        <MonitorPlay size={34} />
        <h3 style={{ margin: '6px 0' }}>No live sites yet</h3>
        <p className="muted">Add a website URL to a repo, or enable GitHub Pages in a repo's Settings tab.</p>
        <button className="btn primary" onClick={() => go('repos')}><Settings2 size={16} /> Go to repositories</button>
      </Glass>
    )

  return (
    <div>
      <Glass className="toolbar" lit={false}>
        <div className="search" style={{ maxWidth: 300 }}>
          <Search size={16} />
          <input className="input" placeholder="Filter sites…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Seg id="device" value={device} onChange={setDevice} options={[
          { value: 'desktop', icon: <Monitor size={15} />, title: 'Desktop' },
          { value: 'tablet', icon: <Tablet size={15} />, title: 'Tablet' },
          { value: 'mobile', icon: <Smartphone size={15} />, title: 'Mobile' },
        ]} />
        <Seg id="wallmode" value={settings.previewMode} onChange={(v) => update({ previewMode: v })} options={[
          { value: 'live', icon: <Radio size={15} />, label: 'Live' },
          { value: 'snapshot', icon: <ImageIcon size={15} />, label: 'Snapshot' },
          { value: 'link', icon: <Link2 size={15} />, label: 'Link only' },
        ]} />
        <div className="row" style={{ minWidth: 200 }}>
          <span className="faint" style={{ fontSize: 13 }}>Size</span>
          <input type="range" min="240" max="720" value={settings.wallMin} onChange={(e) => update({ wallMin: +e.target.value })} />
        </div>
        <div className="grow" />
        <span className="tag"><span className="status-dot up" /> {up} up</span>
        {down > 0 && <span className="tag"><span className="status-dot down" /> {down} down</span>}
        <button className="btn" onClick={checkAll} disabled={checking}>{checking ? <Spinner /> : <Activity size={16} />} Health check</button>
      </Glass>

      <div className="wall" style={{ '--wall-min': minByDevice + 'px' }}>
        {/* click a preview = full screen, Ctrl/⌘/middle-click = new tab */}
        {sites.map((s, i) => (
          <motion.div key={s.repo.id} initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: Math.min(i, 12) * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
            <SiteCard s={s} st={status[s.url]} device={device} mode={settings.fLivePreviews === false && settings.previewMode === 'live' ? 'snapshot' : settings.previewMode} onFull={() => openFull(s)} />
          </motion.div>
        ))}
      </div>

      <FullScreenPreview site={full} onClose={() => setFull(null)} />
    </div>
  )
}

function SiteCard({ s, st, device, mode, onFull }) {
  const [loaded, setLoaded] = useState(false)
  const d = DEVICES[device]
  const snapshot = `https://opengraph.githubassets.com/1/${s.repo.full_name}`
  if (mode === 'link')
    return (
      <Glass className="card link-card" style={{ cursor: 'default' }}>
        <span className={`status-dot ${st ? st.state : 'unknown'}`} />
        <b style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => go('repo', s.repo.owner.login, s.repo.name)}>{s.repo.name}</b>
        <a className="url-pill" href={s.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{s.url.replace(/^https?:\/\//, '')}</a>
        <button className="btn ghost sm icon" onClick={onFull} title="Full screen" aria-label="Full screen"><Maximize2 size={14} /></button>
        <a className="btn sm" href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> New tab</a>
      </Glass>
    )
  return (
    <Glass className="shot card" style={{ cursor: 'default' }}>
      <div className="shot-bar">
        <span className={`status-dot ${st ? st.state : 'unknown'}`} title={st ? `${st.state}${st.ms ? ` · ${st.ms} ms` : ''}` : 'Not checked'} />
        <b style={{ fontSize: 13.5, whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => go('repo', s.repo.owner.login, s.repo.name)}>{s.repo.name}</b>
        <div className="url-pill">{s.url.replace(/^https?:\/\//, '')}</div>
        {st?.ms && <span className="faint" style={{ fontSize: 11.5 }}>{st.ms}ms</span>}
        <button className="btn ghost sm icon" onClick={onFull} title="Full screen" aria-label="Full screen"><Maximize2 size={14} /></button>
        <a className="btn sm" href={s.url} target="_blank" rel="noopener noreferrer" title="Open in a new tab"><ExternalLink size={13} /> New tab</a>
      </div>
      <div className="viewport" style={{ aspectRatio: d.aspect }}>
        <PreviewHit url={s.url} onFull={onFull} />
        {mode === 'snapshot' || s.repo.private ? (
          <img className="snapshot" src={snapshot} alt={s.repo.name} loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <>
            {!loaded && <div className="loading"><Spinner size={22} /></div>}
            <ScaledFrame key={device} src={s.url} width={d.width} onLoad={() => setLoaded(true)} />
          </>
        )}
      </div>
    </Glass>
  )
}

export function enterFullscreen() {
  const el = document.documentElement
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {})
}
function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
}

/** Transparent layer over a live preview: click = full screen, Ctrl/⌘/middle-click = new tab. */
export function PreviewHit({ url, onFull }) {
  const newTab = () => window.open(url, '_blank', 'noopener,noreferrer')
  return (
    <button
      className="vp-hit"
      aria-label="Open full screen"
      onClick={(e) => (e.ctrlKey || e.metaKey || e.shiftKey ? newTab() : onFull())}
      onAuxClick={(e) => e.button === 1 && newTab()}
    >
      <span className="vp-hint"><Maximize2 size={13} /> Full screen <span className="faint">· Ctrl-click: new tab</span></span>
    </button>
  )
}

/** Full-screen site viewer (fills the monitor). Esc or ✕ to leave. */
export function FullScreenPreview({ site, onClose }) {
  useEffect(() => {
    if (!site) return
    const onFs = () => !document.fullscreenElement && onClose()
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [site, onClose])
  const close = () => {
    exitFullscreen()
    onClose()
  }
  return (
    <Modal open={!!site} onClose={close} size="immersive">
      {site && <FullPreview s={site} onClose={close} />}
    </Modal>
  )
}

function FullPreview({ s, onClose }) {
  const [device, setDevice] = useState('desktop')
  const d = DEVICES[device]
  const w = { desktop: '100%', tablet: '820px', mobile: '390px' }[device]
  return (
    <>
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{s.repo.name}</h2>
        <span className="url-pill" style={{ maxWidth: 420 }}>{s.url}</span>
        <div className="grow" />
        <Seg id="fulldevice" value={device} onChange={setDevice} options={[
          { value: 'desktop', icon: <Monitor size={15} />, label: 'Desktop' },
          { value: 'tablet', icon: <Tablet size={15} />, label: 'Tablet' },
          { value: 'mobile', icon: <Smartphone size={15} />, label: 'Mobile' },
        ]} />
        <a className="btn" href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> New tab</a>
        <button className="btn icon" onClick={onClose} aria-label="Exit full screen" title="Exit full screen (Esc)"><X size={18} /></button>
      </div>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: 0 }}>
        <motion.div layout transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          style={{ width: w, maxWidth: '100%', height: '100%', borderRadius: device === 'desktop' ? 12 : 28, overflow: 'hidden', border: '1px solid var(--line-2)', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)', background: '#fff' }}>
          <iframe src={s.url} title={s.url} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', border: 0 }} data-width={d.width} />
        </motion.div>
      </div>
    </>
  )
}
