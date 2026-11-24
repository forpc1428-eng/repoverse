import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from './github'
import { getSecure, setSecure, delSecure, wipeAll } from './store'
import { randomString } from './util'
import { createDemoClient } from './demo'

// Sign-in endpoints live on the same site as the app (Vercel functions in /api).
// An external worker can be used instead by setting VITE_AUTH_WORKER_URL.
const API = (import.meta.env.VITE_AUTH_WORKER_URL || '').replace(/\/$/, '') || '/api'

// Every permission RepoVerse needs, requested once in a single GitHub approval screen.
// After the first approval GitHub skips the screen and signs you straight in.
export const SCOPES = ['repo', 'workflow', 'gist', 'read:user', 'user:email', 'delete_repo']

let configPromise
/** The OAuth client ID is public; it is served by /api/config so no rebuild is needed to set it. */
export function getAuthConfig() {
  if (!configPromise) {
    configPromise = import.meta.env.VITE_GITHUB_CLIENT_ID
      ? Promise.resolve({ clientId: import.meta.env.VITE_GITHUB_CLIENT_ID })
      : fetch(`${API}/config`, { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}))
  }
  return configPromise
}

const redirectUri = () => window.location.origin + window.location.pathname

export async function startOAuth() {
  const { clientId } = await getAuthConfig()
  if (!clientId) throw new Error('GitHub sign-in is not set up on this server yet.')
  const state = randomString(16)
  sessionStorage.setItem('rv-oauth-state', state)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    scope: SCOPES.join(' '),
    state,
    allow_signup: 'true',
  })
  window.location.assign(`https://github.com/login/oauth/authorize?${params}`)
}

async function finishOAuth() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const ghError = params.get('error_description')
  if (!code && !ghError) return null
  // Remove the code from the address bar right away.
  window.history.replaceState({}, '', redirectUri() + window.location.hash)
  if (ghError) throw new Error(ghError)
  const expected = sessionStorage.getItem('rv-oauth-state')
  sessionStorage.removeItem('rv-oauth-state')
  if (!expected || expected !== state) throw new Error('Sign-in was interrupted. Please try again.')
  const res = await fetch(`${API}/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri() }),
    referrerPolicy: 'no-referrer',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || 'GitHub sign-in failed')
  return data.access_token
}

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [repos, setRepos] = useState([])
  const [reposLoading, setReposLoading] = useState(false)
  const [scopes, setScopes] = useState([])

  const gh = useMemo(() => (token === 'demo' ? createDemoClient() : token ? createClient(token) : null), [token])
  const demo = token === 'demo'
  const demoRef = useRef(false)
  demoRef.current = demo
  const persist = (list) => !demoRef.current && setSecure('repos', list)

  const startDemo = useCallback(async () => {
    const me = await createDemoClient().me()
    setRepos([])
    setToken('demo')
    setUser(me)
    setScopes([])
    setStatus('in')
  }, [])

  const acceptToken = useCallback(async (t) => {
    const client = createClient(t)
    const res = await client.get('/user', { raw: true })
    if (!res.ok) throw new Error(res.status === 401 ? 'That token is invalid or expired.' : `GitHub error ${res.status}`)
    const me = await res.json()
    setScopes((res.headers.get('x-oauth-scopes') || '').split(',').map((s) => s.trim()).filter(Boolean))
    await setSecure('token', t)
    setToken(t)
    setUser(me)
    setStatus('in')
    return me
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const fromOAuth = await finishOAuth()
        const t = fromOAuth || (await getSecure('token'))
        if (!t) return setStatus('out')
        const cached = await getSecure('repos', [])
        if (cached.length) setRepos(cached)
        await acceptToken(t)
      } catch (e) {
        setError(e.message)
        await delSecure('token')
        setStatus('out')
      }
    })()
  }, [acceptToken])

  const refreshRepos = useCallback(async () => {
    if (!gh) return
    setReposLoading(true)
    try {
      const list = await gh.repos()
      setRepos(list)
      persist(list)
    } finally {
      setReposLoading(false)
    }
  }, [gh])

  useEffect(() => {
    if (status === 'in') refreshRepos().catch((e) => setError(e.message))
  }, [status, refreshRepos])

  const patchRepo = useCallback((full, patch) => {
    setRepos((list) => {
      const next = list.map((r) => (r.full_name === full ? { ...r, ...patch } : r))
      persist(next)
      return next
    })
  }, [])
  const removeRepo = useCallback((full) => {
    setRepos((list) => {
      const next = list.filter((r) => r.full_name !== full)
      persist(next)
      return next
    })
  }, [])
  const addRepo = useCallback((repo) => {
    setRepos((list) => {
      const next = [repo, ...list.filter((r) => r.id !== repo.id)]
      persist(next)
      return next
    })
  }, [])

  const logout = useCallback(async (wipe = false) => {
    if (demoRef.current) wipe = false
    if (wipe) await wipeAll()
    else {
      await delSecure('token')
      await delSecure('repos')
    }
    setToken(null)
    setUser(null)
    setRepos([])
    setStatus('out')
    if (wipe) window.location.reload()
  }, [])

  return (
    <Ctx.Provider
      value={{ token, user, status, error, setError, gh, repos, reposLoading, refreshRepos, patchRepo, removeRepo, addRepo, acceptToken, logout, scopes, demo, startDemo }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
