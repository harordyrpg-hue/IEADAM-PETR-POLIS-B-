import React, { useMemo } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { FileRecord } from '../../types.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const TrashView: React.FC = () => {
  const { notify, refreshStats, allFiles, filesLoading } = useApp();
  const loading = filesLoading;

  const trashedFiles = useMemo(() => {
    return allFiles
      .filter((f) => f.inTrash)
      .sort((a, b) => new Date(b.trashedAt || b.updatedAt).getTime() - new Date(a.trashedAt || a.updatedAt).getTime());
  }, [allFiles]);

  const handleRestore = async (id: string) => {
    try {
      await api.restoreFile(id);
      notify('Arquivo restaurado com sucesso!', 'success');
      refreshStats();
    } catch {
      notify('Erro ao restaurar arquivo', 'error');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!window.confirm('Tem certeza? Este arquivo será excluído permanentemente do disco.')) return;
    try {
      await api.trashFile(id, true);
      notify('Arquivo excluído definitivamente', 'info');
      refreshStats();
    } catch {
      notify('Erro ao excluir permanentemente', 'error');
    }
  };

  const handleEmptyTrash = async () => {
    if (trashedFiles.length === 0) return;
    if (!window.confirm(`Excluir permanentemente todos os ${trashedFiles.length} arquivos da lixeira?`)) return;

    try {
      await api.batchFiles('delete_permanent', trashedFiles.map((f) => f.id));
      notify('Lixeira esvaziada com sucesso', 'info');
      refreshStats();
    } catch {
      notify('Erro ao esvaziar lixeira', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            Lixeira de Arquivos
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Arquivos removidos permanecem aqui com segurança e podem ser restaurados a qualquer momento.
          </p>
        </div>

        {trashedFiles.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Esvaziar Lixeira</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">Carregando lixeira...</div>
      ) : trashedFiles.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs">
          A lixeira está vazia. Nenhum arquivo foi excluído recentemente.
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-950/40">
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Tamanho</th>
                <th className="px-4 py-3">Enviado por</th>
                <th className="px-4 py-3">Excluído em</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {trashedFiles.map((file) => (
                <tr key={file.id} className="border-b border-neutral-800/60 hover:bg-neutral-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-neutral-200 truncate max-w-xs">
                    {file.name}
                  </td>
                  <td className="px-4 py-3 text-neutral-300 font-mono-numbers">
                    {formatBytes(file.size)}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {file.userName}
                  </td>
                  <td className="px-4 py-3 text-neutral-400 font-mono-numbers">
                    {file.trashedAt ? formatDate(file.trashedAt) : 'Recentemente'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRestore(file.id)}
                        className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1 text-[11px]"
                        title="Restaurar arquivo"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Restaurar</span>
                      </button>

                      <button
                        onClick={() => handlePermanentDelete(file.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg"
                        title="Excluir definitivamente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
