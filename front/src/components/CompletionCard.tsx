import React, { useState } from 'react';
import {
  CheckCircle2,
  FolderCheck,
  Copy,
  Check,
  FileVideo,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { DoneEventData } from '../types';

interface CompletionCardProps {
  doneData: DoneEventData;
  onReset: () => void;
}

export const CompletionCard: React.FC<CompletionCardProps> = ({ doneData, onReset }) => {
  const [copiedFolder, setCopiedFolder] = useState(false);
  const [copiedFileIndex, setCopiedFileIndex] = useState<number | null>(null);

  const handleCopyFolder = () => {
    if (doneData.outputFolder) {
      navigator.clipboard.writeText(doneData.outputFolder);
      setCopiedFolder(true);
      setTimeout(() => setCopiedFolder(false), 2000);
    }
  };

  const handleCopyPath = (pathStr: string, index: number) => {
    navigator.clipboard.writeText(pathStr);
    setCopiedFileIndex(index);
    setTimeout(() => setCopiedFileIndex(null), 2000);
  };

  return (
    <div className="w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Download Concluído com Sucesso!</h2>
            <p className="text-xs text-slate-400">
              {doneData.count} {doneData.count === 1 ? 'vídeo processado' : 'vídeos processados'} e gravados no disco em 1080p@30fps.
            </p>
          </div>
        </div>

        <button
          onClick={onReset}
          className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition"
        >
          <span>Fechar aviso</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Output Directory Box */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <FolderCheck className="w-4 h-4 text-emerald-400" />
            Pasta de Destino no Computador:
          </span>
          <button
            onClick={handleCopyFolder}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
          >
            {copiedFolder ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Caminho Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Caminho</span>
              </>
            )}
          </button>
        </div>

        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 font-mono text-xs text-slate-200 select-all break-all">
          {doneData.outputFolder || 'Pasta de Downloads (Área de Trabalho)'}
        </div>
      </div>

      {/* List of Saved UUID Files */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <FileVideo className="w-4 h-4 text-cyan-400" />
          Arquivos Gravados ({doneData.paths?.length || 0}):
        </h4>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {doneData.paths && doneData.paths.length > 0 ? (
            doneData.paths.map((filePath: string, idx: number) => {
              const fileName = filePath.split('\\').pop()?.split('/').pop() || filePath;
              const isCopied = copiedFileIndex === idx;

              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-semibold text-cyan-400 truncate">
                      {fileName}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                      {filePath}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyPath(filePath, idx)}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white transition shrink-0"
                    title="Copiar caminho completo do arquivo"
                  >
                    {isCopied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="p-3 rounded-xl bg-slate-950 text-xs text-slate-400">
              Download concluído. Os arquivos estão salvos na pasta.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
