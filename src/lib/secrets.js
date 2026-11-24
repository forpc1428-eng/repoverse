// Pre-push scanner: blocks real secrets, warns about suspicious ones.

const BLOCK_PATTERNS = [
  ['GitHub token', /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ['AWS access key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{30,}/],
  ['OpenAI API key', /\bsk-(proj-)?[A-Za-z0-9_-]{32,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe live key', /\b(sk|rk)_live_[0-9a-zA-Z]{20,}\b/],
  ['Slack token', /\bxox[baprs]-[0-9A-Za-z-]{10,}/],
  ['Discord bot token', /\b[MN][A-Za-z\d]{23,25}\.[\w-]{6}\.[\w-]{27,}\b/],
  ['Private key', /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY( BLOCK)?-----/],
  ['Firebase/Supabase service key', /\b(service_role|serviceAccount)\b[^\n]{0,40}eyJ[A-Za-z0-9_-]{20,}/],
  ['Database URL with password', /\b(postgres|postgresql|mysql|mongodb(\+srv)?|redis):\/\/[^\s:@/]+:[^\s@/]{3,}@/],
]
const WARN_PATTERNS = [
  ['Possible hard-coded secret', /\b(api[_-]?key|secret|passwd|password|auth[_-]?token|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*['"][^'"\s]{12,}['"]/i],
  ['JWT token', /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
]

export const SECRET_FILES = [/(^|\/)\.env(\..*)?$/i, /\.(pem|key|p12|pfx|keystore|jks)$/i, /(^|\/)id_(rsa|ed25519|ecdsa)$/i, /(^|\/)credentials\.json$/i, /(^|\/)service-account.*\.json$/i]
const SAFE_ENV = /\.env\.(example|sample|template)$/i

export function scanFile(path, text) {
  const findings = []
  if (SECRET_FILES.some((r) => r.test(path)) && !SAFE_ENV.test(path)) {
    findings.push({ level: 'block', path, kind: 'Secret file', line: 0 })
  }
  if (text == null) return findings
  const lines = text.split('\n')
  for (let i = 0; i < lines.length && i < 20000; i++) {
    const line = lines[i]
    if (line.length > 2000) continue
    for (const [kind, re] of BLOCK_PATTERNS) if (re.test(line)) findings.push({ level: 'block', path, kind, line: i + 1 })
    for (const [kind, re] of WARN_PATTERNS) if (re.test(line)) findings.push({ level: 'warn', path, kind, line: i + 1 })
  }
  return findings
}

// ---- minimal .gitignore support ----
export const DEFAULT_IGNORES = ['node_modules/', '.git/', '.DS_Store', 'Thumbs.db', '*.log', '.vercel/', '.next/', '.cache/', '__pycache__/', '.venv/', 'venv/', '.idea/', '.gradle/', 'build/intermediates/']

function globToRegex(glob) {
  let g = glob.trim()
  if (!g || g.startsWith('#')) return null
  const negate = g.startsWith('!')
  if (negate) g = g.slice(1)
  const dirOnly = g.endsWith('/')
  if (dirOnly) g = g.slice(0, -1)
  const anchored = g.startsWith('/') || g.slice(0, -1).includes('/')
  g = g.replace(/^\//, '')
  let re = g
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
  re = (anchored ? '^' : '(?:^|/)') + re + (dirOnly ? '(?:/|$)' : '(?:$|/)')
  return { re: new RegExp(re), negate }
}

export function makeIgnore(gitignoreText = '') {
  const rules = [...DEFAULT_IGNORES, ...gitignoreText.split(/\r?\n/)].map(globToRegex).filter(Boolean)
  return (path) => {
    let ignored = false
    for (const r of rules) if (r.re.test(path)) ignored = !r.negate
    return ignored
  }
}
