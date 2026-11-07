import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  Image as ImageIcon,
  Plus,
  Clock,
  MapPin,
  Users,
  Sparkles,
  X,
  Trash2,
  Edit2,
  CalendarDays,
  CheckCircle2,
  Volume2,
  Radio,
  Tv,
  Camera,
  Film,
  Lightbulb,
  Lock,
  Globe,
  Share2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { ChurchEvent, TeamTask, User as UserType } from '../../types.js';
import { api } from '../../services/api.js';
import { getHolidaysForYear, getHolidayForDate, HolidayItem } from '../../utils/holidays.js';
import { exportMonthCalendarPDF, exportDayAgendaPDF } from '../../utils/calendarPdfGenerator.js';
import { exportMonthCalendarImage, exportDayAgendaImage } from '../../utils/calendarImageGenerator.js';

const MONTH_NAMES = [
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

const WEEKDAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_NAMES_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const EVENT_CATEGORIES = [
  'Culto de Celebração',
  'Culto de Domingo',
  'Culto de Ensino',
  'Culto de Jovens',
  'Culto de Oração & Vigília',
  'Ensaio do Louvor & Mídia',
  'Reunião de Liderança',
  'Conferência / Congresso',
  'Batismo',
  'Santa Ceia do Senhor',
  'Manutenção & Montagem Técnica',
  'Ação Social & Evangelismo',
  'Outro',
];

interface ChurchCalendarViewProps {
  teamMembers?: UserType[];
}

export const ChurchCalendarView: React.FC<ChurchCalendarViewProps> = ({ teamMembers = [] }) => {
  const { user, events, teamTasks, refreshEvents, updateTeamTask, notify } = useApp();

  // Navigation state (Year & Month: 1-12)
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1-12

  // Selected day for modal
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Quick New Event form states in day modal
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formTime, setFormTime] = useState('19:30');
  const [formIsAllDay, setFormIsAllDay] = useState(false);
  const [formCategory, setFormCategory] = useState('Culto de Celebração');
  const [formLocation, setFormLocation] = useState('Templo Central');
  const [formResponsibles, setFormResponsibles] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [formIsFestive, setFormIsFestive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Role permissions
  const isAuthorized = user?.role === 'super_admin' || user?.role === 'media_admin';

  // Holidays calculation for the current year
  const allHolidaysForYear = useMemo(() => {
    return getHolidaysForYear(currentYear);
  }, [currentYear]);

  // Calendar Grid Calculation
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Sun
    const daysInCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth - 1, 0).getDate();

    const totalSlots = Math.ceil((firstDayIndex + daysInCurrentMonth) / 7) * 7;
    const cells = [];

    let curDay = 1;
    let nextMonthDay = 1;

    for (let i = 0; i < totalSlots; i++) {
      if (i < firstDayIndex) {
        // Prev month
        const prevDay = daysInPrevMonth - firstDayIndex + i + 1;
        const prevM = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevY = currentMonth === 1 ? currentYear - 1 : currentYear;
        const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(prevDay).padStart(2, '0')}`;
        cells.push({
          dayNum: prevDay,
          dateStr,
          isCurrentMonth: false,
        });
      } else if (curDay <= daysInCurrentMonth) {
        // Current month
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(curDay).padStart(2, '0')}`;
        cells.push({
          dayNum: curDay,
          dateStr,
          isCurrentMonth: true,
        });
        curDay++;
      } else {
        // Next month
        const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
        const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
        const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(nextMonthDay).padStart(2, '0')}`;
        cells.push({
          dayNum: nextMonthDay,
          dateStr,
          isCurrentMonth: false,
        });
        nextMonthDay++;
      }
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  };

  // Open modal for a date
  const openDayModal = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setIsAddingEvent(false);
    setEditingEventId(null);
    resetForm();
  };

  const resetForm = () => {
    setFormName('');
    setFormTime('19:30');
    setFormIsAllDay(false);
    setFormCategory('Culto de Celebração');
    setFormLocation('Templo Central');
    setFormResponsibles(user ? [user.name || user.email || 'Mídia'] : []);
    setFormNotes('');
    setFormIsFestive(false);
  };

  const handleStartEditEvent = (evt: ChurchEvent) => {
    setEditingEventId(evt.id);
    setFormName(evt.name);
    setFormTime(evt.time || '19:30');
    setFormIsAllDay(!evt.time);
    setFormCategory(evt.category || 'Culto de Celebração');
    setFormLocation(evt.location || 'Templo Central');
    setFormResponsibles(evt.responsibles || []);
    setFormNotes(evt.notes || evt.description || '');
    setFormIsFestive(Boolean(evt.isFestive));
    setIsAddingEvent(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !selectedDateStr) {
      notify('Preencha o título da atividade.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const timeVal = formIsAllDay ? '' : formTime;

      if (editingEventId) {
        await api.updateEvent(editingEventId, {
          name: formName.trim(),
          date: selectedDateStr,
          time: timeVal,
          location: formLocation.trim(),
          category: formCategory,
          responsibles: formResponsibles,
          description: formNotes.trim(),
          notes: formNotes.trim(),
          isFestive: formIsFestive,
        });
        notify('Horário / Culto atualizado no calendário!', 'success');
      } else {
        await api.createEvent({
          name: formName.trim(),
          date: selectedDateStr,
          time: timeVal,
          location: formLocation.trim(),
          category: formCategory,
          responsibles: formResponsibles,
          description: formNotes.trim(),
          notes: formNotes.trim(),
          isFestive: formIsFestive,
          coverUrl: '/assets/images/church_worship_stage_1790831714044.jpg',
        });
        notify('Horário / Culto adicionado ao calendário!', 'success');
      }

      await refreshEvents();
      setIsAddingEvent(false);
      setEditingEventId(null);
      resetForm();
    } catch {
      notify('Erro ao salvar no calendário.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, eventName: string) => {
    if (!confirm(`Deseja remover "${eventName}" do calendário?`)) return;
    try {
      await api.deleteEvent(eventId);
      await refreshEvents();
      notify('Evento removido do calendário.', 'info');
    } catch {
      notify('Erro ao remover evento.', 'error');
    }
  };

  // Selected day items
  const selectedDayData = useMemo(() => {
    if (!selectedDateStr) return null;
    const holiday = getHolidayForDate(selectedDateStr);
    const dayEvents = events.filter((e) => e.date === selectedDateStr);
    const dayTasks = teamTasks.filter((t) => t.dueDate === selectedDateStr);

    const [y, m, d] = selectedDateStr.split('-');
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const weekdayName = WEEKDAY_NAMES_FULL[dateObj.getDay()];
    const formattedDate = `${weekdayName}, ${parseInt(d, 10)} de ${MONTH_NAMES[parseInt(m, 10) - 1]} de ${y}`;

    return {
      dateStr: selectedDateStr,
      formattedDate,
      holiday,
      dayEvents,
      dayTasks,
    };
  }, [selectedDateStr, events, teamTasks]);

  // Total counts for current month
  const currentMonthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}-`;
  const monthEventsCount = events.filter((e) => e.date.startsWith(currentMonthPrefix)).length;
  const monthHolidaysCount = allHolidaysForYear.filter((h) => h.date.startsWith(currentMonthPrefix)).length;
  const monthTasksCount = teamTasks.filter((t) => t.dueDate && t.dueDate.startsWith(currentMonthPrefix)).length;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Header & Download Bar */}
      <div className="p-5 sm:p-6 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight">
              Calendário da Igreja & Datas Festivas
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Visível a Todos os Usuários
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">
            Feriados nacionais pré-configurados, cultos com horários específicos, anotações diárias e download completo em PDF ou Imagem.
          </p>

          {/* Quick counts */}
          <div className="flex items-center gap-4 mt-3 text-xs text-neutral-400 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>{monthHolidaysCount} feriados / festas em {MONTH_NAMES[currentMonth - 1]}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>{monthEventsCount} cultos agendados</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{monthTasksCount} escalas técnicas</span>
            </span>
          </div>
        </div>

        {/* Action Controls: Month Download Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-start lg:self-center">
          <button
            onClick={() => {
              exportMonthCalendarPDF(currentYear, currentMonth, events, teamTasks, allHolidaysForYear);
              notify(`Baixando PDF do Calendário de ${MONTH_NAMES[currentMonth - 1]} de ${currentYear}...`, 'success');
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 rounded-xl text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Baixar Calendário do Mês Completo em PDF"
          >
            <FileDown className="w-4 h-4 text-amber-400" />
            <span>Baixar Mês (PDF)</span>
          </button>

          <button
            onClick={() => {
              exportMonthCalendarImage(currentYear, currentMonth, events, teamTasks, allHolidaysForYear);
              notify(`Gerando Imagem (PNG) do Calendário de ${MONTH_NAMES[currentMonth - 1]}...`, 'success');
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-neutral-950 font-extrabold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer border border-amber-300/40"
            title="Baixar Calendário do Mês Completo em Imagem PNG (perfeito para grupos do WhatsApp)"
          >
            <ImageIcon className="w-4 h-4 fill-neutral-950" />
            <span>Baixar Mês (Imagem)</span>
          </button>
        </div>
      </div>

      {/* 2. Month Navigator Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={handleNextMonth}
            className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleToday}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Hoje
          </button>

          <div className="ml-2 font-bold text-base text-neutral-100 flex items-center gap-2">
            <span>{MONTH_NAMES[currentMonth - 1]}</span>
            <span className="text-amber-400">{currentYear}</span>
          </div>
        </div>

        {/* Month & Year Selectors */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <select
            value={currentMonth}
            onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
            className="px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={currentYear}
            onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
            className="px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {[2025, 2026, 2027, 2028, 2029].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Calendar Grid */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-neutral-800 bg-neutral-950/50">
          {WEEKDAY_NAMES_SHORT.map((day, idx) => (
            <div
              key={day}
              className={`p-2.5 sm:p-3 text-center text-xs font-bold uppercase tracking-wider ${
                idx === 0 ? 'text-amber-400' : 'text-neutral-400'
              }`}
            >
              <span className="hidden sm:inline">{WEEKDAY_NAMES_FULL[idx]}</span>
              <span className="sm:hidden">{day}</span>
            </div>
          ))}
        </div>

        {/* Day Cells Matrix */}
        <div className="grid grid-cols-7 divide-x divide-y divide-neutral-800/80 bg-neutral-950/20">
          {calendarCells.map((cell) => {
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const isToday = cell.dateStr === todayStr;
            const holiday = getHolidayForDate(cell.dateStr);
            const dayEvents = events.filter((e) => e.date === cell.dateStr);
            const dayTasks = teamTasks.filter((t) => t.dueDate === cell.dateStr);

            return (
              <div
                key={cell.dateStr}
                onClick={() => openDayModal(cell.dateStr)}
                className={`min-h-[96px] sm:min-h-[120px] p-1.5 sm:p-2.5 transition-all flex flex-col justify-between cursor-pointer group relative ${
                  !cell.isCurrentMonth
                    ? 'bg-neutral-950/50 text-neutral-600 opacity-40 hover:opacity-75'
                    : holiday
                    ? 'bg-amber-950/10 hover:bg-amber-950/20'
                    : 'bg-neutral-900/60 hover:bg-neutral-800/60'
                } ${isToday ? 'ring-1.5 ring-inset ring-amber-400 bg-amber-500/5' : ''}`}
              >
                <div>
                  {/* Top Bar inside cell: Day number + Today pill + quick add for admins */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold font-mono-numbers ${
                        isToday
                          ? 'bg-amber-400 text-neutral-950 font-black'
                          : holiday && cell.isCurrentMonth
                          ? 'text-amber-400 font-extrabold'
                          : 'text-neutral-300'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    <div className="flex items-center gap-1">
                      {isToday && (
                        <span className="hidden sm:inline text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                          Hoje
                        </span>
                      )}

                      {/* Quick + button for authorized users */}
                      {isAuthorized && cell.isCurrentMonth && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDateStr(cell.dateStr);
                            setIsAddingEvent(true);
                            setEditingEventId(null);
                            resetForm();
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-amber-300 hover:bg-neutral-800 rounded transition-all"
                          title="Adicionar culto ou horário a este dia"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Holiday / Festive Badge */}
                  {holiday && cell.isCurrentMonth && (
                    <div
                      className="mb-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300 leading-tight truncate"
                      title={holiday.name}
                    >
                      ★ {holiday.name}
                    </div>
                  )}

                  {/* Church Events with exact time */}
                  {cell.isCurrentMonth && (
                    <div className="space-y-1 mt-1">
                      {dayEvents.slice(0, 2).map((evt) => (
                        <div
                          key={evt.id}
                          className="px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/25 text-[10px] text-blue-200 font-medium truncate flex items-center gap-1"
                          title={`${evt.time ? evt.time + ' - ' : ''}${evt.name}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                          {evt.time && <span className="font-mono-numbers text-amber-300 font-bold shrink-0">{evt.time}</span>}
                          <span className="truncate">{evt.name}</span>
                        </div>
                      ))}

                      {/* Media Tasks scheduled for that day */}
                      {dayTasks.slice(0, 1).map((task) => (
                        <div
                          key={task.id}
                          className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-300 font-normal truncate flex items-center gap-1"
                          title={`${task.dueTime ? task.dueTime + ' - ' : ''}${task.title} (${task.assignedToName})`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="truncate">{task.title}</span>
                        </div>
                      ))}

                      {dayEvents.length + dayTasks.length > 3 && (
                        <span className="text-[9px] text-neutral-500 block text-right">
                          +{dayEvents.length + dayTasks.length - 3} mais
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-1" />
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL: DAY APPOINTMENTS, TIMELINE & NOTES WITH DOWNLOAD ACTIONS         */}
      {/* ========================================================================= */}
      {selectedDayData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xs select-none">
          <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-5 sm:p-6 text-neutral-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-800">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-neutral-100 capitalize">
                    {selectedDayData.formattedDate}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Agenda oficial do dia, cultos com horários, escalas de mídia e downloads.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDateStr(null)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Holiday Notice Banner if applicable */}
            {selectedDayData.holiday && (
              <div className="mt-4 p-3 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-neutral-900 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">★</span>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">
                      {selectedDayData.holiday.name}
                    </h4>
                    <p className="text-[11px] text-amber-200/80 mt-0.5">
                      {selectedDayData.holiday.description}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                  {selectedDayData.holiday.badge}
                </span>
              </div>
            )}

            {/* Day Download Bar: PDF or Image for this Day */}
            <div className="mt-4 p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-semibold text-neutral-300">
                Baixar Agenda deste Dia:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    exportDayAgendaPDF(
                      selectedDayData.dateStr,
                      selectedDayData.dayEvents,
                      selectedDayData.dayTasks,
                      selectedDayData.holiday
                    );
                    notify('Baixando PDF oficial da agenda deste dia...', 'info');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  title="Baixar em PDF a agenda deste dia"
                >
                  <FileDown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Baixar Dia (PDF)</span>
                </button>

                <button
                  onClick={() => {
                    exportDayAgendaImage(
                      selectedDayData.dateStr,
                      selectedDayData.dayEvents,
                      selectedDayData.dayTasks,
                      selectedDayData.holiday
                    );
                    notify('Gerando Card em Imagem (PNG) da agenda do dia...', 'success');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
                  title="Baixar Card em Imagem PNG deste dia (ideal para WhatsApp)"
                >
                  <ImageIcon className="w-3.5 h-3.5 fill-neutral-950" />
                  <span>Baixar Card (Imagem)</span>
                </button>
              </div>
            </div>

            {/* Existing Events & Times for this day */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                  Cultos, Horários & Eventos Agendados ({selectedDayData.dayEvents.length})
                </h4>

                {isAuthorized && !isAddingEvent && (
                  <button
                    onClick={() => {
                      setIsAddingEvent(true);
                      setEditingEventId(null);
                      resetForm();
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Horário / Culto</span>
                  </button>
                )}
              </div>

              {selectedDayData.dayEvents.length === 0 && !isAddingEvent ? (
                <div className="p-5 text-center bg-neutral-950/40 border border-neutral-800 rounded-xl">
                  <Clock className="w-6 h-6 text-neutral-600 mx-auto mb-2" />
                  <p className="text-xs text-neutral-400">
                    Nenhum culto ou horário cadastrado para este dia.
                  </p>
                  {isAuthorized && (
                    <button
                      onClick={() => setIsAddingEvent(true)}
                      className="mt-2 text-xs font-semibold text-amber-400 hover:underline inline-block cursor-pointer"
                    >
                      + Cadastrar culto ou horário específico
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedDayData.dayEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-xl flex items-start justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {evt.time ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold font-mono-numbers">
                              {evt.time}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 text-xs font-medium">
                              Dia Todo
                            </span>
                          )}

                          <h5 className="font-bold text-sm text-neutral-100">{evt.name}</h5>

                          <span className="text-[11px] text-neutral-500">· {evt.category}</span>
                        </div>

                        {evt.location && (
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                            <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{evt.location}</span>
                          </div>
                        )}

                        {evt.responsibles && evt.responsibles.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                            <Users className="w-3.5 h-3.5 text-neutral-500" />
                            <span>Escalados: {evt.responsibles.join(', ')}</span>
                          </div>
                        )}

                        {(evt.notes || evt.description) && (
                          <p className="text-xs text-neutral-400 mt-1 whitespace-pre-line bg-neutral-900/60 p-2 rounded border border-neutral-800/80">
                            {evt.notes || evt.description}
                          </p>
                        )}
                      </div>

                      {/* Authorized edit/delete actions */}
                      {isAuthorized && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEditEvent(evt)}
                            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(evt.id, evt.name)}
                            className="p-1.5 text-neutral-400 hover:text-red-400 rounded hover:bg-neutral-800"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Media Tasks Section for this day */}
            <div className="mt-5 pt-4 border-t border-neutral-800 space-y-3">
              <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                Escala da Equipe de Mídia no Dia ({selectedDayData.dayTasks.length})
              </h4>

              {selectedDayData.dayTasks.length === 0 ? (
                <p className="text-xs text-neutral-500 italic">
                  Nenhum posto de mídia individual registrado para hoje.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedDayData.dayTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {t.dueTime && (
                            <span className="font-bold text-amber-400 font-mono-numbers text-[11px]">
                              {t.dueTime}
                            </span>
                          )}
                          <span className="font-semibold text-neutral-200 truncate">{t.title}</span>
                        </div>
                        <span className="text-[11px] text-neutral-400 block truncate">
                          👤 {t.assignedToName}
                        </span>
                      </div>

                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                          t.status === 'concluido'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {t.status === 'concluido' ? 'OK' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. ADD / EDIT EVENT FORM FOR AUTHORIZED LEADERS */}
            {isAddingEvent && isAuthorized && (
              <form onSubmit={handleSaveEvent} className="mt-6 pt-5 border-t border-neutral-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{editingEventId ? 'Editar Horário / Culto' : 'Novo Horário / Culto no Calendário'}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingEvent(false);
                      setEditingEventId(null);
                    }}
                    className="text-xs text-neutral-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Título da Atividade / Culto *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Culto de Celebração, Ensaio Geral"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Categoria do Evento
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {EVENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Specific Time */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-neutral-300">
                        Horário Específico
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-neutral-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formIsAllDay}
                          onChange={(e) => setFormIsAllDay(e.target.checked)}
                          className="rounded border-neutral-700 text-amber-500 focus:ring-0"
                        />
                        <span>Dia Todo</span>
                      </label>
                    </div>
                    <input
                      type="time"
                      value={formTime}
                      disabled={formIsAllDay}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500 disabled:opacity-40"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Local / Espaço da Igreja
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Templo Central, Púlpito, Sala de Mídia"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Responsible Members */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Responsáveis / Voluntários Escalados
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {teamMembers.map((m) => {
                      const isSelected = formResponsibles.includes(m.name);
                      return (
                        <button
                          key={m.uid}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setFormResponsibles((prev) => prev.filter((r) => r !== m.name));
                            } else {
                              setFormResponsibles((prev) => [...prev, m.name]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                          }`}
                        >
                          {isSelected && '✓ '}
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes / Observações do dia */}
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Anotações, Alinhamentos & Observações do Dia
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Ex: Protocolo de transmissão ao vivo, ordem dos louvores, avisos pastorais..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Festive checkbox */}
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsFestive}
                    onChange={(e) => setFormIsFestive(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-700 text-amber-500 focus:ring-0 bg-neutral-800"
                  />
                  <span>Destacar como Culto Especial / Data Comemorativa</span>
                </label>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingEvent(false);
                      setEditingEventId(null);
                    }}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Salvando...' : editingEventId ? 'Atualizar no Calendário' : 'Salvar no Calendário'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
