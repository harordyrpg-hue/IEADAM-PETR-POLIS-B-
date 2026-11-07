import React from 'react';
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
  Shield,
  Radio,
  UserPlus,
  Church,
  CalendarDays,
  Tv,
  Square,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { ViewTab } from '../../types.js';
import { formatBytes, getRoleBadgeStyle } from '../../utils/formatters.js';

interface NavItem {
  id: ViewTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  churchAdminOnly?: boolean;
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
    isRealtimeActive,
    isTransmitting,
    toggleTransmission,
  } = useApp();

  const isSuperAdmin = user?.role === 'super_admin';
  const isMediaAdmin = user?.role === 'super_admin' || user?.role === 'media_admin';
  const canManageChurch = isSuperAdmin || user?.canManageChurchPage === true;
  const roleStyle = user ? getRoleBadgeStyle(user.role) : { label: '', textClass: '', borderClass: '' };

  const pendingTasksCount = teamTasks.filter((t) => t.status !== 'concluido').length;

  const navSections: { title: string; superAdminOnly?: boolean; items: NavItem[] }[] = [
    {
      title: 'Principal',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'schedule', label: 'Central de Agenda', icon: CalendarDays, badge: pendingTasksCount },
        { id: 'files', label: 'Meus arquivos', icon: FolderOpen, badge: storageStats?.counts.totalFiles },
      ],
    },
    {
      title: 'Site Público da Igreja',
      items: [
        { id: 'church', label: 'Página da Igreja', icon: Church, churchAdminOnly: true },
      ],
    },
    {
      title: 'Mídias em Alta Resolução',
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
        { id: 'events', label: 'Eventos', icon: Calendar, badge: storageStats?.counts.totalEvents },
        { id: 'recents', label: 'Recentes', icon: Clock },
        { id: 'favorites', label: 'Favoritos', icon: Star },
        { id: 'shares', label: 'Compartilhados', icon: Share2, badge: storageStats?.counts.totalShares },
        { id: 'trash', label: 'Lixeira', icon: Trash2, badge: storageStats?.breakdown.trash.count },
      ],
    },
    {
      title: 'Administração & Equipe',
      superAdminOnly: true,
      items: [
        { id: 'users', label: 'Membros & Cadastro', icon: Users, superAdminOnly: true },
        { id: 'admin', label: 'Painel Geral', icon: ShieldAlert, superAdminOnly: true },
        { id: 'settings', label: 'Configurações & Cloud', icon: Settings, superAdminOnly: true },
        { id: 'history', label: 'Histórico & Auditoria', icon: History, superAdminOnly: true },
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

  const usedBytes = storageStats?.totalBytesUsed || 0;
  const quotaBytes = storageStats?.totalQuota || 2 * 1024 * 1024 * 1024 * 1024;
  const usedPercent = storageStats?.usedPercentage || 0;

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
        className={`fixed top-16 bottom-0 left-0 z-40 w-72 md:w-64 bg-neutral-900 dark:bg-neutral-950 border-r border-neutral-800 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Section: User Profile + Action "Enviar" + Theme + Realtime */}
        <div className="p-3 border-b border-neutral-800 bg-neutral-900/90 dark:bg-neutral-950/90 space-y-3">
          {/* User Profile Card */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800/70 border border-neutral-700/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={
                  user?.avatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'
                }
                alt={user?.name || 'Perfil'}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-500/40 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-100 truncate">{user?.name}</p>
                <div className="flex items-center gap-1 text-[10px] text-amber-400 font-medium truncate">
                  <Shield className="w-3 h-3 shrink-0" />
                  <span className="truncate">{user?.roleLabel}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sair da conta"
              className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Action Button: Enviar Arquivos */}
          <button
            onClick={handleUploadClick}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Enviar arquivos</span>
          </button>

          {/* Quick Bar: Theme Switcher & Real-time Live indicator */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Alternar tema claro / escuro"
            >
              <div className="flex items-center gap-1.5">
                {theme === 'dark' ? <Moon className="w-3.5 h-3.5 text-amber-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
                <span className="text-[11px] font-medium">{theme === 'dark' ? 'Escuro' : 'Claro'}</span>
              </div>
              <span className="text-[10px] text-neutral-400">Tema</span>
            </button>

            {/* Real-time Status Badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium select-none"
              title="Sincronização em tempo real ativa: alterações de qualquer usuário aparecem instantaneamente"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Ao vivo</span>
            </div>
          </div>
        </div>

        {/* Navigation items list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {navSections.map((section) => {
            if (section.superAdminOnly && !isSuperAdmin) return null;

            // Filter items based on role
            const visibleItems = section.items.filter((item) => {
              if (item.superAdminOnly && !isSuperAdmin) return false;
              if (item.adminOnly && !isSuperAdmin && !isMediaAdmin) return false;
              if (item.churchAdminOnly && !canManageChurch) return false;
              return true;
            });
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-1">
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  {section.title}
                </div>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                        isActive
                          ? 'bg-amber-500/15 text-amber-400 font-semibold'
                          : 'text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-neutral-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <span className="text-[11px] font-mono-numbers text-neutral-400 px-1.5 py-0.5">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Telão & Projeção Card */}
        <div className="px-3 pt-2 pb-1 border-t border-neutral-800">
          <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Tv className="w-3 h-3 text-amber-400" />
                <span>Telão & Projeção</span>
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-amber-300 font-bold border border-neutral-700">
                PC
              </span>
            </div>
            <button
              onClick={() => {
                toggleTransmission();
                if (mobileMenuOpen) setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs ${
                isTransmitting
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-rose-600/30'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 hover:border-amber-500/50'
              }`}
              title={
                isTransmitting
                  ? 'Parar de transmitir agora'
                  : 'Transmitir tela do computador para o telão/projetor'
              }
            >
              {isTransmitting ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Parar de transmitir</span>
                </>
              ) : (
                <>
                  <Tv className="w-3.5 h-3.5 text-amber-400" />
                  <span>Transmitir para a tela</span>
                </>
              )}
            </button>
            <span className="block text-[10px] text-neutral-400 text-center mt-1">
              {isTransmitting ? '🔴 Transmitindo na tela' : 'Opção para computador'}
            </span>
          </div>
        </div>

        {/* Real Storage Health Box */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-900/60">
          <div className="p-3 rounded-xl bg-neutral-800/60 border border-neutral-700/60 text-neutral-300">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-neutral-100">Armazenamento</span>
              </div>
              <span className="text-[11px] font-mono-numbers font-medium text-amber-400">
                {usedPercent.toFixed(1)}%
              </span>
            </div>

            {/* Storage Progress Bar */}
            <div className="w-full h-1.5 bg-neutral-700/80 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-linear-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(usedPercent, 1))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono-numbers">
              <span>{formatBytes(usedBytes)} usado</span>
              <span>{formatBytes(quotaBytes)}</span>
            </div>

            <div className="mt-2 pt-2 border-t border-neutral-700/40 text-[10px] text-neutral-400 flex items-center justify-between">
              <span>Compartilhado</span>
              <span className="text-emerald-400 font-medium">Tempo Real</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
