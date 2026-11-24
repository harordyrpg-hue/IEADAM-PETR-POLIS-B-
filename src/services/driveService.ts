import { FileRecord } from '../types.js';

export const DRIVE_CHUNK_SIZE_BYTES = 2 * 1024 * 1024; // 2 MiB (múltiplo de 256 KiB e abaixo de ~4,5 MB)
export const MAX_INLINE_THUMBNAIL_BYTES = 20 * 1024; // ~20 KB

export interface DriveStatusInfo {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
  accountName: string | null;
  folderId: string | null;
  folderName: string;
  thumbsFolderId: string | null;
  tokenBackend: 'supabase' | 'server';
  supabaseTableReady?: boolean;
  supabaseError?: string | null;
  redirectUri: string;
  updatedAt: string | null;
}

export interface DriveUploadResult {
  driveFileId: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface DriveMigrationFailure {
  fileId: string;
  fileName: string;
  originType: string;
  originUrl: string;
  error: string;
  attempts: number;
  lastAttemptAt: string;
}

export interface DriveMigrationJobState {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'completed';
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  totalFiles: number;
  alreadyInDriveCount: number;
  copiedCount: number;
  processedIds: string[];
  failures: DriveMigrationFailure[];
  currentFileName?: string;
}

const MIGRATION_IDB_NAME = 'ptb_midia_drive_migration_db';
const MIGRATION_IDB_STORE = 'migration_jobs';
const MIGRATION_JOB_KEY = 'active_drive_migration_v1';

function openMigrationDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste navegador.'));
      return;
    }
    const req = indexedDB.open(MIGRATION_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MIGRATION_IDB_STORE)) {
        db.createObjectStore(MIGRATION_IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erro ao abrir armazenamento da migração.'));
  });
}

export async function loadSavedMigrationJob(): Promise<DriveMigrationJobState | null> {
  try {
    const db = await openMigrationDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(MIGRATION_IDB_STORE, 'readonly');
      const req = tx.objectStore(MIGRATION_IDB_STORE).get(MIGRATION_JOB_KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as DriveMigrationJobState) || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function saveMigrationJob(job: DriveMigrationJobState): Promise<void> {
  const db = await openMigrationDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MIGRATION_IDB_STORE, 'readwrite');
    const req = tx.objectStore(MIGRATION_IDB_STORE).put(job);
    req.onsuccess = () => {
      db.close();
      resolve();
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function clearSavedMigrationJob(): Promise<void> {
  try {
    const db = await openMigrationDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MIGRATION_IDB_STORE, 'readwrite');
      const req = tx.objectStore(MIGRATION_IDB_STORE).delete(MIGRATION_JOB_KEY);
      req.onsuccess = () => {
        db.close();
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {}
}

export function buildCallerAuthHeaders(caller?: { uid?: string; email?: string | null }): Record<string, string> {
  if (caller?.uid || caller?.email) {
    return {
      ...(caller.uid ? { 'x-ptb-uid': caller.uid } : {}),
      ...(caller.email ? { 'x-ptb-email': caller.email } : {}),
    };
  }
  try {
    const raw = localStorage.getItem('ptb_auth_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...(parsed?.uid ? { 'x-ptb-uid': String(parsed.uid) } : {}),
        ...(parsed?.email ? { 'x-ptb-email': String(parsed.email) } : {}),
      };
    }
  } catch {}
  return {};
}

export async function fetchDriveStatus(): Promise<DriveStatusInfo> {
  const res = await fetch('/api/drive/status');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Erro ao consultar status do Google Drive.');
  }
  return data as DriveStatusInfo;
}

export async function fetchDriveOAuthUrl(caller?: { uid?: string; email?: string | null }): Promise<{
  url: string;
  redirectUri: string;
}> {
  const res = await fetch('/api/drive/oauth/url', {
    headers: buildCallerAuthHeaders(caller),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Erro ao iniciar conexão com Google Drive.');
  }
  return data;
}

export async function disconnectDriveAccount(caller?: { uid?: string; email?: string | null }): Promise<void> {
  const res = await fetch('/api/drive/disconnect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildCallerAuthHeaders(caller),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Erro ao desconectar Google Drive.');
  }
}

export function estimateDataUrlBytes(dataUrl: string): number {
  if (!dataUrl || !dataUrl.startsWith('data:')) return 0;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return dataUrl.length;
  const meta = dataUrl.slice(0, commaIdx);
  const body = dataUrl.slice(commaIdx + 1);
  if (meta.includes(';base64')) {
    const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
  }
  return new TextEncoder().encode(decodeURIComponent(body)).length;
}

export function dataUrlToBlob(dataUrl: string, fallbackMime = 'application/octet-stream'): Blob {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) {
    return new Blob([dataUrl], { type: fallbackMime });
  }
  const header = dataUrl.slice(0, commaIdx);
  const body = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] || fallbackMime;

  if (header.includes(';base64')) {
    const binStr = atob(body);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

function sendChunkXhrDirect(
  sessionUri: string,
  chunk: Blob,
  contentRange: string | null,
  mimeType: string,
  onChunkProgress?: (loaded: number) => void
): Promise<{ status: number; bodyText: string; rangeHeader: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUri, true);
    xhr.setRequestHeader('Content-Type', mimeType || 'application/octet-stream');
    if (contentRange) {
      xhr.setRequestHeader('Content-Range', contentRange);
    }
    xhr.timeout = 240000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onChunkProgress) {
        onChunkProgress(e.loaded);
      }
    };
    xhr.onload = () => {
      resolve({
        status: xhr.status,
        bodyText: xhr.responseText || '',
        rangeHeader: xhr.getResponseHeader('Range'),
      });
    };
    xhr.onerror = () => reject(new Error('DIRECT_CORS_OR_NETWORK_ERROR'));
    xhr.ontimeout = () => reject(new Error('Tempo limite excedido ao enviar parte para o Drive.'));
    xhr.send(chunk);
  });
}

