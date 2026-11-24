import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: false })

// Every link opens in a new tab without leaking the referrer
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
  if (node.tagName === 'IMG') node.setAttribute('referrerpolicy', 'no-referrer')
})

/** Render untrusted Markdown safely (sanitized with DOMPurify). */
export default function Markdown({ text, repo, branch }) {
  const html = useMemo(() => {
    const raw = marked.parse(text || '')
    const clean = DOMPurify.sanitize(raw, { FORBID_TAGS: ['style', 'form', 'input', 'iframe'], FORBID_ATTR: ['style'] })
    if (!repo) return clean
    // Resolve relative image paths against the repo
    const tpl = document.createElement('template')
    tpl.innerHTML = clean
    tpl.content.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || ''
      if (src && !/^(https?:|data:)/.test(src)) img.setAttribute('src', `https://raw.githubusercontent.com/${repo}/${branch || 'HEAD'}/${src.replace(/^\.?\//, '')}`)
    })
    return tpl.innerHTML
  }, [text, repo, branch])
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}
