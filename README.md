# RepoVerse

**A private, local-first control center for all your GitHub repositories, with a liquid-glass interface.**

There is no server or database. Your browser talks directly to `api.github.com`, and everything RepoVerse stores (your token, cached repos, themes, tags) stays encrypted in your own browser.

## Features

| | |
|---|---|
| 🗂 **All repos** | Grid, list, kanban board and timeline views. Search, filters, sorting, pins, local tags, and code search across every repo |
| 🖥 **Preview Wall** | Live miniature previews of every site at once (desktop, tablet or mobile), full-screen view, and up/slow/down health checks |
| ✏️ **Edit everything** | In-browser code editor with syntax highlighting, file create/delete, and a commit to any branch |
| 📘 **README Studio** | Split editor with live preview, section templates and a badge builder |
| ⚙️ **Repo settings** | Rename, description, topics, website, default branch, features, visibility, archive, delete (typed confirmation), and one-click GitHub Pages |
| 🚀 **Activity** | Create releases and issues; view pull requests and Actions runs |
| 📁 **Push Folder** | Drag a folder in to create a repo and commit, with no git installed. Respects `.gitignore`, **blocks secrets** (API keys, `.env`, private keys), and can generate a README and license and enable Pages |
| 📊 **Insights** | Draggable widgets: totals, contribution heatmap, languages, top stars, health table, traffic |
| ✅ **Bulk actions** | Add/remove topics, local tags, make private/public, archive/unarchive many repos at once |
| 🎨 **Customize** | 8 themes plus custom colors; glass blur, transparency, glow and radius; aurora (WebGL), mesh, orbs, image or solid background; grain, fonts, density, motion, performance mode |
| ☁️ **Sync** | Export/import a file, or sync through a **private Gist in your own GitHub** (still no RepoVerse server) |
| ⌨️ **Command palette** | `Ctrl + K` to jump to any page or repo |
| 📱 **PWA** | Install it as an app on desktop or Android |

## Sign-in

There is one button: **Continue with GitHub**. The first time, GitHub asks you to approve RepoVerse (every permission is requested at once). After that, GitHub signs you straight in with no prompt, and RepoVerse remembers you in this browser.

## Deploy on Vercel (one-time setup)

1. **Import** this repository at <https://vercel.com/new> and deploy. Vercel serves the site and the two tiny sign-in functions in [`api/`](api).
2. **Create a GitHub OAuth App** at <https://github.com/settings/applications/new>:
   - Homepage URL: your Vercel URL, e.g. `https://repoverse.vercel.app`
   - Authorization callback URL: the same URL with a trailing slash, e.g. `https://repoverse.vercel.app/`
3. In Vercel go to **Project → Settings → Environment Variables** and add:
   - `GITHUB_CLIENT_SECRET`: generate one on the OAuth App page
   - (`GITHUB_CLIENT_ID` is optional: the public client ID is already in [`api/_client.js`](api/_client.js). Change it there if you use your own OAuth App.)
4. **Redeploy** (Deployments → ⋯ → Redeploy). Done: every future `git push` deploys automatically.

The client secret only ever lives in Vercel's environment settings, never in the code. The functions are stateless: they store and log nothing.

## Develop locally

```bash
npm install
npm run dev
```

Locally there is a **Demo** button with sample data. It's hidden in production. To test real sign-in locally, run `npx vercel dev` with the env vars set.

## Security model

- **No backend data.** The only server pieces are two stateless functions (`/api/config`, `/api/exchange`). They store nothing and only accept calls from the site itself.
- **Encrypted at rest.** The token, repo cache, tags and background image are encrypted with AES-256-GCM in IndexedDB. The key is a *non-extractable* WebCrypto key, so scripts can use it but can never export it.
- **Strict CSP** in production: scripts only from the site itself, no third-party scripts, no analytics.
- **Sanitized Markdown** via DOMPurify; previews run in sandboxed iframes; `no-referrer` everywhere.
- **Destructive actions** (delete, make public, archive) always ask first; deleting a repo requires typing its name.
- **Pre-push secret scanner** blocks real keys and secret files.

**Honest limits:** no website can promise it will never leak. The remaining risk is a bug in RepoVerse's own code that lets someone inject a script (XSS); the CSP, the sanitizing and having no third-party scripts are there to prevent that. Anyone with access to your unlocked computer and browser profile could use the app as you, the same as with any signed-in site. Use **Customize → Erase all data** on shared machines.

## Notes

- Some sites refuse to be shown inside other pages (`X-Frame-Options`). Switch the Preview Wall to **Snapshot** mode for those.
- Folder picking uses the File System Access API in Chrome and Edge; other browsers fall back to a folder upload input.
- Liquid refraction uses SVG backdrop filters, which only Chromium-based browsers support; others get regular frosted glass.
