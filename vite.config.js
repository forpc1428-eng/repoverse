import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Strict Content Security Policy, injected only into the production build
// (the dev server needs inline scripts for hot reload).
function csp(env) {
  const worker = env.VITE_AUTH_WORKER_URL ? new URL(env.VITE_AUTH_WORKER_URL).origin : ''
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://api.github.com https: ${worker}`.trim(),
    'frame-src https:',
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://github.com",
  ].join('; ')
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${policy}">`),
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), csp(env)],
    build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  }
})
