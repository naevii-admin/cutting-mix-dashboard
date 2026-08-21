#!/usr/bin/env python3
# -----------------------------------------------------------------------------
# gerar_pnl.py -> data/pnl.json
#
# Regime de competência (agrupa por data do PEDIDO, em Brasília).
# Receita = Net do payment_transactions (vem em EUR, o payout) convertido p/ USD
# transação a transação pela taxa implícita (Presentment USD / Amount EUR).
# COGS = Final Price do fornecedor (dedup por Store+Order). Ads = manual por conta.
#
# Roda mesmo sem nenhum input: gera JSON vazio mas válido, com o mês corrente.
# -----------------------------------------------------------------------------

import config as C
from common import (
    input_mais_recente, ler_tabela, num, data_brasilia, normalizar_pedido,
    r1, r2, gravar_json, hoje_brasilia, mes_de,
)


def achar_coluna(linha, *candidatos):
    """Localiza uma coluna por nome aproximado (case/acentos/espacos frouxos)."""
    if not linha:
        return None
    chaves = {k.strip().lower(): k for k in linha.keys()}
    for cand in candidatos:
        c = cand.strip().lower()
        if c in chaves:
            return chaves[c]
    for cand in candidatos:  # match parcial
        c = cand.strip().lower()
        for kl, kreal in chaves.items():
            if c in kl:
                return kreal
    return None


# ---------- 1. Datas dos pedidos (orders_export) ----------
def mapa_datas_e_status():
    linhas = ler_tabela(input_mais_recente("orders_export*.csv", "orders*.csv"))
    datas, status = {}, {}
    if not linhas:
        return datas, status
    amostra = linhas[0]
    col_ped = achar_coluna(amostra, "Name", "Order", "Order Number", "Pedido")
    col_dt = achar_coluna(amostra, "Created at", "Created At", "Processed at", "Data")
    col_st = achar_coluna(amostra, "Financial Status", "Financial status", "Status")
    for l in linhas:
        ped = normalizar_pedido(l.get(col_ped)) if col_ped else ""
        if not ped:
            continue
        if col_dt and l.get(col_dt):
            datas.setdefault(ped, data_brasilia(l.get(col_dt)))
        if col_st and l.get(col_st):
            status.setdefault(ped, str(l.get(col_st)).strip().lower())
    return datas, status


# ---------- 2. Receita líquida por pedido (payment_transactions) ----------
def receita_por_pedido():
    """Devolve dict pedido -> {net_eur, net_usd, data_pagto} e listas de fantasmas."""
    linhas = ler_tabela(input_mais_recente("payment_transactions*.csv", "payments*.csv"))
    por_pedido, reembolsos, fantasmas = {}, [], set()
    if not linhas:
        return por_pedido, reembolsos, fantasmas
    a = linhas[0]
    col_ped = achar_coluna(a, "Order", "Order Name", "Pedido", "Name")
    col_tipo = achar_coluna(a, "Type", "Transaction Type", "Tipo")
    col_net = achar_coluna(a, "Net", "Net Amount")
    col_amt = achar_coluna(a, "Amount")                      # payout currency (EUR)
    col_pres = achar_coluna(a, "Presentment Amount", "Presentment")  # sale currency (USD)
    col_dt = achar_coluna(a, "Transaction Date", "Date", "Created at")

    for l in linhas:
        ped = normalizar_pedido(l.get(col_ped)) if col_ped else ""
        if not ped:
            continue
        tipo = (str(l.get(col_tipo)).strip().lower() if col_tipo else "")
        net_eur = num(l.get(col_net)) if col_net else 0.0
        amt_eur = num(l.get(col_amt)) if col_amt else 0.0
        pres_usd = num(l.get(col_pres)) if col_pres else 0.0
        # taxa implícita EUR->USD desta transação (USD por EUR)
        taxa = (pres_usd / amt_eur) if amt_eur else 0.0
        net_usd = net_eur * taxa if taxa else 0.0
        data = data_brasilia(l.get(col_dt)) if col_dt else None

        if "refund" in tipo or "chargeback" in tipo:
            fantasmas.add(ped)
            reembolsos.append({"pedido": ped, "data": data, "total_eur": r2(abs(net_eur))})

        d = por_pedido.setdefault(ped, {"net_eur": 0.0, "net_usd": 0.0, "data_pagto": data})
        d["net_eur"] += net_eur
        d["net_usd"] += net_usd
        if data and not d["data_pagto"]:
            d["data_pagto"] = data
    return por_pedido, reembolsos, fantasmas


