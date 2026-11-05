import React, { useMemo } from 'react';
import {
  Film,
  Upload,
  Download,
  Play,
  Share2,
  Star,
  Clock,
  HardDrive,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { FileRecord } from '../../types.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const VideosView: React.FC = () => {
  const {
    openUpload,
    setVideoPlayerFile,
    setDetailFile,
    setShareTarget,
    searchQuery,
    notify,
    allFiles,
    filesLoading,
  } = useApp();

  const loading = filesLoading;

  const videos = useMemo(() => {
    let list = allFiles.filter((f) => !f.inTrash && f.type === 'video');
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

  const handleDownload = (e: React.MouseEvent, video: FileRecord) => {
    e.stopPropagation();
    api.triggerDownload(video.downloadUrl, video.name);
    notify(`Iniciando download do vídeo original (${formatBytes(video.size)})`, 'info');
  };

  const handleShare = (e: React.MouseEvent, video: FileRecord) => {
    e.stopPropagation();
    setShareTarget({ type: 'file', id: video.id, name: video.name });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <Film className="w-5 h-5 text-blue-400" />
            Central de Vídeos & Transmissões 4K
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Armazenamento de gravações originais em ProRes, 4K UHD e MP4 sem recompressão.
          </p>
        </div>

        <button
          onClick={() => openUpload()}
          className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-sm transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>Enviar vídeos</span>
        </button>
      </div>

      {/* Videos List */}
      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">Carregando acervo de vídeos...</div>
      ) : videos.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800">
          <Film className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-200">Nenhum vídeo registrado</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            Envie gravações de cultos, testemunhos, cortes para redes sociais e documentários.
          </p>
          <button
            onClick={() => openUpload()}
            className="mt-4 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs"
          >
            Fazer upload de vídeo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((video) => (
            <div
              key={video.id}
              onClick={() => setVideoPlayerFile(video)}
              className="group rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-all flex flex-col justify-between"
            >
              {/* Video Thumbnail */}
              <div className="relative aspect-video w-full overflow-hidden bg-black">
                <img
                  src={video.thumbnailUrl || '/src/assets/images/church_worship_stage_1790831714044.jpg'}
                  alt={video.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
                />

                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-amber-400/90 group-hover:bg-amber-400 text-neutral-950 flex items-center justify-center shadow-xl group-hover:scale-110 transition-all">
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Badges */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-black/75 text-[10px] text-blue-300 font-mono-numbers font-medium">
                    {video.resolution || '4K UHD'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-black/75 text-[10px] text-neutral-200 font-mono uppercase">
                    {video.extension}
                  </span>
                </div>

                {video.duration && (
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/85 text-[11px] text-neutral-100 font-mono-numbers font-medium">
                    {video.duration}
                  </span>
                )}
              </div>

              {/* Video Info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3
                    title={video.name}
                    className="font-semibold text-neutral-200 text-xs line-clamp-1 group-hover:text-amber-300 transition-colors"
                  >
                    {video.name}
                  </h3>

                  {/* Clean Unboxed Metadata */}
                  <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono-numbers mt-1.5">
                    <span>{formatBytes(video.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(video.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{video.userName}</span>
                  </div>
                </div>

                {/* Action Buttons: Assistir e Baixar Original */}
                <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setVideoPlayerFile(video)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Assistir</span>
                  </button>

                  <button
                    onClick={(e) => handleDownload(e, video)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold transition-all shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar original</span>
                  </button>

                  <button
                    onClick={(e) => handleShare(e, video)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    title="Compartilhar"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
