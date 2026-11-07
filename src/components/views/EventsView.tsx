import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CalendarPlus,
  Download,
  Image as ImageIcon,
  Film,
  Palette,
  Music,
  FileText,
  Upload,
  Archive,
  ChevronRight,
  ArrowLeft,
  Users,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { ChurchEvent, FileRecord } from '../../types.js';
import { formatBytes, formatDate } from '../../utils/formatters.js';
import { api } from '../../services/api.js';
import { EventModal } from '../events/EventModal.js';
import { FileCard } from '../files/FileCard.js';

export const EventsView: React.FC = () => {
  const {
    events,
    refreshEvents,
    openUpload,
    selectedFileIds,
    toggleSelectFile,
    activeEventId,
    setActiveEventId,
    notify,
  } = useApp();

  const [selectedEventDetails, setSelectedEventDetails] = useState<{
    event: ChurchEvent;
    files: FileRecord[];
  } | null>(null);

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ChurchEvent | null>(null);
  const [eventMediaFilter, setEventMediaFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // Load event details if activeEventId is set
  const loadEventFiles = async (evtId: string) => {
    try {
      setLoading(true);
      const data = await api.getEvent(evtId);
      setSelectedEventDetails(data);
    } catch {
      notify('Erro ao carregar arquivos do evento', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeEventId) {
      loadEventFiles(activeEventId);
    } else {
      setSelectedEventDetails(null);
    }
  }, [activeEventId]);

  const handleDownloadFullEventZip = async (evtId: string, eventName: string) => {
    notify(`Compactando todos os arquivos de "${eventName}" em ZIP organizado...`, 'info');
    const evt = events.find((e) => e.id === evtId);
    if (evt) {
      await api.downloadEventZip(evt);
    }
  };

  const handleDeleteEvent = async (evtId: string) => {
    try {
      await api.deleteEvent(evtId);
      notify('Evento removido com sucesso', 'info');
      setActiveEventId(null);
      refreshEvents();
    } catch {
      notify('Erro ao remover evento', 'error');
    }
  };

  // Filtered files inside event
  const displayedFiles = selectedEventDetails?.files.filter((f) => {
    if (eventMediaFilter === 'all') return true;
    return f.type === eventMediaFilter;
  }) || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* View 1: Event Detail Inside */}
      {selectedEventDetails ? (
        <div className="space-y-6">
          {/* Back button & Event Header */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <button
              onClick={() => setActiveEventId(null)}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para todos os eventos</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingEvent(selectedEventDetails.event);
                  setIsEventModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>

              <button
                onClick={() => handleDeleteEvent(selectedEventDetails.event.id)}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 text-xs"
                title="Excluir evento"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Event Cover Banner & Quick Stats */}
          <div className="relative rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800">
            <div className="relative h-48 sm:h-64 w-full">
              <img
                src={selectedEventDetails.event.coverUrl}
                alt={selectedEventDetails.event.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-neutral-950 via-neutral-950/60 to-transparent" />

              {/* Banner Content */}
              <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400/90 text-neutral-950 font-bold uppercase tracking-wider text-[10px]">
                      {selectedEventDetails.event.category}
                    </span>
                    <span className="text-neutral-300 font-mono-numbers">
                      {formatDate(selectedEventDetails.event.date)}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-neutral-100">
                    {selectedEventDetails.event.name}
                  </h1>
                  <p className="text-xs text-neutral-400 max-w-xl">
                    {selectedEventDetails.event.description}
                  </p>
                  <p className="text-[11px] text-neutral-400">
                    Responsáveis: <span className="text-neutral-200">{selectedEventDetails.event.responsibles.join(', ')}</span>
                  </p>
                </div>

                {/* Main Download Complete Event Button */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openUpload(null, selectedEventDetails.event.id)}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Adicionar mídias</span>
                  </button>

                  <button
                    onClick={() =>
                      handleDownloadFullEventZip(
                        selectedEventDetails.event.id,
                        selectedEventDetails.event.name
                      )
                    }
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                  >
                    <Archive className="w-4 h-4" />
                    <span>Baixar Evento Completo (ZIP)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Media Count Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <button
              onClick={() => setEventMediaFilter(eventMediaFilter === 'photo' ? 'all' : 'photo')}
              className={`p-3 rounded-xl border text-left transition-all ${
                eventMediaFilter === 'photo'
                  ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span className="font-medium">Fotos</span>
              </div>
              <span className="text-lg font-bold font-mono-numbers">
                {selectedEventDetails.files.filter((f) => f.type === 'photo').length}
              </span>
            </button>

            <button
              onClick={() => setEventMediaFilter(eventMediaFilter === 'video' ? 'all' : 'video')}
              className={`p-3 rounded-xl border text-left transition-all ${
                eventMediaFilter === 'video'
                  ? 'bg-blue-500/15 border-blue-400 text-blue-300'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Film className="w-4 h-4 text-blue-400" />
                <span className="font-medium">Vídeos 4K</span>
              </div>
              <span className="text-lg font-bold font-mono-numbers">
                {selectedEventDetails.files.filter((f) => f.type === 'video').length}
              </span>
            </button>

            <button
              onClick={() => setEventMediaFilter(eventMediaFilter === 'art' ? 'all' : 'art')}
              className={`p-3 rounded-xl border text-left transition-all ${
                eventMediaFilter === 'art'
                  ? 'bg-purple-500/15 border-purple-400 text-purple-300'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Palette className="w-4 h-4 text-purple-400" />
                <span className="font-medium">Artes & Divulgação</span>
              </div>
              <span className="text-lg font-bold font-mono-numbers">
                {selectedEventDetails.files.filter((f) => f.type === 'art').length}
              </span>
            </button>

            <button
              onClick={() => setEventMediaFilter(eventMediaFilter === 'audio' ? 'all' : 'audio')}
              className={`p-3 rounded-xl border text-left transition-all ${
                eventMediaFilter === 'audio'
                  ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Music className="w-4 h-4 text-emerald-400" />
                <span className="font-medium">Áudios & Louvor</span>
              </div>
              <span className="text-lg font-bold font-mono-numbers">
                {selectedEventDetails.files.filter((f) => f.type === 'audio').length}
              </span>
            </button>
          </div>

          {/* Files grid */}
          <div>
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-neutral-200">
                Arquivos do Evento ({displayedFiles.length})
                {eventMediaFilter !== 'all' && (
                  <button
                    onClick={() => setEventMediaFilter('all')}
                    className="text-amber-400 ml-2 hover:underline font-normal"
                  >
                    (Limpar filtro)
                  </button>
                )}
              </span>
            </div>

            {displayedFiles.length === 0 ? (
              <div className="p-8 text-center bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 text-xs">
                Nenhum arquivo nesta categoria ainda. Envie mídias para este evento.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {displayedFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    isSelected={selectedFileIds.includes(file.id)}
                    onSelect={toggleSelectFile}
                    onRefresh={() => loadEventFiles(selectedEventDetails.event.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* View 2: All Church Events Grid */
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
            <div>
              <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                Eventos da Igreja & Coberturas de Mídia
              </h1>
              <p className="text-xs text-neutral-400 mt-0.5">
                Organização central de fotos, gravações 4K, multitracks e artes de cada culto ou conferência.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingEvent(null);
                setIsEventModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-sm transition-all"
            >
              <CalendarPlus className="w-4 h-4" />
              <span>Novo evento</span>
            </button>
          </div>

          {events.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800">
              <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-neutral-200">Nenhum evento cadastrado</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Crie o primeiro evento para organizar fotos, vídeos e artes do próximo culto de domingo.
              </p>
              <button
                onClick={() => setIsEventModalOpen(true)}
                className="mt-4 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-lg text-xs"
              >
                Cadastrar primeiro evento
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => setActiveEventId(evt.id)}
                  className="group rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div className="relative h-44 w-full overflow-hidden bg-black">
                    <img
                      src={evt.coverUrl}
                      alt={evt.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-neutral-950 via-neutral-950/30 to-transparent" />

                    <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded bg-amber-400/90 text-neutral-950 text-[10px] font-bold uppercase tracking-wider">
                      {evt.category}
                    </span>

                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                      {evt.time && (
                        <span className="px-2 py-0.5 rounded bg-amber-400 text-neutral-950 font-extrabold text-[10px] font-mono-numbers">
                          {evt.time}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-black/80 text-[11px] text-neutral-200 font-mono-numbers">
                        {formatDate(evt.date)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-semibold text-neutral-100 text-sm group-hover:text-amber-300 transition-colors line-clamp-1">
                        {evt.name}
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                        {evt.description}
                      </p>

                      {/* Event Media Inventory Breakdown */}
                      <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-neutral-800 text-[11px] text-neutral-400 font-mono-numbers">
                        <div className="flex items-center gap-1">
                          <ImageIcon className="w-3 h-3 text-amber-400" />
                          <span>{evt.stats?.photos || 0} fotos</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Film className="w-3 h-3 text-blue-400" />
                          <span>{evt.stats?.videos || 0} vídeos</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Palette className="w-3 h-3 text-purple-400" />
                          <span>{evt.stats?.arts || 0} artes</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Music className="w-3 h-3 text-emerald-400" />
                          <span>{evt.stats?.audios || 0} áudios</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-neutral-400 truncate max-w-[150px]">
                        {evt.responsibles ? evt.responsibles.join(', ') : 'Equipe de Mídia'}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadFullEventZip(evt.id, evt.name);
                        }}
                        className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-bold px-2 py-1 rounded hover:bg-neutral-800"
                        title="Baixar todo o material do evento em ZIP"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Baixar ZIP</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Event creation & editing modal */}
      <EventModal
        isOpen={isEventModalOpen}
        event={editingEvent}
        onClose={() => {
          setIsEventModalOpen(false);
          setEditingEvent(null);
        }}
        onSuccess={() => {
          refreshEvents();
          if (activeEventId) {
            loadEventFiles(activeEventId);
          }
        }}
      />
    </div>
  );
};
