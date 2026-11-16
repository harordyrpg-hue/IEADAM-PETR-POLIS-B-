import JSZip from 'jszip';
import {
  User,
  UserRole,
  FileRecord,
  Folder,
  ChurchEvent,
  ShareLink,
  Activity,
  StorageStats,
  SystemSettings,
  MediaCategory,
  ChurchProfile,
  ChurchAnnouncement,
  ChurchPublicEvent,
  ChurchArticle,
  ChurchAlbum,
  ChurchDownload,
  TeamTask,
  TeamNote,
  FinancialTransaction,
  FinancialBill,
  FinancialPaymentMethod,
  FinancialReceipt,
  PublicRegistrationEvent,
  EventRegistration,
  EventCashboxMovement,
  EventRegistrationsSummary,
  AttendanceDepartmentKind,
  AttendanceDepartment,
  AttendanceMember,
  AttendanceEntry,
  AttendanceCall,
  TeamTaskStatus,
} from '../types.js';
import { createFileThumbnail } from '../utils/thumbnail.js';

// ==========================================
// UTILITY HELPERS
// ==========================================
export function detectMediaCategory(fileName: string, mimeType: string): MediaCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const photoExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'tiff', 'tif', 'raw', 'cr2', 'nef', 'arw', 'dng', 'heic'];
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v', 'prores'];
  const audioExts = ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'wma', 'aiff'];
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv'];
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];

  const lowerName = fileName.toLowerCase();
  if (
    lowerName.includes('cartaz') ||
    lowerName.includes('banner') ||
    lowerName.includes('stories') ||
    lowerName.includes('post') ||
    lowerName.includes('flyer') ||
    lowerName.includes('arte') ||
    ['psd', 'ai', 'cdr', 'fig', 'sketch'].includes(ext)
  ) {
    return 'art';
  }

  if (photoExts.includes(ext) || mimeType.startsWith('image/')) return 'photo';
  if (videoExts.includes(ext) || mimeType.startsWith('video/')) return 'video';
  if (audioExts.includes(ext) || mimeType.startsWith('audio/')) return 'audio';
  if (docExts.includes(ext) || mimeType.includes('pdf') || mimeType.includes('document')) return 'document';
  if (archiveExts.includes(ext) || mimeType.includes('zip') || mimeType.includes('compressed')) return 'archive';

  return 'other';
}

export async function getImageResolution(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve(`${img.naturalWidth}x${img.naturalHeight}`);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function removeUndefinedValues<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      clean[key] = removeUndefinedValues(value);
    }
  }
  return clean as T;
}

// ==========================================
// HTTP CLIENT & REAL-TIME SSE HUB
// ==========================================
async function apiFetch<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const text = await res.text();
  let parsed: any = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { error: text };
  }

  if (!res.ok) {
    throw new Error(parsed?.error || `Erro HTTP ${res.status}`);
  }
  return parsed as T;
}

async function listCol<T>(col: string): Promise<T[]> {
  const res = await apiFetch<{ items: T[] }>(`/api/db/${col}`);
  return Array.isArray(res.items) ? res.items : [];
}

async function getDocById<T>(col: string, id: string): Promise<T | null> {
  try {
    const res = await apiFetch<{ item: T }>(`/api/db/${col}/${encodeURIComponent(id)}`);
    return res.item || null;
  } catch (err: any) {
    if (err?.message?.includes('404') || err?.message?.includes('não encontrado')) {
      return null;
    }
    return null;
  }
}

async function setDocById<T>(col: string, id: string, data: T, merge = false): Promise<T> {
  const res = await apiFetch<{ item: T }>(
    `/api/db/${col}/${encodeURIComponent(id)}${merge ? '?merge=true' : ''}`,
    {
      method: 'PUT',
      body: JSON.stringify(removeUndefinedValues(data)),
    }
  );
  notifyLocalSubscribers([col]);
  return res.item;
}

async function updateDocById(col: string, id: string, updates: Record<string, any>): Promise<void> {
  await apiFetch(`/api/db/${col}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(removeUndefinedValues(updates)),
  });
  notifyLocalSubscribers([col]);
}

async function deleteDocById(col: string, id: string): Promise<void> {
  await apiFetch(`/api/db/${col}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  notifyLocalSubscribers([col]);
}

async function batchWrite(
  ops: { type: 'set' | 'update' | 'delete'; col: string; id: string; data?: any; merge?: boolean }[]
): Promise<void> {
  if (ops.length === 0) return;
  await apiFetch('/api/db/batch', {
    method: 'POST',
    body: JSON.stringify({
      ops: ops.map((o) => ({
        ...o,
        data: o.data ? removeUndefinedValues(o.data) : undefined,
      })),
    }),
  });
  notifyLocalSubscribers(Array.from(new Set(ops.map((o) => o.col))));
}

type ListenerFn = () => void;
const collectionSubscribers = new Map<string, Set<ListenerFn>>();
let eventSource: EventSource | null = null;
let fallbackInterval: ReturnType<typeof setInterval> | null = null;
let syncChannel: BroadcastChannel | null = null;
let syncListenersBound = false;
let versionCheckInFlight = false;
let versionsInitialized = false;
let lastKnownVersions: Record<string, number> = {};

function notifyLocalSubscribers(collections: string[], broadcastToTabs = true) {
  const unique = Array.from(new Set(collections));
  if (unique.length === 0) return;

  for (const col of unique) {
    const subs = collectionSubscribers.get(col);
    if (subs) {
      subs.forEach((fn) => fn());
    }
  }

  if (broadcastToTabs && syncChannel) {
    try {
      syncChannel.postMessage({ collections: unique, ts: Date.now() });
    } catch {}
  }
}

function applyServerVersions(
  serverVersions: Record<string, number> | undefined,
  explicitCollections?: string[]
) {
  const changed = new Set<string>(explicitCollections || []);

  if (serverVersions && typeof serverVersions === 'object') {
    if (!versionsInitialized) {
      lastKnownVersions = { ...serverVersions };
      versionsInitialized = true;
    } else {
      for (const [col, ver] of Object.entries(serverVersions)) {
        if (typeof ver === 'number' && ver !== lastKnownVersions[col]) {
          changed.add(col);
          lastKnownVersions[col] = ver;
        }
      }
    }
  }

  if (changed.size > 0) {
    notifyLocalSubscribers(Array.from(changed), false);
  }
}

async function checkVersionsFromServer() {
  if (typeof window === 'undefined' || versionCheckInFlight) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  versionCheckInFlight = true;
  try {
    const res = await apiFetch<{ versions: Record<string, number> }>('/api/realtime/versions', {
      cache: 'no-store',
    });
    applyServerVersions(res?.versions);
  } catch {
    // Ignore transient network hiccups; next tick retries automatically
  } finally {
    versionCheckInFlight = false;
  }
}

function ensureRealtimeConnection() {
  if (typeof window === 'undefined') return;

  if (!syncChannel && typeof BroadcastChannel !== 'undefined') {
    try {
      syncChannel = new BroadcastChannel('ptb_midia_sync');
      syncChannel.onmessage = (msg) => {
        if (Array.isArray(msg?.data?.collections)) {
          notifyLocalSubscribers(msg.data.collections, false);
        }
      };
    } catch {}
  }

  if (!eventSource) {
    try {
      eventSource = new EventSource('/api/realtime');
      eventSource.onopen = () => {
        void checkVersionsFromServer();
      };
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          applyServerVersions(
            data?.versions,
            Array.isArray(data?.collections) ? data.collections : undefined
          );
        } catch {}
      };
      eventSource.onerror = () => {
        // EventSource automatically reconnects; version check & focus listeners handle recovery
      };
    } catch {}
  }

  if (!syncListenersBound) {
    syncListenersBound = true;
    window.addEventListener('focus', () => {
      void checkVersionsFromServer();
    });
    window.addEventListener('online', () => {
      void checkVersionsFromServer();
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void checkVersionsFromServer();
        }
      });
    }
  }

  if (!fallbackInterval) {
    fallbackInterval = setInterval(() => {
      void checkVersionsFromServer();
    }, 2000);
  }
}

const CHUNK_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB chunks keep requests well below Cloud Run's 32 MiB cap

function parseXhrError(xhr: XMLHttpRequest): string {
  try {
    const parsed = JSON.parse(xhr.responseText);
    if (parsed?.error) return String(parsed.error);
  } catch {}
  return `Servidor respondeu com status ${xhr.status}`;
}

async function uploadSingleRequest(
  blob: Blob,
  filename: string,
  mimeType: string,
  onProgress?: (percent: number, speedText?: string) => void
): Promise<{ downloadUrl: string; filename: string; size?: number }> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    xhr.setRequestHeader('x-filename', encodeURIComponent(filename));
    xhr.setRequestHeader('Content-Type', mimeType || 'application/octet-stream');
    xhr.timeout = 180000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.min(99, Math.round((e.loaded / Math.max(1, e.total)) * 100));
        const elapsed = Math.max(0.1, (Date.now() - startTime) / 1000);
        const speedMb = e.loaded / (1024 * 1024) / elapsed;
        onProgress(percent, `${speedMb.toFixed(1)} MB/s`);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (pErr) {
          reject(pErr);
        }
      } else {
        reject(new Error(parseXhrError(xhr)));
      }
    };

    xhr.onerror = () => reject(new Error('Erro de conexão ao enviar arquivo.'));
    xhr.ontimeout = () => reject(new Error('Tempo limite de upload excedido.'));
    xhr.send(blob);
  });
}

async function uploadBinaryToServer(
  file: Blob,
  filename: string,
  mimeType: string,
  onProgress?: (percent: number, speedText?: string) => void
): Promise<{ downloadUrl: string; filename: string; size?: number }> {
  if (file.size <= CHUNK_SIZE_BYTES) {
    return uploadSingleRequest(file, filename, mimeType, onProgress);
  }

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);
  const initRes = await apiFetch<{ uploadId: string }>('/api/upload/init', {
    method: 'POST',
    body: JSON.stringify({
      filename,
      totalSize: file.size,
      totalChunks,
      mimeType: mimeType || 'application/octet-stream',
    }),
  });

  const startTime = Date.now();
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE_BYTES;
    const end = Math.min(file.size, start + CHUNK_SIZE_BYTES);
    const slice = file.slice(start, end);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload/chunk', true);
      xhr.setRequestHeader('x-upload-id', initRes.uploadId);
      xhr.setRequestHeader('x-chunk-index', String(chunkIndex));
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.timeout = 180000;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const totalLoaded = start + e.loaded;
          const percent = Math.min(98, Math.round((totalLoaded / file.size) * 100));
          const elapsed = Math.max(0.1, (Date.now() - startTime) / 1000);
          const speedMb = totalLoaded / (1024 * 1024) / elapsed;
          onProgress(percent, `${speedMb.toFixed(1)} MB/s`);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(parseXhrError(xhr)));
        }
      };
      xhr.onerror = () => reject(new Error('Erro de conexão durante envio em partes.'));
      xhr.ontimeout = () => reject(new Error('Tempo limite excedido ao enviar parte do arquivo.'));
      xhr.send(slice);
    });
  }

  if (onProgress) onProgress(99, 'Finalizando...');
  return await apiFetch<{ downloadUrl: string; filename: string; size?: number }>(
    '/api/upload/complete',
    {
      method: 'POST',
      body: JSON.stringify({
        uploadId: initRes.uploadId,
        filename,
        totalChunks,
      }),
    }
  );
}

