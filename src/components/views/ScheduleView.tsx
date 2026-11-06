import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Filter,
  User,
  Radio,
  Volume2,
  Tv,
  Camera,
  Film,
  Palette,
  Lightbulb,
  CheckSquare,
  Square,
  Trash2,
  Edit2,
  Pin,
  Tag,
  StickyNote,
  ChevronDown,
  Calendar,
  X,
  ListTodo,
  Sparkles,
  ArrowRight,
  UserCheck,
  FileDown,
  FileText,
  Lock,
  Globe,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import {
  TeamTask,
  TeamNote,
  TeamTaskCategory,
  TeamTaskPriority,
  TeamTaskStatus,
  ChurchEvent,
  User as UserType,
} from '../../types.js';
import { api } from '../../services/api.js';
import { formatDate } from '../../utils/formatters.js';
import {
  exportIndividualTaskPDF,
  exportUserSchedulePDF,
  exportEventSchedulePDF,
} from '../../utils/pdfGenerator.js';

const CATEGORY_CONFIG: Record<
  TeamTaskCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; border: string; bg: string }
> = {
  transmissao: { label: 'Transmissão', icon: Radio, color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10' },
  som: { label: 'Áudio & Som', icon: Volume2, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  projecao: { label: 'Projeção & LED', icon: Tv, color: 'text-sky-400', border: 'border-sky-500/30', bg: 'bg-sky-500/10' },
  fotografia: { label: 'Fotografia', icon: Camera, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  video: { label: 'Vídeo & Reels', icon: Film, color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' },
  design_redes: { label: 'Design & Redes', icon: Palette, color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  iluminacao: { label: 'Iluminação', icon: Lightbulb, color: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
  outro: { label: 'Outro', icon: CheckSquare, color: 'text-neutral-400', border: 'border-neutral-500/30', bg: 'bg-neutral-500/10' },
};

const NOTE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  amber: { bg: 'bg-amber-950/30', border: 'border-amber-500/30', text: 'text-amber-200', badge: 'bg-amber-500/20 text-amber-300' },
  emerald: { bg: 'bg-emerald-950/30', border: 'border-emerald-500/30', text: 'text-emerald-200', badge: 'bg-emerald-500/20 text-emerald-300' },
  sky: { bg: 'bg-sky-950/30', border: 'border-sky-500/30', text: 'text-sky-200', badge: 'bg-sky-500/20 text-sky-300' },
  rose: { bg: 'bg-rose-950/30', border: 'border-rose-500/30', text: 'text-rose-200', badge: 'bg-rose-500/20 text-rose-300' },
  purple: { bg: 'bg-purple-950/30', border: 'border-purple-500/30', text: 'text-purple-200', badge: 'bg-purple-500/20 text-purple-300' },
  stone: { bg: 'bg-neutral-900', border: 'border-neutral-800', text: 'text-neutral-200', badge: 'bg-neutral-800 text-neutral-300' },
};

export const ScheduleView: React.FC = () => {
  const {
    user,
    events,
    teamTasks,
    teamNotes,
    createTeamTask,
    updateTeamTask,
    toggleTaskComplete,
    deleteTeamTask,
    createTeamNote,
    updateTeamNote,
    deleteTeamNote,
    notify,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'my_schedule' | 'tasks' | 'events' | 'notes'>('my_schedule');
  const [teamMembers, setTeamMembers] = useState<UserType[]>([]);

  // Filters for General Tasks tab
  const [searchQuery, setSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Filters for Personal Tab
  const [personalStatusFilter, setPersonalStatusFilter] = useState<'all' | 'pendente' | 'em_andamento' | 'concluido'>('all');
  const [personalSearchQuery, setPersonalSearchQuery] = useState('');

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const [initialEventForTask, setInitialEventForTask] = useState<ChurchEvent | null>(null);

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<TeamNote | null>(null);

  // Load team users for member assignment
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const users = await api.getUsers();
        setTeamMembers(users);
      } catch (err) {
        console.warn('Could not load team members:', err);
      }
    };
    loadMembers();
  }, []);

  // 1. Tasks strictly assigned to the current user (Personal Schedule)
  const myTasks = teamTasks.filter((t) => {
    if (!user) return false;
    const uidMatch = Boolean(t.assignedToUid && (t.assignedToUid === user.uid || t.assignedToUid === user.id));
    const emailMatch = Boolean(user.email && t.assignedToEmail && t.assignedToEmail.trim().toLowerCase() === user.email.trim().toLowerCase());
    const nameMatch = Boolean(user.name && t.assignedToName && t.assignedToName.trim().toLowerCase() === user.name.trim().toLowerCase());
    return uidMatch || emailMatch || nameMatch;
  });

  const myPendingTasks = myTasks.filter((t) => t.status === 'pendente').length;
  const myInProgressTasks = myTasks.filter((t) => t.status === 'em_andamento').length;
  const myCompletedTasks = myTasks.filter((t) => t.status === 'concluido').length;

  // Filtered personal tasks
  const filteredMyTasks = myTasks.filter((task) => {
    if (personalStatusFilter !== 'all' && task.status !== personalStatusFilter) return false;
    if (personalSearchQuery.trim()) {
      const q = personalSearchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q);
      const matchCreator = task.createdByName?.toLowerCase().includes(q);
      const matchEvent = task.eventName?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCreator && !matchEvent) return false;
    }
    return true;
  });

  // Events where user is in responsibles or has tasks
  const myEvents = events.filter((ev) => {
    if (!user) return false;
    const userNameClean = user.name?.trim().toLowerCase();
    const userEmailClean = user.email?.trim().toLowerCase();
    const inResp = ev.responsibles && ev.responsibles.some((r) => {
      const rClean = r.trim().toLowerCase();
      return rClean === userNameClean || (userEmailClean && rClean === userEmailClean) || (userNameClean && rClean.includes(userNameClean));
    });
    const hasEventTask = myTasks.some((t) => (t.eventId && t.eventId === ev.id) || (t.eventName && ev.name && t.eventName.trim().toLowerCase() === ev.name.trim().toLowerCase()));
    return Boolean(inResp || hasEventTask);
  });

  // 2. Visible tasks in General List respecting privacy rules
  // Private tasks are only visible to super_admin, the assignee, or the creator
  const visibleTasks = teamTasks.filter((task) => {
    if (task.isPrivate) {
      const isSuper = user?.role === 'super_admin';
      const isAssignee =
        Boolean(task.assignedToUid && (task.assignedToUid === user?.uid || task.assignedToUid === user?.id)) ||
        Boolean(user?.email && task.assignedToEmail?.trim().toLowerCase() === user.email.trim().toLowerCase()) ||
        Boolean(user?.name && task.assignedToName?.trim().toLowerCase() === user.name.trim().toLowerCase());
      const isCreator =
        Boolean(task.createdByUid && (task.createdByUid === user?.uid || task.createdByUid === user?.id)) ||
        Boolean(user?.name && task.createdByName?.trim().toLowerCase() === user.name.trim().toLowerCase());
      if (!isSuper && !isAssignee && !isCreator) return false;
    }
    return true;
  });

  // Filtered tasks in general tab
  const filteredTasks = visibleTasks.filter((task) => {
    if (memberFilter !== 'all') {
      if (memberFilter === 'my_tasks' && task.assignedToUid !== user?.uid) return false;
      if (memberFilter !== 'my_tasks' && task.assignedToUid !== memberFilter) return false;
    }
    if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q);
      const matchMember = task.assignedToName?.toLowerCase().includes(q);
      const matchCreator = task.createdByName?.toLowerCase().includes(q);
      const matchEvent = task.eventName?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchMember && !matchCreator && !matchEvent) return false;
    }

    return true;
  });

  // Filtered notes
  const filteredNotes = teamNotes.filter((note) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(q);
      const matchContent = note.content.toLowerCase().includes(q);
      const matchCategory = note.category?.toLowerCase().includes(q);
      const matchTag = note.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchCategory && !matchTag) return false;
    }
    return true;
  });

  const totalTasks = teamTasks.length;
  const pendingTasks = teamTasks.filter((t) => t.status === 'pendente').length;
  const inProgressTasks = teamTasks.filter((t) => t.status === 'em_andamento').length;
  const completedTasks = teamTasks.filter((t) => t.status === 'concluido').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight">
                Central de Agenda & Escalas da Equipe
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Tempo Real
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Aba pessoal para cada usuário, tarefas privadas destinadas, escalas de cultos e exportação profissional em PDF.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 self-start lg:self-center flex-wrap">
          {activeSubTab === 'my_schedule' && (
            <button
              onClick={() => {
                if (user) {
                  exportUserSchedulePDF(user, myTasks, myEvents);
                  notify('Gerando PDF profissional da sua escala pessoal...', 'info');
                }
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs whitespace-nowrap cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Baixar Minha Escala em PDF</span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingTask(null);
              setInitialEventForTask(null);
              setIsTaskModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Afazer / Escala</span>
          </button>

          <button
            onClick={() => {
              setEditingNote(null);
              setIsNoteModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-medium rounded-xl transition-all active:scale-95 text-xs whitespace-nowrap cursor-pointer"
          >
            <StickyNote className="w-4 h-4 text-amber-400" />
            <span>Nova Anotação</span>
          </button>
        </div>
      </div>

      {/* 2. Stats Summary Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
              Minhas Atribuições
            </span>
            <span className="text-xl font-bold font-mono-numbers text-amber-400">{myTasks.length}</span>
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
              Meus Afazeres Pendentes
            </span>
            <span className="text-xl font-bold font-mono-numbers text-neutral-100">{myPendingTasks}</span>
          </div>
          <div className="p-2 rounded-lg bg-neutral-800 text-neutral-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
              Total Geral da Equipe
            </span>
            <span className="text-xl font-bold font-mono-numbers text-neutral-200">{totalTasks}</span>
          </div>
          <div className="p-2 rounded-lg bg-neutral-800 text-neutral-400">
            <ListTodo className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
              Cultos Agendados
            </span>
            <span className="text-xl font-bold font-mono-numbers text-sky-400">{events.length}</span>
          </div>
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
            <Calendar className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs with Dedicated Personal Tab */}
      <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-xl w-fit flex-wrap">
        <button
          onClick={() => setActiveSubTab('my_schedule')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'my_schedule'
              ? 'bg-amber-400 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Minha Escala & Afazeres ({myTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'tasks'
              ? 'bg-amber-400 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <ListTodo className="w-4 h-4" />
          <span>Escala Geral da Equipe ({visibleTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('events')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'events'
              ? 'bg-amber-400 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Cultos & Eventos Agendados ({events.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('notes')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeSubTab === 'notes'
              ? 'bg-amber-400 text-neutral-950 shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <StickyNote className="w-4 h-4" />
          <span>Mural de Anotações ({teamNotes.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB 1 CONTENT: MINHA ESCALA PESSOAL & AFAZERES DESTINADOS              */}
      {/* ========================================================================= */}
      {activeSubTab === 'my_schedule' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Member Profile Overview Banner with PDF Action */}
          <div className="p-5 bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/20 border border-neutral-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-amber-400"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-base">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-neutral-900" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-neutral-100">{user?.name}</h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {user?.roleLabel || 'Membro da Mídia'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {user?.email} · Suas escalas, tarefas privadas solicitadas e afazeres operacionais.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-center">
              <button
                onClick={() => {
                  if (user) {
                    exportUserSchedulePDF(user, myTasks, myEvents);
                    notify('Baixando PDF profissional da sua escala...', 'success');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Baixar PDF da Minha Escala</span>
              </button>
            </div>
          </div>

          {/* Personal Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-neutral-900 border border-neutral-800 rounded-xl">
            {/* Status Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setPersonalStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  personalStatusFilter === 'all'
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Todos ({myTasks.length})
              </button>
              <button
                onClick={() => setPersonalStatusFilter('pendente')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  personalStatusFilter === 'pendente'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-neutral-400 hover:text-amber-300'
                }`}
              >
                Pendentes ({myPendingTasks})
              </button>
              <button
                onClick={() => setPersonalStatusFilter('em_andamento')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  personalStatusFilter === 'em_andamento'
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                    : 'text-neutral-400 hover:text-sky-300'
                }`}
              >
                Em Andamento ({myInProgressTasks})
              </button>
              <button
                onClick={() => setPersonalStatusFilter('concluido')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  personalStatusFilter === 'concluido'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-emerald-300'
                }`}
              >
                Concluídos ({myCompletedTasks})
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar nas minhas tarefas..."
                value={personalSearchQuery}
                onChange={(e) => setPersonalSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-xs placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Personal Tasks Grid */}
          {filteredMyTasks.length === 0 ? (
            <div className="p-10 text-center bg-neutral-900 border border-neutral-800 rounded-2xl">
              <UserCheck className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-neutral-300">Nenhum afazer atribuído a você</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Você não possui tarefas pendentes nesta categoria. Todas as tarefas e escalas solicitadas para você aparecerão aqui de forma privada.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMyTasks.map((task) => {
                const cat = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.outro;
                const CatIcon = cat.icon;
                const isDone = task.status === 'concluido';
                const isUrgent = task.priority === 'urgente';

                return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between group ${
                      isDone
                        ? 'bg-neutral-900/40 border-neutral-800/60 opacity-80'
                        : isUrgent
                        ? 'bg-neutral-900 border-red-500/40 hover:border-red-500/60 shadow-xs'
                        : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Top Badges: Category, Privacy & PDF Download Button */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cat.bg} ${cat.color} ${cat.border}`}
                          >
                            <CatIcon className="w-3 h-3" />
                            <span>{cat.label}</span>
                          </span>

                          {task.isPrivate && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Privada</span>
                            </span>
                          )}
                        </div>

                        {/* Direct PDF Download Action Button on Task */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const relatedEvent = events.find((e) => e.id === task.eventId || e.name === task.eventName);
                              exportIndividualTaskPDF(task, relatedEvent);
                              notify(`Baixando PDF da tarefa "${task.title}"...`, 'info');
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Baixar Ordem de Serviço em PDF desta tarefa"
                          >
                            <FileDown className="w-3 h-3" />
                            <span>PDF</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditingTask(task);
                              setIsTaskModalOpen(true);
                            }}
                            className="p-1 text-neutral-400 hover:text-neutral-200 rounded hover:bg-neutral-800"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title & Checkbox */}
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => toggleTaskComplete(task.id, task.status)}
                          className={`mt-0.5 shrink-0 transition-colors cursor-pointer ${
                            isDone ? 'text-emerald-400 hover:text-emerald-300' : 'text-neutral-500 hover:text-amber-400'
                          }`}
                        >
                          {isDone ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <h4
                            className={`text-sm font-semibold text-neutral-100 leading-snug ${
                              isDone ? 'line-through text-neutral-400' : ''
                            }`}
                          >
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Event link if any */}
                      {task.eventName && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-neutral-800/80 border border-neutral-700/60 text-[11px] text-neutral-300">
                          <Calendar className="w-3 h-3 text-amber-400" />
                          <span className="truncate max-w-[200px]">{task.eventName}</span>
                        </div>
                      )}

                      {/* Checklist */}
                      {task.checklist && task.checklist.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-neutral-800 space-y-1.5">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                            Afazeres da Etapa ({task.checklist.filter((c) => c.completed).length}/{task.checklist.length})
                          </span>
                          {task.checklist.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => {
                                const updated = task.checklist!.map((c) =>
                                  c.id === item.id ? { ...c, completed: !c.completed } : c
                                );
                                updateTeamTask(task.id, { checklist: updated });
                              }}
                              className="flex items-center gap-2 text-xs text-neutral-300 hover:text-white cursor-pointer select-none"
                            >
                              <div
                                className={`w-3 h-3 rounded-xs border flex items-center justify-center shrink-0 ${
                                  item.completed
                                    ? 'bg-emerald-500 border-emerald-500 text-neutral-950'
                                    : 'border-neutral-600 hover:border-amber-400'
                                }`}
                              >
                                {item.completed && <CheckCircle2 className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className={item.completed ? 'line-through text-neutral-500 text-[11px]' : 'text-[11px]'}>
                                {item.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Metadata: Quem Solicitou & Prazo */}
                    <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2 text-xs text-neutral-400">
                      {/* Solicitante (Quem destinou a tarefa) */}
                      <div className="flex items-center gap-1.5 min-w-0" title={`Solicitado por: ${task.createdByName}`}>
                        <span className="text-[10px] text-neutral-500">Por:</span>
                        <span className="truncate text-[11px] font-medium text-amber-300/90">
                          {task.createdByName || 'Liderança'}
                        </span>
                      </div>

                      {/* Due date */}
                      <div className="flex items-center gap-1 text-[11px] font-mono-numbers shrink-0">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        <span>{formatDate(task.dueDate)}</span>
                        {task.dueTime && <span className="text-neutral-500">às {task.dueTime}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Associated Events for Current User */}
          {myEvents.length > 0 && (
            <div className="mt-6 pt-5 border-t border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-200">
                    Cultos & Eventos Escalados para Você
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Eventos onde você está nominalmente escalado na equipe técnica de mídia.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {myEvents.map((evt) => {
                  const eventTasks = myTasks.filter((t) => t.eventId === evt.id || t.eventName === evt.name);
                  return (
                    <div
                      key={evt.id}
                      className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">
                          {evt.category}
                        </span>
                        <h4 className="text-xs font-bold text-neutral-100 truncate mt-0.5">{evt.name}</h4>
                        <span className="text-[11px] text-neutral-400 font-mono-numbers">
                          {formatDate(evt.date)}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          exportEventSchedulePDF(evt, eventTasks);
                          notify(`Baixando escala do evento "${evt.name}"...`, 'info');
                        }}
                        className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer border border-neutral-700"
                        title="Baixar PDF da escala deste culto"
                      >
                        <FileDown className="w-3.5 h-3.5 text-amber-400" />
                        <span>PDF</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 2 CONTENT: ESCALA GERAL DA EQUIPE (COM FILTRO DE PRIVACIDADE)       */}
      {/* ========================================================================= */}
      {activeSubTab === 'tasks' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Info & PDF Export of General Schedule */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl">
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-neutral-200">
                Escala Geral de Tarefas da Equipe de Mídia
              </h3>
              <p className="text-[11px] text-neutral-400">
                Tarefas privadas são exibidas somente aos seus respectivos responsáveis e solicitantes.
              </p>
            </div>

            <button
              onClick={() => {
                exportUserSchedulePDF(
                  { name: 'Equipe de Mídia - Geral', email: 'contato@pibt.org.br', roleLabel: 'Escala Consolidada' },
                  filteredTasks,
                  events
                );
                notify('Exportando relatório consolidado da equipe em PDF...', 'info');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-semibold self-start sm:self-auto transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-amber-400" />
              <span>Exportar Lista em PDF</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3 p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar por afazer, membro, quem solicitou ou culto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-xs placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Member filter */}
              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">Todos os Membros</option>
                <option value="my_tasks">👤 Apenas Minhas Tarefas</option>
                {teamMembers.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.name}
                  </option>
                ))}
              </select>

              {/* Category filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">Todas as Funções</option>
                <option value="transmissao">Transmissão</option>
                <option value="som">Áudio & Som</option>
                <option value="projecao">Projeção & LED</option>
                <option value="fotografia">Fotografia</option>
                <option value="video">Vídeo & Reels</option>
                <option value="design_redes">Design & Redes</option>
                <option value="iluminacao">Iluminação</option>
                <option value="outro">Outro</option>
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="all">Todos os Status</option>
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
              </select>

              {(memberFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setMemberFilter('all');
                    setCategoryFilter('all');
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-2.5 py-2 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Tasks Grid */}
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900 border border-neutral-800 rounded-2xl">
              <ListTodo className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-neutral-300">Nenhum afazer encontrado</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Não há trabalhos ou escalas correspondentes aos filtros. Clique em "+ Novo Afazer / Escala" para agendar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredTasks.map((task) => {
                const cat = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.outro;
                const CatIcon = cat.icon;
                const isDone = task.status === 'concluido';
                const isUrgent = task.priority === 'urgente';

                return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between group ${
                      isDone
                        ? 'bg-neutral-900/40 border-neutral-800/60 opacity-75'
                        : isUrgent
                        ? 'bg-neutral-900 border-red-500/40 hover:border-red-500/60 shadow-xs'
                        : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Top Badges: Category & Privacy & Actions */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cat.bg} ${cat.color} ${cat.border}`}
                          >
                            <CatIcon className="w-3 h-3" />
                            <span>{cat.label}</span>
                          </span>

                          {task.isPrivate ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Privada</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-400">
                              <Globe className="w-2.5 h-2.5" />
                              <span>Pública</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Direct PDF Download Action */}
                          <button
                            onClick={() => {
                              const relatedEvent = events.find((e) => e.id === task.eventId || e.name === task.eventName);
                              exportIndividualTaskPDF(task, relatedEvent);
                              notify(`Baixando PDF da tarefa "${task.title}"...`, 'info');
                            }}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-md text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Baixar Ordem de Serviço em PDF desta tarefa"
                          >
                            <FileDown className="w-3 h-3" />
                            <span>PDF</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditingTask(task);
                              setIsTaskModalOpen(true);
                            }}
                            className="p-1 text-neutral-400 hover:text-neutral-200 rounded hover:bg-neutral-800"
                            title="Editar afazer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Deseja remover "${task.title}"?`)) {
                                deleteTeamTask(task.id);
                              }
                            }}
                            className="p-1 text-neutral-400 hover:text-red-400 rounded hover:bg-neutral-800"
                            title="Excluir afazer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title & Checkbox */}
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => toggleTaskComplete(task.id, task.status)}
                          className={`mt-0.5 shrink-0 transition-colors cursor-pointer ${
                            isDone ? 'text-emerald-400 hover:text-emerald-300' : 'text-neutral-500 hover:text-amber-400'
                          }`}
                        >
                          {isDone ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>

                        <div className="flex-1 min-w-0">
                          <h4
                            className={`text-sm font-semibold text-neutral-100 leading-snug ${
                              isDone ? 'line-through text-neutral-400' : ''
                            }`}
                          >
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Event link */}
                      {task.eventName && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-neutral-800/80 border border-neutral-700/60 text-[11px] text-neutral-300">
                          <Calendar className="w-3 h-3 text-amber-400" />
                          <span className="truncate max-w-[200px]">{task.eventName}</span>
                        </div>
                      )}

                      {/* Checklist */}
                      {task.checklist && task.checklist.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-neutral-800 space-y-1.5">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                            Etapas ({task.checklist.filter((c) => c.completed).length}/{task.checklist.length})
                          </span>
                          {task.checklist.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => {
                                const updated = task.checklist!.map((c) =>
                                  c.id === item.id ? { ...c, completed: !c.completed } : c
                                );
                                updateTeamTask(task.id, { checklist: updated });
                              }}
                              className="flex items-center gap-2 text-xs text-neutral-300 hover:text-white cursor-pointer select-none"
                            >
                              <div
                                className={`w-3 h-3 rounded-xs border flex items-center justify-center shrink-0 ${
                                  item.completed
                                    ? 'bg-emerald-500 border-emerald-500 text-neutral-950'
                                    : 'border-neutral-600 hover:border-amber-400'
                                }`}
                              >
                                {item.completed && <CheckCircle2 className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className={item.completed ? 'line-through text-neutral-500 text-[11px]' : 'text-[11px]'}>
                                {item.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Info: Destinatário & Solicitante (Quem destinou) */}
                    <div className="mt-4 pt-3 border-t border-neutral-800/80 space-y-1.5 text-xs text-neutral-400">
                      <div className="flex items-center justify-between gap-2">
                        {/* Destinatário */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          {task.assignedToAvatar ? (
                            <img
                              src={task.assignedToAvatar}
                              alt={task.assignedToName}
                              className="w-5 h-5 rounded-full object-cover border border-neutral-700"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                              {task.assignedToName?.charAt(0) || 'M'}
                            </div>
                          )}
                          <span className="truncate text-[11px] font-medium text-neutral-200">
                            {task.assignedToName}
                          </span>
                        </div>

                        {/* Due date */}
                        <div className="flex items-center gap-1 text-[11px] font-mono-numbers shrink-0">
                          <Clock className="w-3 h-3 text-neutral-500" />
                          <span>{formatDate(task.dueDate)}</span>
                          {task.dueTime && <span className="text-neutral-500">às {task.dueTime}</span>}
                        </div>
                      </div>

                      {/* Quem destinou a tarefa */}
                      <div className="flex items-center gap-1 text-[10px] text-neutral-500 truncate">
                        <span>Destinado por:</span>
                        <span className="text-amber-400 font-medium">{task.createdByName || 'Liderança de Mídia'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 3 CONTENT: CULTOS & EVENTOS COM BOTÃO DE DOWNLOAD PDF              */}
      {/* ========================================================================= */}
      {activeSubTab === 'events' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">
                Escala Operacional por Culto / Evento
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Veja as atribuições da equipe diretamente vinculadas a cada culto agendado e baixe a ficha completa em PDF.
              </p>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center bg-neutral-900 border border-neutral-800 rounded-2xl">
              <Calendar className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
              <p className="text-sm text-neutral-300">Nenhum evento da igreja agendado no momento.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((evt) => {
                const eventTasks = teamTasks.filter((t) => t.eventId === evt.id || t.eventName === evt.name);
                const completedCount = eventTasks.filter((t) => t.status === 'concluido').length;

                return (
                  <div
                    key={evt.id}
                    className="p-5 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-sm space-y-4"
                  >
                    {/* Event Header with PDF Export */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-neutral-100">{evt.name}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 text-neutral-300">
                              {evt.category}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Data: <span className="text-neutral-200 font-mono-numbers">{formatDate(evt.date)}</span>
                            {evt.responsibles?.length > 0 && ` · Responsáveis: ${evt.responsibles.join(', ')}`}
                          </p>
                        </div>
                      </div>

                      {/* Actions: Download Event PDF & Escalar Membro */}
                      <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                        <button
                          onClick={() => {
                            exportEventSchedulePDF(evt, eventTasks);
                            notify(`Baixando PDF oficial da escala do evento "${evt.name}"...`, 'info');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                          title="Baixar escala oficial deste culto em PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Baixar Escala em PDF</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingTask(null);
                            setInitialEventForTask(evt);
                            setIsTaskModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-400" />
                          <span>Escalar Membro</span>
                        </button>
                      </div>
                    </div>

                    {/* Event Tasks List */}
                    {eventTasks.length === 0 ? (
                      <div className="py-4 text-center border border-dashed border-neutral-800 rounded-xl text-neutral-500 text-xs">
                        Nenhum afazer escalado para este evento ainda. Clique em "Escalar Membro" acima.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {eventTasks.map((task) => {
                          const cat = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.outro;
                          const isDone = task.status === 'concluido';
                          return (
                            <div
                              key={task.id}
                              className={`p-3 rounded-xl border flex items-start justify-between gap-2.5 transition-all ${
                                isDone
                                  ? 'bg-neutral-950/40 border-neutral-800/60 opacity-75'
                                  : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <button
                                  onClick={() => toggleTaskComplete(task.id, task.status)}
                                  className={`mt-0.5 shrink-0 ${
                                    isDone ? 'text-emerald-400' : 'text-neutral-500 hover:text-amber-400'
                                  }`}
                                >
                                  {isDone ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                </button>

                                <div className="min-w-0">
                                  <span className={`text-xs font-medium block truncate ${isDone ? 'line-through text-neutral-400' : 'text-neutral-200'}`}>
                                    {task.title}
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-neutral-400 flex-wrap">
                                    <span className={cat.color}>{cat.label}</span>
                                    <span>·</span>
                                    <span className="text-neutral-300">{task.assignedToName}</span>
                                    {task.isPrivate && (
                                      <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                                        <Lock className="w-2.5 h-2.5" />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => {
                                  exportIndividualTaskPDF(task, evt);
                                  notify(`Baixando PDF da tarefa "${task.title}"...`, 'info');
                                }}
                                className="p-1 text-neutral-400 hover:text-amber-400 rounded shrink-0"
                                title="Baixar Ordem de Serviço em PDF"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Progress Bar */}
                    {eventTasks.length > 0 && (
                      <div className="pt-2 flex items-center justify-between text-xs text-neutral-400">
                        <span>
                          Progresso da Equipe: <strong className="text-neutral-200">{completedCount} de {eventTasks.length} tarefas</strong> concluídas
                        </span>
                        <div className="w-32 bg-neutral-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-amber-400 h-full rounded-full transition-all"
                            style={{ width: `${(completedCount / eventTasks.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TAB 4 CONTENT: MURAL DE ANOTAÇÕES COLABORATIVAS                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'notes' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">
                Mural de Anotações & Alinhamentos em Tempo Real
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Bloco de notas coletivo da mídia: atas rápidas, avisos de culto, protocolos de emergência e ideias.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingNote(null);
                setIsNoteModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Nota</span>
            </button>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900 border border-neutral-800 rounded-2xl">
              <StickyNote className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-neutral-300">Nenhuma anotação no mural</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Crie a primeira anotação para compartilhar lembretes, padrões de gravação ou atas de reunião com a equipe.
              </p>
              <button
                onClick={() => {
                  setEditingNote(null);
                  setIsNoteModalOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs hover:bg-amber-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar Anotação</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNotes.map((note) => {
                const colorScheme = NOTE_COLORS[note.color || 'amber'] || NOTE_COLORS.amber;

                return (
                  <div
                    key={note.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${colorScheme.bg} ${colorScheme.border} shadow-sm group hover:scale-[1.01]`}
                  >
                    <div>
                      {/* Note Header: Category, Pin & Actions */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5">
                          {note.category && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${colorScheme.badge}`}>
                              {note.category}
                            </span>
                          )}
                          {note.isPinned && (
                            <span className="p-1 text-amber-400" title="Anotação Fixada no Topo">
                              <Pin className="w-3.5 h-3.5 fill-amber-400 rotate-45" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingNote(note);
                              setIsNoteModalOpen(true);
                            }}
                            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800/60 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Deseja excluir esta anotação?')) {
                                deleteTeamNote(note.id);
                              }
                            }}
                            className="p-1 text-neutral-400 hover:text-red-400 rounded hover:bg-neutral-800/60 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Note Title */}
                      <h4 className="text-base font-bold text-neutral-100 mb-2 leading-snug">
                        {note.title}
                      </h4>

                      {/* Note Body */}
                      <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </p>

                      {/* Tags */}
                      {note.tags && note.tags.length > 0 && (
                        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                          {note.tags.map((t, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-black/30 text-[10px] text-neutral-400 border border-white/5"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Note Footer */}
                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
                      <span>Por {note.authorName}</span>
                      <span className="font-mono-numbers">{formatDate(note.updatedAt || note.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 8. Modal: Task Create / Edit */}
      {isTaskModalOpen && (
        <TaskModal
          task={editingTask}
          initialEvent={initialEventForTask}
          teamMembers={teamMembers}
          events={events}
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSave={async (data) => {
            if (editingTask) {
              await updateTeamTask(editingTask.id, data);
            } else {
              await createTeamTask(data);
            }
            setIsTaskModalOpen(false);
          }}
        />
      )}

      {/* 9. Modal: Note Create / Edit */}
      {isNoteModalOpen && (
        <NoteModal
          note={editingNote}
          events={events}
          isOpen={isNoteModalOpen}
          onClose={() => setIsNoteModalOpen(false)}
          onSave={async (data) => {
            if (editingNote) {
              await updateTeamNote(editingNote.id, data);
            } else {
              await createTeamNote(data);
            }
            setIsNoteModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// TASK MODAL COMPONENT (WITH PRIVACY TOGGLE & SOLICITANTE)
// ==========================================
interface TaskModalProps {
  task: TeamTask | null;
  initialEvent: ChurchEvent | null;
  teamMembers: UserType[];
  events: ChurchEvent[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<TeamTask>) => Promise<void>;
}

const TaskModal: React.FC<TaskModalProps> = ({
  task,
  initialEvent,
  teamMembers,
  events,
  isOpen,
  onClose,
  onSave,
}) => {
  const { user } = useApp();

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [category, setCategory] = useState<TeamTaskCategory>(task?.category || 'transmissao');
  const [selectedEventId, setSelectedEventId] = useState<string>(task?.eventId || initialEvent?.id || '');
  const [assignedToUid, setAssignedToUid] = useState<string>(task?.assignedToUid || user?.uid || '');
  const [dueDate, setDueDate] = useState<string>(
    task?.dueDate || initialEvent?.date || new Date().toISOString().split('T')[0]
  );
  const [dueTime, setDueTime] = useState<string>(task?.dueTime || '18:00');
  const [priority, setPriority] = useState<TeamTaskPriority>(task?.priority || 'media');
  const [status, setStatus] = useState<TeamTaskStatus>(task?.status || 'pendente');
  const [isPrivate, setIsPrivate] = useState<boolean>(task?.isPrivate !== undefined ? task.isPrivate : true);

  // Checklist items
  const [checklist, setChecklist] = useState<{ id: string; text: string; completed: boolean }[]>(
    task?.checklist || []
  );
  const [newChecklistText, setNewChecklistText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const chosenMember = teamMembers.find((m) => m.uid === assignedToUid) || {
    uid: user?.uid || 'admin',
    name: user?.name || 'Membro da Mídia',
    email: user?.email || '',
    avatar: user?.avatar || '',
  };

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistText.trim()) return;
    setChecklist([
      ...checklist,
      { id: `c_${Date.now()}_${Math.random()}`, text: newChecklistText.trim(), completed: false },
    ]);
    setNewChecklistText('');
  };

  const handleRemoveChecklist = (id: string) => {
    setChecklist(checklist.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    try {
      setIsSubmitting(true);
      const chosenEvent = events.find((ev) => ev.id === selectedEventId);

      await onSave({
        title: title.trim(),
        description: description.trim(),
        category,
        eventId: chosenEvent ? chosenEvent.id : null,
        eventName: chosenEvent ? chosenEvent.name : null,
        assignedToUid: chosenMember.uid,
        assignedToName: chosenMember.name,
        assignedToEmail: chosenMember.email,
        assignedToAvatar: chosenMember.avatar,
        dueDate,
        dueTime,
        priority,
        status,
        isPrivate: Boolean(isPrivate),
        checklist,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-100 text-xs animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-sm">
              {task ? 'Editar Afazer / Escala' : 'Novo Afazer na Agenda'}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-neutral-300 font-medium mb-1">Título do Trabalho / Escala *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Operação do mixer de áudio no culto de celebração"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">Descrição / Instruções</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Orientações detalhadas para a execução do trabalho..."
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-medium mb-1">Função / Área Técnica</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TeamTaskCategory)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="transmissao">Transmissão</option>
                <option value="som">Áudio & Som</option>
                <option value="projecao">Projeção & LED</option>
                <option value="fotografia">Fotografia</option>
                <option value="video">Vídeo & Reels</option>
                <option value="design_redes">Design & Redes</option>
                <option value="iluminacao">Iluminação</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1">Membro Responsável (Destinatário)</label>
              <select
                value={assignedToUid}
                onChange={(e) => setAssignedToUid(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {teamMembers.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.name} ({m.roleLabel || m.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Privacy Toggle (Lock) - Explicit User Requirement */}
          <div className="p-3 bg-neutral-800/60 border border-neutral-700 rounded-xl flex items-start gap-3">
            <input
              type="checkbox"
              id="isPrivateCheck"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-amber-500 bg-neutral-900 border-neutral-700 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="isPrivateCheck" className="cursor-pointer select-none">
              <div className="flex items-center gap-1.5 font-bold text-xs text-neutral-200">
                <Lock className="w-3.5 h-3.5 text-red-400" />
                <span>Tarefa Privada da Equipe</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                Quando ativado, este afazer só aparecerá para o usuário solicitado (<span className="text-amber-300 font-medium">{chosenMember.name}</span>) e para quem destinou / liderança.
              </p>
            </label>
          </div>

          {/* Transparency: Quem destinou */}
          <div className="px-3 py-2 bg-neutral-800/40 rounded-lg border border-neutral-700/50 flex items-center justify-between text-xs text-neutral-400">
            <span>Quem está destinando esta tarefa:</span>
            <span className="font-semibold text-neutral-200">{task?.createdByName || user?.name || user?.email || 'Você'}</span>
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">Vincular a um Culto / Evento</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="">Nenhum (Tarefa de rotina independente)</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({formatDate(ev.date)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-medium mb-1">Data Prevista *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-neutral-300 font-medium mb-1">Horário</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-medium mb-1">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TeamTaskPriority)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">🚨 Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-neutral-300 font-medium mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TeamTaskStatus)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-neutral-300 font-medium mb-1">Checklist de Afazeres / Verificação</label>
            <div className="space-y-1.5 mb-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded bg-neutral-800/60 border border-neutral-700/50">
                  <span className="text-xs text-neutral-300">{item.text}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklist(item.id)}
                    className="p-1 text-neutral-500 hover:text-red-400 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Ligar mesa de som e conferir canais..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklist(e);
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 text-xs placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddChecklist}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-lg text-xs cursor-pointer"
              >
                + Adicionar
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-xl text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Salvando...' : task ? 'Salvar Alterações' : 'Criar na Escala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// NOTE MODAL COMPONENT
// ==========================================
interface NoteModalProps {
  note: TeamNote | null;
  events: ChurchEvent[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<TeamNote>) => Promise<void>;
}

const NoteModal: React.FC<NoteModalProps> = ({
  note,
  events,
  isOpen,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [category, setCategory] = useState(note?.category || 'Alinhamento');
  const [color, setColor] = useState<'amber' | 'emerald' | 'sky' | 'rose' | 'purple' | 'stone'>(
    note?.color || 'amber'
  );
  const [isPinned, setIsPinned] = useState(note ? !!note.isPinned : false);
  const [tagsInput, setTagsInput] = useState(note?.tags ? note.tags.join(', ') : 'Equipe, Mídia');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setIsSubmitting(true);
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter((t) => t.length > 0);

      await onSave({
        title: title.trim(),
        content: content.trim(),
        category,
        color,
        isPinned,
        tags,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-100 text-xs animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-sm">
              {note ? 'Editar Anotação' : 'Nova Anotação no Mural'}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-neutral-300 font-medium mb-1">Título da Nota *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Padrão de Enquadramento no Culto de Domingo"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">Conteúdo da Anotação *</label>
            <textarea
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva os detalhes, ata, lembrete ou checklist..."
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-medium mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="Alinhamento">Alinhamento</option>
                <option value="Aviso Importante">Aviso Importante</option>
                <option value="Ideias de Mídia">Ideias de Mídia</option>
                <option value="Ata de Reunião">Ata de Reunião</option>
                <option value="Checklist de Culto">Checklist de Culto</option>
              </select>
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1">Cor do Cartão</label>
              <div className="flex items-center gap-2 mt-1.5">
                {(['amber', 'emerald', 'sky', 'rose', 'purple', 'stone'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                      c === 'amber'
                        ? 'bg-amber-500'
                        : c === 'emerald'
                        ? 'bg-emerald-500'
                        : c === 'sky'
                        ? 'bg-sky-500'
                        : c === 'rose'
                        ? 'bg-rose-500'
                        : c === 'purple'
                        ? 'bg-purple-500'
                        : 'bg-neutral-600'
                    } ${color === c ? 'scale-125 border-white shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">Tags (separadas por vírgula)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Equipe, Som, Live, Alinhamento"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-300">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 bg-neutral-800 border-neutral-700 focus:ring-0 cursor-pointer"
            />
            <span>Fixar no topo do mural</span>
          </label>

          <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-xl text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Salvando...' : note ? 'Salvar Alterações' : 'Publicar Anotação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
