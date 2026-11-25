import { createContext, useContext, useEffect, useState, useCallback, useSyncExternalStore } from 'react'
import { getSecure, setSecure } from './store'

const VERSION = 3

// ------------------------------------------------------------------ one-click scenes
// Each scene sets the moon, the sky and the interface accents together.
export const SCENES = {
  valentine: {
    name: 'Feb 14, 2008',
    note: 'The waxing moon of that night',
    moonPhaseMode: 'date', moonDate: '2008-02-14',
    skyTop: '#010205', skyBottom: '#060912', galaxyColor1: '#efe9df', galaxyColor2: '#4d5f86', nebulaColor: '#2b3550',
    galaxyAmount: 0.5, nebulaAmount: 0.2, galaxyTilt: 38, galaxyOffset: 0.05, horizonGlow: 0.25,
    moonTint: '#f4efe6', moonExposure: 1.3, moonContrast: 1.15, earthshine: 0.03, earthTint: '#c4cbd8', glowColor: '#f4f2ec', glowIntensity: 0.16, glowSize: 1.7,
    c1: '#f2a7c3', c2: '#8fb3ff', c3: '#ece4d4', shootColor: '#f4f7ff',
  },
  silver: {
    name: 'Silver Full Moon',
    note: 'Bright, cold and clear',
    moonPhaseMode: 'manual', moonPhase: 0.5,
    skyTop: '#03050d', skyBottom: '#0b1a33', galaxyColor1: '#dbe7ff', galaxyColor2: '#4f7cff', nebulaColor: '#3b5bdb',
    galaxyAmount: 0.7, nebulaAmount: 0.3, galaxyTilt: 24, galaxyOffset: 0.1, horizonGlow: 0.6,
    moonTint: '#eef3ff', moonExposure: 1.15, moonContrast: 1.15, earthshine: 0.03, earthTint: '#9fb4ff', glowColor: '#cfe0ff', glowIntensity: 0.9, glowSize: 3,
    c1: '#60a5fa', c2: '#a5b4fc', c3: '#e0f2fe', shootColor: '#e0ecff',
  },
  eclipse: {
    name: 'Blood Moon',
    note: 'Total eclipse of Feb 21, 2008',
    moonPhaseMode: 'manual', moonPhase: 0.5,
    skyTop: '#0d0305', skyBottom: '#2a0a0c', galaxyColor1: '#ffc4a8', galaxyColor2: '#ff5a36', nebulaColor: '#b91c1c',
    galaxyAmount: 0.85, nebulaAmount: 0.5, galaxyTilt: 52, galaxyOffset: 0, horizonGlow: 0.4,
    moonTint: '#ff6a3d', moonExposure: 0.55, moonContrast: 1.2, earthshine: 0.0, earthTint: '#ff3b1f', glowColor: '#ff4a2a', glowIntensity: 0.55, glowSize: 2.4,
    c1: '#ff6b4a', c2: '#ffb347', c3: '#ff9aa2', shootColor: '#ffd0b8',
  },
  crescent: {
    name: 'Thin Crescent',
    note: 'Earthshine on a deep-space night',
    moonPhaseMode: 'manual', moonPhase: 0.09,
    skyTop: '#02030a', skyBottom: '#0a1024', galaxyColor1: '#fff1dc', galaxyColor2: '#6d5dfc', nebulaColor: '#c026d3',
    galaxyAmount: 1.3, nebulaAmount: 0.6, galaxyTilt: 62, galaxyOffset: -0.05, horizonGlow: 0.3,
    moonTint: '#fff6e8', moonExposure: 1.35, moonContrast: 1.05, earthshine: 0.13, earthTint: '#8fb0ff', glowColor: '#fff0d6', glowIntensity: 0.45, glowSize: 2.2,
    c1: '#2dd4bf', c2: '#818cf8', c3: '#f0abfc', shootColor: '#ffffff',
  },
  harvest: {
    name: 'Harvest Gold',
    note: 'A low, warm full moon',
    moonPhaseMode: 'manual', moonPhase: 0.49,
    skyTop: '#0a0706', skyBottom: '#2e1a08', galaxyColor1: '#ffe6bf', galaxyColor2: '#f59e0b', nebulaColor: '#ea580c',
    galaxyAmount: 0.6, nebulaAmount: 0.35, galaxyTilt: 18, galaxyOffset: 0.15, horizonGlow: 0.9,
    moonTint: '#ffd49a', moonExposure: 1.1, moonContrast: 1.1, earthshine: 0.02, earthTint: '#ffb36b', glowColor: '#ffb347', glowIntensity: 0.85, glowSize: 2.8,
    c1: '#f59e0b', c2: '#fb7185', c3: '#fde68a', shootColor: '#ffe7c2',
  },
  arctic: {
    name: 'Arctic Aurora',
    note: 'Waning moon over green skies',
    moonPhaseMode: 'manual', moonPhase: 0.64,
    skyTop: '#020d14', skyBottom: '#06323a', galaxyColor1: '#d8fff6', galaxyColor2: '#22d3ee', nebulaColor: '#10b981',
    galaxyAmount: 0.8, nebulaAmount: 0.95, galaxyTilt: 30, galaxyOffset: 0.08, horizonGlow: 0.8,
    moonTint: '#effffb', moonExposure: 1.2, moonContrast: 1.1, earthshine: 0.04, earthTint: '#9ff0ff', glowColor: '#b5fff0', glowIntensity: 0.7, glowSize: 2.6,
    c1: '#22d3ee', c2: '#34d399', c3: '#a7f3d0', shootColor: '#d1fff6',
  },
  mono: {
    name: 'Minimal Mono',
    note: 'Quiet greys, nothing extra',
    moonPhaseMode: 'manual', moonPhase: 0.36,
    skyTop: '#050505', skyBottom: '#141414', galaxyColor1: '#e5e5e5', galaxyColor2: '#737373', nebulaColor: '#404040',
    galaxyAmount: 0.35, nebulaAmount: 0, galaxyTilt: 40, galaxyOffset: 0, horizonGlow: 0.2,
    moonTint: '#f2f2f2', moonExposure: 1.15, moonContrast: 1.2, earthshine: 0.04, earthTint: '#bfbfbf', glowColor: '#ffffff', glowIntensity: 0.4, glowSize: 2.2,
    c1: '#e5e5e5', c2: '#a3a3a3', c3: '#737373', shootColor: '#ffffff',
  },
}

