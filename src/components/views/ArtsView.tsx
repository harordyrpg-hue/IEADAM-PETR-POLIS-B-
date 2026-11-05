import React, { useMemo } from 'react';
import {
  Palette,
  Upload,
  Download,
  Share2,
  Maximize2,
  Tag,
  Star,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { FileRecord } from '../../types.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const ArtsView: React.FC = () => {
  const {
    openUpload,
    setLightboxFile,
    setDetailFile,
    setShareTarget,
    searchQuery,
    notify,
    allFiles,
    filesLoading,
  } = useApp();

  const loading = filesLoading;

  const arts = useMemo(() => {
    let list = allFiles.filter((f) => !f.inTrash && f.type === 'art');
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

  const handleDownload = (e: React.MouseEvent, art: FileRecord) => {
    e.stopPropagation();
    api.triggerDownload(art.downloadUrl, art.name);
    notify(`Iniciando download da arte original em 300 DPI / vetor (${formatBytes(art.size)})`, 'info');
  };

  const handleShare = (e: React.MouseEvent, art: FileRecord) => {
    e.stopPropagation();
    setShareTarget({ type: 'file', id: art.id, name: art.name });
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-400" />
            Artes Gráficas & Material de Divulgação
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Banners, posts para feed, stories (9:16), cartazes de eventos, convites e identidades visuais em alta resolução para impressão e mídias sociais.
          </p>
        </div>

        <button
          onClick={() => openUpload()}
          className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-sm transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>Enviar artes</span>
        </button>
      </div>

      {/* Grid of Graphic Arts */}
      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">Carregando acervo de artes...</div>
      ) : arts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800">
          <Palette className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-200">Nenhuma arte gráfica encontrada</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            Envie arquivos em PNG transparente, PSD, AI, ou JPG em 300 DPI para impressão.
          </p>
          <button
            onClick={() => openUpload()}
            className="mt-4 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs"
          >
            Fazer upload de arte
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {arts.map((art) => (
            <div
              key={art.id}
              onClick={() => setLightboxFile(art)}
              className="group rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-all flex flex-col justify-between"
            >
              {/* Graphic Art Preview */}
              <div className="relative aspect-4/3 w-full overflow-hidden bg-black/60">
                <img
                  src={art.thumbnailUrl || '/src/assets/images/church_conference_banner_1790831734307.jpg'}
                  alt={art.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Badges */}
                <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 text-[10px] text-purple-300 font-mono uppercase">
                  .{art.extension}
                </span>

                {art.resolution && (
                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-[10px] text-neutral-200 font-mono-numbers">
                    {art.resolution}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <h3
                  title={art.name}
                  className="font-semibold text-neutral-200 text-xs truncate group-hover:text-amber-300 transition-colors"
                >
                  {art.name}
                </h3>

                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono-numbers mt-1 truncate">
                  <span>{formatBytes(art.size)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(art.createdAt)}</span>
                </div>

                <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between text-neutral-400">
                  <button
                    onClick={(e) => handleShare(e, art)}
                    className="p-1 hover:text-white rounded"
                    title="Compartilhar"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleDownload(e, art)}
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium"
                    title="Baixar arte original em alta resolução"
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
