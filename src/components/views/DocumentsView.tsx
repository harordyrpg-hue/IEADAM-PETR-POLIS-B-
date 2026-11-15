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

  const [previewDoc, setPreviewDoc] = useState<FileRecord | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
    api.triggerDownload(doc, doc.name);
    notify(`Iniciando download do documento original: ${doc.name}`, 'info');
  };

  const handleShare = (e: React.MouseEvent, doc: FileRecord) => {
    e.stopPropagation();
    setShareTarget({ type: 'file', id: doc.id, name: doc.name });
  };

  const handlePreviewPdf = async (doc: FileRecord) => {
    setPreviewDoc(doc);
    setPreviewPdfUrl(null);
    setPreviewLoading(true);
    try {
      const resolved = await api.resolveMediaUrl(doc, true);
      setPreviewPdfUrl(resolved);
    } catch {
      notify('Não foi possível abrir a pré-visualização do PDF. Use o botão Baixar.', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">
            Documentos e Manuais
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manuais, roteiros, escalas e apresentações ({docs.length} arquivos).
          </p>
        </div>

        <button
          onClick={() => openUpload()}
          className="flex items-center justify-center gap-2 px-4 min-h-[40px] bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs transition-all shrink-0 cursor-pointer"
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
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-800">
          {docs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => (doc.extension === 'pdf' ? handlePreviewPdf(doc) : setDetailFile(doc))}
              className="group p-4 hover:bg-neutral-800/40 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>

                <div className="min-w-0">
                  <span className="font-semibold text-neutral-200 text-xs sm:text-sm truncate block group-hover:text-amber-300">
                    {doc.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-400 font-mono tabular-nums mt-0.5">
                    <span className="uppercase text-red-400 font-medium">.{doc.extension}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(doc.size)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(doc.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{doc.userName}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                {doc.extension === 'pdf' && (
                  <button
                    onClick={() => handlePreviewPdf(doc)}
                    className="px-3 min-h-[36px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Visualizar</span>
                  </button>
                )}

                <button
                  onClick={(e) => handleShare(e, doc)}
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
                  title="Compartilhar"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                <button
                  onClick={(e) => handleDownload(e, doc)}
                  className="px-3 min-h-[36px] bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>Baixar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF In-Platform Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-4xl h-[85vh] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-800">
              <span className="text-xs font-semibold text-neutral-200 truncate">
                {previewDoc.name}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    api.triggerDownload(previewDoc, previewDoc.name);
                    notify(`Baixando PDF original: ${previewDoc.name}`, 'info');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewDoc(null);
                    setPreviewPdfUrl(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="flex-1 bg-neutral-950 flex items-center justify-center">
              {previewLoading ? (
                <div className="text-xs text-neutral-400">Carregando documento PDF...</div>
              ) : previewPdfUrl ? (
                <iframe src={previewPdfUrl} className="w-full h-full border-none" title="PDF Preview" />
              ) : (
                <div className="p-6 text-center space-y-3">
                  <p className="text-xs text-neutral-400">
                    Pré-visualização indisponível neste navegador. Clique abaixo para baixar o arquivo original.
                  </p>
                  <button
                    type="button"
                    onClick={() => api.triggerDownload(previewDoc, previewDoc.name)}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar PDF Original</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
