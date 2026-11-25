import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles, Moon, Stars, LayoutPanelLeft, Gauge, ShieldCheck, Palette, CalendarHeart, CalendarDays, Crosshair, BatteryCharging, Zap, Download, Upload,
  CloudUpload, CloudDownload, RotateCcw, Trash2, Eye, ToggleRight, Users, Plus, Check, LogOut, PanelLeft, GripVertical, ChevronUp, ChevronDown, EyeOff,
  Search, Info, Play, MapPin, Github, X,
} from 'lucide-react'
import Credit from '../components/Credit'
import { moonTimes, askLocation, guessLocation } from '../lib/moonpos'
import { NAV } from '../App'
import { orderNav } from '../components/Dock'
import { Glass, Seg, Spinner, Switch, spring, useToast } from '../components/ui'
import { sceneRef } from '../components/Background'
import { useSettings, SCENES, FONTS, DEFAULTS, useIsMobile, perfPatch } from '../lib/settings'
import { useAuth, SCOPES } from '../lib/auth'
import { phaseFromDate, phaseName, resolvePhase, illumination } from '../scene/phase'
import { download } from '../lib/util'

const GIST_FILE = 'repoverse-settings.json'
const SECTIONS = [
  { id: 'scenes', label: 'Scenes', icon: Sparkles },
  { id: 'moon', label: 'Moon', icon: Moon },
  { id: 'sky', label: 'Sky & stars', icon: Stars },
  { id: 'ui', label: 'Interface', icon: Palette },
  { id: 'dock', label: 'Dock', icon: PanelLeft },
  { id: 'layout', label: 'Layout', icon: LayoutPanelLeft },
  { id: 'features', label: 'Features', icon: ToggleRight },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'perf', label: 'Performance', icon: Gauge },
  { id: 'data', label: 'Backup & privacy', icon: ShieldCheck },
  { id: 'about', label: 'About', icon: Info },
]

