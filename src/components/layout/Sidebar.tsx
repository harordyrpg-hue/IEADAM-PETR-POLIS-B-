import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Image as ImageIcon,
  Film,
  Palette,
  Music,
  FileText,
  Calendar,
  Clock,
  Star,
  Share2,
  Trash2,
  Users,
  ShieldAlert,
  History,
  Settings,
  HardDrive,
  Upload,
  Sun,
  Moon,
  LogOut,
  Church,
  CalendarDays,
  User as UserIcon,
  QrCode,
  Briefcase,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { ViewTab } from '../../types.js';
import { isSecretariaRole, isTabAllowedForUser } from '../../utils/accessControl.js';

interface NavItem {
  id: ViewTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeText?: string;
  liveDot?: boolean;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  churchAdminOnly?: boolean;
  financeAdminOnly?: boolean;
}

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    storageStats,
    teamTasks,
    mobileMenuOpen,
    setMobileMenuOpen,
    user,
    logout,
    theme,
    toggleTheme,
    openUpload,
    setActiveFolderId,
    setActiveEventId,
    isTransmitting,
    folders,
    allFiles,
    canAccessFinances,
  } = useApp();

  const [avatarError, setAvatarError] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const isMediaAdmin = user?.role === 'super_admin' || user?.role === 'media_admin';
  const isSecretaria = isSecretariaRole(user?.role);
  const canManageChurch = isSuperAdmin || user?.canManageChurchPage === true;

  const pendingTasksCount = teamTasks.filter((t) => t.status !== 'concluido').length;
  const usedPercent = storageStats?.usedPercentage || 0;
  const trashedFoldersCount = folders.filter((f) => f.inTrash).length;
  const trashedFilesCount = allFiles.filter((f) => f.inTrash).length;
  const totalTrashCount = trashedFoldersCount + trashedFilesCount;

  const initials = (user?.name || 'PT')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const navSections: { title: string; superAdminOnly?: boolean; items: NavItem[] }[] = [
    {
      title: 'Principal',
      items: [
        { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
        { id: 'secretariat', label: 'Secretaria', icon: Briefcase },
        { id: 'schedule', label: 'Agenda & Escalas', icon: CalendarDays, badge: pendingTasksCount },
        { id: 'registrations', label: 'Eventos & Inscrições', icon: QrCode },
        { id: 'files', label: 'Meus arquivos', icon: FolderOpen, badge: storageStats?.counts.totalFiles },
        {
          id: 'storage',
          label: 'Armazenamento & Telão',
          icon: HardDrive,
          liveDot: isTransmitting,
          badgeText: isTransmitting ? 'No ar' : `${usedPercent.toFixed(0)}%`,
        },
        { id: 'profile', label: 'Meu Perfil', icon: UserIcon },
      ],
    },
    {
      title: 'Site da Igreja',
      items: [
        { id: 'church', label: 'Página da Igreja', icon: Church, churchAdminOnly: true },
      ],
    },
    {
      title: 'Mídias',
      items: [
        { id: 'photos', label: 'Fotos', icon: ImageIcon, badge: storageStats?.breakdown.photos.count },
        { id: 'videos', label: 'Vídeos', icon: Film, badge: storageStats?.breakdown.videos.count },
        { id: 'arts', label: 'Artes Gráficas', icon: Palette, badge: storageStats?.breakdown.arts.count },
        { id: 'audios', label: 'Áudios & Louvor', icon: Music, badge: storageStats?.breakdown.audios.count },
        { id: 'documents', label: 'Documentos', icon: FileText, badge: storageStats?.breakdown.documents.count },
      ],
    },
    {
      title: 'Organização',
      items: [
        { id: 'events', label: 'Coberturas & Eventos', icon: Calendar, badge: storageStats?.counts.totalEvents },
        { id: 'recents', label: 'Recentes', icon: Clock },
        { id: 'favorites', label: 'Favoritos', icon: Star },
        { id: 'shares', label: 'Compartilhados', icon: Share2, badge: storageStats?.counts.totalShares },
        { id: 'trash', label: 'Lixeira', icon: Trash2, badge: totalTrashCount },
      ],
    },
    {
      title: 'Administração',
      superAdminOnly: true,
      items: [
        { id: 'users', label: 'Equipe & Acessos', icon: Users, superAdminOnly: true },
        { id: 'admin', label: 'Painel Geral', icon: ShieldAlert, superAdminOnly: true },
        { id: 'settings', label: 'Configurações', icon: Settings, superAdminOnly: true },
        { id: 'history', label: 'Histórico', icon: History, superAdminOnly: true },
      ],
    },
  ];

  const handleNavClick = (tabId: ViewTab) => {
    setActiveTab(tabId);
    if (tabId === 'files') {
      setActiveFolderId(null);
    }
    setActiveEventId(null);
    setMobileMenuOpen(false);
  };

  const handleUploadClick = () => {
    openUpload();
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-72 md:w-64 bg-neutral-900 dark:bg-neutral-950 border-r border-neutral-800 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          mobileMenuOpen
            ? 'translate-x-0 pointer-events-auto shadow-2xl'
            : '-translate-x-full pointer-events-none md:pointer-events-auto md:translate-x-0'
        }`}
      >
        {/* Top Section: User + Upload + Theme */}
        <div className="p-3 border-b border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-neutral-800/50 border border-neutral-800">
            {isSecretaria ? (
              <div className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 border border-amber-500/30 flex items-center justify-center shrink-0">
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
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-100 truncate">{user?.name}</p>
                  <p className="text-[11px] text-amber-400/90 truncate">{user?.roleLabel}</p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleNavClick('profile')}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer hover:opacity-90 transition-opacity"
                title="Abrir perfil"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 border border-amber-500/30 flex items-center justify-center shrink-0">
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
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-100 truncate">{user?.name}</p>
                  <p className="text-[11px] text-amber-400/90 truncate">{user?.roleLabel}</p>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              className="p-2 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => logout()}
              title="Sair da conta"
              className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {!isSecretaria && (
            <button
              type="button"
              onClick={handleUploadClick}
              className="w-full flex items-center justify-center gap-2 min-h-[40px] py-2 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs transition-colors active:scale-[0.98] cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Enviar arquivos</span>
            </button>
          )}
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {navSections.map((section) => {
            if (section.superAdminOnly && !isSuperAdmin) return null;

            const visibleItems = section.items.filter((item) => {
              if (!isTabAllowedForUser(item.id, user)) return false;
              if (item.superAdminOnly && !isSuperAdmin) return false;
              if (item.adminOnly && !isSuperAdmin && !isMediaAdmin) return false;
              if (item.churchAdminOnly && !canManageChurch) return false;
              if (item.financeAdminOnly && !canAccessFinances) return false;
              return true;
            });
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-0.5">
                <div className="px-3 pb-1 text-[11px] font-semibold text-neutral-500">
                  {section.title}
                </div>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    activeTab === item.id ||
                    (item.id === 'secretariat' &&
                      (activeTab === 'attendance' || activeTab === 'finances'));

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 min-h-[38px] rounded-xl text-xs font-medium transition-colors text-left cursor-pointer ${
                        isActive
                          ? 'bg-amber-500/15 text-amber-400 font-semibold'
                          : 'text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-neutral-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.liveDot && (
                          <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded">
                            No ar
                          </span>
                        )}
                        {!item.liveDot && item.badgeText && (
                          <span className="text-[11px] font-mono tabular-nums text-neutral-400">
                            {item.badgeText}
                          </span>
                        )}
                        {typeof item.badge === 'number' && item.badge > 0 && (
                          <span className="text-[11px] font-mono tabular-nums text-neutral-400">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
};
