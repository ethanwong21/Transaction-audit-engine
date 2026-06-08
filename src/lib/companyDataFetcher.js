// All SEC requests go through local proxy paths so CORS is never an issue.
// Dev:  Vite dev server proxies /api/sec-* → the respective SEC domain.
// Prod: Vercel edge rewrites /api/sec-* → the respective SEC domain server-side.

const SEC_TICKERS_URL = '/api/sec-tickers'
const SEC_DATA_BASE = '/api/sec-data'
const SEC_EFTS_BASE = '/api/sec-efts'

let tickerMapCache = null

// ─── CIK Resolution ───────────────────────────────────────────────────────────

async function resolveViaSECSearch(query) {
  // EDGAR EFTS full-text search — accession number _id always starts with 10-digit CIK
  const encoded = encodeURIComponent('"' + query + '"')
  const url = `${SEC_EFTS_BASE}/LATEST/search-index?q=${encoded}&forms=10-K&dateRange=custom&startdt=2018-01-01&enddt=2024-12-31`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Company not found: "${query}". Try the full legal name or ticker symbol.`)

  const data = await res.json()
  const hits = data?.hits?.hits || []
  if (!hits.length) throw new Error(`Company not found: "${query}". Try the full legal name or ticker symbol.`)

  const hit = hits[0]
  // _id is like "0000320193-23-000106" → strip dashes → first 10 chars = CIK
  const rawId = (hit._id || '').replace(/-/g, '')
  const cik = rawId.slice(0, 10).padStart(10, '0')
  const name = hit._source?.entity_name || query

  if (!cik || cik === '0000000000') {
    throw new Error(`Company not found: "${query}". Try the full legal name or ticker symbol.`)
  }

  return { cik, ticker: query.toUpperCase(), name }
}

export async function resolveToCIK(query) {
  const q = query.trim().toUpperCase()
  const qLower = query.trim().toLowerCase()

  if (!tickerMapCache) {
    try {
      const res = await fetch(SEC_TICKERS_URL)
      if (res.ok) {
        tickerMapCache = await res.json()
      } else {
        tickerMapCache = {}
      }
    } catch {
      tickerMapCache = {}
    }
  }

  if (tickerMapCache && Object.keys(tickerMapCache).length > 0) {
    for (const entry of Object.values(tickerMapCache)) {
      if (entry.ticker.toUpperCase() === q) {
        return {
          cik: String(entry.cik_str).padStart(10, '0'),
          ticker: entry.ticker.toUpperCase(),
          name: entry.title
        }
      }
    }
    for (const entry of Object.values(tickerMapCache)) {
      if (entry.title.toLowerCase().includes(qLower)) {
        return {
          cik: String(entry.cik_str).padStart(10, '0'),
          ticker: entry.ticker.toUpperCase(),
          name: entry.title
        }
      }
    }
  }

  // Ticker map unavailable or no match — fall back to EFTS search
  return resolveViaSECSearch(query)
}

// ─── SEC Financials ───────────────────────────────────────────────────────────

const FINANCIAL_CONCEPTS = [
  { key: 'Revenues', label: 'Revenue' },
  { key: 'RevenueFromContractWithCustomerExcludingAssessedTax', label: 'Revenue' },
  { key: 'NetIncomeLoss', label: 'Net Income' },
  { key: 'OperatingExpenses', label: 'Operating Expenses' },
  { key: 'OperatingCostsAndExpenses', label: 'Operating Expenses' },
  { key: 'Assets', label: 'Total Assets' },
  { key: 'Liabilities', label: 'Total Liabilities' },
  { key: 'StockholdersEquity', label: "Stockholders' Equity" }
]

export async function fetchSECFinancials(cik) {
  const url = `${SEC_DATA_BASE}/api/xbrl/companyfacts/CIK${cik}.json`
  const res = await fetch(url)

  if (res.status === 429) {
    const err = new Error('SEC_RATE_LIMIT')
    err.code = 'SEC_RATE_LIMIT'
    throw err
  }
  if (!res.ok) throw new Error(`SEC financials fetch failed: ${res.status}`)

  const data = await res.json()
  const usGaap = data['facts']?.['us-gaap'] || {}
  const extracted = {}

  for (const concept of FINANCIAL_CONCEPTS) {
    if (extracted[concept.label]) continue
    const conceptData = usGaap[concept.key]
    if (!conceptData) continue

    const usdData = conceptData.units?.USD || conceptData.units?.shares || null
    if (!usdData) continue

    const periods = usdData
      .filter(d => (d.form === '10-Q' || d.form === '10-K') && d.end && d.val !== undefined)
      .sort((a, b) => a.end.localeCompare(b.end))
      .slice(-12)

    if (periods.length) extracted[concept.label] = { concept: concept.key, periods }
  }

  return extracted
}

// ─── SEC Filings ──────────────────────────────────────────────────────────────

export async function fetchSECFilings(cik) {
  const url = `${SEC_DATA_BASE}/submissions/CIK${cik}.json`
  const res = await fetch(url)

  if (res.status === 429) {
    const err = new Error('SEC_RATE_LIMIT')
    err.code = 'SEC_RATE_LIMIT'
    throw err
  }
  if (!res.ok) throw new Error(`SEC filings fetch failed: ${res.status}`)

  const data = await res.json()
  const recent = data.filings?.recent || {}

  const forms = recent.form || []
  const dates = recent.filingDate || []
  const accessions = recent.accessionNumber || []

  const filings = []
  for (let i = 0; i < Math.min(forms.length, 50) && filings.length < 20; i++) {
    filings.push({ form: forms[i], date: dates[i], accessionNumber: accessions[i] })
  }

  const companyInfo = {
    name: data.name,
    sic: data.sic,
    sicDescription: data.sicDescription,
    stateOfIncorporation: data.stateOfIncorporation,
    exchanges: data.exchanges || [],
    tickers: data.tickers || []
  }

  return { filings, companyInfo }
}

// ─── Insider Trades ───────────────────────────────────────────────────────────

export async function fetchInsiderTrades(cik) {
  // Reuses same submissions endpoint — filtered for Form 4
  const url = `${SEC_DATA_BASE}/submissions/CIK${cik}.json`
  let res
  try {
    res = await fetch(url)
    if (!res.ok) return []
  } catch {
    return []
  }

  const data = await res.json()
  const recent = data.filings?.recent || {}
  const forms = recent.form || []
  const dates = recent.filingDate || []
  const accessions = recent.accessionNumber || []

  const trades = []
  for (let i = 0; i < forms.length && trades.length < 20; i++) {
    if (forms[i] === '4') {
      trades.push({ form: '4', date: dates[i], accessionNumber: accessions[i] })
    }
  }
  return trades
}

// ─── Price Data (best-effort, will be CORS-blocked in browser) ───────────────

export async function fetchPriceData(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1mo&range=2y`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null
    return {
      timestamps: result.timestamp,
      closes: result.indicators?.quote?.[0]?.close || [],
      currency: result.meta?.currency,
      exchange: result.meta?.exchangeName
    }
  } catch {
    return null
  }
}

