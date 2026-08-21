#!/usr/bin/env node
// Publica o que está em data/ (e no resto do repo). NÃO regenera nada — o P&L e o
// caixa vêm do pipeline de análise externo (você cola, o dado é escrito em data/).
// Só faz: git add -A, commit (se houver mudança) e push. Nunca apaga dados colados.

import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();

try {
  run("git add -A");
  const sujo = run("git status --porcelain");
  if (!sujo) {
    console.log("Nada a publicar — data/ já está no último commit.");
    process.exit(0);
  }
  const hoje = new Date();
  const dd = String(hoje.getDate()).padStart(2, "0");
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  run(`git commit -m "dados ${dd}/${mm}"`);
  console.log(`Commit criado: dados ${dd}/${mm}`);
  run("git push");
  console.log("Push enviado. A Vercel vai rebuildar em ~1 min.");
} catch (e) {
  console.error("Falha ao publicar:", e.stderr ? e.stderr.toString() : e.message);
  process.exit(1);
}
