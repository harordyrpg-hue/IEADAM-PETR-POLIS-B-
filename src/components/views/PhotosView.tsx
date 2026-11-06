import React, { useMemo } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Download,
  Share2,
  Star,
  Maximize2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { FileRecord } from '../../types.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const PhotosView: React.FC = () => {
  const {
    openUpload,
    setLightboxFile,
    setDetailFile,
    setShareTarget,
    searchQuery,
    notify,
    allFiles,
    filesLoading,
    refreshStats,
  } = useApp();

  const loading = filesLoading;
  const loadPhotos = () => refreshStats();

  const photos = useMemo(() => {
    let list = allFiles.filter((f) => !f.inTrash && f.type === 'photo');
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

  const handleDownload = (e: React.MouseEvent, photo: FileRecord) => {
    e.stopPropagation();
    api.triggerDownload(photo.downloadUrl, photo.name);
    notify(`Iniciando download da foto original em resolução máxima (${photo.resolution || 'RAW/Hi-Res'})`, 'info');
  };

  const handleShare = (e: React.MouseEvent, photo: FileRecord) => {
    e.stopPropagation();
    setShareTarget({ type: 'file', id: photo.id, name: photo.name });
  };

  const handleToggleFavorite = async (e: React.MouseEvent, photo: FileRecord) => {
    e.stopPropagation();
    try {
      await api.updateFile(photo.id, { isFavorite: !photo.isFavorite });
      loadPhotos();
    } catch {
      notify('Erro ao atualizar favorito', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-amber-400" />
            Galeria de Fotos
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Preservação de qualidade fotográfica em alta resolução (6000×4000, RAW, JPG sem compressão).
          </p>
        </div>

        <button
          onClick={() => openUpload()}
          className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-sm transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>Enviar fotos</span>
        </button>
      </div>

      {/* Photos Grid */}
      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">Carregando galeria...</div>
      ) : photos.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800">
          <ImageIcon className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-200">Nenhuma foto encontrada</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            Envie as fotos dos cultos, batismos, eventos e conferências para a equipe.
          </p>
          <button
            onClick={() => openUpload()}
            className="mt-4 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs"
          >
            Fazer upload de fotos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => setLightboxFile(photo)}
              className="group relative rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-all flex flex-col justify-between"
            >
              {/* Image Container with measured overlay */}
              <div className="relative aspect-4/3 w-full overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={photo.thumbnailUrl || (photo.downloadUrl && !photo.downloadUrl.startsWith('chunked://') ? photo.downloadUrl : '/assets/images/church_conference_banner_1790831734307.jpg')}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Favorite Star */}
                <button
                  onClick={(e) => handleToggleFavorite(e, photo)}
                  className={`absolute top-2 right-2 p-1.5 rounded-md backdrop-blur-xs transition-opacity ${
                    photo.isFavorite
                      ? 'bg-amber-500/20 text-amber-400 opacity-100'
                      : 'bg-black/50 text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                  }`}
                  title={photo.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
                >
                  <Star className={`w-3.5 h-3.5 ${photo.isFavorite ? 'fill-amber-400' : ''}`} />
                </button>

                {/* Hover overlay with zoom hint */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="p-2 rounded-full bg-black/60 text-white">
                    <Maximize2 className="w-5 h-5" />
                  </div>
                </div>

                {/* Resolution Badge */}
                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-[10px] text-amber-300 font-mono-numbers">
                  {photo.resolution || '6000×4000'}
                </span>

                {/* Format Badge */}
                <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[10px] text-neutral-200 uppercase font-mono">
                  {photo.extension}
                </span>
              </div>

              {/* Photo details */}
              <div className="p-3">
                <h3
                  title={photo.name}
                  className="font-semibold text-neutral-200 text-xs truncate group-hover:text-amber-300 transition-colors"
                >
                  {photo.name}
                </h3>

                {/* Zero-Pill Unboxed Metadata */}
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono-numbers mt-1 truncate">
                  <span>{formatBytes(photo.size)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(photo.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400">Original</span>
                </div>

                {/* Actions */}
                <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between text-neutral-400">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleShare(e, photo)}
                      title="Compartilhar"
                      className="p-1 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailFile(photo);
                      }}
                      title="Detalhes"
                      className="p-1 hover:text-white hover:bg-neutral-800 rounded transition-colors text-[11px]"
                    >
                      EXIF / Info
                    </button>
                  </div>

                  <button
                    onClick={(e) => handleDownload(e, photo)}
                    title="Baixar original em alta resolução"
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium p-1 hover:bg-neutral-800 rounded transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar</span>
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
