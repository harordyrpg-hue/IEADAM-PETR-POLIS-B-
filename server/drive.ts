import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import type { Request, Response } from 'express';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DRIVE_TOKEN_FILE = path.join(DATA_DIR, 'drive_oauth_tokens.json');
const DRIVE_FOLDER_NAME = 'PT-B Mídia';
const DRIVE_THUMBS_SUBFOLDER_NAME = '_Miniaturas';
const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

const EPHEMERAL_STATE_SECRET = crypto.randomBytes(32).toString('hex');

export interface ServerDriveTokenRecord {
  id: string;
  refresh_token: string;
  access_token?: string | null;
  access_token_expires_at?: string | null;
  account_email?: string | null;
  account_name?: string | null;
  folder_id?: string | null;
  folder_name?: string | null;
  thumbs_folder_id?: string | null;
  scope?: string | null;
  created_at?: string;
  updated_at?: string;
}

let inMemoryTokenCache: ServerDriveTokenRecord | null | undefined = undefined;
let stateCacheLock = Promise.resolve();

function withDriveTokenLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = stateCacheLock.then(fn, fn);
  stateCacheLock = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function getOAuthCredentials() {
  const clientId = (
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    ''
  ).trim();
  const clientSecret = (
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    ''
  ).trim();
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
}

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return {
    url,
    serviceKey,
    enabled: Boolean(url && serviceKey && !url.includes('MY_SUPABASE')),
  };
}

