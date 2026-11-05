import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  User,
  FileRecord,
  Folder,
  ChurchEvent,
  StorageStats,
  ViewTab,
  TeamTask,
  TeamNote,
  TeamTaskStatus,
} from '../types.js';
import { api } from '../services/api.js';
import { auth } from '../services/firebase.js';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: (fallbackGmail?: string, displayName?: string) => Promise<void>;
  loginWithGmailDirect: (email: string, displayName?: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  storageStats: StorageStats | null;
  refreshStats: () => Promise<void>;
  allFiles: FileRecord[];
  filesLoading: boolean;
  isRealtimeActive: boolean;
  folders: Folder[];
  refreshFolders: () => Promise<void>;
  events: ChurchEvent[];
  refreshEvents: () => Promise<void>;
  teamTasks: TeamTask[];
  teamNotes: TeamNote[];
  createTeamTask: (data: Partial<TeamTask>) => Promise<TeamTask>;
  updateTeamTask: (id: string, updates: Partial<TeamTask>) => Promise<void>;
  toggleTaskComplete: (id: string, currentStatus: TeamTaskStatus) => Promise<void>;
  deleteTeamTask: (id: string) => Promise<void>;
  createTeamNote: (data: Partial<TeamNote>) => Promise<TeamNote>;
  updateTeamNote: (id: string, updates: Partial<TeamNote>) => Promise<void>;
  deleteTeamNote: (id: string) => Promise<void>;
  activeFolderId: string | null;
  setActiveFolderId: (id: string | null) => void;
  activeEventId: string | null;
  setActiveEventId: (id: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  sortField: 'name' | 'size' | 'date' | 'type';
  setSortField: (field: 'name' | 'size' | 'date' | 'type') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  selectedFileIds: string[];
  toggleSelectFile: (id: string) => void;
  selectAllFiles: (ids: string[]) => void;
  clearFileSelection: () => void;
  isUploadOpen: boolean;
  openUpload: (folderId?: string | null, eventId?: string | null) => void;
  closeUpload: () => void;
  uploadFolderId: string | null;
  uploadEventId: string | null;
  detailFile: FileRecord | null;
  setDetailFile: (file: FileRecord | null) => void;
  lightboxFile: FileRecord | null;
  setLightboxFile: (file: FileRecord | null) => void;
  videoPlayerFile: FileRecord | null;
  setVideoPlayerFile: (file: FileRecord | null) => void;
  audioPlayerFile: FileRecord | null;
  setAudioPlayerFile: (file: FileRecord | null) => void;
  shareTarget: { type: 'file' | 'folder' | 'event'; id: string; name: string } | null;
  setShareTarget: (target: { type: 'file' | 'folder' | 'event'; id: string; name: string } | null) => void;
  toasts: Toast[];
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [allFiles, setAllFiles] = useState<FileRecord[]>([]);
  const [filesLoading, setFilesLoading] = useState<boolean>(true);
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(true);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [teamTasks, setTeamTasks] = useState<TeamTask[]>([]);
  const [teamNotes, setTeamNotes] = useState<TeamNote[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortField, setSortField] = useState<'name' | 'size' | 'date' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // Modals & Panels
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [uploadEventId, setUploadEventId] = useState<string | null>(null);

  const [detailFile, setDetailFile] = useState<FileRecord | null>(null);
  const [lightboxFile, setLightboxFile] = useState<FileRecord | null>(null);
  const [videoPlayerFile, setVideoPlayerFile] = useState<FileRecord | null>(null);
  const [audioPlayerFile, setAudioPlayerFile] = useState<FileRecord | null>(null);
  const [shareTarget, setShareTarget] = useState<{ type: 'file' | 'folder' | 'event'; id: string; name: string } | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync theme with html document element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const refreshStats = useCallback(async () => {
    try {
      const stats = await api.getStorageStats();
      setStorageStats(stats);
    } catch (err) {
      console.warn('Storage stats refresh deferred:', err);
    }
  }, []);

  const refreshFolders = useCallback(async () => {
    try {
      const data = await api.getFolders();
      setFolders(data);
    } catch (err) {
      console.warn('Folders refresh deferred:', err);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const data = await api.getEvents();
      setEvents(data);
    } catch (err) {
      console.warn('Events refresh deferred:', err);
    }
  }, []);

  // Listen to Firebase Authentication state changes & restore session
  useEffect(() => {
    // 1. Check local session immediately to avoid flash of login screen
    const storedUser = api.getCurrentSessionUser();
    if (storedUser) {
      setUser(storedUser);
      setAuthLoading(false);
      refreshStats();
      refreshFolders();
      refreshEvents();
    }

    const unsubscribe = api.onAuthStateChanged(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const profile = await api.getUserProfile(fbUser.uid, fbUser.email || '');
          if (profile.status === 'blocked') {
            await api.logout();
            notify('Sua conta foi suspensa temporariamente pelo Administrador.', 'error');
            setUser(null);
          } else {
            setUser(profile);
            try {
              localStorage.setItem('ptb_session_user', JSON.stringify(profile));
            } catch {}
            await Promise.all([refreshStats(), refreshFolders(), refreshEvents()]);
          }
        } catch (err) {
          console.error('Failed to load user profile from Firestore:', err);
          const fallback = api.getCurrentSessionUser();
          if (fallback) setUser(fallback);
        }
      } else {
        const localSession = api.getCurrentSessionUser();
        if (localSession) {
          setUser(localSession);
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [refreshStats, refreshFolders, refreshEvents, notify]);

  // Real-time synchronization across all team members
  useEffect(() => {
    if (!user) {
      setAllFiles([]);
      return;
    }

    // 1. Real-time Files sync (any upload, edit, rename, move, delete syncs instantly)
    const unsubFiles = api.subscribeAllFiles((filesList) => {
      setAllFiles(filesList);
      setFilesLoading(false);
      setIsRealtimeActive(true);
    });

    // 2. Real-time Folders sync
    const unsubFolders = api.subscribeAllFolders((foldersList) => {
      setFolders(foldersList);
    });

    // 3. Real-time Events sync
    const unsubEvents = api.subscribeAllEvents((eventsList) => {
      setEvents(eventsList);
    });

    // 4. Real-time Team Tasks & Scales sync
    const unsubTasks = api.subscribeTeamTasks((tasksList) => {
      setTeamTasks(tasksList);
    });

    // 5. Real-time Team Collaborative Notes sync
    const unsubNotes = api.subscribeTeamNotes((notesList) => {
      setTeamNotes(notesList);
    });

    // Seed initial schedule samples if empty
    api.seedInitialTeamScheduleIfEmpty().catch(() => {});

    return () => {
      unsubFiles();
      unsubFolders();
      unsubEvents();
      unsubTasks();
      unsubNotes();
    };
  }, [user]);

  // Dynamically compute real-time storage stats from allFiles
  useEffect(() => {
    const totalBytes = allFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    const quota = 2 * 1024 * 1024 * 1024 * 1024; // 2 TB Church Storage Quota
    const usedPercentage = quota > 0 ? (totalBytes / quota) * 100 : 0;
    const availableBytes = Math.max(0, quota - totalBytes);

    const breakdown = {
      photos: { count: 0, bytes: 0 },
      videos: { count: 0, bytes: 0 },
      arts: { count: 0, bytes: 0 },
      audios: { count: 0, bytes: 0 },
      documents: { count: 0, bytes: 0 },
      others: { count: 0, bytes: 0 },
      trash: { count: 0, bytes: 0 },
    };

    allFiles.forEach((f) => {
      if (f.inTrash) {
        breakdown.trash.count++;
        breakdown.trash.bytes += f.size || 0;
      } else {
        if (f.type === 'photo') {
          breakdown.photos.count++;
          breakdown.photos.bytes += f.size || 0;
        } else if (f.type === 'video') {
          breakdown.videos.count++;
          breakdown.videos.bytes += f.size || 0;
        } else if (f.type === 'art') {
          breakdown.arts.count++;
          breakdown.arts.bytes += f.size || 0;
        } else if (f.type === 'audio') {
          breakdown.audios.count++;
          breakdown.audios.bytes += f.size || 0;
        } else if (f.type === 'document') {
          breakdown.documents.count++;
          breakdown.documents.bytes += f.size || 0;
        } else {
          breakdown.others.count++;
          breakdown.others.bytes += f.size || 0;
        }
      }
    });

    setStorageStats({
      totalBytesUsed: totalBytes,
      totalQuota: quota,
      availableBytes,
      usedPercentage,
      counts: {
        totalFiles: allFiles.filter((f) => !f.inTrash).length,
        totalFolders: folders.length,
        totalEvents: events.length,
        totalUsers: 1,
        totalShares: 0,
      },
      breakdown,
      recentActivities: [],
    });
  }, [allFiles, folders, events]);

  const loginWithEmail = async (email: string, pass: string) => {
    const profile = await api.loginWithEmail(email, pass);
    setUser(profile);
    notify(`Bem-vindo, ${profile.name}!`, 'success');
  };

  const loginWithGoogle = async (fallbackGmail?: string, displayName?: string) => {
    const profile = await api.loginWithGoogle(fallbackGmail, displayName);
    setUser(profile);
    notify(`Bem-vindo, ${profile.name}!`, 'success');
  };

  const loginWithGmailDirect = async (email: string, displayName?: string) => {
    const profile = await api.loginWithGmailDirect(email, displayName);
    setUser(profile);
    notify(`Bem-vindo, ${profile.name}!`, 'success');
  };

  const registerWithEmail = async (name: string, email: string, pass: string) => {
    const profile = await api.registerWithEmail(name, email, pass);
    setUser(profile);
    notify(`Conta criada com sucesso! Bem-vindo, ${profile.name}!`, 'success');
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setFirebaseUser(null);
    notify('Sessão encerrada com sucesso.', 'info');
  };

  const resetPassword = async (email: string) => {
    await api.resetPassword(email);
    notify('E-mail de recuperação enviado! Verifique sua caixa de entrada.', 'success');
  };

  const openUpload = (folderId: string | null = null, eventId: string | null = null) => {
    setUploadFolderId(folderId);
    setUploadEventId(eventId);
    setIsUploadOpen(true);
  };

  const closeUpload = () => {
    setIsUploadOpen(false);
    setUploadFolderId(null);
    setUploadEventId(null);
  };

  const toggleSelectFile = (id: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllFiles = (ids: string[]) => {
    setSelectedFileIds(ids);
  };

  const clearFileSelection = () => {
    setSelectedFileIds([]);
  };

  // Team Schedule & Task Actions
  const createTeamTask = async (data: Partial<TeamTask>): Promise<TeamTask> => {
    try {
      const task = await api.createTeamTask(data);
      notify(`Afazer "${task.title}" adicionado à escala!`, 'success');
      return task;
    } catch (err: any) {
      notify('Erro ao criar afazer na agenda.', 'error');
      throw err;
    }
  };

  const updateTeamTask = async (id: string, updates: Partial<TeamTask>): Promise<void> => {
    try {
      await api.updateTeamTask(id, updates);
      notify('Afazer atualizado!', 'success');
    } catch (err: any) {
      notify('Erro ao atualizar afazer.', 'error');
      throw err;
    }
  };

  const toggleTaskComplete = async (id: string, currentStatus: TeamTaskStatus): Promise<void> => {
    try {
      await api.toggleTaskComplete(id, currentStatus);
      notify(currentStatus === 'concluido' ? 'Afazer reaberto.' : 'Afazer concluído com sucesso!', 'success');
    } catch (err: any) {
      notify('Erro ao alterar status do afazer.', 'error');
      throw err;
    }
  };

  const deleteTeamTask = async (id: string): Promise<void> => {
    try {
      await api.deleteTeamTask(id);
      notify('Afazer removido da escala.', 'info');
    } catch (err: any) {
      notify('Erro ao remover afazer.', 'error');
      throw err;
    }
  };

  // Team Collaborative Notes Actions
  const createTeamNote = async (data: Partial<TeamNote>): Promise<TeamNote> => {
    try {
      const note = await api.createTeamNote(data);
      notify('Anotação colaborativa criada!', 'success');
      return note;
    } catch (err: any) {
      notify('Erro ao salvar anotação.', 'error');
      throw err;
    }
  };

  const updateTeamNote = async (id: string, updates: Partial<TeamNote>): Promise<void> => {
    try {
      await api.updateTeamNote(id, updates);
      notify('Anotação atualizada!', 'success');
    } catch (err: any) {
      notify('Erro ao atualizar anotação.', 'error');
      throw err;
    }
  };

  const deleteTeamNote = async (id: string): Promise<void> => {
    try {
      await api.deleteTeamNote(id);
      notify('Anotação excluída.', 'info');
    } catch (err: any) {
      notify('Erro ao excluir anotação.', 'error');
      throw err;
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        firebaseUser,
        authLoading,
        loginWithEmail,
        loginWithGoogle,
        loginWithGmailDirect,
        registerWithEmail,
        logout,
        resetPassword,
        theme,
        toggleTheme,
        activeTab,
        setActiveTab,
        storageStats,
        refreshStats,
        allFiles,
        filesLoading,
        isRealtimeActive,
        folders,
        refreshFolders,
        events,
        refreshEvents,
        teamTasks,
        teamNotes,
        createTeamTask,
        updateTeamTask,
        toggleTaskComplete,
        deleteTeamTask,
        createTeamNote,
        updateTeamNote,
        deleteTeamNote,
        activeFolderId,
        setActiveFolderId,
        activeEventId,
        setActiveEventId,
        searchQuery,
        setSearchQuery,
        selectedTag,
        setSelectedTag,
        viewMode,
        setViewMode,
        sortField,
        setSortField,
        sortOrder,
        setSortOrder,
        selectedFileIds,
        toggleSelectFile,
        selectAllFiles,
        clearFileSelection,
        isUploadOpen,
        openUpload,
        closeUpload,
        uploadFolderId,
        uploadEventId,
        detailFile,
        setDetailFile,
        lightboxFile,
        setLightboxFile,
        videoPlayerFile,
        setVideoPlayerFile,
        audioPlayerFile,
        setAudioPlayerFile,
        shareTarget,
        setShareTarget,
        toasts,
        notify,
        dismissToast,
        mobileMenuOpen,
        setMobileMenuOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
