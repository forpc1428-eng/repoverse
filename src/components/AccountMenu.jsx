import { useState } from 'react'
import { Check, LogOut, Plus, Users, Trash2 } from 'lucide-react'
import { Modal, Spinner, useToast } from './ui'
import { useAuth } from '../lib/auth'

/** Account sheet: switch accounts, add another, sign out of one or all. */
export default function AccountMenu({ open, onClose }) {
  const { user, accounts, switchAccount, addAccount, signOut, signOutAll, demo } = useAuth()
  const { toast, confirm } = useToast()
  const [busy, setBusy] = useState('')

  const run = async (key, fn) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="row" style={{ gap: 10 }}><Users size={20} /> Accounts</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
        Stay signed in to several GitHub accounts and switch in one tap. Each account's login is encrypted on this device.
      </p>

      <div className="col" style={{ gap: 8, margin: '14px 0' }}>
        {(demo ? [{ ...user, token: 'demo' }] : accounts).map((a) => {
          const active = a.login === user?.login
          return (
            <div key={a.login} className="row" style={{ padding: 10, borderRadius: 16, border: `1px solid ${active ? 'var(--line-2)' : 'var(--line)'}`, background: active ? 'rgba(255,255,255,.07)' : 'transparent' }}>
              <img className="avatar" src={a.avatar_url} alt="" style={{ width: 40, height: 40 }} />
              <div className="grow">
                <div style={{ fontWeight: 620 }}>{a.name || a.login}</div>
                <div className="faint" style={{ fontSize: 12.5 }}>@{a.login}</div>
              </div>
              {active ? (
                <span className="tag" style={{ color: '#6ee7b7' }}><Check size={12} /> Active</span>
              ) : (
                <button className="btn sm primary" disabled={!!busy} onClick={() => run(a.login, async () => (await switchAccount(a.login), onClose()))}>
                  {busy === a.login ? <Spinner size={13} /> : 'Switch'}
                </button>
              )}
              {!demo && (
                <button
                  className="btn ghost sm icon"
                  title={`Sign out @${a.login}`}
                  aria-label={`Sign out ${a.login}`}
                  onClick={async () => {
                    if (await confirm({ title: `Sign out @${a.login}?`, body: 'This account is removed from this device. Your other accounts stay signed in.', okLabel: 'Sign out', danger: true }))
                      run('out-' + a.login, () => signOut(a.login))
                  }}
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {!demo && (
        <button className="btn primary" style={{ width: '100%', height: 46 }} disabled={!!busy} onClick={() => run('add', addAccount)}>
          {busy === 'add' ? <Spinner /> : <Plus size={17} />} Add another account
        </button>
      )}
      <p className="hint" style={{ margin: '10px 2px 16px' }}>
        GitHub will show its account picker. To add a different account, choose it there (or sign in to it on github.com first).
      </p>

      <div className="divider" />
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        {demo ? (
          <button className="btn" onClick={() => signOut()}><LogOut size={15} /> Leave demo</button>
        ) : (
          <button
            className="btn danger sm"
            onClick={async () => {
              if (await confirm({ title: 'Sign out of all accounts?', body: 'Removes every account, cached repos, tags and pins and the encryption key from this device. Your theme is kept.', okLabel: 'Sign out all', danger: true }))
                signOutAll()
            }}
          >
            <Trash2 size={14} /> Sign out of all accounts
          </button>
        )}
        <button className="btn" onClick={onClose}>Done</button>
      </div>
    </Modal>
  )
}
