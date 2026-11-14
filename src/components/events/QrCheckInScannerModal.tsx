import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  X,
  QrCode,
  Camera,
  CameraOff,
  RefreshCw,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  UserCheck,
  Users,
  Phone,
  Mail,
  Building,
  MapPin,
  Calendar,
  Clock,
  Shield,
  Volume2,
  VolumeX,
  Search,
  Download,
  RotateCcw,
  ScanLine,
  ArrowRight,
  Check,
  ExternalLink,
} from 'lucide-react';
import { PublicRegistrationEvent, EventRegistration } from '../../types.js';
import { api } from '../../services/api.js';
import { useApp } from '../../context/AppContext.js';
import { exportRegistrationTicketPDF, formatDateBR } from '../../utils/registrationTicketPdf.js';

interface QrCheckInScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: PublicRegistrationEvent[];
  selectedEvent: PublicRegistrationEvent | null;
  onSelectEvent: (event: PublicRegistrationEvent) => void;
}

interface DecodedQrSnapshot {
  code: string;
  fullName?: string;
  eventName?: string;
  phone?: string;
  email?: string;
  church?: string;
  area?: string;
  responsibleLeader?: string;
  responsiblePastor?: string;
  rules?: string;
  paymentLabel?: string;
  rawText: string;
}

type ScanOutcome =
  | 'checked_in_now'
  | 'already_checked_in'
  | 'payment_pending'
  | 'wrong_event'
  | 'not_found'
  | 'inspected';

interface ScanResultState {
  outcome: ScanOutcome;
  registration: EventRegistration | null;
  decoded: DecodedQrSnapshot;
  scannedAt: string;
  targetEventIfWrong?: PublicRegistrationEvent | null;
}

function parseCredentialQR(rawText: string): DecodedQrSnapshot {
  const trimmed = rawText.trim();
  const base: DecodedQrSnapshot = {
    code: trimmed,
    rawText: trimmed,
  };

  if (!trimmed) return base;

  // 1. Try JSON payload (used by both PublicEventRegistrationPage and PDF ticket QR)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const code = String(obj.id || obj.codigo || '').trim();
      return {
        code: code || trimmed,
        fullName: obj.nome ? String(obj.nome) : obj.participante ? String(obj.participante) : undefined,
        eventName: obj.evento ? String(obj.evento) : undefined,
        phone: obj.telefone ? String(obj.telefone) : undefined,
        email: obj.email ? String(obj.email) : undefined,
        church: obj.igreja ? String(obj.igreja) : undefined,
        area: obj.area ? String(obj.area) : undefined,
        responsibleLeader: obj.lider ? String(obj.lider) : undefined,
        responsiblePastor: obj.pastor ? String(obj.pastor) : undefined,
        rules: obj.regras ? String(obj.regras) : undefined,
        paymentLabel: obj.valor ? String(obj.valor) : undefined,
        rawText: trimmed,
      };
    } catch {
      // fall through to regex/string parsing
    }
  }

  // 2. Fallback format: PTB-EVENTO:PTB-123456-ABCD:Full Name
  if (trimmed.startsWith('PTB-EVENTO:')) {
    const parts = trimmed.split(':');
    return {
      code: (parts[1] || '').trim(),
      fullName: parts.slice(2).join(':').trim() || undefined,
      rawText: trimmed,
    };
  }

  // 3. Extract PTB registration code pattern if embedded in arbitrary text
  const ptbMatch = trimmed.match(/PTB-\d{4,}-[A-Z0-9]+/i);
  if (ptbMatch) {
    return {
      code: ptbMatch[0].toUpperCase(),
      rawText: trimmed,
    };
  }

  return base;
}

function playFeedbackTone(kind: 'success' | 'warning' | 'error') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playNote = (freq: number, startOffset: number, duration: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.14, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    if (kind === 'success') {
      playNote(587.33, 0, 0.12); // D5
      playNote(880, 0.11, 0.22); // A5
    } else if (kind === 'warning') {
      playNote(440, 0, 0.12, 'triangle');
      playNote(440, 0.16, 0.15, 'triangle');
    } else {
      playNote(240, 0, 0.22, 'sawtooth');
    }
  } catch {
    // Ignore audio context restrictions
  }
}

