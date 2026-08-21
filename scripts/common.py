# -----------------------------------------------------------------------------
# Helpers compartilhados: localizar inputs, ler CSV/planilha, datas em Brasília,
# arredondamentos e leitura tolerante de números "sujos" (com $, €, vírgula).
# Só usa a stdlib no caminho vazio (loja sem venda); pandas é carregado sob demanda.
# -----------------------------------------------------------------------------

import csv
import glob
import os
import re
import json
from datetime import datetime, timezone, timedelta

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUTS = os.path.join(RAIZ, "inputs")
DATA = os.path.join(RAIZ, "data")

# America/Sao_Paulo = UTC-3 o ano todo (o Brasil não usa mais horário de verão).
TZ_BRASILIA = timezone(timedelta(hours=-3))


def input_mais_recente(*padroes):
    """Arquivo mais recente (por mtime) que casa com qualquer glob em inputs/."""
    achados = []
    for p in padroes:
        achados += glob.glob(os.path.join(INPUTS, p))
    achados = [a for a in achados if os.path.isfile(a)]
    if not achados:
        return None
    return max(achados, key=os.path.getmtime)


def ler_tabela(caminho):
    """Lê CSV/TSV/XLS/XLSX numa lista de dicts (colunas -> valor string).
    Retorna [] se o arquivo não existir. Planilhas exigem pandas."""
    if not caminho or not os.path.isfile(caminho):
        return []
    ext = os.path.splitext(caminho)[1].lower()
    if ext in (".xls", ".xlsx"):
        import pandas as pd  # só carrega quando há planilha de verdade
        df = pd.read_excel(caminho, dtype=str).fillna("")
        return df.to_dict("records")
    # CSV/TSV — detecta o separador
    with open(caminho, newline="", encoding="utf-8-sig") as fh:
        amostra = fh.read(4096)
        fh.seek(0)
        try:
            dialeto = csv.Sniffer().sniff(amostra, delimiters=",;\t")
        except csv.Error:
            dialeto = csv.excel
        return list(csv.DictReader(fh, dialect=dialeto))


def num(valor, padrao=0.0):
    """Converte texto possivelmente 'sujo' ($ 1.234,56 / 1,234.56 / €12) em float."""
    if valor is None:
        return padrao
    if isinstance(valor, (int, float)):
        return float(valor)
    s = str(valor).strip()
    if not s:
        return padrao
    s = re.sub(r"[^\d,.\-]", "", s)  # tira símbolos de moeda e espaços
    if not s or s in ("-", ".", ","):
        return padrao
    # Decide qual é o separador decimal olhando o último símbolo
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):      # 1.234,56 -> vírgula é decimal
            s = s.replace(".", "").replace(",", ".")
        else:                                 # 1,234.56 -> ponto é decimal
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return padrao


def data_brasilia(texto_iso):
    """Timestamp da Shopify (ISO, normalmente UTC) -> 'YYYY-MM-DD' em Brasília.
    Datas puras (sem hora) NÃO são convertidas — só têm dia, não instante.
    Serve p/ payout date, Order Time e ads.csv, que já vêm como data local."""
    if not texto_iso:
        return None
    t = str(texto_iso).strip().replace("Z", "+00:00")
    # data pura "YYYY-MM-DD" (ou "YYYY/MM/DD"): devolve como está, sem tz
    m_pura = re.fullmatch(r"(\d{4})[-/](\d{2})[-/](\d{2})", t)
    if m_pura:
        return f"{m_pura.group(1)}-{m_pura.group(2)}-{m_pura.group(3)}"
    try:
        dt = datetime.fromisoformat(t)
    except ValueError:
        m = re.match(r"(\d{4})[-/](\d{2})[-/](\d{2})", t)  # pega só a data se o resto falhar
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(TZ_BRASILIA).strftime("%Y-%m-%d")


def normalizar_pedido(txt):
    """Normaliza número de pedido p/ casar entre fontes (#1234 / 1234 / CM1234)."""
    if txt is None:
        return ""
    s = str(txt).strip()
    m = re.search(r"(\d+)", s)
    return "#" + m.group(1) if m else s


def r2(x):
    return None if x is None else round(x + 0.0, 2)


def r1(x):
    return None if x is None else round(x + 0.0, 1)


def gravar_json(nome, obj):
    os.makedirs(DATA, exist_ok=True)
    caminho = os.path.join(DATA, nome)
    with open(caminho, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
    print(f"gravado {os.path.relpath(caminho, RAIZ)}")


def hoje_brasilia():
    return datetime.now(TZ_BRASILIA).strftime("%Y-%m-%d")


def mes_de(data):
    return data[:7] if data else None
