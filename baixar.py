"""
Baixador interativo com fila.
Um download por vez; demais URLs ficam na espera.
Se fechar no meio, a fila de URLs pendentes volta ao abrir.
Sem historico, sem log em disco, sem cache.
"""

from __future__ import annotations

import traceback

import fila
import queue_worker
from ytdlp_backend import (
    FFMPEG_BIN,
    FFPROBE_BIN,
    TARGET_FPS,
    TARGET_HEIGHT,
    TEMP_DIR,
    VIDEOS_DIR,
    YTDLP_BIN,
    bin_ok,
    is_valid_media_url,
    log_erro,
    log_info,
)


def perguntar(texto: str) -> str:
    try:
        return input(f"{texto}: ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return ""


def checar_bins() -> bool:
    ok = True
    for nome, binario in (
        ("yt-dlp", YTDLP_BIN),
        ("ffmpeg", FFMPEG_BIN),
        ("ffprobe", FFPROBE_BIN),
    ):
        vive = bin_ok(binario)
        print(f"  {nome}: {'ok' if vive else 'AUSENTE'}", flush=True)
        if not vive:
            ok = False
    return ok


def mostrar_fila() -> None:
    st = queue_worker.worker.status()
    n = st["pendingCount"]
    print(f"Fila: {n} pendente(s)", flush=True)
    if st["current"]:
        print(f"  baixando agora: {st['current']}", flush=True)
    for i, url in enumerate(st["pending"], 1):
        marca = ">>" if i == 1 and st["busy"] else "  "
        print(f"{marca} {i}. {url}", flush=True)
    if st["pausedError"]:
        print("Pausado apos erro. Digite: continuar | pular | limpar", flush=True)


def main() -> int:
    print()
    print("Baixador de videos publicos (fila)")
    print(f"  saida: {VIDEOS_DIR}")
    print(f"  sempre MP4 {TARGET_HEIGHT}p {TARGET_FPS}fps")
    print("  nome: UUID.mp4 + metadados aleatorios")
    print("  1 download por vez; cole mais links a qualquer momento")
    print("  ao fechar, so a fila pendente e lembrada (sem historico/log/cache)")
    print()
    print("Comandos: fila | pular | continuar | limpar | sair")
    print("Cole a URL para enfileirar. Enter vazio = sair (fila fica salva).")
    print()
    print("Binarios:")
    if not checar_bins():
        print()
        print("ERRO: falta yt-dlp e/ou ffmpeg no PATH.")
        return 1

    fila.limpar_temporarios(TEMP_DIR)
    pendencias = fila.listar()
    if pendencias:
        print()
        log_info(f"Retomando {len(pendencias)} URL(s) pendente(s) da sessao anterior.")
        mostrar_fila()

    worker = queue_worker.worker

    def on_idle() -> None:
        # Sem cache: temporarios limpos quando a fila fica ociosa.
        fila.limpar_temporarios(TEMP_DIR)

    worker.on_idle = on_idle
    worker.start()

    print()
    while True:
        linha = perguntar("URL ou comando")
        cmd = linha.lower()

        if not linha or cmd in ("sair", "exit", "quit", "q"):
            print("Saindo. Fila pendente preservada para a proxima abertura.")
            worker.stop()
            return 0

        if cmd in ("fila", "status", "f"):
            mostrar_fila()
            continue

        if cmd in ("limpar", "clear"):
            n = fila.limpar()
            worker.kick()
            print(f"Fila limpa ({n} removida(s)).", flush=True)
            continue

        if cmd in ("pular", "skip"):
            pulada = fila.remover_atual()
            if pulada:
                print(f"Pulada: {pulada}", flush=True)
            else:
                print("Fila vazia.", flush=True)
            worker.kick()
            continue

        if cmd in ("continuar", "retry", "ok"):
            print("Retomando fila...", flush=True)
            worker.kick()
            continue

        if not is_valid_media_url(linha):
            print("ERRO: URL invalida ou comando desconhecido.", flush=True)
            continue

        try:
            info = fila.adicionar(linha)
            if info["added"]:
                print(
                    f"Enfileirado na posicao {info['position']} "
                    f"(total {info['pending']}).",
                    flush=True,
                )
            else:
                print(
                    f"Ja estava na fila (posicao {info['position']}).",
                    flush=True,
                )
            worker.kick()
        except Exception as err:
            log_erro("Nao enfileirou", err)
            print(traceback.format_exc())


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print()
        print("Saindo. Fila pendente preservada.")
        try:
            queue_worker.worker.stop()
        except Exception:
            pass
        raise SystemExit(0)
