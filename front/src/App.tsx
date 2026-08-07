import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  DoneEventData,
  HealthResponse,
  MetadataResponse,
  ProgressEventData,
  QueueStatus,
} from './types';
import {
  addToQueue,
  checkHealth,
  clearQueue,
  continueQueue,
  DEFAULT_BASE_URL,
  fetchMetadata,
  fetchQueue,
  sanitizeBaseUrl,
  skipQueueItem,
  subscribeQueueEvents,
  StreamController,
} from './services/api';
import { Header } from './components/Header';
import { UrlInputForm } from './components/UrlInputForm';
import { MetadataCard } from './components/MetadataCard';
import { DownloadProgress } from './components/DownloadProgress';
import { CompletionCard } from './components/CompletionCard';
import { QueuePanel } from './components/QueuePanel';
import { ServerConfigModal } from './components/ServerConfigModal';
import { BackendInstructionsModal } from './components/BackendInstructionsModal';
import { HealthFooter } from './components/HealthFooter';
import { Film, HardDrive, Shield, Zap, AlertCircle } from 'lucide-react';

export default function App() {
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_BASE_URL);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [appState, setAppState] = useState<AppState>('idle');
  const [inputUrl, setInputUrl] = useState('');
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<string[]>([]);
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [progress, setProgress] = useState<ProgressEventData | null>(null);
  const [doneData, setDoneData] = useState<DoneEventData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEnqueueing, setIsEnqueueing] = useState(false);
  const [queueActionBusy, setQueueActionBusy] = useState(false);

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const streamRef = useRef<StreamController | null>(null);
  const doneTimerRef = useRef<number | null>(null);
  const queueRef = useRef<QueueStatus | null>(null);
  const baseUrlRef = useRef(baseUrl);
  baseUrlRef.current = baseUrl;

  /**
   * Fonte da verdade = backend.
   * F5 nao zera a fila: reidrata busy/pending.
   * Link so some da fila apos sucesso (arquivo ja esta em Videos/VideoDownloader).
   */
  const syncFromQueue = (status: QueueStatus) => {
    queueRef.current = status;
    setQueue(status);

    if (status.pausedError) {
      setAppState('paused_error');
      return;
    }
    if (status.busy) {
      setAppState('downloading');
      setProgress((prev) =>
        prev ?? {
          stage: 'baixando',
          percent: null,
          index: 1,
          total: 1,
          title: 'em andamento no servidor',
        }
      );
      return;
    }
    if (status.pendingCount > 0) {
      setAppState('queued');
      setProgress(null);
      return;
    }
    setProgress(null);
    setAppState((prev) =>
      prev === 'loading_metadata' || prev === 'ready' || prev === 'error'
        ? prev
        : doneData
          ? 'done'
          : 'idle'
    );
  };

  const refreshQueue = async () => {
    try {
      syncFromQueue(await fetchQueue(baseUrlRef.current));
    } catch {
      /* offline tratado no health */
    }
  };

  const runHealthCheck = async (targetBaseUrl?: string) => {
    const activeUrl = targetBaseUrl || baseUrl;
    setIsConnecting(true);
    setHealthError(null);
    try {
      const data = await checkHealth(activeUrl);
      setHealth(data);
      if (data.queue) syncFromQueue(data.queue);
      else await refreshQueue();
    } catch (err) {
      setHealth(null);
      setHealthError(
        err instanceof Error
          ? err.message
          : 'Falha de conexao com a API local Python.'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, [baseUrl]);

  // SSE: ao recarregar a pagina, reconecta e puxa a fila atual do Python.
  useEffect(() => {
    streamRef.current?.abort();
    streamRef.current = null;

    if (!health?.ok) return;

    const controller = subscribeQueueEvents({
      baseUrl,
      onQueue: (q) => syncFromQueue(q),
      onProgress: (p) => {
        setProgress(p);
        setAppState('downloading');
      },
      onDone: (d) => {
        // Sucesso: backend ja removeu o link da fila; arquivo ficou na pasta.
        setDoneData(d);
        setProgress(null);
        void refreshQueue();
        if (doneTimerRef.current) window.clearTimeout(doneTimerRef.current);
        doneTimerRef.current = window.setTimeout(() => {
          setDoneData(null);
          const q = queueRef.current;
          if (q?.busy) setAppState('downloading');
          else if (q && q.pendingCount > 0) setAppState('queued');
          else setAppState('idle');
        }, 10000);
      },
      onError: (e) => {
        setErrorMessage(e.message || 'Erro na fila.');
        setAppState('paused_error');
        void refreshQueue();
      },
    });
    streamRef.current = controller;
    void refreshQueue();

    return () => {
      controller.abort();
      if (doneTimerRef.current) window.clearTimeout(doneTimerRef.current);
    };
  }, [baseUrl, health?.ok]);

  const handleSaveBaseUrl = (newUrl: string) => {
    setBaseUrl(sanitizeBaseUrl(newUrl));
  };

  const handleAnalyzeUrl = async (urlToAnalyze: string) => {
    setAppState('loading_metadata');
    setErrorMessage(null);
    setMetadata(null);
    setDoneData(null);

    try {
      const res = await fetchMetadata(baseUrl, urlToAnalyze);
      setMetadata(res);
      if (res.valid && res.type === 'playlist') {
        setSelectedPlaylistIds(res.entries.map((e) => e.id));
      } else {
        setSelectedPlaylistIds([]);
      }
      setAppState('ready');
    } catch (err) {
      setAppState('error');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel obter metadados. Verifique o server.py.'
      );
    }
  };

  const handleEnqueue = async (url: string, ids?: string[]) => {
    setIsEnqueueing(true);
    setErrorMessage(null);
    try {
      const res = await addToQueue(baseUrl, url, ids);
      syncFromQueue(res);
      setInputUrl('');
      setMetadata(null);
      setSelectedPlaylistIds([]);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Falha ao enfileirar.'
      );
      setAppState('error');
    } finally {
      setIsEnqueueing(false);
    }
  };

  const handleEnqueueFromMetadata = async () => {
    if (!inputUrl.trim()) return;
    // Playlist com selecao parcial: manda so os ids marcados.
    // Playlist inteira selecionada ou video unico: manda sem ids (baixa tudo que a URL resolver).
    const isPartialPlaylist =
      metadata?.valid === true &&
      metadata.type === 'playlist' &&
      selectedPlaylistIds.length > 0 &&
      selectedPlaylistIds.length < metadata.entries.length;
    await handleEnqueue(
      inputUrl.trim(),
      isPartialPlaylist ? selectedPlaylistIds : undefined
    );
  };

  const handleSkip = async () => {
    setQueueActionBusy(true);
    try {
      syncFromQueue(await skipQueueItem(baseUrl));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao pular.');
    } finally {
      setQueueActionBusy(false);
    }
  };

  const handleClear = async () => {
    setQueueActionBusy(true);
    try {
      syncFromQueue(await clearQueue(baseUrl));
      setProgress(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao limpar.');
    } finally {
      setQueueActionBusy(false);
    }
  };

  const handleContinue = async () => {
    setQueueActionBusy(true);
    setErrorMessage(null);
    try {
      syncFromQueue(await continueQueue(baseUrl));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao continuar.');
    } finally {
      setQueueActionBusy(false);
    }
  };

  const handleDismissDone = () => {
    if (doneTimerRef.current) window.clearTimeout(doneTimerRef.current);
    setDoneData(null);
    const q = queueRef.current;
    if (q?.busy) setAppState('downloading');
    else if (q && q.pendingCount > 0) setAppState('queued');
    else setAppState('idle');
  };

  const isOffline = !health || !health.ok;
  const showProgress =
    !!queue?.busy ||
    appState === 'downloading' ||
    appState === 'paused_error';
  const showIdleCards =
    appState === 'idle' &&
    !doneData &&
    !queue?.busy &&
    !(queue && queue.pendingCount > 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        health={health}
        isConnecting={isConnecting}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <section className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300 font-medium">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Fila local · Python yt-dlp + FFmpeg · sem historico</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Videos publicos em{' '}
            <span className="text-cyan-400">1080p @ 30fps</span>
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            F5 nao zera a fila: o Python guarda o que esta baixando ou pendente.
            No sucesso, o link some da fila e o MP4 fica em Videos/VideoDownloader.
          </p>
        </section>

        <UrlInputForm
          url={inputUrl}
          setUrl={setInputUrl}
          onAnalyze={handleAnalyzeUrl}
          onEnqueue={handleEnqueue}
          isAnalyzing={appState === 'loading_metadata'}
          isEnqueueing={isEnqueueing}
          isBackendOffline={isOffline && !isConnecting}
        />

        {errorMessage && (
          <section className="w-full rounded-2xl bg-rose-950/40 border border-rose-800/60 p-5 text-rose-300 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-200">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>Erro</span>
            </div>
            <p className="text-xs text-rose-300/90 font-mono break-words">
              {errorMessage}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-900/60 text-rose-200 text-xs font-semibold"
              >
                Como subir o server.py
              </button>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </section>
        )}

        <QueuePanel
          queue={queue}
          onSkip={handleSkip}
          onClear={handleClear}
          onContinue={handleContinue}
          busyAction={queueActionBusy}
        />

        {showProgress && (
          <DownloadProgress
            progress={progress}
            onCancel={() => {
              // So esconde a barra; a fila no Python continua.
              setProgress(null);
            }}
          />
        )}

        {doneData && (
          <CompletionCard doneData={doneData} onReset={handleDismissDone} />
        )}

        {metadata && metadata.valid && (
          <MetadataCard
            metadata={metadata}
            selectedIds={selectedPlaylistIds}
            onToggleId={(id) =>
              setSelectedPlaylistIds((prev) =>
                prev.includes(id)
                  ? prev.filter((x) => x !== id)
                  : [...prev, id]
              )
            }
            onSelectAll={() => {
              if (metadata.type === 'playlist') {
                setSelectedPlaylistIds(metadata.entries.map((e) => e.id));
              }
            }}
            onDeselectAll={() => setSelectedPlaylistIds([])}
            onStartDownload={handleEnqueueFromMetadata}
            isDownloading={isEnqueueing || !!queue?.busy}
          />
        )}

        {showIdleCards && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-2 text-xs">
              <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
                <Film className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-200">Sempre 1080p30</h4>
              <p className="text-slate-400 leading-relaxed">
                Reencode fixo via FFmpeg para 1920x1080 a 30fps em MP4.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-2 text-xs">
              <div className="w-8 h-8 rounded-xl bg-blue-950/80 border border-blue-800/50 flex items-center justify-center text-blue-400">
                <Shield className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-200">Anonimo</h4>
              <p className="text-slate-400 leading-relaxed">
                Sem historico no front. Metadados do arquivo sao aleatorios.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 space-y-2 text-xs">
              <div className="w-8 h-8 rounded-xl bg-emerald-950/80 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
                <HardDrive className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-200">Pasta local</h4>
              <p className="text-slate-400 leading-relaxed">
                Salva em{' '}
                <code className="text-emerald-400 font-mono text-[11px]">
                  Videos/VideoDownloader
                </code>{' '}
                com nome UUID.mp4.
              </p>
            </div>
          </section>
        )}
      </main>

      <ServerConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        baseUrl={baseUrl}
        onSaveBaseUrl={handleSaveBaseUrl}
        health={health}
        isTesting={isConnecting}
        onTestConnection={runHealthCheck}
        errorMsg={healthError}
      />

      <BackendInstructionsModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        baseUrl={baseUrl}
      />

      <HealthFooter
        health={health}
        isConnecting={isConnecting}
        baseUrl={baseUrl}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
      />
    </div>
  );
}
