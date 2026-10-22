// Camada de dados do dashboard.
// Importa os JSONs versionados (gerados por scripts/to_dashboard.py) e calcula
// os agregados. NÃO recalcula P&L nem caixa — a lógica delicada vive nos scripts
// Python. Aqui só somamos/formatamos o que já veio pronto.

import pnlRaw from '../data/pnl.json'
import caixaRaw from '../data/caixa.json'

// ---------- Referências de negócio ----------
export const META_MARGEM = 18 // % — meta de margem
export const CPA_REF = 31 // $ — CPA de referência
// ROAS de break-even: abaixo disso o dia perde dinheiro. Vem do export de
// análise (COGS ~40% + taxa Shopify 5,95%). Revisar quando o COGS mudar.
export const BREAK_EVEN_ROAS = 1.66

// ---------- Caixa (fluxo bancário — Revolut EUR) ----------
// O caixa agora é o extrato do Revolut: conta única desde 12/09/2026, quando o
// Mercury zerou e saiu da operação. É fluxo de caixa REAL por movimentação
// bancária — NÃO reconciliar com o P&L (regimes diferentes; ver README).
const caixaDiarioRaw = caixaRaw.saldo_diario || []
const dataCaixa =
  caixaRaw.data ||
  (caixaDiarioRaw.length ? caixaDiarioRaw[caixaDiarioRaw.length - 1].data : null) ||
  caixaRaw.meta?.periodo?.split(' a ')[1] ||
  caixaRaw.meta?.gerado_em ||
  null
export const caixa = { ...caixaRaw, data: dataCaixa }

export const caixaMeta = caixaRaw.meta || {}
export const caixaSaldo = caixaRaw.saldo_atual || {}
export const caixaResumo = caixaRaw.resumo || {}
export const caixaDiario = caixaDiarioRaw
export const caixaMov = caixaRaw.movimentacoes || []
// Fornecedor (JX/GrandReach) — pode vir null se a planilha da JX não foi passada.
// saldo_conta/a_pagar negativos = crédito adiantado (está em dia).
export const caixaFornecedor = caixaRaw.fornecedor || null

// Taxa BRL usada em toda a formatação de R$ (vem do estado do caixa).
export const BRL = caixaRaw.brl || caixaRaw.meta?.cambio_usd_brl || 5.1

// ---------- Série de P&L, agrupada por mês ----------
// O campo `d` é "MM-DD", então o mês sai de d.slice(0,2). O painel escolhe qual
// mês mostrar; cada mês tem seus próprios agregados (nunca somamos meses juntos).
export const pnl = [...pnlRaw].sort((a, b) => a.d.localeCompare(b.d))

// Meses com dados, do mais antigo pro mais novo (ex.: ["07","08"]).
export const MESES = [...new Set(pnl.map((r) => r.d.slice(0, 2)))].sort()
export const mesCorrente = MESES[MESES.length - 1]

const NOME_MES = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
}
export function nomeMes(m) {
  return NOME_MES[m] || m
}

// Break-even do ROAS por mês (vem do export; muda com o COGS do mês).
const BE_MES = { '07': 1.66, '08': 1.63, '09': 1.65 }
export function breakEvenMes(m) {
  return BE_MES[m] ?? BREAK_EVEN_ROAS
}

// Todos os derivados de um mês: série enriquecida (lucro/ads acumulados, ROAS,
// ticket), totais, composição da receita e o último dia.
export function dadosMes(m) {
  const dias = pnl.filter((r) => r.d.slice(0, 2) === m)

  let acc = 0
  let accAds = 0
  const serie = dias.map((r) => {
    acc += r.lucro
    accAds += r.ads
    return {
      ...r,
      acumulado: round2(acc),
      adsAcum: round2(accAds),
      roas: r.ads > 0 ? round2(r.rec / r.ads) : null,
      ticket: r.ped > 0 ? round2(r.rec / r.ped) : 0,
    }
  })

  const t = dias.reduce(
    (a, r) => ({
      ped: a.ped + r.ped,
      rec: a.rec + r.rec,
      cogs: a.cogs + r.cogs,
      ads: a.ads + r.ads,
      lucro: a.lucro + r.lucro,
    }),
    { ped: 0, rec: 0, cogs: 0, ads: 0, lucro: 0 },
  )
  const totais = {
    ped: t.ped,
    rec: round2(t.rec),
    cogs: round2(t.cogs),
    ads: round2(t.ads),
    lucro: round2(t.lucro),
    margem: t.rec ? round1((t.lucro / t.rec) * 100) : 0,
    // CPA real = ads totais / pedidos totais (não a média dos CPAs diários).
    cpa: t.ped ? round2(t.ads / t.ped) : 0,
    dias: dias.length,
    diasOrg: dias.filter((r) => r.org).length,
  }

  // Composição: por dia lucro = rec − cogs − ads, então COGS + Ads + Lucro = Receita.
  const rec = totais.rec || 1
  const composicao = [
    { key: 'cogs', label: 'COGS', valor: totais.cogs, pct: round1((totais.cogs / rec) * 100) },
    { key: 'ads', label: 'Ads', valor: totais.ads, pct: round1((totais.ads / rec) * 100) },
    { key: 'lucro', label: 'Lucro', valor: totais.lucro, pct: round1((totais.lucro / rec) * 100) },
  ]

  const adsUltimoDia = dias.length ? dias[dias.length - 1] : null

  return { dias, serie, totais, composicao, adsUltimoDia }
}

// Totais do mês corrente (o mais recente) — usado no rodapé do app.
export const totais = dadosMes(mesCorrente).totais

// ---------- Formatação ----------
const fmtUSD = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const fmtBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function usd(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return fmtUSD.format(v)
}

export function brl(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return fmtBRL.format(v * BRL)
}

// R$ a partir de um valor JÁ em BRL (o caixa traz os equivalentes prontos).
export function brlRaw(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return fmtBRL.format(v)
}

const fmtEUR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function eur(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return fmtEUR.format(v)
}

export function num(v, casas = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

export function pct(v, casas = 1) {
  if (v == null || Number.isNaN(v)) return '—'
  return `${num(v, casas)}%`
}

// Data "MM-DD" -> "DD/MM" para exibição.
export function diaBR(d) {
  const [m, dd] = d.split('-')
  return `${dd}/${m}`
}

// ---------- helpers ----------
function round1(v) {
  return Math.round(v * 10) / 10
}
function round2(v) {
  return Math.round(v * 100) / 100
}