export const FONTS = {
  system: { name: 'System', css: "'Segoe UI Variable Display', 'Segoe UI Variable Text', 'SF Pro Display', -apple-system, 'Inter', system-ui, sans-serif" },
  rounded: { name: 'Rounded', css: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Segoe UI Variable Display', system-ui, sans-serif" },
  geometric: { name: 'Geometric', css: "'Century Gothic', 'Futura', 'Avenir Next', 'Montserrat', system-ui, sans-serif" },
  serif: { name: 'Editorial', css: "'Iowan Old Style', 'Palatino Linotype', 'Georgia', ui-serif, serif" },
  mono: { name: 'Mono', css: "'Cascadia Code', 'JetBrains Mono', 'SF Mono', ui-monospace, monospace" },
}

export const WIDGETS = [
  { id: 'stats', name: 'Totals', span: 12 },
  { id: 'heatmap', name: 'Contribution heatmap', span: 12 },
  { id: 'languages', name: 'Languages', span: 6 },
  { id: 'stars', name: 'Top starred', span: 6 },
  { id: 'health', name: 'Repo health', span: 7 },
  { id: 'recent', name: 'Recently pushed', span: 5 },
  { id: 'traffic', name: 'Traffic (views & clones)', span: 12 },
]

export const DEFAULTS = {
  version: VERSION,
  scene: 'valentine',
  ...SCENES.valentine,
  // moon
  moonVisible: true, moonPhase: 0.27,
  moonX: 0.79, moonY: 0.27, moonSize: 0.42,
  moonXMobile: 0.74, moonYMobile: 0.13, moonSizeMobile: 0.42,
  moonBump: 1, moonTilt: -18, moonRotation: 0, libration: true, moonSpin: 0,
  // sky
  starDensity: 1, starSize: 0.9, starBrightness: 1.1, starTwinkle: 0.6, shooting: 'normal', skyDrift: 1, parallax: true,
  // interface
  blur: 20, glassAlpha: 0.07, radius: 20, cardStyle: 'glass', cardBlur: false, font: 'system', uiScale: 1,
  // layout
  dock: 'left', dockOrder: ['repos', 'wall', 'push', 'insights', 'customize'], dockHidden: [], dockSize: 'md', dockLabels: false, dockCompact: true,
  dockPins: true, dockPinCount: 5, dockLogo: true, dockAccount: true,
  cardSize: 'm', density: 'comfy', width: 'contained', view: 'grid', sort: 'pushed', showHealth: true,
  // features (Settings → Features)
  fWall: true, fPush: true, fInsights: true, fCodeSearch: true, fBulk: true, fBoard: true, fTimeline: true,
  fPalette: true, fShortcuts: true, fLivePreviews: true, fHero: true, fForks: true, fScene: true, fToasts: true,
  autoRefresh: 0,
  // performance
  quality: 'auto', fpsCap: 0, reduceMotion: false, motion: 1,
  wallMin: 380, wallMode: 'live',
  widgets: WIDGETS.map((w) => ({ id: w.id, hidden: false, span: w.span })),
}

/** Keys a scene controls (used to show "custom" after the user tweaks something). */
export const SCENE_KEYS = Object.keys(SCENES.valentine).filter((k) => !['name', 'note'].includes(k))

export function applySettings(s) {
  const r = document.documentElement
  const set = (k, v) => r.style.setProperty(k, v)
  set('--c1', s.c1)
  set('--c2', s.c2)
  set('--c3', s.c3)
  set('--sky-top', s.skyTop)
  set('--sky-bottom', s.skyBottom)
  set('--blur', s.blur + 'px')
  set('--glass-alpha', s.glassAlpha)
  set('--radius', s.radius + 'px')
  set('--font', (FONTS[s.font] || FONTS.system).css)
  set('--ui-scale', s.uiScale)
  set('--gap', s.density === 'compact' ? '10px' : s.density === 'spacious' ? '22px' : '16px')
  set('--pad', s.density === 'compact' ? '14px' : s.density === 'spacious' ? '22px' : '18px')
  set('--card-min', { s: '240px', m: '300px', l: '370px' }[s.cardSize] || '300px')
  set('--maxw', s.width === 'full' ? '100%' : '1440px')
  r.dataset.cards = s.cardStyle
  r.dataset.dock = s.dock
  r.classList.toggle('cards-blur', !!s.cardBlur)
  r.classList.toggle('reduce-motion', !!s.reduceMotion)
  r.classList.toggle('no-blur', s.blur <= 0)
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', s.skyTop)
}

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('rv-settings') || '{}')
    // Older versions had a different look: keep only layout preferences.
    const keep = saved.version === VERSION ? saved : { view: saved.view, sort: saved.sort, widgets: saved.widgets }
    Object.keys(keep).forEach((k) => keep[k] === undefined && delete keep[k])
    const merged = { ...DEFAULTS, ...keep, version: VERSION }
    const ids = new Set((merged.widgets || []).map((w) => w.id))
    merged.widgets = [...(merged.widgets || []).filter((w) => WIDGETS.some((x) => x.id === w.id)), ...WIDGETS.filter((w) => !ids.has(w.id)).map((w) => ({ id: w.id, hidden: false, span: w.span }))]
    return merged
  } catch {
    return { ...DEFAULTS }
  }
}

