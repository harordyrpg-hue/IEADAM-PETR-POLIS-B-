import React, { useState, useRef, useCallback } from 'react';
import {
  X,
  Upload,
  File as FileIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Folder as FolderIcon,
  Calendar,
  Tag,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { api } from '../../services/api.js';
import { formatBytes } from '../../utils/formatters.js';
import { UploadQueueItem } from '../../types.js';

export const UploadModal: React.FC = () => {
  const {
    isUploadOpen,
    closeUpload,
    uploadFolderId,
    uploadEventId,
    folders,
    events,
    refreshStats,
    notify,
  } = useApp();

  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(uploadFolderId);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(uploadEventId);
  const [customTags, setCustomTags] = useState<string[]>(['culto', '2026']);
  const [tagInput, setTagInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when opened with prefill
  React.useEffect(() => {
    if (isUploadOpen) {
      setSelectedFolder(uploadFolderId);
      setSelectedEvent(uploadEventId);
    }
  }, [isUploadOpen, uploadFolderId, uploadEventId]);

  if (!isUploadOpen) return null;

  const handleAddFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: UploadQueueItem[] = Array.from(files).map((f) => ({
      id: `up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file: f,
      progress: 0,
      status: 'waiting',
      folderId: selectedFolder,
      eventId: selectedEvent,
      tags: [...customTags],
    }));

    setQueue((prev) => [...prev, ...newItems]);
    // Automatically start processing queue
    setTimeout(() => {
      processQueue([...queue, ...newItems]);
    }, 100);
  };

  const processQueue = async (currentQueue: UploadQueueItem[]) => {
    const waitingItem = currentQueue.find((item) => item.status === 'waiting');
    if (!waitingItem) return;

    // Set to uploading
    setQueue((prev) =>
      prev.map((it) => (it.id === waitingItem.id ? { ...it, status: 'uploading', progress: 0 } : it))
    );

    try {
      await api.uploadFile(
        waitingItem.file,
        {
          folderId: waitingItem.folderId,
          eventId: waitingItem.eventId,
          tags: waitingItem.tags,
        },
        (progress, speed) => {
          setQueue((prev) =>
            prev.map((it) =>
              it.id === waitingItem.id
                ? {
                    ...it,
                    progress,
                    speed,
                    status: progress === 100 ? 'processing' : 'uploading',
                  }
                : it
            )
          );
        }
      );

      // Successfully stored original
      setQueue((prev) =>
        prev.map((it) => (it.id === waitingItem.id ? { ...it, status: 'completed', progress: 100 } : it))
      );

      await refreshStats();

      // Process next item in queue
      setQueue((freshQueue) => {
        setTimeout(() => processQueue(freshQueue), 100);
        return freshQueue;
      });
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((it) =>
          it.id === waitingItem.id
            ? { ...it, status: 'error', error: err.message || 'Erro no upload' }
            : it
        )
      );

      // Continue with other items
      setQueue((freshQueue) => {
        setTimeout(() => processQueue(freshQueue), 100);
        return freshQueue;
      });
    }
  };

  const retryUpload = (itemId: string) => {
    setQueue((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, status: 'waiting', progress: 0, error: undefined } : it))
    );
    setTimeout(() => {
      processQueue(queue);
    }, 50);
  };

  const removeQueueItem = (itemId: string) => {
    setQueue((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleAddTag = () => {
    const clean = tagInput.trim().toLowerCase();
    if (clean && !customTags.includes(clean)) {
      setCustomTags([...customTags, clean]);
      setTagInput('');
    }
  };

  const removeTag = (t: string) => {
    setCustomTags(customTags.filter((tag) => tag !== t));
  };

  // Drag and drop handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleAddFiles(e.dataTransfer.files);
  };

  const hasCompleted = queue.some((i) => i.status === 'completed');
  const isUploadingAny = queue.some((i) => i.status === 'uploading' || i.status === 'processing');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-neutral-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/60">
          <div>
            <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" />
              Upload de Arquivos Originais
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Preservação de qualidade 100% original sem compressão (fotos, vídeos 4K, artes, áudios).
            </p>
          </div>
          <button
            onClick={closeUpload}
            className="p-1.5 text-neutral-400 hover:text-neutral-100 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Target Location Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Folder Select */}
            <div>
              <label className="block text-neutral-300 font-medium mb-1.5 flex items-center gap-1.5">
                <FolderIcon className="w-3.5 h-3.5 text-amber-400" />
                Destino (Pasta):
              </label>
              <select
                value={selectedFolder || ''}
                onChange={(e) => setSelectedFolder(e.target.value || null)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Raiz (Sem pasta)</option>
                {folders.filter((f) => !f.inTrash).map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Event Link */}
            <div>
              <label className="block text-neutral-300 font-medium mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Vincular ao Evento:
              </label>
              <select
                value={selectedEvent || ''}
                onChange={(e) => setSelectedEvent(e.target.value || null)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Nenhum evento</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    📅 {e.name} ({e.date})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags Configuration */}
          <div>
            <label className="block text-neutral-300 text-xs font-medium mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              Tags do Arquivo:
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {customTags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 text-[11px] bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded text-neutral-300"
                >
                  #{t}
                  <button onClick={() => removeTag(t)} className="text-neutral-400 hover:text-neutral-200">
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Adicionar tag (ex: culto, batismo, pregacao)..."
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 text-xs bg-neutral-700 hover:bg-neutral-600 rounded-lg font-medium text-neutral-200 transition-colors"
              >
                Adicionar
              </button>
            </div>
          </div>

          {/* Dropzone Area */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-amber-400 bg-amber-500/10'
                : 'border-neutral-700/80 hover:border-amber-500/50 bg-neutral-800/40 hover:bg-neutral-800/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleAddFiles(e.target.files)}
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mb-1">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-neutral-200">
                Arraste seus arquivos aqui ou clique para selecionar
              </p>
              <p className="text-xs text-neutral-400">
                Suporte para fotos RAW/JPG/PNG, vídeos ProRes/4K/MP4, áudios multitrack WAV, PDFs e documentos.
              </p>
            </div>
          </div>

          {/* Upload Queue List */}
          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800 pb-1">
                <span>Fila de Transferência ({queue.length})</span>
                {hasCompleted && (
                  <button
                    onClick={() => setQueue(queue.filter((i) => i.status !== 'completed'))}
                    className="text-amber-400 hover:underline text-[11px]"
                  >
                    Limpar concluídos
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-neutral-800/70 border border-neutral-700/70 text-xs flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileIcon className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span className="font-medium text-neutral-200 truncate">{item.file.name}</span>
                        <span className="text-[11px] text-neutral-400 font-mono-numbers shrink-0">
                          ({formatBytes(item.file.size)})
                        </span>
                      </div>

                      {/* Status indicator */}
                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'waiting' && (
                          <span className="text-neutral-400">Aguardando...</span>
                        )}
                        {item.status === 'uploading' && (
                          <span className="text-amber-400 font-mono-numbers">
                            {item.progress}% {item.speed ? `· ${item.speed}` : ''}
                          </span>
                        )}
                        {item.status === 'processing' && (
                          <span className="text-amber-300 animate-pulse">Gravando original...</span>
                        )}
                        {item.status === 'completed' && (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
                          </span>
                        )}
                        {item.status === 'error' && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-red-400 flex items-center gap-1" title={item.error}>
                              <AlertCircle className="w-3.5 h-3.5" /> Falha
                            </span>
                            <button
                              onClick={() => retryUpload(item.id)}
                              className="text-amber-400 hover:text-amber-300 underline font-medium"
                            >
                              Tentar novamente
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => removeQueueItem(item.id)}
                          className="text-neutral-400 hover:text-neutral-200 ml-1 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar for active item */}
                    {item.status === 'uploading' && (
                      <div className="w-full h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 transition-all duration-200"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-900/60">
          <div className="text-xs text-neutral-400">
            {isUploadingAny ? 'Enviando arquivos para o servidor...' : 'Arquivos são armazenados sem compressão.'}
          </div>
          <button
            onClick={closeUpload}
            className="px-4 py-2 text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
