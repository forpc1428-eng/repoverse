import { useEffect, useMemo, useRef, useState } from 'react'
import { moonPosition, skyToScreen, guessLocation } from '../lib/moonpos'
import { startAmbience, stopAmbience, setAmbienceVolume, resumeAmbience } from '../lib/sound'
import { useIsMobile, useSettings } from '../lib/settings'

// The live scene instance, for things like the FPS readout in Customize.
export const sceneRef = { current: null }

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function Background() {
  const { settings: raw } = useSettings()
  // Live moon: follow the moon's real path across your sky (Customize → Moon)
  const [clockPos, setClockPos] = useState(null)
  useEffect(() => {
    if (!raw.moonFollowClock) return setClockPos(null)
    const loc = raw.moonLocation || guessLocation()
    const tick = () => setClockPos(skyToScreen(moonPosition(new Date(), loc.lat, loc.lon)))
    tick()
    const t = setInterval(tick, 60000)
    return () => clearInterval(t)
  }, [raw.moonFollowClock, raw.moonLocation])
  const settings = useMemo(
    () => (clockPos ? { ...raw, moonPhaseMode: 'today', moonX: clockPos.x, moonY: clockPos.y, moonXMobile: clockPos.x, moonYMobile: Math.min(clockPos.y, 0.3), moonVisible: raw.moonVisible && clockPos.visible } : raw),
    [raw, clockPos]
  )
  // Ambient night sound (off by default)
  useEffect(() => {
    if (!raw.fSound) return stopAmbience()
    startAmbience(raw.soundVolume)
    const resume = () => resumeAmbience()
    addEventListener('pointerdown', resume, { once: true })
    return () => removeEventListener('pointerdown', resume)
  }, [raw.fSound]) // eslint-disable-line
  useEffect(() => setAmbienceVolume(raw.soundVolume), [raw.soundVolume])
  const mobile = useIsMobile()
  const holder = useRef(null)
  const scene = useRef(null)
  const latest = useRef(settings)
  latest.current = settings
  const [ready, setReady] = useState(false)
  const [noGL] = useState(() => !webglAvailable())
  const failed = noGL || settings.fScene === false

  // (Re)create the scene when quality or device class changes.
  useEffect(() => {
    if (failed) return
    let alive = true
    const canvas = document.createElement('canvas')
    canvas.className = 'bg-canvas'
    holder.current.appendChild(canvas)
    import('../scene/MoonScene').then(({ MoonScene }) => {
      if (!alive) return
      try {
        const s = new MoonScene(canvas, latest.current, { mobile })
        s.onReady = () => alive && setReady(true)
        scene.current = sceneRef.current = s
        if (import.meta.env.DEV) window.__moon = s // handy for inspecting in dev tools
      } catch (e) {
        console.warn('Moon scene unavailable', e)
      }
    })
    const onResize = () => scene.current?.resize()
    const onMove = (e) => scene.current?.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1)
    addEventListener('resize', onResize)
    addEventListener('pointermove', onMove, { passive: true })
    return () => {
      alive = false
      removeEventListener('resize', onResize)
      removeEventListener('pointermove', onMove)
      scene.current?.dispose()
      scene.current = sceneRef.current = null
      canvas.remove()
    }
  }, [settings.quality, mobile, failed])

  useEffect(() => {
    scene.current?.apply(settings)
  }, [settings])

  return (
    <>
      <div className="bg-fallback" />
      <div ref={holder} className={`bg-layer bg-scene ${ready ? 'on' : ''}`} aria-hidden="true" />
      <div className="bg-layer bg-vignette" aria-hidden="true" />
    </>
  )
}
