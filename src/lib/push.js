// Push a local folder to GitHub straight from the browser using the Git Data API.
// No git install, no desktop app, no server in between.
import { makeIgnore, scanFile } from './secrets'
import { b64encodeBytes, looksBinary, pool } from './util'

const MAX_FILE = 100 * 1024 * 1024
const TEXT_SCAN_LIMIT = 2 * 1024 * 1024

/** Read a folder chosen with showDirectoryPicker(). */
export async function readDirectoryHandle(dir) {
  const files = []
  async function walk(handle, prefix) {
    for await (const [name, h] of handle.entries()) {
      const path = prefix ? `${prefix}/${name}` : name
      if (h.kind === 'directory') {
        if (name === 'node_modules' || name === '.git') continue
        await walk(h, path)
      } else files.push({ path, getFile: () => h.getFile() })
    }
  }
  await walk(dir, '')
  return { name: dir.name, files }
}

/** Read files from <input webkitdirectory>. */
export function readFileList(list) {
  const arr = Array.from(list)
  const root = arr[0]?.webkitRelativePath.split('/')[0] || 'project'
  return {
    name: root,
    files: arr.map((f) => ({ path: f.webkitRelativePath.split('/').slice(1).join('/'), getFile: async () => f })),
  }
}

/** Read a dropped folder (DataTransferItem.webkitGetAsEntry). */
export async function readDroppedEntry(entry) {
  const files = []
  const readAll = (reader) =>
    new Promise((res, rej) => {
      const out = []
      const next = () => reader.readEntries((batch) => (batch.length ? (out.push(...batch), next()) : res(out)), rej)
      next()
    })
  async function walk(e, prefix) {
    if (e.isFile) {
      files.push({ path: prefix + e.name, getFile: () => new Promise((r, j) => e.file(r, j)) })
    } else if (e.isDirectory) {
      if (e.name === 'node_modules' || e.name === '.git') return
      const children = await readAll(e.createReader())
      for (const c of children) await walk(c, prefix + e.name + '/')
    }
  }
  if (entry.isDirectory) {
    const children = await readAll(entry.createReader())
    for (const c of children) await walk(c, '')
  } else await walk(entry, '')
  return { name: entry.name, files }
}

/** Load file contents, apply .gitignore, scan for secrets. */
export async function analyze(folder) {
  const gi = folder.files.find((f) => f.path === '.gitignore')
  const ignore = makeIgnore(gi ? await (await gi.getFile()).text() : '')
  const kept = []
  const skipped = []
  const findings = []
  let total = 0
  for (const f of folder.files) {
    if (ignore(f.path)) {
      skipped.push(f.path)
      continue
    }
    const file = await f.getFile()
    if (file.size > MAX_FILE) {
      findings.push({ level: 'block', path: f.path, kind: `File larger than 100 MB (GitHub limit)`, line: 0 })
      continue
    }
    if (file.size > 50 * 1024 * 1024) findings.push({ level: 'warn', path: f.path, kind: 'Large file (over 50 MB)', line: 0 })
    const bytes = new Uint8Array(await file.arrayBuffer())
    const binary = looksBinary(bytes)
    const text = !binary && bytes.length <= TEXT_SCAN_LIMIT ? new TextDecoder().decode(bytes) : null
    findings.push(...scanFile(f.path, text))
    kept.push({ path: f.path, bytes, binary, text })
    total += bytes.length
  }
  return { name: folder.name, files: kept, skipped, findings, total, stack: detectStack(kept) }
}

export function detectStack(files) {
  const has = (p) => files.some((f) => f.path === p)
  const pkgFile = files.find((f) => f.path === 'package.json')
  let pkg = null
  try {
    pkg = pkgFile?.text ? JSON.parse(pkgFile.text) : null
  } catch {}
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
  const tech = []
  if (deps.next) tech.push('Next.js')
  if (deps.react) tech.push('React')
  if (deps.vue) tech.push('Vue')
  if (deps.svelte) tech.push('Svelte')
  if (deps.vite) tech.push('Vite')
  if (deps.tailwindcss) tech.push('Tailwind CSS')
  if (deps.typescript || files.some((f) => f.path.endsWith('.ts') || f.path.endsWith('.tsx'))) tech.push('TypeScript')
  if (deps.three) tech.push('Three.js')
  if (deps.express) tech.push('Express')
  if (has('requirements.txt') || has('pyproject.toml')) tech.push('Python')
  if (has('pubspec.yaml')) tech.push('Flutter')
  if (has('Cargo.toml')) tech.push('Rust')
  if (has('go.mod')) tech.push('Go')
  if (!tech.length && files.some((f) => f.path.endsWith('.html'))) tech.push('HTML', 'CSS', 'JavaScript')
  const staticSite = has('index.html') && !deps.next
  return { pkg, tech, staticSite, scripts: pkg?.scripts || {}, hasReadme: files.some((f) => /^readme(\.md)?$/i.test(f.path)), hasLicense: files.some((f) => /^licen[cs]e/i.test(f.path)) }
}

