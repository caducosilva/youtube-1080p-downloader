import React, { useState } from 'react';
import { Link, X, Loader2, Search, ListPlus, AlertCircle } from 'lucide-react';

interface UrlInputFormProps {
  url: string;
  setUrl: (url: string) => void;
  onAnalyze: (url: string) => void;
  onEnqueue: (url: string) => void;
  isAnalyzing: boolean;
  isEnqueueing: boolean;
  isBackendOffline: boolean;
}

export const UrlInputForm: React.FC<UrlInputFormProps> = ({
  url,
  setUrl,
  onAnalyze,
  onEnqueue,
  isAnalyzing,
  isEnqueueing,
  isBackendOffline,
}) => {
  const [inputError, setInputError] = useState<string | null>(null);
  const busy = isAnalyzing || isEnqueueing;

  const validate = (): string | null => {
    const trimmed = url.trim();
    if (!trimmed) return 'Cole uma URL valida.';
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return 'A URL deve comecar com http:// ou https://';
    }
    return null;
  };

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setInputError(err);
      return;
    }
    setInputError(null);
    onAnalyze(url.trim());
  };

  const handleEnqueue = () => {
    const err = validate();
    if (err) {
      setInputError(err);
      return;
    }
    setInputError(null);
    onEnqueue(url.trim());
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        setInputError(null);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleAnalyze} className="space-y-3">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-slate-400 pointer-events-none">
            <Link className="w-5 h-5 text-cyan-500" />
          </div>

          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (inputError) setInputError(null);
            }}
            placeholder="Cole o link publico (YouTube, erome, etc.)..."
            disabled={busy}
            className="w-full bg-slate-900/90 border-2 border-slate-800 rounded-2xl pl-12 pr-28 sm:pr-36 py-4 text-sm sm:text-base text-white placeholder-slate-500 font-medium focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 shadow-xl transition disabled:opacity-50"
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            {url && !busy && (
              <button
                type="button"
                onClick={() => {
                  setUrl('');
                  setInputError(null);
                }}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                title="Limpar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {!url && !busy && (
              <button
                type="button"
                onClick={handlePaste}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition"
              >
                Colar
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleEnqueue}
            disabled={busy || isBackendOffline || !url.trim()}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-cyan-500/15 flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEnqueueing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enfileirando...
              </>
            ) : (
              <>
                <ListPlus className="w-4 h-4" />
                Adicionar a fila
              </>
            )}
          </button>
          <button
            type="submit"
            disabled={busy || isBackendOffline || !url.trim()}
            className="sm:w-44 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-40"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Analisar
              </>
            )}
          </button>
        </div>

        {inputError && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 px-1 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{inputError}</span>
          </div>
        )}

        {isBackendOffline && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-bold">Backend Python nao detectado</p>
              <p className="mt-0.5 text-rose-300/80">
                Suba com{' '}
                <code className="bg-rose-900/60 font-mono px-1.5 py-0.5 rounded text-[11px]">
                  python server.py
                </code>{' '}
                e ajuste a porta se preciso.
              </p>
            </div>
          </div>
        )}
      </form>

      <p className="mt-3 text-xs text-slate-400 px-1">
        Saida fixa: MP4 1920x1080 @ 30fps · UUID.mp4 · 1 download por vez · sem
        historico/cache no navegador
      </p>
    </div>
  );
};
