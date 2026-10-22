// Painel Caixa — fluxo bancário do Revolut (EUR), conta única desde 12/09/2026.
// É o extrato real por movimentação, NÃO o P&L. Ads aparecem na data da COBRANÇA
// (câmbio EUR→USD que abastece a conta de anúncios), não do gasto — por isso o
// caixa nunca bate dia a dia com o P&L. Isso é esperado, não é erro.

import { useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import Kpi from '../components/Kpi'
import ChartCard from '../components/ChartCard'
import {
  caixaMeta,
  caixaSaldo,
  caixaResumo,
  caixaDiario,
  caixaMov,
  caixaFornecedor,
  eur,
  usd,
  pct,
  brlRaw,
} from '../data'
import { C } from '../chartColors'

// Cor por tipo de movimentação (significado, não estética).
const COR = {
  entrada: C.sage,
  ads: C.clay,
  pedidos: C.inkBlue,
  retirada_brl: C.gold,
  outras: C.line,
}
const NOME = {
  entrada: 'entrada',
  ads: 'ads',
  pedidos: 'pedidos',
  retirada_brl: 'retirada BRL',
  outras: 'outras',
}

const FILTROS = [
  { f: 'todos', label: 'todas' },
  { f: 'entrada', label: 'entradas' },
  { f: 'ads', label: 'ads' },
  { f: 'pedidos', label: 'pedidos' },
  { f: 'retirada_brl', label: 'retirada BRL' },
]

// "2026-09-24" -> "24/09"
const diaCurto = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`

function EvolucaoTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  const linhas = [
    ['saldo no fim', eur(d.saldo_fim_eur), C.plum],
    ['entrada', eur(d.entrada_eur), C.sage],
    ['ads', eur(d.saida_ads_eur), C.clay],
    ['pedidos', eur(d.saida_pedidos_eur), C.inkBlue],
    ['retirada BRL', eur(d.saida_brl_eur), C.gold],
  ]
  return (
    <div className="tt">
      <div className="tt-d">{diaCurto(d.data)}</div>
      {linhas.map(([label, valor, cor]) => (
        <div className="tt-row" key={label}>
          <span>{label}</span>
          <span style={{ color: cor }}>{valor}</span>
        </div>
      ))}
    </div>
  )
}

export default function CashPanel() {
  const [filtro, setFiltro] = useState('todos')

  const dias = caixaDiario.filter((x) => x.saldo_fim_eur != null)
  const positivo = caixaResumo.liquido_eur >= 0

  // Composição das saídas (rosca).
  const saidas = [
    { key: 'ads', label: 'ads', valor: caixaResumo.saiu_ads_eur, cor: C.clay },
    { key: 'pedidos', label: 'pedidos', valor: caixaResumo.saiu_pedidos_eur, cor: C.inkBlue },
    { key: 'retirada_brl', label: 'retirada BRL', valor: caixaResumo.saiu_brl_eur, cor: C.gold },
    { key: 'outras', label: 'outras', valor: caixaResumo.saiu_outras_eur, cor: C.line },
  ].filter((s) => s.valor > 0)
  const totalSaiu = saidas.reduce((a, s) => a + s.valor, 0)

  const F = caixaFornecedor
  const porPedido = F && F.a_pagar_pedidos ? F.a_pagar_usd / F.a_pagar_pedidos : null

  // Movimentações da mais recente pra mais antiga.
  const movs = caixaMov
    .slice()
    .reverse()
    .filter((m) => filtro === 'todos' || m.tipo === filtro)

  return (
    <div>
      {/* -------- KPIs -------- */}
      <div className="kpi-row">
        <Kpi
          label="Saldo em conta"
          accent={C.inkBlue}
          value={eur(caixaSaldo.eur)}
          sub={`${usd(caixaSaldo.usd)} · ${brlRaw(caixaSaldo.brl)}`}
        />
        <Kpi
          label="Entrou no período"
          accent={C.sage}
          value={eur(caixaResumo.entrou_eur)}
          sub={`${caixaResumo.dias} dias · Stripe (payout Shopify)`}
        />
        <Kpi
          label="Saiu — ads"
          accent={C.clay}
          value={eur(caixaResumo.saiu_ads_eur)}
          sub="câmbio EUR→USD (abastece anúncios)"
        />
        <Kpi
          label="Saiu — fornecedor"
          accent={C.inkBlue}
          value={eur(caixaResumo.saiu_pedidos_eur)}
          sub="SWIFT p/ GrandReach (JX)"
        />
        <Kpi
          label="Líquido do período"
          accent={positivo ? C.sage : C.clay}
          value={<span className={positivo ? 'pos' : 'neg'}>{eur(caixaResumo.liquido_eur)}</span>}
          sub={`retirada BRL ${eur(caixaResumo.saiu_brl_eur)}`}
          tag={positivo ? 'entrou mais' : 'saiu mais'}
          tagKind={positivo ? 'good' : 'bad'}
        />
      </div>

      {/* -------- Composição das saídas (rosca) -------- */}
      <div className="section">
        <ChartCard title="Pra onde foi o dinheiro que saiu" note="Total das saídas do período">
          <div className="pie-wrap">
            <div className="pie-graph">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={saidas}
                    dataKey="valor"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="92%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {saidas.map((s) => (
                      <Cell key={s.key} fill={s.cor} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload && payload.length ? (
                        <div className="tt">
                          <div className="tt-row">
                            <span>{payload[0].payload.label}</span>
                            <span style={{ color: payload[0].payload.cor }}>
                              {eur(payload[0].payload.valor)}
                            </span>
                          </div>
                        </div>
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-center">
                <span className="pie-center-label">saiu</span>
                <span className="pie-center-value">{eur(totalSaiu)}</span>
              </div>
            </div>
            <ul className="pie-legend">
              {saidas.map((s) => (
                <li className="pie-legend-item" key={s.key}>
                  <span className="pl-dot" style={{ background: s.cor }} />
                  <span className="pl-label">{s.label}</span>
                  <span className="pl-pct">{pct((s.valor / totalSaiu) * 100)}</span>
                  <span className="pl-val">{eur(s.valor)}</span>
                </li>
              ))}
              <li className="pie-legend-item" style={{ borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 2 }}>
                <span className="pl-dot" style={{ background: C.sage }} />
                <span className="pl-label">entrou</span>
                <span className="pl-pct">{pct((totalSaiu / caixaResumo.entrou_eur) * 100)} gasto</span>
                <span className="pl-val">{eur(caixaResumo.entrou_eur)}</span>
              </li>
            </ul>
          </div>
        </ChartCard>
      </div>

      {/* -------- Evolução do saldo + movimento -------- */}
      <div className="section">
        <ChartCard
          title="Evolução do saldo e movimento de cada dia"
          note="Linha = saldo no fim do dia (€). Barras = entrada (verde) vs saídas empilhadas."
          height={320}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dias} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="data" tickFormatter={diaCurto} tick={{ fontSize: 11 }} stroke={C.line} />
              <YAxis yAxisId="mov" tick={{ fontSize: 11 }} stroke={C.line} width={44} tickFormatter={(v) => `€${Math.round(v)}`} />
              <YAxis yAxisId="saldo" orientation="right" tick={{ fontSize: 11 }} stroke={C.line} width={44} tickFormatter={(v) => `€${Math.round(v)}`} />
              <Tooltip content={<EvolucaoTooltip />} cursor={{ fill: 'rgba(0,0,0,.04)' }} />
              <Bar yAxisId="mov" dataKey="entrada_eur" stackId="in" fill={C.sage} radius={[2, 2, 0, 0]} maxBarSize={26} />
              <Bar yAxisId="mov" dataKey="saida_ads_eur" stackId="out" fill={C.clay} maxBarSize={26} />
              <Bar yAxisId="mov" dataKey="saida_pedidos_eur" stackId="out" fill={C.inkBlue} maxBarSize={26} />
              <Bar yAxisId="mov" dataKey="saida_brl_eur" stackId="out" fill={C.gold} radius={[2, 2, 0, 0]} maxBarSize={26} />
              <Line yAxisId="saldo" type="monotone" dataKey="saldo_fim_eur" stroke={C.plum} strokeWidth={2.5} dot={{ r: 3, fill: C.plum }} />
            </ComposedChart>
          </ResponsiveContainer>
          <ul className="cx-legenda">
            <li><i style={{ background: C.plum }} />saldo</li>
            <li><i style={{ background: C.sage }} />entrada</li>
            <li><i style={{ background: C.clay }} />ads</li>
            <li><i style={{ background: C.inkBlue }} />pedidos</li>
            <li><i style={{ background: C.gold }} />retirada BRL</li>
          </ul>
        </ChartCard>
      </div>

      {/* -------- Fornecedor (JX / GrandReach) -------- */}
      {F && (
        <div className="section">
          <div className="section-head">
            <h2>Fornecedor · JX / GrandReach</h2>
            <span className="hint">
              {F.pedidos_total} pedidos · {usd(F.total_cobrado_usd)} no total · inclui UGC (fora do P&L)
            </span>
          </div>

          <div className="kpi-row">
            <Kpi
              label="A pagar ao fornecedor"
              accent={C.clay}
              value={<span className="neg">{usd(F.a_pagar_usd)}</span>}
              sub={
                porPedido != null
                  ? `${F.a_pagar_pedidos} pedidos · ${usd(porPedido)} por pedido`
                  : 'informado pelo Simon (painel da JX)'
              }
            />
            <Kpi
              label="Crédito na conta"
              accent={C.sage}
              value={<span className="pos">{usd(Math.abs(F.saldo_conta_usd))}</span>}
              sub="adiantado (abate o a pagar)"
            />
            <Kpi
              label="Último pagamento"
              accent={C.gold}
              value={eur(F.ultimo_pagamento.valor_eur)}
              sub={diaCurto(F.ultimo_pagamento.data)}
            />
          </div>

          <div className="card card-pad">
            <div className="stack-label">
              <span><strong>Pagamentos (SWIFT)</strong></span>
              <span className="pt">transferências pra GrandReach</span>
            </div>
            {F.pagamentos.slice().reverse().map((p, i) => (
              <div className="pay" key={i}>
                <span className="pd">{diaCurto(p.data)}</span>
                <span className="pv">{eur(p.valor_eur)} · {usd(p.valor_usd)}</span>
              </div>
            ))}
            <div className="card-note" style={{ marginTop: 10 }}>
              O "a pagar" é informado pelo Simon no painel da JX (a planilha não traz status
              de pagamento){F.a_pagar_atualizado_em ? ` · atualizado ${diaCurto(F.a_pagar_atualizado_em)}` : ''}.
            </div>
          </div>
        </div>
      )}

      {/* -------- Movimentações -------- */}
      <div className="section">
        <div className="section-head">
          <h2>Movimentações</h2>
          <span className="hint">extrato do Revolut · {caixaMov.length} linhas</span>
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
                <th>descrição</th>
                <th className="num">valor</th>
                <th className="num">saldo após</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m, i) => (
                <tr key={i}>
                  <td>{diaCurto(m.data)}</td>
                  <td>
                    <span className="cx-tag" style={{ '--cor': COR[m.tipo] }}>{NOME[m.tipo]}</span>
                  </td>
                  <td className="cx-desc">
                    {m.descricao}
                    {m.usd_declarado ? ` · $${m.usd_declarado.toFixed(2)}` : ''}
                  </td>
                  <td className={`num ${m.valor_eur >= 0 ? 'pos' : 'neg'}`}>
                    {m.valor_eur >= 0 ? '+' : ''}
                    {eur(m.valor_eur)}
                  </td>
                  <td className="num">{m.saldo_apos_eur != null ? eur(m.saldo_apos_eur) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-note" style={{ marginTop: 4, opacity: 0.7 }}>
        {caixaMeta.conta} · {caixaMeta.periodo} · {caixaResumo.dias} dias · câmbio medido
        no extrato €1 = ${caixaMeta.cambio_eur_usd}. Fluxo de caixa (banco), não reconciliar
        com o P&L.
      </div>
    </div>
  )
}
