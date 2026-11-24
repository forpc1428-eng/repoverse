import { useEffect, useState } from 'react'

const parse = () => {
  const parts = (window.location.hash.replace(/^#\/?/, '') || 'repos').split('/').map(decodeURIComponent)
  return { page: parts[0], params: parts.slice(1) }
}

export function useRoute() {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return route
}

export const go = (...parts) => {
  window.location.hash = '/' + parts.map((p) => p.split('/').map(encodeURIComponent).join('/')).join('/')
}
