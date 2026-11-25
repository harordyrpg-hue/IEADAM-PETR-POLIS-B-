import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { initializeApp as initializeFbApp, getApps as getFbApps } from 'firebase/app';
import {
  getFirestore as getFbFirestore,
  collection as fbCollection,
  getDocs as fbGetDocs,
  getDoc as fbGetDoc,
  doc as fbDoc,
  setDoc as fbSetDoc,
  deleteField as fbDeleteField,
} from 'firebase/firestore';
import {
  localStore,
  ALLOWED_COLLECTIONS,
  hashPassword,
  verifyPassword,
  sanitizeUser,
  StoredUserRecord,
} from './server/store.js';
import {
  buildDriveOAuthUrl,
  clearDriveTokenRecord,
  createDriveResumableSession,
  getDriveFileMetadata,
  getPublicDriveStatus,
  handleDriveOAuthCallback,
  isAllowedLegacyFirebaseUrl,
  streamDiskFileWithRange,
  streamDriveFileToResponse,
} from './server/drive.js';

dotenv.config();

let serverFirestoreDb: ReturnType<typeof getFbFirestore> | null = null;
function getServerFirestore() {
  if (serverFirestoreDb) return serverFirestoreDb;
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const fbApp =
    getFbApps().find((a) => a.name === 'server-firestore') ||
    initializeFbApp(cfg, 'server-firestore');
  serverFirestoreDb = cfg.firestoreDatabaseId
    ? getFbFirestore(fbApp, cfg.firestoreDatabaseId)
    : getFbFirestore(fbApp);
  return serverFirestoreDb;
}

const SUPER_ADMIN_EMAIL_SET = new Set([
  'pedro.martinss225@gmail.com',
  'emillycampos308@gmail.com',
]);

function hashV1Credential(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return `v1:${salt}:${digest}`;
}

function verifyV1Credential(password: string, storedHash?: string | null): boolean {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const [, salt, expectedDigest] = parts;
  if (!salt || !expectedDigest) return false;
  const actualDigest = crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return actualDigest === expectedDigest;
}

const ELINES_SECRETARIA_EMAIL = 'elinesaraujo46@gmail.com';

