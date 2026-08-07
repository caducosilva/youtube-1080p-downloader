"""
Fila anonima de URLs pendentes.

So o necessario para retomar se o app fechar:
- lista de URLs ainda nao concluidas
- sem historico, sem titulos, sem caminhos, sem logs, sem cache

Quando a fila esvazia, o arquivo some do disco.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path

from ytdlp_backend import is_valid_media_url, log_info

# Estado minimo no home do usuario (nunca hardcode C:\\Users\\...).
FILA_PATH = (
    Path.home() / "Desktop" / "youtube-1080p-downloader" / ".fila_pendente.json"
)

_lock = threading.RLock()


def _ler_bruto() -> list[dict]:
    """Cada entrada: {"url": str, "ids": list[str]}. "ids" vazio = baixa tudo
    que a URL resolver (video unico, ou album/playlist inteiro)."""
    if not FILA_PATH.is_file():
        return []
    try:
        raw = FILA_PATH.read_text(encoding="utf-8").strip()
        if not raw:
            return []
        data = json.loads(raw)
        pending = data.get("pending") if isinstance(data, dict) else None
        if not isinstance(pending, list):
            return []
        out: list[dict] = []
        vistos: set[str] = set()
        for item in pending:
            if isinstance(item, str):
                url, ids_raw = item, None
            elif isinstance(item, dict):
                url, ids_raw = item.get("url"), item.get("ids")
            else:
                continue
            if not isinstance(url, str):
                continue
            url = url.strip()
            if not url or not is_valid_media_url(url):
                continue
            if url in vistos:
                continue
            vistos.add(url)
            ids = (
                [str(x).strip() for x in ids_raw if str(x).strip()]
                if isinstance(ids_raw, list)
                else []
            )
            out.append({"url": url, "ids": ids})
        return out
    except Exception:
        # Arquivo corrompido: descarta (anonimo, sem log em disco).
        try:
            FILA_PATH.unlink(missing_ok=True)
        except Exception:
            pass
        return []


def _gravar(entradas: list[dict]) -> None:
    """Grava so URLs pendentes (+ ids selecionados). Se vazio, apaga o arquivo."""
    FILA_PATH.parent.mkdir(parents=True, exist_ok=True)
    limpos: list[dict] = []
    vistos: set[str] = set()
    for item in entradas:
        url = str(item.get("url") or "").strip()
        if not url or not is_valid_media_url(url) or url in vistos:
            continue
        vistos.add(url)
        ids = [str(x).strip() for x in (item.get("ids") or []) if str(x).strip()]
        limpos.append({"url": url, "ids": ids})

    if not limpos:
        FILA_PATH.unlink(missing_ok=True)
        return

    # So pending. Nada de timestamps, titulos, historico.
    payload = json.dumps({"pending": limpos}, ensure_ascii=False, separators=(",", ":"))
    tmp = FILA_PATH.with_suffix(".tmp")
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(FILA_PATH)


def listar() -> list[str]:
    """URLs pendentes, so pra exibicao (sem os ids selecionados)."""
    with _lock:
        return [e["url"] for e in _ler_bruto()]


def tamanho() -> int:
    return len(listar())


def adicionar(url: str, ids: list[str] | None = None) -> dict:
    """Enfileira URL (com ids opcionais, pra baixar so parte de uma playlist).
    Ignora duplicata ja pendente."""
    url = (url or "").strip()
    if not is_valid_media_url(url):
        raise ValueError("URL http/https invalida.")
    ids_limpos = [str(x).strip() for x in (ids or []) if str(x).strip()]
    with _lock:
        atual = _ler_bruto()
        urls = [e["url"] for e in atual]
        if url in urls:
            return {"added": False, "position": urls.index(url) + 1, "pending": len(atual)}
        atual.append({"url": url, "ids": ids_limpos})
        _gravar(atual)
        return {"added": True, "position": len(atual), "pending": len(atual)}


def proxima() -> str | None:
    """Primeira URL (continua na fila ate concluir com sucesso)."""
    with _lock:
        atual = _ler_bruto()
        return atual[0]["url"] if atual else None


def proxima_com_ids() -> tuple[str, list[str]] | None:
    """Primeira URL + ids selecionados (lista vazia = baixa tudo)."""
    with _lock:
        atual = _ler_bruto()
        if not atual:
            return None
        item = atual[0]
        return item["url"], item["ids"]


def concluir_atual() -> None:
    """Remove a primeira URL apos download OK. Sem historico."""
    with _lock:
        atual = _ler_bruto()
        if not atual:
            return
        restante = atual[1:]
        _gravar(restante)
        if not restante:
            log_info("Fila vazia (arquivo de pendencias removido).")


def remover_atual() -> str | None:
    """Pula a URL da frente (falha / usuario pediu). Sem historico."""
    with _lock:
        atual = _ler_bruto()
        if not atual:
            return None
        pulada = atual[0]["url"]
        _gravar(atual[1:])
        return pulada


def limpar() -> int:
    """Apaga toda a fila pendente."""
    with _lock:
        n = len(_ler_bruto())
        _gravar([])
        return n


def limpar_temporarios(temp_dir: Path) -> None:
    """Nao guarda cache: limpa pasta temporaria de downloads."""
    if not temp_dir.is_dir():
        return
    for p in temp_dir.iterdir():
        try:
            if p.is_file():
                p.unlink(missing_ok=True)
        except Exception:
            pass
