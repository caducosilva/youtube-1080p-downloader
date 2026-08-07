"""Nucleo yt-dlp: so videos publicos da internet em MP4 1080p @ 30fps."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import traceback
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
# Saida sempre via home do usuario (nunca hardcode C:\Users\...).
VIDEOS_DIR = Path.home() / "Videos" / "VideoDownloader"
OUTPUT_DIR = VIDEOS_DIR
TEMP_DIR = ROOT / ".tmp-downloads"

# Unico perfil de saida. Sempre.
TARGET_WIDTH = 1920
TARGET_HEIGHT = 1080
TARGET_FPS = 30

YTDLP_BIN = os.environ.get("YTDLP_PATH", "yt-dlp")
FFMPEG_BIN = os.environ.get("FFMPEG_PATH", "ffmpeg")
FFPROBE_BIN = os.environ.get("FFPROBE_PATH", "ffprobe")
ARIA2C_BIN = os.environ.get("ARIA2C_PATH", "aria2c")
POT_SERVER_URL = os.environ.get("POT_SERVER_URL", "http://127.0.0.1:4416")
FIREFOX_PROFILE = os.environ.get("FIREFOX_PROFILE_PATH")

DOWNLOAD_PROGRESS_RE = re.compile(r"\[download\]\s+(\d{1,3}(?:\.\d+)?)%")
FFMPEG_TIME_RE = re.compile(r"time=(\d{2}):(\d{2}):(\d{2})\.(\d+)")
YOUTUBE_HOST_RE = re.compile(
    r"^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)$",
    re.I,
)

# Encode mais rapido: medium/crf18 engasgava videos longos (parecia travado).
FFMPEG_PRESET = os.environ.get("FFMPEG_PRESET", "veryfast")
FFMPEG_CRF = os.environ.get("FFMPEG_CRF", "20")

ProgressCb = Callable[[dict[str, Any]], None]


def log_info(msg: str) -> None:
    print(f"INFO: {msg}", flush=True)


def log_erro(msg: str, err: BaseException | None = None) -> None:
    print(f"ERRO: {msg}", flush=True)
    if err is not None:
        traceback.print_exception(type(err), err, err.__traceback__)


def sanitize_file_name(name: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]', " ", name)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return (cleaned[:150] if cleaned else "video")


def is_valid_media_url(url: str) -> bool:
    try:
        parsed = urlparse(url.strip())
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except Exception:
        return False


def is_youtube_url(url: str) -> bool:
    try:
        return bool(YOUTUBE_HOST_RE.match(urlparse(url.strip()).hostname or ""))
    except Exception:
        return False


def is_youtube_playlist_url(url: str) -> bool:
    if not is_youtube_url(url):
        return False
    parsed = urlparse(url.strip())
    if "/playlist" not in (parsed.path or "").lower():
        return False
    return bool(parse_qs(parsed.query).get("list"))


def has_list_param(url: str) -> bool:
    try:
        return bool(parse_qs(urlparse(url).query).get("list"))
    except Exception:
        return bool(re.search(r"[?&]list=", url))


def auth_args_for(url: str) -> list[str]:
    if not is_youtube_url(url):
        return []
    args = [
        "--remote-components",
        "ejs:github",
        "--extractor-args",
        f"youtubepot-bgutilhttp:base_url={POT_SERVER_URL}",
    ]
    if FIREFOX_PROFILE:
        args.extend(["--cookies-from-browser", f"firefox:{FIREFOX_PROFILE}"])
    return args


def run_process(
    bin_name: str,
    args: list[str],
    on_stdout_line: Callable[[str], None] | None = None,
    on_stderr_line: Callable[[str], None] | None = None,
    *,
    quiet_stderr: bool = False,
) -> str:
    cmd = [bin_name, *args]
    log_info(f"CMD: {' '.join(cmd)}")
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            shell=False,
        )
    except FileNotFoundError as err:
        log_erro(f"Binario nao encontrado: {bin_name}", err)
        raise

    stdout_chunks: list[str] = []
    stderr_chunks: list[str] = []

    assert proc.stdout is not None
    assert proc.stderr is not None

    import threading

    def _read_stdout() -> None:
        for line in proc.stdout:
            stdout_chunks.append(line)
            text = line.rstrip("\r\n")
            if text and on_stdout_line:
                on_stdout_line(text)

    def _read_stderr() -> None:
        for line in proc.stderr:
            stderr_chunks.append(line)
            text = line.rstrip("\r\n")
            if not text:
                continue
            if on_stderr_line:
                on_stderr_line(text)
            elif not quiet_stderr:
                print(f"STDERR: {text}", flush=True)

    t_out = threading.Thread(target=_read_stdout, daemon=True)
    t_err = threading.Thread(target=_read_stderr, daemon=True)
    t_out.start()
    t_err.start()
    code = proc.wait()
    t_out.join()
    t_err.join()

    stdout = "".join(stdout_chunks)
    stderr = "".join(stderr_chunks)

    if code == 0:
        log_info(f"{bin_name} ok (exit 0)")
        return stdout

    detail = (stderr[-2000:] or stdout[-2000:] or "(sem saida)")
    err = RuntimeError(f"{bin_name} terminou com codigo {code}: {detail}")
    log_erro(f"{bin_name} falhou", err)
    raise err


def parse_ffmpeg_time_seconds(line: str) -> float | None:
    m = FFMPEG_TIME_RE.search(line)
    if not m:
        return None
    hh, mm, ss, frac = m.groups()
    base = int(hh) * 3600 + int(mm) * 60 + int(ss)
    # frac pode ter 1-2 digitos
    frac_s = float(f"0.{frac}") if frac else 0.0
    return base + frac_s


def probe_duration_seconds(file_path: Path) -> float | None:
    try:
        out = run_process(
            FFPROBE_BIN,
            [
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=nk=1:nw=1",
                str(file_path),
            ],
            quiet_stderr=True,
        ).strip()
        if not out:
            return None
        return float(out)
    except Exception:
        return None


def pick_thumbnail(info: dict[str, Any]) -> str:
    thumb = info.get("thumbnail")
    if isinstance(thumb, str):
        return thumb
    thumbs = info.get("thumbnails")
    if isinstance(thumbs, list) and thumbs:
        last = thumbs[-1]
        if isinstance(last, dict) and isinstance(last.get("url"), str):
            return last["url"]
    return ""


def is_direct_media_url(url: str) -> bool:
    path = (urlparse(url).path or "").lower()
    return bool(
        re.search(r"\.(mp4|m4v|webm|mkv|mov|m3u8|mpd)(?:$|\?)", path, re.I)
    )


def resolve_entry_url(info: dict[str, Any], entry_id: str) -> str:
    """Prefere URL do arquivo (CDN .mp4). webpage_url do album colapsa tudo em 1."""
    candidatos: list[str] = []
    for key in ("url", "webpage_url", "original_url"):
        val = info.get(key)
        if isinstance(val, str) and re.match(r"^https?://", val, re.I):
            candidatos.append(val)
    for c in candidatos:
        if is_direct_media_url(c):
            return c
    if candidatos:
        return candidatos[0]
    if entry_id and re.match(r"^[\w-]{6,}$", entry_id):
        return f"https://www.youtube.com/watch?v={entry_id}"
    return ""


def normalize_media_key(url: str, entry_id: str = "") -> str:
    """Chave pra deduplicar (erome/generic coloca o mesmo video 2x no HTML)."""
    raw = (url or "").strip()
    if not raw:
        return f"id:{entry_id}" if entry_id else ""
    try:
        parsed = urlparse(raw)
        host = (parsed.hostname or "").lower()
        path = (parsed.path or "").rstrip("/").lower()
        # A query importa: o yt-dlp da o mesmo path "/watch" pra TODOS os
        # videos do YouTube (o id fica em ?v=); ignorar a query colapsava
        # qualquer playlist do YouTube pra 1 video so.
        query = (parsed.query or "").lower()
        if host and path:
            return f"{host}{path}?{query}" if query else f"{host}{path}"
    except Exception:
        pass
    return raw.lower()


def is_probably_image_url(url: str) -> bool:
    path = (urlparse(url).path or "").lower()
    return bool(re.search(r"\.(jpe?g|png|gif|webp|bmp|avif)(?:$|\?)", path))


def probe_remote_duration(media_url: str, referer: str | None = None) -> float | None:
    """Le a duracao do arquivo remoto (pra distinguir videos diferentes no album)."""
    if not is_direct_media_url(media_url):
        return None
    args = ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1"]
    if referer:
        args.extend(["-headers", f"Referer: {referer}\r\n"])
    args.append(media_url)
    try:
        out = run_process(FFPROBE_BIN, args).strip()
        if not out:
            return None
        return float(out)
    except Exception:
        return None


def dedupe_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Remove duplicatas do HTML (mesma URL de arquivo).
    Depois, se duas URLs diferentes tiverem a MESMA duracao, mantem so a primeira.
    Videos com duracoes diferentes no mesmo album sao mantidos.
    """
    vistos_url: set[str] = set()
    por_url: list[dict[str, Any]] = []
    for entry in entries:
        url = str(entry.get("url") or "")
        entry_id = str(entry.get("id") or "")
        chave = normalize_media_key(url, entry_id)
        if not chave:
            continue
        if chave in vistos_url:
            log_info(f"Ignorando URL duplicada: id={entry_id} url={url}")
            continue
        # nao deduplicar so por id: no erome os ids -1,-2 sao clones do mesmo arquivo
        vistos_url.add(chave)
        por_url.append(entry)

    if len(por_url) != len(entries):
        log_info(f"Deduplicacao por URL: {len(entries)} -> {len(por_url)} item(ns)")

    # Completa duracao quando faltar (erome flat nao traz)
    for entry in por_url:
        if entry.get("durationSeconds") is None:
            dur = probe_remote_duration(entry.get("url") or "", entry.get("referer"))
            if dur is not None:
                entry["durationSeconds"] = dur
                log_info(f"Duracao {entry.get('id')}: {dur:.3f}s")

    vistos_dur: set[float] = set()
    unicos: list[dict[str, Any]] = []
    for entry in por_url:
        dur = entry.get("durationSeconds")
        if isinstance(dur, (int, float)):
            # arredonda em 0.2s: clones do mesmo arquivo batem; videos distintos nao
            chave_dur = round(float(dur) * 5) / 5.0
            if chave_dur in vistos_dur:
                log_info(
                    f"Ignorando duplicata por duracao={chave_dur}s "
                    f"id={entry.get('id')} url={entry.get('url')}"
                )
                continue
            vistos_dur.add(chave_dur)
        unicos.append(entry)

    if len(unicos) != len(por_url):
        log_info(f"Deduplicacao por duracao: {len(por_url)} -> {len(unicos)} item(ns)")
    return unicos


