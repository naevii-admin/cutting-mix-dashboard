# -----------------------------------------------------------------------------
# Configuração da Cutting Mix — ÚNICO lugar que o Simon edita.
#
# Moeda: a marca VENDE em USD e RECEBE payout em EUR (o inverso da Naevii).
# Fornecedor (dropship) e ads são em USD. Logo a moeda base do P&L e do caixa
# é o USD; só a receita chega em EUR e é convertida transação a transação pela
# taxa real do payout — NUNCA por uma constante.
# -----------------------------------------------------------------------------

MARCA = "Cutting Mix"
STORE_ID = ""            # id da loja no export do fornecedor (ex.: "0fp4vy-u8")

MOEDA_VENDA = "USD"      # moeda em que o cliente paga
MOEDA_PAYOUT = "EUR"     # moeda em que a Shopify credita
MOEDA_BASE = "USD"       # moeda do P&L e do caixa (fornecedor e ads são USD)

CAMBIO_USD_BRL = 5.1168  # só p/ exibir R$ no painel; não entra em nenhum cálculo de negócio
TAXA_SHOPIFY = 0.0588    # referência; a taxa real já vem embutida no Net do payment_transactions
PISO_CAIXA = 750.0       # piso de caixa (ou a maior colisão prevista, o que for maior)
LIMITE_CARTAO = None     # limite do cartão de ads em USD, se houver um dedicado (senão None)

FUSO = "America/Sao_Paulo"  # datas convertidas p/ Brasília (UTC empurra venda noturna pro dia seguinte)

# Contas de anúncio (para a previsão de cobrança do caixa). threshold_usd = valor
# em que o Meta/Google cobra o cartão. O acumulado e o gasto diário são digitados
# no export de caixa (ver README) ou no ads.csv.
CONTAS_ADS = [
    {"nome": "Meta 1", "threshold_usd": None},
    {"nome": "Meta 2", "threshold_usd": None},
    {"nome": "Google", "threshold_usd": None},
]

# Reembolsos que NÃO passaram pelo Shopify Payments (fantasmas manuais da fila do
# fornecedor). Ex.: ["#1234", "#1250"]
FANTASMAS_MANUAIS = []

# Pedidos de brinde/UGC — saem inteiros (sem receita e sem COGS). Ex.: ["#1300"]
PEDIDOS_BRINDE = []

# COGS manual p/ pedido que o fornecedor não cotou (Final Price = 0).
# Ex.: {"#1234": 25.00}
OVERRIDE_COGS = {}

# Janela (dias) p/ estimar COGS de pedido não cotado pela razão mediana COGS/receita.
JANELA_ESTIMATIVA_COGS = 10

# Idade (dias) a partir da qual um pedido na fila do fornecedor é destacado.
IDADE_ALERTA_FILA = 5
