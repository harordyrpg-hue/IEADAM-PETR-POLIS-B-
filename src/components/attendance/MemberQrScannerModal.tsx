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
  Phone,
  Mail,
  Building,
  MapPin,
  Shield,
  Volume2,
  VolumeX,
  Search,
  Download,
  RotateCcw,
  ScanLine,
  ExternalLink,
  Lock,
  Calendar,
} from 'lucide-react';
import {
  AttendanceCall,
  AttendanceDepartment,
  AttendanceDepartmentKind,
  AttendanceMember,
} from '../../types.js';
import { api } from '../../services/api.js';
import { useApp } from '../../context/AppContext.js';
import { formatAttendanceDateBR } from '../../utils/attendanceExport.js';
import {
  exportMemberCredentialPDF,
  getMemberCredentialCode,
} from '../../utils/memberCredentialPdf.js';

interface MemberQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  callTitle: string;
  activeCall: AttendanceCall | null;
  buildBaseCall: () => AttendanceCall;
  onCallUpdated: (callId: string) => void;
  members: AttendanceMember[];
  departments: AttendanceDepartment[];
}

interface DecodedMemberQr {
  id?: string;
  code: string;
  name?: string;
  departmentName?: string;
  roleTitle?: string;
  phone?: string;
  congregation?: string;
  area?: string;
  rawText: string;
}

type MemberScanOutcome =
  | 'checked_in_now'
  | 'already_present'
  | 'locked_by_other'
  | 'not_found'
  | 'inspected';

interface MemberScanResult {
  outcome: MemberScanOutcome;
  member: AttendanceMember | null;
  department?: AttendanceDepartment;
  decoded: DecodedMemberQr;
  scannedAt: string;
  lockedByName?: string;
  markedAt?: string;
  markedByName?: string;
}

const KIND_LABELS: Record<AttendanceDepartmentKind, string> = {
  departamento: 'Departamento',
  ministerio: 'Ministério',
  equipe: 'Equipe',
};

function parseMemberQR(rawText: string): DecodedMemberQr {
  const trimmed = rawText.trim();
  const base: DecodedMemberQr = { code: trimmed, rawText: trimmed };
  if (!trimmed) return base;

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const id = obj.id ? String(obj.id).trim() : undefined;
      const code = String(obj.codigo || obj.id || trimmed).trim();
      return {
        id,
        code,
        name: obj.nome ? String(obj.nome) : undefined,
        departmentName: obj.categoria ? String(obj.categoria) : undefined,
        roleTitle: obj.cargo ? String(obj.cargo) : undefined,
        phone: obj.telefone ? String(obj.telefone) : undefined,
        congregation: obj.congregacao ? String(obj.congregacao) : undefined,
        area: obj.area ? String(obj.area) : undefined,
        rawText: trimmed,
      };
    } catch {
      // fall through
    }
  }

  if (trimmed.startsWith('PTB-MEMBRO:')) {
    const parts = trimmed.split(':');
    return {
      id: (parts[1] || '').trim() || undefined,
      code: (parts[2] || parts[1] || '').trim(),
      name: parts.slice(3).join(':').trim() || undefined,
      rawText: trimmed,
    };
  }

  const memMatch = trimmed.match(/PTB-MEM-[A-Z0-9-]+/i);
  if (memMatch) {
    return {
      code: memMatch[0].toUpperCase(),
      rawText: trimmed,
    };
  }

  return base;
}

function playFeedbackTone(kind: 'success' | 'warning' | 'error') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playNote = (
      freq: number,
      startOffset: number,
      duration: number,
      type: OscillatorType = 'sine'
    ) => {
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
      playNote(587.33, 0, 0.12);
      playNote(880, 0.11, 0.22);
    } else if (kind === 'warning') {
      playNote(440, 0, 0.12, 'triangle');
      playNote(440, 0.16, 0.15, 'triangle');
    } else {
      playNote(240, 0, 0.22, 'sawtooth');
    }
  } catch {
    // Ignore audio restrictions
  }
}

