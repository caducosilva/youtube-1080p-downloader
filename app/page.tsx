"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface PlaylistEntry {
  id: string;
  title: string;
  thumbnail: string;
  durationSeconds: number | null;
  url: string;
}

interface MetadataResponse {
  valid: boolean;
  type?: "video" | "playlist";
  id?: string;
  title?: string;
  thumbnail?: string;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  entries?: PlaylistEntry[];
  playlist?: {
    id: string;
    title: string;
    entries: PlaylistEntry[];
  };
  error?: string;
}

type MediaKind = "video" | "audio";
type VideoHeight = 1080 | 2160;
type VideoFps = 30 | 60;

type DownloadState =
  | { phase: "idle" }
  | {
      phase: "baixando";
      percent: number;
      index: number;
      total: number;
      title: string;
    }
  | {
      phase: "convertendo";
      index: number;
      total: number;
      title: string;
    }
  | { phase: "concluido"; count: number; outputFolder: string }
  | { phase: "erro"; message: string };

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function CaducoSeal() {
  return (
    <a
      className="brand-seal"
      href="https://github.com/caducosilva"
      target="_blank"
      rel="noreferrer"
      title="caducosilva"
    >
      <span className="brand-seal__mark" aria-hidden>
        C
      </span>
      <span className="brand-seal__text">
        <span className="brand-seal__name">CADUCOSILVA</span>
        <span className="brand-seal__contact">abobicarlo@gmail.com</span>
      </span>
    </a>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [media, setMedia] = useState<MediaKind>("video");
  const [height, setHeight] = useState<VideoHeight>(1080);
  const [fps, setFps] = useState<VideoFps>(60);
  const [download, setDownload] = useState<DownloadState>({ phase: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentTitleRef = useRef("");

  const playlistEntries = useMemo(() => {
    if (!metadata?.valid) return [] as PlaylistEntry[];
    if (metadata.type === "playlist") return metadata.entries ?? [];
    return metadata.playlist?.entries ?? [];
  }, [metadata]);

  const hasPlaylistChooser = playlistEntries.length > 0;
  const playlistTitle =
    metadata?.type === "playlist"
      ? metadata.title
      : metadata?.playlist?.title;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = url.trim();
    if (!trimmed) return;

    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch(
          `/api/metadata?url=${encodeURIComponent(trimmed)}`,
        );
        const data: MetadataResponse = await res.json();
        setMetadata(data);
        if (data.valid && data.type === "playlist") {
          setSelectedIds(new Set((data.entries ?? []).map((e) => e.id)));
        } else if (data.valid && data.playlist?.entries?.length) {
          // Video dentro de playlist: seleciona so o video colado por padrao.
          setSelectedIds(new Set(data.id ? [data.id] : []));
        } else {
          setSelectedIds(new Set());
        }
      } catch {
        setMetadata({
          valid: false,
          error: "Nao foi possivel checar o link.",
        });
        setSelectedIds(new Set());
      } finally {
        setChecking(false);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [url]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  function selectAll() {
    setSelectedIds(new Set(playlistEntries.map((e) => e.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startDownload() {
    const trimmed = url.trim();
    if (!trimmed || !metadata?.valid) return;
    if (hasPlaylistChooser && selectedIds.size === 0) return;

    eventSourceRef.current?.close();
    currentTitleRef.current = metadata.title ?? "";
    setDownload({
      phase: "baixando",
      percent: 0,
      index: 1,
      total: hasPlaylistChooser ? selectedIds.size : 1,
      title: currentTitleRef.current,
    });

    const params = new URLSearchParams({
      url: trimmed,
      media,
      height: String(height),
      fps: String(fps),
    });
    if (hasPlaylistChooser) {
      params.set("ids", Array.from(selectedIds).join(","));
    }

    const source = new EventSource(`/api/download?${params.toString()}`);
    eventSourceRef.current = source;

    source.addEventListener("progress", (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      if (data.stage === "item") {
        currentTitleRef.current = data.title ?? currentTitleRef.current;
        setDownload({
          phase: "baixando",
          percent: 0,
          index: data.index ?? 1,
          total: data.total ?? 1,
          title: currentTitleRef.current,
        });
      } else if (data.stage === "baixando") {
        setDownload({
          phase: "baixando",
          percent: data.percent ?? 0,
          index: data.index ?? 1,
          total: data.total ?? 1,
          title: currentTitleRef.current,
        });
      } else if (data.stage === "convertendo") {
        setDownload({
          phase: "convertendo",
          index: data.index ?? 1,
          total: data.total ?? 1,
          title: currentTitleRef.current,
        });
      }
    });

    source.addEventListener("done", (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setDownload({
        phase: "concluido",
        count: data.count ?? 1,
        outputFolder: data.outputFolder ?? "videos baixados",
      });
      source.close();
    });

    source.addEventListener("error", (event) => {
      const raw = (event as MessageEvent).data;
      let message = "Falha no download.";
      if (raw) {
        try {
          message = JSON.parse(raw).message ?? message;
        } catch {
          // payload inesperado
        }
      }
      setDownload({ phase: "erro", message });
      source.close();
    });
  }

  const isDownloading =
    download.phase === "baixando" || download.phase === "convertendo";
  const canDownload =
    Boolean(metadata?.valid) &&
    !checking &&
    !isDownloading &&
    (!hasPlaylistChooser || selectedIds.size > 0);

  return (
    <>
      <div className="brand-watermark" aria-hidden>
        <span>CADUCOSILVA</span>
      </div>
      <CaducoSeal />

      <main className="flex flex-1 justify-center px-4 py-10 pb-28">
        <div className="w-full max-w-2xl space-y-5">
          <header className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              Baixador de videos do YouTube
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Cole o link de um video ou de uma playlist publica. Escolha video
              (MP4) ou so o audio (MP3), a qualidade e os frames por segundo.
            </p>
          </header>

          <div className="panel space-y-3 p-4">
            <label htmlFor="video-url" className="block text-sm font-semibold">
              1. Cole o link do YouTube aqui
            </label>
            <input
              id="video-url"
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=... ou playlist"
              value={url}
              onChange={(event) => {
                const next = event.target.value;
                setUrl(next);
                setDownload({ phase: "idle" });
                if (!next.trim()) {
                  setMetadata(null);
                  setSelectedIds(new Set());
                  setChecking(false);
                }
              }}
              disabled={isDownloading}
              className="w-full rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
            <p className="rounded-lg bg-[#eef6ff] px-3 py-2 text-sm text-[#174ea6]">
              Os arquivos salvos ficam na pasta{" "}
              <strong>videos baixados</strong>, dentro da pasta deste programa.
              Se for playlist, cria uma subpasta com o nome da playlist.
            </p>
          </div>

          {checking && (
            <p className="text-sm text-[var(--muted)]">Checando o link...</p>
          )}

          {!checking && metadata && !metadata.valid && url.trim().length > 0 && (
            <p className="text-sm text-[var(--err)]">
              {metadata.error ??
                "Esse link nao parece ser de um video ou playlist valida do YouTube."}
            </p>
          )}

          {!checking && metadata?.valid && (
            <div className="panel space-y-5 p-4">
              {metadata.type === "video" && !hasPlaylistChooser && (
                <div className="flex gap-4">
                  {metadata.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={metadata.thumbnail}
                      alt={metadata.title ?? "Miniatura do video"}
                      className="h-24 w-40 rounded-md object-cover"
                    />
                  )}
                  <div className="flex flex-1 flex-col justify-center gap-1">
                    <p className="line-clamp-2 text-sm font-semibold">
                      {metadata.title}
                    </p>
                    {metadata.durationSeconds != null && (
                      <p className="text-xs text-[var(--muted)]">
                        Duracao: {formatDuration(metadata.durationSeconds)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {hasPlaylistChooser && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        2. Escolha os videos da playlist
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {playlistTitle} · {selectedIds.size} de{" "}
                        {playlistEntries.length} selecionado(s)
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectAll}
                        disabled={isDownloading}
                        className="underline text-[var(--muted)]"
                      >
                        Selecionar todos
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        disabled={isDownloading}
                        className="underline text-[var(--muted)]"
                      >
                        Limpar selecao
                      </button>
                    </div>
                  </div>
                  <div className="playlist-list">
                    {playlistEntries.map((entry) => (
                      <label key={entry.id} className="playlist-item">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(entry.id)}
                          disabled={isDownloading}
                          onChange={() => toggleId(entry.id)}
                        />
                        {entry.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.thumbnail} alt="" />
                        ) : (
                          <div className="h-[3.1rem] w-[5.5rem] rounded-[0.35rem] bg-[#dde3ec]" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {entry.title}
                          </span>
                          {entry.durationSeconds != null && (
                            <span className="text-xs text-[var(--muted)]">
                              {formatDuration(entry.durationSeconds)}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  {hasPlaylistChooser ? "3" : "2"}. Quero baixar
                </p>
                <div className="choice-grid two">
                  <label className="choice">
                    <input
                      type="radio"
                      name="media"
                      checked={media === "video"}
                      disabled={isDownloading}
                      onChange={() => setMedia("video")}
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        Video (MP4)
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        Arquivo de video com imagem e som
                      </span>
                    </span>
                  </label>
                  <label className="choice">
                    <input
                      type="radio"
                      name="media"
                      checked={media === "audio"}
                      disabled={isDownloading}
                      onChange={() => setMedia("audio")}
                    />
                    <span>
                      <span className="block text-sm font-semibold">
                        So o audio (MP3)
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        Apenas o som, sem video
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              {media === "video" && (
                <>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">
                      {hasPlaylistChooser ? "4" : "3"}. Qualidade do video
                    </p>
                    <div className="choice-grid two">
                      <label className="choice">
                        <input
                          type="radio"
                          name="height"
                          checked={height === 1080}
                          disabled={isDownloading}
                          onChange={() => setHeight(1080)}
                        />
                        <span className="text-sm font-semibold">1080p</span>
                      </label>
                      <label className="choice">
                        <input
                          type="radio"
                          name="height"
                          checked={height === 2160}
                          disabled={isDownloading}
                          onChange={() => setHeight(2160)}
                        />
                        <span className="text-sm font-semibold">
                          2160p (4K)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">
                      {hasPlaylistChooser ? "5" : "4"}. Frames por segundo
                    </p>
                    <div className="choice-grid two">
                      <label className="choice">
                        <input
                          type="radio"
                          name="fps"
                          checked={fps === 30}
                          disabled={isDownloading}
                          onChange={() => setFps(30)}
                        />
                        <span className="text-sm font-semibold">30 fps</span>
                      </label>
                      <label className="choice">
                        <input
                          type="radio"
                          name="fps"
                          checked={fps === 60}
                          disabled={isDownloading}
                          onChange={() => setFps(60)}
                        />
                        <span className="text-sm font-semibold">60 fps</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {download.phase === "idle" && (
                <button
                  type="button"
                  onClick={startDownload}
                  disabled={!canDownload}
                  className="primary-btn"
                >
                  Baixar
                </button>
              )}

              {download.phase === "baixando" && (
                <div className="space-y-2">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.max(4, download.percent)}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-[var(--muted)]">
                    Baixando {download.index} de {download.total}
                    {download.title ? `: ${download.title}` : ""} ·{" "}
                    {download.percent.toFixed(0)}%
                  </p>
                </div>
              )}

              {download.phase === "convertendo" && (
                <p className="text-center text-xs text-[var(--muted)]">
                  Ajustando {download.index} de {download.total}
                  {download.title ? `: ${download.title}` : ""}...
                </p>
              )}

              {download.phase === "concluido" && (
                <div className="space-y-2 text-center">
                  <p className="text-sm font-semibold text-[var(--ok)]">
                    Pronto. {download.count} arquivo(s) salvo(s) em videos
                    baixados.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDownload({ phase: "idle" })}
                    className="text-xs text-[var(--muted)] underline"
                  >
                    Baixar outro
                  </button>
                </div>
              )}

              {download.phase === "erro" && (
                <div className="space-y-2 text-center">
                  <p className="text-sm text-[var(--err)]">{download.message}</p>
                  <button
                    type="button"
                    onClick={() => setDownload({ phase: "idle" })}
                    className="text-xs text-[var(--muted)] underline"
                  >
                    Tentar de novo
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mx-auto max-w-xs space-y-3 rounded-xl border border-[var(--line)] bg-white p-4 text-center">
            <p className="text-sm font-semibold">Doacoes via PIX</p>
            <p className="text-xs text-[var(--muted)]">
              Escaneie o QR Code ou copie a chave aleatoria
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/pix-qrcode.png"
              alt="QR Code PIX da chave aleatoria caducosilva"
              className="mx-auto h-44 w-44 rounded-lg border border-[var(--line)] bg-white p-2"
            />
            <code className="block break-all rounded-lg bg-[#f4f7fb] px-2 py-2 text-[11px] text-[var(--foreground)]">
              f74458dc-2a36-49bd-9250-1cef4365ebb8
            </code>
          </div>
        </div>
      </main>
    </>
  );
}
