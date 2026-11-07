import React, { useState } from 'react';
import {
  X,
  Zap,
  Calendar,
  Clock,
  User,
  Radio,
  Volume2,
  Tv,
  Camera,
  Film,
  Lightbulb,
  CheckCircle2,
  Lock,
  Sparkles,
  Users,
  ChevronRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { ChurchEvent, TeamTask, TeamTaskCategory, User as UserType } from '../../types.js';
import { api } from '../../services/api.js';
import { useApp } from '../../context/AppContext.js';

interface FastScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamMembers: UserType[];
  existingEvents: ChurchEvent[];
  onSuccess: () => void;
}

interface ServicePostConfig {
  id: string;
  category: TeamTaskCategory;
  label: string;
  defaultTitle: string;
  iconType: 'som' | 'transmissao' | 'camera' | 'reels' | 'projecao' | 'foto' | 'luz';
  enabled: boolean;
  assignedUid: string;
  checklist: string[];
}

function getNextDateForDay(targetDayOfWeek: number): string {
  const now = new Date();
  const currentDay = now.getDay();
  let diff = (targetDayOfWeek - currentDay + 7) % 7;
  // If target day is today and it's already after 20:00, schedule for next week
  if (diff === 0 && now.getHours() >= 20) {
    diff = 7;
  }
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + diff);
  return targetDate.toISOString().split('T')[0];
}

const INITIAL_POSTS: ServicePostConfig[] = [
  {
    id: 'post_som',
    category: 'som',
    label: 'Mesa de Som & Áudio',
    defaultTitle: 'Operação de Áudio & Mesa de Som',
    iconType: 'som',
    enabled: true,
    assignedUid: '',
    checklist: [
      'Chegar 30 min antes para passagem de som',
      'Testar microfones dos pastores e louvor',
      'Balancear retornos e gravação master',
      'Desligar e cobrir mesa com zelo ao final',
    ],
  },
  {
    id: 'post_transmissao',
    category: 'transmissao',
    label: 'Transmissão Ao Vivo (OBS / YouTube)',
    defaultTitle: 'Transmissão Ao Vivo (YouTube & OBS)',
    iconType: 'transmissao',
    enabled: true,
    assignedUid: '',
    checklist: [
      'Iniciar encoder 15 min antes do culto',
      'Conferir áudio no feed do YouTube',
      'Inserir GC de versículos e avisos',
      'Salvar gravação master e encerrar stream',
    ],
  },
  {
    id: 'post_camera1',
    category: 'video',
    label: 'Câmera 1 (Púlpito & Altar)',
    defaultTitle: 'Operação de Câmera 1 (Principal)',
    iconType: 'camera',
    enabled: true,
    assignedUid: '',
    checklist: [
      'Checar tripé, foco e bateria',
      'Enquadrar púlpito e ministração com estabilidade',
      'Seguir movimentos e transições com fluidez',
    ],
  },
  {
    id: 'post_reels',
    category: 'video',
    label: 'Vídeo, Reels & Stories',
    defaultTitle: 'Captação de Vídeo, Reels & Stories',
    iconType: 'reels',
    enabled: true,
    assignedUid: '',
    checklist: [
      'Gravar trechos do louvor na vertical 9:16',
      'Registrar momentos marcantes da mensagem pastoral',
      'Postar stories oficiais em tempo real',
    ],
  },
  {
    id: 'post_projecao',
    category: 'projecao',
    label: 'Projeção no Telão LED (Holyrics)',
    defaultTitle: 'Projeção de Letras & Telão LED (Holyrics)',
    iconType: 'projecao',
    enabled: true,
    assignedUid: '',
    checklist: [
      'Sincronizar letras dos hinos no Holyrics',
      'Projetar versículos bíblicos citados pelo pregador',
      'Exibir avisos institucionais e dízimos no telão',
    ],
  },
  {
    id: 'post_foto',
    category: 'fotografia',
    label: 'Fotografia & Cobertura Oficial',
    defaultTitle: 'Fotografia Oficial & Cobertura do Culto',
    iconType: 'foto',
    enabled: true,
    assignedUid: '',
    checklist: [
      'Fotos da congregação e comunhão',
      'Fotos da ministração da Palavra e louvor',
      'Descarregar fotos na Central PT-B após o culto',
    ],
  },
  {
    id: 'post_luz',
    category: 'iluminacao',
    label: 'Iluminação & Cenografia',
    defaultTitle: 'Operação de Iluminação & Cenas',
    iconType: 'luz',
    enabled: false,
    assignedUid: '',
    checklist: [
      'Ajustar cenas de luz para louvor e palavra',
      'Desligar canhões de iluminação após o culto',
    ],
  },
];

