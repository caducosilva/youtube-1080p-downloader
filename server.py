"""
API HTTP local com fila de downloads.
Um por vez; pendencias retomam ao reabrir. Sem log/historico/cache em disco.
"""

from __future__ import annotations

import json
import os
import queue
import socket
import subprocess
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import fila
import queue_worker
from ytdlp_backend import (
    FFMPEG_BIN,
    FFPROBE_BIN,
    TEMP_DIR,
    YTDLP_BIN,
    bin_ok,
    fetch_metadata,
    is_valid_media_url,
    log_erro,
    log_info,
)

HOST = "127.0.0.1"
PORTAS_CANDIDATAS = [
    *([int(os.environ["PORT"])] if os.environ.get("PORT", "").isdigit() else []),
    8765,
    8766,
    8767,
    8877,
    9100,
    9123,
    18080,
    28080,
    0,
]

# No Windows, SO_REUSEADDR deixa um segundo processo se ligar na mesma porta
# de um listener antigo (zumbi) sem erro algum: as duas instancias ficam
# escutando juntas e o SO manda conexoes ora pra uma ora pra outra, causando
# os ConnectionResetError aleatorios. SO_EXCLUSIVEADDRUSE bloqueia isso: bind()
# so funciona se a porta estiver de fato livre.
_EXCLUSIVE_OPT = getattr(socket, "SO_EXCLUSIVEADDRUSE", None)


def _tornar_exclusiva(sock: socket.socket) -> None:
    if _EXCLUSIVE_OPT is not None:
        sock.setsockopt(socket.SOL_SOCKET, _EXCLUSIVE_OPT, 1)
    else:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)


def _matar_zumbi_na_porta(porta: int) -> bool:
    """Se a porta estiver presa por uma instancia antiga deste mesmo server.py
    (processo que morreu sem liberar o socket, ou janela fechada no X), mata
    so esse processo e devolve True. Nunca mexe em processo de outro app."""
    if sys.platform != "win32" or not porta:
        return False
    # Caminho completo (nao so o nome): outros projetos irmãos tambem tem um
    # server.py, e so o nome bateria neles tambem.
    script = str(Path(__file__).resolve())
    ps_cmd = (
        f"Get-NetTCPConnection -LocalPort {porta} -State Listen -ErrorAction SilentlyContinue "
        "| Select-Object -ExpandProperty OwningProcess -Unique "
        "| ForEach-Object { "
        "    $p = Get-CimInstance Win32_Process -Filter \"ProcessId=$_\" -ErrorAction SilentlyContinue; "
        f"    if ($p -and $p.ProcessId -ne {os.getpid()} -and $p.CommandLine -like '*{script}*') {{ "
        "        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; "
        "        Write-Output $p.ProcessId "
        "    } "
        "}"
    )
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception:
        return False
    mortos = [linha.strip() for linha in (r.stdout or "").splitlines() if linha.strip()]
    for pid in mortos:
        log_info(f"Zumbi encerrado: PID {pid} ainda segurava a porta {porta}.")
    if mortos:
        time.sleep(0.3)  # da tempo do SO liberar o socket antes de tentar de novo
    return bool(mortos)


def _tentar_bind(host: str, porta: int) -> int | None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        _tornar_exclusiva(sock)
        try:
            sock.bind((host, porta))
        except OSError:
            return None
        return int(sock.getsockname()[1])


def achar_porta_livre(host: str = HOST) -> int:
    vistos: set[int] = set()
    for porta in PORTAS_CANDIDATAS:
        if porta in vistos:
            continue
        vistos.add(porta)

        escolhida = _tentar_bind(host, porta)
        if escolhida is None and porta and _matar_zumbi_na_porta(porta):
            # Porta ocupada por uma instancia zumbi nossa: mata e tenta de novo
            # (evita cair pra outra porta que o front nao conhece por padrao).
            escolhida = _tentar_bind(host, porta)

        if escolhida is not None:
            log_info(f"porta livre encontrada: {escolhida}")
            return escolhida
        if porta:
            log_info(f"porta {porta} indisponivel (em uso por outro processo)")
    raise OSError("Nenhuma porta local disponivel.")


