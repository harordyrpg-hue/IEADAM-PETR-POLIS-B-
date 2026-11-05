import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  FolderOpen,
  Image as ImageIcon,
  Film,
  PlusCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { ViewTab } from '../../types.js';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, openUpload } = useApp();

  const tabs: { id: ViewTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'schedule', label: 'Agenda', icon: CalendarDays },
    { id: 'files', label: 'Arquivos', icon: FolderOpen },
    { id: 'photos', label: 'Fotos', icon: ImageIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-neutral-900/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-neutral-800 px-2 py-1.5 flex items-center justify-around text-neutral-400">
      {tabs.slice(0, 2).map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 min-w-[56px] text-[10px] font-medium transition-colors ${
              isActive ? 'text-amber-400 font-semibold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Icon className="w-5 h-5 mb-0.5" />
            <span>{tab.label}</span>
          </button>
        );
      })}

      {/* Center Upload Button */}
      <button
        onClick={() => openUpload()}
        className="flex flex-col items-center justify-center -mt-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 p-2.5 rounded-full shadow-lg transition-transform active:scale-95"
        title="Enviar arquivos"
      >
        <PlusCircle className="w-6 h-6 stroke-[2.5]" />
      </button>

      {tabs.slice(2).map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 min-w-[56px] text-[10px] font-medium transition-colors ${
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
