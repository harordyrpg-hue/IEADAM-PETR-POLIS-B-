import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Share2,
  Star,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { formatBytes } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const PhotoLightbox: React.FC = () => {
  const {
    lightboxFile,
    setLightboxFile,
    setDetailFile,
    setShareTarget,
    notify,
  } = useApp();

  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [lightboxFile]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxFile(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setLightboxFile]);

  if (!lightboxFile) return null;

  const handleDownload = () => {
    api.triggerDownload(lightboxFile.downloadUrl, lightboxFile.name);
    notify(`Iniciando download da foto original em resolução máxima (${lightboxFile.resolution || 'alta resolução'})`, 'info');
  };

  const handleShare = () => {
    setShareTarget({ type: 'file', id: lightboxFile.id, name: lightboxFile.name });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-200">
      {/* Top Floating Controls Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-black/60 z-10">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-semibold text-xs uppercase tracking-wider">
            Galeria Fotográfica
          </span>
          <span className="text-neutral-400 text-xs hidden sm:inline truncate max-w-sm">
            {lightboxFile.name}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-1 mr-2 text-neutral-300">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-1 hover:text-white rounded"
              title="Diminuir zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono-numbers">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-1 hover:text-white rounded"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setDetailFile(lightboxFile)}
            className="p-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Ver informações técnicas"
          >
            <Info className="w-4 h-4" />
          </button>

          <button
            onClick={handleShare}
            className="p-2 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded-lg transition-colors"
            title="Compartilhar foto"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold text-xs rounded-lg transition-all shadow-md active:scale-95"
            title="Baixar original sem compressão"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Original ({formatBytes(lightboxFile.size)})</span>
          </button>

          <button
            onClick={() => setLightboxFile(null)}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors ml-2"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
        <img
          src={lightboxFile.thumbnailUrl || `/storage/originals/${lightboxFile.storageKey}`}
          alt={lightboxFile.name}
          referrerPolicy="no-referrer"
          className="max-w-full max-h-[80vh] object-contain transition-transform duration-200 shadow-2xl rounded-md"
          style={{ transform: `scale(${zoom})` }}
        />
      </div>

      {/* Bottom Metadata & Uncompressed Assurance */}
      <div className="px-6 py-3 border-t border-neutral-800/80 bg-black/60 flex items-center justify-between text-xs text-neutral-400 z-10">
        <div className="flex items-center gap-3">
          <span className="font-medium text-neutral-200">{lightboxFile.name}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-numbers text-amber-400 font-semibold">
            {lightboxFile.resolution || '6000×4000'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-numbers">{formatBytes(lightboxFile.size)}</span>
        </div>

        <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-medium">
          <span>Arquivo Original Intacto</span>
        </div>
      </div>
    </div>
  );
};