export const FastScheduleModal: React.FC<FastScheduleModalProps> = ({
  isOpen,
  onClose,
  teamMembers,
  existingEvents,
  onSuccess,
}) => {
  const { user, createBatchTeamTasks, notify } = useApp();

  const [activePreset, setActivePreset] = useState<string>('domingo_noite');
  const [eventName, setEventName] = useState<string>('Culto de Celebração - Domingo');
  const [eventDate, setEventDate] = useState<string>(() => getNextDateForDay(0));
  const [eventTime, setEventTime] = useState<string>('18:00');
  const [eventCategory, setEventCategory] = useState<string>('Culto de Domingo');
  const [isPrivateAll, setIsPrivateAll] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize post configurations with smart default assignments
  const [posts, setPosts] = useState<ServicePostConfig[]>(() => {
    return INITIAL_POSTS.map((p, idx) => {
      // Pick a team member if available
      const member = teamMembers[idx % teamMembers.length];
      return {
        ...p,
        assignedUid: member ? member.uid : (user?.uid || ''),
      };
    });
  });

  if (!isOpen) return null;

  const handleApplyPreset = (presetKey: string) => {
    setActivePreset(presetKey);

    if (presetKey === 'domingo_noite') {
      setEventName('Culto de Celebração - Domingo');
      setEventDate(getNextDateForDay(0));
      setEventTime('18:00');
      setEventCategory('Culto de Domingo');
    } else if (presetKey === 'quarta_doutrina') {
      setEventName('Culto de Ensino & Doutrina - Quarta');
      setEventDate(getNextDateForDay(3));
      setEventTime('19:30');
      setEventCategory('Culto de Quarta');
    } else if (presetKey === 'sabado_jovens') {
      setEventName('Culto Conexão Jovens - Sábado');
      setEventDate(getNextDateForDay(6));
      setEventTime('19:30');
      setEventCategory('Evento de Jovens');
    } else if (presetKey === 'oracao_sexta') {
      setEventName('Culto de Oração & Alinhamento');
      setEventDate(getNextDateForDay(5));
      setEventTime('19:30');
      setEventCategory('Culto de Oração');
    } else {
      setEventName('Culto Especial da Igreja');
      setEventDate(new Date().toISOString().split('T')[0]);
      setEventTime('19:00');
      setEventCategory('Culto Especial');
    }
  };

  const handleTogglePost = (id: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleMemberChange = (id: string, uid: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, assignedUid: uid } : p))
    );
  };

  const handleDistributeEvenly = () => {
    if (teamMembers.length === 0) return;
    setPosts((prev) =>
      prev.map((p, idx) => ({
        ...p,
        assignedUid: teamMembers[idx % teamMembers.length].uid,
      }))
    );
    notify('Membros distribuídos pelos postos de mídia!', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!eventName.trim() || !eventDate) {
      notify('Preencha o nome e a data do culto', 'error');
      return;
    }

    const enabledPosts = posts.filter((p) => p.enabled);
    if (enabledPosts.length === 0) {
      notify('Habilite pelo menos um posto técnico para escalar', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Check if event with this name and date already exists, or create new ChurchEvent
      let eventId: string | null = null;
      const existingMatch = existingEvents.find(
        (ev) =>
          ev.name.toLowerCase().trim() === eventName.toLowerCase().trim() &&
          ev.date === eventDate
      );

      // Collect unique responsible member names for event header
      const assignedUserObjects = enabledPosts
        .map((p) => teamMembers.find((m) => m.uid === p.assignedUid) || user)
        .filter(Boolean) as UserType[];
      const uniqueResponsibleNames = Array.from(
        new Set(assignedUserObjects.map((u) => u.name))
      );

      if (existingMatch) {
        eventId = existingMatch.id;
        // Merge responsibles in existing event
        const mergedResp = Array.from(
          new Set([...(existingMatch.responsibles || []), ...uniqueResponsibleNames])
        );
        api.updateEvent(existingMatch.id, { responsibles: mergedResp }).catch(() => {});
      } else {
        const newEvt = await api.createEvent({
          name: eventName.trim(),
          date: eventDate,
          category: eventCategory,
          responsibles: uniqueResponsibleNames,
          description: `Escala técnica da equipe de mídia para o ${eventName}.`,
        });
        eventId = newEvt.id;
      }

      // 2. Prepare all individual team tasks in batch
      const batchTasksPayload: Partial<TeamTask>[] = enabledPosts.map((post) => {
        const assignedMember =
          teamMembers.find((m) => m.uid === post.assignedUid) ||
          user || {
            uid: post.assignedUid || 'membro',
            name: 'Membro da Equipe',
            email: '',
            avatar: '',
          };

        return {
          title: post.defaultTitle,
          description: `Posto escalado: ${post.label} para o ${eventName}.`,
          category: post.category,
          eventId,
          eventName,
          assignedToUid: assignedMember.uid,
          assignedToName: assignedMember.name,
          assignedToEmail: assignedMember.email || '',
          assignedToAvatar: assignedMember.avatar || '',
          dueDate: eventDate,
          dueTime: eventTime,
          priority: 'alta',
          status: 'pendente',
          isPrivate: isPrivateAll,
          checklist: post.checklist.map((item, idx) => ({
            id: `c_${Date.now()}_${idx}`,
            text: item,
            completed: false,
          })),
        };
      });

      // 3. Dispatch batch creation to Firestore
      await createBatchTeamTasks(batchTasksPayload);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create fast schedule:', err);
      notify('Erro ao gerar a escala express do culto.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderIcon = (type: ServicePostConfig['iconType']) => {
    switch (type) {
      case 'som':
        return <Volume2 className="w-4 h-4 text-emerald-400" />;
      case 'transmissao':
        return <Radio className="w-4 h-4 text-red-400" />;
      case 'camera':
        return <Camera className="w-4 h-4 text-blue-400" />;
      case 'reels':
        return <Film className="w-4 h-4 text-purple-400" />;
      case 'projecao':
        return <Tv className="w-4 h-4 text-amber-400" />;
      case 'foto':
        return <Camera className="w-4 h-4 text-cyan-400" />;
      case 'luz':
        return <Lightbulb className="w-4 h-4 text-yellow-400" />;
      default:
        return <Zap className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl p-5 sm:p-7 text-neutral-100 text-xs animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-600 text-neutral-950 font-bold rounded-xl shadow-md">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Escala Rápida do Culto
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Gerador Express
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Monte a escala de todos os postos de mídia em 1 clique e dispare os afazeres da equipe.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto pr-1 py-4 space-y-5 flex-1">
          {/* 1. Quick Presets Bar */}
          <div>
            <label className="block text-neutral-300 font-semibold mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Escolha o Culto / Preset Rápido</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset('domingo_noite')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  activePreset === 'domingo_noite'
                    ? 'bg-amber-500/20 border-amber-500/80 text-amber-300 font-bold shadow-xs'
                    : 'bg-neutral-800/80 border-neutral-700/70 text-neutral-300 hover:border-neutral-600'
                }`}
              >
                <div className="font-semibold text-xs">🌟 Domingo</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Celebração (18h)</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('quarta_doutrina')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  activePreset === 'quarta_doutrina'
                    ? 'bg-amber-500/20 border-amber-500/80 text-amber-300 font-bold shadow-xs'
                    : 'bg-neutral-800/80 border-neutral-700/70 text-neutral-300 hover:border-neutral-600'
                }`}
              >
                <div className="font-semibold text-xs">📖 Quarta</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Ensino (19h30)</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('sabado_jovens')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  activePreset === 'sabado_jovens'
                    ? 'bg-amber-500/20 border-amber-500/80 text-amber-300 font-bold shadow-xs'
                    : 'bg-neutral-800/80 border-neutral-700/70 text-neutral-300 hover:border-neutral-600'
                }`}
              >
                <div className="font-semibold text-xs">🔥 Sábado</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Jovens (19h30)</div>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset('especial')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  activePreset === 'especial'
                    ? 'bg-amber-500/20 border-amber-500/80 text-amber-300 font-bold shadow-xs'
                    : 'bg-neutral-800/80 border-neutral-700/70 text-neutral-300 hover:border-neutral-600'
                }`}
              >
                <div className="font-semibold text-xs">⚡ Outro</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Personalizado</div>
              </button>
            </div>
          </div>

          {/* 2. Event Metadata Inputs */}
          <div className="p-3.5 bg-neutral-800/40 border border-neutral-800 rounded-xl space-y-3">
            <div>
              <label className="block text-neutral-300 font-medium mb-1">Título do Culto / Evento *</label>
              <input
                type="text"
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Ex: Culto de Celebração - Domingo"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-300 font-medium mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Data do Culto *</span>
                </label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Horário *</span>
                </label>
                <input
                  type="time"
                  required
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer font-mono"
                />
              </div>
            </div>
          </div>

          {/* 3. Technical Posts Roster Matrix */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-neutral-300 font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Postos da Equipe de Mídia ({posts.filter((p) => p.enabled).length} ativos)</span>
              </label>

              {teamMembers.length > 1 && (
                <button
                  type="button"
                  onClick={handleDistributeEvenly}
                  className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer"
                >
                  Distribuir Membros Automaticamente
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    post.enabled
                      ? 'bg-neutral-800/70 border-neutral-700'
                      : 'bg-neutral-900/50 border-neutral-800/80 opacity-60'
                  }`}
                >
                  {/* Left: Checkbox & Post Title */}
                  <div className="flex items-center gap-2.5 min-w-[200px]">
                    <input
                      type="checkbox"
                      id={`check_${post.id}`}
                      checked={post.enabled}
                      onChange={() => handleTogglePost(post.id)}
                      className="w-4 h-4 rounded text-amber-500 bg-neutral-900 border-neutral-700 focus:ring-0 cursor-pointer"
                    />
                    <label
                      htmlFor={`check_${post.id}`}
                      className="flex items-center gap-2 cursor-pointer select-none"
                    >
                      <div className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800">
                        {renderIcon(post.iconType)}
                      </div>
                      <div>
                        <span className={`font-semibold block ${post.enabled ? 'text-neutral-100' : 'text-neutral-400'}`}>
                          {post.label}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {post.checklist.length} passos de checklist
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Right: Member Selector */}
                  {post.enabled && (
                    <div className="flex-1 sm:max-w-xs">
                      <select
                        value={post.assignedUid}
                        onChange={(e) => handleMemberChange(post.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        {teamMembers.map((m) => (
                          <option key={m.uid} value={m.uid}>
                            {m.name} ({m.roleLabel || m.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 4. Privacy Toggle */}
          <div className="p-3 bg-neutral-800/40 border border-neutral-700/60 rounded-xl flex items-start gap-3">
            <input
              type="checkbox"
              id="isPrivateAllCheck"
              checked={isPrivateAll}
              onChange={(e) => setIsPrivateAll(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded text-amber-500 bg-neutral-900 border-neutral-700 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="isPrivateAllCheck" className="cursor-pointer select-none">
              <div className="flex items-center gap-1.5 font-bold text-xs text-neutral-200">
                <Lock className="w-3.5 h-3.5 text-red-400" />
                <span>Tarefas Privadas da Equipe (Recomendado)</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                Cada membro da equipe vê exclusivamente o seu posto na sua aba pessoal. Super administradores mantêm visibilidade total de tudo.
              </p>
            </label>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-extrabold rounded-xl shadow-lg shadow-amber-500/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-neutral-950" />
            <span>
              {isSubmitting
                ? 'Publicando Escala...'
                : `⚡ Publicar Escala Completa (${posts.filter((p) => p.enabled).length} Postos)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
