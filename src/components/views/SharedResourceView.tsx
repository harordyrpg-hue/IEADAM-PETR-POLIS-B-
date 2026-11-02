import React, { useState, useEffect } from 'react';
import {
  Download,
  Share2,
  Calendar,
  Folder as FolderIcon,
  File as FileIcon,
  CheckCircle2,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import { ShareLink, FileRecord } from '../../types.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

interface SharedResourceViewProps {
  token: string;
  onExit: () => void;
}

export const SharedResourceView: React.FC<SharedResourceViewProps> = ({ token, onExit }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ share: ShareLink; resource: any } | null>(null);

  useEffect(() => {
    const loadShare = async () => {
      try {
        setLoading(true);
        const res = await api.getSharedResource(token);
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Link inválido ou expirado.');
      } finally {
        setLoading(false);
      }
    };
    loadShare();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400 text-xs">
        Carregando recurso compartilhado...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-950 text-neutral-100 text-center">
        <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 max-w-md w-full space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-neutral-100">Acesso Indisponível</h2>
          <p className="text-xs text-neutral-400">{error || 'Não foi possível encontrar este arquivo compartilhado.'}</p>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium"
          >
            Ir para a Central
          </button>
        </div>
      </div>
    );
  }

  const { share, resource } = data;

  const handleDownload = () => {
    if (share.resourceType === 'file') {
      api.triggerDownload(`/api/files/${resource.id}/download`);
    } else if (share.resourceType === 'folder') {
      api.triggerDownload(`/api/folders/${resource.folder.id}/download`);
    } else if (share.resourceType === 'event') {
      api.triggerDownload(`/api/events/${resource.event.id}/download`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="h-16 px-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 font-bold text-sm tracking-wider border border-amber-500/30">
            PTB
          </div>
          <div>
            <h1 className="text-sm font-semibold">PT-B Mídia</h1>
            <p className="text-[10px] text-neutral-400">Portal de Compartilhamento Seguro</p>
          </div>
        </div>

        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao painel</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-6">
        <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              Recurso Compartilhado ({share.resourceType})
            </span>
            <h2 className="text-xl font-bold text-neutral-100">{share.resourceName}</h2>
            <p className="text-xs text-neutral-400">
              Compartilhado por {share.createdByName} em {formatDate(share.createdAt)}
            </p>
          </div>

          {share.allowDownload && (
            <button
              onClick={handleDownload}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Arquivo Original</span>
            </button>
          )}
        </div>

        {/* Resource Preview depending on type */}
        {share.resourceType === 'file' && resource && (
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
            {resource.thumbnailUrl && (
              <div className="w-full h-80 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={resource.thumbnailUrl}
                  alt={resource.name}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-800">
              <span>Tamanho: {formatBytes(resource.size)}</span>
              <span>Resolução: {resource.resolution || 'Original'}</span>
              <span>Formato: {resource.extension.toUpperCase()}</span>
            </div>
          </div>
        )}

        {share.resourceType === 'event' && resource && (
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
            <h3 className="font-semibold text-sm">Arquivos incluídos neste evento:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {resource.files?.map((f: FileRecord) => (
                <div key={f.id} className="p-3 rounded-lg bg-neutral-800/60 border border-neutral-700/60 flex items-center justify-between">
                  <span className="truncate font-medium">{f.name}</span>
                  <span className="text-neutral-400 font-mono-numbers shrink-0 ml-2">{formatBytes(f.size)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
