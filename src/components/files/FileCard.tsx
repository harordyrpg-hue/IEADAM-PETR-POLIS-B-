import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Palette,
  Archive,
  Download,
  Share2,
  Star,
  Trash2,
  Info,
  Play,
  Check,
} from 'lucide-react';
import { FileRecord } from '../../types.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { useApp } from '../../context/AppContext.js';
import { api } from '../../services/api.js';

interface FileCardProps {
  file: FileRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
}

// Global in-memory cache to avoid re-resolving chunked blobs across re-renders
const mediaBlobCache = new Map<string, string>();

export const FileCard: React.FC<FileCardProps> = ({
  file,
  isSelected,
  onSelect,
  onRefresh,
}) => {
  const {
    setDetailFile,
    setLightboxFile,
    setVideoPlayerFile,
    setAudioPlayerFile,
    setShareTarget,
    notify,
  } = useApp();

  const [resolvedSource, setResolvedSource] = useState<string | null>(() => {
    if (file.thumbnailUrl && !file.thumbnailUrl.startsWith('chunked://')) {
      return file.thumbnailUrl;
    }
    if (mediaBlobCache.has(file.id)) {
      return mediaBlobCache.get(file.id)!;
    }
    return null;
  });

  const [imgError, setImgError] = useState(false);

  // If the file is stored in chunked Firestore or needs resolution
  useEffect(() => {
    let isMounted = true;

    if (resolvedSource && !resolvedSource.startsWith('chunked://')) {
      return;
    }

    const needsResolution =
      (file.thumbnailUrl && file.thumbnailUrl.startsWith('chunked://')) ||
      (!file.thumbnailUrl && (file.type === 'photo' || file.type === 'art') && file.downloadUrl?.startsWith('chunked://'));

    if (needsResolution) {
      if (mediaBlobCache.has(file.id)) {
        setResolvedSource(mediaBlobCache.get(file.id)!);
        return;
      }

      api.resolveMediaUrl(file).then((url) => {
        if (isMounted && url) {
          mediaBlobCache.set(file.id, url);
          setResolvedSource(url);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [file.id, file.thumbnailUrl, file.downloadUrl, resolvedSource]);

  const handleOpen = () => {
    if (file.type === 'photo') {
      setLightboxFile(file);
    } else if (file.type === 'video') {
      setVideoPlayerFile(file);
    } else if (file.type === 'audio') {
      setAudioPlayerFile(file);
    } else {
      setDetailFile(file);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    api.triggerDownload(file.downloadUrl, file.name);
    notify(`Iniciando download do original: ${file.name}`, 'info');
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShareTarget({ type: 'file', id: file.id, name: file.name });
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.updateFile(file.id, { isFavorite: !file.isFavorite });
      if (onRefresh) onRefresh();
    } catch {
      notify('Erro ao atualizar favorito', 'error');
    }
  };

  const handleTrash = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.trashFile(file.id);
      notify('Arquivo movido para a Lixeira', 'info');
      if (onRefresh) onRefresh();
    } catch {
      notify('Erro ao mover para a lixeira', 'error');
    }
  };

  // Determine active visual image source
  const activeImageSource = !imgError
    ? (resolvedSource && !resolvedSource.startsWith('chunked://')
        ? resolvedSource
        : (file.thumbnailUrl && !file.thumbnailUrl.startsWith('chunked://')
            ? file.thumbnailUrl
            : (file.type === 'photo' || file.type === 'art'
                ? (file.downloadUrl && !file.downloadUrl.startsWith('chunked://') ? file.downloadUrl : null)
                : null)))
    : null;

  const renderThumbnail = () => {
    if (activeImageSource) {
      return (
        <div className="relative w-full h-44 bg-neutral-900 overflow-hidden group/thumb flex items-center justify-center">
          <img
            src={activeImageSource}
            alt=""
            aria-hidden="true"
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {file.type === 'video' && (
            <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-90 group-hover/thumb:opacity-100 transition-opacity">
              <div className="w-11 h-11 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg shadow-black/50 transform group-hover/thumb:scale-110 transition-transform">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </div>
            </div>
          )}
          {file.resolution && (
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[10px] text-neutral-200 font-mono-numbers rounded backdrop-blur-xs">
              {file.resolution}
            </span>
          )}
          {file.duration && (
            <span className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/80 text-[10px] text-neutral-200 font-mono-numbers rounded backdrop-blur-xs">
              {file.duration}
            </span>
          )}
        </div>
      );
    }

    // Rich visual representations for documents, audio, and media when image is not present
    if (file.type === 'document') {
      const ext = (file.extension || 'DOC').toUpperCase();
      let badgeBg = 'bg-red-600';
      let borderTop = 'border-t-red-500';

      if (['DOC', 'DOCX'].includes(ext)) {
        badgeBg = 'bg-blue-600';
        borderTop = 'border-t-blue-500';
      } else if (['XLS', 'XLSX', 'CSV'].includes(ext)) {
        badgeBg = 'bg-emerald-600';
        borderTop = 'border-t-emerald-500';
      } else if (['PPT', 'PPTX'].includes(ext)) {
        badgeBg = 'bg-amber-600';
        borderTop = 'border-t-amber-500';
      }

      return (
        <div className="relative w-full h-44 bg-neutral-950 p-4 flex items-center justify-center border-b border-neutral-800">
          {/* Realistic Paper Sheet inside square */}
          <div className={`relative w-40 h-34 bg-white rounded-md shadow-md border-t-4 ${borderTop} p-2.5 flex flex-col justify-between overflow-hidden transform group-hover:scale-102 transition-transform`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`px-1.5 py-0.5 ${badgeBg} text-white text-[9px] font-bold rounded uppercase`}>
                  {ext}
                </span>
                <FileText className="w-3.5 h-3.5 text-neutral-400" />
              </div>
              {/* Document Mock Paragraph Lines */}
              <div className="space-y-1.5">
                <div className="h-1.5 bg-neutral-800 rounded-full w-full" />
                <div className="h-1 bg-neutral-300 rounded-full w-11/12" />
                <div className="h-1 bg-neutral-300 rounded-full w-4/5" />
                <div className="h-1 bg-neutral-300 rounded-full w-9/12" />
                <div className="h-1 bg-neutral-300 rounded-full w-3/4" />
              </div>
            </div>
            <div className="text-[8px] text-neutral-400 font-mono text-right border-t border-neutral-100 pt-1">
              Documento PT-B
            </div>
          </div>
        </div>
      );
    }

    if (file.type === 'audio') {
      return (
        <div className="relative w-full h-44 bg-gradient-to-br from-emerald-950/80 via-neutral-900 to-neutral-950 flex flex-col items-center justify-center border-b border-neutral-800">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-105 transition-transform">
            <Music className="w-7 h-7" />
          </div>
          {/* Sound wave equalizer effect */}
          <div className="flex items-center gap-1 mt-3">
            <span className="w-1 h-3 bg-emerald-500/60 rounded-full animate-pulse" />
            <span className="w-1 h-5 bg-emerald-400 rounded-full" />
            <span className="w-1 h-2 bg-emerald-500/60 rounded-full" />
            <span className="w-1 h-6 bg-emerald-400 rounded-full animate-pulse" />
            <span className="w-1 h-4 bg-emerald-500/60 rounded-full" />
          </div>
          <span className="mt-2 text-[10px] font-mono uppercase tracking-wider text-emerald-300/80">
            {file.extension || 'Áudio'} · Master
          </span>
        </div>
      );
    }

    if (file.type === 'video') {
      return (
        <div className="relative w-full h-44 bg-gradient-to-br from-neutral-900 via-neutral-950 to-blue-950/40 flex flex-col items-center justify-center border-b border-neutral-800">
          <div className="w-12 h-12 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg shadow-black/50 group-hover:scale-110 transition-transform">
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </div>
          <span className="mt-3 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
            Vídeo Original · .{file.extension}
          </span>
          {file.duration && (
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[10px] text-neutral-200 font-mono-numbers rounded">
              {file.duration}
            </span>
          )}
        </div>
      );
    }

    // Default media placeholder (clean icon, zero broken alt text)
    return (
      <div className="relative w-full h-44 bg-neutral-900/90 flex flex-col items-center justify-center border-b border-neutral-800">
        <div className="w-12 h-12 rounded-xl bg-neutral-800/80 flex items-center justify-center text-amber-400/80 border border-neutral-700/50">
          {file.type === 'art' ? (
            <Palette className="w-6 h-6" />
          ) : file.type === 'archive' ? (
            <Archive className="w-6 h-6" />
          ) : (
            <ImageIcon className="w-6 h-6" />
          )}
        </div>
        <span className="mt-2 text-[11px] font-mono uppercase text-neutral-400">
          .{file.extension}
        </span>
      </div>
    );
  };

  return (
    <div
      onClick={handleOpen}
      className={`group relative bg-neutral-900 border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl ${
        isSelected
          ? 'border-amber-400 ring-2 ring-amber-400/20'
          : 'border-neutral-800 hover:border-neutral-700'
      }`}
    >
      {/* Checkbox for batch selection */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect(file.id);
        }}
        className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
          isSelected
            ? 'bg-amber-400 text-neutral-950 shadow-sm'
            : 'bg-black/60 text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white'
        }`}
      >
        <Check className={`w-3.5 h-3.5 ${isSelected ? 'stroke-[3]' : 'stroke-2'}`} />
      </button>

      {/* Favorite Star Button */}
      <button
        onClick={handleToggleFavorite}
        className={`absolute top-2 right-2 z-10 p-1.5 rounded-md backdrop-blur-xs transition-all ${
          file.isFavorite
            ? 'bg-amber-500/20 text-amber-400 opacity-100'
            : 'bg-black/50 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-amber-400'
        }`}
        title={file.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
      >
        <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-amber-400' : ''}`} />
      </button>

      {/* Thumbnail area (Always visual, never broken text) */}
      {renderThumbnail()}

      {/* Card Content & Zero-Pill Metadata */}
      <div className="p-3">
        <h3
          title={file.name}
          className="text-xs font-semibold text-neutral-200 truncate group-hover:text-amber-300 transition-colors"
        >
          {file.name}
        </h3>

        {/* Clean unboxed metadata with · separator */}
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono-numbers mt-1 truncate">
          <span>{formatBytes(file.size)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(file.createdAt)}</span>
          {file.resolution && (
            <>
              <span aria-hidden="true">·</span>
              <span>{file.resolution}</span>
            </>
          )}
        </div>

        {/* Card Action Hover Bar */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-800/80 text-neutral-400">
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownload}
              title="Baixar original sem compressão"
              className="p-1.5 hover:text-amber-400 hover:bg-neutral-800 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleShare}
              title="Compartilhar"
              className="p-1.5 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDetailFile(file);
              }}
              title="Ver detalhes"
              className="p-1.5 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleTrash}
            title="Mover para lixeira"
            className="p-1.5 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
