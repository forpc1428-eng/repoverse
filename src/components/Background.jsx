import { useEffect, useRef, useState } from 'react'
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
  const { settings } = useSettings()
  const mobile = useIsMobile()
  const holder = useRef(null)
  const scene = useRef(null)
  const latest = useRef(settings)
  latest.current = settings
  const [ready, setReady] = useState(false)
  const [failed] = useState(() => !webglAvailable())

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