def entry_from_info(
    info: dict[str, Any],
    page_url: str | None = None,
) -> dict[str, Any] | None:
    raw_id = info.get("id")
    if isinstance(raw_id, (int, float)):
        entry_id = str(int(raw_id)) if float(raw_id).is_integer() else str(raw_id)
    elif isinstance(raw_id, str):
        entry_id = raw_id
    else:
        return None
    title = info.get("title")
    if not isinstance(title, str) or not title.strip():
        title = entry_id
    url = resolve_entry_url(info, entry_id)
    if not url:
        return None

    referer = None
    webpage = info.get("webpage_url")
    if isinstance(webpage, str) and webpage.startswith("http") and not is_direct_media_url(webpage):
        referer = webpage
    elif page_url:
        referer = page_url

    duration = info.get("duration")
    return {
        "id": entry_id,
        "title": title,
        "thumbnail": pick_thumbnail(info),
        "durationSeconds": duration if isinstance(duration, (int, float)) else None,
        "url": url,
        "referer": referer,
    }


def fetch_playlist_entries(url: str) -> dict[str, Any]:
    stdout = run_process(
        YTDLP_BIN,
        ["-J", "--flat-playlist", "--skip-download", *auth_args_for(url), url],
    )
    info = json.loads(stdout)
    entries: list[dict[str, Any]] = []
    for raw in info.get("entries") or []:
        if isinstance(raw, dict):
            entry = entry_from_info(raw, page_url=url)
            if entry:
                entries.append(entry)
    entries = dedupe_entries(entries)
    pid = info.get("id")
    title = info.get("title")
    return {
        "id": str(pid) if pid is not None else "playlist",
        "title": title if isinstance(title, str) and title.strip() else "playlist",
        "entries": entries,
    }


