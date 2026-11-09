import React from 'react';
import { Search, Menu, X, Activity, Tv, Square } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';

export const Header: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    mobileMenuOpen,
    setMobileMenuOpen,
    isRealtimeActive,
    isTransmitting,
    toggleTransmission,
    user,
    setActiveTab,
  } = useApp();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-neutral-900/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800 text-neutral-100 transition-colors">
      {/* Zone 1: Menu Toggle & Brand & Live Realtime Indicator */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 -ml-1 text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer md:hidden"
          aria-label="Abrir menu lateral"
          title="Abrir menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 text-amber-500 font-bold text-xs sm:text-sm tracking-wider border border-amber-500/30 shrink-0">
            PTB
          </div>
          <span className="hidden xs:inline text-sm sm:text-base font-semibold tracking-tight text-neutral-100 whitespace-nowrap">
            PT-B Mídia
          </span>
        </div>

        {/* Real-time Cloud Synchronization Badge */}
        {isRealtimeActive && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-medium select-none ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Ao vivo</span>
          </div>
        )}
      </div>

      {/* Zone 2: Global Search Bar */}
      <div className="flex-1 min-w-0 max-w-md mx-2 sm:mx-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar fotos, vídeos, artes, pastas..."
            className="w-full pl-9 pr-7 sm:pr-8 py-1.5 text-xs sm:text-sm bg-neutral-800/80 border border-neutral-700/80 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-all truncate"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Zone 3: Actions (Desktop Transmission & Mobile Profile Avatar) */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Mobile Profile Avatar Quick Button */}
        <button
          onClick={() => setActiveTab('profile')}
          className="md:hidden p-0.5 rounded-full ring-2 ring-amber-500/40 hover:ring-amber-400 transition-all cursor-pointer"
          title="Ver meu perfil e escala"
        >
          <img
            src={
              user?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'
            }
            alt={user?.name || 'Perfil'}
            className="w-7 h-7 rounded-full object-cover"
          />
        </button>

        {/* Desktop Screen transmission */}
        <button
          onClick={toggleTransmission}
          className={`hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs ${
            isTransmitting
              ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/80 shadow-rose-600/30 animate-pulse'
              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 hover:border-amber-500/50'
          }`}
          title={
            isTransmitting
              ? 'Parar de transmitir para a tela'
              : 'Transmitir tela do computador para o telão, projetor ou TV da igreja'
          }
        >
          {isTransmitting ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Parar de transmitir</span>
            </>
          ) : (
            <>
              <Tv className="w-4 h-4 text-amber-400" />
              <span>Transmitir para a tela</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
