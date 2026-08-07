import React from 'react';
import { Loader2, AlertOctagon, Ban, Film, RefreshCw, CheckCircle2 } from 'lucide-react';
import { ProgressEventData } from '../types';

interface DownloadProgressProps {
  progress: ProgressEventData | null;
  onCancel: () => void;
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({ progress, onCancel }) => {
  const percent = progress?.percent != null ? Math.round(progress.percent) : null;
  const stage = progress?.stage || 'baixando';
  const index = progress?.index || 1;
  const total = progress?.total || 1;

  const stageLabels: Record<string, string> = {
    item: `Iniciando item ${index} de ${total}...`,
    baixando: `Baixando fluxo de midia (${index}/${total})...`,
    convertendo: `Reencodando pra MP4 1080p @ 30fps (${index}/${total})...`,
    finalizando: `Gravando metadados aleatorios e salvando...`,
  };

  return (
    <div className="w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Download em Andamento</h3>
            <p className="text-xs text-slate-400 font-mono">
              {stageLabels[stage] || 'Processando no backend Python...'}
            </p>
          </div>
        </div>

        {total > 1 && (
          <div className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-400 font-bold">
            Item {index} / {total}
          </div>
        )}
      </div>

      {/* Progress Bar Container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400 capitalize">{stage}</span>
          <span className="text-cyan-400 font-bold">
            {percent !== null
              ? `${percent}%`
              : stage === 'convertendo'
                ? 'Convertendo...'
                : 'Processando...'}
          </span>
        </div>

        <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative p-0.5">
          {percent !== null ? (
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300 shadow-lg shadow-cyan-500/20"
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-cyan-500/20 via-cyan-400 to-cyan-500/20 rounded-full animate-pulse" />
          )}
        </div>
      </div>

      {/* Item Title if present */}
      {progress?.title && (
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs flex items-center gap-2 text-slate-300">
          <Film className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="font-mono text-slate-300 truncate">
            Arquivo atual: {progress.title}
          </span>
        </div>
      )}

      {/* Stage indicators */}
      <div className="grid grid-cols-3 gap-2 text-[11px] font-medium pt-1">
        <div
          className={`p-2 rounded-lg border text-center flex items-center justify-center gap-1.5 ${
            stage === 'baixando'
              ? 'bg-cyan-950/40 border-cyan-800 text-cyan-300 font-bold'
              : 'bg-slate-950/40 border-slate-800/60 text-slate-400'
          }`}
        >
          <span>1. Download</span>
        </div>
        <div
          className={`p-2 rounded-lg border text-center flex items-center justify-center gap-1.5 ${
            stage === 'convertendo'
              ? 'bg-cyan-950/40 border-cyan-800 text-cyan-300 font-bold'
              : 'bg-slate-950/40 border-slate-800/60 text-slate-400'
          }`}
        >
          <span>2. Reencode 1080p</span>
        </div>
        <div
          className={`p-2 rounded-lg border text-center flex items-center justify-center gap-1.5 ${
            stage === 'finalizando'
              ? 'bg-cyan-950/40 border-cyan-800 text-cyan-300 font-bold'
              : 'bg-slate-950/40 border-slate-800/60 text-slate-400'
          }`}
        >
          <span>3. Finalizando</span>
        </div>
      </div>

      {/* Cancel button */}
      <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400 italic">
          * Ocultar a barra nao cancela o download no Python. A fila continua.
        </p>
        <button
          onClick={onCancel}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
        >
          <Ban className="w-3.5 h-3.5" />
          <span>Ocultar barra</span>
        </button>
      </div>
    </div>
  );
};