# ---------- 3. COGS por pedido (fornecedor) ----------
def cogs_por_pedido():
    linhas = ler_tabela(input_mais_recente("fornecedor*.xls*", "fornecedor*.csv", "wiio*.xls*"))
    cogs, sem_cotacao = {}, set()
    vistos = set()
    if not linhas:
        return cogs, sem_cotacao
    a = linhas[0]
    col_ped = achar_coluna(a, "Order Number", "Order", "Pedido", "Order No")
    col_loja = achar_coluna(a, "Store", "Loja")
    col_preco = achar_coluna(a, "Final Price", "Final", "Custo", "Cost", "Price")
    for l in linhas:
        ped = normalizar_pedido(l.get(col_ped)) if col_ped else ""
        if not ped:
            continue
        loja = str(l.get(col_loja)).strip() if col_loja else ""
        if C.STORE_ID and loja and C.STORE_ID not in loja:
            continue  # ignora outras lojas do painel do fornecedor
        chave = (loja, ped)                 # dedup por (Store, Order Number)
        if chave in vistos:
            continue
        vistos.add(chave)
        preco = num(l.get(col_preco)) if col_preco else 0.0
        if preco <= 0:
            sem_cotacao.add(ped)
        cogs[ped] = cogs.get(ped, 0.0) + preco
    return cogs, sem_cotacao


# ---------- 4. Ads por dia e por conta (manual) ----------
def ads_por_dia():
    """ads.csv: colunas data, conta, valor_usd. Devolve dia -> {meta, google}."""
    linhas = ler_tabela(input_mais_recente("ads*.csv"))
    por_dia = {}
    if not linhas:
        return por_dia
    a = linhas[0]
    col_dt = achar_coluna(a, "data", "date", "dia")
    col_conta = achar_coluna(a, "conta", "account", "fonte", "source")
    col_val = achar_coluna(a, "valor_usd", "valor", "amount", "usd", "gasto")
    for l in linhas:
        dia = data_brasilia(l.get(col_dt)) if col_dt else None
        if not dia:
            continue
        conta = (str(l.get(col_conta)).strip().lower() if col_conta else "")
        val = num(l.get(col_val)) if col_val else 0.0
        d = por_dia.setdefault(dia, {"meta": 0.0, "google": 0.0})
        if "google" in conta:
            d["google"] += val
        else:
            d["meta"] += val
    return por_dia


# ---------- 5. Montagem do P&L ----------
def montar():
    datas, status = mapa_datas_e_status()
    receita, reembolsos, fantasmas_auto = receita_por_pedido()
    cogs, sem_cotacao = cogs_por_pedido()
    ads = ads_por_dia()

    brinde = {normalizar_pedido(p) for p in C.PEDIDOS_BRINDE}
    for ped, custo in C.OVERRIDE_COGS.items():
        cogs[normalizar_pedido(ped)] = float(custo)

    # Junta o universo de pedidos válidos (com receita e/ou data)
    pedidos = set(receita) | set(datas)
    cancelados = []
    dia_ord = {}  # data -> acumulador do dia

    for ped in pedidos:
        st = status.get(ped, "")
        if st in ("refunded", "voided") or ped in brinde:
            if st in ("refunded", "voided"):
                cancelados.append({"pedido": ped, "data": datas.get(ped), "status": st})
            continue  # sai inteiro: nem pedido, nem receita, nem COGS
        data = datas.get(ped) or (receita.get(ped, {}) or {}).get("data_pagto")
        if not data:
            continue
        r = receita.get(ped, {"net_eur": 0.0, "net_usd": 0.0})
        acc = dia_ord.setdefault(data, {
            "pedidos": 0, "rec_eur": 0.0, "rec_usd": 0.0, "cogs": 0.0,
            "sem_cotacao": 0, "estimados": [],
        })
        acc["pedidos"] += 1
        acc["rec_eur"] += r["net_eur"]
        acc["rec_usd"] += r["net_usd"]
        if ped in cogs:
            acc["cogs"] += cogs[ped]
        if ped in sem_cotacao:
            acc["sem_cotacao"] += 1
            acc["estimados"].append(ped)

    dias = _finalizar_dias(dia_ord, ads)
    return dias, reembolsos, cancelados


