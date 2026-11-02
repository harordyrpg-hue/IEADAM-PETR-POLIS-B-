import React, { useState, useMemo } from 'react';
import { BookOpen, Search, Calendar, User, Tag, Clock, ArrowRight, X, ChevronRight, Share2 } from 'lucide-react';
import { ChurchArticle } from '../../types.js';
import { formatDate } from '../../utils/formatters.js';
import { SafeMarkdownRenderer } from '../../utils/safeMarkdown.js';

interface ChurchDevotionalsProps {
  articles: ChurchArticle[];
}

export const ChurchDevotionals: React.FC<ChurchDevotionalsProps> = ({ articles }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeArticle, setActiveArticle] = useState<ChurchArticle | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set).sort();
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      if (selectedCategory !== 'all' && art.category !== selectedCategory) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = art.title.toLowerCase().includes(q);
        const matchSummary = art.summary.toLowerCase().includes(q);
        const matchContent = art.content.toLowerCase().includes(q);
        const matchAuthor = art.author.toLowerCase().includes(q);
        const matchTags = art.tags && art.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchSummary && !matchContent && !matchAuthor && !matchTags) {
          return false;
        }
      }
      return true;
    });
  }, [articles, selectedCategory, search]);

  return (
    <section id="devocionais" className="py-20 md:py-28 bg-stone-950 text-stone-100 border-b border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Alimento Espiritual</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
            Artigos & Devocionais Bíblicos
          </h2>
          <p className="text-stone-400 text-sm sm:text-base leading-relaxed">
            Mensagens inspiradoras, estudos das Escrituras e meditações pastorais para abençoar a sua jornada diária com Deus.
          </p>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10 max-w-4xl mx-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por tema, versículo ou palavra..."
              className="w-full pl-10 pr-4 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
              }`}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-stone-950 font-bold'
                    : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Articles List / Grid */}
        {filteredArticles.length === 0 ? (
          <div className="p-12 text-center bg-stone-900/40 border border-stone-800 rounded-2xl text-stone-400 text-sm max-w-xl mx-auto">
            Nenhum artigo ou devocional encontrado para a busca selecionada.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((art) => (
              <article
                key={art.id}
                onClick={() => setActiveArticle(art)}
                className="bg-stone-900/70 border border-stone-800 rounded-2xl overflow-hidden hover:border-amber-500/40 hover:bg-stone-900 transition-all shadow-md flex flex-col justify-between cursor-pointer group"
              >
                {art.coverImageUrl && (
                  <div className="aspect-16/9 w-full overflow-hidden bg-stone-800">
                    <img
                      src={art.coverImageUrl}
                      alt={art.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[11px] font-semibold">
                        {art.category}
                      </span>
                      <span className="text-[11px] text-stone-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(art.publishedAt || art.createdAt)}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-amber-400 transition-colors mb-2 leading-snug">
                      {art.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-stone-300 line-clamp-3 leading-relaxed mb-4">
                      {art.summary}
                    </p>
                  </div>

                  <div>
                    {art.tags && art.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {art.tags.slice(0, 3).map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] text-stone-400 bg-stone-950 px-2 py-0.5 rounded-md border border-stone-800"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-3 border-t border-stone-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-stone-400">
                        <User className="w-3.5 h-3.5 text-amber-500" />
                        <span>{art.author}</span>
                      </div>
                      <span className="text-xs text-amber-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        <span>Ler artigo</span>
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Full Reading Modal View */}
      {activeArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActiveArticle(null)}
        >
          <div
            className="w-full max-w-3xl bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-10 text-stone-100 shadow-2xl relative max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveArticle(null)}
              className="absolute top-6 right-6 p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {activeArticle.coverImageUrl && (
              <div className="aspect-21/9 sm:aspect-16/7 rounded-2xl overflow-hidden mb-6 bg-stone-800">
                <img
                  src={activeArticle.coverImageUrl}
                  alt={activeArticle.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400 mb-4">
              <span className="px-3 py-1 rounded-md bg-amber-500/15 text-amber-400 font-semibold text-xs">
                {activeArticle.category}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-stone-300">
                <User className="w-3.5 h-3.5 text-amber-500" />
                <span>{activeArticle.author}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(activeArticle.publishedAt || activeArticle.createdAt)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3.5xl font-extrabold text-white mb-4 leading-tight">
              {activeArticle.title}
            </h1>

            {activeArticle.summary && (
              <p className="text-sm sm:text-base text-amber-300/90 font-medium italic border-l-4 border-amber-500 pl-4 py-1.5 my-5 bg-amber-500/5 rounded-r">
                {activeArticle.summary}
              </p>
            )}

            {/* Article Body */}
            <div className="text-stone-200 text-sm sm:text-base leading-relaxed space-y-4 my-6 pb-6 border-b border-stone-800">
              <SafeMarkdownRenderer content={activeArticle.content} />
            </div>

            {/* Tags and Close Footer */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex flex-wrap gap-2">
                {activeArticle.tags &&
                  activeArticle.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="text-xs text-stone-400 bg-stone-950 px-2.5 py-1 rounded-lg border border-stone-800"
                    >
                      #{t}
                    </span>
                  ))}
              </div>

              <button
                onClick={() => setActiveArticle(null)}
                className="px-6 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Fechar Artigo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
