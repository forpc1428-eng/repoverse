import * as THREE from 'three'
import {
  FULLSCREEN_VERT, MOON_BAKE_FRAG, SKY_BAKE_FRAG, DIR_VERT, SKY_FRAG, MOON_FRAG, GLOW_VERT, GLOW_FRAG, STAR_VERT, STAR_FRAG, SHOOT_FRAG,
} from './shaders'
import { resolvePhase, illumination } from './phase'

// color/normal = NASA texture sizes (in /public/moon). moonTex = procedural fallback size.
export const QUALITY = {
  battery: { dpr: 1, fps: 30, stars: 2600, color: '2k', normal: '2k', moonTex: 2048, skyTex: 2048, aa: false, detail: 1 },
  balanced: { dpr: 2, fps: 60, stars: 6500, color: '4k', normal: '4k', moonTex: 4096, skyTex: 4096, aa: true, detail: 2 },
  ultra: { dpr: 3, fps: 0, stars: 11000, color: '8k', normal: '4k', moonTex: 4096, skyTex: 4096, aa: true, detail: 3 },
}

function maxTexture() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    return gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096
  } catch {
    return 4096
  }
}

export function autoQuality(mobile) {
  const cores = navigator.hardwareConcurrency || 8
  const mem = navigator.deviceMemory || 8
  if (mobile) return cores >= 8 && mem >= 6 ? 'balanced' : 'battery'
  if (cores <= 4 || mem <= 4) return 'balanced'
  return maxTexture() >= 8192 ? 'ultra' : 'balanced'
}

const SHOOT_INTERVAL = { off: 0, rare: 14, normal: 6, shower: 0.9 }
const VFOV = 35
const MOON_DIST = 20
const SKY_R = 900
const STAR_R = 800

const col = (hex) => {
  const c = new THREE.Color(hex || '#ffffff')
  return new THREE.Vector3(c.r, c.g, c.b) // sRGB components; shaders linearise
}
const rand = mulberry32(20080214)
function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = () => {
  let u = 0
  for (let i = 0; i < 4; i++) u += rand()
  return (u - 2) / 0.58
}

