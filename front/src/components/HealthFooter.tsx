import React from 'react';
import { HealthResponse } from '../types';
import { Server, CheckCircle2, AlertTriangle, Terminal } from 'lucide-react';

interface HealthFooterProps {
  health: HealthResponse | null;
  isConnecting: boolean;
  baseUrl: string;
  onOpenConfig: () => void;
  onOpenGuide: () => void;
}

export const HealthFooter: React.FC<HealthFooterProps> = ({
  health,
  isConnecting,
  baseUrl,
  onOpenConfig,
  onOpenGuide,
}) => {
  const isOnline = health?.ok === true;
  const binaries = health?.binaries;
  const allBinariesOk = binaries?.ytdlp && binaries?.ffmpeg && binaries?.ffprobe;

  return (
    <footer className="w-full border-t border-slate-800/80 bg-slate-900/40 py-4 px-4 sm:px-6 mt-auto text-xs text-slate-400">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left info */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1">
          <button
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 hover:text-white transition group"
          >
            <Server className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
            <span className="font-mono text-[11px] text-slate-300">{baseUrl}</span>
          </button>

          <span className="text-slate-700 hidden sm:inline">•</span>

          <span className="text-[11px]">
            Perfil: <strong className="text-slate-300 font-mono">MP4 1920x1080 @ 30fps</strong>
          </span>
        </div>

        {/* Right status */}
        <div className="flex items-center gap-3 text-[11px]">
          {isConnecting ? (
            <span className="text-amber-400 flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Verificando saúde da API...
            </span>
          ) : isOnline ? (
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> API Online
              </span>
              <span className="text-slate-700">•</span>
              <span className="font-mono text-slate-400">
                yt-dlp: {binaries?.ytdlp ? '✓' : '✗'} | ffmpeg: {binaries?.ffmpeg ? '✓' : '✗'} | ffprobe:{' '}
                {binaries?.ffprobe ? '✓' : '✗'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenGuide}
                className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 hover:underline"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Backend offline (clique para ajuda)
              </button>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};
