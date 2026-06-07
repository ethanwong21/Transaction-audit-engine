import React, { useState, useEffect, useCallback } from 'react'
import useAppStore from '../store/useAppStore'
import FlagBadge from '../components/FlagBadge'
import AIResponse from '../components/AIResponse'
import { getTransactionExplanation } from '../data/apiClient'

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

const TIER_COLORS = { Critical: '#e05252', High: '#c04080', Medium: '#E8A020', Low: '#4caf82', Clean: '#4a5568' }

export default function DetailPanel() {
  const selectedTxn = useAppStore(s => s.selectedTxn)
  const setSelectedTxn = useAppStore(s => s.setSelectedTxn)
  const analysisResults = useAppStore(s => s.analysisResults)
  const transactions = useAppStore(s => s.transactions)
  const updateReviewState = useAppStore(s => s.updateReviewState)
  const reviewState = useAppStore(s => s.reviewState)

  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [note, setNote] = useState('')

  const close = useCallback(() => setSelectedTxn(null), [setSelectedTxn])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  useEffect(() => {
    setAiText(''); setAiError('')
  }, [selectedTxn?.txn_id])

  if (!selectedTxn) return null

  const result = analysisResults[selectedTxn.txn_id] || { score: 0, tier: 'Clean', flags: [] }
  const state = reviewState[selectedTxn.txn_id] || {}
  const tierColor = TIER_COLORS[result.tier]

  const peerTxns = transactions.filter(t => t.vendor === selectedTxn.vendor && t.txn_id !== selectedTxn.txn_id)
  const peerAmounts = peerTxns.map(t => t.amount)
  const peerMean = peerAmounts.length ? peerAmounts.reduce((a, b) => a + b, 0) / peerAmounts.length : null
  const deviation = peerMean ? ((selectedTxn.amount - peerMean) / peerMean * 100).toFixed(1) : null

  async function explainWithAI() {
    setAiLoading(true); setAiError(''); setAiText('')
    try {
      const peerData = { vendorMean: peerMean, sampleSize: peerAmounts.length, deviation: deviation + '%' }
      const text = await getTransactionExplanation(selectedTxn, result.flags, peerData)
      setAiText(text)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  function addNote() {
    if (!note.trim()) return
    updateReviewState(selectedTxn.txn_id, { note: note.trim() })
    setNote('')
  }

  return (
    <>
      <div
        onClick={close}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)',
        zIndex: 101, overflowY: 'auto', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: 'var(--bg-panel)', zIndex: 1
        }}>
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
              {selectedTxn.txn_id}
            </div>
            <div style={{ fontSize: 11, color: tierColor, fontFamily: 'IBM Plex Mono', fontWeight: 600, marginTop: 2 }}>
              {result.tier.toUpperCase()} · SCORE {result.score}
            </div>
          </div>
          <button onClick={close} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', fontSize: 12, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}>
            ✕ CLOSE
          </button>
        </div>

        <div style={{ padding: '20px', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px', marginBottom: 20 }}>
            <Field label="DATE" value={selectedTxn.date} />
            <Field label="AMOUNT" value={`$${selectedTxn.amount.toLocaleString()}`} />
            <Field label="VENDOR" value={selectedTxn.vendor} />
            <Field label="DEPARTMENT" value={selectedTxn.department} />
            <Field label="DESCRIPTION" value={selectedTxn.description} />
            <Field label="ACCOUNT CODE" value={selectedTxn.account_code} />
            <Field label="PAYMENT METHOD" value={selectedTxn.payment_method} />
            <Field label="APPROVER" value={selectedTxn.approver} />
            <Field label="SUBMITTED BY" value={selectedTxn.submitted_by} />
          </div>

          {result.flags.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em', marginBottom: 12 }}>ACTIVE FLAGS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.flags.map(flag => (
                  <div key={flag.rule} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                    <div>
                      <FlagBadge flag={flag} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginLeft: 8 }}>+{flag.points} pts</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{flag.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {peerMean !== null && (
            <div style={{ marginBottom: 20, background: 'var(--bg-base)', border: '1px solid var(--border)', padding: '12px 16px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em', marginBottom: 10 }}>PEER COMPARISON</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>THIS TXN</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13 }}>${selectedTxn.amount.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>VENDOR AVG</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13 }}>${Math.round(peerMean).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 3 }}>DEVIATION</div>
                  <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: Math.abs(parseFloat(deviation)) > 50 ? 'var(--critical)' : 'var(--medium)' }}>
                    {parseFloat(deviation) > 0 ? '+' : ''}{deviation}%
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={explainWithAI}
            disabled={aiLoading}
            style={{
              width: '100%', background: aiLoading ? 'var(--accent-dim)' : 'var(--bg-base)',
              border: '1px solid var(--accent)', color: 'var(--accent)',
              padding: '10px', fontSize: 12, fontFamily: 'IBM Plex Mono',
              fontWeight: 600, cursor: aiLoading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.05em', marginBottom: 4
            }}
          >
            {aiLoading ? '■ ANALYZING...' : '▶ EXPLAIN WITH AI'}
          </button>

          {aiError && (
            <div style={{ padding: '8px 12px', background: 'rgba(224,82,82,0.1)', border: '1px solid var(--critical)', fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--critical)', marginBottom: 16 }}>
              {aiError}
            </div>
          )}
          {(aiLoading || aiText) && <AIResponse text={aiText} loading={aiLoading} />}

          <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em', marginBottom: 12 }}>ACTIONS</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'APPROVE', status: 'approved', color: 'var(--low)' },
                { label: 'ESCALATE', status: 'escalated', color: 'var(--critical)' },
                { label: 'FOLLOW-UP', status: 'followup', color: 'var(--medium)' }
              ].map(action => (
                <button
                  key={action.status}
                  onClick={() => updateReviewState(selectedTxn.txn_id, { status: state.status === action.status ? null : action.status })}
                  style={{
                    border: `1px solid ${action.color}`,
                    background: state.status === action.status ? action.color : 'transparent',
                    color: state.status === action.status ? '#000' : action.color,
                    padding: '8px 16px', fontSize: 11, fontFamily: 'IBM Plex Mono',
                    fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em'
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>

            {state.note && (
              <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', padding: '10px 12px', marginBottom: 10, fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-secondary)' }}>
                NOTE: {state.note}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNote()}
                placeholder="Add note..."
                style={{
                  flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', padding: '8px 12px', fontSize: 12,
                  fontFamily: 'IBM Plex Mono', outline: 'none'
                }}
              />
              <button
                onClick={addNote}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '8px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', cursor: 'pointer' }}
              >
                ADD
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
