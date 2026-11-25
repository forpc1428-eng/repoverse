// Soft night ambience generated live with the Web Audio API — no audio files.
// A gentle filtered-noise breeze plus faint, sparse crickets. Off by default.
let ctx = null
let master = null
let chirpTimer = null

function noiseBuffer(c) {
  const len = c.sampleRate * 4
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1 // pink-ish noise
    b0 = 0.997 * b0 + w * 0.029
    b1 = 0.985 * b1 + w * 0.032
    b2 = 0.95 * b2 + w * 0.048
    d[i] = (b0 + b1 + b2) * 0.35
  }
  return buf
}

function chirp() {
  if (!ctx) return
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.value = 4200 + Math.random() * 600
  g.gain.value = 0
  for (let i = 0; i < 3; i++) {
    g.gain.setTargetAtTime(0.018, t + i * 0.09, 0.008)
    g.gain.setTargetAtTime(0, t + i * 0.09 + 0.035, 0.01)
  }
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + 0.4)
  chirpTimer = setTimeout(chirp, 2500 + Math.random() * 6000)
}

export function startAmbience(volume = 0.4) {
  if (ctx) return setAmbienceVolume(volume)
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  src.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 520
  const lfo = ctx.createOscillator() // slow "gusts"
  const lfoGain = ctx.createGain()
  lfo.frequency.value = 0.07
  lfoGain.gain.value = 260
  lfo.connect(lfoGain).connect(lp.frequency)
  const windGain = ctx.createGain()
  windGain.gain.value = 0.5
  src.connect(lp).connect(windGain).connect(master)
  src.start()
  lfo.start()
  setAmbienceVolume(volume)
  chirpTimer = setTimeout(chirp, 1500)
}

export function setAmbienceVolume(v) {
  if (master) master.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.6, ctx.currentTime, 0.6)
}

export function stopAmbience() {
  clearTimeout(chirpTimer)
  if (!ctx) return
  const c = ctx
  master.gain.setTargetAtTime(0, c.currentTime, 0.3)
  setTimeout(() => c.close(), 1200)
  ctx = null
  master = null
}

/** Browsers start audio paused until the first click; call this from a click. */
export function resumeAmbience() {
  if (ctx && ctx.state === 'suspended') ctx.resume()
}
