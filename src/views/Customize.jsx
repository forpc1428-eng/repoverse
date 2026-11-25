import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, Moon, Stars, LayoutPanelLeft, Gauge, ShieldCheck, Palette, CalendarHeart, CalendarDays, Crosshair, BatteryCharging, Zap, Download, Upload,
  CloudUpload, CloudDownload, RotateCcw, Trash2, Eye, ToggleRight, Users, Plus, Check, LogOut,
} from 'lucide-react'
import { Glass, Seg, Spinner, Switch, spring, useToast } from '../components/ui'
import { sceneRef } from '../components/Background'
import { useSettings, SCENES, FONTS, DEFAULTS, useIsMobile } from '../lib/settings'
import { useAuth, SCOPES } from '../lib/auth'
import { phaseFromDate, phaseName, resolvePhase, illumination } from '../scene/phase'
import { download } from '../lib/util'

const GIST_FILE = 'repoverse-settings.json'
const SECTIONS = [
  { id: 'scenes', label: 'Scenes', icon: Sparkles },
  { id: 'moon', label: 'Moon', icon: Moon },
  { id: 'sky', label: 'Sky & stars', icon: Stars },
  { id: 'ui', label: 'Interface', icon: Palette },
  { id: 'layout', label: 'Layout', icon: LayoutPanelLeft },
  { id: 'features', label: 'Features', icon: ToggleRight },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'perf', label: 'Performance', icon: Gauge },
  { id: 'data', label: 'Backup & privacy', icon: ShieldCheck },
]

// ------------------------------------------------------------------ small controls
function Row({ label, hint, children }) {
  return (
    <div className="cz-row">
      <div className="cz-label">{label}{hint && <small>{hint}</small>}</div>
      <div className="cz-ctl">{children}</div>
    </div>
  )
}
function Slider({ k, min, max, step = 0.01, fmt = (v) => v, label, hint }) {
  const { settings: s, update } = useSettings()
  const v = s[k]
  return (
    <Row label={label} hint={hint}>
      <input type="range" min={min} max={max} step={step} value={v} style={{ '--fill': `${((v - min) / (max - min)) * 100}%`, flex: 1 }} onChange={(e) => update({ [k]: +e.target.value })} aria-label={label} />
      <span className="cz-val">{fmt(v)}</span>
    </Row>
  )
}
function Toggle({ k, label, hint }) {
  const { settings: s, update } = useSettings()
  return (
    <Row label={label} hint={hint}>
      <div className="grow" />
      <Switch on={!!s[k]} onChange={(v) => update({ [k]: v })} label={label} />
    </Row>
  )
}
function Colors({ label, keys, hint }) {
  const { settings: s, update } = useSettings()
  return (
    <Row label={label} hint={hint}>
      {keys.map(([k, name]) => (
        <label key={k} className="row" style={{ gap: 8, fontSize: 12.5 }} title={name}>
          <input type="color" value={s[k]} onChange={(e) => update({ [k]: e.target.value })} aria-label={name} />
          <span className="muted">{name}</span>
        </label>
      ))}
    </Row>
  )
}
function Choice({ k, label, hint, options }) {
  const { settings: s, update } = useSettings()
  return (
    <Row label={label} hint={hint}>
      <Seg id={k} value={s[k]} onChange={(v) => update({ [k]: v })} options={options.map(([value, l]) => ({ value, label: l }))} />
    </Row>
  )
}

/** Tiny CSS moon showing a phase (for scene cards). */
function MiniMoon({ phase, tint = '#f3eee6', size = 40 }) {
  const p = ((phase % 1) + 1) % 1
  const lit = illumination(p)
  const waxing = p < 0.5
  // terminator: an ellipse whose width follows the illuminated fraction
  const w = Math.abs(1 - 2 * lit) * size
  return (
    <svg className="mini-moon" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={size / 2} fill="rgba(0,0,0,.55)" />
      <path
        d={`M ${size / 2} 0 A ${size / 2} ${size / 2} 0 0 ${waxing ? 1 : 0} ${size / 2} ${size} A ${w / 2} ${size / 2} 0 0 ${lit > 0.5 === waxing ? 1 : 0} ${size / 2} 0`}
        fill={tint}
        style={{ filter: `drop-shadow(0 0 6px ${tint})` }}
      />
    </svg>
  )
}