export function generateReadme({ name, description, stack, owner, files, license }) {
  const title = name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const badges = stack.tech
    .map((t) => `![${t}](https://img.shields.io/badge/-${encodeURIComponent(t.replace(/-/g, '--'))}-111?style=for-the-badge)`)
    .join(' ')
  const s = stack.scripts
  const install = stack.pkg
    ? ['```bash', `git clone https://github.com/${owner}/${name}.git`, `cd ${name}`, 'npm install', s.dev ? 'npm run dev' : s.start ? 'npm start' : '', '```'].filter(Boolean).join('\n')
    : stack.tech.includes('Python')
      ? ['```bash', `git clone https://github.com/${owner}/${name}.git`, `cd ${name}`, 'pip install -r requirements.txt', '```'].join('\n')
      : stack.staticSite
        ? `Open \`index.html\` in your browser, or visit the live site.`
        : ['```bash', `git clone https://github.com/${owner}/${name}.git`, '```'].join('\n')
  const top = [...new Set(files.map((f) => f.path.split('/')[0]))].slice(0, 14)
  const tree = top.map((p) => `├── ${p}${files.some((f) => f.path.startsWith(p + '/')) ? '/' : ''}`).join('\n')
  const scripts = Object.keys(s).length ? `\n## Scripts\n\n| Command | Description |\n|---|---|\n${Object.entries(s).slice(0, 8).map(([k, v]) => `| \`npm run ${k}\` | \`${v.replace(/\|/g, '\\|')}\` |`).join('\n')}\n` : ''
  return `# ${title}

${description || `A ${stack.tech[0] || ''} project.`.replace('  ', ' ')}

${badges}
${stack.staticSite ? `\n🌐 **Live demo:** https://${owner.toLowerCase()}.github.io/${name}/\n` : ''}
## Getting started

${install}
${scripts}
## Project structure

\`\`\`
${name}/
${tree}
\`\`\`

## Tech stack

${stack.tech.map((t) => `- ${t}`).join('\n') || '- (add your stack here)'}
${license ? `\n## License\n\nReleased under the ${license.toUpperCase()} license.\n` : ''}
---

<sub>Shipped with RepoVerse ✨</sub>
`
}

/**
 * Commit files on top of a branch in one commit.
 * onProgress(doneCount, total, label)
 */
export async function commitFiles(gh, full, branch, files, message, onProgress = () => {}) {
  onProgress(0, files.length, 'Reading branch…')
  const ref = await gh.get(`/repos/${full}/git/ref/heads/${encodeURIComponent(branch)}`)
  const baseCommit = await gh.get(`/repos/${full}/git/commits/${ref.object.sha}`)
  let done = 0
  const tree = await pool(files, 6, async (f) => {
    const blob = await gh.post(`/repos/${full}/git/blobs`, { content: b64encodeBytes(f.bytes), encoding: 'base64' })
    done++
    onProgress(done, files.length, `Uploading ${f.path}`)
    return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha }
  })
  onProgress(done, files.length, 'Creating commit…')
  const newTree = await gh.post(`/repos/${full}/git/trees`, { base_tree: baseCommit.tree.sha, tree })
  const commit = await gh.post(`/repos/${full}/git/commits`, { message, tree: newTree.sha, parents: [ref.object.sha] })
  await gh.patch(`/repos/${full}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: commit.sha })
  onProgress(files.length, files.length, 'Done')
  return commit
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Wait until a freshly created repo's default branch exists. */
export async function waitForBranch(gh, full, branch, tries = 10) {
  for (let i = 0; i < tries; i++) {
    try {
      return await gh.get(`/repos/${full}/git/ref/heads/${encodeURIComponent(branch)}`)
    } catch {
      await sleep(700 + i * 300)
    }
  }
  throw new Error('GitHub is taking too long to create the repository. Try again in a moment.')
}
