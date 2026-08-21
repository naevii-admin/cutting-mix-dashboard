#!/usr/bin/env python3
# -----------------------------------------------------------------------------
# gerar_caixa.py -> data/caixa.json
#
# Regime de caixa, projeção de 8 dias. Entradas (EUR, payout) e saídas (USD,
# fornecedor + ads) são projetadas em pernas separadas e comparadas em USD.
#   disponivel = savings_checking - saldo_devedor_cartao
#   entradas   = Net do payment_transactions por Payout Date (pending+scheduled+in_transit)
#   ads        = previsão por threshold (cartão liquida em D+1); colisão = 2+ no mesmo dia
#   fila       = pedidos não pagos do fornecedor, mais velho primeiro
#
# Saldos e acumulados são digitados pelo Simon em inputs/saldos.json (ver README).
# Roda vazio (sem input) gerando JSON válido com o mês corrente.
# -----------------------------------------------------------------------------

import json
import os
from datetime import datetime, timedelta

import config as C
from common import (
    input_mais_recente, ler_tabela, num, data_brasilia, normalizar_pedido,
    r2, gravar_json, hoje_brasilia, INPUTS,
)


def carregar_saldos():
    """Lê inputs/saldos.json (valores digitados pelo Simon). Ausente -> vazio."""
    caminho = os.path.join(INPUTS, "saldos.json")
    if not os.path.isfile(caminho):
        return {}
    with open(caminho, encoding="utf-8") as fh:
        return json.load(fh)


def achar_coluna(linha, *cands):
    if not linha:
        return None
    chaves = {k.strip().lower(): k for k in linha.keys()}
    for c in cands:
        if c.strip().lower() in chaves:
            return chaves[c.strip().lower()]
    for c in cands:
        for kl, kreal in chaves.items():
            if c.strip().lower() in kl:
                return kreal
    return None


def proxima_util(data):
    """Empurra sábado/domingo p/ a segunda seguinte (banco não credita no fds)."""
    d = datetime.strptime(data, "%Y-%m-%d").date()
    while d.weekday() >= 5:  # 5=sáb, 6=dom
        d += timedelta(days=1)
    return d.strftime("%Y-%m-%d")


def eh_fim_de_semana(data):
    return datetime.strptime(data, "%Y-%m-%d").date().weekday() >= 5


# ---------- Entradas: Net por Payout Date (payment_transactions) ----------
def entradas_futuras():
    linhas = ler_tabela(input_mais_recente("payment_transactions*.csv", "payments*.csv"))
    if not linhas:
        return []
    a = linhas[0]
    col_status = achar_coluna(a, "Payout Status", "Status")
    col_pdate = achar_coluna(a, "Payout Date", "Payout")
    col_net = achar_coluna(a, "Net", "Net Amount")
    col_amt = achar_coluna(a, "Amount")
    col_pres = achar_coluna(a, "Presentment Amount", "Presentment")

    porta = {}  # payout_date -> {status: {transacoes, net_usd}}
    for l in linhas:
        status = (str(l.get(col_status)).strip().lower() if col_status else "")
        if status not in ("pending", "scheduled", "in_transit", "in transit"):
            continue
        pdate = data_brasilia(l.get(col_pdate)) if col_pdate else None
        if not pdate:
            continue
        net_eur = num(l.get(col_net)) if col_net else 0.0
        amt_eur = num(l.get(col_amt)) if col_amt else 0.0
        pres_usd = num(l.get(col_pres)) if col_pres else 0.0
        taxa = (pres_usd / amt_eur) if amt_eur else 0.0
        net_usd = net_eur * taxa
        st = "in_transit" if "transit" in status else status
        alvo = porta.setdefault(pdate, {})
        alvo.setdefault(st, {"transacoes": 0, "net_usd": 0.0})
        alvo[st]["transacoes"] += 1
        alvo[st]["net_usd"] += net_usd

    detalhe = []
    for pdate in sorted(porta):
        credita = proxima_util(pdate)
        por_status = {s: {"transacoes": v["transacoes"], "net_usd": r2(v["net_usd"])}
                      for s, v in porta[pdate].items()}
        total = sum(v["net_usd"] for v in porta[pdate].values())
        detalhe.append({
            "payout_date": pdate, "credita_em": credita,
            "adiado_fim_de_semana": credita != pdate,
            "total_usd": r2(total), "por_status": por_status,
        })
    return detalhe


