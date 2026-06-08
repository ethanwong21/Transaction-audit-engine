import React, { useState, useRef } from 'react'
import useAppStore from '../../store/useAppStore'
import {
  resolveToCIK,
  fetchSECFinancials,
  fetchSECFilings,
  fetchInsiderTrades,
  fetchPriceData,
  mapToTransactions
} from '../../lib/companyDataFetcher'
import { runFinancialAnomalyDetection } from '../../lib/financialAnomalyEngine'
import ScoreBar from '../ScoreBar'
import FlagBadge from '../FlagBadge'

// ─── Constants ───────────────────────────────────────────────────────────────

const TIER_COLORS = {
  Critical: '#e05252',
  High: '#c04080',
  Medium: '#E8A020',
  Low: '#4caf82',
  Clean: '#4a5568'
}

const PAGE_SIZE = 25

const STEPS = [
  { id: 'cik', label: 'Resolving ticker → CIK...' },
  { id: 'filings', label: 'Fetching SEC filings...' },
  { id: 'financials', label: 'Loading financial statements...' },
  { id: 'insider', label: 'Fetching insider trades...' },
  { id: 'anomaly', label: 'Running anomaly detection...' }
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ steps, currentStep, done }) {
  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--accent-dim)',
      borderLeft: '3px solid var(--accent)',
      padding: '20px 24px',
      marginBottom: 24,
      fontFamily: 'IBM Plex Mono'
    }}>
      <div style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 14 }}>
        ■ FETCHING DATA
      </div>
      {STEPS.map((step, i) => {
        const stepIdx = STEPS.findIndex(s => s.id === currentStep)
        const isComplete = done || i < stepIdx
        const isActive = !done && step.id === currentStep
        const isPending = !done && i > stepIdx

        return (
          <div key={step.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 8,
            color: isComplete ? 'var(--low)' : isActive ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 12
          }}>
            <span style={{ width: 16, flexShrink: 0, fontWeight: 700 }}>
              {isComplete ? '✓' : isActive ? '▶' : '·'}
            </span>
            <span>{step.label}</span>
            {isActive && <span style={{ color: 'var(--accent)', fontSize: 10, marginLeft: 4 }}>
              <Blink />
            </span>}
          </div>
        )
      })}
    </div>
  )
}

function Blink() {
  const [on, setOn] = React.useState(true)
  React.useEffect(() => {
    const t = setInterval(() => setOn(v => !v), 500)
    return () => clearInterval(t)
  }, [])
  return <span style={{ opacity: on ? 1 : 0 }}>■</span>
}

function SourceBadge({ label, status }) {
  const color = status === 'ok' ? 'var(--low)' : status === 'fail' ? 'var(--critical)' : 'var(--text-muted)'
  const bg = status === 'ok' ? 'rgba(76,175,130,0.1)' : status === 'fail' ? 'rgba(224,82,82,0.1)' : 'rgba(74,85,104,0.1)'
  const icon = status === 'ok' ? '✓' : status === 'fail' ? '✕' : '—'
  return (
    <span style={{
      fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 600,
      color, background: bg, border: `1px solid ${color}`,
      padding: '2px 8px', letterSpacing: '0.05em', marginRight: 6, display: 'inline-flex', alignItems: 'center', gap: 4
    }}>
      {icon} {label}
    </span>
  )
}

