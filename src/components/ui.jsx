import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

export const spring = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 }

/** Kept for compatibility: the pointer-tracking light was removed for performance. */
export function useSpecularLight() {}

// eslint-disable-next-line no-unused-vars
export function Glass({ as: Tag = 'div', className = '', lit, liquid, children, ...rest }) {
  return (
    <Tag className={`glass ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

/** A card that lifts on hover (pure CSS, no per-frame JavaScript). */
export function TiltCard({ className = '', children, onClick, style, ...rest }) {
  return (
    <div className={`card ${className}`} style={style} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick?.(e)} {...rest}>
      {children}
    </div>
  )
}

export function Switch({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

export function Seg({ value, onChange, options, id }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)} title={o.title || o.label} role="tab" aria-selected={value === o.value}>
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={spring} />}
          {o.icon}
          {o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  )
}

export function Tabs({ value, onChange, tabs, id = 'tabs' }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} className={value === t.value ? 'on' : ''} onClick={() => onChange(t.value)} role="tab" aria-selected={value === t.value}>
          {value === t.value && <motion.span layoutId={id} className="tab-pill" transition={spring} />}
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, children, className = '', size = '' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
          <motion.div
            className={`glass glass-strong modal ${size} ${className}`}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={spring}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ---------- Toasts & confirm ----------
const ToastCtx = createContext(null)
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const [typed, setTyped] = useState('')
  const toast = useCallback((msg, type = 'info') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'error' ? 7000 : 4000)
  }, [])
  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setTyped('')
        setConfirmState({ ...opts, resolve })
      }),
    []
  )
  const close = (v) => {
    confirmState?.resolve(v)
    setConfirmState(null)
  }
  const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info }
  return (
    <ToastCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const I = Icon[t.type] || Info
            return (
              <motion.div key={t.id} layout className={`glass glass-strong toast ${t.type}`} initial={{ opacity: 0, x: 40, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40, scale: 0.95 }} transition={spring}>
                <I size={18} style={{ flex: 'none', marginTop: 1, color: t.type === 'error' ? '#f87171' : t.type === 'success' ? '#34d399' : 'var(--c2)' }} />
                <div className="grow">{t.msg}</div>
                <button className="btn ghost sm icon" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss">
                  <X size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      <Modal open={!!confirmState} onClose={() => close(false)}>
        {confirmState && (
          <>
            <h2>{confirmState.title}</h2>
            <p className="muted" style={{ whiteSpace: 'pre-line' }}>{confirmState.body}</p>
            {confirmState.typeToConfirm && (
              <div className="field">
                <label className="label">
                  Type <b className="mono">{confirmState.typeToConfirm}</b> to confirm
                </label>
                <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
              </div>
            )}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn" onClick={() => close(false)}>Cancel</button>
              <button
                className={`btn ${confirmState.danger ? 'danger' : 'primary'}`}
                disabled={confirmState.typeToConfirm && typed !== confirmState.typeToConfirm}
                onClick={() => close(true)}
                autoFocus={!confirmState.typeToConfirm}
              >
                {confirmState.okLabel || 'Confirm'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

export function Spinner({ size = 16 }) {
  return (
    <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Ring({ value, color }) {
  return (
    <div className="ring" style={{ '--p': value, '--ring-color': color }} title={`Health ${value}%`}>
      <span>{value}</span>
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <div className="hint" style={{ marginTop: 5 }}>{hint}</div>}
    </div>
  )
}

/** Animate a number counting up. */
export function Counter({ value }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf
    const start = performance.now()
    const from = 0
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 900)
      setN(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{n.toLocaleString()}</>
}

export const pageMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transitionEnd: { transform: 'none' } },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
}
