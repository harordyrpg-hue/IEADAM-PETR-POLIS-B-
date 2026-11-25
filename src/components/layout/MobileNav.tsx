import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  CalendarDays,
  FolderOpen,
  Home,
  QrCode,
  User as UserIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { ViewTab } from '../../types.js';
import { isSecretariaRole } from '../../utils/accessControl.js';

export const MobileNav: React.FC = () => {
  const {
    user,
    activeTab,
    setActiveTab,
    setActiveFolderId,
    setActiveEventId,
    setMobileMenuOpen,
  } = useApp();

  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatar]);

  const initials = (user?.name || 'PT')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const handleNavigate = (tabId: ViewTab) => {
    setActiveTab(tabId);
    if (tabId === 'files' || tabId === 'dashboard') {
      setActiveFolderId(null);
    }
    setActiveEventId(null);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isSecretaria = isSecretariaRole(user?.role);
  const isSecretariatActive =
    activeTab === 'secretariat' || activeTab === 'attendance' || activeTab === 'finances';
  const isRegistrationsActive = activeTab === 'registrations';
  const isProfileActive = activeTab === 'profile';
  const isScheduleActive = activeTab === 'schedule';
  const isDashboardActive = activeTab === 'dashboard';
  const isFilesActive = activeTab === 'files';

  if (isSecretaria) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 pointer-events-none">
        <nav
          aria-label="Navegação rápida móvel"
          className="pointer-events-auto mx-auto max-w-md grid grid-cols-3 items-center gap-1.5 rounded-2xl bg-neutral-900/95 dark:bg-neutral-950/95 backdrop-blur-xl border border-neutral-800/90 shadow-[0_12px_32px_rgba(0,0,0,0.55)] p-1.5 select-none"
        >
          <button
            type="button"
            onClick={() => handleNavigate('secretariat')}
            aria-current={isSecretariatActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 px-1 rounded-xl text-[11px] leading-none font-medium transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              isSecretariatActive
                ? 'bg-amber-500/15 text-amber-400 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <Briefcase className="w-5 h-5 shrink-0" />
            <span className="truncate max-w-full">Secretaria</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('registrations')}
            aria-current={isRegistrationsActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 px-1 rounded-xl text-[11px] leading-none font-medium transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              isRegistrationsActive
                ? 'bg-amber-500/15 text-amber-400 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <QrCode className="w-5 h-5 shrink-0" />
            <span className="truncate max-w-full">Eventos</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavigate('schedule')}
            aria-current={isScheduleActive ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 px-1 rounded-xl text-[11px] leading-none font-medium transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              isScheduleActive
                ? 'bg-amber-500/15 text-amber-400 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
            }`}
          >
            <CalendarDays className="w-5 h-5 shrink-0" />
            <span className="truncate max-w-full">Agenda</span>
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 pointer-events-none">
      <nav
        aria-label="Navegação rápida móvel"
        className="pointer-events-auto mx-auto max-w-md grid grid-cols-4 items-center gap-1.5 rounded-2xl bg-neutral-900/95 dark:bg-neutral-950/95 backdrop-blur-xl border border-neutral-800/90 shadow-[0_12px_32px_rgba(0,0,0,0.55)] p-1.5 select-none"
      >
        {/* 1. Perfil do Usuário (com foto) */}
        <button
          type="button"
          onClick={() => handleNavigate('profile')}
          aria-current={isProfileActive ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-[48px] py-1 px-1 rounded-xl text-[11px] leading-none font-medium transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
            isProfileActive
              ? 'bg-amber-500/15 text-amber-400 font-semibold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full overflow-hidden flex items-center justify-center bg-neutral-800 shrink-0 transition-transform ${
              isProfileActive
                ? 'ring-2 ring-amber-400 scale-105'
                : 'ring-1 ring-neutral-700'
            }`}
          >
            {user?.avatar && !avatarError ? (
              <img
                src={user.avatar}
                alt={user?.name || 'Perfil'}
                onError={() => setAvatarError(true)}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : initials ? (
              <span className="text-[10px] font-bold text-amber-400">{initials}</span>
            ) : (
              <UserIcon className="w-3.5 h-3.5 text-neutral-300" />
            )}
          </span>
          <span className="truncate max-w-full">Perfil</span>
        </button>

        {/* 2. Agenda */}
        <button
          type="button"
          onClick={() => handleNavigate('schedule')}
          aria-current={isScheduleActive ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 px-1 rounded-xl text-[11px] leading-none font-medium transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
            isScheduleActive
              ? 'bg-amber-500/15 text-amber-400 font-semibold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
        >
          <CalendarDays className="w-5 h-5 shrink-0" />
          <span className="truncate max-w-full">Agenda</span>
        </button>

        {/* 3. Ícone Amarelo com Casa -> Tela Inicial (Dashboard) */}
        <button
          type="button"
          onClick={() => handleNavigate('dashboard')}
          aria-current={isDashboardActive ? 'page' : undefined}
          title="Tela inicial"
          aria-label="Tela inicial"
          className="flex items-center justify-center min-h-[48px] py-0.5 px-1 rounded-xl cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <span
            className={`w-12 h-10 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 flex items-center justify-center shadow-[0_4px_14px_rgba(251,191,36,0.35)] transition-transform active:scale-95 ${
              isDashboardActive
                ? 'ring-2 ring-amber-200/90 ring-offset-2 ring-offset-neutral-900'
                : ''
            }`}
          >
            <Home className="w-5 h-5 stroke-[2.4]" />
          </span>
        </button>

        {/* 4. Arquivos */}
        <button
          type="button"
          onClick={() => handleNavigate('files')}
          aria-current={isFilesActive ? 'page' : undefined}
          className={`flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 px-1 rounded-xl text-[11px] leading-none font-medium transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
            isFilesActive
              ? 'bg-amber-500/15 text-amber-400 font-semibold'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
          }`}
        >
          <FolderOpen className="w-5 h-5 shrink-0" />
          <span className="truncate max-w-full">Arquivos</span>
        </button>
      </nav>
    </div>
  );
};

