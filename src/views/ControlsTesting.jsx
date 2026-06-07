import React, { useState, useMemo } from 'react'
import useAppStore from '../store/useAppStore'

function ControlCard({ title, status, count, pct, threshold, description }) {
  const statusColor = status === 'PASS' ? 'var(--low)' : status === 'FAIL' ? 'var(--critical)' : 'var(--medium)'
  return (
    <div style={{ background: 'var(--bg-panel)', border: `1px solid var(--border)`, borderLeft: `3px solid ${statusColor}`, padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, fontWeight: 700, color: statusColor, letterSpacing: '0.05em' }}>{status}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{description}</div>
      <div style={{ display: 'flex', gap: 24 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.08em', marginBottom: 3 }}>COUNT</div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 600, color: statusColor }}>{count}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.08em', marginBottom: 3 }}>RATE</div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 600 }}>{pct}%</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.08em', marginBottom: 3 }}>THRESHOLD</div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 600, color: 'var(--text-muted)' }}>{threshold}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, height: 4, background: 'var(--border)' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: statusColor, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

export default function ControlsTesting() {
  const transactions = useAppStore(s => s.transactions)
  const analysisResults = useAppStore(s => s.analysisResults)
  const [aiNotice, setAiNotice] = useState(false)

  const controls = useMemo(() => {
    const total = transactions.length
    if (!total) return []

    // Segregation of Duties: same person submits and approves
    const sodCount = transactions.filter(t => t.submitted_by === t.approver).length
    const sodPct = Math.round(sodCount / total * 100)

    // Weekend Approval Rate
    const weekendCount = transactions.filter(t => {
      const d = new Date(t.date)
      return d.getDay() === 0 || d.getDay() === 6
    }).length
    const weekendPct = Math.round(weekendCount / total * 100)

    // Duplicate Rate
    const seen = new Set()
    let dupCount = 0
    for (const t of transactions) {
      const key = `${t.vendor}|${t.amount}`
      if (seen.has(key)) dupCount++
      seen.add(key)
    }
    const dupPct = Math.round(dupCount / total * 100)

    // Vague Description Rate
    const vagueCount = transactions.filter(t => {
      if (!t.description) return false
      return /^(misc|other|adj|adjustment|n\/a|na|tbd)$/i.test(t.description.trim())
    }).length
    const vaguePct = Math.round(vagueCount / total * 100)

    // New Vendor Rate (appears < 3 times)
    const vendorCounts = {}
    for (const t of transactions) vendorCounts[t.vendor] = (vendorCounts[t.vendor] || 0) + 1
    const newVendorTxns = transactions.filter(t => vendorCounts[t.vendor] < 3).length
    const newVendorPct = Math.round(newVendorTxns / total * 100)

    return [
      {
        title: 'Segregation of Duties',
        count: sodCount,
        pct: sodPct,
        threshold: '0%',
        status: sodCount === 0 ? 'PASS' : sodPct < 5 ? 'WARNING' : 'FAIL',
        description: 'Transactions where the submitter and approver are the same individual.'
      },
      {
        title: 'Weekend Approval Rate',
        count: weekendCount,
        pct: weekendPct,
        threshold: '5%',
        status: weekendPct === 0 ? 'PASS' : weekendPct <= 5 ? 'WARNING' : 'FAIL',
        description: 'Transactions processed on Saturday or Sunday without documented exception.'
      },
      {
        title: 'Duplicate Transaction Rate',
        count: dupCount,
        pct: dupPct,
        threshold: '2%',
        status: dupCount === 0 ? 'PASS' : dupPct <= 2 ? 'WARNING' : 'FAIL',
        description: 'Transactions with identical vendor and amount combinations.'
      },
      {
        title: 'Vague Description Rate',
        count: vagueCount,
        pct: vaguePct,
        threshold: '1%',
        status: vagueCount === 0 ? 'PASS' : vaguePct <= 1 ? 'WARNING' : 'FAIL',
        description: 'Transactions with non-descriptive descriptions (misc, other, TBD, etc.).'
      },
      {
        title: 'New Vendor Rate',
        count: newVendorTxns,
        pct: newVendorPct,
        threshold: '15%',
        status: newVendorPct <= 15 ? 'PASS' : newVendorPct <= 25 ? 'WARNING' : 'FAIL',
        description: 'Transactions from vendors with fewer than 3 total transactions on record.'
      }
    ]
  }, [transactions, analysisResults])

  function generateMemo() {
    setAiNotice(true)
  }

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Controls Testing</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
            {controls.filter(c => c.status === 'PASS').length} / {controls.length} controls passing
          </div>
        </div>
        <button
          onClick={generateMemo}
          disabled={!transactions.length}
          style={{
            background: 'var(--accent)',
            border: 'none', color: '#fff', padding: '10px 20px',
            fontSize: 12, fontFamily: 'IBM Plex Mono', fontWeight: 600,
            cursor: 'pointer', letterSpacing: '0.05em'
          }}
        >
          ▶ GENERATE CONTROLS MEMO
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {controls.map(c => <ControlCard key={c.title} {...c} />)}
      </div>

      {aiNotice && (
        <div style={{ borderLeft: '3px solid #2D7DD2', background: '#111318', padding: '12px 16px', marginBottom: 16, fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-secondary)' }}>
          AI features require an Anthropic API key. Add ANTHROPIC_API_KEY to your environment variables to enable this feature.
        </div>
      )}
    </div>
  )
}