export default function Customize() {
  const mobile = useIsMobile()
  const [section, setSection] = useState('scenes')
  const bodyRef = useRef(null)
  return (
    <div className="cz">
      <Glass as="nav" className="cz-nav" aria-label="Customize sections">
        {SECTIONS.map((x) => (
          <button key={x.id} className={section === x.id ? 'on' : ''} onClick={() => setSection(x.id)}>
            {section === x.id && <motion.span layoutId="cz-pill" className="dock-pill" style={{ borderRadius: 12 }} transition={spring} />}
            <x.icon size={17} /> {x.label}
          </button>
        ))}
      </Glass>
      <div className="cz-body" ref={bodyRef} key={section} style={{ animation: 'rise .4s var(--ease) both' }}>
        {section === 'scenes' && <ScenesSection mobile={mobile} />}
        {section === 'moon' && <MoonSection mobile={mobile} />}
        {section === 'sky' && <SkySection />}
        {section === 'ui' && <UiSection />}
        {section === 'layout' && <LayoutSection />}
        {section === 'features' && <FeaturesSection />}
        {section === 'accounts' && <AccountsSection />}
        {section === 'perf' && <PerfSection />}
        {section === 'data' && <DataSection />}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ sections
function ScenesSection({ mobile }) {
  const { settings: s, update, applyScene } = useSettings()
  const { toast } = useToast()
  const quick = [
    { icon: CalendarDays, title: "Tonight's real moon", sub: phaseName(phaseFromDate(new Date())), run: () => update({ moonPhaseMode: 'today' }) },
    { icon: CalendarHeart, title: 'Moon of Feb 14, 2008', sub: 'Waxing gibbous · 57% lit', run: () => update({ moonPhaseMode: 'date', moonDate: '2008-02-14' }) },
    { icon: Crosshair, title: s.moonX > 0.5 ? 'Move moon left' : 'Move moon right', sub: 'Swap sides', run: () => update(mobile ? { moonXMobile: 1 - s.moonXMobile } : { moonX: 1 - s.moonX }) },
    { icon: BatteryCharging, title: s.quality === 'battery' ? 'Back to balanced' : 'Battery saver', sub: s.quality === 'battery' ? 'Smoother visuals' : '30 fps, lighter render', run: () => update({ quality: s.quality === 'battery' ? 'auto' : 'battery' }) },
    { icon: Eye, title: s.moonVisible ? 'Hide the moon' : 'Show the moon', sub: 'Just stars & sky', run: () => update({ moonVisible: !s.moonVisible }) },
    { icon: Zap, title: s.shooting === 'shower' ? 'Calm sky' : 'Meteor shower', sub: 'Shooting stars', run: () => update({ shooting: s.shooting === 'shower' ? 'normal' : 'shower' }) },
  ]
  return (
    <>
      <Glass className="section">
        <h3><Sparkles size={16} /> Scenes <span className="faint" style={{ fontWeight: 400, fontSize: 13 }}>One click sets the moon, sky and colours</span></h3>
        <div className="scenes">
          {Object.entries(SCENES).map(([id, sc]) => (
            <button
              key={id}
              className={`scene-card ${s.scene === id ? 'on' : ''}`}
              onClick={() => (applyScene(id), toast(`${sc.name} applied`, 'success'))}
              style={{ background: `radial-gradient(70% 80% at 80% 20%, ${sc.galaxyColor2}55, transparent 60%), radial-gradient(60% 60% at 20% 90%, ${sc.nebulaColor}44, transparent 70%), linear-gradient(${sc.skyTop}, ${sc.skyBottom})` }}
            >
              <MiniMoon phase={sc.moonPhaseMode === 'date' ? phaseFromDate(new Date(sc.moonDate + 'T20:00:00Z')) : sc.moonPhase} tint={sc.moonTint} />
              <b>{sc.name}</b>
              <small>{sc.note}</small>
              <span className="row" style={{ gap: 4, marginTop: 6, position: 'relative' }}>
                {[sc.c1, sc.c2, sc.c3].map((c) => <i key={c} style={{ width: 12, height: 12, borderRadius: 99, background: c, display: 'inline-block' }} />)}
              </span>
            </button>
          ))}
        </div>
        {s.scene === 'custom' && <p className="hint" style={{ marginBottom: 0 }}>You've customised the current scene. Pick one above to start fresh.</p>}
      </Glass>
      <Glass className="section">
        <h3><Zap size={16} /> Quick actions</h3>
        <div className="quick">
          {quick.map((q) => (
            <button key={q.title} onClick={q.run}>
              <span className="q-ico"><q.icon size={18} /></span>
              <span><b>{q.title}</b><small>{q.sub}</small></span>
            </button>
          ))}
        </div>
      </Glass>
    </>
  )
}

function MoonSection({ mobile }) {
  const { settings: s, update } = useSettings()
  const phase = resolvePhase(s)
  const pos = mobile ? { x: 'moonXMobile', y: 'moonYMobile', size: 'moonSizeMobile' } : { x: 'moonX', y: 'moonY', size: 'moonSize' }
  const spots = [['Top left', 0.24, 0.26], ['Top right', 0.76, 0.28], ['Center', 0.5, 0.45], ['Bottom right', 0.8, 0.72]]
  return (
    <>
      <Glass className="cz-group">
        <h3>Phase</h3>
        <Row label="Moon phase from" hint={`${phaseName(phase)} · ${Math.round(illumination(phase) * 100)}% lit`}>
          <Seg id="pm" value={s.moonPhaseMode} onChange={(v) => update({ moonPhaseMode: v })} options={[{ value: 'date', label: 'A date' }, { value: 'today', label: 'Tonight' }, { value: 'manual', label: 'Manual' }]} />
        </Row>
        {s.moonPhaseMode === 'date' && (
          <Row label="Date" hint="Any date, past or future">
            <input type="date" className="input" style={{ width: 'auto' }} value={s.moonDate} onChange={(e) => update({ moonDate: e.target.value })} />
            <button className="btn sm" onClick={() => update({ moonDate: '2008-02-14' })}>Feb 14, 2008</button>
          </Row>
        )}
        {s.moonPhaseMode === 'manual' && <Slider k="moonPhase" label="Phase" min={0} max={0.999} step={0.005} fmt={(v) => `${Math.round(illumination(v) * 100)}%`} hint={phaseName(s.moonPhase)} />}
        <Slider k="moonTilt" label="Terminator tilt" min={-90} max={90} step={1} fmt={(v) => `${v}°`} hint="Angle of the light" />
      </Glass>
      <Glass className="cz-group">
        <h3>Placement {mobile && <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>(phone layout)</span>}</h3>
        <Row label="Quick position">
          {spots.map(([l, x, y]) => <button key={l} className="chip" onClick={() => update({ [pos.x]: x, [pos.y]: y })}>{l}</button>)}
        </Row>
        <Slider k={pos.size} label="Size" min={0.15} max={1.1} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Slider k={pos.x} label="Horizontal" min={0} max={1} fmt={(v) => `${Math.round(v * 100)}`} />
        <Slider k={pos.y} label="Vertical" min={0} max={1} fmt={(v) => `${Math.round(v * 100)}`} />
        <Toggle k="moonVisible" label="Show moon" />
      </Glass>
      <Glass className="cz-group">
        <h3>Look</h3>
        <Colors label="Moon & glow colour" keys={[['moonTint', 'Moon'], ['glowColor', 'Glow'], ['earthTint', 'Earthshine']]} />
        <Slider k="moonExposure" label="Brightness" min={0.2} max={2} fmt={(v) => v.toFixed(2)} />
        <Slider k="moonContrast" label="Surface contrast" min={0.6} max={1.8} fmt={(v) => v.toFixed(2)} hint="Seas vs highlands" />
        <Slider k="moonBump" label="Crater depth" min={0} max={3} fmt={(v) => v.toFixed(1)} />
        <Slider k="glowIntensity" label="Glow strength" min={0} max={2} fmt={(v) => v.toFixed(2)} />
        <Slider k="glowSize" label="Glow size" min={1.3} max={5} fmt={(v) => v.toFixed(1)} />
        <Slider k="earthshine" label="Earthshine" min={0} max={0.4} fmt={(v) => v.toFixed(2)} hint="Faint light on the dark side" />
        <Slider k="moonRotation" label="Rotation" min={-180} max={180} step={1} fmt={(v) => `${v}°`} />
        <Slider k="moonSpin" label="Moon rotation speed" min={0} max={6} step={0.1} fmt={(v) => (v ? `${v.toFixed(1)}°/s` : 'Off')} hint="Slowly reveals the far side" />
        <Toggle k="libration" label="Gentle libration" hint="The slow real-life wobble" />
      </Glass>
    </>
  )
}

function SkySection() {
  return (
    <>
      <Glass className="cz-group">
        <h3>Sky</h3>
        <Colors label="Sky gradient" keys={[['skyTop', 'Top'], ['skyBottom', 'Horizon']]} />
        <Slider k="horizonGlow" label="Horizon glow" min={0} max={1.5} fmt={(v) => v.toFixed(2)} />
        <Slider k="skyDrift" label="Sky drift" min={0} max={4} fmt={(v) => `${v.toFixed(1)}×`} />
        <Toggle k="parallax" label="Depth parallax" hint="Stars shift as you move the mouse" />
      </Glass>
      <Glass className="cz-group">
        <h3>Galaxy & nebula</h3>
        <Colors label="Milky Way" keys={[['galaxyColor1', 'Core'], ['galaxyColor2', 'Arms']]} />
        <Slider k="galaxyAmount" label="Milky Way strength" min={0} max={2} fmt={(v) => v.toFixed(2)} />
        <Slider k="galaxyTilt" label="Milky Way angle" min={-90} max={90} step={1} fmt={(v) => `${v}°`} />
        <Slider k="galaxyOffset" label="Milky Way offset" min={-0.5} max={0.5} fmt={(v) => v.toFixed(2)} />
        <Colors label="Nebula colour" keys={[['nebulaColor', 'Nebula']]} />
        <Slider k="nebulaAmount" label="Nebula strength" min={0} max={2} fmt={(v) => v.toFixed(2)} />
      </Glass>
      <Glass className="cz-group">
        <h3>Stars</h3>
        <Slider k="starDensity" label="Star count" min={0.1} max={2.5} fmt={(v) => `${v.toFixed(1)}×`} />
        <Slider k="starSize" label="Star size" min={0.4} max={2.5} fmt={(v) => `${v.toFixed(1)}×`} />
        <Slider k="starBrightness" label="Star brightness" min={0.2} max={2.5} fmt={(v) => `${v.toFixed(1)}×`} />
        <Slider k="starTwinkle" label="Twinkle" min={0} max={1} fmt={(v) => `${Math.round(v * 100)}%`} />
        <Choice k="shooting" label="Shooting stars" options={[['off', 'Off'], ['rare', 'Rare'], ['normal', 'Normal'], ['shower', 'Shower']]} />
        <Colors label="Shooting star colour" keys={[['shootColor', 'Trail']]} />
      </Glass>
    </>
  )
}

function UiSection() {
  const { settings: s, update } = useSettings()
  return (
    <>
      <Glass className="cz-group">
        <h3>Colour</h3>
        <Colors label="Accent colours" keys={[['c1', 'Primary'], ['c2', 'Secondary'], ['c3', 'Highlight']]} />
        <Row label="Match the sky" hint="Take accents from the galaxy & nebula">
          <button className="btn sm" onClick={() => update({ c1: s.nebulaColor, c2: s.galaxyColor2, c3: s.galaxyColor1 })}>Match</button>
        </Row>
      </Glass>
      <Glass className="cz-group">
        <h3>Glass</h3>
        <Slider k="blur" label="Glass blur" min={0} max={40} step={1} fmt={(v) => `${v}px`} hint="0 = solid panels (fastest)" />
        <Slider k="glassAlpha" label="Glass tint" min={0.01} max={0.25} fmt={(v) => v.toFixed(2)} />
        <Slider k="radius" label="Corner roundness" min={4} max={32} step={1} fmt={(v) => `${v}px`} />
        <Choice k="cardStyle" label="Card style" options={[['glass', 'Glass'], ['solid', 'Solid'], ['outline', 'Outline'], ['minimal', 'Minimal']]} />
        <Toggle k="cardBlur" label="Real blur on cards" hint="Prettier, heavier. Off is recommended" />
      </Glass>
      <Glass className="cz-group">
        <h3>Type</h3>
        <Row label="Font">
          {Object.entries(FONTS).map(([k, f]) => <button key={k} className={`chip ${s.font === k ? 'on' : ''}`} style={{ fontFamily: f.css }} onClick={() => update({ font: k })}>{f.name}</button>)}
        </Row>
        <Slider k="uiScale" label="Text size" min={0.85} max={1.2} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} />
      </Glass>
    </>
  )
}

function LayoutSection() {
  return (
    <Glass className="cz-group">
      <h3>Layout</h3>
      <Choice k="dock" label="Navigation dock" hint="Desktop" options={[['left', 'Left'], ['bottom', 'Bottom']]} />
      <Choice k="cardSize" label="Card size" options={[['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]} />
      <Choice k="density" label="Spacing" options={[['compact', 'Compact'], ['comfy', 'Comfy'], ['spacious', 'Spacious']]} />
      <Choice k="width" label="Content width" options={[['contained', 'Centered'], ['full', 'Full']]} />
      <Choice k="view" label="Default repo view" options={[['grid', 'Grid'], ['list', 'List'], ['board', 'Board'], ['timeline', 'Timeline']]} />
      <Toggle k="showHealth" label="Health dot on cards" />
    </Glass>
  )
}

function FeaturesSection() {
  const { update } = useSettings()
  const all = (v) => update({ fWall: v, fPush: v, fInsights: v, fCodeSearch: v, fBulk: v, fBoard: v, fTimeline: v, fPalette: v, fShortcuts: v, fLivePreviews: v, fHero: v, fForks: true, fScene: true, fToasts: true })
  return (
    <>
      <Glass className="cz-group">
        <h3>Pages</h3>
        <Toggle k="fWall" label="Preview Wall" hint="Live previews of all your sites" />
        <Toggle k="fPush" label="Push Folder" hint="Upload a folder as a new repo" />
        <Toggle k="fInsights" label="Insights" hint="Stats, heatmap, traffic" />
      </Glass>
      <Glass className="cz-group">
        <h3>Repositories</h3>
        <Toggle k="fHero" label="Greeting & stats" hint="The big hello at the top" />
        <Toggle k="fCodeSearch" label="Code search" hint="Search inside all your code" />
        <Toggle k="fBulk" label="Bulk actions" hint="Select many repos at once" />
        <Toggle k="fBoard" label="Board view" />
        <Toggle k="fTimeline" label="Timeline view" />
        <Toggle k="fForks" label="Show forks" hint="Off hides forks unless you filter for them" />
        <Toggle k="fLivePreviews" label="Live site previews" hint="Off uses lightweight snapshots" />
        <Choice k="autoRefresh" label="Auto-refresh repos" hint="Re-sync with GitHub in the background" options={[[0, 'Off'], [5, '5 min'], [15, '15 min'], [60, '1 hour']]} />
      </Glass>
      <Glass className="cz-group">
        <h3>App</h3>
        <Toggle k="fScene" label="3D moon & sky" hint="Off = simple gradient, lightest on battery" />
        <Toggle k="fPalette" label="Command palette" hint="Ctrl K to jump anywhere" />
        <Toggle k="fShortcuts" label="Keyboard shortcuts" hint="Alt + number switches pages" />
        <Toggle k="fToasts" label="Notifications" hint="Errors always show" />
        <Row label="Quick set">
          <button className="btn sm" onClick={() => all(true)}>Everything on</button>
          <button className="btn sm" onClick={() => all(false)}>Minimal</button>
        </Row>
      </Glass>
    </>
  )
}

function AccountsSection() {
  const { user, accounts, switchAccount, addAccount, signOut, demo } = useAuth()
  const { toast, confirm } = useToast()
  return (
    <Glass className="cz-group">
      <h3>Signed-in accounts</h3>
      {(demo ? [user] : accounts).map((a) => (
        <Row key={a.login} label={<span className="row" style={{ gap: 10 }}><img className="avatar" src={a.avatar_url} alt="" />{a.name || a.login}</span>} hint={`@${a.login}`}>
          <div className="grow" />
          {a.login === user?.login ? (
            <span className="tag" style={{ color: '#6ee7b7' }}><Check size={12} /> Active</span>
          ) : (
            <button className="btn sm primary" onClick={() => switchAccount(a.login).catch((e) => toast(e.message, 'error'))}>Switch</button>
          )}
          {!demo && (
            <button className="btn sm" onClick={async () => (await confirm({ title: `Sign out @${a.login}?`, body: 'Other accounts stay signed in.', okLabel: 'Sign out', danger: true })) && signOut(a.login)}>
              <LogOut size={14} /> Sign out
            </button>
          )}
        </Row>
      ))}
      {!demo && (
        <Row label="Add an account" hint="GitHub shows its account picker">
          <button className="btn sm primary" onClick={() => addAccount().catch((e) => toast(e.message, 'error'))}><Plus size={14} /> Add another account</button>
        </Row>
      )}
    </Glass>
  )
}

function PerfSection() {
  const { settings: s, update } = useSettings()
  const [fps, setFps] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setFps(sceneRef.current?.fps || 0), 500)
    return () => clearInterval(t)
  }, [])
  return (
    <Glass className="cz-group">
      <h3>Performance <span className="fps" style={{ marginLeft: 8 }}>{fps} fps · {sceneRef.current?.qName || '…'}</span></h3>
      <Choice k="quality" label="Render quality" hint="Auto picks the best for this device" options={[['auto', 'Auto'], ['battery', 'Battery'], ['balanced', 'Balanced'], ['ultra', 'Ultra']]} />
      <Row label="Frame-rate cap" hint="Lower = cooler & longer battery">
        <Seg id="fps" value={s.fpsCap} onChange={(v) => update({ fpsCap: v })} options={[{ value: 0, label: 'Auto' }, { value: 30, label: '30' }, { value: 60, label: '60' }, { value: 120, label: '120' }]} />
      </Row>
      <Slider k="motion" label="Animation speed" min={0} max={3} fmt={(v) => `${v.toFixed(1)}×`} />
      <Toggle k="reduceMotion" label="Reduce motion" hint="Freezes the sky and turns off animations" />
    </Glass>
  )
}

function DataSection() {
  const { settings: s, reset, userData, setUserData, setSettings } = useSettings()
  const { gh, logout, scopes, demo } = useAuth()
  const { toast, confirm } = useToast()
  const importRef = useRef(null)
  const [sync, setSync] = useState('')

  const applyImport = (d) => {
    if (d?.app !== 'repoverse') throw new Error('Not a RepoVerse setup file')
    if (d.settings) setSettings({ ...DEFAULTS, ...d.settings, version: DEFAULTS.version })
    if (d.userData) setUserData(d.userData)
  }
  const findGist = async () => (await gh.gists()).find((g) => g.files[GIST_FILE])
  const pushSync = async () => {
    setSync('up')
    try {
      const content = JSON.stringify({ app: 'repoverse', version: 3, settings: s, userData }, null, 2)
      const g = await findGist()
      if (g) await gh.updateGist(g.id, { files: { [GIST_FILE]: { content } } })
      else await gh.createGist({ description: 'RepoVerse settings sync (private)', public: false, files: { [GIST_FILE]: { content } } })
      toast('Saved to a private Gist in your GitHub', 'success')
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
      if (!g) throw new Error('No synced settings yet. Save from another device first.')
      applyImport(JSON.parse((await gh.gist(g.id)).files[GIST_FILE].content))
      toast('Restored from your Gist', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSync('')
    }
  }
  const wipe = async () => {
    if (await confirm({ title: 'Erase everything on this device?', body: 'Deletes your login, cached repos, tags, pins, theme and the encryption key from this browser.\nYour GitHub repositories are NOT touched.', danger: true, okLabel: 'Erase & sign out' })) {
      localStorage.removeItem('rv-settings')
      logout(true)
    }
  }
  return (
    <>
      <Glass className="cz-group">
        <h3>Backup & sync</h3>
        <Row label="Setup file" hint="Look, layout, tags, pins">
          <button className="btn sm" onClick={() => download('repoverse-setup.json', JSON.stringify({ app: 'repoverse', version: 3, settings: s, userData }, null, 2))}><Download size={14} /> Export</button>
          <button className="btn sm" onClick={() => importRef.current.click()}><Upload size={14} /> Import</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => {
            const f = e.target.files[0]
            if (f) f.text().then((t) => { try { applyImport(JSON.parse(t)); toast('Imported', 'success') } catch (err) { toast(err.message, 'error') } })
            e.target.value = ''
          }} />
        </Row>
        <Row label="Sync between devices" hint="Through a private Gist in your own GitHub">
          <button className="btn sm primary" onClick={pushSync} disabled={!!sync || demo}>{sync === 'up' ? <Spinner size={13} /> : <CloudUpload size={14} />} Save</button>
          <button className="btn sm" onClick={pullSync} disabled={!!sync || demo}>{sync === 'down' ? <Spinner size={13} /> : <CloudDownload size={14} />} Restore</button>
        </Row>
        <Row label="Reset look" hint="Back to the Feb 14, 2008 scene">
          <button className="btn sm" onClick={reset}><RotateCcw size={14} /> Reset</button>
        </Row>
      </Glass>
      <Glass className="cz-group">
        <h3>Privacy</h3>
        <ul className="muted" style={{ margin: '8px 0 14px', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8 }}>
          <li>No database: your browser talks directly to GitHub.</li>
          <li>Login and data encrypted (AES-256-GCM) with a key that can't be exported.</li>
          <li>No analytics, trackers or third-party scripts.</li>
          <li>Permissions: <span className="mono" style={{ fontSize: 12 }}>{(scopes.length ? scopes : SCOPES).join(', ')}</span></li>
        </ul>
        <button className="btn danger sm" onClick={wipe} style={{ marginBottom: 14 }}><Trash2 size={14} /> Erase all data on this device</button>
      </Glass>
    </>
  )
}