async function sendChunkViaServerProxy(
  sessionUri: string,
  chunk: Blob,
  contentRange: string | null,
  mimeType: string,
  caller?: { uid?: string; email?: string | null }
): Promise<{ status: number; bodyText: string; rangeHeader: string | null }> {
  const res = await fetch('/api/drive/upload/chunk-proxy', {
    method: 'PUT',
    headers: {
      ...buildCallerAuthHeaders(caller),
      'x-drive-session-uri': sessionUri,
      'x-upload-content-type': mimeType || 'application/octet-stream',
      ...(contentRange ? { 'x-content-range': contentRange } : {}),
    },
    body: chunk,
  });
  const bodyText = await res.text().catch(() => '');
  return {
    status: res.status,
    bodyText,
    rangeHeader: res.headers.get('x-drive-range'),
  };
}

export async function verifyDriveFile(
  driveFileId: string,
  caller?: { uid?: string; email?: string | null }
): Promise<DriveUploadResult> {
  const res = await fetch(`/api/drive/files/${encodeURIComponent(driveFileId)}/verify`, {
    headers: buildCallerAuthHeaders(caller),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.id) {
    throw new Error(data?.error || 'Falha ao confirmar tamanho do arquivo no Google Drive.');
  }
  return {
    driveFileId: String(data.id),
    name: String(data.name || ''),
    size: Number(data.size || 0),
    mimeType: String(data.mimeType || 'application/octet-stream'),
  };
}

/**
 * Cria sessão resumível no servidor e envia os bytes diretamente do navegador para o Google Drive
 * em partes de 2 MiB (múltiplo de 256 KiB e compatível com limite de ~4,5 MB do host).
 */
export async function uploadBlobToDriveResumable(
  blob: Blob,
  options: {
    name: string;
    mimeType?: string;
    isThumbnail?: boolean;
    ptbFileId?: string;
    caller?: { uid?: string; email?: string | null };
  },
  onProgress?: (percent: number, speedText?: string) => void
): Promise<DriveUploadResult> {
  const mimeType = options.mimeType || blob.type || 'application/octet-stream';
  const totalSize = blob.size;

  const initRes = await fetch('/api/drive/upload/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildCallerAuthHeaders(options.caller),
    },
    body: JSON.stringify({
      name: options.name,
      mimeType,
      size: totalSize,
      isThumbnail: Boolean(options.isThumbnail),
      ptbFileId: options.ptbFileId,
    }),
  });

  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok) {
    throw new Error(initData?.error || 'Falha ao criar sessão resumível no Google Drive.');
  }

  if (initData.alreadyExists && initData.existingFile?.id) {
    if (onProgress) onProgress(100, 'Já enviado ao Drive');
    return {
      driveFileId: String(initData.existingFile.id),
      name: String(initData.existingFile.name || options.name),
      size: Number(initData.existingFile.size ?? totalSize),
      mimeType: String(initData.existingFile.mimeType || mimeType),
    };
  }

  const sessionUri = String(initData.sessionUri || '');
  if (!sessionUri) {
    throw new Error('Servidor não retornou URI de sessão do Google Drive.');
  }

  const startTime = Date.now();
  let useProxy = false;

  if (totalSize === 0) {
    const emptyRes = await sendChunkXhrDirect(sessionUri, blob, null, mimeType).catch(async () => {
      return await sendChunkViaServerProxy(sessionUri, blob, null, mimeType, options.caller);
    });
    if (emptyRes.status < 200 || emptyRes.status >= 300) {
      throw new Error(`Falha ao enviar arquivo vazio ao Drive (${emptyRes.status}).`);
    }
    const parsed = JSON.parse(emptyRes.bodyText || '{}');
    if (onProgress) onProgress(100, 'Concluído');
    return {
      driveFileId: String(parsed.id),
      name: String(parsed.name || options.name),
      size: Number(parsed.size || 0),
      mimeType: String(parsed.mimeType || mimeType),
    };
  }

  let offset = 0;
  let finalMeta: any = null;

  while (offset < totalSize) {
    const end = Math.min(totalSize, offset + DRIVE_CHUNK_SIZE_BYTES);
    const slice = blob.slice(offset, end);
    const contentRange = `bytes ${offset}-${end - 1}/${totalSize}`;

    let res: { status: number; bodyText: string; rangeHeader: string | null };
    if (!useProxy) {
      try {
        res = await sendChunkXhrDirect(sessionUri, slice, contentRange, mimeType, (loaded) => {
          if (onProgress) {
            const totalLoaded = offset + loaded;
            const pct = Math.min(99, Math.round((totalLoaded / totalSize) * 100));
            const elapsed = Math.max(0.1, (Date.now() - startTime) / 1000);
            const speedMb = totalLoaded / (1024 * 1024) / elapsed;
            onProgress(pct, `${speedMb.toFixed(1)} MB/s · Drive`);
          }
        });
      } catch (err: any) {
        if (err?.message === 'DIRECT_CORS_OR_NETWORK_ERROR') {
          useProxy = true;
          res = await sendChunkViaServerProxy(
            sessionUri,
            slice,
            contentRange,
            mimeType,
            options.caller
          );
        } else {
          throw err;
        }
      }
    } else {
      res = await sendChunkViaServerProxy(sessionUri, slice, contentRange, mimeType, options.caller);
      if (onProgress) {
        const pct = Math.min(99, Math.round((end / totalSize) * 100));
        const elapsed = Math.max(0.1, (Date.now() - startTime) / 1000);
        const speedMb = end / (1024 * 1024) / elapsed;
        onProgress(pct, `${speedMb.toFixed(1)} MB/s · Drive`);
      }
    }

    if (res.status === 200 || res.status === 201) {
      finalMeta = JSON.parse(res.bodyText || '{}');
      break;
    }

    if (res.status === 308) {
      let nextOffset = end;
      if (res.rangeHeader) {
        const match = res.rangeHeader.match(/bytes=0-(\d+)/i);
        if (match?.[1]) {
          nextOffset = parseInt(match[1], 10) + 1;
        }
      }
      offset = Math.max(nextOffset, offset + 1);
      continue;
    }

    throw new Error(
      `Erro do Google Drive durante upload resumível (HTTP ${res.status}): ${res.bodyText.slice(0, 200)}`
    );
  }

  if (!finalMeta?.id) {
    throw new Error('Upload ao Google Drive finalizou sem retornar o ID do arquivo.');
  }

  let reportedSize = Number(finalMeta.size);
  let verifiedMime = String(finalMeta.mimeType || mimeType);
  let verifiedName = String(finalMeta.name || options.name);

  if (Number.isNaN(reportedSize) || reportedSize !== totalSize) {
    const verified = await verifyDriveFile(String(finalMeta.id), options.caller);
    reportedSize = verified.size;
    verifiedMime = verified.mimeType || verifiedMime;
    verifiedName = verified.name || verifiedName;
  }

  if (reportedSize !== totalSize) {
    throw new Error(
      `Tamanho divergente após envio ao Google Drive (esperado ${totalSize} bytes, recebido ${reportedSize} bytes).`
    );
  }

  if (onProgress) onProgress(100, 'Concluído no Drive');

  return {
    driveFileId: String(finalMeta.id),
    name: verifiedName,
    size: reportedSize,
    mimeType: verifiedMime,
  };
}

