import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
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

  // Active call selection (handles 1 or multiple calls on the same date)
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>('Chamada Geral');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'presente' | 'falta' | 'pendente'>('all');

  // Modals
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptKind, setNewDeptKind] = useState<AttendanceDepartmentKind>('departamento');
  const [isSavingDept, setIsSavingDept] = useState(false);

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberDeptId, setNewMemberDeptId] = useState('');
  const [isSavingMember, setIsSavingMember] = useState(false);

  // Participants Selector Modal ("Escolher quem estará na chamada")
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [tempIncludedIds, setTempIncludedIds] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');

  // Absence Justification Modal
  const [absenceTarget, setAbsenceTarget] = useState<{
    member: AttendanceMember;
    department: AttendanceDepartment;
    existingEntry?: AttendanceEntry;
  } | null>(null);
  const [justificationText, setJustificationText] = useState('');
  const [noJustification, setNoJustification] = useState(false);

  // New Call Title Modal (for extra call on same day)
  const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
  const [newCallTitle, setNewCallTitle] = useState('');

  const [isExportingImage, setIsExportingImage] = useState(false);

  // Seed initial roster once if empty & subscribe to real-time collections
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

  // Pick active call for selectedDate
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

  // Set of dates that already have at least 1 recorded call
  const datesWithCalls = useMemo(() => {
    const map: Record<string, number> = {};
    calls.forEach((c) => {
      map[c.date] = (map[c.date] || 0) + 1;
    });
    return map;
  }, [calls]);

  // Included member IDs for the active call (defaults to all members if no call saved yet for this day)
  const effectiveIncludedIds = useMemo(() => {
    if (activeCall) {
      const validIds = new Set(members.map((m) => m.id));
      return activeCall.includedMemberIds.filter((id) => validIds.has(id));
    }
    return members.map((m) => m.id);
  }, [activeCall, members]);

  const includedSet = useMemo(() => new Set(effectiveIncludedIds), [effectiveIncludedIds]);

  // Helper to build or update the call document on Firestore
  const buildBaseCall = (overrideId?: string, overrideTitle?: string): AttendanceCall => {
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
  };

  // Group included members by department (used for both UI and PDF/PNG export)
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

  // Overall totals for the current roll call
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

    return { totalIncluded, presentCount, absentCount, unmarkedCount };
  }, [allDepartmentGroups]);

  // Filtered groups for UI display
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allDepartmentGroups
      .filter((g) => departmentFilter === 'all' || g.department.id === departmentFilter)
      .map((g) => {
        const filteredMembers = g.members.filter(({ member, entry }) => {
          if (q && !member.name.toLowerCase().includes(q) && !g.department.name.toLowerCase().includes(q)) {
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

  // ==========================================
  // HANDLERS: MARKING PRESENCE & ABSENCE
  // ==========================================
  const handleMarkPresent = async (member: AttendanceMember, department: AttendanceDepartment) => {
    const baseCall = buildBaseCall();
    const currentEntry = baseCall.records[member.id];
    const nextRecords = { ...baseCall.records };

    if (currentEntry?.status === 'presente') {
      // Toggle off to unmarked
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
    } catch {
      notify('Erro ao registrar presença.', 'error');
    }
  };

  const handleOpenAbsenceModal = (
    member: AttendanceMember,
    department: AttendanceDepartment,
    existingEntry?: AttendanceEntry
  ) => {
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
    } catch {
      notify('Erro ao registrar falta.', 'error');
    }
  };

  const handleClearMemberMark = async (memberId: string) => {
    if (!activeCall) return;
    const nextRecords = { ...activeCall.records };
    delete nextRecords[memberId];
    try {
      await api.saveAttendanceCall({
        ...activeCall,
        records: nextRecords,
      });
    } catch {
      notify('Erro ao limpar marcação.', 'error');
    }
  };

  const handleRemoveMemberFromCall = async (member: AttendanceMember) => {
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
      notify(`${member.name} removido desta chamada.`, 'info');
    } catch {
      notify('Erro ao remover participante da chamada.', 'error');
    }
  };

  // ==========================================
  // HANDLERS: CALL TITLE & EXTRA CALL
  // ==========================================
  const handleSaveCallTitle = async () => {
    const cleanTitle = draftTitle.trim() || 'Chamada Geral';
    const baseCall = buildBaseCall();
    try {
      const saved = await api.saveAttendanceCall({
        ...baseCall,
        title: cleanTitle,
      });
      setSelectedCallId(saved.id);
      notify('Título da chamada salvo!', 'success');
    } catch {
      notify('Erro ao salvar título da chamada.', 'error');
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
    } catch {
      notify('Erro ao criar chamada.', 'error');
    }
  };

  // ==========================================
  // HANDLERS: PARTICIPANTS SELECTION MODAL
  // ==========================================
  const handleOpenParticipantsModal = () => {
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
    } catch {
      notify('Erro ao salvar participantes da chamada.', 'error');
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
        // Keep activeCall records departmentName synced
        if (activeCall) {
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
        const nextOrder = departments.length > 0 ? Math.max(...departments.map((d) => d.order || 0)) + 1 : 1;
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
    setIsMemberModalOpen(true);
  };

  const handleOpenEditMember = (member: AttendanceMember) => {
    setEditingMemberId(member.id);
    setNewMemberName(member.name);
    setNewMemberDeptId(member.departmentId);
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
        });
        // Keep activeCall record synced with updated member name & category
        if (activeCall && activeCall.records[editingMemberId]) {
          const targetDept = departments.find((d) => d.id === newMemberDeptId);
          const nextRecords = {
            ...activeCall.records,
            [editingMemberId]: {
              ...activeCall.records[editingMemberId],
              memberName: cleanName,
              departmentId: newMemberDeptId,
              departmentName: targetDept?.name || activeCall.records[editingMemberId].departmentName,
            },
          };
          await api.saveAttendanceCall({ ...activeCall, records: nextRecords });
        }
        notify(`Membro "${cleanName}" atualizado!`, 'success');
      } else {
        const created = await api.createAttendanceMember(newMemberDeptId, cleanName);
        // Automatically include newly created member in active call if one exists on selected date
        if (activeCall) {
          await api.saveAttendanceCall({
            ...activeCall,
            includedMemberIds: Array.from(new Set([...activeCall.includedMemberIds, created.id])),
          });
        }
        notify(`Membro "${created.name}" adicionado!`, 'success');
      }
      setNewMemberName('');
      setEditingMemberId(null);
      setIsMemberModalOpen(false);
    } catch {
      notify('Erro ao salvar membro.', 'error');
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleDeleteMember = async (member: AttendanceMember) => {
    if (!confirm(`Excluir o membro "${member.name}" da lista?`)) return;
    try {
      await api.deleteAttendanceMember(member.id, member.name);
      if (activeCall && (activeCall.includedMemberIds.includes(member.id) || activeCall.records[member.id])) {
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
  // HANDLERS: PDF & PNG IMAGE EXPORT
  // ==========================================
  const handleExportPDF = () => {
    if (totals.totalIncluded === 0) {
      notify('Selecione ao menos um participante na chamada antes de baixar o PDF.', 'info');
      return;
    }
    const responsibleUser = user?.name || activeCall?.updatedByName || 'Responsável';
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
      const responsibleUser = user?.name || activeCall?.updatedByName || 'Responsável';
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

  const handleSelectCalendarDate = (dateISO: string) => {
    setSelectedDate(dateISO);
  };

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
    <div className="space-y-6 pb-20">
      {/* 1. Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-neutral-900 border border-neutral-800 rounded-2xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 tracking-wide mb-1">
            <Building className="w-4 h-4" />
            <span>IEADAM Petrópolis B · Chamada de Membros</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight flex items-center gap-2.5">
            <ClipboardCheck className="w-6 h-6 text-amber-400 shrink-0" />
            <span>Presença & Faltas</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Escolha a data no calendário, defina quem estará na chamada, registre presenças ou faltas com justificativa e exporte em PDF ou Imagem.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-red-400" />
            <span>Baixar PDF</span>
          </button>

          <button
            type="button"
            disabled={isExportingImage}
            onClick={handleExportImage}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-60 text-neutral-100 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
            <span>{isExportingImage ? 'Gerando...' : 'Baixar Imagem'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateDepartment}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-xs font-semibold rounded-xl border border-amber-500/30 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Nova Categoria / Equipe</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddMember()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Novo Membro</span>
          </button>
        </div>
      </div>

      {/* 2. Main Split Layout: Calendar & Call Settings (Left) + Attendance List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Calendar + Call Controls */}
        <div className="lg:col-span-4 space-y-4">
          {/* Interactive Calendar Card */}
          <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-4">
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
                  className="px-2 py-1 text-[11px] font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer"
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

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS_PT.map((wd) => (
                <div key={wd} className="text-[11px] font-semibold text-neutral-500 py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Days grid */}
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
                    onClick={() => handleSelectCalendarDate(cell.dateISO!)}
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-200">
                  Identificação da Chamada
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNewCallTitle('');
                    setIsNewCallModalOpen(true);
                  }}
                  className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Outra chamada neste dia</span>
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
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Ex: Culto de Domingo, Ensaio..."
                  className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleSaveCallTitle}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors cursor-pointer shrink-0"
                >
                  Salvar
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Quem estará nesta chamada:</span>
                <span className="font-mono tabular-nums font-bold text-neutral-100">
                  {effectiveIncludedIds.length} / {members.length}
                </span>
              </div>

              <button
                type="button"
                onClick={handleOpenParticipantsModal}
                className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-xs font-bold rounded-xl border border-neutral-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Escolher Participantes da Chamada</span>
              </button>

              <div className="text-[11px] text-neutral-400 pt-1 space-y-1">
                <div>
                  Responsável atual: <strong className="text-neutral-200">{user?.name || 'Usuário'}</strong>
                </div>
                {activeCall?.updatedByName && (
                  <div>
                    Última alteração: <strong className="text-neutral-300">{activeCall.updatedByName}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Stats + Filters + Attendance Roster */}
        <div className="lg:col-span-8 space-y-5">
          {/* 4-Card Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
              <div className="text-[11px] font-semibold text-neutral-400">Na Chamada</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-neutral-100 mt-1">
                {totals.totalIncluded}
              </div>
            </div>

            <div className="p-4 bg-neutral-900 border border-emerald-500/30 rounded-xl">
              <div className="text-[11px] font-semibold text-emerald-400">Presenças</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                {totals.presentCount}
              </div>
            </div>

            <div className="p-4 bg-neutral-900 border border-red-500/30 rounded-xl">
              <div className="text-[11px] font-semibold text-red-400">Faltas</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-red-400 mt-1">
                {totals.absentCount}
              </div>
            </div>

            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl">
              <div className="text-[11px] font-semibold text-neutral-400">Sem Marcação</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-400 mt-1">
                {totals.unmarkedCount}
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar membro ou departamento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-400"
              >
                <option value="all">Todos os Departamentos</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-lg">
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
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      statusFilter === tab.id
                        ? 'bg-neutral-800 text-amber-400'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Departments & Members Attendance List */}
          {loading ? (
            <div className="p-10 text-center bg-neutral-900 border border-neutral-800 rounded-2xl text-xs text-neutral-400">
              Carregando departamentos e membros...
            </div>
          ) : departments.length === 0 ? (
            <div className="p-10 text-center bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3">
              <Users className="w-10 h-10 text-neutral-600 mx-auto" />
              <h3 className="text-sm font-bold text-neutral-200">Nenhum departamento cadastrado</h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Adicione departamentos, ministérios ou equipes para começar a fazer chamadas, ou restaure a lista inicial padrão da igreja.
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
          ) : filteredGroups.every((g) => g.members.length === 0) ? (
            <div className="p-10 text-center bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3">
              <Users className="w-9 h-9 text-neutral-600 mx-auto" />
              <div className="text-sm font-semibold text-neutral-300">
                Nenhum membro exibido com os filtros ou seleção atual
              </div>
              <p className="text-xs text-neutral-400">
                Ajuste os filtros acima ou clique em "Escolher Participantes da Chamada" para incluir membros neste dia.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenParticipantsModal}
                  className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-xs font-semibold rounded-xl border border-neutral-700 cursor-pointer"
                >
                  Escolher Participantes
                </button>
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
            <div className="space-y-5">
              {filteredGroups.map((group) => {
                // Hide empty groups when filtering by search/status unless department has 0 members total and no filter active
                const totalMembersInDept = members.filter((m) => m.departmentId === group.department.id).length;
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
                    <div className="px-4 py-3.5 bg-neutral-950/70 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
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
                          title={`Editar categoria ${group.department.name}`}
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
                          const justificationDisplay =
                            entry?.noJustification
                              ? 'Não apresentou justificativa'
                              : entry?.justification || 'Não apresentou justificativa';

                          return (
                            <div
                              key={member.id}
                              className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
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

                                  {entry?.markedByName && (
                                    <span className="text-[11px] text-neutral-400">
                                      · Marcado por <strong className="text-neutral-300">{entry.markedByName}</strong>
                                    </span>
                                  )}
                                </div>

                                {isAbsent && (
                                  <div className="flex items-center gap-2 flex-wrap text-xs text-red-300">
                                    <span>
                                      <strong>Justificativa:</strong> {justificationDisplay}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenAbsenceModal(member, group.department, entry)}
                                      className="text-[11px] text-amber-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Editar</span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleMarkPresent(member, group.department)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
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
                                  onClick={() => handleOpenAbsenceModal(member, group.department, entry)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                    isAbsent
                                      ? 'bg-red-600 text-white'
                                      : 'bg-neutral-800 hover:bg-red-600/20 text-neutral-300 hover:text-red-300 border border-neutral-700'
                                  }`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Falta</span>
                                </button>

                                {(isPresent || isAbsent) && (
                                  <button
                                    type="button"
                                    onClick={() => handleClearMemberMark(member.id)}
                                    className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                                    title="Limpar marcação de hoje"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRemoveMemberFromCall(member)}
                                  className="px-2 py-1.5 text-[11px] text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                                  title="Retirar apenas da chamada deste dia"
                                >
                                  Retirar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditMember(member)}
                                  className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                                  title={`Editar membro ${member.name} ou mudar categoria`}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(member)}
                                  className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                                  title={`Excluir membro ${member.name} permanentemente`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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
      {/* MODAL 1: FALTA & JUSTIFICATIVA OBRIGATÓRIA               */}
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
                  placeholder="Descreva o porquê da falta (ex: trabalho, motivo de saúde, viagem...)"
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
                  Escolher Quem Estará na Chamada ({formatAttendanceDateBR(selectedDate)})
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Marque os departamentos ou membros específicos que participarão desta chamada.
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

                const selectedInDept = deptMembers.filter((m) => tempIncludedIds.includes(m.id)).length;
                const allDeptSelected = deptMembers.length > 0 && selectedInDept === deptMembers.length;

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
                  Confirmar Lista da Chamada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CRIAR / EDITAR CATEGORIA (DEPTO/MINISTÉRIO/EQUIPE) */}
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
      {/* MODAL 4: ADICIONAR / EDITAR MEMBRO                       */}
      {/* ======================================================== */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-100">
                {editingMemberId ? 'Editar Membro' : 'Acrescentar Membro'}
              </h3>
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

            <form onSubmit={handleSaveMember} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-200">
                  Categoria (Departamento / Ministério / Equipe)
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
                  Nome do Membro
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
                  placeholder="Ex: Culto da Noite, Ensaio do Louvor, Reunião de Líderes..."
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
    </div>
  );
};
