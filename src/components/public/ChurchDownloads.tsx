import React, { useState } from 'react';
import { ChurchDownload } from '../../types';
import { FileText, Download, Music, BookOpen, FileCheck, Search, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';

interface ChurchDownloadsProps {
  downloads: ChurchDownload[];
}

export const ChurchDownloads: React.FC<ChurchDownloadsProps> = ({ downloads }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'Todos os Materiais' },
    { id: 'boletim', label: 'Boletins Semanais' },
    { id: 'estudo', label: 'Estudos Bíblicos' },
    { id: 'partitura', label: 'Música & Partituras' },
    { id: 'leitura', label: 'Guias de Oração & Leitura' },
  ];

  const filteredDownloads = downloads.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getFormatBadge = (format: string) => {
    const f = (format || '').toLowerCase();
    if (f.includes('pdf')) {
      return { bg: 'bg-red-950/70 text-red-300 border-red-800/60', icon: <FileText className="w-4 h-4 text-red-400" /> };
    }
    if (f.includes('audio') || f.includes('mp3') || f.includes('mus')) {
      return { bg: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60', icon: <Music className="w-4 h-4 text-emerald-400" /> };
    }
    if (f.includes('doc') || f.includes('txt')) {
      return { bg: 'bg-blue-950/70 text-blue-300 border-blue-800/60', icon: <BookOpen className="w-4 h-4 text-blue-400" /> };
    }
    return { bg: 'bg-amber-950/70 text-amber-300 border-amber-800/60', icon: <FileCheck className="w-4 h-4 text-amber-400" /> };
  };

  const handleDownload = async (item: ChurchDownload) => {
    try {
      setDownloadingId(item.id);
      await api.incrementChurchDownloadCount(item.id);
      api.triggerDownload(item.fileUrl, `${item.title}.${item.format || 'pdf'}`);
    } catch {
      window.open(item.fileUrl, '_blank');
    } finally {
      setTimeout(() => {
        setDownloadingId(null);
      }, 1000);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <section id="downloads" className="py-20 bg-stone-950 text-stone-100 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block text-amber-400 font-semibold text-sm tracking-wider uppercase bg-amber-950/60 border border-amber-800/60 px-3.5 py-1 rounded-full mb-3">
            Recursos para Edificação
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-4">
            Arquivos & Materiais para Download
          </h2>
          <p className="text-stone-300 text-base sm:text-lg">
            Acesse boletins semanais, esboços de estudos bíblicos, partituras para o ministério de louvor e materiais de apoio.
          </p>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                    : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800 hover:border-stone-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar arquivo..."
              className="w-full bg-stone-900 border border-stone-800 text-stone-200 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Files List */}
        {filteredDownloads.length === 0 ? (
          <div className="text-center py-16 bg-stone-900/40 rounded-2xl border border-stone-850 text-stone-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-500" />
            <p className="text-base font-medium">Nenhum arquivo disponível no momento.</p>
            <p className="text-sm text-stone-400 mt-1">Materiais e boletins serão postados aqui regularmente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredDownloads.map((item) => {
              const badge = getFormatBadge(item.format || 'pdf');
              const isDownloading = downloadingId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-stone-900/80 rounded-2xl border border-stone-800 p-5 hover:border-amber-500/50 transition-all duration-300 shadow-md hover:shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className={`p-2.5 rounded-xl border ${badge.bg}`}>
                        {badge.icon}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                          {item.category}
                        </span>
                        <span className="text-[11px] font-mono uppercase font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-900/60">
                          {item.format?.toUpperCase() || 'ARQUIVO'}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-semibold text-white text-base mb-1.5 line-clamp-2">
                      {item.title}
                    </h3>

                    {item.description && (
                      <p className="text-stone-300 text-xs sm:text-sm line-clamp-3 mb-4 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-stone-800/80 flex items-center justify-between mt-auto">
                    <div className="text-xs text-stone-400">
                      {item.fileSize ? (
                        <span>{formatFileSize(item.fileSize)}</span>
                      ) : (
                        <span>Disponível</span>
                      )}
                      {typeof item.downloadCount === 'number' && item.downloadCount > 0 && (
                        <span className="ml-2 pl-2 border-l border-stone-800">
                          {item.downloadCount} downloads
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleDownload(item)}
                      disabled={isDownloading}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isDownloading
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm hover:shadow-md shadow-amber-900/30'
                      }`}
                    >
                      {isDownloading ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 animate-pulse" />
                          <span>Baixando...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};
