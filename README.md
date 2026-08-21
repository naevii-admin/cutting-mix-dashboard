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

## Como atualizar (o dia a dia do Simon)

1. **Exportar os 4 arquivos** e jogar em `inputs/` (a pasta é ignorada pelo git):

   | arquivo | onde exportar | serve pra |
   |---|---|---|
   | `orders_export.csv` | Shopify → Pedidos → Exportar | data e status financeiro do pedido |
   | `payment_transactions.csv` | Shopify → Finanças → Transações | **fonte de verdade** da receita (Net), entradas futuras, refunds/chargebacks |
   | `fornecedor.xls` | painel do fornecedor | COGS por pedido e fila de pagamento |
   | `ads.csv` | você digita | gasto de ads por dia e por conta |

   Os scripts pegam **o arquivo mais recente** de cada tipo por padrão de nome (glob),
   então pode deixar os antigos na pasta — vale sempre o mais novo.

2. **`ads.csv`** — uma linha por dia e por conta:
   ```csv
   data,conta,valor_usd
   2026-08-20,Meta 1,80.00
   2026-08-20,Meta 2,90.00
   2026-08-20,Google,30.00
   ```
   Enquanto um dia não tiver ads informado, ele fica **parcial** (fora dos totais).

3. **`inputs/saldos.json`** — os números que só você sabe (saldos do banco e dos ads):
   ```json
   {
     "caixa_usd": 0,
     "caixa_eur": 0,
     "saldo_devedor_cartao_usd": 0,
     "retido_shopify_usd": 0,
     "contas_ads": [
       {"nome": "Meta 1", "threshold_usd": 300, "acumulado_usd": 0, "gasto_diario_usd": 0},
       {"nome": "Meta 2", "threshold_usd": 300, "acumulado_usd": 0, "gasto_diario_usd": 0},
       {"nome": "Google",  "threshold_usd": 200, "acumulado_usd": 0, "gasto_diario_usd": 0}
     ]
   }
   ```
   - `caixa_usd` = savings + checking. `saldo_devedor_cartao_usd` é **subtraído** (o
     disponível real é `caixa − saldo devedor`).
   - `threshold_usd` = valor em que o Meta/Google cobra o cartão; `acumulado_usd` = quanto
     já acumulou; `gasto_diario_usd` = ritmo de gasto. É o que prevê a **cobrança** e a **colisão**.

4. **Publicar:**
   ```bash
   npm run publicar
   ```
   Isso roda os dois geradores (`npm run gerar`), dá commit e push. A Vercel rebuilda sozinha.

   Só gerar sem publicar: `npm run gerar`.

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
