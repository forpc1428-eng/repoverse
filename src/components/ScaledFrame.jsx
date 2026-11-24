import { useEffect, useRef, useState } from 'react'

/**
 * Renders a website at a real device width (e.g. 1440px) and scales it down to fit,
 * so previews look like true miniature screenshots. Only loads when visible.
 */
export default function ScaledFrame({ src, width = 1440, onLoad, eager = false }) {
  const ref = useRef(null)
  const [box, setBox] = useState(null)
  const [visible, setVisible] = useState(eager)
  useEffect(() => {
    const el = ref.current
    const ro = new ResizeObserver(([e]) => setBox(e.contentRect))
    ro.observe(el)
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '300px' })
    io.observe(el)
    return () => {
      ro.disconnect()
      io.disconnect()
    }
  }, [])
  const scale = box ? box.width / width : 0.3
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {visible && (
        <iframe
          src={src}
          title={src}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
          onLoad={onLoad}
          style={{ width, height: box ? box.height / scale : 900, transform: `translateX(-50%) scale(${scale})` }}
        />
      )}
    </div>
  )
}