_BENIGN_ERRORS = (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)


class ServidorExclusivo(ThreadingHTTPServer):
    """Nunca compartilha a porta com outro processo (ver _tornar_exclusiva)."""

    allow_reuse_address = False

    def server_bind(self) -> None:
        _tornar_exclusiva(self.socket)
        super().server_bind()

    def handle_error(self, request, client_address) -> None:
        # Cliente (browser) resetou a conexao antes de terminar a requisicao
        # (comum com EventSource/preflight): nao e falha do servidor.
        exc = sys.exc_info()[1]
        if isinstance(exc, _BENIGN_ERRORS):
            return
        super().handle_error(request, client_address)


_console_handler_ref = None


def _instalar_shutdown_janela(cleanup) -> None:
    """No Windows, fechar a janela do console (X) nao gera KeyboardInterrupt:
    o processo e encerrado a forca e a porta fica presa (zumbi). Isso pega
    esse evento (e logoff/desligamento) pra liberar a porta antes de morrer."""
    if sys.platform != "win32":
        return
    import ctypes
    import ctypes.wintypes

    global _console_handler_ref
    handler_type = ctypes.WINFUNCTYPE(ctypes.wintypes.BOOL, ctypes.wintypes.DWORD)

    def handler(ctrl_type: int) -> bool:
        # CTRL_C=0 CTRL_BREAK=1 CTRL_CLOSE=2 CTRL_LOGOFF=5 CTRL_SHUTDOWN=6
        if ctrl_type in (0, 1, 2, 5, 6):
            cleanup()
            return True
        return False

    _console_handler_ref = handler_type(handler)
    ctypes.windll.kernel32.SetConsoleCtrlHandler(_console_handler_ref, True)


