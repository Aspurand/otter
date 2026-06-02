// Full-screen image viewer with a download button.
// Used by the Memories tab + ThrowbackCard.

import { useEffect, useState } from 'react'

export default function Lightbox({ src, alt = '', filename = 'memory', onClose }) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  // iOS-safe download: fetch as blob, save via an anchor with `download`.
  // This avoids iOS opening the image in a new tab and losing the user.
  async function download() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      const ext = (blob.type.split('/')[1] || 'jpg').split(';')[0]
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 5_000)
    } catch (e) {
      console.error('download failed', e)
      // Fallback: open the signed URL in a new tab so the user can long-press to save.
      window.open(src, '_blank', 'noopener')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-label="image viewer">
      <img className="lightbox-img" src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
      <div className="lightbox-actions" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-btn" type="button" onClick={download} disabled={busy}>
          {busy ? 'saving…' : '↓ download'}
        </button>
        <button className="lightbox-btn" type="button" onClick={onClose}>close</button>
      </div>
      <button className="lightbox-close" type="button" onClick={onClose} aria-label="close">×</button>
    </div>
  )
}
