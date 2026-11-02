import React, { useMemo } from 'react';
import {
  Music,
  Upload,
  Download,
  Play,
  Share2,
  Volume2,
  Clock,
  Disc,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { FileRecord } from '../../types.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const AudiosView: React.FC = () => {
  const {
    openUpload,
    setAudioPlayerFile,
    setDetailFile,
    setShareTarget,
    searchQuery,
    notify,
    allFiles,
    filesLoading,
  } = useApp();

  const loading = filesLoading;

  const audios = useMemo(() => {
    let list = allFiles.filter((f) => !f.inTrash && f.type === 'audio');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.ownerName.toLowerCase().includes(q) ||
          (f.tags && f.tags.some((t) => t.toLowerCase().includes(q))) ||
          f.extension.toLowerCase().includes(q)
      );
    }
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [allFiles, searchQuery]);

  const handleDownload = (e: React.MouseEvent, audio: FileRecord) => {
    e.stopPropagation();
    api.triggerDownload(`/api/files/${audio.id}/download`);
    notify(`Iniciando download do arquivo de áudio original (${formatBytes(audio.size)})`, 'info');
  };

  const handleShare = (e: React.MouseEvent, audio: FileRecord) => {
    e.stopPropagation();
    setShareTarget({ type: 'file', id: audio.id, name: audio.name });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <Music className="w-5 h-5 text-emerald-400" />
            Acervo de Áudios, Pregações & Multitracks
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Gravações de cultos em master WAV 96kHz, multitracks da equipe de louvor e podcasts da igreja.
          </p>
        </div>

        <button
          onClick={() => openUpload()}
          className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-sm transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>Enviar áudios</span>
        </button>
      </div>

      {/* Audios List */}
      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">Carregando faixas de áudio...</div>
      ) : audios.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800">
          <Music className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-200">Nenhum áudio encontrado</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            Armazene gravações das ministrações de louvor, mensagens pastorais e multitracks.
          </p>
          <button
            onClick={() => openUpload()}
            className="mt-4 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs"
          >
            Fazer upload de áudio
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {audios.map((audio) => (
            <div
              key={audio.id}
              onClick={() => setAudioPlayerFile(audio)}
              className="group p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/60 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-amber-400 group-hover:text-neutral-950 transition-colors">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>

                <div className="min-w-0">
                  <span className="font-semibold text-neutral-200 text-xs truncate block group-hover:text-amber-300">
                    {audio.name}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono-numbers mt-0.5">
                    <span className="uppercase text-emerald-400 font-medium">{audio.extension}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(audio.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(audio.createdAt)}</span>
                    {audio.duration && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Duração: {audio.duration}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => handleShare(e, audio)}
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Compartilhar"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setAudioPlayerFile(audio)}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Ouvir</span>
                </button>

                <button
                  onClick={(e) => handleDownload(e, audio)}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-3 h-3" />
                  <span>Baixar Master</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
