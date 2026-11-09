/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.js';
import { Header } from './components/layout/Header.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { MobileNav } from './components/layout/MobileNav.js';
import { UploadModal } from './components/upload/UploadModal.js';
import { FileDetailModal } from './components/files/FileDetailModal.js';
import { PhotoLightbox } from './components/files/PhotoLightbox.js';
import { VideoPlayerModal } from './components/files/VideoPlayerModal.js';
import { AudioPlayerModal } from './components/files/AudioPlayerModal.js';
import { ShareModal } from './components/files/ShareModal.js';
import { ScreenTransmissionWidget } from './components/layout/ScreenTransmissionWidget.js';
import { DashboardView } from './components/views/DashboardView.js';
import { FilesManagerView } from './components/views/FilesManagerView.js';
import { PhotosView } from './components/views/PhotosView.js';
import { VideosView } from './components/views/VideosView.js';
import { ArtsView } from './components/views/ArtsView.js';
import { AudiosView } from './components/views/AudiosView.js';
import { DocumentsView } from './components/views/DocumentsView.js';
import { EventsView } from './components/views/EventsView.js';
import { ScheduleView } from './components/views/ScheduleView.js';
import { RecentsView } from './components/views/RecentsView.js';
import { FavoritesView } from './components/views/FavoritesView.js';
import { SharesView } from './components/views/SharesView.js';
import { TrashView } from './components/views/TrashView.js';
import { UsersView } from './components/views/UsersView.js';
import { AdminView } from './components/views/AdminView.js';
import { HistoryView } from './components/views/HistoryView.js';
import { SettingsView } from './components/views/SettingsView.js';
import { SharedResourceView } from './components/views/SharedResourceView.js';
import { ChurchAdminView } from './components/views/ChurchAdminView.js';
import { StorageTransmissionView } from './components/views/StorageTransmissionView.js';
import { ProfileView } from './components/views/ProfileView.js';
import { FinancialView } from './components/views/FinancialView.js';
import { PublicChurchPage } from './components/public/PublicChurchPage.js';
import { LoginView } from './components/auth/LoginView.js';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, toasts, dismissToast, user, authLoading } = useApp();
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [sharedToken, setSharedToken] = useState<string | null>(null);

  // Check URL hash for shared resource links (e.g. #share=ptb_token)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#share=')) {
        const token = hash.replace('#share=', '');
        setSharedToken(token);
      } else {
        setSharedToken(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
          <p className="text-xs text-neutral-400">Conectando aos serviços oficiais do Firebase...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
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
        return (user?.role === 'super_admin' || user?.canManageChurchPage === true) ? (
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
      case 'finances':
        return <FinancialView />;
      default:
        return (
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
      {/* Top Header */}
      <Header />

      <div className="flex-1 flex min-w-0">
        {/* Sidebar (Desktop & Mobile Drawer) */}
        <Sidebar />

        {/* Main Content Area - Native smooth window scrolling without touch traps */}
        <main className="flex-1 md:pl-64 min-w-0 pb-28 md:pb-12">
          <div className="max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
            {renderActiveView()}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />

      {/* Global Interactive Modals */}
      <UploadModal />
      <FileDetailModal />
      <PhotoLightbox />
      <VideoPlayerModal />
      <AudioPlayerModal />
      <ShareModal />
      <ScreenTransmissionWidget />

      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
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

const checkIsChurchRoute = () => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return path === '/igreja' || path.startsWith('/igreja/') || hash === '#igreja' || hash.startsWith('#igreja');
};

export default function App() {
  const [isChurchPage, setIsChurchPage] = useState(checkIsChurchRoute());

  useEffect(() => {
    const handleRouteCheck = () => {
      setIsChurchPage(checkIsChurchRoute());
    };

    window.addEventListener('popstate', handleRouteCheck);
    window.addEventListener('hashchange', handleRouteCheck);
    return () => {
      window.removeEventListener('popstate', handleRouteCheck);
      window.removeEventListener('hashchange', handleRouteCheck);
    };
  }, []);

  if (isChurchPage) {
    return <PublicChurchPage />;
  }

  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
