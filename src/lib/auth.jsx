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
export const SCOPES = ['repo', 'workflow', 'gist', 'read:user', 'user:email', 'delete_repo', 'notifications', 'security_events']

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

/** Start GitHub sign-in. selectAccount shows GitHub's account picker (for adding another account). */
export async function startOAuth({ selectAccount = false } = {}) {
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
  if (selectAccount) params.set('prompt', 'select_account')
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

const cacheKey = (login) => `repos:${login}`
const pickUser = (me) => ({ login: me.login, name: me.name, avatar_url: me.avatar_url, id: me.id })

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [repos, setRepos] = useState([])
  const [reposLoading, setReposLoading] = useState(false)
  const [scopes, setScopes] = useState([])
  // Every signed-in GitHub account on this device (tokens encrypted at rest).
  const [accounts, setAccounts] = useState([])

  const gh = useMemo(() => (token === 'demo' ? createDemoClient() : token ? createClient(token) : null), [token])
  const demo = token === 'demo'
  const demoRef = useRef(false)
  demoRef.current = demo
  const loginRef = useRef(null)
  loginRef.current = user?.login
  const persist = (list) => !demoRef.current && loginRef.current && setSecure(cacheKey(loginRef.current), list)

  const saveAccounts = useCallback(async (list, active) => {
    setAccounts(list)
    await setSecure('accounts', list)
    if (active !== undefined) await setSecure('activeAccount', active)
  }, [])

  const startDemo = useCallback(async () => {
    const me = await createDemoClient().me()
    setRepos([])
    setToken('demo')
    setUser(me)
    setScopes([])
    setStatus('in')
  }, [])

  /** Validate a token, add/refresh its account and make it the active one. */
  const acceptToken = useCallback(async (t) => {
    const res = await createClient(t).get('/user', { raw: true })
    if (!res.ok) throw Object.assign(new Error(res.status === 401 ? 'That GitHub login has expired. Please sign in again.' : `GitHub error ${res.status}`), { status: res.status })
    const me = await res.json()
    const sc = (res.headers.get('x-oauth-scopes') || '').split(',').map((x) => x.trim()).filter(Boolean)
    const list = (await getSecure('accounts', [])).filter((a) => a.login !== me.login)
    const next = [{ ...pickUser(me), token: t, scopes: sc }, ...list]
    await saveAccounts(next, me.login)
    setRepos(await getSecure(cacheKey(me.login), []))
    setScopes(sc)
    setToken(t)
    setUser(me)
    setStatus('in')
    return me
  }, [saveAccounts])

  useEffect(() => {
    ;(async () => {
      try {
        // migrate the single-account storage of older versions
        const legacy = await getSecure('token')
        if (legacy) {
          await delSecure('token')
          await delSecure('repos')
          await acceptToken(legacy).catch(() => {})
        }
        const fromOAuth = await finishOAuth()
        if (fromOAuth) return void (await acceptToken(fromOAuth))
        const list = await getSecure('accounts', [])
        setAccounts(list)
        if (!list.length) return setStatus('out')
        const active = await getSecure('activeAccount')
        const acc = list.find((a) => a.login === active) || list[0]
        setRepos(await getSecure(cacheKey(acc.login), []))
        await acceptToken(acc.token)
      } catch (e) {
        setError(e.message)
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

  /** Switch to another signed-in account (instant: cached repos show, then refresh). */
  const switchAccount = useCallback(async (login) => {
    const acc = accounts.find((a) => a.login === login)
    if (!acc) return
    try {
      await acceptToken(acc.token)
    } catch (e) {
      setError(`${login}: ${e.message}`)
      if (e.status === 401) await saveAccounts(accounts.filter((a) => a.login !== login))
    }
  }, [accounts, acceptToken, saveAccounts])

  const addAccount = useCallback(() => startOAuth({ selectAccount: true }), [])

  const goOut = () => {
    setToken(null)
    setUser(null)
    setRepos([])
    setStatus('out')
  }

  /** Sign out one account (the active one by default). Others stay signed in. */
  const signOut = useCallback(async (login = loginRef.current) => {
    if (demoRef.current) return goOut()
    const rest = accounts.filter((a) => a.login !== login)
    await delSecure(cacheKey(login))
    await saveAccounts(rest, rest[0]?.login ?? null)
    if (login !== loginRef.current) return
    if (rest.length) await acceptToken(rest[0].token).catch(() => goOut())
    else goOut()
  }, [accounts, acceptToken, saveAccounts])

  /** Sign out every account and erase all private data + the encryption key. */
  const signOutAll = useCallback(async () => {
    await wipeAll()
    window.location.reload()
  }, [])

  // Backwards-compatible helper used by older screens.
  const logout = useCallback((wipe = false) => (wipe && !demoRef.current ? signOutAll() : signOut()), [signOut, signOutAll])

  return (
    <Ctx.Provider
      value={{
        token, user, status, error, setError, gh, repos, reposLoading, refreshRepos, patchRepo, removeRepo, addRepo, acceptToken,
        logout, signOut, signOutAll, scopes, demo, startDemo, accounts, switchAccount, addAccount,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
