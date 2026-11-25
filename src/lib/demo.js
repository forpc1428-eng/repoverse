// Demo mode: a fake GitHub client with sample data so anyone can explore RepoVerse
// without signing in. Nothing is sent anywhere; write actions are simulated.
import { b64encodeText } from './util'

const now = Date.now()
const ago = (d) => new Date(now - d * 86400000).toISOString()
const owner = { login: 'demo-dev', avatar_url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="g"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect width="40" height="40" fill="url(#g)"/><text x="20" y="26" font-size="16" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700">D</text></svg>') }

const SAMPLE = [
  ['nebula-portfolio', 'Personal portfolio with 3D scenes and smooth scroll', 'TypeScript', 128, 14, 1, false, 'https://example.com', ['portfolio', 'threejs', 'react'], 'mit'],
  ['snack-toss', 'A tiny physics arcade game for the browser', 'JavaScript', 42, 6, 4, false, null, ['game', 'canvas'], 'mit', true],
  ['orbit-forge', 'Procedural planet generator with WebGL shaders', 'TypeScript', 311, 27, 9, false, 'https://example.org', ['webgl', 'shaders', 'generative'], 'apache-2.0'],
  ['astro-flow', 'Workflow automation dashboard', 'Python', 19, 2, 12, true, null, ['automation'], null],
  ['forge-studio', 'Design tool for crafting UI kits', 'TypeScript', 76, 8, 20, false, null, [], 'mit'],
  ['link-multiverse', 'All my links in one cosmic page', 'HTML', 9, 1, 33, false, null, ['links'], null, true],
  ['vedverse-api', 'REST API for the verse platform', 'Go', 54, 5, 3, true, null, ['api', 'go'], 'mit'],
  ['dotfiles', 'My terminal + editor setup', 'Shell', 4, 0, 120, false, null, [], null],
  ['ml-notebooks', 'Experiments with small language models', 'Jupyter Notebook', 23, 3, 60, false, null, ['ml'], 'mit'],
  ['old-blog', 'Archived Jekyll blog', 'CSS', 2, 0, 700, false, null, [], null],
  ['rust-raytracer', 'Weekend raytracer in Rust', 'Rust', 88, 9, 45, false, null, ['rust', 'graphics'], 'mit'],
  ['chat-widget', 'Embeddable support chat widget', 'Vue', 31, 4, 15, true, null, ['vue'], null],
]

export const demoRepos = SAMPLE.map(([name, description, language, stars, forks, days, priv, homepage, topics, lic, pages], i) => ({
  id: 1000 + i,
  name,
  full_name: `${owner.login}/${name}`,
  owner,
  private: priv,
  description,
  language,
  stargazers_count: stars,
  forks_count: forks,
  watchers_count: stars,
  subscribers_count: Math.round(stars / 6),
  open_issues_count: i % 4,
  pushed_at: ago(days),
  updated_at: ago(days),
  created_at: ago(days + 200 + i * 30),
  homepage,
  has_pages: !!pages,
  topics,
  license: lic ? { key: lic, name: lic.toUpperCase() + ' License' } : null,
  fork: name === 'dotfiles',
  archived: name === 'old-blog',
  size: 1200 + i * 800,
  default_branch: 'main',
  html_url: `https://github.com/${owner.login}/${name}`,
  clone_url: `https://github.com/${owner.login}/${name}.git`,
  has_issues: true,
  has_wiki: false,
  has_projects: true,
  permissions: { admin: true, push: true, pull: true },
}))

const README = (r) => `# ${r.name}\n\n${r.description}\n\n## Getting started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n> This is **demo data**. Sign in with GitHub to see your real repositories.\n`
const FILES = {
  'README.md': null,
  'package.json': '{\n  "name": "demo",\n  "version": "1.0.0",\n  "scripts": { "dev": "vite" }\n}\n',
  'index.html': '<!doctype html>\n<html>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.js"></script>\n  </body>\n</html>\n',
  'src/main.js': "import './style.css'\n\nconst app = document.querySelector('#app')\napp.innerHTML = `<h1>Hello from RepoVerse demo ✨</h1>`\n",
  'src/style.css': 'body {\n  font-family: system-ui;\n  background: #0b0b22;\n  color: white;\n}\n',
}

const demoError = () => Object.assign(new Error('Demo mode: sign in with GitHub to make real changes.'), { status: 403 })

export function createDemoClient() {
  const repoOf = (full) => demoRepos.find((r) => r.full_name === full) || demoRepos[0]
  const days = []
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const seed = Math.sin(i * 12.9898) * 43758.5453
    const r = seed - Math.floor(seed)
    days.push({ date: d.toISOString().slice(0, 10), contributionCount: r > 0.35 ? Math.floor(r * r * 14) : 0 })
  }
  const weeks = []
  for (let i = 0; i < days.length; i += 7) weeks.push({ contributionDays: days.slice(i, i + 7) })

  const api = {
    demo: true,
    me: async () => ({ ...owner, name: 'Demo Developer' }),
    repos: async () => demoRepos,
    repo: async (full) => repoOf(full),
    languages: async (full) => {
      const l = repoOf(full).language
      return l ? { [l]: 42000, CSS: 9000, HTML: 4000 } : {}
    },
    branches: async () => [{ name: 'main' }, { name: 'dev' }],
    tree: async () => ({ truncated: false, tree: [{ path: 'src', type: 'tree' }, ...Object.keys(FILES).map((p) => ({ path: p, type: 'blob' }))] }),
    file: async (full, path) => ({ sha: 'demo' + path, size: 300, content: b64encodeText(path === 'README.md' ? README(repoOf(full)) : FILES[path] || '') }),
    readme: async (full) => ({ path: 'README.md', sha: 'demo', content: b64encodeText(README(repoOf(full))) }),
    pages: async (full) => {
      if (!repoOf(full).has_pages) throw Object.assign(new Error('Not Found'), { status: 404 })
      return { html_url: `https://${owner.login}.github.io/${repoOf(full).name}/`, source: { branch: 'main', path: '/' }, status: 'built' }
    },
    releases: async () => [{ id: 1, tag_name: 'v1.2.0', name: 'Glass update', published_at: ago(3), html_url: '#' }, { id: 2, tag_name: 'v1.0.0', name: 'First release', published_at: ago(40), html_url: '#' }],
    issues: async () => [{ id: 1, number: 12, title: 'Add dark mode toggle', created_at: ago(2), html_url: '#' }],
    pulls: async () => [{ id: 1, number: 13, title: 'Improve mobile layout', user: { login: 'friend' }, html_url: '#' }],
    runs: async () => ({ workflow_runs: [{ id: 1, name: 'CI', head_branch: 'main', status: 'completed', conclusion: 'success', created_at: ago(1), html_url: '#' }, { id: 2, name: 'Deploy', head_branch: 'main', status: 'completed', conclusion: 'failure', created_at: ago(4), html_url: '#' }] }),
    views: async () => ({ count: 300, uniques: 80, views: Array.from({ length: 14 }, (_, i) => ({ count: 10 + Math.round(Math.abs(Math.sin(i)) * 30) })) }),
    clones: async () => ({ count: 12 }),
    graphql: async () => ({ user: { contributionsCollection: { contributionCalendar: { totalContributions: days.reduce((n, d) => n + d.contributionCount, 0), weeks } } } }),
    searchCode: async (q) => ({ total_count: 2, items: [{ sha: '1', path: 'src/main.js', repository: demoRepos[0] }, { sha: '2', path: 'src/app.ts', repository: demoRepos[2] }].map((x) => ({ ...x, q })) }),
    gists: async () => [],
    notifications: async () => [
      { id: '1', unread: true, reason: 'review_requested', updated_at: ago(0.1), subject: { title: 'Improve mobile layout', type: 'PullRequest', url: 'https://api.github.com/repos/demo-dev/nebula-portfolio/pulls/13' }, repository: { full_name: 'demo-dev/nebula-portfolio', html_url: '#' } },
      { id: '2', unread: true, reason: 'mention', updated_at: ago(0.6), subject: { title: 'Shader looks off on Safari', type: 'Issue', url: 'https://api.github.com/repos/demo-dev/orbit-forge/issues/7' }, repository: { full_name: 'demo-dev/orbit-forge', html_url: '#' } },
      { id: '3', unread: false, reason: 'subscribed', updated_at: ago(2), subject: { title: 'v1.2.0', type: 'Release', url: null }, repository: { full_name: 'demo-dev/snack-toss', html_url: '#' } },
    ],
    searchIssues: async () => ({ items: [] }),
    latestRelease: async () => ({ tag_name: 'v1.2.0', name: 'Glass update' }),
    compare: async () => ({ ahead_by: 4, behind_by: 1 }),
    commits: async () => [],
    deployments: async () => [],
    pagesBuild: async () => ({ status: 'built', updated_at: ago(1) }),
    dependabotAlerts: async () => [],
    secretAlerts: async () => [],
    get: async (p) => {
      if (p === '/licenses/mit') throw demoError()
      return {}
    },
  }
  // Any write operation (or anything not mocked) is refused politely.
  return new Proxy(api, { get: (t, k) => (k in t ? t[k] : async () => { throw demoError() }) })
}