# ---------- Fila do fornecedor ----------
def fila_fornecedor(fantasmas):
    linhas = ler_tabela(input_mais_recente("fornecedor*.xls*", "fornecedor*.csv", "wiio*.xls*"))
    if not linhas:
        return None, []
    a = linhas[0]
    col_ped = achar_coluna(a, "Order Number", "Order", "Pedido")
    col_loja = achar_coluna(a, "Store", "Loja")
    col_preco = achar_coluna(a, "Final Price", "Custo", "Cost", "Price")
    col_data = achar_coluna(a, "Order Time", "Order Date", "Data")
    col_pago = achar_coluna(a, "Paid", "Payment Status", "Status")

    hoje = datetime.strptime(hoje_brasilia(), "%Y-%m-%d").date()
    vistos, itens, sem_cotacao = set(), [], []
    for l in linhas:
        ped = normalizar_pedido(l.get(col_ped)) if col_ped else ""
        if not ped:
            continue
        loja = str(l.get(col_loja)).strip() if col_loja else ""
        if C.STORE_ID and loja and C.STORE_ID not in loja:
            continue
        if (loja, ped) in vistos:
            continue
        vistos.add((loja, ped))
        pago = (str(l.get(col_pago)).strip().lower() if col_pago else "")
        if pago in ("paid", "pago", "1", "true", "yes"):
            continue
        if ped in fantasmas:
            continue  # fantasma (reembolsado/chargeback) — não pagar
        preco = num(l.get(col_preco)) if col_preco else 0.0
        if preco <= 0:
            sem_cotacao.append(ped)
        data_ped = data_brasilia(l.get(col_data)) if col_data else None
        idade = (hoje - datetime.strptime(data_ped, "%Y-%m-%d").date()).days if data_ped else 0
        itens.append({"pedido": ped, "valor_usd": r2(preco), "idade_dias": idade, "data": data_ped})
    itens.sort(key=lambda x: (x["data"] or "9999", x["pedido"]))  # mais velho primeiro
    return itens, sem_cotacao


# ---------- Previsão de cobrança dos ads (threshold) ----------
def prever_ads(contas_cfg, dias=8):
    """Para cada dia, quais contas cobram (acumulado+gasto>=threshold; cartão D+1)."""
    hoje = datetime.strptime(hoje_brasilia(), "%Y-%m-%d").date()
    contas = []
    for c in contas_cfg:
        th = c.get("threshold_usd")
        if not th:
            continue
        contas.append({
            "nome": c.get("nome", "?"), "threshold": float(th),
            "acumulado": float(c.get("acumulado_usd") or 0),
            "gasto": float(c.get("gasto_diario_usd") or 0),
            "cobrancas": [],
        })
    cobrancas_por_dia = {}  # data (D+1, sai do caixa) -> valor
    for offset in range(dias):
        dia = (hoje + timedelta(days=offset)).strftime("%Y-%m-%d")
        for c in contas:
            if c["gasto"] <= 0 or c["threshold"] <= 0:
                continue
            c["acumulado"] += c["gasto"]
            if c["acumulado"] >= c["threshold"]:
                c["acumulado"] -= c["threshold"]
                # cobrança no cartão em D, sai do caixa em D+1
                saida = (hoje + timedelta(days=offset + 1)).strftime("%Y-%m-%d")
                c["cobrancas"].append(saida)
                cobrancas_por_dia[saida] = cobrancas_por_dia.get(saida, 0.0) + c["threshold"]
    return contas, cobrancas_por_dia


def resumo_contas(contas):
    hoje = datetime.strptime(hoje_brasilia(), "%Y-%m-%d").date()
    saida = []
    for c in contas:
        falta = max(c["threshold"] - c["acumulado"], 0)
        dias_ate = round(falta / c["gasto"], 2) if c["gasto"] > 0 else None
        saida.append({
            "nome": c["nome"], "threshold_usd": r2(c["threshold"]),
            "acumulado_usd": r2(c["acumulado"]), "gasto_diario_usd": r2(c["gasto"]),
            "falta_usd": r2(falta), "dias_ate_cobrar": dias_ate,
            "cobrancas_previstas": sorted(set(c["cobrancas"])),
        })
    return saida


