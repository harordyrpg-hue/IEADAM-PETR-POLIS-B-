import React, { useState } from 'react';
import { Bell, Pin, Calendar, Tag, ArrowRight, X, ChevronRight } from 'lucide-react';
import { ChurchAnnouncement } from '../../types.js';
import { formatDate } from '../../utils/formatters.js';
import { SafeMarkdownRenderer } from '../../utils/safeMarkdown.js';

interface ChurchAnnouncementsProps {
  announcements: ChurchAnnouncement[];
}

export const ChurchAnnouncements: React.FC<ChurchAnnouncementsProps> = ({ announcements }) => {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<ChurchAnnouncement | null>(null);

  if (announcements.length === 0) {
    return null;
  }

  return (
    <section id="avisos" className="py-20 md:py-28 bg-stone-950 text-stone-100 border-b border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Bell className="w-3.5 h-3.5" />
            <span>Mural de Avisos</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
            Comunicados & Notícias da Igreja
          </h2>
          <p className="text-stone-400 text-sm sm:text-base leading-relaxed">
            Fique por dentro das principais orientações, avisos da semana e notas importantes para a nossa comunidade.
          </p>
        </div>

        {/* Announcements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {announcements.map((ann) => (
            <article
              key={ann.id}
              onClick={() => setSelectedAnnouncement(ann)}
              className={`rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden group ${
                ann.isPinned
                  ? 'bg-stone-900 border-amber-500/50 shadow-xl shadow-amber-950/20 hover:border-amber-400'
                  : 'bg-stone-900/60 border-stone-800 hover:border-stone-700 hover:bg-stone-900'
              }`}
            >
              {/* Optional Cover Image */}
              {ann.imageUrl && (
                <div className="aspect-16/9 w-full overflow-hidden bg-stone-800 relative">
                  <img
                    src={ann.imageUrl}
                    alt={ann.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {ann.isPinned && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-stone-950 text-[10px] font-bold shadow-md">
                      <Pin className="w-3 h-3 fill-stone-950" />
                      <span>Fixado no Topo</span>
                    </div>
                  )}
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                      <Tag className="w-3 h-3" />
                      {ann.category || 'Comunicado'}
                    </span>
                    {!ann.imageUrl && ann.isPinned && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                        <Pin className="w-3 h-3" />
                        <span>Fixado</span>
                      </span>
                    )}
                    <span className="text-[11px] text-stone-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(ann.date || ann.createdAt)}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-amber-400 transition-colors mb-2 leading-snug">
                    {ann.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-stone-300 line-clamp-3 leading-relaxed mb-4">
                    {ann.content.replace(/[#*`>-]/g, '').trim()}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between text-xs text-amber-400 font-semibold group-hover:translate-x-1 transition-transform">
                  <span>Ler comunicado completo</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Full Modal Viewer */}
      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 text-stone-100 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {selectedAnnouncement.imageUrl && (
              <div className="aspect-16/9 rounded-2xl overflow-hidden mb-6 bg-stone-800">
                <img
                  src={selectedAnnouncement.imageUrl}
                  alt={selectedAnnouncement.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-stone-400 mb-3">
              <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 font-semibold">
                {selectedAnnouncement.category}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(selectedAnnouncement.date || selectedAnnouncement.createdAt)}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-4 leading-tight">
              {selectedAnnouncement.title}
            </h3>

            <div className="text-stone-300 text-sm sm:text-base leading-relaxed space-y-3 pb-4">
              <SafeMarkdownRenderer content={selectedAnnouncement.content} />
            </div>

            <div className="pt-5 border-t border-stone-800 flex justify-end">
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
