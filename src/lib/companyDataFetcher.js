// Requests go through proxy paths in dev (Vite) and prod (Vercel rewrites).
// If the proxy is unavailable, data.sec.gov APIs are also tried directly —
// data.sec.gov sends proper CORS headers unlike www.sec.gov.

const SEC_DATA_BASE = '/api/sec-data'

// ─── Hardcoded CIK table for the most-searched tickers ───────────────────────
// These allow zero-network CIK resolution for common stocks.
// CIKs are stable permanent identifiers assigned by the SEC.
const KNOWN_TICKERS = {
  AAPL:  { cik: '0000320193', name: 'Apple Inc.' },
  MSFT:  { cik: '0000789019', name: 'Microsoft Corporation' },
  GOOGL: { cik: '0001652044', name: 'Alphabet Inc.' },
  GOOG:  { cik: '0001652044', name: 'Alphabet Inc.' },
  AMZN:  { cik: '0001018724', name: 'Amazon.com Inc.' },
  META:  { cik: '0001326801', name: 'Meta Platforms Inc.' },
  TSLA:  { cik: '0001318605', name: 'Tesla Inc.' },
  NVDA:  { cik: '0001045810', name: 'NVIDIA Corporation' },
  NFLX:  { cik: '0001065280', name: 'Netflix Inc.' },
  JPM:   { cik: '0000019617', name: 'JPMorgan Chase & Co.' },
  BAC:   { cik: '0000070858', name: 'Bank of America Corporation' },
  WMT:   { cik: '0000104169', name: 'Walmart Inc.' },
  JNJ:   { cik: '0000200406', name: 'Johnson & Johnson' },
  XOM:   { cik: '0000034088', name: 'Exxon Mobil Corporation' },
  V:     { cik: '0001403161', name: 'Visa Inc.' },
  MA:    { cik: '0001141391', name: 'Mastercard Incorporated' },
  BRK:   { cik: '0001067983', name: 'Berkshire Hathaway Inc.' },
  UNH:   { cik: '0000731766', name: 'UnitedHealth Group Incorporated' },
  PG:    { cik: '0000080424', name: 'Procter & Gamble Co.' },
  HD:    { cik: '0000354950', name: 'Home Depot Inc.' },
  INTC:  { cik: '0000050863', name: 'Intel Corporation' },
  AMD:   { cik: '0000002488', name: 'Advanced Micro Devices Inc.' },
  PYPL:  { cik: '0001633917', name: 'PayPal Holdings Inc.' },
  DIS:   { cik: '0001001039', name: 'Walt Disney Co.' },
  BABA:  { cik: '0001577552', name: 'Alibaba Group Holding Ltd.' },
  CRM:   { cik: '0001108524', name: 'Salesforce Inc.' },
  ORCL:  { cik: '0001341439', name: 'Oracle Corporation' },
  CSCO:  { cik: '0000858877', name: 'Cisco Systems Inc.' },
  IBM:   { cik: '0000051143', name: 'International Business Machines Corp.' },
  GE:    { cik: '0000040533', name: 'General Electric Company' },
}

let tickerMapCache = null

// ─── CIK Resolution ───────────────────────────────────────────────────────────

export async function resolveToCIK(query) {
  const q = query.trim().toUpperCase()
  const qLower = query.trim().toLowerCase()

  // 1. Accept direct CIK input (7–10 digit number)
  if (/^\d{7,10}$/.test(query.trim())) {
    const cik = query.trim().padStart(10, '0')
    return { cik, ticker: cik, name: `CIK ${cik}` }
  }

  // 2. Check hardcoded known-ticker table (instant, no network)
  if (KNOWN_TICKERS[q]) {
    const entry = KNOWN_TICKERS[q]
    return { cik: entry.cik, ticker: q, name: entry.name }
  }

  // 3. Try full ticker map via proxy (/api/sec-tickers → www.sec.gov)
  if (!tickerMapCache) {
    try {
      const res = await Promise.race([
        fetch('/api/sec-tickers'),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
      ])
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
    // Exact ticker match
    for (const entry of Object.values(tickerMapCache)) {
      if (entry.ticker.toUpperCase() === q) {
        return {
          cik: String(entry.cik_str).padStart(10, '0'),
          ticker: entry.ticker.toUpperCase(),
          name: entry.title
        }
      }
    }
    // Fuzzy name match
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

  // 4. Ticker map unavailable or no match
  throw new Error(
    `Company "${query}" not found.\n\n` +
    `Try:\n` +
    `• A known ticker: AAPL, MSFT, TSLA, NVDA, META, AMZN, GOOGL\n` +
    `• The full legal company name\n` +
    `• The 10-digit SEC CIK number (e.g. 0000320193 for Apple)`
  )
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

async function secFetch(path) {
  // Try proxy path first, fall back to direct data.sec.gov (CORS-enabled)
  let res
  try {
    res = await fetch(`${SEC_DATA_BASE}${path}`)
    if (res.ok) return res
  } catch { /* proxy unavailable */ }

  // Direct fallback — data.sec.gov does send CORS headers
  res = await fetch(`https://data.sec.gov${path}`)
  if (res.status === 429) {
    const err = new Error('SEC_RATE_LIMIT')
    err.code = 'SEC_RATE_LIMIT'
    throw err
  }
  if (!res.ok) throw new Error(`SEC request failed: ${res.status} for ${path}`)
  return res
}

export async function fetchSECFinancials(cik) {
  const res = await secFetch(`/api/xbrl/companyfacts/CIK${cik}.json`)
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
  const res = await secFetch(`/submissions/CIK${cik}.json`)
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
  let res
  try {
    res = await secFetch(`/submissions/CIK${cik}.json`)
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

// ─── Price Data ───────────────────────────────────────────────────────────────

export async function fetchPriceData(ticker) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1mo&range=2y`
    )
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
