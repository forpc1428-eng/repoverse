// Where the moon is in YOUR sky right now (low-precision astronomy, ~1° accuracy).
// Formulas after SunCalc / Meeus. No network, no data leaves the browser.
const rad = Math.PI / 180
const e = rad * 23.4397

const toDays = (date) => date.valueOf() / 86400000 - 0.5 + 2440588 - 2451545

function moonCoords(d) {
  const L = rad * (218.316 + 13.176396 * d)
  const M = rad * (134.963 + 13.064993 * d)
  const F = rad * (93.272 + 13.22935 * d)
  const l = L + rad * 6.289 * Math.sin(M)
  const b = rad * 5.128 * Math.sin(F)
  return {
    ra: Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)),
    dec: Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)),
  }
}

/** Moon altitude & azimuth (degrees; azimuth measured from north, clockwise). */
export function moonPosition(date, lat, lon) {
  const lw = rad * -lon
  const phi = rad * lat
  const d = toDays(date)
  const c = moonCoords(d)
  const H = rad * (280.16 + 360.9856235 * d) - lw - c.ra
  const alt = Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H))
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(c.dec) * Math.cos(phi))
  return { altitude: alt / rad, azimuth: (az / rad + 180 + 360) % 360 }
}

/** Next moonrise and moonset within 24h (sampled every 5 minutes). */
export function moonTimes(date, lat, lon) {
  let rise = null
  let set = null
  let prev = moonPosition(date, lat, lon).altitude
  for (let m = 5; m <= 24 * 60 && (!rise || !set); m += 5) {
    const t = new Date(date.getTime() + m * 60000)
    const a = moonPosition(t, lat, lon).altitude
    if (prev < 0 && a >= 0 && !rise) rise = t
    if (prev >= 0 && a < 0 && !set) set = t
    prev = a
  }
  return { rise, set }
}

/** Your approximate location: browser geolocation if allowed, otherwise from your time zone. */
export function guessLocation() {
  const lon = -new Date().getTimezoneOffset() / 4 // 15° per hour
  return { lat: 20, lon, approximate: true }
}

export function askLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(guessLocation())
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(1), lon: +p.coords.longitude.toFixed(1), approximate: false }), // rounded: ~10 km, never sent anywhere
      () => resolve(guessLocation()),
      { maximumAge: 3600000, timeout: 8000 }
    )
  })
}

/** Map altitude/azimuth to a spot on the screen (east = left, west = right). */
export function skyToScreen({ altitude, azimuth }) {
  // facing south: azimuth 90 (E) → left, 270 (W) → right
  const x = Math.min(0.92, Math.max(0.08, (azimuth - 90) / 180))
  const y = Math.min(0.85, Math.max(0.12, 0.85 - (Math.max(altitude, 0) / 70) * 0.73))
  return { x, y, visible: altitude > -2 }
}
