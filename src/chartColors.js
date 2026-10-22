// Fonte única das cores dos gráficos.
//
// As cores moram no tema (theme.css :root, variáveis CSS). Recharts precisa de
// valores concretos e não resolve var() em atributos SVG (fill/stroke), então
// lemos as variáveis do tema aqui em runtime, uma vez, no load do módulo.
//
// Para mudar uma cor: edite o theme.css. Os fallbacks abaixo só entram se a
// leitura falhar — devem espelhar o tema, nunca divergir dele.

function cssVar(name, fallback) {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export const C = {
  sage: cssVar('--sage', '#5a8a4f'),
  sageDark: cssVar('--sage-dark', '#3f5a37'),
  clay: cssVar('--clay', '#c8492c'),
  gold: cssVar('--gold', '#c69a3f'),
  inkBlue: cssVar('--ink-blue', '#7a9cc0'),
  plum: cssVar('--plum', '#8e4f8a'),
  line: cssVar('--line', '#e0d8c8'),
}
