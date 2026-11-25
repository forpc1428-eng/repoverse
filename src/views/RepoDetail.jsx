import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Star, GitFork, Eye, ExternalLink, Github, Lock, Globe, CheckCircle2, XCircle, FileCode2, BookOpen, Settings2, Activity, LayoutDashboard,
  Folder, File, FilePlus2, Trash2, Save, Wand2, Rocket, Tag as TagIcon, CircleDot, GitPullRequest, PlayCircle, Plus, X, Copy, Image as ImageIcon,
} from 'lucide-react'
import { Glass, Modal, Spinner, Switch, Tabs, Field, Ring, useToast } from '../components/ui'
import Markdown from '../components/Markdown'
import ScaledFrame from '../components/ScaledFrame'
import { autoDetails } from '../lib/auto'
import { PreviewHit, FullScreenPreview, enterFullscreen } from './Wall'
import { initials } from './Repos'
import { useAuth } from '../lib/auth'
import { go } from '../lib/router'
import { b64decodeBytes, b64encodeText, bytes, fmt, health, healthColor, langColor, looksBinary, siteUrl, timeAgo, b64encodeBytes } from '../lib/util'

const CodeEditor = lazy(() => import('../components/CodeEditor'))

export default function RepoDetail({ owner, name, tab, path }) {
  const { repos, gh, patchRepo } = useAuth()
  const full = `${owner}/${name}`
  const cached = repos.find((r) => r.full_name.toLowerCase() === full.toLowerCase())
  const [repo, setRepo] = useState(cached || null)
  const [err, setErr] = useState('')

  useEffect(() => {
    gh.repo(full)
      .then((r) => {
        setRepo(r)
        patchRepo(r.full_name, r)
      })
      .catch((e) => setErr(e.message))
  }, [full, gh, patchRepo])

  const setTab = (t) => go('repo', owner, name, t)
  if (err && !repo) return <Glass className="empty">{err}</Glass>
  if (!repo) return <div className="empty"><Spinner size={26} /></div>

  const tabs = [
    { value: 'overview', label: 'Overview', icon: <LayoutDashboard size={15} /> },
    { value: 'files', label: 'Files', icon: <FileCode2 size={15} /> },
    { value: 'readme', label: 'README Studio', icon: <BookOpen size={15} /> },
    { value: 'activity', label: 'Activity', icon: <Activity size={15} /> },
    { value: 'settings', label: 'Settings', icon: <Settings2 size={15} /> },
  ]
  const update = (r) => {
    setRepo((x) => ({ ...x, ...r }))
    patchRepo(repo.full_name, r)
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row wrap" style={{ gap: 12 }}>
        <button className="btn" onClick={() => go('repos')}><ArrowLeft size={16} /> All repos</button>
        <Tabs id="repo-tabs" value={tab} onChange={setTab} tabs={tabs} />
      </div>
      {tab === 'overview' && <Overview repo={repo} update={update} setTab={setTab} />}
      {tab === 'files' && <Files repo={repo} initialPath={path} />}
      {tab === 'readme' && <ReadmeStudio repo={repo} />}
      {tab === 'activity' && <ActivityTab repo={repo} />}
      {tab === 'settings' && <SettingsTab repo={repo} update={update} />}
    </div>
  )
}

