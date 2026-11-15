import React, { useState } from 'react';
import { Search, Menu, X, Tv, Square } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';

export const Header: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    mobileMenuOpen,
    setMobileMenuOpen,
    isTransmitting,
    toggleTransmission,
    user,
    setActiveTab,
  } = useApp();

  const [avatarError, setAvatarError] = useState(false);

  const initials = (user?.name || 'PT')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 h-16 px-3 sm:px-4 md:px-6 bg-neutral-900/95 dark:bg-neutral-950/95 backdrop-blur-md border-b border-neutral-800 text-neutral-100 transition-colors">
      {/* Left: Menu Toggle & Brand */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 -ml-1 min-w-[40px] min-h-[40px] flex items-center justify-center text-neutral-300 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer md:hidden"
          aria-label="Abrir menu lateral"
          title="Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2 cursor-pointer text-left"
          title="Ir para a tela inicial"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 font-bold text-xs tracking-wider border border-amber-500/25 shrink-0">
            PTB
          </div>
          <span className="hidden sm:inline text-sm font-semibold tracking-tight text-neutral-100 whitespace-nowrap">
            PT-B Mídia
          </span>
        </button>
      </div>

      {/* Center: Global Search */}
      <div className="flex-1 min-w-0 max-w-md mx-1 sm:mx-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar arquivos, eventos..."
            className="w-full h-10 pl-9 pr-8 text-xs sm:text-sm bg-neutral-800/80 border border-neutral-700/70 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 transition-colors truncate"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpar pesquisa"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Mobile Profile Avatar */}
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className="md:hidden w-9 h-9 rounded-full ring-1 ring-amber-500/40 hover:ring-amber-400 overflow-hidden bg-neutral-800 flex items-center justify-center transition-all cursor-pointer shrink-0"
          title="Meu perfil"
          aria-label="Abrir perfil"
        >
          {user?.avatar && !avatarError ? (
            <img
              src={user.avatar}
              alt={user?.name || 'Perfil'}
              onError={() => setAvatarError(true)}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs font-bold text-amber-400">{initials}</span>
          )}
        </button>

        {/* Desktop Screen transmission */}
        <button
          type="button"
          onClick={toggleTransmission}
          className={`hidden md:flex items-center gap-2 px-3.5 h-9 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            isTransmitting
              ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/60'
              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
          }`}
          title={
            isTransmitting
              ? 'Parar transmissão para o telão'
              : 'Transmitir tela para o telão/projetor'
          }
        >
          {isTransmitting ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Parar transmissão</span>
            </>
          ) : (
            <>
              <Tv className="w-4 h-4 text-amber-400" />
              <span>Transmitir tela</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