def video_from_info(info: dict[str, Any], fallback_url: str) -> dict[str, Any]:
    raw_id = info.get("id")
    if raw_id is None:
        vid = sanitize_file_name(fallback_url)[:40]
    else:
        vid = str(raw_id)
    title = info.get("title")
    if not isinstance(title, str) or not title.strip():
        title = vid
    return {
        "type": "video",
        "id": vid,
        "title": title,
        "thumbnail": pick_thumbnail(info),
        "durationSeconds": info.get("duration")
        if isinstance(info.get("duration"), (int, float))
        else None,
        "width": info.get("width") if isinstance(info.get("width"), int) else None,
        "height": info.get("height") if isinstance(info.get("height"), int) else None,
    }


def fetch_metadata(url: str) -> dict[str, Any]:
    trimmed = url.strip()
    if not is_valid_media_url(trimmed):
        raise ValueError("Cole um link http ou https valido.")

    if is_youtube_playlist_url(trimmed):
        playlist = fetch_playlist_entries(trimmed)
        return {
            "type": "playlist",
            "id": playlist["id"],
            "title": playlist["title"],
            "entries": playlist["entries"],
        }

    stdout = run_process(
        YTDLP_BIN,
        ["-J", "--no-playlist", "--skip-download", *auth_args_for(trimmed), trimmed],
    )
    info = json.loads(stdout)

    if info.get("_type") == "playlist" or (
        isinstance(info.get("entries"), list) and info["entries"]
    ):
        playlist = fetch_playlist_entries(trimmed)
        if playlist["entries"]:
            return {
                "type": "playlist",
                "id": playlist["id"],
                "title": playlist["title"],
                "entries": playlist["entries"],
            }

    video = video_from_info(info, trimmed)
    if is_youtube_url(trimmed) and has_list_param(trimmed):
        try:
            playlist = fetch_playlist_entries(trimmed)
            if len(playlist["entries"]) > 1:
                # O link e de 1 video mas ele faz parte de uma playlist/mix
                # com mais itens: trata como playlist (baixa ela inteira por
                # padrao; o usuario ainda pode desmarcar itens na UI).
                return {
                    "type": "playlist",
                    "id": playlist["id"],
                    "title": playlist["title"],
                    "entries": playlist["entries"],
                }
            if playlist["entries"]:
                video["playlist"] = playlist
        except Exception:
            pass
    return video