export const MemberQrScannerModal: React.FC<MemberQrScannerModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  callTitle,
  activeCall,
  buildBaseCall,
  onCallUpdated,
  members,
  departments,
}) => {
  const { user, notify } = useApp();

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
  const [scanResult, setScanResult] = useState<MemberScanResult | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);

  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  // Lock check
  const isLockedByOther = !!(
    activeCall?.activeOperatorUid &&
    user?.uid &&
    activeCall.activeOperatorUid !== user.uid
  );

  // Present members from current activeCall
  const presentMembers = useMemo(() => {
    const records = activeCall?.records || {};
    const list: {
      member: AttendanceMember;
      department?: AttendanceDepartment;
      markedAt?: string;
      markedByName?: string;
    }[] = [];

    Object.values(records).forEach((entry) => {
      if (entry.status !== 'presente') return;
      const memberObj = memberMap.get(entry.memberId) || {
        id: entry.memberId,
        departmentId: entry.departmentId,
        name: entry.memberName,
        createdByUid: entry.markedByUid,
        createdByName: entry.markedByName,
        createdAt: entry.markedAt,
        updatedAt: entry.markedAt,
      };
      list.push({
        member: memberObj,
        department: deptMap.get(entry.departmentId),
        markedAt: entry.markedAt,
        markedByName: entry.markedByName,
      });
    });

    return list.sort((a, b) => {
      const ta = a.markedAt ? new Date(a.markedAt).getTime() : 0;
      const tb = b.markedAt ? new Date(b.markedAt).getTime() : 0;
      return tb - ta;
    });
  }, [activeCall, memberMap, deptMap]);

  const filteredPresent = useMemo(() => {
    const q = presentSearch.trim().toLowerCase();
    if (!q) return presentMembers;
    return presentMembers.filter(
      ({ member, department }) =>
        member.name.toLowerCase().includes(q) ||
        getMemberCredentialCode(member).toLowerCase().includes(q) ||
        (department?.name || '').toLowerCase().includes(q)
    );
  }, [presentMembers, presentSearch]);

  const includedCount = useMemo(() => {
    if (activeCall) {
      const validIds = new Set(members.map((m) => m.id));
      return activeCall.includedMemberIds.filter((id) => validIds.has(id)).length;
    }
    return members.length;
  }, [activeCall, members]);

  const absentCount = useMemo(() => {
    if (!activeCall) return 0;
    return Object.values(activeCall.records || {}).filter((r) => r.status === 'falta').length;
  }, [activeCall]);

  const totalPresent = presentMembers.length;
  const totalInCall = Math.max(includedCount, totalPresent);
  const attendancePercent = totalInCall > 0 ? Math.round((totalPresent / totalInCall) * 100) : 0;

  // Match decoded QR or manual code against members
  const findMatchingMember = useCallback(
    (decoded: DecodedMemberQr): AttendanceMember | null => {
      const needleCode = decoded.code.trim().toUpperCase();
      const needleId = decoded.id?.trim();

      if (needleId) {
        const byId = memberMap.get(needleId);
        if (byId) return byId;
      }

      const byExactCodeOrId = members.find(
        (m) =>
          m.id.toUpperCase() === needleCode ||
          getMemberCredentialCode(m).toUpperCase() === needleCode
      );
      if (byExactCodeOrId) return byExactCodeOrId;

      if (needleCode.length >= 3) {
        const byName = members.filter((m) => m.name.toLowerCase() === needleCode.toLowerCase());
        if (byName.length === 1) return byName[0];
      }

      return null;
    },
    [memberMap, members]
  );

  // Core QR processing + auto attendance check-in
  const handleDecodedPayload = useCallback(
    async (rawText: string) => {
      if (isProcessingScan) return;
      const decoded = parseMemberQR(rawText);
      if (!decoded.code && !decoded.id) return;

      setIsProcessingScan(true);
      const nowIso = new Date().toISOString();
      try {
        const found = findMatchingMember(decoded);

        if (!found) {
          if (soundEnabled) playFeedbackTone('error');
          setScanResult({
            outcome: 'not_found',
            member: null,
            decoded,
            scannedAt: nowIso,
          });
          notify(`Credencial "${decoded.code}" não encontrada no cadastro de membros.`, 'error');
          return;
        }

        const dept = deptMap.get(found.departmentId);

        if (isLockedByOther) {
          if (soundEnabled) playFeedbackTone('warning');
          setScanResult({
            outcome: 'locked_by_other',
            member: found,
            department: dept,
            decoded,
            scannedAt: nowIso,
            lockedByName: activeCall?.activeOperatorName || 'Outro membro',
          });
          notify(
            `Chamada bloqueada por ${activeCall?.activeOperatorName || 'outro membro'}.`,
            'info'
          );
          return;
        }

        const baseCall = buildBaseCall();
        const result = await api.markMemberPresentByQr(
          baseCall,
          found,
          dept,
          user ? { uid: user.uid, name: user.name, email: user.email } : undefined
        );
        onCallUpdated(result.call.id);

        if (result.outcome === 'already_present') {
          if (soundEnabled) playFeedbackTone('warning');
          setScanResult({
            outcome: 'already_present',
            member: found,
            department: dept,
            decoded,
            scannedAt: nowIso,
            markedAt: result.entry.markedAt,
            markedByName: result.entry.markedByName,
          });
          notify(`${found.name} já está marcado(a) como presente nesta chamada.`, 'info');
          return;
        }

        if (soundEnabled) playFeedbackTone('success');
        setScanResult({
          outcome: 'checked_in_now',
          member: found,
          department: dept,
          decoded,
          scannedAt: nowIso,
          markedAt: result.entry.markedAt,
          markedByName: result.entry.markedByName,
        });
        notify(`Presença confirmada via QR: ${found.name}!`, 'success');
      } catch (err) {
        if (soundEnabled) playFeedbackTone('error');
        if (err instanceof Error && err.message.startsWith('ATTENDANCE_LOCKED:')) {
          const ownerName = err.message.replace('ATTENDANCE_LOCKED:', '');
          const found = findMatchingMember(decoded);
          setScanResult({
            outcome: 'locked_by_other',
            member: found,
            department: found ? deptMap.get(found.departmentId) : undefined,
            decoded,
            scannedAt: nowIso,
            lockedByName: ownerName,
          });
          notify(`Chamada em andamento por ${ownerName}. Outro membro não pode assumir.`, 'error');
        } else {
          notify('Erro ao validar credencial QR do membro.', 'error');
        }
      } finally {
        setIsProcessingScan(false);
      }
    },
    [
      isProcessingScan,
      findMatchingMember,
      deptMap,
      isLockedByOther,
      activeCall,
      buildBaseCall,
      user,
      onCallUpdated,
      soundEnabled,
      notify,
    ]
  );

  const handleDecodedRef = useRef(handleDecodedPayload);
  useEffect(() => {
    handleDecodedRef.current = handleDecodedPayload;
  }, [handleDecodedPayload]);

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
        if (
          name === 'NotAllowedError' ||
          name === 'PermissionDeniedError' ||
          name === 'SecurityError'
        ) {
          throw firstErr;
        }
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
    },
    []
  );

  const handleRequestCameraPermission = async () => {
    stopCamera();
    setCameraError(null);
    setCameraActive(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'A câmera ao vivo não está disponível neste contexto. Use "Fotografar QR", "Ler Foto / Print" ou abra em uma nova aba.'
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
          'Permissão da câmera bloqueada ou recusada. Clique em "Permitir Câmera", abra em nova aba ou use "Fotografar QR".'
        );
      } else {
        setCameraError(
          'Nenhuma câmera detectada ou câmera em uso. Use "Fotografar QR", "Ler Foto / Print" ou digite o código.'
        );
      }
    }
  };

  useEffect(() => {
    if (!isOpen || !cameraActive) {
      stopCamera();
      return;
    }

    let cancelled = false;
    setCameraError(null);

    async function startCamera() {
      if (streamRef.current && streamRef.current.active) {
        setCameraReady(true);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'A câmera ao vivo não está disponível neste contexto. Use "Fotografar QR", "Ler Foto / Print" ou abra em uma nova aba.'
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
            'Permissão da câmera não concedida. Clique em "Permitir Câmera", abra em nova aba ou use "Fotografar QR".'
          );
        } else {
          setCameraError(
            'Nenhuma câmera detectada ou câmera ocupada. Use "Fotografar QR", "Ler Foto / Print" ou código manual.'
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
          notify('Nenhum QR Code válido encontrado nesta imagem.', 'error');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (captureInputRef.current) captureInputRef.current.value = '';
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDecodedPayload(manualInput.trim());
    setManualInput('');
  };

  const handleUndoPresence = async (member: AttendanceMember) => {
    if (!activeCall) return;
    if (isLockedByOther) {
      notify(`Chamada bloqueada por ${activeCall.activeOperatorName}.`, 'error');
      return;
    }
    try {
      setIsProcessingScan(true);
      const nextRecords = { ...activeCall.records };
      delete nextRecords[member.id];
      await api.saveAttendanceCall({
        ...activeCall,
        records: nextRecords,
      });
      if (scanResult?.member?.id === member.id) {
        setScanResult(null);
      }
      notify(`Presença de ${member.name} desmarcada.`, 'info');
    } catch {
      notify('Erro ao desfazer presença.', 'error');
    } finally {
      setIsProcessingScan(false);
    }
  };

  const handleInspectPresent = (item: {
    member: AttendanceMember;
    department?: AttendanceDepartment;
    markedAt?: string;
    markedByName?: string;
  }) => {
    setScanResult({
      outcome: 'inspected',
      member: item.member,
      department: item.department,
      decoded: {
        id: item.member.id,
        code: getMemberCredentialCode(item.member),
        name: item.member.name,
        departmentName: item.department?.name,
        roleTitle: item.member.roleTitle,
        phone: item.member.phone,
        congregation: item.member.congregation,
        area: item.member.area,
        rawText: item.member.id,
      },
      scannedAt: item.markedAt || new Date().toISOString(),
      markedAt: item.markedAt,
      markedByName: item.markedByName,
    });
  };

  if (!isOpen) return null;

  const currentMember = scanResult?.member;
  const currentDept =
    scanResult?.department ||
    (currentMember ? deptMap.get(currentMember.departmentId) : undefined);
  const displayName = currentMember?.name || scanResult?.decoded.name || 'Membro';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex items-stretch sm:items-center justify-center sm:p-4 lg:p-6">
      <div className="w-full h-full sm:h-auto sm:max-h-[92vh] max-w-6xl bg-neutral-900 sm:border sm:border-neutral-800 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 1. Compact Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold text-neutral-100 truncate">
                Leitor QR — Chamada de Membros
              </h2>
              <div className="text-xs text-amber-400 font-medium truncate">
                {callTitle} · {formatAttendanceDateBR(selectedDate)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className="min-h-[40px] min-w-[40px] px-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title={soundEnabled ? 'Desativar som' : 'Ativar som'}
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

        {/* Lock Notice if another member owns the call */}
        {isLockedByOther && (
          <div className="px-4 py-2.5 bg-red-500/15 border-b border-red-500/30 flex items-center gap-2 text-xs text-red-200 shrink-0">
            <Lock className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              Chamada em andamento por <strong>{activeCall?.activeOperatorName}</strong>. Leitura bloqueada para alterações por outro usuário.
            </span>
          </div>
        )}

        {/* 2. Hairline Telemetry Strip */}
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
                Na Chamada
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-neutral-100">
                {totalInCall}
              </span>
            </div>

            <div className="px-2 sm:px-4 py-2.5 text-center sm:text-left sm:flex sm:items-baseline sm:justify-between">
              <span className="block text-[10px] sm:text-xs font-medium text-neutral-400 truncate">
                Faltas
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-red-400">
                {absentCount}
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

          <div className="h-0.5 w-full bg-neutral-800/80">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${attendancePercent}%` }}
            />
          </div>
        </div>

        {/* Mobile Segmented Switcher */}
        {!scanResult && (
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

        {/* 3. Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:grid lg:grid-cols-12 lg:gap-6 items-start space-y-4 lg:space-y-0">
          {/* LEFT: Camera & Quick Input */}
          <div
            className={`lg:col-span-5 space-y-3 ${
              scanResult || mobileTab === 'presentes' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
              <div className="relative h-64 sm:h-72 lg:h-auto lg:aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${
                    cameraActive && !cameraError ? 'block' : 'hidden'
                  }`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Floating Camera Controls */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                    }
                    className="min-h-[36px] px-2.5 py-1.5 bg-neutral-950/75 hover:bg-neutral-900 backdrop-blur-sm text-neutral-100 text-[11px] font-semibold rounded-xl border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    title="Trocar câmera"
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

                {cameraActive && !cameraError && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                    <div className="w-40 h-40 sm:w-48 sm:h-48 relative">
                      <span className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-amber-400 rounded-tl-xl" />
                      <span className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-amber-400 rounded-tr-xl" />
                      <span className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-amber-400 rounded-bl-xl" />
                      <span className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-amber-400 rounded-br-xl" />
                    </div>
                    <span className="mt-3 px-3 py-1 bg-black/70 backdrop-blur-xs text-[11px] font-medium text-neutral-200 rounded-lg">
                      {cameraReady
                        ? 'Aponte para a credencial do membro'
                        : 'Iniciando câmera...'}
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

              {/* Manual Input + Photo Fallback */}
              <div className="p-3 sm:p-3.5 space-y-2.5 border-t border-neutral-800 bg-neutral-950">
                <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Código PTB-MEM-... ou nome do membro"
                    className="flex-1 min-w-0 px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 font-mono focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={!manualInput.trim() || isProcessingScan}
                    className="min-h-[38px] px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Confirmar
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

            <div className="px-1 flex items-center gap-2 text-[11px] text-neutral-400">
              <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">
                {formatAttendanceDateBR(selectedDate)} · {callTitle}
              </span>
            </div>
          </div>

          {/* RIGHT: Verification Result Card & Present List */}
          <div
            className={`lg:col-span-7 space-y-4 ${
              !scanResult && mobileTab === 'scanner' ? 'hidden lg:block' : 'block'
            }`}
          >
            {scanResult ? (
              <div
                className={`bg-neutral-950 border rounded-2xl overflow-hidden shadow-xl ${
                  scanResult.outcome === 'checked_in_now'
                    ? 'border-emerald-500/50'
                    : scanResult.outcome === 'already_present' || scanResult.outcome === 'inspected'
                    ? 'border-sky-500/40'
                    : scanResult.outcome === 'locked_by_other'
                    ? 'border-amber-500/50'
                    : 'border-red-500/50'
                }`}
              >
                {/* Result Status Header */}
                <div
                  className={`px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-2.5 ${
                    scanResult.outcome === 'checked_in_now'
                      ? 'bg-emerald-500/15 text-emerald-300 border-b border-emerald-500/30'
                      : scanResult.outcome === 'already_present'
                      ? 'bg-sky-500/15 text-sky-300 border-b border-sky-500/30'
                      : scanResult.outcome === 'inspected'
                      ? 'bg-emerald-500/10 text-emerald-300 border-b border-neutral-800'
                      : scanResult.outcome === 'locked_by_other'
                      ? 'bg-amber-500/15 text-amber-300 border-b border-amber-500/30'
                      : 'bg-red-500/15 text-red-300 border-b border-red-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {scanResult.outcome === 'checked_in_now' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    )}
                    {(scanResult.outcome === 'already_present' ||
                      scanResult.outcome === 'inspected') && (
                      <UserCheck className="w-5 h-5 text-sky-400 shrink-0" />
                    )}
                    {scanResult.outcome === 'locked_by_other' && (
                      <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                    )}
                    {scanResult.outcome === 'not_found' && (
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}

                    <div className="min-w-0">
                      <div className="text-xs font-bold tracking-wide">
                        {scanResult.outcome === 'checked_in_now' &&
                          'Presença Confirmada na Chamada'}
                        {scanResult.outcome === 'already_present' &&
                          'Presença Já Registrada Hoje'}
                        {scanResult.outcome === 'inspected' &&
                          'Credencial de Membro Presente'}
                        {scanResult.outcome === 'locked_by_other' &&
                          'Chamada Bloqueada por Outro Responsável'}
                        {scanResult.outcome === 'not_found' &&
                          'Credencial Não Encontrada'}
                      </div>
                      <div className="text-[11px] opacity-85 truncate">
                        {scanResult.outcome === 'checked_in_now' &&
                          `Confirmado às ${new Date(scanResult.scannedAt).toLocaleTimeString('pt-BR')}`}
                        {(scanResult.outcome === 'already_present' ||
                          scanResult.outcome === 'inspected') &&
                          `Marcado às ${
                            scanResult.markedAt
                              ? new Date(scanResult.markedAt).toLocaleTimeString('pt-BR')
                              : '-'
                          }${scanResult.markedByName ? ` · por ${scanResult.markedByName}` : ''}`}
                        {scanResult.outcome === 'locked_by_other' &&
                          `Em andamento por ${scanResult.lockedByName || 'outro membro'}`}
                        {scanResult.outcome === 'not_found' &&
                          'Código não localizado no cadastro de membros.'}
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

                {/* Member Info Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold text-sm flex items-center justify-center shrink-0">
                        {initials || 'MB'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-neutral-100 truncate">
                          {displayName}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5 flex-wrap">
                          <span className="font-mono tabular-nums text-amber-400 font-semibold">
                            {currentMember
                              ? getMemberCredentialCode(currentMember)
                              : scanResult.decoded.code}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {currentDept?.name || scanResult.decoded.departmentName || 'Geral'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {currentMember && (
                      <div className="text-left sm:text-right shrink-0">
                        <div className="text-[11px] text-neutral-400">Categoria</div>
                        <div className="text-xs font-bold text-emerald-400 mt-0.5">
                          {currentDept ? KIND_LABELS[currentDept.kind] : 'Membro'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <Shield className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[11px] text-neutral-400">Função / Cargo</div>
                        <div className="font-semibold text-neutral-100 mt-0.5">
                          {currentMember?.roleTitle ||
                            scanResult.decoded.roleTitle ||
                            currentDept?.name ||
                            'Membro Ativo'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Phone className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[11px] text-neutral-400">Telefone / WhatsApp</div>
                        <div className="font-semibold font-mono tabular-nums text-neutral-100 mt-0.5">
                          {currentMember?.phone || scanResult.decoded.phone || 'Não informado'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Building className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[11px] text-neutral-400">Congregação</div>
                        <div className="font-semibold text-neutral-100 mt-0.5">
                          {currentMember?.congregation ||
                            scanResult.decoded.congregation ||
                            'IEADAM Petrópolis B'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-[11px] text-neutral-400">Área / Setor</div>
                        <div className="font-semibold text-neutral-100 mt-0.5">
                          {currentMember?.area || scanResult.decoded.area || 'Sede / Geral'}
                        </div>
                      </div>
                    </div>

                    {currentMember?.email && (
                      <div className="flex items-start gap-2.5 sm:col-span-2">
                        <Mail className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[11px] text-neutral-400">E-mail</div>
                          <div className="font-semibold text-neutral-100 mt-0.5 truncate">
                            {currentMember.email}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  {currentMember && (
                    <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-neutral-800">
                      {!isLockedByOther &&
                        activeCall?.records?.[currentMember.id]?.status === 'presente' && (
                          <button
                            type="button"
                            disabled={isProcessingScan}
                            onClick={() => handleUndoPresence(currentMember)}
                            className="min-h-[40px] px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-red-300 text-xs font-semibold rounded-xl border border-red-500/30 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Desfazer Presença</span>
                          </button>
                        )}

                      <button
                        type="button"
                        onClick={() => exportMemberCredentialPDF(currentMember, currentDept)}
                        className="min-h-[40px] px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>Credencial PDF</span>
                      </button>
                    </div>
                  )}
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
                    Aponte a câmera para o QR Code da credencial do membro ou informe o código para confirmar a presença automaticamente nesta chamada.
                  </p>
                </div>
              </div>
            )}

            {/* Live Presentes List */}
            <div
              className={`bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden ${
                scanResult && mobileTab !== 'presentes' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="px-4 py-3 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h3 className="text-xs font-bold text-neutral-100">
                    Presentes na Chamada
                  </h3>
                  <span className="text-xs font-mono tabular-nums font-bold text-emerald-400">
                    {totalPresent} / {totalInCall}
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

              {filteredPresent.length === 0 ? (
                <div className="p-8 text-center text-xs text-neutral-400">
                  {presentMembers.length === 0
                    ? 'Nenhum membro marcado como presente ainda. Leia um QR Code para registrar a primeira presença.'
                    : 'Nenhum membro presente encontrado nesta busca.'}
                </div>
              ) : (
                <div className="max-h-[340px] overflow-y-auto divide-y divide-neutral-800/70">
                  {filteredPresent.map((item, idx) => (
                    <div
                      key={item.member.id}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-neutral-900/70 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleInspectPresent(item)}
                        className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span className="text-[11px] font-mono tabular-nums text-emerald-400 font-bold w-7 shrink-0">
                          #{String(filteredPresent.length - indexOrLength(idx)).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-neutral-100 truncate">
                            {item.member.name}
                          </div>
                          <div className="text-[11px] text-neutral-400 truncate">
                            <span className="font-mono text-amber-400/90">
                              {getMemberCredentialCode(item.member)}
                            </span>
                            {item.department ? ` · ${item.department.name}` : ''}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-mono tabular-nums text-emerald-400">
                          {item.markedAt
                            ? new Date(item.markedAt).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Presente'}
                        </span>
                        {!isLockedByOther && (
                          <button
                            type="button"
                            onClick={() => handleUndoPresence(item.member)}
                            className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg cursor-pointer"
                            title="Desfazer presença"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function indexOrLength(i: number) {
  return i;
}
