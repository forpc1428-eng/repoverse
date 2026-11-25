import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, GitPullRequest, CircleDot, Star, CheckCheck, Check, ExternalLink, Inbox as InboxIcon, RefreshCw, Tag, MessageSquare, AlertTriangle } from 'lucide-react'
import { Glass, Seg, Spinner, useToast } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { go } from '../lib/router'
import { starGains } from '../lib/growth'
import { timeAgo } from '../lib/util'

/** api.github.com/repos/o/r/pulls/12 → github.com/o/r/pull/12 */
const webUrl = (n) => {
  const u = n.subject?.url
  if (!u) return n.repository?.html_url
  return u.replace('https://api.github.com/repos/', 'https://github.com/').replace('/pulls/', '/pull/').replace('/commits/', '/commit/')
}
const typeIcon = { PullRequest: GitPullRequest, Issue: CircleDot, Release: Tag, Discussion: MessageSquare, CheckSuite: AlertTriangle }

export default function Inbox() {
  const { gh, user, repos, demo } = useAuth()
  const { settings: s } = useSettings()
  const { toast } = useToast()
  const [tab, setTab] = useState('all')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [seen, setSeen] = useState(null)

  const load = useCallback(async () => {
    setBusy(true)
    const q = (x) => gh.searchIssues(x).then((r) => r.items).catch(() => [])
    const [notifications, reviews, assigned, stars] = await Promise.all([
      s.fInboxNotifications !== false ? gh.notifications().catch((e) => (e.status === 403 ? 'scope' : [])) : [],
      s.fInboxReviews !== false ? q(`is:open is:pr review-requested:${user.login} archived:false`) : [],
      s.fInboxAssigned !== false ? q(`is:open assignee:${user.login} archived:false`) : [],
      s.fInboxStars !== false ? starGains(user.login, repos) : { gains: [] },
    ])
    setSeen(() => stars.markSeen)
    setData({ notifications, reviews, assigned, stars: stars.gains })
    setBusy(false)
  }, [gh, user.login, repos, s.fInboxNotifications, s.fInboxReviews, s.fInboxAssigned, s.fInboxStars])
  useEffect(() => {
    load()
  }, [load])

  const tabs = useMemo(() => {
    const t = [{ value: 'all', label: 'All' }]
    if (s.fInboxNotifications !== false) t.push({ value: 'notifications', label: 'Notifications' })
    if (s.fInboxReviews !== false) t.push({ value: 'reviews', label: 'Reviews' })
    if (s.fInboxAssigned !== false) t.push({ value: 'assigned', label: 'Assigned' })
    if (s.fInboxStars !== false) t.push({ value: 'stars', label: 'Stars' })
    return t
  }, [s.fInboxNotifications, s.fInboxReviews, s.fInboxAssigned, s.fInboxStars])

  if (!data) return <div className="empty"><Spinner size={24} /></div>
  const notes = Array.isArray(data.notifications) ? data.notifications : []
  const rows = []
  if (tab === 'all' || tab === 'notifications')
    notes.forEach((n) => rows.push({ key: 'n' + n.id, kind: 'notification', icon: typeIcon[n.subject.type] || Bell, title: n.subject.title, sub: `${n.repository.full_name} · ${n.reason.replace(/_/g, ' ')}`, time: n.updated_at, url: webUrl(n), unread: n.unread, id: n.id }))
  if (tab === 'all' || tab === 'reviews')
    data.reviews.forEach((i) => rows.push({ key: 'r' + i.id, kind: 'review', icon: GitPullRequest, title: i.title, sub: `Review requested · ${i.repository_url.split('/').slice(-2).join('/')} #${i.number}`, time: i.updated_at, url: i.html_url }))
  if (tab === 'all' || tab === 'assigned')
    data.assigned.forEach((i) => rows.push({ key: 'a' + i.id, kind: 'assigned', icon: i.pull_request ? GitPullRequest : CircleDot, title: i.title, sub: `Assigned to you · ${i.repository_url.split('/').slice(-2).join('/')} #${i.number}`, time: i.updated_at, url: i.html_url }))
  if (tab === 'all' || tab === 'stars')
    data.stars.forEach((g) => rows.push({ key: 's' + g.repo.id, kind: 'star', icon: Star, title: `+${g.gained} star${g.gained > 1 ? 's' : ''} on ${g.repo.name}`, sub: `Now ${g.repo.stargazers_count} stars`, time: new Date().toISOString(), repo: g.repo }))
  rows.sort((a, b) => new Date(b.time) - new Date(a.time))

  const markRead = async (r) => {
    try {
      await gh.markRead(r.id)
      setData((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === r.id ? { ...n, unread: false } : n)) }))
    } catch (e) {
      toast(e.message, 'error')
    }
  }
  const markAll = async () => {
    try {
      if (notes.length) await gh.markAllRead()
      seen?.()
      setData((d) => ({ ...d, notifications: notes.map((n) => ({ ...n, unread: false })), stars: [] }))
      toast('All caught up', 'success')
    } catch (e) {
      toast(e.message, 'error')
    }
  }
  const unread = notes.filter((n) => n.unread).length

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row wrap">
        <Seg id="inbox-tab" value={tab} onChange={setTab} options={tabs} />
        <div className="grow" />
        {unread > 0 && <span className="tag">{unread} unread</span>}
        <button className="btn sm" onClick={load} disabled={busy}>{busy ? <Spinner size={13} /> : <RefreshCw size={14} />} Refresh</button>
        <button className="btn sm" onClick={markAll} disabled={demo}><CheckCheck size={14} /> Mark all read</button>
      </div>
      {data.notifications === 'scope' && (
        <div className="finding warn"><AlertTriangle size={16} /> Sign in again (avatar → Add account → pick yourself) to allow notifications.</div>
      )}
      <Glass style={{ overflow: 'hidden' }}>
        {!rows.length ? (
          <div className="empty"><InboxIcon size={30} /><div style={{ marginTop: 6 }}>You're all caught up. 🌙</div></div>
        ) : (
          rows.map((r) => (
            <div key={r.key} className="list-row" style={{ opacity: r.kind === 'notification' && !r.unread ? 0.6 : 1 }} onClick={() => (r.repo ? go('repo', r.repo.owner.login, r.repo.name) : window.open(r.url, '_blank', 'noopener,noreferrer'))}>
              <r.icon size={17} style={{ color: r.kind === 'star' ? '#fbbf24' : r.unread ? 'var(--c3)' : 'var(--text-3)', flex: 'none' }} />
              <div className="grow">
                <div style={{ fontWeight: r.unread ? 650 : 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                <div className="faint" style={{ fontSize: 12.5 }}>{r.sub}</div>
              </div>
              <span className="faint" style={{ fontSize: 12, flex: 'none' }}>{timeAgo(r.time)}</span>
              {r.kind === 'notification' && r.unread && (
                <button className="btn ghost sm icon" title="Mark read" aria-label="Mark read" onClick={(e) => (e.stopPropagation(), markRead(r))}><Check size={15} /></button>
              )}
              {r.url && <ExternalLink size={14} className="faint" style={{ flex: 'none' }} />}
            </div>
          ))
        )}
      </Glass>
    </div>
  )
}
