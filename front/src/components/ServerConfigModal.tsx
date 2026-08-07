import React, { useState } from 'react';
import { X, Server, CheckCircle2, AlertTriangle, RefreshCw, Terminal, Cpu } from 'lucide-react';
import { HealthResponse } from '../types';
import { DEFAULT_BASE_URL, sanitizeBaseUrl } from '../services/api';

interface ServerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseUrl: string;
  onSaveBaseUrl: (newUrl: string) => void;
  health: HealthResponse | null;
  isTesting: boolean;
  onTestConnection: (testUrl?: string) => void;
  errorMsg: string | null;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  isOpen,
  onClose,
  baseUrl,
  onSaveBaseUrl,
  health,
  isTesting,
  onTestConnection,
  errorMsg,
}) => {
  const [inputUrl, setInputUrl] = useState(baseUrl);

  if (!isOpen) return null;

  const handleSaveAndTest = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeBaseUrl(inputUrl);
    onSaveBaseUrl(cleaned);
    onTestConnection(cleaned);
  };

  const handleResetDefault = () => {
    setInputUrl(DEFAULT_BASE_URL);
    onSaveBaseUrl(DEFAULT_BASE_URL);
    onTestConnection(DEFAULT_BASE_URL);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Configurações da API Local</h3>
              <p className="text-xs text-slate-400">Servidor Python backend (server.py)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5">
          <form onSubmit={handleSaveAndTest} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                URL Base do Backend (HTTP)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8765"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
                <button
                  type="submit"
                  disabled={isTesting}
                  className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                  Testar
                </button>
              </div>
              <div className="flex justify-between items-center mt-1.5">
                <p className="text-[11px] text-slate-500">Padrão local: http://127.0.0.1:8765</p>
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="text-[11px] text-cyan-400 hover:underline"
                >
                  Restaurar padrão
                </button>
              </div>
            </div>
          </form>

          {/* Health & Binaries Status */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2.5">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" /> Status da Conexão
              </span>
              {health?.ok ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Conectado (HTTP 200)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> Desconectado / Erro
                </span>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300">
                <p className="font-bold mb-1">Não foi possível conectar ao backend:</p>
                <p className="font-mono text-[11px] opacity-90">{errorMsg}</p>
                <p className="mt-2 text-[11px] text-rose-200">
                  Certifique-se de executar <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono">python server.py</code> no terminal do seu computador.
                </p>
              </div>
            )}

            {health && (
              <div className="space-y-2.5 pt-1">
                <div className="text-xs text-slate-400">
                  <span className="text-slate-500">Perfil de Saída:</span>{' '}
                  <span className="font-mono text-slate-200">{health.profile}</span>
                </div>

                <div className="text-xs font-semibold text-slate-300 mb-1">
                  Binários do Sistema (Requeridos pelo Python):
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* ytdlp */}
                  <div className={`p-2.5 rounded-lg border text-center text-xs font-mono transition ${
                    health.binaries.ytdlp
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                  }`}>
                    <div className="font-bold">yt-dlp</div>
                    <div className="text-[10px] mt-0.5 font-sans">
                      {health.binaries.ytdlp ? 'Instalado ✓' : 'Ausente ✗'}
                    </div>
                  </div>

                  {/* ffmpeg */}
                  <div className={`p-2.5 rounded-lg border text-center text-xs font-mono transition ${
                    health.binaries.ffmpeg
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                  }`}>
                    <div className="font-bold">ffmpeg</div>
                    <div className="text-[10px] mt-0.5 font-sans">
                      {health.binaries.ffmpeg ? 'Instalado ✓' : 'Ausente ✗'}
                    </div>
                  </div>

                  {/* ffprobe */}
                  <div className={`p-2.5 rounded-lg border text-center text-xs font-mono transition ${
                    health.binaries.ffprobe
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                  }`}>
                    <div className="font-bold">ffprobe</div>
                    <div className="text-[10px] mt-0.5 font-sans">
                      {health.binaries.ffprobe ? 'Instalado ✓' : 'Ausente ✗'}
                    </div>
                  </div>
                </div>

                {(!health.binaries.ytdlp || !health.binaries.ffmpeg || !health.binaries.ffprobe) && (
                  <p className="text-[11px] text-amber-400 bg-amber-950/30 border border-amber-800/50 p-2 rounded-lg mt-2">
                    ⚠️ Atenção: Se algum binário estiver ausente, o backend não conseguirá processar ou reencodar o vídeo em 1080p.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
