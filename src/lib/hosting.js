// Vercel & Netlify accounts — straight from the browser to each provider's API
// (both allow it). Tokens are encrypted on this device like GitHub logins.
import { getSecure, setSecure } from './store'

export const PROVIDERS = {
  vercel: {
    name: 'Vercel',
    tokenUrl: 'https://vercel.com/account/settings/tokens',
    help: 'Vercel → Account Settings → Tokens → Create. Scope: Full Account (or a team).',
  },
  netlify: {
    name: 'Netlify',
    tokenUrl: 'https://app.netlify.com/user/applications#personal-access-tokens',
    help: 'Netlify → User settings → Applications → New access token.',
  },
}

async function call(provider, token, path, { method = 'GET', body } = {}) {
  const base = provider === 'vercel' ? 'https://api.vercel.com' : 'https://api.netlify.com/api/v1'
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || data?.message || `${PROVIDERS[provider].name} error ${res.status}`), { status: res.status })
  return data
}

/** Check a token and describe the account (and Vercel teams). */
export async function identify(provider, token) {
  if (provider === 'vercel') {
    const { user } = await call('vercel', token, '/v2/user')
    const teams = await call('vercel', token, '/v2/teams?limit=50').then((d) => d.teams || []).catch(() => [])
    return {
      provider, token, username: user.username, name: user.name || user.username,
      avatar: user.avatar ? `https://vercel.com/api/www/avatar/${user.avatar}?s=80` : null,
      scopes: [{ id: '', name: 'Personal' }, ...teams.map((t) => ({ id: t.id, name: t.name }))],
    }
  }
  const u = await call('netlify', token, '/user')
  return { provider, token, username: u.slug || u.email, name: u.full_name || u.email, avatar: u.avatar_url, scopes: [{ id: '', name: 'All sites' }] }
}

const q = (scope) => (scope ? `teamId=${encodeURIComponent(scope)}` : '')

/** Projects/sites in a common shape. */
export async function listProjects(acc, scope = '') {
  if (acc.provider === 'vercel') {
    const d = await call('vercel', acc.token, `/v9/projects?limit=100${scope ? '&' + q(scope) : ''}`)
    return (d.projects || []).map((p) => {
      const dep = p.latestDeployments?.[0]
      const prod = p.targets?.production
      const domain = p.alias?.find?.((a) => !a.domain?.includes('-git-'))?.domain || prod?.alias?.[0] || (dep?.url ?? null)
      return {
        id: p.id, name: p.name, framework: p.framework, provider: 'vercel',
        url: domain ? `https://${domain.replace(/^https?:\/\//, '')}` : null,
        state: mapState(prod?.readyState || dep?.readyState),
        updated: prod?.createdAt || dep?.createdAt || p.updatedAt,
        repo: p.link?.type === 'github' ? `${p.link.org}/${p.link.repo}` : null,
        dashboard: `https://vercel.com/${acc.username}/${p.name}`,
        lastDeploymentId: prod?.id || dep?.uid,
      }
    })
  }
  const sites = await call('netlify', acc.token, '/sites?per_page=100&filter=all')
  return sites.map((s) => ({
    id: s.id, name: s.name, framework: s.build_settings?.cmd ? s.build_settings.cmd.split(' ')[0] : null, provider: 'netlify',
    url: s.ssl_url || s.url,
    state: mapState(s.published_deploy?.state),
    updated: s.published_deploy?.published_at || s.updated_at,
    repo: s.build_settings?.repo_url?.match(/github\.com\/([^/]+\/[^/.]+)/)?.[1] || null,
    dashboard: s.admin_url,
  }))
}

const mapState = (s) => {
  const v = String(s || '').toLowerCase()
  if (['ready', 'success'].includes(v)) return 'ready'
  if (['error', 'failed', 'canceled'].includes(v)) return 'error'
  if (!v) return 'unknown'
  return 'building' // building, queued, initializing, enqueued, processing, uploading
}

/** Trigger a fresh production deploy. */
export async function redeploy(acc, project, scope = '') {
  if (acc.provider === 'vercel') {
    if (!project.lastDeploymentId) throw new Error('No previous deployment to redeploy.')
    return call('vercel', acc.token, `/v13/deployments?forceNew=1${scope ? '&' + q(scope) : ''}`, { method: 'POST', body: { name: project.name, deploymentId: project.lastDeploymentId, target: 'production' } })
  }
  return call('netlify', acc.token, `/sites/${project.id}/builds`, { method: 'POST' })
}

// ---- encrypted account list
export const loadHostAccounts = () => getSecure('hosting', [])
export const saveHostAccounts = (list) => setSecure('hosting', list)