@dataclass
class DownloadOptions:
    """So ids opcionais de playlist. Qualidade e tipo sao fixos (video 1080p30)."""

    video_ids: list[str] = field(default_factory=list)


def parse_download_options(
    media: str | None = None,
    height: str | None = None,
    fps: str | None = None,
    ids: str | None = None,
) -> DownloadOptions:
    # media/height/fps ignorados de proposito: sempre video 1080p 30fps.
    _ = (media, height, fps)
    return DownloadOptions(
        video_ids=[x.strip() for x in (ids or "").split(",") if x.strip()],
    )


def scale_pad_1080() -> str:
    return (
        f"scale={TARGET_WIDTH}:{TARGET_HEIGHT}:force_original_aspect_ratio=decrease,"
        f"pad={TARGET_WIDTH}:{TARGET_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black"
    )


def random_metadata_args() -> list[str]:
    """Remove metadados originais e grava campos aleatorios."""
    args = ["-map_metadata", "-1"]
    for key in (
        "title",
        "artist",
        "album",
        "album_artist",
        "composer",
        "genre",
        "comment",
        "description",
        "synopsis",
        "copyright",
        "encoded_by",
        "publisher",
    ):
        args.extend(["-metadata", f"{key}={uuid.uuid4()}"])
    # ano aleatorio plausivel
    ano = 1990 + (uuid.uuid4().int % 36)
    args.extend(["-metadata", f"date={ano}"])
    args.extend(["-metadata", f"track={1 + (uuid.uuid4().int % 99)}"])
    return args


def find_downloaded_file(work_dir: Path, job_id: str, preferred_ext: str | None = None) -> Path:
    matches = [
        p
        for p in work_dir.iterdir()
        if p.name == job_id or p.name.startswith(f"{job_id}.")
    ]
    if not matches:
        raise FileNotFoundError("Arquivo baixado nao encontrado.")
    if preferred_ext:
        for p in matches:
            if p.suffix.lower() == f".{preferred_ext.lower()}":
                return p
    finals = [p for p in matches if not re.search(r"\.f\d+\.", p.name, re.I)]
    return finals[0] if finals else matches[0]


