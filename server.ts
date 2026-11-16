import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import {
  localStore,
  ALLOWED_COLLECTIONS,
  hashPassword,
  verifyPassword,
  sanitizeUser,
  StoredUserRecord,
} from './server/store.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded media files directly (return 404 instead of SPA fallback when missing)
app.use(
  '/uploads',
  express.static(UPLOADS_DIR),
  (_req, res) => {
    res.status(404).json({ error: 'Arquivo não encontrado.' });
  }
);

// Dedicated binary upload endpoint (registered before express.json so JSON files also upload as raw Buffer)
app.post('/api/upload', express.raw({ type: '*/*', limit: '250mb' }), (req, res) => {
  const rawFileName = (req.headers['x-filename'] as string) || `file_${Date.now()}`;
  const decodedFileName = decodeURIComponent(rawFileName);
  const cleanName = decodedFileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const uniqueName = `${Date.now()}_${cleanName}`;
  const filePath = path.join(UPLOADS_DIR, uniqueName);

  const buffer = req.body as Buffer;
  if (!buffer || buffer.length === 0) {
    return res.status(400).json({ error: 'Nenhum dado recebido para upload.' });
  }

  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error('[Upload API] Error writing file to disk:', err);
      return res.status(500).json({ error: 'Falha ao salvar arquivo no armazenamento local.' });
    }

    const downloadUrl = `/uploads/${uniqueName}`;
    res.json({
      success: true,
      filename: uniqueName,
      originalName: decodedFileName,
      downloadUrl,
      size: buffer.length,
    });
  });
});

app.use(express.json({ limit: '50mb' }));

// Real-time Server-Sent Events stream
app.get('/api/realtime', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ connected: true, ts: Date.now() })}\n\n`);
  localStore.registerSseClient(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

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
    role === 'super_admin' || role === 'media_admin' || role === 'media_member'
      ? role
      : 'media_member';

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Administrador',
    media_admin: 'Administrador de Mídia',
    media_member: 'Membro da Mídia',
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
        canManageChurchPage: resolvedRole === 'super_admin',
        canManageFinances: resolvedRole === 'super_admin' || resolvedRole === 'media_admin',
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

// Dedicated direct download endpoint with Content-Disposition attachment for mobile devices
app.get('/api/download', (req, res) => {
  const fileUrl = (req.query.url as string) || '';
  const customName = (req.query.name as string) || '';

  if (fileUrl.startsWith('/uploads/')) {
    const fileName = path.basename(fileUrl);
    const filePath = path.join(UPLOADS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      return res.download(filePath, customName || fileName);
    }
  }

  if (fileUrl) {
    return res.redirect(fileUrl);
  }
  res.status(404).send('Arquivo não encontrado.');
});

// Fallback endpoint for /api/files/:id/download
app.get('/api/files/:id/download', (req, res) => {
  const { id } = req.params;
  const customName = req.query.name as string;

  const snap = localStore.readSnapshot();
  const fileDoc = snap.files[id];
  if (fileDoc?.downloadUrl?.startsWith('/uploads/')) {
    const diskPath = path.join(UPLOADS_DIR, path.basename(fileDoc.downloadUrl));
    if (fs.existsSync(diskPath)) {
      return res.download(diskPath, customName || fileDoc.name || path.basename(diskPath));
    }
  }

  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const match = files.find((f) => f.includes(id) || (customName && f.endsWith(customName)));
    if (match) {
      const filePath = path.join(UPLOADS_DIR, match);
      return res.download(filePath, customName || match);
    }
  } catch {}

  res.status(404).json({ error: 'Arquivo não encontrado no servidor.' });
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