export function getAppBaseUrl(req?: Request): string {
  const envUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envUrl && envUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(envUrl)) {
    return envUrl;
  }
  if (req) {
    const proto =
      String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000')
      .split(',')[0]
      .trim();
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

export function getDriveRedirectUri(req?: Request): string {
  return `${getAppBaseUrl(req)}/api/drive/oauth/callback`;
}

function getStateSigningKey(): string {
  return (process.env.DRIVE_OAUTH_STATE_SECRET || '').trim() || EPHEMERAL_STATE_SECRET;
}

export function createSignedOAuthState(payload: { uid?: string; email?: string }): string {
  const body = Buffer.from(
    JSON.stringify({
      nonce: crypto.randomBytes(12).toString('hex'),
      ts: Date.now(),
      uid: payload.uid || '',
      email: payload.email || '',
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getStateSigningKey())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifySignedOAuthState(state: string): boolean {
  if (!state || typeof state !== 'string' || !state.includes('.')) return false;
  const [body, sig] = state.split('.');
  if (!body || !sig) return false;
  const expected = crypto
    .createHmac('sha256', getStateSigningKey())
    .update(body)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof decoded.ts !== 'number') return false;
    // Valid for 15 minutes
    return Date.now() - decoded.ts <= 15 * 60 * 1000;
  } catch {
    return false;
  }
}

async function checkSupabaseDriveTable(): Promise<{ ready: boolean; error?: string }> {
  const supa = getSupabaseConfig();
  if (!supa.enabled) return { ready: true };
  try {
    const res = await fetch(`${supa.url}/rest/v1/google_drive_tokens?select=id&limit=1`, {
      headers: {
        apikey: supa.serviceKey,
        Authorization: `Bearer ${supa.serviceKey}`,
      },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) return { ready: true };
    const text = await res.text().catch(() => '');
    return { ready: false, error: `HTTP ${res.status}: ${text}` };
  } catch (err: any) {
    return { ready: false, error: err?.message || 'Erro de conexão com Supabase' };
  }
}

async function loadDriveTokenRecord(): Promise<ServerDriveTokenRecord | null> {
  if (inMemoryTokenCache !== undefined && inMemoryTokenCache !== null) {
    return inMemoryTokenCache;
  }

  const supa = getSupabaseConfig();
  if (supa.enabled) {
    try {
      const res = await fetch(
        `${supa.url}/rest/v1/google_drive_tokens?id=eq.church_drive&select=*`,
        {
          headers: {
            apikey: supa.serviceKey,
            Authorization: `Bearer ${supa.serviceKey}`,
          },
          signal: AbortSignal.timeout(4000),
        }
      );
      if (res.ok) {
        const rows = (await res.json()) as ServerDriveTokenRecord[];
        if (Array.isArray(rows) && rows.length > 0 && rows[0]?.refresh_token) {
          inMemoryTokenCache = rows[0];
          return rows[0];
        }
        inMemoryTokenCache = null;
        return null;
      }
    } catch (err) {
      console.warn('[Drive Token] Supabase read fallback note:', err);
    }
  }

  try {
    if (fs.existsSync(DRIVE_TOKEN_FILE)) {
      const raw = fs.readFileSync(DRIVE_TOKEN_FILE, 'utf8');
      const parsed = JSON.parse(raw) as ServerDriveTokenRecord;
      if (parsed?.refresh_token) {
        inMemoryTokenCache = parsed;
        return parsed;
      }
    }
  } catch {}

  return null;
}

async function saveDriveTokenRecord(record: ServerDriveTokenRecord): Promise<void> {
  const now = new Date().toISOString();
  const payload: ServerDriveTokenRecord = {
    ...record,
    id: 'church_drive',
    folder_name: record.folder_name || DRIVE_FOLDER_NAME,
    created_at: record.created_at || now,
    updated_at: now,
  };

  const supa = getSupabaseConfig();
  if (supa.enabled) {
    const res = await fetch(`${supa.url}/rest/v1/google_drive_tokens?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supa.serviceKey,
        Authorization: `Bearer ${supa.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Falha ao gravar token na tabela public.google_drive_tokens do Supabase (${res.status}): ${text}. Verifique se executou o SQL de supabase_drive_tokens.sql no Supabase.`
      );
    }
    inMemoryTokenCache = payload;
    return;
  }

  // Fallback local protegido apenas quando Supabase não está configurado
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmp = `${DRIVE_TOKEN_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, DRIVE_TOKEN_FILE);
  inMemoryTokenCache = payload;
}

export async function clearDriveTokenRecord(): Promise<void> {
  return withDriveTokenLock(async () => {
    inMemoryTokenCache = null;
    const supa = getSupabaseConfig();
    if (supa.enabled) {
      await fetch(`${supa.url}/rest/v1/google_drive_tokens?id=eq.church_drive`, {
        method: 'DELETE',
        headers: {
          apikey: supa.serviceKey,
          Authorization: `Bearer ${supa.serviceKey}`,
        },
      }).catch(() => {});
    }
    if (fs.existsSync(DRIVE_TOKEN_FILE)) {
      fs.unlinkSync(DRIVE_TOKEN_FILE);
    }
  });
}

export async function getPublicDriveStatus(req?: Request) {
  const creds = getOAuthCredentials();
  const supa = getSupabaseConfig();
  const token = await loadDriveTokenRecord();
  const supaCheck = supa.enabled && !token ? await checkSupabaseDriveTable() : { ready: true };
  return {
    configured: creds.configured,
    connected: Boolean(token?.refresh_token),
    accountEmail: token?.account_email || null,
    accountName: token?.account_name || null,
    folderId: token?.folder_id || null,
    folderName: token?.folder_name || DRIVE_FOLDER_NAME,
    thumbsFolderId: token?.thumbs_folder_id || null,
    tokenBackend: supa.enabled ? 'supabase' : 'server',
    supabaseTableReady: supa.enabled ? supaCheck.ready : true,
    supabaseError: supa.enabled && !supaCheck.ready ? supaCheck.error || null : null,
    redirectUri: getDriveRedirectUri(req),
    updatedAt: token?.updated_at || null,
  };
}

export function buildDriveOAuthUrl(req: Request, caller: { uid?: string; email?: string }) {
  const creds = getOAuthCredentials();
  if (!creds.configured) {
    throw new Error(
      'Credenciais OAuth do servidor não configuradas (GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET).'
    );
  }
  const redirectUri = getDriveRedirectUri(req);
  const state = createSignedOAuthState(caller);
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    redirectUri,
  };
}

export async function getValidDriveAccessToken(): Promise<{
  accessToken: string;
  tokenRecord: ServerDriveTokenRecord;
}> {
  return withDriveTokenLock(async () => {
    const token = await loadDriveTokenRecord();
    if (!token?.refresh_token) {
      throw new Error('Google Drive da igreja ainda não está conectado.');
    }

    const expiresAtMs = token.access_token_expires_at
      ? new Date(token.access_token_expires_at).getTime()
      : 0;
    if (token.access_token && expiresAtMs > Date.now() + 90_000) {
      return { accessToken: token.access_token, tokenRecord: token };
    }

    const creds = getOAuthCredentials();
    if (!creds.configured) {
      throw new Error(
        'Credenciais OAuth do Google Drive ausentes no servidor para renovar o token.'
      );
    }

    const body = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || !data?.access_token) {
      throw new Error(
        data?.error_description || data?.error || `Falha ao renovar access token do Drive (${res.status}).`
      );
    }

    const expiresInSec = Number(data.expires_in || 3500);
    const updated: ServerDriveTokenRecord = {
      ...token,
      access_token: data.access_token,
      access_token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    };
    await saveDriveTokenRecord(updated);
    return { accessToken: data.access_token, tokenRecord: updated };
  });
}

async function driveJsonFetch(
  accessToken: string,
  url: string,
  init?: RequestInit
): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(json?.error?.message || json?.error || `Google Drive API erro ${res.status}`);
  }
  return json;
}

async function findOrCreateDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string | null
): Promise<string> {
  const escaped = folderName.replace(/'/g, "\\'");
  let q = `name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name)&pageSize=5`;
  const searchRes = await driveJsonFetch(accessToken, searchUrl);
  if (Array.isArray(searchRes.files) && searchRes.files.length > 0 && searchRes.files[0]?.id) {
    return searchRes.files[0].id as string;
  }

  const created = await driveJsonFetch(
    accessToken,
    'https://www.googleapis.com/drive/v3/files?fields=id,name',
    {
      method: 'POST',
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    }
  );
  return created.id as string;
}

async function verifyFolderExists(accessToken: string, folderId?: string | null): Promise<boolean> {
  if (!folderId) return false;
  try {
    const meta = await driveJsonFetch(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,trashed`
    );
    return Boolean(meta?.id && !meta?.trashed);
  } catch {
    return false;
  }
}

export async function ensureDriveWorkspaceFolders(): Promise<{
  accessToken: string;
  folderId: string;
  thumbsFolderId: string;
  tokenRecord: ServerDriveTokenRecord;
}> {
  const { accessToken, tokenRecord } = await getValidDriveAccessToken();

  let folderId = tokenRecord.folder_id || null;
  let thumbsFolderId = tokenRecord.thumbs_folder_id || null;
  let changed = false;

  if (!(await verifyFolderExists(accessToken, folderId))) {
    folderId = await findOrCreateDriveFolder(accessToken, DRIVE_FOLDER_NAME);
    changed = true;
  }

  if (!(await verifyFolderExists(accessToken, thumbsFolderId))) {
    thumbsFolderId = await findOrCreateDriveFolder(
      accessToken,
      DRIVE_THUMBS_SUBFOLDER_NAME,
      folderId
    );
    changed = true;
  }

  if (changed) {
    const updated: ServerDriveTokenRecord = {
      ...tokenRecord,
      folder_id: folderId,
      folder_name: DRIVE_FOLDER_NAME,
      thumbs_folder_id: thumbsFolderId,
    };
    await withDriveTokenLock(async () => {
      await saveDriveTokenRecord(updated);
    });
    return {
      accessToken,
      folderId: folderId!,
      thumbsFolderId: thumbsFolderId!,
      tokenRecord: updated,
    };
  }

  return {
    accessToken,
    folderId: folderId!,
    thumbsFolderId: thumbsFolderId!,
    tokenRecord,
  };
}

export async function handleDriveOAuthCallback(req: Request) {
  const code = String(req.query.code || '').trim();
  const state = String(req.query.state || '').trim();
  const oauthError = String(req.query.error || '').trim();

  if (oauthError) {
    throw new Error(`Autorização Google Drive cancelada ou recusada: ${oauthError}`);
  }
  if (!code || !verifySignedOAuthState(state)) {
    throw new Error('Estado OAuth inválido ou expirado. Tente conectar novamente.');
  }

  const creds = getOAuthCredentials();
  if (!creds.configured) {
    throw new Error('GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET não configurados.');
  }

  const redirectUri = getDriveRedirectUri(req);
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = (await tokenRes.json().catch(() => ({}))) as any;
  if (!tokenRes.ok || !tokenData?.access_token) {
    throw new Error(
      tokenData?.error_description || tokenData?.error || `Falha na troca do código OAuth (${tokenRes.status}).`
    );
  }

  const existing = await loadDriveTokenRecord();
  const refreshToken = String(tokenData.refresh_token || existing?.refresh_token || '');
  if (!refreshToken) {
    throw new Error(
      'O Google não retornou refresh_token. Remova a permissão anterior em myaccount.google.com/permissions e reconecte.'
    );
  }

  let accountEmail: string | null = existing?.account_email || null;
  let accountName: string | null = existing?.account_name || null;
  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userRes.ok) {
      const info = (await userRes.json()) as any;
      accountEmail = info?.email || accountEmail;
      accountName = info?.name || accountName;
    }
  } catch {}

  if (!accountEmail) {
    try {
      const aboutRes = await fetch(
        'https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)',
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      if (aboutRes.ok) {
        const about = (await aboutRes.json()) as any;
        accountEmail = about?.user?.emailAddress || accountEmail;
        accountName = about?.user?.displayName || accountName;
      }
    } catch {}
  }

  const expiresInSec = Number(tokenData.expires_in || 3500);
  const folderId = await findOrCreateDriveFolder(tokenData.access_token, DRIVE_FOLDER_NAME);
  const thumbsFolderId = await findOrCreateDriveFolder(
    tokenData.access_token,
    DRIVE_THUMBS_SUBFOLDER_NAME,
    folderId
  );

  const saved: ServerDriveTokenRecord = {
    id: 'church_drive',
    refresh_token: refreshToken,
    access_token: tokenData.access_token,
    access_token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    account_email: accountEmail,
    account_name: accountName,
    folder_id: folderId,
    folder_name: DRIVE_FOLDER_NAME,
    thumbs_folder_id: thumbsFolderId,
    scope: tokenData.scope || DRIVE_SCOPES,
    created_at: existing?.created_at,
  };

  await withDriveTokenLock(async () => {
    await saveDriveTokenRecord(saved);
  });

  return {
    connected: true,
    accountEmail,
    accountName,
    folderId,
    folderName: DRIVE_FOLDER_NAME,
  };
}

export async function findExistingMigratedDriveFile(
  ptbFileId: string
): Promise<{ id: string; name: string; size: number; mimeType: string } | null> {
  if (!ptbFileId) return null;
  const { accessToken, folderId } = await ensureDriveWorkspaceFolders();
  const escaped = ptbFileId.replace(/'/g, "\\'");
  const q = `'${folderId}' in parents and appProperties has { key='ptbFileId' and value='${escaped}' } and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,size,mimeType)&pageSize=5`;
  const res = await driveJsonFetch(accessToken, url);
  const first = Array.isArray(res.files) ? res.files[0] : null;
  if (!first?.id) return null;
  return {
    id: String(first.id),
    name: String(first.name || ''),
    size: Number(first.size || 0),
    mimeType: String(first.mimeType || 'application/octet-stream'),
  };
}

export async function createDriveResumableSession(params: {
  name: string;
  mimeType: string;
  size: number;
  origin?: string;
  isThumbnail?: boolean;
  ptbFileId?: string;
}): Promise<{
  alreadyExists?: boolean;
  existingFile?: { id: string; name: string; size: number; mimeType: string };
  sessionUri?: string;
  folderId: string;
  folderName: string;
}> {
  const { accessToken, folderId, thumbsFolderId } = await ensureDriveWorkspaceFolders();

  // Dedup protection for safe resumable migration
  if (params.ptbFileId && !params.isThumbnail) {
    const existing = await findExistingMigratedDriveFile(params.ptbFileId).catch(() => null);
    if (existing && existing.size === params.size) {
      return {
        alreadyExists: true,
        existingFile: existing,
        folderId,
        folderName: DRIVE_FOLDER_NAME,
      };
    }
  }

  const targetParent = params.isThumbnail ? thumbsFolderId : folderId;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': params.mimeType || 'application/octet-stream',
    'X-Upload-Content-Length': String(Math.max(0, Math.floor(params.size || 0))),
  };
  if (params.origin) {
    headers['Origin'] = params.origin;
  }

  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: params.name,
        mimeType: params.mimeType || 'application/octet-stream',
        parents: [targetParent],
        ...(params.ptbFileId
          ? { appProperties: { ptbFileId: params.ptbFileId } }
          : {}),
      }),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '');
    throw new Error(`Falha ao iniciar sessão resumível no Google Drive (${initRes.status}): ${errText}`);
  }

  const sessionUri = initRes.headers.get('location');
  if (!sessionUri) {
    throw new Error('Google Drive não retornou a URL da sessão de upload (Location header).');
  }

  return {
    alreadyExists: false,
    sessionUri,
    folderId: targetParent,
    folderName: params.isThumbnail ? DRIVE_THUMBS_SUBFOLDER_NAME : DRIVE_FOLDER_NAME,
  };
}

export async function getDriveFileMetadata(driveFileId: string): Promise<{
  id: string;
  name: string;
  size: number;
  mimeType: string;
  trashed?: boolean;
}> {
  const { accessToken } = await getValidDriveAccessToken();
  const meta = await driveJsonFetch(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      driveFileId
    )}?fields=id,name,size,mimeType,trashed`
  );
  return {
    id: String(meta.id),
    name: String(meta.name || ''),
    size: Number(meta.size || 0),
    mimeType: String(meta.mimeType || 'application/octet-stream'),
    trashed: Boolean(meta.trashed),
  };
}

function encodeContentDispositionFilename(filename: string, inline: boolean): string {
  const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'arquivo';
  const encoded = encodeURIComponent(filename);
  const type = inline ? 'inline' : 'attachment';
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function streamDriveFileToResponse(
  driveFileId: string,
  req: Request,
  res: Response,
  options: { inline: boolean; filename?: string; mimeType?: string }
): Promise<void> {
  const { accessToken } = await getValidDriveAccessToken();
  const rangeHeader = req.headers.range;
  const controller = new AbortController();
  res.on('close', () => {
    try {
      controller.abort();
    } catch {}
  });

  const upstreamHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (rangeHeader) {
    upstreamHeaders['Range'] = String(rangeHeader);
  }

  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media`,
    {
      headers: upstreamHeaders,
      signal: controller.signal,
    }
  );

  if (!driveRes.ok && driveRes.status !== 206) {
    const errText = await driveRes.text().catch(() => '');
    res.status(driveRes.status === 404 ? 404 : 502).json({
      error: `Erro ao transmitir arquivo do Google Drive (${driveRes.status}): ${errText.slice(0, 180)}`,
    });
    return;
  }

  const contentType =
    driveRes.headers.get('content-type') || options.mimeType || 'application/octet-stream';
  const contentLength = driveRes.headers.get('content-length');
  const contentRange = driveRes.headers.get('content-range');
  const acceptRanges = driveRes.headers.get('accept-ranges') || 'bytes';

  res.status(driveRes.status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', acceptRanges);
  if (contentLength) res.setHeader('Content-Length', contentLength);
  if (contentRange) res.setHeader('Content-Range', contentRange);
  res.setHeader(
    'Content-Disposition',
    encodeContentDispositionFilename(options.filename || driveFileId, options.inline)
  );
  res.setHeader('Cache-Control', options.inline ? 'private, max-age=300' : 'no-store');

  if (!driveRes.body) {
    res.end();
    return;
  }

  const nodeStream = Readable.fromWeb(driveRes.body as any);
  nodeStream.on('error', () => {
    try {
      res.end();
    } catch {}
  });
  nodeStream.pipe(res);
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  pdf: 'application/pdf',
};

export function streamDiskFileWithRange(
  diskPath: string,
  req: Request,
  res: Response,
  options: { inline: boolean; filename: string; mimeType?: string }
): void {
  const stat = fs.statSync(diskPath);
  const totalSize = stat.size;
  const ext = path.extname(options.filename || diskPath).replace('.', '').toLowerCase();
  const contentType =
    options.mimeType || MIME_BY_EXT[ext] || 'application/octet-stream';

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    encodeContentDispositionFilename(options.filename, options.inline)
  );

  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
    if (!match) {
      res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
      return;
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? Math.min(totalSize - 1, parseInt(match[2], 10)) : totalSize - 1;
    if (isNaN(start) || isNaN(end) || start > end || start >= totalSize) {
      res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
      return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    res.setHeader('Content-Length', String(end - start + 1));
    fs.createReadStream(diskPath, { start, end }).pipe(res);
    return;
  }

  res.status(200);
  res.setHeader('Content-Length', String(totalSize));
  fs.createReadStream(diskPath).pipe(res);
}

export function isAllowedLegacyFirebaseUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'firebasestorage.googleapis.com' ||
      host === 'storage.googleapis.com' ||
      host.endsWith('.firebasestorage.app')
    );
  } catch {
    return false;
  }
}
