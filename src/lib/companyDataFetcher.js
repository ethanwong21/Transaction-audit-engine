const SEC_HEADERS = { 'User-Agent': 'TransactionAuditEngine contact@example.com' }

// Cached ticker map to avoid re-fetching
let tickerMapCache = null

export async function resolveToCIK(query) {
  if (!tickerMapCache) {
    const res = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: SEC_HEADERS })
    if (!res.ok) throw new Error(`Failed to fetch ticker map: ${res.status}`)
    tickerMapCache = await res.json()
  }

  const q = query.trim().toUpperCase()
  const qLower = query.trim().toLowerCase()

  // Exact ticker match first
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

  throw new Error(`Company not found: "${query}". Try the full legal name or ticker symbol.`)
}

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
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`
  const res = await fetch(url, { headers: SEC_HEADERS })

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
    if (extracted[concept.label]) continue // already got this label from a prior alias
    const conceptData = usGaap[concept.key]
    if (!conceptData) continue

    const units = conceptData.units
    const usdData = units?.USD || units?.shares || null
    if (!usdData) continue

    // Prefer 10-Q and 10-K entries with end dates, take last 12
    const periods = usdData
      .filter(d => d.form === '10-Q' || d.form === '10-K')
      .filter(d => d.end && d.val !== undefined)
      .sort((a, b) => a.end.localeCompare(b.end))
      .slice(-12)

    if (periods.length) {
      extracted[concept.label] = { concept: concept.key, periods }
    }
  }

  return extracted
}

export async function fetchSECFilings(cik) {
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`
  const res = await fetch(url, { headers: SEC_HEADERS })

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
  for (let i = 0; i < Math.min(forms.length, 50); i++) {
    filings.push({
      form: forms[i],
      date: dates[i],
      accessionNumber: accessions[i]
    })
  }

  const companyInfo = {
    name: data.name,
    sic: data.sic,
    sicDescription: data.sicDescription,
    stateOfIncorporation: data.stateOfIncorporation,
    exchanges: data.exchanges || [],
    tickers: data.tickers || []
  }

  return { filings: filings.slice(0, 20), companyInfo }
}

export async function fetchInsiderTrades(cik) {
  // Reuse the submissions data — filter for Form 4
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`
  const res = await fetch(url, { headers: SEC_HEADERS })
  if (!res.ok) return []

  const data = await res.json()
  const recent = data.filings?.recent || {}
  const forms = recent.form || []
  const dates = recent.filingDate || []
  const accessions = recent.accessionNumber || []

  const trades = []
  for (let i = 0; i < forms.length && trades.length < 20; i++) {
    if (forms[i] === '4') {
      trades.push({
        form: '4',
        date: dates[i],
        accessionNumber: accessions[i]
      })
    }
  }
  return trades
}

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

export function mapToTransactions(secFinancials, secFilings, insiderTrades, ticker, companyName) {
  const transactions = []

  // Map SEC quarterly financials
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

  // Map SEC filings metadata
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

  // Map insider trades
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
