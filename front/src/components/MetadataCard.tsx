import React, { useState } from 'react';
import {
  Film,
  ListVideo,
  Clock,
  CheckSquare,
  Square,
  Download,
  CheckCircle2,
  AlertOctagon,
  Search,
  Video,
} from 'lucide-react';
import { MetadataResponse, PlaylistEntry } from '../types';
import { formatDuration } from '../utils/formatters';

interface MetadataCardProps {
  metadata: MetadataResponse;
  selectedIds: string[];
  onToggleId: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onStartDownload: () => void;
  isDownloading: boolean;
}

export const MetadataCard: React.FC<MetadataCardProps> = ({
  metadata,
  selectedIds,
  onToggleId,
  onSelectAll,
  onDeselectAll,
  onStartDownload,
  isDownloading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!metadata.valid) {
    const msg =
      'error' in metadata && typeof metadata.error === 'string'
        ? metadata.error
        : 'A URL fornecida nao e suportada ou o conteudo nao esta publico.';
    return (
      <div className="w-full rounded-2xl bg-rose-950/40 border border-rose-800/60 p-6 text-rose-300 space-y-2 animate-in fade-in duration-200">
        <div className="flex items-center gap-2 font-bold text-sm text-rose-200">
          <AlertOctagon className="w-5 h-5 text-rose-400" />
          <span>Nao foi possivel analisar este link</span>
        </div>
        <p className="text-xs text-rose-300/80 font-mono">{msg}</p>
      </div>
    );
  }

  // SINGLE VIDEO
  if (metadata.type === 'video') {
    return (
      <div className="w-full rounded-2xl bg-slate-900 border border-slate-800/80 p-5 sm:p-6 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex flex-col md:flex-row gap-5 items-start">
          {/* Thumbnail */}
          <div className="relative w-full md:w-64 h-40 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 group">
            {metadata.thumbnail ? (
              <img
                src={metadata.thumbnail}
                alt={metadata.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <Video className="w-8 h-8 text-slate-500" />
                <span className="text-xs font-medium">Sem miniatura</span>
              </div>
            )}
            {metadata.durationSeconds && (
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur text-[11px] font-mono font-semibold text-white border border-slate-700/60 flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" />
                <span>{formatDuration(metadata.durationSeconds)}</span>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/60 border border-cyan-800/60 text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
              <Film className="w-3.5 h-3.5" /> Vídeo Único Detectado
            </div>

            <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
              {metadata.title}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400">Resolução Final</div>
                <div className="font-mono font-bold text-cyan-400">1920x1080 (1080p)</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400">Taxa de Quadros</div>
                <div className="font-mono font-bold text-cyan-400">30 FPS</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 col-span-2 sm:col-span-1">
                <div className="text-[11px] text-slate-400">Formato / Codec</div>
                <div className="font-mono font-bold text-slate-200">MP4 (H.264)</div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              * O backend removerá os metadados originais e reencodará o arquivo para MP4 1080p@30fps com nome UUID.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 border-t border-slate-800/80 flex justify-end">
          <button
            onClick={onStartDownload}
            disabled={isDownloading}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2.5 transition transform active:scale-98 disabled:opacity-40"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Adicionar a fila (1080p MP4)</span>
          </button>
        </div>
      </div>
    );
  }

  // PLAYLIST / ALBUM
  const entries = metadata.entries || [];
  const filteredEntries = entries.filter((item) =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const allSelected = entries.length > 0 && selectedIds.length === entries.length;
  const noneSelected = selectedIds.length === 0;

  return (
    <div className="w-full rounded-2xl bg-slate-900 border border-slate-800/80 p-5 sm:p-6 shadow-xl space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-950/60 border border-blue-800/60 text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1.5">
            <ListVideo className="w-3.5 h-3.5" /> Álbum / Playlist ({entries.length} vídeos)
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
            {metadata.title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/60 flex items-center gap-1.5 transition"
          >
            {allSelected ? (
              <>
                <Square className="w-3.5 h-3.5 text-slate-400" />
                <span>Desmarcar Todos</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Selecionar Todos ({entries.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter / Search inside playlist */}
      {entries.length > 4 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar vídeos da playlist por título..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>
      )}

      {/* Playlist Item Selection List */}
      <div className="max-h-80 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
        {filteredEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Nenhum vídeo encontrado para o filtro.
          </div>
        ) : (
          filteredEntries.map((entry: PlaylistEntry, idx: number) => {
            const isSelected = selectedIds.includes(entry.id);
            return (
              <div
                key={entry.id || idx}
                onClick={() => onToggleId(entry.id)}
                className={`p-3 rounded-xl border flex items-center gap-3.5 cursor-pointer transition ${
                  isSelected
                    ? 'bg-slate-800/90 border-cyan-500/60 text-white'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-950'
                }`}
              >
                {/* Checkbox icon */}
                <div className="shrink-0">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-cyan-400" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-600" />
                  )}
                </div>

                {/* Thumbnail */}
                <div className="w-16 h-10 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
                  {entry.thumbnail ? (
                    <img
                      src={entry.thumbnail}
                      alt={entry.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Film className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Title & Duration */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-slate-200 truncate">
                    {entry.title || `Vídeo ${idx + 1}`}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                    <span>{formatDuration(entry.durationSeconds)}</span>
                    <span>•</span>
                    <span className="text-slate-400">ID: {entry.id}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selection Footer */}
      <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          <span className="font-bold text-cyan-400 font-mono">{selectedIds.length}</span> de{' '}
          <span className="font-mono">{entries.length}</span> videos listados. A fila baixa o album inteiro (videos distintos).
        </div>

        <button
          onClick={onStartDownload}
          disabled={isDownloading || noneSelected}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition transform active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4 stroke-[2.5]" />
          <span>Adicionar album a fila</span>
        </button>
      </div>
    </div>
  );
};
