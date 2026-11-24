export const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', HTML: '#e34c26', CSS: '#663399',
  Java: '#b07219', Kotlin: '#A97BFF', Swift: '#F05138', Go: '#00ADD8', Rust: '#dea584', 'C++': '#f34b7d',
  C: '#555555', 'C#': '#178600', PHP: '#4F5D95', Ruby: '#701516', Dart: '#00B4AB', Vue: '#41b883',
  Svelte: '#ff3e00', Shell: '#89e051', Lua: '#000080', Luau: '#00A2FF', SCSS: '#c6538c', 'Jupyter Notebook': '#DA5B0B',
  PowerShell: '#012456', Astro: '#ff5a03', MDX: '#fcb32c', GDScript: '#355570', Elixir: '#6e4a7e', Scala: '#c22d40',
}
export const langColor = (l) => LANG_COLORS[l] || '#9aa0b5'

export function timeAgo(date) {
  if (!date) return ''
  const s = (Date.now() - new Date(date).getTime()) / 1000
  const units = [['y', 31536000], ['mo', 2592000], ['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]]
  for (const [u, n] of units) if (s >= n) return `${Math.floor(s / n)}${u} ago`
  return 'just now'
}

export function fmt(n) {
  if (n == null) return '0'
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

export function bytes(n) {
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1048576).toFixed(1) + ' MB'
}

// UTF-8 safe base64
export function b64encodeBytes(u8) {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < u8.length; i += chunk) s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk))
  return btoa(s)
}
export const b64encodeText = (text) => b64encodeBytes(new TextEncoder().encode(text))
export function b64decodeBytes(b64) {
  const bin = atob(b64.replace(/\s/g, ''))
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8
}
export function b64decodeText(b64) {
  return new TextDecoder().decode(b64decodeBytes(b64))
}
export function looksBinary(u8) {
  const n = Math.min(u8.length, 8000)
  for (let i = 0; i < n; i++) if (u8[i] === 0) return true
  return false
}

/** Where a repo's website lives, if anywhere. */
export function siteUrl(repo) {
  if (repo.homepage && /^https?:\/\//.test(repo.homepage)) return repo.homepage
  if (repo.has_pages) {
    const owner = repo.owner.login.toLowerCase()
    if (repo.name.toLowerCase() === `${owner}.github.io`) return `https://${owner}.github.io/`
    return `https://${owner}.github.io/${repo.name}/`
  }
  return null
}

/** Repo health checklist (0–100). */
export function health(repo) {
  const checks = [
    { key: 'description', label: 'Has a description', ok: !!repo.description },
    { key: 'license', label: 'Has a license', ok: !!repo.license },
    { key: 'topics', label: 'Has topics', ok: (repo.topics || []).length > 0 },
    { key: 'homepage', label: 'Has a live site / homepage', ok: !!siteUrl(repo) },
    { key: 'fresh', label: 'Updated in the last 6 months', ok: Date.now() - new Date(repo.pushed_at).getTime() < 15552000000 },
    { key: 'notEmpty', label: 'Has code', ok: repo.size > 0 },
  ]
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)
  return { score, checks }
}
export const healthColor = (s) => (s >= 80 ? '#34d399' : s >= 50 ? '#fbbf24' : '#f87171')

export function randomString(len = 32) {
  const a = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function pool(items, limit, fn) {
  const results = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

export const LICENSES = [
  { key: '', name: 'None' },
  { key: 'mit', name: 'MIT' },
  { key: 'apache-2.0', name: 'Apache 2.0' },
  { key: 'gpl-3.0', name: 'GPL v3' },
  { key: 'bsd-3-clause', name: 'BSD 3-Clause' },
  { key: 'mpl-2.0', name: 'Mozilla 2.0' },
  { key: 'unlicense', name: 'Unlicense' },
]
