import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Download,
  Share2,
  FileText,
  AlertCircle,
  Building,
  User,
  Phone,
  Mail,
  Shield,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  QrCode,
} from 'lucide-react';
import QRCode from 'qrcode';
import { PublicRegistrationEvent, EventRegistration, RegistrationThemeColor } from '../../types.js';
import { api } from '../../services/api.js';
import { exportRegistrationTicketPDF, formatDateBR } from '../../utils/registrationTicketPdf.js';

interface PublicEventRegistrationPageProps {
  eventId: string;
  onExit?: () => void;
}

export const PublicEventRegistrationPage: React.FC<PublicEventRegistrationPageProps> = ({
  eventId,
  onExit,
}) => {
  const [event, setEvent] = useState<PublicRegistrationEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [church, setChurch] = useState('IEADAM Petrópolis B');
  const [area, setArea] = useState('');
  const [responsibleLeader, setResponsibleLeader] = useState('');
  const [responsiblePastor, setResponsiblePastor] = useState('');
  const [customResponses, setCustomResponses] = useState<Record<string, any>>({});
  const [acceptedRules, setAcceptedRules] = useState(false);

  // Submitting & Confirmation State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedRegistration, setConfirmedRegistration] = useState<EventRegistration | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadEvent() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getPublicEventById(eventId);
        if (!isMounted) return;
        if (!data) {
          setError('Evento não encontrado ou link expirado.');
        } else {
          setEvent(data);
        }
      } catch (err) {
        if (isMounted) setError('Erro ao carregar informações do evento.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadEvent();
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  // Generate QR Code image when registration is confirmed
  useEffect(() => {
    if (confirmedRegistration) {
      QRCode.toDataURL(confirmedRegistration.qrCodeData, {
        width: 360,
        margin: 1.5,
        color: { dark: '#000000', light: '#ffffff' },
      }).then(setQrCodeDataUrl);
    }
  }, [confirmedRegistration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    if (!fullName.trim() || !phone.trim()) {
      alert('Por favor, preencha seu Nome Completo e Telefone.');
      return;
    }

    if (event.rulesAndNotes && !acceptedRules) {
      alert('Por favor, marque a caixa confirmando que está ciente das regras do evento.');
      return;
    }

    try {
      setIsSubmitting(true);
      const reg = await api.createEventRegistration({
        eventId: event.id,
        eventName: event.name,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        church: church.trim() || undefined,
        area: area.trim() || undefined,
        responsibleLeader: responsibleLeader.trim() || undefined,
        responsiblePastor: responsiblePastor.trim() || undefined,
        customResponses,
      });

      setConfirmedRegistration(reg);
    } catch (err) {
      alert('Erro ao confirmar inscrição. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!confirmedRegistration || !event) return;
    await exportRegistrationTicketPDF(confirmedRegistration, event);
  };

  const handleDownloadQR = () => {
    if (!qrCodeDataUrl || !confirmedRegistration) return;
    const link = document.createElement('a');
    link.download = `qrcode_${confirmedRegistration.id}.png`;
    link.href = qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Theme color styles
  const getThemeClasses = (color?: RegistrationThemeColor) => {
    switch (color) {
      case 'emerald':
        return {
          bannerGrad: 'from-emerald-950/80 via-neutral-900 to-neutral-950',
          accentText: 'text-emerald-400',
          accentBorder: 'border-emerald-500/40',
          accentBg: 'bg-emerald-500',
          buttonHover: 'hover:bg-emerald-400',
        };
      case 'blue':
        return {
          bannerGrad: 'from-blue-950/80 via-neutral-900 to-neutral-950',
          accentText: 'text-blue-400',
          accentBorder: 'border-blue-500/40',
          accentBg: 'bg-blue-500',
          buttonHover: 'hover:bg-blue-400',
        };
      case 'indigo':
        return {
          bannerGrad: 'from-indigo-950/80 via-neutral-900 to-neutral-950',
          accentText: 'text-indigo-400',
          accentBorder: 'border-indigo-500/40',
          accentBg: 'bg-indigo-500',
          buttonHover: 'hover:bg-indigo-400',
        };
      case 'rose':
        return {
          bannerGrad: 'from-rose-950/80 via-neutral-900 to-neutral-950',
          accentText: 'text-rose-400',
          accentBorder: 'border-rose-500/40',
          accentBg: 'bg-rose-500',
          buttonHover: 'hover:bg-rose-400',
        };
      case 'purple':
        return {
          bannerGrad: 'from-purple-950/80 via-neutral-900 to-neutral-950',
          accentText: 'text-purple-400',
          accentBorder: 'border-purple-500/40',
          accentBg: 'bg-purple-500',
          buttonHover: 'hover:bg-purple-400',
        };
      default:
        // Amber theme
        return {
          bannerGrad: 'from-amber-950/80 via-neutral-900 to-neutral-950',
          accentText: 'text-amber-400',
          accentBorder: 'border-amber-500/40',
          accentBg: 'bg-amber-400',
          buttonHover: 'hover:bg-amber-300',
        };
    }
  };

  const theme = getThemeClasses(event?.themeColor);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-neutral-100">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-500 font-bold text-lg flex items-center justify-center border border-amber-500/30 animate-pulse mb-3">
          PTB
        </div>
        <p className="text-sm font-semibold text-neutral-300">Carregando formulário de inscrição...</p>
        <p className="text-xs text-neutral-500 mt-1">IEADAM Petrópolis B · PT-B Mídia</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center text-neutral-100">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Evento Não Encontrado</h2>
        <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed">
          {error || 'O link pode estar incorreto ou o evento foi cancelado pela organização.'}
        </p>
        {onExit && (
          <button
            onClick={onExit}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl"
          >
            Voltar ao Início
          </button>
        )}
      </div>
    );
  }

  // 1. CONFIRMATION SCREEN (POST-SUBMIT SUCCESS)
  if (confirmedRegistration) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 py-10 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* Header Accent Bar */}
          <div className={`h-3 w-full ${theme.accentBg}`} />

          <div className="p-6 sm:p-8 space-y-6 text-center">
            {/* Success Icon */}
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
                Inscrição Confirmada com Sucesso!
              </span>
              <h1 className="text-2xl font-bold text-neutral-100 mt-1">
                {confirmedRegistration.fullName}
              </h1>
              <p className="text-xs text-neutral-400 mt-1">
                Sua credencial para o evento <strong>{confirmedRegistration.eventName}</strong> está garantida.
              </p>
            </div>

            {/* Registration Code Badge */}
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-2xl inline-block">
              <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                Código de Inscrição (Check-In)
              </div>
              <div className="text-xl font-bold font-mono-numbers text-amber-400 tracking-wider mt-0.5">
                {confirmedRegistration.id}
              </div>
            </div>

            {/* QR Code Container */}
            {qrCodeDataUrl && (
              <div className="p-5 bg-white rounded-2xl inline-block shadow-lg border border-neutral-300">
                <img
                  src={qrCodeDataUrl}
                  alt={`QR Code ${confirmedRegistration.id}`}
                  className="w-48 h-48 sm:w-56 sm:h-56 mx-auto object-contain"
                />
                <div className="text-[10px] font-bold text-neutral-800 mt-2 tracking-wide uppercase">
                  Apresente este QR Code no credenciamento
                </div>
              </div>
            )}

            {/* Event Logistics Reminder */}
            <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-2xl text-left space-y-2 text-xs">
              <div className="flex items-center gap-2 text-neutral-200">
                <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Data:</strong> {formatDateBR(event.date)} às {event.time}
                </span>
              </div>
              <div className="flex items-center gap-2 text-neutral-200">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Local:</strong> {event.location}
                </span>
              </div>
              {confirmedRegistration.church && (
                <div className="flex items-center gap-2 text-neutral-300">
                  <Building className="w-4 h-4 text-neutral-400 shrink-0" />
                  <span>
                    <strong>Igreja / Congregação:</strong> {confirmedRegistration.church}
                  </span>
                </div>
              )}
            </div>

            {/* Download Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleDownloadPDF}
                className="flex-1 py-3 px-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 touch-manipulation cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Comprovante em PDF</span>
              </button>

              <button
                onClick={handleDownloadQR}
                className="py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 border border-neutral-700 transition-colors"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>Salvar Imagem QR</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setConfirmedRegistration(null);
                  setFullName('');
                  setPhone('');
                  setEmail('');
                  setArea('');
                  setResponsibleLeader('');
                  setResponsiblePastor('');
                  setAcceptedRules(false);
                }}
                className="text-xs text-neutral-400 hover:text-neutral-200 underline"
              >
                Fazer outra inscrição neste evento
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. PUBLIC REGISTRATION FORM
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-6 sm:py-12 px-4 sm:px-6 flex justify-center">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Banner image or top gradient */}
        {event.bannerUrl ? (
          <div className="relative w-full h-48 sm:h-64 overflow-hidden bg-neutral-950">
            <img
              src={event.bannerUrl}
              alt={event.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/40 to-transparent" />
          </div>
        ) : (
          <div className={`p-8 bg-gradient-to-br ${theme.bannerGrad} border-b border-neutral-800`}>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
              <Building className="w-4 h-4" />
              IEADAM Petrópolis B · PT-B Mídia
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100">
              {event.name}
            </h1>
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-6">
          {/* Event Title if banner was present */}
          {event.bannerUrl && (
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                <Building className="w-4 h-4" />
                IEADAM Petrópolis B · PT-B Mídia
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-100">
                {event.name}
              </h1>
            </div>
          )}

          {/* Logistics Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-neutral-950 rounded-2xl border border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-semibold text-neutral-400">Data</div>
                <div className="text-xs font-bold text-neutral-100 font-mono-numbers truncate">
                  {formatDateBR(event.date)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-semibold text-neutral-400">Horário</div>
                <div className="text-xs font-bold text-neutral-100 truncate">
                  {event.time}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:col-span-1">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-semibold text-neutral-400">Local</div>
                <div className="text-xs font-bold text-neutral-100 truncate" title={event.location}>
                  {event.location}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          )}

          {/* Rules and notes card */}
          {event.rulesAndNotes && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span>Anotações & Regras do Evento</span>
              </div>
              <p className="text-xs text-neutral-300 whitespace-pre-line leading-relaxed">
                {event.rulesAndNotes}
              </p>
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="border-t border-neutral-800 pt-4">
              <h2 className="text-base font-bold text-neutral-100 mb-1">
                Formulário de Inscrição
              </h2>
              <p className="text-xs text-neutral-400 mb-4">
                Preencha os dados abaixo para emitir sua credencial com QR Code.
              </p>
            </div>

            {/* Standard: Nome Completo */}
            {event.standardFields?.fullName?.enabled !== false && (
              <div>
                <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                  {event.standardFields?.fullName?.label || 'Nome Completo'} *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required={event.standardFields?.fullName?.required !== false}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Standard: Telefone / WhatsApp & E-mail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {event.standardFields?.phone?.enabled !== false && (
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    {event.standardFields?.phone?.label || 'Telefone / WhatsApp'} *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      required={event.standardFields?.phone?.required !== false}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(92) 99999-9999"
                      className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs font-mono-numbers"
                    />
                  </div>
                </div>
              )}

              {event.standardFields?.email?.enabled !== false && (
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    {event.standardFields?.email?.label || 'E-mail'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required={event.standardFields?.email?.required === true}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Standard: Igreja & Área */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {event.standardFields?.church?.enabled !== false && (
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    {event.standardFields?.church?.label || 'Igreja / Congregação'}
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required={event.standardFields?.church?.required === true}
                      value={church}
                      onChange={(e) => setChurch(e.target.value)}
                      placeholder="Ex: IEADAM Petrópolis B, Templo Central"
                      className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                    />
                  </div>
                </div>
              )}

              {event.standardFields?.area?.enabled !== false && (
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    {event.standardFields?.area?.label || 'Área'}
                  </label>
                  <input
                    type="text"
                    required={event.standardFields?.area?.required === true}
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Ex: Área 05, Área Central, etc."
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Standard: Líder Responsável & Pastor Responsável */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {event.standardFields?.responsibleLeader?.enabled !== false && (
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    {event.standardFields?.responsibleLeader?.label || 'Líder Responsável'}
                  </label>
                  <input
                    type="text"
                    required={event.standardFields?.responsibleLeader?.required === true}
                    value={responsibleLeader}
                    onChange={(e) => setResponsibleLeader(e.target.value)}
                    placeholder="Nome do seu líder de mídia/grupo"
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>
              )}

              {event.standardFields?.responsiblePastor?.enabled !== false && (
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                    {event.standardFields?.responsiblePastor?.label || 'Pastor Responsável'}
                  </label>
                  <input
                    type="text"
                    required={event.standardFields?.responsiblePastor?.required === true}
                    value={responsiblePastor}
                    onChange={(e) => setResponsiblePastor(e.target.value)}
                    placeholder="Nome do pastor da congregação"
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Custom Configurable Fields (if added by admin) */}
            {event.customFields && event.customFields.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Perguntas Adicionais
                </div>
                {event.customFields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      {field.label} {field.required && '*'}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        required={field.required}
                        value={customResponses[field.id] || ''}
                        onChange={(e) =>
                          setCustomResponses((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 focus:outline-none focus:border-amber-400 text-xs"
                      >
                        <option value="">Selecione uma opção...</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        rows={2}
                        required={field.required}
                        value={customResponses[field.id] || ''}
                        onChange={(e) =>
                          setCustomResponses((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        placeholder={field.placeholder || ''}
                        className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                      />
                    ) : field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          required={field.required}
                          checked={!!customResponses[field.id]}
                          onChange={(e) =>
                            setCustomResponses((prev) => ({ ...prev, [field.id]: e.target.checked }))
                          }
                          className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-neutral-900 border-neutral-700"
                        />
                        <span>{field.placeholder || field.label}</span>
                      </label>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        required={field.required}
                        value={customResponses[field.id] || ''}
                        onChange={(e) =>
                          setCustomResponses((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        placeholder={field.placeholder || ''}
                        className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Checkbox: Declaro estar ciente das regras */}
            {event.rulesAndNotes && (
              <label className="flex items-start gap-2.5 p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-xs text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={acceptedRules}
                  onChange={(e) => setAcceptedRules(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-neutral-900 border-neutral-700 mt-0.5 shrink-0"
                />
                <span className="leading-relaxed">
                  Declaro que li e estou ciente das regras, horários e orientações deste evento.
                </span>
              </label>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3.5 px-4 ${theme.accentBg} ${theme.buttonHover} text-neutral-950 font-bold rounded-2xl text-xs sm:text-sm shadow-xl transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer touch-manipulation`}
              >
                {isSubmitting ? (
                  <span>Processando inscrição...</span>
                ) : (
                  <>
                    <span>Confirmar Inscrição & Obter Credencial</span>
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer branding */}
          <div className="text-center pt-6 border-t border-neutral-800 text-[11px] text-neutral-500">
            IEADAM Petrópolis B · Ministério de Mídia & Comunicação (PT-B Mídia)
          </div>
        </div>
      </div>
    </div>
  );
};
