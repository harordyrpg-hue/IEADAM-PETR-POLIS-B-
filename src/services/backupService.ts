import {
  collection,
  DocumentData,
  documentId,
  getDocs,
  limit,
  orderBy,
  Query,
  query,
  QueryDocumentSnapshot,
  QuerySnapshot,
  startAfter,
  Timestamp,
} from 'firebase/firestore';
import { auth, db, FIRESTORE_DATABASE_ID, isQuotaError } from './firebase.js';
import { FileRecord, Folder } from '../types.js';

/**
 * Todas as coleções operacionais de ALLOWED_COLLECTIONS (server/store.ts) + file_data.
 * Ordem otimizada: metadados principais (users, admins, folders, files) primeiro
 * e file_data por último para maximizar a captura antes de eventuais limites de cota.
 */
export const BACKUP_COLLECTIONS = [
  'users',
  'admins',
  'folders',
  'files',
  'events',
  'shares',
  'activities',
  'settings',
  'church_settings',
  'church_announcements',
  'church_events',
  'church_articles',
  'church_albums',
  'church_downloads',
  'team_tasks',
  'team_notes',
  'financial_records',
  'financial_bills',
  'public_events',
  'event_registrations',
  'attendance_departments',
  'attendance_members',
  'attendance_calls',
  'baptism_settings',
  'baptism_registrations',
  'file_data',
] as const;

export type BackupCollectionName = (typeof BACKUP_COLLECTIONS)[number];

export type CollectionBackupStatus =
  | 'pending'
  | 'in_progress'
  | 'paused_quota'
  | 'paused_manual'
  | 'completed'
  | 'error';

export type BackupJobStatus =
  | 'idle'
  | 'running'
  | 'paused_quota'
  | 'paused_manual'
  | 'completed'
  | 'error';

export interface CollectionBackupState {
  collection: BackupCollectionName;
  status: CollectionBackupStatus;
  lastDocId: string | null;
  documents: Record<string, any>[];
  pagesRead: number;
  errorMessage?: string;
  completedAt?: string;
}

export interface BackupJobState {
  id: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  status: BackupJobStatus;
  currentCollectionIndex: number;
  pausedReason?: string;
  collections: Record<string, CollectionBackupState>;
  downloadedCollections: string[];
  downloadedCsv: boolean;
  csvGeneratedAt?: string;
}

const IDB_NAME = 'ptb_midia_backup_db';
const IDB_VERSION = 1;
const IDB_STORE = 'backup_jobs';
const ACTIVE_JOB_KEY = 'active_firestore_backup_v1';

function openBackupDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste navegador.'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        database.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erro ao abrir armazenamento local de backup.'));
  });
}

export async function loadSavedBackupJob(): Promise<BackupJobState | null> {
  try {
    const database = await openBackupDb();
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(ACTIVE_JOB_KEY);
      req.onsuccess = () => {
        database.close();
        resolve((req.result as BackupJobState) || null);
      };
      req.onerror = () => {
        database.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function saveBackupJob(job: BackupJobState): Promise<void> {
  const database = await openBackupDb();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(job);
    req.onsuccess = () => {
      database.close();
      resolve();
    };
    req.onerror = () => {
      database.close();
      reject(req.error);
    };
  });
}

export async function clearSavedBackupJob(): Promise<void> {
  try {
    const database = await openBackupDb();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(ACTIVE_JOB_KEY);
      req.onsuccess = () => {
        database.close();
        resolve();
      };
      req.onerror = () => {
        database.close();
        reject(req.error);
      };
    });
  } catch {}
}

export function createInitialBackupJob(): BackupJobState {
  const now = new Date().toISOString();
  const collections: Record<string, CollectionBackupState> = {};
  for (const col of BACKUP_COLLECTIONS) {
    collections[col] = {
      collection: col,
      status: 'pending',
      lastDocId: null,
      documents: [],
      pagesRead: 0,
    };
  }
  return {
    id: ACTIVE_JOB_KEY,
    startedAt: now,
    updatedAt: now,
    status: 'idle',
    currentCollectionIndex: 0,
    collections,
    downloadedCollections: [],
    downloadedCsv: false,
  };
}

