import { useCallback, useEffect, useMemo, useState } from 'react'
import { GitBranch, GitMerge, GitPullRequest, Trash2, RotateCw, Rocket, Tag as TagIcon, Check, X, Radio } from 'lucide-react'
import { Glass, Modal, Spinner, Switch, Field, useToast } from '../components/ui'
import { useAuth } from '../lib/auth'
import { commitFiles } from '../lib/push'
import { timeAgo } from '../lib/util'

// ======================================================= deploy status chip
export function DeployStatus({ repo }) {
  const { gh } = useAuth()
  const [st, setSt] = useState(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const deps = await gh.deployments(repo.full_name)
        if (deps?.length) {
          const s = (await gh.deploymentStatuses(repo.full_name, deps[0].id))?.[0]
          if (alive) return setSt({ state: s?.state || deps[0].task, env: deps[0].environment, at: s?.created_at || deps[0].created_at, url: s?.environment_url || s?.target_url })
        }
        if (repo.has_pages) {
          const b = await gh.pagesBuild(repo.full_name)
          if (alive) setSt({ state: b.status === 'built' ? 'success' : b.status === 'errored' ? 'failure' : 'in_progress', env: 'GitHub Pages', at: b.updated_at })
        }
      } catch {
        /* no deployments */
      }
    })()
    return () => {
      alive = false
    }
  }, [gh, repo.full_name, repo.has_pages])
  if (!st) return null
  const ok = st.state === 'success'
  const bad = ['failure', 'error'].includes(st.state)
  const color = ok ? '#34d399' : bad ? '#f87171' : '#fbbf24'
  const label = ok ? 'Live' : bad ? 'Deploy failed' : 'Deploying'
  return (
    <a className="tag" href={st.url || undefined} target="_blank" rel="noopener noreferrer" title={`${st.env} · ${timeAgo(st.at)}`} style={{ color, borderColor: color + '66', textDecoration: 'none' }}>
      <span className="status-dot" style={{ background: color, boxShadow: `0 0 8px ${color}`, width: 7, height: 7 }} /> {label} · {st.env}
    </a>
  )
}

// ======================================================= one-click release
const bump = (v, kind) => {
  const m = /^(v?)(\d+)\.(\d+)\.(\d+)/.exec(v || '')
  if (!m) return { patch: 'v0.1.1', minor: 'v0.2.0', major: 'v1.0.0' }[kind] || 'v0.1.0'
  const [, p, a, b, c] = m
  if (kind === 'major') return `${p}${+a + 1}.0.0`
  if (kind === 'minor') return `${p}${a}.${+b + 1}.0`
  return `${p}${a}.${b}.${+c + 1}`
}

export function ReleaseHelper({ repo, onDone }) {
  const { gh, demo } = useAuth()
  const { toast, confirm } = useToast()
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState('')
  useEffect(() => {
    ;(async () => {
      const latest = await gh.latestRelease(repo.full_name).catch(() => null)
      let ahead = null
      if (latest) ahead = await gh.compare(repo.full_name, latest.tag_name, repo.default_branch).then((c) => c.ahead_by).catch(() => null)
      else ahead = await gh.commits(repo.full_name, repo.default_branch, 50).then((c) => c.length).catch(() => null)
      setInfo({ latest, ahead })
    })()
  }, [gh, repo.full_name, repo.default_branch])
  if (!info) return <div className="shimmer" style={{ height: 54 }} />
  const cur = info.latest?.tag_name
  const release = async (kind) => {
    const tag = bump(cur, kind)
    if (!(await confirm({ title: `Publish ${tag}?`, body: `Creates the tag ${tag} on ${repo.default_branch} and a GitHub Release. GitHub writes the changelog from the changes since ${cur || 'the start'}.`, okLabel: `Release ${tag}` }))) return
    setBusy(kind)
    try {
      const r = await gh.createRelease(repo.full_name, { tag_name: tag, name: tag, target_commitish: repo.default_branch, generate_release_notes: true })
      toast(`${tag} released`, 'success')
      setInfo((x) => ({ ...x, latest: r, ahead: 0 }))
      onDone?.()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy('')
    }
  }
  return (
    <div className="row wrap" style={{ padding: '6px 0 12px', gap: 8 }}>
      <span className="muted" style={{ fontSize: 13 }}>
        {cur ? <>Latest <b>{cur}</b></> : 'No releases yet'}
        {info.ahead != null && <> · {info.ahead} new commit{info.ahead === 1 ? '' : 's'}</>}
      </span>
      <div className="grow" />
      {['patch', 'minor', 'major'].map((k) => (
        <button key={k} className={`btn sm ${k === 'patch' ? 'primary' : ''}`} disabled={!!busy || demo || info.ahead === 0} onClick={() => release(k)} title={`${k} release`}>
          {busy === k ? <Spinner size={13} /> : <Rocket size={13} />} {bump(cur, k)}
        </button>
      ))}
    </div>
  )
}

