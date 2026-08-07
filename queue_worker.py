"""
Worker da fila: um download por vez.
Persistencia so de URLs pendentes (ver fila.py). Sem historico/log/cache.
"""

from __future__ import annotations

import threading
import time
import traceback
from typing import Any, Callable

import fila
from ytdlp_backend import (
    TEMP_DIR,
    DownloadOptions,
    download_and_convert,
    fetch_metadata,
    log_erro,
    log_info,
)

ProgressCb = Callable[[dict[str, Any]], None]
DoneCb = Callable[[dict[str, Any]], None]
ErrorCb = Callable[[str, str], None]
EventCb = Callable[[str, dict[str, Any]], None]


class QueueWorker:
    def __init__(self) -> None:
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._busy = threading.Lock()
        self._thread: threading.Thread | None = None
        self._atual: str | None = None
        self._paused_error = False
        self._listeners: list[EventCb] = []
        self._listeners_lock = threading.Lock()
        self.on_progress: ProgressCb | None = None
        self.on_item_done: DoneCb | None = None
        self.on_item_error: ErrorCb | None = None
        self.on_idle: Callable[[], None] | None = None

    @property
    def atual(self) -> str | None:
        return self._atual

    @property
    def ocupado(self) -> bool:
        return self._atual is not None

    @property
    def pausado_por_erro(self) -> bool:
        return self._paused_error

    def subscribe(self, cb: EventCb) -> Callable[[], None]:
        with self._listeners_lock:
            self._listeners.append(cb)

        def unsub() -> None:
            with self._listeners_lock:
                if cb in self._listeners:
                    self._listeners.remove(cb)

        return unsub

    def _broadcast(self, event: str, data: dict[str, Any]) -> None:
        with self._listeners_lock:
            listeners = list(self._listeners)
        for cb in listeners:
            try:
                cb(event, data)
            except Exception:
                pass

    def start(self) -> None:
        fila.limpar_temporarios(TEMP_DIR)
        if self._thread and self._thread.is_alive():
            self.kick()
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._loop, name="fila-download", daemon=True
        )
        self._thread.start()
        self.kick()

    def stop(self, wait: bool = False) -> None:
        self._stop.set()
        self._wake.set()
        if wait and self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def kick(self) -> None:
        self._paused_error = False
        self._wake.set()
        self._broadcast("queue", self.status())

    def status(self) -> dict[str, Any]:
        pending = fila.listar()
        return {
            "busy": self.ocupado,
            "current": self._atual,
            "pausedError": self._paused_error,
            "pending": pending,
            "pendingCount": len(pending),
        }

    def _emit_progress(self, ev: dict[str, Any]) -> None:
        if self.on_progress:
            try:
                self.on_progress(ev)
            except Exception:
                pass
        self._broadcast("progress", ev)

    def _loop(self) -> None:
        while not self._stop.is_set():
            if self._paused_error:
                self._wake.wait(timeout=1.0)
                self._wake.clear()
                continue

            proxima = fila.proxima_com_ids()
            if not proxima:
                self._atual = None
                if self.on_idle:
                    try:
                        self.on_idle()
                    except Exception:
                        pass
                self._broadcast("queue", self.status())
                self._wake.wait(timeout=1.0)
                self._wake.clear()
                continue
            url, ids = proxima

            with self._busy:
                self._atual = url
                self._broadcast("queue", self.status())
                try:
                    self._baixar(url, ids)
                    fila.concluir_atual()
                except Exception as err:
                    msg = str(err)
                    stack = traceback.format_exc()
                    log_erro("Falha na fila (URL permanece pendente)", err)
                    self._paused_error = True
                    if self.on_item_error:
                        try:
                            self.on_item_error(msg, stack)
                        except Exception:
                            pass
                    self._broadcast("error", {"message": msg})
                finally:
                    self._atual = None
                    self._broadcast("queue", self.status())

            time.sleep(0.05)

    def _baixar(self, url: str, ids: list[str] | None = None) -> None:
        log_info("Fila: iniciando item")
        try:
            meta = fetch_metadata(url)
            tipo = meta.get("type")
            log_info(f"OK: {tipo}")
            if tipo == "playlist":
                total = len(meta.get("entries") or [])
                if ids:
                    log_info(f"Playlist: {len(ids)}/{total} video(s) selecionado(s)")
                else:
                    log_info(f"Playlist: {total} video(s)")
        except Exception:
            log_info("Metadata indisponivel, tentando download direto")

        def on_progress(ev: dict[str, Any]) -> None:
            stage = ev.get("stage")
            if stage == "item":
                log_info(f"Item {ev.get('index')}/{ev.get('total')}")
            elif stage == "baixando":
                pct = ev.get("percent")
                if isinstance(pct, (int, float)) and (pct >= 99 or int(pct) % 25 == 0):
                    log_info(f"Baixando... {pct:.0f}%")
            elif stage == "convertendo":
                log_info("Convertendo / limpando metadados...")
            elif stage == "finalizando":
                log_info("Finalizando...")
            self._emit_progress(ev)

        result = download_and_convert(
            url, DownloadOptions(video_ids=list(ids or [])), on_progress
        )
        log_info(f"Pronto. {len(result['titles'])} arquivo(s)")
        for p in result["finalPaths"]:
            print(f"  - {p}", flush=True)
        payload = {
            "titles": result["titles"],
            "paths": result["finalPaths"],
            "outputFolder": result["outputFolder"],
            "count": len(result["titles"]),
        }
        if self.on_item_done:
            self.on_item_done(payload)
        self._broadcast("done", payload)


worker = QueueWorker()
