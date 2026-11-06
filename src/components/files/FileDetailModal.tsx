import React, { useState } from 'react';
import {
  X,
  Download,
  Share2,
  Star,
  Trash2,
  Calendar,
  User,
  HardDrive,
  Camera,
  Layers,
  Tag,
  Folder as FolderIcon,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { formatBytes, formatDateTime, getMediaCategoryLabel } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const FileDetailModal: React.FC = () => {
  const {
    detailFile,
    setDetailFile,
    setShareTarget,
    setLightboxFile,
    setVideoPlayerFile,
    setAudioPlayerFile,
    folders,
    events,
    notify,
  } = useApp();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (detailFile) {
      setEditedName(detailFile.name);
      setIsEditingName(false);
      setPreviewUrl(detailFile.thumbnailUrl && !detailFile.thumbnailUrl.startsWith('chunked://') ? detailFile.thumbnailUrl : null);
      api.resolveMediaUrl(detailFile).then((url) => {
        if (url) setPreviewUrl(url);
      });
    }
  }, [detailFile]);

  if (!detailFile) return null;

  const currentFolder = folders.find((f) => f.id === detailFile.folderId);
  const currentEvent = events.find((e) => e.id === detailFile.eventId);

  const handleDownload = () => {
    api.triggerDownload(`/api/files/${detailFile.id}/download`);
    notify(`Iniciando download do original: ${detailFile.name}`, 'info');
  };

  const handleShare = () => {
    setShareTarget({ type: 'file', id: detailFile.id, name: detailFile.name });
  };

  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === detailFile.name) {
      setIsEditingName(false);
      return;
    }
    try {
      setIsSaving(true);
      const updated = await api.updateFile(detailFile.id, { name: editedName.trim() });
      setDetailFile(updated);
      setIsEditingName(false);
      notify('Nome do arquivo atualizado', 'success');
    } catch {
      notify('Erro ao renomear arquivo', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFavorite = async () => {
    try {
      const updated = await api.updateFile(detailFile.id, { isFavorite: !detailFile.isFavorite });
      setDetailFile(updated);
      notify(updated.isFavorite ? 'Arquivo marcado como favorito' : 'Removido dos favoritos', 'info');
    } catch {
      notify('Erro ao atualizar favorito', 'error');
    }
  };

  const handleOpenMedia = () => {
    if (detailFile.type === 'photo') {
      setLightboxFile(detailFile);
    } else if (detailFile.type === 'video') {
      setVideoPlayerFile(detailFile);
    } else if (detailFile.type === 'audio') {
      setAudioPlayerFile(detailFile);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-neutral-100 animate-in fade-in zoom-in-95 duration-200 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              {getMediaCategoryLabel(detailFile.type)} Original
            </span>
          </div>
          <button
            onClick={() => setDetailFile(null)}
            className="p-1.5 text-neutral-400 hover:text-neutral-100 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Preview banner */}
          {previewUrl ? (
            <div
              onClick={handleOpenMedia}
              className="relative w-full h-56 bg-black rounded-xl overflow-hidden cursor-pointer group border border-neutral-800 flex items-center justify-center"
            >
              <img
                src={previewUrl}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-102"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="px-3 py-1.5 rounded-lg bg-black/70 text-neutral-200 text-xs font-medium">
                  Clique para ampliar / reproduzir
                </span>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-neutral-800/40 border border-neutral-800 flex flex-col items-center justify-center">
              <HardDrive className="w-12 h-12 text-neutral-500 mb-2" />
              <p className="text-neutral-400 text-xs font-mono">
                {detailFile.originalName} ({detailFile.extension.toUpperCase()})
              </p>
            </div>
          )}

          {/* Editable File Name */}
          <div>
            <label className="text-neutral-400 text-[11px] font-medium block mb-1">Nome do arquivo:</label>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-neutral-200 focus:outline-none focus:border-amber-500 font-medium"
                />
                <button
                  onClick={handleSaveName}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold rounded-lg"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-800/60 border border-neutral-700/60">
                <span className="font-semibold text-neutral-200 break-all">{detailFile.name}</span>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="text-amber-400 hover:underline text-[11px] ml-2 shrink-0"
                >
                  Renomear
                </button>
              </div>
            )}
          </div>

          {/* Technical Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-2.5 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Tamanho</span>
              <span className="font-semibold font-mono-numbers text-neutral-200 text-xs">
                {formatBytes(detailFile.size)}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Formato / MIME</span>
              <span className="font-semibold text-neutral-200 text-xs truncate block" title={detailFile.mimeType}>
                {detailFile.extension.toUpperCase()} · {detailFile.mimeType.split('/')[1] || detailFile.mimeType}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Resolução / Tempo</span>
              <span className="font-semibold font-mono-numbers text-neutral-200 text-xs">
                {detailFile.resolution || detailFile.duration || 'N/A'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Enviado por</span>
              <span className="font-semibold text-neutral-200 text-xs truncate block">
                {detailFile.userName}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Data de gravação</span>
              <span className="font-semibold font-mono-numbers text-neutral-200 text-xs">
                {formatDateTime(detailFile.createdAt)}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-800/50 border border-neutral-700/50">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Compressão</span>
              <span className="font-semibold text-emerald-400 text-xs">
                Original Preservado
              </span>
            </div>
          </div>

          {/* Camera / Production EXIF (if available) */}
          {detailFile.metadata && Object.keys(detailFile.metadata).length > 0 && (
            <div className="p-3 rounded-lg bg-neutral-800/40 border border-neutral-700/50">
              <div className="flex items-center gap-1.5 text-neutral-300 font-semibold mb-2">
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>Dados de Produção & Equipamento</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-300">
                {Object.entries(detailFile.metadata).map(([key, val]) => (
                  <div key={key}>
                    <span className="text-neutral-500 capitalize">{key}: </span>
                    <span className="font-mono-numbers">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hierarchy location */}
          <div className="space-y-1.5 text-neutral-300">
            <div className="flex items-center gap-2">
              <FolderIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Pasta: </span>
              <span className="text-neutral-100 font-medium">
                {currentFolder ? currentFolder.name : 'Raiz'}
              </span>
            </div>
            {currentEvent && (
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Evento vinculado: </span>
                <span className="text-neutral-100 font-medium">{currentEvent.name}</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {detailFile.tags && detailFile.tags.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-neutral-400 mb-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>Tags associadas:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detailFile.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 text-[11px]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-800 bg-neutral-900/80">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-lg border transition-colors ${
                detailFile.isFavorite
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200'
              }`}
              title={detailFile.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
            >
              <Star className={`w-4 h-4 ${detailFile.isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Compartilhar</span>
            </button>
          </div>

          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold transition-all shadow-md active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Original ({formatBytes(detailFile.size)})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