function getPageSizeForCollection(col: BackupCollectionName): number {
  if (col === 'file_data') return 1;
  if (col === 'files') return 2;
  if (
    col === 'church_albums' ||
    col === 'church_articles' ||
    col === 'church_downloads' ||
    col === 'church_events'
  ) {
    return 5;
  }
  return 25;
}

export function serializeFirestoreValue(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (value instanceof Timestamp || typeof value?.toDate === 'function') {
    try {
      return {
        _firestoreType: 'Timestamp',
        iso: value.toDate().toISOString(),
        seconds: value.seconds,
        nanoseconds: value.nanoseconds,
      };
    } catch {
      return String(value);
    }
  }

  if (typeof value?.toBase64 === 'function') {
    return {
      _firestoreType: 'Bytes',
      base64: value.toBase64(),
    };
  }

  if (typeof value?.latitude === 'number' && typeof value?.longitude === 'number') {
    return {
      _firestoreType: 'GeoPoint',
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (typeof value?.path === 'string' && value?.firestore) {
    return {
      _firestoreType: 'DocumentReference',
      path: value.path,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreValue(item));
  }

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = serializeFirestoreValue(v);
  }
  return out;
}

function mergeDocumentsByDocId(
  existing: Record<string, any>[],
  incoming: Record<string, any>[]
): Record<string, any>[] {
  const map = new Map<string, Record<string, any>>();
  for (const doc of existing) {
    const key = String(doc._docId || doc.id || '');
    if (key) map.set(key, doc);
  }
  for (const doc of incoming) {
    const key = String(doc._docId || doc.id || '');
    if (key) map.set(key, doc);
  }
  return Array.from(map.values());
}

export function classifyFileStorageLocation(file: Partial<FileRecord>): string {
  const url = String(file.downloadUrl || '').trim();
  const storagePath = String(file.storagePath || file.storageKey || '').trim();
  const engine = String(file.metadata?.engine || '');

  if (url.startsWith('chunked://') || storagePath.startsWith('chunked://')) {
    return 'chunked://';
  }
  if (url.startsWith('data:')) {
    return 'data:';
  }
  if (
    url.startsWith('/uploads/') ||
    storagePath.startsWith('/uploads/') ||
    url.includes('/uploads/')
  ) {
    return '/uploads';
  }
  if (
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('storage.googleapis.com') ||
    url.startsWith('gs://') ||
    engine === 'Firebase Storage' ||
    (storagePath.startsWith('media/') && url.startsWith('https://'))
  ) {
    return 'Firebase Storage';
  }
  return 'Outro / Indefinido';
}

function resolveFolderBreadcrumb(
  folderId: string | null | undefined,
  foldersById: Map<string, Partial<Folder>>
): string {
  if (!folderId) return 'Raiz';
  const visited = new Set<string>();
  const parts: string[] = [];
  let cursor: string | null | undefined = folderId;

  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const folder = foldersById.get(cursor);
    if (!folder) {
      if (parts.length === 0) parts.unshift(cursor);
      break;
    }
    parts.unshift(folder.name || cursor);
    cursor = folder.parentId;
  }

  return parts.join(' / ') || 'Raiz';
}

function escapeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function formatBytesHuman(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

export function buildFilesInventoryCsv(
  fileDocs: Record<string, any>[],
  folderDocs: Record<string, any>[],
  userDocs: Record<string, any>[]
): string {
  const foldersById = new Map<string, Partial<Folder>>();
  for (const f of folderDocs) {
    const fid = String(f.id || f._docId || '');
    if (fid) foldersById.set(fid, f as Partial<Folder>);
  }

  const usersByUid = new Map<string, { name?: string; email?: string }>();
  for (const u of userDocs) {
    const uid = String(u.uid || u.id || u._docId || '');
    if (uid) usersByUid.set(uid, u);
  }

  const header = [
    'id',
    'nome',
    'tamanho',
    'tamanho_formatado',
    'pasta',
    'dono',
    'onde_esta_guardado',
    'referencia',
    'na_lixeira',
    'criado_em',
  ];

  const rows = fileDocs.map((f) => {
    const id = String(f.id || f._docId || '');
    const nome = String(f.name || f.originalName || '');
    const tamanho = Number(f.size || 0);
    const tamanhoFormatado = formatBytesHuman(tamanho);
    const pasta = resolveFolderBreadcrumb(f.folderId, foldersById);
    const userMatch = f.ownerUid ? usersByUid.get(String(f.ownerUid)) : undefined;
    const dono = String(
      f.ownerName || f.userName || userMatch?.name || userMatch?.email || f.ownerUid || ''
    );
    const ondeEstaGuardado = classifyFileStorageLocation(f as Partial<FileRecord>);

    const rawUrl = String(f.downloadUrl || '');
    const rawPath = String(f.storagePath || f.storageKey || '');
    let referencia = rawPath || rawUrl;
    if (ondeEstaGuardado === 'data:' && rawUrl.startsWith('data:')) {
      const commaIdx = rawUrl.indexOf(',');
      referencia = commaIdx > 0 ? `${rawUrl.slice(0, commaIdx + 1)}[base64_${rawUrl.length}_chars]` : 'data:';
    } else if (ondeEstaGuardado === '/uploads') {
      referencia = rawUrl || rawPath;
    } else if (ondeEstaGuardado === 'Firebase Storage') {
      referencia = rawPath || rawUrl;
    }

    const naLixeira = f.inTrash === true ? 'Sim' : 'Não';
    const criadoEm =
      typeof f.createdAt === 'object' && f.createdAt?.iso
        ? f.createdAt.iso
        : String(f.createdAt || '');

    return [
      id,
      nome,
      tamanho,
      tamanhoFormatado,
      pasta,
      dono,
      ondeEstaGuardado,
      referencia,
      naLixeira,
      criadoEm,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  // UTF-8 BOM para abrir com acentuação correta no Excel e Google Sheets
  return `\uFEFF${header.join(',')}\r\n${rows.join('\r\n')}`;
}

export function buildCollectionJsonString(colState: CollectionBackupState): string {
  const payload = {
    collection: colState.collection,
    databaseId: FIRESTORE_DATABASE_ID,
    exportedAt: colState.completedAt || new Date().toISOString(),
    status: colState.status,
    totalDocuments: colState.documents.length,
    documents: colState.documents,
  };
  return JSON.stringify(payload, null, 2);
}

export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function getDateStamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function downloadCollectionBackupFile(colState: CollectionBackupState): void {
  const json = buildCollectionJsonString(colState);
  triggerFileDownload(
    `backup_${colState.collection}_${getDateStamp()}.json`,
    json,
    'application/json;charset=utf-8'
  );
}

export function downloadFilesCsvBackup(job: BackupJobState): void {
  const filesCol = job.collections['files'];
  const foldersCol = job.collections['folders'];
  const usersCol = job.collections['users'];
  const csv = buildFilesInventoryCsv(
    filesCol?.documents || [],
    foldersCol?.documents || [],
    usersCol?.documents || []
  );
  triggerFileDownload(
    `backup_arquivos_inventario_${getDateStamp()}.csv`,
    csv,
    'text/csv;charset=utf-8'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface BackupRunCallbacks {
  onProgress: (job: BackupJobState) => void;
  shouldPause: () => boolean;
}

/**
 * Executa o backup completo em partes (paginado com orderBy(documentId) + startAfter),
 * exclusivamente somente-leitura no Firestore, salvando progresso no IndexedDB a cada página.
 */
export async function runResumableFirestoreBackup(
  initialJob: BackupJobState,
  callbacks: BackupRunCallbacks
): Promise<BackupJobState> {
  const job: BackupJobState = {
    ...initialJob,
    status: 'running',
    pausedReason: undefined,
    updatedAt: new Date().toISOString(),
    collections: { ...initialJob.collections },
    downloadedCollections: [...(initialJob.downloadedCollections || [])],
  };

  for (const colName of BACKUP_COLLECTIONS) {
    if (!job.collections[colName]) {
      job.collections[colName] = {
        collection: colName,
        status: 'pending',
        lastDocId: null,
        documents: [],
        pagesRead: 0,
      };
    }
  }

  await saveBackupJob(job);
  callbacks.onProgress({ ...job, collections: { ...job.collections } });

  const startIdx = Math.max(
    0,
    BACKUP_COLLECTIONS.findIndex((c) => job.collections[c]?.status !== 'completed')
  );

  // If all collections are already completed, ensure downloads/status are updated cleanly
  if (BACKUP_COLLECTIONS.every((c) => job.collections[c]?.status === 'completed')) {
    job.status = 'completed';
    job.completedAt = job.completedAt || new Date().toISOString();
    await saveBackupJob(job);
    callbacks.onProgress({ ...job, collections: { ...job.collections } });
    return job;
  }

  for (let idx = startIdx; idx < BACKUP_COLLECTIONS.length; idx++) {
    const colName = BACKUP_COLLECTIONS[idx];
    const colState: CollectionBackupState = {
      ...job.collections[colName],
      documents: [...job.collections[colName].documents],
    };
    job.collections[colName] = colState;
    job.currentCollectionIndex = idx;

    if (colState.status === 'completed') {
      continue;
    }

    if (callbacks.shouldPause()) {
      colState.status = 'paused_manual';
      job.status = 'paused_manual';
      job.pausedReason = 'Backup pausado manualmente. Você pode continuar de onde parou a qualquer momento.';
      job.updatedAt = new Date().toISOString();
      await saveBackupJob(job);
      callbacks.onProgress({ ...job, collections: { ...job.collections } });
      return job;
    }

    colState.status = 'in_progress';
    colState.errorMessage = undefined;
    await saveBackupJob(job);
    callbacks.onProgress({ ...job, collections: { ...job.collections } });

    const pageSize = getPageSizeForCollection(colName);
    let lastSnapshot: QueryDocumentSnapshot<DocumentData> | null = null;

    while (true) {
      if (callbacks.shouldPause()) {
        colState.status = 'paused_manual';
        job.status = 'paused_manual';
        job.pausedReason = 'Backup pausado manualmente. Você pode continuar de onde parou a qualquer momento.';
        job.updatedAt = new Date().toISOString();
        await saveBackupJob(job);
        callbacks.onProgress({ ...job, collections: { ...job.collections } });
        return job;
      }

      try {
        const cursor: QueryDocumentSnapshot<DocumentData> | string | null =
          lastSnapshot || colState.lastDocId;
        const q: Query<DocumentData> = cursor
          ? query(
              collection(db, colName),
              orderBy(documentId()),
              startAfter(cursor),
              limit(pageSize)
            )
          : query(collection(db, colName), orderBy(documentId()), limit(pageSize));

        const snap: QuerySnapshot<DocumentData> = await getDocs(q);

        if (snap.empty) {
          colState.status = 'completed';
          colState.completedAt = new Date().toISOString();
          job.updatedAt = colState.completedAt;
          await saveBackupJob(job);
          callbacks.onProgress({ ...job, collections: { ...job.collections } });
          break;
        }

        const parsedDocs = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
          const serialized = serializeFirestoreValue(d.data());
          return {
            ...serialized,
            id: serialized?.id ?? d.id,
            _docId: d.id,
          };
        });

        colState.documents = mergeDocumentsByDocId(colState.documents, parsedDocs);
        colState.lastDocId = snap.docs[snap.docs.length - 1].id;
        colState.pagesRead += 1;
        lastSnapshot = snap.docs[snap.docs.length - 1];
        job.updatedAt = new Date().toISOString();

        const reachedEnd = snap.docs.length < pageSize;
        if (reachedEnd) {
          colState.status = 'completed';
          colState.completedAt = job.updatedAt;
        }

        await saveBackupJob(job);
        callbacks.onProgress({ ...job, collections: { ...job.collections } });

        if (reachedEnd) {
          break;
        }

        await sleep(75);
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : String(err);
        if (isQuotaError(err)) {
          colState.status = 'paused_quota';
          colState.errorMessage =
            'Cota diária do Cloud Firestore excedida neste ponto. Progresso preservado localmente.';
          job.status = 'paused_quota';
          job.pausedReason =
            `Cota do Firestore atingida durante a leitura de "${colName}" (${colState.documents.length} docs já salvos desta coleção). O progresso foi guardado — clique em "Continuar backup" quando a cota liberar.`;
          job.updatedAt = new Date().toISOString();
          console.warn(`Firestore Backup paused due to quota on ${colName}:`, rawMessage);
          await saveBackupJob(job);
          callbacks.onProgress({ ...job, collections: { ...job.collections } });
          return job;
        }

        // Structured Firestore error logging without throwing out without saving state
        const errInfo = {
          error: rawMessage,
          operationType: 'list',
          path: colName,
          authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
          },
        };
        console.error('Firestore Error: ', JSON.stringify(errInfo));
        colState.status = 'error';
        colState.errorMessage = rawMessage;
        job.status = 'error';
        job.pausedReason = `Erro ao ler "${colName}": ${rawMessage}. Progresso anterior salvo.`;
        job.updatedAt = new Date().toISOString();
        await saveBackupJob(job);
        callbacks.onProgress({ ...job, collections: { ...job.collections } });
        return job;
      }
    }

    // Coleção concluída: baixa o .json automaticamente (com intervalo seguro) se ainda não baixado
    if (!job.downloadedCollections.includes(colName)) {
      try {
        downloadCollectionBackupFile(colState);
        job.downloadedCollections.push(colName);
        await saveBackupJob(job);
        callbacks.onProgress({ ...job, collections: { ...job.collections } });
        await sleep(380);
      } catch {}
    }

    // Assim que folders e files terminarem, já gera e baixa o CSV dos arquivos
    const filesReady = job.collections['files']?.status === 'completed';
    const foldersReady = job.collections['folders']?.status === 'completed';
    if (filesReady && foldersReady && !job.downloadedCsv) {
      try {
        downloadFilesCsvBackup(job);
        job.downloadedCsv = true;
        job.csvGeneratedAt = new Date().toISOString();
        await saveBackupJob(job);
        callbacks.onProgress({ ...job, collections: { ...job.collections } });
        await sleep(380);
      } catch {}
    }
  }

  job.status = 'completed';
  job.completedAt = new Date().toISOString();
  job.updatedAt = job.completedAt;
  job.pausedReason = undefined;
  await saveBackupJob(job);
  callbacks.onProgress({ ...job, collections: { ...job.collections } });
  return job;
}

export async function downloadAllCompletedJsons(
  job: BackupJobState,
  onlyPending = false
): Promise<number> {
  let count = 0;
  for (const colName of BACKUP_COLLECTIONS) {
    const colState = job.collections[colName];
    if (!colState || colState.documents.length === 0 && colState.status !== 'completed') continue;
    if (onlyPending && job.downloadedCollections.includes(colName)) continue;
    downloadCollectionBackupFile(colState);
    if (!job.downloadedCollections.includes(colName)) {
      job.downloadedCollections.push(colName);
    }
    count++;
    await sleep(380);
  }
  await saveBackupJob(job);
  return count;
}
