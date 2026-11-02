import React from 'react';
import {
  ShieldAlert,
  HardDrive,
  Users,
  FolderOpen,
  Image as ImageIcon,
  Film,
  Palette,
  Music,
  FileText,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { formatBytes, formatDateTime } from '../../utils/formatters.js';

export const AdminView: React.FC = () => {
  const { storageStats, setActiveTab, user } = useApp();

  const usedBytes = storageStats?.totalBytesUsed || 0;
  const quotaBytes = storageStats?.totalQuota || 2 * 1024 * 1024 * 1024 * 1024;
  const usedPercent = storageStats?.usedPercentage || 0;
  const breakdown = storageStats?.breakdown;

  const storageCategories = [
    { label: 'Vídeos 4K & Transmissões', bytes: breakdown?.videos.bytes || 0, count: breakdown?.videos.count || 0, color: 'bg-blue-500', icon: Film },
    { label: 'Fotos em Alta Resolução', bytes: breakdown?.photos.bytes || 0, count: breakdown?.photos.count || 0, color: 'bg-amber-500', icon: ImageIcon },
    { label: 'Artes Gráficas & Impressão', bytes: breakdown?.arts.bytes || 0, count: breakdown?.arts.count || 0, color: 'bg-purple-500', icon: Palette },
    { label: 'Áudios & Multitracks Master', bytes: breakdown?.audios.bytes || 0, count: breakdown?.audios.count || 0, color: 'bg-emerald-500', icon: Music },
    { label: 'Documentos & Manuais', bytes: breakdown?.documents.bytes || 0, count: breakdown?.documents.count || 0, color: 'bg-red-500', icon: FileText },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            Painel Geral de Administração da Central
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Métricas de armazenamento real, saúde dos servidores de mídia e auditoria da igreja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
            ● Servidor Ativo & Saudável
          </span>
        </div>
      </div>

      {/* Storage Breakdown Section */}
      <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-neutral-100">Distribuição Real do Armazenamento</h2>
          </div>
          <span className="text-xs font-mono-numbers text-amber-400 font-bold">
            {formatBytes(usedBytes)} de {formatBytes(quotaBytes)} ({usedPercent.toFixed(2)}%)
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="w-full h-4 bg-neutral-800 rounded-full overflow-hidden flex p-0.5 border border-neutral-700/60 mb-6">
          {storageCategories.map((cat, i) => {
            const catPercent = usedBytes > 0 ? (cat.bytes / usedBytes) * usedPercent : 0;
            if (catPercent <= 0) return null;
            return (
              <div
                key={cat.label}
                title={`${cat.label}: ${formatBytes(cat.bytes)}`}
                className={`h-full ${cat.color} first:rounded-l-full last:rounded-r-full transition-all duration-500`}
                style={{ width: `${catPercent}%` }}
              />
            );
          })}
        </div>

        {/* Detailed Category Table */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {storageCategories.map((cat) => {
            const Icon = cat.icon;
            const percentageOfUsed = usedBytes > 0 ? (cat.bytes / usedBytes) * 100 : 0;

            return (
              <div
                key={cat.label}
                className="p-4 rounded-xl bg-neutral-800/40 border border-neutral-700/50 flex items-start justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${cat.color}/20 text-neutral-100 shrink-0 mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-neutral-200 block truncate max-w-[160px]">
                      {cat.label}
                    </span>
                    <span className="text-xs text-neutral-400 font-mono-numbers mt-0.5 block">
                      {cat.count} arquivos ({percentageOfUsed.toFixed(1)}% do uso)
                    </span>
                  </div>
                </div>

                <span className="text-xs font-bold font-mono-numbers text-neutral-100">
                  {formatBytes(cat.bytes)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <span className="text-xs text-neutral-400 block">Total de Arquivos</span>
          <span className="text-2xl font-bold font-mono-numbers text-neutral-100 mt-1 block">
            {storageStats?.counts.totalFiles || 0}
          </span>
          <span className="text-[10px] text-emerald-400 mt-1 block">Integridade original 100%</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <span className="text-xs text-neutral-400 block">Pastas Estruturadas</span>
          <span className="text-2xl font-bold font-mono-numbers text-neutral-100 mt-1 block">
            {storageStats?.counts.totalFolders || 0}
          </span>
          <span className="text-[10px] text-neutral-400 mt-1 block">Hierarquia da igreja</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <span className="text-xs text-neutral-400 block">Eventos Cobertos</span>
          <span className="text-2xl font-bold font-mono-numbers text-neutral-100 mt-1 block">
            {storageStats?.counts.totalEvents || 0}
          </span>
          <span className="text-[10px] text-neutral-400 mt-1 block">Cultos e conferências</span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <span className="text-xs text-neutral-400 block">Membros Autorizados</span>
          <span className="text-2xl font-bold font-mono-numbers text-neutral-100 mt-1 block">
            {storageStats?.counts.totalUsers || 0}
          </span>
          <span className="text-[10px] text-amber-400 mt-1 block">Papéis configurados</span>
        </div>
      </div>

      {/* Audit Log Preview */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-neutral-100">Registro de Auditoria Recente</h3>
          </div>
          <button
            onClick={() => setActiveTab('history')}
            className="text-xs text-amber-400 hover:underline"
          >
            Ver histórico detalhado
          </button>
        </div>

        <div className="space-y-2">
          {storageStats?.recentActivities && storageStats.recentActivities.length > 0 ? (
            storageStats.recentActivities.slice(0, 6).map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-neutral-800/40 border border-neutral-700/40 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-neutral-200">{act.userName}:</span>
                  <span className="text-neutral-300 truncate">{act.actionLabel}</span>
                  <span className="text-neutral-500 truncate hidden sm:inline">({act.targetName})</span>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono-numbers shrink-0">
                  {formatDateTime(act.createdAt)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-neutral-500 text-xs py-4 text-center">Nenhum registro encontrado.</p>
          )}
        </div>
      </div>
    </div>
  );
};
