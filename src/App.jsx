import { useState } from 'react'
import PnlPanel from './panels/PnlPanel'
import CashPanel from './panels/CashPanel'
import { caixa, totais, BRL, usd } from './data'

const TABS = [
  { id: 'pnl', label: 'Resultado (P&L)' },
  { id: 'caixa', label: 'Caixa' },
]

function dataBR(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const initialTab = () =>
  typeof location !== 'undefined' && location.hash === '#caixa' ? 'caixa' : 'pnl'

export default function App() {
  const [tab, setTab] = useState(initialTab)

  function pick(id) {
    setTab(id)
    if (typeof location !== 'undefined') location.hash = id === 'caixa' ? '#caixa' : ''
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">LUNIC HOME</span>
          <span className="sub">Painel financeiro</span>
        </div>
        <div className="asof">
          <div>
            Caixa em <span className="num">{dataBR(caixa.data)}</span>
          </div>
          <div>
            Câmbio <span className="num">R$ {BRL.toFixed(2)}</span> / US$
          </div>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => pick(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'pnl' ? <PnlPanel /> : <CashPanel />}

      <footer className="foot">
        <span>
          Mês corrente · {totais.dias} dias fechados · lucro {usd(totais.lucro)}
        </span>
        <span>Dados versionados no repositório · atualiza a cada git push</span>
      </footer>
    </div>
  )
}