def main():
    saldos = carregar_saldos()
    contas_cfg = saldos.get("contas_ads") or []
    # herda thresholds do config.py quando o saldos.json não trouxe
    if not contas_cfg:
        contas_cfg = [dict(c) for c in C.CONTAS_ADS]

    fantasmas = {normalizar_pedido(p) for p in C.FANTASMAS_MANUAIS}
    entradas = entradas_futuras()
    itens_fila, sem_cotacao = fila_fornecedor(fantasmas)
    contas, cobrancas_dia = prever_ads(contas_cfg)

    caixa = float(saldos.get("caixa_usd") or 0)
    devedor = float(saldos.get("saldo_devedor_cartao_usd") or 0)
    disponivel = caixa - devedor
    piso_base = float(saldos.get("piso_usd") or C.PISO_CAIXA)

    # entradas por dia de crédito
    entra_por_dia = {}
    for e in entradas:
        entra_por_dia[e["credita_em"]] = entra_por_dia.get(e["credita_em"], 0.0) + e["total_usd"]

    # ---- projeção de 8 dias ----
    hoje = datetime.strptime(hoje_brasilia(), "%Y-%m-%d").date()
    projecao, saldo = [], disponivel
    # piso final = max(piso base, maior colisão prevista)
    colisoes = []
    contagem_por_dia = {}
    for c in contas:
        for d in c["cobrancas"]:
            contagem_por_dia.setdefault(d, []).append(c["threshold"])
    for d, vals in contagem_por_dia.items():
        if len(vals) >= 2:
            colisoes.append({"data": d, "valor_usd": r2(sum(vals))})
    colisoes.sort(key=lambda x: x["data"])
    piso = max(piso_base, max((cl["valor_usd"] for cl in colisoes), default=0))

    for offset in range(8):
        dia = (hoje + timedelta(days=offset)).strftime("%Y-%m-%d")
        entrada = round(entra_por_dia.get(dia, 0.0), 2)
        saida_ads = round(cobrancas_dia.get(dia, 0.0), 2)
        saldo = round(saldo + entrada - saida_ads, 2)
        projecao.append({
            "data": dia, "entrada_usd": entrada, "saida_ads_usd": saida_ads,
            "saldo_usd": saldo, "vs_piso_usd": round(saldo - piso, 2),
            "abaixo_piso": saldo < piso,
            "colisao": len(contagem_por_dia.get(dia, [])) >= 2,
            "fim_de_semana": eh_fim_de_semana(dia),
            "entrada_confirmada": entrada > 0,
            "hoje": offset == 0,
        })

    menor_saldo = min((p["saldo_usd"] for p in projecao), default=disponivel)
    teto = max(0.0, round(menor_saldo - piso, 2))

    # ---- fila do fornecedor ----
    if itens_fila is None:
        fila = {
            "pedidos": 0, "total_usd": 0, "idade_min_dias": 0, "idade_max_dias": 0,
            "por_dia": [], "teto_pagamento_hoje_usd": r2(teto), "pagar_hoje": [],
            "pagar_hoje_total_usd": 0, "sem_cotacao": [],
            "bloqueados_pedidos": 0, "bloqueados_total_usd": 0,
        }
    else:
        total_fila = sum(i["valor_usd"] for i in itens_fila)
        idades = [i["idade_dias"] for i in itens_fila] or [0]
        por_dia = {}
        for i in itens_fila:
            k = i["data"] or "s/data"
            g = por_dia.setdefault(k, {"data": i["data"], "pedidos": 0, "total_usd": 0.0})
            g["pedidos"] += 1
            g["total_usd"] += i["valor_usd"]
        # pagar hoje: os mais velhos até o teto
        pagar, soma = [], 0.0
        for i in itens_fila:
            if soma + i["valor_usd"] > teto:
                continue
            pagar.append({"pedido": i["pedido"], "valor_usd": i["valor_usd"], "idade_dias": i["idade_dias"]})
            soma += i["valor_usd"]
        fila = {
            "pedidos": len(itens_fila), "total_usd": r2(total_fila),
            "idade_min_dias": min(idades), "idade_max_dias": max(idades),
            "por_dia": [{"data": v["data"], "pedidos": v["pedidos"], "total_usd": r2(v["total_usd"])}
                        for v in sorted(por_dia.values(), key=lambda x: x["data"] or "")],
            "teto_pagamento_hoje_usd": r2(teto),
            "pagar_hoje": pagar, "pagar_hoje_total_usd": r2(soma),
            "sem_cotacao": sem_cotacao,
            "bloqueados_pedidos": len(fantasmas), "bloqueados_total_usd": 0,
        }

    # ---- alertas ----
    alertas = []
    for cl in colisoes:
        alertas.append({"nivel": "alto",
                        "texto": f"Colisão do Meta em {cl['data']}: ${cl['valor_usd']:.2f} no mesmo dia."})
    # só alerta de piso quando a loja já tem caixa/entradas configurados (senão é ruído)
    if (disponivel > 0 or entradas) and any(p["abaixo_piso"] for p in projecao):
        d = next(p for p in projecao if p["abaixo_piso"])
        alertas.append({"nivel": "alto",
                        "texto": f"Saldo projetado cai abaixo do piso de ${piso:.2f} em {d['data']} (${d['saldo_usd']:.2f})."})
    if C.LIMITE_CARTAO:
        for d, vals in contagem_por_dia.items():
            if sum(vals) > C.LIMITE_CARTAO:
                alertas.append({"nivel": "alto",
                                "texto": f"Cobranças de ${sum(vals):.2f} em {d} passam do limite do cartão (${C.LIMITE_CARTAO:.2f}) — o Meta pode recusar."})
    if sem_cotacao:
        alertas.append({"nivel": "baixo",
                        "texto": f"{len(sem_cotacao)} pedido(s) sem cotação na fila — o total real é maior que o mostrado."})

    entradas_total = round(sum(e["total_usd"] for e in entradas), 2)
    regime = {
        "entrada_usd": r2(entradas_total / 14) if entradas else 0,  # média diária grosseira
        "ads_usd": r2(sum(cobrancas_dia.values()) / 8) if cobrancas_dia else 0,
        "cogs_novo_usd": 0,
        "sobra_livre_usd": 0,
        "dias_para_zerar_fila": 0,
    }

    saida = {
        "meta": {
            "marca": C.MARCA, "mes": hoje_brasilia()[:7], "gerado_em": hoje_brasilia(),
            "piso_caixa_usd": piso,
            "observacoes": [
                "Entradas = Net por Payout Date (pending+scheduled+in_transit), convertido EUR->USD pela taxa implícita; NÃO usar o export de payouts.",
                "Payout de sábado/domingo credita na segunda (banco não credita no fim de semana).",
                "Disponível = savings+checking - saldo devedor do cartão. Cartão liquida em D+1.",
                "Cobrança de ads prevista por threshold; colisão = 2+ contas no mesmo dia.",
                "Reserva Shopify e valores retidos não são caixa disponível hoje.",
            ],
        },
        "saldos": {
            "caixa_usd": r2(caixa), "caixa_eur": r2(float(saldos.get("caixa_eur") or 0)),
            "saldo_devedor_cartao_usd": r2(devedor), "disponivel_usd": r2(disponivel),
            "piso_usd": r2(piso), "livre_hoje_usd": r2(max(0.0, disponivel - piso)),
            "retido_shopify_usd": r2(float(saldos.get("retido_shopify_usd") or 0)),
            "entradas_futuras_usd": r2(entradas_total),
        },
        "entradas_detalhe": entradas,
        "ads_contas": resumo_contas(contas),
        "colisoes": colisoes,
        "projecao": projecao,
        "fila_fornecedor": fila,
        "regime_diario": regime,
        "alertas": alertas,
    }
    gravar_json("caixa.json", saida)
    print(f"Caixa: {len(entradas)} entradas, {len(projecao)} dias projetados, {len(colisoes)} colisão(ões)")


if __name__ == "__main__":
    main()
