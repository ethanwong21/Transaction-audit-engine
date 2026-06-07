import React from 'react'

function getTierColor(tier) {
  switch (tier) {
    case 'Critical': return 'var(--critical)'
    case 'High': return 'var(--high)'
    case 'Medium': return 'var(--medium)'
    case 'Low': return 'var(--low)'
    default: return 'var(--clean)'
  }
}

export default function ScoreBar({ score, tier, compact = false }) {
  const color = getTierColor(tier)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: compact ? 60 : 80,
        height: 4,
        background: 'var(--border)',
        flexShrink: 0
      }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{
        fontFamily: 'IBM Plex Mono',
        fontSize: compact ? 11 : 12,
        color,
        fontWeight: 600,
        minWidth: 24
      }}>
        {score}
      </span>
    </div>
  )
}
