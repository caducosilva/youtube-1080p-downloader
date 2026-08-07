import React from 'react';
import { Download, Server, HelpCircle, ShieldCheck } from 'lucide-react';
import { HealthResponse } from '../types';

interface HeaderProps {
  health: HealthResponse | null;
  isConnecting: boolean;
  onOpenConfig: () => void;
  onOpenGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  isConnecting,
  onOpenConfig,
  onOpenGuide,
}) => {
  const isOnline = health?.ok === true;
  const allBinariesOk =
    health?.binaries.ytdlp && health?.binaries.ffmpeg && health?.binaries.ffprobe;

  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Left branding */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/10">
            <Download className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white leading-tight">
                Baixador 1080p
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                1920x1080 @ 30fps
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Fila local · 1 download por vez · sem historico no navegador
            </p>
          </div>
        </div>

        {/* Right status & controls */}
        <div className="flex items-center gap-2.5">
          {/* Quick status button */}
          <button
            onClick={onOpenConfig}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
              isConnecting
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                : isOnline && allBinariesOk
                ? 'bg-slate-800/80 border-slate-700/60 text-slate-200 hover:border-cyan-500/50 hover:bg-slate-800'
                : 'bg-rose-950/50 border-rose-800/60 text-rose-300 hover:bg-rose-900/60'
            }`}

          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnecting
                  ? 'bg-amber-400 animate-ping'
                  : isOnline && allBinariesOk
                  ? 'bg-emerald-400'
                  : 'bg-rose-500'
              }`}
            />
            <span className="hidden md:inline">
              {isConnecting
                ? 'Conectando API...'
                : isOnline
                ? allBinariesOk
                  ? 'API Ativa'
                  : 'Binários Incompletos'
                : 'API Desconectada'}
            </span>
            <Server className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Guide button */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition"
            title="Como rodar o backend em Python"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Guia do Backend</span>
          </button>
        </div>
      </div>
    </header>
  );
};
