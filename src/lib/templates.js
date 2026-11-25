// Project templates, a one-page portfolio generator and a profile README builder.
// Everything here only produces file contents; pushing happens through the Git Data API.
import { siteUrl } from './util'

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const enc = (text) => new TextEncoder().encode(text)
const files = (obj) => Object.entries(obj).map(([path, text]) => ({ path, bytes: enc(text) }))

const GITIGNORE_NODE = 'node_modules\ndist\n.env\n.env.*\n!.env.example\n.DS_Store\n'

export const TEMPLATES = [
  { id: 'vite-react', name: 'React + Vite', note: 'Modern web app starter', pages: false },
  { id: 'landing', name: 'Landing page', note: 'Pure HTML/CSS, ready for Pages', pages: true },
  { id: 'node-api', name: 'Node API', note: 'Tiny HTTP JSON server', pages: false },
  { id: 'python', name: 'Python script', note: 'main.py + requirements', pages: false },
  { id: 'empty', name: 'Empty', note: 'README + .gitignore', pages: false },
]

export function templateFiles(id, { name, description = '' }) {
  const title = name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const readme = (extra = '') => `# ${title}\n\n${description || 'Created with RepoVerse.'}\n${extra}`
  switch (id) {
    case 'vite-react':
      return files({
        'README.md': readme('\n## Run\n\n```bash\nnpm install\nnpm run dev\n```\n'),
        '.gitignore': GITIGNORE_NODE,
        'package.json': JSON.stringify({ name, private: true, version: '0.1.0', type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' }, devDependencies: { '@vitejs/plugin-react': '^4.3.3', vite: '^5.4.10' } }, null, 2) + '\n',
        'vite.config.js': "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({ plugins: [react()] })\n",
        'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${esc(title)}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`,
        'src/main.jsx': "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(<App />)\n",
        'src/App.jsx': `export default function App() {\n  return (\n    <main>\n      <h1>${esc(title)}</h1>\n      <p>Edit <code>src/App.jsx</code> to get started.</p>\n    </main>\n  )\n}\n`,
        'src/index.css': 'body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; background: #05060c; color: #f2f2f7; }\ncode { background: #ffffff14; padding: 2px 6px; border-radius: 6px; }\n',
      })
    case 'landing':
      return files({
        'README.md': readme(`\nLive at GitHub Pages once enabled.\n`),
        'index.html': `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>${esc(title)}</title>\n  <link rel="stylesheet" href="style.css" />\n</head>\n<body>\n  <main>\n    <h1>${esc(title)}</h1>\n    <p>${esc(description || 'Something beautiful is coming.')}</p>\n    <a class="btn" href="#">Get started</a>\n  </main>\n</body>\n</html>\n`,
        'style.css': `body {\n  margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; color: #f4f4fb;\n  background: radial-gradient(60% 50% at 75% 20%, #1c2240 0%, transparent 70%), #04050a;\n}\nmain { text-align: center; padding: 24px; }\nh1 { font-size: clamp(2.4rem, 6vw, 4.5rem); letter-spacing: -0.04em; margin: 0 0 12px; }\np { color: #c9c9d8; max-width: 520px; margin: 0 auto 28px; }\n.btn { display: inline-block; padding: 12px 22px; border-radius: 14px; color: #fff; text-decoration: none; background: linear-gradient(120deg, #f2a7c3, #8fb3ff); }\n`,
      })
    case 'node-api':
      return files({
        'README.md': readme('\n## Run\n\n```bash\nnode index.js\n# → http://localhost:3000\n```\n'),
        '.gitignore': GITIGNORE_NODE,
        'package.json': JSON.stringify({ name, version: '0.1.0', type: 'module', scripts: { start: 'node index.js' } }, null, 2) + '\n',
        'index.js': "import { createServer } from 'node:http'\n\nconst server = createServer((req, res) => {\n  res.setHeader('Content-Type', 'application/json')\n  res.end(JSON.stringify({ ok: true, path: req.url, time: new Date().toISOString() }))\n})\n\nserver.listen(3000, () => console.log('Listening on http://localhost:3000'))\n",
      })
    case 'python':
      return files({
        'README.md': readme('\n## Run\n\n```bash\npip install -r requirements.txt\npython main.py\n```\n'),
        '.gitignore': '__pycache__/\n.venv/\nvenv/\n.env\n',
        'requirements.txt': '\n',
        'main.py': 'def main() -> None:\n    print("Hello from ' + name.replace('"', '') + '!")\n\n\nif __name__ == "__main__":\n    main()\n',
      })
    default:
      return files({ 'README.md': readme(), '.gitignore': '.DS_Store\n.env\n' })
  }
}

// ------------------------------------------------------------------ portfolio site
export function portfolioHtml({ user, title, tagline, repos, accent = '#f2a7c3', accent2 = '#8fb3ff' }) {
  const cards = repos
    .map((r) => {
      const site = siteUrl(r)
      return `      <article class="card">
        <h3>${esc(r.name)}</h3>
        <p>${esc(r.description || '')}</p>
        <div class="meta">${r.language ? `<span>${esc(r.language)}</span>` : ''}<span>★ ${r.stargazers_count}</span></div>
        <div class="links"><a href="${esc(r.html_url)}">Code</a>${site ? `<a href="${esc(site)}">Live ↗</a>` : ''}</div>
      </article>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(tagline)}" />
  <style>
    :root { --a: ${esc(accent)}; --b: ${esc(accent2)}; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; color: #f3f3f8; background: #03040a; min-height: 100vh; }
    body::before { content: ''; position: fixed; inset: 0; z-index: -1;
      background: radial-gradient(1px 1px at 20% 30%, #fff8, transparent), radial-gradient(1px 1px at 70% 60%, #fff6, transparent), radial-gradient(1.5px 1.5px at 40% 80%, #fff7, transparent),
        radial-gradient(1px 1px at 85% 20%, #fff9, transparent), radial-gradient(1px 1px at 10% 70%, #fff5, transparent), radial-gradient(50% 40% at 80% 10%, #1a1f3a, transparent 70%), #03040a;
      background-size: 300px 300px, 400px 400px, 500px 500px, 350px 350px, 450px 450px, 100% 100%, 100% 100%; }
    .moon { position: fixed; right: 8vw; top: 8vh; width: 110px; height: 110px; border-radius: 50%; z-index: -1;
      background: radial-gradient(circle at 38% 35%, #fff, #d9d4ca 55%, #8a857c); box-shadow: 0 0 60px #fff3; }
    header { max-width: 980px; margin: 0 auto; padding: 14vh 24px 40px; }
    h1 { font-size: clamp(2.4rem, 6vw, 4rem); letter-spacing: -0.045em; margin: 0 0 10px; }
    h1 span { background: linear-gradient(120deg, var(--a), var(--b)); -webkit-background-clip: text; background-clip: text; color: transparent; }
    header p { color: #c4c4d4; font-size: 1.1rem; max-width: 560px; margin: 0; }
    main { max-width: 980px; margin: 0 auto; padding: 0 24px 80px; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .card { padding: 20px; border-radius: 18px; background: linear-gradient(180deg, #ffffff12, #ffffff06); border: 1px solid #ffffff1c; display: flex; flex-direction: column; gap: 10px; transition: transform .3s; }
    .card:hover { transform: translateY(-4px); }
    .card h3 { margin: 0; font-size: 1.1rem; }
    .card p { margin: 0; color: #b9b9ca; font-size: .93rem; flex: 1; }
    .meta { display: flex; gap: 12px; color: #9a9aae; font-size: .85rem; }
    .links { display: flex; gap: 14px; }
    .links a { color: var(--b); text-decoration: none; font-weight: 600; font-size: .9rem; }
    footer { text-align: center; color: #77778a; font-size: .8rem; padding: 0 0 40px; }
    footer a { color: inherit; }
  </style>
</head>
<body>
  <div class="moon" aria-hidden="true"></div>
  <header>
    <h1>${esc(title.split(' ').slice(0, -1).join(' '))} <span>${esc(title.split(' ').slice(-1)[0])}</span></h1>
    <p>${esc(tagline)}</p>
  </header>
  <main>
${cards}
  </main>
  <footer>© ${new Date().getFullYear()} <a href="https://github.com/${esc(user.login)}">@${esc(user.login)}</a> · built with RepoVerse</footer>
</body>
</html>
`
}

// ------------------------------------------------------------------ profile README
export function profileReadme({ user, about, repos, stats = true, topLangs = [] }) {
  const name = user.name || user.login
  const rows = repos.map((r) => `| [**${r.name}**](${r.html_url}) | ${(r.description || '').replace(/\|/g, '\\|')} | ${r.language || ''} | ⭐ ${r.stargazers_count} |`).join('\n')
  const badges = topLangs.map((l) => `![${l}](https://img.shields.io/badge/-${encodeURIComponent(l.replace(/-/g, '--'))}-111?style=flat-square)`).join(' ')
  return `# Hi, I'm ${name} 👋

${about || 'I build things for the web.'}

${badges}

## 🌙 Featured projects

| Project | About | Language | Stars |
|---|---|---|---|
${rows}
${stats ? `\n## 📊 Stats\n\n![GitHub stats](https://github-readme-stats.vercel.app/api?username=${encodeURIComponent(user.login)}&show_icons=true&theme=midnight-purple&hide_border=true)\n` : ''}
<sub>Made with RepoVerse</sub>
`
}
