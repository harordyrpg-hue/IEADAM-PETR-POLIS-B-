import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Tag, Filter, ChevronRight } from 'lucide-react';
import { ChurchProfile, ChurchPublicEvent } from '../../types.js';
import { formatDate } from '../../utils/formatters.js';

interface ChurchScheduleProps {
  profile: ChurchProfile;
  events: ChurchPublicEvent[];
}

export const ChurchSchedule: React.FC<ChurchScheduleProps> = ({ profile, events }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Extract available months from events
  const months = useMemo(() => {
    const set = new Set<string>();
    events.forEach((ev) => {
      if (ev.date && ev.date.length >= 7) {
        set.add(ev.date.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(set).sort();
  }, [events]);

  // Extract categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    events.forEach((ev) => {
      if (ev.category) set.add(ev.category);
    });
    return Array.from(set).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (selectedMonth !== 'all' && (!ev.date || !ev.date.startsWith(selectedMonth))) {
        return false;
      }
      if (selectedCategory !== 'all' && ev.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [events, selectedMonth, selectedCategory]);

  const formatMonthLabel = (yyyyMm: string) => {
    try {
      const [year, month] = yyyyMm.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } catch {
      return yyyyMm;
    }
  };

  return (
    <section id="agenda" className="py-20 md:py-28 bg-stone-900 text-stone-100 border-b border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Programação</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
            Agenda de Cultos & Eventos
          </h2>
          <p className="text-stone-400 text-sm sm:text-base leading-relaxed">
            Participe das nossas reuniões de adoração, comunhão, estudo bíblico e encontros especiais.
          </p>
        </div>

        {/* Regular Weekly Service Schedule Cards */}
        <div className="mb-16">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Nossos Cultos Semanais Regulares
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {profile.serviceTimes &&
              profile.serviceTimes.map((st) => (
                <div
                  key={st.id}
                  className="bg-stone-950/70 border border-stone-800 rounded-2xl p-6 relative overflow-hidden group hover:border-amber-500/50 transition-all shadow-md"
                >
                  <div className="w-1.5 h-full bg-amber-500 absolute top-0 left-0" />
                  <div className="pl-2">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                      {st.day} • {st.time}
                    </span>
                    <h4 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors mb-2">
                      {st.title}
                    </h4>
                    {st.description && (
                      <p className="text-xs text-stone-400 leading-relaxed">
                        {st.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Upcoming Special Events with Month & Category Filter */}
        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-amber-400" />
              Próximos Eventos & Conferências
            </h3>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {months.length > 1 && (
                <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs">
                  <span className="text-stone-400 px-2 flex items-center gap-1">
                    <Filter className="w-3 h-3" />
                    <span>Mês:</span>
                  </span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-stone-800 text-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="all">Todos os meses</option>
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {formatMonthLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {categories.length > 1 && (
                <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800 text-xs">
                  <span className="text-stone-400 px-2 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    <span>Tipo:</span>
                  </span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-stone-800 text-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="all">Todas as categorias</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center bg-stone-950/60 border border-stone-800 rounded-2xl text-stone-400 text-sm">
              Nenhum evento especial encontrado para os filtros selecionados. Nossos cultos regulares continuam nos horários normais.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="bg-stone-950 border border-stone-800 rounded-2xl overflow-hidden hover:border-amber-500/40 transition-all shadow-lg flex flex-col justify-between group"
                >
                  {ev.bannerUrl && (
                    <div className="aspect-16/9 w-full overflow-hidden bg-stone-800">
                      <img
                        src={ev.bannerUrl}
                        alt={ev.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}

                  <div className="p-6 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-semibold">
                          {ev.category}
                        </span>
                        <span className="text-[11px] text-stone-400 font-mono-numbers">
                          {formatDate(ev.date)}
                        </span>
                      </div>

                      <h4 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug group-hover:text-amber-400 transition-colors">
                        {ev.title}
                      </h4>

                      <p className="text-xs sm:text-sm text-stone-300 leading-relaxed mb-4">
                        {ev.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-stone-800 space-y-2 text-xs text-stone-400">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Horário: <strong className="text-stone-200">{ev.time}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">Local: <strong className="text-stone-200">{ev.location}</strong></span>
                      </div>
                      {ev.registrationLink && (
                        <div className="pt-2">
                          <a
                            href={ev.registrationLink}
                            target={ev.registrationLink.startsWith('http') ? '_blank' : undefined}
                            rel={ev.registrationLink.startsWith('http') ? 'noopener noreferrer' : undefined}
                            className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
                          >
                            <span>Fazer Inscrição Online</span>
                            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
