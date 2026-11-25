import { useMemo, useState } from 'react'
import { LayoutTemplate, UserRound, Globe2, ShieldCheck, ArrowLeft, Eye, Rocket, Check, ExternalLink, Wand2, Archive, FileBadge, AlertTriangle, Lock } from 'lucide-react'
import { Glass, Field, Spinner, Switch, useToast } from '../components/ui'
import Markdown from '../components/Markdown'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { go } from '../lib/router'
import { commitFiles, waitForBranch } from '../lib/push'
import { autoDetails } from '../lib/auto'
import { TEMPLATES, templateFiles, portfolioHtml, profileReadme } from '../lib/templates'
import { b64encodeText, health, langColor, LICENSES, pool, timeAgo } from '../lib/util'

const slug = (s) => s.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)

export default function Tools() {
  const { settings: s } = useSettings()
  const [tool, setTool] = useState(null)
  const tools = [
    s.fPortfolio !== false && { id: 'portfolio', icon: Globe2, title: 'Portfolio site', note: 'Your best repos as a live website, in one click' },
    s.fProfileReadme !== false && { id: 'profile', icon: UserRound, title: 'Profile README', note: 'The intro card on your GitHub profile' },
    s.fTemplates !== false && { id: 'templates', icon: LayoutTemplate, title: 'New from template', note: 'React, landing page, API, Python…' },
    s.fSweep !== false && { id: 'sweep', icon: ShieldCheck, title: 'Health & security sweep', note: 'Find and fix issues across all repos' },
  ].filter(Boolean)

  if (tool)
    return (
      <div className="col" style={{ gap: 14 }}>
        <div><button className="btn ghost sm" style={{ marginLeft: -10 }} onClick={() => setTool(null)}><ArrowLeft size={15} /> All tools</button></div>
        {tool === 'portfolio' && <Portfolio />}
        {tool === 'profile' && <Profile />}
        {tool === 'templates' && <Templates />}
        {tool === 'sweep' && <Sweep />}
      </div>
    )
  return (
    <div className="quick" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
      {tools.map((t) => (
        <button key={t.id} onClick={() => setTool(t.id)} style={{ padding: 20 }}>
          <span className="q-ico" style={{ width: 44, height: 44, borderRadius: 14 }}><t.icon size={21} /></span>
          <span><b style={{ fontSize: 15 }}>{t.title}</b><small>{t.note}</small></span>
        </button>
      ))}
      {!tools.length && <div className="empty">All tools are switched off in Customize → Features.</div>}
    </div>
  )
}

// ------------------------------------------------------------------ shared repo picker
function usePicker(limit = 6) {
  const { repos, user } = useAuth()
  const { userData } = useSettings()
  const own = useMemo(() => repos.filter((r) => !r.fork && !r.archived && !r.private && r.owner.login === user.login), [repos, user.login])
  const initial = useMemo(() => {
    const pinned = userData.pins.filter((f) => own.some((r) => r.full_name === f))
    return new Set(pinned.length ? pinned.slice(0, limit) : [...own].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, limit).map((r) => r.full_name))
  }, [own, userData.pins, limit])
  const [sel, setSel] = useState(initial)
  const chosen = own.filter((r) => sel.has(r.full_name))
  const ui = (
    <Field label={`Featured repos (${chosen.length})`} hint="Public repos only. Starts with your pinned or most-starred.">
      <div className="col" style={{ gap: 4, maxHeight: 260, overflow: 'auto', padding: 4 }}>
        {own.map((r) => (
          <label key={r.id} className="row" style={{ gap: 10, fontSize: 13.5, cursor: 'pointer', padding: '4px 6px', borderRadius: 10 }}>
            <input type="checkbox" checked={sel.has(r.full_name)} onChange={() => setSel((x) => { const n = new Set(x); n.has(r.full_name) ? n.delete(r.full_name) : n.add(r.full_name); return n })} />
            <i className="lang-dot" style={{ background: langColor(r.language) }} />
            <span className="grow">{r.name}</span>
            <span className="faint">★ {r.stargazers_count}</span>
          </label>
        ))}
        {!own.length && <span className="faint">No public repos yet.</span>}
      </div>
    </Field>
  )
  return { chosen, ui }
}

async function ensureRepo(gh, login, name, body) {
  try {
    return await gh.repo(`${login}/${name}`)
  } catch (e) {
    if (e.status !== 404) throw e
    const r = await gh.createRepo({ name, auto_init: true, ...body })
    await waitForBranch(gh, r.full_name, r.default_branch)
    return r
  }
}

