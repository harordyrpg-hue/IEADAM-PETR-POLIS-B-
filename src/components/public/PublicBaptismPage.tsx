import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Heart,
  Home,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { BaptismFormSettings, BaptismRegistration } from '../../types.js';
import { api } from '../../services/api.js';
import { exportSingleBaptismFichaPDF } from '../../utils/baptismPdf.js';

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

function computeAgeFromBirthDate(birthDateStr: string): string {
  if (!birthDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) return '';
  const [y, m, d] = birthDateStr.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) {
    age--;
  }
  return age >= 0 && age <= 120 ? String(age) : '';
}

function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return 'A confirmar';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return dateStr;
}

type FormStep = 'form' | 'confirmed';

export const PublicBaptismPage: React.FC = () => {
  const [settings, setSettings] = useState<BaptismFormSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<FormStep>('form');

  // Dados Pessoais (sem Dados Eclesiásticos no envio público — preenchidos depois pela Secretaria)
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Masc.' | 'Fem.' | ''>('');
  const [naturalidade, setNaturalidade] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [spouseName, setSpouseName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [phone, setPhone] = useState('');
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState('');
  const [congregation, setCongregation] = useState('IEADAM Petrópolis B');
  const [guardianName, setGuardianName] = useState('');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<BaptismRegistration | null>(null);

  useEffect(() => {
    let active = true;
    const safetyTimer = window.setTimeout(() => {
      if (active) {
        setSettings((prev) => prev || api.getDefaultBaptismSettings());
        setLoading(false);
      }
    }, 2500);

    api
      .getBaptismFormSettings()
      .then((initial) => {
        if (active) {
          setSettings(initial);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setSettings(api.getDefaultBaptismSettings());
          setLoading(false);
        }
      });

    const unsub = api.subscribeBaptismFormSettings((live) => {
      if (active) {
        setSettings(live);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      window.clearTimeout(safetyTimer);
      unsub();
    };
  }, []);

  const numericAge = Number(age);
  const isMinor = Boolean(age !== '' && !Number.isNaN(numericAge) && numericAge < 18);

  const handleBirthDateChange = (val: string) => {
    setBirthDate(val);
    const computed = computeAgeFromBirthDate(val);
    if (computed) setAge(computed);
  };

  const resetForm = () => {
    setFullName('');
    setCpf('');
    setBirthDate('');
    setAge('');
    setGender('');
    setNaturalidade('');
    setMaritalStatus('');
    setSpouseName('');
    setMotherName('');
    setFatherName('');
    setPhone('');
    setCep('');
    setAddress('');
    setCongregation('IEADAM Petrópolis B');
    setGuardianName('');
    setDeclarationAccepted(false);
    setFormError(null);
    setSubmittedRecord(null);
    setStep('form');
  };

  // Validar e salvar inscrição diretamente, abrindo a tela de confirmação
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError('Por favor, informe seu Nome Completo.');
      return;
    }
    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11) {
      setFormError('Por favor, informe um CPF válido com 11 dígitos.');
      return;
    }
    if (!birthDate.trim()) {
      setFormError('Por favor, informe sua Data de Nascimento.');
      return;
    }
    if (!age.trim()) {
      setFormError('Por favor, informe sua Idade.');
      return;
    }
    if (!gender) {
      setFormError('Por favor, selecione o Sexo (Masc. ou Fem.).');
      return;
    }
    if (!naturalidade.trim()) {
      setFormError('Por favor, informe sua Naturalidade (cidade/estado de nascimento).');
      return;
    }
    if (!maritalStatus.trim()) {
      setFormError('Por favor, selecione seu Estado Civil.');
      return;
    }
    if (maritalStatus === 'Casado(a)' && !spouseName.trim()) {
      setFormError('Por favor, informe o Nome do Cônjuge.');
      return;
    }
    if (!motherName.trim()) {
      setFormError('Por favor, informe o Nome da Mãe.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Por favor, informe seu Telefone / WhatsApp.');
      return;
    }
    const cepDigits = cep.replace(/\D/g, '');
    if (cepDigits.length !== 8) {
      setFormError('Por favor, informe um CEP válido com 8 dígitos.');
      return;
    }
    if (!address.trim()) {
      setFormError('Por favor, informe seu Endereço completo.');
      return;
    }
    if (!congregation.trim()) {
      setFormError('Por favor, informe sua Congregação / Núcleo.');
      return;
    }
    if (isMinor && !guardianName.trim()) {
      setFormError('Como o candidato é menor de 18 anos, informe o Nome do Responsável.');
      return;
    }
    if (!declarationAccepted) {
      setFormError('É necessário confirmar a declaração de decisão pessoal pelo batismo.');
      return;
    }

    try {
      setSubmitting(true);
      const created = await api.submitPublicBaptismRegistration({
        fullName,
        cpf,
        birthDate,
        age,
        gender,
        naturalidade,
        maritalStatus,
        spouseName: maritalStatus === 'Casado(a)' ? spouseName : '',
        motherName,
        fatherName,
        phone,
        cep,
        address,
        congregation,
        guardianName,
        declarationAccepted,
        declarationCity: 'Manaus / AM',
        declarationDate: new Date().toISOString().slice(0, 10),
      });
      setSubmittedRecord(created);
      setStep('confirmed');
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        window.scrollTo(0, 0);
      }
    } catch (err: any) {
      setFormError(
        err?.message || 'Não foi possível enviar sua inscrição. Tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const churchTitle = settings?.churchTitle || 'IEADAM Petrópolis B · PT-B Mídia';
  const formTitle = settings?.formTitle || 'Inscrição — Batismo nas Águas';
  const rawSubtitle = settings?.subtitle || '';
  const subtitle =
    !rawSubtitle || /exclusivo\s+da\s+secretaria/i.test(rawSubtitle)
      ? 'Ficha oficial de inscrição para o Batismo nas Águas'
      : rawSubtitle;

  // ==========================================
  // 0. LOADING SCREEN (Padrão PT-B Mídia)
  // ==========================================
  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-neutral-950 flex flex-col items-center justify-center p-6 text-neutral-100">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-500 font-bold text-lg flex items-center justify-center border border-amber-500/30 animate-pulse mb-3">
          PTB
        </div>
        <p className="text-sm font-semibold text-neutral-300">
          Carregando formulário de inscrição...
        </p>
        <p className="text-xs text-neutral-500 mt-1">IEADAM Petrópolis B · PT-B Mídia</p>
      </div>
    );
  }

  // ==========================================
  // 1. FORMULÁRIO PAUSADO
  // ==========================================
  if (settings?.status === 'pausado') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-neutral-950 text-neutral-100 py-6 sm:py-10 px-4 sm:px-6 flex items-center justify-center overflow-x-hidden">
        <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="h-3 w-full bg-amber-400" />
          <div className="p-6 sm:p-8 space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
              <Clock className="w-8 h-8" />
            </div>

            <div>
              <div className="text-[11px] font-bold tracking-wider uppercase text-amber-400">
                {churchTitle}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 mt-1">
                Formulário Temporariamente Pausado
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed max-w-md mx-auto">
                {settings.pausedMessage ||
                  'As inscrições para o Batismo nas Águas estão temporariamente pausadas pela Secretaria. Aguarde a reabertura ou procure a equipe da igreja.'}
              </p>
            </div>

            <div className="pt-4 border-t border-neutral-800 text-[11px] text-neutral-500">
              IEADAM Petrópolis B · Secretaria &amp; Ministério de Mídia (PT-B Mídia)
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. FORMULÁRIO FECHADO
  // ==========================================
  if (settings?.status === 'fechado') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-neutral-950 text-neutral-100 py-6 sm:py-10 px-4 sm:px-6 flex items-center justify-center overflow-x-hidden">
        <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="h-3 w-full bg-red-600" />
          <div className="p-6 sm:p-8 space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 mx-auto flex items-center justify-center">
              <Lock className="w-8 h-8" />
            </div>

            <div>
              <div className="text-[11px] font-bold tracking-wider uppercase text-red-400">
                {churchTitle}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 mt-1">
                Inscrições Encerradas
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed max-w-md mx-auto">
                {settings.closedMessage ||
                  'As inscrições para este período de Batismo nas Águas foram encerradas pela Secretaria.'}
              </p>
            </div>

            <div className="pt-4 border-t border-neutral-800 text-[11px] text-neutral-500">
              IEADAM Petrópolis B · Secretaria &amp; Ministério de Mídia (PT-B Mídia)
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 3. TELA DE CONFIRMAÇÃO E ENCERRAMENTO DO FORMULÁRIO
  // ==========================================
  if (step === 'confirmed' && submittedRecord) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-neutral-950 text-neutral-100 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:py-10 px-4 sm:px-6 flex items-center justify-center overflow-x-hidden">
        <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="h-3 w-full bg-amber-400" />

          <div className="bg-gradient-to-br from-emerald-950/50 via-neutral-900 to-neutral-950 border-b border-neutral-800 px-5 sm:px-6 py-7 text-center">
            <div className="space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="text-xs font-bold tracking-wider uppercase text-emerald-400">
                Inscrição Confirmada com Sucesso!
              </div>

              <div>
                <h1 className="text-2xl font-bold text-neutral-100">
                  {submittedRecord.fullName}
                </h1>
                <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed max-w-md mx-auto">
                  Sua inscrição foi finalizada e enviada automaticamente para a direção da igreja e Secretaria. Em breve a equipe entrará em contato!
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-5 text-center">
            <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-2xl inline-block">
              <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                Protocolo da Inscrição
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-amber-400 tracking-wider mt-0.5">
                {submittedRecord.protocolNumber}
              </div>
            </div>

            <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-2xl text-left space-y-2 text-xs">
              {submittedRecord.cpf && (
                <div className="flex items-center gap-2 text-neutral-200">
                  <CreditCard className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>CPF:</strong>{' '}
                    <span className="font-mono">{submittedRecord.cpf}</span>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-neutral-200">
                <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Nascimento / Idade:</strong>{' '}
                  {formatDateBR(submittedRecord.birthDate)} ({submittedRecord.age} anos ·{' '}
                  {submittedRecord.gender})
                </span>
              </div>
              {submittedRecord.naturalidade && (
                <div className="flex items-center gap-2 text-neutral-200">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Naturalidade:</strong> {submittedRecord.naturalidade}
                  </span>
                </div>
              )}
              {submittedRecord.maritalStatus && (
                <div className="flex items-center gap-2 text-neutral-200">
                  <Heart className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Estado Civil:</strong> {submittedRecord.maritalStatus}
                    {submittedRecord.maritalStatus === 'Casado(a)' && submittedRecord.spouseName
                      ? ` · Cônjuge: ${submittedRecord.spouseName}`
                      : ''}
                  </span>
                </div>
              )}
              {submittedRecord.motherName && (
                <div className="flex items-start gap-2 text-neutral-300">
                  <Users className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Filiação:</strong> Mãe: {submittedRecord.motherName}
                    {submittedRecord.fatherName ? ` · Pai: ${submittedRecord.fatherName}` : ''}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-neutral-200">
                <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Telefone / WhatsApp:</strong>{' '}
                  <span className="font-mono">{submittedRecord.phone}</span>
                </span>
              </div>
              {(submittedRecord.cep || submittedRecord.address) && (
                <div className="flex items-start gap-2 text-neutral-300">
                  <Home className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Endereço:</strong>{' '}
                    {submittedRecord.cep ? `CEP ${submittedRecord.cep} — ` : ''}
                    {submittedRecord.address}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-neutral-300">
                <Building className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Congregação / Núcleo:</strong> {submittedRecord.congregation}
                </span>
              </div>
              {submittedRecord.guardianName && (
                <div className="flex items-center gap-2 text-neutral-300">
                  <Users className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Responsável:</strong> {submittedRecord.guardianName}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={() => exportSingleBaptismFichaPDF(submittedRecord, settings)}
                className="flex-1 py-3 px-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 touch-manipulation cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Comprovante &amp; Ficha (PDF)</span>
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 border border-neutral-700 transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>Nova Inscrição</span>
              </button>
            </div>

            <div className="pt-4 border-t border-neutral-800 text-[11px] text-neutral-500">
              IEADAM Petrópolis B · Secretaria &amp; Ministério de Mídia (PT-B Mídia)
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 5. FORMULÁRIO PÚBLICO PADRÃO DO SITE (ETAPA 1)
  // ==========================================
  return (
    <div className="min-h-screen min-h-[100dvh] bg-neutral-950 text-neutral-100 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:py-10 px-3 sm:px-6 flex flex-col items-center overflow-x-hidden">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Top Gradient Banner — idêntico ao padrão de Inscrição de Eventos */}
        <div className="p-6 sm:p-8 bg-gradient-to-br from-amber-950/80 via-neutral-900 to-neutral-950 border-b border-neutral-800">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
            <Building className="w-4 h-4" />
            <span>{churchTitle}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100">
            {formTitle}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 mt-1.5">{subtitle}</p>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Logistics strip (if configured by admin) */}
          {(settings?.nextBaptismDate || settings?.baptismLocation) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
              {settings.nextBaptismDate && (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase font-semibold text-neutral-400">
                      Previsão do Batismo
                    </div>
                    <div className="text-xs font-bold text-neutral-100 font-mono tabular-nums truncate">
                      {formatDateBR(settings.nextBaptismDate)}
                    </div>
                  </div>
                </div>
              )}

              {settings.baptismLocation && (
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase font-semibold text-neutral-400">
                      Local
                    </div>
                    <div
                      className="text-xs font-bold text-neutral-100 truncate"
                      title={settings.baptismLocation}
                    >
                      {settings.baptismLocation}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Orientation Box */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Orientação de Preenchimento</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Preencha todo o formulário com atenção e dados corretos (apenas o Nome do Pai é opcional, e o Nome do Responsável caso seja menor de 18 anos). Todas as informações preenchidas serão enviadas diretamente para a direção da igreja para validação e organização do batismo.
            </p>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmitRegistration} className="space-y-4 pt-1">
            <div className="border-t border-neutral-800 pt-4">
              <h2 className="text-base font-bold text-neutral-100 mb-1">
                Dados do Candidato(a)
              </h2>
              <p className="text-xs text-neutral-400 mb-4">
                Preencha todos os campos abaixo e clique em Enviar Inscrição.
              </p>
            </div>

            {/* Nome Completo & CPF */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7">
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Nome Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={180}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs"
                  />
                </div>
              </div>

              <div className="sm:col-span-5">
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  CPF *
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={14}
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Data de Nascimento, Idade, Sexo */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Data de Nascimento *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => handleBirthDateChange(e.target.value)}
                    className="w-full min-h-[44px] appearance-none pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 text-base sm:text-xs"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Idade *
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  required
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Ex: 18"
                  className="w-full min-h-[44px] px-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs font-mono tabular-nums"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Sexo *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Masc.', 'Fem.'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setGender(opt)}
                      className={`min-h-[44px] px-3 rounded-xl border text-sm sm:text-xs font-semibold transition-colors cursor-pointer ${
                        gender === opt
                          ? 'bg-amber-400 border-amber-400 text-neutral-950 font-bold'
                          : 'bg-neutral-950 border-neutral-700 text-neutral-300 hover:border-neutral-600'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Naturalidade & Estado Civil */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Naturalidade *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={naturalidade}
                    onChange={(e) => setNaturalidade(e.target.value)}
                    placeholder="Cidade / UF de nascimento (ex: Manaus / AM)"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Estado Civil *
                </label>
                <div className="relative">
                  <Heart className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    required
                    value={maritalStatus}
                    onChange={(e) => {
                      const next = e.target.value;
                      setMaritalStatus(next);
                      if (next !== 'Casado(a)') {
                        setSpouseName('');
                      }
                    }}
                    className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 text-base sm:text-xs"
                  >
                    <option value="">Selecione...</option>
                    <option value="Solteiro(a)">Solteiro(a)</option>
                    <option value="Casado(a)">Casado(a)</option>
                    <option value="Divorciado(a)">Divorciado(a)</option>
                    <option value="Viúvo(a)">Viúvo(a)</option>
                    <option value="Separado(a)">Separado(a)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Nome do Cônjuge (condicional para Casado(a)) */}
            {maritalStatus === 'Casado(a)' && (
              <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/30">
                <label className="block text-[11px] font-semibold text-amber-300 uppercase tracking-wider mb-1">
                  Nome do Cônjuge *
                </label>
                <div className="relative">
                  <Heart className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={180}
                    value={spouseName}
                    onChange={(e) => setSpouseName(e.target.value)}
                    placeholder="Nome completo do(a) esposo(a)"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-amber-500/40 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs"
                  />
                </div>
              </div>
            )}

            {/* Filiação: Nome da Mãe (obrigatório) & Nome do Pai (opcional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Nome da Mãe *
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={180}
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="Nome completo da mãe"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Nome do Pai <span className="text-neutral-400 normal-case font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={180}
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="Nome completo do pai (não obrigatório)"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Telefone / WhatsApp & Congregação / Núcleo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Telefone / WhatsApp *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    maxLength={40}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(92) 99999-9999"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Congregação / Núcleo *
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={140}
                    value={congregation}
                    onChange={(e) => setCongregation(e.target.value)}
                    placeholder="Ex: IEADAM Petrópolis B"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs"
                  />
                </div>
              </div>
            </div>

            {/* CEP & Endereço do Candidato */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  CEP *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={9}
                    value={cep}
                    onChange={(e) => setCep(formatCEP(e.target.value))}
                    placeholder="00000-000"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="sm:col-span-8">
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Endereço *
                </label>
                <div className="relative">
                  <Home className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={280}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, número, complemento, bairro..."
                    className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Nome do Responsável (se menor de 18 anos) */}
            <div>
              <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                Nome do Responsável (se menor de 18 anos){isMinor ? ' *' : ''}
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required={isMinor}
                  maxLength={180}
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder={
                    isMinor
                      ? 'Obrigatório para candidatos menores de 18 anos'
                      : 'Preencha caso o candidato seja menor de 18 anos'
                  }
                  className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-base sm:text-xs"
                />
              </div>
            </div>

            {/* Declaração */}
            <label className="flex items-start gap-2.5 p-3.5 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-300 cursor-pointer hover:border-neutral-700 transition-colors">
              <input
                type="checkbox"
                checked={declarationAccepted}
                onChange={(e) => setDeclarationAccepted(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-400 bg-neutral-900 border-neutral-700 mt-0.5 shrink-0 cursor-pointer"
              />
              <span className="leading-relaxed">
                Declaro que desejo me batizar nas águas, conforme minha fé e decisão pessoal, e estou ciente das orientações da igreja sobre o batismo.
              </span>
            </label>

            {/* Inline Validation Feedback */}
            {formError && (
              <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl flex items-start justify-between gap-2 text-xs text-red-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="text-red-300 hover:text-white text-xs font-bold px-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}

            {/* Submit Button -> Enviar Inscrição */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-2xl text-xs sm:text-sm shadow-xl transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
              >
                {submitting ? (
                  <span>Enviando inscrição...</span>
                ) : (
                  <>
                    <span>Enviar Inscrição</span>
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer branding — idêntico ao padrão de Inscrição de Eventos */}
          <div className="text-center pt-6 border-t border-neutral-800 text-[11px] text-neutral-500">
            IEADAM Petrópolis B · Secretaria &amp; Ministério de Mídia (PT-B Mídia)
          </div>
        </div>
      </div>
    </div>
  );
};
