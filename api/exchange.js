import { CLIENT_ID } from './_client.js'
// POST /api/exchange: swaps GitHub's one-time sign-in code for an access token.
//
// GitHub requires the client secret for this step, and a secret can never live in
// browser code, so this tiny function does it. It is STATELESS: it stores nothing,
// logs nothing, and returns the token straight to the browser that asked for it.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  // Only accept calls from this same site.
  const origin = req.headers.origin || ''
  const host = req.headers['x-forwarded-host'] || req.headers.host
  if (!origin || new URL(origin).host !== host) return res.status(403).json({ error: 'forbidden_origin' })

  const { GITHUB_CLIENT_SECRET } = process.env
  const GITHUB_CLIENT_ID = CLIENT_ID
  if (!GITHUB_CLIENT_SECRET) return res.status(500).json({ error: 'not_configured', error_description: 'GitHub sign-in is not set up on this server yet.' })

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {}
  const { code, redirect_uri } = body
  if (typeof code !== 'string' || !code || code.length > 100) return res.status(400).json({ error: 'bad_request' })
  if (redirect_uri && new URL(redirect_uri).host !== host) return res.status(400).json({ error: 'bad_redirect' })

  const gh = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'repoverse-auth' },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, redirect_uri }),
  })
  const data = await gh.json().catch(() => ({ error: 'bad_github_response' }))
  if (!data.access_token) {
    return res.status(400).json({ error: data.error || 'exchange_failed', error_description: data.error_description || 'GitHub sign-in failed. Please try again.' })
  }
  return res.status(200).json({ access_token: data.access_token, scope: data.scope, token_type: data.token_type })
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