// ------------------------------------------------------------------ portfolio
function Portfolio() {
  const { gh, user, demo, addRepo } = useAuth()
  const { settings: s } = useSettings()
  const { toast } = useToast()
  const { chosen, ui } = usePicker(6)
  const [title, setTitle] = useState(`Hi, I'm ${(user.name || user.login).split(' ')[0]}`)
  const [tagline, setTagline] = useState(user.bio || 'Things I build, ship and love.')
  const [target, setTarget] = useState(`${user.login.toLowerCase()}.github.io`)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const html = () => portfolioHtml({ user, title, tagline, repos: chosen, accent: s.c1, accent2: s.c2 })
  const preview = () => window.open(URL.createObjectURL(new Blob([html()], { type: 'text/html' })), '_blank', 'noopener')
  const publish = async () => {
    setBusy(true)
    try {
      const repo = await ensureRepo(gh, user.login, slug(target), { description: 'My portfolio', homepage: '' })
      await commitFiles(gh, repo.full_name, repo.default_branch, [{ path: 'index.html', bytes: new TextEncoder().encode(html()) }, { path: '.nojekyll', bytes: new Uint8Array() }], 'Update portfolio (RepoVerse)')
      await gh.enablePages(repo.full_name, repo.default_branch).catch((e) => (e.status === 409 ? null : Promise.reject(e)))
      const url = repo.name.toLowerCase() === `${user.login.toLowerCase()}.github.io` ? `https://${user.login.toLowerCase()}.github.io/` : `https://${user.login.toLowerCase()}.github.io/${repo.name}/`
      await gh.updateRepo(repo.full_name, { homepage: url }).catch(() => {})
      addRepo(await gh.repo(repo.full_name))
      setDone(url)
      toast('Portfolio published. It goes live in about a minute.', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Glass className="section">
      <h3><Globe2 size={17} /> Portfolio site</h3>
      <div className="split">
        <div>
          <Field label="Headline"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Tagline"><input className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} /></Field>
          <Field label="Publish to repo" hint={`Live at https://${user.login.toLowerCase()}.github.io/${target.toLowerCase() === `${user.login.toLowerCase()}.github.io` ? '' : slug(target) + '/'}`}>
            <input className="input" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        </div>
        <div>{ui}</div>
      </div>
      <div className="row wrap" style={{ marginTop: 6 }}>
        <button className="btn" onClick={preview} disabled={!chosen.length}><Eye size={15} /> Preview</button>
        <button className="btn primary" onClick={publish} disabled={busy || !chosen.length || demo}>{busy ? <Spinner /> : <Rocket size={15} />} Publish</button>
        {done && <a className="btn ghost" href={done} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> {done}</a>}
      </div>
    </Glass>
  )
}

// ------------------------------------------------------------------ profile README
function Profile() {
  const { gh, user, repos, demo } = useAuth()
  const { toast } = useToast()
  const { chosen, ui } = usePicker(5)
  const [about, setAbout] = useState(user.bio || 'I build things for the web and love shipping side projects.')
  const [stats, setStats] = useState(true)
  const [busy, setBusy] = useState(false)
  const topLangs = useMemo(() => {
    const m = {}
    repos.forEach((r) => r.language && (m[r.language] = (m[r.language] || 0) + 1))
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l]) => l)
  }, [repos])
  const md = profileReadme({ user, about, repos: chosen, stats, topLangs })
  const publish = async () => {
    setBusy(true)
    try {
      const repo = await ensureRepo(gh, user.login, user.login, { description: 'My GitHub profile', private: false })
      let sha
      try {
        sha = (await gh.file(repo.full_name, 'README.md', repo.default_branch)).sha
      } catch {}
      await gh.saveFile(repo.full_name, 'README.md', { content: b64encodeText(md), message: 'Update profile README (RepoVerse)', sha, branch: repo.default_branch })
      toast('Profile README published on your GitHub profile', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Glass className="section">
      <h3><UserRound size={17} /> Profile README</h3>
      <div className="split">
        <div>
          <Field label="About you"><textarea className="textarea" style={{ fontFamily: 'var(--font)', fontSize: 14 }} value={about} onChange={(e) => setAbout(e.target.value)} /></Field>
          <div className="row between field"><span>Include a GitHub stats card</span><Switch on={stats} onChange={setStats} label="Stats card" /></div>
          {ui}
          <button className="btn primary" onClick={publish} disabled={busy || demo}>{busy ? <Spinner /> : <Rocket size={15} />} Publish to github.com/{user.login}</button>
        </div>
        <Glass className="section" style={{ maxHeight: 520, overflow: 'auto' }}><Markdown text={md} /></Glass>
      </div>
    </Glass>
  )
}

// ------------------------------------------------------------------ templates
function Templates() {
  const { gh, user, demo, addRepo } = useAuth()
  const { toast } = useToast()
  const [tpl, setTpl] = useState('vite-react')
  const [name, setName] = useState('my-new-project')
  const [description, setDescription] = useState('')
  const [priv, setPriv] = useState(false)
  const [license, setLicense] = useState('mit')
  const [pages, setPages] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = TEMPLATES.find((x) => x.id === tpl)
  const create = async () => {
    setBusy(true)
    try {
      const repo = await gh.createRepo({ name: slug(name), description, private: priv, auto_init: true, license_template: license || undefined })
      await waitForBranch(gh, repo.full_name, repo.default_branch)
      const files = templateFiles(tpl, { name: slug(name), description }).filter((f) => !(license && f.path === 'LICENSE'))
      await commitFiles(gh, repo.full_name, repo.default_branch, files, `Start from ${t.name} template (RepoVerse)`)
      if ((pages || t.pages) && !priv) await gh.enablePages(repo.full_name, repo.default_branch).catch(() => {})
      const fresh = await gh.repo(repo.full_name)
      addRepo(fresh)
      toast(`${fresh.name} created`, 'success')
      go('repo', fresh.owner.login, fresh.name)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Glass className="section">
      <h3><LayoutTemplate size={17} /> New from template</h3>
      <div className="quick" style={{ marginBottom: 16 }}>
        {TEMPLATES.map((x) => (
          <button key={x.id} onClick={() => (setTpl(x.id), setPages(x.pages))} style={tpl === x.id ? { borderColor: 'var(--c3)', background: 'rgba(255,255,255,.09)' } : undefined}>
            {tpl === x.id ? <Check size={16} style={{ color: 'var(--c3)' }} /> : <LayoutTemplate size={16} className="faint" />}
            <span><b>{x.name}</b><small>{x.note}</small></span>
          </button>
        ))}
      </div>
      <div className="split">
        <div>
          <Field label="Repository name" hint={`github.com/${user.login}/${slug(name)}`}><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Description"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></Field>
        </div>
        <div>
          <Field label="License"><select className="select" value={license} onChange={(e) => setLicense(e.target.value)}>{LICENSES.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}</select></Field>
          <div className="row between field"><span>Private</span><Switch on={priv} onChange={setPriv} label="Private" /></div>
          <div className="row between field"><span>Publish with GitHub Pages</span><Switch on={pages && !priv} onChange={setPages} label="Pages" /></div>
        </div>
      </div>
      <button className="btn primary" onClick={create} disabled={busy || !slug(name) || demo}>{busy ? <Spinner /> : <Rocket size={15} />} Create repository</button>
    </Glass>
  )
}

// ------------------------------------------------------------------ sweep
function Sweep() {
  const { gh, user, repos, patchRepo, demo } = useAuth()
  const { settings: s } = useSettings()
  const { toast, confirm } = useToast()
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState(0)
  const mine = repos.filter((r) => r.permissions?.push && !r.archived)

  const scan = async () => {
    setBusy('scan')
    setProgress(0)
    let done = 0
    let securityBlocked = false
    const rows = await pool(mine.slice(0, 80), 4, async (r) => {
      const h = health(r)
      const issues = h.checks.filter((c) => !c.ok && c.key !== 'homepage').map((c) => c.key)
      if (Date.now() - new Date(r.pushed_at) > 365 * 86400000) issues.push('stale')
      if (!r.size) issues.push('empty')
      let dep = null
      let sec = null
      if (s.fSecurityAlerts !== false) {
        dep = await gh.dependabotAlerts(r.full_name).then((a) => a.length).catch((e) => ((e.status === 403 && (securityBlocked = true)), null))
        if (!r.private) sec = await gh.secretAlerts(r.full_name).then((a) => a.length).catch(() => null)
      }
      setProgress(++done)
      return { r, issues, dep, sec }
    })
    setRes({ rows: rows.filter((x) => x.issues.length || x.dep || x.sec), securityBlocked, scanned: rows.length })
    setBusy('')
  }

  const fix = async (label, list, fn, body) => {
    if (!list.length) return
    if (body && !(await confirm({ title: label, body, okLabel: label }))) return
    setBusy(label)
    let ok = 0
    for (const x of list) {
      try {
        await fn(x.r)
        ok++
      } catch (e) {
        toast(`${x.r.name}: ${e.message}`, 'error')
      }
    }
    setBusy('')
    toast(`${label}: ${ok}/${list.length} done`, ok ? 'success' : 'error')
    scan()
  }
  const has = (k) => (res?.rows || []).filter((x) => x.issues.includes(k))
  const missingInfo = (res?.rows || []).filter((x) => x.issues.some((k) => ['description', 'topics'].includes(k)))
  const count = (k) => has(k).length
  const alerts = (res?.rows || []).reduce((n, x) => n + (x.dep || 0) + (x.sec || 0), 0)

  return (
    <Glass className="section">
      <h3><ShieldCheck size={17} /> Health & security sweep <span className="grow" />
        <button className="btn sm primary" onClick={scan} disabled={!!busy}>{busy === 'scan' ? <><Spinner size={13} /> {progress}/{Math.min(mine.length, 80)}</> : 'Run sweep'}</button>
      </h3>
      {!res ? (
        <p className="muted" style={{ margin: 0 }}>Checks every repo you can edit for missing descriptions, topics and licenses, stale or empty repos{s.fSecurityAlerts !== false ? ', and GitHub security alerts' : ''}.</p>
      ) : (
        <>
          <div className="hero-stats" style={{ marginTop: 0 }}>
            <span className="hero-stat"><b>{res.scanned}</b> scanned</span>
            <span className="hero-stat"><b>{count('description')}</b> no description</span>
            <span className="hero-stat"><b>{count('topics')}</b> no topics</span>
            <span className="hero-stat"><b>{count('license')}</b> no license</span>
            <span className="hero-stat"><b>{count('stale')}</b> stale (1y+)</span>
            <span className="hero-stat"><b>{count('empty')}</b> empty</span>
            {s.fSecurityAlerts !== false && <span className="hero-stat" style={alerts ? { borderColor: 'rgba(248,113,113,.5)' } : undefined}><b>{alerts}</b> security alerts</span>}
          </div>
          {res.securityBlocked && <div className="finding warn" style={{ marginTop: 12 }}><Lock size={15} /> Security alerts need one more permission: sign in again (avatar → Add account → pick yourself).</div>}
          <div className="row wrap" style={{ margin: '14px 0' }}>
            <button className="btn sm" disabled={!!busy || !missingInfo.length || demo} onClick={() => fix('Auto-fill info', missingInfo, async (r) => {
              const a = await autoDetails(gh, r)
              if (!r.description) patchRepo(r.full_name, await gh.updateRepo(r.full_name, { description: a.description }))
              if (!(r.topics || []).length && a.topics.length) patchRepo(r.full_name, { topics: (await gh.setTopics(r.full_name, a.topics)).names })
            }, `Fill missing descriptions and topics for ${missingInfo.length} repos? Existing text is kept.`)}><Wand2 size={14} /> Auto-fill info ({missingInfo.length})</button>
            <button className="btn sm" disabled={!!busy || !count('license') || demo} onClick={() => fix('Add MIT license', has('license'), async (r) => {
              const lic = await gh.get('/licenses/mit')
              await gh.saveFile(r.full_name, 'LICENSE', { content: b64encodeText(lic.body.replace('[year]', new Date().getFullYear()).replace('[fullname]', user.name || user.login)), message: 'Add MIT license', branch: r.default_branch })
            }, `Add an MIT license to ${count('license')} repos?`)}><FileBadge size={14} /> Add MIT license ({count('license')})</button>
            <button className="btn sm" disabled={!!busy || !count('stale') || demo} onClick={() => fix('Archive stale', has('stale'), async (r) => patchRepo(r.full_name, await gh.updateRepo(r.full_name, { archived: true })),
              `Archive ${count('stale')} repos not updated in over a year? They become read-only; you can unarchive any time.`)}><Archive size={14} /> Archive stale ({count('stale')})</button>
          </div>
          <div className="col" style={{ gap: 2 }}>
            {res.rows.map(({ r, issues, dep, sec }) => (
              <div key={r.id} className="list-row" style={{ padding: '10px 6px' }} onClick={() => go('repo', r.owner.login, r.name)}>
                <span className="grow" style={{ fontWeight: 600 }}>{r.name}</span>
                {issues.map((k) => <span key={k} className="tag">{k}</span>)}
                {dep ? <span className="tag" style={{ color: '#fca5a5' }}><AlertTriangle size={11} /> {dep} dependency</span> : null}
                {sec ? <span className="tag" style={{ color: '#fca5a5' }}><AlertTriangle size={11} /> {sec} secret</span> : null}
                <span className="faint" style={{ fontSize: 12 }}>{timeAgo(r.pushed_at)}</span>
              </div>
            ))}
            {!res.rows.length && <div className="empty">Everything looks healthy. 🌙</div>}
          </div>
        </>
      )}
    </Glass>
  )
}
