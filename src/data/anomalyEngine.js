function mean(values) {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stddev(values) {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / values.length
  return Math.sqrt(variance)
}

function daysBetween(d1, d2) {
  const t1 = new Date(d1).getTime()
  const t2 = new Date(d2).getTime()
  return Math.abs(t1 - t2) / (1000 * 60 * 60 * 24)
}

function isWeekend(dateStr) {
  const d = new Date(dateStr)
  const day = d.getDay()
  return day === 0 || day === 6
}

function isVague(description) {
  if (!description) return false
  const lower = description.toLowerCase().trim()
  return /^(misc|other|adj|adjustment|n\/a|na|tbd)$/.test(lower)
}

function isRoundNumber(amount) {
  return amount >= 10000 && amount % 1000 === 0
}

export function runAnomalyDetection(transactions) {
  const results = {}

  // Precompute vendor stats
  const vendorAmounts = {}
  const vendorCount = {}
  for (const t of transactions) {
    if (!vendorAmounts[t.vendor]) vendorAmounts[t.vendor] = []
    vendorAmounts[t.vendor].push(t.amount)
    vendorCount[t.vendor] = (vendorCount[t.vendor] || 0) + 1
  }

  const vendorStats = {}
  for (const [vendor, amounts] of Object.entries(vendorAmounts)) {
    vendorStats[vendor] = {
      mean: mean(amounts),
      std: stddev(amounts),
      count: amounts.length
    }
  }

  // Precompute dept+account_code pairs seen frequently
  const pairCounts = {}
  for (const t of transactions) {
    const key = `${t.department}|${t.account_code}`
    pairCounts[key] = (pairCounts[key] || 0) + 1
  }

  for (const txn of transactions) {
    const flags = []
    let score = 0

    // STATISTICAL_OUTLIER: amount > 2 std devs from vendor mean
    const vs = vendorStats[txn.vendor]
    if (vs && vs.std > 0 && Math.abs(txn.amount - vs.mean) > 2 * vs.std) {
      flags.push({ rule: 'STATISTICAL_OUTLIER', label: 'Statistical Outlier', severity: 'High', points: 35 })
      score += 35
    }

    // DUPLICATE_RISK: same amount + vendor within 7 days
    const duplicateMatch = transactions.find(other =>
      other.txn_id !== txn.txn_id &&
      other.vendor === txn.vendor &&
      Math.abs(other.amount - txn.amount) < 0.01 &&
      daysBetween(other.date, txn.date) <= 7
    )
    if (duplicateMatch) {
      flags.push({ rule: 'DUPLICATE_RISK', label: 'Duplicate Risk', severity: 'High', points: 40, matchId: duplicateMatch.txn_id })
      score += 40
    }

    // WEEKEND_ACTIVITY
    if (isWeekend(txn.date)) {
      flags.push({ rule: 'WEEKEND_ACTIVITY', label: 'Weekend Activity', severity: 'Medium', points: 20 })
      score += 20
    }

    // VAGUE_DESCRIPTION
    if (isVague(txn.description)) {
      flags.push({ rule: 'VAGUE_DESCRIPTION', label: 'Vague Description', severity: 'Medium', points: 25 })
      score += 25
    }

    // ROUND_NUMBER
    if (isRoundNumber(txn.amount)) {
      flags.push({ rule: 'ROUND_NUMBER', label: 'Round Number', severity: 'Low', points: 15 })
      score += 15
    }

    // NEW_VENDOR: appears < 3 times
    if (vendorCount[txn.vendor] < 3) {
      flags.push({ rule: 'NEW_VENDOR', label: 'New Vendor', severity: 'Low', points: 10 })
      score += 10
    }

    // HIGH_VALUE
    if (txn.amount > 50000) {
      flags.push({ rule: 'HIGH_VALUE', label: 'High Value', severity: 'High', points: 30 })
      score += 30
    }

    // CONTROL_EXCEPTION: dept/account_code pair unseen elsewhere (appears only once)
    const pairKey = `${txn.department}|${txn.account_code}`
    if (pairCounts[pairKey] === 1) {
      flags.push({ rule: 'CONTROL_EXCEPTION', label: 'Control Exception', severity: 'High', points: 35 })
      score += 35
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

export function getVendorStats(transactions) {
  const stats = {}
  for (const t of transactions) {
    if (!stats[t.vendor]) stats[t.vendor] = { amounts: [], flagCount: 0, txnIds: [] }
    stats[t.vendor].amounts.push(t.amount)
    stats[t.vendor].txnIds.push(t.txn_id)
  }
  return stats
}
