function getEndpoint() {
  if (import.meta.env.PROD) return '/api/claude'
  return '/api/anthropic/v1/messages'
}

function getHeaders() {
  if (import.meta.env.PROD) {
    return { 'Content-Type': 'application/json' }
  }
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!key) throw new Error('VITE_ANTHROPIC_API_KEY is not set. Add it to your .env file.')
  return {
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01'
  }
}

async function callClaude(systemPrompt, userMessage) {
  const endpoint = getEndpoint()
  const headers = getHeaders()

  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  return data.content[0].text
}

export async function getAuditSummary(stats) {
  const system = `You are a senior internal audit AI assistant. You analyze financial transaction data and produce concise, professional audit summaries. Use precise language. Identify key risk themes, not just counts. Format with clear sections.`

  const user = `Analyze this audit run data and write a concise executive audit summary (3-4 paragraphs):

${JSON.stringify(stats, null, 2)}

Include: overall risk assessment, top concerns, recommended immediate actions, and control environment observations.`

  return callClaude(system, user)
}

export async function getTransactionExplanation(txn, flags, peerData) {
  const system = `You are a forensic accounting AI. You explain why specific transactions are flagged as anomalies. Be precise, analytical, and cite specific data points. Write 2-3 paragraphs.`

  const user = `Explain why this transaction was flagged and what audit risk it represents:

Transaction:
${JSON.stringify(txn, null, 2)}

Flags triggered:
${JSON.stringify(flags, null, 2)}

Peer comparison data:
${JSON.stringify(peerData, null, 2)}

Provide a clear explanation of the risk, what a legitimate version of this transaction would look like, and what follow-up steps an auditor should take.`

  return callClaude(system, user)
}

export async function getControlsMemo(controlResults) {
  const system = `You are a compliance and internal controls expert. You write formal audit memos assessing control environment health. Use professional memo format with clear findings and recommendations.`

  const user = `Write a formal controls assessment memo based on these test results:

${JSON.stringify(controlResults, null, 2)}

Format as: TO/FROM/DATE/SUBJECT header, then Executive Summary, Findings by Control Area, Risk Rating, and Recommendations. Be specific with percentages and counts.`

  return callClaude(system, user)
}
