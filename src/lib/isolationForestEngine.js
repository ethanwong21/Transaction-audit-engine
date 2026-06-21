import { IsolationForest } from 'ml-isolation-forest'

function minMaxNormalize(matrix) {
  if (!matrix.length) return matrix
  const numFeatures = matrix[0].length
  const mins = Array(numFeatures).fill(Infinity)
  const maxs = Array(numFeatures).fill(-Infinity)

  for (const row of matrix) {
    for (let j = 0; j < numFeatures; j++) {
      if (row[j] < mins[j]) mins[j] = row[j]
      if (row[j] > maxs[j]) maxs[j] = row[j]
    }
  }

  return matrix.map(row =>
    row.map((v, j) => {
      const range = maxs[j] - mins[j]
      return range === 0 ? 0 : (v - mins[j]) / range
    })
  )
}

export function extractFeatures(transactions) {
  const vendorAmounts = {}
  const vendorLastDate = {}
  for (const t of transactions) {
    if (!vendorAmounts[t.vendor]) vendorAmounts[t.vendor] = []
    vendorAmounts[t.vendor].push(t.amount)
  }

  const vendorStats = {}
  for (const [vendor, amounts] of Object.entries(vendorAmounts)) {
    const m = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const std = Math.sqrt(amounts.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / amounts.length)
    vendorStats[vendor] = { mean: m, std, count: amounts.length }
  }

  // Sort by date for days-since-last calculation
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  const txnIds = []
  const featureMatrix = []

  for (const t of sorted) {
    const vs = vendorStats[t.vendor]
    const amountZscore = vs.std > 0 ? Math.abs((t.amount - vs.mean) / vs.std) : 0
    const d = new Date(t.date)
    const dayOfWeek = d.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0

    const daysSinceLast = vendorLastDate[t.vendor]
      ? (new Date(t.date) - new Date(vendorLastDate[t.vendor])) / (1000 * 60 * 60 * 24)
      : 365

    vendorLastDate[t.vendor] = t.date

    txnIds.push(t.txn_id)
    featureMatrix.push([
      t.amount,
      amountZscore,
      dayOfWeek,
      isWeekend,
      vs.count,
      (t.description || '').length,
      Math.min(daysSinceLast, 365)
    ])
  }

  return { featureMatrix, txnIds }
}

export function runIsolationForest(transactions) {
  if (transactions.length < 5) {
    return Object.fromEntries(transactions.map(t => [t.txn_id, 0]))
  }

  const { featureMatrix, txnIds } = extractFeatures(transactions)
  const normalized = minMaxNormalize(featureMatrix)

  const forest = new IsolationForest()
  forest.train(normalized)
  const scores = forest.predict(normalized)

  const result = {}
  for (let i = 0; i < txnIds.length; i++) {
    result[txnIds[i]] = scores[i]
  }
  return result
}