function subscribeCollection<T>(
  col: string,
  transform: (items: T[]) => void
): () => void {
  ensureRealtimeConnection();

  let cancelled = false;
  let inFlight = false;
  let queued = false;

  const fetchAndEmit = async () => {
    if (cancelled) return;
    if (inFlight) {
      queued = true;
      return;
    }
    inFlight = true;
    try {
      const items = await listCol<T>(col);
      if (!cancelled) {
        transform(items);
      }
    } catch (err) {
      console.warn(`Realtime sync (${col}):`, err);
    } finally {
      inFlight = false;
      if (queued && !cancelled) {
        queued = false;
        void fetchAndEmit();
      }
    }
  };

  if (!collectionSubscribers.has(col)) {
    collectionSubscribers.set(col, new Set());
  }
  collectionSubscribers.get(col)!.add(fetchAndEmit);

  // Initial load
  void fetchAndEmit();

  return () => {
    cancelled = true;
    const set = collectionSubscribers.get(col);
    if (set) {
      set.delete(fetchAndEmit);
      if (set.size === 0) {
        collectionSubscribers.delete(col);
      }
    }
  };
}

// Local auth listeners
const authListeners = new Set<(user: User | null) => void>();
function emitAuthChange(user: User | null) {
  authListeners.forEach((cb) => {
    try {
      cb(user);
    } catch {}
  });
}

