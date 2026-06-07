import React from 'react'

export default function FlagBadge({ flag }) {
  const cls = flag.severity === 'High' ? 'badge badge-high' :
              flag.severity === 'Medium' ? 'badge badge-medium' : 'badge badge-low'
  return (
    <span className={cls} title={`${flag.label} (+${flag.points} pts)`}>
      {flag.rule.replace(/_/g, ' ')}
    </span>
  )
}