// ------------------------------------------------------------------ mobile detection
const MQ = '(max-width: 760px), (pointer: coarse) and (max-width: 1024px)'
const subscribe = (fn) => {
  const m = matchMedia(MQ)
  m.addEventListener('change', fn)
  return () => m.removeEventListener('change', fn)
}
export const useIsMobile = () => useSyncExternalStore(subscribe, () => matchMedia(MQ).matches)

const Ctx = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)
  const [userData, setUserDataState] = useState({ pins: [], tags: {}, folders: ['Featured', 'In progress', 'Done'], folderOf: {}, tagColors: {} })

  useEffect(() => {
    getSecure('userData', null).then((d) => d && setUserDataState((u) => ({ ...u, ...d })))
  }, [])

  useEffect(() => {
    applySettings(settings)
    const t = setTimeout(() => localStorage.setItem('rv-settings', JSON.stringify(settings)), 200)
    return () => clearTimeout(t)
  }, [settings])

  const update = useCallback((patch) => {
    setSettings((s) => {
      const p = typeof patch === 'function' ? patch(s) : patch
      const touchesScene = Object.keys(p).some((k) => SCENE_KEYS.includes(k)) && !('scene' in p)
      return { ...s, ...p, ...(touchesScene ? { scene: 'custom' } : {}) }
    })
  }, [])
  const applyScene = useCallback((id) => {
    const { name, note, ...scene } = SCENES[id]
    setSettings((s) => ({ ...s, ...scene, scene: id }))
  }, [])
  const reset = useCallback(() => setSettings({ ...DEFAULTS }), [])
  const setUserData = useCallback((fn) => {
    setUserDataState((u) => {
      const next = typeof fn === 'function' ? fn(u) : { ...u, ...fn }
      setSecure('userData', next)
      return next
    })
  }, [])

  return <Ctx.Provider value={{ settings, update, applyScene, reset, userData, setUserData, setSettings }}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
