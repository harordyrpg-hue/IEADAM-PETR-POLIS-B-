import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from '../../context/AppContext.js';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';
import { MobileNav } from './MobileNav.js';
import { UploadModal } from '../upload/UploadModal.js';
import { FileDetailModal } from '../files/FileDetailModal.js';
import { PhotoLightbox } from '../files/PhotoLightbox.js';
import { VideoPlayerModal } from '../files/VideoPlayerModal.js';
import { AudioPlayerModal } from '../files/AudioPlayerModal.js';
import { ShareModal } from '../files/ShareModal.js';
import { ScreenTransmissionWidget } from './ScreenTransmissionWidget.js';
import { DashboardView } from '../views/DashboardView.js';
import { FilesManagerView } from '../views/FilesManagerView.js';
import { PhotosView } from '../views/PhotosView.js';
import { VideosView } from '../views/VideosView.js';
import { ArtsView } from '../views/ArtsView.js';
import { AudiosView } from '../views/AudiosView.js';
import { DocumentsView } from '../views/DocumentsView.js';
import { EventsView } from '../views/EventsView.js';
import { ScheduleView } from '../views/ScheduleView.js';
import { RecentsView } from '../views/RecentsView.js';
import { FavoritesView } from '../views/FavoritesView.js';
import { SharesView } from '../views/SharesView.js';
import { TrashView } from '../views/TrashView.js';
import { UsersView } from '../views/UsersView.js';
import { AdminView } from '../views/AdminView.js';
import { HistoryView } from '../views/HistoryView.js';
import { SettingsView } from '../views/SettingsView.js';
import { SharedResourceView } from '../views/SharedResourceView.js';
import { ChurchAdminView } from '../views/ChurchAdminView.js';
import { StorageTransmissionView } from '../views/StorageTransmissionView.js';
import { ProfileView } from '../views/ProfileView.js';
import { PublicEventsAdminView } from '../views/PublicEventsAdminView.js';
import { SecretariatView } from '../views/SecretariatView.js';
import { PublicEventRegistrationPage } from '../public/PublicEventRegistrationPage.js';
import { LoginView } from '../auth/LoginView.js';
import { isSecretariaRole, sanitizeTabForUser } from '../../utils/accessControl.js';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  LogOut,
} from 'lucide-react';