export class MoonScene {
  constructor(canvas, settings, { mobile = false } = {}) {
    this.canvas = canvas
    this.mobile = mobile
    this.s = settings
    this.qName = settings.quality === 'auto' || !QUALITY[settings.quality] ? autoQuality(mobile) : settings.quality
    this.q = QUALITY[this.qName]
    this.time = 20
    this.last = performance.now()
    this.lastDraw = 0
    this.pointer = new THREE.Vector2()
    this.pointerSmooth = new THREE.Vector2()
    this.bakeQueue = []
    this.shoots = []
    this.nextShoot = 2
    this.onReady = null
    this.fpsSamples = []

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q.aa, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true }))
    r.outputColorSpace = THREE.LinearSRGBColorSpace
    r.toneMapping = THREE.NoToneMapping
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.dpr))
    r.setClearColor(0x000000, 1)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(VFOV, 1, 0.1, 2000)
    this.rig = new THREE.Group()
    this.rig.add(this.camera)
    this.scene.add(this.rig)

    // Bake helpers
    this.bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.bakeScene = new THREE.Scene()
    this.bakeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
    this.bakeScene.add(this.bakeQuad)

    this.#buildSky()
    this.#buildStars()
    this.#buildMoon()
    this.#buildShoots()

    this.resize()
    this.apply(settings, true)
    this.loop = (now) => this.#tick(now)
    this.raf = requestAnimationFrame(this.loop)
    this.onVis = () => {
      if (!document.hidden) {
        this.last = performance.now()
        cancelAnimationFrame(this.raf)
        this.raf = requestAnimationFrame(this.loop)
      }
    }
    document.addEventListener('visibilitychange', this.onVis)
  }

  // ------------------------------------------------------------------ building
  #target(w, h) {
    const t = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, stencilBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter })
    t.texture.wrapS = THREE.RepeatWrapping
    t.texture.wrapT = THREE.ClampToEdgeWrapping
    t.texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy())
    return t
  }

  #buildSky() {
    const n = this.q.skyTex
    this.skyRT = this.#target(n, n / 2)
    this.skyBakeMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: SKY_BAKE_FRAG,
      uniforms: {
        uTop: { value: new THREE.Vector3() }, uBottom: { value: new THREE.Vector3() }, uGal1: { value: new THREE.Vector3() }, uGal2: { value: new THREE.Vector3() },
        uNeb: { value: new THREE.Vector3() }, uGalAmt: { value: 1 }, uNebAmt: { value: 1 }, uTilt: { value: 0.6 }, uOffset: { value: 0 }, uHorizon: { value: 0.5 },
      },
      depthTest: false,
    })
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(SKY_R, 48, 24),
      new THREE.ShaderMaterial({ vertexShader: DIR_VERT, fragmentShader: SKY_FRAG, uniforms: { uSky: { value: this.skyRT.texture } }, side: THREE.BackSide, depthWrite: false })
    )
    this.sky.renderOrder = -10
    this.scene.add(this.sky)
  }

  #buildStars() {
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uTwinkle: { value: 0.6 }, uBright: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.stars = new THREE.Points(new THREE.BufferGeometry(), this.starMat)
    this.stars.renderOrder = -5
    this.scene.add(this.stars)
  }

  #fillStars() {
    const s = this.s
    const count = Math.round(this.q.stars * (s.starDensity ?? 1) * (this.mobile ? 0.6 : 1))
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const phase = new Float32Array(count)
    const color = new Float32Array(count * 3)
    const tilt = s.galaxyTilt * (Math.PI / 180)
    const gN = new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), s.galaxyOffset).normalize()
    const fwd = new THREE.Vector3(0, 0, -1)
    const e2 = fwd.clone().sub(gN.clone().multiplyScalar(fwd.dot(gN))).normalize()
    const e1 = new THREE.Vector3().crossVectors(gN, e2).normalize()
    const palette = [[0.66, 0.78, 1], [0.82, 0.88, 1], [1, 1, 1], [1, 0.95, 0.85], [1, 0.84, 0.66], [1, 0.72, 0.6]]
    const v = new THREE.Vector3()
    const bandShare = s.galaxyAmount > 0.05 ? 0.38 : 0
    for (let i = 0; i < count; i++) {
      if (rand() < bandShare) {
        const a = (rand() * 2 - 1) * 1.0
        v.copy(e2).multiplyScalar(Math.cos(a)).addScaledVector(e1, Math.sin(a)).addScaledVector(gN, gauss() * 0.07).normalize()
      } else {
        v.set((rand() * 2 - 1) * 1.35, (rand() * 2 - 1) * 0.62, -1).normalize()
      }
      v.multiplyScalar(STAR_R)
      pos.set([v.x, v.y, v.z], i * 3)
      const r = rand()
      size[i] = 0.7 + Math.pow(r, 9) * 3.4 + rand() * 0.5
      phase[i] = rand()
      const c = palette[Math.min(palette.length - 1, Math.floor(Math.pow(rand(), 1.3) * palette.length))]
      const b = 0.35 + Math.pow(r, 3) * 0.9
      color.set([c[0] * b, c[1] * b, c[2] * b], i * 3)
    }
    const g = this.stars.geometry
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    g.computeBoundingSphere()
  }

  #buildMoon() {
    const n = this.q.moonTex
    this.moonRT = this.#target(n, n / 2)
    this.moonBakeMat = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: MOON_BAKE_FRAG, uniforms: { uDetail: { value: this.q.detail } }, depthTest: false })
    this.moonMat = new THREE.ShaderMaterial({
      vertexShader: DIR_VERT,
      fragmentShader: MOON_FRAG,
      uniforms: {
        uSurf: { value: this.moonRT.texture }, uTexel: { value: new THREE.Vector2(1 / n, 2 / n) },
        uSun: { value: new THREE.Vector3(1, 0, 0) }, uView: { value: new THREE.Vector3(0, 0, 1) },
        uTint: { value: new THREE.Vector3(1, 1, 1) }, uEarthTint: { value: new THREE.Vector3(0.6, 0.7, 1) },
        uEarthshine: { value: 0.05 }, uExposure: { value: 1.2 }, uBump: { value: 1 }, uReady: { value: 0 }, uContrast: { value: 1 },
        uColorMap: { value: null }, uNormalMap: { value: null }, uMode: { value: 0 },
      },
      transparent: true,
    })
    const seg = this.q.detail > 1 ? 256 : 160
    this.#loadNasaMaps()
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(1, seg, seg / 2), this.moonMat)
    this.moon.renderOrder = 2
    this.glowMat = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uColor: { value: new THREE.Vector3(1, 1, 1) }, uIntensity: { value: 0.6 }, uInner: { value: 0.3 }, uIll: { value: 1 }, uLit: { value: new THREE.Vector2(1, 0) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.glowMat)
    this.glow.renderOrder = 1
    this.scene.add(this.glow, this.moon)
  }

  #loadNasaMaps() {
    const r = this.renderer
    const maxTex = r.capabilities.maxTextureSize
    const pick = (size) => (size === '8k' && maxTex < 8192 ? '4k' : size)
    const load = (url) =>
      new Promise((resolve, reject) => {
        const l = new THREE.ImageBitmapLoader()
        l.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
        l.load(url, (bmp) => {
          const t = new THREE.Texture(bmp)
          t.flipY = false
          t.wrapS = THREE.RepeatWrapping
          t.wrapT = THREE.ClampToEdgeWrapping
          t.minFilter = THREE.LinearMipmapLinearFilter
          t.magFilter = THREE.LinearFilter
          t.generateMipmaps = true
          t.anisotropy = r.capabilities.getMaxAnisotropy()
          t.needsUpdate = true
          resolve(t)
        }, undefined, reject)
      })
    Promise.all([load(`/moon/moon-color-${pick(this.q.color)}.jpg`), load(`/moon/moon-normal-${this.q.normal}.jpg`)])
      .then(([color, normal]) => {
        if (this.disposed) return color.dispose(), normal.dispose()
        const u = this.moonMat.uniforms
        u.uColorMap.value = color
        u.uNormalMap.value = normal
        u.uMode.value = 1
        r.initTexture(color)
        r.initTexture(normal)
        this.maps = [color, normal]
        this.moonBaked = true
      })
      .catch((e) => {
        console.warn('NASA moon maps unavailable, using procedural moon', e)
        this.#queueBake(this.moonRT, this.moonBakeMat, 'moon', () => (this.moonBaked = true))
      })
  }

  #buildShoots() {
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: SHOOT_FRAG, uniforms: { uColor: { value: new THREE.Vector3(1, 1, 1) }, uLife: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
      )
      m.visible = false
      m.renderOrder = -4
      m.userData = { life: 0, dur: 1, vel: new THREE.Vector3() }
      this.shoots.push(m)
      this.scene.add(m)
    }
  }

  // ------------------------------------------------------------------ baking (spread across frames → no jank)
  #queueBake(rt, mat, key, done) {
    this.bakeQueue = this.bakeQueue.filter((j) => j.key !== key)
    const strips = Math.max(8, Math.round(rt.height / 48))
    this.bakeQueue.push({ key, rt, mat, y: 0, step: Math.ceil(rt.height / strips), done })
  }
  #runBake() {
    const job = this.bakeQueue[0]
    if (!job) return
    const r = this.renderer
    this.bakeQuad.material = job.mat
    job.rt.scissorTest = true
    job.rt.scissor.set(0, job.y, job.rt.width, job.step)
    job.rt.viewport.set(0, 0, job.rt.width, job.rt.height)
    r.setRenderTarget(job.rt)
    r.render(this.bakeScene, this.bakeCam)
    r.setRenderTarget(null)
    job.y += job.step
    if (job.y >= job.rt.height) {
      job.rt.scissorTest = false
      this.bakeQueue.shift()
      job.done?.()
    }
  }

  // ------------------------------------------------------------------ settings
  apply(s, initial = false) {
    const prev = initial ? {} : this.s
    this.s = s
    const changed = (...keys) => initial || keys.some((k) => prev[k] !== s[k])

    if (changed('skyTop', 'skyBottom', 'galaxyColor1', 'galaxyColor2', 'nebulaColor', 'galaxyAmount', 'nebulaAmount', 'galaxyTilt', 'galaxyOffset', 'horizonGlow')) {
      const u = this.skyBakeMat.uniforms
      u.uTop.value = col(s.skyTop)
      u.uBottom.value = col(s.skyBottom)
      u.uGal1.value = col(s.galaxyColor1)
      u.uGal2.value = col(s.galaxyColor2)
      u.uNeb.value = col(s.nebulaColor)
      u.uGalAmt.value = s.galaxyAmount
      u.uNebAmt.value = s.nebulaAmount
      u.uTilt.value = s.galaxyTilt * (Math.PI / 180)
      u.uOffset.value = s.galaxyOffset
      u.uHorizon.value = s.horizonGlow
      this.#queueBake(this.skyRT, this.skyBakeMat, 'sky')
    }
    if (changed('starDensity', 'galaxyTilt', 'galaxyOffset', 'galaxyAmount')) this.#fillStars()
    // (the moon surface comes from NASA maps; the procedural bake is only a fallback)

    const st = this.starMat.uniforms
    st.uTwinkle.value = s.reduceMotion ? 0 : s.starTwinkle
    st.uBright.value = s.starBrightness
    this.#starScale()

    const m = this.moonMat.uniforms
    m.uTint.value = col(s.moonTint)
    m.uEarthTint.value = col(s.earthTint)
    m.uEarthshine.value = s.earthshine
    m.uExposure.value = s.moonExposure
    m.uContrast.value = s.moonContrast
    m.uBump.value = s.moonBump
    this.glowMat.uniforms.uColor.value = col(s.glowColor)
    this.shoots.forEach((sh) => (sh.material.uniforms.uColor.value = col(s.shootColor)))
    this.#layoutMoon()
  }

  #starScale() {
    this.starMat.uniforms.uScale.value = (this.s.starSize ?? 1) * this.renderer.getPixelRatio() * 1.6
  }

  #layoutMoon() {
    const s = this.s
    const x = this.mobile ? s.moonXMobile : s.moonX
    const y = this.mobile ? s.moonYMobile : s.moonY
    const size = this.mobile ? s.moonSizeMobile : s.moonSize
    const viewH = 2 * MOON_DIST * Math.tan(THREE.MathUtils.degToRad(VFOV / 2))
    const viewW = viewH * this.camera.aspect
    const radius = (size * Math.min(viewW, viewH)) / 2
    this.moonBase = new THREE.Vector3((x - 0.5) * viewW, (0.5 - y) * viewH, -MOON_DIST)
    this.moon.scale.setScalar(radius)
    this.glow.scale.setScalar(radius * 2 * s.glowSize)
    this.glowMat.uniforms.uInner.value = 1 / s.glowSize
    this.moon.visible = this.glow.visible = s.moonVisible !== false
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    if (this.s) {
      this.#layoutMoon()
      this.#starScale()
    }
  }

  setPointer(x, y) {
    this.pointer.set(x, y)
  }

  // ------------------------------------------------------------------ frame
  #spawnShoot() {
    const sh = this.shoots.find((m) => !m.visible)
    if (!sh) return
    const viewH = 2 * 600 * Math.tan(THREE.MathUtils.degToRad(VFOV / 2))
    const viewW = viewH * this.camera.aspect
    const toLeft = rand() < 0.6
    const tiltA = 0.3 + rand() * 0.5
    const a = toLeft ? Math.PI + tiltA : -tiltA // heading down-left or down-right
    const startX = (toLeft ? 0.05 + rand() * 0.45 : -0.5 + rand() * 0.45) * viewW
    const startY = (0.1 + rand() * 0.38) * viewH
    sh.position.set(startX, startY, -600)
    sh.rotation.z = a
    const len = 45 + rand() * 90
    sh.scale.set(len, 1.6 + rand() * 1.2, 1)
    const speed = 380 + rand() * 420
    sh.userData.vel.set(Math.cos(a) * speed, Math.sin(a) * speed, 0)
    sh.userData.life = 0
    sh.userData.dur = 0.55 + rand() * 0.7
    sh.visible = true
  }

  #tick(now) {
    if (this.disposed) return
    if (document.hidden) return
    this.raf = requestAnimationFrame(this.loop)
    const cap = this.s.fpsCap || this.q.fps
    if (cap && now - this.lastDraw < 1000 / cap - 1.5) return
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    this.lastDraw = now
    this.fpsSamples.push(dt)
    if (this.fpsSamples.length > 60) this.fpsSamples.shift()

    if (this.bakeQueue.length) this.#runBake()

    const s = this.s
    const still = s.reduceMotion
    const speed = still ? 0 : s.motion ?? 1
    this.time += dt * speed * 1.15 // overall motion pace (+15%)

    // camera parallax (depth): stars & galaxy drift against the near moon
    if (s.parallax && !still) {
      this.pointerSmooth.lerp(this.pointer, 1 - Math.pow(0.001, dt))
      this.rig.rotation.y = -this.pointerSmooth.x * 0.035 + Math.sin(this.time * 0.02) * 0.01
      this.rig.rotation.x = this.pointerSmooth.y * 0.025
    } else {
      this.rig.rotation.set(0, 0, 0)
    }
    // slow, continuous drift of the whole sky + a gentle camera sway
    this.sky.rotation.y = this.stars.rotation.y = this.time * 0.0045 * (s.skyDrift ?? 1)
    this.sky.rotation.x = this.stars.rotation.x = Math.sin(this.time * 0.013) * 0.01 * (s.skyDrift ?? 1)
    if (!still) {
      this.rig.rotation.y += Math.sin(this.time * 0.021) * 0.006
      this.rig.rotation.x += Math.cos(this.time * 0.017) * 0.004
    }

    // moon: face the camera, gentle libration wobble
    const camPos = this.camera.getWorldPosition(new THREE.Vector3())
    const mp = this.moonBase.clone().applyQuaternion(this.rig.quaternion)
    this.moon.position.copy(mp)
    this.moon.lookAt(camPos)
    const lib = s.libration ? 0.11 : 0
    this.moon.rotateY(THREE.MathUtils.degToRad((s.moonSpin ?? 0) * this.time) + Math.sin(this.time * 0.05) * lib)
    this.moon.rotateX(Math.cos(this.time * 0.037) * lib * 0.6)
    this.moon.rotateZ(THREE.MathUtils.degToRad(s.moonRotation || 0))
    this.glow.position.copy(mp).multiplyScalar(1.001)
    this.glow.lookAt(camPos)

    // sunlight from the real (or chosen) phase
    const phase = resolvePhase(s)
    const theta = phase * Math.PI * 2
    const V = camPos.clone().sub(mp).normalize()
    const right = new THREE.Vector3(0, 1, 0).cross(V).normalize()
    const L = V.clone().multiplyScalar(-Math.cos(theta)).addScaledVector(right, Math.sin(theta)).normalize()
    L.applyAxisAngle(V, THREE.MathUtils.degToRad(s.moonTilt || 0))
    const inv = this.moon.quaternion.clone().invert()
    this.moonMat.uniforms.uSun.value.copy(L.applyQuaternion(inv))
    this.moonMat.uniforms.uView.value.copy(V.clone().applyQuaternion(inv))
    const ill = illumination(phase)
    this.glowMat.uniforms.uIntensity.value = s.glowIntensity * (0.25 + 0.75 * ill)
    this.glowMat.uniforms.uIll.value = ill
    // direction of the lit limb on screen (camera space)
    const litView = L.clone().applyQuaternion(this.moon.quaternion).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()).invert())
    this.glowMat.uniforms.uLit.value.set(litView.x, litView.y).normalize()
    if (this.moonBaked && this.moonMat.uniforms.uReady.value < 1) {
      this.moonMat.uniforms.uReady.value = Math.min(1, this.moonMat.uniforms.uReady.value + dt * 1.6)
      this.glowMat.uniforms.uIntensity.value *= this.moonMat.uniforms.uReady.value
      if (this.moonMat.uniforms.uReady.value >= 1) this.onReady?.()
    } else if (!this.moonBaked) this.glowMat.uniforms.uIntensity.value = 0

    this.starMat.uniforms.uTime.value = this.time

    // shooting stars
    const interval = still ? 0 : SHOOT_INTERVAL[s.shooting] || 0
    if (interval) {
      this.nextShoot -= dt
      if (this.nextShoot <= 0) {
        this.#spawnShoot()
        this.nextShoot = interval * (0.4 + rand() * 1.2)
      }
    }
    for (const sh of this.shoots) {
      if (!sh.visible) continue
      const d = sh.userData
      d.life += dt / d.dur
      sh.position.addScaledVector(d.vel, dt)
      sh.material.uniforms.uLife.value = d.life
      if (d.life >= 1) sh.visible = false
    }

    this.renderer.render(this.scene, this.camera)
  }

  /** Average frames per second over the last ~60 frames. */
  get fps() {
    if (!this.fpsSamples.length) return 0
    return Math.round(this.fpsSamples.length / this.fpsSamples.reduce((a, b) => a + b, 0))
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    document.removeEventListener('visibilitychange', this.onVis)
    this.scene.traverse((o) => {
      o.geometry?.dispose()
      o.material?.dispose()
    })
    this.skyRT.dispose()
    this.moonRT.dispose()
    this.maps?.forEach((t) => t.dispose())
    this.skyBakeMat.dispose()
    this.moonBakeMat.dispose()
    this.bakeQuad.geometry.dispose()
    this.renderer.dispose()
  }
}
