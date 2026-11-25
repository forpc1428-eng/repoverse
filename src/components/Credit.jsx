import { useSettings } from '../lib/settings'

/** Small, quiet signature. Noticeable on hover, never in the way. (Customize → Features → App) */
export default function Credit({ inline = false }) {
  const { settings } = useSettings()
  if (settings.fCredit === false) return null
  return (
    <a className={`credit ${inline ? 'inline' : ''}`} href="https://github.com/forpc1428-eng/repoverse" target="_blank" rel="noopener noreferrer" title="RepoVerse on GitHub">
      <span className="credit-moon" aria-hidden="true" />
      made by <b>Vedant</b> <span className="credit-sep">·</span> vibing
    </a>
  )
}
