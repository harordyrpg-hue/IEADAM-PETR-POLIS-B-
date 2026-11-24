import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Building,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Droplets,
  Home,
  Lock,
  MapPin,
  Phone,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { BaptismFormSettings, BaptismRegistration } from '../../types.js';
import { api } from '../../services/api.js';
import { exportSingleBaptismFichaPDF } from '../../utils/baptismPdf.js';

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

const WaterAnimationBackdrop: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 overflow-hidden select-none"
  >
    {/* Subtle glowing water depth */}
    <div className="absolute inset-0 bg-gradient-to-b from-sky-950/35 via-cyan-950/20 to-sky-900/35" />

    {/* Floating droplets */}
    <div
      className="animate-water-droplet absolute bottom-6 left-[12%] w-2 h-2 rounded-full bg-sky-300/60"
      style={{ animationDelay: '0s' }}
    />
    <div
      className="animate-water-droplet absolute bottom-10 left-[32%] w-1.5 h-1.5 rounded-full bg-cyan-200/50"
      style={{ animationDelay: '1.1s' }}
    />
    <div
      className="animate-water-droplet absolute bottom-5 left-[58%] w-2.5 h-2.5 rounded-full bg-sky-400/45"
      style={{ animationDelay: '0.6s' }}
    />
    <div
      className="animate-water-droplet absolute bottom-8 left-[78%] w-1.5 h-1.5 rounded-full bg-cyan-300/60"
      style={{ animationDelay: '2.1s' }}
    />
    <div
      className="animate-water-droplet absolute bottom-4 left-[90%] w-2 h-2 rounded-full bg-sky-200/50"
      style={{ animationDelay: '1.7s' }}
    />

    {/* Layered Animated SVG Waves at the bottom */}
    <div
      className={`absolute bottom-0 left-0 right-0 ${
        compact ? 'h-16' : 'h-24 sm:h-28'
      } overflow-hidden`}
    >
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="animate-water-wave absolute bottom-0 left-0 w-[200%] h-full opacity-35"
      >
        <path
          d="M0,48 C150,92 300,8 450,52 C600,96 750,12 900,52 C1050,92 1150,24 1200,48 L1200,120 L0,120 Z"
          fill="#0284c7"
        />
      </svg>
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="animate-water-wave-reverse absolute bottom-0 left-0 w-[200%] h-[82%] opacity-40"
      >
        <path
          d="M0,64 C160,18 320,104 480,58 C640,12 800,100 960,56 C1080,22 1160,76 1200,64 L1200,120 L0,120 Z"
          fill="#06b6d4"
        />
      </svg>
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="animate-water-wave absolute bottom-0 left-0 w-[200%] h-[58%] opacity-30"
        style={{ animationDuration: '8.5s' }}
      >
        <path
          d="M0,72 C180,32 340,106 540,68 C740,30 920,102 1200,72 L1200,120 L0,120 Z"
          fill="#38bdf8"
        />
      </svg>
    </div>
  </div>
);

interface ChatLine {
  id: number;
  sender: 'espirito' | 'candidato';
  speaker: string;
  text: string;
}

