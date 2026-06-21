import React, { useState, useMemo } from 'react'
import useAppStore from '../store/useAppStore'
import ScoreBar from '../components/ScoreBar'
import FlagBadge from '../components/FlagBadge'
import DetailPanel from './DetailPanel'

const PAGE_SIZE = 25

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>↕</span>
  return <span style={{ color: 'var(--accent)', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
}

const TIER_COLORS = { Critical: '#e05252', High: '#c04080', Medium: '#E8A020', Low: '#4caf82', Clean: '#4a5568' }

export default function ReviewQueue() {
  const transactions = useAppStore(s => s.transactions)
  const analysisResults = useAppStore(s => s.analysisResults)
  const filters = useAppStore(s => s.filters)
  const setFilters = useAppStore(s => s.setFilters)
  const setSelectedTxn = useAppStore(s => s.setSelectedTxn)
  const reviewState = useAppStore(s => s.reviewState)

  const [sortCol, setSortCol] = useState('score')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  const departments = useMemo(() => ['all', ...new Set(transactions.map(t => t.department))].sort(), [transactions])
  const flagTypes = useMemo(() => {
    const types = new Set()
    Object.values(analysisResults).forEach(r => (r.ruleFlags || []).forEach(f => types.add(f.rule)))
    return ['all', ...types]
  }, [analysisResults])

  const flagged = useMemo(() => transactions.filter(t => {
    const r = analysisResults[t.txn_id]
    return r && r.tier !== 'Clean'
  }), [transactions, analysisResults])

  const filtered = useMemo(() => flagged.filter(t => {
    const r = analysisResults[t.txn_id]
    if (filters.tier !== 'all' && r.tier !== filters.tier) return false
    if (filters.department !== 'all' && t.department !== filters.department) return false
    if (filters.flagType !== 'all' && !(r.ruleFlags || []).some(f => f.rule === filters.flagType)) return false
    if (filters.dateRange) {
      const [start, end] = filters.dateRange
      if (t.date < start || t.date > end) return false
    }
    return true
  }), [flagged, analysisResults, filters])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const ar = analysisResults[a.txn_id]
    const br = analysisResults[b.txn_id]
    let av, bv
    switch (sortCol) {
      case 'score': av = ar.compositeScore; bv = br.compositeScore; break
      case 'date': av = a.date; bv = b.date; break
      case 'amount': av = a.amount; bv = b.amount; break
      case 'vendor': av = a.vendor; bv = b.vendor; break
      case 'department': av = a.department; bv = b.department; break
      default: av = ar.compositeScore; bv = br.compositeScore
    }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  }), [filtered, sortCol, sortDir, analysisResults])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
    setPage(1)
  }

  const thStyle = (col) => ({
    padding: '10px 12px', textAlign: 'left', fontSize: 10,
    color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono',
    fontWeight: 500, letterSpacing: '0.08em', cursor: 'pointer',
    userSelect: 'none', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)'
  })

  const selectStyle = {
    background: 'var(--bg-base)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', padding: '6px 10px',
    fontSize: 12, fontFamily: 'IBM Plex Mono', outline: 'none', cursor: 'pointer'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 16, marginRight: 8 }}>Review Queue</div>
          <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)' }}>
            {filtered.length} flagged transactions
          </span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <select value={filters.tier} onChange={e => { setFilters({ tier: e.target.value }); setPage(1) }} style={selectStyle}>
              <option value="all">All Tiers</option>
              {['Critical', 'High', 'Medium', 'Low'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filters.department} onChange={e => { setFilters({ department: e.target.value }); setPage(1) }} style={selectStyle}>
              {departments.map(d => <option key={d} value={d}>{d === 'all' ? 'All Depts' : d}</option>)}
            </select>
            <select value={filters.flagType} onChange={e => { setFilters({ flagType: e.target.value }); setPage(1) }} style={selectStyle}>
              {flagTypes.map(f => <option key={f} value={f}>{f === 'all' ? 'All Flags' : f.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1 }}>
            <tr>
              {[
                { key: 'score', label: 'RISK SCORE' },
                { key: 'txn_id', label: 'TXN ID' },
                { key: 'date', label: 'DATE' },
                { key: 'amount', label: 'AMOUNT' },
                { key: 'vendor', label: 'VENDOR' },
                { key: 'department', label: 'DEPT' },
                { key: 'flags', label: 'FLAGS' },
                { key: 'status', label: 'STATUS' }
              ].map(col => (
                <th key={col.key} style={thStyle(col.key)} onClick={() => col.key !== 'flags' && col.key !== 'status' && toggleSort(col.key)}>
                  {col.label}
                  {col.key !== 'flags' && col.key !== 'status' && <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map(t => {
              const r = analysisResults[t.txn_id]
              const rs = reviewState[t.txn_id] || {}
              return (
                <tr
                  key={t.txn_id}
                  onClick={() => setSelectedTxn(t)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <ScoreBar score={r.compositeScore} tier={r.tier} compact />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: TIER_COLORS[r.tier], fontFamily: 'IBM Plex Mono' }}>{r.tier.toUpperCase()}</span>
                      {r.mlIsAnomaly && <span title="Flagged by ML model" style={{ fontSize: 9, background: '#a78bfa22', border: '1px solid #a78bfa', color: '#a78bfa', fontFamily: 'IBM Plex Mono', padding: '1px 4px' }}>ML</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--accent)' }}>{t.txn_id}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>{t.date}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>${t.amount.toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.vendor}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{t.department}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(r.ruleFlags || []).slice(0, 2).map(f => <FlagBadge key={f.rule} flag={f} />)}
                      {(r.ruleFlags || []).length > 2 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>+{r.ruleFlags.length - 2}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {rs.status && (
                      <span style={{
                        fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 600,
                        color: rs.status === 'approved' ? 'var(--low)' : rs.status === 'escalated' ? 'var(--critical)' : 'var(--medium)',
                        letterSpacing: '0.05em'
                      }}>
                        {rs.status.toUpperCase()}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', fontSize: 13 }}>
                  — no transactions match current filters —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginRight: 8 }}>
            Page {page} of {totalPages} · {sorted.length} results
          </span>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)', padding: '6px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
            ← PREV
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
            return (
              <button key={p} onClick={() => setPage(p)}
                style={{ background: p === page ? 'var(--accent)' : 'var(--bg-base)', border: '1px solid var(--border)', color: p === page ? '#fff' : 'var(--text-secondary)', padding: '6px 12px', fontSize: 12, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
                {p}
              </button>
            )
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)', padding: '6px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
            NEXT →
          </button>
        </div>
      )}

      <DetailPanel />
    </div>
  )
}
