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
  CheckCircle2,
  Calendar,
  CalendarDays,
  CheckSquare,
  Square,
  StickyNote,
  Pin,
  ArrowRight,
  FileDown,
  Lock,
  Tv,
  ClipboardCheck,
  QrCode,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { ViewTab } from '../../types.js';
import { EventModal } from '../events/EventModal.js';
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

  const usedBytes = storageStats?.totalBytesUsed || 0;
  const quotaBytes = storageStats?.totalQuota || 2 * 1024 * 1024 * 1024 * 1024;
  const availableBytes = storageStats?.availableBytes || Math.max(0, quotaBytes - usedBytes);
  const usedPercent = storageStats?.usedPercentage || 0;

  const firstName = user?.name?.split(' ')[0] || 'Membro';

  const mediaCategories: {
    id: ViewTab;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
    bytes: number;
    iconClass: string;
  }[] = [
    {
      id: 'files',
      title: 'Arquivos',
      icon: FolderOpen,
      count: storageStats?.counts.totalFiles || 0,
      bytes: storageStats?.totalBytesUsed || 0,
      iconClass: 'text-amber-400',
    },
    {
      id: 'photos',
      title: 'Fotos',
      icon: ImageIcon,
      count: storageStats?.breakdown.photos.count || 0,
      bytes: storageStats?.breakdown.photos.bytes || 0,
      iconClass: 'text-amber-400',
    },
    {
      id: 'videos',
      title: 'Vídeos',
      icon: Film,
      count: storageStats?.breakdown.videos.count || 0,
      bytes: storageStats?.breakdown.videos.bytes || 0,
      iconClass: 'text-sky-400',
    },
    {
      id: 'arts',
      title: 'Artes',
      icon: Palette,
      count: storageStats?.breakdown.arts.count || 0,
      bytes: storageStats?.breakdown.arts.bytes || 0,
      iconClass: 'text-purple-400',
    },
    {
      id: 'audios',
      title: 'Áudios',
      icon: Music,
      count: storageStats?.breakdown.audios.count || 0,
      bytes: storageStats?.breakdown.audios.bytes || 0,
      iconClass: 'text-emerald-400',
    },
    {
      id: 'documents',
      title: 'Documentos',
      icon: FileText,
      count: storageStats?.breakdown.documents.count || 0,
      bytes: storageStats?.breakdown.documents.bytes || 0,
      iconClass: 'text-rose-400',
    },
  ];

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

  const filteredTasks = accessibleTasks
    .filter((t) =>
      taskFilter === 'mine'
        ? t.assignedToUid === user?.uid ||
          (user?.email && t.assignedToEmail?.toLowerCase() === user.email.toLowerCase())
        : true
    )
    .sort((a, b) => {
      if (a.status === 'concluido' && b.status !== 'concluido') return 1;
      if (a.status !== 'concluido' && b.status === 'concluido') return -1;
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    });

  const pendingCount = accessibleTasks.filter((t) => t.status !== 'concluido').length;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Compact Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight truncate">
            Olá, {firstName}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
            PT-B Mídia · Arquivos em qualidade original, escalas e chamadas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => openUpload()}
            className="min-h-[40px] flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl transition-colors active:scale-95 text-xs whitespace-nowrap cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Enviar arquivos</span>
          </button>

          <button
            type="button"
            onClick={() => toggleTransmission()}
            className={`min-h-[40px] flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
              isTransmitting
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
            }`}
          >
            {isTransmitting ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Parar Telão</span>
              </>
            ) : (
              <>
                <Tv className="w-4 h-4 text-amber-400" />
                <span>Telão</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Quick Shortcuts (Clean, Non-Duplicate, Single-Line) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className="flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 hover:bg-neutral-800/60 transition-colors text-left cursor-pointer"
        >
          <CalendarDays className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-neutral-100 truncate">Agenda & Escalas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className="flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 hover:bg-neutral-800/60 transition-colors text-left cursor-pointer"
        >
          <ClipboardCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-neutral-100 truncate">Chamada</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('registrations')}
          className="flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 hover:bg-neutral-800/60 transition-colors text-left cursor-pointer"
        >
          <QrCode className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="text-xs font-semibold text-neutral-100 truncate">Inscrições QR</span>
        </button>

        <button
          type="button"
          onClick={onNewFolderClick}
          className="flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 hover:bg-neutral-800/60 transition-colors text-left cursor-pointer"
        >
          <FolderPlus className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-neutral-100 truncate">Nova Pasta</span>
        </button>

        <button
          type="button"
          onClick={() => setIsEventModalOpen(true)}
          className="flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 hover:bg-neutral-800/60 transition-colors text-left cursor-pointer"
        >
          <CalendarPlus className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-neutral-100 truncate">Novo Evento</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('photos')}
          className="flex items-center gap-2.5 p-3 min-h-[48px] rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 hover:bg-neutral-800/60 transition-colors text-left cursor-pointer"
        >
          <ImageIcon className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-neutral-100 truncate">Ver Fotos</span>
        </button>
      </div>

      {/* 3. Team Schedule & Notes (Clean Hairline List, Zero Nested Box Clutter) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-neutral-100">
              Agenda & Escalas da Equipe
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {pendingCount} tarefa(s) pendente(s) · {teamNotes.length} aviso(s) no mural
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>Abrir Agenda</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Tasks List */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300">Próximos afazeres</span>
              <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTaskFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    taskFilter === 'all'
                      ? 'bg-amber-400 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Todos ({accessibleTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('mine')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    taskFilter === 'mine'
                      ? 'bg-amber-400 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Minhas (
                  {
                    accessibleTasks.filter(
                      (t) =>
                        t.assignedToUid === user?.uid ||
                        (user?.email && t.assignedToEmail?.toLowerCase() === user.email.toLowerCase())
                    ).length
                  }
                  )
                </button>
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="py-6 text-center border-t border-neutral-800">
                <p className="text-xs text-neutral-400">
                  {taskFilter === 'mine'
                    ? 'Nenhuma escala atribuída a você no momento.'
                    : 'Nenhum afazer cadastrado.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-800 border-t border-neutral-800">
                {filteredTasks.slice(0, 4).map((task) => {
                  const isCompleted = task.status === 'concluido';
                  return (
                    <div
                      key={task.id}
                      className={`py-2.5 flex items-start justify-between gap-3 ${
                        isCompleted ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleTaskComplete(task.id, task.status)}
                          className="mt-0.5 text-neutral-400 hover:text-amber-400 transition-colors shrink-0 cursor-pointer"
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
                              className={`text-xs font-semibold truncate ${
                                isCompleted ? 'line-through text-neutral-500' : 'text-neutral-100'
                              }`}
                            >
                              {task.title}
                            </span>
                            {task.isPrivate && (
                              <Lock className="w-3 h-3 text-red-400 shrink-0" />
                            )}
                            {task.priority === 'urgente' && !isCompleted && (
                              <span className="text-[10px] font-bold text-red-400">Urgente</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-neutral-400 flex-wrap">
                            <span>{task.assignedToName || 'Equipe'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{getCategoryLabel(task.category)}</span>
                            {task.dueDate && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {formatDate(task.dueDate)}
                                  {task.dueTime ? ` ${task.dueTime}` : ''}
                                </span>
                              </>
                            )}
                            {task.eventName && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-400/90 truncate max-w-[140px]">
                                  {task.eventName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => exportIndividualTaskPDF(task)}
                          className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
                          title="Baixar PDF desta tarefa"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes Column */}
          <div className="lg:col-span-5 space-y-2.5 lg:border-l lg:border-neutral-800 lg:pl-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-neutral-300">Anotações & Avisos</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className="text-[11px] text-amber-400 hover:underline font-medium cursor-pointer"
              >
                Ver todas ({teamNotes.length})
              </button>
            </div>

            {teamNotes.length === 0 ? (
              <div className="py-6 text-center border-t border-neutral-800">
                <p className="text-xs text-neutral-400">Nenhuma anotação registrada.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-800 border-t border-neutral-800">
                {teamNotes.slice(0, 3).map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setActiveTab('schedule')}
                    className="w-full py-2.5 text-left hover:bg-neutral-800/30 transition-colors cursor-pointer block"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {note.isPinned && (
                          <Pin className="w-3 h-3 text-amber-400 shrink-0 fill-amber-400" />
                        )}
                        <h3 className="text-xs font-semibold text-neutral-200 truncate">
                          {note.title}
                        </h3>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono tabular-nums shrink-0">
                        {formatDate(note.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                      {note.content}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Media Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-neutral-800 rounded-2xl overflow-hidden border border-neutral-800">
        {mediaCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveTab(cat.id)}
              className="p-3.5 bg-neutral-900 hover:bg-neutral-800/80 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-300">{cat.title}</span>
                <Icon className={`w-4 h-4 ${cat.iconClass}`} />
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5 font-mono tabular-nums">
                <span className="text-base font-bold text-neutral-100">{cat.count}</span>
                <span className="text-[11px] text-neutral-400">{formatBytes(cat.bytes)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 5. Storage & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-neutral-100">Armazenamento</h2>
              </div>
              <span className="text-xs font-mono tabular-nums font-bold text-amber-400">
                {usedPercent.toFixed(1)}%
              </span>
            </div>

            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(usedPercent, 1))}%` }}
              />
            </div>

            <div className="divide-y divide-neutral-800/80 text-xs">
              <div className="flex items-center justify-between py-2">
                <span className="text-neutral-400">Utilizado</span>
                <span className="font-semibold font-mono tabular-nums text-neutral-200">
                  {formatBytes(usedBytes)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-neutral-400">Disponível</span>
                <span className="font-semibold font-mono tabular-nums text-emerald-400">
                  {formatBytes(availableBytes)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-neutral-400">Capacidade total</span>
                <span className="font-semibold font-mono tabular-nums text-neutral-200">
                  {formatBytes(quotaBytes)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className="text-xs text-amber-400 hover:underline text-left font-medium cursor-pointer"
          >
            Gerenciar armazenamento →
          </button>
        </div>

        <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-neutral-100">Atividades recentes</h2>
            </div>
            {user?.role === 'super_admin' && (
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className="text-xs text-amber-400 hover:underline font-medium cursor-pointer"
              >
                Ver histórico
              </button>
            )}
          </div>

          {storageStats?.recentActivities && storageStats.recentActivities.length > 0 ? (
            <div className="divide-y divide-neutral-800 border-t border-neutral-800">
              {storageStats.recentActivities.slice(0, 5).map((act) => (
                <div
                  key={act.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-200 truncate">
                        <span className="text-neutral-400 font-normal">{act.userName} · </span>
                        {act.actionLabel}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {act.targetName}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-neutral-500 font-mono tabular-nums shrink-0">
                    {formatDate(act.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500 text-xs py-6 text-center border-t border-neutral-800">
              Nenhuma atividade recente registrada.
            </p>
          )}
        </div>
      </div>

      {/* 6. Church Events Preview */}
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-neutral-100">Coberturas de Eventos</h2>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('events')}
            className="text-xs text-amber-400 hover:underline font-medium cursor-pointer"
          >
            Ver todos ({events.length})
          </button>
        </div>

        {events.length === 0 ? (
          <div className="py-6 text-center border-t border-neutral-800 space-y-2">
            <p className="text-xs text-neutral-400">Nenhum evento cadastrado.</p>
            <button
              type="button"
              onClick={() => setIsEventModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 text-xs font-semibold cursor-pointer"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>Criar primeiro evento</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {events.slice(0, 3).map((evt) => (
              <button
                key={evt.id}
                type="button"
                onClick={() => setActiveTab('events')}
                className="group rounded-xl overflow-hidden bg-neutral-950/60 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors flex flex-col text-left"
              >
                <div className="relative h-28 w-full overflow-hidden bg-neutral-900">
                  {evt.coverUrl ? (
                    <img
                      src={evt.coverUrl}
                      alt={evt.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="w-7 h-7 text-amber-400/35" />
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-[10px] text-neutral-200 font-mono tabular-nums">
                    {formatDate(evt.date)}
                  </span>
                </div>
                <div className="p-3 w-full">
                  <h3 className="font-semibold text-neutral-100 text-xs group-hover:text-amber-300 transition-colors truncate">
                    {evt.name}
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                    {evt.category}
                  </p>
                </div>
              </button>
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