export const QrCheckInScannerModal: React.FC<QrCheckInScannerModalProps> = ({
  isOpen,
  onClose,
  events,
  selectedEvent,
  onSelectEvent,
}) => {
  const { user, notify } = useApp();

  const [eventAttendees, setEventAttendees] = useState<EventRegistration[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  // Camera state
  const [cameraActive, setCameraActive] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Sound, mobile tab & manual input
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mobileTab, setMobileTab] = useState<'scanner' | 'presentes'>('scanner');
  const [manualInput, setManualInput] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [presentSearch, setPresentSearch] = useState('');

  // Active Credential Screen State
  const [scanResult, setScanResult] = useState<ScanResultState | null>(null);

  // Refs for camera stream & decoding loop
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  // Active event reference (fallback to first event if none provided)
  const activeEvent = useMemo(() => {
    if (selectedEvent) {
      return events.find((e) => e.id === selectedEvent.id) || selectedEvent;
    }
    return events.find((e) => e.status === 'aberto') || events[0] || null;
  }, [selectedEvent, events]);

  // Subscribe to real-time registrations strictly for activeEvent
  useEffect(() => {
    if (!isOpen || !activeEvent) {
      setEventAttendees([]);
      return;
    }

    setLoadingAttendees(true);
    const unsub = api.subscribeEventRegistrations(activeEvent.id, (list) => {
      setEventAttendees(list.filter((r) => r.eventId === activeEvent.id));
      setLoadingAttendees(false);
    });
    return () => unsub();
  }, [isOpen, activeEvent?.id]);

  // Keep open credential screen synced with live attendee updates
  useEffect(() => {
    if (!scanResult?.registration) return;
    const liveMatch = eventAttendees.find((a) => a.id === scanResult.registration?.id);
    if (liveMatch) {
      setScanResult((prev) => (prev ? { ...prev, registration: liveMatch } : null));
    }
  }, [eventAttendees]);

  // Derived counters & present list
  const checkedInAttendees = useMemo(() => {
    return eventAttendees
      .filter((a) => a.status === 'presente')
      .sort((a, b) => {
        const ta = a.checkInAt ? new Date(a.checkInAt).getTime() : 0;
        const tb = b.checkInAt ? new Date(b.checkInAt).getTime() : 0;
        return tb - ta;
      });
  }, [eventAttendees]);

  const filteredPresentAttendees = useMemo(() => {
    if (!presentSearch.trim()) return checkedInAttendees;
    const q = presentSearch.toLowerCase();
    return checkedInAttendees.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        (a.church || '').toLowerCase().includes(q) ||
        (a.area || '').toLowerCase().includes(q)
    );
  }, [checkedInAttendees, presentSearch]);

  const totalRegistered = eventAttendees.length;
  const totalPresent = checkedInAttendees.length;
  const pendingArrival = Math.max(0, totalRegistered - totalPresent);
  const attendancePercent = totalRegistered > 0 ? Math.round((totalPresent / totalRegistered) * 100) : 0;

  // Core QR Verification & Auto Check-In Handler
  const handleDecodedPayload = useCallback(
    async (rawText: string) => {
      if (!activeEvent || isProcessingScan) return;
      const decoded = parseCredentialQR(rawText);
      if (!decoded.code) return;

      setIsProcessingScan(true);
      try {
        // 1. Try local attendees of current event first (fastest)
        const normalizedCode = decoded.code.toUpperCase();
        let found =
          eventAttendees.find((a) => a.id.toUpperCase() === normalizedCode) || null;

        // 2. If not in current event's attendees, query Firestore globally by code
        if (!found) {
          found = await api.getEventRegistrationByCode(decoded.code);
          if (!found && decoded.code !== normalizedCode) {
            found = await api.getEventRegistrationByCode(normalizedCode);
          }
        }

        const nowIso = new Date().toISOString();

        // Case A: Not found anywhere
        if (!found) {
          if (soundEnabled) playFeedbackTone('error');
          setScanResult({
            outcome: 'not_found',
            registration: null,
            decoded,
            scannedAt: nowIso,
          });
          notify(`Credencial "${decoded.code}" não encontrada no sistema.`, 'error');
          return;
        }

        // Case B: Belongs to a different event (strict isolation)
        if (found.eventId !== activeEvent.id) {
          if (soundEnabled) playFeedbackTone('warning');
          const targetEv = events.find((e) => e.id === found?.eventId) || null;
          setScanResult({
            outcome: 'wrong_event',
            registration: found,
            decoded,
            scannedAt: nowIso,
            targetEventIfWrong: targetEv,
          });
          notify(`Esta credencial pertence ao evento "${found.eventName}".`, 'info');
          return;
        }

        // Case C: Paid event and payment is NOT confirmed yet
        if (activeEvent.isPaid && found.paymentStatus !== 'paid') {
          if (soundEnabled) playFeedbackTone('warning');
          setScanResult({
            outcome: 'payment_pending',
            registration: found,
            decoded,
            scannedAt: nowIso,
          });
          notify(`Pagamento de ${found.fullName} ainda não confirmado!`, 'info');
          return;
        }

        // Case D: Already checked in previously
        if (found.status === 'presente') {
          if (soundEnabled) playFeedbackTone('warning');
          setScanResult({
            outcome: 'already_checked_in',
            registration: found,
            decoded,
            scannedAt: nowIso,
          });
          notify(`${found.fullName} já teve presença registrada anteriormente.`, 'info');
          return;
        }

        // Case E: Valid ticket -> AUTOMATICALLY mark as 'presente' & open credential screen!
        const updated = await api.markRegistrationCheckIn(
          found.id,
          true,
          user ? { uid: user.uid, name: user.name } : undefined
        );
        const finalReg: EventRegistration = updated || {
          ...found,
          status: 'presente',
          checkInAt: nowIso,
          checkedInByUid: user?.uid || null,
          checkedInByName: user?.name || 'Credenciamento',
        };

        if (soundEnabled) playFeedbackTone('success');
        setScanResult({
          outcome: 'checked_in_now',
          registration: finalReg,
          decoded,
          scannedAt: nowIso,
        });
        notify(`Presença confirmada: ${finalReg.fullName}!`, 'success');
      } catch {
        if (soundEnabled) playFeedbackTone('error');
        notify('Erro ao verificar credencial QR.', 'error');
      } finally {
        setIsProcessingScan(false);
      }
    },
    [activeEvent, eventAttendees, events, isProcessingScan, notify, soundEnabled, user]
  );

  // Keep latest callback ref for animation loop
  const handleDecodedRef = useRef(handleDecodedPayload);
  useEffect(() => {
    handleDecodedRef.current = handleDecodedPayload;
  }, [handleDecodedPayload]);

  // Stop camera cleanly
  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  // Attach acquired stream to video element and start playback
  const attachStreamToVideo = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      setCameraReady(true);
      setCameraError(null);
    }
  }, []);

  // Acquire camera with graceful fallback from rear-camera constraints to generic video: true
  const acquireCameraStream = useCallback(
    async (mode: 'environment' | 'user'): Promise<MediaStream> => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (firstErr) {
        const name = firstErr instanceof Error ? firstErr.name : '';
        // If user denied permission, don't prompt twice with fallback
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
          throw firstErr;
        }
        // Fallback for devices/webcams that reject facingMode/resolution constraints
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
    },
    []
  );

  // Direct user-gesture camera permission request (fixes Safari/iOS & iframe gesture blocks)
  const handleRequestCameraPermission = async () => {
    stopCamera();
    setCameraError(null);
    setCameraActive(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'A câmera ao vivo não está disponível neste navegador/contexto. Use "Fotografar QR", "Ler Foto / Print" ou abra em uma nova aba.'
      );
      return;
    }

    try {
      const stream = await acquireCameraStream(facingMode);
      await attachStreamToVideo(stream);
    } catch (err) {
      const errName = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : '';
      if (
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errName === 'SecurityError' ||
        msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('denied')
      ) {
        setCameraError(
          'O navegador bloqueou ou recusou o acesso à câmera neste quadro. Clique no ícone de cadeado/câmera na barra de endereço para permitir, ou clique em "Abrir em Nova Aba" abaixo.'
        );
      } else {
        setCameraError(
          'Nenhuma câmera detectada ou câmera em uso por outro aplicativo. Use "Fotografar QR", "Ler Foto / Print" ou o código manual.'
        );
      }
    }
  };

  // Start camera & continuous jsQR scanning loop
  useEffect(() => {
    if (!isOpen || !cameraActive) {
      stopCamera();
      return;
    }

    let cancelled = false;
    setCameraError(null);

    async function startCamera() {
      // Reuse stream if already acquired via direct click handler
      if (streamRef.current && streamRef.current.active) {
        setCameraReady(true);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'A câmera ao vivo não está disponível neste navegador/contexto. Use "Fotografar QR", "Ler Foto / Print" ou abra em uma nova aba.'
        );
        return;
      }

      try {
        const stream = await acquireCameraStream(facingMode);

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        await attachStreamToVideo(stream);
      } catch (err) {
        if (cancelled) return;
        const errName = err instanceof Error ? err.name : '';
        const msg = err instanceof Error ? err.message : '';
        if (
          errName === 'NotAllowedError' ||
          errName === 'PermissionDeniedError' ||
          errName === 'SecurityError' ||
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('denied')
        ) {
          setCameraError(
            'A permissão da câmera não foi concedida ou foi bloqueada pelo navegador. Clique em "Solicitar Permissão da Câmera", abra em nova aba ou use "Fotografar QR".'
          );
        } else {
          setCameraError(
            'Nenhuma câmera detectada ou câmera ocupada por outro aplicativo. Use "Fotografar QR", "Ler Foto / Print" ou o código manual.'
          );
        }
      }
    }

    startCamera();

    let lastFrameScan = 0;
    const scanTick = (time: number) => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(scanTick);

      if (time - lastFrameScan < 140) return;
      lastFrameScan = time;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        const now = Date.now();
        if (
          code.data === lastScanRef.current.text &&
          now - lastScanRef.current.timestamp < 2400
        ) {
          return;
        }
        lastScanRef.current = { text: code.data, timestamp: now };
        handleDecodedRef.current(code.data);
      }
    };

    rafRef.current = requestAnimationFrame(scanTick);

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, cameraActive, facingMode, stopCamera, acquireCameraStream, attachStreamToVideo]);

  // Decode QR code from an uploaded image file (screenshot / photo)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (decoded && decoded.data) {
          handleDecodedPayload(decoded.data);
        } else {
          if (soundEnabled) playFeedbackTone('error');
          notify('Nenhum QR Code válido identificado nesta imagem. Tente uma imagem mais nítida.', 'error');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (captureInputRef.current) captureInputRef.current.value = '';
  };

  // Manual code / USB 2D scanner submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDecodedPayload(manualInput.trim());
    setManualInput('');
  };

  // Manual action: Confirm payment + mark present in one click
  const handleConfirmPaymentAndCheckIn = async (reg: EventRegistration) => {
    if (!activeEvent) return;
    try {
      setIsProcessingScan(true);
      await api.confirmRegistrationPayment(
        reg.id,
        user ? { uid: user.uid, name: user.name } : undefined,
        activeEvent.price || 0
      );
      const updated = await api.markRegistrationCheckIn(
        reg.id,
        true,
        user ? { uid: user.uid, name: user.name } : undefined
      );
      const nowIso = new Date().toISOString();
      const finalReg: EventRegistration = updated || {
        ...reg,
        paymentStatus: 'paid',
        status: 'presente',
        checkInAt: nowIso,
        checkedInByName: user?.name || 'Credenciamento',
      };
      if (soundEnabled) playFeedbackTone('success');
      setScanResult((prev) =>
        prev
          ? {
              ...prev,
              outcome: 'checked_in_now',
              registration: finalReg,
              scannedAt: nowIso,
            }
          : null
      );
      notify(`Pagamento confirmado e presença registrada para ${reg.fullName}!`, 'success');
    } catch {
      notify('Erro ao confirmar pagamento e presença.', 'error');
    } finally {
      setIsProcessingScan(false);
    }
  };

  // Force check-in even if payment pending
  const handleForceCheckIn = async (reg: EventRegistration) => {
    try {
      setIsProcessingScan(true);
      const nowIso = new Date().toISOString();
      const updated = await api.markRegistrationCheckIn(
        reg.id,
        true,
        user ? { uid: user.uid, name: user.name } : undefined
      );
      const finalReg: EventRegistration = updated || {
        ...reg,
        status: 'presente',
        checkInAt: nowIso,
        checkedInByName: user?.name || 'Credenciamento',
      };
      if (soundEnabled) playFeedbackTone('success');
      setScanResult((prev) =>
        prev
          ? {
              ...prev,
              outcome: 'checked_in_now',
              registration: finalReg,
              scannedAt: nowIso,
            }
          : null
      );
      notify(`Presença registrada para ${reg.fullName}.`, 'success');
    } catch {
      notify('Erro ao registrar presença.', 'error');
    } finally {
      setIsProcessingScan(false);
    }
  };

  // Undo check-in
  const handleUndoCheckIn = async (reg: EventRegistration) => {
    try {
      setIsProcessingScan(true);
      await api.markRegistrationCheckIn(
        reg.id,
        false,
        user ? { uid: user.uid, name: user.name } : undefined
      );
      if (scanResult?.registration?.id === reg.id) {
        setScanResult(null);
      }
      notify(`Presença de ${reg.fullName} desmarcada.`, 'info');
    } catch {
      notify('Erro ao desfazer presença.', 'error');
    } finally {
      setIsProcessingScan(false);
    }
  };

  // Inspect an already checked-in attendee from the live present list
  const handleInspectPresentAttendee = (reg: EventRegistration) => {
    setScanResult({
      outcome: 'inspected',
      registration: reg,
      decoded: {
        code: reg.id,
        fullName: reg.fullName,
        eventName: reg.eventName,
        rawText: reg.qrCodeData || reg.id,
      },
      scannedAt: reg.checkInAt || reg.registeredAt,
    });
  };

  if (!isOpen) return null;

  const currentReg = scanResult?.registration;
  const displayName = currentReg?.fullName || scanResult?.decoded.fullName || 'Participante';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex items-stretch sm:items-center justify-center sm:p-4 lg:p-6">
      <div className="w-full h-full sm:h-auto sm:max-h-[92vh] max-w-6xl bg-neutral-900 sm:border sm:border-neutral-800 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 1. Compact Header Bar */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-neutral-100 whitespace-nowrap">
                  Leitor QR
                </h2>
                {activeEvent && (
                  <span className="hidden md:inline text-xs text-neutral-500 truncate">
                    · {formatDateBR(activeEvent.date)} às {activeEvent.time} · {activeEvent.location}
                  </span>
                )}
              </div>
              {events.length > 0 && activeEvent && (
                <select
                  value={activeEvent.id}
                  onChange={(e) => {
                    const nextEv = events.find((ev) => ev.id === e.target.value);
                    if (nextEv) {
                      setScanResult(null);
                      onSelectEvent(nextEv);
                    }
                  }}
                  aria-label="Selecionar evento"
                  className="mt-0.5 w-full sm:w-auto max-w-full sm:max-w-xs bg-transparent text-xs font-medium text-amber-400 focus:outline-none truncate cursor-pointer"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id} className="bg-neutral-900 text-neutral-100">
                      {ev.name} ({formatDateBR(ev.date)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className="min-h-[40px] min-w-[40px] px-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={soundEnabled ? 'Desativar som de confirmação' : 'Ativar som de confirmação'}
              aria-label={soundEnabled ? 'Desativar som' : 'Ativar som'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-neutral-500" />
              )}
              <span className="hidden sm:inline">{soundEnabled ? 'Som' : 'Mudo'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="min-h-[40px] px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <X className="w-4 h-4" />
              <span>Fechar</span>
            </button>
          </div>
        </div>

        {/* 2. Clean Hairline Attendance Telemetry Strip */}
        {activeEvent && (
          <div className="relative bg-neutral-950/70 border-b border-neutral-800 shrink-0">
            <div className="grid grid-cols-4 divide-x divide-neutral-800/80">
              <div className="px-2 sm:px-4 py-2.5 text-center sm:text-left sm:flex sm:items-baseline sm:justify-between">
                <span className="block text-[10px] sm:text-xs font-medium text-emerald-400 truncate">
                  Presentes
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-400">
                  {totalPresent}
                </span>
              </div>

              <div className="px-2 sm:px-4 py-2.5 text-center sm:text-left sm:flex sm:items-baseline sm:justify-between">
                <span className="block text-[10px] sm:text-xs font-medium text-neutral-400 truncate">
                  Inscritos
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-neutral-100">
                  {totalRegistered}
                </span>
              </div>

              <div className="px-2 sm:px-4 py-2.5 text-center sm:text-left sm:flex sm:items-baseline sm:justify-between">
                <span className="block text-[10px] sm:text-xs font-medium text-neutral-400 truncate">
                  Faltam
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-amber-400">
                  {pendingArrival}
                </span>
              </div>

              <div className="px-2 sm:px-4 py-2.5 text-center sm:text-left sm:flex sm:items-baseline sm:justify-between">
                <span className="block text-[10px] sm:text-xs font-medium text-neutral-400 truncate">
                  Taxa
                </span>
                <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-sky-400">
                  {attendancePercent}%
                </span>
              </div>
            </div>

            {/* Subtle 2px Progress Bar */}
            <div className="h-0.5 w-full bg-neutral-800/80">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${attendancePercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Mobile Segmented Switcher (Scanner vs Presentes) */}
        {activeEvent && !scanResult && (
          <div className="lg:hidden px-4 py-2 bg-neutral-900 border-b border-neutral-800 shrink-0">
            <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
              <button
                type="button"
                onClick={() => setMobileTab('scanner')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  mobileTab === 'scanner'
                    ? 'bg-neutral-800 text-amber-400'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>Leitor QR</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('presentes')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  mobileTab === 'presentes'
                    ? 'bg-neutral-800 text-emerald-400'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Presentes ({totalPresent})</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Main Content Area */}
        {!activeEvent ? (
          <div className="p-12 text-center text-neutral-400 text-sm">
            Crie pelo menos um evento antes de utilizar o leitor QR de credenciais.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:grid lg:grid-cols-12 lg:gap-6 items-start space-y-4 lg:space-y-0">
            {/* LEFT COLUMN: Camera & Quick Input (hidden on mobile when inspecting a credential or viewing Presentes tab) */}
            <div
              className={`lg:col-span-5 space-y-3 ${
                scanResult || mobileTab === 'presentes' ? 'hidden lg:block' : 'block'
              }`}
            >
              {/* Camera Viewport Container */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="relative h-64 sm:h-72 lg:h-auto lg:aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${cameraActive && !cameraError ? 'block' : 'hidden'}`}
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Floating Camera Action Controls */}
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
                      className="min-h-[36px] px-2.5 py-1.5 bg-neutral-950/75 hover:bg-neutral-900 backdrop-blur-sm text-neutral-100 text-[11px] font-semibold rounded-xl border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      title="Trocar câmera frontal / traseira"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Trocar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCameraActive((v) => !v)}
                      className={`min-h-[36px] px-2.5 py-1.5 backdrop-blur-sm text-[11px] font-semibold rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        cameraActive
                          ? 'bg-neutral-950/75 hover:bg-neutral-900 text-neutral-100 border-white/10'
                          : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 border-amber-300'
                      }`}
                    >
                      {cameraActive ? (
                        <>
                          <CameraOff className="w-3.5 h-3.5" />
                          <span>Pausar</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5" />
                          <span>Ativar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Crisp Target Reticle */}
                  {cameraActive && !cameraError && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                      <div className="w-40 h-40 sm:w-48 sm:h-48 relative">
                        <span className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-amber-400 rounded-tl-xl" />
                        <span className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-amber-400 rounded-tr-xl" />
                        <span className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-amber-400 rounded-bl-xl" />
                        <span className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-amber-400 rounded-br-xl" />
                      </div>
                      <span className="mt-3 px-3 py-1 bg-black/70 backdrop-blur-xs text-[11px] font-medium text-neutral-200 rounded-lg">
                        {cameraReady ? 'Aponte para o QR Code da credencial' : 'Iniciando câmera...'}
                      </span>
                    </div>
                  )}

                  {!cameraActive && (
                    <div className="p-6 text-center space-y-3">
                      <CameraOff className="w-9 h-9 text-neutral-600 mx-auto" />
                      <p className="text-xs text-neutral-400">Câmera pausada</p>
                      <button
                        type="button"
                        onClick={() => setCameraActive(true)}
                        className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Reativar Câmera
                      </button>
                    </div>
                  )}

                  {cameraActive && cameraError && (
                    <div className="p-4 text-center space-y-2.5 max-w-xs">
                      <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                      <p className="text-xs text-neutral-300 leading-relaxed">{cameraError}</p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleRequestCameraPermission}
                          className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Permitir Câmera</span>
                        </button>
                        <a
                          href={typeof window !== 'undefined' ? window.location.href : '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                          <span>Nova Aba</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Clean Quick Action Controls Below Camera */}
                <div className="p-3 sm:p-3.5 space-y-2.5 border-t border-neutral-800 bg-neutral-950">
                  <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      placeholder="Digite código PTB-... ou bipe no leitor USB"
                      className="flex-1 min-w-0 px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 font-mono focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={!manualInput.trim() || isProcessingScan}
                      className="min-h-[38px] px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Verificar
                    </button>
                  </form>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      ref={captureInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => captureInputRef.current?.click()}
                      className="min-h-[40px] py-2 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Fotografar QR</span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[40px] py-2 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Ler Foto / Print</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Quiet Single-Line Logistics Footer */}
              <div className="px-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-400">
                <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{formatDateBR(activeEvent.date)}</span>
                <span aria-hidden="true">·</span>
                <span>{activeEvent.time}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{activeEvent.location}</span>
              </div>
            </div>

            {/* RIGHT COLUMN: Professional Credential Screen + Live Presentes List */}
            <div
              className={`lg:col-span-7 space-y-4 ${
                !scanResult && mobileTab === 'scanner' ? 'hidden lg:block' : 'block'
              }`}
            >
              {/* 1. PROFESSIONAL CANDIDATE CREDENTIAL SCREEN */}
              {scanResult ? (
                <div
                  className={`bg-neutral-950 border rounded-2xl overflow-hidden shadow-xl ${
                    scanResult.outcome === 'checked_in_now'
                      ? 'border-emerald-500/50'
                      : scanResult.outcome === 'already_checked_in' || scanResult.outcome === 'inspected'
                      ? 'border-sky-500/40'
                      : scanResult.outcome === 'payment_pending' || scanResult.outcome === 'wrong_event'
                      ? 'border-amber-500/50'
                      : 'border-red-500/50'
                  }`}
                >
                  {/* Status Banner Header */}
                  <div
                    className={`px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-2.5 ${
                      scanResult.outcome === 'checked_in_now'
                        ? 'bg-emerald-500/15 text-emerald-300 border-b border-emerald-500/30'
                        : scanResult.outcome === 'already_checked_in'
                        ? 'bg-sky-500/15 text-sky-300 border-b border-sky-500/30'
                        : scanResult.outcome === 'inspected'
                        ? 'bg-emerald-500/10 text-emerald-300 border-b border-neutral-800'
                        : scanResult.outcome === 'payment_pending' || scanResult.outcome === 'wrong_event'
                        ? 'bg-amber-500/15 text-amber-300 border-b border-amber-500/30'
                        : 'bg-red-500/15 text-red-300 border-b border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {scanResult.outcome === 'checked_in_now' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                      {(scanResult.outcome === 'already_checked_in' || scanResult.outcome === 'inspected') && (
                        <UserCheck className="w-5 h-5 text-sky-400 shrink-0" />
                      )}
                      {(scanResult.outcome === 'payment_pending' || scanResult.outcome === 'wrong_event') && (
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                      )}
                      {scanResult.outcome === 'not_found' && <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}

                      <div className="min-w-0">
                        <div className="text-xs font-bold tracking-wide">
                          {scanResult.outcome === 'checked_in_now' && 'Presença Confirmada no Evento'}
                          {scanResult.outcome === 'already_checked_in' && 'Check-in Já Registrado'}
                          {scanResult.outcome === 'inspected' && 'Credencial de Participante Presente'}
                          {scanResult.outcome === 'payment_pending' && 'Pagamento Pendente ou Não Confirmado'}
                          {scanResult.outcome === 'wrong_event' && 'Credencial de Outro Evento'}
                          {scanResult.outcome === 'not_found' && 'Credencial Não Encontrada'}
                        </div>
                        <div className="text-[11px] opacity-85 truncate">
                          {scanResult.outcome === 'checked_in_now' &&
                            `Registrado às ${new Date(scanResult.scannedAt).toLocaleTimeString('pt-BR')}`}
                          {scanResult.outcome === 'already_checked_in' &&
                            `Entrada anterior em ${
                              currentReg?.checkInAt
                                ? new Date(currentReg.checkInAt).toLocaleString('pt-BR')
                                : 'horário anterior'
                            }`}
                          {scanResult.outcome === 'inspected' &&
                            `Check-in em ${
                              currentReg?.checkInAt ? new Date(currentReg.checkInAt).toLocaleString('pt-BR') : '-'
                            }`}
                          {scanResult.outcome === 'payment_pending' &&
                            'Evento pago com ingresso ainda não confirmado.'}
                          {scanResult.outcome === 'wrong_event' &&
                            `Vinculada ao evento: ${currentReg?.eventName || scanResult.decoded.eventName || 'Outro'}`}
                          {scanResult.outcome === 'not_found' &&
                            'Código não encontrado nas inscrições deste evento.'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setScanResult(null);
                        setMobileTab('scanner');
                      }}
                      className="min-h-[38px] px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Ler Próxima
                    </button>
                  </div>

                  {/* Credential Body: Candidate Profile & Structured Info */}
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Profile Hero */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold text-sm flex items-center justify-center shrink-0">
                          {initials || 'PT'}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-neutral-100 truncate">
                            {displayName}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5 flex-wrap">
                            <span className="font-mono tabular-nums text-amber-400 font-semibold">
                              {currentReg?.id || scanResult.decoded.code}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {currentReg?.isPaidEvent
                                ? `Ingresso R$ ${Number(currentReg.ticketPrice || activeEvent.price || 0).toFixed(2)}`
                                : scanResult.decoded.paymentLabel || 'Inscrição Gratuita'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {currentReg && (
                        <div className="text-left sm:text-right shrink-0">
                          <div className="text-[11px] text-neutral-400">Situação</div>
                          <div
                            className={`text-xs font-bold mt-0.5 ${
                              currentReg.status === 'presente'
                                ? 'text-emerald-400'
                                : currentReg.paymentStatus === 'rejected' || currentReg.status === 'cancelada'
                                ? 'text-red-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {currentReg.status === 'presente'
                              ? 'Presente no Evento'
                              : currentReg.paymentStatus === 'waiting_confirmation'
                              ? 'Aguardando Pagamento'
                              : currentReg.paymentStatus === 'rejected'
                              ? 'Não Pago / Cancelado'
                              : 'Confirmada'}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Structured Info Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                      <div className="flex items-start gap-2.5">
                        <Phone className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[11px] text-neutral-400">Telefone / WhatsApp</div>
                          <div className="font-semibold font-mono tabular-nums text-neutral-100 mt-0.5">
                            {currentReg?.phone || scanResult.decoded.phone || 'Não informado'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Mail className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[11px] text-neutral-400">E-mail</div>
                          <div className="font-semibold text-neutral-100 mt-0.5 truncate">
                            {currentReg?.email || scanResult.decoded.email || 'Não informado'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Building className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[11px] text-neutral-400">Igreja / Congregação</div>
                          <div className="font-semibold text-neutral-100 mt-0.5">
                            {currentReg?.church || scanResult.decoded.church || 'Não informada'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[11px] text-neutral-400">Área</div>
                          <div className="font-semibold text-neutral-100 mt-0.5">
                            {currentReg?.area || scanResult.decoded.area || 'Geral'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Shield className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[11px] text-neutral-400">Líder Responsável</div>
                          <div className="font-semibold text-neutral-100 mt-0.5">
                            {currentReg?.responsibleLeader || scanResult.decoded.responsibleLeader || 'Não informado'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Users className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[11px] text-neutral-400">Pastor Responsável</div>
                          <div className="font-semibold text-neutral-100 mt-0.5">
                            {currentReg?.responsiblePastor || scanResult.decoded.responsiblePastor || 'Não informado'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Custom Form Responses if any */}
                    {currentReg?.customResponses && Object.keys(currentReg.customResponses).length > 0 && (
                      <div className="pt-3 border-t border-neutral-800 space-y-2">
                        <div className="text-[11px] font-semibold text-neutral-400">
                          Respostas Adicionais
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {Object.entries(currentReg.customResponses).map(([key, val]) => {
                            const fieldMeta = activeEvent.customFields?.find((f) => f.id === key);
                            const label = fieldMeta?.label || key;
                            const formattedVal =
                              typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : String(val || '-');
                            return (
                              <div key={key} className="py-1 border-b border-neutral-800/70">
                                <span className="text-neutral-400">{label}: </span>
                                <span className="text-neutral-100 font-semibold">{formattedVal}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Audit Timestamps */}
                    {currentReg && (
                      <div className="pt-3 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
                        <div>
                          Inscrito:{' '}
                          <span className="text-neutral-300 font-mono tabular-nums">
                            {new Date(currentReg.registeredAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {currentReg.checkInAt && (
                          <div>
                            Check-in:{' '}
                            <span className="text-emerald-400 font-mono tabular-nums font-semibold">
                              {new Date(currentReg.checkInAt).toLocaleString('pt-BR')}
                            </span>
                            {currentReg.checkedInByName && (
                              <span> · {currentReg.checkedInByName}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Controls */}
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      {scanResult.outcome === 'wrong_event' && scanResult.targetEventIfWrong && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectEvent(scanResult.targetEventIfWrong!);
                            setScanResult(null);
                            setMobileTab('scanner');
                          }}
                          className="min-h-[40px] px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <span>Abrir "{scanResult.targetEventIfWrong.name}"</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {scanResult.outcome === 'payment_pending' && currentReg && (
                        <>
                          <button
                            type="button"
                            disabled={isProcessingScan}
                            onClick={() => handleConfirmPaymentAndCheckIn(currentReg)}
                            className="min-h-[40px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Check className="w-4 h-4" />
                            <span>Confirmar Pagamento e Dar Presença</span>
                          </button>

                          <button
                            type="button"
                            disabled={isProcessingScan}
                            onClick={() => handleForceCheckIn(currentReg)}
                            className="min-h-[40px] px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 cursor-pointer whitespace-nowrap"
                          >
                            Dar Presença Mesmo Assim
                          </button>
                        </>
                      )}

                      {currentReg && currentReg.status === 'presente' && (
                        <button
                          type="button"
                          disabled={isProcessingScan}
                          onClick={() => handleUndoCheckIn(currentReg)}
                          className="min-h-[40px] px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-red-300 text-xs font-semibold rounded-xl border border-red-500/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Desfazer Presença</span>
                        </button>
                      )}

                      {currentReg && (
                        <button
                          type="button"
                          onClick={() => exportRegistrationTicketPDF(currentReg, activeEvent)}
                          className="min-h-[40px] px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5 text-amber-400" />
                          <span>Credencial PDF</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hidden lg:flex p-5 bg-neutral-950 border border-neutral-800 rounded-2xl items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-100">
                      Aguardando Leitura de Credencial
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                      Aponte a câmera para o QR Code ou informe o código para exibir a ficha completa do participante e incluí-lo automaticamente nos presentes.
                    </p>
                  </div>
                </div>
              )}

              {/* 2. LIVE LIST OF PRESENT PARTICIPANTS IN THE EVENT */}
              <div
                className={`bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden ${
                  scanResult && mobileTab !== 'presentes' ? 'hidden lg:block' : 'block'
                }`}
              >
                <div className="px-4 py-3 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h3 className="text-xs font-bold text-neutral-100">
                      Lista de Presentes
                    </h3>
                    <span className="text-xs font-mono tabular-nums font-bold text-emerald-400">
                      {totalPresent} / {totalRegistered}
                    </span>
                  </div>

                  <div className="relative w-full sm:w-52">
                    <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={presentSearch}
                      onChange={(e) => setPresentSearch(e.target.value)}
                      placeholder="Buscar presente..."
                      className="w-full pl-8 pr-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {loadingAttendees ? (
                  <div className="p-6 text-center text-xs text-neutral-400">
                    Carregando lista de presentes...
                  </div>
                ) : filteredPresentAttendees.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-400">
                    {checkedInAttendees.length === 0
                      ? 'Nenhum participante presente ainda. Leia um QR Code para registrar a primeira entrada.'
                      : 'Nenhum participante presente encontrado com esta busca.'}
                  </div>
                ) : (
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-neutral-800/70">
                    {filteredPresentAttendees.map((person, index) => (
                      <div
                        key={person.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-neutral-900/70 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => handleInspectPresentAttendee(person)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <span className="text-[11px] font-mono tabular-nums text-emerald-400 font-bold w-7 shrink-0">
                            #{String(filteredPresentAttendees.length - index).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-neutral-100 truncate">
                              {person.fullName}
                            </div>
                            <div className="text-[11px] text-neutral-400 truncate">
                              <span className="font-mono text-amber-400/90">{person.id}</span>
                              {person.church ? ` · ${person.church}` : ''}
                              {person.area ? ` (${person.area})` : ''}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-mono tabular-nums text-emerald-400">
                            {person.checkInAt
                              ? new Date(person.checkInAt).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Presente'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUndoCheckIn(person)}
                            className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                            title="Desfazer presença"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
