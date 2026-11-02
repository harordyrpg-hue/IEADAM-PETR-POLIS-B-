import React from 'react';
import {
  X,
  Download,
  Share2,
  Film,
  Play,
  Volume2,
  Clock,
  HardDrive,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { formatBytes } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const VideoPlayerModal: React.FC = () => {
  const {
    videoPlayerFile,
    setVideoPlayerFile,
    setDetailFile,
    setShareTarget,
    notify,
  } = useApp();

  if (!videoPlayerFile) return null;

  const handleDownload = () => {
    api.triggerDownload(`/api/files/${videoPlayerFile.id}/download`);
    notify(`Iniciando download do vídeo original (${formatBytes(videoPlayerFile.size)})`, 'info');
  };

  const handleShare = () => {
    setShareTarget({ type: 'file', id: videoPlayerFile.id, name: videoPlayerFile.name });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-900/90">
          <div className="flex items-center gap-2.5 truncate">
            <Film className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-semibold text-xs text-neutral-200 truncate">
              {videoPlayerFile.name}
            </span>
          </div>
          <button
            onClick={() => setVideoPlayerFile(null)}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Viewport */}
        <div className="relative aspect-video bg-black flex items-center justify-center">
          <video
            controls
            autoPlay
            className="w-full h-full object-contain"
            src={`/storage/originals/${videoPlayerFile.storageKey}`}
            poster={videoPlayerFile.thumbnailUrl || undefined}
          >
            Seu navegador não suporta a pré-visualização deste formato de vídeo.
          </video>
        </div>

        {/* Metadata & Controls Bar */}
        <div className="p-4 bg-neutral-900/95 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-200">{videoPlayerFile.name}</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono-numbers text-[10px]">
                {videoPlayerFile.resolution || '4K UHD'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-neutral-400 font-mono-numbers text-[11px]">
              <span>Tamanho: {formatBytes(videoPlayerFile.size)}</span>
              <span aria-hidden="true">·</span>
              <span>Duração: {videoPlayerFile.duration || '01:42:18'}</span>
              <span aria-hidden="true">·</span>
              <span>Codec: {videoPlayerFile.metadata?.codec || 'Original H.264/ProRes'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartilhar</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Vídeo Original</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
