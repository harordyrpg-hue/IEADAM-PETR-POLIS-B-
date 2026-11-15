import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Plus,
  Trash2,
  Download,
  Image as ImageIcon,
  Users,
  UserPlus,
  FolderPlus,
  Search,
  SlidersHorizontal,
  Edit3,
  ClipboardCheck,
  Building,
  RotateCcw,
  QrCode,
  Lock,
  Unlock,
  UserCheck,
  IdCard,
  MoreHorizontal,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import {
  AttendanceCall,
  AttendanceDepartment,
  AttendanceDepartmentKind,
  AttendanceEntry,
  AttendanceMember,
} from '../../types.js';
import { api } from '../../services/api.js';
import {
  DepartmentExportGroup,
  exportAttendanceImage,
  exportAttendancePDF,
  formatAttendanceDateBR,
} from '../../utils/attendanceExport.js';
import {
  exportBatchMemberCredentialsPDF,
  exportMemberCredentialPDF,
  getMemberCredentialCode,
} from '../../utils/memberCredentialPdf.js';
import { MemberCredentialModal } from '../attendance/MemberCredentialModal.js';
import { MemberQrScannerModal } from '../attendance/MemberQrScannerModal.js';

const KIND_LABELS: Record<AttendanceDepartmentKind, string> = {
  departamento: 'Departamento',
  ministerio: 'Ministério',
  equipe: 'Equipe',
};

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const AttendanceView: React.FC = () => {
  const { user, notify } = useApp();

  const [departments, setDepartments] = useState<AttendanceDepartment[]>([]);
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [calls, setCalls] = useState<AttendanceCall[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected date & calendar month
  const todayISO = useMemo(() => getTodayISO(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);

  // Workspace view mode ('chamada' | 'credenciais')
  const [workspaceTab, setWorkspaceTab] = useState<'chamada' | 'credenciais'>('chamada');

  // Active call selection
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>('Chamada Geral');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'presente' | 'falta' | 'pendente'>('all');

  // Secondary action menu per member row (keeps rows clean)
  const [openMenuMemberId, setOpenMenuMemberId] = useState<string | null>(null);

  // Modals: Category
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptKind, setNewDeptKind] = useState<AttendanceDepartmentKind>('departamento');
  const [isSavingDept, setIsSavingDept] = useState(false);

  // Modals: Member (with credential metadata)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberDeptId, setNewMemberDeptId] = useState('');
  const [newMemberRoleTitle, setNewMemberRoleTitle] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberCongregation, setNewMemberCongregation] = useState('IEADAM Petrópolis B');
  const [newMemberArea, setNewMemberArea] = useState('');
  const [isSavingMember, setIsSavingMember] = useState(false);

  // Modals: Participants Selector
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [tempIncludedIds, setTempIncludedIds] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');

  // Modals: Absence Justification
  const [absenceTarget, setAbsenceTarget] = useState<{
    member: AttendanceMember;
    department: AttendanceDepartment;
    existingEntry?: AttendanceEntry;
  } | null>(null);
  const [justificationText, setJustificationText] = useState('');
  const [noJustification, setNoJustification] = useState(false);

  // Modals: New Extra Call
  const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
  const [newCallTitle, setNewCallTitle] = useState('');

  // Modals: Credential Preview & QR Scanner
  const [credentialTarget, setCredentialTarget] = useState<AttendanceMember | null>(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Busy flags
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isExportingBatchPdf, setIsExportingBatchPdf] = useState(false);
  const [isResettingCall, setIsResettingCall] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);

  // Seed initial roster once & subscribe
  useEffect(() => {
    let active = true;
    setLoading(true);

    api.ensureInitialAttendanceRoster().catch(() => {
      // handled in api
    });

    const unsubDepts = api.subscribeAttendanceDepartments((list) => {
      if (!active) return;
      setDepartments(list);
      setLoading(false);
    });
    const unsubMembers = api.subscribeAttendanceMembers((list) => {
      if (!active) return;
      setMembers(list);
    });
    const unsubCalls = api.subscribeAttendanceCalls((list) => {
      if (!active) return;
      setCalls(list);
    });

    return () => {
      active = false;
      unsubDepts();
      unsubMembers();
      unsubCalls();
    };
  }, []);

  // Calls for selected date
  const callsForSelectedDate = useMemo(
    () => calls.filter((c) => c.date === selectedDate),
    [calls, selectedDate]
  );

  useEffect(() => {
    if (callsForSelectedDate.length > 0) {
      const stillExists = callsForSelectedDate.find((c) => c.id === selectedCallId);
      if (stillExists) {
        setDraftTitle(stillExists.title);
      } else {
        setSelectedCallId(callsForSelectedDate[0].id);
        setDraftTitle(callsForSelectedDate[0].title);
      }
    } else {
      setSelectedCallId(null);
      setDraftTitle('Chamada Geral');
    }
  }, [selectedDate, callsForSelectedDate, selectedCallId]);

  const activeCall = useMemo(
    () => callsForSelectedDate.find((c) => c.id === selectedCallId) || null,
    [callsForSelectedDate, selectedCallId]
  );

  // Exclusive operator lock state
  const activeOperatorUid = activeCall?.activeOperatorUid || null;
  const activeOperatorName = activeCall?.activeOperatorName || null;
  const isLockedByMe = !!(activeOperatorUid && user?.uid && activeOperatorUid === user.uid);
  const isLockedByOther = !!(activeOperatorUid && user?.uid && activeOperatorUid !== user.uid);

  const datesWithCalls = useMemo(() => {
    const map: Record<string, number> = {};
    calls.forEach((c) => {
      map[c.date] = (map[c.date] || 0) + 1;
    });
    return map;
  }, [calls]);

  const effectiveIncludedIds = useMemo(() => {
    if (activeCall) {
      const validIds = new Set(members.map((m) => m.id));
      return activeCall.includedMemberIds.filter((id) => validIds.has(id));
    }
    return members.map((m) => m.id);
  }, [activeCall, members]);

  const includedSet = useMemo(() => new Set(effectiveIncludedIds), [effectiveIncludedIds]);
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d])), [departments]);

  const buildBaseCall = useCallback(
    (overrideId?: string, overrideTitle?: string): AttendanceCall => {
      const now = new Date().toISOString();
      if (activeCall && !overrideId) {
        return activeCall;
      }
      return {
        id: overrideId || `call_${selectedDate}`,
        date: selectedDate,
        title: overrideTitle || draftTitle.trim() || 'Chamada Geral',
        includedMemberIds: members.map((m) => m.id),
        records: {},
        createdByUid: user?.uid || 'system',
        createdByName: user?.name || 'Usuário',
        updatedByUid: user?.uid || 'system',
        updatedByName: user?.name || 'Usuário',
        createdAt: now,
        updatedAt: now,
      };
    },
    [activeCall, selectedDate, draftTitle, members, user]
  );

  // Error helper for exclusive call lock
  const handleLockError = (err: unknown, fallbackMessage: string) => {
    if (err instanceof Error && err.message.startsWith('ATTENDANCE_LOCKED:')) {
      const ownerName = err.message.replace('ATTENDANCE_LOCKED:', '');
      notify(
        `Chamada em andamento por ${ownerName}. Outro membro não pode assumir enquanto estiver ativa.`,
        'error'
      );
      return;
    }
    notify(fallbackMessage, 'error');
  };

  // Group included members by department (Chamada tab)
  const allDepartmentGroups: DepartmentExportGroup[] = useMemo(() => {
    const records = activeCall?.records || {};
    return departments.map((dept) => {
      const deptMembers = members.filter((m) => m.departmentId === dept.id && includedSet.has(m.id));
      let presentCount = 0;
      let absentCount = 0;
      let unmarkedCount = 0;

      const entries = deptMembers.map((member) => {
        const entry = records[member.id];
        if (entry?.status === 'presente') presentCount++;
        else if (entry?.status === 'falta') absentCount++;
        else unmarkedCount++;
        return { member, entry };
      });

      return {
        department: dept,
        members: entries,
        presentCount,
        absentCount,
        unmarkedCount,
      };
    });
  }, [departments, members, includedSet, activeCall]);

  const totals = useMemo(() => {
    let totalIncluded = 0;
    let presentCount = 0;
    let absentCount = 0;
    let unmarkedCount = 0;

    allDepartmentGroups.forEach((g) => {
      totalIncluded += g.members.length;
      presentCount += g.presentCount;
      absentCount += g.absentCount;
      unmarkedCount += g.unmarkedCount;
    });

    const markedTotal = presentCount + absentCount;
    const attendancePercent =
      totalIncluded > 0 ? Math.round((presentCount / totalIncluded) * 100) : 0;

    return { totalIncluded, presentCount, absentCount, unmarkedCount, markedTotal, attendancePercent };
  }, [allDepartmentGroups]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allDepartmentGroups
      .filter((g) => departmentFilter === 'all' || g.department.id === departmentFilter)
      .map((g) => {
        const filteredMembers = g.members.filter(({ member, entry }) => {
          if (
            q &&
            !member.name.toLowerCase().includes(q) &&
            !g.department.name.toLowerCase().includes(q) &&
            !getMemberCredentialCode(member).toLowerCase().includes(q)
          ) {
            return false;
          }
          if (statusFilter === 'presente' && entry?.status !== 'presente') return false;
          if (statusFilter === 'falta' && entry?.status !== 'falta') return false;
          if (statusFilter === 'pendente' && entry !== undefined) return false;
          return true;
        });
        return { ...g, members: filteredMembers };
      });
  }, [allDepartmentGroups, departmentFilter, searchQuery, statusFilter]);

  // All members grouped for the "Credenciais & QR Codes" tab
  const credentialDirectoryGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return departments
      .filter((d) => departmentFilter === 'all' || d.id === departmentFilter)
      .map((dept) => {
        const list = members.filter((m) => {
          if (m.departmentId !== dept.id) return false;
          if (!q) return true;
          return (
            m.name.toLowerCase().includes(q) ||
            dept.name.toLowerCase().includes(q) ||
            getMemberCredentialCode(m).toLowerCase().includes(q) ||
            (m.roleTitle || '').toLowerCase().includes(q)
          );
        });
        return { department: dept, members: list };
      });
  }, [departments, members, departmentFilter, searchQuery]);

  // ==========================================
  // HANDLERS: EXCLUSIVE CALL LOCK
  // ==========================================
  const handleClaimCall = async () => {
    if (isLockedByOther) {
      notify(
        `Esta chamada já está sendo realizada por ${activeOperatorName}. Outro membro não pode assumir.`,
        'error'
      );
      return;
    }
    try {
      setIsTogglingLock(true);
      const base = buildBaseCall();
      const saved = await api.claimAttendanceCall(
        base,
        user ? { uid: user.uid, name: user.name, email: user.email } : undefined
      );
      setSelectedCallId(saved.id);
      notify('Você assumiu a condução desta chamada!', 'success');
    } catch (err) {
      handleLockError(err, 'Erro ao assumir chamada.');
    } finally {
      setIsTogglingLock(false);
    }
  };

  const handleReleaseCall = async () => {
    if (!activeCall) return;
    if (!isLockedByMe) {
      notify(
        `Apenas ${activeOperatorName || 'quem iniciou'} pode liberar esta chamada.`,
        'error'
      );
      return;
    }
    try {
      setIsTogglingLock(true);
      await api.releaseAttendanceCall(
        activeCall.id,
        user ? { uid: user.uid, name: user.name } : undefined,
        true
      );
      notify('Chamada liberada com sucesso. Outro responsável pode assumi-la se necessário.', 'info');
    } catch (err) {
      handleLockError(err, 'Erro ao liberar chamada.');
    } finally {
      setIsTogglingLock(false);
    }
  };

  // ==========================================
  // HANDLERS: MARKING PRESENCE & ABSENCE
  // ==========================================
  const handleMarkPresent = async (member: AttendanceMember, department: AttendanceDepartment) => {
    if (isLockedByOther) {
      notify(`Chamada em andamento por ${activeOperatorName}. Apenas o responsável atual pode marcar.`, 'error');
      return;
    }
    const baseCall = buildBaseCall();
    const currentEntry = baseCall.records[member.id];
    const nextRecords = { ...baseCall.records };

    if (currentEntry?.status === 'presente') {
      delete nextRecords[member.id];
    } else {
      nextRecords[member.id] = {
        memberId: member.id,
        memberName: member.name,
        departmentId: department.id,
        departmentName: department.name,
        status: 'presente',
        markedByUid: user?.uid || 'system',
        markedByName: user?.name || 'Usuário',
        markedAt: new Date().toISOString(),
      };
    }

    try {
      const saved = await api.saveAttendanceCall({
        ...baseCall,
        title: draftTitle.trim() || baseCall.title,
        records: nextRecords,
      });
      setSelectedCallId(saved.id);
    } catch (err) {
      handleLockError(err, 'Erro ao registrar presença.');
    }
  };

  const handleOpenAbsenceModal = (
    member: AttendanceMember,
    department: AttendanceDepartment,
    existingEntry?: AttendanceEntry
  ) => {
    if (isLockedByOther) {
      notify(`Chamada em andamento por ${activeOperatorName}.`, 'error');
      return;
    }
    setAbsenceTarget({ member, department, existingEntry });
    if (existingEntry?.status === 'falta') {
      setNoJustification(!!existingEntry.noJustification);
      setJustificationText(existingEntry.noJustification ? '' : existingEntry.justification || '');
    } else {
      setNoJustification(false);
      setJustificationText('');
    }
  };

  const handleSaveAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!absenceTarget) return;
    if (isLockedByOther) {
      notify(`Chamada em andamento por ${activeOperatorName}.`, 'error');
      return;
    }

    if (!noJustification && !justificationText.trim()) {
      notify('Informe o motivo da falta ou marque "Não apresentou justificativa".', 'error');
      return;
    }

    const baseCall = buildBaseCall();
    const nextRecords = { ...baseCall.records };
    nextRecords[absenceTarget.member.id] = {
      memberId: absenceTarget.member.id,
      memberName: absenceTarget.member.name,
      departmentId: absenceTarget.department.id,
      departmentName: absenceTarget.department.name,
      status: 'falta',
      justification: noJustification ? 'Não apresentou justificativa' : justificationText.trim(),
      noJustification,
      markedByUid: user?.uid || 'system',
      markedByName: user?.name || 'Usuário',
      markedAt: new Date().toISOString(),
    };

    try {
      const saved = await api.saveAttendanceCall({
        ...baseCall,
        title: draftTitle.trim() || baseCall.title,
        records: nextRecords,
      });
      setSelectedCallId(saved.id);
      setAbsenceTarget(null);
      setJustificationText('');
      setNoJustification(false);
      notify(`Falta registrada para ${absenceTarget.member.name}.`, 'info');
    } catch (err) {
      handleLockError(err, 'Erro ao registrar falta.');
    }
  };

  const handleClearMemberMark = async (memberId: string) => {
    if (!activeCall) return;
    if (isLockedByOther) {
      notify(`Chamada em andamento por ${activeOperatorName}.`, 'error');
      return;
    }
    const nextRecords = { ...activeCall.records };
    delete nextRecords[memberId];
    try {
      await api.saveAttendanceCall({
        ...activeCall,
        records: nextRecords,
      });
      setOpenMenuMemberId(null);
    } catch (err) {
      handleLockError(err, 'Erro ao limpar marcação.');
    }
  };

  const handleRemoveMemberFromCall = async (member: AttendanceMember) => {
    if (isLockedByOther) {
      notify(`Chamada em andamento por ${activeOperatorName}.`, 'error');
      return;
    }
    const baseCall = buildBaseCall();
    const nextIncluded = baseCall.includedMemberIds.filter((id) => id !== member.id);
    const nextRecords = { ...baseCall.records };
    delete nextRecords[member.id];
    try {
      const saved = await api.saveAttendanceCall({
        ...baseCall,
        includedMemberIds: nextIncluded,
        records: nextRecords,
      });
      setSelectedCallId(saved.id);
      setOpenMenuMemberId(null);
      notify(`${member.name} removido apenas desta chamada.`, 'info');
    } catch (err) {
      handleLockError(err, 'Erro ao remover participante da chamada.');
    }
  };

  // ==========================================
  // HANDLERS: CALL TITLE & EXTRA CALL
  // ==========================================
  const handleSaveCallTitle = async () => {
    if (isLockedByOther) {
      notify(`Chamada em andamento por ${activeOperatorName}.`, 'error');
      return;
    }
    const cleanTitle = draftTitle.trim() || 'Chamada Geral';
    const baseCall = buildBaseCall();
    try {
      const saved = await api.saveAttendanceCall({
        ...baseCall,
        title: cleanTitle,
      });
      setSelectedCallId(saved.id);
      notify('Título da chamada salvo!', 'success');
    } catch (err) {
      handleLockError(err, 'Erro ao salvar título da chamada.');
    }
  };

  const handleCreateExtraCallForDate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newCallTitle.trim() || 'Nova Chamada';
    const newId = `call_${selectedDate}_${Date.now()}`;
    const base = buildBaseCall(newId, title);
    try {
      const saved = await api.saveAttendanceCall(base);
      setSelectedCallId(saved.id);
      setDraftTitle(saved.title);
      setIsNewCallModalOpen(false);
      setNewCallTitle('');
      notify(`Nova chamada "${title}" criada para ${formatAttendanceDateBR(selectedDate)}.`, 'success');
    } catch (err) {
      handleLockError(err, 'Erro ao criar chamada.');
    }
  };

  // ==========================================
  // HANDLERS: PARTICIPANTS MODAL
  // ==========================================
  const handleOpenParticipantsModal = () => {
    if (isLockedByOther) {
      notify(`Chamada em andamento por ${activeOperatorName}.`, 'error');
      return;
    }
    setTempIncludedIds([...effectiveIncludedIds]);
    setParticipantSearch('');
    setIsParticipantsModalOpen(true);
  };

  const handleToggleTempMember = (memberId: string) => {
    setTempIncludedIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleToggleTempDepartment = (deptId: string) => {
    const deptMemberIds = members.filter((m) => m.departmentId === deptId).map((m) => m.id);
    if (deptMemberIds.length === 0) return;
    const allSelected = deptMemberIds.every((id) => tempIncludedIds.includes(id));
    if (allSelected) {
      setTempIncludedIds((prev) => prev.filter((id) => !deptMemberIds.includes(id)));
    } else {
      setTempIncludedIds((prev) => Array.from(new Set([...prev, ...deptMemberIds])));
    }
  };

  const handleSaveParticipants = async () => {
    if (isLockedByOther) {
      notify(`Chamada em andamento por ${activeOperatorName}.`, 'error');
      return;
    }
    const baseCall = buildBaseCall();
    const tempSet = new Set(tempIncludedIds);
    const cleanedRecords: Record<string, AttendanceEntry> = {};
    Object.entries(baseCall.records).forEach(([memberId, entry]) => {
      if (tempSet.has(memberId)) {
        cleanedRecords[memberId] = entry;
      }
    });

    try {
      const saved = await api.saveAttendanceCall({
        ...baseCall,
        title: draftTitle.trim() || baseCall.title,
        includedMemberIds: tempIncludedIds,
        records: cleanedRecords,
      });
      setSelectedCallId(saved.id);
      setIsParticipantsModalOpen(false);
      notify(`${tempIncludedIds.length} participante(s) definidos para esta chamada.`, 'success');
    } catch (err) {
      handleLockError(err, 'Erro ao salvar participantes da chamada.');
    }
  };

  // ==========================================
  // HANDLERS: DEPARTMENTS & MEMBERS CRUD
  // ==========================================
  const handleOpenCreateDepartment = () => {
    setEditingDeptId(null);
    setNewDeptName('');
    setNewDeptKind('departamento');
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDepartment = (dept: AttendanceDepartment) => {
    setEditingDeptId(dept.id);
    setNewDeptName(dept.name);
    setNewDeptKind(dept.kind);
    setIsDeptModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newDeptName.trim();
    if (!cleanName) {
      notify('Informe o nome da categoria, departamento, ministério ou equipe.', 'error');
      return;
    }
    try {
      setIsSavingDept(true);
      if (editingDeptId) {
        await api.updateAttendanceDepartment(editingDeptId, {
          name: cleanName,
          kind: newDeptKind,
        });
        if (activeCall && !isLockedByOther) {
          let changed = false;
          const nextRecords = { ...activeCall.records };
          Object.entries(nextRecords).forEach(([memId, entry]) => {
            if (entry.departmentId === editingDeptId && entry.departmentName !== cleanName) {
              nextRecords[memId] = { ...entry, departmentName: cleanName };
              changed = true;
            }
          });
          if (changed) {
            await api.saveAttendanceCall({ ...activeCall, records: nextRecords });
          }
        }
        notify('Categoria atualizada com sucesso!', 'success');
      } else {
        const nextOrder =
          departments.length > 0 ? Math.max(...departments.map((d) => d.order || 0)) + 1 : 1;
        await api.createAttendanceDepartment(cleanName, newDeptKind, nextOrder);
        notify('Categoria/equipe adicionada com sucesso!', 'success');
      }
      setNewDeptName('');
      setEditingDeptId(null);
      setIsDeptModalOpen(false);
    } catch {
      notify('Erro ao salvar categoria.', 'error');
    } finally {
      setIsSavingDept(false);
    }
  };

  const handleDeleteDepartment = async (dept: AttendanceDepartment) => {
    const count = members.filter((m) => m.departmentId === dept.id).length;
    if (
      !confirm(
        `Excluir "${dept.name}"${count > 0 ? ` e seus ${count} membro(s)` : ''}? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    try {
      await api.deleteAttendanceDepartment(dept.id, dept.name);
      if (departmentFilter === dept.id) setDepartmentFilter('all');
      notify(`"${dept.name}" excluído.`, 'info');
    } catch {
      notify('Erro ao excluir departamento.', 'error');
    }
  };

  const handleOpenAddMember = (presetDeptId?: string) => {
    setEditingMemberId(null);
    setNewMemberName('');
    setNewMemberDeptId(presetDeptId || departments[0]?.id || '');
    setNewMemberRoleTitle('');
    setNewMemberPhone('');
    setNewMemberEmail('');
    setNewMemberCongregation('IEADAM Petrópolis B');
    setNewMemberArea('');
    setIsMemberModalOpen(true);
  };

  const handleOpenEditMember = (member: AttendanceMember) => {
    setOpenMenuMemberId(null);
    setEditingMemberId(member.id);
    setNewMemberName(member.name);
    setNewMemberDeptId(member.departmentId);
    setNewMemberRoleTitle(member.roleTitle || '');
    setNewMemberPhone(member.phone || '');
    setNewMemberEmail(member.email || '');
    setNewMemberCongregation(member.congregation || 'IEADAM Petrópolis B');
    setNewMemberArea(member.area || '');
    setIsMemberModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newMemberName.trim();
    if (!cleanName || !newMemberDeptId) {
      notify('Informe o nome do membro e selecione a categoria.', 'error');
      return;
    }
    try {
      setIsSavingMember(true);
      if (editingMemberId) {
        await api.updateAttendanceMember(editingMemberId, {
          name: cleanName,
          departmentId: newMemberDeptId,
          roleTitle: newMemberRoleTitle,
          phone: newMemberPhone,
          email: newMemberEmail,
          congregation: newMemberCongregation,
          area: newMemberArea,
        });
        if (activeCall && activeCall.records[editingMemberId] && !isLockedByOther) {
          const targetDept = departments.find((d) => d.id === newMemberDeptId);
          const nextRecords = {
            ...activeCall.records,
            [editingMemberId]: {
              ...activeCall.records[editingMemberId],
              memberName: cleanName,
              departmentId: newMemberDeptId,
              departmentName:
                targetDept?.name || activeCall.records[editingMemberId].departmentName,
            },
          };
          await api.saveAttendanceCall({ ...activeCall, records: nextRecords });
        }
        notify(`Membro "${cleanName}" atualizado!`, 'success');
      } else {
        const created = await api.createAttendanceMember(newMemberDeptId, cleanName, {
          roleTitle: newMemberRoleTitle,
          phone: newMemberPhone,
          email: newMemberEmail,
          congregation: newMemberCongregation,
          area: newMemberArea,
        });
        if (activeCall && !isLockedByOther) {
          await api.saveAttendanceCall({
            ...activeCall,
            includedMemberIds: Array.from(new Set([...activeCall.includedMemberIds, created.id])),
          });
        }
        notify(`Membro "${created.name}" adicionado com credencial QR!`, 'success');
      }
      setEditingMemberId(null);
      setIsMemberModalOpen(false);
    } catch {
      notify('Erro ao salvar membro.', 'error');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleDeleteMember = async (member: AttendanceMember) => {
    setOpenMenuMemberId(null);
    if (!confirm(`Excluir o membro "${member.name}" permanentemente?`)) return;
    try {
      await api.deleteAttendanceMember(member.id, member.name);
      if (
        activeCall &&
        !isLockedByOther &&
        (activeCall.includedMemberIds.includes(member.id) || activeCall.records[member.id])
      ) {
        const nextRecords = { ...activeCall.records };
        delete nextRecords[member.id];
        await api.saveAttendanceCall({
          ...activeCall,
          includedMemberIds: activeCall.includedMemberIds.filter((id) => id !== member.id),
          records: nextRecords,
        });
      }
      notify(`Membro "${member.name}" excluído.`, 'info');
    } catch {
      notify('Erro ao excluir membro.', 'error');
    }
  };

  // ==========================================
  // HANDLERS: EXPORTS & RESET
  // ==========================================
  const handleExportPDF = () => {
    if (totals.totalIncluded === 0) {
      notify('Selecione ao menos um participante na chamada antes de baixar o PDF.', 'info');
      return;
    }
    const responsibleUser =
      activeCall?.activeOperatorName || activeCall?.updatedByName || user?.name || 'Responsável';
    exportAttendancePDF({
      date: selectedDate,
      callTitle: draftTitle.trim() || activeCall?.title || 'Chamada Geral',
      groups: allDepartmentGroups,
      totals,
      responsibleUserName: responsibleUser,
      call: activeCall,
    });
    notify('PDF da chamada baixado com sucesso!', 'success');
  };

  const handleExportImage = async () => {
    if (totals.totalIncluded === 0) {
      notify('Selecione ao menos um participante na chamada antes de baixar a imagem.', 'info');
      return;
    }
    try {
      setIsExportingImage(true);
      const responsibleUser =
        activeCall?.activeOperatorName || activeCall?.updatedByName || user?.name || 'Responsável';
      await exportAttendanceImage({
        date: selectedDate,
        callTitle: draftTitle.trim() || activeCall?.title || 'Chamada Geral',
        groups: allDepartmentGroups,
        totals,
        responsibleUserName: responsibleUser,
        call: activeCall,
      });
      notify('Imagem PNG da chamada baixada com sucesso!', 'success');
    } catch {
      notify('Erro ao gerar imagem da chamada.', 'error');
    } finally {
      setIsExportingImage(false);
    }
  };

  const handleBatchDownloadCredentials = async (
    targetMembers: AttendanceMember[],
    suffix: string
  ) => {
    if (targetMembers.length === 0) {
      notify('Nenhum membro encontrado para gerar credenciais.', 'info');
      return;
    }
    try {
      setIsExportingBatchPdf(true);
      await exportBatchMemberCredentialsPDF(targetMembers, departments, suffix);
      notify(`${targetMembers.length} credencial(is) exportada(s) em PDF!`, 'success');
    } catch {
      notify('Erro ao gerar PDF de credenciais.', 'error');
    } finally {
      setIsExportingBatchPdf(false);
    }
  };

  const handleResetAttendanceCall = async () => {
    if (isLockedByOther) {
      notify(`Chamada em andamento por ${activeOperatorName}. Apenas quem iniciou pode restaurar.`, 'error');
      return;
    }
    const hasMarks = !!(activeCall && Object.keys(activeCall.records || {}).length > 0);
    const hasCustomParticipants = !!(activeCall && effectiveIncludedIds.length !== members.length);
    const hasFilters =
      searchQuery.trim() !== '' || departmentFilter !== 'all' || statusFilter !== 'all';

    if (!hasMarks && !hasCustomParticipants && !hasFilters) {
      notify('A chamada deste dia já está zerada.', 'info');
      return;
    }

    const callLabel = draftTitle.trim() || activeCall?.title || 'Chamada Geral';
    if (
      !confirm(
        `Deseja restaurar a chamada "${callLabel}" (${formatAttendanceDateBR(selectedDate)}) e reiniciar do zero? Todas as marcações deste dia serão apagadas.`
      )
    ) {
      return;
    }

    try {
      setIsResettingCall(true);
      if (activeCall) {
        await api.saveAttendanceCall({
          ...activeCall,
          title: callLabel,
          includedMemberIds: members.map((m) => m.id),
          records: {},
        });
      }
      setSearchQuery('');
      setDepartmentFilter('all');
      setStatusFilter('all');
      setAbsenceTarget(null);
      setJustificationText('');
      setNoJustification(false);
      notify('Chamada restaurada e reiniciada do zero!', 'success');
    } catch (err) {
      handleLockError(err, 'Erro ao restaurar a chamada.');
    } finally {
      setIsResettingCall(false);
    }
  };

  // ==========================================
  // CALENDAR GRID COMPUTATION
  // ==========================================
  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { dateISO: string | null; dayNumber: number | null }[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ dateISO: null, dayNumber: null });
    }
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({
        dateISO: `${year}-${mStr}-${dStr}`,
        dayNumber: d,
      });
    }
    return cells;
  }, [calendarMonth]);

  const handlePrevMonth = () => {
    setCalendarMonth((prev) =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }
    );
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }
    );
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(todayISO);
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-20">
      {/* 1. Clean Top Header Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 sm:p-5 bg-neutral-900 border border-neutral-800 rounded-2xl">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
            <Building className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>IEADAM Petrópolis B</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-amber-400">
              {formatAttendanceDateBR(selectedDate)}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight flex items-center gap-2.5 mt-1">
            <ClipboardCheck className="w-6 h-6 text-amber-400 shrink-0" />
            <span>Chamada de Membros</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="min-h-[40px] flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <QrCode className="w-4 h-4" />
            <span>Leitor QR</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-red-400" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            disabled={isExportingImage}
            onClick={handleExportImage}
            className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-60 text-neutral-100 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
            <span>{isExportingImage ? 'Gerando...' : 'Imagem'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateDepartment}
            className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Nova Categoria</span>
            <span className="sm:hidden">Categoria</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddMember()}
            className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Novo Membro</span>
            <span className="sm:hidden">Membro</span>
          </button>

          <button
            type="button"
            disabled={isResettingCall || isLockedByOther}
            onClick={handleResetAttendanceCall}
            title="Restaurar e zerar marcações da chamada"
            className="min-h-[40px] flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-red-500/15 disabled:opacity-50 text-red-300 text-xs font-semibold rounded-xl border border-red-500/30 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResettingCall ? 'animate-spin' : ''}`} />
            <span>Restaurar</span>
          </button>
        </div>
      </div>

      {/* 2. Exclusive Call Lock Banner (Shows clearly who is conducting the call) */}
      <div
        className={`px-4 py-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isLockedByOther
            ? 'bg-red-950/30 border-red-500/40 text-red-100'
            : isLockedByMe
            ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-100'
            : 'bg-neutral-900 border-neutral-800 text-neutral-200'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isLockedByOther
                ? 'bg-red-500/20 text-red-400'
                : isLockedByMe
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-neutral-800 text-amber-400'
            }`}
          >
            {isLockedByOther ? (
              <Lock className="w-4 h-4" />
            ) : isLockedByMe ? (
              <UserCheck className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            {isLockedByOther ? (
              <>
                <div className="text-xs sm:text-sm font-bold text-red-200">
                  Chamada sendo realizada por {activeOperatorName}
                </div>
                <p className="text-xs text-red-300/90 mt-0.5">
                  Modo bloqueado: outro membro não pode assumir ou alterar enquanto{' '}
                  <strong>{activeOperatorName}</strong> estiver conduzindo esta chamada
                  {activeCall?.activeOperatorStartedAt
                    ? ` (iniciada às ${new Date(activeCall.activeOperatorStartedAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })})`
                    : ''}
                  .
                </p>
              </>
            ) : isLockedByMe ? (
              <>
                <div className="text-xs sm:text-sm font-bold text-emerald-200">
                  Você está realizando esta chamada ({user?.name})
                </div>
                <p className="text-xs text-emerald-300/80 mt-0.5">
                  Exclusividade ativa: outros membros veem seu nome e não podem assumir até você liberar.
                </p>
              </>
            ) : (
              <>
                <div className="text-xs sm:text-sm font-bold text-neutral-100">
                  Chamada livre para realização
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Assuma a chamada para travar em seu nome ({user?.name || 'Usuário'}) enquanto faz o registro.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {isLockedByMe && (
            <button
              type="button"
              disabled={isTogglingLock}
              onClick={handleReleaseCall}
              className="min-h-[38px] px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{isTogglingLock ? 'Liberando...' : 'Finalizar / Liberar Chamada'}</span>
            </button>
          )}

          {!activeOperatorUid && (
            <button
              type="button"
              disabled={isTogglingLock}
              onClick={handleClaimCall}
              className="min-h-[38px] px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isTogglingLock ? 'Assumindo...' : 'Assumir Chamada'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Collapsible Calendar (Mobile) + Call Session Controls */}
        <div className="lg:col-span-4 space-y-4">
          {/* Mobile Quick Date Bar (saves vertical space on phone) */}
          <div className="lg:hidden p-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <CalendarIcon className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] text-neutral-400">Data & Chamada</div>
                <div className="text-xs font-bold text-neutral-100 truncate">
                  {formatAttendanceDateBR(selectedDate)} · {draftTitle}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileCalendarOpen((v) => !v)}
              className="min-h-[38px] px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>Calendário</span>
              {mobileCalendarOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Calendar & Session Settings Container */}
          <div className={`${mobileCalendarOpen ? 'block' : 'hidden'} lg:block space-y-4`}>
            {/* Interactive Calendar Card */}
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-neutral-100">
                    {MONTHS_PT[calendarMonth.month]} {calendarMonth.year}
                  </h2>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer"
                    aria-label="Mês anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer"
                    aria-label="Próximo mês"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS_PT.map((wd) => (
                  <div key={wd} className="text-[11px] font-semibold text-neutral-500 py-1">
                    {wd}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, index) => {
                  if (!cell.dateISO || !cell.dayNumber) {
                    return <div key={`empty-${index}`} className="h-9" />;
                  }
                  const isSelected = cell.dateISO === selectedDate;
                  const isToday = cell.dateISO === todayISO;
                  const hasCall = !!datesWithCalls[cell.dateISO];

                  return (
                    <button
                      key={cell.dateISO}
                      type="button"
                      onClick={() => setSelectedDate(cell.dateISO!)}
                      className={`relative h-9 rounded-lg text-xs font-mono tabular-nums font-semibold flex flex-col items-center justify-center transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-400 text-neutral-950 font-bold'
                          : isToday
                          ? 'bg-neutral-800 text-amber-400 border border-amber-500/40'
                          : 'text-neutral-300 hover:bg-neutral-800/80'
                      }`}
                    >
                      <span>{cell.dayNumber}</span>
                      {hasCall && (
                        <span
                          className={`w-1.5 h-1 rounded-sm mt-0.5 ${
                            isSelected ? 'bg-neutral-950' : 'bg-emerald-400'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                <span>Dia selecionado:</span>
                <span className="font-mono tabular-nums font-bold text-amber-400">
                  {formatAttendanceDateBR(selectedDate)}
                </span>
              </div>
            </div>

            {/* Call Session & Participants Selector Card */}
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-neutral-200">
                    Chamada do Dia
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCallTitle('');
                      setIsNewCallModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nova neste dia</span>
                  </button>
                </div>

                {callsForSelectedDate.length > 1 && (
                  <select
                    value={selectedCallId || ''}
                    onChange={(e) => {
                      const found = callsForSelectedDate.find((c) => c.id === e.target.value);
                      if (found) {
                        setSelectedCallId(found.id);
                        setDraftTitle(found.title);
                      }
                    }}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                  >
                    {callsForSelectedDate.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({Object.keys(c.records || {}).length} marcados)
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled={isLockedByOther}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Ex: Culto de Domingo, Ensaio..."
                    className="flex-1 min-w-0 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={isLockedByOther}
                    onClick={handleSaveCallTitle}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors cursor-pointer shrink-0"
                  >
                    Salvar
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Participantes selecionados:</span>
                  <span className="font-mono tabular-nums font-bold text-neutral-100">
                    {effectiveIncludedIds.length} / {members.length}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isLockedByOther}
                  onClick={handleOpenParticipantsModal}
                  className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-amber-400 text-xs font-bold rounded-xl border border-neutral-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Escolher Participantes da Chamada</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Telemetry Strip + Mode Switcher + Clean Roster / Credentials */}
        <div className="lg:col-span-8 space-y-4">
          {/* Hairline 4-Metric Strip + Progress Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-4 divide-x divide-neutral-800/80">
              <div className="px-2 sm:px-4 py-3 text-center sm:text-left sm:flex sm:items-baseline sm:justify-between">
                <span className="block text-[10px] sm:text-xs font-medium text-neutral-400 truncate">
                  Na Chamada
                </span>
                <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-neutral-100">
                  {totals.totalIncluded}
                </span>
              </div>

              <div className="px-2 sm:px-4 py-3 text-center sm:text-left sm:flex sm:items-baseline sm:justify-between">
                <span className="block text-[10px] sm:text-xs font-medium text-emerald-400 truncate">
                  Presentes
                </span>
                <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-emerald-400">
                  {totals.presentCount}
                </span>
              </div>

              <div className="px-2 sm:px-4 py-3 text-center sm:text-left sm:flex sm:items-baseline sm:justify-between">
                <span className="block text-[10px] sm:text-xs font-medium text-red-400 truncate">
                  Faltas
                </span>
                <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-red-400">
                  {totals.absentCount}
                </span>
              </div>

              <div className="px-2 sm:px-4 py-3 text-center sm:text-left sm:flex sm:items-baseline sm:justify-between">
                <span className="block text-[10px] sm:text-xs font-medium text-neutral-400 truncate">
                  Pendentes
                </span>
                <span className="text-lg sm:text-2xl font-bold font-mono tabular-nums text-amber-400">
                  {totals.unmarkedCount}
                </span>
              </div>
            </div>

            <div className="h-1 w-full bg-neutral-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${totals.attendancePercent}%` }}
              />
            </div>
          </div>

          {/* Workspace Mode Switcher + Search/Filters */}
          <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Segmented Workspace Mode Switcher */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-xl shrink-0">
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('chamada')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    workspaceTab === 'chamada'
                      ? 'bg-neutral-800 text-amber-400'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>Lista de Chamada</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('credenciais')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    workspaceTab === 'credenciais'
                      ? 'bg-neutral-800 text-emerald-400'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <IdCard className="w-3.5 h-3.5" />
                  <span>Credenciais QR ({members.length})</span>
                </button>
              </div>

              {workspaceTab === 'credenciais' && (
                <button
                  type="button"
                  disabled={isExportingBatchPdf || members.length === 0}
                  onClick={() => {
                    const listToExport =
                      departmentFilter === 'all'
                        ? members
                        : members.filter((m) => m.departmentId === departmentFilter);
                    const deptName =
                      departmentFilter === 'all'
                        ? 'todos'
                        : deptMap.get(departmentFilter)?.name || 'grupo';
                    handleBatchDownloadCredentials(listToExport, deptName);
                  }}
                  className="min-h-[38px] px-3.5 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isExportingBatchPdf
                      ? 'Gerando Lote...'
                      : departmentFilter === 'all'
                      ? 'Baixar Todas Credenciais (PDF)'
                      : 'Baixar Credenciais do Grupo (PDF)'}
                  </span>
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nome, código PTB-MEM ou categoria..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 focus:outline-none focus:border-amber-400"
              >
                <option value="all">Todas as Categorias</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              {workspaceTab === 'chamada' && (
                <div className="flex items-center gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-xl overflow-x-auto">
                  {(
                    [
                      { id: 'all', label: 'Todos' },
                      { id: 'presente', label: 'Presentes' },
                      { id: 'falta', label: 'Faltas' },
                      { id: 'pendente', label: 'Pendentes' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        statusFilter === tab.id
                          ? 'bg-neutral-800 text-amber-400'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CONTENT AREA */}
          {loading ? (
            <div className="p-10 text-center bg-neutral-900 border border-neutral-800 rounded-2xl text-xs text-neutral-400">
              Carregando departamentos e membros...
            </div>
          ) : departments.length === 0 ? (
            <div className="p-10 text-center bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3">
              <Users className="w-10 h-10 text-neutral-600 mx-auto" />
              <h3 className="text-sm font-bold text-neutral-200">Nenhum departamento cadastrado</h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Adicione departamentos, ministérios ou equipes para começar a fazer chamadas ou restaure a lista inicial da igreja.
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleOpenCreateDepartment}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl cursor-pointer"
                >
                  + Nova Categoria
                </button>
                <button
                  type="button"
                  onClick={() => api.ensureInitialAttendanceRoster(true)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restaurar Lista Inicial</span>
                </button>
              </div>
            </div>
          ) : workspaceTab === 'credenciais' ? (
            /* ======================================================== */
            /* TAB 2: CREDENCIAIS & QR CODES DOS MEMBROS                */
            /* ======================================================== */
            <div className="space-y-4">
              {credentialDirectoryGroups.every((g) => g.members.length === 0) ? (
                <div className="p-10 text-center bg-neutral-900 border border-neutral-800 rounded-2xl text-xs text-neutral-400">
                  Nenhum membro encontrado com esta busca.
                </div>
              ) : (
                credentialDirectoryGroups.map((group) => {
                  if (group.members.length === 0) return null;
                  return (
                    <section
                      key={group.department.id}
                      className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-neutral-950/70 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="text-sm font-bold text-neutral-100 truncate">
                            {group.department.name}
                          </h3>
                          <span className="text-[11px] text-neutral-400">
                            · {KIND_LABELS[group.department.kind]} · {group.members.length} membro(s)
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={isExportingBatchPdf}
                          onClick={() =>
                            handleBatchDownloadCredentials(group.members, group.department.name)
                          }
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-xs font-semibold rounded-lg border border-neutral-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar PDF do Grupo</span>
                        </button>
                      </div>

                      <div className="divide-y divide-neutral-800/70">
                        {group.members.map((member) => {
                          const code = getMemberCredentialCode(member);
                          return (
                            <div
                              key={member.id}
                              className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-800/30 transition-colors"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-100 truncate">
                                  {member.name}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5 flex-wrap">
                                  <span className="font-mono text-amber-400/90 font-semibold">
                                    {code}
                                  </span>
                                  {member.roleTitle && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>{member.roleTitle}</span>
                                    </>
                                  )}
                                  {member.phone && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono">{member.phone}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setCredentialTarget(member)}
                                  className="min-h-[36px] px-3 py-1.5 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>Ver Credencial</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    await exportMemberCredentialPDF(member, group.department);
                                    notify(`Credencial PDF de ${member.name} baixada!`, 'success');
                                  }}
                                  className="min-h-[36px] px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>PDF</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditMember(member)}
                                  className="min-h-[36px] min-w-[36px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-amber-400 rounded-xl border border-neutral-700 flex items-center justify-center cursor-pointer"
                                  title="Editar dados da credencial"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          ) : filteredGroups.every((g) => g.members.length === 0) ? (
            /* Empty state for Lista de Chamada */
            <div className="p-10 text-center bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3">
              <Users className="w-9 h-9 text-neutral-600 mx-auto" />
              <div className="text-sm font-semibold text-neutral-300">
                Nenhum membro exibido com os filtros ou seleção atual
              </div>
              <p className="text-xs text-neutral-400">
                Ajuste os filtros acima ou clique em "Escolher Participantes da Chamada".
              </p>
              <div className="flex items-center justify-center gap-2">
                {!isLockedByOther && (
                  <button
                    type="button"
                    onClick={handleOpenParticipantsModal}
                    className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-xs font-semibold rounded-xl border border-neutral-700 cursor-pointer"
                  >
                    Escolher Participantes
                  </button>
                )}
                {(searchQuery || departmentFilter !== 'all' || statusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setDepartmentFilter('all');
                      setStatusFilter('all');
                    }}
                    className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* TAB 1: LISTA DE CHAMADA ORGANIZADA                       */
            /* ======================================================== */
            <div className="space-y-4">
              {filteredGroups.map((group) => {
                const totalMembersInDept = members.filter(
                  (m) => m.departmentId === group.department.id
                ).length;
                if (
                  group.members.length === 0 &&
                  (searchQuery.trim() !== '' || statusFilter !== 'all' || totalMembersInDept > 0)
                ) {
                  return null;
                }

                return (
                  <section
                    key={group.department.id}
                    className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden"
                  >
                    {/* Department Header */}
                    <div className="px-4 py-3 bg-neutral-950/70 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-neutral-100">
                            {group.department.name}
                          </h3>
                          <span className="text-[11px] text-neutral-400">
                            · {KIND_LABELS[group.department.kind]}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-400 font-mono tabular-nums mt-0.5 flex items-center gap-2">
                          <span className="text-emerald-400 font-semibold">
                            {group.presentCount} presença(s)
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-red-400 font-semibold">
                            {group.absentCount} falta(s)
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{group.members.length} na chamada</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenAddMember(group.department.id)}
                          className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg border border-neutral-700 flex items-center gap-1 transition-colors cursor-pointer"
                          title={`Adicionar membro em ${group.department.name}`}
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-400" />
                          <span>Membro</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditDepartment(group.department)}
                          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-amber-400 rounded-lg border border-neutral-700 transition-colors cursor-pointer"
                          title={`Editar ${group.department.name}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteDepartment(group.department)}
                          className="p-1.5 bg-neutral-800 hover:bg-red-950/60 text-neutral-400 hover:text-red-400 rounded-lg border border-neutral-700 hover:border-red-500/40 transition-colors cursor-pointer"
                          title={`Excluir ${group.department.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Member Rows */}
                    {group.members.length === 0 ? (
                      <div className="p-6 text-center text-xs text-neutral-500">
                        Nenhum membro cadastrado neste grupo. Clique em "+ Membro" acima para adicionar.
                      </div>
                    ) : (
                      <div className="divide-y divide-neutral-800/70">
                        {group.members.map(({ member, entry }) => {
                          const isPresent = entry?.status === 'presente';
                          const isAbsent = entry?.status === 'falta';
                          const menuOpen = openMenuMemberId === member.id;
                          const justificationDisplay = entry?.noJustification
                            ? 'Não apresentou justificativa'
                            : entry?.justification || 'Não apresentou justificativa';

                          return (
                            <div
                              key={member.id}
                              className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                                isAbsent
                                  ? 'bg-red-950/20'
                                  : isPresent
                                  ? 'bg-emerald-950/10'
                                  : 'hover:bg-neutral-800/30'
                              }`}
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`text-sm font-semibold ${
                                      isAbsent ? 'text-red-300' : 'text-neutral-100'
                                    }`}
                                  >
                                    {member.name}
                                  </span>

                                  <span className="text-[11px] font-mono text-neutral-500">
                                    {getMemberCredentialCode(member)}
                                  </span>

                                  {entry?.markedByName && (
                                    <span className="text-[11px] text-neutral-400">
                                      · por <strong className="text-neutral-300">{entry.markedByName}</strong>
                                    </span>
                                  )}
                                </div>

                                {isAbsent && (
                                  <div className="flex items-center gap-2 flex-wrap text-xs text-red-300">
                                    <span>
                                      <strong>Justificativa:</strong> {justificationDisplay}
                                    </span>
                                    {!isLockedByOther && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenAbsenceModal(member, group.department, entry)
                                        }
                                        className="text-[11px] text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                        <span>Editar</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Clean Primary Touch Controls + Credential + More Menu */}
                              <div className="flex items-center gap-1.5 shrink-0 relative">
                                <button
                                  type="button"
                                  disabled={isLockedByOther}
                                  onClick={() => handleMarkPresent(member, group.department)}
                                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${
                                    isPresent
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-neutral-800 hover:bg-emerald-600/20 text-neutral-300 hover:text-emerald-300 border border-neutral-700'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Presente</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isLockedByOther}
                                  onClick={() =>
                                    handleOpenAbsenceModal(member, group.department, entry)
                                  }
                                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap ${
                                    isAbsent
                                      ? 'bg-red-600 text-white'
                                      : 'bg-neutral-800 hover:bg-red-600/20 text-neutral-300 hover:text-red-300 border border-neutral-700'
                                  }`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Falta</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setCredentialTarget(member)}
                                  className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 bg-neutral-800 hover:bg-amber-400/15 text-amber-400 rounded-xl border border-neutral-700 flex items-center justify-center gap-1 text-xs font-semibold transition-colors cursor-pointer"
                                  title={`Abrir credencial QR de ${member.name}`}
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenMenuMemberId((prev) =>
                                      prev === member.id ? null : member.id
                                    )
                                  }
                                  className="min-h-[38px] min-w-[38px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-100 rounded-xl border border-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Mais ações"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>

                                {menuOpen && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={() => setOpenMenuMemberId(null)}
                                      aria-hidden="true"
                                    />
                                    <div className="absolute right-0 top-11 z-20 w-48 bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl p-1.5 space-y-0.5">
                                      {(isPresent || isAbsent) && !isLockedByOther && (
                                        <button
                                          type="button"
                                          onClick={() => handleClearMemberMark(member.id)}
                                          className="w-full px-3 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800 rounded-lg flex items-center gap-2 cursor-pointer"
                                        >
                                          <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
                                          <span>Limpar marcação</span>
                                        </button>
                                      )}
                                      {!isLockedByOther && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveMemberFromCall(member)}
                                          className="w-full px-3 py-2 text-left text-xs text-amber-300 hover:bg-neutral-800 rounded-lg flex items-center gap-2 cursor-pointer"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                          <span>Retirar desta chamada</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditMember(member)}
                                        className="w-full px-3 py-2 text-left text-xs text-neutral-200 hover:bg-neutral-800 rounded-lg flex items-center gap-2 cursor-pointer"
                                      >
                                        <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Editar membro / QR</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMember(member)}
                                        className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-950/50 rounded-lg flex items-center gap-2 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Excluir membro</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: FALTA & JUSTIFICATIVA                           */}
      {/* ======================================================== */}
      {absenceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-100">Registrar Falta</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {absenceTarget.member.name} · {absenceTarget.department.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbsenceTarget(null)}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAbsence} className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-200">
                  Motivo / Justificativa da Falta
                </label>
                <textarea
                  rows={3}
                  disabled={noJustification}
                  value={justificationText}
                  onChange={(e) => setJustificationText(e.target.value)}
                  placeholder="Descreva o porquê da falta (ex: trabalho, saúde, viagem...)"
                  className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-red-400 disabled:opacity-40"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 bg-neutral-950 border border-neutral-800 rounded-xl cursor-pointer hover:border-neutral-700">
                <input
                  type="checkbox"
                  checked={noJustification}
                  onChange={(e) => setNoJustification(e.target.checked)}
                  className="w-4 h-4 rounded accent-red-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-neutral-200">
                  Não apresentou justificativa
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAbsenceTarget(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Confirmar Falta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ESCOLHER PARTICIPANTES DA CHAMADA               */}
      {/* ======================================================== */}
      {isParticipantsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-100">
                  Participantes da Chamada ({formatAttendanceDateBR(selectedDate)})
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Marque os departamentos ou membros específicos desta chamada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsParticipantsModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  placeholder="Filtrar membro..."
                  className="w-full pl-9 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTempIncludedIds(members.map((m) => m.id))}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => setTempIncludedIds([])}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {departments.map((dept) => {
                const deptMembers = members.filter((m) => m.departmentId === dept.id);
                const visibleMembers = participantSearch.trim()
                  ? deptMembers.filter((m) =>
                      m.name.toLowerCase().includes(participantSearch.trim().toLowerCase())
                    )
                  : deptMembers;

                if (visibleMembers.length === 0) return null;

                const selectedInDept = deptMembers.filter((m) =>
                  tempIncludedIds.includes(m.id)
                ).length;
                const allDeptSelected =
                  deptMembers.length > 0 && selectedInDept === deptMembers.length;

                return (
                  <div key={dept.id} className="border border-neutral-800 rounded-xl overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-neutral-950 flex items-center justify-between">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allDeptSelected}
                          onChange={() => handleToggleTempDepartment(dept.id)}
                          className="w-4 h-4 rounded accent-amber-400 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-neutral-100">{dept.name}</span>
                        <span className="text-[11px] text-neutral-400">
                          · {KIND_LABELS[dept.kind]}
                        </span>
                      </label>
                      <span className="text-[11px] font-mono tabular-nums text-amber-400">
                        {selectedInDept}/{deptMembers.length}
                      </span>
                    </div>

                    <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-neutral-900">
                      {visibleMembers.map((m) => {
                        const checked = tempIncludedIds.includes(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'bg-amber-500/10 text-neutral-100 border border-amber-500/30'
                                : 'bg-neutral-950/60 text-neutral-400 border border-transparent hover:bg-neutral-800/60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleTempMember(m.id)}
                              className="w-3.5 h-3.5 rounded accent-amber-400 cursor-pointer"
                            />
                            <span className="truncate">{m.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-4 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-mono tabular-nums">
                Selecionados: <strong className="text-amber-400">{tempIncludedIds.length}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsParticipantsModalOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveParticipants}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Confirmar Lista
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CRIAR / EDITAR CATEGORIA                        */}
      {/* ======================================================== */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-100">
                {editingDeptId
                  ? 'Editar Categoria / Departamento / Equipe'
                  : 'Nova Categoria, Departamento ou Equipe'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsDeptModalOpen(false);
                  setEditingDeptId(null);
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-200">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'departamento', label: 'Departamento' },
                      { id: 'ministerio', label: 'Ministério' },
                      { id: 'equipe', label: 'Equipe' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setNewDeptKind(item.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        newDeptKind === item.id
                          ? 'bg-amber-400 text-neutral-950 border-amber-400 font-bold'
                          : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-200">
                  Nome da Categoria / Grupo
                </label>
                <input
                  type="text"
                  required
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="Ex: Recepção, Mídia, Ministério Infantil..."
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeptModalOpen(false);
                    setEditingDeptId(null);
                  }}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingDept}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-neutral-950 text-xs font-bold rounded-xl cursor-pointer"
                >
                  {isSavingDept ? 'Salvando...' : editingDeptId ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: ADICIONAR / EDITAR MEMBRO + DADOS DA CREDENCIAL */}
      {/* ======================================================== */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-neutral-100">
                  {editingMemberId ? 'Editar Membro & Credencial' : 'Novo Membro com Credencial QR'}
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  A credencial QR é gerada automaticamente com os dados preenchidos abaixo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMemberModalOpen(false);
                  setEditingMemberId(null);
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-200">
                    Nome do Membro *
                  </label>
                  <input
                    type="text"
                    required
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Ex: Líder Marcos, Ana Paula..."
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-200">
                    Categoria (Depto / Equipe) *
                  </label>
                  <select
                    required
                    value={newMemberDeptId}
                    onChange={(e) => setNewMemberDeptId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({KIND_LABELS[d.kind]})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-200">
                    Função / Cargo
                  </label>
                  <input
                    type="text"
                    value={newMemberRoleTitle}
                    onChange={(e) => setNewMemberRoleTitle(e.target.value)}
                    placeholder="Ex: Diácono, Líder, Vocal..."
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-200">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={newMemberPhone}
                    onChange={(e) => setNewMemberPhone(e.target.value)}
                    placeholder="(92) 99999-9999"
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-200">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="membro@email.com"
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-200">
                    Congregação
                  </label>
                  <input
                    type="text"
                    value={newMemberCongregation}
                    onChange={(e) => setNewMemberCongregation(e.target.value)}
                    placeholder="IEADAM Petrópolis B"
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-200">
                    Área / Setor
                  </label>
                  <input
                    type="text"
                    value={newMemberArea}
                    onChange={(e) => setNewMemberArea(e.target.value)}
                    placeholder="Ex: Sede, Área 1..."
                    className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMemberModalOpen(false);
                    setEditingMemberId(null);
                  }}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingMember}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-neutral-950 text-xs font-bold rounded-xl cursor-pointer"
                >
                  {isSavingMember
                    ? 'Salvando...'
                    : editingMemberId
                    ? 'Salvar Alterações'
                    : 'Adicionar Membro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: CRIAR NOVA CHAMADA EXTRA NO MESMO DIA           */}
      {/* ======================================================== */}
      {isNewCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-100">
                Nova Chamada em {formatAttendanceDateBR(selectedDate)}
              </h3>
              <button
                type="button"
                onClick={() => setIsNewCallModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExtraCallForDate} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-200">
                  Nome desta Chamada
                </label>
                <input
                  type="text"
                  required
                  value={newCallTitle}
                  onChange={(e) => setNewCallTitle(e.target.value)}
                  placeholder="Ex: Culto da Noite, Ensaio do Louvor..."
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCallModalOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Criar Chamada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: CREDENCIAL DIGITAL + QR CODE DO MEMBRO          */}
      {/* ======================================================== */}
      <MemberCredentialModal
        member={credentialTarget}
        department={credentialTarget ? deptMap.get(credentialTarget.departmentId) : undefined}
        onClose={() => setCredentialTarget(null)}
        onEditMember={handleOpenEditMember}
      />

      {/* ======================================================== */}
      {/* MODAL 7: LEITOR QR DE CHAMADA DE MEMBROS                 */}
      {/* ======================================================== */}
      <MemberQrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        selectedDate={selectedDate}
        callTitle={draftTitle.trim() || activeCall?.title || 'Chamada Geral'}
        activeCall={activeCall}
        buildBaseCall={() => buildBaseCall()}
        onCallUpdated={(callId) => setSelectedCallId(callId)}
        members={members}
        departments={departments}
      />
    </div>
  );
};
