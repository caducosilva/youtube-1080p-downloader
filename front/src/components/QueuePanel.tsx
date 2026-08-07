import React from 'react';
import {
  ListOrdered,
  SkipForward,
  Trash2,
  Play,
  Loader2,
  Link2,
} from 'lucide-react';
import { QueueStatus } from '../types';

interface QueuePanelProps {
  queue: QueueStatus | null;
  onSkip: () => void;
  onClear: () => void;
  onContinue: () => void;
  busyAction: boolean;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 28 ? `${u.pathname.slice(0, 28)}...` : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url.length > 48 ? `${url.slice(0, 48)}...` : url;
  }
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  queue,
  onSkip,
  onClear,
  onContinue,
  busyAction,
}) => {
  if (!queue || queue.pendingCount === 0) {
    return (
      <div className="w-full rounded-2xl bg-slate-900/60 border border-slate-800 p-5 text-xs text-slate-400">
        <div className="flex items-center gap-2 font-semibold text-slate-300 mb-1">
          <ListOrdered className="w-4 h-4 text-cyan-400" />
          Fila vazia
        </div>
        <p>
          Cole links na fila. Um por vez. No sucesso o link some e o arquivo
          fica em Videos/VideoDownloader. F5 / fechar o browser nao apaga o que ainda
          esta baixando ou pendente (fica no Python).
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="text-sm font-bold text-white">
              Fila ({queue.pendingCount})
            </h3>
            <p className="text-[11px] text-slate-400">
              sucesso remove o link · pendente/baixando fica ate terminar · F5
              reidrata
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {queue.pausedError && (
            <button
              type="button"
              onClick={onContinue}
              disabled={busyAction}
              className="px-3 py-1.5 rounded-lg bg-amber-900/50 hover:bg-amber-900 border border-amber-700/60 text-amber-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5" />
              Continuar
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            disabled={busyAction || queue.pendingCount === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Pular atual
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={busyAction}
            className="px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-950 border border-rose-800/50 text-rose-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar fila
          </button>
        </div>
      </div>

      {queue.pausedError && (
        <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-xl px-3 py-2">
          Pausado apos erro. A URL permanece na frente. Use Continuar ou Pular.
        </div>
      )}

      <ul className="space-y-2 max-h-56 overflow-y-auto">
        {queue.pending.map((url, i) => {
          const isCurrent = i === 0 && (queue.busy || queue.pausedError);
          return (
            <li
              key={`${i}-${url}`}
              className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${
                isCurrent
                  ? 'bg-cyan-950/30 border-cyan-800/60'
                  : 'bg-slate-950/50 border-slate-800'
              }`}
            >
              <span className="font-mono text-slate-500 w-6 shrink-0">{i + 1}.</span>
              {isCurrent && queue.busy ? (
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin mt-0.5 shrink-0" />
              ) : (
                <Link2 className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-mono text-slate-200 break-all">{shortUrl(url)}</div>
                {isCurrent && (
                  <div className="text-[11px] text-cyan-400 mt-0.5 font-semibold">
                    {queue.busy ? 'baixando agora' : 'na frente (pausado)'}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