// ======================================================= Overview
function Overview({ repo, update, setTab }) {
  const { gh, user } = useAuth()
  const { toast } = useToast()
  const [langs, setLangs] = useState(null)
  const [fixing, setFixing] = useState('')
  const [full, setFull] = useState(false)
  const h = health(repo)
  const site = siteUrl(repo)

  useEffect(() => {
    gh.languages(repo.full_name).then(setLangs).catch(() => setLangs({}))
  }, [gh, repo.full_name])
  const total = langs ? Object.values(langs).reduce((a, b) => a + b, 0) : 0

  const addLicense = async () => {
    setFixing('license')
    try {
      const lic = await gh.get('/licenses/mit')
      const body = lic.body.replace('[year]', new Date().getFullYear()).replace('[fullname]', user.name || user.login)
      await gh.saveFile(repo.full_name, 'LICENSE', { content: b64encodeText(body), message: 'Add MIT license', branch: repo.default_branch })
      update(await gh.repo(repo.full_name))
      toast('MIT license added', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setFixing('')
    }
  }
  const autoFix = async (key) => {
    setFixing(key)
    try {
      const a = await autoDetails(gh, repo)
      if (key === 'description') update(await gh.updateRepo(repo.full_name, { description: a.description }))
      if (key === 'topics') {
        if (!a.topics.length) throw new Error('No topics could be worked out for this repo.')
        const t = await gh.setTopics(repo.full_name, a.topics)
        update({ topics: t.names })
      }
      if (key === 'homepage') {
        if (!a.homepage) return setTab('settings'), toast('No website found. Enable GitHub Pages in Settings.', 'info')
        update(await gh.updateRepo(repo.full_name, { homepage: a.homepage }))
      }
      toast('Fixed automatically. Edit it any time in Settings.', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setFixing('')
    }
  }
  const fixes = { description: () => autoFix('description'), topics: () => autoFix('topics'), homepage: () => autoFix('homepage'), license: addLicense }

  return (
    <div className="col" style={{ gap: 16 }}>
      <Glass className="repo-hero" liquid style={{ '--accent': repo.language ? langColor(repo.language) : 'var(--c1)' }}>
        {!repo.private && <div className="cover" style={{ backgroundImage: `url(https://opengraph.githubassets.com/1/${repo.full_name})` }} />}
        <div className="cover-tint" />
        <div className="row between wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
          <div className="row grow" style={{ gap: 18, alignItems: 'flex-start', minWidth: 280 }}>
            <div className="monogram xl">{initials(repo.name)}</div>
            <div className="grow">
              <div className="row wrap" style={{ gap: 10 }}>
                <h2>{repo.name}</h2>
                <span className="badge">{repo.private ? <><Lock size={10} /> private</> : <><Globe size={10} /> public</>}</span>
                {repo.archived && <span className="badge">archived</span>}
                {repo.fork && <span className="badge">fork</span>}
              </div>
              <p className="muted" style={{ margin: '6px 0 12px', maxWidth: 720, fontSize: 15 }}>{repo.description || 'No description yet.'}</p>
              <div className="row wrap" style={{ gap: 6 }}>{(repo.topics || []).map((t) => <span key={t} className="tag">{t}</span>)}</div>
            </div>
          </div>
          <div className="row wrap">
            <button className="btn" onClick={() => navigator.clipboard.writeText(repo.clone_url).then(() => toast('Clone URL copied', 'success'))}><Copy size={16} /> Clone</button>
            <a className="btn" href={repo.html_url} target="_blank" rel="noopener noreferrer"><Github size={16} /> GitHub</a>
            {site && <a className="btn primary" href={site} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Live site</a>}
          </div>
        </div>
        <div className="divider" style={{ margin: '20px 0 16px' }} />
        <div className="metrics">
          {[
            ['Stars', fmt(repo.stargazers_count)],
            ['Forks', fmt(repo.forks_count)],
            ['Watching', fmt(repo.subscribers_count ?? repo.watchers_count)],
            ['Open issues', repo.open_issues_count],
            ['Size', bytes(repo.size * 1024)],
            ['Last push', timeAgo(repo.pushed_at)],
            ['Created', new Date(repo.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })],
          ].map(([k, v]) => (
            <div key={k} className="metric"><span>{k}</span><b>{v}</b></div>
          ))}
        </div>
      </Glass>

      <div className="widgets">
        <Glass className="section widget" style={{ '--span': 6 }}>
          <h3>Languages</h3>
          {!langs ? <div className="shimmer" style={{ height: 60 }} /> : !total ? <div className="faint">No code detected</div> : (
            <>
              <div className="bar" style={{ height: 12, marginBottom: 14 }}>
                {Object.entries(langs).map(([l, n]) => <i key={l} style={{ width: `${(n / total) * 100}%`, background: langColor(l) }} title={l} />)}
              </div>
              <div className="row wrap" style={{ gap: 14 }}>
                {Object.entries(langs).map(([l, n]) => (
                  <span key={l} className="meta" style={{ color: 'var(--text-2)' }}><i className="lang-dot" style={{ background: langColor(l) }} />{l} <span className="faint">{((n / total) * 100).toFixed(1)}%</span></span>
                ))}
              </div>
            </>
          )}
        </Glass>
        <Glass className="section widget" style={{ '--span': 6 }}>
          <h3><Ring value={h.score} color={healthColor(h.score)} /> Repo health</h3>
          <div className="col" style={{ gap: 8 }}>
            {h.checks.map((c) => (
              <div key={c.key} className="row" style={{ fontSize: 13.5 }}>
                {c.ok ? <CheckCircle2 size={16} color="#34d399" /> : <XCircle size={16} color="#f87171" />}
                <span className="grow">{c.label}</span>
                {!c.ok && fixes[c.key] && (
                  <button className="btn sm" onClick={fixes[c.key]} disabled={fixing === c.key}>
                    {fixing === c.key ? <Spinner size={13} /> : <Wand2 size={13} />} Fix
                  </button>
                )}
              </div>
            ))}
          </div>
        </Glass>
      </div>

      {site && (
        <Glass className="shot" lit={false}>
          <div className="shot-bar"><div className="dots"><i /><i /><i /></div><div className="url-pill">{site}</div>
            <a className="btn sm" href={site} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> New tab</a>
          </div>
          <div className="viewport" style={{ aspectRatio: '16/8' }}>
            <PreviewHit url={site} onFull={() => (setFull(true), enterFullscreen())} />
            <ScaledFrame src={site} />
          </div>
        </Glass>
      )}
      <FullScreenPreview site={full && site ? { url: site, repo } : null} onClose={() => setFull(false)} />
    </div>
  )
}

// ======================================================= Files
function Files({ repo, initialPath }) {
  const { gh } = useAuth()
  const { toast, confirm } = useToast()
  const [branch, setBranch] = useState(repo.default_branch)
  const [branches, setBranches] = useState([])
  const [tree, setTree] = useState(null)
  const [truncated, setTruncated] = useState(false)
  const [open, setOpen] = useState(new Set())
  const [file, setFile] = useState(null)
  const [loadingFile, setLoadingFile] = useState(false)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  const loadTree = useCallback(() => {
    setTree(null)
    return gh
      .tree(repo.full_name, branch)
      .then((t) => {
        setTree(t.tree)
        setTruncated(t.truncated)
      })
      .catch((e) => {
        setTree([])
        if (e.status !== 409) toast(e.message, 'error') // 409 = empty repo
      })
  }, [gh, repo.full_name, branch, toast])

  useEffect(() => {
    gh.branches(repo.full_name).then(setBranches).catch(() => {})
  }, [gh, repo.full_name])
  useEffect(() => {
    loadTree()
  }, [loadTree])

  const openFile = useCallback(
    async (p) => {
      setLoadingFile(true)
      try {
        const f = await gh.file(repo.full_name, p, branch)
        let u8 = f.content ? b64decodeBytes(f.content) : null
        if (!u8 && f.sha) u8 = b64decodeBytes((await gh.blob(repo.full_name, f.sha)).content) // files > 1 MB
        const binary = looksBinary(u8)
        const ext = p.split('.').pop().toLowerCase()
        const img = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'avif'].includes(ext)
        const text = binary ? '' : new TextDecoder().decode(u8)
        setFile({
          path: p, sha: f.sha, size: f.size, text, original: text, binary,
          image: img ? `data:${ext === 'svg' ? 'image/svg+xml' : 'image/' + (ext === 'jpg' ? 'jpeg' : ext)};base64,${b64encodeBytes(u8)}` : null,
        })
        setMsg(`Update ${p}`)
        // expand parent folders
        setOpen((o) => {
          const n = new Set(o)
          p.split('/').slice(0, -1).forEach((_, i, arr) => n.add(arr.slice(0, i + 1).join('/')))
          return n
        })
      } catch (e) {
        toast(e.message, 'error')
      } finally {
        setLoadingFile(false)
      }
    },
    [gh, repo.full_name, branch, toast]
  )

  useEffect(() => {
    if (initialPath && tree?.length) openFile(initialPath)
  }, [initialPath, tree?.length]) // eslint-disable-line

  const save = async () => {
    setSaving(true)
    try {
      const res = await gh.saveFile(repo.full_name, file.path, { content: b64encodeText(file.text), message: msg || `Update ${file.path}`, sha: file.sha, branch })
      setFile((f) => ({ ...f, sha: res.content.sha, original: f.text, isNew: false }))
      toast(`Committed ${file.path}`, 'success')
      if (file.isNew) loadTree()
    } catch (e) {
      toast(e.status === 409 ? 'This file changed on GitHub since you opened it. Reopen it to get the latest version.' : e.message, 'error')
    } finally {
      setSaving(false)
    }
  }
  const newFile = () => {
    const p = prompt('New file path (e.g. src/utils.js):')?.trim().replace(/^\/+/, '')
    if (!p) return
    setFile({ path: p, sha: undefined, text: '', original: null, binary: false, isNew: true })
    setMsg(`Create ${p}`)
  }
  const remove = async () => {
    if (!(await confirm({ title: 'Delete file', body: `Delete ${file.path} from ${branch}? This creates a commit (you can restore it from history).`, danger: true, okLabel: 'Delete' }))) return
    try {
      await gh.deleteFile(repo.full_name, file.path, { message: `Delete ${file.path}`, sha: file.sha, branch })
      toast('File deleted', 'success')
      setFile(null)
      loadTree()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  // Build nested structure
  const nodes = useMemo(() => {
    if (!tree) return []
    const t = filter.toLowerCase()
    if (t) return tree.filter((n) => n.type === 'blob' && n.path.toLowerCase().includes(t)).map((n) => ({ ...n, depth: 0, label: n.path }))
    const out = []
    const children = new Map()
    tree.forEach((n) => {
      const parent = n.path.includes('/') ? n.path.slice(0, n.path.lastIndexOf('/')) : ''
      if (!children.has(parent)) children.set(parent, [])
      children.get(parent).push(n)
    })
    const walk = (parent, depth) => {
      const list = (children.get(parent) || []).sort((a, b) => (a.type === b.type ? a.path.localeCompare(b.path) : a.type === 'tree' ? -1 : 1))
      list.forEach((n) => {
        out.push({ ...n, depth, label: n.path.split('/').pop() })
        if (n.type === 'tree' && open.has(n.path)) walk(n.path, depth + 1)
      })
    }
    walk('', 0)
    return out
  }, [tree, open, filter])

  const dirty = file && file.text !== file.original

  return (
    <div className="files">
      <Glass className="tree" lit={false}>
        <div className="row" style={{ marginBottom: 8, gap: 6 }}>
          <select className="select" value={branch} onChange={(e) => (setBranch(e.target.value), setFile(null))} style={{ padding: '6px 10px', fontSize: 13 }}>
            {(branches.length ? branches.map((b) => b.name) : [branch]).map((b) => <option key={b}>{b}</option>)}
          </select>
          <button className="btn sm icon" title="New file" onClick={newFile}><FilePlus2 size={15} /></button>
        </div>
        <input className="input" style={{ padding: '6px 10px', fontSize: 13, marginBottom: 8 }} placeholder="Filter files…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {!tree ? <div className="empty"><Spinner /></div> : !tree.length ? <div className="faint" style={{ padding: 10 }}>Empty repository. Create a file to start.</div> : (
          nodes.map((n) => (
            <div
              key={n.path}
              className={`tree-item ${file?.path === n.path ? 'on' : ''}`}
              style={{ paddingLeft: 8 + n.depth * 14 }}
              onClick={() => (n.type === 'tree' ? setOpen((o) => { const s = new Set(o); s.has(n.path) ? s.delete(n.path) : s.add(n.path); return s }) : openFile(n.path))}
              title={n.path}
            >
              {n.type === 'tree' ? <Folder size={14} style={{ color: 'var(--c2)', flex: 'none' }} /> : <File size={14} style={{ flex: 'none', opacity: 0.6 }} />}
              {n.label}
            </div>
          ))
        )}
        {truncated && <div className="hint" style={{ padding: 8 }}>This repository is very large; some files are not listed.</div>}
      </Glass>

      <Glass className="editor-wrap" lit={false}>
        {loadingFile ? <div className="empty"><Spinner size={22} /></div> : !file ? (
          <div className="empty"><FileCode2 size={30} /><div>Pick a file to view or edit it</div></div>
        ) : (
          <>
            <div className="row" style={{ padding: '10px 12px', borderBottom: '1px solid var(--stroke-soft)', gap: 8 }}>
              <span className="mono grow" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.path}{dirty && <span style={{ color: 'var(--c2)' }}> ●</span>}</span>
              {file.size != null && <span className="faint" style={{ fontSize: 12 }}>{bytes(file.size)}</span>}
              {!file.isNew && <button className="btn sm danger" onClick={remove}><Trash2 size={14} /></button>}
            </div>
            {file.image ? (
              <div style={{ padding: 30, display: 'grid', placeItems: 'center', flex: 1 }}>
                <img src={file.image} alt={file.path} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 12 }} />
              </div>
            ) : file.binary ? (
              <div className="empty"><ImageIcon size={26} /><div>Binary file, can't be edited here.</div></div>
            ) : (
              <>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <Suspense fallback={<div className="empty"><Spinner /></div>}>
                    <CodeEditor value={file.text} filename={file.path} onChange={(v) => setFile((f) => ({ ...f, text: v }))} />
                  </Suspense>
                </div>
                <div className="row" style={{ padding: 12, borderTop: '1px solid var(--stroke-soft)' }}>
                  <input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Commit message" />
                  <button className="btn primary" disabled={!dirty && !file.isNew || saving} onClick={save}>
                    {saving ? <Spinner /> : <Save size={16} />} Commit to {branch}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </Glass>
    </div>
  )
}

// ======================================================= README Studio
const TEMPLATES = {
  'Hero header': (r) => `<div align="center">\n\n# ${r.name}\n\n**${r.description || 'One line that explains what this does.'}**\n\n[Live demo](${siteUrl(r) || '#'}) · [Report bug](${r.html_url}/issues) · [Request feature](${r.html_url}/issues)\n\n</div>\n`,
  Features: () => `\n## ✨ Features\n\n- ⚡ Fast: \n- 🎨 Beautiful: \n- 🔒 Secure: \n`,
  'Getting started': (r) => `\n## 🚀 Getting started\n\n\`\`\`bash\ngit clone ${r.clone_url}\ncd ${r.name}\nnpm install\nnpm run dev\n\`\`\`\n`,
  Screenshots: () => `\n## 📸 Screenshots\n\n| Home | Detail |\n|---|---|\n| ![](docs/home.png) | ![](docs/detail.png) |\n`,
  'Tech stack': (r) => `\n## 🛠 Tech stack\n\n- ${r.language || 'Language'}\n`,
  Contributing: () => `\n## 🤝 Contributing\n\n1. Fork the repo\n2. Create a branch: \`git checkout -b feature/amazing\`\n3. Commit: \`git commit -m "Add amazing feature"\`\n4. Push and open a pull request\n`,
  License: (r) => `\n## 📄 License\n\n${r.license ? `Released under the ${r.license.name}.` : 'MIT'}\n`,
  'Stats badges': (r) => `\n![Stars](https://img.shields.io/github/stars/${r.full_name}?style=for-the-badge) ![Forks](https://img.shields.io/github/forks/${r.full_name}?style=for-the-badge) ![Last commit](https://img.shields.io/github/last-commit/${r.full_name}?style=for-the-badge)\n`,
}

function ReadmeStudio({ repo }) {
  const { gh } = useAuth()
  const { toast } = useToast()
  const [state, setState] = useState(null) // {path, sha, text, original}
  const [msg, setMsg] = useState('Update README')
  const [saving, setSaving] = useState(false)
  const [badge, setBadge] = useState({ label: 'made with', message: 'love', color: '8b5cf6' })

  useEffect(() => {
    gh.readme(repo.full_name)
      .then((r) => {
        const text = new TextDecoder().decode(b64decodeBytes(r.content))
        setState({ path: r.path, sha: r.sha, text, original: text })
      })
      .catch(() => setState({ path: 'README.md', sha: undefined, text: '', original: '' }))
  }, [gh, repo.full_name])

  if (!state) return <div className="empty"><Spinner size={24} /></div>
  const insert = (s) => setState((x) => ({ ...x, text: x.text + s }))
  const save = async () => {
    setSaving(true)
    try {
      const res = await gh.saveFile(repo.full_name, state.path, { content: b64encodeText(state.text), message: msg, sha: state.sha, branch: repo.default_branch })
      setState((x) => ({ ...x, sha: res.content.sha, original: x.text }))
      toast('README committed', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }
  const badgeUrl = `https://img.shields.io/badge/${encodeURIComponent(badge.label.replace(/-/g, '--'))}-${encodeURIComponent(badge.message.replace(/-/g, '--'))}-${badge.color.replace('#', '')}?style=for-the-badge`

  return (
    <div className="col" style={{ gap: 14 }}>
      <Glass className="section" lit={false} style={{ padding: 14 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="faint" style={{ fontSize: 13 }}>Insert:</span>
          {Object.entries(TEMPLATES).map(([k, fn]) => <button key={k} className="chip" onClick={() => insert(fn(repo))}><Plus size={12} /> {k}</button>)}
        </div>
        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          <span className="faint" style={{ fontSize: 13 }}>Badge builder:</span>
          <input className="input" style={{ width: 120, padding: '6px 10px' }} value={badge.label} onChange={(e) => setBadge({ ...badge, label: e.target.value })} />
          <input className="input" style={{ width: 120, padding: '6px 10px' }} value={badge.message} onChange={(e) => setBadge({ ...badge, message: e.target.value })} />
          <input type="color" value={'#' + badge.color.replace('#', '')} onChange={(e) => setBadge({ ...badge, color: e.target.value.slice(1) })} style={{ width: 34, height: 34 }} />
          <img src={badgeUrl} alt="badge preview" referrerPolicy="no-referrer" style={{ height: 24 }} />
          <button className="btn sm" onClick={() => insert(`\n![${badge.label}](${badgeUrl})\n`)}>Insert badge</button>
        </div>
      </Glass>
      <div className="split">
        <Glass className="editor-wrap" lit={false}>
          <div className="row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--stroke-soft)' }}>
            <span className="mono grow" style={{ fontSize: 13 }}>{state.path}{state.text !== state.original && <span style={{ color: 'var(--c2)' }}> ●</span>}</span>
          </div>
          <Suspense fallback={<div className="empty"><Spinner /></div>}>
            <CodeEditor value={state.text} filename="README.md" onChange={(v) => setState((x) => ({ ...x, text: v }))} height="64vh" />
          </Suspense>
        </Glass>
        <Glass className="section" lit={false} style={{ maxHeight: 'calc(64vh + 46px)', overflow: 'auto' }}>
          {state.text.trim() ? <Markdown text={state.text} repo={repo.full_name} branch={repo.default_branch} /> : <div className="empty">Start writing, or insert a template above ↑</div>}
        </Glass>
      </div>
      <Glass className="row" lit={false} style={{ padding: 12 }}>
        <input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} />
        <button className="btn primary" onClick={save} disabled={saving || state.text === state.original}>{saving ? <Spinner /> : <Save size={16} />} Commit README</button>
      </Glass>
    </div>
  )
}

// ======================================================= Activity
function ActivityTab({ repo }) {
  const { gh } = useAuth()
  const { toast } = useToast()
  const [data, setData] = useState({})
  const [newRelease, setNewRelease] = useState(false)
  const [newIssue, setNewIssue] = useState(false)
  const load = useCallback(() => {
    const f = repo.full_name
    const safe = (p) => p.catch(() => null)
    Promise.all([safe(gh.releases(f)), safe(gh.issues(f)), safe(gh.pulls(f)), safe(gh.runs(f))]).then(([releases, issues, pulls, runs]) =>
      setData({ releases: releases || [], issues: (issues || []).filter((i) => !i.pull_request), pulls: pulls || [], runs: runs?.workflow_runs || [] })
    )
  }, [gh, repo.full_name])
  useEffect(load, [load])
  if (!data.releases) return <div className="empty"><Spinner size={24} /></div>

  const runColor = (r) => (r.status !== 'completed' ? '#fbbf24' : r.conclusion === 'success' ? '#34d399' : '#f87171')

  return (
    <div className="widgets">
      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><Rocket size={16} /> Releases <span className="grow" /><button className="btn sm" onClick={() => setNewRelease(true)}><Plus size={14} /> New release</button></h3>
        {!data.releases.length ? <div className="faint">No releases yet</div> : data.releases.map((r) => (
          <a key={r.id} className="list-row" href={r.html_url} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 4px', textDecoration: 'none' }}>
            <TagIcon size={15} className="faint" /><b>{r.tag_name}</b><span className="grow muted">{r.name}</span><span className="faint" style={{ fontSize: 12 }}>{timeAgo(r.published_at)}</span>
          </a>
        ))}
      </Glass>
      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><PlayCircle size={16} /> Actions runs</h3>
        {!data.runs.length ? <div className="faint">No workflow runs</div> : data.runs.map((r) => (
          <a key={r.id} className="list-row" href={r.html_url} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 4px', textDecoration: 'none' }}>
            <span className="status-dot" style={{ background: runColor(r), boxShadow: `0 0 8px ${runColor(r)}` }} />
            <span className="grow">{r.name} <span className="faint">· {r.head_branch}</span></span>
            <span className="faint" style={{ fontSize: 12 }}>{r.conclusion || r.status} · {timeAgo(r.created_at)}</span>
          </a>
        ))}
      </Glass>
      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><CircleDot size={16} /> Open issues <span className="grow" /><button className="btn sm" onClick={() => setNewIssue(true)}><Plus size={14} /> New issue</button></h3>
        {!data.issues.length ? <div className="faint">No open issues 🎉</div> : data.issues.map((i) => (
          <a key={i.id} className="list-row" href={i.html_url} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 4px', textDecoration: 'none' }}>
            <span className="faint">#{i.number}</span><span className="grow">{i.title}</span><span className="faint" style={{ fontSize: 12 }}>{timeAgo(i.created_at)}</span>
          </a>
        ))}
      </Glass>
      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><GitPullRequest size={16} /> Open pull requests</h3>
        {!data.pulls.length ? <div className="faint">No open pull requests</div> : data.pulls.map((p) => (
          <a key={p.id} className="list-row" href={p.html_url} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 4px', textDecoration: 'none' }}>
            <span className="faint">#{p.number}</span><span className="grow">{p.title}</span><span className="faint" style={{ fontSize: 12 }}>{p.user.login}</span>
          </a>
        ))}
      </Glass>
      <CreateModal
        open={newRelease} onClose={() => setNewRelease(false)} title="New release"
        fields={[['tag_name', 'Tag (e.g. v1.0.0)'], ['name', 'Title'], ['body', 'Release notes (Markdown)', true]]}
        extra={{ generate_release_notes: true, target_commitish: repo.default_branch }}
        submit={async (b) => { await gh.createRelease(repo.full_name, b); toast('Release published', 'success'); load() }}
      />
      <CreateModal
        open={newIssue} onClose={() => setNewIssue(false)} title="New issue"
        fields={[['title', 'Title'], ['body', 'Description (Markdown)', true]]}
        submit={async (b) => { await gh.createIssue(repo.full_name, b); toast('Issue created', 'success'); load() }}
      />
    </div>
  )
}

function CreateModal({ open, onClose, title, fields, submit, extra = {} }) {
  const [v, setV] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setV({}); setErr('') } }, [open])
  return (
    <Modal open={open} onClose={onClose}>
      <h2>{title}</h2>
      <form onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr('')
        try { await submit({ ...extra, ...v }); onClose() } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
      }} style={{ marginTop: 14 }}>
        {fields.map(([k, label, multi]) => (
          <Field key={k} label={label}>
            {multi ? <textarea className="textarea" value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <input className="input" required={k !== 'name'} value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} />}
          </Field>
        ))}
        {err && <div className="finding block" style={{ marginBottom: 12 }}>{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? <Spinner /> : 'Create'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ======================================================= Settings
function SettingsTab({ repo, update }) {
  const { gh, removeRepo } = useAuth()
  const { toast, confirm } = useToast()
  const [form, setForm] = useState({ name: repo.name, description: repo.description || '', homepage: repo.homepage || '', default_branch: repo.default_branch, has_issues: repo.has_issues, has_wiki: repo.has_wiki, has_projects: repo.has_projects, has_discussions: !!repo.has_discussions })
  const [topics, setTopics] = useState(repo.topics || [])
  const [topicInput, setTopicInput] = useState('')
  const [branches, setBranches] = useState([])
  const [pages, setPages] = useState(undefined)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    gh.branches(repo.full_name).then(setBranches).catch(() => {})
    gh.pages(repo.full_name).then(setPages).catch(() => setPages(null))
  }, [gh, repo.full_name])

  const run = async (label, fn) => {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy('')
    }
  }
  const saveGeneral = () => run('general', async () => {
    const r = await gh.updateRepo(repo.full_name, form)
    const t = await gh.setTopics(r.full_name, topics)
    update({ ...r, topics: t.names })
    toast('Settings saved', 'success')
    if (r.name !== repo.name) go('repo', r.owner.login, r.name, 'settings')
  })
  const toggleVisibility = async () => {
    const toPublic = repo.private
    if (!(await confirm({ title: toPublic ? 'Make public?' : 'Make private?', body: toPublic ? 'Anyone on the internet will be able to see this code.' : 'Only you and collaborators will see it. Stars and watchers from others may be lost.', danger: toPublic, okLabel: toPublic ? 'Make public' : 'Make private' }))) return
    run('vis', async () => update(await gh.updateRepo(repo.full_name, { private: !repo.private })))
  }
  const toggleArchive = async () => {
    if (!repo.archived && !(await confirm({ title: 'Archive repository?', body: 'It becomes read-only. You can unarchive it at any time.', okLabel: 'Archive' }))) return
    run('archive', async () => update(await gh.updateRepo(repo.full_name, { archived: !repo.archived })))
  }
  const enablePages = () => run('pages', async () => {
    const p = await gh.enablePages(repo.full_name, form.default_branch)
    setPages(p)
    update({ has_pages: true })
    toast('GitHub Pages enabled. Your site will be live in about a minute.', 'success')
  })
  const disablePages = async () => {
    if (!(await confirm({ title: 'Disable GitHub Pages?', body: 'The live site will go offline.', danger: true, okLabel: 'Disable' }))) return
    run('pages', async () => { await gh.disablePages(repo.full_name); setPages(null); update({ has_pages: false }) })
  }
  const del = async () => {
    if (!(await confirm({ title: 'Delete repository permanently', body: `This permanently deletes ${repo.full_name}: code, issues, releases, stars. This CANNOT be undone.`, typeToConfirm: repo.full_name, danger: true, okLabel: 'Delete forever' }))) return
    run('delete', async () => {
      await gh.deleteRepo(repo.full_name)
      removeRepo(repo.full_name)
      toast(`${repo.full_name} deleted`, 'success')
      go('repos')
    })
  }

  const f = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) })
  const autoFill = () => run('auto', async () => {
    const a = await autoDetails(gh, repo)
    setForm((x) => ({ ...x, description: x.description || a.description, homepage: x.homepage || a.homepage }))
    setTopics((t) => [...new Set([...t, ...a.topics])])
    toast('Suggestions filled in. Review, edit, then Save.', 'success')
  })
  const autoReplace = () => run('auto', async () => {
    const a = await autoDetails(gh, repo)
    setForm((x) => ({ ...x, description: a.description, homepage: a.homepage || x.homepage }))
    setTopics(a.topics)
    toast('Replaced with fresh suggestions. Review, edit, then Save.', 'success')
  })
  return (
    <div className="widgets">
      <Glass className="section widget" style={{ '--span': 7 }}>
        <h3>
          General <span className="grow" />
          <button className="btn sm primary" onClick={autoFill} disabled={busy === 'auto'} title="Fill empty fields from the README, package.json and languages (free, in your browser)">
            {busy === 'auto' ? <Spinner size={13} /> : <Wand2 size={14} />} Auto-fill
          </button>
          <button className="btn sm" onClick={autoReplace} disabled={busy === 'auto'} title="Replace description and topics with new suggestions">Regenerate</button>
        </h3>
        <Field label="Repository name"><input className="input" {...f('name')} /></Field>
        <Field label="Description"><input className="input" {...f('description')} placeholder="What does this project do?" /></Field>
        <Field label="Website" hint="Shown in the repo sidebar and used by the Preview Wall."><input className="input" {...f('homepage')} placeholder="https://…" /></Field>
        <Field label="Topics">
          <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
            {topics.map((t) => <span key={t} className="tag" style={{ fontSize: 13 }}>{t}<button className="btn ghost sm icon" style={{ padding: 0 }} onClick={() => setTopics(topics.filter((x) => x !== t))}><X size={12} /></button></span>)}
          </div>
          <input className="input" value={topicInput} placeholder="Type a topic and press Enter" onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && topicInput.trim()) { e.preventDefault(); setTopics([...new Set([...topics, topicInput.trim().toLowerCase().replace(/\s+/g, '-')])]); setTopicInput('') } }} />
        </Field>
        <Field label="Default branch">
          <select className="select" {...f('default_branch')}>{(branches.length ? branches.map((b) => b.name) : [form.default_branch]).map((b) => <option key={b}>{b}</option>)}</select>
        </Field>
        <div className="col" style={{ gap: 10, margin: '6px 0 16px' }}>
          {[['has_issues', 'Issues'], ['has_wiki', 'Wiki'], ['has_projects', 'Projects'], ['has_discussions', 'Discussions']].map(([k, l]) => (
            <div key={k} className="row between"><span>{l}</span><Switch on={form[k]} onChange={(v) => setForm({ ...form, [k]: v })} label={l} /></div>
          ))}
        </div>
        <button className="btn primary" onClick={saveGeneral} disabled={busy === 'general'}>{busy === 'general' ? <Spinner /> : <Save size={16} />} Save changes</button>
      </Glass>
      <div className="widget col" style={{ '--span': 5, gap: 'var(--gap)' }}>
        <Glass className="section">
          <h3><Globe size={16} /> GitHub Pages</h3>
          {pages === undefined ? <Spinner /> : pages ? (
            <>
              <p className="muted" style={{ marginTop: 0 }}>Live at <a href={pages.html_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--c2)' }}>{pages.html_url}</a><br /><span className="faint">Source: {pages.source?.branch}{pages.source?.path} · {pages.status || 'building'}</span></p>
              <button className="btn danger sm" onClick={disablePages} disabled={busy === 'pages'}>Disable Pages</button>
            </>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0 }}>Publish this repo as a website for free, from the <b>{form.default_branch}</b> branch.</p>
              <button className="btn primary" onClick={enablePages} disabled={busy === 'pages'}>{busy === 'pages' ? <Spinner /> : <Rocket size={16} />} Enable in one click</button>
            </>
          )}
        </Glass>
        <Glass className="section">
          <h3>Visibility & state</h3>
          <div className="row between" style={{ marginBottom: 12 }}>
            <span>{repo.private ? <><Lock size={14} /> Private</> : <><Globe size={14} /> Public</>}</span>
            <button className="btn sm" onClick={toggleVisibility} disabled={busy === 'vis'}>Make {repo.private ? 'public' : 'private'}</button>
          </div>
          <div className="row between">
            <span>{repo.archived ? 'Archived (read-only)' : 'Active'}</span>
            <button className="btn sm" onClick={toggleArchive} disabled={busy === 'archive'}>{repo.archived ? 'Unarchive' : 'Archive'}</button>
          </div>
        </Glass>
        <Glass className="section" style={{ borderColor: 'rgba(248,113,113,.35)' }}>
          <h3 style={{ color: '#fca5a5' }}>Danger zone</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Permanently delete this repository. You'll need to type its full name.</p>
          <button className="btn danger" onClick={del} disabled={busy === 'delete'}><Trash2 size={16} /> Delete repository</button>
        </Glass>
      </div>
    </div>
  )
}