def _razao_cogs_mediana(dias, ate_idx):
    """Razão mediana COGS/receita dos pedidos cotados nos últimos N dias fechados."""
    janela = [d for d in dias[max(0, ate_idx - C.JANELA_ESTIMATIVA_COGS):ate_idx]
              if d["rec_usd"] > 0 and d["cogs"] > 0 and d["sem_cotacao"] == 0]
    if not janela:
        return 0.40  # fallback conservador (40%) até haver histórico
    razoes = sorted(d["cogs"] / d["rec_usd"] for d in janela)
    n = len(razoes)
    return razoes[n // 2] if n % 2 else (razoes[n // 2 - 1] + razoes[n // 2]) / 2


def _finalizar_dias(dia_ord, ads):
    hoje = hoje_brasilia()
    linhas = []
    for data in sorted(dia_ord):
        acc = dia_ord[data]
        linhas.append({
            "data": data, "mes": mes_de(data), "pedidos": acc["pedidos"],
            "rec_eur": acc["rec_eur"], "rec_usd": acc["rec_usd"], "cogs": acc["cogs"],
            "sem_cotacao": acc["sem_cotacao"], "estimados": acc["estimados"],
        })

    # Estima COGS de dias com pedido não cotado, pela razão mediana recente
    for i, d in enumerate(linhas):
        cogs_estimado = False
        if d["sem_cotacao"] > 0 and d["rec_usd"] > 0:
            razao = _razao_cogs_mediana(linhas, i)
            # completa só o que falta: assume que os cotados já estão no d["cogs"]
            faltando = d["sem_cotacao"]
            ticket = d["rec_usd"] / d["pedidos"] if d["pedidos"] else 0
            d["cogs"] += faltando * ticket * razao
            cogs_estimado = True
        d["cogs_estimado"] = cogs_estimado

    saida = []
    lucro_acc = 0.0
    ads_acc = 0.0
    for d in linhas:
        data = d["data"]
        a = ads.get(data)
        ads_informado = a is not None
        # dia parcial: dia corrente OU ads ainda não informado
        parcial = (data >= hoje) or (not ads_informado)

        rec_usd = r2(d["rec_usd"])
        rec_eur = r2(d["rec_eur"])
        cogs_usd = r2(d["cogs"])
        taxa = r2(d["rec_usd"] / d["rec_eur"]) if d["rec_eur"] else None

        if ads_informado:
            ads_meta = r2(a["meta"])
            ads_google = r2(a["google"])
            ads_usd = r2(a["meta"] + a["google"])
        else:
            ads_meta = ads_google = ads_usd = None

        registro = {
            "data": data, "mes": d["mes"], "pedidos": d["pedidos"],
            "receita_liquida_eur": rec_eur, "cambio_eur_usd_dia": taxa,
            "receita_liquida_usd": rec_usd,
            "receita_liquida_brl": r2(d["rec_usd"] * C.CAMBIO_USD_BRL),
            "cogs_usd": cogs_usd, "cogs_brl": r2(d["cogs"] * C.CAMBIO_USD_BRL),
            "cogs_pct": r1(d["cogs"] / d["rec_usd"] * 100) if d["rec_usd"] else None,
            "ads_usd": ads_usd, "ads_brl": r2(ads_usd * C.CAMBIO_USD_BRL) if ads_usd is not None else None,
            "ads_meta_usd": ads_meta, "ads_google_usd": ads_google,
            "ads_pct": r1(ads_usd / d["rec_usd"] * 100) if (ads_usd is not None and d["rec_usd"]) else None,
            "pedidos_sem_cotacao": d["sem_cotacao"],
            "pedidos_estimados": d["estimados"],
            "cogs_estimado": d["cogs_estimado"],
            "dia_parcial": parcial,
            "desconto_eur": 0,
        }

        if parcial:
            registro.update({
                "lucro_usd": None, "lucro_brl": None, "margem_pct": None,
                "cpa_usd": None, "ticket_liquido_usd": r2(d["rec_usd"] / d["pedidos"]) if d["pedidos"] else None,
                "roas": None, "roas_breakeven_dia": _breakeven(d["rec_usd"], d["cogs"]),
                "lucro_acumulado_usd": r2(lucro_acc), "ads_acumulado_mes_usd": r2(ads_acc),
            })
        else:
            lucro = d["rec_usd"] - d["cogs"] - (a["meta"] + a["google"])
            lucro_acc += lucro
            ads_acc += (a["meta"] + a["google"])
            registro.update({
                "lucro_usd": r2(lucro), "lucro_brl": r2(lucro * C.CAMBIO_USD_BRL),
                "margem_pct": r1(lucro / d["rec_usd"] * 100) if d["rec_usd"] else None,
                "cpa_usd": r2(ads_usd / d["pedidos"]) if d["pedidos"] else None,
                "ticket_liquido_usd": r2(d["rec_usd"] / d["pedidos"]) if d["pedidos"] else None,
                "roas": r2(d["rec_usd"] / ads_usd) if ads_usd else None,
                "roas_breakeven_dia": _breakeven(d["rec_usd"], d["cogs"]),
                "lucro_acumulado_usd": r2(lucro_acc), "ads_acumulado_mes_usd": r2(ads_acc),
            })
        saida.append(registro)
    return saida


def _breakeven(rec, cogs):
    """ROAS de break-even do dia = receita / (receita - cogs)."""
    margem = rec - cogs
    return r2(rec / margem) if margem > 0 else None


def totais_do_mes(dias_do_mes):
    fechados = [d for d in dias_do_mes if not d["dia_parcial"]]
    parciais = [d for d in dias_do_mes if d["dia_parcial"]]
    if not fechados:
        base = {k: None for k in (
            "pedidos", "receita_liquida_usd", "receita_liquida_brl", "cogs_usd",
            "cogs_pct", "ads_usd", "ads_pct", "lucro_usd", "lucro_brl", "margem_pct",
            "cpa_usd", "ticket_liquido_usd", "roas", "roas_breakeven")}
        base.update({
            "dias_fechados": 0, "dias_parciais": len(parciais),
            "primeiro_dia": dias_do_mes[0]["data"] if dias_do_mes else "",
            "ultimo_dia_fechado": "", "mes_completo": False,
        })
        return base
    ped = sum(d["pedidos"] for d in fechados)
    rec = sum(d["receita_liquida_usd"] for d in fechados)
    cogs = sum(d["cogs_usd"] for d in fechados)
    adsv = sum(d["ads_usd"] for d in fechados)
    lucro = sum(d["lucro_usd"] for d in fechados)
    margem = lucro - 0  # placeholder p/ clareza
    breakeven = rec / (rec - cogs) if (rec - cogs) > 0 else None
    return {
        "pedidos": ped, "receita_liquida_usd": r2(rec),
        "receita_liquida_brl": r2(rec * C.CAMBIO_USD_BRL),
        "cogs_usd": r2(cogs), "cogs_pct": r1(cogs / rec * 100) if rec else None,
        "ads_usd": r2(adsv), "ads_pct": r1(adsv / rec * 100) if rec else None,
        "lucro_usd": r2(lucro), "lucro_brl": r2(lucro * C.CAMBIO_USD_BRL),
        "margem_pct": r1(lucro / rec * 100) if rec else None,
        "cpa_usd": r2(adsv / ped) if ped else None,
        "ticket_liquido_usd": r2(rec / ped) if ped else None,
        "roas": r2(rec / adsv) if adsv else None,
        "roas_breakeven": r2(breakeven) if breakeven else None,
        "dias_fechados": len(fechados), "dias_parciais": len(parciais),
        "primeiro_dia": dias_do_mes[0]["data"],
        "ultimo_dia_fechado": fechados[-1]["data"],
        "mes_completo": False,
    }


def main():
    dias, reembolsos, cancelados = montar()

    # Garante que o MÊS CORRENTE apareça mesmo sem venda (senão some do seletor).
    meses = sorted({d["mes"] for d in dias})
    mes_atual = hoje_brasilia()[:7]
    if mes_atual not in meses:
        meses.append(mes_atual)
        meses = sorted(meses)

    totais_por_mes = {}
    for m in meses:
        dias_m = [d for d in dias if d["mes"] == m]
        totais_por_mes[m] = totais_do_mes(dias_m)

    # totais_fechados: soma TODOS os meses (NÃO usar no painel de mês)
    todos_fechados = [d for d in dias if not d["dia_parcial"]]
    totais_fechados = totais_do_mes(todos_fechados) if todos_fechados else totais_do_mes([])

    # câmbio EUR->USD médio do que foi convertido
    tot_eur = sum(d["receita_liquida_eur"] for d in dias if d["receita_liquida_eur"])
    tot_usd = sum(d["receita_liquida_usd"] for d in dias if d["receita_liquida_usd"])
    cambio_medio = r2(tot_usd / tot_eur) if tot_eur else None

    saida = {
        "meta": {
            "marca": C.MARCA, "gerado_em": hoje_brasilia(),
            "moeda_base": C.MOEDA_BASE, "moeda_payout": C.MOEDA_PAYOUT,
            "cambio_eur_usd_medio": cambio_medio, "cambio_usd_brl": C.CAMBIO_USD_BRL,
            "fuso_horario": C.FUSO,
            "observacoes": [
                "Receita = Net do payment_transactions (EUR) convertido p/ USD pela taxa implícita de cada transação (Presentment USD / Amount EUR); nunca por constante.",
                "Moeda base = USD (fornecedor e ads são USD; só a receita chega em EUR).",
                "Pedidos refunded/voided e brindes saem inteiros (sem pedido, receita nem COGS).",
                "COGS dedup por (Store, Order Number); Final Price=0 é estimado (cogs_estimado=true), não gratuito.",
                "ads_usd = ads_meta_usd + ads_google_usd; o painel de mês usa totais_por_mes, nunca totais_fechados.",
                "dia_parcial=true (dia corrente ou ads não informado) fica fora dos totais, com ads/lucro/margem null.",
            ],
        },
        "meses": meses,
        "totais_por_mes": totais_por_mes,
        "totais_fechados": totais_fechados,
        "dias": dias,
        "reembolsos": reembolsos,
        "cancelados": cancelados,
    }
    gravar_json("pnl.json", saida)
    print(f"P&L: {len(dias)} dias, meses {meses}")


if __name__ == "__main__":
    main()
