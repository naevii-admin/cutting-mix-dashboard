// Painel Caixa — Lunic Home. Conta em USD (Mercury Checking). A Naevii banca os
// ads (Meta+Google) até a Lunic ter caixa próprio, então todo gasto vira DÍVIDA
// da Lunic com a Naevii. É fluxo de caixa real (banco), NÃO reconciliar com o P&L.
// Dias após a data de atualização são PROJEÇÃO (só payouts já agendados).

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { useState } from 'react'
import Kpi from '../components/Kpi'
import ChartCard from '../components/ChartCard'
import {
  caixa,
  caixaSaldo,
  caixaDivida,
  caixaPosicao,
  caixaResumo,
  caixaDiario,
  caixaMov,
  caixaReceber,
  caixaFilaJx,
  caixaAlertas,
  usd,
} from '../data'
import { C } from '../chartColors'

// "2026-10-24" -> "24/10"
const diaCurto = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`

const COR = { entrada: C.sage, ads: C.clay, pedidos: C.inkBlue }
const NOME = { entrada: 'entrada', ads: 'ads', pedidos: 'pedidos' }

const FILTROS = [
  { f: 'todos', label: 'todas' },
  { f: 'entrada', label: 'entradas' },
  { f: 'ads', label: 'ads' },
]

function EvolucaoTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  const linhas = [
    ['posição líquida', usd(d.posicao_liquida_usd), d.posicao_liquida_usd >= 0 ? C.sage : C.clay],
    ['saldo em conta', usd(d.saldo_fim_usd), C.inkBlue],
    ['dívida c/ Naevii', usd(d.divida_naevii_usd), C.clay],
  ]
  return (
    <div className="tt">
      <div className="tt-d">{diaCurto(label)}{d.projetado ? ' · projeção' : ''}</div>
      {linhas.map(([l, v, cor]) => (
        <div className="tt-row" key={l}>
          <span>{l}</span>
          <span style={{ color: cor }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

export default function CashPanel() {
  const [filtro, setFiltro] = useState('todos')

  const hoje = caixa.data
  const posHoje = caixaPosicao.hoje_usd
  const posOk = posHoje >= 0

  const filaCotada = caixaFilaJx.filter((p) => p.valor_usd != null)
  const filaTotal = filaCotada.reduce((a, p) => a + p.valor_usd, 0)
  const filaSemCotacao = caixaFilaJx.length - filaCotada.length

  const movs = caixaMov
    .slice()
    .reverse()
    .filter((m) => filtro === 'todos' || m.tipo === filtro)

  const nivelCor = { alto: C.clay, medio: C.gold, baixo: C.sage }

  return (
    <div>
      {/* -------- KPIs -------- */}
      <div className="kpi-row">
        <Kpi
          label="Saldo em conta"
          accent={C.inkBlue}
          value={usd(caixaSaldo.usd)}
          sub={`Mercury USD · piso ${usd(caixaSaldo.piso_usd)}`}
        />
        <Kpi
          label="Dívida com a Naevii"
          accent={C.clay}
          value={<span className="neg">{usd(caixaDivida.total_usd)}</span>}
          sub="ads bancados (Meta + Google)"
        />
        <Kpi
          label="A receber (payouts)"
          accent={C.sage}
          value={usd(caixaResumo.a_receber_usd)}
          sub="payouts Shopify pendentes"
        />
        <Kpi
          label="Fila do fornecedor (JX)"
          accent={C.gold}
          value={<span className="neg">{usd(filaTotal)}</span>}
          sub={`${filaCotada.length} pedidos${filaSemCotacao ? ` · +${filaSemCotacao} sem cotação` : ''}`}
        />
        <Kpi
          label="Posição líquida hoje"
          accent={posOk ? C.sage : C.clay}
          value={<span className={posOk ? 'pos' : 'neg'}>{usd(posHoje)}</span>}
          sub={`com payouts: ${usd(caixaPosicao.com_payouts_usd)}`}
          tag={posOk ? 'no azul' : 'no vermelho'}
          tagKind={posOk ? 'good' : 'bad'}
        />
      </div>

      {/* -------- Evolução -------- */}
      <div className="section">
        <ChartCard
          title="Saldo, dívida e posição líquida"
          note="Linha roxa = posição líquida (conta − dívida). A partir de 24/10 é projeção (só payouts já agendados)."
          height={320}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={caixaDiario} margin={{ top: 8, right: 10, left: 4, bottom: 4 }}>
              <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="data" tickFormatter={diaCurto} tick={{ fontSize: 11 }} stroke={C.line} />
              <YAxis tick={{ fontSize: 11 }} stroke={C.line} width={52} tickFormatter={(v) => `$${Math.round(v)}`} />
              <Tooltip content={<EvolucaoTooltip />} cursor={{ stroke: C.line }} />
              <ReferenceLine y={0} stroke={C.ink} strokeDasharray="2 2" />
              {hoje && (
                <ReferenceLine
                  x={hoje}
                  stroke={C.inkBlue}
                  strokeDasharray="4 4"
                  label={{ value: 'hoje', position: 'insideTopLeft', fill: C.inkBlue, fontSize: 11 }}
                />
              )}
              <Line type="monotone" dataKey="divida_naevii_usd" stroke={C.clay} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="saldo_fim_usd" stroke={C.inkBlue} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="posicao_liquida_usd" stroke={C.plum} strokeWidth={2.8} dot={{ r: 2.5, fill: C.plum }} />
            </ComposedChart>
          </ResponsiveContainer>
          <ul className="cx-legenda">
            <li><i style={{ background: C.plum }} />posição líquida</li>
            <li><i style={{ background: C.inkBlue }} />saldo em conta</li>
            <li><i style={{ background: C.clay }} />dívida c/ Naevii</li>
          </ul>
        </ChartCard>
      </div>

      {/* -------- A receber + Fila JX -------- */}
      <div className="section grid cols-2">
        <div className="card card-pad">
          <div className="stack-label">
            <span><strong>A receber · payouts Shopify</strong></span>
            <span className="pt">{usd(caixaResumo.a_receber_usd)} no total</span>
          </div>
          {caixaReceber.map((r, i) => (
            <div className="pay" key={i}>
              <span className="pd">{diaCurto(r.data)} · {r.pedidos}</span>
              <span className="pv pos">{usd(r.valor_usd)}</span>
            </div>
          ))}
          <div className="card-note" style={{ marginTop: 10 }}>
            Payout cai em USD (Mercury), D+7 úteis. 1,5% de conversão quando a cliente paga em EUR.
          </div>
        </div>

        <div className="card card-pad">
          <div className="stack-label">
            <span><strong>Fila do fornecedor · JX</strong></span>
            <span className="pt">{usd(filaTotal)} cotado{filaSemCotacao ? ` · +${filaSemCotacao} sem cotação` : ''}</span>
          </div>
          {caixaFilaJx.map((p, i) => (
            <div className="pay" key={i}>
              <span className="pd">{p.pedido}</span>
              <span className="pv">{p.valor_usd != null ? usd(p.valor_usd) : '—'}</span>
            </div>
          ))}
          <div className="card-note" style={{ marginTop: 10 }}>
            Aguardando a JX splitar os pedidos. Nada pago ainda.
          </div>
        </div>
      </div>

      {/* -------- Alertas -------- */}
      {caixaAlertas.length > 0 && (
        <div className="section">
          <div className="section-head"><h2>Alertas</h2></div>
          <div className="card card-pad">
            {caixaAlertas.map((a, i) => (
              <div className="pay" key={i} style={{ alignItems: 'flex-start', gap: 10 }}>
                <span className="cx-tag" style={{ '--cor': nivelCor[a.nivel] || C.ink }}>{a.nivel}</span>
                <span className="cx-desc" style={{ flex: 1 }}>{a.texto}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------- Movimentações -------- */}
      <div className="section">
        <div className="section-head">
          <h2>Movimentações</h2>
          <span className="hint">{caixaMov.length} linhas · ads bancados pela Naevii + payouts</span>
        </div>

        <div className="cx-filtros">
          {FILTROS.map((b) => (
            <button key={b.f} className={filtro === b.f ? 'is-on' : undefined} onClick={() => setFiltro(b.f)}>
              {b.label}
            </button>
          ))}
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>data</th>
                <th>tipo</th>
                <th>banco</th>
                <th>descrição</th>
                <th className="num">valor</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m, i) => (
                <tr key={i}>
                  <td>{diaCurto(m.data)}</td>
                  <td><span className="cx-tag" style={{ '--cor': COR[m.tipo] || C.ink }}>{NOME[m.tipo] || m.tipo}</span></td>
                  <td className="cx-desc">{m.banco}</td>
                  <td className="cx-desc">{m.descricao}</td>
                  <td className={`num ${m.valor_usd >= 0 ? 'pos' : 'neg'}`}>
                    {m.valor_usd >= 0 ? '+' : ''}{usd(m.valor_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-note" style={{ marginTop: 4, opacity: 0.7 }}>
        Conta Mercury (USD) · atualizado {hoje ? diaCurto(hoje) : '—'} · a Naevii banca os ads até a
        Lunic ter caixa próprio (vira dívida). Fluxo de caixa (banco), não reconciliar com o P&L.
      </div>
    </div>
  )
}