// ======================================================= branches & CI
export function BranchesTab({ repo }) {
  const { gh, demo } = useAuth()
  const { toast, confirm } = useToast()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState('')
  const load = useCallback(async () => {
    const [branches, pulls, runs] = await Promise.all([gh.branches(repo.full_name).catch(() => []), gh.pulls(repo.full_name).catch(() => []), gh.runs(repo.full_name).catch(() => null)])
    const others = branches.filter((b) => b.name !== repo.default_branch).slice(0, 15)
    const cmp = await Promise.all(others.map((b) => gh.compare(repo.full_name, repo.default_branch, b.name).then((c) => ({ ahead: c.ahead_by, behind: c.behind_by })).catch(() => ({}))))
    setData({
      branches: others.map((b, i) => ({ ...b, ...cmp[i] })),
      pulls,
      failed: (runs?.workflow_runs || []).filter((r) => r.conclusion === 'failure'),
    })
  }, [gh, repo.full_name, repo.default_branch])
  useEffect(() => {
    load()
  }, [load])
  const run = async (key, fn, msg) => {
    setBusy(key)
    try {
      await fn()
      toast(msg, 'success')
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy('')
    }
  }
  if (!data) return <div className="empty"><Spinner size={22} /></div>
  return (
    <div className="widgets">
      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><GitBranch size={16} /> Branches <span className="faint" style={{ fontWeight: 400, fontSize: 12.5 }}>vs {repo.default_branch}</span></h3>
        {!data.branches.length && <div className="faint">Only {repo.default_branch}.</div>}
        {data.branches.map((b) => (
          <div key={b.name} className="row" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="mono grow" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name}</span>
            {b.ahead != null && <span className="tag" title="ahead / behind">↑{b.ahead} ↓{b.behind}</span>}
            {b.protected ? <span className="tag">protected</span> : (
              <button className="btn ghost sm icon" aria-label={`Delete ${b.name}`} disabled={!!busy || demo} onClick={async () => (await confirm({ title: `Delete branch ${b.name}?`, body: b.ahead ? `It has ${b.ahead} commit(s) not in ${repo.default_branch}. Those would only remain if referenced elsewhere.` : 'It is fully merged.', danger: true, okLabel: 'Delete branch' })) && run('d' + b.name, () => gh.deleteBranch(repo.full_name, b.name), `Deleted ${b.name}`)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </Glass>
      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><GitPullRequest size={16} /> Pull requests</h3>
        {!data.pulls.length && <div className="faint">No open pull requests.</div>}
        {data.pulls.map((p) => (
          <div key={p.id} className="row" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="faint">#{p.number}</span>
            <a className="grow" href={p.html_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</a>
            {p.draft ? <span className="tag">draft</span> : (
              <button className="btn sm" disabled={!!busy || demo} onClick={async () => (await confirm({ title: `Merge #${p.number}?`, body: `Squash-merge "${p.title}" into ${p.base?.ref || repo.default_branch}.`, okLabel: 'Merge' })) && run('m' + p.number, () => gh.mergePull(repo.full_name, p.number), `Merged #${p.number}`)}>
                {busy === 'm' + p.number ? <Spinner size={13} /> : <GitMerge size={13} />} Merge
              </button>
            )}
          </div>
        ))}
      </Glass>
      <Glass className="section widget" style={{ '--span': 12 }}>
        <h3><Radio size={16} /> Failed checks</h3>
        {!data.failed.length ? <div className="faint">No failed workflow runs. ✓</div> : data.failed.map((r) => (
          <div key={r.id} className="row" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
            <span className="status-dot down" />
            <a className="grow" href={r.html_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{r.name} <span className="faint">· {r.head_branch} · {timeAgo(r.created_at)}</span></a>
            <button className="btn sm" disabled={!!busy || demo} onClick={() => run('r' + r.id, () => gh.rerunFailed(repo.full_name, r.id), 'Re-run started')}>
              {busy === 'r' + r.id ? <Spinner size={13} /> : <RotateCw size={13} />} Re-run failed jobs
            </button>
          </div>
        ))}
      </Glass>
    </div>
  )
}

// ======================================================= line diff (LCS)
export function lineDiff(a = '', b = '') {
  const A = a.split('\n')
  const B = b.split('\n')
  if (A.length * B.length > 2_500_000) return null // too large to diff in the browser
  const n = A.length
  const m = B.length
  const dp = new Int32Array((n + 1) * (m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i * (m + 1) + j] = A[i] === B[j] ? dp[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1])
  const out = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) out.push([' ', A[i++], j++])
    else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) out.push(['-', A[i++]])
    else out.push(['+', B[j++]])
  }
  while (i < n) out.push(['-', A[i++]])
  while (j < m) out.push(['+', B[j++]])
  return out
}

function DiffView({ before, after }) {
  const d = useMemo(() => lineDiff(before ?? '', after), [before, after])
  if (!d) return <div className="hint">File too large to show a diff.</div>
  // show changed lines with 2 lines of context
  const keep = new Set()
  d.forEach((l, i) => l[0] !== ' ' && [-2, -1, 0, 1, 2].forEach((k) => keep.add(i + k)))
  let last = -1
  return (
    <pre className="diff">
      {d.map((l, i) => {
        if (!keep.has(i)) return null
        const gap = last !== -1 && i - last > 1
        last = i
        return (
          <span key={i}>
            {gap && <span className="diff-gap">⋯</span>}
            <span className={l[0] === '+' ? 'diff-add' : l[0] === '-' ? 'diff-del' : ''}>{l[0]} {l[1]}{'\n'}</span>
          </span>
        )
      })}
    </pre>
  )
}

// ======================================================= staged changes review
export function StagedReview({ open, onClose, repo, branch, staged, onCommitted }) {
  const { gh } = useAuth()
  const { toast } = useToast()
  const list = [...staged.values()]
  const [msg, setMsg] = useState('')
  const [asPR, setAsPR] = useState(false)
  const [newBranch, setNewBranch] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setMsg(list.length === 1 ? `Update ${list[0].path}` : `Update ${list.length} files`)
      setNewBranch(`update-${new Date().toISOString().slice(0, 10)}`)
    }
  }, [open]) // eslint-disable-line
  const commit = async () => {
    setBusy(true)
    try {
      let target = branch
      if (asPR) {
        const ref = await gh.get(`/repos/${repo.full_name}/git/ref/heads/${encodeURIComponent(branch)}`)
        target = newBranch.trim().replace(/\s+/g, '-')
        await gh.createBranch(repo.full_name, target, ref.object.sha)
      }
      await commitFiles(gh, repo.full_name, target, list.map((f) => ({ path: f.path, bytes: new TextEncoder().encode(f.text) })), msg)
      if (asPR) {
        const pr = await gh.createPull(repo.full_name, { title: msg, head: target, base: branch, body: `Changes to ${list.length} file(s), made with RepoVerse.` })
        toast(`Pull request #${pr.number} opened`, 'success')
      } else toast(`Committed ${list.length} file(s) to ${branch}`, 'success')
      onCommitted()
      onClose()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} size="wide">
      <h2>Review {list.length} change{list.length === 1 ? '' : 's'}</h2>
      <div className="col" style={{ gap: 12, margin: '14px 0', maxHeight: '50vh', overflow: 'auto' }}>
        {list.map((f) => (
          <div key={f.path}>
            <div className="mono" style={{ fontSize: 12.5, marginBottom: 4 }}>{f.isNew ? <span className="tag">new</span> : null} {f.path}</div>
            <DiffView before={f.original} after={f.text} />
          </div>
        ))}
      </div>
      <Field label="Commit message"><input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
      <div className="row between field"><span>Put it on a new branch and open a pull request</span><Switch on={asPR} onChange={setAsPR} label="As pull request" /></div>
      {asPR && <Field label="New branch name"><input className="input mono" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} /></Field>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}><X size={15} /> Keep editing</button>
        <button className="btn primary" disabled={busy || !msg.trim() || !list.length} onClick={commit}>{busy ? <Spinner /> : asPR ? <GitPullRequest size={15} /> : <Check size={15} />} {asPR ? 'Commit & open PR' : `Commit to ${branch}`}</button>
      </div>
    </Modal>
  )
}

export { TagIcon }
