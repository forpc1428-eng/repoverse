import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../lib/settings'

/**
 * Opening signature: hundreds of stars fly in and form "made by Vedant",
 * a constellation is drawn between them, shooting stars streak across,
 * then everything dissolves into the night sky. Click or press any key to skip.
 */
const DURATION = 4600

function shouldShow(s) {
  if (s.fIntro === false) return false
  if (s.introWhen === 'always') return true
  if (s.introWhen === 'first') return !localStorage.getItem('rv-intro-seen')
  return !sessionStorage.getItem('rv-intro-seen') // once per browser session
}

export default function Intro() {
  const { settings } = useSettings()
  const [show, setShow] = useState(() => shouldShow(settings))
  const canvas = useRef(null)

  // "Play intro" from Customize
  useEffect(() => {
    const replay = () => setShow(true)
    addEventListener('rv-intro', replay)
    return () => removeEventListener('rv-intro', replay)
  }, [])

  useEffect(() => {
    if (!show) return
    sessionStorage.setItem('rv-intro-seen', '1')
    localStorage.setItem('rv-intro-seen', '1')
    const cv = canvas.current
    const ctx = cv.getContext('2d')
    const dpr = Math.min(devicePixelRatio || 1, 2)
    let W = innerWidth
    let H = innerHeight
    cv.width = W * dpr
    cv.height = H * dpr
    ctx.scale(dpr, dpr)
    const css = getComputedStyle(document.documentElement)
    const c1 = css.getPropertyValue('--c1').trim() || '#f2a7c3'
    const c2 = css.getPropertyValue('--c2').trim() || '#8fb3ff'
    const c3 = css.getPropertyValue('--c3').trim() || '#ece4d4'
    const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
    const [A, B, C] = [hex(c1), hex(c2), hex(c3)]
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
    const still = settings.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches

    // ---- sample the text into target points
    const big = Math.min(W * 0.17, 170)
    const small = big * 0.34
    const off = document.createElement('canvas')
    off.width = W
    off.height = H
    const o = off.getContext('2d')
    o.fillStyle = '#fff'
    o.textAlign = 'center'
    o.textBaseline = 'middle'
    const font = getComputedStyle(document.body).fontFamily
    o.font = `600 ${small}px ${font}`
    o.fillText('made by', W / 2, H / 2 - big * 0.62)
    o.font = `800 ${big}px ${font}`
    o.fillText('Vedant', W / 2, H / 2 + small * 0.35)
    const data = o.getImageData(0, 0, W, H).data
    const step = Math.max(3, Math.round(big / 34))
    const pts = []
    for (let y = 0; y < H; y += step)
      for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 140) pts.push([x + (Math.random() - 0.5) * step * 0.6, y + (Math.random() - 0.5) * step * 0.6])
    const xs = pts.map((p) => p[0])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)

    const stars = pts.map(([tx, ty]) => {
      const t = (tx - minX) / Math.max(1, maxX - minX)
      const col = t < 0.5 ? mix(A, B, t * 2) : mix(B, C, (t - 0.5) * 2)
      const ang = Math.random() * Math.PI * 2
      const dist = Math.max(W, H) * (0.6 + Math.random() * 0.6)
      return {
        tx, ty, sx: W / 2 + Math.cos(ang) * dist, sy: H / 2 + Math.sin(ang) * dist,
        curve: (Math.random() - 0.5) * 220, delay: Math.random() * 0.55 + ((tx - minX) / (maxX - minX + 1)) * 0.35,
        size: Math.random() < 0.08 ? 1.9 + Math.random() * 1.2 : 0.7 + Math.random() * 0.9,
        tw: Math.random() * Math.PI * 2, col,
        dx: (Math.random() - 0.5) * 120, dy: -60 - Math.random() * 160, // dissolve drift
      }
    })
    // constellation anchors: a sparse, spread-out subset joined to near neighbours
    const anchors = stars.filter((_, i) => i % Math.max(8, Math.round(stars.length / 70)) === 0)
    const lines = []
    anchors.forEach((a, i) => {
      const near = anchors.map((b, j) => [j, Math.hypot(a.tx - b.tx, a.ty - b.ty)]).filter(([j, d]) => j > i && d < big * 0.75).sort((x, y) => x[1] - y[1]).slice(0, 2)
      near.forEach(([j]) => lines.push([a, anchors[j], Math.random() * 0.4]))
    })
    // background dust
    const dust = Array.from({ length: Math.round((W * H) / 5000) }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.1 + 0.2, tw: Math.random() * 6 }))
    // shooting stars
    const shooters = Array.from({ length: still ? 0 : 5 }, (_, i) => ({ at: 0.35 + i * 0.55 + Math.random() * 0.25, x: W * (0.45 + Math.random() * 0.6), y: H * (Math.random() * 0.4), len: 140 + Math.random() * 160, sp: 1.6 + Math.random() * 0.8, ang: Math.PI * (0.78 + Math.random() * 0.12) }))

    const ease = (t) => 1 - Math.pow(1 - t, 3)
    let raf
    const t0 = performance.now()
    const frame = (now) => {
      const el = (now - t0) / 1000
      const total = DURATION / 1000
      const form = still ? 1 : Math.min(1, el / 1.9)
      const dissolve = Math.max(0, (el - (total - 1.1)) / 1.1)
      ctx.clearRect(0, 0, W, H)
      // veil
      ctx.fillStyle = `rgba(2,3,8,${0.86 * (1 - dissolve)})`
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      for (const d of dust) {
        const a = (0.25 + 0.35 * Math.sin(el * 2 + d.tw)) * (1 - dissolve)
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.fillRect(d.x, d.y, d.s, d.s)
      }
      // constellation lines (after the stars arrive)
      const lineT = Math.max(0, Math.min(1, (el - 1.5) / 0.9))
      if (lineT > 0) {
        ctx.lineWidth = 0.7
        for (const [a, b, dl] of lines) {
          const k = Math.max(0, Math.min(1, (lineT - dl) / 0.6))
          if (!k) continue
          ctx.strokeStyle = `rgba(${a.col.join(',')},${0.28 * (1 - dissolve)})`
          ctx.beginPath()
          ctx.moveTo(a.tx, a.ty)
          ctx.lineTo(a.tx + (b.tx - a.tx) * k, a.ty + (b.ty - a.ty) * k)
          ctx.stroke()
        }
      }
      // stars
      for (const s of stars) {
        const p = ease(Math.max(0, Math.min(1, (form - s.delay * (still ? 0 : 1)) / (1 - 0.6))))
        const bend = Math.sin(p * Math.PI) * s.curve
        let x = s.sx + (s.tx - s.sx) * p + bend
        let y = s.sy + (s.ty - s.sy) * p - bend * 0.4
        if (dissolve) {
          x += s.dx * dissolve
          y += s.dy * dissolve
        }
        const tw = 0.7 + 0.3 * Math.sin(el * 5 + s.tw)
        const a = Math.min(1, p * 1.4) * tw * (1 - dissolve)
        const r = s.size * (p < 1 ? 1.4 : 1)
        ctx.fillStyle = `rgba(${s.col.join(',')},${a})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        if (s.size > 1.8 && p > 0.9) {
          // glints on the brightest stars
          ctx.fillStyle = `rgba(255,255,255,${0.5 * a})`
          ctx.fillRect(x - r * 3, y - 0.4, r * 6, 0.8)
          ctx.fillRect(x - 0.4, y - r * 3, 0.8, r * 6)
        }
      }
      // a sparkle sweeping across the name
      if (!still && el > 2 && el < 3.2) {
        const sx = minX + (maxX - minX) * ((el - 2) / 1.2)
        const g = ctx.createRadialGradient(sx, H / 2 + small * 0.35, 0, sx, H / 2 + small * 0.35, big * 0.7)
        g.addColorStop(0, 'rgba(255,255,255,.22)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(sx - big, H / 2 - big, big * 2, big * 2)
      }
      // shooting stars
      for (const sh of shooters) {
        const k = (el - sh.at) / 0.9
        if (k < 0 || k > 1) continue
        const hx = sh.x + Math.cos(sh.ang) * k * sh.sp * W * 0.5
        const hy = sh.y + Math.sin(sh.ang) * k * sh.sp * W * 0.5
        const tx = hx - Math.cos(sh.ang) * sh.len
        const ty = hy - Math.sin(sh.ang) * sh.len
        const g = ctx.createLinearGradient(tx, ty, hx, hy)
        const fade = Math.sin(k * Math.PI)
        g.addColorStop(0, 'rgba(255,255,255,0)')
        g.addColorStop(1, `rgba(255,255,255,${0.9 * fade})`)
        ctx.strokeStyle = g
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(hx, hy)
        ctx.stroke()
        ctx.fillStyle = `rgba(255,255,255,${fade})`
        ctx.beginPath()
        ctx.arc(hx, hy, 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
      // tagline
      const tagA = Math.max(0, Math.min(1, (el - 2.1) / 0.6)) * (1 - dissolve)
      if (tagA) {
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = `rgba(236,236,255,${0.55 * tagA})`
        ctx.font = `500 ${Math.max(12, small * 0.42)}px ${font}`
        ctx.textAlign = 'center'
        ctx.letterSpacing = '6px'
        ctx.fillText('VIBING  ·  REPOVERSE', W / 2, H / 2 + big * 0.95)
      }
      ctx.globalCompositeOperation = 'source-over'
      if (el < total) raf = requestAnimationFrame(frame)
      else setShow(false)
    }
    raf = requestAnimationFrame(frame)
    const skip = () => setShow(false)
    addEventListener('keydown', skip)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('keydown', skip)
    }
  }, [show]) // eslint-disable-line

  if (!show) return null
  return <canvas ref={canvas} className="intro" onClick={() => setShow(false)} aria-label="Intro: made by Vedant. Click to skip." role="img" />
}
