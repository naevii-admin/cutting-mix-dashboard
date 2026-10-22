// Gate de senha client-side. Proteção LEVE: barra o acesso casual à URL, mas os
// dados moram no bundle — não é trava criptográfica. Adequado a um painel interno
// entre sócios; para dado sensível, mover os dados pra trás de auth no servidor.
//
// A senha vem de VITE_DASHBOARD_PASSWORD (variável de ambiente do Vite), nunca
// hardcoded. Uma vez acertada, guardamos um marcador em sessionStorage — a sessão
// dura só enquanto a aba fica aberta (fechou a aba, pede senha de novo). Trocar a
// senha invalida sessões antigas automaticamente.

import { useState } from 'react'

const SENHA = import.meta.env.VITE_DASHBOARD_PASSWORD
const KEY = 'naevii-auth'

// Marcador derivado da senha (não é hash de segurança — só invalida a sessão
// quando a senha muda). Guardamos isto, nunca a senha em si.
function marcador(pw) {
  try {
    return btoa(unescape(encodeURIComponent(pw)))
  } catch {
    return null
  }
}

const TOKEN = SENHA ? marcador(SENHA) : null

function jaAutenticado() {
  if (!TOKEN) return false
  try {
    return sessionStorage.getItem(KEY) === TOKEN
  } catch {
    return false
  }
}

export default function Gate({ children }) {
  const [ok, setOk] = useState(jaAutenticado)
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState(false)

  // Senha não configurada no ambiente: falha fechado (nada é renderizado).
  if (!SENHA) {
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="gate-mark">LUNIC HOME</div>
          <p className="gate-msg">
            Senha não configurada. Defina <code>VITE_DASHBOARD_PASSWORD</code> nas
            variáveis de ambiente (Vercel) ou em <code>.env.local</code> para o
            desenvolvimento local.
          </p>
        </div>
      </div>
    )
  }

  if (ok) return children

  function enviar(e) {
    e.preventDefault()
    if (valor === SENHA) {
      try {
        sessionStorage.setItem(KEY, TOKEN)
      } catch {
        /* storage indisponível: segue só na sessão em memória */
      }
      setOk(true)
    } else {
      setErro(true)
      setValor('')
    }
  }

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={enviar}>
        <div className="gate-mark">LUNIC HOME</div>
        <div className="gate-sub">Painel financeiro · acesso restrito</div>
        <input
          className="gate-input num"
          type="password"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value)
            setErro(false)
          }}
          placeholder="senha"
          autoFocus
          autoComplete="current-password"
        />
        {erro && <div className="gate-erro">Senha incorreta.</div>}
        <button className="gate-btn" type="submit">
          Entrar
        </button>
      </form>
    </div>
  )
}
