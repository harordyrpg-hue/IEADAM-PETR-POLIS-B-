import React, { useState, useMemo } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Folder as FolderIcon,
  Search,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Palette,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Archive,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { FileRecord, Folder } from '../../types.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const TrashView: React.FC = () => {
  const {
    notify,
    refreshStats,
    allFiles,
    filesLoading,
    folders,
    refreshFolders,
  } = useApp();

  const [filterType, setFilterType] = useState<'all' | 'folders' | 'files'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);

  // 1. Trashed Folders
  const trashedFolders = useMemo(() => {
    return folders
      .filter((f) => f.inTrash === true)
      .sort(
        (a, b) =>
          new Date(b.trashedAt || b.updatedAt || 0).getTime() -
          new Date(a.trashedAt || a.updatedAt || 0).getTime()
      );
  }, [folders]);

  const trashedFolderIdSet = useMemo(
    () => new Set(trashedFolders.map((f) => f.id)),
    [trashedFolders]
  );

  // 2. Trashed Files (explicitly marked inTrash OR belonging to a trashed folder)
  const trashedFiles = useMemo(() => {
    return allFiles
      .filter((f) => f.inTrash === true || (f.folderId && trashedFolderIdSet.has(f.folderId)))
      .sort(
        (a, b) =>
          new Date(b.trashedAt || b.updatedAt || 0).getTime() -
          new Date(a.trashedAt || a.updatedAt || 0).getTime()
      );
  }, [allFiles, trashedFolderIdSet]);

  // Compute total occupied bytes
  const totalTrashBytes = useMemo(() => {
    return trashedFiles.reduce((acc, f) => acc + (f.size || 0), 0);
  }, [trashedFiles]);

  // Map folderId to files for folder previews
  const filesByFolder = useMemo(() => {
    const map = new Map<string, FileRecord[]>();
    for (const f of allFiles) {
      if (f.folderId) {
        if (!map.has(f.folderId)) map.set(f.folderId, []);
        map.get(f.folderId)!.push(f);
      }
    }
    return map;
  }, [allFiles]);

  // Filtered lists by search
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return trashedFolders;
    const q = searchQuery.toLowerCase();
    return trashedFolders.filter((f) => f.name.toLowerCase().includes(q));
  }, [trashedFolders, searchQuery]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return trashedFiles;
    const q = searchQuery.toLowerCase();
    return trashedFiles.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.userName && f.userName.toLowerCase().includes(q))
    );
  }, [trashedFiles, searchQuery]);

  const totalItemCount = trashedFolders.length + trashedFiles.length;

  // Restore a single folder and its files
  const handleRestoreFolder = async (folder: Folder) => {
    try {
      setActionInProgress(true);
      await api.restoreFolder(folder.id);
      notify(`Pasta "${folder.name}" e seus arquivos foram restaurados com sucesso!`, 'success');
      await refreshFolders();
      refreshStats();
    } catch {
      notify('Erro ao restaurar pasta', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Permanently delete a folder and its files
  const handlePermanentDeleteFolder = async (folder: Folder) => {
    const folderFiles = filesByFolder.get(folder.id) || [];
    const confirmMsg = `Tem certeza? A pasta "${folder.name}" e todos os ${folderFiles.length} arquivos contidos nela serão EXCLUÍDOS DEFINITIVAMENTE do disco e não poderão ser recuperados.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setActionInProgress(true);
      await api.deleteFolder(folder.id, true);
      notify(`Pasta "${folder.name}" excluída definitivamente.`, 'info');
      await refreshFolders();
      refreshStats();
    } catch {
      notify('Erro ao excluir pasta definitivamente', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Restore a single file
  const handleRestoreFile = async (file: FileRecord) => {
    try {
      setActionInProgress(true);
      await api.restoreFile(file.id);
      notify(`Arquivo "${file.name}" restaurado com sucesso!`, 'success');
      await refreshFolders();
      refreshStats();
    } catch {
      notify('Erro ao restaurar arquivo', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Permanently delete a single file
  const handlePermanentDeleteFile = async (file: FileRecord) => {
    if (!window.confirm(`Tem certeza? O arquivo "${file.name}" será excluído permanentemente do Cloud Storage e Firestore.`)) return;

    try {
      setActionInProgress(true);
      await api.trashFile(file.id, true);
      notify(`Arquivo "${file.name}" excluído definitivamente.`, 'info');
      refreshStats();
    } catch {
      notify('Erro ao excluir arquivo permanentemente', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Restore everything (all folders & all files)
  const handleRestoreAll = async () => {
    if (totalItemCount === 0) return;
    if (!window.confirm(`Restaurar todas as ${trashedFolders.length} pastas e todos os ${trashedFiles.length} arquivos da Lixeira de volta aos seus locais originais?`)) return;

    try {
      setActionInProgress(true);
      // 1. Restore all folders
      for (const folder of trashedFolders) {
        await api.restoreFolder(folder.id);
      }
      // 2. Restore all standalone files
      for (const file of trashedFiles) {
        await api.restoreFile(file.id);
      }
      notify('Todos os itens da Lixeira foram restaurados com sucesso!', 'success');
      await refreshFolders();
      refreshStats();
    } catch {
      notify('Erro ao restaurar itens da lixeira', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Empty entire trash (permanent delete)
  const handleEmptyTrash = async () => {
    if (totalItemCount === 0) return;
    if (!window.confirm(`ATENÇÃO: Você está prestes a EXCLUIR DEFINITIVAMENTE todas as ${trashedFolders.length} pastas e todos os ${trashedFiles.length} arquivos da lixeira.\n\nEsta operação é IRREVERSÍVEL. Deseja continuar?`)) return;

    try {
      setActionInProgress(true);
      // 1. Permanently delete all trashed folders
      for (const folder of trashedFolders) {
        await api.deleteFolder(folder.id, true);
      }
      // 2. Permanently delete any remaining trashed files
      const remainingFileIds = trashedFiles.map((f) => f.id);
      if (remainingFileIds.length > 0) {
        await api.batchFiles('delete_permanent', remainingFileIds);
      }
      notify('Lixeira esvaziada completamente.', 'info');
      await refreshFolders();
      refreshStats();
    } catch {
      notify('Erro ao esvaziar lixeira', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'photo':
        return <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'video':
        return <Film className="w-4 h-4 text-blue-400 shrink-0" />;
      case 'art':
        return <Palette className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'audio':
        return <Music className="w-4 h-4 text-purple-400 shrink-0" />;
      case 'document':
        return <FileText className="w-4 h-4 text-rose-400 shrink-0" />;
      default:
        return <Archive className="w-4 h-4 text-neutral-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Summary Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight">
                Lixeira do Sistema
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-800 border border-neutral-700 text-neutral-300">
                {trashedFolders.length} pastas · {trashedFiles.length} arquivos ({formatBytes(totalTrashBytes)})
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Pastas e arquivos excluídos permanecem salvos com segurança aqui. Você pode restaurá-los aos seus locais originais a qualquer momento ou excluí-los em definitivo.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        {totalItemCount > 0 && (
          <div className="flex items-center gap-2 self-start md:self-center flex-wrap shrink-0">
            <button
              onClick={handleRestoreAll}
              disabled={actionInProgress}
              className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Restaurar todas as pastas e arquivos de volta"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Tudo</span>
            </button>

            <button
              onClick={handleEmptyTrash}
              disabled={actionInProgress}
              className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Excluir permanentemente todos os itens da lixeira"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Esvaziar Lixeira</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-xl w-fit">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filterType === 'all'
                ? 'bg-amber-400 text-neutral-950 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Todos ({totalItemCount})
          </button>
          <button
            onClick={() => setFilterType('folders')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterType === 'folders'
                ? 'bg-amber-400 text-neutral-950 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FolderIcon className="w-3.5 h-3.5" />
            <span>Pastas ({trashedFolders.length})</span>
          </button>
          <button
            onClick={() => setFilterType('files')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterType === 'files'
                ? 'bg-amber-400 text-neutral-950 shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Arquivos ({trashedFiles.length})</span>
          </button>
        </div>

        {/* Search inside trash */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar na lixeira..."
            className="w-full pl-9 pr-7 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. Content Area */}
      {filesLoading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">
          Carregando itens da lixeira...
        </div>
      ) : totalItemCount === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center mx-auto text-neutral-400">
            <Trash2 className="w-6 h-6" />
          </div>
          <p className="font-semibold text-neutral-300 text-sm">A Lixeira está vazia</p>
          <p className="text-neutral-400 max-w-sm mx-auto">
            Nenhum arquivo ou pasta foi excluído. Se você apagar algum item acidentalmente, ele ficará disponível aqui para restauração imediata.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION A: PASTAS NA LIXEIRA */}
          {(filterType === 'all' || filterType === 'folders') && filteredFolders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                  <FolderIcon className="w-4 h-4 text-amber-400" />
                  <span>Pastas Excluídas ({filteredFolders.length})</span>
                </h2>
                <span className="text-xs text-neutral-400">
                  Ao restaurar uma pasta, todos os seus arquivos retornam juntos
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredFolders.map((folder) => {
                  const folderFiles = filesByFolder.get(folder.id) || [];
                  const folderSize = folderFiles.reduce((acc, f) => acc + (f.size || 0), 0);
                  const isExpanded = expandedFolderId === folder.id;

                  return (
                    <div
                      key={folder.id}
                      className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 transition-all flex flex-col justify-between space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className="p-2.5 rounded-xl border flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${folder.color || '#D97706'}18`,
                              borderColor: `${folder.color || '#D97706'}40`,
                              color: folder.color || '#D97706',
                            }}
                          >
                            <FolderIcon className="w-5 h-5 fill-current" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-neutral-100 truncate">
                              {folder.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400 font-mono-numbers flex-wrap">
                              <span>{folderFiles.length} {folderFiles.length === 1 ? 'arquivo' : 'arquivos'}</span>
                              <span>·</span>
                              <span>{formatBytes(folderSize)}</span>
                              <span>·</span>
                              <span className="text-neutral-400">
                                {folder.trashedAt ? `Excluída em ${formatDate(folder.trashedAt)}` : 'Excluída recentemente'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Expand files inside button */}
                        {folderFiles.length > 0 && (
                          <button
                            onClick={() => setExpandedFolderId(isExpanded ? null : folder.id)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                            title={isExpanded ? 'Ocultar arquivos' : 'Ver arquivos desta pasta'}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                      {/* Expanded list of files inside this trashed folder */}
                      {isExpanded && folderFiles.length > 0 && (
                        <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-xl space-y-2 text-xs">
                          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                            Arquivos contidos nesta pasta ({folderFiles.length}):
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                            {folderFiles.map((file) => (
                              <div
                                key={file.id}
                                className="flex items-center justify-between p-1.5 bg-neutral-900/80 rounded-lg border border-neutral-800/60"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {getFileIcon(file.type)}
                                  <span className="text-neutral-300 truncate">{file.name}</span>
                                </div>
                                <span className="text-neutral-400 font-mono-numbers text-[10px] shrink-0 ml-2">
                                  {formatBytes(file.size)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Folder action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800/80">
                        <button
                          onClick={() => handleRestoreFolder(folder)}
                          disabled={actionInProgress}
                          className="px-3 py-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          title="Restaurar esta pasta e todos os seus arquivos"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Restaurar Pasta</span>
                        </button>

                        <button
                          onClick={() => handlePermanentDeleteFolder(folder)}
                          disabled={actionInProgress}
                          className="px-2.5 py-1.5 bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-red-400 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          title="Excluir definitivamente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir Definitivamente</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION B: ARQUIVOS NA LIXEIRA */}
          {(filterType === 'all' || filterType === 'files') && filteredFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Arquivos Excluídos ({filteredFiles.length})</span>
                </h2>
                <span className="text-xs text-neutral-400 font-mono-numbers">
                  Total: {formatBytes(totalTrashBytes)}
                </span>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-950/60">
                      <th className="px-4 py-3">Arquivo</th>
                      <th className="px-4 py-3">Pasta de Origem</th>
                      <th className="px-4 py-3">Tamanho</th>
                      <th className="px-4 py-3">Enviado por</th>
                      <th className="px-4 py-3">Excluído em</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.map((file) => {
                      const parentFolder = file.folderId
                        ? folders.find((f) => f.id === file.folderId)
                        : null;

                      return (
                        <tr
                          key={file.id}
                          className="border-b border-neutral-800/60 hover:bg-neutral-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-neutral-200">
                            <div className="flex items-center gap-2.5 min-w-0 max-w-xs sm:max-w-md">
                              {getFileIcon(file.type)}
                              <span className="truncate" title={file.name}>
                                {file.name}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-neutral-400">
                            {parentFolder ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 text-[11px] border border-neutral-700/60">
                                <FolderIcon className="w-3 h-3 text-amber-400" />
                                <span className="truncate max-w-[120px]">{parentFolder.name}</span>
                                {parentFolder.inTrash && (
                                  <span className="text-[9px] text-red-400 bg-red-500/10 px-1 rounded">
                                    na lixeira
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-neutral-400 text-[11px] italic">Raiz (Sem pasta)</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-neutral-300 font-mono-numbers">
                            {formatBytes(file.size)}
                          </td>

                          <td className="px-4 py-3 text-neutral-400">
                            {file.userName || file.ownerName || 'Membro'}
                          </td>

                          <td className="px-4 py-3 text-neutral-400 font-mono-numbers">
                            {file.trashedAt ? formatDate(file.trashedAt) : 'Recentemente'}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleRestoreFile(file)}
                                disabled={actionInProgress}
                                className="px-2.5 py-1 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 rounded-lg flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                                title="Restaurar arquivo para a pasta original"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Restaurar</span>
                              </button>

                              <button
                                onClick={() => handlePermanentDeleteFile(file)}
                                disabled={actionInProgress}
                                className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                title="Excluir definitivamente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No results for current filter */}
          {((filterType === 'folders' && filteredFolders.length === 0) ||
            (filterType === 'files' && filteredFiles.length === 0) ||
            (searchQuery && filteredFolders.length === 0 && filteredFiles.length === 0)) && (
            <div className="p-8 text-center rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs">
              Nenhum item encontrado para o filtro ou pesquisa informada.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
