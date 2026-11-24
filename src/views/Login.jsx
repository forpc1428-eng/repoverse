import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Github, ShieldCheck, Sparkles, Lock, MonitorSmartphone, Check } from 'lucide-react'
import { Glass, Spinner, spring } from '../components/ui'
import { getAuthConfig, startOAuth, useAuth } from '../lib/auth'

export default function Login() {
  const { error, setError, startDemo } = useAuth()
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(null) // null = checking, true/false

  useEffect(() => {
    getAuthConfig().then((c) => setReady(!!c.clientId))
  }, [])

  const signIn = async () => {
    setBusy(true)
    setError('')
    try {
      await startOAuth() // navigates to GitHub
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const features = [
    [Sparkles, 'Every repo in one place: view, edit, organize'],
    [MonitorSmartphone, 'Live preview wall of all your sites'],
    [ShieldCheck, 'Push folders with a built-in secret scanner'],
    [Lock, 'No database: your data stays in your browser'],
  ]

  return (
    <div className="login-wrap">
      <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring, delay: 0.1 }}>
        <Glass className="login-card glass-strong" liquid>
          <motion.div className="brand-mark" style={{ width: 64, height: 64, borderRadius: 20, margin: '0 auto' }} animate={{ rotate: [0, 8, -6, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
          <h1>
            Your GitHub,
            <br />
            <span className="grad-text">beautifully in control.</span>
          </h1>
          <p className="muted" style={{ margin: '0 0 26px' }}>
            A private, local-first control center for every repository you own.
          </p>

          <button className="btn primary big" style={{ width: '100%' }} onClick={signIn} disabled={busy || ready === false}>
            {busy || ready === null ? <Spinner size={18} /> : <Github size={20} />} Continue with GitHub
          </button>
          <p className="hint" style={{ margin: '12px 0 0' }}>
            {ready === false
              ? 'GitHub sign-in is not configured on this server yet.'
              : 'Approve once on GitHub. After that, signing in is instant.'}
          </p>

          {import.meta.env.DEV && (
            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={startDemo}>
              <Sparkles size={14} /> Demo (local development only)
            </button>
          )}

          {error && <div className="finding block" style={{ marginTop: 14, textAlign: 'left' }}>{error}</div>}

          <div className="divider" style={{ margin: '24px 0 18px' }} />
          <div className="col" style={{ gap: 10 }}>
            {features.map(([I, t], i) => (
              <motion.div key={t} className="login-feature" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }}>
                <I size={17} style={{ color: 'var(--c2)', flex: 'none' }} /> {t}
              </motion.div>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'center', gap: 6, marginTop: 18, fontSize: 12 }}>
            <Check size={13} color="#34d399" /> <span className="faint">Your token is encrypted and never leaves this browser except to talk to GitHub.</span>
          </div>
        </Glass>
      </motion.div>
    </div>
  )
}
