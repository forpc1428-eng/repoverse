import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Monitor, Tablet, Smartphone, Maximize2, ExternalLink, Activity, Search, Image as ImageIcon, Radio, MonitorPlay, Settings2 } from 'lucide-react'
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
    if (sites.length && !Object.keys(status).length) checkAll()
  }, [sites.length]) // eslint-disable-line

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
        <Seg id="wallmode" value={settings.wallMode} onChange={(v) => update({ wallMode: v })} options={[
          { value: 'live', icon: <Radio size={15} />, label: 'Live' },
          { value: 'snapshot', icon: <ImageIcon size={15} />, label: 'Snapshot' },
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
        {sites.map((s, i) => (
          <motion.div key={s.repo.id} initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: Math.min(i, 12) * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
            <SiteCard s={s} st={status[s.url]} device={device} mode={settings.fLivePreviews === false ? 'snapshot' : settings.wallMode} onFull={() => setFull(s)} />
          </motion.div>
        ))}
      </div>

      <Modal open={!!full} onClose={() => setFull(null)} size="full">
        {full && <FullPreview s={full} />}
      </Modal>
    </div>
  )
}

function SiteCard({ s, st, device, mode, onFull }) {
  const [loaded, setLoaded] = useState(false)
  const d = DEVICES[device]
  const snapshot = `https://opengraph.githubassets.com/1/${s.repo.full_name}`
  return (
    <Glass className="shot card" style={{ cursor: 'default' }}>
      <div className="shot-bar">
        <span className={`status-dot ${st ? st.state : 'unknown'}`} title={st ? `${st.state}${st.ms ? ` · ${st.ms} ms` : ''}` : 'Not checked'} />
        <b style={{ fontSize: 13.5, whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => go('repo', s.repo.owner.login, s.repo.name)}>{s.repo.name}</b>
        <div className="url-pill">{s.url.replace(/^https?:\/\//, '')}</div>
        {st?.ms && <span className="faint" style={{ fontSize: 11.5 }}>{st.ms}ms</span>}
        <button className="btn ghost sm icon" onClick={onFull} title="Full screen"><Maximize2 size={14} /></button>
        <a className="btn ghost sm icon" href={s.url} target="_blank" rel="noopener noreferrer" title="Open"><ExternalLink size={14} /></a>
      </div>
      <div className="viewport" style={{ aspectRatio: d.aspect }}>
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

function FullPreview({ s }) {
  const [device, setDevice] = useState('desktop')
  const d = DEVICES[device]
  const w = { desktop: '100%', tablet: '820px', mobile: '390px' }[device]
  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>{s.repo.name}</h2>
        <span className="url-pill" style={{ maxWidth: 420 }}>{s.url}</span>
        <div className="grow" />
        <Seg id="fulldevice" value={device} onChange={setDevice} options={[
          { value: 'desktop', icon: <Monitor size={15} />, label: 'Desktop' },
          { value: 'tablet', icon: <Tablet size={15} />, label: 'Tablet' },
          { value: 'mobile', icon: <Smartphone size={15} />, label: 'Mobile' },
        ]} />
        <a className="btn" href={s.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Open</a>
      </div>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: 0 }}>
        <motion.div layout transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          style={{ width: w, maxWidth: '100%', height: '100%', borderRadius: device === 'desktop' ? 14 : 28, overflow: 'hidden', border: '1px solid var(--stroke)', boxShadow: '0 30px 80px -20px rgba(0,0,0,.7)', background: '#fff' }}>
          <iframe src={s.url} title={s.url} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', border: 0 }} data-width={d.width} />
        </motion.div>
      </div>
    </>
  )
}
