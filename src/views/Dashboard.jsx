import React, { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer
} from 'recharts'
import useAppStore from '../store/useAppStore'

const TIER_COLORS = {
  Critical: '#e05252',
  High: '#c04080',
  Medium: '#E8A020',
  Low: '#4caf82'
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '1px solid var(--border)',
      padding: '20px 24px',
      flex: 1,
      minWidth: 140
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: accent || 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '10px 14px', fontFamily: 'IBM Plex Mono', fontSize: 11 }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const transactions = useAppStore(s => s.transactions)
  const analysisResults = useAppStore(s => s.analysisResults)
  const [aiNotice, setAiNotice] = useState(false)

  const stats = useMemo(() => {
    const flagged = Object.values(analysisResults).filter(r => r.tier !== 'Clean')
    const critical = flagged.filter(r => r.tier === 'Critical').length
    const scores = Object.values(analysisResults).map(r => r.compositeScore)
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

    const atRisk = transactions
      .filter(t => analysisResults[t.txn_id]?.tier === 'Critical' || analysisResults[t.txn_id]?.tier === 'High')
      .reduce((sum, t) => sum + t.amount, 0)

    const mlOnly = Object.values(analysisResults).filter(r => r.mlIsAnomaly && r.ruleScore < 25).length

    return { total: transactions.length, flagged: flagged.length, critical, avgScore, atRisk, mlOnly }
  }, [transactions, analysisResults])

  const deptChartData = useMemo(() => {
    const depts = {}
    for (const t of transactions) {
      const r = analysisResults[t.txn_id]
      if (!r || r.tier === 'Clean') continue
      if (!depts[t.department]) depts[t.department] = { department: t.department, Critical: 0, High: 0, Medium: 0, Low: 0 }
      depts[t.department][r.tier]++
    }
    return Object.values(depts).sort((a, b) => (b.Critical + b.High) - (a.Critical + a.High))
  }, [transactions, analysisResults])

  const weeklyData = useMemo(() => {
    const weeks = {}
    for (const t of transactions) {
      const d = new Date(t.date)
      const week = `W${Math.ceil(d.getDate() / 7)}-${d.toLocaleString('default', { month: 'short' })}`
      if (!weeks[week]) weeks[week] = { week, total: 0, flagged: 0 }
      weeks[week].total++
      if (analysisResults[t.txn_id]?.tier !== 'Clean') weeks[week].flagged++
    }
    return Object.values(weeks).slice(0, 20)
  }, [transactions, analysisResults])

  const topVendors = useMemo(() => {
    const vm = {}
    for (const t of transactions) {
      const r = analysisResults[t.txn_id]
      if (!r || r.tier === 'Clean') continue
      if (!vm[t.vendor]) vm[t.vendor] = { vendor: t.vendor, count: 0, score: 0, amount: 0 }
      vm[t.vendor].count++
      vm[t.vendor].score = Math.max(vm[t.vendor].score, r.compositeScore)
      vm[t.vendor].amount += t.amount
    }
    return Object.values(vm).sort((a, b) => b.score - a.score).slice(0, 5)
  }, [transactions, analysisResults])

  function runAuditSummary() {
    setAiNotice(true)
  }

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Audit Dashboard</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
            {transactions.length} transactions analyzed
          </div>
        </div>
        <button
          onClick={runAuditSummary}
          disabled={!transactions.length}
          style={{
            background: 'var(--accent)',
            border: 'none',
            color: '#fff',
            padding: '10px 20px',
            fontSize: 12,
            fontFamily: 'IBM Plex Mono',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.05em'
          }}
        >
          ▶ RUN AI AUDIT SUMMARY
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="TOTAL TRANSACTIONS" value={stats.total} />
        <StatCard label="FLAGGED" value={stats.flagged} accent="var(--alert)" sub={`${Math.round(stats.flagged / Math.max(1, stats.total) * 100)}% of total`} />
        <StatCard label="CRITICAL" value={stats.critical} accent="var(--critical)" />
        <StatCard label="$ AT RISK" value={`$${(stats.atRisk / 1000).toFixed(0)}K`} accent="var(--critical)" sub="Critical + High tier" />
        <StatCard label="AVG RISK SCORE" value={stats.avgScore} sub="out of 100" />
        <StatCard label="ML-FLAGGED (RULES MISSED)" value={stats.mlOnly} accent="#a78bfa" sub="ML only · ruleScore < 25" />
      </div>

      {aiNotice && (
        <div style={{ borderLeft: '3px solid #2D7DD2', background: '#111318', padding: '12px 16px', marginBottom: 16, fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-secondary)' }}>
          AI features require an Anthropic API key. Add ANTHROPIC_API_KEY to your environment variables to enable this feature.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em', marginBottom: 16 }}>
            RISK TIERS BY DEPARTMENT
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="department" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Critical" stackId="a" fill={TIER_COLORS.Critical} />
              <Bar dataKey="High" stackId="a" fill={TIER_COLORS.High} />
              <Bar dataKey="Medium" stackId="a" fill={TIER_COLORS.Medium} />
              <Bar dataKey="Low" stackId="a" fill={TIER_COLORS.Low} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em', marginBottom: 16 }}>
            WEEKLY VOLUME + ANOMALY OVERLAY
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'IBM Plex Mono' }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total" stroke="var(--accent)" dot={false} strokeWidth={2} name="Total" />
              <Line type="monotone" dataKey="flagged" stroke="var(--critical)" dot={false} strokeWidth={2} name="Flagged" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', marginTop: 16 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em' }}>
          TOP 5 FLAGGED VENDORS
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Vendor', 'Flag Count', 'Total Amount', 'Max Score'].map(h => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', fontWeight: 500, letterSpacing: '0.08em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topVendors.map((v, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 20px', fontWeight: 500 }}>{v.vendor}</td>
                <td style={{ padding: '10px 20px', fontFamily: 'IBM Plex Mono', color: 'var(--alert)' }}>{v.count}</td>
                <td style={{ padding: '10px 20px', fontFamily: 'IBM Plex Mono' }}>${v.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td style={{ padding: '10px 20px', fontFamily: 'IBM Plex Mono', color: 'var(--critical)' }}>{v.score}</td>
              </tr>
            ))}
            {topVendors.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', fontSize: 12 }}>— no flagged vendors —</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
