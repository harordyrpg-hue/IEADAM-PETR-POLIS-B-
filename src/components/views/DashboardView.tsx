import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Image as ImageIcon,
  Film,
  Palette,
  Music,
  FileText,
  Upload,
  FolderPlus,
  CalendarPlus,
  HardDrive,
  Clock,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  CalendarDays,
  CheckSquare,
  Square,
  StickyNote,
  Pin,
  Users,
  ArrowRight,
  Tag,
  Radio,
  FileDown,
  Lock,
  Tv,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { formatBytes, formatDate, formatDateTime } from '../../utils/formatters.js';
import { ViewTab } from '../../types.js';
import { EventModal } from '../events/EventModal.js';
import { api } from '../../services/api.js';
import { exportIndividualTaskPDF } from '../../utils/pdfGenerator.js';


interface DashboardViewProps {
  onNewFolderClick: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNewFolderClick }) => {
  const {
    user,
    storageStats,
    setActiveTab,
    openUpload,
    refreshStats,
    refreshEvents,
    events,
    teamTasks,
    teamNotes,
    toggleTaskComplete,
    isTransmitting,
    toggleTransmission,
  } = useApp();

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'mine'>('all');

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const usedBytes = storageStats?.totalBytesUsed || 0;
  const quotaBytes = storageStats?.totalQuota || 2 * 1024 * 1024 * 1024 * 1024;
  const availableBytes = storageStats?.availableBytes || Math.max(0, quotaBytes - usedBytes);
  const usedPercent = storageStats?.usedPercentage || 0;

  const categoryCards: {
    id: ViewTab;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
    bytes: number;
    color: string;
    border: string;
  }[] = [
    {
      id: 'files',
      title: 'Arquivos',
      icon: FolderOpen,
      count: storageStats?.counts.totalFiles || 0,
      bytes: storageStats?.totalBytesUsed || 0,
      color: 'text-amber-400 bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      id: 'photos',
      title: 'Fotos',
      icon: ImageIcon,
      count: storageStats?.breakdown.photos.count || 0,
      bytes: storageStats?.breakdown.photos.bytes || 0,
      color: 'text-amber-400 bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      id: 'videos',
      title: 'Vídeos',
      icon: Film,
      count: storageStats?.breakdown.videos.count || 0,
      bytes: storageStats?.breakdown.videos.bytes || 0,
      color: 'text-blue-400 bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      id: 'arts',
      title: 'Artes',
      icon: Palette,
      count: storageStats?.breakdown.arts.count || 0,
      bytes: storageStats?.breakdown.arts.bytes || 0,
      color: 'text-purple-400 bg-purple-500/10',
      border: 'border-purple-500/20',
    },
    {
      id: 'audios',
      title: 'Áudios',
      icon: Music,
      count: storageStats?.breakdown.audios.count || 0,
      bytes: storageStats?.breakdown.audios.bytes || 0,
      color: 'text-emerald-400 bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      id: 'documents',
      title: 'Documentos',
      icon: FileText,
      count: storageStats?.breakdown.documents.count || 0,
      bytes: storageStats?.breakdown.documents.bytes || 0,
      color: 'text-red-400 bg-red-500/10',
      border: 'border-red-500/20',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Welcome Greeting & Identity */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-neutral-900 border border-neutral-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight">
            Olá, {user?.name || 'Membro da Equipe'}!
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Bem-vindo ao <span className="font-semibold text-neutral-200">PT-B Mídia</span> — Central de Arquivos e Mídias da Igreja.
          </p>
          <div className="flex items-center gap-3 text-xs text-neutral-400 mt-3">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Qualidade Original Preservada</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>Sem compressão automática</span>
          </div>
        </div>

        {/* Quick Upload CTA */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => openUpload()}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            <span>Enviar arquivos</span>
          </button>
        </div>
      </div>

      {/* 2. Quick Access Buttons */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          Acesso Rápido
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setActiveTab('schedule')}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/20 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-amber-400 text-neutral-950 group-hover:scale-105 transition-transform shadow-xs">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-300 block">
                Central de Agenda
              </span>
              <span className="text-[10px] text-amber-200/70 block">
                Escalas e notas
              </span>
            </div>
          </button>

          {/* Transmitir para a Tela / Telão (PC) */}
          <button
            onClick={() => toggleTransmission()}
            className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left group cursor-pointer ${
              isTransmitting
                ? 'bg-rose-600/20 border-rose-500/50 hover:bg-rose-600/30 text-rose-200 animate-pulse'
                : 'bg-neutral-900 border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-800/80'
            }`}
            title="Transmitir tela para o telão/projetor da igreja"
          >
            <div className={`p-2 rounded-lg transition-transform group-hover:scale-105 ${
              isTransmitting ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30' : 'bg-amber-500/10 text-amber-400'
            }`}>
              {isTransmitting ? <Square className="w-4 h-4 fill-current" /> : <Tv className="w-4 h-4" />}
            </div>
            <div>
              <span className={`text-xs font-bold block ${isTransmitting ? 'text-rose-300' : 'text-neutral-200 group-hover:text-amber-300'}`}>
                {isTransmitting ? 'Parar Transmissão' : 'Transmitir Tela'}
              </span>
              <span className="text-[10px] text-neutral-400 block">
                {isTransmitting ? 'Ao vivo no telão' : 'Telão / PC'}
              </span>
            </div>
          </button>

          <button
            onClick={() => openUpload()}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-800/80 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <Upload className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-neutral-200 group-hover:text-amber-300">
              Enviar arquivos
            </span>
          </button>

          <button
            onClick={onNewFolderClick}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-800/80 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <FolderPlus className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-neutral-200 group-hover:text-amber-300">
              Criar pasta
            </span>
          </button>

          <button
            onClick={() => setIsEventModalOpen(true)}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-800/80 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <CalendarPlus className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-neutral-200 group-hover:text-amber-300">
              Novo evento
            </span>
          </button>

          <button
            onClick={() => setActiveTab('photos')}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-800/80 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
              <ImageIcon className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-neutral-200 group-hover:text-amber-300">
              Ver fotos
            </span>
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-800/80 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:scale-105 transition-transform">
              <Film className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-neutral-200 group-hover:text-blue-300">
              Ver vídeos
            </span>
          </button>
        </div>
      </div>

      {/* 2.5 Real-time Team Schedule & Collaborative Notes Hub */}
      <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-neutral-100">
                  Central de Agenda & Escalas da Equipe
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Tempo Real
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Organização de trabalhos, afazeres por membro para cada culto e anotações colaborativas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('schedule')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold border border-neutral-700 transition-all"
            >
              <span>Abrir Central Completa</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Two-Column Grid: Tasks/Escalas vs Team Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Escalas e Afazeres (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-300">
                  Afazeres & Escalas
                </span>
                <span className="px-2 py-0.5 rounded-full bg-neutral-800 text-[10px] text-neutral-400 font-mono-numbers">
                  {teamTasks.filter((t) => t.status !== 'concluido').length} pendentes
                </span>
              </div>

              {/* Filter: All vs Mine */}
              <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    taskFilter === 'all'
                      ? 'bg-amber-400 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Todos ({teamTasks.length})
                </button>
                <button
                  onClick={() => setTaskFilter('mine')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    taskFilter === 'mine'
                      ? 'bg-amber-400 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Minhas ({teamTasks.filter((t) => t.assignedToEmail === user?.email).length})
                </button>
              </div>
            </div>

            {/* Tasks List with Privacy Filtering & PDF Action */}
            <div className="space-y-2">
              {(() => {
                const accessibleTasks = teamTasks.filter((t) => {
                  if (t.isPrivate) {
                    const isSuper = user?.role === 'super_admin';
                    const isAssignee =
                      t.assignedToUid === user?.uid ||
                      (user?.email && t.assignedToEmail?.toLowerCase() === user.email.toLowerCase());
                    const isCreator = t.createdByUid === user?.uid;
                    if (!isSuper && !isAssignee && !isCreator) return false;
                  }
                  return true;
                });

                const filtered = accessibleTasks.filter((t) =>
                  taskFilter === 'mine'
                    ? t.assignedToUid === user?.uid || (user?.email && t.assignedToEmail?.toLowerCase() === user.email.toLowerCase())
                    : true
                );

                if (filtered.length === 0) {
                  return (
                    <div className="p-6 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center">
                      <p className="text-xs text-neutral-400">
                        {taskFilter === 'mine'
                          ? 'Nenhuma escala ou afazer atribuído a você no momento.'
                          : 'Nenhum afazer cadastrado. Crie um novo na Central de Agenda.'}
                      </p>
                      <button
                        onClick={() => setActiveTab('schedule')}
                        className="mt-2 text-xs text-amber-400 hover:underline font-medium"
                      >
                        Gerenciar escalas da equipe →
                      </button>
                    </div>
                  );
                }

                // Show top 4 tasks (pending first)
                const sorted = [...filtered].sort((a, b) => {
                  if (a.status === 'concluido' && b.status !== 'concluido') return 1;
                  if (a.status !== 'concluido' && b.status === 'concluido') return -1;
                  return (a.dueDate || '').localeCompare(b.dueDate || '');
                });

                const getCategoryLabel = (cat: string) => {
                  const map: Record<string, string> = {
                    transmissao: 'Transmissão',
                    som: 'Som',
                    projecao: 'Projeção',
                    fotografia: 'Fotografia',
                    video: 'Vídeo',
                    design_redes: 'Design & Redes',
                    iluminacao: 'Iluminação',
                    outro: 'Geral',
                  };
                  return map[cat] || cat;
                };

                return sorted.slice(0, 4).map((task) => {
                  const isCompleted = task.status === 'concluido';
                  return (
                    <div
                      key={task.id}
                      className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition-all ${
                        isCompleted
                          ? 'bg-neutral-950/40 border-neutral-800/50 opacity-60'
                          : 'bg-neutral-950/80 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <button
                          onClick={() => toggleTaskComplete(task.id, task.status)}
                          className="mt-0.5 text-neutral-400 hover:text-amber-400 transition-colors shrink-0"
                          title={isCompleted ? 'Marcar como pendente' : 'Marcar como concluída'}
                        >
                          {isCompleted ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-semibold ${
                                isCompleted ? 'line-through text-neutral-500' : 'text-neutral-200'
                              }`}
                            >
                              {task.title}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-300">
                              {getCategoryLabel(task.category)}
                            </span>
                            {task.isPrivate && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Privada</span>
                              </span>
                            )}
                            {task.priority === 'urgente' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                URGENTE
                              </span>
                            )}
                          </div>

                          {task.description && (
                            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                              {task.description}
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-neutral-400 flex-wrap">
                            <span className="text-neutral-300 font-medium">
                              👤 {task.assignedToName || 'Equipe'}
                            </span>
                            <span className="text-amber-400/80">
                              Por: {task.createdByName || 'Liderança'}
                            </span>
                            {task.dueDate && (
                              <span>
                                📅 {formatDate(task.dueDate)} {task.dueTime ? `às ${task.dueTime}` : ''}
                              </span>
                            )}
                            {task.eventName && (
                              <span className="text-amber-400/90 truncate max-w-[150px]">
                                ⛪ {task.eventName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => exportIndividualTaskPDF(task)}
                          className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 rounded transition-colors"
                          title="Baixar Ordem de Serviço em PDF desta tarefa"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isCompleted
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : task.status === 'em_andamento'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {isCompleted
                            ? 'Concluído'
                            : task.status === 'em_andamento'
                            ? 'Em andamento'
                            : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Right Column: Collaborative Notes & Checklist (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-neutral-300">
                  Mural de Anotações & Avisos
                </span>
              </div>
              <button
                onClick={() => setActiveTab('schedule')}
                className="text-[11px] text-amber-400 hover:underline font-medium"
              >
                Ver todas ({teamNotes.length})
              </button>
            </div>

            <div className="space-y-2">
              {teamNotes.length === 0 ? (
                <div className="p-6 rounded-xl bg-neutral-950/60 border border-neutral-800 text-center">
                  <p className="text-xs text-neutral-400">Nenhuma anotação registrada pela equipe.</p>
                  <button
                    onClick={() => setActiveTab('schedule')}
                    className="mt-2 text-xs text-amber-400 hover:underline font-medium"
                  >
                    Criar primeira anotação →
                  </button>
                </div>
              ) : (
                teamNotes.slice(0, 3).map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setActiveTab('schedule')}
                    className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {note.isPinned && (
                          <Pin className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400" />
                        )}
                        <h4 className="text-xs font-bold text-neutral-200 group-hover:text-amber-300 transition-colors truncate">
                          {note.title}
                        </h4>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono-numbers shrink-0">
                        {formatDate(note.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                      {note.content}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-neutral-800/80 text-[10px] text-neutral-500">
                      <span>Por: {note.authorName}</span>
                      <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[9px]">
                        {note.category}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Category Summary Cards */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          Mídias Armazenadas
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categoryCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                onClick={() => setActiveTab(card.id)}
                className={`p-4 rounded-xl bg-neutral-900 border ${card.border} hover:bg-neutral-800/70 transition-all text-left group flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
                </div>

                <div>
                  <span className="text-xs font-medium text-neutral-300 block">
                    {card.title}
                  </span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-base font-bold font-mono-numbers text-neutral-100">
                      {card.count}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono-numbers">
                      ({formatBytes(card.bytes)})
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Real Storage Metrics & Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real Storage Panel */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-neutral-100">Armazenamento Real</h3>
              </div>
              <span className="text-xs font-mono-numbers font-bold text-amber-400">
                {usedPercent.toFixed(1)}% ocupado
              </span>
            </div>

            {/* Visual Storage Bar */}
            <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden p-0.5 border border-neutral-700/50 mb-4">
              <div
                className="h-full bg-linear-to-r from-amber-500 via-amber-400 to-amber-300 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(usedPercent, 1))}%` }}
              />
            </div>

            {/* Storage Numbers */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
                <span className="text-neutral-400">Espaço Utilizado:</span>
                <span className="font-semibold font-mono-numbers text-neutral-200">
                  {formatBytes(usedBytes)}
                </span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80">
                <span className="text-neutral-400">Espaço Disponível:</span>
                <span className="font-semibold font-mono-numbers text-emerald-400">
                  {formatBytes(availableBytes)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Capacidade Total Alocada:</span>
                <span className="font-semibold font-mono-numbers text-neutral-200">
                  {formatBytes(quotaBytes)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Google Cloud Storage Ready</span>
            <button
              onClick={() => setActiveTab('settings')}
              className="text-amber-400 hover:underline"
            >
              Configurar Storage
            </button>
          </div>
        </div>

        {/* Recent Activities Feed */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-neutral-100">Atividades Recentes</h3>
            </div>
            <button
              onClick={() => setActiveTab('history')}
              className="text-xs text-amber-400 hover:underline"
            >
              Ver histórico completo
            </button>
          </div>

          {/* Activities list */}
          <div className="space-y-3 overflow-hidden">
            {storageStats?.recentActivities && storageStats.recentActivities.length > 0 ? (
              storageStats.recentActivities.slice(0, 5).map((act) => (
                <div
                  key={act.id}
                  className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-neutral-800/40 hover:bg-neutral-800/70 border border-neutral-700/40 transition-colors text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-1 rounded bg-neutral-800 text-amber-400 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-200 truncate">
                        <span className="text-neutral-400 font-normal">{act.userName} · </span>
                        {act.actionLabel}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {act.targetName} {act.details ? `— ${act.details}` : ''}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] text-neutral-400 font-mono-numbers shrink-0">
                    {formatDate(act.createdAt)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-neutral-500 text-xs py-4 text-center">Nenhuma atividade recente registrada.</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
            <span>Eventos e mídias sincronizados em tempo real</span>
            <button
              onClick={() => refreshStats()}
              className="text-neutral-300 hover:text-white"
            >
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* 5. Featured Church Events Section */}
      <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-neutral-100">Eventos da Igreja</h3>
          </div>
          <button
            onClick={() => setActiveTab('events')}
            className="text-xs text-amber-400 hover:underline"
          >
            Ver todos os eventos ({events.length})
          </button>
        </div>

        {events.length === 0 ? (
          <div className="p-8 rounded-xl bg-neutral-800/20 border border-dashed border-neutral-800 text-center">
            <Calendar className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
            <p className="text-xs text-neutral-400">Nenhum evento cadastrado no momento.</p>
            <button
              onClick={() => setIsEventModalOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20 text-xs font-medium transition-all cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>Criar primeiro evento</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {events.slice(0, 3).map((evt) => (
              <div
                key={evt.id}
                onClick={() => {
                  setActiveTab('events');
                }}
                className="group relative rounded-xl overflow-hidden bg-neutral-800/40 border border-neutral-700/60 hover:border-neutral-600 cursor-pointer transition-all flex flex-col"
              >
                <div className="relative h-32 w-full overflow-hidden">
                  <img
                    src={evt.coverUrl}
                    alt={evt.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-[10px] text-amber-300 font-medium">
                    {evt.category}
                  </span>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-[10px] text-neutral-200 font-mono-numbers">
                    {formatDate(evt.date)}
                  </span>
                </div>
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-200 text-xs group-hover:text-amber-300 transition-colors line-clamp-1">
                      {evt.name}
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">
                      {evt.description}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-neutral-700/40 flex items-center justify-between text-[10px] text-neutral-400 font-mono-numbers">
                    <span>{evt.responsibles ? evt.responsibles.join(', ') : 'Mídia'}</span>
                    <span className="text-amber-400">Ver arquivos →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Event Modal */}
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSuccess={() => {
          refreshEvents();
          refreshStats();
        }}
      />
    </div>
  );
};
