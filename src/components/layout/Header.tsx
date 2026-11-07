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
  } = useApp();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-neutral-900/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800 text-neutral-100 transition-colors">
      {/* Zone 1: Menu Toggle & Brand & Live Realtime Indicator */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 -ml-1 text-neutral-300 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          aria-label="Abrir menu lateral"
          title="Abrir menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 font-bold text-sm tracking-wider border border-amber-500/30">
            PTB
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold tracking-tight text-neutral-100 whitespace-nowrap">
              PT-B Mídia
            </span>
          </div>
        </div>

        {/* Real-time Cloud Synchronization Badge */}
        {isRealtimeActive && (
          <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-medium select-none ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Sincronizado em tempo real</span>
            <span className="sm:hidden">Ao vivo</span>
          </div>
        )}
      </div>

      {/* Zone 2: Global Search Bar */}
      <div className="flex-1 max-w-md mx-3 sm:mx-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar fotos, vídeos, artes, pastas..."
            className="w-full pl-9 pr-8 py-1.5 text-xs md:text-sm bg-neutral-800/80 border border-neutral-700/80 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/40 transition-all"
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

      {/* Zone 3: Computer-only screen transmission control */}
      <div className="hidden md:flex items-center gap-2.5 shrink-0">
        <button
          onClick={toggleTransmission}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs ${
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
