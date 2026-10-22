// Moldura padrão de gráfico: título, nota e área com altura fixa.

export default function ChartCard({ title, note, height = 260, children }) {
  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div className="card-title">{title}</div>
        {note && <div className="card-note">{note}</div>}
      </div>
      <div className="chart-body" style={{ height }}>
        {children}
      </div>
    </div>
  )
}
