import React from 'react';
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
  MoreVertical,
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

  const renderThumbnail = () => {
    const imageSource = file.thumbnailUrl || (file.type === 'photo' || file.type === 'art' ? file.downloadUrl : null);
    if (imageSource) {
      return (
        <div className="relative w-full h-40 bg-neutral-900 overflow-hidden group/thumb">
          <img
            src={imageSource}
            alt={file.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {file.type === 'video' && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-90 group-hover/thumb:opacity-100 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-amber-500/90 text-neutral-950 flex items-center justify-center shadow-lg">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </div>
            </div>
          )}
          {file.resolution && (
            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/75 text-[10px] text-neutral-200 font-mono-numbers rounded">
              {file.resolution}
            </span>
          )}
          {file.duration && (
            <span className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/75 text-[10px] text-neutral-200 font-mono-numbers rounded">
              {file.duration}
            </span>
          )}
        </div>
      );
    }

    // Fallback based on type
    const getFallbackIcon = () => {
      switch (file.type) {
        case 'video':
          return <Film className="w-10 h-10 text-blue-400" />;
        case 'audio':
          return <Music className="w-10 h-10 text-emerald-400" />;
        case 'art':
          return <Palette className="w-10 h-10 text-amber-400" />;
        case 'document':
          return <FileText className="w-10 h-10 text-purple-400" />;
        case 'archive':
          return <Archive className="w-10 h-10 text-orange-400" />;
        default:
          return <ImageIcon className="w-10 h-10 text-neutral-400" />;
      }
    };

    return (
      <div className="relative w-full h-40 bg-neutral-800/80 flex flex-col items-center justify-center border-b border-neutral-700/40">
        {getFallbackIcon()}
        <span className="mt-2 text-[11px] font-mono uppercase text-neutral-400">
          .{file.extension}
        </span>
        {file.duration && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-neutral-900/80 text-[10px] text-neutral-300 font-mono-numbers rounded">
            {file.duration}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={handleOpen}
      className={`group relative bg-neutral-900 border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg ${
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
            : 'bg-black/50 text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white'
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
            : 'bg-black/40 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-amber-400'
        }`}
        title={file.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
      >
        <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-amber-400' : ''}`} />
      </button>

      {/* Thumbnail area */}
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
              className="p-1 hover:text-amber-400 hover:bg-neutral-800 rounded transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleShare}
              title="Compartilhar"
              className="p-1 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDetailFile(file);
              }}
              title="Ver detalhes"
              className="p-1 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleTrash}
            title="Mover para lixeira"
            className="p-1 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
