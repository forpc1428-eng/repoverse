// Free, private "auto" details for a repository.
// Everything is worked out in the browser from the repo's own README, package.json and
// language stats — no AI service, no cost, nothing sent anywhere except GitHub's API.
import { b64decodeText, siteUrl } from './util'

const TEMPLATE_TEXT = [
  /this template provides a minimal setup/i,
  /getting started with create react app/i,
  /bootstrapped with create/i,
  /this project was generated with/i,
  /^#?\s*react \+ (vite|typescript)/i,
  /currently,? two official plugins are available/i,
  /welcome to your new/i,
]

/** First real sentence(s) of a README, cleaned of markdown, badges and HTML. */
export function descriptionFromReadme(md, repoName = '') {
  if (!md) return ''
  const text = md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, ' ')
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  for (let p of paras) {
    if (/^(#|\||>|-{3,}|\*{3,}|!\[|\[!\[)/.test(p)) continue // headings, tables, quotes, rules, images, badges
    if (/^(\s*[-*+]|\s*\d+\.)\s/.test(p)) continue // lists
    p = p
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (p.length < 25 || !/[a-z]{3}/i.test(p)) continue
    if (TEMPLATE_TEXT.some((r) => r.test(p))) continue
    if (p.toLowerCase().replace(/[^a-z0-9]/g, '') === repoName.toLowerCase().replace(/[^a-z0-9]/g, '')) continue
    return trimSentence(p, 150)
  }
  return ''
}

function trimSentence(s, max) {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  if (end > 60) return cut.slice(0, end + 1)
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\-–—]$/, '') + '…'
}

const DEP_TOPICS = {
  react: 'react', 'react-dom': 'react', next: 'nextjs', vue: 'vue', nuxt: 'nuxt', svelte: 'svelte', '@sveltejs/kit': 'sveltekit', astro: 'astro', angular: 'angular', '@angular/core': 'angular',
  vite: 'vite', three: 'threejs', '@react-three/fiber': 'react-three-fiber', tailwindcss: 'tailwindcss', 'framer-motion': 'animation', gsap: 'animation', express: 'express', fastify: 'fastify',
  electron: 'electron', 'react-native': 'react-native', expo: 'expo', firebase: 'firebase', '@supabase/supabase-js': 'supabase', mongoose: 'mongodb', prisma: 'prisma', 'socket.io': 'websocket',
  typescript: 'typescript', 'discord.js': 'discord-bot', phaser: 'game', 'pixi.js': 'webgl', 'chart.js': 'charts', d3: 'data-visualization', '@anthropic-ai/sdk': 'ai', openai: 'ai',
}
const NAME_WORDS = ['portfolio', 'game', 'api', 'dashboard', 'bot', 'cli', 'blog', 'website', 'app', 'ai', 'chat', 'landing', 'docs', 'website', 'shop', 'store', 'tool', 'extension', 'plugin', 'theme', 'template']
const LANG_TOPIC = { 'C#': 'csharp', 'C++': 'cpp', 'Jupyter Notebook': 'jupyter-notebook', 'Objective-C': 'objective-c', Shell: 'shell', HTML: 'html', CSS: 'css' }

export function autoTopics(repo, langs = {}, pkg = null) {
  const out = new Set()
  Object.keys(langs).sort((a, b) => langs[b] - langs[a]).slice(0, 3).forEach((l) => out.add(LANG_TOPIC[l] || l.toLowerCase()))
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
  Object.keys(deps).forEach((d) => DEP_TOPICS[d] && out.add(DEP_TOPICS[d]))
  const words = repo.name.toLowerCase().split(/[-_.\s]+/)
  NAME_WORDS.forEach((w) => words.includes(w) && out.add(w === 'website' ? 'website' : w))
  if (siteUrl(repo)) out.add('website')
  ;(pkg?.keywords || []).slice(0, 4).forEach((k) => out.add(String(k).toLowerCase().replace(/\s+/g, '-')))
  return [...out].map((t) => t.replace(/[^a-z0-9-]/g, '').replace(/^-+/, '')).filter((t) => /^[a-z0-9][a-z0-9-]{0,49}$/.test(t)).slice(0, 8)
}

function kindOf(repo, deps, pkg) {
  const n = repo.name.toLowerCase()
  if (deps.three || deps['@react-three/fiber']) return '3D web experience'
  if (/game|toss|play|arcade/.test(n) || deps.phaser) return 'browser game'
  if (/portfolio/.test(n)) return 'portfolio website'
  if (/dashboard/.test(n)) return 'dashboard'
  if (/bot/.test(n) || deps['discord.js']) return 'bot'
  if (pkg?.bin) return 'command-line tool'
  if (deps.express || deps.fastify || /api|server|backend/.test(n)) return 'API server'
  if (deps.electron) return 'desktop app'
  if (deps['react-native'] || deps.expo) return 'mobile app'
  if (siteUrl(repo) || deps.react || deps.vue || deps.svelte || deps.next) return 'web app'
  if (/dotfiles/.test(n)) return 'set of dotfiles'
  return 'project'
}

/** Build a description from the stack when the README has nothing usable. */
export function synthDescription(repo, langs = {}, pkg = null) {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
  const lang = Object.keys(langs).sort((a, b) => langs[b] - langs[a])[0] || repo.language
  const stack = ['next', 'react', 'vue', 'svelte', 'three', 'vite', 'tailwindcss', 'express', 'electron']
    .filter((d) => deps[d])
    .map((d) => ({ next: 'Next.js', react: 'React', vue: 'Vue', svelte: 'Svelte', three: 'Three.js', vite: 'Vite', tailwindcss: 'Tailwind CSS', express: 'Express', electron: 'Electron' })[d])
    .slice(0, 3)
  const kind = kindOf(repo, deps, pkg)
  const a = /^[aeiou]/i.test(lang || kind) ? 'An' : 'A'
  const base = `${a} ${lang ? lang + ' ' : ''}${kind}`
  return stack.length ? `${base} built with ${stack.join(stack.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1')}.` : `${base}.`
}

/**
 * Work out a description, topics and website for a repo.
 * Returns suggestions only — nothing is saved here.
 */
export async function autoDetails(gh, repo) {
  const full = repo.full_name
  const [readme, pkgFile, langs] = await Promise.all([
    gh.readme(full).then((r) => b64decodeText(r.content)).catch(() => ''),
    gh.file(full, 'package.json', repo.default_branch).then((f) => b64decodeText(f.content)).catch(() => ''),
    gh.languages(full).catch(() => ({})),
  ])
  let pkg = null
  try {
    pkg = pkgFile ? JSON.parse(pkgFile) : null
  } catch {}
  const fromPkg = pkg?.description && pkg.description.length > 10 ? pkg.description : ''
  const description = fromPkg || descriptionFromReadme(readme, repo.name) || synthDescription(repo, langs, pkg)
  const topics = autoTopics(repo, langs, pkg)
  const homepage = repo.homepage || siteUrl(repo) || (pkg?.homepage && /^https?:\/\//.test(pkg.homepage) ? pkg.homepage : '')
  return { description: trimSentence(description, 300), topics, homepage }
}
