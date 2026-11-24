import { useEffect, useRef } from 'react'
import { useSettings } from '../lib/settings'

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`
const FRAG = `
precision highp float;
uniform vec2 r; uniform float t; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 bg; uniform vec2 m;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 R = mat2(.8,.6,-.6,.8);
  for(int i=0;i<5;i++){ v += a*n(p); p = R*p*2.02 + 3.1; a *= .5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / r; vec2 p = uv; p.x *= r.x / r.y;
  float T = t * .045;
  vec2 q = vec2(fbm(p*1.4 + T), fbm(p*1.4 - T + 4.7));
  vec2 w = vec2(fbm(p*1.1 + q*1.8 + vec2(1.7, 9.2) + T*1.3), fbm(p*1.1 + q*1.8 + vec2(8.3, 2.8) - T));
  float f = fbm(p*1.2 + w*1.6);
  vec3 col = bg;
  col = mix(col, c1, smoothstep(.35, .95, f) * .85);
  col = mix(col, c2, smoothstep(.45, 1.0, w.x) * .7 * (1.0 - uv.y*.4));
  col = mix(col, c3, smoothstep(.55, 1.0, w.y) * .55 * uv.y);
  // aurora ribbons
  float band = sin((uv.x*3.0 + f*4.0 + T*6.0)) * .5 + .5;
  col += c2 * pow(band, 18.0) * .18 * smoothstep(.2, .9, uv.y);
  // soft pointer glow
  float d = distance(uv, m); col += c1 * .12 * exp(-d*d*12.0);
  col = mix(bg, col, .92);
  col *= .62 + .38 * smoothstep(1.25, .2, distance(uv, vec2(.5, .55)));
  gl_FragColor = vec4(col, 1.0);
}`

const hex = (h) => {
  const v = h.replace('#', '')
  const n = parseInt(v.length === 3 ? v.split('').map((c) => c + c).join('') : v, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function Aurora({ s }) {
  const ref = useRef(null)
  const colors = useRef(s)
  colors.current = s

  useEffect(() => {
    const canvas = ref.current
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) return
    const sh = (type, src) => {
      const x = gl.createShader(type)
      gl.shaderSource(x, src)
      gl.compileShader(x)
      return x
    }
    const prog = gl.createProgram()
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const U = (n) => gl.getUniformLocation(prog, n)
    const u = { r: U('r'), t: U('t'), c1: U('c1'), c2: U('c2'), c3: U('c3'), bg: U('bg'), m: U('m') }
    const mouse = [0.5, 0.6]
    const target = [0.5, 0.6]
    const onMove = (e) => {
      target[0] = e.clientX / innerWidth
      target[1] = 1 - e.clientY / innerHeight
    }
    addEventListener('pointermove', onMove, { passive: true })

    const scale = 0.5 // render at half resolution: smooth + cheap
    const resize = () => {
      canvas.width = Math.max(1, innerWidth * scale)
      canvas.height = Math.max(1, innerHeight * scale)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    addEventListener('resize', resize)

    let raf
    let start = performance.now()
    const frame = (now) => {
      const c = colors.current
      const still = c.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches
      mouse[0] += (target[0] - mouse[0]) * 0.04
      mouse[1] += (target[1] - mouse[1]) * 0.04
      gl.uniform2f(u.r, canvas.width, canvas.height)
      gl.uniform1f(u.t, still ? 20 : ((now - start) / 1000) * (c.motion || 1) + 20)
      gl.uniform3fv(u.c1, hex(c.c1))
      gl.uniform3fv(u.c2, hex(c.c2))
      gl.uniform3fv(u.c3, hex(c.c3))
      gl.uniform3fv(u.bg, hex(c.bg))
      gl.uniform2f(u.m, mouse[0], mouse[1])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!document.hidden) raf = requestAnimationFrame(frame)
    }
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(frame)
    }
    document.addEventListener('visibilitychange', onVis)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVis)
      // Free GPU objects but keep the context alive: React can re-run this effect on the
      // same <canvas>, and getContext() would hand back a lost context.
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [])

  return <canvas ref={ref} className="bg-canvas" />
}

export default function Background() {
  const { settings: s, bgImage } = useSettings()
  return (
    <>
      <div className={`bg-layer ${s.background === 'mesh' ? 'bg-mesh' : s.background === 'orbs' ? 'bg-orbs' : s.background === 'image' ? 'bg-image' : ''}`}
        style={s.background === 'image' && bgImage ? { backgroundImage: `url(${bgImage})` } : s.background === 'solid' ? { background: s.bg } : undefined}>
        {s.background === 'aurora' && <Aurora s={s} />}
        {s.background === 'orbs' && (<><span /><span /><span /></>)}
      </div>
      {s.vignette && <div className="bg-layer bg-vignette" />}
      {s.grain && <div className="bg-layer bg-grain" />}
      {/* SVG filter used for the liquid-glass refraction effect */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="liquid-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="38" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
    </>
  )
}
