// Cartão de KPI: valor grande em USD, equivalente em R$ embaixo, e um selo
// opcional (bom/ruim/atenção) comparando com uma meta.

export default function Kpi({ label, value, sub, accent, tag, tagKind = 'neutral' }) {
  return (
    <div className="kpi" style={accent ? { '--accent': accent } : undefined}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub != null && <div className="sub">{sub}</div>}
      {tag != null && <span className={`tag tag-${tagKind}`}>{tag}</span>}
    </div>
  )
}
