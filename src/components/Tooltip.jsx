// Tooltip customizado dos gráficos (paleta NAEVII, números monoespaçados).
// Recebe uma função `rows(payloadDatum)` que devolve [{ label, value }].

import { diaBR } from '../data'

export default function makeTooltip(rows) {
  return function CustomTooltip({ active, payload }) {
    if (!active || !payload || !payload.length) return null
    const d = payload[0].payload
    return (
      <div className="tt">
        <div className="tt-d">{diaBR(d.d)}</div>
        {rows(d).map((r) => (
          <div className="tt-row" key={r.label}>
            <span>{r.label}</span>
            <span style={r.color ? { color: r.color } : undefined}>{r.value}</span>
          </div>
        ))}
      </div>
    )
  }
}
