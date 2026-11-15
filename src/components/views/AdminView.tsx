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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">
            Painel Administrativo
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Métricas de armazenamento, uso da equipe e auditoria recente.
          </p>
        </div>

        <span className="text-xs font-medium text-emerald-400">
          Sistema operacional
        </span>
      </div>

      {/* Hairline Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-800 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="p-4 bg-neutral-900">
          <span className="text-xs text-neutral-400 block">Arquivos</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-neutral-100 mt-1 block">
            {storageStats?.counts.totalFiles || 0}
          </span>
        </div>

        <div className="p-4 bg-neutral-900">
          <span className="text-xs text-neutral-400 block">Pastas</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-neutral-100 mt-1 block">
            {storageStats?.counts.totalFolders || 0}
          </span>
        </div>

        <div className="p-4 bg-neutral-900">
          <span className="text-xs text-neutral-400 block">Eventos</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-neutral-100 mt-1 block">
            {storageStats?.counts.totalEvents || 0}
          </span>
        </div>

        <div className="p-4 bg-neutral-900">
          <span className="text-xs text-neutral-400 block">Membros</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-amber-400 mt-1 block">
            {storageStats?.counts.totalUsers || 0}
          </span>
        </div>
      </div>

      {/* Storage Breakdown Section */}
      <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-100">
            Distribuição de Armazenamento
          </h2>
          <span className="text-xs font-mono tabular-nums text-amber-400 font-bold">
            {formatBytes(usedBytes)} de {formatBytes(quotaBytes)} ({usedPercent.toFixed(2)}%)
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden flex">
          {storageCategories.map((cat) => {
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

        {/* Detailed Category Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {storageCategories.map((cat) => {
            const Icon = cat.icon;
            const percentageOfUsed = usedBytes > 0 ? (cat.bytes / usedBytes) * 100 : 0;

            return (
              <div
                key={cat.label}
                className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${cat.color}/20 text-neutral-100 shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-neutral-200 block truncate">
                      {cat.label}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono tabular-nums mt-0.5 block">
                      {cat.count} arq. ({percentageOfUsed.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <span className="text-xs font-bold font-mono tabular-nums text-neutral-100 shrink-0">
                  {formatBytes(cat.bytes)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit Log Preview */}
      <div className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h3 className="text-sm font-semibold text-neutral-100">Auditoria Recente</h3>
          <button
            onClick={() => setActiveTab('history')}
            className="text-xs text-amber-400 hover:underline font-medium cursor-pointer"
          >
            Ver histórico completo
          </button>
        </div>

        <div className="divide-y divide-neutral-800">
          {storageStats?.recentActivities && storageStats.recentActivities.length > 0 ? (
            storageStats.recentActivities.slice(0, 6).map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-xs hover:bg-neutral-800/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-neutral-200 shrink-0">{act.userName}:</span>
                  <span className="text-neutral-300 truncate">{act.actionLabel}</span>
                  <span className="text-neutral-500 truncate hidden sm:inline">({act.targetName})</span>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono tabular-nums shrink-0">
                  {formatDateTime(act.createdAt)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-neutral-500 text-xs py-6 text-center">Nenhum registro encontrado.</p>
          )}
        </div>
      </div>
    </div>
  );
};
