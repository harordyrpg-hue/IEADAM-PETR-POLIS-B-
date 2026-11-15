import React, { useMemo } from 'react';
import { Star } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { FileRecord } from '../../types.js';
import { FileCard } from '../files/FileCard.js';
import { FileListRow } from '../files/FileListRow.js';
import { api } from '../../services/api.js';

export const FavoritesView: React.FC = () => {
  const { viewMode, selectedFileIds, toggleSelectFile, searchQuery, allFiles, filesLoading, refreshStats } = useApp();
  const loading = filesLoading;
  const loadFavorites = () => refreshStats();

  const files = useMemo(() => {
    let list = allFiles.filter((f) => !f.inTrash && f.isFavorite);
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

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="pb-4 border-b border-neutral-800">
        <h1 className="text-xl font-bold text-neutral-100">
          Favoritos
        </h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          Mídias e documentos marcados para acesso rápido ({files.length} arquivos).
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">Carregando favoritos...</div>
      ) : files.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs">
          Nenhum arquivo favoritado ainda. Clique na estrela de qualquer arquivo para adicioná-lo aqui.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              isSelected={selectedFileIds.includes(file.id)}
              onSelect={toggleSelectFile}
              onRefresh={loadFavorites}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-[11px] font-medium text-neutral-400 bg-neutral-950/50">
                  <th className="w-10 px-3 py-3 text-center"></th>
                  <th className="px-3 py-3">Nome</th>
                  <th className="px-3 py-3 hidden sm:table-cell">Categoria</th>
                  <th className="px-3 py-3 text-right">Tamanho</th>
                  <th className="px-3 py-3 hidden md:table-cell">Resolução</th>
                  <th className="px-3 py-3 hidden lg:table-cell">Responsável</th>
                  <th className="px-3 py-3 hidden md:table-cell">Data</th>
                  <th className="px-3 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <FileListRow
                    key={file.id}
                    file={file}
                    isSelected={selectedFileIds.includes(file.id)}
                    onSelect={toggleSelectFile}
                    onRefresh={loadFavorites}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