// ─── Transaction Mapping ──────────────────────────────────────────────────────

export function mapToTransactions(secFinancials, secFilings, insiderTrades, ticker, companyName) {
  const transactions = []

  for (const [label, data] of Object.entries(secFinancials)) {
    for (const period of data.periods) {
      transactions.push({
        txn_id: `SEC-${ticker}-${data.concept}-${period.end}`,
        date: period.end,
        amount: Math.abs(period.val),
        vendor: companyName,
        department: label,
        description: `${period.form} filing — ${label} for ${period.end}`,
        account_code: data.concept,
        payment_method: 'SEC_FILING',
        approver: 'SEC_EDGAR',
        submitted_by: ticker
      })
    }
  }

  for (const filing of secFilings) {
    transactions.push({
      txn_id: `FIL-${ticker}-${filing.accessionNumber.replace(/-/g, '')}`,
      date: filing.date,
      amount: 0,
      vendor: companyName,
      department: 'SEC Filing',
      description: `${filing.form} filed on ${filing.date}`,
      account_code: filing.form,
      payment_method: 'SEC_FILING',
      approver: 'SEC_EDGAR',
      submitted_by: ticker
    })
  }

  for (const trade of insiderTrades) {
    transactions.push({
      txn_id: `INS-${ticker}-${trade.accessionNumber.replace(/-/g, '')}`,
      date: trade.date,
      amount: 0,
      vendor: 'Insider',
      department: 'Insider Trading',
      description: 'Form 4 filed — insider transaction reported',
      account_code: 'FORM_4',
      payment_method: 'INSIDER_TRADE',
      approver: 'SEC_EDGAR',
      submitted_by: ticker
    })
  }

  return transactions
}
