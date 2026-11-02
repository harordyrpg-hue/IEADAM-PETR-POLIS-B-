import React, { useMemo, useState } from 'react';
import {
  FileText,
  Upload,
  Download,
  Share2,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { FileRecord } from '../../types.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const DocumentsView: React.FC = () => {
  const {
    openUpload,
    setDetailFile,
    setShareTarget,
    searchQuery,
    notify,
    allFiles,
    filesLoading,
  } = useApp();

  const loading = filesLoading;

  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  const docs = useMemo(() => {
    let list = allFiles.filter((f) => !f.inTrash && f.type === 'document');
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

  const handleDownload = (e: React.MouseEvent, doc: FileRecord) => {
    e.stopPropagation();
    api.triggerDownload(`/api/files/${doc.id}/download`);
    notify(`Iniciando download do documento original: ${doc.name}`, 'info');
  };

  const handleShare = (e: React.MouseEvent, doc: FileRecord) => {
    e.stopPropagation();
    setShareTarget({ type: 'file', id: doc.id, name: doc.name });
  };

  const handlePreviewPdf = (doc: FileRecord) => {
    setPreviewPdfUrl(`/storage/originals/${doc.storageKey}`);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-400" />
            Manuais, Escalas & Documentos da Mídia
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manuais de operação das câmeras, escalas semanais, roteiros de transmissão e apresentações em PDF/DOCX.
          </p>
        </div>

        <button
          onClick={() => openUpload()}
          className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-sm transition-all"
        >
          <Upload className="w-4 h-4" />
          <span>Enviar documento</span>
        </button>
      </div>

      {/* Docs List */}
      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">Carregando documentos...</div>
      ) : docs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800">
          <FileText className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-200">Nenhum documento encontrado</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            Envie manuais de treinamento da equipe de mídia, escalas dos voluntários e apresentações de culto.
          </p>
          <button
            onClick={() => openUpload()}
            className="mt-4 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs"
          >
            Fazer upload de documento
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {docs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => (doc.extension === 'pdf' ? handlePreviewPdf(doc) : setDetailFile(doc))}
              className="group p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/60 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>

                <div className="min-w-0">
                  <span className="font-semibold text-neutral-200 text-xs truncate block group-hover:text-amber-300">
                    {doc.name}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono-numbers mt-0.5">
                    <span className="uppercase text-red-400 font-medium">.{doc.extension}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(doc.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(doc.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{doc.userName}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                {doc.extension === 'pdf' && (
                  <button
                    onClick={() => handlePreviewPdf(doc)}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Visualizar</span>
                  </button>
                )}

                <button
                  onClick={(e) => handleShare(e, doc)}
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Compartilhar"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                <button
                  onClick={(e) => handleDownload(e, doc)}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Download className="w-3 h-3" />
                  <span>Baixar Original</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF In-Platform Preview Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-4xl h-[85vh] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <span className="text-xs font-semibold text-neutral-200">Visualizador de Documento PDF</span>
              <button
                onClick={() => setPreviewPdfUrl(null)}
                className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs"
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 bg-neutral-950">
              <iframe src={previewPdfUrl} className="w-full h-full border-none" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
