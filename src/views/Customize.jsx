import { useRef, useState } from 'react'
import { Palette, Sparkles, Image as ImageIcon, Download, Upload, CloudUpload, CloudDownload, RotateCcw, ShieldCheck, Trash2, Type, Zap, Layers } from 'lucide-react'
import { Glass, Seg, Spinner, Switch, useToast } from '../components/ui'
import { useSettings, THEMES, FONTS, DEFAULTS } from '../lib/settings'
import { useAuth, SCOPES } from '../lib/auth'
import { download } from '../lib/util'

const GIST_FILE = 'repoverse-settings.json'

function Slider({ label, k, min, max, step = 1, unit = '' }) {
  const { settings: s, update } = useSettings()
  return (
    <div className="slider-row">
      <span className="muted">{label}</span>
      <input type="range" min={min} max={max} step={step} value={s[k]} onChange={(e) => update({ [k]: +e.target.value })} />
      <span className="mono faint" style={{ fontSize: 12, textAlign: 'right' }}>{s[k]}{unit}</span>
    </div>
  )
}
function Toggle({ label, k, hint }) {
  const { settings: s, update } = useSettings()
  return (
    <div className="row between" style={{ padding: '9px 0' }}>
      <div><div>{label}</div>{hint && <div className="hint">{hint}</div>}</div>
      <Switch on={s[k]} onChange={(v) => update({ [k]: v })} label={label} />
    </div>
  )
}