// ==========================================
// MAIN API OBJECT
// ==========================================
export const api = {
  // ==========================================
  // 1. AUTHENTICATION & PROFILE
  // ==========================================
  getCurrentSessionUser(): User | null {
    try {
      const stored = localStorage.getItem('ptb_session_user');
      if (stored) return JSON.parse(stored) as User;
    } catch {}
    return null;
  },

  getEffectiveUser(): { uid: string; displayName: string; email: string; user?: User } {
    const session = api.getCurrentSessionUser();
    if (session) {
      return {
        uid: session.uid,
        displayName: session.name || session.email || 'Usuário',
        email: session.email || '',
        user: session,
      };
    }
    return {
      uid: 'system_guest',
      displayName: 'Equipe PT-B',
      email: '',
    };
  },

  async loginWithGoogle(): Promise<User | null> {
    throw new Error('Login com Google desativado. Utilize seu e-mail e senha de acesso.');
  },

  async checkRedirectAuth(): Promise<User | null> {
    return null;
  },

  async loginWithEmail(email: string, pass: string): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanEmail || !cleanPass) {
      throw new Error('Informe e-mail e senha.');
    }

    const res = await apiFetch<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: cleanEmail, password: cleanPass }),
    });

    const profile = res.user;
    try {
      localStorage.setItem('ptb_session_user', JSON.stringify(profile));
    } catch {}
    emitAuthChange(profile);
    return profile;
  },

  async registerWithEmail(name: string, email: string, pass: string): Promise<User> {
    const res = await apiFetch<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: pass.trim(),
      }),
    });

    const profile = res.user;
    try {
      localStorage.setItem('ptb_session_user', JSON.stringify(profile));
    } catch {}
    emitAuthChange(profile);
    return profile;
  },

  async logout(): Promise<void> {
    try {
      localStorage.removeItem('ptb_session_user');
    } catch {}
    emitAuthChange(null);
  },

  async resetPassword(email: string, newPassword?: string): Promise<void> {
    await apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        ...(newPassword ? { newPassword } : {}),
      }),
    });
  },

  onAuthStateChanged(callback: (user: User | null) => void) {
    authListeners.add(callback);
    callback(api.getCurrentSessionUser());
    return () => {
      authListeners.delete(callback);
    };
  },

  async getUserProfile(uid: string, fallbackEmail: string = ''): Promise<User> {
    const effectiveEmail = fallbackEmail.trim().toLowerCase();
    try {
      const res = await apiFetch<{ user: User }>(
        `/api/auth/profile/${encodeURIComponent(uid)}${effectiveEmail ? `?email=${encodeURIComponent(effectiveEmail)}` : ''}`
      );
      if (res?.user) return res.user;
    } catch {}

    const session = api.getCurrentSessionUser();
    if (session && (session.uid === uid || (effectiveEmail && session.email?.toLowerCase() === effectiveEmail))) {
      return session;
    }

    throw new Error('Perfil de usuário não encontrado.');
  },

  // ==========================================
  // 2. USER MANAGEMENT (SUPER ADMIN & TEAM)
  // ==========================================
  async getUsers(): Promise<User[]> {
    try {
      const list = await listCol<User>('users');
      return list.map((u) => ({ ...u, id: u.uid || u.id, uid: u.uid || u.id || '' }));
    } catch (error) {
      console.warn('Could not list users:', error);
      const current = api.getCurrentSessionUser();
      return current ? [current] : [];
    }
  },

  async createTeamUser(data: {
    name: string;
    email: string;
    initialPassword: string;
    role: UserRole;
    avatar?: string;
  }): Promise<User> {
    const currentUser = api.getEffectiveUser();
    const res = await apiFetch<{ user: User }>('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    await api.addActivity({
      userId: currentUser.uid,
      userName: currentUser.displayName,
      action: 'role_change',
      actionLabel: 'Criou novo membro da equipe',
      targetType: 'user',
      targetName: res.user.name,
      details: `${res.user.roleLabel} (${res.user.email})`,
    });

    notifyLocalSubscribers(['users']);
    return res.user;
  },

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
    const roleLabels: Record<UserRole, string> = {
      super_admin: 'Super Administrador',
      media_admin: 'Administrador de Mídia',
      media_member: 'Membro da Mídia',
    };
    await updateDocById('users', uid, {
      role,
      roleLabel: roleLabels[role],
      canManageChurchPage: role === 'super_admin' || role === 'media_admin',
      updatedAt: new Date().toISOString(),
    });

    if (role === 'super_admin') {
      await setDocById('admins', uid, { uid, updatedAt: new Date().toISOString() }, true);
    } else {
      await deleteDocById('admins', uid).catch(() => {});
    }
  },

  async setUserStatus(uid: string, status: 'active' | 'blocked'): Promise<void> {
    await updateDocById('users', uid, {
      status,
      updatedAt: new Date().toISOString(),
    });
  },

  async updateUserChurchPermission(uid: string, canManageChurchPage: boolean): Promise<void> {
    await updateDocById('users', uid, {
      canManageChurchPage,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteTeamUser(uid: string): Promise<void> {
    await deleteDocById('users', uid);
    await deleteDocById('admins', uid).catch(() => {});
  },

  async createUser(data: { name: string; email: string; role: UserRole; avatar?: string; status?: 'active' | 'blocked' }): Promise<User> {
    return api.createTeamUser({
      name: data.name,
      email: data.email,
      initialPassword: 'MidiaPTB2026!#',
      role: data.role,
      avatar: data.avatar,
    });
  },

  async updateUser(uid: string, updates: Partial<User>): Promise<void> {
    if (updates.role) {
      await api.updateUserRole(uid, updates.role);
    }
    if (updates.status) {
      await api.setUserStatus(uid, updates.status);
    }
    if (updates.name || updates.avatar) {
      await updateDocById('users', uid, {
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.avatar ? { avatar: updates.avatar } : {}),
        updatedAt: new Date().toISOString(),
      });
    }
  },

  async uploadAvatar(file: File): Promise<string> {
    try {
      const res = await uploadBinaryToServer(
        file,
        `avatar_${Date.now()}_${file.name}`,
        file.type || 'image/jpeg'
      );
      if (res?.downloadUrl) return res.downloadUrl;
    } catch (err) {
      console.warn('Upload de avatar via API falhou, usando canvas fallback:', err);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 360;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  },

  async deleteUser(uid: string): Promise<void> {
    return api.deleteTeamUser(uid);
  },

  // ==========================================
  // 3. SERVER STORAGE & FILES
  // ==========================================
  async uploadFile(
    file: File,
    options: { folderId?: string | null; eventId?: string | null; tags?: string[] } = {},
    onProgress?: (progress: number, speedText?: string) => void
  ): Promise<FileRecord> {
    const currentUser = api.getEffectiveUser();

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const category = detectMediaCategory(file.name, file.type);
    const resolution = await getImageResolution(file);

    let generatedThumb: string | null = null;
    try {
      generatedThumb = await createFileThumbnail(file);
    } catch (thumbErr) {
      console.warn('Thumbnail generation note:', thumbErr);
    }

    const uploadResult = await uploadBinaryToServer(
      file,
      file.name,
      file.type || 'application/octet-stream',
      onProgress
    );

    const downloadUrl = uploadResult.downloadUrl;
    const storagePath = `/uploads/${uploadResult.filename}`;
    if (onProgress) onProgress(100, 'Concluído');

    let finalThumb = generatedThumb;
    if (!finalThumb) {
      if (downloadUrl.startsWith('data:image/')) {
        finalThumb = downloadUrl;
      } else if ((downloadUrl.startsWith('http') || downloadUrl.startsWith('/uploads/')) && (category === 'photo' || category === 'art')) {
        finalThumb = downloadUrl;
      }
    }

    const newRecord: FileRecord = {
      id: fileId,
      name: file.name,
      originalName: file.name,
      extension: ext,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      type: category,
      storagePath,
      storageKey: storagePath,
      downloadUrl,
      thumbnailUrl: finalThumb || null,
      folderId: options.folderId || null,
      eventId: options.eventId || null,
      ownerUid: currentUser.uid,
      ownerName: currentUser.displayName || currentUser.email || 'Membro da Mídia',
      userName: currentUser.displayName || currentUser.email || 'Membro da Mídia',
      isFavorite: false,
      inTrash: false,
      trashedAt: null,
      tags: options.tags && options.tags.length > 0 ? options.tags : ['recente', category],
      resolution: resolution || null,
      duration: category === 'video' ? 'Original' : category === 'audio' ? 'Master' : null,
      metadata: {
        uploadedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDocById('files', fileId, newRecord);

    await api.addActivity({
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email || 'Membro da Mídia',
      action: 'upload',
      actionLabel: `Upload de ${category === 'photo' ? 'foto' : category === 'video' ? 'vídeo' : category === 'art' ? 'arte gráfica' : category === 'audio' ? 'áudio' : 'documento'} original`,
      targetType: 'file',
      targetName: file.name,
      details: `${(file.size / (1024 * 1024)).toFixed(2)} MB · Servidor Local`,
    });

    return newRecord;
  },

  subscribeAllFiles(callback: (files: FileRecord[]) => void): () => void {
    return subscribeCollection<FileRecord>('files', (items) => {
      callback(
        items.map((f) => ({
          ...f,
          id: f.id,
          storageKey: f.storagePath,
          userName: f.ownerName,
        }))
      );
    });
  },

  subscribeAllFolders(callback: (folders: Folder[]) => void): () => void {
    return subscribeCollection<Folder>('folders', (items) => {
      callback(items);
    });
  },

  subscribeAllEvents(callback: (events: ChurchEvent[]) => void): () => void {
    return subscribeCollection<ChurchEvent>('events', (items) => {
      callback(items);
    });
  },

  async getFiles(params: {
    type?: string;
    folderId?: string | null;
    eventId?: string | null;
    isFavorite?: boolean;
    inTrash?: boolean;
    tag?: string;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  } = {}): Promise<FileRecord[]> {
    try {
      let list = (await listCol<FileRecord>('files')).map((f) => ({
        ...f,
        storageKey: f.storagePath,
        userName: f.ownerName,
      }));

      if (params.inTrash === true) {
        list = list.filter((f) => f.inTrash === true);
      } else {
        list = list.filter((f) => !f.inTrash);
      }

      if (params.type && params.type !== 'all') {
        list = list.filter((f) => f.type === params.type);
      }

      if (params.folderId !== undefined) {
        if (params.folderId === 'root' || params.folderId === null) {
          list = list.filter((f) => !f.folderId);
        } else if (params.folderId !== 'all') {
          list = list.filter((f) => f.folderId === params.folderId);
        }
      }

      if (params.eventId && params.eventId !== 'all') {
        list = list.filter((f) => f.eventId === params.eventId);
      }

      if (params.isFavorite === true) {
        list = list.filter((f) => f.isFavorite === true);
      }

      if (params.tag) {
        const t = params.tag.toLowerCase();
        list = list.filter((f) => f.tags && f.tags.map((x) => x.toLowerCase()).includes(t));
      }

      if (params.search) {
        const q = params.search.toLowerCase();
        list = list.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.ownerName.toLowerCase().includes(q) ||
            (f.tags && f.tags.some((t) => t.toLowerCase().includes(q))) ||
            f.extension.toLowerCase().includes(q)
        );
      }

      const sortKey = params.sort || 'date';
      const isAsc = params.order === 'asc';
      list.sort((a, b) => {
        if (sortKey === 'name') return (isAsc ? 1 : -1) * a.name.localeCompare(b.name);
        if (sortKey === 'size') return (isAsc ? 1 : -1) * (a.size - b.size);
        if (sortKey === 'type') return (isAsc ? 1 : -1) * a.type.localeCompare(b.type);
        return (isAsc ? 1 : -1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });

      return list;
    } catch (error) {
      console.warn('Could not list files:', error);
      return [];
    }
  },

  async updateFile(id: string, updates: Partial<FileRecord>): Promise<FileRecord> {
    await updateDocById('files', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    const updated = await getDocById<FileRecord>('files', id);
    if (!updated) throw new Error('Arquivo não encontrado');
    return {
      ...updated,
      storageKey: updated.storagePath,
      userName: updated.ownerName,
    };
  },

  async trashFile(id: string, permanent: boolean = false): Promise<void> {
    const currentUser = api.getEffectiveUser();
    const file = await getDocById<FileRecord>('files', id);
    if (!file) return;

    if (permanent) {
      await deleteDocById('files', id);
      await api.addActivity({
        userId: currentUser.uid,
        userName: currentUser.displayName,
        action: 'delete',
        actionLabel: 'Excluiu arquivo permanentemente',
        targetType: 'file',
        targetName: file.name,
        details: 'Arquivo removido definitivamente do servidor',
      });
    } else {
      await updateDocById('files', id, {
        inTrash: true,
        trashedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await api.addActivity({
        userId: currentUser.uid,
        userName: currentUser.displayName,
        action: 'delete',
        actionLabel: 'Moveu arquivo para a Lixeira',
        targetType: 'file',
        targetName: file.name,
        details: 'Preservado com segurança na lixeira',
      });
    }
  },

  async restoreFile(id: string): Promise<void> {
    const file = await getDocById<FileRecord>('files', id);
    await updateDocById('files', id, {
      inTrash: false,
      trashedAt: null,
      updatedAt: new Date().toISOString(),
    });

    if (file?.folderId) {
      const folder = await getDocById<Folder>('folders', file.folderId);
      if (folder?.inTrash) {
        await updateDocById('folders', file.folderId, {
          inTrash: false,
          trashedAt: null,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    }
  },

  async batchFiles(action: string, fileIds: string[], targetFolderId?: string): Promise<void> {
    for (const id of fileIds) {
      if (action === 'trash') await api.trashFile(id, false);
      if (action === 'restore') await api.restoreFile(id);
      if (action === 'delete_permanent') await api.trashFile(id, true);
      if (action === 'favorite') await api.updateFile(id, { isFavorite: true });
      if (action === 'move') await api.updateFile(id, { folderId: targetFolderId || null });
    }
  },

  // ==========================================
  // 4. FOLDERS
  // ==========================================
  async getFolders(inTrash = false): Promise<Folder[]> {
    try {
      const list = await listCol<Folder>('folders');
      return list.filter((f) => (inTrash ? f.inTrash === true : !f.inTrash));
    } catch (error) {
      console.warn('Could not list folders:', error);
      return [];
    }
  },

  async createFolder(name: string, parentId: string | null = null, color = '#D97706'): Promise<Folder> {
    const currentUser = api.getEffectiveUser();
    const folderId = `fld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const folder: Folder = {
      id: folderId,
      name: name.trim(),
      parentId: parentId || null,
      color,
      ownerUid: currentUser.uid,
      isFavorite: false,
      inTrash: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDocById('folders', folderId, folder);
    await api.addActivity({
      userId: currentUser.uid,
      userName: currentUser.displayName,
      action: 'create_folder',
      actionLabel: 'Criou nova pasta',
      targetType: 'folder',
      targetName: folder.name,
      details: parentId ? 'Subpasta criada' : 'Pasta raiz criada',
    });
    return folder;
  },

  async updateFolder(id: string, updates: Partial<Folder>): Promise<void> {
    await updateDocById('folders', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteFolder(id: string, permanent: boolean = false): Promise<void> {
    const currentUser = api.getEffectiveUser();
    const folder = await getDocById<Folder>('folders', id);
    const folderName = folder?.name || 'Pasta';

    const allFiles = await listCol<FileRecord>('files');
    const allFolders = await listCol<Folder>('folders');
    const childFiles = allFiles.filter((f) => f.folderId === id);
    const childFolders = allFolders.filter((f) => f.parentId === id);

    if (permanent) {
      const ops: { type: 'delete'; col: string; id: string }[] = [
        ...childFiles.map((f) => ({ type: 'delete' as const, col: 'files', id: f.id })),
        ...childFolders.map((f) => ({ type: 'delete' as const, col: 'folders', id: f.id })),
        { type: 'delete', col: 'folders', id },
      ];
      await batchWrite(ops);
      await api.addActivity({
        userId: currentUser.uid,
        userName: currentUser.displayName,
        action: 'delete',
        actionLabel: 'Excluiu pasta permanentemente',
        targetType: 'folder',
        targetName: folderName,
        details: 'Pasta e conteúdo removidos definitivamente',
      });
    } else {
      const now = new Date().toISOString();
      const ops: { type: 'update'; col: string; id: string; data: any }[] = [
        { type: 'update', col: 'folders', id, data: { inTrash: true, trashedAt: now, updatedAt: now } },
        ...childFiles.map((f) => ({
          type: 'update' as const,
          col: 'files',
          id: f.id,
          data: { inTrash: true, trashedAt: now, updatedAt: now },
        })),
        ...childFolders.map((f) => ({
          type: 'update' as const,
          col: 'folders',
          id: f.id,
          data: { inTrash: true, trashedAt: now, updatedAt: now },
        })),
      ];
      await batchWrite(ops);
      await api.addActivity({
        userId: currentUser.uid,
        userName: currentUser.displayName,
        action: 'delete',
        actionLabel: 'Moveu pasta para a Lixeira',
        targetType: 'folder',
        targetName: folderName,
        details: 'Preservada com segurança na lixeira',
      });
    }
  },

  async restoreFolder(id: string): Promise<void> {
    const currentUser = api.getEffectiveUser();
    const folder = await getDocById<Folder>('folders', id);
    const folderName = folder?.name || 'Pasta';
    const now = new Date().toISOString();

    const allFiles = await listCol<FileRecord>('files');
    const childFiles = allFiles.filter((f) => f.folderId === id);

    const ops: { type: 'update'; col: string; id: string; data: any }[] = [
      { type: 'update', col: 'folders', id, data: { inTrash: false, trashedAt: null, updatedAt: now } },
      ...childFiles.map((f) => ({
        type: 'update' as const,
        col: 'files',
        id: f.id,
        data: { inTrash: false, trashedAt: null, updatedAt: now },
      })),
    ];

    if (folder?.parentId) {
      const parent = await getDocById<Folder>('folders', folder.parentId);
      if (parent?.inTrash) {
        ops.push({
          type: 'update',
          col: 'folders',
          id: folder.parentId,
          data: { inTrash: false, trashedAt: null, updatedAt: now },
        });
      }
    }

    await batchWrite(ops);
    await api.addActivity({
      userId: currentUser.uid,
      userName: currentUser.displayName,
      action: 'create_folder',
      actionLabel: 'Restaurou pasta da Lixeira',
      targetType: 'folder',
      targetName: folderName,
      details: 'Pasta e arquivos retornaram ao local original',
    });
  },

  // ==========================================
  // 5. CHURCH EVENTS
  // ==========================================
  async getEvents(): Promise<ChurchEvent[]> {
    try {
      const [events, files] = await Promise.all([
        listCol<ChurchEvent>('events'),
        listCol<FileRecord>('files'),
      ]);
      const allFiles = files.filter((f) => !f.inTrash);

      return events.map((evt) => {
        const eventFiles = allFiles.filter((f) => f.eventId === evt.id);
        return {
          ...evt,
          stats: {
            totalFiles: eventFiles.length,
            photos: eventFiles.filter((f) => f.type === 'photo').length,
            videos: eventFiles.filter((f) => f.type === 'video').length,
            arts: eventFiles.filter((f) => f.type === 'art').length,
            audios: eventFiles.filter((f) => f.type === 'audio').length,
            docs: eventFiles.filter((f) => f.type === 'document').length,
            totalBytes: eventFiles.reduce((acc, f) => acc + (f.size || 0), 0),
          },
        };
      });
    } catch (error) {
      console.warn('Could not list events:', error);
      return [];
    }
  },

  async getEvent(id: string): Promise<{ event: ChurchEvent; files: FileRecord[] }> {
    const event = await getDocById<ChurchEvent>('events', id);
    if (!event) throw new Error('Evento não encontrado');
    const files = await api.getFiles({ eventId: id, inTrash: false });
    return { event, files };
  },

  async createEvent(data: Partial<ChurchEvent>): Promise<ChurchEvent> {
    const currentUser = api.getEffectiveUser();
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newEvent: ChurchEvent = {
      id: eventId,
      name: data.name || '',
      description: data.description || '',
      date: data.date || new Date().toISOString().split('T')[0],
      time: data.time || '',
      location: data.location || '',
      isFestive: Boolean(data.isFestive),
      notes: data.notes || '',
      category: data.category || 'Culto de Domingo',
      coverUrl: data.coverUrl || '/assets/images/church_worship_stage_1790831714044.jpg',
      responsibles: data.responsibles || [currentUser.displayName || 'Mídia'],
      ownerUid: currentUser.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDocById('events', eventId, newEvent);
    await api.addActivity({
      userId: currentUser.uid,
      userName: currentUser.displayName,
      action: 'create_event',
      actionLabel: 'Criou novo evento da igreja',
      targetType: 'event',
      targetName: newEvent.name,
      details: `${newEvent.category} · ${newEvent.date}`,
    });
    return newEvent;
  },

  async updateEvent(id: string, updates: Partial<ChurchEvent>): Promise<void> {
    await updateDocById('events', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteEvent(id: string): Promise<void> {
    await deleteDocById('events', id);
  },

  // ==========================================
  // 6. SHARES
  // ==========================================
  async getShares(): Promise<ShareLink[]> {
    return await listCol<ShareLink>('shares');
  },

  async createShare(data: {
    resourceType: 'file' | 'folder' | 'event';
    resourceId: string;
    resourceName: string;
    allowDownload: boolean;
    requireAuth: boolean;
    expiresAt: string | null;
  }): Promise<ShareLink> {
    const currentUser = api.getEffectiveUser();
    const shareId = `shr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const token = `ptb_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;

    const newShare: ShareLink = {
      id: shareId,
      token,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      resourceName: data.resourceName,
      allowDownload: data.allowDownload,
      requireAuth: data.requireAuth,
      expiresAt: data.expiresAt,
      ownerUid: currentUser.uid,
      createdByName: currentUser.displayName,
      createdAt: new Date().toISOString(),
    };

    await setDocById('shares', shareId, newShare);
    return newShare;
  },

  async deleteShare(id: string): Promise<void> {
    await deleteDocById('shares', id);
  },

  async getSharedResource(token: string): Promise<{ share: ShareLink; resource: any }> {
    const shares = await listCol<ShareLink>('shares');
    const share = shares.find((s) => s.token === token);
    if (!share) throw new Error('Link de compartilhamento inválido ou expirado.');
    if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
      throw new Error('Este link de compartilhamento expirou.');
    }

    let resourceData: any = null;
    if (share.resourceType === 'file') {
      resourceData = await getDocById<FileRecord>('files', share.resourceId);
    } else if (share.resourceType === 'folder') {
      const folder = await getDocById<Folder>('folders', share.resourceId);
      const files = await api.getFiles({ folderId: share.resourceId, inTrash: false });
      resourceData = { folder, files };
    } else if (share.resourceType === 'event') {
      const event = await getDocById<ChurchEvent>('events', share.resourceId);
      const files = await api.getFiles({ eventId: share.resourceId, inTrash: false });
      resourceData = { event, files };
    }

    return { share, resource: resourceData };
  },

  // ==========================================
  // 7. ACTIVITIES AUDIT
  // ==========================================
  async getActivities(): Promise<Activity[]> {
    try {
      const list = await listCol<Activity>('activities');
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return list.slice(0, 50);
    } catch (error) {
      console.warn('Could not list activities:', error);
      return [];
    }
  },

  async addActivity(data: Omit<Activity, 'id' | 'createdAt'>): Promise<void> {
    const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newAct: Activity = {
      ...data,
      id: actId,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDocById('activities', actId, newAct);
    } catch (error) {
      console.warn('Could not record activity:', error);
    }
  },

  // ==========================================
  // 8. STORAGE STATS & SETTINGS
  // ==========================================
  async getSettings(): Promise<SystemSettings> {
    const defaultData: any = {
      churchName: 'PT-B Mídia',
      churchSubtitle: 'Central de Arquivos e Mídias',
      storageEngine: 'Servidor Dedicado PT-B Mídia',
      totalQuotaBytes: 2 * 1024 * 1024 * 1024 * 1024,
      updatedAt: new Date().toISOString(),
    };

    try {
      const existing = await getDocById<any>('settings', 'system');
      const baseData = existing ? { ...defaultData, ...existing } : defaultData;

      return {
        ...baseData,
        projectId: 'ptb-midia-local',
        storageBucket: '/uploads',
        firestoreDatabaseId: 'Banco Persistente Local',
        settings: baseData,
        gcsInstructions: {
          active: true,
          bucket: '/uploads',
          status: 'Armazenamento Dedicado Ativo',
        },
      };
    } catch {
      return {
        ...defaultData,
        projectId: 'ptb-midia-local',
        storageBucket: '/uploads',
        firestoreDatabaseId: 'Banco Persistente Local',
        settings: defaultData,
      };
    }
  },

  async updateSettings(updates: Partial<SystemSettings>): Promise<void> {
    await setDocById(
      'settings',
      'system',
      {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
      true
    );
  },

  async getStorageStats(): Promise<StorageStats> {
    try {
      const [allFiles, folders, events, users, shares, activities, settings] = await Promise.all([
        listCol<FileRecord>('files').catch(() => []),
        listCol<Folder>('folders').catch(() => []),
        listCol<ChurchEvent>('events').catch(() => []),
        listCol<User>('users').catch(() => []),
        listCol<ShareLink>('shares').catch(() => []),
        api.getActivities().catch(() => []),
        api.getSettings().catch(() => ({
          totalQuotaBytes: 2 * 1024 * 1024 * 1024 * 1024,
          churchName: 'PT-B Mídia',
          churchSubtitle: 'Central de Arquivos e Mídias',
          storageEngine: 'Servidor Dedicado PT-B Mídia',
          updatedAt: new Date().toISOString(),
        } as SystemSettings)),
      ]);

      const activeFiles = allFiles.filter((f) => !f.inTrash);
      const trashFiles = allFiles.filter((f) => f.inTrash);

      let totalBytesUsed = 0;
      let photosBytes = 0;
      let photosCount = 0;
      let videosBytes = 0;
      let videosCount = 0;
      let artsBytes = 0;
      let artsCount = 0;
      let audiosBytes = 0;
      let audiosCount = 0;
      let docsBytes = 0;
      let docsCount = 0;
      let othersBytes = 0;
      let othersCount = 0;

      for (const f of activeFiles) {
        totalBytesUsed += f.size || 0;
        switch (f.type) {
          case 'photo':
            photosBytes += f.size || 0;
            photosCount++;
            break;
          case 'video':
            videosBytes += f.size || 0;
            videosCount++;
            break;
          case 'art':
            artsBytes += f.size || 0;
            artsCount++;
            break;
          case 'audio':
            audiosBytes += f.size || 0;
            audiosCount++;
            break;
          case 'document':
            docsBytes += f.size || 0;
            docsCount++;
            break;
          default:
            othersBytes += f.size || 0;
            othersCount++;
            break;
        }
      }

      const totalQuota = settings.totalQuotaBytes;
      const availableBytes = Math.max(0, totalQuota - totalBytesUsed);
      const usedPercentage = totalQuota > 0 ? (totalBytesUsed / totalQuota) * 100 : 0;
      const trashBytes = trashFiles.reduce((acc, f) => acc + (f.size || 0), 0);

      return {
        totalBytesUsed,
        totalQuota,
        availableBytes,
        usedPercentage: Number(usedPercentage.toFixed(2)),
        breakdown: {
          photos: { bytes: photosBytes, count: photosCount },
          videos: { bytes: videosBytes, count: videosCount },
          arts: { bytes: artsBytes, count: artsCount },
          audios: { bytes: audiosBytes, count: audiosCount },
          documents: { bytes: docsBytes, count: docsCount },
          others: { bytes: othersBytes, count: othersCount },
          trash: { bytes: trashBytes, count: trashFiles.length },
        },
        counts: {
          totalFiles: activeFiles.length,
          totalFolders: folders.filter((f) => !f.inTrash).length,
          totalEvents: events.length,
          totalUsers: users.length,
          totalShares: shares.length,
        },
        recentActivities: activities,
      };
    } catch (error) {
      console.error('Error fetching storage stats:', error);
      return {
        totalBytesUsed: 0,
        totalQuota: 2 * 1024 * 1024 * 1024 * 1024,
        availableBytes: 2 * 1024 * 1024 * 1024 * 1024,
        usedPercentage: 0,
        breakdown: {
          photos: { bytes: 0, count: 0 },
          videos: { bytes: 0, count: 0 },
          arts: { bytes: 0, count: 0 },
          audios: { bytes: 0, count: 0 },
          documents: { bytes: 0, count: 0 },
          others: { bytes: 0, count: 0 },
          trash: { bytes: 0, count: 0 },
        },
        counts: {
          totalFiles: 0,
          totalFolders: 0,
          totalEvents: 0,
          totalUsers: 1,
          totalShares: 0,
        },
        recentActivities: [],
      };
    }
  },

  // ==========================================
  // 9. DOWNLOAD & MEDIA RESOLUTION HELPERS
  // ==========================================
  async resolveMediaUrl(file: FileRecord, preferOriginal: boolean = false): Promise<string | null> {
    const primary = preferOriginal ? file.downloadUrl : file.thumbnailUrl;
    const secondary = preferOriginal ? file.thumbnailUrl : file.downloadUrl;
    const source = primary || secondary;
    if (!source) return null;
    return source;
  },

  async resolveFileBlob(file: FileRecord): Promise<Blob | null> {
    const url = file.downloadUrl || file.thumbnailUrl;
    if (!url) return null;

    if (url.startsWith('data:')) {
      const arr = url.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || file.mimeType || 'application/octet-stream';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr] as any, { type: mime });
    }

    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  },

  async triggerDownload(urlOrRecord: string | FileRecord, customFilename?: string) {
    let url = typeof urlOrRecord === 'string' ? urlOrRecord : urlOrRecord.downloadUrl;
    let filename = customFilename || (typeof urlOrRecord === 'object' ? urlOrRecord.name : '');

    if (url.includes('/api/files/') && url.includes('/download')) {
      const match = url.match(/\/api\/files\/([^/]+)\/download/);
      if (match && match[1]) {
        const record = await getDocById<FileRecord>('files', match[1]);
        if (record) {
          url = record.downloadUrl || url;
          if (!filename) filename = record.name;
        }
      }
    }

    if (url.startsWith('data:')) {
      try {
        const arr = url.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr] as any, { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || 'arquivo_original';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          link.remove();
        }, 1000);
        return;
      } catch (dataUrlErr) {
        console.warn('Data URL download error:', dataUrlErr);
      }
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || url.split('/').pop() || 'arquivo_original';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          link.remove();
        }, 1000);
        return;
      }
    } catch {}

    const directUrl = url.startsWith('/uploads/')
      ? `/api/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename || '')}`
      : url;

    const link = document.createElement('a');
    link.href = directUrl;
    link.download = filename || 'arquivo_original';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
    }, 1000);
  },

  async downloadMultipleZip(items: (FileRecord | string)[], zipName: string = 'PTB_Midia_Arquivos') {
    const zip = new JSZip();
    const files: FileRecord[] = [];

    for (const item of items) {
      if (typeof item === 'string') {
        const docItem = await getDocById<FileRecord>('files', item);
        if (docItem) files.push(docItem);
      } else {
        files.push(item);
      }
    }

    for (const file of files) {
      try {
        const blob = await api.resolveFileBlob(file);
        if (blob) {
          zip.file(file.name, blob);
        }
      } catch (err) {
        console.warn(`Could not fetch file for zip: ${file.name}`, err);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${zipName}.zip`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 1000);
  },

  async downloadFolderZip(folder: Folder) {
    const files = await api.getFiles({ folderId: folder.id, inTrash: false });
    await api.downloadMultipleZip(files, `${folder.name.replace(/[^a-zA-Z0-9_\-\s]/g, '')}_ZIP`);
  },

  async downloadEventZip(event: ChurchEvent) {
    const files = await api.getFiles({ eventId: event.id, inTrash: false });
    const zip = new JSZip();

    const categorySubfolders: Record<string, string> = {
      photo: '01_Fotos_Originais',
      video: '02_Videos_Transmissoes',
      art: '03_Artes_Graficas',
      audio: '04_Audios_Louvor',
      document: '05_Documentos',
      other: '06_Outros',
    };

    for (const file of files) {
      try {
        const folderName = categorySubfolders[file.type] || '06_Outros';
        const blob = await api.resolveFileBlob(file);
        if (blob) {
          zip.folder(folderName)?.file(file.name, blob);
        }
      } catch (err) {
        console.warn(`Could not download file for event zip: ${file.name}`, err);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.name.replace(/[^a-zA-Z0-9_\-\s]/g, '')}_COMPLETO.zip`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 1000);
  },

  // ==========================================
  // 10. PUBLIC CHURCH PAGE SERVICES
  // ==========================================
  getDefaultChurchProfile(): ChurchProfile {
    return {
      id: 'profile',
      name: 'IEADAM Petrópolis B',
      slogan: 'Uma igreja acolhedora, firmada na Palavra e viva no amor de Cristo.',
      highlightVerse: {
        text: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.',
        reference: 'João 3:16',
      },
      welcomeMessage:
        'Seja muito bem-vindo à nossa comunidade de fé! Estamos de braços abertos para caminhar com você e sua família no discipulado e na comunhão com Cristo Jesus.',
      history:
        'A Igreja Evangélica Assembleia de Deus no Amazonas - Petrópolis B (IEADAM Petrópolis B) nasceu do anseio fervoroso de proclamar o Evangelho fiel às Escrituras Sagradas. Ao longo de sua trajetória, tem servido com cultos inspiradores, discipulado bíblico, assistência às famílias e ministérios atuantes em todas as faixas etárias.',
      mission:
        'Glorificar a Deus através da pregação integral do Evangelho, da adoração bíblica, do discipulado e do serviço amoroso à comunidade.',
      vision:
        'Ser uma igreja espiritualmente viva, acolhedora, multiplicadora de líderes e referência de integridade e amor prático no bairro e no mundo.',
      values: [
        'Fidelidade incondicional à Bíblia Sagrada',
        'Comunhão fraternal sincera e acolhimento',
        'Oração constante e dependência do Espírito Santo',
        'Adoração com reverência e alegria',
        'Missões e compromisso evangelístico',
        'Cuidado com a família e a próxima geração',
      ],
      leadership: [
        {
          id: 'lead-1',
          name: 'Pr. Pedro Martins',
          role: 'Pastor Titular & Ministério Pastoral',
          bio: 'Dedicado ao ensino expositivo das Escrituras, ao aconselhamento bíblico e à visão da igreja.',
          photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        },
      ],
      serviceTimes: [
        {
          id: 'st-1',
          day: 'Domingo',
          time: '09h00',
          title: 'Escola Bíblica Dominical (EBD)',
          description: 'Classes de estudo bíblico aprofundado para crianças, jovens, adultos e novos convertidos.',
        },
        {
          id: 'st-2',
          day: 'Domingo',
          time: '18h30',
          title: 'Culto de Celebração & Louvor',
          description: 'Nosso culto principal com louvor congregacional, proclamação da Palavra e celebração.',
        },
        {
          id: 'st-3',
          day: 'Quarta-feira',
          time: '19h30',
          title: 'Culto de Oração & Doutrina',
          description: 'Momento de intercessão comunitária e estudo temático das Escrituras.',
        },
        {
          id: 'st-4',
          day: 'Sábado',
          time: '19h30',
          title: 'Culto de Jovens (Conexão)',
          description: 'Reunião vibrante de juventude com louvor contemporâneo, comunhão e dinâmicas bíblicas.',
        },
      ],
      heroBannerUrl:
        'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1800&q=80',
      contact: {
        phone: '(82) 3321-4500',
        whatsapp: '(82) 99876-5432',
        email: 'contato@pibt.org.br',
        address: 'Av. Doutor Jorge Montenegro Barros, Tabuleiro do Martins',
        cityState: 'Maceió - AL, CEP 57081-000',
        mapsEmbedUrl:
          'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3933.8821946252926!2d-35.76569112417772!3d-9.589839990494498!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x7014603953d5a57%3A0x6a0907a934440035!2sTabuleiro%20do%20Martins%2C%20Macei%C3%B3%20-%20AL!5e0!3m2!1spt-BR!2sbr!4v1715000000000!5m2!1spt-BR!2sbr',
        mapsLink: 'https://maps.google.com/?q=Tabuleiro+do+Martins+Maceio',
      },
      social: {
        instagram: 'https://instagram.com/pibt_oficial',
        youtube: 'https://youtube.com/@pibt_oficial',
        facebook: 'https://facebook.com/pibt.oficial',
        spotify: 'https://spotify.com',
      },
      updatedAt: new Date().toISOString(),
    };
  },

  async getChurchProfile(): Promise<ChurchProfile> {
    try {
      const existing = await getDocById<ChurchProfile>('church_settings', 'profile');
      if (existing) return existing;
    } catch {}
    return api.getDefaultChurchProfile();
  },

  async updateChurchProfile(profileData: Partial<ChurchProfile>): Promise<ChurchProfile> {
    const effective = api.getEffectiveUser();
    const updated: Partial<ChurchProfile> = {
      ...profileData,
      updatedAt: new Date().toISOString(),
      updatedBy: effective.displayName || 'Administrador',
    };
    return await setDocById('church_settings', 'profile', updated as ChurchProfile, true);
  },

  async getChurchAnnouncements(publishedOnly: boolean = false): Promise<ChurchAnnouncement[]> {
    try {
      let list = await listCol<ChurchAnnouncement>('church_announcements');
      if (publishedOnly) {
        list = list.filter((a) => a.status === 'published');
      }
      list.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime();
      });
      return list;
    } catch {
      return [];
    }
  },

  async createChurchAnnouncement(data: Omit<ChurchAnnouncement, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChurchAnnouncement> {
    const newId = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const announcement: ChurchAnnouncement = {
      ...data,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await setDocById('church_announcements', newId, announcement);
  },

  async updateChurchAnnouncement(id: string, updates: Partial<ChurchAnnouncement>): Promise<void> {
    await updateDocById('church_announcements', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteChurchAnnouncement(id: string): Promise<void> {
    await deleteDocById('church_announcements', id);
  },

  async getChurchPublicEvents(publishedOnly: boolean = false): Promise<ChurchPublicEvent[]> {
    try {
      let list = await listCol<ChurchPublicEvent>('church_events');
      if (publishedOnly) {
        list = list.filter((e) => e.status === 'published');
      }
      list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      return list;
    } catch {
      return [];
    }
  },

  async createChurchPublicEvent(data: Omit<ChurchPublicEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChurchPublicEvent> {
    const newId = `pub_event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const event: ChurchPublicEvent = {
      ...data,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await setDocById('church_events', newId, event);
  },

  async updateChurchPublicEvent(id: string, updates: Partial<ChurchPublicEvent>): Promise<void> {
    await updateDocById('church_events', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteChurchPublicEvent(id: string): Promise<void> {
    await deleteDocById('church_events', id);
  },

  async getChurchArticles(publishedOnly: boolean = false): Promise<ChurchArticle[]> {
    try {
      let list = await listCol<ChurchArticle>('church_articles');
      if (publishedOnly) {
        list = list.filter((a) => a.status === 'published');
      }
      list.sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
      return list;
    } catch {
      return [];
    }
  },

  async getChurchArticleById(id: string): Promise<ChurchArticle | null> {
    return await getDocById<ChurchArticle>('church_articles', id);
  },

  async createChurchArticle(data: Omit<ChurchArticle, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChurchArticle> {
    const newId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const article: ChurchArticle = {
      ...data,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await setDocById('church_articles', newId, article);
  },

  async updateChurchArticle(id: string, updates: Partial<ChurchArticle>): Promise<void> {
    await updateDocById('church_articles', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteChurchArticle(id: string): Promise<void> {
    await deleteDocById('church_articles', id);
  },

  async getChurchAlbums(publishedOnly: boolean = false): Promise<ChurchAlbum[]> {
    try {
      let list = await listCol<ChurchAlbum>('church_albums');
      if (publishedOnly) {
        list = list.filter((a) => a.status === 'published');
      }
      list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
      return list;
    } catch {
      return [];
    }
  },

  async createChurchAlbum(data: Omit<ChurchAlbum, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChurchAlbum> {
    const newId = `alb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const album: ChurchAlbum = {
      ...data,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await setDocById('church_albums', newId, album);
  },

  async updateChurchAlbum(id: string, updates: Partial<ChurchAlbum>): Promise<void> {
    await updateDocById('church_albums', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteChurchAlbum(id: string): Promise<void> {
    await deleteDocById('church_albums', id);
  },

  async getChurchDownloads(publishedOnly: boolean = false): Promise<ChurchDownload[]> {
    try {
      let list = await listCol<ChurchDownload>('church_downloads');
      if (publishedOnly) {
        list = list.filter((d) => d.status === 'published');
      }
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return list;
    } catch {
      return [];
    }
  },

  async createChurchDownload(data: Omit<ChurchDownload, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>): Promise<ChurchDownload> {
    const newId = `down_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const downloadItem: ChurchDownload = {
      ...data,
      id: newId,
      downloadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await setDocById('church_downloads', newId, downloadItem);
  },

  async updateChurchDownload(id: string, updates: Partial<ChurchDownload>): Promise<void> {
    await updateDocById('church_downloads', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteChurchDownload(id: string): Promise<void> {
    await deleteDocById('church_downloads', id);
  },

  async incrementChurchDownloadCount(id: string): Promise<void> {
    try {
      await apiFetch(`/api/church-downloads/${encodeURIComponent(id)}/increment`, {
        method: 'POST',
      });
    } catch {}
  },

  async seedInitialChurchDataIfEmpty(): Promise<void> {
    // Handled on server boot
  },

  // ==========================================
  // 12. CENTRAL DE AGENDA, ESCALAS & TAREFAS DA EQUIPE (REAL-TIME)
  // ==========================================
  subscribeTeamTasks(callback: (tasks: TeamTask[]) => void): () => void {
    return subscribeCollection<TeamTask>('team_tasks', (list) => {
      const priorityWeight: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
      const sorted = [...list].sort((a, b) => {
        if (a.status === 'concluido' && b.status !== 'concluido') return 1;
        if (a.status !== 'concluido' && b.status === 'concluido') return -1;
        const dateA = a.dueDate || '';
        const dateB = b.dueDate || '';
        const diffDate = dateA.localeCompare(dateB);
        if (diffDate !== 0) return diffDate;
        const pA = priorityWeight[a.priority || 'media'] || 0;
        const pB = priorityWeight[b.priority || 'media'] || 0;
        return pB - pA;
      });
      callback(sorted);
    });
  },

  async getTeamTasks(): Promise<TeamTask[]> {
    try {
      return await listCol<TeamTask>('team_tasks');
    } catch (err) {
      console.warn('Could not load team tasks:', err);
      return [];
    }
  },

  async createTeamTask(data: Partial<TeamTask>): Promise<TeamTask> {
    const effective = api.getEffectiveUser();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const task: TeamTask = {
      id: taskId,
      title: data.title || 'Novo Afazer',
      description: data.description || '',
      category: data.category || 'transmissao',
      eventId: data.eventId || null,
      eventName: data.eventName || null,
      assignedToUid: data.assignedToUid || effective.uid,
      assignedToName: data.assignedToName || effective.displayName,
      assignedToEmail: data.assignedToEmail || effective.email,
      assignedToAvatar: data.assignedToAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
      dueDate: data.dueDate || new Date().toISOString().split('T')[0],
      dueTime: data.dueTime || '18:00',
      priority: data.priority || 'media',
      status: data.status || 'pendente',
      createdByUid: effective.uid,
      createdByName: effective.displayName,
      isPrivate: data.isPrivate !== undefined ? data.isPrivate : (data.assignedToUid ? true : false),
      checklist: data.checklist || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDocById('team_tasks', taskId, task);
    await api.addActivity({
      userId: effective.uid,
      userName: effective.displayName,
      action: 'create_task',
      actionLabel: 'Escalou novo afazer de equipe',
      targetType: 'task',
      targetName: task.title,
      details: `${task.assignedToName} · ${task.dueDate}`,
    });
    return task;
  },

  async createBatchTeamTasks(tasksData: Partial<TeamTask>[]): Promise<TeamTask[]> {
    if (!tasksData || tasksData.length === 0) return [];
    const effective = api.getEffectiveUser();
    const createdTasks: TeamTask[] = [];
    const ops: { type: 'set'; col: string; id: string; data: TeamTask }[] = [];

    for (let i = 0; i < tasksData.length; i++) {
      const data = tasksData[i];
      const taskId = `task_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
      const task: TeamTask = {
        id: taskId,
        title: data.title || 'Novo Afazer',
        description: data.description || '',
        category: data.category || 'transmissao',
        eventId: data.eventId || null,
        eventName: data.eventName || null,
        assignedToUid: data.assignedToUid || effective.uid,
        assignedToName: data.assignedToName || effective.displayName,
        assignedToEmail: data.assignedToEmail || effective.email,
        assignedToAvatar: data.assignedToAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
        dueDate: data.dueDate || new Date().toISOString().split('T')[0],
        dueTime: data.dueTime || '18:00',
        priority: data.priority || 'media',
        status: data.status || 'pendente',
        createdByUid: effective.uid,
        createdByName: effective.displayName,
        isPrivate: data.isPrivate !== undefined ? data.isPrivate : (data.assignedToUid ? true : false),
        checklist: data.checklist || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      ops.push({ type: 'set', col: 'team_tasks', id: taskId, data: task });
      createdTasks.push(task);
    }

    await batchWrite(ops);
    await api.addActivity({
      userId: effective.uid,
      userName: effective.displayName,
      action: 'create_task',
      actionLabel: 'Escalou equipe em lote (escala express)',
      targetType: 'task',
      targetName: `${createdTasks.length} afazeres da equipe`,
      details: `${createdTasks[0]?.eventName || 'Escala de culto'} · ${createdTasks[0]?.dueDate}`,
    });
    return createdTasks;
  },

  async batchUpdateTaskStatus(taskIds: string[], newStatus: TeamTaskStatus): Promise<void> {
    if (!taskIds || taskIds.length === 0) return;
    const now = new Date().toISOString();
    await batchWrite(
      taskIds.map((id) => ({
        type: 'update' as const,
        col: 'team_tasks',
        id,
        data: { status: newStatus, updatedAt: now },
      }))
    );
  },

  async batchDeleteTeamTasks(taskIds: string[]): Promise<void> {
    if (!taskIds || taskIds.length === 0) return;
    await batchWrite(
      taskIds.map((id) => ({
        type: 'delete' as const,
        col: 'team_tasks',
        id,
      }))
    );
  },

  async updateTeamTask(id: string, updates: Partial<TeamTask>): Promise<void> {
    await updateDocById('team_tasks', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async toggleTaskComplete(id: string, currentStatus: TeamTaskStatus): Promise<void> {
    const isCompleted = currentStatus === 'concluido';
    const newStatus: TeamTaskStatus = isCompleted ? 'pendente' : 'concluido';
    await api.updateTeamTask(id, {
      status: newStatus,
      completedAt: newStatus === 'concluido' ? new Date().toISOString() : null,
    });
  },

  async deleteTeamTask(id: string): Promise<void> {
    await deleteDocById('team_tasks', id);
  },

  // ==========================================
  // 13. TRABALHO DE ANOTAÇÃO COLABORATIVA DA EQUIPE (REAL-TIME)
  // ==========================================
  subscribeTeamNotes(callback: (notes: TeamNote[]) => void): () => void {
    return subscribeCollection<TeamNote>('team_notes', (list) => {
      const sorted = [...list].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
        return timeB - timeA;
      });
      callback(sorted);
    });
  },

  async getTeamNotes(): Promise<TeamNote[]> {
    try {
      return await listCol<TeamNote>('team_notes');
    } catch (err) {
      console.warn('Could not load team notes:', err);
      return [];
    }
  },

  async createTeamNote(data: Partial<TeamNote>): Promise<TeamNote> {
    const effective = api.getEffectiveUser();
    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const note: TeamNote = {
      id: noteId,
      title: data.title || 'Nova Anotação',
      content: data.content || '',
      category: data.category || 'Alinhamento',
      color: data.color || 'amber',
      isPinned: !!data.isPinned,
      authorUid: effective.uid,
      authorName: effective.displayName,
      relatedEventId: data.relatedEventId || null,
      relatedEventName: data.relatedEventName || null,
      tags: data.tags || ['Equipe'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDocById('team_notes', noteId, note);
    return note;
  },

  async updateTeamNote(id: string, updates: Partial<TeamNote>): Promise<void> {
    await updateDocById('team_notes', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteTeamNote(id: string): Promise<void> {
    await deleteDocById('team_notes', id);
  },

  // ==========================================
  // LIVRO FINANCEIRO, CAIXA & GASTOS MÍDIA PT-B
  // ==========================================
  subscribeFinancialTransactions(callback: (records: FinancialTransaction[]) => void): () => void {
    return subscribeCollection<FinancialTransaction>('financial_records', (list) => {
      const sorted = [...list].sort(
        (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
      );
      callback(sorted);
    });
  },

  async getFinancialTransactions(): Promise<FinancialTransaction[]> {
    try {
      const list = await listCol<FinancialTransaction>('financial_records');
      list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
      return list;
    } catch (err) {
      console.warn('Could not load financial transactions:', err);
      return [];
    }
  },

  async createFinancialTransaction(data: Partial<FinancialTransaction>): Promise<FinancialTransaction> {
    const effective = api.getEffectiveUser();
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tx: FinancialTransaction = {
      id: txId,
      type: data.type || 'entrada',
      title: data.title || 'Lançamento Financeiro',
      amount: Number(data.amount) || 0,
      date: data.date || new Date().toISOString().split('T')[0],
      category: data.category || 'outro',
      description: data.description || '',
      counterparty: data.counterparty || 'Igreja / Ministério',
      paymentMethod: data.paymentMethod || 'pix',
      receipt: data.receipt || null,
      status: data.status || 'confirmado',
      createdByUid: effective.uid,
      createdByName: effective.displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDocById('financial_records', txId, tx);
    await api.addActivity({
      userId: effective.uid,
      userName: effective.displayName,
      action: tx.type === 'entrada' ? 'create_income' : 'create_expense',
      actionLabel: tx.type === 'entrada' ? 'Registrou Entrada de Caixa' : 'Registrou Saída de Caixa',
      targetType: 'finance',
      targetName: tx.title,
      details: `R$ ${tx.amount.toFixed(2)} · ${tx.counterparty}`,
    });
    return tx;
  },

  async updateFinancialTransaction(id: string, updates: Partial<FinancialTransaction>): Promise<void> {
    await updateDocById('financial_records', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteFinancialTransaction(id: string): Promise<void> {
    await deleteDocById('financial_records', id);
  },

  subscribeFinancialBills(callback: (bills: FinancialBill[]) => void): () => void {
    return subscribeCollection<FinancialBill>('financial_bills', (list) => {
      const sorted = [...list].sort((a, b) => {
        if (a.status === 'pendente' && b.status !== 'pendente') return -1;
        if (a.status !== 'pendente' && b.status === 'pendente') return 1;
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate && !b.dueDate) return -1;
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      callback(sorted);
    });
  },

  async getFinancialBills(): Promise<FinancialBill[]> {
    try {
      return await listCol<FinancialBill>('financial_bills');
    } catch (err) {
      console.warn('Could not load financial bills:', err);
      return [];
    }
  },

  async createFinancialBill(data: Partial<FinancialBill>): Promise<FinancialBill> {
    const effective = api.getEffectiveUser();
    const billId = `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const bill: FinancialBill = {
      id: billId,
      type: data.type || 'a_pagar',
      title: data.title || 'Conta / Previsão',
      amount: Number(data.amount) || 0,
      category: data.category || 'outro',
      description: data.description || '',
      counterparty: data.counterparty || 'Fornecedor / Responsável',
      dueDate: data.hasNoForecast ? null : (data.dueDate || null),
      hasNoForecast: !!data.hasNoForecast,
      priority: data.priority || 'media',
      status: data.status || 'pendente',
      receipt: data.receipt || null,
      createdByUid: effective.uid,
      createdByName: effective.displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDocById('financial_bills', billId, bill);
    await api.addActivity({
      userId: effective.uid,
      userName: effective.displayName,
      action: 'create_bill',
      actionLabel: bill.type === 'a_pagar' ? 'Cadastrou Conta a Pagar' : 'Cadastrou Conta a Receber',
      targetType: 'finance_bill',
      targetName: bill.title,
      details: `R$ ${bill.amount.toFixed(2)} · ${bill.counterparty}`,
    });
    return bill;
  },

  async updateFinancialBill(id: string, updates: Partial<FinancialBill>): Promise<void> {
    await updateDocById('financial_bills', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteFinancialBill(id: string): Promise<void> {
    await deleteDocById('financial_bills', id);
  },

  async settleFinancialBill(
    bill: FinancialBill,
    paymentMethod: FinancialPaymentMethod = 'pix',
    createTransaction: boolean = true
  ): Promise<FinancialTransaction | null> {
    await api.updateFinancialBill(bill.id, {
      status: 'pago',
      paidAt: new Date().toISOString(),
    });

    if (createTransaction) {
      const tx = await api.createFinancialTransaction({
        type: bill.type === 'a_pagar' ? 'saida' : 'entrada',
        title: bill.title,
        amount: bill.amount,
        date: new Date().toISOString().split('T')[0],
        category: bill.category,
        description: `Liquidação de conta (${bill.type === 'a_pagar' ? 'Conta Paga' : 'Conta Recebida'}): ${bill.description}`,
        counterparty: bill.counterparty,
        paymentMethod,
        receipt: bill.receipt || null,
        status: 'confirmado',
      });
      return tx;
    }
    return null;
  },

  async uploadFinancialReceipt(file: File): Promise<FinancialReceipt> {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
    const docType: 'image' | 'pdf' | 'document' = isImage ? 'image' : (isPdf ? 'pdf' : 'document');

    try {
      const res = await uploadBinaryToServer(
        file,
        `recibo_${Date.now()}_${file.name}`,
        file.type || 'application/octet-stream'
      );

      if (res?.downloadUrl) {
        return {
          url: res.downloadUrl,
          name: file.name,
          type: docType,
          size: file.size,
        };
      }
    } catch (err) {
      console.warn('Upload via /api/upload falhou, usando FileReader DataURL fallback:', err);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          url: reader.result as string,
          name: file.name,
          type: docType,
          size: file.size,
        });
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo de comprovante'));
      reader.readAsDataURL(file);
    });
  },

  // ==========================================
  // SISTEMA DE EVENTOS PÚBLICOS COM INSCRIÇÃO & QR CODE
  // ==========================================
  subscribePublicEvents(callback: (events: PublicRegistrationEvent[]) => void): () => void {
    return subscribeCollection<PublicRegistrationEvent>('public_events', (list) => {
      const sorted = [...list].sort(
        (a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
      );
      callback(sorted);
    });
  },

  async getPublicEvents(): Promise<PublicRegistrationEvent[]> {
    try {
      const list = await listCol<PublicRegistrationEvent>('public_events');
      list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
      return list;
    } catch (err) {
      console.warn('Could not load public events:', err);
      return [];
    }
  },

  async getPublicEventById(id: string): Promise<PublicRegistrationEvent | null> {
    return await getDocById<PublicRegistrationEvent>('public_events', id);
  },

  async createPublicEvent(data: Partial<PublicRegistrationEvent>): Promise<PublicRegistrationEvent> {
    const effective = api.getEffectiveUser();
    const eventId = `pubevent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const defaultStandardFields = {
      fullName: { enabled: true, required: true, label: 'Nome Completo' },
      phone: { enabled: true, required: true, label: 'Telefone / WhatsApp' },
      email: { enabled: true, required: false, label: 'E-mail' },
      church: { enabled: true, required: false, label: 'Igreja / Congregação' },
      area: { enabled: true, required: false, label: 'Área' },
      responsibleLeader: { enabled: true, required: false, label: 'Líder Responsável' },
      responsiblePastor: { enabled: true, required: false, label: 'Pastor Responsável' },
    };

    const event: PublicRegistrationEvent = {
      id: eventId,
      name: data.name || 'Novo Evento Público',
      description: data.description || '',
      date: data.date || new Date().toISOString().split('T')[0],
      time: data.time || '19:30',
      location: data.location || 'IEADAM Petrópolis B - Templo Central',
      bannerUrl: data.bannerUrl || null,
      themeColor: data.themeColor || 'amber',
      rulesAndNotes: data.rulesAndNotes || '• Chegue com 15 minutos de antecedência.\n• Apresente seu comprovante ou QR Code na entrada.\n• Evento sujeito à lotação do espaço.',
      maxRegistrations: data.maxRegistrations || null,
      status: data.status || 'aberto',
      standardFields: data.standardFields || defaultStandardFields,
      customFields: data.customFields || [],
      createdByUid: effective.uid,
      createdByName: effective.displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDocById('public_events', eventId, event);
    await api.addActivity({
      userId: effective.uid,
      userName: effective.displayName,
      action: 'create_public_event',
      actionLabel: 'Criou Evento Público com Inscrição',
      targetType: 'public_event',
      targetName: event.name,
      details: `${event.date} · ${event.location}`,
    });
    return event;
  },

  async updatePublicEvent(id: string, updates: Partial<PublicRegistrationEvent>): Promise<void> {
    await updateDocById('public_events', id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  async deletePublicEvent(id: string): Promise<void> {
    const regs = await listCol<EventRegistration & { docId?: string }>('event_registrations');
    const ops: { type: 'delete'; col: string; id: string }[] = [
      { type: 'delete', col: 'public_events', id },
      ...regs
        .filter((r) => r.eventId === id)
        .map((r) => ({ type: 'delete' as const, col: 'event_registrations', id: (r as any).firestoreDocId || r.id })),
    ];
    await batchWrite(ops);
  },

  subscribeEventRegistrations(eventId: string, callback: (registrations: EventRegistration[]) => void): () => void {
    return subscribeCollection<EventRegistration>('event_registrations', (items) => {
      const list = items
        .filter((r) => r.eventId === eventId)
        .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
      callback(list);
    });
  },

  async getEventRegistrations(eventId: string): Promise<EventRegistration[]> {
    try {
      const items = await listCol<EventRegistration>('event_registrations');
      return items
        .filter((r) => r.eventId === eventId)
        .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
    } catch (err) {
      console.warn(`Could not load registrations for event ${eventId}:`, err);
      return [];
    }
  },

  async createEventRegistration(data: Partial<EventRegistration>): Promise<EventRegistration> {
    const regCode = `PTB-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const regId = `reg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const isPaid = !!data.isPaidEvent;
    const initialPaymentStatus = data.paymentStatus || (isPaid ? 'waiting_confirmation' : 'free');
    const timeoutMin = data.extendedMinutes || 10;
    const nowMs = Date.now();
    const expiresAt = data.paymentExpiresAt || new Date(nowMs + timeoutMin * 60 * 1000).toISOString();

    const qrPayload = JSON.stringify({
      id: regCode,
      evento: data.eventName || 'Evento IEADAM Petrópolis B',
      nome: data.fullName,
      telefone: data.phone,
      email: data.email || '',
      igreja: data.church || '',
      area: data.area || '',
      lider: data.responsibleLeader || '',
      pastor: data.responsiblePastor || '',
      pago: isPaid ? 'SIM' : 'GRATUITO',
      valor: isPaid && data.ticketPrice ? `R$ ${data.ticketPrice.toFixed(2)}` : 'R$ 0,00',
      status: initialPaymentStatus === 'paid' || initialPaymentStatus === 'free' ? 'CONFIRMADO' : 'AGUARDANDO_PAGAMENTO',
      dataHora: new Date().toISOString(),
    });

    const registration: EventRegistration = {
      id: regCode,
      eventId: data.eventId || '',
      eventName: data.eventName || '',
      fullName: data.fullName || '',
      phone: data.phone || '',
      email: data.email || '',
      church: data.church || '',
      area: data.area || '',
      responsibleLeader: data.responsibleLeader || '',
      responsiblePastor: data.responsiblePastor || '',
      customResponses: data.customResponses || {},
      status: isPaid && initialPaymentStatus !== 'paid' ? 'pendente' : 'confirmada',
      qrCodeData: qrPayload,
      registeredAt: new Date().toISOString(),
      isPaidEvent: isPaid,
      ticketPrice: data.ticketPrice || 0,
      paymentType: data.paymentType || 'pix',
      paymentStatus: initialPaymentStatus,
      paymentRequestedAt: new Date().toISOString(),
      paymentExpiresAt: expiresAt,
      extendedMinutes: 0,
      maxWaitExceeded: false,
      paidConfirmedAt: initialPaymentStatus === 'paid' ? new Date().toISOString() : null,
    };

    await setDocById('event_registrations', regId, {
      ...registration,
      firestoreDocId: regId,
    });
    return { ...registration, id: regCode };
  },

  subscribeSingleRegistration(registrationId: string, callback: (reg: EventRegistration | null) => void): () => void {
    return subscribeCollection<EventRegistration & { firestoreDocId?: string }>('event_registrations', (items) => {
      const match = items.find((r) => r.id === registrationId || r.firestoreDocId === registrationId);
      callback(match || null);
    });
  },

  async findRegistrationDocKey(idOrCode: string): Promise<{ docKey: string; record: EventRegistration } | null> {
    const items = await listCol<EventRegistration & { firestoreDocId?: string }>('event_registrations');
    const found = items.find((r) => r.id === idOrCode || r.firestoreDocId === idOrCode);
    if (!found) return null;
    return { docKey: found.firestoreDocId || found.id, record: found };
  },

  async updateEventRegistration(id: string, updates: Partial<EventRegistration>): Promise<void> {
    const found = await api.findRegistrationDocKey(id);
    const key = found?.docKey || id;
    await updateDocById('event_registrations', key, updates);
  },

  async getEventRegistrationByCode(code: string): Promise<EventRegistration | null> {
    const cleanCode = code.trim();
    if (!cleanCode) return null;
    const found = await api.findRegistrationDocKey(cleanCode);
    return found?.record || null;
  },

  async markRegistrationCheckIn(
    id: string,
    present: boolean,
    adminUser?: { uid: string; name: string }
  ): Promise<EventRegistration | null> {
    const nowIso = new Date().toISOString();
    const updates: Partial<EventRegistration> = {
      status: present ? 'presente' : 'confirmada',
      checkInAt: present ? nowIso : null,
      checkedInByUid: present ? adminUser?.uid || null : null,
      checkedInByName: present ? adminUser?.name || 'Credenciamento' : null,
    };

    const found = await api.findRegistrationDocKey(id);
    if (!found) return null;
    await updateDocById('event_registrations', found.docKey, updates);
    const updatedRecord: EventRegistration = { ...found.record, ...updates };

    if (present) {
      await this.addActivity({
        userId: adminUser?.uid || 'system',
        userName: adminUser?.name || 'Credenciamento',
        action: 'event_checkin',
        actionLabel: 'Check-in QR no evento',
        targetType: 'event_registration',
        targetName: updatedRecord.fullName,
        details: `Presença confirmada em "${updatedRecord.eventName}" (${updatedRecord.id})`,
      }).catch(() => {});
    }

    return updatedRecord;
  },

  subscribeAllEventRegistrationsSummary(
    callback: (summaryMap: Record<string, EventRegistrationsSummary>) => void
  ): () => void {
    return subscribeCollection<EventRegistration>('event_registrations', (items) => {
      const map: Record<string, EventRegistrationsSummary> = {};
      items.forEach((r) => {
        if (!r.eventId) return;
        if (!map[r.eventId]) {
          map[r.eventId] = {
            total: 0,
            waiting: 0,
            paid: 0,
            rejected: 0,
            cashboxBalance: 0,
            pendingBalance: 0,
            rejectedBalance: 0,
          };
        }
        const s = map[r.eventId];
        s.total += 1;
        const price = Number(r.ticketPrice) || 0;
        if (r.paymentStatus === 'paid') {
          s.paid += 1;
          s.cashboxBalance += price;
        } else if (r.paymentStatus === 'waiting_confirmation') {
          s.waiting += 1;
          s.pendingBalance += price;
        } else if (r.paymentStatus === 'rejected' || r.status === 'cancelada') {
          s.rejected += 1;
          s.rejectedBalance += price;
        }
      });
      callback(map);
    });
  },

  async appendEventCashboxMovement(
    eventId: string,
    movement: Omit<EventCashboxMovement, 'id' | 'timestamp'>
  ): Promise<void> {
    if (!eventId) return;
    try {
      const evData = await getDocById<PublicRegistrationEvent>('public_events', eventId);
      if (!evData) return;
      const prevMovements = Array.isArray(evData.cashboxMovements) ? evData.cashboxMovements : [];
      const newEntry: EventCashboxMovement = {
        id: `cx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        ...movement,
      };
      const updatedMovements = [newEntry, ...prevMovements].slice(0, 120);
      await updateDocById('public_events', eventId, {
        cashboxMovements: updatedMovements,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Could not append event cashbox movement:', error);
    }
  },

  async confirmRegistrationPayment(
    id: string,
    adminUser?: { uid?: string; name?: string },
    fallbackPrice?: number
  ): Promise<{ wasAlreadyPaid: boolean; amount: number }> {
    const found = await api.findRegistrationDocKey(id);
    const key = found?.docKey || id;
    const existing = found?.record;

    const wasAlreadyPaid = existing?.paymentStatus === 'paid';
    const effectivePrice = Number(existing?.ticketPrice) || Number(fallbackPrice) || 0;

    await updateDocById('event_registrations', key, {
      paymentStatus: 'paid',
      status: 'confirmada',
      ticketPrice: effectivePrice,
      paidConfirmedAt: new Date().toISOString(),
      confirmedByAdminUid: adminUser?.uid || 'admin',
      confirmedByAdminName: adminUser?.name || 'Administrador / Vendedor',
      maxWaitExceeded: false,
      rejectionReason: null,
    });

    if (!wasAlreadyPaid && existing?.eventId) {
      await api.appendEventCashboxMovement(existing.eventId, {
        type: 'entrada',
        amount: effectivePrice,
        registrationId: existing.id || id,
        attendeeName: existing.fullName || 'Participante',
        paymentType: existing.paymentType,
        reason: 'Pagamento confirmado',
        adminName: adminUser?.name || 'Administrador / Vendedor',
      });
    }

    return { wasAlreadyPaid, amount: effectivePrice };
  },

  async rejectRegistrationPayment(
    id: string,
    reason?: string,
    adminUser?: { uid?: string; name?: string }
  ): Promise<{ wasPaid: boolean; amount: number }> {
    const found = await api.findRegistrationDocKey(id);
    const key = found?.docKey || id;
    const existing = found?.record;

    const wasPaid = existing?.paymentStatus === 'paid';
    const amount = Number(existing?.ticketPrice) || 0;

    await updateDocById('event_registrations', key, {
      paymentStatus: 'rejected',
      status: 'cancelada',
      paidConfirmedAt: null,
      rejectionReason: reason || 'Pagamento não identificado ou cancelado pelo administrador.',
    });

    if (wasPaid && existing?.eventId) {
      await api.appendEventCashboxMovement(existing.eventId, {
        type: 'estorno',
        amount,
        registrationId: existing.id || id,
        attendeeName: existing.fullName || 'Participante',
        paymentType: existing.paymentType,
        reason: 'Pagamento cancelado (Não Pagou)',
        adminName: adminUser?.name || 'Administrador / Vendedor',
      });
    }

    return { wasPaid, amount };
  },

  async extendRegistrationWaitTime(id: string, additionalMinutes: number = 5): Promise<void> {
    const found = await api.findRegistrationDocKey(id);
    const key = found?.docKey || id;
    const existing = found?.record;

    const currentExpires = existing?.paymentExpiresAt ? new Date(existing.paymentExpiresAt).getTime() : Date.now();
    const baseTime = Math.max(Date.now(), currentExpires);
    const newExpires = new Date(baseTime + additionalMinutes * 60 * 1000).toISOString();
    const prevExtended = existing?.extendedMinutes || 0;

    await updateDocById('event_registrations', key, {
      paymentExpiresAt: newExpires,
      extendedMinutes: prevExtended + additionalMinutes,
      maxWaitExceeded: false,
      paymentStatus: 'waiting_confirmation',
      status: 'pendente',
    });
  },

  async resetRegistrationToWaiting(
    id: string,
    minutes: number = 10,
    adminUser?: { uid?: string; name?: string }
  ): Promise<{ wasPaid: boolean; amount: number }> {
    const found = await api.findRegistrationDocKey(id);
    const key = found?.docKey || id;
    const existing = found?.record;

    const wasPaid = existing?.paymentStatus === 'paid';
    const amount = Number(existing?.ticketPrice) || 0;
    const newExpires = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    await updateDocById('event_registrations', key, {
      paymentStatus: 'waiting_confirmation',
      status: 'pendente',
      paidConfirmedAt: null,
      paymentExpiresAt: newExpires,
      maxWaitExceeded: false,
    });

    if (wasPaid && existing?.eventId) {
      await api.appendEventCashboxMovement(existing.eventId, {
        type: 'estorno',
        amount,
        registrationId: existing.id || id,
        attendeeName: existing.fullName || 'Participante',
        paymentType: existing.paymentType,
        reason: 'Confirmação revertida para a fila',
        adminName: adminUser?.name || 'Administrador / Vendedor',
      });
    }

    return { wasPaid, amount };
  },

  async deleteEventRegistration(
    id: string,
    adminUser?: { uid?: string; name?: string }
  ): Promise<{ wasPaid: boolean; amount: number }> {
    const found = await api.findRegistrationDocKey(id);
    const key = found?.docKey || id;
    const existing = found?.record;

    const wasPaid = existing?.paymentStatus === 'paid';
    const amount = Number(existing?.ticketPrice) || 0;

    await deleteDocById('event_registrations', key);

    if (wasPaid && existing?.eventId) {
      await api.appendEventCashboxMovement(existing.eventId, {
        type: 'estorno',
        amount,
        registrationId: existing.id || id,
        attendeeName: existing.fullName || 'Participante',
        paymentType: existing.paymentType,
        reason: 'Inscrição paga excluída',
        adminName: adminUser?.name || 'Administrador / Vendedor',
      });
    }

    return { wasPaid, amount };
  },

  async uploadEventBanner(file: File): Promise<string> {
    return api.uploadChurchImage(file, 'banner');
  },

  async uploadChurchImage(file: File, prefix = 'church'): Promise<string> {
    try {
      const res = await uploadBinaryToServer(
        file,
        `${prefix}_${Date.now()}_${file.name}`,
        file.type || 'image/jpeg'
      );
      if (res?.downloadUrl) return res.downloadUrl;
    } catch (err) {
      console.warn('Image upload via /api/upload fallback to canvas/FileReader:', err);
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            }
          } else {
            if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  },

  async seedInitialTeamScheduleIfEmpty(): Promise<void> {
    // Intentionally empty
  },

  // ==========================================
  // SISTEMA DE CHAMADA, PRESENÇA & FALTAS DE MEMBROS
  // ==========================================
  async ensureInitialAttendanceRoster(forceRestore = false): Promise<void> {
    await apiFetch('/api/attendance/seed', {
      method: 'POST',
      body: JSON.stringify({ forceRestore }),
    });
    notifyLocalSubscribers(['attendance_departments', 'attendance_members', 'settings']);
  },

  subscribeAttendanceDepartments(callback: (departments: AttendanceDepartment[]) => void) {
    return subscribeCollection<AttendanceDepartment>('attendance_departments', (list) => {
      const sorted = [...list].sort(
        (a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'pt-BR')
      );
      callback(sorted);
    });
  },

  subscribeAttendanceMembers(callback: (members: AttendanceMember[]) => void) {
    return subscribeCollection<AttendanceMember>('attendance_members', (list) => {
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      callback(sorted);
    });
  },

  subscribeAttendanceCalls(callback: (calls: AttendanceCall[]) => void) {
    return subscribeCollection<AttendanceCall>('attendance_calls', (list) => {
      const sorted = [...list].sort(
        (a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)
      );
      callback(sorted);
    });
  },

  async createAttendanceDepartment(
    name: string,
    kind: AttendanceDepartmentKind,
    order = 99
  ): Promise<AttendanceDepartment> {
    const effective = api.getEffectiveUser();
    const now = new Date().toISOString();
    const id = `dept_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const dept: AttendanceDepartment = {
      id,
      name: name.trim(),
      kind,
      order,
      createdByUid: effective.uid,
      createdByName: effective.displayName,
      createdAt: now,
      updatedAt: now,
    };

    await setDocById('attendance_departments', id, dept);
    await api.addActivity({
      userId: effective.uid,
      userName: effective.displayName,
      action: 'create_attendance_department',
      actionLabel: 'Criou Departamento/Equipe na Chamada',
      targetType: 'attendance',
      targetName: dept.name,
      details: `Tipo: ${kind}`,
    });
    return dept;
  },

  async updateAttendanceDepartment(
    departmentId: string,
    updates: { name: string; kind: AttendanceDepartmentKind; order?: number }
  ): Promise<void> {
    const effective = api.getEffectiveUser();
    const now = new Date().toISOString();
    await updateDocById('attendance_departments', departmentId, {
      name: updates.name.trim(),
      kind: updates.kind,
      ...(updates.order !== undefined ? { order: updates.order } : {}),
      updatedAt: now,
    });
    await api.addActivity({
      userId: effective.uid,
      userName: effective.displayName,
      action: 'update_attendance_department',
      actionLabel: 'Editou Categoria/Equipe na Chamada',
      targetType: 'attendance',
      targetName: updates.name.trim(),
      details: `Tipo: ${updates.kind}`,
    });
  },

  async deleteAttendanceDepartment(departmentId: string, departmentName?: string): Promise<void> {
    const members = await listCol<AttendanceMember>('attendance_members');
    const deptMembers = members.filter((m) => m.departmentId === departmentId);

    await batchWrite([
      ...deptMembers.map((m) => ({ type: 'delete' as const, col: 'attendance_members', id: m.id })),
      { type: 'delete', col: 'attendance_departments', id: departmentId },
    ]);

    const effective = api.getEffectiveUser();
    await api.addActivity({
      userId: effective.uid,
      userName: effective.displayName,
      action: 'delete_attendance_department',
      actionLabel: 'Excluiu Departamento/Equipe da Chamada',
      targetType: 'attendance',
      targetName: departmentName || departmentId,
      details: `${deptMembers.length} membro(s) removidos`,
    });
  },

  async createAttendanceMember(
    departmentId: string,
    name: string,
    extra?: {
      roleTitle?: string;
      phone?: string;
      email?: string;
      congregation?: string;
      area?: string;
      notes?: string;
    }
  ): Promise<AttendanceMember> {
    const effective = api.getEffectiveUser();
    const now = new Date().toISOString();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const id = `mem_${Date.now()}_${rand.toLowerCase()}`;
    const memberCode = `PTB-MEM-${Date.now().toString().slice(-5)}-${rand}`;
    const member: AttendanceMember = {
      id,
      departmentId,
      name: name.trim(),
      memberCode,
      roleTitle: extra?.roleTitle?.trim() || undefined,
      phone: extra?.phone?.trim() || undefined,
      email: extra?.email?.trim() || undefined,
      congregation: extra?.congregation?.trim() || 'IEADAM Petrópolis B',
      area: extra?.area?.trim() || undefined,
      notes: extra?.notes?.trim() || undefined,
      createdByUid: effective.uid,
      createdByName: effective.displayName,
      createdAt: now,
      updatedAt: now,
    };

    await setDocById('attendance_members', id, member);
    await api.addActivity({
      userId: effective.uid,
      userName: effective.displayName,
      action: 'create_attendance_member',
      actionLabel: 'Adicionou Membro na Chamada',
      targetType: 'attendance',
      targetName: member.name,
      details: `Código: ${memberCode}`,
    });
    return member;
  },

  async updateAttendanceMember(
    memberId: string,
    updates: {
      name: string;
      departmentId: string;
      roleTitle?: string;
      phone?: string;
      email?: string;
      congregation?: string;
      area?: string;
      notes?: string;
    }
  ): Promise<void> {
    const effective = api.getEffectiveUser();
    const now = new Date().toISOString();
    await updateDocById('attendance_members', memberId, {
      name: updates.name.trim(),
      departmentId: updates.departmentId,
      roleTitle: updates.roleTitle?.trim() || '',
      phone: updates.phone?.trim() || '',
      email: updates.email?.trim() || '',
      congregation: updates.congregation?.trim() || 'IEADAM Petrópolis B',
      area: updates.area?.trim() || '',
      notes: updates.notes?.trim() || '',
      updatedAt: now,
    });
    await api.addActivity({
      userId: effective.uid,
      userName: effective.displayName,
      action: 'update_attendance_member',
      actionLabel: 'Editou Membro na Chamada',
      targetType: 'attendance',
      targetName: updates.name.trim(),
      details: `Categoria ID: ${updates.departmentId}`,
    });
  },

  async deleteAttendanceMember(memberId: string, memberName?: string): Promise<void> {
    await deleteDocById('attendance_members', memberId);
    const effective = api.getEffectiveUser();
    await api.addActivity({
      userId: effective.uid,
      userName: effective.displayName,
      action: 'delete_attendance_member',
      actionLabel: 'Excluiu Membro da Chamada',
      targetType: 'attendance',
      targetName: memberName || memberId,
      details: 'Membro removido da lista de chamada',
    });
  },

  async claimAttendanceCall(
    callBase: AttendanceCall,
    operator?: { uid: string; name: string; email?: string }
  ): Promise<AttendanceCall> {
    const effective = api.getEffectiveUser();
    const op = {
      uid: operator?.uid || effective.uid,
      name: operator?.name || effective.displayName,
      email: operator?.email || effective.email || '',
    };
    const res = await apiFetch<{ call: AttendanceCall }>('/api/attendance/claim', {
      method: 'POST',
      body: JSON.stringify({ callBase, operator: op }),
    });
    notifyLocalSubscribers(['attendance_calls']);
    return res.call;
  },

  async releaseAttendanceCall(
    callId: string,
    operator?: { uid: string; name: string },
    markFinished = false
  ): Promise<AttendanceCall | null> {
    const effective = api.getEffectiveUser();
    const op = {
      uid: operator?.uid || effective.uid,
      name: operator?.name || effective.displayName,
    };
    const res = await apiFetch<{ call: AttendanceCall | null }>('/api/attendance/release', {
      method: 'POST',
      body: JSON.stringify({ callId, operator: op, markFinished }),
    });
    notifyLocalSubscribers(['attendance_calls']);
    return res.call;
  },

  async saveAttendanceCall(
    call: AttendanceCall,
    options?: { autoClaimIfFree?: boolean; operator?: { uid: string; name: string; email?: string } }
  ): Promise<AttendanceCall> {
    const effective = api.getEffectiveUser();
    const op = {
      uid: options?.operator?.uid || effective.uid,
      name: options?.operator?.name || effective.displayName,
      email: options?.operator?.email || effective.email || '',
    };
    const res = await apiFetch<{ call: AttendanceCall }>('/api/attendance/save', {
      method: 'POST',
      body: JSON.stringify({ call, options, operator: op }),
    });
    notifyLocalSubscribers(['attendance_calls']);
    return res.call;
  },

  async markMemberPresentByQr(
    callBase: AttendanceCall,
    member: AttendanceMember,
    department: AttendanceDepartment | undefined,
    operator?: { uid: string; name: string; email?: string }
  ): Promise<{
    outcome: 'checked_in_now' | 'already_present';
    call: AttendanceCall;
    entry: AttendanceEntry;
  }> {
    const effective = api.getEffectiveUser();
    const op = {
      uid: operator?.uid || effective.uid,
      name: operator?.name || effective.displayName,
      email: operator?.email || effective.email || '',
    };
    const res = await apiFetch<{
      outcome: 'checked_in_now' | 'already_present';
      call: AttendanceCall;
      entry: AttendanceEntry;
    }>('/api/attendance/qr-checkin', {
      method: 'POST',
      body: JSON.stringify({ callBase, member, department, operator: op }),
    });

    if (res.outcome === 'checked_in_now') {
      notifyLocalSubscribers(['attendance_calls']);
      await api.addActivity({
        userId: op.uid,
        userName: op.name,
        action: 'attendance_qr_checkin',
        actionLabel: 'Presença de Membro via QR Code',
        targetType: 'attendance',
        targetName: member.name,
        details: `Chamada: ${callBase.title} (${callBase.date})`,
      });
    }
    return res;
  },

  async deleteAttendanceCall(callId: string): Promise<void> {
    await deleteDocById('attendance_calls', callId);
  },
};
