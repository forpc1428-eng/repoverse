import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FolderUp, FolderOpen, ShieldAlert, ShieldCheck, AlertTriangle, FileText, Rocket, ExternalLink, Github, RotateCcw, Sparkles, Check } from 'lucide-react'
import { Glass, Field, Seg, Spinner, Switch, useToast } from '../components/ui'
import Markdown from '../components/Markdown'
import { useAuth } from '../lib/auth'
import { go } from '../lib/router'
import { analyze, commitFiles, generateReadme, readDirectoryHandle, readDroppedEntry, readFileList, waitForBranch, sleep } from '../lib/push'
import { b64decodeText, bytes, LICENSES } from '../lib/util'

const slug = (s) => s.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'my-project'

export default function Push() {
  const { gh, user, repos, addRepo } = useAuth()
  const { toast } = useToast()
  const inputRef = useRef(null)
  const [stage, setStage] = useState('pick') // pick | analyzing | review | pushing | done
  const [over, setOver] = useState(false)
  const [a, setA] = useState(null)
  const [opts, setOpts] = useState({})
  const [progress, setProgress] = useState({ done: 0, total: 1, label: '' })
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [ignoreWarnings, setIgnoreWarnings] = useState(false)
  const [showReadme, setShowReadme] = useState(false)

  async function load(folder) {
    setErr('')
    setStage('analyzing')
    try {
      const res = await analyze(folder)
      if (!res.files.length) throw new Error('No files to push in that folder (everything was ignored or it is empty).')
      setA(res)
      const desc = res.stack.pkg?.description || ''
      setOpts({
        target: 'new', name: slug(res.name), description: desc, private: true, license: res.stack.hasLicense ? '' : 'mit',
        readme: !res.stack.hasReadme, pages: res.stack.staticSite, existing: '', message: 'Initial commit from RepoVerse',
        excluded: new Set(res.findings.filter((f) => f.level === 'block' && f.kind === 'Secret file').map((f) => f.path)),
      })
      setIgnoreWarnings(false)
      setStage('review')
    } catch (e) {
      setErr(e.message)
      setStage('pick')
    }
  }

  const pickFolder = async () => {
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker({ mode: 'read' })
        load(await readDirectoryHandle(dir))
      } catch (e) {
        if (e.name !== 'AbortError') setErr(e.message)
      }
    } else inputRef.current?.click()
  }
  const onDrop = async (e) => {
    e.preventDefault()
    setOver(false)
    const entry = e.dataTransfer.items?.[0]?.webkitGetAsEntry?.()
    if (entry?.isDirectory) load(await readDroppedEntry(entry))
    else setErr('Drop a folder, not a single file.')
  }

  // Findings for files that are still included
  const included = a ? a.files.filter((f) => !opts.excluded?.has(f.path)) : []
  const activeFindings = a ? a.findings.filter((f) => !opts.excluded?.has(f.path)) : []
  const blocks = activeFindings.filter((f) => f.level === 'block')
  const warns = activeFindings.filter((f) => f.level === 'warn')
  const readmeText = a && opts.readme ? generateReadme({ name: opts.name, description: opts.description, stack: a.stack, owner: user.login, files: included, license: opts.license }) : ''
  const canPush = a && included.length && !blocks.length && (!warns.length || ignoreWarnings) && (opts.target === 'new' ? opts.name : opts.existing)

  async function push() {
    setStage('pushing')
    setErr('')
    try {
      let repo
      let files = included.map((f) => ({ path: f.path, bytes: f.bytes }))
      if (opts.target === 'new') {
        setProgress({ done: 0, total: 1, label: 'Creating repository…' })
        repo = await gh.createRepo({ name: opts.name, description: opts.description, private: opts.private, auto_init: true, license_template: opts.license || undefined })
        await waitForBranch(gh, repo.full_name, repo.default_branch)
        // If we generate a README, it replaces GitHub's placeholder one
        if (opts.readme) files = [...files.filter((f) => !/^readme\.md$/i.test(f.path)), { path: 'README.md', bytes: new TextEncoder().encode(readmeText) }]
      } else {
        repo = repos.find((r) => r.full_name === opts.existing)
        if (opts.readme && !files.some((f) => /^readme\.md$/i.test(f.path))) files.push({ path: 'README.md', bytes: new TextEncoder().encode(readmeText) })
      }
      await commitFiles(gh, repo.full_name, repo.default_branch, files, opts.message, (done, total, label) => setProgress({ done, total, label }))
      let pagesUrl = null
      if (opts.pages && opts.target === 'new' && !opts.private) {
        setProgress((p) => ({ ...p, label: 'Enabling GitHub Pages…' }))
        try {
          const p = await gh.enablePages(repo.full_name, repo.default_branch)
          pagesUrl = p.html_url
        } catch (e) {
          toast(`Pages: ${e.message}`, 'error')
        }
      }
      await sleep(400)
      const fresh = await gh.repo(repo.full_name)
      addRepo(fresh)
      setResult({ repo: fresh, pagesUrl, count: files.length })
      setStage('done')
    } catch (e) {
      setErr(e.message)
      setStage('review')
    }
  }

  const reset = () => {
    setStage('pick')
    setA(null)
    setResult(null)
    setErr('')
  }
  const o = (k) => ({ value: opts[k] ?? '', onChange: (e) => setOpts({ ...opts, [k]: e.target.value }) })
  const pct = Math.round((progress.done / Math.max(1, progress.total)) * 100)

  return (
    <div>
      <input ref={inputRef} type="file" webkitdirectory="" directory="" multiple hidden onChange={(e) => e.target.files.length && load(readFileList(e.target.files))} />
      {err && <div className="finding block" style={{ marginBottom: 14 }}><AlertTriangle size={16} /> {err}</div>}
      <AnimatePresence mode="wait">
        {stage === 'pick' && (
          <motion.div key="pick" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Glass className="section" liquid>
              <div className={`dropzone ${over ? 'over' : ''}`} onDragOver={(e) => (e.preventDefault(), setOver(true))} onDragLeave={() => setOver(false)} onDrop={onDrop}>
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'inline-block' }}>
                  <div className="brand-mark" style={{ width: 72, height: 72, borderRadius: 24, margin: '0 auto 18px' }}><FolderUp size={32} color="#fff" style={{ position: 'absolute' }} /></div>
                </motion.div>
                <h2 style={{ margin: '0 0 6px', fontSize: 24, letterSpacing: '-.02em' }}>Drop a project folder here</h2>
                <p className="muted" style={{ margin: '0 0 20px' }}>It gets scanned for secrets, gets a README, and is pushed to GitHub. No git install needed.</p>
                <button className="btn primary big" onClick={pickFolder}><FolderOpen size={18} /> Choose folder</button>
                <div className="row wrap" style={{ justifyContent: 'center', gap: 18, marginTop: 26 }}>
                  {['Skips node_modules & .gitignore files', 'Blocks API keys & .env', 'Auto README + license', 'One-click GitHub Pages'].map((t) => (
                    <span key={t} className="row faint" style={{ gap: 6, fontSize: 13 }}><Check size={14} color="var(--c2)" />{t}</span>
                  ))}
                </div>
              </div>
            </Glass>
          </motion.div>
        )}

        {stage === 'analyzing' && (
          <motion.div key="an" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Glass className="empty"><Spinner size={28} /><div style={{ marginTop: 10 }}>Reading files and scanning for secrets…</div></Glass>
          </motion.div>
        )}

        {stage === 'review' && a && (
          <motion.div key="rev" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="widgets">
            <Glass className="section widget" style={{ '--span': 7 }}>
              <h3><FolderOpen size={16} /> {a.name} <span className="faint" style={{ fontWeight: 400 }}>· {included.length} files · {bytes(included.reduce((n, f) => n + f.bytes.length, 0))} · {a.skipped.length} ignored</span></h3>
              <div className="row wrap" style={{ gap: 6, marginBottom: 16 }}>{a.stack.tech.map((t) => <span key={t} className="tag"><Sparkles size={11} /> {t}</span>)}</div>
              <Field label="Push to">
                <Seg id="target" value={opts.target} onChange={(v) => setOpts({ ...opts, target: v })} options={[{ value: 'new', label: 'New repository' }, { value: 'existing', label: 'Existing repository' }]} />
              </Field>
              {opts.target === 'new' ? (
                <>
                  <Field label="Repository name" hint={`github.com/${user.login}/${slug(opts.name || '')}`}><input className="input" {...o('name')} onBlur={() => setOpts({ ...opts, name: slug(opts.name) })} /></Field>
                  <Field label="Description"><input className="input" {...o('description')} placeholder="What does it do?" /></Field>
                  <div className="row between field"><span>Private repository</span><Switch on={opts.private} onChange={(v) => setOpts({ ...opts, private: v })} label="Private" /></div>
                  <Field label="License">
                    <select className="select" {...o('license')}>{LICENSES.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}</select>
                  </Field>
                  {a.stack.staticSite && (
                    <div className="row between field">
                      <span>Publish with GitHub Pages {opts.private && <span className="faint">(needs a public repo on the free plan)</span>}</span>
                      <Switch on={opts.pages} onChange={(v) => setOpts({ ...opts, pages: v })} label="Pages" />
                    </div>
                  )}
                </>
              ) : (
                <Field label="Repository" hint="Files are added or updated on the default branch. Nothing is deleted.">
                  <select className="select" {...o('existing')}>
                    <option value="">Choose…</option>
                    {repos.filter((r) => r.permissions?.push && !r.archived).map((r) => <option key={r.id} value={r.full_name}>{r.full_name}</option>)}
                  </select>
                </Field>
              )}
              <div className="row between field">
                <span>{a.stack.hasReadme ? 'Replace README with a generated one' : 'Generate a README'}</span>
                <div className="row">
                  {opts.readme && <button className="btn sm" onClick={() => setShowReadme(!showReadme)}><FileText size={13} /> {showReadme ? 'Hide' : 'Preview'}</button>}
                  <Switch on={opts.readme} onChange={(v) => setOpts({ ...opts, readme: v })} label="README" />
                </div>
              </div>
              {opts.readme && showReadme && <Glass className="section" lit={false} style={{ maxHeight: 360, overflow: 'auto', marginBottom: 14 }}><Markdown text={readmeText} /></Glass>}
              <Field label="Commit message"><input className="input" {...o('message')} /></Field>
              <div className="row">
                <button className="btn" onClick={reset}><RotateCcw size={16} /> Start over</button>
                <div className="grow" />
                <button className="btn primary big" disabled={!canPush} onClick={push}><Rocket size={18} /> Push to GitHub</button>
              </div>
            </Glass>

            <div className="widget col" style={{ '--span': 5, gap: 'var(--gap)' }}>
              <Glass className="section">
                <h3>{blocks.length ? <ShieldAlert size={16} color="#f87171" /> : <ShieldCheck size={16} color="#34d399" />} Security scan</h3>
                {!activeFindings.length && <div className="finding" style={{ background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.3)' }}><ShieldCheck size={16} /> No secrets found. Safe to push.</div>}
                <div className="col" style={{ gap: 8, maxHeight: 320, overflow: 'auto' }}>
                  {activeFindings.map((f, i) => (
                    <div key={i} className={`finding ${f.level}`}>
                      {f.level === 'block' ? <ShieldAlert size={16} style={{ flex: 'none' }} /> : <AlertTriangle size={16} style={{ flex: 'none' }} />}
                      <div className="grow">
                        <b>{f.kind}</b>
                        <div className="mono faint" style={{ fontSize: 12 }}>{f.path}{f.line ? `:${f.line}` : ''}</div>
                      </div>
                      <button className="btn sm" onClick={() => setOpts({ ...opts, excluded: new Set([...opts.excluded, f.path]) })}>Exclude file</button>
                    </div>
                  ))}
                </div>
                {blocks.length > 0 && <p className="hint" style={{ marginBottom: 0 }}>Pushing is blocked until every red item is excluded or fixed in the folder.</p>}
                {!blocks.length && warns.length > 0 && (
                  <label className="row" style={{ marginTop: 12, fontSize: 13 }}><input type="checkbox" checked={ignoreWarnings} onChange={(e) => setIgnoreWarnings(e.target.checked)} /> I checked the warnings. Push anyway.</label>
                )}
                {opts.excluded?.size > 0 && (
                  <div className="hint" style={{ marginTop: 10 }}>Excluded: {[...opts.excluded].join(', ')} <button className="btn ghost sm" onClick={() => setOpts({ ...opts, excluded: new Set() })}>Undo</button></div>
                )}
              </Glass>
              <Glass className="section" style={{ maxHeight: 340, overflow: 'auto' }}>
                <h3>Files to push</h3>
                {included.slice(0, 400).map((f) => <div key={f.path} className="mono faint" style={{ fontSize: 12, padding: '2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.path}</div>)}
                {included.length > 400 && <div className="hint">…and {included.length - 400} more</div>}
              </Glass>
            </div>
          </motion.div>
        )}

        {stage === 'pushing' && (
          <motion.div key="push" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Glass className="section" style={{ maxWidth: 640, margin: '40px auto', textAlign: 'center', padding: 40 }} liquid>
              <Spinner size={30} />
              <h2 style={{ margin: '16px 0 4px' }}>Shipping {opts.name || opts.existing}…</h2>
              <p className="muted mono" style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{progress.label}</p>
              <div className="progress" style={{ margin: '20px 0 8px' }}><i style={{ width: `${pct}%` }} /></div>
              <div className="faint">{progress.done} / {progress.total} files · {pct}%</div>
            </Glass>
          </motion.div>
        )}

        {stage === 'done' && result && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
            <Glass className="section" style={{ maxWidth: 640, margin: '40px auto', textAlign: 'center', padding: 40 }} liquid>
              <motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }}
                style={{ width: 74, height: 74, borderRadius: '50%', margin: '0 auto', display: 'grid', placeItems: 'center', background: 'linear-gradient(120deg,#34d399,var(--c2))', boxShadow: '0 0 40px rgba(52,211,153,.5)' }}>
                <Check size={38} color="#fff" strokeWidth={3} />
              </motion.div>
              <h2 style={{ margin: '18px 0 4px', fontSize: 26 }}>Shipped! 🚀</h2>
              <p className="muted">{result.count} files pushed to <b>{result.repo.full_name}</b></p>
              {result.pagesUrl && <p className="muted">Your site will be live in about a minute at<br /><a href={result.pagesUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--c2)' }}>{result.pagesUrl}</a></p>}
              <div className="row wrap" style={{ justifyContent: 'center', marginTop: 20 }}>
                <a className="btn" href={result.repo.html_url} target="_blank" rel="noopener noreferrer"><Github size={16} /> View on GitHub</a>
                <button className="btn primary" onClick={() => go('repo', result.repo.owner.login, result.repo.name)}><ExternalLink size={16} /> Open in RepoVerse</button>
                <button className="btn" onClick={reset}><FolderUp size={16} /> Push another</button>
              </div>
            </Glass>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