function sanitizeFirestoreUser(raw: any, docId: string) {
  const {
    passwordHash: _ph,
    initialPasswordHash: _iph,
    secretariaRoleAssigned: _sra,
    ...rest
  } = raw || {};
  const passwordSetOnce = Boolean(raw?.passwordSetOnce);
  const mustChangePassword =
    typeof raw?.mustChangePassword === 'boolean' ? raw.mustChangePassword : !passwordSetOnce;
  return {
    ...rest,
    uid: raw?.uid || raw?.id || docId,
    id: raw?.id || raw?.uid || docId,
    passwordSetOnce,
    mustChangePassword: passwordSetOnce ? false : mustChangePassword,
  };
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const CHUNKS_DIR = path.join(UPLOADS_DIR, '.chunks');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeStoredFilename(rawName: string): { originalName: string; uniqueName: string } {
  const decoded = safeDecodeURIComponent(rawName || `file_${Date.now()}`);
  const cleanName = decoded.replace(/[^a-zA-Z0-9.\-_]/g, '_') || `file_${Date.now()}`;
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${cleanName}`;
  return { originalName: decoded, uniqueName };
}

// Serve uploaded media files directly (block internal .chunks folder; return 404 instead of SPA fallback when missing)
app.use(
  '/uploads',
  (req, res, next) => {
    if (req.path.startsWith('/.chunks')) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
    next();
  },
  express.static(UPLOADS_DIR),
  (_req, res) => {
    res.status(404).json({ error: 'Arquivo não encontrado.' });
  }
);

// Dedicated single-shot binary upload endpoint (registered before express.json so JSON files also upload as raw Buffer)
app.post('/api/upload', express.raw({ type: '*/*', limit: '30mb' }), (req, res) => {
  const rawFileName = (req.headers['x-filename'] as string) || `file_${Date.now()}`;
  const { originalName, uniqueName } = sanitizeStoredFilename(rawFileName);
  const filePath = path.join(UPLOADS_DIR, uniqueName);

  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');

  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error('[Upload API] Error writing file to disk:', err);
      return res.status(500).json({ error: 'Falha ao salvar arquivo no armazenamento local.' });
    }

    const downloadUrl = `/uploads/${uniqueName}`;
    res.json({
      success: true,
      filename: uniqueName,
      originalName,
      downloadUrl,
      size: buffer.length,
    });
  });
});

// Chunked binary upload endpoint (must be before express.json so every raw slice stays a Buffer)
app.post('/api/upload/chunk', express.raw({ type: '*/*', limit: '16mb' }), async (req, res) => {
  const uploadId = String(req.headers['x-upload-id'] || '').replace(/[^a-zA-Z0-9_\-]/g, '');
  const chunkIndex = Number(req.headers['x-chunk-index']);

  if (!uploadId || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return res.status(400).json({ error: 'Metadados de parte inválidos no upload.' });
  }

  const chunkDir = path.join(CHUNKS_DIR, uploadId);
  if (!fs.existsSync(chunkDir)) {
    return res.status(404).json({ error: 'Sessão de upload não encontrada ou expirada.' });
  }

  const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  const chunkPath = path.join(chunkDir, `part_${String(chunkIndex).padStart(6, '0')}`);

  try {
    await fs.promises.writeFile(chunkPath, buffer);
    return res.json({ success: true, chunkIndex, size: buffer.length });
  } catch (err) {
    console.error('[Upload Chunk API] Error writing chunk:', err);
    return res.status(500).json({ error: 'Falha ao gravar parte do arquivo no servidor.' });
  }
});

app.use(express.json({ limit: '50mb' }));

// Initialize a chunked upload session (bypasses Cloud Run 32 MiB single-request body limit)
app.post('/api/upload/init', async (req, res) => {
  const rawFilename = String(req.body?.filename || `file_${Date.now()}`);
  const decodedFilename = safeDecodeURIComponent(rawFilename);
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const chunkDir = path.join(CHUNKS_DIR, uploadId);

  try {
    await fs.promises.mkdir(chunkDir, { recursive: true });
    return res.json({ uploadId, filename: decodedFilename });
  } catch (err) {
    console.error('[Upload Init API] Error creating chunk dir:', err);
    return res.status(500).json({ error: 'Falha ao iniciar sessão de upload no servidor.' });
  }
});

// Assemble all uploaded chunks into a final file in UPLOADS_DIR
app.post('/api/upload/complete', async (req, res) => {
  const uploadId = String(req.body?.uploadId || '').replace(/[^a-zA-Z0-9_\-]/g, '');
  const rawFilename = String(req.body?.filename || `file_${Date.now()}`);
  const totalChunks = Number(req.body?.totalChunks || 0);

  if (!uploadId || !Number.isInteger(totalChunks) || totalChunks <= 0) {
    return res.status(400).json({ error: 'Dados inválidos para finalizar o upload.' });
  }

  const chunkDir = path.join(CHUNKS_DIR, uploadId);
  if (!fs.existsSync(chunkDir)) {
    return res.status(404).json({ error: 'Sessão de upload não encontrada.' });
  }

  const { originalName, uniqueName } = sanitizeStoredFilename(rawFilename);
  const finalPath = path.join(UPLOADS_DIR, uniqueName);

  try {
    let totalSize = 0;
    const writeHandle = await fs.promises.open(finalPath, 'w');
    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunkDir, `part_${String(i).padStart(6, '0')}`);
        if (!fs.existsSync(chunkPath)) {
          throw new Error(`Parte ${i + 1} de ${totalChunks} não encontrada.`);
        }
        const chunkBuf = await fs.promises.readFile(chunkPath);
        await writeHandle.write(chunkBuf);
        totalSize += chunkBuf.length;
      }
    } finally {
      await writeHandle.close();
    }

    await fs.promises.rm(chunkDir, { recursive: true, force: true }).catch(() => {});

    return res.json({
      success: true,
      filename: uniqueName,
      originalName,
      downloadUrl: `/uploads/${uniqueName}`,
      size: totalSize,
    });
  } catch (err: any) {
    await fs.promises.unlink(finalPath).catch(() => {});
    await fs.promises.rm(chunkDir, { recursive: true, force: true }).catch(() => {});
    console.error('[Upload Complete API] Error assembling chunks:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao montar arquivo completo no servidor.' });
  }
});

// Lightweight version check endpoint for instant multi-user diff synchronization
app.get('/api/realtime/versions', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({ versions: localStore.getVersions(), ts: Date.now() });
});

// Real-time Server-Sent Events stream with proxy unbuffering headers
app.get('/api/realtime', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  res.write(
    `data: ${JSON.stringify({ connected: true, versions: localStore.getVersions(), ts: Date.now() })}\n\n`
  );
  localStore.registerSseClient(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 10000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// ==========================================
// AUTHENTICATION & USER ACCOUNTS (LOCAL DB)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const cleanPass = String(req.body?.password || '').trim();

  if (!cleanEmail || !cleanPass) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  try {
    const user = await localStore.withLock((db) => {
      const usersList = Object.values(db.users) as StoredUserRecord[];
      const found = usersList.find((u) => (u.email || '').toLowerCase().trim() === cleanEmail);
      if (!found) {
        return { error: 'E-mail ou senha incorretos.', status: 401 };
      }
      if (found.status === 'blocked') {
        return { error: 'Sua conta foi suspensa temporariamente pelo Administrador.', status: 403 };
      }

      if (!found.passwordHash) {
        // First password login for pre-configured admin account without password hash yet
        found.passwordHash = hashPassword(cleanPass);
        found.updatedAt = new Date().toISOString();
        db.users[found.uid] = found;
        return { user: sanitizeUser(found), status: 200 };
      }

      if (!verifyPassword(cleanPass, found.passwordHash)) {
        return { error: 'E-mail ou senha incorretos.', status: 401 };
      }

      return { user: sanitizeUser(found), status: 200 };
    });

    if ('error' in user) {
      return res.status(user.status).json({ error: user.error });
    }
    return res.json({ user: user.user });
  } catch (err: any) {
    console.error('[Auth Login Error]', err);
    return res.status(500).json({ error: err?.message || 'Falha na autenticação.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const cleanPass = String(req.body?.password || '').trim();
  const name = String(req.body?.name || '').trim();

  const isInitialAdmin =
    cleanEmail === 'pedro.martinss225@gmail.com' || cleanEmail === 'emillycampos308@gmail.com';
  if (!isInitialAdmin) {
    return res.status(403).json({
      error:
        'Cadastro público desabilitado. Novos membros devem ser cadastrados pelo Super Administrador no painel de equipe.',
    });
  }
  if (cleanPass.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const result = await localStore.withLock((db) => {
      const existing = Object.values(db.users).find(
        (u: any) => (u.email || '').toLowerCase() === cleanEmail
      );
      if (existing) {
        return { error: 'Este e-mail já está cadastrado.', status: 409 };
      }
      const uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const profile: StoredUserRecord = {
        uid,
        id: uid,
        name: name || 'Administrador PT-B',
        email: cleanEmail,
        role: 'super_admin',
        roleLabel: 'Super Administrador',
        avatar:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&h=200&q=80',
        status: 'active',
        canManageChurchPage: true,
        canManageFinances: true,
        passwordHash: hashPassword(cleanPass),
        createdAt: now,
        updatedAt: now,
      };
      db.users[uid] = profile;
      return { user: sanitizeUser(profile), status: 201 };
    });

    if ('error' in result) {
      return res.status(result.status).json({ error: result.error });
    }
    localStore.broadcastChange('users');
    return res.status(201).json({ user: result.user });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha ao registrar conta.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const newPassword = String(req.body?.newPassword || '').trim();
  if (!cleanEmail) {
    return res.status(400).json({ error: 'Informe o e-mail da conta.' });
  }

  try {
    const result = await localStore.withLock((db) => {
      const found = Object.values(db.users).find(
        (u: any) => (u.email || '').toLowerCase().trim() === cleanEmail
      ) as StoredUserRecord | undefined;

      if (!found) {
        return { error: 'Nenhuma conta encontrada para este e-mail.', status: 404 };
      }
      if (newPassword) {
        if (newPassword.length < 6) {
          return { error: 'A nova senha deve ter pelo menos 6 caracteres.', status: 400 };
        }
        found.passwordHash = hashPassword(newPassword);
        found.updatedAt = new Date().toISOString();
        db.users[found.uid] = found;
        return { ok: true, message: 'Senha atualizada com sucesso.' };
      }
      // Reset back so next login sets password cleanly
      delete found.passwordHash;
      found.updatedAt = new Date().toISOString();
      db.users[found.uid] = found;
      return {
        ok: true,
        message: 'Acesso redefinido. Você já pode entrar definindo sua nova senha.',
      };
    });

    if ('error' in result) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao redefinir senha.' });
  }
});

app.post('/api/auth/users', async (req, res) => {
  const { name, email, initialPassword, role, avatar } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !name) {
    return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
  }
  const pass = String(initialPassword || 'MidiaPTB2026!#');
  if (pass.length < 6) {
    return res.status(400).json({ error: 'A senha inicial deve ter pelo menos 6 caracteres.' });
  }

  const resolvedRole =
    role === 'super_admin' ||
    role === 'media_admin' ||
    role === 'media_member' ||
    role === 'secretaria'
      ? role
      : 'media_member';

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Administrador',
    media_admin: 'Administrador de Mídia',
    media_member: 'Membro da Mídia',
    secretaria: 'Secretaria',
  };

  try {
    const result = await localStore.withLock((db) => {
      const exists = Object.values(db.users).find(
        (u: any) => (u.email || '').toLowerCase() === cleanEmail
      );
      if (exists) {
        return { error: 'Já existe um membro cadastrado com este e-mail.', status: 409 };
      }

      const uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const newUser: StoredUserRecord = {
        uid,
        id: uid,
        name: String(name).trim(),
        email: cleanEmail,
        role: resolvedRole,
        roleLabel: roleLabels[resolvedRole],
        avatar:
          avatar ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
        status: 'active',
        canManageChurchPage: resolvedRole === 'super_admin' || resolvedRole === 'media_admin',
        canManageFinances:
          resolvedRole === 'super_admin' ||
          resolvedRole === 'media_admin' ||
          resolvedRole === 'secretaria',
        passwordHash: hashPassword(pass),
        createdAt: now,
        updatedAt: now,
      };
      db.users[uid] = newUser;
      if (resolvedRole === 'super_admin') {
        db.admins[uid] = { uid, email: cleanEmail, createdAt: now };
      }
      return { user: sanitizeUser(newUser), status: 201 };
    });

    if ('error' in result) {
      return res.status(result.status).json({ error: result.error });
    }
    localStore.broadcastChange(['users', 'admins']);
    return res.status(201).json({ user: result.user });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao criar membro.' });
  }
});

app.get('/api/auth/profile/:uid', (req, res) => {
  const { uid } = req.params;
  const fallbackEmail = String(req.query.email || '').trim().toLowerCase();
  const snap = localStore.readSnapshot();
  let found = snap.users[uid];
  if (!found && fallbackEmail) {
    found = Object.values(snap.users).find(
      (u: any) => (u.email || '').toLowerCase().trim() === fallbackEmail
    );
  }
  if (!found) {
    return res.status(404).json({ error: 'Perfil não encontrado.' });
  }
  return res.json({ user: sanitizeUser(found) });
});

// ==========================================
// CLOUD FIRESTORE AUTH FALLBACK (EMAIL + 12345 / ONE-TIME PASSWORD)
// ==========================================
app.post('/api/firestore-auth/login', async (req, res) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const cleanPass = String(req.body?.password || '').trim();

  if (!cleanEmail || !cleanPass) {
    return res.status(400).json({ error: 'Informe seu e-mail e sua senha.' });
  }

  try {
    const db = getServerFirestore();
    const snap = await fbGetDocs(fbCollection(db, 'users'));
    const matched = snap.docs
      .filter((d) => ((d.data() as any)?.email || '').toLowerCase().trim() === cleanEmail)
      .map((d) => ({ id: d.id, data: d.data() as any }));

    const canonical =
      matched.find((d) => !d.id.startsWith('admin_') && !d.id.startsWith('user_')) || matched[0];

    if (!canonical) {
      return res.status(404).json({
        error: 'Conta não cadastrada na equipe PT-B Mídia. Solicite acesso ao Super Administrador.',
      });
    }

    const record = canonical.data;
    if (record.status === 'blocked') {
      return res.status(403).json({
        error: 'Sua conta foi suspensa temporariamente pelo Administrador.',
      });
    }

    const passwordAlreadyDefinedOnce = Boolean(record.passwordSetOnce && record.passwordHash);
    if (passwordAlreadyDefinedOnce) {
      if (!verifyV1Credential(cleanPass, record.passwordHash)) {
        return res.status(401).json({
          error:
            'Senha incorreta. Após o primeiro acesso, utilize apenas a senha definitiva que você cadastrou.',
        });
      }
    } else {
      const hasCustomInitial = Boolean(record.initialPasswordHash);
      const validInitial = hasCustomInitial
        ? verifyV1Credential(cleanPass, record.initialPasswordHash)
        : cleanPass === '12345';

      if (!validInitial) {
        return res.status(401).json({
          error: hasCustomInitial
            ? 'Senha provisória incorreta. Use a senha inicial informada pelo Administrador ou 12345 se resetada.'
            : 'No primeiro acesso, entre utilizando seu e-mail e a senha provisória 12345.',
        });
      }
    }

    let effectiveRecord = record;
    if (
      cleanEmail === ELINES_SECRETARIA_EMAIL &&
      !record.secretariaRoleAssigned &&
      record.role !== 'secretaria'
    ) {
      const now = new Date().toISOString();
      const migrationPatch = {
        role: 'secretaria',
        roleLabel: 'Secretaria',
        canManageChurchPage: false,
        canManageFinances: true,
        secretariaRoleAssigned: true,
        updatedAt: now,
      };
      effectiveRecord = { ...record, ...migrationPatch };
      for (const m of matched) {
        await fbSetDoc(fbDoc(db, 'users', m.id), migrationPatch, { merge: true }).catch(() => {});
      }
    }

    const user = sanitizeFirestoreUser(
      {
        ...effectiveRecord,
        email: cleanEmail,
        ...(SUPER_ADMIN_EMAIL_SET.has(cleanEmail)
          ? {
              role: 'super_admin',
              roleLabel: 'Super Administrador',
              canManageChurchPage: true,
              canManageFinances: true,
            }
          : {}),
        passwordSetOnce: passwordAlreadyDefinedOnce,
        mustChangePassword: !passwordAlreadyDefinedOnce,
      },
      canonical.id
    );

    return res.json({ user });
  } catch (err: any) {
    console.error('[Firestore Auth Login Fallback Error]', err);
    return res.status(500).json({ error: err?.message || 'Erro ao autenticar no Firestore.' });
  }
});

app.post('/api/firestore-auth/set-password', async (req, res) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const uid = String(req.body?.uid || '').trim();
  const newPassword = String(req.body?.newPassword || '').trim();

  if (!cleanEmail) {
    return res.status(400).json({ error: 'Sessão inválida. Entre novamente.' });
  }
  if (newPassword.length < 5) {
    return res.status(400).json({ error: 'A senha definitiva deve ter no mínimo 5 caracteres.' });
  }
  if (newPassword === '12345') {
    return res.status(400).json({
      error: 'Por segurança, escolha uma senha diferente da senha provisória 12345.',
    });
  }

  try {
    const db = getServerFirestore();
    const snap = await fbGetDocs(fbCollection(db, 'users'));
    const matched = snap.docs
      .filter((d) => ((d.data() as any)?.email || '').toLowerCase().trim() === cleanEmail)
      .map((d) => ({ id: d.id, data: d.data() as any }));

    const canonical =
      matched.find((d) => !d.id.startsWith('admin_') && !d.id.startsWith('user_')) || matched[0];

    if (canonical?.data?.passwordSetOnce) {
      return res.status(409).json({
        error: 'Sua senha definitiva já foi definida anteriormente e não pode ser alterada novamente.',
      });
    }

    const now = new Date().toISOString();
    const hashed = hashV1Credential(newPassword);
    const targetIds = new Set<string>(matched.map((m) => m.id));
    if (uid) targetIds.add(uid);

    for (const targetId of targetIds) {
      await fbSetDoc(
        fbDoc(db, 'users', targetId),
        {
          passwordHash: hashed,
          initialPasswordHash: fbDeleteField(),
          passwordSetOnce: true,
          mustChangePassword: false,
          passwordUpdatedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    const baseUser = canonical
      ? sanitizeFirestoreUser(canonical.data, canonical.id)
      : { uid, id: uid, email: cleanEmail };

    return res.json({
      user: {
        ...baseUser,
        passwordSetOnce: true,
        mustChangePassword: false,
        passwordUpdatedAt: now,
        updatedAt: now,
      },
    });
  } catch (err: any) {
    console.error('[Firestore Set Password Fallback Error]', err);
    return res.status(500).json({ error: err?.message || 'Erro ao salvar senha definitiva.' });
  }
});

// ==========================================
// GENERIC PERSISTENT DATABASE ENDPOINTS
// ==========================================
app.get('/api/db/:col', (req, res) => {
  const { col } = req.params;
  if (!ALLOWED_COLLECTIONS.has(col)) {
    return res.status(400).json({ error: `Coleção inválida: ${col}` });
  }
  const snap = localStore.readSnapshot();
  let items = Object.entries(snap[col] || {}).map(([id, doc]) => ({
    ...doc,
    id: doc?.id || id,
  }));
  if (col === 'users') {
    items = items.map(sanitizeUser);
  }
  res.json({ items });
});

app.get('/api/db/:col/:id', (req, res) => {
  const { col, id } = req.params;
  if (!ALLOWED_COLLECTIONS.has(col)) {
    return res.status(400).json({ error: `Coleção inválida: ${col}` });
  }
  const snap = localStore.readSnapshot();
  const doc = snap[col]?.[id];
  if (!doc) {
    return res.status(404).json({ error: 'Registro não encontrado.' });
  }
  res.json({ item: col === 'users' ? sanitizeUser(doc) : doc });
});

app.put('/api/db/:col/:id', async (req, res) => {
  const { col, id } = req.params;
  if (!ALLOWED_COLLECTIONS.has(col)) {
    return res.status(400).json({ error: `Coleção inválida: ${col}` });
  }
  const merge = req.query.merge === 'true';
  const payload = req.body || {};

  try {
    const saved = await localStore.withLock((db) => {
      const existing = db[col][id] || {};
      const next = merge ? { ...existing, ...payload } : { ...payload };
      if (!next.id && col !== 'settings') {
        next.id = id;
      }
      if (col === 'users' && existing.passwordHash && !next.passwordHash) {
        next.passwordHash = existing.passwordHash;
      }
      db[col][id] = next;
      return col === 'users' ? sanitizeUser(next) : next;
    });

    localStore.broadcastChange(col);
    res.json({ item: saved });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao gravar registro.' });
  }
});

app.patch('/api/db/:col/:id', async (req, res) => {
  const { col, id } = req.params;
  if (!ALLOWED_COLLECTIONS.has(col)) {
    return res.status(400).json({ error: `Coleção inválida: ${col}` });
  }
  const updates = req.body || {};

  try {
    const result = await localStore.withLock((db) => {
      const existing = db[col][id];
      if (!existing) {
        return { error: 'Registro não encontrado.', status: 404 };
      }
      const next = { ...existing, ...updates };
      if (col === 'users' && existing.passwordHash && !updates.passwordHash) {
        next.passwordHash = existing.passwordHash;
      }
      db[col][id] = next;
      return { item: col === 'users' ? sanitizeUser(next) : next, status: 200 };
    });

    if ('error' in result) {
      return res.status(result.status).json({ error: result.error });
    }
    localStore.broadcastChange(col);
    res.json({ item: result.item });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao atualizar registro.' });
  }
});

app.delete('/api/db/:col/:id', async (req, res) => {
  const { col, id } = req.params;
  if (!ALLOWED_COLLECTIONS.has(col)) {
    return res.status(400).json({ error: `Coleção inválida: ${col}` });
  }

  try {
    let removedFileUrl = '';
    await localStore.withLock((db) => {
      const existing = db[col][id];
      if (col === 'files' && existing?.downloadUrl?.startsWith('/uploads/')) {
        removedFileUrl = existing.downloadUrl;
      }
      delete db[col][id];
    });

    if (removedFileUrl) {
      const diskPath = path.join(UPLOADS_DIR, path.basename(removedFileUrl));
      fs.promises.unlink(diskPath).catch(() => {});
    }

    localStore.broadcastChange(col);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao excluir registro.' });
  }
});

app.post('/api/db/batch', async (req, res) => {
  const ops = Array.isArray(req.body?.ops) ? req.body.ops : [];
  if (ops.length === 0) {
    return res.json({ success: true });
  }

  for (const op of ops) {
    if (!ALLOWED_COLLECTIONS.has(op?.col)) {
      return res.status(400).json({ error: `Coleção inválida no batch: ${op?.col}` });
    }
  }

  try {
    const touched = new Set<string>();
    const filesToDelete: string[] = [];

    await localStore.withLock((db) => {
      for (const op of ops) {
        const { type, col, id, data, merge } = op;
        touched.add(col);
        if (type === 'set') {
          const existing = db[col][id] || {};
          db[col][id] = merge ? { ...existing, ...data } : { ...data };
        } else if (type === 'update') {
          if (db[col][id]) {
            db[col][id] = { ...db[col][id], ...data };
          }
        } else if (type === 'delete') {
          const existing = db[col][id];
          if (col === 'files' && existing?.downloadUrl?.startsWith('/uploads/')) {
            filesToDelete.push(existing.downloadUrl);
          }
          delete db[col][id];
        }
      }
    });

    for (const fileUrl of filesToDelete) {
      const diskPath = path.join(UPLOADS_DIR, path.basename(fileUrl));
      fs.promises.unlink(diskPath).catch(() => {});
    }

    localStore.broadcastChange(Array.from(touched));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao executar operação em lote.' });
  }
});

app.post('/api/db/:col/mirror', async (req, res) => {
  const { col } = req.params;
  if (!ALLOWED_COLLECTIONS.has(col) || col === 'users' || col === 'admins') {
    return res.status(400).json({ error: `Coleção não espelhável: ${col}` });
  }
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    return res.json({ success: true, merged: 0 });
  }

  try {
    let merged = 0;
    await localStore.withLock((db) => {
      for (const item of items) {
        const id = item?.id || item?.firestoreDocId;
        if (!id) continue;
        const existing = db[col][id];
        if (existing?.localOnly) {
          const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const incomingTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
          if (existingTime >= incomingTime) continue;
        }
        db[col][id] = { ...item, id };
        merged++;
      }
    });
    res.json({ success: true, merged });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao espelhar registros no servidor.' });
  }
});

// ==========================================
// ATOMIC ATTENDANCE TRANSACTIONS & ROSTER
// ==========================================
app.post('/api/attendance/seed', async (req, res) => {
  try {
    await localStore.seedAttendanceRoster(Boolean(req.body?.forceRestore));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao inicializar lista de chamada.' });
  }
});

app.post('/api/attendance/claim', async (req, res) => {
  const { callBase, operator } = req.body || {};
  if (!callBase?.id || !operator?.uid) {
    return res.status(400).json({ error: 'Dados inválidos para assumir chamada.' });
  }
  const now = new Date().toISOString();

  try {
    const result = await localStore.withLock((db) => {
      const existing = db.attendance_calls[callBase.id] || null;
      if (existing?.activeOperatorUid && existing.activeOperatorUid !== operator.uid) {
        return {
          error: `ATTENDANCE_LOCKED:${existing.activeOperatorName || 'Outro membro'}`,
          status: 409,
        };
      }

      const nextPayload = {
        ...(existing || callBase),
        id: callBase.id,
        activeOperatorUid: operator.uid,
        activeOperatorName: operator.name,
        activeOperatorEmail: operator.email || '',
        activeOperatorStartedAt:
          existing?.activeOperatorUid === operator.uid && existing.activeOperatorStartedAt
            ? existing.activeOperatorStartedAt
            : now,
        callStatus: 'em_andamento',
        updatedByUid: operator.uid,
        updatedByName: operator.name,
        updatedAt: now,
        createdAt: existing?.createdAt || callBase.createdAt || now,
        createdByUid: existing?.createdByUid || callBase.createdByUid || operator.uid,
        createdByName: existing?.createdByName || callBase.createdByName || operator.name,
      };
      db.attendance_calls[callBase.id] = nextPayload;
      return { call: nextPayload, status: 200 };
    });

    if ('error' in result) {
      return res.status(result.status).json({ error: result.error });
    }
    localStore.broadcastChange('attendance_calls');
    return res.json({ call: result.call });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao assumir chamada.' });
  }
});

app.post('/api/attendance/release', async (req, res) => {
  const { callId, operator, markFinished } = req.body || {};
  if (!callId || !operator?.uid) {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }
  const now = new Date().toISOString();

  try {
    const result = await localStore.withLock((db) => {
      const existing = db.attendance_calls[callId];
      if (!existing) return { call: null, status: 200 };

      if (existing.activeOperatorUid && existing.activeOperatorUid !== operator.uid) {
        return {
          error: `ATTENDANCE_LOCKED:${existing.activeOperatorName || 'Outro membro'}`,
          status: 409,
        };
      }

      const nextPayload = {
        ...existing,
        id: callId,
        activeOperatorUid: null,
        activeOperatorName: null,
        activeOperatorEmail: null,
        activeOperatorStartedAt: null,
        callStatus: markFinished ? 'finalizada' : 'aberta',
        updatedByUid: operator.uid,
        updatedByName: operator.name,
        updatedAt: now,
      };
      db.attendance_calls[callId] = nextPayload;
      return { call: nextPayload, status: 200 };
    });

    if ('error' in result) {
      return res.status(result.status).json({ error: result.error });
    }
    localStore.broadcastChange('attendance_calls');
    return res.json({ call: result.call });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao liberar chamada.' });
  }
});

app.post('/api/attendance/save', async (req, res) => {
  const { call, options, operator } = req.body || {};
  if (!call?.id || !operator?.uid) {
    return res.status(400).json({ error: 'Dados inválidos ao salvar chamada.' });
  }
  const now = new Date().toISOString();

  try {
    const result = await localStore.withLock((db) => {
      const existing = db.attendance_calls[call.id] || null;
      if (existing?.activeOperatorUid && existing.activeOperatorUid !== operator.uid) {
        return {
          error: `ATTENDANCE_LOCKED:${existing.activeOperatorName || 'Outro membro'}`,
          status: 409,
        };
      }

      const shouldClaim =
        options?.autoClaimIfFree !== false &&
        (!existing || !existing.activeOperatorUid || existing.activeOperatorUid === operator.uid);

      const payload = {
        ...call,
        activeOperatorUid:
          call.activeOperatorUid !== undefined
            ? call.activeOperatorUid
            : shouldClaim
            ? operator.uid
            : existing?.activeOperatorUid ?? null,
        activeOperatorName:
          call.activeOperatorName !== undefined
            ? call.activeOperatorName
            : shouldClaim
            ? operator.name
            : existing?.activeOperatorName ?? null,
        activeOperatorEmail:
          call.activeOperatorEmail !== undefined
            ? call.activeOperatorEmail
            : shouldClaim
            ? operator.email || ''
            : existing?.activeOperatorEmail ?? null,
        activeOperatorStartedAt:
          call.activeOperatorStartedAt !== undefined
            ? call.activeOperatorStartedAt
            : shouldClaim
            ? existing?.activeOperatorStartedAt || now
            : existing?.activeOperatorStartedAt ?? null,
        callStatus:
          call.callStatus ||
          (shouldClaim ? 'em_andamento' : existing?.callStatus || 'aberta'),
        updatedByUid: operator.uid,
        updatedByName: operator.name,
        updatedAt: now,
        createdAt: existing?.createdAt || call.createdAt || now,
        createdByUid: existing?.createdByUid || call.createdByUid || operator.uid,
        createdByName: existing?.createdByName || call.createdByName || operator.name,
      };
      db.attendance_calls[call.id] = payload;
      return { call: payload, status: 200 };
    });

    if ('error' in result) {
      return res.status(result.status).json({ error: result.error });
    }
    localStore.broadcastChange('attendance_calls');
    return res.json({ call: result.call });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao salvar chamada.' });
  }
});

app.post('/api/attendance/qr-checkin', async (req, res) => {
  const { callBase, member, department, operator } = req.body || {};
  if (!callBase?.id || !member?.id || !operator?.uid) {
    return res.status(400).json({ error: 'Dados inválidos no check-in QR.' });
  }
  const now = new Date().toISOString();

  try {
    const result = await localStore.withLock((db) => {
      const existing = db.attendance_calls[callBase.id] || null;
      if (existing?.activeOperatorUid && existing.activeOperatorUid !== operator.uid) {
        return {
          error: `ATTENDANCE_LOCKED:${existing.activeOperatorName || 'Outro membro'}`,
          status: 409,
        };
      }

      const baseRecords = existing?.records || callBase.records || {};
      const existingEntry = baseRecords[member.id];
      if (existingEntry?.status === 'presente') {
        return {
          outcome: 'already_present' as const,
          call: existing || callBase,
          entry: existingEntry,
          status: 200,
        };
      }

      const entry = {
        memberId: member.id,
        memberName: member.name,
        departmentId: member.departmentId,
        departmentName: department?.name || existingEntry?.departmentName || 'Geral',
        status: 'presente',
        markedByUid: operator.uid,
        markedByName: operator.name,
        markedAt: now,
      };

      const baseIncluded = existing?.includedMemberIds || callBase.includedMemberIds || [];
      const nextIncluded = baseIncluded.includes(member.id)
        ? baseIncluded
        : [...baseIncluded, member.id];

      const nextCall = {
        ...(existing || callBase),
        id: callBase.id,
        includedMemberIds: nextIncluded,
        records: {
          ...baseRecords,
          [member.id]: entry,
        },
        activeOperatorUid: operator.uid,
        activeOperatorName: operator.name,
        activeOperatorEmail: operator.email || '',
        activeOperatorStartedAt:
          existing?.activeOperatorUid === operator.uid && existing.activeOperatorStartedAt
            ? existing.activeOperatorStartedAt
            : now,
        callStatus: 'em_andamento',
        updatedByUid: operator.uid,
        updatedByName: operator.name,
        updatedAt: now,
        createdAt: existing?.createdAt || callBase.createdAt || now,
        createdByUid: existing?.createdByUid || callBase.createdByUid || operator.uid,
        createdByName: existing?.createdByName || callBase.createdByName || operator.name,
      };

      db.attendance_calls[callBase.id] = nextCall;
      return {
        outcome: 'checked_in_now' as const,
        call: nextCall,
        entry,
        status: 200,
      };
    });

    if ('error' in result) {
      return res.status(result.status).json({ error: result.error });
    }
    if (result.outcome === 'checked_in_now') {
      localStore.broadcastChange('attendance_calls');
    }
    return res.json({
      outcome: result.outcome,
      call: result.call,
      entry: result.entry,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao confirmar presença via QR.' });
  }
});

// ==========================================
// GOOGLE DRIVE OAUTH, RESUMABLE UPLOAD & RANGE STREAMING
// ==========================================
function isCallerSuperAdmin(req: express.Request): { ok: boolean; uid: string; email: string } {
  const uid = String(req.headers['x-ptb-uid'] || '').trim();
  const email = String(req.headers['x-ptb-email'] || '').trim().toLowerCase();
  if (!uid && !email) return { ok: false, uid: '', email: '' };
  if (email && SUPER_ADMIN_EMAIL_SET.has(email)) {
    return { ok: true, uid, email };
  }
  const snap = localStore.readSnapshot();
  const matched = Object.values(snap.users || {}).find(
    (u: any) =>
      ((uid && (u.uid === uid || u.id === uid)) ||
        (email && (u.email || '').toLowerCase().trim() === email)) &&
      u.role === 'super_admin' &&
      u.status !== 'blocked'
  ) as any;
  return { ok: Boolean(matched), uid, email };
}

function isCallerTeamMember(req: express.Request): { ok: boolean; uid: string; email: string } {
  const uid = String(req.headers['x-ptb-uid'] || '').trim();
  const email = String(req.headers['x-ptb-email'] || '').trim().toLowerCase();
  if (!uid && !email) return { ok: false, uid: '', email: '' };
  if (email && SUPER_ADMIN_EMAIL_SET.has(email)) {
    return { ok: true, uid, email };
  }
  const snap = localStore.readSnapshot();
  const matched = Object.values(snap.users || {}).find(
    (u: any) =>
      ((uid && (u.uid === uid || u.id === uid)) ||
        (email && (u.email || '').toLowerCase().trim() === email)) &&
      u.status !== 'blocked'
  ) as any;
  return { ok: Boolean(matched), uid, email };
}

function encodeInlineOrAttach(filename: string, inline: boolean): string {
  const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'arquivo';
  return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(
    filename
  )}`;
}

async function streamRemoteFirebaseUrl(
  targetUrl: string,
  req: express.Request,
  res: express.Response,
  options: { inline: boolean; filename: string; mimeType?: string }
) {
  if (!isAllowedLegacyFirebaseUrl(targetUrl)) {
    return res.status(400).json({ error: 'URL de origem não permitida.' });
  }
  const rangeHeader = req.headers.range;
  const controller = new AbortController();
  res.on('close', () => {
    try {
      controller.abort();
    } catch {}
  });

  const upstreamRes = await fetch(targetUrl, {
    headers: rangeHeader ? { Range: String(rangeHeader) } : {},
    signal: controller.signal,
  });

  if (!upstreamRes.ok && upstreamRes.status !== 206) {
    return res.status(upstreamRes.status).json({
      error: `Falha ao ler origem legada (${upstreamRes.status}).`,
    });
  }

  const contentType =
    upstreamRes.headers.get('content-type') || options.mimeType || 'application/octet-stream';
  const contentLength = upstreamRes.headers.get('content-length');
  const contentRange = upstreamRes.headers.get('content-range');
  const acceptRanges = upstreamRes.headers.get('accept-ranges') || 'bytes';

  res.status(upstreamRes.status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', acceptRanges);
  if (contentLength) res.setHeader('Content-Length', contentLength);
  if (contentRange) res.setHeader('Content-Range', contentRange);
  res.setHeader('Content-Disposition', encodeInlineOrAttach(options.filename, options.inline));

  if (!upstreamRes.body) {
    res.end();
    return;
  }
  const { Readable } = await import('stream');
  Readable.fromWeb(upstreamRes.body as any).pipe(res);
}

app.get('/api/drive/status', async (req, res) => {
  try {
    const status = await getPublicDriveStatus(req);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao consultar status do Google Drive.' });
  }
});

app.get('/api/drive/oauth/url', (req, res) => {
  const caller = isCallerSuperAdmin(req);
  if (!caller.ok) {
    return res.status(403).json({
      error: 'Apenas o Super Administrador pode conectar a conta do Google Drive.',
    });
  }
  try {
    const data = buildDriveOAuthUrl(req, { uid: caller.uid, email: caller.email });
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Falha ao gerar URL OAuth do Google Drive.' });
  }
});

const driveOAuthCallbackHandler: express.RequestHandler = async (req, res) => {
  try {
    const status = await handleDriveOAuthCallback(req);
    const safePayload = JSON.stringify({
      type: 'DRIVE_OAUTH_SUCCESS',
      accountEmail: status.accountEmail,
      accountName: status.accountName,
      folderId: status.folderId,
      folderName: status.folderName,
    }).replace(/</g, '\\u003c');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><title>Google Drive Conectado</title></head>
  <body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
    <div style="text-align:center;padding:24px;max-width:420px;">
      <h2 style="margin:0 0 8px;color:#fbbf24;">Google Drive conectado com sucesso</h2>
      <p style="font-size:14px;color:#a3a3a3;margin:0 0 16px;">Pasta configurada: <strong>PT-B Mídia</strong>. Esta janela fechará automaticamente.</p>
      <script>
        try {
          if (window.opener) {
            window.opener.postMessage(${safePayload}, '*');
            setTimeout(function() { window.close(); }, 350);
          } else {
            window.location.href = '/';
          }
        } catch (e) {}
      </script>
    </div>
  </body>
</html>`);
  } catch (err: any) {
    const safeError = JSON.stringify({
      type: 'DRIVE_OAUTH_ERROR',
      error: err?.message || 'Falha na conexão com Google Drive.',
    }).replace(/</g, '\\u003c');

    res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><title>Erro na conexão Google Drive</title></head>
  <body style="font-family:system-ui,sans-serif;background:#0a0a0a;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
    <div style="text-align:center;padding:24px;max-width:460px;">
      <h2 style="margin:0 0 8px;color:#f87171;">Não foi possível conectar o Google Drive</h2>
      <p style="font-size:13px;color:#d4d4d4;margin:0 0 16px;">${String(err?.message || 'Erro desconhecido').replace(/[<>&"]/g, '')}</p>
      <script>
        try {
          if (window.opener) {
            window.opener.postMessage(${safeError}, '*');
          }
        } catch (e) {}
      </script>
    </div>
  </body>
</html>`);
  }
};

app.get(['/api/drive/oauth/callback', '/api/drive/oauth/callback/'], driveOAuthCallbackHandler);

app.post('/api/drive/disconnect', async (req, res) => {
  const caller = isCallerSuperAdmin(req);
  if (!caller.ok) {
    return res.status(403).json({
      error: 'Apenas o Super Administrador pode desconectar o Google Drive.',
    });
  }
  try {
    await clearDriveTokenRecord();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao desconectar Google Drive.' });
  }
});

app.post('/api/drive/upload/session', async (req, res) => {
  const caller = isCallerTeamMember(req);
  if (!caller.ok) {
    return res.status(401).json({ error: 'Autenticação necessária para iniciar upload no Drive.' });
  }
  const { name, mimeType, size, isThumbnail, ptbFileId } = req.body || {};
  if (!name || typeof size !== 'number' || size < 0) {
    return res.status(400).json({ error: 'Parâmetros inválidos para sessão de upload no Drive.' });
  }
  try {
    const origin = req.headers.origin ? String(req.headers.origin) : undefined;
    const session = await createDriveResumableSession({
      name: String(name),
      mimeType: String(mimeType || 'application/octet-stream'),
      size,
      origin,
      isThumbnail: Boolean(isThumbnail),
      ptbFileId: ptbFileId ? String(ptbFileId) : undefined,
    });
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao criar sessão resumível no Google Drive.' });
  }
});

// Optional chunk proxy strictly for small chunks (<= 4 MB) if browser direct PUT to Google Drive hits CORS restrictions
app.put(
  '/api/drive/upload/chunk-proxy',
  express.raw({ type: '*/*', limit: '4mb' }),
  async (req, res) => {
    const caller = isCallerTeamMember(req);
    if (!caller.ok) {
      return res.status(401).json({ error: 'Autenticação necessária.' });
    }
    const sessionUri = String(req.headers['x-drive-session-uri'] || '').trim();
    const contentRange = String(req.headers['x-content-range'] || '').trim();
    const contentType = String(req.headers['x-upload-content-type'] || 'application/octet-stream');

    let parsedSession: URL;
    try {
      parsedSession = new URL(sessionUri);
    } catch {
      return res.status(400).json({ error: 'Session URI inválida.' });
    }
    if (
      parsedSession.protocol !== 'https:' ||
      parsedSession.hostname.toLowerCase() !== 'www.googleapis.com' ||
      !parsedSession.pathname.startsWith('/upload/drive/')
    ) {
      return res.status(400).json({ error: 'Destino de sessão não permitido.' });
    }

    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    try {
      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
      };
      if (contentRange) {
        headers['Content-Range'] = contentRange;
      }
      const upstream = await fetch(parsedSession.toString(), {
        method: 'PUT',
        headers,
        body: buffer,
      });
      const text = await upstream.text();
      res.status(upstream.status);
      const rangeHeader = upstream.headers.get('range');
      if (rangeHeader) res.setHeader('X-Drive-Range', rangeHeader);
      if (text) {
        try {
          return res.json(JSON.parse(text));
        } catch {
          return res.send(text);
        }
      }
      return res.end();
    } catch (err: any) {
      return res.status(502).json({ error: err?.message || 'Erro no envio de parte para o Drive.' });
    }
  }
);