export const PublicBaptismPage: React.FC = () => {
  const [settings, setSettings] = useState<BaptismFormSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Dados Pessoais (sem Dados Eclesiásticos no envio público — preenchidos depois pela Secretaria)
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Masc.' | 'Fem.' | ''>('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [congregation, setCongregation] = useState('IEADAM Petrópolis B');
  const [guardianName, setGuardianName] = useState('');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<BaptismRegistration | null>(null);

  // Animação de águas + Chat interativo ao final do formulário
  const chatSectionRef = useRef<HTMLDivElement | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const [chatPlaybackSeed, setChatPlaybackSeed] = useState(0);

  useEffect(() => {
    let active = true;
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
      unsub();
    };
  }, []);

  // Trigger sequential chat reveal when the end-of-form chat enters viewport
  useEffect(() => {
    const el = chatSectionRef.current;
    if (!el || chatStarted) return;

    if (typeof IntersectionObserver === 'undefined') {
      setChatStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setChatStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [chatStarted, loading, settings?.status, submittedRecord]);

  useEffect(() => {
    if (!chatStarted) return;
    setVisibleCount(1);

    const timers: number[] = [];
    const delays = [900, 1850, 2850, 3850, 4800];
    delays.forEach((delay, idx) => {
      const t = window.setTimeout(() => {
        setVisibleCount(idx + 2);
      }, delay);
      timers.push(t);
    });

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [chatStarted, chatPlaybackSeed]);

  const numericAge = Number(age);
  const isMinor = Boolean(age !== '' && !Number.isNaN(numericAge) && numericAge < 18);

  const handleBirthDateChange = (val: string) => {
    setBirthDate(val);
    const computed = computeAgeFromBirthDate(val);
    if (computed) setAge(computed);
  };

  const resetForm = () => {
    setFullName('');
    setBirthDate('');
    setAge('');
    setGender('');
    setPhone('');
    setAddress('');
    setCongregation('IEADAM Petrópolis B');
    setGuardianName('');
    setDeclarationAccepted(false);
    setFormError(null);
    setSubmittedRecord(null);
    setVisibleCount(0);
    setChatStarted(false);
  };

  const replayChat = () => {
    setChatStarted(true);
    setChatPlaybackSeed((prev) => prev + 1);
  };

  const candidateDisplayName = fullName.trim() || 'candidato(a)';
  const chatMessages: ChatLine[] = [
    {
      id: 1,
      sender: 'espirito',
      speaker: 'Espírito Santo',
      text: `Olá, ${candidateDisplayName} qual é a boa?`,
    },
    {
      id: 2,
      sender: 'candidato',
      speaker: fullName.trim() ? fullName.trim() : 'Candidato',
      text: 'Irei me batizar nas águas, estou muito feliz, finalmente chegou a hora',
    },
    {
      id: 3,
      sender: 'espirito',
      speaker: 'Espírito Santo',
      text: 'Que alegria, estou muito orgulhoso de você, pode ter certeza que é a melhor decisão',
    },
    {
      id: 4,
      sender: 'candidato',
      speaker: fullName.trim() ? fullName.trim() : 'Candidato',
      text: 'Será no dia 06 de Dezembro, na Congregação Canaã',
    },
    {
      id: 5,
      sender: 'espirito',
      speaker: 'Espírito Santo',
      text: 'Show! Estarei lá para te acompanhar',
    },
    {
      id: 6,
      sender: 'candidato',
      speaker: fullName.trim() ? fullName.trim() : 'Candidato',
      text: 'Você é convidado de honra! 😁',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError('Por favor, informe seu Nome Completo.');
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
    if (!phone.trim()) {
      setFormError('Por favor, informe seu Telefone / WhatsApp.');
      return;
    }
    if (!address.trim()) {
      setFormError('Por favor, informe seu Endereço.');
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
        birthDate,
        age,
        gender,
        phone,
        address,
        congregation,
        guardianName,
        declarationAccepted,
        declarationCity: 'Manaus / AM',
        declarationDate: new Date().toISOString().slice(0, 10),
      });
      setSubmittedRecord(created);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setFormError(err?.message || 'Não foi possível enviar sua inscrição. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const churchTitle =
    settings?.churchTitle || 'IEADAM Petrópolis B · PT-B Mídia';
  const formTitle = settings?.formTitle || 'Inscrição — Batismo nas Águas';
  const subtitle =
    settings?.subtitle || 'Ficha oficial da Secretaria · Somente dados pessoais essenciais';

  // ==========================================
  // 0. LOADING SCREEN (Padrão PT-B Mídia)
  // ==========================================
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-neutral-100">
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
      <div className="min-h-screen bg-neutral-950 text-neutral-100 py-6 sm:py-10 px-4 sm:px-6 flex items-center justify-center">
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
      <div className="min-h-screen bg-neutral-950 text-neutral-100 py-6 sm:py-10 px-4 sm:px-6 flex items-center justify-center">
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
  // 3. TELA DE CONFIRMAÇÃO FINAL (APÓS ENVIO)
  // ==========================================
  if (submittedRecord) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 py-8 sm:py-10 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="h-3 w-full bg-amber-400" />

          {/* Celebratory Water Header Banner */}
          <div className="relative overflow-hidden border-b border-neutral-800 px-6 py-8 text-center">
            <WaterAnimationBackdrop compact />
            <div className="relative z-10 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
                  Inscrição Confirmada com Sucesso!
                </span>
                <h1 className="text-2xl font-bold text-neutral-100 mt-1">
                  {submittedRecord.fullName}
                </h1>
                <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed max-w-md mx-auto">
                  Sua ficha já foi salva automaticamente na lista da Secretaria. A liderança completará seus dados eclesiásticos e confirmará tudo com você!
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
              <div className="flex items-center gap-2 text-neutral-200">
                <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Nascimento / Idade:</strong>{' '}
                  {formatDateBR(submittedRecord.birthDate)} ({submittedRecord.age} anos ·{' '}
                  {submittedRecord.gender})
                </span>
              </div>
              <div className="flex items-center gap-2 text-neutral-200">
                <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Telefone / WhatsApp:</strong>{' '}
                  <span className="font-mono">{submittedRecord.phone}</span>
                </span>
              </div>
              {submittedRecord.address && (
                <div className="flex items-start gap-2 text-neutral-300">
                  <Home className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Endereço:</strong> {submittedRecord.address}
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
  // 4. FORMULÁRIO PÚBLICO PADRÃO DO SITE
  // ==========================================
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-6 sm:py-10 px-4 sm:px-6 flex flex-col items-center">
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

          {/* Security / Instructions notice matching rules card */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Orientação da Secretaria</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Solicitamos apenas seus dados essenciais (sem CPF, RG, filiação, tipo sanguíneo ou dados financeiros). As informações eclesiásticas serão registradas posteriormente pela Secretaria.
            </p>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="border-t border-neutral-800 pt-4">
              <h2 className="text-base font-bold text-neutral-100 mb-1">
                Dados do Candidato(a)
              </h2>
              <p className="text-xs text-neutral-400 mb-4">
                Preencha seus dados pessoais abaixo para enviar sua ficha de inscrição à Secretaria.
              </p>
            </div>

            {/* Nome Completo */}
            <div>
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
                  className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                />
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
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  Idade *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Ex: 18"
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs font-mono tabular-nums"
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
                      className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
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
                    required
                    maxLength={40}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(92) 99999-9999"
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs font-mono tabular-nums"
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
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Endereço do Candidato */}
            <div>
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
                  placeholder="Rua, número, bairro..."
                  className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                />
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
                  className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
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

            {/* ANIMAÇÃO DE ÁGUAS + CHAT DE CONVERSA NO FINAL DA INSCRIÇÃO */}
            <div
              ref={chatSectionRef}
              className="relative rounded-2xl border border-sky-500/30 bg-neutral-950 overflow-hidden shadow-lg"
            >
              <WaterAnimationBackdrop />

              <div className="relative z-10 p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-sky-400/20">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/35 text-sky-300 flex items-center justify-center shrink-0">
                      <Droplets className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                        <span className="truncate">Momento Especial do Batismo</span>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      </div>
                      <p className="text-[11px] text-sky-200/80 truncate">
                        Conversa no caminho das águas
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={replayChat}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-900/85 hover:bg-neutral-800 border border-neutral-700/80 text-[11px] font-semibold text-neutral-300 cursor-pointer shrink-0 transition-colors"
                    title="Reproduzir conversa novamente"
                  >
                    <RotateCcw className="w-3 h-3 text-sky-300" />
                    <span>Rever</span>
                  </button>
                </div>

                {/* Chat Messages */}
                <div className="space-y-2.5 min-h-[210px]">
                  {chatMessages.slice(0, visibleCount).map((msg) => {
                    const isSpirit = msg.sender === 'espirito';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                          isSpirit ? 'items-start' : 'items-end'
                        }`}
                      >
                        <span
                          className={`text-[10px] font-bold mb-1 px-1 ${
                            isSpirit ? 'text-sky-300' : 'text-amber-300'
                          }`}
                        >
                          {msg.speaker}
                        </span>
                        <div
                          className={`max-w-[88%] sm:max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                            isSpirit
                              ? 'bg-neutral-900/95 border border-sky-400/35 text-neutral-100 rounded-tl-sm'
                              : 'bg-amber-400 text-neutral-950 font-semibold rounded-tr-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}

                  {chatStarted && visibleCount < chatMessages.length && (
                    <div
                      className={`flex ${
                        chatMessages[visibleCount]?.sender === 'espirito'
                          ? 'justify-start'
                          : 'justify-end'
                      }`}
                    >
                      <div className="px-3 py-2 rounded-2xl bg-neutral-900/85 border border-neutral-700/80 text-[11px] text-neutral-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"
                          style={{ animationDelay: '0.15s' }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"
                          style={{ animationDelay: '0.3s' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

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

            {/* Submit Button — Confirmar inscrição */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-2xl text-xs sm:text-sm shadow-xl transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer touch-manipulation"
              >
                {submitting ? (
                  <span>Confirmando inscrição...</span>
                ) : (
                  <>
                    <span>Confirmar Inscrição</span>
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