const MainLayout: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    toasts,
    dismissToast,
    confirmDialog,
    resolveConfirm,
    user,
    authLoading,
    completeFirstLoginPassword,
    logout,
  } = useApp();

  const [firstNewPassword, setFirstNewPassword] = useState('');
  const [firstConfirmPassword, setFirstConfirmPassword] = useState('');
  const [showFirstPassword, setShowFirstPassword] = useState(false);
  const [savingFirstPassword, setSavingFirstPassword] = useState(false);
  const [firstPasswordError, setFirstPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmDialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resolveConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDialog, resolveConfirm]);

  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [sharedToken, setSharedToken] = useState<string | null>(null);
  const [publicEventId, setPublicEventId] = useState<string | null>(null);

  // Check URL hash and query params for public registration and shared resource links
  useEffect(() => {
    const handleRouteCheck = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const queryInscricao = searchParams.get('inscricao') || searchParams.get('evento');
      if (queryInscricao) {
        setPublicEventId(queryInscricao);
        return;
      }

      const hash = window.location.hash;
      if (hash.startsWith('#inscricao=') || hash.startsWith('#evento=')) {
        const hashId = hash.replace(/#(inscricao|evento)=/, '');
        setPublicEventId(hashId);
        return;
      }
      setPublicEventId(null);

      if (hash.startsWith('#share=')) {
        const token = hash.replace('#share=', '');
        setSharedToken(token);
      } else {
        setSharedToken(null);
      }
    };

    handleRouteCheck();
    window.addEventListener('hashchange', handleRouteCheck);
    window.addEventListener('popstate', handleRouteCheck);
    return () => {
      window.removeEventListener('hashchange', handleRouteCheck);
      window.removeEventListener('popstate', handleRouteCheck);
    };
  }, []);

  if (publicEventId) {
    return (
      <PublicEventRegistrationPage
        eventId={publicEventId}
        onExit={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('inscricao');
          url.searchParams.delete('evento');
          url.hash = '';
          window.history.replaceState({}, '', url.pathname);
          setPublicEventId(null);
        }}
      />
    );
  }

  if (sharedToken) {
    return (
      <SharedResourceView
        token={sharedToken}
        onExit={() => {
          window.location.hash = '';
          setSharedToken(null);
        }}
      />
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-neutral-100 selection:bg-amber-500/30 selection:text-amber-200">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/20 text-amber-500 font-bold text-lg tracking-wider border border-amber-500/30 animate-pulse">
            PTB
          </div>
          <h2 className="text-base font-semibold text-neutral-200">PT-B Mídia</h2>
          <p className="text-xs text-neutral-400">Conectando ao servidor PT-B Mídia...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  if (user.mustChangePassword || !user.passwordSetOnce) {
    const handleCompleteFirstPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setFirstPasswordError(null);
      const trimmed = firstNewPassword.trim();

      if (trimmed.length < 5) {
        setFirstPasswordError('A senha definitiva deve ter no mínimo 5 caracteres.');
        return;
      }
      if (trimmed === '12345') {
        setFirstPasswordError('Escolha uma senha diferente da senha provisória 12345.');
        return;
      }
      if (trimmed !== firstConfirmPassword.trim()) {
        setFirstPasswordError('A confirmação da senha não confere.');
        return;
      }

      try {
        setSavingFirstPassword(true);
        await completeFirstLoginPassword(trimmed);
        setFirstNewPassword('');
        setFirstConfirmPassword('');
      } catch (err: any) {
        setFirstPasswordError(err?.message || 'Erro ao salvar sua senha definitiva.');
      } finally {
        setSavingFirstPassword(false);
      }
    };

    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-neutral-100">
        <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-neutral-100">
              Primeiro Acesso — Defina sua Senha
            </h1>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Olá, <strong className="text-neutral-200">{user.name}</strong>! A senha provisória{' '}
              <span className="font-mono text-amber-300">12345</span> vale apenas para este primeiro acesso.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[11px] leading-relaxed flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Atenção:</strong> você só pode definir sua senha definitiva <strong>uma única vez</strong> agora. Essa senha substituirá a <span className="font-mono">12345</span> e será usada em todos os próximos acessos.
            </span>
          </div>

          {firstPasswordError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{firstPasswordError}</span>
            </div>
          )}

          <form onSubmit={handleCompleteFirstPassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-neutral-300 font-medium mb-1.5">
                Nova Senha Definitiva *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type={showFirstPassword ? 'text' : 'password'}
                  required
                  minLength={5}
                  value={firstNewPassword}
                  onChange={(e) => setFirstNewPassword(e.target.value)}
                  placeholder="Mínimo 5 caracteres (diferente de 12345)"
                  className="w-full pl-9 pr-10 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowFirstPassword(!showFirstPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                  tabIndex={-1}
                >
                  {showFirstPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1.5">
                Confirmar Nova Senha *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type={showFirstPassword ? 'text' : 'password'}
                  required
                  minLength={5}
                  value={firstConfirmPassword}
                  onChange={(e) => setFirstConfirmPassword(e.target.value)}
                  placeholder="Repita sua senha definitiva"
                  className="w-full pl-9 pr-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingFirstPassword}
              className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {savingFirstPassword ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Salvar Senha Definitiva e Entrar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
            <span className="truncate">{user.email}</span>
            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-1 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer shrink-0 ml-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isSecretaria = isSecretariaRole(user?.role);

  const renderActiveView = () => {
    const safeTab = sanitizeTabForUser(activeTab, user);
    switch (safeTab) {
      case 'dashboard':
        return (
          <DashboardView
            onNewFolderClick={() => {
              setActiveTab('files');
              setIsNewFolderOpen(true);
            }}
          />
        );
      case 'files':
        return (
          <FilesManagerView
            isNewFolderOpen={isNewFolderOpen}
            setIsNewFolderOpen={setIsNewFolderOpen}
          />
        );
      case 'photos':
        return <PhotosView />;
      case 'videos':
        return <VideosView />;
      case 'arts':
        return <ArtsView />;
      case 'audios':
        return <AudiosView />;
      case 'documents':
        return <DocumentsView />;
      case 'events':
        return <EventsView />;
      case 'schedule':
        return <ScheduleView />;
      case 'recents':
        return <RecentsView />;
      case 'favorites':
        return <FavoritesView />;
      case 'shares':
        return <SharesView />;
      case 'trash':
        return <TrashView />;
      case 'users':
        return user?.role === 'super_admin' ? (
          <UsersView />
        ) : (
          <DashboardView
            onNewFolderClick={() => {
              setActiveTab('files');
              setIsNewFolderOpen(true);
            }}
          />
        );
      case 'admin':
        return user?.role === 'super_admin' ? (
          <AdminView />
        ) : (
          <DashboardView
            onNewFolderClick={() => {
              setActiveTab('files');
              setIsNewFolderOpen(true);
            }}
          />
        );
      case 'history':
        return user?.role === 'super_admin' ? (
          <HistoryView />
        ) : (
          <DashboardView
            onNewFolderClick={() => {
              setActiveTab('files');
              setIsNewFolderOpen(true);
            }}
          />
        );
      case 'settings':
        return user?.role === 'super_admin' ? (
          <SettingsView />
        ) : (
          <DashboardView
            onNewFolderClick={() => {
              setActiveTab('files');
              setIsNewFolderOpen(true);
            }}
          />
        );
      case 'church':
        return user?.role === 'super_admin' || user?.canManageChurchPage === true ? (
          <ChurchAdminView />
        ) : (
          <DashboardView
            onNewFolderClick={() => {
              setActiveTab('files');
              setIsNewFolderOpen(true);
            }}
          />
        );
      case 'storage':
        return <StorageTransmissionView />;
      case 'profile':
        return <ProfileView />;
      case 'secretariat':
        return <SecretariatView />;
      case 'finances':
        return <SecretariatView initialSubTab="finances" />;
      case 'registrations':
        return <PublicEventsAdminView />;
      case 'attendance':
        return <SecretariatView initialSubTab="attendance" />;
      default:
        return isSecretaria ? (
          <SecretariatView />
        ) : (
          <DashboardView
            onNewFolderClick={() => {
              setActiveTab('files');
              setIsNewFolderOpen(true);
            }}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      <Header />

      <div className="flex-1 flex min-w-0">
        <Sidebar />

        <main className="flex-1 md:pl-64 min-w-0 pb-28 md:pb-12">
          <div className="max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">{renderActiveView()}</div>
        </main>
      </div>

      <MobileNav />

      {!isSecretaria && (
        <>
          <UploadModal />
          <FileDetailModal />
          <PhotoLightbox />
          <VideoPlayerModal />
          <AudioPlayerModal />
          <ShareModal />
        </>
      )}
      <ScreenTransmissionWidget />

      {confirmDialog && (
        <div
          className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => resolveConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-confirm-title"
        >
          <div
            className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmDialog.danger !== false
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="global-confirm-title" className="text-sm font-bold text-neutral-100">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed whitespace-pre-line">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="min-h-[40px] px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 transition-colors cursor-pointer"
              >
                {confirmDialog.cancelLabel || 'Cancelar'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => resolveConfirm(true)}
                className={`min-h-[40px] px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                  confirmDialog.danger !== false
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-amber-400 hover:bg-amber-300 text-neutral-950'
                }`}
              >
                {confirmDialog.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-20 right-4 z-[80] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-xl border text-xs font-medium backdrop-blur-md animate-in slide-in-from-top-2 duration-200 ${
              toast.type === 'success'
                ? 'bg-neutral-900/95 border-emerald-500/40 text-emerald-300'
                : toast.type === 'error'
                ? 'bg-neutral-900/95 border-red-500/40 text-red-300'
                : 'bg-neutral-900/95 border-neutral-700/60 text-neutral-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-amber-400 shrink-0" />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-0.5 text-neutral-400 hover:text-white rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AuthenticatedShell: React.FC = () => (
  <AppProvider>
    <MainLayout />
  </AppProvider>
);

export default AuthenticatedShell;
