"use client";

import { useEffect, useRef, useState } from "react";

interface MetadataResponse {
  valid: boolean;
  id?: string;
  title?: string;
  thumbnail?: string;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  error?: string;
}

type DownloadState =
  | { phase: "idle" }
  | { phase: "baixando"; percent: number }
  | { phase: "convertendo" }
  | { phase: "concluido"; title: string }
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

export default function Home() {
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [download, setDownload] = useState<DownloadState>({ phase: "idle" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = url.trim();
    if (!trimmed) {
      // Link vazio: nada para checar. O onChange ja limpa metadata/checking
      // direto (fora do effect), entao aqui so cancela um debounce pendente.
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/metadata?url=${encodeURIComponent(trimmed)}`);
        const data: MetadataResponse = await res.json();
        setMetadata(data);
      } catch {
        setMetadata({ valid: false, error: "Nao foi possivel checar o link." });
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

  function startDownload() {
    const trimmed = url.trim();
    if (!trimmed || !metadata?.valid) return;

    eventSourceRef.current?.close();
    setDownload({ phase: "baixando", percent: 0 });

    const source = new EventSource(`/api/download?url=${encodeURIComponent(trimmed)}`);
    eventSourceRef.current = source;

    source.addEventListener("progress", (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      if (data.stage === "baixando") {
        setDownload({ phase: "baixando", percent: data.percent ?? 0 });
      } else if (data.stage === "convertendo") {
        setDownload({ phase: "convertendo" });
      }
    });

    source.addEventListener("done", (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setDownload({ phase: "concluido", title: data.title });
      source.close();
    });

    source.addEventListener("error", (event) => {
      const raw = (event as MessageEvent).data;
      let message = "Falha no download.";
      if (raw) {
        try {
          message = JSON.parse(raw).message ?? message;
        } catch {
          // payload nao veio no formato esperado, mantem mensagem padrao
        }
      }
      setDownload({ phase: "erro", message });
      source.close();
    });
  }

  const isDownloading =
    download.phase === "baixando" || download.phase === "convertendo";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Baixador de videos do YouTube</h1>
          <p className="text-sm text-neutral-500">
            Cole o link do video. O download sai sempre em MP4, exatamente em
            1920x1080.
          </p>
        </header>

        <div className="space-y-2">
          <label htmlFor="video-url" className="text-sm font-medium">
            Link do YouTube
          </label>
          <input
            id="video-url"
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(event) => {
              const next = event.target.value;
              setUrl(next);
              setDownload({ phase: "idle" });
              if (!next.trim()) {
                setMetadata(null);
                setChecking(false);
              }
            }}
            disabled={isDownloading}
            className="w-full rounded-lg border border-neutral-300 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-neutral-500 disabled:opacity-60 dark:border-neutral-700"
          />
        </div>

        {checking && (
          <p className="text-sm text-neutral-500">Checando o link...</p>
        )}

        {!checking && metadata && !metadata.valid && url.trim().length > 0 && (
          <p className="text-sm text-red-500">
            {metadata.error ?? "Esse link nao parece ser de um video valido do YouTube."}
          </p>
        )}

        {!checking && metadata?.valid && (
          <div className="space-y-4 rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
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
                <p className="line-clamp-2 text-sm font-medium">{metadata.title}</p>
                {metadata.durationSeconds != null && (
                  <p className="text-xs text-neutral-500">
                    Duracao: {formatDuration(metadata.durationSeconds)}
                  </p>
                )}
              </div>
            </div>

            {download.phase === "idle" && (
              <button
                type="button"
                onClick={startDownload}
                className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Baixar em 1920x1080
              </button>
            )}

            {download.phase === "baixando" && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="h-full rounded-full bg-neutral-900 transition-all dark:bg-white"
                    style={{ width: `${Math.max(4, download.percent)}%` }}
                  />
                </div>
                <p className="text-center text-xs text-neutral-500">
                  Baixando... {download.percent.toFixed(0)}%
                </p>
              </div>
            )}

            {download.phase === "convertendo" && (
              <p className="text-center text-xs text-neutral-500">
                Ajustando o video para 1920x1080...
              </p>
            )}

            {download.phase === "concluido" && (
              <div className="space-y-2 text-center">
                <p className="text-sm font-medium text-emerald-500">
                  Pronto. Salvo em videos baixados.
                </p>
                <button
                  type="button"
                  onClick={() => setDownload({ phase: "idle" })}
                  className="text-xs text-neutral-500 underline"
                >
                  Baixar outro video
                </button>
              </div>
            )}

            {download.phase === "erro" && (
              <div className="space-y-2 text-center">
                <p className="text-sm text-red-500">{download.message}</p>
                <button
                  type="button"
                  onClick={() => setDownload({ phase: "idle" })}
                  className="text-xs text-neutral-500 underline"
                >
                  Tentar de novo
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