app.get('/api/drive/files/:driveFileId/verify', async (req, res) => {
  const caller = isCallerTeamMember(req);
  if (!caller.ok) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }
  try {
    const meta = await getDriveFileMetadata(req.params.driveFileId);
    res.json(meta);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao verificar arquivo no Drive.' });
  }
});

app.get('/api/drive/stream/:driveFileId', async (req, res) => {
  const { driveFileId } = req.params;
  if (!driveFileId) {
    return res.status(400).json({ error: 'driveFileId inválido.' });
  }
  const inline = req.query.download !== '1';
  const filename = String(req.query.name || driveFileId);
  try {
    await streamDriveFileToResponse(driveFileId, req, res, { inline, filename });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(502).json({ error: err?.message || 'Erro ao transmitir do Google Drive.' });
    }
  }
});

app.get('/api/drive/proxy-legacy', async (req, res) => {
  const caller = isCallerSuperAdmin(req);
  if (!caller.ok) {
    return res.status(403).json({
      error: 'Apenas o Super Administrador pode ler arquivos legados para migração.',
    });
  }
  const targetUrl = String(req.query.url || '').trim();
  if (!isAllowedLegacyFirebaseUrl(targetUrl)) {
    return res.status(400).json({ error: 'URL de origem legada não permitida.' });
  }
  try {
    await streamRemoteFirebaseUrl(targetUrl, req, res, {
      inline: true,
      filename: 'legacy_asset',
    });
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(502).json({ error: err?.message || 'Falha ao ler origem legada.' });
    }
  }
});

