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
      <div className="pb-3 border-b border-neutral-800">
        <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          Arquivos Favoritos
        </h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          Acesso prioritário às mídias mais importantes marcadas com estrela pela equipe.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">Carregando favoritos...</div>
      ) : files.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs">
          Nenhum arquivo favoritado ainda. Clique na estrela de qualquer foto, vídeo ou arte para adicioná-lo aqui.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-950/40">
                <th className="w-10 px-3 py-2.5 text-center"></th>
                <th className="px-3 py-2.5">Nome</th>
                <th className="px-3 py-2.5 hidden sm:table-cell">Categoria</th>
                <th className="px-3 py-2.5 text-right">Tamanho</th>
                <th className="px-3 py-2.5 hidden md:table-cell">Resolução</th>
                <th className="px-3 py-2.5 hidden lg:table-cell">Responsável</th>
                <th className="px-3 py-2.5 hidden md:table-cell">Data</th>
                <th className="px-3 py-2.5 text-right">Ações</th>
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
      )}
    </div>
  );
};
