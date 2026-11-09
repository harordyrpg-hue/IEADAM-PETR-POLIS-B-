import React, { useState, useRef, useMemo } from 'react';
import {
  User as UserIcon,
  Camera,
  Upload,
  Check,
  Edit2,
  FileDown,
  Calendar,
  Clock,
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  X,
  FileText,
  Mail,
  Sparkles,
  Award,
  CalendarDays,
  ListTodo,
  CheckSquare,
  Square,
  Lock,
  Tag,
  Radio,
  Tv,
  Film,
  Music,
  Palette,
  Volume2,
  Lightbulb,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { TeamTask, TeamTaskCategory, TeamTaskPriority, TeamTaskStatus } from '../../types.js';
import { api } from '../../services/api.js';
import { formatDate, getRoleBadgeStyle } from '../../utils/formatters.js';
import { exportUserSchedulePDF, exportIndividualTaskPDF } from '../../utils/pdfGenerator.js';

export const ProfileView: React.FC = () => {
  const {
    user,
    updateUserProfile,
    teamTasks,
    updateTeamTask,
    toggleTaskComplete,
    createTeamTask,
    events,
    notify,
  } = useApp();

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Tasks filter state
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed' | 'private'>('all');
  const [taskSearch, setTaskSearch] = useState('');

  // New Private Task Modal state
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<TeamTaskCategory>('outro');
  const [newPriority, setNewPriority] = useState<TeamTaskPriority>('media');
  const [newDueDate, setNewDueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [newDueTime, setNewDueTime] = useState<string>('19:00');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newChecklist, setNewChecklist] = useState<string[]>([]);
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Filter tasks belonging to current user
  const myTasks = useMemo(() => {
    if (!user) return [];
    const uid = user.uid;
    const email = user.email?.toLowerCase();
    const name = user.name?.toLowerCase();

    return teamTasks
      .filter((t) => {
        return (
          t.assignedToUid === uid ||
          (email && t.assignedToEmail?.toLowerCase() === email) ||
          (name && t.assignedToName?.toLowerCase() === name)
        );
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [teamTasks, user]);

  const pendingCount = useMemo(
    () => myTasks.filter((t) => t.status !== 'concluido').length,
    [myTasks]
  );
  const completedCount = useMemo(
    () => myTasks.filter((t) => t.status === 'concluido').length,
    [myTasks]
  );
  const privateCount = useMemo(
    () => myTasks.filter((t) => t.isPrivate === true).length,
    [myTasks]
  );

  const filteredTasks = useMemo(() => {
    return myTasks.filter((t) => {
      if (taskFilter === 'pending' && t.status === 'concluido') return false;
      if (taskFilter === 'completed' && t.status !== 'concluido') return false;
      if (taskFilter === 'private' && !t.isPrivate) return false;

      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchEvent = t.eventName?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchEvent) return false;
      }

      return true;
    });
  }, [myTasks, taskFilter, taskSearch]);

  const roleStyle = user ? getRoleBadgeStyle(user.role) : { label: '', textClass: '', borderClass: '' };

  // Handle Photo Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      notify('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).', 'error');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      notify('Enviando nova foto de perfil...', 'info');

      // Upload and optimize avatar
      const avatarUrl = await api.uploadAvatar(file);

      // Save to user profile
      await updateUserProfile({ avatar: avatarUrl });
      notify('Foto de perfil atualizada com sucesso!', 'success');
    } catch {
      notify('Erro ao atualizar foto de perfil.', 'error');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Name Save
  const handleSaveName = async () => {
    if (!user || !editedName.trim() || editedName.trim() === user.name) {
      setIsEditingName(false);
      return;
    }

    try {
      setIsSavingName(true);
      await updateUserProfile({ name: editedName.trim() });
      notify('Nome atualizado com sucesso!', 'success');
      setIsEditingName(false);
    } catch {
      notify('Erro ao atualizar nome.', 'error');
    } finally {
      setIsSavingName(false);
    }
  };

  // Handle Export Full Schedule PDF
  const handleExportSchedulePDF = () => {
    if (!user) return;
    if (myTasks.length === 0) {
      notify('Você não possui tarefas ou escalas cadastradas no momento.', 'info');
      return;
    }

    notify('Gerando PDF da sua escala pessoal...', 'info');
    exportUserSchedulePDF(
      {
        name: user.name,
        email: user.email,
        roleLabel: user.roleLabel,
      },
      myTasks,
      events
    );
  };

  // Handle Export Single Task PDF
  const handleExportTaskPDF = (task: TeamTask) => {
    notify(`Gerando PDF da tarefa "${task.title}"...`, 'info');
    const relatedEvent = task.eventId
      ? events.find((e) => e.id === task.eventId)
      : (task.eventName ? events.find((e) => e.name === task.eventName) : null);
    exportIndividualTaskPDF(task, relatedEvent || null);
  };

  // Handle Add Checklist item in New Task Modal
  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setNewChecklist((prev) => [...prev, newChecklistText.trim()]);
    setNewChecklistText('');
  };

  // Handle Save New Private Task
  const handleSavePrivateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;

    try {
      setIsSavingTask(true);
      await createTeamTask({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        category: newCategory,
        priority: newPriority,
        dueDate: newDueDate,
        dueTime: newDueTime,
        assignedToUid: user.uid,
        assignedToName: user.name,
        assignedToEmail: user.email,
        assignedToAvatar: user.avatar,
        status: 'pendente',
        isPrivate: true,
        checklist: newChecklist.map((text, idx) => ({
          id: `chk_${Date.now()}_${idx}`,
          text,
          completed: false,
        })),
      });

      notify('Afazer privado criado com sucesso!', 'success');
      setIsNewTaskOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewChecklist([]);
    } catch {
      notify('Erro ao criar afazer privado.', 'error');
    } finally {
      setIsSavingTask(false);
    }
  };

  const getCategoryIcon = (category: TeamTaskCategory) => {
    switch (category) {
      case 'projecao':
        return <Tv className="w-3.5 h-3.5 text-amber-400" />;
      case 'video':
        return <Film className="w-3.5 h-3.5 text-blue-400" />;
      case 'transmissao':
        return <Radio className="w-3.5 h-3.5 text-rose-400" />;
      case 'som':
        return <Volume2 className="w-3.5 h-3.5 text-purple-400" />;
      case 'fotografia':
        return <Camera className="w-3.5 h-3.5 text-emerald-400" />;
      case 'design_redes':
        return <Palette className="w-3.5 h-3.5 text-orange-400" />;
      case 'iluminacao':
        return <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />;
      default:
        return <ListTodo className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  if (!user) {
    return (
      <div className="p-8 text-center text-neutral-400 text-xs">
        Carregando dados do perfil...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Identity Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight">
                Meu Perfil & Central do Membro
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${roleStyle.textClass} ${roleStyle.borderClass} bg-neutral-800/80`}>
                {user.roleLabel}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Gerencie seus dados pessoais, altere foto e nome, consulte sua escala de cultos e baixe seus afazeres em PDF.
            </p>
          </div>
        </div>

        {/* Global Export PDF Button */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          <button
            onClick={handleExportSchedulePDF}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            title="Baixar escala completa e afazeres em PDF"
          >
            <FileDown className="w-4 h-4" />
            <span>Baixar Minha Escala em PDF</span>
          </button>
        </div>
      </div>

      {/* 2. User Profile Card & Role Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Card: Photo & Name Editing */}
        <div className="lg:col-span-1 p-6 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col items-center text-center space-y-4 shadow-xs">
          {/* Avatar with Camera Trigger */}
          <div className="relative group">
            <img
              src={
                user.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80'
              }
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover ring-4 ring-amber-500/30 border-2 border-neutral-800 shadow-xl"
            />

            {/* Hover/Touch Overlay */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute inset-0 rounded-full bg-black/60 flex flex-col items-center justify-center text-amber-400 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-50"
              title="Trocar foto do perfil"
            >
              <Camera className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                {isUploadingAvatar ? 'Enviando...' : 'Trocar Foto'}
              </span>
            </button>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAvatar}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 underline underline-offset-4 cursor-pointer disabled:opacity-50"
          >
            {isUploadingAvatar ? 'Enviando nova foto...' : 'Fazer upload de nova foto'}
          </button>

          {/* Name Display & Editing */}
          <div className="w-full pt-2 border-t border-neutral-800/80">
            {isEditingName ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  autoFocus
                />
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSavingName ? 'Salvando...' : 'Salvar'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditedName(user.name);
                      setIsEditingName(false);
                    }}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-lg font-bold text-neutral-100 truncate">{user.name}</h2>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 text-neutral-400 hover:text-amber-400 rounded-md transition-colors cursor-pointer"
                  title="Editar nome"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-400 mt-1">
              <Mail className="w-3.5 h-3.5 text-neutral-400" />
              <span>{user.email}</span>
            </div>
          </div>
        </div>

        {/* Right Cards: Cargo / Role Details & Permissions */}
        <div className="lg:col-span-2 space-y-4">
          {/* Cargo Details Card */}
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-neutral-100 uppercase tracking-wider">
                  Cargo & Atribuições na Igreja
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${roleStyle.textClass} ${roleStyle.borderClass} bg-neutral-800/90`}>
                {user.roleLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                  Ministério / Equipe
                </span>
                <p className="font-semibold text-neutral-200">PT-B Mídia & Comunicação</p>
                <p className="text-[11px] text-neutral-400">IEADAM Petrópolis B</p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">
                  Status da Conta
                </span>
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Membro Ativo & Verificado</span>
                </div>
                <p className="text-[11px] text-neutral-400">Sincronização em tempo real</p>
              </div>
            </div>

            {/* Permissions summary */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                Permissões do seu Cargo:
              </span>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-300">
                <li className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/80">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Upload e Download de fotos e vídeos em 4K</span>
                </li>
                <li className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/80">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Acesso à agenda oficial e escalas de cultos</span>
                </li>
                <li className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/80">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Gerenciamento de afazeres privados e notas</span>
                </li>
                {user.role === 'super_admin' && (
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Acesso Total Super Admin (Usuários, Configs)</span>
                  </li>
                )}
                {(user.role === 'super_admin' || user.canManageChurchPage) && (
                  <li className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/80">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Gerenciamento do Site Público da Igreja</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Escala Pessoal & Afazeres Privados */}
      <div className="space-y-4">
        {/* Section Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
          <div>
            <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-amber-400" />
              <span>Minha Escala & Afazeres Pessoais</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Visualize suas tarefas atribuídas, marque como concluídas ou exporte a lista completa em PDF.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setIsNewTaskOpen(true)}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Novo Afazer Privado</span>
            </button>

            <button
              onClick={handleExportSchedulePDF}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Baixar Escala (PDF)</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-xl w-fit">
            <button
              onClick={() => setTaskFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                taskFilter === 'all'
                  ? 'bg-amber-400 text-neutral-950 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Todas ({myTasks.length})
            </button>
            <button
              onClick={() => setTaskFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                taskFilter === 'pending'
                  ? 'bg-amber-400 text-neutral-950 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              onClick={() => setTaskFilter('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                taskFilter === 'completed'
                  ? 'bg-amber-400 text-neutral-950 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Concluídas ({completedCount})
            </button>
            <button
              onClick={() => setTaskFilter('private')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                taskFilter === 'private'
                  ? 'bg-amber-400 text-neutral-950 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Afazeres Privados ({privateCount})
            </button>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Filtrar tarefas..."
              className="w-full px-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40"
            />
          </div>
        </div>

        {/* Tasks List */}
        {filteredTasks.length === 0 ? (
          <div className="p-10 text-center rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs space-y-2">
            <ListTodo className="w-8 h-8 mx-auto text-neutral-400" />
            <p className="font-semibold text-neutral-300">Nenhuma tarefa encontrada neste filtro</p>
            <p className="text-neutral-400 max-w-sm mx-auto">
              Quando um administrador atribuir tarefas ou escalas para você, ou quando você criar seus afazeres privados, eles aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredTasks.map((task) => {
              const isCompleted = task.status === 'concluido';
              const isInProgress = task.status === 'em_andamento';

              return (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                    isCompleted
                      ? 'bg-neutral-900/60 border-neutral-800/80 opacity-80'
                      : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 shadow-xs'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Top bar: Category + Private Badge + Event Name */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="p-1 rounded bg-neutral-800 border border-neutral-700/60">
                          {getCategoryIcon(task.category)}
                        </span>
                        <span className="text-[11px] font-semibold text-neutral-300 capitalize">
                          {task.category}
                        </span>
                        {task.isPrivate && (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Privado</span>
                          </span>
                        )}
                      </div>

                      {task.eventName && (
                        <span className="text-[11px] text-amber-400 font-medium truncate max-w-[160px]">
                          {task.eventName}
                        </span>
                      )}
                    </div>

                    {/* Task Title & Description */}
                    <div>
                      <h3
                        className={`text-sm font-semibold ${
                          isCompleted ? 'line-through text-neutral-400' : 'text-neutral-100'
                        }`}
                      >
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {/* Checklist (if any) */}
                    {task.checklist && task.checklist.length > 0 && (
                      <div className="p-2.5 bg-neutral-950/60 border border-neutral-800 rounded-lg space-y-1.5 text-xs">
                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">
                          Checklist:
                        </span>
                        {task.checklist.map((item, idx) => (
                          <div key={item.id || idx} className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                const updatedChecklist = task.checklist!.map((c, i) =>
                                  i === idx ? { ...c, completed: !c.completed } : c
                                );
                                await updateTeamTask(task.id, { checklist: updatedChecklist });
                              }}
                              className="text-neutral-400 hover:text-amber-400 cursor-pointer"
                            >
                              {item.completed ? (
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <span
                              className={`text-xs ${
                                item.completed
                                  ? 'line-through text-neutral-400'
                                  : 'text-neutral-300'
                              }`}
                            >
                              {item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer: Date, Status toggle & PDF Download */}
                  <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-neutral-400 font-mono-numbers text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>{formatDate(task.dueDate)}</span>
                      {task.dueTime && (
                        <>
                          <span>·</span>
                          <Clock className="w-3 h-3 text-neutral-400" />
                          <span>{task.dueTime}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Individual PDF Download */}
                      <button
                        onClick={() => handleExportTaskPDF(task)}
                        className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                        title="Baixar esta tarefa em PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>

                      {/* Status Toggle Button */}
                      <button
                        onClick={() => toggleTaskComplete(task.id, task.status)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          isCompleted
                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30'
                            : isInProgress
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30'
                            : 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:border-amber-400/50'
                        }`}
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Concluída</span>
                          </>
                        ) : isInProgress ? (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>Em andamento</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3 h-3" />
                            <span>Concluir</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Modal: Novo Afazer Privado */}
      {isNewTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none">
          <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-100 text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-neutral-100">Novo Afazer Privado</h3>
              </div>
              <button
                onClick={() => setIsNewTaskOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePrivateTask} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Título do Afazer *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Treinar operação da mesa de corte de vídeo"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Descrição ou Observações Pessoais
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Anotações privadas para você lembrar..."
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Categoria
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as TeamTaskCategory)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="outro">Geral / Operacional</option>
                    <option value="projecao">Projeção & Telão</option>
                    <option value="video">Vídeo & Filmagem</option>
                    <option value="transmissao">Transmissão Ao Vivo</option>
                    <option value="som">Áudio & Mesa</option>
                    <option value="fotografia">Fotografia</option>
                    <option value="design_redes">Design & Redes Sociais</option>
                    <option value="iluminacao">Iluminação</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Prioridade
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TeamTaskPriority)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Data Limite
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 font-mono-numbers"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 font-mono-numbers"
                  />
                </div>
              </div>

              {/* Checklist builder */}
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">
                  Checklist de Etapas (Opcional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                    placeholder="Adicionar item e pressionar Enter..."
                    className="flex-1 px-3 py-1.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl font-semibold"
                  >
                    Adicionar
                  </button>
                </div>

                {newChecklist.length > 0 && (
                  <div className="space-y-1 pt-1 max-h-28 overflow-y-auto">
                    {newChecklist.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-1.5 bg-neutral-950 rounded-lg border border-neutral-800"
                      >
                        <span className="text-neutral-300 truncate">{item}</span>
                        <button
                          type="button"
                          onClick={() => setNewChecklist((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-neutral-400 hover:text-red-400 p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsNewTaskOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingTask}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                  {isSavingTask ? 'Salvando...' : 'Salvar Afazer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
