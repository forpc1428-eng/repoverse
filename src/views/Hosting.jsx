import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, ExternalLink, RotateCw, Search, Cloud, Github, LayoutDashboard, X, KeyRound, ArrowRight } from 'lucide-react'
import { Glass, Modal, Seg, Spinner, Field, useToast } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { go } from '../lib/router'
import { PROVIDERS, identify, listProjects, redeploy, loadHostAccounts, saveHostAccounts } from '../lib/hosting'
import { timeAgo } from '../lib/util'

const STATE = { ready: ['#34d399', 'Ready'], building: ['#fbbf24', 'Building'], error: ['#f87171', 'Error'], unknown: ['#9ca3af', 'No deploys'] }

export default function Hosting() {
  const { settings: s } = useSettings()
  const { repos } = useAuth()
  const { toast, confirm } = useToast()
  const enabled = Object.keys(PROVIDERS).filter((p) => s[p === 'vercel' ? 'fVercel' : 'fNetlify'] !== false)
  const [provider, setProvider] = useState(enabled[0] || 'vercel')
  const [accounts, setAccounts] = useState(null)
  const [activeId, setActiveId] = useState({})
  const [scope, setScope] = useState('')
  const [projects, setProjects] = useState(null)
  const [q, setQ] = useState('')
  const [connect, setConnect] = useState(false)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    loadHostAccounts().then(setAccounts)
  }, [])
  const mine = (accounts || []).filter((a) => a.provider === provider)
  const acc = mine.find((a) => a.username === activeId[provider]) || mine[0]

  const load = useCallback(async () => {
    if (!acc) return setProjects([])
    setProjects(null)
    try {
      setProjects(await listProjects(acc, scope))
    } catch (e) {
      toast(e.message, 'error')
      setProjects([])
    }
  }, [acc?.username, acc?.provider, scope]) // eslint-disable-line
  useEffect(() => {
    load()
  }, [load])

  const save = async (list) => {
    setAccounts(list)
    await saveHostAccounts(list)
  }
  const remove = async (a) => {
    if (!(await confirm({ title: `Disconnect ${a.name}?`, body: `Removes this ${PROVIDERS[a.provider].name} account from this device. Nothing changes on ${PROVIDERS[a.provider].name}.`, okLabel: 'Disconnect', danger: true }))) return
    save(accounts.filter((x) => !(x.provider === a.provider && x.username === a.username)))
  }
  const doRedeploy = async (p) => {
    if (!(await confirm({ title: `Redeploy ${p.name}?`, body: `Starts a fresh production deploy on ${PROVIDERS[p.provider].name}.`, okLabel: 'Redeploy' }))) return
    setBusy(p.id)
    try {
      await redeploy(acc, p, scope)
      toast(`${p.name}: deploy started`, 'success')
      setProjects((list) => list.map((x) => (x.id === p.id ? { ...x, state: 'building', updated: new Date().toISOString() } : x)))
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy('')
    }
  }

  const shown = useMemo(() => (projects || []).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())), [projects, q])
  if (!enabled.length) return <Glass className="empty">Vercel and Netlify are both switched off in Customize → Features.</Glass>
  if (!accounts) return <div className="empty"><Spinner size={22} /></div>

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row wrap">
        {enabled.length > 1 && <Seg id="host-prov" value={provider} onChange={(v) => (setProvider(v), setScope(''))} options={enabled.map((p) => ({ value: p, label: PROVIDERS[p].name }))} />}
        <div className="row wrap" style={{ gap: 6 }}>
          {mine.map((a) => (
            <button key={a.username} className={`chip ${a === acc ? 'on' : ''}`} onClick={() => (setActiveId({ ...activeId, [provider]: a.username }), setScope(''))} title={a.name}>
              {a.avatar ? <img src={a.avatar} alt="" style={{ width: 18, height: 18, borderRadius: 99 }} /> : <Cloud size={14} />}
              {a.username}
              <span onClick={(e) => (e.stopPropagation(), remove(a))} style={{ display: 'inline-flex', opacity: 0.6 }} role="button" aria-label="Disconnect"><X size={13} /></span>
            </button>
          ))}
          <button className="chip" onClick={() => setConnect(true)}><Plus size={14} /> Connect {PROVIDERS[provider].name}</button>
        </div>
        <div className="grow" />
        {acc && acc.scopes?.length > 1 && (
          <select className="select" style={{ width: 'auto' }} value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Team">
            {acc.scopes.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
          </select>
        )}
        {acc && (
          <div className="search" style={{ maxWidth: 240 }}>
            <Search size={15} />
            <input className="input" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        {acc && <button className="btn icon" onClick={load} aria-label="Refresh"><RotateCw size={16} /></button>}
      </div>

      {!acc ? (
        <Glass className="empty">
          <Cloud size={30} />
          <h3 style={{ margin: '6px 0' }}>Connect your {PROVIDERS[provider].name} account</h3>
          <p className="muted" style={{ maxWidth: 420, margin: '0 auto 16px' }}>See every project, its live link and deploy status, and redeploy in one click. Connect as many accounts as you like.</p>
          <button className="btn primary" onClick={() => setConnect(true)}><Plus size={15} /> Connect</button>
        </Glass>
      ) : !projects ? (
        <div className="grid">{[1, 2, 3].map((i) => <div key={i} className="shimmer" style={{ height: 130 }} />)}</div>
      ) : !shown.length ? (
        <div className="empty">No projects{q ? ' match' : ' yet'}.</div>
      ) : (
        <div className="grid">
          {shown.map((p, i) => {
            const [color, label] = STATE[p.state] || STATE.unknown
            const gh = p.repo && repos.find((r) => r.full_name.toLowerCase() === p.repo.toLowerCase())
            return (
              <div key={p.id} className="card glass" style={{ '--i': i, cursor: 'default' }}>
                <div className="card-head">
                  <span className="status-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                  <div className="grow">
                    <div className="card-title"><span className="name">{p.name}</span></div>
                    <div className="card-sub">{label} · {timeAgo(p.updated)}{p.framework ? ` · ${p.framework}` : ''}</div>
                  </div>
                </div>
                {p.url && <a className="url-pill" style={{ textDecoration: 'none' }} href={p.url} target="_blank" rel="noopener noreferrer">{p.url.replace(/^https?:\/\//, '')}</a>}
                <div className="card-foot">
                  <div className="row" style={{ gap: 4 }}>
                    {gh ? (
                      <button className="btn ghost sm" onClick={() => go('repo', gh.owner.login, gh.name)} title="Open the GitHub repo in RepoVerse"><Github size={13} /> {gh.name}</button>
                    ) : p.repo ? <span className="faint" style={{ fontSize: 12 }}><Github size={12} /> {p.repo}</span> : null}
                  </div>
                  <div className="row" style={{ gap: 2 }}>
                    {p.url && <a className="btn ghost sm icon" href={p.url} target="_blank" rel="noopener noreferrer" aria-label="Open site" title="Open site"><ExternalLink size={14} /></a>}
                    <a className="btn ghost sm icon" href={p.dashboard} target="_blank" rel="noopener noreferrer" aria-label="Dashboard" title={`${PROVIDERS[p.provider].name} dashboard`}><LayoutDashboard size={14} /></a>
                    <button className="btn sm" onClick={() => doRedeploy(p)} disabled={busy === p.id}>{busy === p.id ? <Spinner size={13} /> : <RotateCw size={13} />} Redeploy</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConnectModal
        open={connect}
        provider={provider}
        onClose={() => setConnect(false)}
        onConnected={async (a) => {
          const list = [...accounts.filter((x) => !(x.provider === a.provider && x.username === a.username)), a]
          await save(list)
          setActiveId({ ...activeId, [a.provider]: a.username })
          setConnect(false)
          toast(`${PROVIDERS[a.provider].name} account ${a.username} connected`, 'success')
        }}
      />
    </div>
  )
}

function ConnectModal({ open, provider, onClose, onConnected }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (open) (setToken(''), setErr(''))
  }, [open])
  const P = PROVIDERS[provider]
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      onConnected(await identify(provider, token.trim()))
    } catch (e2) {
      setErr(e2.status === 401 || e2.status === 403 ? 'That token was not accepted. Check it and try again.' : e2.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose}>
      <h2>Connect {P.name}</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>Two quick steps. The token is encrypted and stays on this device; it is only ever sent to {P.name}.</p>
      <a className="btn" style={{ width: '100%', margin: '8px 0 6px' }} href={P.tokenUrl} target="_blank" rel="noopener noreferrer"><KeyRound size={16} /> 1. Create a token on {P.name} <ExternalLink size={13} /></a>
      <p className="hint" style={{ margin: '0 0 14px' }}>{P.help}</p>
      <form onSubmit={submit}>
        <Field label="2. Paste it here">
          <div className="row">
            <input className="input mono" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} placeholder="token" />
            <button className="btn primary" disabled={!token.trim() || busy} aria-label="Connect">{busy ? <Spinner /> : <ArrowRight size={17} />}</button>
          </div>
        </Field>
        {err && <div className="finding block">{err}</div>}
      </form>
    </Modal>
  )
}
