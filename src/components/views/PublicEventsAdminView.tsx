import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Plus,
  Copy,
  ExternalLink,
  Download,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Eye,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
  FileText,
  Building,
  Phone,
  Mail,
  User,
  Share2,
  QrCode,
  Sparkles,
  ChevronRight,
  Shield,
  Palette,
  Image as ImageIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import {
  PublicRegistrationEvent,
  EventRegistration,
  RegistrationThemeColor,
  RegistrationCustomField,
} from '../../types.js';
import { api } from '../../services/api.js';
import { exportRegistrationTicketPDF, formatDateBR } from '../../utils/registrationTicketPdf.js';
import { jsPDF } from 'jspdf';

export const PublicEventsAdminView: React.FC = () => {
  const { user, notify } = useApp();

  const [events, setEvents] = useState<PublicRegistrationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view: 'list' or 'attendees'
  const [selectedEventForAttendees, setSelectedEventForAttendees] = useState<PublicRegistrationEvent | null>(null);
  const [attendees, setAttendees] = useState<EventRegistration[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [attendeeStatusFilter, setAttendeeStatusFilter] = useState<'all' | 'confirmada' | 'presente'>('all');

  // Event Modal (Create / Edit & Form Builder)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('19:30');
  const [location, setLocation] = useState('IEADAM Petrópolis B - Templo Central');
  const [bannerUrl, setBannerUrl] = useState('');
  const [themeColor, setThemeColor] = useState<RegistrationThemeColor>('amber');
  const [rulesAndNotes, setRulesAndNotes] = useState(
    '• Chegue com 15 a 20 minutos de antecedência.\n• Apresente seu comprovante ou QR Code na portaria.\n• Evento sujeito à lotação do espaço.'
  );
  const [maxRegistrations, setMaxRegistrations] = useState<string>('');
  const [status, setStatus] = useState<'aberto' | 'encerrado' | 'em_breve'>('aberto');

  // Standard Fields Config
  const [standardFields, setStandardFields] = useState({
    fullName: { enabled: true, required: true, label: 'Nome Completo' },
    phone: { enabled: true, required: true, label: 'Telefone / WhatsApp' },
    email: { enabled: true, required: false, label: 'E-mail' },
    church: { enabled: true, required: false, label: 'Igreja / Congregação' },
    area: { enabled: true, required: false, label: 'Área' },
    responsibleLeader: { enabled: true, required: false, label: 'Líder Responsável' },
    responsiblePastor: { enabled: true, required: false, label: 'Pastor Responsável' },
  });

  // Custom Fields
  const [customFields, setCustomFields] = useState<RegistrationCustomField[]>([]);
  const [newCustomLabel, setNewCustomLabel] = useState('');
  const [newCustomType, setNewCustomType] = useState<'text' | 'select' | 'checkbox' | 'textarea' | 'number'>('text');
  const [newCustomRequired, setNewCustomRequired] = useState(false);
  const [newCustomOptions, setNewCustomOptions] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  // Subscribe to public events list
  useEffect(() => {
    setLoading(true);
    const unsub = api.subscribePublicEvents((list) => {
      setEvents(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe to attendees when an event is selected
  useEffect(() => {
    if (!selectedEventForAttendees) {
      setAttendees([]);
      return;
    }

    setAttendeesLoading(true);
    const unsub = api.subscribeEventRegistrations(selectedEventForAttendees.id, (list) => {
      setAttendees(list);
      setAttendeesLoading(false);
    });
    return () => unsub();
  }, [selectedEventForAttendees]);

  // Copy Public Form Link to Clipboard
  const handleCopyLink = (event: PublicRegistrationEvent) => {
    const origin = window.location.origin;
    const publicUrl = `${origin}/?inscricao=${event.id}`;
    navigator.clipboard.writeText(publicUrl);
    notify('Link de inscrição copiado para a área de transferência!', 'success');
  };

  // Open Form Preview
  const handleOpenPreview = (event: PublicRegistrationEvent) => {
    const origin = window.location.origin;
    window.open(`${origin}/?inscricao=${event.id}`, '_blank');
  };

  // Open Edit Modal
  const handleOpenEdit = (event: PublicRegistrationEvent) => {
    setEditingEventId(event.id);
    setName(event.name);
    setDescription(event.description || '');
    setDate(event.date);
    setTime(event.time);
    setLocation(event.location);
    setBannerUrl(event.bannerUrl || '');
    setThemeColor(event.themeColor || 'amber');
    setRulesAndNotes(event.rulesAndNotes || '');
    setMaxRegistrations(event.maxRegistrations ? String(event.maxRegistrations) : '');
    setStatus(event.status);
    setStandardFields(
      event.standardFields || {
        fullName: { enabled: true, required: true, label: 'Nome Completo' },
        phone: { enabled: true, required: true, label: 'Telefone / WhatsApp' },
        email: { enabled: true, required: false, label: 'E-mail' },
        church: { enabled: true, required: false, label: 'Igreja / Congregação' },
        area: { enabled: true, required: false, label: 'Área' },
        responsibleLeader: { enabled: true, required: false, label: 'Líder Responsável' },
        responsiblePastor: { enabled: true, required: false, label: 'Pastor Responsável' },
      }
    );
    setCustomFields(event.customFields || []);
    setIsEventModalOpen(true);
  };

  const resetFormBuilder = () => {
    setEditingEventId(null);
    setName('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setTime('19:30');
    setLocation('IEADAM Petrópolis B - Templo Central');
    setBannerUrl('');
    setThemeColor('amber');
    setRulesAndNotes(
      '• Chegue com 15 a 20 minutos de antecedência.\n• Apresente seu comprovante ou QR Code na portaria.\n• Evento sujeito à lotação do espaço.'
    );
    setMaxRegistrations('');
    setStatus('aberto');
    setStandardFields({
      fullName: { enabled: true, required: true, label: 'Nome Completo' },
      phone: { enabled: true, required: true, label: 'Telefone / WhatsApp' },
      email: { enabled: true, required: false, label: 'E-mail' },
      church: { enabled: true, required: false, label: 'Igreja / Congregação' },
      area: { enabled: true, required: false, label: 'Área' },
      responsibleLeader: { enabled: true, required: false, label: 'Líder Responsável' },
      responsiblePastor: { enabled: true, required: false, label: 'Pastor Responsável' },
    });
    setCustomFields([]);
    setNewCustomLabel('');
    setNewCustomOptions('');
  };

  // Add custom field
  const handleAddCustomField = () => {
    if (!newCustomLabel.trim()) return;
    const newField: RegistrationCustomField = {
      id: `custom_${Date.now()}`,
      label: newCustomLabel.trim(),
      type: newCustomType,
      required: newCustomRequired,
      options:
        newCustomType === 'select'
          ? newCustomOptions
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
    };
    setCustomFields((prev) => [...prev, newField]);
    setNewCustomLabel('');
    setNewCustomOptions('');
    setNewCustomRequired(false);
  };

  // Banner Upload
  const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingBanner(true);
      notify('Enviando banner do evento...', 'info');
      const url = await api.uploadEventBanner(file);
      setBannerUrl(url);
      notify('Banner atualizado!', 'success');
    } catch {
      notify('Erro ao enviar banner.', 'error');
    } finally {
      setIsUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  // Save Event
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date || !location.trim()) {
      notify('Por favor, preencha o Nome, Data e Local do evento.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const payload: Partial<PublicRegistrationEvent> = {
        name: name.trim(),
        description: description.trim(),
        date,
        time,
        location: location.trim(),
        bannerUrl: bannerUrl.trim() || null,
        themeColor,
        rulesAndNotes: rulesAndNotes.trim(),
        maxRegistrations: maxRegistrations ? parseInt(maxRegistrations, 10) : null,
        status,
        standardFields,
        customFields,
      };

      if (editingEventId) {
        await api.updatePublicEvent(editingEventId, payload);
        notify('Evento e formulário atualizados com sucesso!', 'success');
      } else {
        await api.createPublicEvent(payload);
        notify('Evento público criado com link de inscrição pronto!', 'success');
      }

      setIsEventModalOpen(false);
      resetFormBuilder();
    } catch {
      notify('Erro ao salvar evento.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Attendees Statistics Calculations
  const stats = useMemo(() => {
    const total = attendees.length;
    const checkedIn = attendees.filter((a) => a.status === 'presente').length;

    const churchCount: Record<string, number> = {};
    const areaCount: Record<string, number> = {};

    attendees.forEach((a) => {
      const ch = a.church || 'Não informada';
      churchCount[ch] = (churchCount[ch] || 0) + 1;

      const ar = a.area || 'Geral';
      areaCount[ar] = (areaCount[ar] || 0) + 1;
    });

    const topChurches = Object.entries(churchCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topAreas = Object.entries(areaCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { total, checkedIn, topChurches, topAreas };
  }, [attendees]);

  // Filtered Attendees
  const filteredAttendees = useMemo(() => {
    return attendees.filter((a) => {
      if (attendeeStatusFilter !== 'all' && a.status !== attendeeStatusFilter) {
        return false;
      }
      if (attendeeSearch.trim()) {
        const q = attendeeSearch.toLowerCase();
        const matchName = a.fullName.toLowerCase().includes(q);
        const matchPhone = a.phone.includes(q);
        const matchChurch = a.church?.toLowerCase().includes(q);
        const matchId = a.id.toLowerCase().includes(q);
        const matchLeader = a.responsibleLeader?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchChurch && !matchId && !matchLeader) {
          return false;
        }
      }
      return true;
    });
  }, [attendees, attendeeStatusFilter, attendeeSearch]);

  // Toggle Attendee Check-In
  const handleToggleCheckIn = async (attendee: EventRegistration) => {
    const newStatus = attendee.status === 'presente' ? 'confirmada' : 'presente';
    try {
      await api.updateEventRegistration(attendee.id, {
        status: newStatus,
        checkInAt: newStatus === 'presente' ? new Date().toISOString() : null,
      });
      notify(
        newStatus === 'presente'
          ? `Check-in de ${attendee.fullName} confirmado!`
          : `Check-in de ${attendee.fullName} desmarcado.`,
        'success'
      );
    } catch {
      notify('Erro ao atualizar check-in.', 'error');
    }
  };

  // Export Attendees List to PDF
  const handleExportAttendeesPDF = () => {
    if (!selectedEventForAttendees) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const margin = 16;
    let y = 16;

    // Header bar
    doc.setFillColor(217, 119, 6);
    doc.rect(0, 0, pageWidth, 5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(23, 23, 23);
    doc.text('IEADAM PETRÓPOLIS B · PT-B MÍDIA', margin, y);

    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(115, 115, 115);
    doc.text(`LISTA OFICIAL DE PARTICIPANTES INSCRITOS — ${selectedEventForAttendees.name.toUpperCase()}`, margin, y);

    doc.setFontSize(7.5);
    doc.text(`Total: ${attendees.length} inscritos`, pageWidth - margin, y, { align: 'right' });

    y += 8;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y, pageWidth - margin, y);

    y += 8;

    // Table Header
    doc.setFillColor(24, 24, 27);
    doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(245, 158, 11);
    doc.text('#', margin + 3, y + 4.8);
    doc.text('CÓDIGO', margin + 12, y + 4.8);
    doc.text('NOME COMPLETO', margin + 35, y + 4.8);
    doc.text('TELEFONE', margin + 95, y + 4.8);
    doc.text('IGREJA / ÁREA', margin + 125, y + 4.8);
    doc.text('STATUS', margin + 165, y + 4.8);

    y += 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(31, 41, 55);

    attendees.forEach((a, index) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }

      doc.text(`${index + 1}`, margin + 3, y);
      doc.text(a.id, margin + 12, y);
      doc.text(a.fullName.substring(0, 30), margin + 35, y);
      doc.text(a.phone || '-', margin + 95, y);
      doc.text(`${a.church || 'IEADAM'} (${a.area || 'Geral'})`.substring(0, 22), margin + 125, y);
      doc.text(a.status === 'presente' ? 'PRESENTE' : 'CONFIRMADA', margin + 165, y);

      y += 6;
    });

    const cleanName = selectedEventForAttendees.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    doc.save(`inscritos_${cleanName}.pdf`);
  };

  // Export Attendees List to CSV
  const handleExportAttendeesCSV = () => {
    if (!selectedEventForAttendees) return;

    const headers = ['Código', 'Nome Completo', 'Telefone', 'Email', 'Igreja', 'Área', 'Líder', 'Pastor', 'Status', 'Data Inscrição'];
    const rows = attendees.map((a) => [
      a.id,
      `"${a.fullName.replace(/"/g, '""')}"`,
      `"${a.phone}"`,
      `"${a.email || ''}"`,
      `"${a.church || ''}"`,
      `"${a.area || ''}"`,
      `"${a.responsibleLeader || ''}"`,
      `"${a.responsiblePastor || ''}"`,
      a.status,
      a.registeredAt,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `participantes_${selectedEventForAttendees.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-950 border border-neutral-800 rounded-2xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
            <Building className="w-4 h-4" />
            IEADAM Petrópolis B · PT-B Mídia
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-amber-400" />
            Eventos Públicos com Inscrição
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Crie eventos com formulários públicos personalizáveis, links diretos para candidatos (sem login) e credenciais com QR Code.
          </p>
        </div>

        <button
          onClick={() => {
            resetFormBuilder();
            setIsEventModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 touch-manipulation cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Criar Evento & Formulário</span>
        </button>
      </div>

      {/* 2. Main View Mode: Attendees View OR Events List */}
      {selectedEventForAttendees ? (
        /* ======================================================== */
        /* ATTENDEES & STATISTICS DASHBOARD VIEW                   */
        /* ======================================================== */
        <div className="space-y-6">
          {/* Back button and title */}
          <div className="flex items-center justify-between gap-4 p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedEventForAttendees(null)}
                className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl transition-colors cursor-pointer"
                title="Voltar aos eventos"
              >
                <X className="w-4 h-4" />
              </button>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Gerenciamento de Participantes
                </span>
                <h2 className="text-lg font-bold text-neutral-100">
                  {selectedEventForAttendees.name}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyLink(selectedEventForAttendees)}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-neutral-700"
              >
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                <span>Copiar Link</span>
              </button>
              <button
                onClick={handleExportAttendeesPDF}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-neutral-700"
              >
                <Download className="w-3.5 h-3.5 text-red-400" />
                <span>Exportar PDF</span>
              </button>
              <button
                onClick={handleExportAttendeesCSV}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-neutral-700"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <div className="text-xs text-neutral-400 font-semibold mb-1">Total de Inscritos</div>
              <div className="text-3xl font-bold font-mono-numbers text-neutral-100">{stats.total}</div>
              <div className="text-[10px] text-neutral-400 mt-1">Candidatos cadastrados no link público</div>
            </div>

            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <div className="text-xs text-neutral-400 font-semibold mb-1">Check-Ins Confirmados</div>
              <div className="text-3xl font-bold font-mono-numbers text-emerald-400">{stats.checkedIn}</div>
              <div className="text-[10px] text-emerald-400/80 mt-1">
                {stats.total > 0 ? ((stats.checkedIn / stats.total) * 100).toFixed(0) : 0}% presentes no evento
              </div>
            </div>

            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <div className="text-xs text-neutral-400 font-semibold mb-1">Principais Congregações</div>
              <div className="space-y-1 mt-2">
                {stats.topChurches.slice(0, 2).map(([ch, cnt]) => (
                  <div key={ch} className="text-xs text-neutral-300 flex items-center justify-between">
                    <span className="truncate max-w-[140px]">{ch}</span>
                    <span className="font-bold font-mono-numbers text-amber-400">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <div className="text-xs text-neutral-400 font-semibold mb-1">Principais Áreas</div>
              <div className="space-y-1 mt-2">
                {stats.topAreas.slice(0, 2).map(([ar, cnt]) => (
                  <div key={ar} className="text-xs text-neutral-300 flex items-center justify-between">
                    <span className="truncate max-w-[140px]">{ar}</span>
                    <span className="font-bold font-mono-numbers text-purple-400">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Attendees Table Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nome, telefone, igreja, código..."
                value={attendeeSearch}
                onChange={(e) => setAttendeeSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setAttendeeStatusFilter('all')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  attendeeStatusFilter === 'all'
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Todos ({attendees.length})
              </button>
              <button
                onClick={() => setAttendeeStatusFilter('confirmada')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  attendeeStatusFilter === 'confirmada'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Inscritos ({attendees.filter((a) => a.status === 'confirmada').length})
              </button>
              <button
                onClick={() => setAttendeeStatusFilter('presente')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  attendeeStatusFilter === 'presente'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Presentes ({attendees.filter((a) => a.status === 'presente').length})
              </button>
            </div>
          </div>

          {/* Attendees Table */}
          {filteredAttendees.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl text-neutral-400 text-xs">
              Nenhum participante encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto bg-neutral-900 border border-neutral-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/80 border-b border-neutral-800 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Check-In</th>
                    <th className="p-3.5">Código / Nome</th>
                    <th className="p-3.5">Telefone / WhatsApp</th>
                    <th className="p-3.5">Igreja & Área</th>
                    <th className="p-3.5">Líder & Pastor</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {filteredAttendees.map((a) => {
                    const isPresent = a.status === 'presente';
                    return (
                      <tr key={a.id} className="hover:bg-neutral-850/50 transition-colors">
                        <td className="p-3.5">
                          <button
                            onClick={() => handleToggleCheckIn(a)}
                            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                              isPresent
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400'
                            }`}
                            title={isPresent ? 'Check-in confirmado' : 'Marcar check-in'}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="hidden sm:inline">{isPresent ? 'Presente' : 'Check-in'}</span>
                          </button>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-neutral-100">{a.fullName}</div>
                          <div className="text-[10px] font-mono-numbers text-amber-400">{a.id}</div>
                          {a.email && <div className="text-[10px] text-neutral-400">{a.email}</div>}
                        </td>

                        <td className="p-3.5">
                          <div className="font-mono-numbers text-neutral-200">{a.phone}</div>
                          {a.phone && (
                            <a
                              href={`https://wa.me/55${a.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-emerald-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                            >
                              <Phone className="w-2.5 h-2.5" />
                              Chamar no WhatsApp
                            </a>
                          )}
                        </td>

                        <td className="p-3.5">
                          <div className="text-neutral-200">{a.church || 'IEADAM Petrópolis B'}</div>
                          <div className="text-[10px] text-neutral-400">Área: {a.area || 'Geral'}</div>
                        </td>

                        <td className="p-3.5">
                          <div className="text-neutral-300">Líder: {a.responsibleLeader || '-'}</div>
                          <div className="text-[10px] text-neutral-400">Pastor: {a.responsiblePastor || '-'}</div>
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => exportRegistrationTicketPDF(a, selectedEventForAttendees)}
                              className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 rounded-lg transition-colors"
                              title="Baixar Credencial PDF com QR Code"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm(`Excluir inscrição de ${a.fullName}?`)) {
                                  await api.deleteEventRegistration(a.id);
                                }
                              }}
                              className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 rounded-lg transition-colors"
                              title="Excluir inscrição"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ======================================================== */
        /* EVENTS LIST VIEW                                         */
        /* ======================================================== */
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900/40 border border-neutral-800 rounded-2xl">
              <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-neutral-300 mb-1">
                Nenhum evento com inscrição cadastrado
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-4">
                Crie um evento público, personalize o formulário com dados e regras, e gere o link para compartilhar no WhatsApp da igreja.
              </p>
              <button
                onClick={() => {
                  resetFormBuilder();
                  setIsEventModalOpen(true);
                }}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs transition-colors"
              >
                + Criar Primeiro Evento
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((ev) => {
                const isOpen = ev.status === 'aberto';
                return (
                  <div
                    key={ev.id}
                    className="p-5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl transition-colors space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      {/* Banner thumbnail if exists */}
                      {ev.bannerUrl && (
                        <div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-neutral-950">
                          <img
                            src={ev.bannerUrl}
                            alt={ev.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Header badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                            isOpen
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {ev.status === 'aberto' ? 'Inscrições Abertas' : ev.status === 'em_breve' ? 'Em Breve' : 'Encerrado'}
                        </span>

                        <span className="text-[11px] text-neutral-400 font-mono-numbers flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          {formatDateBR(ev.date)} · {ev.time}
                        </span>
                      </div>

                      {/* Title & Logistics */}
                      <h3 className="font-bold text-base text-neutral-100 mb-1">{ev.name}</h3>
                      <div className="text-xs text-neutral-400 flex items-center gap-1.5 mb-2">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </div>

                      {ev.description && (
                        <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed mb-3">
                          {ev.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-3 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyLink(ev)}
                          className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors active:scale-95 touch-manipulation cursor-pointer"
                          title="Copiar link do formulário público"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Link</span>
                        </button>

                        <button
                          onClick={() => handleOpenPreview(ev)}
                          className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl transition-colors"
                          title="Visualizar formulário público como convidado"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedEventForAttendees(ev)}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-neutral-700 transition-colors cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ver Inscritos</span>
                        </button>

                        <button
                          onClick={() => handleOpenEdit(ev)}
                          className="p-2 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 rounded-xl transition-colors"
                          title="Editar evento e formulário"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={async () => {
                            if (window.confirm(`Excluir evento "${ev.name}" e todas as suas inscrições?`)) {
                              await api.deletePublicEvent(ev.id);
                            }
                          }}
                          className="p-2 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 rounded-xl transition-colors"
                          title="Excluir evento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: FORM BUILDER & EVENT CREATOR / EDITOR            */}
      {/* ======================================================== */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-6">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
              <h3 className="font-bold text-neutral-100 text-base flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                {editingEventId ? 'Editar Evento & Formulário Montável' : 'Criar Evento Público com Formulário'}
              </h3>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* SECTION 1: INFORMAÇÕES BÁSICAS DO EVENTO */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  1. Informações Básicas do Evento
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Nome do Evento *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Conferência de Jovens 2026, Congresso de Mulheres, Vigília Geral"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                        Data do Evento *
                      </label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 text-xs font-mono-numbers focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                        Horário de Início *
                      </label>
                      <input
                        type="text"
                        required
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        placeholder="Ex: 19:30 ou 18:00 às 21:30"
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Local do Evento *
                    </label>
                    <input
                      type="text"
                      required
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Ex: IEADAM Petrópolis B - Templo Central, Rua..."
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Descrição & Detalhes do Evento
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descreva a temática, preletores, tema bíblico ou detalhes do evento..."
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: ANOTAÇÕES & REGRAS DO EVENTO */}
              <div className="pt-2 border-t border-neutral-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  2. Regras e Orientações do Evento (Ficam Gravadas no QR Code & PDF)
                </h4>
                <p className="text-[11px] text-neutral-400 mb-2">
                  O participante precisará declarar ciência destas regras ao se inscrever.
                </p>
                <textarea
                  rows={3}
                  value={rulesAndNotes}
                  onChange={(e) => setRulesAndNotes(e.target.value)}
                  placeholder="Ex: Chegada com antecedência, vestimenta, orientações de estacionamento, regras de credenciamento..."
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* SECTION 3: PERSONALIZAÇÃO VISUAL (BANNER & COR DO FORMULÁRIO) */}
              <div className="pt-2 border-t border-neutral-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                  <Palette className="w-4 h-4" />
                  3. Personalização Visual do Formulário
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Theme Color Picker */}
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                      Cor Tema do Formulário
                    </label>
                    <div className="flex items-center gap-2">
                      {[
                        { id: 'amber', bg: 'bg-amber-500' },
                        { id: 'emerald', bg: 'bg-emerald-500' },
                        { id: 'blue', bg: 'bg-blue-500' },
                        { id: 'indigo', bg: 'bg-indigo-500' },
                        { id: 'rose', bg: 'bg-rose-500' },
                        { id: 'purple', bg: 'bg-purple-500' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setThemeColor(c.id as RegistrationThemeColor)}
                          className={`w-7 h-7 rounded-full ${c.bg} transition-transform ${
                            themeColor === c.id ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Banner image */}
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
                      Banner do Evento (Opcional)
                    </label>
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBannerSelect}
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={bannerUrl}
                        onChange={(e) => setBannerUrl(e.target.value)}
                        placeholder="URL da imagem ou clique em Enviar"
                        className="flex-1 px-3 py-1.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        disabled={isUploadingBanner}
                        onClick={() => bannerInputRef.current?.click()}
                        className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700"
                      >
                        {isUploadingBanner ? 'Enviando...' : 'Enviar Foto'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: FORMULÁRIO MONTÁVEL (CAMPOS PADRÃO & PERSONALIZADOS) */}
              <div className="pt-2 border-t border-neutral-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4" />
                  4. Estrutura do Formulário (Campos Editáveis)
                </h4>
                <p className="text-[11px] text-neutral-400 mb-3">
                  Ative ou desative campos padrão, personalize o rótulo de cada pergunta ou adicione novos campos conforme necessário.
                </p>

                {/* Standard Fields Toggle List */}
                <div className="space-y-2 p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                  <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Campos Padrão do Participante
                  </div>

                  {Object.entries(standardFields).map(([key, config]) => (
                    <div key={key} className="flex items-center justify-between gap-3 text-xs py-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={(e) =>
                            setStandardFields((prev) => ({
                              ...prev,
                              [key]: { ...config, enabled: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-neutral-900 border-neutral-700"
                        />
                        <span className="text-neutral-200 font-medium">{config.label}</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[11px] text-neutral-400">
                          <input
                            type="checkbox"
                            checked={config.required}
                            onChange={(e) =>
                              setStandardFields((prev) => ({
                                ...prev,
                                [key]: { ...config, required: e.target.checked },
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-0 bg-neutral-900 border-neutral-700"
                          />
                          <span>Obrigatório</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Fields List */}
                {customFields.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Campos Adicionados Personalizados ({customFields.length})
                    </div>
                    {customFields.map((f, idx) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs"
                      >
                        <div>
                          <span className="font-semibold text-neutral-200">{f.label}</span>
                          <span className="text-[10px] text-neutral-400 ml-2">
                            [{f.type}] {f.required && '· Obrigatório'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-neutral-400 hover:text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Custom Field Form */}
                <div className="p-3 bg-neutral-950/60 border border-dashed border-neutral-800 rounded-xl space-y-2.5">
                  <div className="text-[11px] font-semibold text-neutral-300">
                    + Adicionar Campo Personalizado ao Formulário
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={newCustomLabel}
                        onChange={(e) => setNewCustomLabel(e.target.value)}
                        placeholder="Nome da pergunta (ex: Tamanho da Camisa, Observação Alimentar)"
                        className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <select
                        value={newCustomType}
                        onChange={(e) => setNewCustomType(e.target.value as any)}
                        className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
                      >
                        <option value="text">Texto Curto</option>
                        <option value="textarea">Texto Longo</option>
                        <option value="select">Seleção (Dropdown)</option>
                        <option value="number">Número</option>
                        <option value="checkbox">Caixa de Seleção (Sim/Não)</option>
                      </select>
                    </div>
                  </div>

                  {newCustomType === 'select' && (
                    <input
                      type="text"
                      value={newCustomOptions}
                      onChange={(e) => setNewCustomOptions(e.target.value)}
                      placeholder="Opções separadas por vírgula (ex: P, M, G, GG)"
                      className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                    />
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCustomRequired}
                        onChange={(e) => setNewCustomRequired(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-neutral-900 border-neutral-700"
                      />
                      <span>Resposta obrigatória</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg"
                    >
                      Inserir Campo
                    </button>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-neutral-200">Status das Inscrições</div>
                  <div className="text-[11px] text-neutral-400">
                    Controle se o link público aceita novas inscrições no momento.
                  </div>
                </div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="px-3 py-1.5 bg-neutral-950 border border-neutral-700 rounded-xl text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="aberto">Inscrições Abertas</option>
                  <option value="em_breve">Em Breve</option>
                  <option value="encerrado">Inscrições Encerradas</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : editingEventId ? 'Atualizar Evento & Formulário' : 'Salvar & Gerar Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
