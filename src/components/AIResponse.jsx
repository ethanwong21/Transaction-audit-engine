import React, { useEffect, useState, useRef } from 'react'

export default function AIResponse({ text, loading }) {
  const [displayed, setDisplayed] = useState('')
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!text) { setDisplayed(''); return }
    setDisplayed('')
    let i = 0
    intervalRef.current = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(intervalRef.current)
    }, 8)
    return () => clearInterval(intervalRef.current)
  }, [text])

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--accent-dim)',
        padding: '16px 20px',
        fontFamily: 'IBM Plex Mono',
        fontSize: 12,
        color: 'var(--accent)',
        marginTop: 16
      }}>
        <span className="analyzing">■ ANALYZING</span>
        <style>{`
          .analyzing::after {
            content: '...';
            animation: dots 1.2s steps(4, end) infinite;
          }
          @keyframes dots {
            0%, 20% { content: ''; }
            40% { content: '.'; }
            60% { content: '..'; }
            80%, 100% { content: '...'; }
          }
        `}</style>
      </div>
    )
  }

  if (!displayed) return null

  return (
    <div style={{
      background: 'var(--bg-base)',
      border: '1px solid var(--accent-dim)',
      padding: '16px 20px',
      marginTop: 16,
      borderLeft: '3px solid var(--accent)'
    }}>
      <div style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: 'var(--accent)', marginBottom: 8, letterSpacing: '0.1em' }}>
        ▶ AI ANALYSIS
      </div>
      <pre style={{
        fontFamily: 'IBM Plex Mono',
        fontSize: 12,
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: 1.7,
        margin: 0
      }}>
        {displayed}
      </pre>
    </div>
  )
}