function classifyOriginType(url: string): string {
  if (url.startsWith('chunked://')) return 'chunked://';
  if (url.startsWith('data:')) return 'data:';
  if (url.startsWith('/uploads/')) return '/uploads';
  if (url.startsWith('https://')) return 'Firebase Storage';
  return 'Desconhecido';
}

export async function runSafeDriveMigration(params: {
  files: FileRecord[];
  caller: { uid: string; email?: string | null };
  onlyFailures?: boolean;
  existingJob?: DriveMigrationJobState | null;
  resolveChunkedBlob: (chunkUri: string, fallbackMime?: string) => Promise<Blob | null>;
  updateFileRecord: (id: string, updates: Partial<FileRecord>) => Promise<void>;
  shouldPause: () => boolean;
  onProgress: (job: DriveMigrationJobState) => void;
}): Promise<DriveMigrationJobState> {
  const {
    files,
    caller,
    onlyFailures = false,
    existingJob,
    resolveChunkedBlob,
    updateFileRecord,
    shouldPause,
    onProgress,
  } = params;

  const totalFiles = files.length;
  const alreadyMigrated = files.filter((f) => Boolean(f.driveFileId));
  const pendingFiles = files.filter((f) => !f.driveFileId);

  const failureIds = new Set((existingJob?.failures || []).map((f) => f.fileId));
  const targets = onlyFailures
    ? pendingFiles.filter((f) => failureIds.has(f.id))
    : pendingFiles;

  const job: DriveMigrationJobState = {
    id: MIGRATION_JOB_KEY,
    status: 'running',
    startedAt: existingJob?.startedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalFiles,
    alreadyInDriveCount: alreadyMigrated.length,
    copiedCount: onlyFailures ? existingJob?.copiedCount || 0 : 0,
    processedIds: [...(existingJob?.processedIds || [])],
    failures: onlyFailures
      ? (existingJob?.failures || []).filter((f) => !targets.some((t) => t.id === f.fileId))
      : [],
  };

  const processedSet = new Set(job.processedIds);

  await saveMigrationJob(job);
  onProgress({ ...job, failures: [...job.failures] });

  const BATCH_SIZE = 3;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    if (shouldPause()) {
      job.status = 'paused';
      job.currentFileName = undefined;
      job.updatedAt = new Date().toISOString();
      await saveMigrationJob(job);
      onProgress({ ...job, failures: [...job.failures] });
      return job;
    }

    const batch = targets.slice(i, i + BATCH_SIZE);
    for (const file of batch) {
      if (shouldPause()) {
        job.status = 'paused';
        job.currentFileName = undefined;
        job.updatedAt = new Date().toISOString();
        await saveMigrationJob(job);
        onProgress({ ...job, failures: [...job.failures] });
        return job;
      }

      if (file.driveFileId) continue;

      const sourceUrl = String(file.legacyUrl || file.downloadUrl || '').trim();
      const originType = classifyOriginType(sourceUrl);
      job.currentFileName = file.name;
      job.updatedAt = new Date().toISOString();
      onProgress({ ...job, failures: [...job.failures] });

      try {
        if (!sourceUrl) {
          throw new Error('Registro sem URL de origem nem legacyUrl.');
        }

        let sourceBlob: Blob | null = null;

        if (sourceUrl.startsWith('chunked://')) {
          sourceBlob = await resolveChunkedBlob(sourceUrl, file.mimeType);
          if (!sourceBlob) {
            throw new Error('Dados fragmentados (file_data / file_chunks) não encontrados.');
          }
        } else if (sourceUrl.startsWith('data:')) {
          sourceBlob = dataUrlToBlob(sourceUrl, file.mimeType || 'application/octet-stream');
        } else if (sourceUrl.startsWith('/uploads/')) {
          const res = await fetch(sourceUrl);
          if (!res.ok) {
            throw new Error(`Arquivo local não encontrado em ${sourceUrl} (HTTP ${res.status}).`);
          }
          sourceBlob = await res.blob();
        } else if (/^https?:\/\//i.test(sourceUrl)) {
          try {
            const direct = await fetch(sourceUrl);
            if (!direct.ok) throw new Error(`HTTP ${direct.status}`);
            sourceBlob = await direct.blob();
          } catch {
            const proxied = await fetch(
              `/api/drive/proxy-legacy?url=${encodeURIComponent(sourceUrl)}`,
              { headers: buildCallerAuthHeaders(caller) }
            );
            if (!proxied.ok) {
              const errData = await proxied.json().catch(() => ({}));
              throw new Error(errData?.error || `Falha ao ler origem remota (${proxied.status}).`);
            }
            sourceBlob = await proxied.blob();
          }
        } else {
          throw new Error(`Formato de origem não suportado: ${sourceUrl.slice(0, 48)}`);
        }

        if (!sourceBlob || (sourceBlob.size === 0 && (file.size || 0) > 0)) {
          throw new Error('Arquivo de origem retornou 0 bytes.');
        }

        const driveUploaded = await uploadBlobToDriveResumable(sourceBlob, {
          name: file.name || file.originalName || file.id,
          mimeType: file.mimeType || sourceBlob.type || 'application/octet-stream',
          ptbFileId: file.id,
          caller,
        });

        // Conferência explícita: só preenche driveFileId depois de confirmar tamanho exato
        if (driveUploaded.size !== sourceBlob.size) {
          throw new Error(
            `Conferência de tamanho falhou (origem ${sourceBlob.size} bytes vs Drive ${driveUploaded.size} bytes).`
          );
        }

        // Regra de miniatura (~20 KB): se miniatura antiga for maior que 20 KB, envia para o Drive também
        let thumbUpdates: Partial<FileRecord> = {};
        if (
          file.thumbnailUrl &&
          file.thumbnailUrl.startsWith('data:') &&
          !file.thumbnailDriveFileId &&
          estimateDataUrlBytes(file.thumbnailUrl) > MAX_INLINE_THUMBNAIL_BYTES
        ) {
          try {
            const thumbBlob = dataUrlToBlob(file.thumbnailUrl, 'image/jpeg');
            const thumbRes = await uploadBlobToDriveResumable(thumbBlob, {
              name: `thumb_${file.id}.jpg`,
              mimeType: thumbBlob.type || 'image/jpeg',
              isThumbnail: true,
              caller,
            });
            thumbUpdates = {
              thumbnailDriveFileId: thumbRes.driveFileId,
              thumbnailUrl: `/api/drive/stream/${thumbRes.driveFileId}`,
            };
          } catch (thumbErr) {
            console.warn(`Aviso: miniatura de ${file.name} não migrada:`, thumbErr);
          }
        }

        const now = new Date().toISOString();
        await updateFileRecord(file.id, {
          legacyUrl: sourceUrl,
          legacyStoragePath: file.legacyStoragePath || file.storagePath,
          driveFileId: driveUploaded.driveFileId,
          driveMimeType: driveUploaded.mimeType,
          driveSize: driveUploaded.size,
          name: file.name,
          size: driveUploaded.size,
          mimeType: driveUploaded.mimeType || file.mimeType,
          downloadUrl: `/api/files/${file.id}/download`,
          storagePath: `gdrive://${driveUploaded.driveFileId}`,
          storageKey: `gdrive://${driveUploaded.driveFileId}`,
          migratedToDriveAt: now,
          updatedAt: now,
          ...thumbUpdates,
        });

        if (!processedSet.has(file.id)) {
          processedSet.add(file.id);
          job.processedIds.push(file.id);
        }
        job.copiedCount += 1;
        job.alreadyInDriveCount += 1;
        job.failures = job.failures.filter((f) => f.fileId !== file.id);
      } catch (err: any) {
        const prevFail = existingJob?.failures?.find((f) => f.fileId === file.id);
        job.failures = [
          ...job.failures.filter((f) => f.fileId !== file.id),
          {
            fileId: file.id,
            fileName: file.name || file.id,
            originType,
            originUrl: sourceUrl.startsWith('data:')
              ? `${sourceUrl.slice(0, 48)}...`
              : sourceUrl,
            error: err?.message || 'Erro desconhecido durante cópia para o Drive.',
            attempts: (prevFail?.attempts || 0) + 1,
            lastAttemptAt: new Date().toISOString(),
          },
        ];
      }

      job.updatedAt = new Date().toISOString();
      await saveMigrationJob(job);
      onProgress({ ...job, failures: [...job.failures] });
    }
  }

  job.status = 'completed';
  job.currentFileName = undefined;
  job.completedAt = new Date().toISOString();
  job.updatedAt = job.completedAt;
  await saveMigrationJob(job);
  onProgress({ ...job, failures: [...job.failures] });
  return job;
}
