import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Lock,
  Pause,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Settings2,
  Share2,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useApp } from '../../context/AppContext.js';
import {
  AttendanceDepartment,
  BaptismFormSettings,
  BaptismFormStatus,
  BaptismRegistration,
  BaptismRegistrationStatus,
} from '../../types.js';
import { api } from '../../services/api.js';
import {
  exportGeneralBaptismFichasPDF,
  exportSingleBaptismFichaPDF,
} from '../../utils/baptismPdf.js';
import {
  buildPublicUrl,
  copyTextSafely,
  isRunningOnDevPreviewOrigin,
} from '../../utils/publicUrl.js';

const FORM_STATUS_META: Record<
  BaptismFormStatus,
  { label: string; textClass: string; dotClass: string }
> = {
  aberto: {
    label: 'Aberto para inscrições',
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400',
  },
  pausado: {
    label: 'Pausado temporariamente',
    textClass: 'text-amber-400',
    dotClass: 'bg-amber-400',
  },
  fechado: {
    label: 'Fechado / Encerrado',
    textClass: 'text-red-400',
    dotClass: 'bg-red-400',
  },
};

const REG_STATUS_META: Record<
  BaptismRegistrationStatus,
  { label: string; textClass: string }
> = {
  pendente: { label: 'Pendente', textClass: 'text-amber-400' },
  aprovado: { label: 'Aprovado', textClass: 'text-sky-400' },
  batizado: { label: 'Batizado(a)', textClass: 'text-emerald-400' },
  arquivado: { label: 'Arquivado', textClass: 'text-neutral-400' },
};

function formatDateBR(val?: string): string {
  if (!val) return '';
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : val;
}

