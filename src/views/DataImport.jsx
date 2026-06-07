import React, { useState, useRef } from 'react'
import Papa from 'papaparse'
import useAppStore from '../store/useAppStore'
import { generateTransactions } from '../data/generateData'
import { runAnomalyDetection } from '../data/anomalyEngine'

const REQUIRED_FIELDS = ['txn_id', 'date', 'amount', 'vendor', 'department', 'description', 'account_code', 'payment_method', 'approver', 'submitted_by']

const SCHEMA_EXAMPLE = `txn_id,date,amount,vendor,department,description,account_code,payment_method,approver,submitted_by
TXN-1001,2024-03-15,12500.00,Accenture Solutions,Engineering,Consulting services Q1,ENG-4100,Wire Transfer,J. Mitchell,m.johnson
TXN-1002,2024-03-16,8750.50,AWS Cloud Services,IT,Cloud infrastructure monthly,IT-2100,ACH,K. Thompson,a.smith`

export default function DataImport() {
  const setTransactions = useAppStore(s => s.setTransactions)
  const setAnalysisResults = useAppStore(s => s.setAnalysisResults)
  const transactions = useAppStore(s => s.transactions)

  const [dragging, setDragging] = useState(false)
  const [report, setReport] = useState(null)
  const [columnMap, setColumnMap] = useState({})
  const [parsedHeaders, setParsedHeaders] = useState([])
  const [parsedRows, setParsedRows] = useState([])
  const [showMap, setShowMap] = useState(false)
  const fileRef = useRef(null)

  function loadDemo() {
    const txns = generateTransactions()
    const results = runAnomalyDetection(txns)
    setTransactions(txns)
    setAnalysisResults(results)
    setReport({ type: 'demo', count: txns.length, flagged: Object.values(results).filter(r => r.tier !== 'Clean').length })
    setParsedHeaders([]); setParsedRows([]); setShowMap(false)
  }

  function processCSV(text) {
    const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true })
    if (result.errors.length) {
      setReport({ type: 'error', errors: result.errors.map(e => e.message) })
      return
    }
    const headers = result.meta.fields || []
    setParsedHeaders(headers)
    setParsedRows(result.data)

    const missing = REQUIRED_FIELDS.filter(f => !headers.includes(f))
    if (missing.length === 0) {
      applyData(result.data, {})
    } else {
      const initMap = {}
      for (const f of missing) initMap[f] = ''
      setColumnMap(initMap)
      setShowMap(true)
      setReport({ type: 'mapping', missing })
    }
  }

  function applyData(rows, map) {
    const errors = []
    const txns = rows.map((row, i) => {
      const t = {}
      for (const field of REQUIRED_FIELDS) {
        const src = map[field] || field
        t[field] = row[src]
      }
      if (!t.txn_id) errors.push(`Row ${i + 1}: missing txn_id`)
      if (isNaN(parseFloat(t.amount))) errors.push(`Row ${i + 1}: invalid amount`)
      t.amount = parseFloat(t.amount) || 0
      return t
    })

    if (errors.length > 5) {
      setReport({ type: 'error', errors: errors.slice(0, 10) }); return
    }

    const results = runAnomalyDetection(txns)
    setTransactions(txns)
    setAnalysisResults(results)
    const flagged = Object.values(results).filter(r => r.tier !== 'Clean').length
    setReport({ type: 'success', count: txns.length, flagged, warnings: errors })
    setShowMap(false)
  }

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => processCSV(e.target.result)
    reader.readAsText(file)
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) handleFile(file)
    else setReport({ type: 'error', errors: ['Only CSV files are supported.'] })
  }

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Data Import</h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
            {transactions.length > 0 ? `${transactions.length} transactions loaded` : 'No data loaded'}
          </div>
        </div>
        <button
          onClick={loadDemo}
          style={{ background: 'var(--accent)', border: 'none', color: '#fff', padding: '10px 20px', fontSize: 12, fontFamily: 'IBM Plex Mono', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em' }}
        >
          ▶ LOAD DEMO DATA
        </button>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'rgba(45,125,210,0.05)' : 'var(--bg-panel)',
          transition: 'all 0.2s', marginBottom: 24
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12, color: dragging ? 'var(--accent)' : 'var(--text-muted)' }}>⬆</div>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Drop CSV file here or click to browse</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>Accepts .csv format · UTF-8 encoding</div>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
      </div>

      {report && (
        <div style={{
          background: report.type === 'error' ? 'rgba(224,82,82,0.08)' : report.type === 'demo' || report.type === 'success' ? 'rgba(76,175,130,0.08)' : 'rgba(232,160,32,0.08)',
          border: `1px solid ${report.type === 'error' ? 'var(--critical)' : report.type === 'demo' || report.type === 'success' ? 'var(--low)' : 'var(--alert)'}`,
          padding: '16px 20px', marginBottom: 24
        }}>
          {report.type === 'demo' && (
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--low)' }}>
              ✓ Demo data loaded: {report.count} transactions, {report.flagged} flagged
            </div>
          )}
          {report.type === 'success' && (
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--low)' }}>
              ✓ Imported {report.count} transactions · {report.flagged} flagged
              {report.warnings?.length > 0 && (
                <div style={{ color: 'var(--medium)', marginTop: 8 }}>
                  {report.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                </div>
              )}
            </div>
          )}
          {report.type === 'error' && (
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--critical)' }}>
              {report.errors.map((e, i) => <div key={i}>✕ {e}</div>)}
            </div>
          )}
          {report.type === 'mapping' && (
            <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--alert)' }}>
              ⚠ Missing columns: {report.missing.join(', ')} — use the mapper below
            </div>
          )}
        </div>
      )}

      {showMap && parsedHeaders.length > 0 && (
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px', marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 16, fontFamily: 'IBM Plex Mono', color: 'var(--alert)' }}>
            COLUMN MAPPING — MAP YOUR CSV HEADERS TO REQUIRED FIELDS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {REQUIRED_FIELDS.map(field => (
              <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)', width: 120, flexShrink: 0 }}>{field}</span>
                <select
                  value={columnMap[field] || field}
                  onChange={e => setColumnMap(m => ({ ...m, [field]: e.target.value }))}
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 10px', fontSize: 12, fontFamily: 'IBM Plex Mono', flex: 1, outline: 'none' }}
                >
                  <option value="">-- select --</option>
                  {parsedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button
            onClick={() => applyData(parsedRows, columnMap)}
            style={{ background: 'var(--accent)', border: 'none', color: '#fff', padding: '10px 20px', fontSize: 12, fontFamily: 'IBM Plex Mono', fontWeight: 600, cursor: 'pointer' }}
          >
            ▶ APPLY MAPPING & IMPORT
          </button>
        </div>
      )}

      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '20px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.1em', marginBottom: 12 }}>EXPECTED SCHEMA</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 24px', marginBottom: 16 }}>
          {REQUIRED_FIELDS.map(f => (
            <div key={f} style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--accent)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              {f}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.08em', marginBottom: 8 }}>EXAMPLE</div>
        <pre style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-base)', border: '1px solid var(--border)', padding: '12px', overflowX: 'auto', lineHeight: 1.6 }}>
          {SCHEMA_EXAMPLE}
        </pre>
      </div>
    </div>
  )
}
