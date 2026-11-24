// Thin GitHub REST/GraphQL client. Calls go straight from the browser to api.github.com.

export class GitHubError extends Error {
  constructor(status, message, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

const listeners = new Set()
export const rateLimit = { remaining: null, limit: null, reset: null }
export function onRateLimit(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function createClient(token) {
  async function request(method, path, body, { raw = false, headers = {}, signal } = {}) {
    const url = path.startsWith('http') ? path : `https://api.github.com${path}`
    const res = await fetch(url, {
      method,
      signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    })
    const rem = res.headers.get('x-ratelimit-remaining')
    if (rem != null && !url.includes('/search/')) {
      rateLimit.remaining = +rem
      rateLimit.limit = +res.headers.get('x-ratelimit-limit')
      rateLimit.reset = +res.headers.get('x-ratelimit-reset')
      listeners.forEach((fn) => fn({ ...rateLimit }))
    }
    if (raw) return res
    if (res.status === 204) return null
    let data = null
    const text = await res.text()
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    if (!res.ok) {
      let msg = (data && data.message) || res.statusText
      if (data?.errors?.length) msg += ': ' + data.errors.map((e) => e.message || e.code).join(', ')
      throw new GitHubError(res.status, msg, data)
    }
    return data
  }

  async function paginate(path, { max = 3000 } = {}) {
    let url = path + (path.includes('?') ? '&' : '?') + 'per_page=100'
    const out = []
    while (url && out.length < max) {
      const res = await request('GET', url, undefined, { raw: true })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new GitHubError(res.status, d.message || res.statusText, d)
      }
      const data = await res.json()
      out.push(...(Array.isArray(data) ? data : data.items || data.workflow_runs || []))
      const link = res.headers.get('link') || ''
      const next = link.split(',').find((p) => p.includes('rel="next"'))
      url = next ? next.match(/<([^>]+)>/)[1] : null
    }
    return out
  }

  const enc = (p) => p.split('/').map(encodeURIComponent).join('/')

  return {
    request,
    paginate,
    get: (p, o) => request('GET', p, undefined, o),
    post: (p, b, o) => request('POST', p, b, o),
    patch: (p, b, o) => request('PATCH', p, b, o),
    put: (p, b, o) => request('PUT', p, b, o),
    del: (p, b, o) => request('DELETE', p, b, o),
    graphql: async (query, variables) => {
      const d = await request('POST', '/graphql', { query, variables })
      if (d.errors) throw new GitHubError(400, d.errors.map((e) => e.message).join('; '), d)
      return d.data
    },

    me: () => request('GET', '/user'),
    repos: () => paginate('/user/repos?sort=pushed&affiliation=owner,collaborator,organization_member'),
    repo: (full) => request('GET', `/repos/${full}`),
    languages: (full) => request('GET', `/repos/${full}/languages`),
    branches: (full) => paginate(`/repos/${full}/branches`, { max: 300 }),
    tree: (full, ref) => request('GET', `/repos/${full}/git/trees/${encodeURIComponent(ref)}?recursive=1`),
    file: (full, path, ref) => request('GET', `/repos/${full}/contents/${enc(path)}?ref=${encodeURIComponent(ref)}`),
    blob: (full, sha) => request('GET', `/repos/${full}/git/blobs/${sha}`),
    saveFile: (full, path, { content, message, sha, branch }) =>
      request('PUT', `/repos/${full}/contents/${enc(path)}`, { message, content, sha, branch }),
    deleteFile: (full, path, { message, sha, branch }) =>
      request('DELETE', `/repos/${full}/contents/${enc(path)}`, { message, sha, branch }),
    readme: (full) => request('GET', `/repos/${full}/readme`),
    updateRepo: (full, patch) => request('PATCH', `/repos/${full}`, patch),
    setTopics: (full, names) => request('PUT', `/repos/${full}/topics`, { names }),
    deleteRepo: (full) => request('DELETE', `/repos/${full}`),
    pages: (full) => request('GET', `/repos/${full}/pages`),
    enablePages: (full, branch, path = '/') => request('POST', `/repos/${full}/pages`, { source: { branch, path } }),
    disablePages: (full) => request('DELETE', `/repos/${full}/pages`),
    releases: (full) => request('GET', `/repos/${full}/releases?per_page=20`),
    createRelease: (full, body) => request('POST', `/repos/${full}/releases`, body),
    issues: (full) => request('GET', `/repos/${full}/issues?state=open&per_page=30`),
    createIssue: (full, body) => request('POST', `/repos/${full}/issues`, body),
    pulls: (full) => request('GET', `/repos/${full}/pulls?state=open&per_page=30`),
    runs: (full) => request('GET', `/repos/${full}/actions/runs?per_page=10`),
    views: (full) => request('GET', `/repos/${full}/traffic/views`),
    clones: (full) => request('GET', `/repos/${full}/traffic/clones`),
    createRepo: (body) => request('POST', '/user/repos', body),
    searchCode: (q) => request('GET', `/search/code?q=${encodeURIComponent(q)}&per_page=50`),
    gists: () => request('GET', '/gists?per_page=100'),
    createGist: (body) => request('POST', '/gists', body),
    updateGist: (id, body) => request('PATCH', `/gists/${id}`, body),
    gist: (id) => request('GET', `/gists/${id}`),
  }
}
