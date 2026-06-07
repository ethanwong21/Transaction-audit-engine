const departments = ['Engineering', 'Marketing', 'Finance', 'Operations', 'Legal', 'HR', 'Sales', 'IT']

const accountCodes = {
  Engineering: ['ENG-4100', 'ENG-4200', 'ENG-4300'],
  Marketing: ['MKT-5100', 'MKT-5200', 'MKT-5300'],
  Finance: ['FIN-6100', 'FIN-6200', 'FIN-6300'],
  Operations: ['OPS-7100', 'OPS-7200', 'OPS-7300'],
  Legal: ['LEG-8100', 'LEG-8200', 'LEG-8300'],
  HR: ['HR-9100', 'HR-9200', 'HR-9300'],
  Sales: ['SAL-3100', 'SAL-3200', 'SAL-3300'],
  IT: ['IT-2100', 'IT-2200', 'IT-2300']
}

const vendors = [
  'Accenture Solutions', 'AWS Cloud Services', 'Microsoft Enterprise', 'Salesforce Inc',
  'Oracle Corporation', 'ServiceNow', 'Workday HCM', 'Zendesk Support',
  'Slack Technologies', 'Zoom Communications', 'DocuSign Corp', 'Dropbox Business',
  'Adobe Systems', 'Atlassian', 'GitHub Enterprise', 'DataDog Monitoring',
  'Snowflake Inc', 'Tableau Software', 'HubSpot CRM', 'Intercom',
  'Stripe Payments', 'Twilio Inc', 'SendGrid', 'Cloudflare',
  'New Relic', 'PagerDuty', 'Splunk Enterprise', 'Elastic Search',
  'MongoDB Atlas', 'Okta Security'
]

const oneTimeVendors = [
  'Meridian Capital Advisors',
  'Nexus Strategic Partners',
  'Apex Global Consulting'
]

const paymentMethods = ['ACH', 'Wire Transfer', 'Corporate Card', 'Check', 'EFT']

const approvers = ['J. Mitchell', 'S. Rodriguez', 'K. Thompson', 'A. Patel', 'L. Chen', 'R. Williams']

const submitters = ['m.johnson', 'a.smith', 'r.garcia', 'l.brown', 'j.davis', 'k.wilson', 'p.martinez', 'c.lee']

const normalDescriptions = [
  'Monthly SaaS subscription', 'Q3 vendor payment', 'Professional services',
  'Software license renewal', 'Consulting services Q4', 'Annual maintenance contract',
  'Infrastructure services', 'Support contract renewal', 'Training services',
  'Implementation services', 'Data services monthly', 'Platform license fee',
  'Integration services', 'Security audit services', 'Cloud infrastructure Q3',
  'Analytics platform fee', 'Development tools license', 'Operations support',
  'API usage fees', 'Managed services contract'
]

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function randomAmount(min, max, round = false) {
  const amt = randomBetween(min, max)
  if (round) return Math.round(amt / 1000) * 1000
  return Math.round(amt * 100) / 100
}

let txnCounter = 1000

function makeTxn(overrides = {}) {
  const dept = overrides.department || randomChoice(departments)
  const codes = accountCodes[dept]
  const date = overrides.date || formatDate(addDays(new Date('2024-01-01'), Math.floor(Math.random() * 365)))
  const id = `TXN-${txnCounter++}`
  return {
    txn_id: id,
    date,
    amount: overrides.amount || randomAmount(500, 15000),
    vendor: overrides.vendor || randomChoice(vendors),
    department: dept,
    description: overrides.description || randomChoice(normalDescriptions),
    account_code: overrides.account_code || randomChoice(codes),
    payment_method: overrides.payment_method || randomChoice(paymentMethods),
    approver: overrides.approver || randomChoice(approvers),
    submitted_by: overrides.submitted_by || randomChoice(submitters)
  }
}

function getWeekendDate(baseYear = 2024) {
  const start = new Date(`${baseYear}-01-01`)
  for (let attempt = 0; attempt < 1000; attempt++) {
    const d = addDays(start, Math.floor(Math.random() * 365))
    if (d.getDay() === 0 || d.getDay() === 6) return formatDate(d)
  }
  return '2024-01-06' // fallback saturday
}

export function generateTransactions() {
  const transactions = []

  // 150 normal transactions
  for (let i = 0; i < 150; i++) {
    transactions.push(makeTxn())
  }

  // 8-10 duplicate amount+vendor pairs within 7 days
  const dupVendors = vendors.slice(0, 5)
  for (let i = 0; i < 9; i++) {
    const vendor = dupVendors[i % dupVendors.length]
    const baseDate = addDays(new Date('2024-02-01'), i * 20)
    const amount = randomAmount(3000, 12000)
    const dept = randomChoice(departments)
    transactions.push(makeTxn({ vendor, amount, date: formatDate(baseDate), department: dept }))
    const closeDate = addDays(baseDate, Math.floor(randomBetween(1, 6)))
    transactions.push(makeTxn({ vendor, amount, date: formatDate(closeDate), department: dept }))
  }

  // 6-8 weekend transactions above $5,000
  for (let i = 0; i < 7; i++) {
    transactions.push(makeTxn({
      date: getWeekendDate(),
      amount: randomAmount(5500, 25000)
    }))
  }

  // 5 vague descriptions
  const vagueDescs = ['misc', 'other', 'adjustment', 'n/a', 'tbd']
  for (let i = 0; i < 5; i++) {
    transactions.push(makeTxn({ description: vagueDescs[i] }))
  }

  // 4 round-number transactions above $50,000
  for (let i = 0; i < 4; i++) {
    transactions.push(makeTxn({ amount: randomAmount(50000, 150000, true) }))
  }

  // 3 one-time high-value vendors (>$20K, appears once)
  for (const vendor of oneTimeVendors) {
    transactions.push(makeTxn({
      vendor,
      amount: randomAmount(22000, 85000)
    }))
  }

  // 2 department/account_code mismatches
  const mismatch1Dept = 'Engineering'
  const mismatch1Code = randomChoice(accountCodes['Marketing'])
  transactions.push(makeTxn({ department: mismatch1Dept, account_code: mismatch1Code, amount: randomAmount(2000, 8000) }))

  const mismatch2Dept = 'Finance'
  const mismatch2Code = randomChoice(accountCodes['HR'])
  transactions.push(makeTxn({ department: mismatch2Dept, account_code: mismatch2Code, amount: randomAmount(1500, 6000) }))

  // Shuffle
  for (let i = transactions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [transactions[i], transactions[j]] = [transactions[j], transactions[i]]
  }

  return transactions.slice(0, 200)
}