export default function Customize() {
  const { settings: s, update, reset, setBgImage, bgImage, userData, setUserData, setSettings } = useSettings()
  const { gh, logout, scopes } = useAuth()
  const { toast, confirm } = useToast()
  const fileRef = useRef(null)
  const importRef = useRef(null)
  const [sync, setSync] = useState('')

  const onImage = (e) => {
    const f = e.target.files[0]
    if (!f) return
    if (f.size > 6 * 1024 * 1024) return toast('Image too large (max 6 MB)', 'error')
    const reader = new FileReader()
    reader.onload = () => {
      setBgImage(reader.result)
      update({ background: 'image' })
    }
    reader.readAsDataURL(f)
  }

  const exportData = () => {
    const { ...settings } = s
    download('repoverse-setup.json', JSON.stringify({ app: 'repoverse', version: 1, settings, userData }, null, 2))
  }
  const applyImport = (d) => {
    if (d?.app !== 'repoverse') throw new Error('Not a RepoVerse setup file')
    if (d.settings) setSettings({ ...DEFAULTS, ...d.settings })
    if (d.userData) setUserData(d.userData)
  }
  const importData = (e) => {
    const f = e.target.files[0]
    if (!f) return
    f.text().then((t) => {
      try {
        applyImport(JSON.parse(t))
        toast('Setup imported', 'success')
      } catch (err) {
        toast(err.message, 'error')
      }
    })
    e.target.value = ''
  }

  // Sync via a private Gist in the user's own GitHub account (no RepoVerse server involved)
  const findGist = async () => (await gh.gists()).find((g) => g.files[GIST_FILE])
  const pushSync = async () => {
    setSync('up')
    try {
      const content = JSON.stringify({ app: 'repoverse', version: 1, settings: s, userData }, null, 2)
      const g = await findGist()
      if (g) await gh.updateGist(g.id, { files: { [GIST_FILE]: { content } } })
      else await gh.createGist({ description: 'RepoVerse settings sync (private)', public: false, files: { [GIST_FILE]: { content } } })
      toast('Settings saved to a private Gist in your GitHub', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSync('')
    }
  }
  const pullSync = async () => {
    setSync('down')
    try {
      const g = await findGist()
      if (!g) throw new Error('No synced settings found yet. Save from another device first.')
      const full = await gh.gist(g.id)
      applyImport(JSON.parse(full.files[GIST_FILE].content))
      toast('Settings restored from your Gist', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSync('')
    }
  }

  const wipe = async () => {
    if (await confirm({ title: 'Erase everything on this device?', body: 'Deletes your token, cached repos, themes, tags, folders and the encryption key from this browser.\nYour GitHub repositories are NOT touched.', danger: true, okLabel: 'Erase & sign out' })) logout(true)
  }

  const BGS = [
    { value: 'aurora', label: 'Aurora' }, { value: 'mesh', label: 'Mesh' }, { value: 'orbs', label: 'Orbs' }, { value: 'image', label: 'Image' }, { value: 'solid', label: 'Solid' },
  ]

  return (
    <div className="widgets">
      <Glass className="section widget" style={{ '--span': 12 }} liquid>
        <h3><Palette size={16} /> Theme</h3>
        <div className="swatches">
          {Object.entries(THEMES).map(([k, t]) => (
            <div key={k} className={`swatch ${s.theme === k ? 'on' : ''}`} onClick={() => update({ theme: k, bg: t.bg, c1: t.c1, c2: t.c2, c3: t.c3 })}
              style={{ background: `radial-gradient(circle at 20% 20%, ${t.c1}, transparent 60%), radial-gradient(circle at 85% 30%, ${t.c2}, transparent 55%), radial-gradient(circle at 50% 100%, ${t.c3}, transparent 60%), ${t.bg}` }}>
              <span style={{ textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>{t.name}</span>
            </div>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 18, marginTop: 18 }}>
          {[['c1', 'Primary'], ['c2', 'Secondary'], ['c3', 'Accent'], ['bg', 'Base']].map(([k, l]) => (
            <label key={k} className="row" style={{ gap: 8 }}>
              <input type="color" value={s[k]} onChange={(e) => update({ [k]: e.target.value, theme: 'custom' })} />
              <span className="muted" style={{ fontSize: 13 }}>{l}<br /><span className="mono faint" style={{ fontSize: 11 }}>{s[k]}</span></span>
            </label>
          ))}
        </div>
      </Glass>

      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><Layers size={16} /> Glass</h3>
        <Slider label="Blur" k="blur" min={0} max={50} unit="px" />
        <Slider label="Transparency" k="glassAlpha" min={0.02} max={0.3} step={0.01} />
        <Slider label="Glow strength" k="glow" min={0} max={1} step={0.05} />
        <Slider label="Corner radius" k="radius" min={4} max={36} unit="px" />
        <Toggle label="Liquid refraction" k="liquid" hint="Glass bends what's behind it (Chrome / Edge)" />
        <Toggle label="Specular light" k="specular" hint="Light follows your cursor across glass" />
        <Toggle label="3D tilt cards" k="tilt" />
      </Glass>

      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><ImageIcon size={16} /> Background</h3>
        <div style={{ marginBottom: 14 }}>
          <Seg id="bg" value={s.background} onChange={(v) => (v === 'image' && !bgImage ? fileRef.current.click() : update({ background: v }))} options={BGS} />
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          <button className="btn sm" onClick={() => fileRef.current.click()}><Upload size={14} /> Upload image</button>
          {bgImage && <button className="btn sm" onClick={() => (setBgImage(''), update({ background: 'aurora' }))}><Trash2 size={14} /> Remove image</button>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onImage} />
        </div>
        <Toggle label="Film grain" k="grain" />
        <Toggle label="Vignette" k="vignette" />
        <Slider label="Animation speed" k="motion" min={0.2} max={3} step={0.1} unit="×" />
      </Glass>

      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><Type size={16} /> Layout & type</h3>
        <div className="field">
          <label className="label">Font</label>
          <div className="row wrap" style={{ gap: 8 }}>
            {Object.entries(FONTS).map(([k, f]) => <button key={k} className={`chip ${s.font === k ? 'on' : ''}`} style={{ fontFamily: f.css }} onClick={() => update({ font: k })}>{f.name}</button>)}
          </div>
        </div>
        <div className="field">
          <label className="label">Density</label>
          <Seg id="density" value={s.density} onChange={(v) => update({ density: v })} options={[{ value: 'compact', label: 'Compact' }, { value: 'comfy', label: 'Comfy' }, { value: 'spacious', label: 'Spacious' }]} />
        </div>
      </Glass>

      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><Zap size={16} /> Performance & motion</h3>
        <div className="field">
          <label className="label">Performance mode</label>
          <Seg id="perf" value={s.perf} onChange={(v) => update({ perf: v })} options={[{ value: 'auto', label: 'Auto' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
          <div className="hint" style={{ marginTop: 6 }}>On = no blur on cards. Auto turns it on for low-power devices.</div>
        </div>
        <Toggle label="Reduce motion" k="reduceMotion" hint="Stops animations and the moving background" />
      </Glass>

      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><Sparkles size={16} /> Backup & sync</h3>
        <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>Your setup (theme, layout, tags, folders, pins) lives only in this browser. Move it between devices with a file, or with a private Gist in <b>your own</b> GitHub account.</p>
        <div className="row wrap">
          <button className="btn" onClick={exportData}><Download size={15} /> Export file</button>
          <button className="btn" onClick={() => importRef.current.click()}><Upload size={15} /> Import file</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={importData} />
        </div>
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={pushSync} disabled={!!sync}>{sync === 'up' ? <Spinner /> : <CloudUpload size={15} />} Save to Gist</button>
          <button className="btn" onClick={pullSync} disabled={!!sync}>{sync === 'down' ? <Spinner /> : <CloudDownload size={15} />} Restore from Gist</button>
        </div>
        <div className="divider" />
        <button className="btn" onClick={reset}><RotateCcw size={15} /> Reset look to defaults</button>
      </Glass>

      <Glass className="section widget" style={{ '--span': 6 }}>
        <h3><ShieldCheck size={16} /> Privacy & security</h3>
        <ul className="muted" style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8 }}>
          <li>No RepoVerse server or database. Your browser talks directly to GitHub.</li>
          <li>Token and data are encrypted (AES-256-GCM) with a non-exportable key.</li>
          <li>No analytics, trackers or third-party scripts. A strict Content Security Policy is applied.</li>
          <li>Granted scopes: <span className="mono" style={{ fontSize: 12 }}>{(scopes.length ? scopes : ['fine-grained token']).join(', ')}</span></li>
          {scopes.length > 0 && SCOPES.some((x) => !scopes.includes(x)) && <li style={{ color: '#fbbf24' }}>Missing: {SCOPES.filter((x) => !scopes.includes(x)).join(', ')}. Some features may not work.</li>}
        </ul>
        <button className="btn danger" onClick={wipe}><Trash2 size={15} /> Erase all data on this device</button>
      </Glass>
    </div>
  )
}