// ------------------------------------------------------------------ small controls
const SearchCtx = createContext('')
const textOf = (n) => (typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(textOf).join(' ') : n?.props ? textOf(n.props.children) : '')
function Row({ label, hint, children }) {
  const q = useContext(SearchCtx)
  if (q && !`${textOf(label)} ${hint || ''}`.toLowerCase().includes(q)) return null
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
  const [query, setQuery] = useState('')
  const bodyRef = useRef(null)
  const q = query.trim().toLowerCase()
  return (
    <div className="cz">
      <Glass as="nav" className="cz-nav" aria-label="Customize sections">
        {SECTIONS.map((x) => (
          <button key={x.id} className={section === x.id && !q ? 'on' : ''} onClick={() => (setSection(x.id), setQuery(''))}>
            {section === x.id && !q && <motion.span layoutId="cz-pill" className="dock-pill" style={{ borderRadius: 12 }} transition={spring} />}
            <x.icon size={17} /> {x.label}
          </button>
        ))}
      </Glass>
      <div className="cz-body" ref={bodyRef}>
        <div className="search cz-search">
          <Search size={16} />
          <input className="input glass" placeholder="Search all settings… (e.g. preview, blur, stars, dock)" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search settings" />
          {query && <button className="btn ghost sm icon" style={{ position: 'absolute', right: 6, top: 6 }} onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
        </div>
        <SearchCtx.Provider value={q}>
          {q ? (
            <>
              <MoonSection mobile={mobile} />
              <SkySection />
              <UiSection />
              <DockSection />
              <LayoutSection />
              <FeaturesSection />
              <PerfSection />
            </>
          ) : (
            <div key={section} className="col" style={{ gap: 'var(--gap)', animation: 'rise .4s var(--ease) both' }}>
        {section === 'scenes' && <ScenesSection mobile={mobile} />}
        {section === 'moon' && <MoonSection mobile={mobile} />}
        {section === 'sky' && <SkySection />}
        {section === 'ui' && <UiSection />}
        {section === 'dock' && <DockSection />}
        {section === 'layout' && <LayoutSection />}
        {section === 'features' && <FeaturesSection />}
        {section === 'accounts' && <AccountsSection />}
        {section === 'perf' && <PerfSection />}
        {section === 'data' && <DataSection />}
        {section === 'about' && <AboutSection />}
            </div>
          )}
        </SearchCtx.Provider>
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
      <LiveMoon />
      <Glass className="cz-group">
        <h3>Phase timeline</h3>
        <PlayMonth />
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
      <Glass className="cz-group">
        <h3>Ambience</h3>
        <Toggle k="fSound" label="Night ambience" hint="Soft breeze & distant crickets, generated live (no audio files)" />
        <Slider k="soundVolume" label="Volume" min={0} max={1} fmt={(v) => `${Math.round(v * 100)}%`} />
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

function DockSection() {
  const { settings: s, update } = useSettings()
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const order = orderNav(NAV, { ...s, dockHidden: [] }).map((n) => n.id)
  const hidden = s.dockHidden || []
  const move = (id, to) => {
    const next = order.filter((x) => x !== id)
    next.splice(Math.max(0, Math.min(next.length, to)), 0, id)
    update({ dockOrder: next })
  }
  const toggle = (id) => update({ dockHidden: hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id] })
  return (
    <>
      <Glass className="cz-group">
        <h3>Dock items <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>· drag to reorder</span></h3>
        <div className="col" style={{ gap: 6, margin: '8px 0 12px' }}>
          {order.map((id, i) => {
            const n = NAV.find((x) => x.id === id)
            const off = hidden.includes(id)
            return (
              <div
                key={id}
                className={`dock-edit-row ${drag === id ? 'dragging' : ''} ${over === id ? 'over' : ''} ${off ? 'off' : ''}`}
                draggable
                onDragStart={() => setDrag(id)}
                onDragEnd={() => (setDrag(null), setOver(null))}
                onDragOver={(e) => (e.preventDefault(), setOver(id))}
                onDrop={(e) => (e.preventDefault(), drag && drag !== id && move(drag, i), setDrag(null), setOver(null))}
              >
                <GripVertical size={16} className="faint" />
                <n.icon size={18} />
                <span className="grow">{n.label}</span>
                <button className="btn ghost sm icon" aria-label="Move up" disabled={i === 0} onClick={() => move(id, i - 1)}><ChevronUp size={15} /></button>
                <button className="btn ghost sm icon" aria-label="Move down" disabled={i === order.length - 1} onClick={() => move(id, i + 1)}><ChevronDown size={15} /></button>
                {id === 'customize' ? (
                  <span className="hint" style={{ width: 32, textAlign: 'center' }} title="Always shown so you can get back here">🔒</span>
                ) : (
                  <button className="btn ghost sm icon" aria-label={off ? 'Show' : 'Hide'} title={off ? 'Show in dock' : 'Hide from dock'} onClick={() => toggle(id)}>{off ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                )}
              </div>
            )
          })}
        </div>
      </Glass>
      <Glass className="cz-group">
        <h3>Look</h3>
        <Choice k="dock" label="Position" hint="Desktop" options={[['left', 'Left'], ['right', 'Right'], ['bottom', 'Bottom']]} />
        <Choice k="dockSize" label="Size" options={[['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']]} />
        <Toggle k="dockCompact" label="Compact" hint="Hug the icons instead of full height" />
        <Toggle k="dockLabels" label="Show labels" hint="Names under the icons" />
        <Toggle k="dockLogo" label="Moon logo" hint="Shows tonight's (or your chosen) phase" />
        <Toggle k="dockAccount" label="Account button" />
      </Glass>
      <Glass className="cz-group">
        <h3>Pinned repos</h3>
        <Toggle k="dockPins" label="Pinned repos in dock" hint="Pin repos from their card to add them here" />
        {s.dockPins && <Slider k="dockPinCount" label="How many" min={1} max={10} step={1} fmt={(v) => v} />}
        <Row label="Reset dock">
          <button className="btn sm" onClick={() => update({ dockOrder: NAV.map((n) => n.id), dockHidden: [], dockSize: 'md', dockLabels: false, dockCompact: true, dock: 'left', dockPins: true, dockLogo: true, dockAccount: true })}>
            <RotateCcw size={14} /> Default dock
          </button>
        </Row>
      </Glass>
    </>
  )
}

function LayoutSection() {
  return (
    <Glass className="cz-group">
      <h3>Layout</h3>
      <Choice k="cardSize" label="Card size" options={[['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]} />
      <Choice k="density" label="Spacing" options={[['compact', 'Compact'], ['comfy', 'Comfy'], ['spacious', 'Spacious']]} />
      <Choice k="width" label="Content width" options={[['contained', 'Centered'], ['full', 'Full']]} />
      <Choice k="view" label="Default repo view" options={[['grid', 'Grid'], ['list', 'List'], ['board', 'Board'], ['timeline', 'Timeline']]} />
      <Toggle k="showHealth" label="Health dot on cards" />
    </Glass>
  )
}

const EVERYTHING = ['fInbox', 'fWall', 'fHosting', 'fPush', 'fTools', 'fInsights', 'fHero', 'fHeroStats', 'fHeroActions', 'fFilters', 'fCodeSearch', 'fBulk', 'fBoard', 'fTimeline', 'fForks',
  'fCardDesc', 'fCardTags', 'fCardMeta', 'fCardActions', 'showHealth', 'fAutoFill', 'fHealthPanel', 'fLanguages', 'fSitePreview', 'fDeployStatus', 'fReleases', 'fGitOps', 'fStaging', 'fHealthCheck',
  'fInboxNotifications', 'fInboxReviews', 'fInboxAssigned', 'fInboxStars', 'fVercel', 'fNetlify', 'fPortfolio', 'fProfileReadme', 'fTemplates', 'fSweep', 'fSecurityAlerts', 'fGrowth',
  'fScene', 'fPalette', 'fShortcuts', 'fToasts', 'fTooltips', 'fRateBadge', 'fSmartCache']
const MINIMAL_OFF = ['fInbox', 'fWall', 'fHosting', 'fPush', 'fTools', 'fInsights', 'fHeroStats', 'fHeroActions', 'fCodeSearch', 'fBulk', 'fBoard', 'fTimeline', 'fCardTags', 'fCardActions',
  'fLanguages', 'fGitOps', 'fStaging', 'fReleases', 'fRateBadge', 'fDeployStatus', 'fSitePreview']

function FeaturesSection() {
  const { settings: s, update } = useSettings()
  const allOn = () => update({ ...Object.fromEntries(EVERYTHING.map((k) => [k, true])), previewMode: 'live' })
  const minimal = () => update({ ...Object.fromEntries(EVERYTHING.map((k) => [k, !MINIMAL_OFF.includes(k)])), previewMode: 'link' })
  return (
    <>
      <Glass className="cz-group">
        <h3>Quick set</h3>
        <Row label="Presets" hint="Then fine-tune anything below">
          <button className="btn sm primary" onClick={allOn}>Everything on</button>
          <button className="btn sm" onClick={minimal}>Minimal</button>
        </Row>
      </Glass>
      <Glass className="cz-group">
        <h3>Pages</h3>
        <Toggle k="fInbox" label="Inbox" hint="Notifications, reviews, assigned, new stars" />
        <Toggle k="fWall" label="Preview Wall" hint="All your live sites at once" />
        <Toggle k="fHosting" label="Hosting" hint="Vercel & Netlify projects" />
        <Toggle k="fPush" label="Push Folder" hint="Upload a folder as a repo" />
        <Toggle k="fTools" label="Tools" hint="Portfolio, profile, templates, sweep" />
        <Toggle k="fInsights" label="Insights" hint="Stats, heatmap, traffic, growth" />
      </Glass>
      <Glass className="cz-group">
        <h3>Previews</h3>
        <Choice k="previewMode" label="Site previews show" hint="Live = real site, Snapshot = image, Link only = just the address" options={[['live', 'Live'], ['snapshot', 'Snapshot'], ['link', 'Link only']]} />
        <Toggle k="fHealthCheck" label="Up/down check" hint="Ping each site when the wall opens" />
        <Toggle k="fSitePreview" label="Preview on repo page" />
      </Glass>
      <Glass className="cz-group">
        <h3>Repositories list</h3>
        <Toggle k="fHero" label="Greeting" />
        <Toggle k="fHeroStats" label="Greeting stats" />
        <Toggle k="fHeroActions" label="Greeting buttons" />
        <Toggle k="fFilters" label="Filter chips" />
        <Toggle k="fCodeSearch" label="Code search" />
        <Toggle k="fBulk" label="Bulk select" />
        <Toggle k="fBoard" label="Board view" />
        <Toggle k="fTimeline" label="Timeline view" />
        <Toggle k="fForks" label="Show forks" />
        <Toggle k="fMergeAccounts" label="All accounts in one list" hint="Also shows repos from your other signed-in accounts" />
        <Toggle k="fCardDesc" label="Card description" />
        <Toggle k="fCardTags" label="Card tags" />
        <Toggle k="fCardMeta" label="Card language & stars" />
        <Toggle k="fCardActions" label="Card quick buttons" />
        <Toggle k="showHealth" label="Card health dot" />
      </Glass>
      <Glass className="cz-group">
        <h3>Repository page</h3>
        <Toggle k="fAutoFill" label="Auto-fill & one-click fixes" hint="Free, in your browser" />
        <Toggle k="fHealthPanel" label="Health panel" />
        <Toggle k="fLanguages" label="Languages panel" />
        <Toggle k="fDeployStatus" label="Deploy status" hint="Live / building / failed from Vercel, Netlify, Pages" />
        <Toggle k="fReleases" label="One-click releases" hint="Next version + automatic changelog" />
        <Toggle k="fGitOps" label="Branches & CI tab" hint="Branches, merge PRs, re-run failed checks" />
        <Toggle k="fStaging" label="Stage & review edits" hint="Edit many files, see the diff, commit once" />
      </Glass>
      <Glass className="cz-group">
        <h3>Inbox</h3>
        <Toggle k="fInboxNotifications" label="Notifications" />
        <Toggle k="fInboxReviews" label="Review requests" />
        <Toggle k="fInboxAssigned" label="Assigned to me" />
        <Toggle k="fInboxStars" label="New stars" />
      </Glass>
      <Glass className="cz-group">
        <h3>Hosting & tools</h3>
        <Toggle k="fVercel" label="Vercel" />
        <Toggle k="fNetlify" label="Netlify" />
        <Toggle k="fPortfolio" label="Portfolio site maker" />
        <Toggle k="fProfileReadme" label="Profile README builder" />
        <Toggle k="fTemplates" label="New from template" />
        <Toggle k="fSweep" label="Health & security sweep" />
        <Toggle k="fSecurityAlerts" label="Include security alerts" hint="Dependabot & secret scanning" />
        <Toggle k="fGrowth" label="Growth history" hint="One tiny daily snapshot, on this device" />
      </Glass>
      <Glass className="cz-group">
        <h3>App</h3>
        <Toggle k="fScene" label="3D moon & sky" hint="Off = simple gradient, lightest on battery" />
        <Toggle k="fPalette" label="Command palette" hint="Ctrl K to jump anywhere" />
        <Toggle k="fShortcuts" label="Keyboard shortcuts" hint="Alt + number switches pages" />
        <Toggle k="fTooltips" label="Tooltips" />
        <Toggle k="fToasts" label="Notifications" hint="Errors always show" />
        <Toggle k="fRateBadge" label="API usage badge" />
        <Toggle k="fSmartCache" label="Smart caching" hint="Faster refreshes, fewer GitHub API calls" />
        <Toggle k="fCredit" label="Made-by credit" />
        <Choice k="autoRefresh" label="Auto-refresh repos" options={[[0, 'Off'], [5, '5 min'], [15, '15 min'], [60, '1 hour']]} />
      </Glass>
    </>
  )
}

function LiveMoon() {
  const { settings: s, update } = useSettings()
  const [busy, setBusy] = useState(false)
  const loc = s.moonLocation || guessLocation()
  const t = moonTimes(new Date(), loc.lat, loc.lon)
  const fmtT = (d) => (d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—')
  return (
    <Glass className="cz-group">
      <h3>Live moon</h3>
      <Toggle k="moonFollowClock" label="Follow the real sky" hint="Tonight's phase, rising in the east and setting in the west as the hours pass" />
      <Row label="Your location" hint={s.moonLocation ? `${loc.lat}°, ${loc.lon}° (rounded, stays on this device)` : 'Estimated from your time zone'}>
        <button className="btn sm" disabled={busy} onClick={async () => (setBusy(true), update({ moonLocation: await askLocation() }), setBusy(false))}>
          {busy ? <Spinner size={13} /> : <MapPin size={14} />} Use my location
        </button>
        {s.moonLocation && <button className="btn ghost sm" onClick={() => update({ moonLocation: null })}>Forget</button>}
      </Row>
      <Row label="Moonrise · moonset" hint="Next 24 hours">
        <span className="mono" style={{ fontSize: 13 }}>↑ {fmtT(t.rise)} · ↓ {fmtT(t.set)}</span>
      </Row>
    </Glass>
  )
}

function PlayMonth() {
  const { update } = useSettings()
  const [playing, setPlaying] = useState(false)
  const play = () => {
    setPlaying(true)
    const start = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - start) / 12000)
      update({ moonPhaseMode: 'manual', moonPhase: (p * 0.999) % 1 })
      if (p < 1) requestAnimationFrame(step)
      else setPlaying(false)
    }
    requestAnimationFrame(step)
  }
  return (
    <Row label="Play a month" hint="Watch a full lunar cycle in 12 seconds">
      <button className="btn sm primary" disabled={playing} onClick={play}>{playing ? <Spinner size={13} /> : <Play size={14} />} Play</button>
    </Row>
  )
}

function AboutSection() {
  return (
    <Glass className="section" style={{ textAlign: 'center', padding: '34px 22px' }}>
      <h2 style={{ margin: '0 0 6px', letterSpacing: '-.03em' }}>RepoVerse</h2>
      <p className="muted" style={{ margin: '0 auto', maxWidth: 460 }}>A private, local-first control center for GitHub, Vercel and Netlify, under the real moon of Feb 14, 2008.</p>
      <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
        <a className="btn sm" href="https://github.com/forpc1428-eng/repoverse" target="_blank" rel="noopener noreferrer"><Github size={14} /> Source</a>
      </div>
      <p className="hint" style={{ marginTop: 14 }}>Moon imagery: NASA LRO / SVS (public domain).</p>
      <Credit inline />
    </Glass>
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
      <Row label="Performance mode" hint="One switch for the lightest setup everywhere. Turning it off restores yours.">
        <div className="grow" />
        <Switch on={!!s.perfMode} onChange={(v) => update(perfPatch(s, v))} label="Performance mode" />
      </Row>
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
