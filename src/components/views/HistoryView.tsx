import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Upload,
  Download,
  Trash2,
  RotateCcw,
  FolderPlus,
  Share2,
  CalendarPlus,
  Shield,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { Activity } from '../../types.js';
import { formatDateTime } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const HistoryView: React.FC = () => {
  const { notify } = useApp();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [search, setSearch] = useState('');

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getActivities();
      setActivities(data);
    } catch {
      notify('Erro ao carregar histórico', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'upload':
        return <Upload className="w-3.5 h-3.5 text-amber-400" />;
      case 'download':
        return <Download className="w-3.5 h-3.5 text-blue-400" />;
      case 'delete':
        return <Trash2 className="w-3.5 h-3.5 text-red-400" />;
      case 'restore':
        return <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />;
      case 'create_folder':
        return <FolderPlus className="w-3.5 h-3.5 text-amber-400" />;
      case 'share':
        return <Share2 className="w-3.5 h-3.5 text-purple-400" />;
      case 'create_event':
        return <CalendarPlus className="w-3.5 h-3.5 text-emerald-400" />;
      case 'role_change':
        return <Shield className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return <History className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  const filtered = activities.filter((act) => {
    if (filterAction !== 'all' && act.action !== filterAction) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        act.userName.toLowerCase().includes(q) ||
        act.targetName.toLowerCase().includes(q) ||
        act.actionLabel.toLowerCase().includes(q) ||
        act.details.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            Histórico & Trilha de Auditoria
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Registro cronológico e imutável de todas as ações de upload, download, deleção e compartilhamento.
          </p>
        </div>

        {/* Filter & Search */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por nome ou arquivo..."
            className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
          />

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
          >
            <option value="all">Todas as ações</option>
            <option value="upload">Uploads</option>
            <option value="download">Downloads</option>
            <option value="delete">Exclusões</option>
            <option value="restore">Restaurações</option>
            <option value="share">Compartilhamentos</option>
            <option value="create_event">Eventos</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">Carregando histórico...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs">
          Nenhum registro encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-950/40">
                <th className="px-4 py-3">Data e Horário</th>
                <th className="px-4 py-3">Membro da Equipe</th>
                <th className="px-4 py-3">Ação Executada</th>
                <th className="px-4 py-3">Arquivo / Alvo</th>
                <th className="px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((act) => (
                <tr key={act.id} className="border-b border-neutral-800/60 hover:bg-neutral-800/40 transition-colors">
                  <td className="px-4 py-3 text-neutral-400 font-mono-numbers whitespace-nowrap">
                    {formatDateTime(act.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-neutral-200 whitespace-nowrap">
                    {act.userName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-neutral-800 shrink-0">
                        {getActionIcon(act.action)}
                      </div>
                      <span className="text-neutral-200">{act.actionLabel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-300 truncate max-w-xs">
                    {act.targetName}
                  </td>
                  <td className="px-4 py-3 text-neutral-400 text-[11px] truncate max-w-xs">
                    {act.details || '—'}
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
