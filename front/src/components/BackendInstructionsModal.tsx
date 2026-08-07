import React, { useState } from 'react';
import { X, Terminal, Copy, Check, ExternalLink, Code2, AlertTriangle } from 'lucide-react';

interface BackendInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseUrl: string;
}

export const BackendInstructionsModal: React.FC<BackendInstructionsModalProps> = ({
  isOpen,
  onClose,
  baseUrl,
}) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (cmd: string, key: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const commandRun = `cd %USERPROFILE%\\Desktop\\youtube-1080p-downloader\npython server.py`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Guia de Execução do Backend Python</h3>
              <p className="text-xs text-slate-400">Como subir o servidor local (server.py)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar text-xs">
          {/* Step 1 */}
          <div className="space-y-2">
            <div className="font-bold text-slate-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-[11px]">
                1
              </span>
              Abra o Terminal ou Prompt de Comando no Windows
            </div>
            <p className="text-slate-400 pl-7">
              Acesse a pasta onde o repositório do backend Python (<code className="font-mono text-cyan-300">server.py</code>) está salvo.
            </p>
          </div>

          {/* Step 2 Command Box */}
          <div className="space-y-2">
            <div className="font-bold text-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-[11px]">
                  2
                </span>
                Execute o Backend Python
              </div>
              <button
                onClick={() => handleCopy(commandRun, 'run')}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] font-semibold"
              >
                {copiedCmd === 'run' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Comando</span>
                  </>
                )}
              </button>
            </div>

            <div className="pl-7">
              <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-cyan-300 select-all overflow-x-auto">
                {commandRun}
              </pre>
            </div>
          </div>

          {/* Step 3 URL configuration */}
          <div className="space-y-2">
            <div className="font-bold text-slate-200 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center font-bold text-[11px]">
                3
              </span>
              Verifique a Porta no Log do Terminal
            </div>
            <p className="text-slate-400 pl-7">
              Ao iniciar, o script exibirá o endereço base, por exemplo:{' '}
              <code className="font-mono text-cyan-400">http://127.0.0.1:8765</code>.
              Cole esse endereço no campo <strong>Base URL</strong> no topo deste frontend.
            </p>
          </div>

          {/* Requisitos / Binaries */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-cyan-400" />
              Requisitos de Ambiente no Computador:
            </div>
            <ul className="space-y-1.5 text-slate-400 pl-2">
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>
                  <strong className="text-slate-200">Python 3.9+</strong> instalado no PATH.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>
                  <strong className="text-slate-200">yt-dlp e ffmpeg</strong> no PATH para permitir a extração e conversão 1080p@30fps.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>
                  <strong className="text-slate-200">Pasta de saída padrão:</strong>{' '}
                  <code className="font-mono text-slate-300">Videos / VideoDownloader</code> (na pasta do usuário).
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
