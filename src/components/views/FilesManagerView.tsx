import React, { useState, useEffect, useMemo } from 'react';
import {
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  LayoutGrid,
  List,
  ArrowUpDown,
  Download,
  Trash2,
  Edit2,
  ChevronRight,
  Home,
  Tag,
  Search,
  Upload,
  Archive,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { FileRecord, Folder } from '../../types.js';
import { FileCard } from '../files/FileCard.js';
import { FileListRow } from '../files/FileListRow.js';
import { BatchActionBar } from '../files/BatchActionBar.js';
import { api } from '../../services/api.js';

interface FilesManagerViewProps {
  isNewFolderOpen: boolean;
  setIsNewFolderOpen: (open: boolean) => void;
}

export const FilesManagerView: React.FC<FilesManagerViewProps> = ({
  isNewFolderOpen,
  setIsNewFolderOpen,
}) => {
  const {
    folders,
    refreshFolders,
    activeFolderId,
    setActiveFolderId,
    viewMode,
    setViewMode,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    selectedFileIds,
    toggleSelectFile,
    selectAllFiles,
    clearFileSelection,
    searchQuery,
    openUpload,
    notify,
    allFiles,
    filesLoading,
    refreshStats,
  } = useApp();

  const loading = filesLoading;

  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#D97706');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editedFolderName, setEditedFolderName] = useState('');

  // Live Real-time files for current folder synchronized across all users
  const files = useMemo(() => {
    let list = allFiles.filter((f) => !f.inTrash);

    if (!activeFolderId || activeFolderId === 'root') {
      list = list.filter((f) => !f.folderId);
    } else {
      list = list.filter((f) => f.folderId === activeFolderId);
    }

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

    const isAsc = sortOrder === 'asc';
    return [...list].sort((a, b) => {
      if (sortField === 'name') return (isAsc ? 1 : -1) * a.name.localeCompare(b.name);
      if (sortField === 'size') return (isAsc ? 1 : -1) * (a.size - b.size);
      if (sortField === 'type') return (isAsc ? 1 : -1) * a.type.localeCompare(b.type);
      return (isAsc ? 1 : -1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
  }, [allFiles, activeFolderId, searchQuery, sortField, sortOrder]);

  const loadFiles = () => {
    refreshStats();
  };

  // Current folder and subfolders
  const currentFolder = useMemo(() => {
    return folders.find((f) => f.id === activeFolderId) || null;
  }, [folders, activeFolderId]);

  const subfolders = useMemo(() => {
    return folders.filter((f) => !f.inTrash && f.parentId === (activeFolderId || null));
  }, [folders, activeFolderId]);

  // Breadcrumbs path
  const breadcrumbs = useMemo(() => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Meus arquivos' }];
    if (currentFolder) {
      if (currentFolder.parentId) {
        const parent = folders.find((f) => f.id === currentFolder.parentId);
        if (parent) {
          crumbs.push({ id: parent.id, name: parent.name });
        }
      }
      crumbs.push({ id: currentFolder.id, name: currentFolder.name });
    }
    return crumbs;
  }, [folders, currentFolder]);

  // Folder actions
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await api.createFolder(newFolderName.trim(), activeFolderId, newFolderColor);
      notify(`Pasta "${newFolderName}" criada com sucesso!`, 'success');
      setNewFolderName('');
      setIsNewFolderOpen(false);
      await refreshFolders();
    } catch {
      notify('Erro ao criar pasta', 'error');
    }
  };

  const handleUpdateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder || !editedFolderName.trim()) return;

    try {
      await api.updateFolder(editingFolder.id, { name: editedFolderName.trim() });
      notify('Pasta renomeada com sucesso!', 'success');
      setEditingFolder(null);
      await refreshFolders();
    } catch {
      notify('Erro ao renomear pasta', 'error');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await api.deleteFolder(folderId);
      notify('Pasta movida para a Lixeira', 'info');
      if (activeFolderId === folderId) {
        setActiveFolderId(null);
      }
      await refreshFolders();
      loadFiles();
    } catch {
      notify('Erro ao excluir pasta', 'error');
    }
  };

  const handleDownloadFolderZip = (folderId: string) => {
    notify('Gerando arquivo ZIP da pasta...', 'info');
    api.triggerDownload(`/api/folders/${folderId}/download`);
  };

  const handleSortToggle = (field: 'name' | 'size' | 'date' | 'type') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Header Toolbar & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id || 'root'}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />}
              <button
                onClick={() => setActiveFolderId(crumb.id)}
                className={`flex items-center gap-1 font-medium transition-colors ${
                  idx === breadcrumbs.length - 1
                    ? 'text-amber-400 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {idx === 0 && <Home className="w-3.5 h-3.5 mr-0.5" />}
                <span>{crumb.name}</span>
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* View mode & Action buttons */}
        <div className="flex items-center gap-2">
          {/* Create Folder button */}
          <button
            onClick={() => setIsNewFolderOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span>Criar pasta</span>
          </button>

          {/* Upload Button */}
          <button
            onClick={() => openUpload(activeFolderId)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Enviar arquivos</span>
          </button>

          {/* Grid / List View Toggle */}
          <div className="flex items-center bg-neutral-800/80 border border-neutral-700/80 rounded-lg p-0.5 ml-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-neutral-700 text-amber-400 shadow-xs' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list' ? 'bg-neutral-700 text-amber-400 shadow-xs' : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Subfolders Grid */}
      {subfolders.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
            Pastas ({subfolders.length})
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {subfolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => setActiveFolderId(folder.id)}
                className="group relative p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/60 cursor-pointer transition-all flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${folder.color || '#D97706'}20`, color: folder.color || '#D97706' }}
                  >
                    <FolderIcon className="w-4 h-4 fill-current" />
                  </div>

                  {/* Folder quick actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDownloadFolderZip(folder.id)}
                      title="Baixar pasta em ZIP"
                      className="p-1 text-neutral-400 hover:text-amber-400 hover:bg-neutral-700 rounded"
                    >
                      <Archive className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingFolder(folder);
                        setEditedFolderName(folder.name);
                      }}
                      title="Renomear pasta"
                      className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder.id)}
                      title="Excluir pasta"
                      className="p-1 text-neutral-400 hover:text-red-400 hover:bg-neutral-700 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-neutral-200 text-xs truncate block group-hover:text-amber-300">
                    {folder.name}
                  </span>
                  <span className="text-[10px] text-neutral-400">Pasta</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Files Header & Sort Options */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-300">
            Arquivos {files.length > 0 ? `(${files.length})` : ''}
          </span>
          {files.length > 0 && (
            <button
              onClick={() => {
                if (selectedFileIds.length === files.length) {
                  clearFileSelection();
                } else {
                  selectAllFiles(files.map((f) => f.id));
                }
              }}
              className="text-[11px] text-amber-400 hover:underline ml-2"
            >
              {selectedFileIds.length === files.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="hidden sm:inline">Ordenar:</span>
          <button
            onClick={() => handleSortToggle('name')}
            className={`px-2 py-1 rounded transition-colors ${sortField === 'name' ? 'bg-neutral-800 text-amber-400 font-medium' : 'hover:text-neutral-200'}`}
          >
            Nome
          </button>
          <button
            onClick={() => handleSortToggle('size')}
            className={`px-2 py-1 rounded transition-colors ${sortField === 'size' ? 'bg-neutral-800 text-amber-400 font-medium' : 'hover:text-neutral-200'}`}
          >
            Tamanho
          </button>
          <button
            onClick={() => handleSortToggle('date')}
            className={`px-2 py-1 rounded transition-colors ${sortField === 'date' ? 'bg-neutral-800 text-amber-400 font-medium' : 'hover:text-neutral-200'}`}
          >
            Data
          </button>
          <button
            onClick={() => handleSortToggle('type')}
            className={`px-2 py-1 rounded transition-colors ${sortField === 'type' ? 'bg-neutral-800 text-amber-400 font-medium' : 'hover:text-neutral-200'}`}
          >
            Tipo
          </button>
        </div>
      </div>

      {/* 4. Files Rendering (Grid or List) */}
      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">
          Carregando arquivos...
        </div>
      ) : files.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800">
          <FolderOpen className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-200">Esta pasta está vazia</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
            Envie fotos, vídeos em 4K, artes gráficas ou documentos para armazená-los sem perda de qualidade.
          </p>
          <button
            onClick={() => openUpload(activeFolderId)}
            className="mt-4 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs"
          >
            Enviar primeiro arquivo
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              isSelected={selectedFileIds.includes(file.id)}
              onSelect={toggleSelectFile}
              onRefresh={loadFiles}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-950/40">
                <th className="w-10 px-3 py-2.5 text-center"></th>
                <th className="px-3 py-2.5">Nome do Arquivo</th>
                <th className="px-3 py-2.5 hidden sm:table-cell">Categoria</th>
                <th className="px-3 py-2.5 text-right">Tamanho</th>
                <th className="px-3 py-2.5 hidden md:table-cell">Resolução / Tempo</th>
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
                  onRefresh={loadFiles}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Batch Action Bar */}
      <BatchActionBar onSuccess={loadFiles} />

      {/* New Folder Modal */}
      {isNewFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl text-neutral-100 text-xs">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-amber-400" />
              {activeFolderId ? `Nova Subpasta em "${currentFolder?.name}"` : 'Nova Pasta'}
            </h3>

            <form onSubmit={handleCreateFolder} className="space-y-3">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Nome da pasta:</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ex: Culto de Domingo, Conferência 2026..."
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">Cor da etiqueta:</label>
                <div className="flex items-center gap-2">
                  {['#D97706', '#2563EB', '#059669', '#DC2626', '#7C3AED', '#EC4899'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewFolderColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${newFolderColor === c ? 'scale-125 ring-2 ring-white' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsNewFolderOpen(false)}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold rounded-lg shadow-sm"
                >
                  Criar Pasta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {editingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl text-neutral-100 text-xs">
            <h3 className="text-sm font-semibold mb-3">Renomear pasta</h3>

            <form onSubmit={handleUpdateFolder} className="space-y-3">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Novo nome:</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editedFolderName}
                  onChange={(e) => setEditedFolderName(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingFolder(null)}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold rounded-lg shadow-sm"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