function formatCPF(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatCEP(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

export const BaptismView: React.FC = () => {
  const { user, notify, requestConfirm } = useApp();

  const [subTab, setSubTab] = useState<'fichas' | 'pdfs' | 'config'>('fichas');
  const [settings, setSettings] = useState<BaptismFormSettings>(() =>
    api.getDefaultBaptismSettings()
  );
  const [registrations, setRegistrations] = useState<BaptismRegistration[]>([]);
  const [departments, setDepartments] = useState<AttendanceDepartment[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BaptismRegistrationStatus>('all');
  const [pdfFilter, setPdfFilter] = useState<'all' | 'pendente' | 'aprovados_batizados' | 'batizado'>('all');

  const [copiedLink, setCopiedLink] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resettingAction, setResettingAction] = useState<'settings' | 'clear' | 'both' | null>(null);

  // Editor modal for filling/editing candidate & ecclesiastical & secretary fields
  const [editingReg, setEditingReg] = useState<BaptismRegistration | null>(null);
  const [isNewManualOpen, setIsNewManualOpen] = useState(false);
  const [savingReg, setSavingReg] = useState(false);
  const [syncingMemberId, setSyncingMemberId] = useState<string | null>(null);
  const [targetDeptId, setTargetDeptId] = useState('');

  // Form fields in modal (Personal + Ecclesiastical + Secretary)
  const [fFullName, setFFullName] = useState('');
  const [fCpf, setFCpf] = useState('');
  const [fBirthDate, setFBirthDate] = useState('');
  const [fAge, setFAge] = useState('');
  const [fGender, setFGender] = useState<'Masc.' | 'Fem.' | ''>('');
  const [fNaturalidade, setFNaturalidade] = useState('');
  const [fMaritalStatus, setFMaritalStatus] = useState('');
  const [fSpouseName, setFSpouseName] = useState('');
  const [fMotherName, setFMotherName] = useState('');
  const [fFatherName, setFFatherName] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fCep, setFCep] = useState('');
  const [fAddress, setFAddress] = useState('');
  const [fCongregation, setFCongregation] = useState('IEADAM Petrópolis B');
  const [fGuardianName, setFGuardianName] = useState('');
  const [fConversionDate, setFConversionDate] = useState('');
  const [fPreviouslyBaptized, setFPreviouslyBaptized] = useState<'sim' | 'nao' | ''>('');
  const [fRecommendingPastor, setFRecommendingPastor] = useState('');
  const [fBaptismDate, setFBaptismDate] = useState('');
  const [fReceivedBy, setFReceivedBy] = useState('');
  const [fSecretaryNotes, setFSecretaryNotes] = useState('');
  const [fStatus, setFStatus] = useState<BaptismRegistrationStatus>('pendente');

  // Config tab draft
  const [cfgChurchTitle, setCfgChurchTitle] = useState('');
  const [cfgFormTitle, setCfgFormTitle] = useState('');
  const [cfgSubtitle, setCfgSubtitle] = useState('');
  const [cfgNextDate, setCfgNextDate] = useState('');
  const [cfgLocation, setCfgLocation] = useState('');
  const [cfgPausedMsg, setCfgPausedMsg] = useState('');
  const [cfgClosedMsg, setCfgClosedMsg] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const publicLink = useMemo(() => {
    if (typeof window === 'undefined') return '/?batismo=inscricao';
    return buildPublicUrl('/?batismo=inscricao');
  }, []);
  const runningOnDevPreview = useMemo(() => isRunningOnDevPreviewOrigin(), []);

  useEffect(() => {
    let active = true;
    const unsubSettings = api.subscribeBaptismFormSettings((live) => {
      if (!active) return;
      setSettings(live);
      setCfgChurchTitle(live.churchTitle || '');
      setCfgFormTitle(live.formTitle || '');
      setCfgSubtitle(live.subtitle || '');
      setCfgNextDate(live.nextBaptismDate || '');
      setCfgLocation(live.baptismLocation || '');
      setCfgPausedMsg(live.pausedMessage || '');
      setCfgClosedMsg(live.closedMessage || '');
    });

    const unsubRegs = api.subscribeBaptismRegistrations((list) => {
      if (!active) return;
      setRegistrations(list);
      setLoading(false);
    });

    const unsubDepts = api.subscribeAttendanceDepartments((depts) => {
      if (!active) return;
      setDepartments(depts);
      if (depts.length > 0 && !targetDeptId) {
        setTargetDeptId(depts[0].id);
      }
    });

    return () => {
      active = false;
      unsubSettings();
      unsubRegs();
      unsubDepts();
    };
  }, []);

  useEffect(() => {
    if (!qrModalOpen) return;
    QRCode.toDataURL(publicLink, {
      width: 420,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [qrModalOpen, publicLink]);

  const counts = useMemo(() => {
    return {
      total: registrations.length,
      pendente: registrations.filter((r) => r.status === 'pendente').length,
      aprovado: registrations.filter((r) => r.status === 'aprovado').length,
      batizado: registrations.filter((r) => r.status === 'batizado').length,
      arquivado: registrations.filter((r) => r.status === 'arquivado').length,
    };
  }, [registrations]);

  const filteredRegistrations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return registrations.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        (r.protocolNumber || '').toLowerCase().includes(q) ||
        (r.cpf || '').toLowerCase().includes(q) ||
        (r.naturalidade || '').toLowerCase().includes(q) ||
        (r.cep || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.address || '').toLowerCase().includes(q) ||
        (r.congregation || '').toLowerCase().includes(q) ||
        (r.recommendingPastor || '').toLowerCase().includes(q)
      );
    });
  }, [registrations, searchQuery, statusFilter]);

  const pdfTargets = useMemo(() => {
    if (pdfFilter === 'pendente') {
      return registrations.filter((r) => r.status === 'pendente');
    }
    if (pdfFilter === 'aprovados_batizados') {
      return registrations.filter((r) => r.status === 'aprovado' || r.status === 'batizado');
    }
    if (pdfFilter === 'batizado') {
      return registrations.filter((r) => r.status === 'batizado');
    }
    return registrations.filter((r) => r.status !== 'arquivado');
  }, [registrations, pdfFilter]);

  const handleChangeFormStatus = async (nextStatus: BaptismFormStatus) => {
    if (updatingStatus || settings.status === nextStatus) return;
    try {
      setUpdatingStatus(true);
      const updated = await api.updateBaptismFormSettings({ status: nextStatus });
      setSettings(updated);
      notify(`Formulário público agora está: ${FORM_STATUS_META[nextStatus].label}.`, 'success');
    } catch {
      notify('Erro ao atualizar status do formulário.', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCopyPublicLink = async () => {
    const copied = await copyTextSafely(publicLink);
    if (copied) {
      setCopiedLink(true);
      notify('Link público do formulário de Batismo copiado!', 'success');
      setTimeout(() => setCopiedLink(false), 2500);
    } else {
      notify(`Copie o link: ${publicLink}`, 'info');
    }
  };

  const handleShareWhatsApp = () => {
    const text =
      `Paz do Senhor! Preencha sua Ficha de Inscrição para o Batismo nas Águas pelo link oficial:\n${publicLink}\n\n` +
      `Dica para iPhone: se o navegador do WhatsApp pedir permissão de segurança, toque no ícone da bússola (canto inferior direito) para abrir no Safari.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), 300);
  };

  const openEditor = (reg: BaptismRegistration) => {
    setIsNewManualOpen(false);
    setEditingReg(reg);
    setFFullName(reg.fullName || '');
    setFCpf(reg.cpf || '');
    setFBirthDate(reg.birthDate || '');
    setFAge(reg.age || '');
    setFGender(reg.gender || '');
    setFNaturalidade(reg.naturalidade || '');
    setFMaritalStatus(reg.maritalStatus || '');
    setFSpouseName(reg.spouseName || '');
    setFMotherName(reg.motherName || '');
    setFFatherName(reg.fatherName || '');
    setFPhone(reg.phone || '');
    setFCep(reg.cep || '');
    setFAddress(reg.address || '');
    setFCongregation(reg.congregation || 'IEADAM Petrópolis B');
    setFGuardianName(reg.guardianName || '');
    setFConversionDate(reg.conversionDate || '');
    setFPreviouslyBaptized(reg.previouslyBaptized || '');
    setFRecommendingPastor(reg.recommendingPastor || '');
    setFBaptismDate(reg.baptismDate || settings.nextBaptismDate || '');
    setFReceivedBy(reg.receivedBy || user?.name || '');
    setFSecretaryNotes(reg.secretaryNotes || '');
    setFStatus(reg.status || 'pendente');
  };

  const openManualCreate = () => {
    setEditingReg(null);
    setIsNewManualOpen(true);
    setFFullName('');
    setFCpf('');
    setFBirthDate('');
    setFAge('');
    setFGender('Masc.');
    setFNaturalidade('');
    setFMaritalStatus('');
    setFSpouseName('');
    setFMotherName('');
    setFFatherName('');
    setFPhone('');
    setFCep('');
    setFAddress('');
    setFCongregation('IEADAM Petrópolis B');
    setFGuardianName('');
    setFConversionDate('');
    setFPreviouslyBaptized('');
    setFRecommendingPastor('');
    setFBaptismDate(settings.nextBaptismDate || '');
    setFReceivedBy(user?.name || '');
    setFSecretaryNotes('');
    setFStatus('pendente');
  };

  const handleSaveEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fFullName.trim()) {
      notify('Informe o nome completo do candidato.', 'error');
      return;
    }
    try {
      setSavingReg(true);
      const effectiveSpouse = fMaritalStatus === 'Casado(a)' ? fSpouseName.trim() : '';
      if (isNewManualOpen) {
        const created = await api.submitPublicBaptismRegistration({
          fullName: fFullName,
          cpf: fCpf,
          birthDate: fBirthDate || new Date().toISOString().slice(0, 10),
          age: fAge,
          gender: (fGender || 'Masc.') as 'Masc.' | 'Fem.',
          naturalidade: fNaturalidade,
          maritalStatus: fMaritalStatus,
          spouseName: effectiveSpouse,
          motherName: fMotherName,
          fatherName: fFatherName,
          phone: fPhone,
          cep: fCep,
          address: fAddress,
          congregation: fCongregation || 'IEADAM Petrópolis B',
          guardianName: fGuardianName,
          declarationAccepted: true,
          declarationCity: 'Manaus / AM',
          declarationDate: new Date().toISOString().slice(0, 10),
          allowWhenClosedByAdmin: true,
        });
        await api.updateBaptismRegistration(created.id, {
          conversionDate: fConversionDate,
          previouslyBaptized: fPreviouslyBaptized,
          recommendingPastor: fRecommendingPastor,
          baptismDate: fBaptismDate,
          receivedBy: fReceivedBy,
          secretaryNotes: fSecretaryNotes,
          status: fStatus,
        });
        notify('Ficha de batismo criada com sucesso!', 'success');
        setIsNewManualOpen(false);
      } else if (editingReg) {
        await api.updateBaptismRegistration(editingReg.id, {
          fullName: fFullName.trim(),
          cpf: fCpf.trim(),
          birthDate: fBirthDate.trim(),
          age: fAge.trim(),
          gender: fGender,
          naturalidade: fNaturalidade.trim(),
          maritalStatus: fMaritalStatus.trim(),
          spouseName: effectiveSpouse,
          motherName: fMotherName.trim(),
          fatherName: fFatherName.trim(),
          phone: fPhone.trim(),
          cep: fCep.trim(),
          address: fAddress.trim(),
          congregation: fCongregation.trim(),
          guardianName: fGuardianName.trim(),
          conversionDate: fConversionDate.trim(),
          previouslyBaptized: fPreviouslyBaptized,
          recommendingPastor: fRecommendingPastor.trim(),
          baptismDate: fBaptismDate.trim(),
          receivedBy: fReceivedBy.trim(),
          secretaryNotes: fSecretaryNotes.trim(),
          status: fStatus,
        });
        notify(`Ficha de "${fFullName.trim()}" salva!`, 'success');
        setEditingReg(null);
      }
    } catch (err: any) {
      notify(err?.message || 'Erro ao salvar ficha de batismo.', 'error');
    } finally {
      setSavingReg(false);
    }
  };

  const handleResetAction = async (mode: 'settings' | 'clear' | 'both') => {
    try {
      setResettingAction(mode);
      let clearedCount = 0;

      if (mode === 'clear' || mode === 'both') {
        clearedCount = await api.clearAllBaptismRegistrations();
        setRegistrations([]);
      }

      if (mode === 'settings' || mode === 'both') {
        const defaults = await api.resetBaptismFormSettings();
        setSettings(defaults);
        setCfgChurchTitle(defaults.churchTitle || '');
        setCfgFormTitle(defaults.formTitle || '');
        setCfgSubtitle(defaults.subtitle || '');
        setCfgNextDate(defaults.nextBaptismDate || '');
        setCfgLocation(defaults.baptismLocation || '');
        setCfgPausedMsg(defaults.pausedMessage || '');
        setCfgClosedMsg(defaults.closedMessage || '');
      }

      if (mode === 'clear') {
        notify(`Formulário limpo! ${clearedCount} ficha(s) removida(s) da lista.`, 'success');
      } else if (mode === 'settings') {
        notify('Configurações do formulário restauradas para o padrão!', 'success');
      } else {
        notify(`Reset completo realizado! ${clearedCount} ficha(s) limpa(s) e padrões restaurados.`, 'success');
      }
      setResetModalOpen(false);
    } catch {
      notify('Erro ao limpar/resetar formulário de Batismo.', 'error');
    } finally {
      setResettingAction(null);
    }
  };

  const handleSyncToMember = async (reg: BaptismRegistration) => {
    try {
      setSyncingMemberId(reg.id);
      const member = await api.syncBaptismToAttendanceMember(reg, targetDeptId || undefined);
      notify(
        `"${member.name}" ${reg.linkedMemberId ? 'atualizado(a)' : 'enviado(a)'} para a Ficha de Membros (com Dados Eclesiásticos)!`,
        'success'
      );
      if (editingReg && editingReg.id === reg.id) {
        setEditingReg({ ...editingReg, linkedMemberId: member.id });
      }
    } catch (err: any) {
      notify(err?.message || 'Erro ao enviar candidato para a ficha de membros.', 'error');
    } finally {
      setSyncingMemberId(null);
    }
  };

  const handleDeleteReg = async (reg: BaptismRegistration) => {
    const confirmed = await requestConfirm({
      title: 'Excluir ficha de batismo',
      message: `Deseja excluir a ficha de "${reg.fullName}" (${reg.protocolNumber})? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await api.deleteBaptismRegistration(reg.id, reg.fullName);
      if (editingReg?.id === reg.id) setEditingReg(null);
      notify('Ficha excluída.', 'info');
    } catch {
      notify('Erro ao excluir ficha.', 'error');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      const updated = await api.updateBaptismFormSettings({
        churchTitle: cfgChurchTitle.trim(),
        formTitle: cfgFormTitle.trim(),
        subtitle: cfgSubtitle.trim(),
        nextBaptismDate: cfgNextDate.trim(),
        baptismLocation: cfgLocation.trim(),
        pausedMessage: cfgPausedMsg.trim(),
        closedMessage: cfgClosedMsg.trim(),
      });
      setSettings(updated);
      notify('Configurações do formulário de Batismo salvas!', 'success');
    } catch {
      notify('Erro ao salvar configurações.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const statusMeta = FORM_STATUS_META[settings.status];

  return (
    <div className="space-y-6">
      {/* Control Strip: Form Status + Public Link Sharing */}
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${statusMeta.dotClass}`} />
              <h2 className="text-sm font-bold text-neutral-100">
                Formulário Público de Batismo nas Águas
              </h2>
            </div>
            <p className={`text-xs font-medium ${statusMeta.textClass}`}>
              Estado atual: {statusMeta.label}
              <span className="text-neutral-500 font-normal"> · {counts.total} inscrito(s)</span>
            </p>
          </div>

          {/* Open / Pause / Close Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
            <button
              type="button"
              disabled={updatingStatus}
              onClick={() => handleChangeFormStatus('aberto')}
              className={`inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                settings.status === 'aberto'
                  ? 'bg-emerald-500 text-neutral-950 font-bold'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Abrir</span>
            </button>

            <button
              type="button"
              disabled={updatingStatus}
              onClick={() => handleChangeFormStatus('pausado')}
              className={`inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                settings.status === 'pausado'
                  ? 'bg-amber-400 text-neutral-950 font-bold'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pausar</span>
            </button>

            <button
              type="button"
              disabled={updatingStatus}
              onClick={() => handleChangeFormStatus('fechado')}
              className={`inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                settings.status === 'fechado'
                  ? 'bg-red-500 text-white font-bold'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Fechar</span>
            </button>
          </div>
        </div>

        {/* Shareable Public Link Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-3 border-t border-neutral-800">
          <div className="flex items-center gap-2 min-w-0 flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2">
            <span className="text-[11px] font-semibold text-amber-400 shrink-0">
              Link Público:
            </span>
            <span className="text-xs font-mono text-neutral-300 truncate select-all">
              {publicLink}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyPublicLink}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span>QR Code</span>
            </button>

            <a
              href={publicLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir</span>
            </a>

            <button
              type="button"
              onClick={() => setResetModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold cursor-pointer"
              title="Limpar fichas ou resetar configurações do formulário"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar / Resetar</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-neutral-400 leading-relaxed">
          {runningOnDevPreview ? (
            <>
              <strong className="text-amber-300">Link público protegido contra bloqueios:</strong>{' '}
              o botão &quot;Copiar Link&quot; e o QR Code já usam o endereço público compartilhável (em vez do link privado de edição). No iPhone, caso o navegador interno do WhatsApp exiba aviso de cookie, oriente tocar no ícone da bússola para abrir no <strong>Safari</strong>.
            </>
          ) : (
            <>
              No iPhone, se o navegador interno do WhatsApp bloquear cookies de segurança, oriente o candidato a tocar no ícone da bússola para abrir o link diretamente no <strong>Safari</strong>.
            </>
          )}
        </p>
      </div>

      {/* Sub-navigation inside Batismo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setSubTab('fichas')}
            className={`inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              subTab === 'fichas'
                ? 'bg-amber-400 text-neutral-950 font-bold'
                : 'text-neutral-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Fichas dos Inscritos ({counts.total})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('pdfs')}
            className={`inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              subTab === 'pdfs'
                ? 'bg-amber-400 text-neutral-950 font-bold'
                : 'text-neutral-300 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Baixar PDF (Individual &amp; Geral)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('config')}
            className={`inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              subTab === 'config'
                ? 'bg-amber-400 text-neutral-950 font-bold'
                : 'text-neutral-300 hover:text-white'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Configurar Formulário</span>
          </button>
        </div>

        <button
          type="button"
          onClick={openManualCreate}
          className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[38px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-amber-400 text-xs font-bold cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Ficha Manual</span>
        </button>
      </div>

      {/* TAB 1: FICHAS DOS INSCRITOS */}
      {subTab === 'fichas' && (
        <div className="space-y-4">
          {/* Search + Status Filter */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, protocolo, telefone, congregação ou pastor..."
                className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-xl">
              {(
                [
                  { id: 'all', label: `Todos (${counts.total})` },
                  { id: 'pendente', label: `Pendentes (${counts.pendente})` },
                  { id: 'aprovado', label: `Aprovados (${counts.aprovado})` },
                  { id: 'batizado', label: `Batizados (${counts.batizado})` },
                  { id: 'arquivado', label: `Arquivados (${counts.arquivado})` },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatusFilter(item.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === item.id
                      ? 'bg-neutral-800 text-amber-400'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center bg-neutral-900 border border-neutral-800 rounded-2xl text-xs text-neutral-400">
              Carregando fichas de batismo...
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="p-10 text-center bg-neutral-900 border border-neutral-800 rounded-2xl space-y-2">
              <FileText className="w-9 h-9 text-neutral-600 mx-auto" />
              <p className="text-sm font-semibold text-neutral-200">
                Nenhuma ficha de batismo encontrada
              </p>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Compartilhe o link público acima para que os candidatos preencham a ficha de inscrição, ou adicione manualmente.
              </p>
            </div>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl divide-y divide-neutral-800">
              {filteredRegistrations.map((reg) => {
                const stMeta = REG_STATUS_META[reg.status] || REG_STATUS_META.pendente;
                const missingEcclesiastical =
                  !reg.conversionDate && !reg.previouslyBaptized && !reg.recommendingPastor;

                return (
                  <div
                    key={reg.id}
                    className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-neutral-800/30 transition-colors"
                  >
                    <div
                      onClick={() => openEditor(reg)}
                      className="min-w-0 flex-1 cursor-pointer space-y-1"
                    >
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="text-sm font-bold text-neutral-100">
                          {reg.fullName}
                        </span>
                        <span className={`text-xs font-semibold ${stMeta.textClass}`}>
                          · {stMeta.label}
                        </span>
                        {reg.linkedMemberId && (
                          <span className="text-[11px] font-medium text-emerald-400">
                            · Na Ficha de Membros
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-400">
                        <span className="font-mono text-amber-400/90">{reg.protocolNumber}</span>
                        {reg.cpf && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">CPF {reg.cpf}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>
                          {reg.age ? `${reg.age} anos` : formatDateBR(reg.birthDate)}
                        </span>
                        {reg.gender && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{reg.gender}</span>
                          </>
                        )}
                        {reg.maritalStatus && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{reg.maritalStatus}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{reg.phone}</span>
                        <span aria-hidden="true">·</span>
                        <span>{reg.congregation}</span>
                        {(reg.cep || reg.address) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate max-w-xs">
                              {reg.cep ? `${reg.cep} · ` : ''}
                              {reg.address}
                            </span>
                          </>
                        )}
                        {missingEcclesiastical ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-300/90">
                              Aguardando dados eclesiásticos / secretaria
                            </span>
                          </>
                        ) : (
                          reg.recommendingPastor && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-neutral-300">
                                Pastor: {reg.recommendingPastor}
                              </span>
                            </>
                          )
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditor(reg)}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-xs font-semibold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Completar / Editar Ficha</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          exportSingleBaptismFichaPDF(reg, settings);
                          notify(`PDF da ficha de ${reg.fullName} baixado!`, 'success');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer"
                        title="Baixar PDF desta ficha"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        disabled={syncingMemberId === reg.id}
                        onClick={() => handleSyncToMember(reg)}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
                        title="Enviar dados eclesiásticos para Ficha de Membros"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                        <span>{reg.linkedMemberId ? 'Atualizar Membro' : 'Virar Membro'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BAIXAR PDF INDIVIDUAL E PDF GERAL (FICHA POR FICHA) */}
      {subTab === 'pdfs' && (
        <div className="space-y-5">
          {/* General Ficha-by-Ficha Export Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-neutral-100">
                  PDF Geral — Todos os Inscritos (Ficha por Ficha)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                  Gera um documento PDF completo com o modelo oficial da ficha de batismo, imprimindo{' '}
                  <strong className="text-neutral-200">1 ficha estruturada por página</strong> (Dados do Candidato, Dados Eclesiásticos, Declaração com assinaturas e Uso da Secretaria — não em formato planilha Excel).
                </p>
              </div>

              <button
                type="button"
                disabled={pdfTargets.length === 0}
                onClick={() => {
                  exportGeneralBaptismFichasPDF(
                    pdfTargets,
                    settings,
                    pdfFilter === 'all' ? 'Geral_Todas_Fichas' : pdfFilter
                  );
                  notify(`PDF Geral com ${pdfTargets.length} ficha(s) baixado!`, 'success');
                }}
                className="inline-flex items-center justify-center gap-2 px-5 min-h-[42px] rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 text-xs font-bold cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Baixar PDF Geral ({pdfTargets.length} ficha{pdfTargets.length === 1 ? '' : 's'})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-800">
              <span className="text-xs text-neutral-400 mr-1">Filtrar fichas no PDF Geral:</span>
              {(
                [
                  { id: 'all', label: 'Todos os inscritos ativos' },
                  { id: 'pendente', label: 'Somente Pendentes' },
                  { id: 'aprovados_batizados', label: 'Aprovados e Batizados' },
                  { id: 'batizado', label: 'Somente Batizados' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPdfFilter(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    pdfFilter === opt.id
                      ? 'bg-neutral-800 text-amber-400'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Individual Ficha Downloads */}
          <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-100">
                  Baixar PDF Individual por Inscrito
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Escolha qualquer candidato abaixo para baixar a ficha individual oficial pronta para impressão ou arquivo digital.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar inscrito..."
                  className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {filteredRegistrations.length === 0 ? (
              <p className="text-xs text-neutral-500 py-6 text-center">
                Nenhuma ficha para listar.
              </p>
            ) : (
              <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-xl bg-neutral-950/60">
                {filteredRegistrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-neutral-100 truncate">
                        {reg.fullName}
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        <span className="font-mono text-amber-400/90">{reg.protocolNumber}</span>
                        {' · '}
                        {reg.congregation}
                        {' · '}
                        {REG_STATUS_META[reg.status]?.label || reg.status}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        exportSingleBaptismFichaPDF(reg, settings);
                        notify(`Ficha PDF de ${reg.fullName} baixada!`, 'success');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 text-xs font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>Baixar Ficha PDF</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CONFIGURAÇÕES DO FORMULÁRIO */}
      {subTab === 'config' && (
        <form
          onSubmit={handleSaveConfig}
          className="p-5 sm:p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4"
        >
          <div>
            <h3 className="text-sm font-bold text-neutral-100">
              Cabeçalho, Datas e Mensagens do Formulário Público
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Personalize as informações exibidas na ficha pública e nos PDFs oficiais.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-200">
                Nome da Igreja / Instituição
              </label>
              <input
                type="text"
                value={cfgChurchTitle}
                onChange={(e) => setCfgChurchTitle(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-200">
                Título da Ficha
              </label>
              <input
                type="text"
                value={cfgFormTitle}
                onChange={(e) => setCfgFormTitle(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-200">
                Subtítulo
              </label>
              <input
                type="text"
                value={cfgSubtitle}
                onChange={(e) => setCfgSubtitle(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-200">
                Previsão / Data do Próximo Batismo (opcional)
              </label>
              <input
                type="date"
                value={cfgNextDate}
                onChange={(e) => setCfgNextDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-200">
                Local do Batismo
              </label>
              <input
                type="text"
                value={cfgLocation}
                onChange={(e) => setCfgLocation(e.target.value)}
                className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-200">
                Mensagem quando o formulário estiver PAUSADO
              </label>
              <textarea
                rows={2}
                value={cfgPausedMsg}
                onChange={(e) => setCfgPausedMsg(e.target.value)}
                className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-200">
                Mensagem quando o formulário estiver FECHADO
              </label>
              <textarea
                rows={2}
                value={cfgClosedMsg}
                onChange={(e) => setCfgClosedMsg(e.target.value)}
                className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => setResetModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar ou Resetar Formulário</span>
            </button>

            <button
              type="submit"
              disabled={savingConfig}
              className="px-5 min-h-[40px] rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      )}

      {/* MODAL: COMPLETAR / EDITAR FICHA + DADOS ECLESIÁSTICOS + SECRETARIA */}
      {(editingReg || isNewManualOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-neutral-100">
                  {isNewManualOpen
                    ? 'Nova Ficha Manual de Batismo'
                    : `Ficha Completa · ${editingReg?.protocolNumber}`}
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Preencha os Dados Eclesiásticos, Registro da Secretaria e exporte ou envie para a Ficha de Membros.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingReg(null);
                  setIsNewManualOpen(false);
                }}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditor} className="p-5 space-y-5 overflow-y-auto">
              {/* 1. Dados Pessoais */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 border-b border-neutral-800 pb-1.5">
                  1. Dados do Candidato(a)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={fFullName}
                      onChange={(e) => setFFullName(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">CPF</label>
                    <input
                      type="text"
                      maxLength={14}
                      value={fCpf}
                      onChange={(e) => setFCpf(formatCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Data de Nascimento</label>
                    <input
                      type="date"
                      value={fBirthDate}
                      onChange={(e) => setFBirthDate(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Idade</label>
                    <input
                      type="text"
                      value={fAge}
                      onChange={(e) => setFAge(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Sexo</label>
                    <select
                      value={fGender}
                      onChange={(e) => setFGender(e.target.value as 'Masc.' | 'Fem.' | '')}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    >
                      <option value="">Selecione</option>
                      <option value="Masc.">Masc.</option>
                      <option value="Fem.">Fem.</option>
                    </select>
                  </div>

                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Naturalidade</label>
                    <input
                      type="text"
                      value={fNaturalidade}
                      onChange={(e) => setFNaturalidade(e.target.value)}
                      placeholder="Ex: Manaus / AM"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Estado Civil</label>
                    <select
                      value={fMaritalStatus}
                      onChange={(e) => {
                        const next = e.target.value;
                        setFMaritalStatus(next);
                        if (next !== 'Casado(a)') setFSpouseName('');
                      }}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    >
                      <option value="">Selecione</option>
                      <option value="Solteiro(a)">Solteiro(a)</option>
                      <option value="Casado(a)">Casado(a)</option>
                      <option value="Divorciado(a)">Divorciado(a)</option>
                      <option value="Viúvo(a)">Viúvo(a)</option>
                      <option value="Separado(a)">Separado(a)</option>
                    </select>
                  </div>

                  {fMaritalStatus === 'Casado(a)' && (
                    <div className="sm:col-span-12 space-y-1">
                      <label className="text-xs font-semibold text-amber-300">Nome do Cônjuge</label>
                      <input
                        type="text"
                        value={fSpouseName}
                        onChange={(e) => setFSpouseName(e.target.value)}
                        placeholder="Nome completo do(a) esposo(a)"
                        className="w-full px-3 py-2 bg-neutral-950 border border-amber-500/40 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Nome da Mãe</label>
                    <input
                      type="text"
                      value={fMotherName}
                      onChange={(e) => setFMotherName(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">
                      Nome do Pai <span className="text-neutral-400 font-normal">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={fFatherName}
                      onChange={(e) => setFFatherName(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={fPhone}
                      onChange={(e) => setFPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Congregação / Núcleo</label>
                    <input
                      type="text"
                      value={fCongregation}
                      onChange={(e) => setFCongregation(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">CEP</label>
                    <input
                      type="text"
                      maxLength={9}
                      value={fCep}
                      onChange={(e) => setFCep(formatCEP(e.target.value))}
                      placeholder="00000-000"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-8 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Endereço</label>
                    <input
                      type="text"
                      value={fAddress}
                      onChange={(e) => setFAddress(e.target.value)}
                      placeholder="Rua, número, bairro..."
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-12 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">
                      Nome do Responsável (se menor de 18 anos)
                    </label>
                    <input
                      type="text"
                      value={fGuardianName}
                      onChange={(e) => setFGuardianName(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Dados Eclesiásticos (preenchidos pelo administrador depois) */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 border-b border-neutral-800 pb-1.5">
                  2. Dados Eclesiásticos (Preenchido pela Administração)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">
                      Data da Decisão / Conversão
                    </label>
                    <input
                      type="date"
                      value={fConversionDate}
                      onChange={(e) => setFConversionDate(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">
                      Já foi batizado antes?
                    </label>
                    <select
                      value={fPreviouslyBaptized}
                      onChange={(e) => setFPreviouslyBaptized(e.target.value as 'sim' | 'nao' | '')}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    >
                      <option value="">Não informado</option>
                      <option value="sim">Sim</option>
                      <option value="nao">Não</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">
                      Pastor / Dirigente que indicou
                    </label>
                    <input
                      type="text"
                      value={fRecommendingPastor}
                      onChange={(e) => setFRecommendingPastor(e.target.value)}
                      placeholder="Nome do Pastor ou Dirigente"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Registro da Secretaria */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-400 border-b border-neutral-800 pb-1.5">
                  3. Registro da Secretaria
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Status da Ficha</label>
                    <select
                      value={fStatus}
                      onChange={(e) => setFStatus(e.target.value as BaptismRegistrationStatus)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="aprovado">Aprovado</option>
                      <option value="batizado">Batizado(a)</option>
                      <option value="arquivado">Arquivado</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Data do Batismo</label>
                    <input
                      type="date"
                      value={fBaptismDate}
                      onChange={(e) => setFBaptismDate(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">Recebido por</label>
                    <input
                      type="text"
                      value={fReceivedBy}
                      onChange={(e) => setFReceivedBy(e.target.value)}
                      placeholder="Secretário(a)"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-xs font-semibold text-neutral-200">
                      Observações da Secretaria (opcional)
                    </label>
                    <textarea
                      rows={3}
                      value={fSecretaryNotes}
                      onChange={(e) => setFSecretaryNotes(e.target.value)}
                      className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Sync to Member Record + Actions */}
              {!isNewManualOpen && editingReg && (
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-semibold text-neutral-100">
                      Integração com Ficha de Membros (Chamadas &amp; Credenciais)
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Envia os Dados Pessoais e Dados Eclesiásticos diretamente para a Ficha de Membros.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {departments.length > 0 && (
                      <select
                        value={targetDeptId}
                        onChange={(e) => setTargetDeptId(e.target.value)}
                        className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-200"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      disabled={syncingMemberId === editingReg.id}
                      onClick={() =>
                        handleSyncToMember({
                          ...editingReg,
                          fullName: fFullName,
                          birthDate: fBirthDate,
                          gender: fGender,
                          phone: fPhone,
                          congregation: fCongregation,
                          conversionDate: fConversionDate,
                          previouslyBaptized: fPreviouslyBaptized,
                          baptismDate: fBaptismDate,
                          recommendingPastor: fRecommendingPastor,
                          secretaryNotes: fSecretaryNotes,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 text-xs font-semibold cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>
                        {editingReg.linkedMemberId
                          ? 'Atualizar Ficha de Membro'
                          : 'Enviar para Ficha de Membros'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800">
                <div className="flex items-center gap-2">
                  {!isNewManualOpen && editingReg && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDeleteReg(editingReg)}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          exportSingleBaptismFichaPDF(
                            {
                              ...editingReg,
                              fullName: fFullName,
                              cpf: fCpf,
                              birthDate: fBirthDate,
                              age: fAge,
                              gender: fGender,
                              naturalidade: fNaturalidade,
                              maritalStatus: fMaritalStatus,
                              spouseName: fMaritalStatus === 'Casado(a)' ? fSpouseName : '',
                              motherName: fMotherName,
                              fatherName: fFatherName,
                              phone: fPhone,
                              cep: fCep,
                              address: fAddress,
                              congregation: fCongregation,
                              guardianName: fGuardianName,
                              conversionDate: fConversionDate,
                              previouslyBaptized: fPreviouslyBaptized,
                              recommendingPastor: fRecommendingPastor,
                              baptismDate: fBaptismDate,
                              receivedBy: fReceivedBy,
                              secretaryNotes: fSecretaryNotes,
                              status: fStatus,
                            },
                            settings
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 text-xs font-semibold cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>Baixar PDF</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReg(null);
                      setIsNewManualOpen(false);
                    }}
                    className="px-4 min-h-[38px] rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingReg}
                    className="px-5 min-h-[38px] rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    {savingReg ? 'Salvando...' : 'Salvar Ficha'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QR CODE DO FORMULÁRIO PÚBLICO */}
      {qrModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setQrModalOpen(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-sm p-6 text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-100">
                QR Code — Inscrição Batismo
              </h3>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="QR Code do formulário de Batismo"
                className="w-56 h-56 mx-auto rounded-xl bg-white p-2"
              />
            )}

            <p className="text-xs text-neutral-400 break-all font-mono">{publicLink}</p>

            <div className="flex items-center justify-center gap-2">
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download="QRCode_Batismo_IEADAM.png"
                  className="inline-flex items-center gap-1.5 px-4 min-h-[38px] rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar QR Code</span>
                </a>
              )}
              <button
                type="button"
                onClick={handleCopyPublicLink}
                className="inline-flex items-center gap-1.5 px-4 min-h-[38px] rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-xs font-semibold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIMPAR / RESETAR FORMULÁRIO */}
      {resetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => !resettingAction && setResetModalOpen(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-100">
                    Limpar ou Resetar Formulário
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Escolha o que deseja limpar ou restaurar para um novo ciclo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={!!resettingAction}
                onClick={() => setResetModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={!!resettingAction}
                onClick={() => handleResetAction('settings')}
                className="w-full p-3.5 rounded-xl bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800 text-left space-y-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                <div className="text-xs font-bold text-amber-400">
                  {resettingAction === 'settings'
                    ? 'Restaurando configurações...'
                    : '1. Resetar apenas configurações e textos'}
                </div>
                <p className="text-[11px] text-neutral-400">
                  Restaura título, subtítulo, local, data e mensagens para o padrão e define o formulário como Aberto (mantém os {counts.total} inscritos atuais).
                </p>
              </button>

              <button
                type="button"
                disabled={!!resettingAction || counts.total === 0}
                onClick={() => handleResetAction('clear')}
                className="w-full p-3.5 rounded-xl bg-neutral-950 hover:bg-red-500/10 border border-neutral-800 hover:border-red-500/40 text-left space-y-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                <div className="text-xs font-bold text-red-300">
                  {resettingAction === 'clear'
                    ? 'Limpando fichas...'
                    : `2. Limpar lista de inscritos (${counts.total} ficha${counts.total === 1 ? '' : 's'})`}
                </div>
                <p className="text-[11px] text-neutral-400">
                  Remove todas as fichas enviadas até agora para iniciar uma nova turma de batismo do zero.
                </p>
              </button>

              <button
                type="button"
                disabled={!!resettingAction}
                onClick={() => handleResetAction('both')}
                className="w-full p-3.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-left space-y-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                <div className="text-xs font-bold text-red-200">
                  {resettingAction === 'both'
                    ? 'Executando reset completo...'
                    : '3. Reset completo (Limpar inscritos + Restaurar padrão)'}
                </div>
                <p className="text-[11px] text-red-200/75">
                  Zera a lista de inscritos e restaura todas as configurações do formulário para o estado inicial.
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={!!resettingAction}
                onClick={() => setResetModalOpen(false)}
                className="px-4 min-h-[36px] rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