def probe_video(file_path: Path) -> dict[str, Any]:
    stdout = run_process(
        FFPROBE_BIN,
        [
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate",
            "-of",
            "json",
            str(file_path),
        ],
    )
    data = json.loads(stdout)
    stream = (data.get("streams") or [{}])[0]
    fps = None
    rate = stream.get("r_frame_rate")
    if isinstance(rate, str) and "/" in rate:
        num_s, den_s = rate.split("/", 1)
        den = float(den_s) or 0
        if den:
            fps = float(num_s) / den
    return {
        "width": stream.get("width") or 0,
        "height": stream.get("height") or 0,
        "fps": fps,
    }


def job_from_entry(entry: dict[str, Any], fallback_url: str = "") -> dict[str, str]:
    referer = entry.get("referer") or ""
    return {
        "id": str(entry.get("id") or ""),
        "title": str(entry.get("title") or entry.get("id") or "video"),
        "url": str(entry.get("url") or fallback_url),
        "referer": str(referer) if isinstance(referer, str) else "",
    }


def ytdlp_referer_args(url: str, referer: str | None = None) -> list[str]:
    """CDN (erome etc.) exige Referer da pagina do album."""
    ref = (referer or "").strip()
    if not ref and is_direct_media_url(url):
        # fallback generico se a pagina nao veio no job
        host = urlparse(url).hostname or ""
        if "erome.com" in host:
            ref = "https://www.erome.com/"
    if not ref:
        return []
    return ["--add-header", f"Referer:{ref}"]


def resolve_jobs(url: str, options: DownloadOptions) -> list[dict[str, str]]:
    meta = fetch_metadata(url)

    if meta.get("type") == "playlist":
        entries = meta.get("entries") or []
        if options.video_ids:
            selected = [e for e in entries if e["id"] in options.video_ids]
        else:
            selected = entries
        selected = [e for e in selected if not is_probably_image_url(e.get("url") or "")]
        selected = dedupe_entries(selected)
        if not selected:
            raise ValueError("Nenhum video selecionado na playlist.")
        return [job_from_entry(e) for e in selected]

    playlist = meta.get("playlist")
    if playlist and options.video_ids:
        selected = [
            e for e in playlist.get("entries") or [] if e["id"] in options.video_ids
        ]
        selected = [e for e in selected if not is_probably_image_url(e.get("url") or "")]
        selected = dedupe_entries(selected)
        if not selected:
            raise ValueError("Nenhum video selecionado na playlist.")
        return [job_from_entry(e) for e in selected]

    return [job_from_entry({"id": meta["id"], "title": meta["title"], "url": url, "referer": ""}, url)]