app.post('/api/church-downloads/:id/increment', async (req, res) => {
  const { id } = req.params;
  try {
    await localStore.withLock((db) => {
      const existing = db.church_downloads[id];
      if (existing) {
        existing.downloadCount = (existing.downloadCount || 0) + 1;
        db.church_downloads[id] = existing;
      }
    });
    localStore.broadcastChange('church_downloads');
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

async function resolveFileDocForServing(id: string): Promise<any | null> {
  const snap = localStore.readSnapshot();
  if (snap.files[id]) {
    return snap.files[id];
  }
  try {
    const db = getServerFirestore();
    const docSnap = await fbGetDoc(fbDoc(db, 'files', id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...(docSnap.data() as any) };
    }
  } catch {}
  return null;
}

// Streaming + Range + Attachment Download endpoint (/api/download)
app.get('/api/download', async (req, res) => {
  const fileId = String(req.query.id || '').trim();
  const driveFileIdParam = String(req.query.driveFileId || '').trim();
  const fileUrl = String(req.query.url || '').trim();
  const customName = String(req.query.name || '').trim();
  const inline = req.query.inline === '1';

  try {
    if (driveFileIdParam) {
      return await streamDriveFileToResponse(driveFileIdParam, req, res, {
        inline,
        filename: customName || driveFileIdParam,
      });
    }

    if (fileId) {
      const docRecord = await resolveFileDocForServing(fileId);
      if (docRecord?.driveFileId) {
        return await streamDriveFileToResponse(docRecord.driveFileId, req, res, {
          inline,
          filename: customName || docRecord.name || fileId,
          mimeType: docRecord.driveMimeType || docRecord.mimeType,
        });
      }
    }

    if (fileUrl.includes('/api/files/') && fileUrl.includes('/download')) {
      const match = fileUrl.match(/\/api\/files\/([^/?]+)\/download/);
      if (match?.[1]) {
        const docRecord = await resolveFileDocForServing(match[1]);
        if (docRecord?.driveFileId) {
          return await streamDriveFileToResponse(docRecord.driveFileId, req, res, {
            inline,
            filename: customName || docRecord.name || match[1],
            mimeType: docRecord.driveMimeType || docRecord.mimeType,
          });
        }
      }
    }

    if (fileUrl.startsWith('/api/drive/stream/')) {
      const idPart = fileUrl.replace('/api/drive/stream/', '').split('?')[0];
      if (idPart) {
        return await streamDriveFileToResponse(idPart, req, res, {
          inline,
          filename: customName || idPart,
        });
      }
    }

    if (fileUrl.startsWith('/uploads/')) {
      const diskPath = path.resolve(UPLOADS_DIR, path.basename(fileUrl));
      if (diskPath.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(diskPath)) {
        return streamDiskFileWithRange(diskPath, req, res, {
          inline,
          filename: customName || path.basename(diskPath),
        });
      }
    }

    if (isAllowedLegacyFirebaseUrl(fileUrl)) {
      return await streamRemoteFirebaseUrl(fileUrl, req, res, {
        inline,
        filename: customName || 'arquivo_original',
      });
    }

    if (fileUrl && /^https?:\/\//i.test(fileUrl)) {
      return res.redirect(fileUrl);
    }

    return res.status(404).send('Arquivo não encontrado.');
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(502).json({ error: err?.message || 'Erro ao baixar arquivo.' });
    }
  }
});

// Unified File Download & Range Streaming endpoint (/api/files/:id/download)
app.get('/api/files/:id/download', async (req, res) => {
  const { id } = req.params;
  const customName = String(req.query.name || '').trim();
  const inline =
    req.query.download === '1'
      ? false
      : req.query.inline === '1' || Boolean(req.headers.range) || true;

  try {
    const fileDoc = await resolveFileDocForServing(id);

    // 1. Se já migrado ou enviado ao Google Drive, faz streaming com Range direto do Drive
    if (fileDoc?.driveFileId) {
      return await streamDriveFileToResponse(fileDoc.driveFileId, req, res, {
        inline,
        filename: customName || fileDoc.name || id,
        mimeType: fileDoc.driveMimeType || fileDoc.mimeType,
      });
    }

    // 2. Enquanto não tiver driveFileId, serve pela origem antiga (/uploads ou Firebase Storage)
    const legacySource = String(fileDoc?.legacyUrl || fileDoc?.downloadUrl || '');
    if (legacySource.startsWith('/uploads/')) {
      const diskPath = path.resolve(UPLOADS_DIR, path.basename(legacySource));
      if (diskPath.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(diskPath)) {
        return streamDiskFileWithRange(diskPath, req, res, {
          inline,
          filename: customName || fileDoc?.name || path.basename(diskPath),
          mimeType: fileDoc?.mimeType,
        });
      }
    }

    if (isAllowedLegacyFirebaseUrl(legacySource)) {
      return await streamRemoteFirebaseUrl(legacySource, req, res, {
        inline,
        filename: customName || fileDoc?.name || id,
        mimeType: fileDoc?.mimeType,
      });
    }

    // Fallback scan inside UPLOADS_DIR by ID
    try {
      const files = fs.readdirSync(UPLOADS_DIR);
      const match = files.find((f) => f.includes(id) || (customName && f.endsWith(customName)));
      if (match) {
        const diskPath = path.resolve(UPLOADS_DIR, match);
        if (diskPath.startsWith(UPLOADS_DIR + path.sep) && fs.existsSync(diskPath)) {
          return streamDiskFileWithRange(diskPath, req, res, {
            inline,
            filename: customName || fileDoc?.name || match,
            mimeType: fileDoc?.mimeType,
          });
        }
      }
    } catch {}

    return res.status(404).json({ error: 'Arquivo não encontrado no servidor.' });
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(502).json({ error: err?.message || 'Erro ao servir arquivo.' });
    }
  }
});

// Basic health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    platform: 'PT-B Mídia',
    infrastructure: 'Servidor Dedicado PT-B Mídia',
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PT-B Mídia Server] Running on http://localhost:${PORT}`);
  });
}

startServer();

