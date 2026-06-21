import React, { useState, useMemo } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import useAppStore from '../store/useAppStore'
import ScoreBar from '../components/ScoreBar'

function mean(arr) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

export default function VendorRisk() {
  const transactions = useAppStore(s => s.transactions)
  const analysisResults = useAppStore(s => s.analysisResults)
  const setSelectedTxn = useAppStore(s => s.setSelectedTxn)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [sortCol, setSortCol] = useState('maxScore')
  const [sortDir, setSortDir] = useState('desc')

  const vendorData = useMemo(() => {
    const vm = {}
    for (const t of transactions) {
      if (!vm[t.vendor]) vm[t.vendor] = { vendor: t.vendor, txns: [], amounts: [], flagCount: 0, maxScore: 0 }
      vm[t.vendor].txns.push(t)
      vm[t.vendor].amounts.push(t.amount)
      const r = analysisResults[t.txn_id]
      if (r && (r.ruleFlags || []).length > 0) vm[t.vendor].flagCount++
      if (r) vm[t.vendor].maxScore = Math.max(vm[t.vendor].maxScore, r.compositeScore)
    }
    return Object.values(vm).map(v => ({
      ...v,
      count: v.txns.length,
      totalAmount: v.amounts.reduce((a, b) => a + b, 0),
      avgAmount: mean(v.amounts),
      maxAmount: Math.max(...v.amounts)
    }))
  }, [transactions, analysisResults])

  const oneTimeHighValue = useMemo(() =>
    vendorData.filter(v => v.count === 1 && v.totalAmount > 20000),
    [vendorData]
  )

  const sorted = useMemo(() => [...vendorData].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol]
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  }), [vendorData, sortCol, sortDir])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const selected = selectedVendor ? vendorData.find(v => v.vendor === selectedVendor) : null

  const thStyle = (col) => ({
    padding: '10px 14px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)',
    fontFamily: 'IBM Plex Mono', fontWeight: 500, letterSpacing: '0.08em',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)'
  })

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Vendor Risk</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
            {vendorData.length} vendors · click row for drilldown
          </div>
        </div>

        {oneTimeHighValue.length > 0 && (
          <div style={{ padding: '12px 24px', background: 'rgba(232,160,32,0.06)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--alert)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em', marginBottom: 8 }}>
              ⚠ ONE-TIME HIGH-VALUE VENDORS (&gt;$20K, SINGLE TRANSACTION)
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {oneTimeHighValue.map(v => (
                <button
                  key={v.vendor}
                  onClick={() => setSelectedVendor(v.vendor)}
                  style={{
                    background: 'rgba(232,160,32,0.1)', border: '1px solid var(--alert)',
                    color: 'var(--alert)', padding: '6px 14px', fontSize: 11,
                    fontFamily: 'IBM Plex Mono', cursor: 'pointer', fontWeight: 600
                  }}
                >
                  {v.vendor} · ${v.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1 }}>
              <tr>
                {[
                  { key: 'vendor', label: 'VENDOR' },
                  { key: 'count', label: 'COUNT' },
                  { key: 'totalAmount', label: 'TOTAL $' },
                  { key: 'avgAmount', label: 'AVG $' },
                  { key: 'maxAmount', label: 'MAX $' },
                  { key: 'flagCount', label: '# FLAGS' },
                  { key: 'maxScore', label: 'MAX SCORE' }
                ].map(col => (
                  <th key={col.key} style={thStyle(col.key)} onClick={() => toggleSort(col.key)}>
                    {col.label}
                    <span style={{ color: sortCol === col.key ? 'var(--accent)' : 'var(--text-muted)', marginLeft: 4 }}>
                      {sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(v => (
                <tr
                  key={v.vendor}
                  onClick={() => setSelectedVendor(v.vendor === selectedVendor ? null : v.vendor)}
                  style={{
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: v.vendor === selectedVendor ? 'var(--bg-elevated)' : 'transparent'
                  }}
                  onMouseEnter={e => v.vendor !== selectedVendor && (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => v.vendor !== selectedVendor && (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: v.count === 1 && v.totalAmount > 20000 ? 'var(--alert)' : 'var(--text-primary)' }}>
                    {v.vendor}
                    {v.count === 1 && v.totalAmount > 20000 && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--alert)' }}>NEW</span>}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>{v.count}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>${v.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>${Math.round(v.avgAmount).toLocaleString()}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>${v.maxAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'IBM Plex Mono', fontSize: 12, color: v.flagCount > 0 ? 'var(--alert)' : 'var(--text-muted)' }}>{v.flagCount}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <ScoreBar score={v.maxScore} tier={v.maxScore >= 75 ? 'Critical' : v.maxScore >= 50 ? 'High' : v.maxScore >= 25 ? 'Medium' : v.maxScore > 0 ? 'Low' : 'Clean'} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div style={{ width: 360, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{selected.vendor}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{selected.count} transactions</div>
            </div>
            <button onClick={() => setSelectedVendor(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '4px 10px', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em', marginBottom: 10 }}>AMOUNT SPARKLINE</div>
            <ResponsiveContainer width="100%" height={60}>
              <LineChart data={selected.txns.sort((a, b) => a.date.localeCompare(b.date)).map((t, i) => ({ i, v: t.amount }))}>
                <Line type="monotone" dataKey="v" stroke="var(--accent)" dot={false} strokeWidth={2} />
                <Tooltip formatter={v => `$${v.toLocaleString()}`} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {selected.txns.sort((a, b) => b.date.localeCompare(a.date)).map(t => {
              const r = analysisResults[t.txn_id]
              return (
                <div
                  key={t.txn_id}
                  onClick={() => setSelectedTxn(t)}
                  style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--accent)' }}>{t.txn_id}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>${t.amount.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>{t.date}</span>
                    {r && r.compositeScore > 0 && <ScoreBar score={r.compositeScore} tier={r.tier} compact />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