def cors_headers() -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Cache-Control, Last-Event-ID",
    }


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        # Sem log de acesso (anonimo). Erros operacionais usam log_info pontual.
        return

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": str(len(body)),
            "Cache-Control": "no-store",
            **cors_headers(),
        }
        self.send_response(status)
        for k, v in headers.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        for k, v in cors_headers().items():
            self.send_header(k, v)
        self.end_headers()

    def do_POST(self) -> None:
        self.do_GET()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)

        try:
            if path == "/":
                self._send_json(
                    200,
                    {
                        "service": "yt-dlp-video-1080p30",
                        "frontend": False,
                        "profile": "video MP4 1920x1080 @ 30fps",
                        "queue": True,
                        "anonymous": True,
                        "endpoints": {
                            "health": "GET /api/health",
                            "metadata": "GET /api/metadata?url=",
                            "queue": "GET /api/queue",
                            "queue_add": "GET|POST /api/queue/add?url=",
                            "queue_skip": "GET|POST /api/queue/skip",
                            "queue_clear": "GET|POST /api/queue/clear",
                            "queue_continue": "GET|POST /api/queue/continue",
                            "queue_events": "GET /api/queue/events",
                            "download": "GET /api/download?url= (enfileira)",
                        },
                    },
                )
                return

            if path == "/api/health":
                binaries = {
                    "ytdlp": bin_ok(YTDLP_BIN),
                    "ffmpeg": bin_ok(FFMPEG_BIN),
                    "ffprobe": bin_ok(FFPROBE_BIN),
                }
                self._send_json(
                    200,
                    {
                        "ok": True,
                        "service": "yt-dlp-video-1080p30",
                        "profile": "video MP4 1920x1080 @ 30fps",
                        "binaries": binaries,
                        "queue": queue_worker.worker.status(),
                    },
                )
                return

            if path == "/api/metadata":
                url = (qs.get("url") or [""])[0].strip()
                if not is_valid_media_url(url):
                    self._send_json(
                        200,
                        {"valid": False, "error": "URL http/https invalida."},
                    )
                    return
                meta = fetch_metadata(url)
                self._send_json(200, {"valid": True, **meta})
                return

            if path == "/api/queue":
                self._send_json(200, queue_worker.worker.status())
                return

            if path == "/api/queue/add":
                url = (qs.get("url") or [""])[0].strip()
                if not is_valid_media_url(url):
                    self._send_json(400, {"error": "URL http/https invalida."})
                    return
                # ids opcionais: baixar so alguns videos de uma playlist/album.
                ids_raw = (qs.get("ids") or [""])[0].strip()
                ids = [x for x in (i.strip() for i in ids_raw.split(",")) if x]
                info = fila.adicionar(url, ids)
                queue_worker.worker.kick()
                self._send_json(200, {**info, **queue_worker.worker.status()})
                return

            if path == "/api/queue/skip":
                pulada = fila.remover_atual()
                queue_worker.worker.kick()
                self._send_json(
                    200,
                    {
                        "skipped": bool(pulada),
                        **queue_worker.worker.status(),
                    },
                )
                return

            if path == "/api/queue/clear":
                n = fila.limpar()
                queue_worker.worker.kick()
                self._send_json(
                    200,
                    {"cleared": n, **queue_worker.worker.status()},
                )
                return

            if path == "/api/queue/continue":
                queue_worker.worker.kick()
                self._send_json(200, queue_worker.worker.status())
                return

            if path == "/api/queue/events":
                self._handle_queue_events()
                return

            if path == "/api/download":
                # Compat: enfileira a URL (e ids sao ignorados no perfil atual da fila).
                url = (qs.get("url") or [""])[0].strip()
                if not is_valid_media_url(url):
                    self._send_json(400, {"error": "Cole um link http ou https valido."})
                    return
                fila.adicionar(url)
                queue_worker.worker.kick()
                self._handle_queue_events()
                return

            self._send_json(404, {"error": "Rota nao encontrada."})
        except Exception as err:
            log_erro(f"Falha em {path}", err)
            self._send_json(
                500,
                {
                    "error": str(err),
                },
            )

    def _handle_queue_events(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, no-transform")
        self.send_header("Connection", "keep-alive")
        for k, v in cors_headers().items():
            self.send_header(k, v)
        self.end_headers()

        q: queue.Queue[tuple[str, dict]] = queue.Queue()

        def on_event(event: str, data: dict) -> None:
            q.put((event, data))

        unsub = queue_worker.worker.subscribe(on_event)
        # Snapshot inicial (sem historico alem da fila atual).
        q.put(("queue", queue_worker.worker.status()))

        try:
            while True:
                try:
                    event, data = q.get(timeout=15)
                except queue.Empty:
                    # keepalive
                    self.wfile.write(b":\n\n")
                    self.wfile.flush()
                    continue
                payload = (
                    f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                )
                self.wfile.write(payload.encode("utf-8"))
                self.wfile.flush()
        except Exception:
            pass
        finally:
            unsub()


def main() -> int:
    try:
        porta = achar_porta_livre(HOST)
    except OSError as err:
        log_erro("Nao achei porta livre", err)
        return 1

    fila.limpar_temporarios(TEMP_DIR)
    queue_worker.worker.on_idle = lambda: fila.limpar_temporarios(TEMP_DIR)
    queue_worker.worker.start()
    n = fila.tamanho()
    if n:
        log_info(f"Retomando {n} URL(s) pendente(s).")

    log_info(f"API em http://{HOST}:{porta}")
    log_info("Fila: /api/queue  /api/queue/add  /api/queue/events")
    log_info("Sem log/historico/cache em disco. Ctrl+C libera a porta.")

    server = ServidorExclusivo((HOST, porta), Handler)

    encerrado = threading.Event()

    def encerrar() -> None:
        if encerrado.is_set():
            return
        encerrado.set()
        queue_worker.worker.stop()
        try:
            server.shutdown()
        except Exception:
            pass
        try:
            server.server_close()
        except Exception:
            pass
        fila.limpar_temporarios(TEMP_DIR)
        log_info("Porta liberada.")

    _instalar_shutdown_janela(encerrar)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log_info("Encerrado. Fila pendente preservada.")
    except Exception as err:
        log_erro("Falha ao subir servidor", err)
        return 1
    finally:
        encerrar()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
