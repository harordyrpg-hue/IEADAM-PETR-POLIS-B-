import React, { useState } from 'react';
import {
  Download,
  FolderInput,
  Star,
  Trash2,
  X,
  Archive,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { api } from '../../services/api.js';

interface BatchActionBarProps {
  onSuccess: () => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({ onSuccess }) => {
  const {
    selectedFileIds,
    clearFileSelection,
    folders,
    notify,
  } = useApp();

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetFolderId, setTargetFolderId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (selectedFileIds.length === 0) return null;

  const count = selectedFileIds.length;

  const handleDownloadZip = async () => {
    try {
      setIsProcessing(true);
      notify(`Preparando arquivo ZIP com ${count} arquivos selecionados...`, 'info');
      await api.downloadMultipleZip(selectedFileIds, `PTB_Midia_${count}_arquivos`);
      notify('Download em ZIP concluído!', 'success');
      clearFileSelection();
    } catch {
      notify('Erro ao gerar arquivo compactado', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchFavorite = async () => {
    try {
      setIsProcessing(true);
      await api.batchFiles('favorite', selectedFileIds);
      notify(`${count} arquivos favoritados`, 'success');
      clearFileSelection();
      onSuccess();
    } catch {
      notify('Erro ao favoritar arquivos', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchTrash = async () => {
    try {
      setIsProcessing(true);
      await api.batchFiles('trash', selectedFileIds);
      notify(`${count} arquivos movidos para a Lixeira`, 'info');
      clearFileSelection();
      onSuccess();
    } catch {
      notify('Erro ao mover arquivos para a lixeira', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchMove = async () => {
    try {
      setIsProcessing(true);
      await api.batchFiles('move', selectedFileIds, targetFolderId || undefined);
      notify(`${count} arquivos movidos com sucesso`, 'success');
      setShowMoveModal(false);
      clearFileSelection();
      onSuccess();
    } catch {
      notify('Erro ao mover arquivos', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/95 dark:bg-neutral-950/95 border border-neutral-700/80 shadow-2xl rounded-2xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md text-neutral-100 text-xs animate-in slide-in-from-bottom-3 duration-200">
        <div className="flex items-center gap-2 pr-3 border-r border-neutral-700/80">
          <span className="font-semibold text-amber-400 font-mono-numbers">{count}</span>
          <span className="text-neutral-300">selecionado{count > 1 ? 's' : ''}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDownloadZip}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium transition-colors disabled:opacity-50"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Baixar em ZIP</span>
          </button>

          <button
            onClick={() => setShowMoveModal(true)}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors"
          >
            <FolderInput className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mover</span>
          </button>

          <button
            onClick={handleBatchFavorite}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors"
          >
            <Star className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Favoritar</span>
          </button>

          <button
            onClick={handleBatchTrash}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-200 hover:text-red-400 font-medium transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excluir</span>
          </button>
        </div>

        <button
          onClick={clearFileSelection}
          className="p-1 text-neutral-400 hover:text-neutral-100 rounded-lg hover:bg-neutral-800 transition-colors ml-1"
          title="Cancelar seleção"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Move Destination Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-2xl p-5 shadow-2xl text-neutral-100 text-xs">
            <h3 className="text-sm font-semibold mb-3">Mover {count} arquivos para:</h3>

            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 mb-4 text-neutral-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">Raiz (Sem pasta)</option>
              {folders.filter((f) => !f.inTrash).map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowMoveModal(false)}
                className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleBatchMove}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold"
              >
                Mover agora
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
