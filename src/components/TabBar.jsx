import React from 'react'
import useAppStore from '../store/useAppStore'

const tabs = [
  { id: 'dashboard', label: 'Dashboard', key: 'D' },
  { id: 'review', label: 'Review Queue', key: 'R' },
  { id: 'vendor', label: 'Vendor Risk', key: null },
  { id: 'controls', label: 'Controls Testing', key: null },
  { id: 'import', label: 'Data Import', key: null }
]

export default function TabBar() {
  const activeTab = useAppStore(s => s.activeTab)
  const setActiveTab = useAppStore(s => s.setActiveTab)
  const analysisResults = useAppStore(s => s.analysisResults)

  const flaggedCount = Object.values(analysisResults).filter(r => r.tier !== 'Clean').length

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      gap: 0,
      flexShrink: 0
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        paddingRight: 32,
        marginRight: 16,
        borderRight: '1px solid var(--border)'
      }}>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.08em' }}>
          TAE
        </span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, letterSpacing: '0.05em' }}>
          AUDIT ENGINE
        </span>
      </div>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            padding: '12px 20px',
            color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: activeTab === tab.id ? 600 : 400,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'color 0.15s',
            whiteSpace: 'nowrap'
          }}
        >
          {tab.label}
          {tab.id === 'review' && flaggedCount > 0 && (
            <span style={{
              background: 'var(--critical)',
              color: '#fff',
              fontSize: 10,
              fontFamily: 'IBM Plex Mono',
              fontWeight: 700,
              padding: '1px 6px',
              minWidth: 18,
              textAlign: 'center'
            }}>
              {flaggedCount}
            </span>
          )}
          {tab.key && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
              [{tab.key}]
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
