// Painel Resultado (P&L). Regime de competência — os números já vêm assim dos
// scripts. Aqui só exibimos: KPIs, 4 gráficos e a tabela diária.

import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  BarChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  PieChart,
  Pie,
} from 'recharts'

import { useState } from 'react'
import Kpi from '../components/Kpi'
import ChartCard from '../components/ChartCard'
import makeTooltip from '../components/Tooltip'
import {
  MESES,
  mesCorrente,
  nomeMes,
  dadosMes,
  breakEvenMes,
  META_MARGEM,
  CPA_REF,
  usd,
  brl,
  num,
  pct,
  diaBR,
} from '../data'
import { C } from '../chartColors'

// Cores das fatias da pizza: clay=COGS, gold=Ads, sage=Lucro.
const COMP_COR = { cogs: C.clay, ads: C.gold, lucro: C.sage }

// Tooltip da pizza (os dados não têm dia, então não usa o makeTooltip padrão).
function PizzaTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  return (
    <div className="tt">
      <div className="tt-d">{d.label}</div>
      <div className="tt-row">
        <span>Da receita</span>
        <span style={{ color: COMP_COR[d.key] }}>{pct(d.pct)}</span>
      </div>
      <div className="tt-row">
        <span>Valor</span>
        <span>{usd(d.valor)}</span>
      </div>
    </div>
  )
}

const axisX = { dataKey: 'd', tickFormatter: diaBR, tickLine: false, axisLine: { stroke: C.line } }
const grid = { strokeDasharray: '3 3', stroke: C.line, vertical: false }

