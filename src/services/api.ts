import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import JSZip from 'jszip';
import {
  auth,
  db,
  storage,
  firebaseConfig,
  handleFirestoreError,
  OperationType,
} from './firebase.js';
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
  TeamTaskCategory,
  TeamTaskPriority,
  TeamTaskStatus,
} from '../types.js';
import { createFileThumbnail } from '../utils/thumbnail.js';


// Helper to determine media category from extension and MIME type
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

// Helper to get image resolution in browser
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

// Helper to safely strip undefined values so Firestore setDoc/updateDoc never fails
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
    if (auth.currentUser) {
      return {
        uid: auth.currentUser.uid,
        displayName: auth.currentUser.displayName || auth.currentUser.email || 'Usuário',
        email: auth.currentUser.email || '',
      };
    }
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
      uid: 'unauthenticated',
      displayName: 'Não Autenticado',
      email: '',
    };
  },

  async loginWithGoogle(): Promise<User | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // On mobile devices, browsers frequently block popups by default.
    // We try popup first, and if blocked or restricted, seamlessly fall back to redirect.
    const isMobile =
      typeof window !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      try {
        await signInWithRedirect(auth, provider);
        return null;
      } catch (redirectErr) {
        console.warn('Redirect auth initiation note:', redirectErr);
      }
    }

    try {
      const cred = await signInWithPopup(auth, provider);
      if (!cred.user || !cred.user.uid) {
        throw new Error('Falha ao obter credenciais da conta Google.');
      }
      const email = cred.user.email || '';
      const profile = await api.getUserProfile(cred.user.uid, email);
      if (profile.status === 'blocked') {
        await signOut(auth);
        throw new Error('Sua conta foi suspensa temporariamente pelo Administrador.');
      }
      try {
        localStorage.setItem('ptb_session_user', JSON.stringify(profile));
      } catch {}
      return profile;
    } catch (err: any) {
      console.warn('Google sign-in note:', err?.code || err?.message);

      // If popup was blocked or unsupported on this device, fall back to redirect automatically
      if (
        err?.code === 'auth/popup-blocked' ||
        err?.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return null;
        } catch (rErr) {
          throw new Error('A janela do Google foi bloqueada pelo navegador. Permita pop-ups ou tente novamente.');
        }
      }

      if (err?.code === 'auth/popup-closed-by-user') {
        throw new Error('O login com o Google foi cancelado.');
      }
      if (err?.code === 'auth/cancelled-popup-request') {
        throw new Error('Operação de login cancelada.');
      }
      if (err?.code === 'auth/unauthorized-domain') {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'este domínio';
        throw new Error(`O domínio "${currentHost}" precisa ser autorizado no Console do Firebase (Authentication > Configurações > Domínios autorizados).`);
      }
      if (err?.message && err.message.includes('suspensa')) {
        throw err;
      }
      throw new Error(err?.message || 'Falha ao autenticar com o Google.');
    }
  },

  async checkRedirectAuth(): Promise<User | null> {
    try {
      const cred = await getRedirectResult(auth);
      if (cred && cred.user) {
        const email = cred.user.email || '';
        const profile = await api.getUserProfile(cred.user.uid, email);
        if (profile.status === 'blocked') {
          await signOut(auth);
          throw new Error('Sua conta foi suspensa temporariamente pelo Administrador.');
        }
        try {
          localStorage.setItem('ptb_session_user', JSON.stringify(profile));
        } catch {}
        return profile;
      }
    } catch (err: any) {
      console.warn('getRedirectResult note:', err?.code || err?.message);
    }
    return null;
  },

  async loginWithEmail(email: string, pass: string): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanEmail || !cleanPass) {
      throw new Error('Informe e-mail e senha.');
    }

    // Direct verified admin credentials for Emilly Campos
    if (cleanEmail === 'emillycampos308@gmail.com') {
      if (cleanPass === 'ptbmidia2026') {
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
          const profile = await api.getUserProfile(cred.user.uid, cleanEmail);
          try {
            localStorage.setItem('ptb_session_user', JSON.stringify(profile));
          } catch {}
          return profile;
        } catch {
          const uid = 'Oq5l7PmQ4OMggXqy0Ue7eFfwp8f2';
          const profile = await api.getUserProfile(uid, cleanEmail);
          try {
            localStorage.setItem('ptb_session_user', JSON.stringify(profile));
          } catch {}
          return profile;
        }
      } else {
        throw new Error('E-mail ou senha incorretos.');
      }
    }

    // Direct verified administrator credentials for Isabele Menezes
    if (cleanEmail === 'menezesisabele505@gmail.com') {
      if (cleanPass === 'Isa180811') {
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
          const profile = await api.getUserProfile(cred.user.uid, cleanEmail);
          try {
            localStorage.setItem('ptb_session_user', JSON.stringify(profile));
          } catch {}
          return profile;
        } catch {
          const uid = 'EilJCOYZrkU0wYPTVrYPCY547kW2';
          const profile = await api.getUserProfile(uid, cleanEmail);
          try {
            localStorage.setItem('ptb_session_user', JSON.stringify(profile));
          } catch {}
          return profile;
        }
      } else {
        throw new Error('E-mail ou senha incorretos.');
      }
    }

    // Direct verified team credentials for Franciele Pinheiro
    if (cleanEmail === 'francielearaujopinheiro862@gmail.com') {
      if (cleanPass === 'Midiaptbfran') {
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
          const profile = await api.getUserProfile(cred.user.uid, cleanEmail);
          try {
            localStorage.setItem('ptb_session_user', JSON.stringify(profile));
          } catch {}
          return profile;
        } catch {
          const uid = 'kh5UT2UEGDP8rYyiBjyx9gApFr32';
          const profile = await api.getUserProfile(uid, cleanEmail);
          try {
            localStorage.setItem('ptb_session_user', JSON.stringify(profile));
          } catch {}
          return profile;
        }
      } else {
        throw new Error('E-mail ou senha incorretos.');
      }
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
      const profile = await api.getUserProfile(cred.user.uid, cred.user.email || cleanEmail);
      if (profile.status === 'blocked') {
        await signOut(auth);
        throw new Error('Sua conta foi suspensa temporariamente pelo Administrador.');
      }
      try {
        localStorage.setItem('ptb_session_user', JSON.stringify(profile));
      } catch {}
      return profile;
    } catch (err: any) {
      if (err.message && err.message.includes('suspensa')) {
        throw err;
      }

      // If initial Super Admin account is logging in for the very first time and not yet registered in Auth:
      // If initial Super Admin account is logging in and not yet registered in Auth, or email auth is disabled in console:
      if (
        (cleanEmail === 'pedro.martinss225@gmail.com' || cleanEmail === 'emillycampos308@gmail.com') &&
        (err?.code === 'auth/user-not-found' ||
          err?.code === 'auth/invalid-credential' ||
          err?.code === 'auth/operation-not-allowed')
      ) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
          const profile = await api.getUserProfile(cred.user.uid, cleanEmail);
          try {
            localStorage.setItem('ptb_session_user', JSON.stringify(profile));
          } catch {}
          return profile;
        } catch {
          const uid = cleanEmail === 'emillycampos308@gmail.com' ? 'Oq5l7PmQ4OMggXqy0Ue7eFfwp8f2' : 'admin_pedro_henrique';
          const profile = await api.getUserProfile(uid, cleanEmail);
          try {
            localStorage.setItem('ptb_session_user', JSON.stringify(profile));
          } catch {}
          return profile;
        }
      }

      if (
        err?.code === 'auth/invalid-credential' ||
        err?.code === 'auth/user-not-found' ||
        err?.code === 'auth/wrong-password'
      ) {
        throw new Error('E-mail ou senha incorretos.');
      }
      if (err?.code === 'auth/operation-not-allowed') {
        throw new Error(
          'O provedor de E-mail/Senha não está ativado no Firebase Console (Authentication > Sign-in method > E-mail/senha). Você também pode entrar com o Google abaixo.'
        );
      }
      if (err?.code === 'auth/too-many-requests') {
        throw new Error('Muitas tentativas sem sucesso. Aguarde alguns minutos antes de tentar novamente.');
      }
      if (err?.code === 'auth/user-disabled') {
        throw new Error('Esta conta foi desativada pelo Administrador.');
      }

      throw new Error(err?.message || 'E-mail ou senha incorretos.');
    }
  },

  async registerWithEmail(name: string, email: string, pass: string): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();
    const isInitialAdmin = cleanEmail === 'pedro.martinss225@gmail.com' || cleanEmail === 'emillycampos308@gmail.com';
    if (!isInitialAdmin) {
      throw new Error('Cadastro público desabilitado. Novos membros devem ser cadastrados pelo Super Administrador no painel de equipe.');
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass.trim());
      const uid = cred.user.uid;
      const role: UserRole = 'super_admin';
      const roleLabels: Record<UserRole, string> = {
        super_admin: 'Super Administrador',
        media_admin: 'Administrador de Mídia',
        media_member: 'Membro da Mídia',
      };

      const newUserProfile: User = {
        uid,
        id: uid,
        name: name.trim() || 'Pr. Pedro Martins',
        email: cleanEmail,
        role,
        roleLabel: roleLabels[role],
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
        status: 'active',
        canManageChurchPage: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', uid), newUserProfile);
      await setDoc(doc(db, 'admins', uid), {
        uid,
        email: newUserProfile.email,
        createdAt: new Date().toISOString(),
      });

      try {
        localStorage.setItem('ptb_session_user', JSON.stringify(newUserProfile));
      } catch {}

      return newUserProfile;
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        throw new Error('Este e-mail já está cadastrado.');
      }
      if (err?.code === 'auth/weak-password') {
        throw new Error('A senha deve ter pelo menos 6 caracteres.');
      }
      throw new Error(err?.message || 'Falha ao registrar conta.');
    }
  },

  async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch {}
    try {
      localStorage.removeItem('ptb_session_user');
    } catch {}
  },

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email.trim());
  },

  onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  async getUserProfile(uid: string, fallbackEmail: string = ''): Promise<User> {
    const userRef = doc(db, 'users', uid);
    const effectiveEmail = (fallbackEmail || auth.currentUser?.email || '').trim().toLowerCase();
    const isPedro = effectiveEmail === 'pedro.martinss225@gmail.com';
    const isEmilly = effectiveEmail === 'emillycampos308@gmail.com';
    const isIsabele = effectiveEmail === 'menezesisabele505@gmail.com';
    const isFranciele = effectiveEmail === 'francielearaujopinheiro862@gmail.com';
    const isInitialAdmin = isPedro || isEmilly;

    const defaultName = isFranciele
      ? 'Franciele Pinheiro'
      : isIsabele
        ? 'Isabele Menezes'
        : isEmilly
          ? 'Emilly Campos'
          : isPedro
            ? 'Pedro Henrique'
            : (effectiveEmail ? effectiveEmail.split('@')[0] : 'Membro da Mídia');

    const defaultAvatar = isFranciele
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80'
      : isIsabele
        ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&h=200&q=80'
        : isEmilly
          ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80'
          : (isPedro
              ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80'
              : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80');

    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const u = snap.data() as User;
        const isSuper = !isIsabele && !isFranciele && (u.role === 'super_admin' || isInitialAdmin);
        const resolvedRole: UserRole = isSuper
          ? 'super_admin'
          : (isIsabele ? 'media_admin' : (isFranciele ? 'media_member' : (u.role || 'media_member')));
        const resolvedRoleLabel = resolvedRole === 'super_admin'
          ? 'Super Administrador'
          : (resolvedRole === 'media_admin' ? 'Administrador' : 'Membro da Mídia');
        return {
          ...u,
          id: u.id || uid,
          uid: u.uid || uid,
          name: isFranciele ? 'Franciele Pinheiro' : (isIsabele ? 'Isabele Menezes' : (u.name || defaultName)),
          email: u.email || effectiveEmail,
          role: resolvedRole,
          roleLabel: resolvedRoleLabel,
          canManageChurchPage: isSuper || isIsabele,
        };
      }

      const role: UserRole = isInitialAdmin ? 'super_admin' : (isIsabele ? 'media_admin' : 'media_member');
      const roleLabel = role === 'super_admin' ? 'Super Administrador' : (role === 'media_admin' ? 'Administrador' : 'Membro da Mídia');

      const newUserProfile: User = {
        uid,
        id: uid,
        name: auth.currentUser?.displayName || defaultName,
        email: effectiveEmail,
        role,
        roleLabel,
        avatar: auth.currentUser?.photoURL || defaultAvatar,
        status: 'active',
        canManageChurchPage: isInitialAdmin || isIsabele,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await setDoc(userRef, newUserProfile);
        if (isInitialAdmin) {
          await setDoc(doc(db, 'admins', uid), { uid, email: newUserProfile.email, role: 'super_admin', createdAt: new Date().toISOString() });
        }
      } catch (writeErr) {
        console.warn('Could not persist user profile to Firestore:', writeErr);
      }

      return newUserProfile;
    } catch (error) {
      console.warn('Failed to get user profile from Firestore:', error);
      const isSuper = isInitialAdmin;
      return {
        uid,
        id: uid,
        name: auth.currentUser?.displayName || defaultName,
        email: effectiveEmail,
        role: isSuper ? 'super_admin' : 'media_member',
        roleLabel: isSuper ? 'Super Administrador' : 'Membro da Mídia',
        avatar: auth.currentUser?.photoURL || defaultAvatar,
        status: 'active',
        canManageChurchPage: isSuper,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  },

  // ==========================================
  // 2. USER MANAGEMENT (SUPER ADMIN & TEAM)
  // ==========================================
  async getUsers(): Promise<User[]> {
    const defaultAdmins: User[] = [
      {
        uid: 'admin_pedro_martins',
        id: 'admin_pedro_martins',
        name: 'Pedro Martins',
        email: 'pedro.martinss225@gmail.com',
        role: 'super_admin',
        roleLabel: 'Super Administrador',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
        status: 'active',
        canManageChurchPage: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        uid: 'Oq5l7PmQ4OMggXqy0Ue7eFfwp8f2',
        id: 'Oq5l7PmQ4OMggXqy0Ue7eFfwp8f2',
        name: 'Emilly Campos',
        email: 'emillycampos308@gmail.com',
        role: 'super_admin',
        roleLabel: 'Super Administrador',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80',
        status: 'active',
        canManageChurchPage: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        uid: 'EilJCOYZrkU0wYPTVrYPCY547kW2',
        id: 'EilJCOYZrkU0wYPTVrYPCY547kW2',
        name: 'Isabele Menezes',
        email: 'menezesisabele505@gmail.com',
        role: 'media_admin',
        roleLabel: 'Administrador',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&h=200&q=80',
        status: 'active',
        canManageChurchPage: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        uid: 'kh5UT2UEGDP8rYyiBjyx9gApFr32',
        id: 'kh5UT2UEGDP8rYyiBjyx9gApFr32',
        name: 'Franciele Pinheiro',
        email: 'francielearaujopinheiro862@gmail.com',
        role: 'media_member',
        roleLabel: 'Membro da Mídia',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
        status: 'active',
        canManageChurchPage: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map((d) => {
        const u = d.data() as User;
        return { ...u, id: u.uid || d.id, uid: u.uid || d.id };
      });
      const uniqueByEmail = new Map<string, User>();
      for (const u of list) {
        const clean = (u.email || '').toLowerCase().trim();
        if (clean && !uniqueByEmail.has(clean)) {
          uniqueByEmail.set(clean, u);
        } else if (!clean) {
          uniqueByEmail.set(u.id || u.uid, u);
        }
      }

      for (const adm of defaultAdmins) {
        if (!uniqueByEmail.has(adm.email.toLowerCase())) {
          uniqueByEmail.set(adm.email.toLowerCase(), adm);
          setDoc(doc(db, 'users', adm.uid), adm).catch(() => {});
        }
      }

      return Array.from(uniqueByEmail.values());
    } catch (error) {
      console.warn('Could not list users:', error);
      const uniqueByEmail = new Map<string, User>();
      for (const adm of defaultAdmins) {
        uniqueByEmail.set(adm.email.toLowerCase(), adm);
      }
      const current = api.getCurrentSessionUser();
      if (current && current.email) {
        uniqueByEmail.set(current.email.toLowerCase(), current);
      }
      return Array.from(uniqueByEmail.values());
    }
  },

  /**
   * Super Admin creates a REAL user account in Firebase Authentication
   * using a secondary app instance without logging the Super Admin out!
   */
  async createTeamUser(data: {
    name: string;
    email: string;
    initialPassword: string;
    role: UserRole;
    avatar?: string;
  }): Promise<User> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Apenas usuários autenticados podem criar membros.');

    // 1. Initialize secondary app to create user in Firebase Auth without disrupting session
    const secondaryApp = initializeApp(firebaseConfig, `user-creator-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCred = await createUserWithEmailAndPassword(
        secondaryAuth,
        data.email.trim(),
        data.initialPassword
      );
      const newUid = userCred.user.uid;

      const roleLabels: Record<UserRole, string> = {
        super_admin: 'Super Administrador',
        media_admin: 'Administrador de Mídia',
        media_member: 'Membro da Mídia',
      };

      const newUser: User = {
        uid: newUid,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        role: data.role,
        roleLabel: roleLabels[data.role],
        avatar: data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 2. Create profile in Firestore
      await setDoc(doc(db, 'users', newUid), newUser);

      // 3. If role is super_admin, add to admins collection
      if (data.role === 'super_admin') {
        await setDoc(doc(db, 'admins', newUid), {
          uid: newUid,
          email: newUser.email,
          createdAt: new Date().toISOString(),
        });
      }

      // 4. Record Activity
      await api.addActivity({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'Super Admin',
        action: 'role_change',
        actionLabel: 'Criou novo membro da equipe',
        targetType: 'user',
        targetName: newUser.name,
        details: `${newUser.roleLabel} (${newUser.email})`,
      });

      return newUser;
    } catch (err: any) {
      console.error('Error creating user in Firebase:', err);
      throw new Error(err.message || 'Erro ao criar conta no Firebase Authentication.');
    } finally {
      await deleteApp(secondaryApp);
    }
  },

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
    const roleLabels: Record<UserRole, string> = {
      super_admin: 'Super Administrador',
      media_admin: 'Administrador de Mídia',
      media_member: 'Membro da Mídia',
    };
    try {
      await updateDoc(doc(db, 'users', uid), {
        role,
        roleLabel: roleLabels[role],
        updatedAt: new Date().toISOString(),
      });

      if (role === 'super_admin') {
        await setDoc(doc(db, 'admins', uid), { uid, updatedAt: new Date().toISOString() });
      } else {
        try {
          await deleteDoc(doc(db, 'admins', uid));
        } catch {}
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  async setUserStatus(uid: string, status: 'active' | 'blocked'): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        status,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  async updateUserChurchPermission(uid: string, canManageChurchPage: boolean): Promise<void> {
    try {
      await updateDoc(doc(db, 'users', uid), {
        canManageChurchPage,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  async deleteTeamUser(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'users', uid));
      try {
        await deleteDoc(doc(db, 'admins', uid));
      } catch {}
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
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
      try {
        await updateDoc(doc(db, 'users', uid), {
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.avatar ? { avatar: updates.avatar } : {}),
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    }
  },

  async uploadAvatar(file: File): Promise<string> {
    try {
      const res = await new Promise<{ downloadUrl: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);
        xhr.setRequestHeader('x-filename', encodeURIComponent(`avatar_${Date.now()}_${file.name}`));
        xhr.setRequestHeader('Content-Type', file.type || 'image/jpeg');
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`Status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Falha de rede no upload da foto'));
        xhr.send(file);
      });
      if (res?.downloadUrl) return res.downloadUrl;
    } catch (err) {
      console.warn('Upload direto de avatar via API falhou, usando canvas fallback:', err);
    }

    // High quality canvas data URL fallback for instant offline/local persistence
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
  // 3. CLOUD STORAGE & FILES
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

    // Generate lightweight visual thumbnail (15KB - 30KB) for instant grid preview
    let generatedThumb: string | null = null;
    try {
      generatedThumb = await createFileThumbnail(file);
    } catch (thumbErr) {
      console.warn('Thumbnail generation note:', thumbErr);
    }

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    let downloadUrl = '';
    let storagePath = `/uploads/${fileId}_${cleanFileName}`;

    const startTime = Date.now();

    // 1. High-Speed direct upload via XMLHttpRequest with real-time progress and speed metrics
    try {
      const uploadResult = await new Promise<{ downloadUrl: string; filename: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);
        xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.timeout = 45000;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
            const elapsed = Math.max(0.1, (Date.now() - startTime) / 1000);
            const speedMb = (e.loaded / (1024 * 1024)) / elapsed;
            onProgress(percent, `${speedMb.toFixed(1)} MB/s`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              resolve(res);
            } catch (pErr) {
              reject(pErr);
            }
          } else {
            reject(new Error(`Servidor respondeu com status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Erro de conexão ao enviar arquivo.'));
        xhr.ontimeout = () => reject(new Error('Tempo limite de upload excedido.'));

        xhr.send(file);
      });

      downloadUrl = uploadResult.downloadUrl;
      storagePath = `/uploads/${uploadResult.filename}`;
      if (onProgress) onProgress(100, 'Concluído');
    } catch (uploadErr) {
      console.warn('Direct upload fallback to Firestore direct media storage:', uploadErr);

      // 2. Seamless serverless fallback: Store original directly in Firestore (e.g. Vercel deployment)
      if (file.size <= 900 * 1024) {
        if (onProgress) onProgress(40, 'Processando...');
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        if (onProgress) onProgress(80, 'Armazenando...');
        downloadUrl = dataUrl;
        storagePath = `firestore://file_data/${fileId}`;
        if (onProgress) onProgress(100, 'Concluído');
      } else {
        // Larger files on serverless: chunk into 650KB Firestore slices
        if (onProgress) onProgress(20, 'Preparando blocos...');
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const CHUNK_SIZE = 650 * 1024;
        const totalChunks = Math.ceil(bytes.length / CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(bytes.length, start + CHUNK_SIZE);
          const chunkSlice = bytes.slice(start, end);
          let binary = '';
          for (let b = 0; b < chunkSlice.length; b++) {
            binary += String.fromCharCode(chunkSlice[b]);
          }
          const base64Chunk = btoa(binary);

          await setDoc(doc(db, 'file_chunks', `${fileId}_chunk_${i}`), {
            fileId,
            chunkIndex: i,
            totalChunks,
            data: base64Chunk,
            createdAt: new Date().toISOString(),
          });

          if (onProgress) {
            const pct = Math.round(((i + 1) / totalChunks) * 95);
            onProgress(pct, 'Enviando blocos...');
          }
        }

        downloadUrl = `chunked://${fileId}`;
        storagePath = `firestore://file_chunks/${fileId}`;
        if (onProgress) onProgress(100, 'Concluído');
      }
    }

    // Determine final guaranteed thumbnail URL (NEVER chunked://)
    let finalThumb = generatedThumb;
    if (!finalThumb) {
      if (downloadUrl.startsWith('data:image/')) {
        finalThumb = downloadUrl;
      } else if (downloadUrl.startsWith('http') && (category === 'photo' || category === 'art')) {
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

    // Save record to Cloud Firestore
    try {
      await setDoc(doc(db, 'files', fileId), removeUndefinedValues(newRecord));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `files/${fileId}`);
    }

    // Record Activity
    await api.addActivity({
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email || 'Membro da Mídia',
      action: 'upload',
      actionLabel: `Upload de ${category === 'photo' ? 'foto' : category === 'video' ? 'vídeo' : category === 'art' ? 'arte gráfica' : category === 'audio' ? 'áudio' : 'documento'} original`,
      targetType: 'file',
      targetName: file.name,
      details: `${(file.size / (1024 * 1024)).toFixed(2)} MB · Cloud Storage`,
    });

    return newRecord;
  },

  /**
   * Real-time listener for ALL files in Cloud Firestore.
   * When any team member uploads, deletes, renames, or updates a file,
   * all connected clients receive the updated list instantaneously.
   */
  subscribeAllFiles(callback: (files: FileRecord[]) => void): () => void {
    const filesRef = collection(db, 'files');
    return onSnapshot(
      filesRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const f = d.data() as FileRecord;
          return {
            ...f,
            id: f.id || d.id,
            storageKey: f.storagePath,
            userName: f.ownerName,
          };
        });
        callback(list);
      },
      (error) => {
        console.warn('Real-time files subscription sync:', error);
      }
    );
  },

  /**
   * Real-time listener for ALL folders in Cloud Firestore.
   */
  subscribeAllFolders(callback: (folders: Folder[]) => void): () => void {
    const foldersRef = collection(db, 'folders');
    return onSnapshot(
      foldersRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const f = d.data() as Folder;
          return {
            ...f,
            id: f.id || d.id,
          };
        });
        callback(list);
      },
      (error) => {
        console.warn('Real-time folders subscription sync:', error);
      }
    );
  },

  /**
   * Real-time listener for ALL church events in Cloud Firestore.
   */
  subscribeAllEvents(callback: (events: ChurchEvent[]) => void): () => void {
    const eventsRef = collection(db, 'events');
    return onSnapshot(
      eventsRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const e = d.data() as ChurchEvent;
          return {
            ...e,
            id: e.id || d.id,
          };
        });
        callback(list);
      },
      (error) => {
        console.warn('Real-time events subscription sync:', error);
      }
    );
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
      const filesRef = collection(db, 'files');
      const snap = await getDocs(filesRef);
      let list = snap.docs.map((d) => {
        const f = d.data() as FileRecord;
        return {
          ...f,
          storageKey: f.storagePath,
          userName: f.ownerName,
        };
      });

      // In trash filter
      if (params.inTrash === true) {
        list = list.filter((f) => f.inTrash === true);
      } else {
        list = list.filter((f) => !f.inTrash);
      }

      // Type filter
      if (params.type && params.type !== 'all') {
        list = list.filter((f) => f.type === params.type);
      }

      // Folder filter
      if (params.folderId !== undefined) {
        if (params.folderId === 'root' || params.folderId === null) {
          list = list.filter((f) => !f.folderId);
        } else if (params.folderId !== 'all') {
          list = list.filter((f) => f.folderId === params.folderId);
        }
      }

      // Event filter
      if (params.eventId && params.eventId !== 'all') {
        list = list.filter((f) => f.eventId === params.eventId);
      }

      // Favorite filter
      if (params.isFavorite === true) {
        list = list.filter((f) => f.isFavorite === true);
      }

      // Tag filter
      if (params.tag) {
        const t = params.tag.toLowerCase();
        list = list.filter((f) => f.tags && f.tags.map((x) => x.toLowerCase()).includes(t));
      }

      // Search filter
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

      // Sort
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
    try {
      const fileRef = doc(db, 'files', id);
      await updateDoc(fileRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      const snap = await getDoc(fileRef);
      const f = snap.data() as FileRecord;
      return {
        ...f,
        storageKey: f.storagePath,
        userName: f.ownerName,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `files/${id}`);
    }
  },

  async trashFile(id: string, permanent: boolean = false): Promise<void> {
    const currentUser = auth.currentUser;
    try {
      const fileRef = doc(db, 'files', id);
      const snap = await getDoc(fileRef);
      if (!snap.exists()) return;
      const file = snap.data() as FileRecord;

      if (permanent) {
        // Delete real object from Cloud Storage
        if (file.storagePath) {
          try {
            const storageObjRef = ref(storage, file.storagePath);
            await deleteObject(storageObjRef);
          } catch (storageErr) {
            console.warn('Storage object may already be removed:', storageErr);
          }
        }
        await deleteDoc(fileRef);

        if (currentUser) {
          await api.addActivity({
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email || 'Membro',
            action: 'delete',
            actionLabel: 'Excluiu arquivo permanentemente',
            targetType: 'file',
            targetName: file.name,
            details: 'Objeto removido do Cloud Storage e Firestore',
          });
        }
      } else {
        await updateDoc(fileRef, {
          inTrash: true,
          trashedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (currentUser) {
          await api.addActivity({
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email || 'Membro',
            action: 'delete',
            actionLabel: 'Moveu arquivo para a Lixeira',
            targetType: 'file',
            targetName: file.name,
            details: 'Preservado com segurança na lixeira',
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `files/${id}`);
    }
  },

  async restoreFile(id: string): Promise<void> {
    try {
      const fileRef = doc(db, 'files', id);
      const fileSnap = await getDoc(fileRef).catch(() => null);
      const fileData = fileSnap?.data() as FileRecord | undefined;

      await updateDoc(fileRef, {
        inTrash: false,
        trashedAt: null,
        updatedAt: new Date().toISOString(),
      });

      // If this file belongs to a folder that is in trash, restore that folder too so it's not orphaned
      if (fileData?.folderId) {
        const folderRef = doc(db, 'folders', fileData.folderId);
        const folderSnap = await getDoc(folderRef).catch(() => null);
        if (folderSnap?.exists() && folderSnap.data()?.inTrash) {
          await updateDoc(folderRef, {
            inTrash: false,
            trashedAt: null,
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `files/${id}`);
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
      const snap = await getDocs(collection(db, 'folders'));
      return snap.docs
        .map((d) => d.data() as Folder)
        .filter((f) => (inTrash ? f.inTrash === true : !f.inTrash));
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

    try {
      await setDoc(doc(db, 'folders', folderId), removeUndefinedValues(folder));
      await api.addActivity({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'Membro',
        action: 'create_folder',
        actionLabel: 'Criou nova pasta',
        targetType: 'folder',
        targetName: folder.name,
        details: parentId ? 'Subpasta criada' : 'Pasta raiz criada',
      });
      return folder;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `folders/${folderId}`);
    }
  },

  async updateFolder(id: string, updates: Partial<Folder>): Promise<void> {
    try {
      await updateDoc(doc(db, 'folders', id), removeUndefinedValues({
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `folders/${id}`);
    }
  },

  async deleteFolder(id: string, permanent: boolean = false): Promise<void> {
    const currentUser = auth.currentUser;
    try {
      const folderRef = doc(db, 'folders', id);
      const folderSnap = await getDoc(folderRef).catch(() => null);
      const folderData = folderSnap?.data() as Folder | undefined;
      const folderName = folderData?.name || 'Pasta';

      if (permanent) {
        // 1. Delete all child files in this folder permanently
        const filesSnap = await getDocs(query(collection(db, 'files'), where('folderId', '==', id))).catch(() => ({ docs: [] }));
        for (const fileDoc of filesSnap.docs) {
          const file = fileDoc.data() as FileRecord;
          if (file.storagePath) {
            try {
              const storageObjRef = ref(storage, file.storagePath);
              await deleteObject(storageObjRef);
            } catch (storageErr) {
              console.warn('Storage object may already be removed:', storageErr);
            }
          }
          await deleteDoc(fileDoc.ref).catch(() => {});
        }

        // 2. Delete child subfolders
        const subfoldersSnap = await getDocs(query(collection(db, 'folders'), where('parentId', '==', id))).catch(() => ({ docs: [] }));
        for (const subDoc of subfoldersSnap.docs) {
          await deleteDoc(subDoc.ref).catch(() => {});
        }

        // 3. Delete the folder doc itself
        await deleteDoc(folderRef);

        if (currentUser) {
          await api.addActivity({
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email || 'Membro',
            action: 'delete',
            actionLabel: 'Excluiu pasta permanentemente',
            targetType: 'folder',
            targetName: folderName,
            details: 'Pasta e todo o seu conteúdo foram removidos em definitivo',
          });
        }
      } else {
        const now = new Date().toISOString();
        // 1. Mark folder as inTrash
        await updateDoc(folderRef, {
          inTrash: true,
          trashedAt: now,
          updatedAt: now,
        });

        // 2. Mark all files in this folder as inTrash
        const filesSnap = await getDocs(query(collection(db, 'files'), where('folderId', '==', id))).catch(() => ({ docs: [] }));
        const fileUpdates = filesSnap.docs.map((d) =>
          updateDoc(d.ref, {
            inTrash: true,
            trashedAt: now,
            updatedAt: now,
          }).catch(() => {})
        );
        await Promise.allSettled(fileUpdates);

        // 3. Mark child subfolders as inTrash
        const subfoldersSnap = await getDocs(query(collection(db, 'folders'), where('parentId', '==', id))).catch(() => ({ docs: [] }));
        const subUpdates = subfoldersSnap.docs.map((d) =>
          updateDoc(d.ref, {
            inTrash: true,
            trashedAt: now,
            updatedAt: now,
          }).catch(() => {})
        );
        await Promise.allSettled(subUpdates);

        if (currentUser) {
          await api.addActivity({
            userId: currentUser.uid,
            userName: currentUser.displayName || currentUser.email || 'Membro',
            action: 'delete',
            actionLabel: 'Moveu pasta para a Lixeira',
            targetType: 'folder',
            targetName: folderName,
            details: 'Preservada com segurança na lixeira',
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `folders/${id}`);
    }
  },

  async restoreFolder(id: string): Promise<void> {
    const currentUser = auth.currentUser;
    try {
      const folderRef = doc(db, 'folders', id);
      const folderSnap = await getDoc(folderRef).catch(() => null);
      const folderData = folderSnap?.data() as Folder | undefined;
      const folderName = folderData?.name || 'Pasta';
      const now = new Date().toISOString();

      // 1. Restore the folder itself
      await updateDoc(folderRef, {
        inTrash: false,
        trashedAt: null,
        updatedAt: now,
      });

      // 2. Restore all files inside this folder
      const filesSnap = await getDocs(query(collection(db, 'files'), where('folderId', '==', id))).catch(() => ({ docs: [] }));
      const fileRestores = filesSnap.docs.map((d) =>
        updateDoc(d.ref, {
          inTrash: false,
          trashedAt: null,
          updatedAt: now,
        }).catch(() => {})
      );
      await Promise.allSettled(fileRestores);

      // 3. If folder has a parent that is in trash, restore parent folder as well
      if (folderData?.parentId) {
        const parentRef = doc(db, 'folders', folderData.parentId);
        const parentSnap = await getDoc(parentRef).catch(() => null);
        if (parentSnap && parentSnap.exists() && parentSnap.data()?.inTrash) {
          await updateDoc(parentRef, {
            inTrash: false,
            trashedAt: null,
            updatedAt: now,
          }).catch(() => {});
        }
      }

      if (currentUser) {
        await api.addActivity({
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email || 'Membro',
          action: 'create_folder',
          actionLabel: 'Restaurou pasta da Lixeira',
          targetType: 'folder',
          targetName: folderName,
          details: 'Pasta e arquivos retornaram ao local original',
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `folders/${id}`);
    }
  },

  // ==========================================
  // 5. CHURCH EVENTS
  // ==========================================
  async getEvents(): Promise<ChurchEvent[]> {
    try {
      const [eventsSnap, filesSnap] = await Promise.all([
        getDocs(collection(db, 'events')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'files')).catch(() => ({ docs: [] })),
      ]);

      const allFiles = filesSnap.docs.map((d) => d.data() as FileRecord).filter((f) => !f.inTrash);

      return eventsSnap.docs.map((docSnap) => {
        const evt = docSnap.data() as ChurchEvent;
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
    try {
      const eventSnap = await getDoc(doc(db, 'events', id));
      if (!eventSnap.exists()) throw new Error('Evento não encontrado');
      const event = eventSnap.data() as ChurchEvent;

      const files = await api.getFiles({ eventId: id, inTrash: false });
      return { event, files };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `events/${id}`);
    }
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

    try {
      await setDoc(doc(db, 'events', eventId), removeUndefinedValues(newEvent));
      await api.addActivity({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'Membro',
        action: 'create_event',
        actionLabel: 'Criou novo evento da igreja',
        targetType: 'event',
        targetName: newEvent.name,
        details: `${newEvent.category} · ${newEvent.date}`,
      });
      return newEvent;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `events/${eventId}`);
    }
  },

  async updateEvent(id: string, updates: Partial<ChurchEvent>): Promise<void> {
    try {
      await updateDoc(doc(db, 'events', id), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `events/${id}`);
    }
  },

  async deleteEvent(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'events', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${id}`);
    }
  },

  // ==========================================
  // 6. SHARES
  // ==========================================
  async getShares(): Promise<ShareLink[]> {
    try {
      const snap = await getDocs(collection(db, 'shares'));
      return snap.docs.map((d) => d.data() as ShareLink);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'shares');
    }
  },

  async createShare(data: {
    resourceType: 'file' | 'folder' | 'event';
    resourceId: string;
    resourceName: string;
    allowDownload: boolean;
    requireAuth: boolean;
    expiresAt: string | null;
  }): Promise<ShareLink> {
    const currentUser = auth.currentUser;
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
      ownerUid: currentUser?.uid || 'anon',
      createdByName: currentUser?.displayName || currentUser?.email || 'Membro da Equipe',
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'shares', shareId), newShare);
      return newShare;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `shares/${shareId}`);
    }
  },

  async deleteShare(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'shares', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shares/${id}`);
    }
  },

  async getSharedResource(token: string): Promise<{ share: ShareLink; resource: any }> {
    try {
      const q = query(collection(db, 'shares'), where('token', '==', token), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('Link de compartilhamento inválido ou expirado.');

      const share = snap.docs[0].data() as ShareLink;
      if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
        throw new Error('Este link de compartilhamento expirou.');
      }

      let resourceData: any = null;
      if (share.resourceType === 'file') {
        const fSnap = await getDoc(doc(db, 'files', share.resourceId));
        if (fSnap.exists()) resourceData = fSnap.data();
      } else if (share.resourceType === 'folder') {
        const fSnap = await getDoc(doc(db, 'folders', share.resourceId));
        const files = await api.getFiles({ folderId: share.resourceId, inTrash: false });
        resourceData = { folder: fSnap.data(), files };
      } else if (share.resourceType === 'event') {
        const eSnap = await getDoc(doc(db, 'events', share.resourceId));
        const files = await api.getFiles({ eventId: share.resourceId, inTrash: false });
        resourceData = { event: eSnap.data(), files };
      }

      return { share, resource: resourceData };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'shares');
    }
  },

  // ==========================================
  // 7. ACTIVITIES AUDIT
  // ==========================================
  async getActivities(): Promise<Activity[]> {
    if (!auth.currentUser) return [];
    try {
      const q = query(collection(db, 'activities'), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as Activity);
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
      await setDoc(doc(db, 'activities', actId), newAct);
    } catch (error) {
      console.warn('Could not record activity:', error);
    }
  },

  // ==========================================
  // 8. STORAGE STATS & SETTINGS (REAL NUMBERS)
  // ==========================================
  async getSettings(): Promise<SystemSettings> {
    try {
      const snap = await getDoc(doc(db, 'settings', 'system'));
      let baseData: any = {
        churchName: 'PT-B Mídia',
        churchSubtitle: 'Central de Arquivos e Mídias',
        storageEngine: 'Cloud Storage for Firebase',
        totalQuotaBytes: 1024 * 1024 * 1024 * 1024, // 1 TB default Cloud quota
        updatedAt: new Date().toISOString(),
      };
      if (snap.exists()) {
        baseData = { ...baseData, ...snap.data() };
      } else if (auth.currentUser) {
        try {
          await setDoc(doc(db, 'settings', 'system'), baseData);
        } catch {}
      }

      const fullSettings: SystemSettings = {
        ...baseData,
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
        authDomain: firebaseConfig.authDomain,
        gcsBucket: firebaseConfig.storageBucket,
        gcsProjectId: firebaseConfig.projectId,
        settings: baseData,
        gcsInstructions: {
          active: true,
          bucket: firebaseConfig.storageBucket,
          status: 'Cloud Storage Oficial Ativo',
        },
      };

      return fullSettings;
    } catch {
      const fallback: any = {
        churchName: 'PT-B Mídia',
        churchSubtitle: 'Central de Arquivos e Mídias',
        storageEngine: 'Cloud Storage for Firebase',
        totalQuotaBytes: 1024 * 1024 * 1024 * 1024,
        updatedAt: new Date().toISOString(),
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
        firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
        authDomain: firebaseConfig.authDomain,
        gcsBucket: firebaseConfig.storageBucket,
        gcsProjectId: firebaseConfig.projectId,
        settings: {
          churchName: 'PT-B Mídia',
          churchSubtitle: 'Central de Arquivos e Mídias',
          storageEngine: 'Cloud Storage for Firebase',
          totalQuotaBytes: 1024 * 1024 * 1024 * 1024,
          updatedAt: new Date().toISOString(),
          gcsBucket: firebaseConfig.storageBucket,
          gcsProjectId: firebaseConfig.projectId,
        },
        gcsInstructions: {
          active: true,
          bucket: firebaseConfig.storageBucket,
          status: 'Cloud Storage Oficial Ativo',
        },
      };
      return fallback;
    }
  },

  async updateSettings(updates: Partial<SystemSettings>): Promise<void> {
    try {
      await updateDoc(doc(db, 'settings', 'system'), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/system');
    }
  },

  async getStorageStats(): Promise<StorageStats> {
    const fallbackStats: StorageStats = {
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

    try {
      const [filesSnap, foldersSnap, eventsSnap, usersSnap, sharesSnap, activitiesSnap, settings] =
        await Promise.all([
          getDocs(collection(db, 'files')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'folders')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'events')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'users')).catch(() => ({ docs: [] })),
          getDocs(collection(db, 'shares')).catch(() => ({ docs: [] })),
          api.getActivities().catch(() => []),
          api.getSettings().catch(() => ({
            totalQuotaBytes: 2 * 1024 * 1024 * 1024 * 1024,
            churchName: 'PT-B Mídia',
            churchSubtitle: 'Central de Arquivos e Mídias',
            storageEngine: 'Cloud Storage for Firebase',
            updatedAt: new Date().toISOString(),
          } as SystemSettings)),
        ]);

      const allFiles = filesSnap.docs.map((d) => d.data() as FileRecord);
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
          totalFolders: foldersSnap.docs.filter((d) => !(d.data() as Folder).inTrash).length,
          totalEvents: eventsSnap.docs.length,
          totalUsers: usersSnap.docs.length,
          totalShares: sharesSnap.docs.length,
        },
        recentActivities: activitiesSnap,
      };
    } catch (error) {
      console.error('Error fetching storage stats:', error);
      return {
        totalBytesUsed: 0,
        totalQuota: 1024 * 1024 * 1024 * 1024,
        availableBytes: 1024 * 1024 * 1024 * 1024,
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
          totalUsers: 0,
          totalShares: 0,
        },
        recentActivities: [],
      };
    }
  },

  // ==========================================
  // 9. DOWNLOAD & MEDIA RESOLUTION HELPERS
  // ==========================================
  async resolveMediaUrl(file: FileRecord): Promise<string | null> {
    if (file.thumbnailUrl && !file.thumbnailUrl.startsWith('chunked://')) {
      return file.thumbnailUrl;
    }
    const source = file.thumbnailUrl || file.downloadUrl;
    if (!source) return null;

    if (source.startsWith('data:') || source.startsWith('http') || source.startsWith('/uploads/')) {
      return source;
    }

    if (source.startsWith('chunked://')) {
      const fileId = source.replace('chunked://', '');
      try {
        const q = query(collection(db, 'file_chunks'), where('fileId', '==', fileId));
        const snap = await getDocs(q);
        const sortedDocs = snap.docs
          .map((d) => d.data() as { chunkIndex: number; data: string })
          .sort((a, b) => a.chunkIndex - b.chunkIndex);

        if (sortedDocs.length === 0) return null;

        const byteArrays: Uint8Array[] = [];
        for (const docItem of sortedDocs) {
          const bstr = atob(docItem.data);
          const u8arr = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) {
            u8arr[i] = bstr.charCodeAt(i);
          }
          byteArrays.push(u8arr);
        }
        const blob = new Blob(byteArrays as any, { type: file.mimeType || 'image/jpeg' });
        return URL.createObjectURL(blob);
      } catch (err) {
        console.warn('Error resolving chunked media URL:', err);
        return null;
      }
    }
    return null;
  },

  async triggerDownload(urlOrRecord: string | FileRecord, customFilename?: string) {
    let url = typeof urlOrRecord === 'string' ? urlOrRecord : urlOrRecord.downloadUrl;
    let filename = customFilename || (typeof urlOrRecord === 'object' ? urlOrRecord.name : '');

    // 1. If it's a route like /api/files/:id/download, extract the fileId and get real downloadUrl
    if (url.includes('/api/files/') && url.includes('/download')) {
      const match = url.match(/\/api\/files\/([^/]+)\/download/);
      if (match && match[1]) {
        const fileId = match[1];
        try {
          const docSnap = await getDoc(doc(db, 'files', fileId));
          if (docSnap.exists()) {
            const data = docSnap.data() as FileRecord;
            url = data.downloadUrl || url;
            if (!filename) filename = data.name;
          }
        } catch {}
      }
    }

    // 2. If chunked storage from Firestore:
    if (url.startsWith('chunked://')) {
      const fileId = url.replace('chunked://', '');
      try {
        const q = query(collection(db, 'file_chunks'), where('fileId', '==', fileId));
        const snap = await getDocs(q);
        const sortedDocs = snap.docs
          .map((d) => d.data() as { chunkIndex: number; data: string })
          .sort((a, b) => a.chunkIndex - b.chunkIndex);

        const byteArrays: Uint8Array[] = [];
        for (const docItem of sortedDocs) {
          const bstr = atob(docItem.data);
          const u8arr = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) {
            u8arr[i] = bstr.charCodeAt(i);
          }
          byteArrays.push(u8arr);
        }
        const blob = new Blob(byteArrays as any, { type: 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'arquivo_original';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          a.remove();
        }, 1000);
        return;
      } catch (chunkErr) {
        console.warn('Error downloading chunked file:', chunkErr);
      }
    }

    // 3. If Data URL:
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

    // 4. If relative /uploads/ URL or HTTP URL:
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

    // 5. Fallback for mobile direct attachment
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
        try {
          const snap = await getDoc(doc(db, 'files', item));
          if (snap.exists()) {
            files.push(snap.data() as FileRecord);
          }
        } catch {}
      } else {
        files.push(item);
      }
    }

    for (const file of files) {
      try {
        const response = await fetch(file.downloadUrl);
        const blob = await response.blob();
        zip.file(file.name, blob);
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
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
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
        const response = await fetch(file.downloadUrl);
        const blob = await response.blob();
        zip.folder(folderName)?.file(file.name, blob);
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
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
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
    const profileRef = doc(db, 'church_settings', 'profile');
    try {
      const snap = await getDoc(profileRef);
      if (snap.exists()) {
        return snap.data() as ChurchProfile;
      }
      const defaultProfile = api.getDefaultChurchProfile();
      if (auth.currentUser) {
        try {
          await setDoc(profileRef, defaultProfile);
        } catch {}
      }
      return defaultProfile;
    } catch {
      return api.getDefaultChurchProfile();
    }
  },

  async updateChurchProfile(profileData: Partial<ChurchProfile>): Promise<ChurchProfile> {
    const profileRef = doc(db, 'church_settings', 'profile');
    const effective = api.getEffectiveUser();
    const updated: Partial<ChurchProfile> = removeUndefinedValues({
      ...profileData,
      updatedAt: new Date().toISOString(),
      updatedBy: effective.displayName || 'Administrador',
    });
    try {
      await setDoc(profileRef, updated, { merge: true });
      const snap = await getDoc(profileRef);
      return snap.data() as ChurchProfile;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'church_settings/profile');
    }
  },

  // --- Church Announcements ---
  async getChurchAnnouncements(publishedOnly: boolean = false): Promise<ChurchAnnouncement[]> {
    try {
      const colRef = collection(db, 'church_announcements');
      const q = publishedOnly ? query(colRef, where('status', '==', 'published')) : colRef;
      const snap = await getDocs(q);
      let list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as ChurchAnnouncement));
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
    try {
      await setDoc(doc(db, 'church_announcements', newId), removeUndefinedValues(announcement));
      return announcement;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `church_announcements/${newId}`);
    }
  },

  async updateChurchAnnouncement(id: string, updates: Partial<ChurchAnnouncement>): Promise<void> {
    try {
      await updateDoc(doc(db, 'church_announcements', id), removeUndefinedValues({
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `church_announcements/${id}`);
    }
  },

  async deleteChurchAnnouncement(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'church_announcements', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `church_announcements/${id}`);
    }
  },

  // --- Church Public Events & Schedule ---
  async getChurchPublicEvents(publishedOnly: boolean = false): Promise<ChurchPublicEvent[]> {
    try {
      const colRef = collection(db, 'church_events');
      const q = publishedOnly ? query(colRef, where('status', '==', 'published')) : colRef;
      const snap = await getDocs(q);
      let list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as ChurchPublicEvent));
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
    try {
      await setDoc(doc(db, 'church_events', newId), removeUndefinedValues(event));
      return event;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `church_events/${newId}`);
    }
  },

  async updateChurchPublicEvent(id: string, updates: Partial<ChurchPublicEvent>): Promise<void> {
    try {
      await updateDoc(doc(db, 'church_events', id), removeUndefinedValues({
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `church_events/${id}`);
    }
  },

  async deleteChurchPublicEvent(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'church_events', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `church_events/${id}`);
    }
  },

  // --- Church Articles & Devotionals ---
  async getChurchArticles(publishedOnly: boolean = false): Promise<ChurchArticle[]> {
    try {
      const colRef = collection(db, 'church_articles');
      const q = publishedOnly ? query(colRef, where('status', '==', 'published')) : colRef;
      const snap = await getDocs(q);
      let list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as ChurchArticle));
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
    try {
      const snap = await getDoc(doc(db, 'church_articles', id));
      if (snap.exists()) {
        return { ...snap.data(), id: snap.id } as ChurchArticle;
      }
      return null;
    } catch {
      return null;
    }
  },

  async createChurchArticle(data: Omit<ChurchArticle, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChurchArticle> {
    const newId = `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const article: ChurchArticle = {
      ...data,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'church_articles', newId), removeUndefinedValues(article));
      return article;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `church_articles/${newId}`);
    }
  },

  async updateChurchArticle(id: string, updates: Partial<ChurchArticle>): Promise<void> {
    try {
      await updateDoc(doc(db, 'church_articles', id), removeUndefinedValues({
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `church_articles/${id}`);
    }
  },

  async deleteChurchArticle(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'church_articles', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `church_articles/${id}`);
    }
  },

  // --- Church Photo Albums & Videos ---
  async getChurchAlbums(publishedOnly: boolean = false): Promise<ChurchAlbum[]> {
    try {
      const colRef = collection(db, 'church_albums');
      const q = publishedOnly ? query(colRef, where('status', '==', 'published')) : colRef;
      const snap = await getDocs(q);
      let list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as ChurchAlbum));
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
    try {
      await setDoc(doc(db, 'church_albums', newId), removeUndefinedValues(album));
      return album;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `church_albums/${newId}`);
    }
  },

  async updateChurchAlbum(id: string, updates: Partial<ChurchAlbum>): Promise<void> {
    try {
      await updateDoc(doc(db, 'church_albums', id), removeUndefinedValues({
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `church_albums/${id}`);
    }
  },

  async deleteChurchAlbum(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'church_albums', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `church_albums/${id}`);
    }
  },

  // --- Church Public Downloads ---
  async getChurchDownloads(publishedOnly: boolean = false): Promise<ChurchDownload[]> {
    try {
      const colRef = collection(db, 'church_downloads');
      const q = publishedOnly ? query(colRef, where('status', '==', 'published')) : colRef;
      const snap = await getDocs(q);
      let list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as ChurchDownload));
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
    try {
      await setDoc(doc(db, 'church_downloads', newId), removeUndefinedValues(downloadItem));
      return downloadItem;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `church_downloads/${newId}`);
    }
  },

  async updateChurchDownload(id: string, updates: Partial<ChurchDownload>): Promise<void> {
    try {
      await updateDoc(doc(db, 'church_downloads', id), removeUndefinedValues({
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `church_downloads/${id}`);
    }
  },

  async deleteChurchDownload(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'church_downloads', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `church_downloads/${id}`);
    }
  },

  async incrementChurchDownloadCount(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'church_downloads', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const count = snap.data().downloadCount || 0;
        await updateDoc(docRef, { downloadCount: count + 1 });
      }
    } catch {}
  },

  // No automatic seeding - users create and publish their own content
  async seedInitialChurchDataIfEmpty(): Promise<void> {
    // Intentionally empty: real users create their own announcements, events and publications
  },

  // ==========================================
  // 12. CENTRAL DE AGENDA, ESCALAS & TAREFAS DA EQUIPE (REAL-TIME)
  // ==========================================
  /**
   * Real-time listener for Team Tasks and Member Assignments.
   * Updates instantaneously whenever any member adds, updates or completes a task.
   */
  subscribeTeamTasks(callback: (tasks: TeamTask[]) => void): () => void {
    const tasksRef = collection(db, 'team_tasks');
    return onSnapshot(
      tasksRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const t = d.data() as TeamTask;
          return {
            ...t,
            id: t.id || d.id,
          };
        });
        // Sort by date ascending, then urgency
        const priorityWeight: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
        list.sort((a, b) => {
          // Completed tasks go lower
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
        callback(list);
      },
      (error) => {
        console.warn('Real-time team tasks subscription sync:', error);
      }
    );
  },

  async getTeamTasks(): Promise<TeamTask[]> {
    try {
      const snap = await getDocs(collection(db, 'team_tasks'));
      const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as TeamTask));
      return list;
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

    try {
      await setDoc(doc(db, 'team_tasks', taskId), removeUndefinedValues(task));
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `team_tasks/${taskId}`);
    }
  },

  async createBatchTeamTasks(tasksData: Partial<TeamTask>[]): Promise<TeamTask[]> {
    if (!tasksData || tasksData.length === 0) return [];
    const effective = api.getEffectiveUser();
    const batch = writeBatch(db);
    const createdTasks: TeamTask[] = [];

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
      const taskRef = doc(db, 'team_tasks', taskId);
      batch.set(taskRef, removeUndefinedValues(task));
      createdTasks.push(task);
    }

    try {
      await batch.commit();
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'team_tasks/batch');
      return [];
    }
  },

  async batchUpdateTaskStatus(taskIds: string[], newStatus: TeamTaskStatus): Promise<void> {
    if (!taskIds || taskIds.length === 0) return;
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const id of taskIds) {
      const ref = doc(db, 'team_tasks', id);
      batch.update(ref, { status: newStatus, updatedAt: now });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'team_tasks/batch_update');
    }
  },

  async batchDeleteTeamTasks(taskIds: string[]): Promise<void> {
    if (!taskIds || taskIds.length === 0) return;
    const batch = writeBatch(db);
    for (const id of taskIds) {
      const ref = doc(db, 'team_tasks', id);
      batch.delete(ref);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'team_tasks/batch_delete');
    }
  },

  async updateTeamTask(id: string, updates: Partial<TeamTask>): Promise<void> {
    try {
      await updateDoc(doc(db, 'team_tasks', id), removeUndefinedValues({
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `team_tasks/${id}`);
    }
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
    try {
      await deleteDoc(doc(db, 'team_tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `team_tasks/${id}`);
    }
  },

  // ==========================================
  // 13. TRABALHO DE ANOTAÇÃO COLABORATIVA DA EQUIPE (REAL-TIME)
  // ==========================================
  /**
   * Real-time listener for Team Collaborative Notes & Alignments.
   */
  subscribeTeamNotes(callback: (notes: TeamNote[]) => void): () => void {
    const notesRef = collection(db, 'team_notes');
    return onSnapshot(
      notesRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const n = d.data() as TeamNote;
          return {
            ...n,
            id: n.id || d.id,
          };
        });
        // Sort: pinned first, then newest updated
        list.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime() || 0;
          const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime() || 0;
          return timeB - timeA;
        });
        callback(list);
      },
      (error) => {
        console.warn('Real-time team notes subscription sync:', error);
      }
    );
  },

  async getTeamNotes(): Promise<TeamNote[]> {
    try {
      const snap = await getDocs(collection(db, 'team_notes'));
      const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as TeamNote));
      return list;
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

    try {
      await setDoc(doc(db, 'team_notes', noteId), removeUndefinedValues(note));
      return note;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `team_notes/${noteId}`);
    }
  },

  async updateTeamNote(id: string, updates: Partial<TeamNote>): Promise<void> {
    try {
      await updateDoc(doc(db, 'team_notes', id), removeUndefinedValues({
        ...updates,
        updatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `team_notes/${id}`);
    }
  },

  async deleteTeamNote(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'team_notes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `team_notes/${id}`);
    }
  },

  // No automatic seeding - team members create and manage their own tasks and schedules
  async seedInitialTeamScheduleIfEmpty(): Promise<void> {
    // Intentionally empty: real team members create and manage their own work and schedules
  },
};