function CompanyHeader({ companyData, sources }) {
  const { name, ticker, companyInfo, financials } = companyData

  const revenue = Object.entries(financials)
    .find(([k]) => k === 'Revenue')
  const latestRevenue = revenue ? revenue[1].periods.slice(-1)[0]?.val : null

  const netIncome = Object.entries(financials)
    .find(([k]) => k === 'Net Income')
  const latestNetIncome = netIncome ? netIncome[1].periods.slice(-1)[0]?.val : null

  const assets = Object.entries(financials)
    .find(([k]) => k === 'Total Assets')
  const latestAssets = assets ? assets[1].periods.slice(-1)[0]?.val : null

  function fmt(val) {
    if (val == null) return '—'
    const abs = Math.abs(val)
    const sign = val < 0 ? '-' : ''
    if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
    return `${sign}$${abs.toLocaleString()}`
  }

  const exchange = companyInfo?.exchanges?.[0] || '—'
  const sic = companyInfo?.sicDescription || '—'

  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{name}</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{ticker}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{exchange}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sic}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'REVENUE', value: fmt(latestRevenue) },
            { label: 'NET INCOME', value: fmt(latestNetIncome) },
            { label: 'TOTAL ASSETS', value: fmt(latestAssets) }
          ].map(stat => (
            <div key={stat.label}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.08em', marginBottom: 3 }}>{stat.label}</div>
              <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 16, fontWeight: 600 }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.08em', marginBottom: 8 }}>DATA SOURCES</div>
        {Object.entries(sources).map(([label, status]) => (
          <SourceBadge key={label} label={label} status={status} />
        ))}
      </div>
    </div>
  )
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>↕</span>
  return <span style={{ color: 'var(--accent)', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function ResultsTable({ transactions, analysis }) {
  const [sortCol, setSortCol] = useState('score')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [expandedRaw, setExpandedRaw] = useState(false)

  const flagged = transactions.filter(t => {
    const r = analysis[t.txn_id]
    return r && r.tier !== 'Clean'
  })

  const sorted = [...flagged].sort((a, b) => {
    const ar = analysis[a.txn_id]
    const br = analysis[b.txn_id]
    let av, bv
    switch (sortCol) {
      case 'score': av = ar.score; bv = br.score; break
      case 'date': av = a.date; bv = b.date; break
      case 'amount': av = a.amount; bv = b.amount; break
      case 'department': av = a.department; bv = b.department; break
      default: av = ar.score; bv = br.score
    }
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const pageData = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
    setPage(1)
  }

  const thStyle = {
    padding: '10px 12px', textAlign: 'left', fontSize: 10,
    color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono',
    fontWeight: 500, letterSpacing: '0.08em', cursor: 'pointer',
    userSelect: 'none', whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border)'
  }

  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em' }}>
          FLAGGED RESULTS — {flagged.length} anomalies detected
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
          {transactions.length} total records analyzed
        </div>
      </div>

      {flagged.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', fontSize: 13 }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>✓</div>
          No anomalies detected in the analyzed data.
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    { key: 'score', label: 'RISK SCORE' },
                    { key: 'txn_id', label: 'ID' },
                    { key: 'date', label: 'DATE' },
                    { key: 'amount', label: 'AMOUNT' },
                    { key: 'department', label: 'SOURCE' },
                    { key: 'description', label: 'DESCRIPTION' },
                    { key: 'flags', label: 'FLAGS' },
                    { key: 'tier', label: 'TIER' }
                  ].map(col => (
                    <th
                      key={col.key}
                      style={thStyle}
                      onClick={() => col.key !== 'flags' && col.key !== 'description' && toggleSort(col.key)}
                    >
                      {col.label}
                      {col.key !== 'flags' && col.key !== 'description' && (
                        <SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageData.map(t => {
                  const r = analysis[t.txn_id]
                  return (
                    <tr
                      key={t.txn_id}
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <ScoreBar score={r.score} tier={r.tier} compact />
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                        {t.txn_id}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'IBM Plex Mono', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {t.date}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'IBM Plex Mono', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {t.amount > 0 ? `$${t.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {t.department}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.description}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {r.flags.slice(0, 2).map(f => <FlagBadge key={f.rule} flag={f} />)}
                          {r.flags.length > 2 && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                              +{r.flags.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 700,
                          color: TIER_COLORS[r.tier], letterSpacing: '0.05em'
                        }}>
                          {r.tier.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginRight: 8 }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)', padding: '5px 12px', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
              >
                ← PREV
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{ background: p === page ? 'var(--accent)' : 'var(--bg-base)', border: '1px solid var(--border)', color: p === page ? '#fff' : 'var(--text-secondary)', padding: '5px 10px', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)', padding: '5px 12px', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
              >
                NEXT →
              </button>
            </div>
          )}
        </>
      )}

      {/* Raw data toggle */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setExpandedRaw(v => !v)}
          style={{ width: '100%', background: 'none', border: 'none', padding: '10px 20px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer', letterSpacing: '0.05em' }}
        >
          {expandedRaw ? '▼' : '▶'} RAW TRANSACTION DATA ({transactions.length} records)
        </button>
        {expandedRaw && (
          <pre style={{
            margin: 0, padding: '16px 20px', maxHeight: 400, overflowY: 'auto',
            fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-secondary)',
            background: 'var(--bg-base)', borderTop: '1px solid var(--border)',
            lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all'
          }}>
            {JSON.stringify(transactions.slice(0, 50), null, 2)}
            {transactions.length > 50 && `\n\n... and ${transactions.length - 50} more records`}
          </pre>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CompanyLookup() {
  const {
    companyData, companyTransactions, companyAnalysis,
    companyLoading, companyError, companyTicker,
    setCompanyData, setCompanyTransactions, setCompanyAnalysis,
    setCompanyLoading, setCompanyError, setCompanyTicker
  } = useAppStore()

  const [query, setQuery] = useState(companyTicker || '')
  const [currentStep, setCurrentStep] = useState(null)
  const [stepsComplete, setStepsComplete] = useState(false)
  const [sources, setSources] = useState({})
  const [rateLimitCountdown, setRateLimitCountdown] = useState(null)
  const countdownRef = useRef(null)

  function startCountdown(onDone) {
    let count = 10
    setRateLimitCountdown(count)
    countdownRef.current = setInterval(() => {
      count--
      setRateLimitCountdown(count)
      if (count <= 0) {
        clearInterval(countdownRef.current)
        setRateLimitCountdown(null)
        onDone()
      }
    }, 1000)
  }

  async function doSearch(q) {
    const trimmed = q.trim()
    if (!trimmed) return

    setCompanyLoading(true)
    setCompanyError(null)
    setCompanyData(null)
    setCompanyTransactions([])
    setCompanyAnalysis({})
    setStepsComplete(false)
    setSources({})
    const newSources = {}

    try {
      // Step 1: Resolve CIK
      setCurrentStep('cik')
      let resolved
      try {
        resolved = await resolveToCIK(trimmed)
        newSources['Ticker Map'] = 'ok'
      } catch (e) {
        if (e.code === 'SEC_RATE_LIMIT') {
          setCompanyError({ type: 'rate_limit' })
          setCompanyLoading(false)
          startCountdown(() => doSearch(q))
          return
        }
        throw e
      }

      const { cik, ticker, name } = resolved
      setCompanyTicker(ticker)

      // Step 2: SEC Filings
      setCurrentStep('filings')
      let filingsData = { filings: [], companyInfo: {} }
      let insiderTrades = []
      try {
        filingsData = await fetchSECFilings(cik)
        insiderTrades = await fetchInsiderTrades(cik)
        newSources['SEC Filings'] = 'ok'
        newSources['Insider Trades'] = insiderTrades.length > 0 ? 'ok' : 'skip'
      } catch (e) {
        if (e.code === 'SEC_RATE_LIMIT') {
          setCompanyError({ type: 'rate_limit' })
          setCompanyLoading(false)
          startCountdown(() => doSearch(q))
          return
        }
        newSources['SEC Filings'] = 'fail'
        newSources['Insider Trades'] = 'fail'
      }

      // Step 3: Financials
      setCurrentStep('financials')
      let secFinancials = {}
      try {
        secFinancials = await fetchSECFinancials(cik)
        newSources['SEC Financials'] = Object.keys(secFinancials).length > 0 ? 'ok' : 'skip'
      } catch (e) {
        if (e.code === 'SEC_RATE_LIMIT') {
          setCompanyError({ type: 'rate_limit' })
          setCompanyLoading(false)
          startCountdown(() => doSearch(q))
          return
        }
        newSources['SEC Financials'] = 'fail'
      }

      // Step 4: Insider trades (already fetched above, step indicator only)
      setCurrentStep('insider')
      await new Promise(r => setTimeout(r, 80)) // brief pause for UX

      // Step 5: Price data (best-effort, CORS likely blocked)
      let priceData = null
      try {
        priceData = await fetchPriceData(ticker)
        newSources['Price Data'] = priceData ? 'ok' : 'skip'
      } catch {
        newSources['Price Data'] = 'skip'
      }
      if (!newSources['Price Data']) newSources['Price Data'] = 'skip'

      // Step 5: Anomaly detection
      setCurrentStep('anomaly')
      const txns = mapToTransactions(
        secFinancials,
        filingsData.filings,
        insiderTrades,
        ticker,
        name
      )

      const analysisResult = runFinancialAnomalyDetection(txns, txns)

      setSources(newSources)
      setCompanyData({ name, ticker, companyInfo: filingsData.companyInfo, financials: secFinancials, priceData })
      setCompanyTransactions(txns)
      setCompanyAnalysis(analysisResult)
      setStepsComplete(true)
    } catch (e) {
      const msg = e.message || String(e)
      setCompanyError({ type: 'general', message: msg })
    } finally {
      setCompanyLoading(false)
      setCurrentStep(null)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    doSearch(query)
  }

  const inputStyle = {
    flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', padding: '10px 16px', fontSize: 14,
    fontFamily: 'IBM Plex Mono', outline: 'none',
    borderRight: 'none'
  }

  const btnStyle = {
    background: companyLoading ? 'var(--accent-dim)' : 'var(--accent)',
    border: 'none', color: '#fff', padding: '10px 24px',
    fontSize: 12, fontFamily: 'IBM Plex Mono', fontWeight: 700,
    cursor: companyLoading ? 'not-allowed' : 'pointer', letterSpacing: '0.08em',
    whiteSpace: 'nowrap'
  }

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Company Lookup</h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
          SEC EDGAR · Public financial data · No API key required
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', marginBottom: 24, maxWidth: 640 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ticker (AAPL), company name, or 10-digit CIK"
          disabled={companyLoading}
          style={inputStyle}
        />
        <button type="submit" disabled={companyLoading || !query.trim()} style={btnStyle}>
          {companyLoading ? '■ LOADING' : '▶ SEARCH'}
        </button>
      </form>

      {/* Loading steps */}
      {companyLoading && currentStep && (
        <StepIndicator steps={STEPS} currentStep={currentStep} done={false} />
      )}

      {/* Rate limit error */}
      {companyError?.type === 'rate_limit' && (
        <div style={{
          border: '1px solid var(--alert)', borderLeft: '3px solid var(--alert)',
          background: 'rgba(232,160,32,0.06)', padding: '16px 20px', marginBottom: 16,
          fontFamily: 'IBM Plex Mono', fontSize: 12
        }}>
          <div style={{ color: 'var(--alert)', fontWeight: 700, marginBottom: 6 }}>⚠ SEC EDGAR RATE LIMIT</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            SEC EDGAR is rate limiting requests. Please wait 10 seconds and try again.
          </div>
          {rateLimitCountdown !== null && (
            <div style={{ color: 'var(--accent)', marginTop: 10, fontSize: 16, fontWeight: 700 }}>
              Retrying in {rateLimitCountdown}s...
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {companyError?.type === 'general' && (
        <div style={{
          border: '1px solid var(--critical)', borderLeft: '3px solid var(--critical)',
          background: 'rgba(224,82,82,0.06)', padding: '16px 20px', marginBottom: 16,
          fontFamily: 'IBM Plex Mono', fontSize: 12
        }}>
          <div style={{ color: 'var(--critical)', fontWeight: 700, marginBottom: 8 }}>LOOKUP FAILED</div>
          <pre style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, marginBottom: 12, fontSize: 11, lineHeight: 1.7 }}>
            {companyError.message}
          </pre>
          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            Guaranteed to work (no network needed):{' '}
            {['AAPL','MSFT','TSLA','NVDA','META','AMZN','GOOGL','JPM','NFLX','ORCL'].map(t => (
              <button key={t} onClick={() => { setQuery(t); doSearch(t) }}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--accent)', padding: '2px 8px', fontSize: 11, fontFamily: 'IBM Plex Mono', cursor: 'pointer', marginRight: 4, marginTop: 4 }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {companyData && !companyLoading && (
        <>
          <CompanyHeader companyData={companyData} sources={sources} />
          <ResultsTable transactions={companyTransactions} analysis={companyAnalysis} />
        </>
      )}

      {/* Empty state */}
      {!companyData && !companyLoading && !companyError && (
        <div style={{
          background: 'var(--bg-panel)', border: '1px solid var(--border)',
          padding: '48px', textAlign: 'center', color: 'var(--text-muted)'
        }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⌕</div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, marginBottom: 12 }}>
            Search for any public company
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Uses SEC EDGAR public APIs — no API key required.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['AAPL','MSFT','TSLA','NVDA','META','AMZN','GOOGL','JPM','NFLX','ORCL'].map(t => (
              <button key={t} onClick={() => { setQuery(t); doSearch(t) }}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--accent)', padding: '6px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', fontWeight: 600, cursor: 'pointer' }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
