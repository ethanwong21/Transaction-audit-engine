import { runAnomalyDetection } from '../data/anomalyEngine'

function daysBetween(d1, d2) {
  return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / (1000 * 60 * 60 * 24)
}

function isWeekend(dateStr) {
  const d = new Date(dateStr)
  return d.getDay() === 0 || d.getDay() === 6
}

export function runFinancialAnomalyDetection(transactions, allTransactions) {
  // Start with base rules
  const baseResults = runAnomalyDetection(allTransactions || transactions)

  // Group financial data by department (concept label) sorted by date for trend analysis
  const byDept = {}
  for (const t of transactions) {
    if (!byDept[t.department]) byDept[t.department] = []
    byDept[t.department].push(t)
  }
  for (const key of Object.keys(byDept)) {
    byDept[key].sort((a, b) => a.date.localeCompare(b.date))
  }

  // Revenue periods for sustained decline check
  const revenueKey = Object.keys(byDept).find(k => k === 'Revenue') || null
  const revenuePeriods = revenueKey ? byDept[revenueKey] : []

  // Net income periods for profit swing
  const netIncomeKey = Object.keys(byDept).find(k => k === 'Net Income') || null
  const netIncomePeriods = netIncomeKey ? byDept[netIncomeKey] : []

  // Operating expenses periods
  const opexKey = Object.keys(byDept).find(k => k === 'Operating Expenses') || null
  const opexPeriods = opexKey ? byDept[opexKey] : []

  // Assets and Liabilities
  const assetPeriods = byDept['Total Assets'] || []
  const liabilityPeriods = byDept['Total Liabilities'] || []

  // Insider trade transactions
  const insiderTxns = transactions.filter(t => t.payment_method === 'INSIDER_TRADE')

  const results = {}

  for (const txn of transactions) {
    const base = baseResults[txn.txn_id] || { score: 0, tier: 'Clean', flags: [] }
    const flags = [...base.flags]
    let score = base.score

    // ─── REVENUE_DECLINE: revenue declined >20% vs prior period ─────────────
    if (txn.department === 'Revenue' && revenuePeriods.length >= 2) {
      const idx = revenuePeriods.findIndex(t => t.txn_id === txn.txn_id)
      if (idx > 0) {
        const prev = revenuePeriods[idx - 1].amount
        if (prev > 0 && txn.amount < prev * 0.8) {
          flags.push({ rule: 'REVENUE_DECLINE', label: 'Revenue Decline >20%', severity: 'High', points: 35 })
          score += 35
        }
      }
    }

    // ─── PROFIT_SWING: net income swung from positive to negative ────────────
    if (txn.department === 'Net Income' && netIncomePeriods.length >= 2) {
      const idx = netIncomePeriods.findIndex(t => t.txn_id === txn.txn_id)
      if (idx > 0) {
        const prevRaw = netIncomePeriods[idx - 1]
        // We stored abs value; check description for sign clues — use amount comparison heuristic
        // If this period's amount is 0 and prior was significant, treat as swing
        if (txn.amount === 0 && prevRaw.amount > 0) {
          flags.push({ rule: 'PROFIT_SWING', label: 'Profit → Loss Swing', severity: 'High', points: 40 })
          score += 40
        }
      }
    }

    // ─── LARGE_INSIDER_SELL: amount > $1M and insider trade ──────────────────
    if (txn.payment_method === 'INSIDER_TRADE' && txn.amount > 1_000_000) {
      flags.push({ rule: 'LARGE_INSIDER_SELL', label: 'Large Insider Trade', severity: 'High', points: 35 })
      score += 35
    }

    // ─── INSIDER_SELL_CLUSTER: 3+ insider trades within 30 days ─────────────
    if (txn.payment_method === 'INSIDER_TRADE') {
      const nearbyTrades = insiderTxns.filter(
        other => other.txn_id !== txn.txn_id && daysBetween(other.date, txn.date) <= 30
      )
      if (nearbyTrades.length >= 2) {
        flags.push({ rule: 'INSIDER_SELL_CLUSTER', label: 'Insider Trade Cluster', severity: 'High', points: 30 })
        score += 30
      }
    }

    // ─── EXPENSE_CREEP: opex growth > revenue growth same period ─────────────
    if (txn.department === 'Operating Expenses' && opexPeriods.length >= 2 && revenuePeriods.length >= 2) {
      const opIdx = opexPeriods.findIndex(t => t.txn_id === txn.txn_id)
      if (opIdx > 0) {
        const prevOpex = opexPeriods[opIdx - 1].amount
        const opexGrowth = prevOpex > 0 ? (txn.amount - prevOpex) / prevOpex : 0

        // Find closest revenue period by date
        const closestRev = revenuePeriods.reduce((best, r) => {
          const d = Math.abs(new Date(r.date).getTime() - new Date(txn.date).getTime())
          return d < Math.abs(new Date(best.date).getTime() - new Date(txn.date).getTime()) ? r : best
        }, revenuePeriods[0])
        const closestRevIdx = revenuePeriods.indexOf(closestRev)

        if (closestRevIdx > 0) {
          const prevRev = revenuePeriods[closestRevIdx - 1].amount
          const revGrowth = prevRev > 0 ? (closestRev.amount - prevRev) / prevRev : 0
          if (opexGrowth > revGrowth && opexGrowth > 0) {
            flags.push({ rule: 'EXPENSE_CREEP', label: 'Expense Creep', severity: 'Medium', points: 25 })
            score += 25
          }
        }
      }
    }

    // ─── BALANCE_SHEET_STRESS: liabilities > assets same period ─────────────
    if (txn.department === 'Total Liabilities' && assetPeriods.length > 0) {
      const closestAsset = assetPeriods.reduce((best, a) => {
        const d = Math.abs(new Date(a.date).getTime() - new Date(txn.date).getTime())
        return d < Math.abs(new Date(best.date).getTime() - new Date(txn.date).getTime()) ? a : best
      }, assetPeriods[0])
      if (txn.amount > closestAsset.amount && closestAsset.amount > 0) {
        flags.push({ rule: 'BALANCE_SHEET_STRESS', label: 'Liabilities > Assets', severity: 'High', points: 40 })
        score += 40
      }
    }

    // ─── WEEKEND_FILING: filing date on Saturday or Sunday ───────────────────
    if (txn.payment_method === 'SEC_FILING' && isWeekend(txn.date)) {
      // Only add if base WEEKEND_ACTIVITY wasn't already caught
      if (!flags.some(f => f.rule === 'WEEKEND_ACTIVITY')) {
        flags.push({ rule: 'WEEKEND_FILING', label: 'Weekend Filing', severity: 'Low', points: 15 })
        score += 15
      }
    }

    // ─── SUSTAINED_DECLINE: 3+ consecutive periods declining revenue ─────────
    if (txn.department === 'Revenue' && revenuePeriods.length >= 4) {
      const idx = revenuePeriods.findIndex(t => t.txn_id === txn.txn_id)
      if (idx >= 3) {
        const isDecline3 =
          revenuePeriods[idx].amount < revenuePeriods[idx - 1].amount &&
          revenuePeriods[idx - 1].amount < revenuePeriods[idx - 2].amount &&
          revenuePeriods[idx - 2].amount < revenuePeriods[idx - 3].amount
        if (isDecline3) {
          flags.push({ rule: 'SUSTAINED_DECLINE', label: 'Sustained Revenue Decline', severity: 'High', points: 35 })
          score += 35
        }
      }
    }

    score = Math.min(score, 100)

    let tier
    if (score >= 75) tier = 'Critical'
    else if (score >= 50) tier = 'High'
    else if (score >= 25) tier = 'Medium'
    else if (score >= 1) tier = 'Low'
    else tier = 'Clean'

    results[txn.txn_id] = { score, tier, flags }
  }

  return results
}
