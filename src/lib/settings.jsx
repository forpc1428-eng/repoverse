import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getSecure, setSecure } from './store'

export const THEMES = {
  aurora: { name: 'Aurora', bg: '#06061a', c1: '#8b5cf6', c2: '#22d3ee', c3: '#f472b6' },
  midnight: { name: 'Midnight', bg: '#03040d', c1: '#3b82f6', c2: '#818cf8', c3: '#0ea5e9' },
  sunset: { name: 'Sunset', bg: '#150611', c1: '#f97316', c2: '#ec4899', c3: '#facc15' },
  ocean: { name: 'Ocean', bg: '#02101a', c1: '#06b6d4', c2: '#10b981', c3: '#3b82f6' },
  forest: { name: 'Forest', bg: '#04110a', c1: '#22c55e', c2: '#a3e635', c3: '#14b8a6' },
  rose: { name: 'Rose Gold', bg: '#13070d', c1: '#fb7185', c2: '#c084fc', c3: '#fdba74' },
  cyber: { name: 'Cyber', bg: '#05020f', c1: '#d946ef', c2: '#00f5d4', c3: '#fde047' },
  mono: { name: 'Mono', bg: '#09090b', c1: '#a1a1aa', c2: '#f4f4f5', c3: '#52525b' },
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
  theme: 'aurora',
  ...THEMES.aurora,
  blur: 22,
  glassAlpha: 0.08,
  glow: 0.55,
  radius: 22,
  density: 'comfy',
  font: 'system',
  background: 'aurora', // aurora | mesh | orbs | image | solid
  grain: true,
  vignette: true,
  liquid: true,
  tilt: true,
  specular: true,
  motion: 1,
  reduceMotion: false,
  perf: 'auto', // auto | on | off
  railCollapsed: false,
  view: 'grid',
  sort: 'pushed',
  wallMin: 380,
  wallMode: 'live',
  widgets: WIDGETS.map((w) => ({ id: w.id, hidden: false, span: w.span })),
}

const isChromium = () => !!(navigator.userAgentData && navigator.userAgentData.brands?.some((b) => /Chrom/i.test(b.brand)))

export function applySettings(s) {
  const r = document.documentElement
  const set = (k, v) => r.style.setProperty(k, v)
  set('--bg', s.bg)
  set('--c1', s.c1)
  set('--c2', s.c2)
  set('--c3', s.c3)
  set('--blur', s.blur + 'px')
  set('--glass-alpha', s.glassAlpha)
  set('--glow', s.glow)
  set('--radius', s.radius + 'px')
  set('--speed', s.motion || 1)
  set('--font', (FONTS[s.font] || FONTS.system).css)
  set('--gap', s.density === 'compact' ? '10px' : s.density === 'spacious' ? '22px' : '16px')
  set('--pad', s.density === 'compact' ? '13px' : s.density === 'spacious' ? '24px' : '18px')
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || navigator.deviceMemory <= 4
  r.classList.toggle('perf', s.perf === 'on' || (s.perf === 'auto' && lowEnd))
  r.classList.toggle('liquid-on', !!s.liquid && isChromium())
  r.classList.toggle('reduce-motion', !!s.reduceMotion)
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', s.bg)
}

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('rv-settings') || '{}')
    const merged = { ...DEFAULTS, ...saved }
    // keep widget list in sync with available widgets
    const ids = new Set(merged.widgets.map((w) => w.id))
    WIDGETS.forEach((w) => !ids.has(w.id) && merged.widgets.push({ id: w.id, hidden: false, span: w.span }))
    merged.widgets = merged.widgets.filter((w) => WIDGETS.some((x) => x.id === w.id))
    return merged
  } catch {
    return { ...DEFAULTS }
  }
}

const Ctx = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)
  const [bgImage, setBgImageState] = useState('')
  // user data: pins, tags, folders (contains repo names → encrypted store)
  const [userData, setUserDataState] = useState({ pins: [], tags: {}, folders: ['Featured', 'In progress', 'Done'], folderOf: {}, tagColors: {} })

  useEffect(() => {
    getSecure('bgImage', '').then(setBgImageState)
    getSecure('userData', null).then((d) => d && setUserDataState((u) => ({ ...u, ...d })))
  }, [])

  useEffect(() => {
    applySettings(settings)
    localStorage.setItem('rv-settings', JSON.stringify(settings))
  }, [settings])

  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), [])
  const reset = useCallback(() => setSettings({ ...DEFAULTS }), [])
  const setBgImage = useCallback((v) => {
    setBgImageState(v)
    setSecure('bgImage', v)
  }, [])
  const setUserData = useCallback((fn) => {
    setUserDataState((u) => {
      const next = typeof fn === 'function' ? fn(u) : { ...u, ...fn }
      setSecure('userData', next)
      return next
    })
  }, [])

  return (
    <Ctx.Provider value={{ settings, update, reset, bgImage, setBgImage, userData, setUserData, setSettings }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSettings = () => useContext(Ctx)
