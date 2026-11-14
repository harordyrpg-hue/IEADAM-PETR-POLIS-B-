import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  FolderOpen,
  Image as ImageIcon,
  Home,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { ViewTab } from '../../types.js';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, setActiveFolderId, setActiveEventId, setMobileMenuOpen } = useApp();

  const tabs: { id: ViewTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'schedule', label: 'Agenda', icon: CalendarDays },
    { id: 'files', label: 'Arquivos', icon: FolderOpen },
    { id: 'photos', label: 'Fotos', icon: ImageIcon },
  ];

  const handleNavigate = (tabId: ViewTab) => {
    setActiveTab(tabId);
    if (tabId === 'files' || tabId === 'dashboard') {
      setActiveFolderId(null);
    }
    setActiveEventId(null);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isDashboardActive = activeTab === 'dashboard';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-neutral-900/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-neutral-800 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around text-neutral-400 shadow-2xl select-none">
      {tabs.slice(0, 2).map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleNavigate(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 min-w-[56px] text-[10px] font-medium transition-colors cursor-pointer touch-manipulation ${
              isActive ? 'text-amber-400 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span>{tab.label}</span>
          </button>
        );
      })}

      {/* Center Home Button -> Dashboard */}
      <button
        type="button"
        onClick={() => handleNavigate('dashboard')}
        className={`flex flex-col items-center justify-center -mt-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 p-2.5 rounded-full shadow-lg transition-all active:scale-95 cursor-pointer touch-manipulation ${
          isDashboardActive ? 'ring-2 ring-amber-200/80 ring-offset-2 ring-offset-neutral-900' : ''
        }`}
        title="Home · Tela inicial (Dashboard)"
        aria-label="Home - Ir para o Dashboard"
      >
        <Home className="w-6 h-6 stroke-[2.25]" />
      </button>

      {tabs.slice(2).map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleNavigate(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 min-w-[56px] text-[10px] font-medium transition-colors cursor-pointer touch-manipulation ${
              isActive ? 'text-amber-400 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