def download_video_mp4(
    url: str,
    final_path: Path,
    on_progress: ProgressCb,
    index: int,
    total: int,
    referer: str | None = None,
) -> None:
    """Baixa o melhor <=1080p e sempre reencode pra 1920x1080 @ 30fps."""
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    job_id = str(uuid.uuid4())
    raw_template = str(TEMP_DIR / f"{job_id}.%(ext)s")
    on_progress({"stage": "baixando", "percent": 0, "index": index, "total": total})

    # Prefere 1080p ate 30fps; se nao houver, pega ate 1080 e converte.
    fmt = "/".join(
        [
            f"bv*[height<={TARGET_HEIGHT}][fps<={TARGET_FPS}]+ba",
            f"bv*[height<={TARGET_HEIGHT}]+ba",
            f"b[height<={TARGET_HEIGHT}]",
            "b",
        ]
    )

    def on_line(line: str) -> None:
        m = DOWNLOAD_PROGRESS_RE.search(line)
        if m:
            on_progress(
                {
                    "stage": "baixando",
                    "percent": float(m.group(1)),
                    "index": index,
                    "total": total,
                }
            )

    base_args = [
        "-f",
        fmt,
        "--merge-output-format",
        "mp4",
        "--no-playlist",
        "--newline",
        "-o",
        raw_template,
        *auth_args_for(url),
        *ytdlp_referer_args(url, referer),
        url,
    ]

    # aria2c baixa fragmentos em paralelo (bem mais rapido que o downloader
    # nativo do yt-dlp). Se nao der certo (site que nao aceita, aria2c
    # ausente, etc.), cai pro download normal do yt-dlp sem aria2c.
    tentativas = []
    if shutil.which(ARIA2C_BIN):
        tentativas.append(
            [
                "--downloader",
                "aria2c",
                "--downloader-args",
                "aria2c:-x16 -s16 -k1M --summary-interval=0",
                *base_args,
            ]
        )
    tentativas.append(base_args)

    ultimo_erro: Exception | None = None
    for i, args in enumerate(tentativas):
        try:
            run_process(YTDLP_BIN, args, on_line)
            ultimo_erro = None
            break
        except Exception as err:
            ultimo_erro = err
            if i + 1 < len(tentativas):
                log_info("Download via aria2c falhou, tentando o downloader nativo do yt-dlp...")
                for sobra in TEMP_DIR.glob(f"{job_id}*"):
                    sobra.unlink(missing_ok=True)
    if ultimo_erro is not None:
        raise ultimo_erro

    downloaded = find_downloaded_file(TEMP_DIR, job_id, "mp4")
    on_progress({"stage": "convertendo", "percent": 0, "index": index, "total": total})

    duration = probe_duration_seconds(downloaded)
    last_pct_logged = -1

    def on_ffmpeg_line(line: str) -> None:
        nonlocal last_pct_logged
        t = parse_ffmpeg_time_seconds(line)
        if t is None or not duration or duration <= 0:
            return
        pct = max(0.0, min(99.0, (t / duration) * 100.0))
        # Evita flood de eventos/SSE
        if int(pct) == last_pct_logged and pct < 99:
            return
        if int(pct) % 2 != 0 and pct < 99:
            return
        last_pct_logged = int(pct)
        on_progress(
            {
                "stage": "convertendo",
                "percent": pct,
                "index": index,
                "total": total,
            }
        )
        if int(pct) % 10 == 0:
            log_info(f"Convertendo... {pct:.0f}%")

    final_path.unlink(missing_ok=True)
    # Sempre reencode 1080p30; preset rapido pra nao parecer travado em videos longos.
    run_process(
        FFMPEG_BIN,
        [
            "-y",
            "-i",
            str(downloaded),
            "-vf",
            scale_pad_1080(),
            "-r",
            str(TARGET_FPS),
            "-c:v",
            "libx264",
            "-preset",
            FFMPEG_PRESET,
            "-crf",
            str(FFMPEG_CRF),
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            *random_metadata_args(),
            str(final_path),
        ],
        on_stderr_line=on_ffmpeg_line,
        quiet_stderr=True,
    )
    on_progress({"stage": "finalizando", "percent": 100, "index": index, "total": total})
    downloaded.unlink(missing_ok=True)


def download_and_convert(
    url: str,
    options: DownloadOptions | None,
    on_progress: ProgressCb,
) -> dict[str, Any]:
    """Sempre video publico -> MP4 1920x1080 @ 30fps (UUID + metadados aleatorios)."""
    if not is_valid_media_url(url):
        raise ValueError("Cole um link http ou https valido.")

    options = DownloadOptions(video_ids=list((options or DownloadOptions()).video_ids))

    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)

    jobs = resolve_jobs(url.strip(), options)
    folder = VIDEOS_DIR

    final_paths: list[str] = []
    titles: list[str] = []
    total = len(jobs)

    for i, job in enumerate(jobs):
        file_id = str(uuid.uuid4())
        final_path = folder / f"{file_id}.mp4"
        on_progress(
            {
                "stage": "item",
                "index": i + 1,
                "total": total,
                "title": file_id,
            }
        )
        download_video_mp4(
            job["url"],
            final_path,
            on_progress,
            i + 1,
            total,
            job.get("referer") or None,
        )
        final_paths.append(str(final_path))
        titles.append(file_id)

    return {
        "finalPaths": final_paths,
        "titles": titles,
        "outputFolder": str(folder),
        "profile": f"{TARGET_HEIGHT}p{TARGET_FPS}",
    }


def bin_ok(name: str) -> bool:
    if shutil.which(name):
        return True
    try:
        r = subprocess.run(
            [name, "--version"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
        )
        # No Windows o ffmpeg as vezes devolve codigo estranho mesmo ok.
        out = (r.stdout or "") + (r.stderr or "")
        return (
            "ffmpeg" in out.lower()
            or "ffprobe" in out.lower()
            or "yt-dlp" in out.lower()
            or r.returncode == 0
        )
    except Exception:
        return False
