import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Download,
  FileText,
  AlertCircle,
  Building,
  User,
  Phone,
  Mail,
  ChevronRight,
  QrCode,
  Copy,
  Check,
  MessageCircle,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
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

  // Submitting, Pending Payment & Confirmation State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<EventRegistration | null>(null);
  const [confirmedRegistration, setConfirmedRegistration] = useState<EventRegistration | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // Payment UI state
  const [pixCopied, setPixCopied] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [hasInteractedWithPayment, setHasInteractedWithPayment] = useState(false);

  // Load Event Data
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

          // Check if session has a pending registration for this event
          const cachedRegJson = sessionStorage.getItem(`pending_reg_${eventId}`);
          if (cachedRegJson) {
            try {
              const cachedReg = JSON.parse(cachedRegJson) as EventRegistration;
              if (cachedReg && cachedReg.id) {
                setPendingRegistration(cachedReg);
              }
            } catch {
              // ignore json parse error
            }
          }
        }
      } catch {
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

  // Real-time listener for pending paid registration
  useEffect(() => {
    if (!pendingRegistration?.id) return;

    const unsubscribe = api.subscribeSingleRegistration(pendingRegistration.id, (updatedReg) => {
      if (!updatedReg) return;

      // Update pending registration state (e.g. wait time extension by admin)
      setPendingRegistration(updatedReg);
      sessionStorage.setItem(`pending_reg_${eventId}`, JSON.stringify(updatedReg));

      // If admin confirmed payment
      if (updatedReg.paymentStatus === 'paid' || updatedReg.status === 'confirmada') {
        setConfirmedRegistration(updatedReg);
        setPendingRegistration(null);
        sessionStorage.removeItem(`pending_reg_${eventId}`);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [pendingRegistration?.id, eventId]);

  // Countdown timer for pending payment
  useEffect(() => {
    if (!pendingRegistration || confirmedRegistration) {
      setRemainingSeconds(null);
      return;
    }

    const calcRemaining = () => {
      if (!pendingRegistration.paymentExpiresAt) {
        // Fallback: timeout minutes from registration time
        const createdMs = pendingRegistration.registeredAt || pendingRegistration.createdAt
          ? new Date(pendingRegistration.registeredAt || pendingRegistration.createdAt!).getTime()
          : Date.now();
        const timeoutMs = (event?.paymentTimeoutMinutes || 15) * 60 * 1000;
        const diff = Math.floor((createdMs + timeoutMs - Date.now()) / 1000);
        return Math.max(0, diff);
      }
      const expiresMs = new Date(pendingRegistration.paymentExpiresAt).getTime();
      const diff = Math.floor((expiresMs - Date.now()) / 1000);
      return Math.max(0, diff);
    };

    setRemainingSeconds(calcRemaining());

    const interval = setInterval(() => {
      const rem = calcRemaining();
      setRemainingSeconds(rem);
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingRegistration, confirmedRegistration, event?.paymentTimeoutMinutes]);

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

      if (event.isPaid) {
        // Switch to payment waiting screen
        setPendingRegistration(reg);
        sessionStorage.setItem(`pending_reg_${eventId}`, JSON.stringify(reg));
      } else {
        // Free event: instant confirmation
        setConfirmedRegistration(reg);
      }
    } catch {
      alert('Erro ao confirmar inscrição. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyPix = async () => {
    const textToCopy = event?.pixCode || event?.pixKey || '';
    if (!textToCopy) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setPixCopied(true);
      setHasInteractedWithPayment(true);
      setTimeout(() => setPixCopied(false), 4000);
    } catch {
      setPixCopied(true);
      setHasInteractedWithPayment(true);
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

  // Format seconds to MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Clean phone number for WhatsApp link
  const cleanPhoneForWa = (rawPhone?: string) => {
    if (!rawPhone) return '';
    let cleaned = rawPhone.replace(/\D/g, '');
    if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = `55${cleaned}`;
    }
    return cleaned;
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

  // ==========================================
  // 1. CONFIRMATION SCREEN (POST-SUBMIT SUCCESS)
  // ==========================================
  if (confirmedRegistration) {
    const isPaid = !!(confirmedRegistration.isPaidEvent || event.isPaid);
    const priceVal = confirmedRegistration.ticketPrice ?? event.price ?? 0;

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
                {isPaid ? 'Pagamento Confirmado & Inscrição Garantida!' : 'Inscrição Confirmada com Sucesso!'}
              </span>
              <h1 className="text-2xl font-bold text-neutral-100 mt-1">
                {confirmedRegistration.fullName}
              </h1>
              <p className="text-xs text-neutral-400 mt-1">
                Sua credencial para o evento <strong>{confirmedRegistration.eventName}</strong> está garantida.
              </p>
            </div>

            {/* Paid Badge / Ticket Price */}
            {isPaid && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Ingresso Pago: R$ {priceVal.toFixed(2)}
                </span>
              </div>
            )}

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
                <span>Baixar Comprovante & Ingresso (PDF)</span>
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
                  setPendingRegistration(null);
                  sessionStorage.removeItem(`pending_reg_${eventId}`);
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

  // ===============================================================
  // 2. PAID EVENT: PAYMENT & WAITING FOR CONFIRMATION SCREEN
  // ===============================================================
  if (pendingRegistration && event.isPaid) {
    const isExpired = remainingSeconds !== null && remainingSeconds <= 0;
    const ticketPrice = pendingRegistration.ticketPrice ?? event.price ?? 0;
    const supportPhoneClean = cleanPhoneForWa(event.supportWhatsappNumber || event.whatsappPaymentNumber);
    const sellerPhoneClean = cleanPhoneForWa(event.whatsappPaymentNumber);

    const supportMsg = encodeURIComponent(
      `Olá! Fiz a inscrição no evento "${event.name}" (Inscrição: #${pendingRegistration.id.slice(-6)}, Nome: ${pendingRegistration.fullName}), mas ainda não tive o pagamento confirmado. Poderiam me ajudar?`
    );

    const sellerMsg = encodeURIComponent(
      `Olá! Estou realizando a inscrição no evento "${event.name}". Meu código é #${pendingRegistration.id.slice(-6)} (Nome: ${pendingRegistration.fullName}, Valor: R$ ${ticketPrice.toFixed(2)}). Segue meu comprovante de pagamento!`
    );

    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 py-6 sm:py-10 px-4 sm:px-6 flex items-center justify-center">
        <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
          {/* Header Accent Bar */}
          <div className="h-3 w-full bg-amber-500" />

          <div className="p-6 sm:p-8 space-y-6">
            {/* Top Badge */}
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                Aguardando Confirmação do Pagamento
              </span>
              <h1 className="text-2xl font-bold text-neutral-100 mt-2">
                {event.name}
              </h1>
              <p className="text-xs text-neutral-400 mt-1">
                Inscrição de <strong>{pendingRegistration.fullName}</strong> · Código: <span className="font-mono text-amber-400 font-bold">#{pendingRegistration.id.slice(-6)}</span>
              </p>
            </div>

            {/* Ticket Price Box */}
            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Valor da Inscrição
                </div>
                <div className="text-xs text-neutral-400">
                  Ingresso individual oficial
                </div>
              </div>
              <div className="text-2xl font-bold font-mono-numbers text-emerald-400">
                R$ {ticketPrice.toFixed(2)}
              </div>
            </div>

            {/* Payment Method 1: Pix Copie e Cole */}
            {event.paymentType === 'pix' && (
              <div className="space-y-4 p-5 bg-neutral-950/70 border border-neutral-800 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Pagamento via Pix (Copie e Cole)
                  </div>
                  {event.pixBeneficiary && (
                    <span className="text-[11px] text-neutral-400">
                      Favorecido: <strong className="text-neutral-200">{event.pixBeneficiary}</strong>
                    </span>
                  )}
                </div>

                {event.pixKey && (
                  <div className="text-xs text-neutral-300">
                    <span className="text-neutral-500">Chave Pix:</span>{' '}
                    <span className="font-mono text-amber-400 font-semibold">{event.pixKey}</span>
                  </div>
                )}

                {/* Copia e Cola box */}
                <div>
                  <div className="text-[10px] uppercase font-semibold text-neutral-400 mb-1">
                    Código Pix Copia e Cola
                  </div>
                  <div className="relative">
                    <textarea
                      readOnly
                      rows={2}
                      value={event.pixCode || event.pixKey || ''}
                      className="w-full p-2.5 bg-neutral-900 border border-neutral-700 rounded-xl text-neutral-200 text-xs font-mono resize-none focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleCopyPix}
                    className="w-full mt-2 py-3 px-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer shadow-md"
                  >
                    {pixCopied ? (
                      <>
                        <Check className="w-4 h-4 stroke-[3] text-neutral-950" />
                        <span>Código Pix Copiado com Sucesso!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copiar Código Pix Copia e Cola</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-[11px] text-neutral-400 space-y-1 pt-1 leading-relaxed">
                  <p>1. Abra o aplicativo do seu banco e selecione <strong>Pix &gt; Copia e Cola</strong>.</p>
                  <p>2. Cole o código acima, confira o valor de <strong>R$ {ticketPrice.toFixed(2)}</strong> e confirme.</p>
                  <p>3. Após o pagamento, nosso administrador confirmará na fila do sistema e sua credencial será liberada automaticamente nesta tela!</p>
                </div>
              </div>
            )}

            {/* Payment Method 2: WhatsApp Link (wa.me) */}
            {event.paymentType === 'whatsapp' && (
              <div className="space-y-4 p-5 bg-neutral-950/70 border border-neutral-800 rounded-2xl">
                <div className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  Pagamento com Vendedor no WhatsApp
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed">
                  Clique no botão abaixo para conversar diretamente com o responsável/vendedor pelo evento. Envie seu comprovante de pagamento para liberação da sua credencial.
                </p>

                <a
                  href={`https://wa.me/${sellerPhoneClean}?text=${sellerMsg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setHasInteractedWithPayment(true)}
                  className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer shadow-lg"
                >
                  <MessageCircle className="w-4 h-4 stroke-[2.5]" />
                  <span>Conversar com o Vendedor no WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>

                <div className="text-[11px] text-neutral-400 space-y-1 pt-1 leading-relaxed">
                  <p>• O vendedor confirmará seu pagamento no painel administrativo.</p>
                  <p>• Mantenha esta página aberta: ela atualizará sozinha assim que confirmarem seu ingresso!</p>
                </div>
              </div>
            )}

            {/* Real-time Status Card & Countdown */}
            <div className={`p-5 rounded-2xl border ${isExpired ? 'bg-red-500/10 border-red-500/30' : 'bg-neutral-950 border-neutral-800'} space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isExpired ? 'bg-red-400' : 'bg-amber-400'} opacity-75`} />
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isExpired ? 'bg-red-500' : 'bg-amber-500'}`} />
                  </span>
                  <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                    {isExpired ? 'Tempo de Espera Excedido' : 'Fila de Verificação em Tempo Real'}
                  </span>
                </div>

                {remainingSeconds !== null && (
                  <div className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg ${isExpired ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {isExpired ? '00:00' : formatTimer(remainingSeconds)}
                  </div>
                )}
              </div>

              {/* Expired vs Waiting messages */}
              {isExpired ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-start gap-2.5 text-xs text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      Parece que seu pagamento ainda não foi confirmado, fique à vontade para entrar em contato conosco.
                    </p>
                  </div>

                  {supportPhoneClean && (
                    <a
                      href={`https://wa.me/${supportPhoneClean}?text=${supportMsg}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-neutral-700 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <span>Falar com o Suporte no WhatsApp</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="space-y-2 text-xs text-neutral-400 leading-relaxed">
                  <p>
                    Assim que nossa equipe confirmar seu comprovante, esta tela irá <strong>recarregar automaticamente</strong> e liberar seu ingresso com QR Code e PDF.
                  </p>
                  <p className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    Sincronização ativa com o servidor em tempo real.
                  </p>
                </div>
              )}
            </div>

            {/* Cancel / Back button */}
            <div className="text-center pt-2">
              <button
                onClick={() => {
                  if (confirm('Deseja cancelar o processo e voltar ao formulário?')) {
                    setPendingRegistration(null);
                    sessionStorage.removeItem(`pending_reg_${eventId}`);
                  }
                }}
                className="text-xs text-neutral-500 hover:text-neutral-300 underline"
              >
                Voltar e preencher novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 3. PUBLIC REGISTRATION FORM (DEFAULT VIEW)
  // ==========================================
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

          {/* Paid Event Price Banner (if applicable) */}
          {event.isPaid && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  R$
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Evento com Inscrição Paga
                  </div>
                  <div className="text-xs text-neutral-300">
                    {event.paymentType === 'pix' ? 'Pagamento via Pix Copie e Cole' : 'Pagamento via WhatsApp'}
                  </div>
                </div>
              </div>
              <div className="text-xl font-bold font-mono-numbers text-emerald-400">
                R$ {(event.price || 0).toFixed(2)}
              </div>
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
                {event.isPaid
                  ? 'Preencha os dados abaixo. Na etapa seguinte você receberá as instruções de pagamento.'
                  : 'Preencha os dados abaixo para emitir sua credencial com QR Code.'}
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
                ) : event.isPaid ? (
                  <>
                    <span>Continuar para Pagamento (R$ {(event.price || 0).toFixed(2)})</span>
                    <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                  </>
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
