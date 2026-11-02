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
  Trash2,
  Info,
  Check,
} from 'lucide-react';
import { FileRecord } from '../../types.js';
import { formatBytes, formatDate, getMediaCategoryLabel } from '../../utils/formatters.js';
import { useApp } from '../../context/AppContext.js';
import { api } from '../../services/api.js';

interface FileListRowProps {
  file: FileRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
}

export const FileListRow: React.FC<FileListRowProps> = ({
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

  const getIcon = () => {
    switch (file.type) {
      case 'photo':
        return <ImageIcon className="w-4 h-4 text-amber-400" />;
      case 'video':
        return <Film className="w-4 h-4 text-blue-400" />;
      case 'art':
        return <Palette className="w-4 h-4 text-purple-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-emerald-400" />;
      case 'document':
        return <FileText className="w-4 h-4 text-red-400" />;
      default:
        return <Archive className="w-4 h-4 text-neutral-400" />;
    }
  };

  return (
    <tr
      onClick={handleOpen}
      className={`group border-b border-neutral-800/80 hover:bg-neutral-800/50 cursor-pointer transition-colors text-xs ${
        isSelected ? 'bg-amber-500/10' : ''
      }`}
    >
      {/* Checkbox */}
      <td className="w-10 px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onSelect(file.id)}
          className={`w-4 h-4 rounded flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-amber-400 text-neutral-950'
              : 'border border-neutral-600 group-hover:border-neutral-400'
          }`}
        >
          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
        </button>
      </td>

      {/* Name and Type */}
      <td className="px-3 py-2.5 min-w-[220px]">
        <div className="flex items-center gap-2.5">
          <div className="shrink-0">{getIcon()}</div>
          <span className="font-medium text-neutral-200 truncate group-hover:text-amber-300">
            {file.name}
          </span>
          {file.isFavorite && (
            <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
          )}
        </div>
      </td>

      {/* Media Type */}
      <td className="px-3 py-2.5 text-neutral-400 hidden sm:table-cell whitespace-nowrap">
        {getMediaCategoryLabel(file.type)}
      </td>

      {/* Size (Tabular Figures) */}
      <td className="px-3 py-2.5 text-right font-mono-numbers text-neutral-300 whitespace-nowrap">
        {formatBytes(file.size)}
      </td>

      {/* Resolution or Duration */}
      <td className="px-3 py-2.5 text-neutral-400 font-mono-numbers hidden md:table-cell whitespace-nowrap">
        {file.resolution || file.duration || '—'}
      </td>

      {/* Uploader */}
      <td className="px-3 py-2.5 text-neutral-400 hidden lg:table-cell truncate max-w-[120px]">
        {file.userName}
      </td>

      {/* Date */}
      <td className="px-3 py-2.5 text-neutral-400 font-mono-numbers hidden md:table-cell whitespace-nowrap">
        {formatDate(file.createdAt)}
      </td>

      {/* Row Actions */}
      <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
          <button
            onClick={handleDownload}
            title="Baixar original"
            className="p-1 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleShare}
            title="Compartilhar"
            className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToggleFavorite}
            title="Favoritar"
            className="p-1 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded transition-colors"
          >
            <Star className={`w-3.5 h-3.5 ${file.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>
          <button
            onClick={handleTrash}
            title="Mover para lixeira"
            className="p-1 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