export default function PnlPanel() {
  // Mês selecionado (default: o mais recente). Cada mês é isolado — nunca somados.
  const [mes, setMes] = useState(mesCorrente)
  const { dias: pnl, serie: pnlSerie, totais, composicao, adsUltimoDia } = dadosMes(mes)
  const be = breakEvenMes(mes)

  const margemOk = totais.margem >= META_MARGEM
  const cpaOk = totais.cpa <= CPA_REF

  // ROAS pra plotar: dias orgânicos (ads 0, ROAS ∞) viram uma barra no topo da
  // escala, em sage escuro, marcada como orgânico no tooltip — sem fingir número.
  const roasFinitos = pnlSerie.filter((d) => d.roas != null).map((d) => d.roas)
  const ROAS_TOPO = roasFinitos.length ? Math.max(...roasFinitos) : be
  const roasData = pnlSerie.map((d) => ({ ...d, roasPlot: d.org ? ROAS_TOPO : d.roas }))

  return (
    <div>
      {/* -------- Seletor de mês -------- */}
      {MESES.length > 1 && (
        <div className="mes-tabs">
          {MESES.map((m) => (
            <button
              key={m}
              className={`mes-tab${m === mes ? ' ativo' : ''}`}
              onClick={() => setMes(m)}
            >
              {nomeMes(m)}
            </button>
          ))}
        </div>
      )}

      {/* -------- KPIs -------- */}
      <div className="kpi-row">
        <Kpi
          label="Faturamento"
          accent={C.inkBlue}
          value={usd(totais.rec)}
          sub={brl(totais.rec)}
        />
        <Kpi
          label="Lucro"
          accent={totais.lucro >= 0 ? C.sage : C.clay}
          value={<span className={totais.lucro >= 0 ? 'pos' : 'neg'}>{usd(totais.lucro)}</span>}
          sub={brl(totais.lucro)}
        />
        <Kpi
          label="Margem"
          accent={margemOk ? C.sage : C.gold}
          value={pct(totais.margem)}
          sub={`meta ${META_MARGEM}%`}
          tag={margemOk ? `+${num(totais.margem - META_MARGEM)} pts` : `${num(totais.margem - META_MARGEM)} pts`}
          tagKind={margemOk ? 'good' : 'warn'}
        />
        <Kpi
          label="Pedidos"
          accent={C.plum}
          value={num(totais.ped, 0)}
          sub={`${totais.dias} dias fechados`}
        />
        <Kpi
          label="CPA real"
          accent={cpaOk ? C.sage : C.clay}
          value={usd(totais.cpa)}
          sub={`ref ${usd(CPA_REF)}`}
          tag={cpaOk ? `${usd(CPA_REF - totais.cpa)} abaixo` : `${usd(totais.cpa - CPA_REF)} acima`}
          tagKind={cpaOk ? 'good' : 'bad'}
        />
      </div>

      {/* -------- Gráficos -------- */}
      <div className="section grid cols-2">
        {/* 1. Faturamento & lucro */}
        <ChartCard
          title="Faturamento & lucro"
          note="Barras = receita/dia · linha = lucro/dia"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={pnl} margin={{ top: 8, right: 8, left: 6, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis {...axisX} />
              <YAxis tickLine={false} axisLine={false} width={54} />
              <Tooltip
                content={makeTooltip((d) => [
                  { label: 'Receita', value: usd(d.rec), color: C.inkBlue },
                  { label: 'Lucro', value: usd(d.lucro), color: d.lucro >= 0 ? C.sage : C.clay },
                ])}
              />
              <Bar dataKey="rec" fill={C.inkBlue} radius={[3, 3, 0, 0]} maxBarSize={26} opacity={0.85} />
              <Line type="monotone" dataKey="lucro" stroke={C.gold} strokeWidth={2.8} dot={{ r: 3, fill: C.gold }} />
              <ReferenceLine y={0} stroke={C.line} strokeDasharray="3 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 2. Lucro acumulado */}
        <ChartCard
          title="Lucro acumulado"
          note="Como o mês foi construído dia a dia"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pnlSerie} margin={{ top: 8, right: 8, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="gAcum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.sage} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.sage} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...grid} />
              <XAxis {...axisX} />
              <YAxis tickLine={false} axisLine={false} width={54} />
              <Tooltip
                content={makeTooltip((d) => [
                  { label: 'Acumulado', value: usd(d.acumulado), color: C.sage },
                  { label: 'No dia', value: usd(d.lucro), color: d.lucro >= 0 ? C.sage : C.clay },
                ])}
              />
              <Area type="monotone" dataKey="acumulado" stroke={C.sage} strokeWidth={2.4} fill="url(#gAcum)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 3. Pedidos por dia */}
        <ChartCard title="Pedidos por dia" note="Dias em dourado = orgânicos (ads $0)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pnl} margin={{ top: 8, right: 8, left: 6, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis {...axisX} />
              <YAxis tickLine={false} axisLine={false} width={34} allowDecimals={false} />
              <Tooltip
                content={makeTooltip((d) => [
                  { label: 'Pedidos', value: num(d.ped, 0), color: C.plum },
                  { label: 'CPA', value: d.org ? 'orgânico' : usd(d.cpa) },
                ])}
              />
              <Bar dataKey="ped" radius={[3, 3, 0, 0]} maxBarSize={26}>
                {pnl.map((d) => (
                  <Cell key={d.d} fill={d.org ? C.gold : C.plum} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 4. Margem & CPA — o gráfico-tese */}
        <ChartCard
          title="Margem & CPA"
          note={`Margem sobe quando CPA cai · linha de meta em ${META_MARGEM}%`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={pnl} margin={{ top: 8, right: 4, left: 6, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis {...axisX} />
              <YAxis yAxisId="m" tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}%`} />
              <YAxis yAxisId="c" orientation="right" tickLine={false} axisLine={false} width={38} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                content={makeTooltip((d) => [
                  { label: 'Margem', value: pct(d.margem), color: d.margem >= META_MARGEM ? C.sage : C.clay },
                  { label: 'CPA', value: d.org ? 'orgânico' : usd(d.cpa), color: C.gold },
                ])}
              />
              <Bar yAxisId="m" dataKey="margem" radius={[3, 3, 0, 0]} maxBarSize={26}>
                {pnl.map((d) => (
                  <Cell key={d.d} fill={d.margem >= META_MARGEM ? C.sage : C.clay} opacity={0.85} />
                ))}
              </Bar>
              <ReferenceLine yAxisId="m" y={META_MARGEM} stroke={C.sage} strokeDasharray="5 4" />
              <ReferenceLine yAxisId="m" y={0} stroke={C.line} />
              <Line yAxisId="c" type="monotone" dataKey="cpa" stroke={C.gold} strokeWidth={2.4} dot={{ r: 2.5, fill: C.gold }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* -------- ROAS por dia + ticket médio -------- */}
      <div className="section grid cols-2">
        {/* ROAS por dia com break-even */}
        <ChartCard
          title="ROAS por dia"
          note={`Receita ÷ ads · verde acima do break-even (${num(be)}×), vermelho abaixo · orgânico em sage escuro`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roasData} margin={{ top: 8, right: 8, left: 6, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis {...axisX} />
              <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}×`} />
              <Tooltip
                content={makeTooltip((d) => [
                  {
                    label: 'ROAS',
                    value: d.org ? 'orgânico · ∞' : `${num(d.roas)}×`,
                    color: d.org ? C.sageDark : d.roas >= be ? C.sage : C.clay,
                  },
                  { label: 'Receita', value: usd(d.rec) },
                  { label: 'Ads', value: d.org ? '$0' : usd(d.ads) },
                ])}
              />
              <Bar dataKey="roasPlot" radius={[3, 3, 0, 0]} maxBarSize={26}>
                {roasData.map((d) => (
                  <Cell
                    key={d.d}
                    fill={d.org ? C.sageDark : d.roas >= be ? C.sage : C.clay}
                    opacity={0.85}
                  />
                ))}
              </Bar>
              <ReferenceLine
                y={be}
                stroke={C.inkBlue}
                strokeDasharray="5 4"
                label={{ value: `break-even ${num(be)}×`, position: 'insideTopRight', fill: C.inkBlue, fontSize: 11 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Ticket médio por dia */}
        <ChartCard
          title="Ticket médio por dia"
          note="Receita ÷ pedidos · dias altos = mais upsell"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={pnlSerie} margin={{ top: 8, right: 8, left: 6, bottom: 0 }}>
              <CartesianGrid {...grid} />
              <XAxis {...axisX} />
              <YAxis tickLine={false} axisLine={false} width={54} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                content={makeTooltip((d) => [
                  { label: 'Ticket médio', value: usd(d.ticket), color: C.plum },
                  { label: 'Receita', value: usd(d.rec) },
                  { label: 'Pedidos', value: num(d.ped, 0) },
                ])}
              />
              <Line type="monotone" dataKey="ticket" stroke={C.plum} strokeWidth={2.4} dot={{ r: 2.5, fill: C.plum }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* -------- Composição da receita + acompanhamento de ads -------- */}
      <div className="section grid cols-2">
        {/* Pizza: pra onde vai a receita */}
        <ChartCard
          title="Pra onde vai a receita"
          note="Receita do mês = COGS + Ads + Lucro"
        >
          <div className="pie-wrap">
            <div className="pie-graph">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={composicao}
                    dataKey="valor"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius="58%"
                    outerRadius="92%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {composicao.map((c) => (
                      <Cell key={c.key} fill={COMP_COR[c.key]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PizzaTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-center">
                <span className="pie-center-label">Receita</span>
                <span className="pie-center-value">{usd(totais.rec)}</span>
              </div>
            </div>
            <ul className="pie-legend">
              {composicao.map((c) => (
                <li className="pie-legend-item" key={c.key}>
                  <span className="pl-dot" style={{ background: COMP_COR[c.key] }} />
                  <span className="pl-label">{c.label}</span>
                  <span className="pl-pct">{pct(c.pct)}</span>
                  <span className="pl-val">{usd(c.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>

        {/* Acompanhamento de ads (queima do mês) */}
        <ChartCard
          title="Queima de ads"
          note="Gasto com o Meta · dia mais recente e acumulado do mês"
        >
          <div className="ads-track">
            <div className="ads-stats">
              <div className="ads-stat">
                <div className="label">Último dia</div>
                <div className="value">{adsUltimoDia ? usd(adsUltimoDia.ads) : '—'}</div>
                <div className="sub">{adsUltimoDia ? diaBR(adsUltimoDia.d) : ''}</div>
              </div>
              <div className="ads-stat">
                <div className="label">Acumulado no mês</div>
                <div className="value">{usd(totais.ads)}</div>
                <div className="sub">{totais.dias} dias · CPA {usd(totais.cpa)}</div>
              </div>
            </div>
            <div className="ads-spark">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pnlSerie} margin={{ top: 6, right: 8, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gAds" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.gold} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={C.gold} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...grid} />
                  <XAxis {...axisX} />
                  <YAxis tickLine={false} axisLine={false} width={54} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    content={makeTooltip((d) => [
                      { label: 'Ads acumulado', value: usd(d.adsAcum), color: C.gold },
                      { label: 'No dia', value: d.org ? 'orgânico' : usd(d.ads) },
                    ])}
                  />
                  <Area type="monotone" dataKey="adsAcum" stroke={C.gold} strokeWidth={2.4} fill="url(#gAds)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* -------- Tabela diária -------- */}
      <div className="section">
        <div className="section-head">
          <h2>Dias fechados</h2>
          <span className="hint">
            {totais.dias} dias · {totais.diasOrg} orgânico{totais.diasOrg === 1 ? '' : 's'} · lucro em USD e R$
          </span>
        </div>
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Ped.</th>
                <th>Receita</th>
                <th>COGS</th>
                <th>Ads</th>
                <th>Margem</th>
                <th>CPA</th>
                <th>Lucro (USD)</th>
                <th>Lucro (R$)</th>
              </tr>
            </thead>
            <tbody>
              {pnl.map((d) => (
                <tr key={d.d} className={d.org ? 'org-row' : undefined}>
                  <td>
                    {diaBR(d.d)}{' '}
                    {d.org && <span className="chip-org">orgânico</span>}
                  </td>
                  <td>{num(d.ped, 0)}</td>
                  <td>{usd(d.rec)}</td>
                  <td>{usd(d.cogs)}</td>
                  <td>{d.org ? '—' : usd(d.ads)}</td>
                  <td className={d.margem >= META_MARGEM ? 'pos' : d.margem < 0 ? 'neg' : undefined}>
                    {pct(d.margem)}
                  </td>
                  <td>{d.org ? '—' : usd(d.cpa)}</td>
                  <td className={d.lucro >= 0 ? 'pos' : 'neg'}>{usd(d.lucro)}</td>
                  <td className={d.lucro >= 0 ? 'pos' : 'neg'}>{brl(d.lucro)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{num(totais.ped, 0)}</td>
                <td>{usd(totais.rec)}</td>
                <td>{usd(totais.cogs)}</td>
                <td>{usd(totais.ads)}</td>
                <td>{pct(totais.margem)}</td>
                <td>{usd(totais.cpa)}</td>
                <td className={totais.lucro >= 0 ? 'pos' : 'neg'}>{usd(totais.lucro)}</td>
                <td className={totais.lucro >= 0 ? 'pos' : 'neg'}>{brl(totais.lucro)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
