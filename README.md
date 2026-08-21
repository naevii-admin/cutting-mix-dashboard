# Cutting Mix · Painel de P&L e Caixa

Dashboard financeiro da **Cutting Mix Drink** (cuttingmixdrink.com) — suplemento, mercado
Itália/Europa. Estático (HTML + Chart.js via CDN), sem build. Deploy no Vercel a partir do GitHub.

> **Moeda — o inverso da Naevii.** A marca **vende em USD** e **recebe payout em EUR**
> (Shopify Payments). Fornecedor (dropship) e ads (Meta + Google) são em **USD**.
> Logo **só a receita chega em EUR; todo o resto é USD**, e a **moeda base do P&L e do
> caixa é o USD**. O payout EUR é convertido pra USD pela taxa **real de cada transação**
> (nunca por uma constante — na Naevii a constante subestimou a receita ~5% por semanas).

Caixa é **separado** do da Naevii. Nenhum rateio de conta compartilhada.

---

## Como atualizar (o dia a dia)

O P&L (`data/pnl.json`) e o caixa (`data/caixa.json`) vêm do **pipeline de análise**
(a mesma ferramenta usada na Naevii). O fluxo é: o pipeline gera o JSON → o conteúdo é
escrito em `data/` → publica. **O `publicar` só faz commit + push — não regenera nada**,
pra nunca apagar os dados.

```bash
npm run publicar
```

Isso dá `git add -A`, um commit `dados DD/MM` e `git push` (só se houver mudança). A Vercel
rebuilda sozinha em ~1 min.

> Os scripts Python (`scripts/gerar_pnl.py`, `scripts/gerar_caixa.py`) e o comando
> `npm run gerar` ficam no repo como **referência/opcional** — um caminho alternativo que lê
> CSVs crus de `inputs/` (Shopify + fornecedor + `ads.csv` + `saldos.json`). Não fazem parte
> do fluxo de publicação atual. Se um dia quiser gerar a partir dos CSVs, o `gerar_pnl.py`
> precisa ser adaptado ao formato do export atual (JXdropshipping: Buyer Payment Amount + Total cost).

---

## O que o painel mostra

**Seletor de mês** no topo (alimentado por `meses`). Cada mês é isolado — usa
`totais_por_mes[mes]`, **nunca** `totais_fechados` (esse soma todos os meses).

- **P&L:** faturamento, lucro (USD e R$), margem, CPA, ticket, ROAS; barras de receita/lucro,
  lucro acumulado, **ads empilhado por fonte** (Meta + Google), margem × CPA, ROAS com o
  **break-even de cada dia** como referência, e a pizza COGS/Ads/Lucro.
- **Caixa:** disponível (já descontado o cartão), retido, entradas futuras, teto de pagamento;
  projeção de 8 dias com linha do piso e destaque nos dias de **colisão** e **abaixo do piso**;
  fila do fornecedor por dia; e a lista de alertas.

Dias `dia_parcial` (dia corrente ou sem ads informado) ficam de fora dos gráficos e dos totais.

---

## Configuração (uma vez)

Tudo que muda de marca pra marca está em **`scripts/config.py`**: `STORE_ID`, thresholds das
contas de ads, `PISO_CAIXA`, `LIMITE_CARTAO`, listas de brindes/fantasmas e `OVERRIDE_COGS`
(COGS manual pra pedido que o fornecedor não cotou). Editar lá, não espalhar pelos scripts.

## Regras de negócio (idênticas às aprendidas na Naevii)

- **Receita:** `Net` do `payment_transactions` casado por pedido. O `Net` vem em EUR; converte
  pra USD pela taxa implícita de cada transação (`Presentment USD ÷ Amount EUR`). A taxa de
  conversão da Shopify já está embutida no `Net` — não descontar duas vezes.
- **Exclusões:** pedidos `refunded`/`voided` e brindes/UGC saem **inteiros** (sem pedido,
  receita nem COGS).
- **Datas:** convertidas pra America/Sao_Paulo (UTC empurraria venda noturna pro dia seguinte).
  Datas puras (payout, Order Time, ads) não são convertidas — já vêm locais.
- **COGS:** `Final Price` do fornecedor, **dedup por (Store, Order Number)**. `Final Price = 0`
  é **não cotado** (estimado pela razão mediana dos últimos dias, marca `cogs_estimado`), não grátis.
  O fornecedor recota frete depois; o export mais novo é sempre a verdade.
- **Ads:** soma Meta (todas as contas) + Google. Campos separados no JSON pra não perder o Google.
- **Caixa:** entradas = `Net` por `Payout Date` (pending + scheduled + in_transit), **não** o
  export de payouts. Fim de semana credita na segunda. Cobrança de ads prevista por threshold,
  cartão liquida em D+1, colisão quando 2+ contas caem no mesmo dia.

## Deploy

Repositório no GitHub → importar na Vercel como **site estático** (framework: *Other*, sem
build command, output = raiz). Cada `git push` republica.
