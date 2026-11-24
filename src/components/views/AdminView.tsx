import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Image as ImageIcon,
  Film,
  Palette,
  Music,
  FileText,
  Download,
  Play,
  Pause,
  RotateCcw,
  FileSpreadsheet,
  FileJson,
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  HardDrive,
  Link2,
  Unlink,
  RefreshCw,
  FolderCheck,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { api } from '../../services/api.js';
import { formatBytes, formatDateTime } from '../../utils/formatters.js';
import {
  BACKUP_COLLECTIONS,
  BackupJobState,
  clearSavedBackupJob,
  createInitialBackupJob,
  downloadAllCompletedJsons,
  downloadCollectionBackupFile,
  downloadFilesCsvBackup,
  loadSavedBackupJob,
  runResumableFirestoreBackup,
} from '../../services/backupService.js';
import {
  DriveMigrationJobState,
  DriveStatusInfo,
  clearSavedMigrationJob,
  disconnectDriveAccount,
  fetchDriveOAuthUrl,
  fetchDriveStatus,
  loadSavedMigrationJob,
  runSafeDriveMigration,
} from '../../services/driveService.js';

export const AdminView: React.FC = () => {
  const { storageStats, setActiveTab, user, notify, allFiles } = useApp();
  const isSuperAdmin = user?.role === 'super_admin';

  const [backupJob, setBackupJob] = useState<BackupJobState | null>(null);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [isBackupPanelOpen, setIsBackupPanelOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const pauseRequestedRef = useRef(false);

  // Google Drive integration & safe migration state
  const [driveStatus, setDriveStatus] = useState<DriveStatusInfo | null>(null);
  const [driveStatusLoading, setDriveStatusLoading] = useState(false);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [confirmDisconnectDrive, setConfirmDisconnectDrive] = useState(false);
  const [migrationJob, setMigrationJob] = useState<DriveMigrationJobState | null>(null);
  const [confirmResetMigration, setConfirmResetMigration] = useState(false);
  const migrationPauseRef = useRef(false);

  const loadDriveStatus = useCallback(async () => {
    setDriveStatusLoading(true);
    try {
      const status = await fetchDriveStatus();
      setDriveStatus(status);
    } catch (err: any) {
      console.warn('Falha ao consultar status do Google Drive:', err);
    } finally {
      setDriveStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) {
      setIsLoadingJob(false);
      return;
    }
    let mounted = true;
    loadSavedBackupJob()
      .then((saved) => {
        if (!mounted) return;
        if (saved) {
          setBackupJob(saved);
          if (saved.status !== 'idle') {
            setIsBackupPanelOpen(true);
          }
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingJob(false);
      });

    loadSavedMigrationJob().then((savedMig) => {
      if (!mounted || !savedMig) return;
      if (savedMig.status === 'running') {
        savedMig.status = 'paused';
      }
      setMigrationJob(savedMig);
    });

    loadDriveStatus();

    return () => {
      mounted = false;
    };
  }, [isSuperAdmin, loadDriveStatus]);

  // Listen for OAuth popup completion via postMessage
  useEffect(() => {
    if (!isSuperAdmin) return;
    const handleMessage = (event: MessageEvent) => {
      if (!event?.data || typeof event.data !== 'object') return;
      const origin = event.origin || '';
      const isTrustedOrigin =
        origin === window.location.origin ||
        origin.endsWith('.run.app') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1');
      if (!isTrustedOrigin) return;

      if (event.data.type === 'DRIVE_OAUTH_SUCCESS') {
        setIsConnectingDrive(false);
        loadDriveStatus();
        const connectedMail = event.data.accountEmail || event.data.email;
        notify(
          `Google Drive conectado${connectedMail ? ` (${connectedMail})` : ''}! Pasta "${event.data.folderName || 'PT-B Mídia'}" pronta.`,
          'success'
        );
      } else if (event.data.type === 'DRIVE_OAUTH_ERROR') {
        setIsConnectingDrive(false);
        notify(event.data.error || 'Falha ao autorizar Google Drive.', 'error');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isSuperAdmin, loadDriveStatus, notify]);

  const handleConnectDrive = async () => {
    if (!isSuperAdmin || !user) return;
    setIsConnectingDrive(true);
    try {
      const { url } = await fetchDriveOAuthUrl({ uid: user.uid, email: user.email });
      const popup = window.open(
        url,
        'ptb_drive_oauth',
        'width=600,height=720,menubar=no,toolbar=no,location=yes,resizable=yes,scrollbars=yes'
      );
      if (!popup) {
        setIsConnectingDrive(false);
        notify('Pop-up bloqueado pelo navegador. Permita pop-ups para autorizar o Google Drive.', 'error');
        return;
      }
      const watchClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(watchClosed);
          setIsConnectingDrive(false);
          loadDriveStatus();
        }
      }, 800);
    } catch (err: any) {
      setIsConnectingDrive(false);
      notify(err?.message || 'Erro ao iniciar conexão com o Google Drive.', 'error');
    }
  };

  const handleDisconnectDrive = async () => {
    if (!isSuperAdmin || !user) return;
    try {
      await disconnectDriveAccount({ uid: user.uid, email: user.email });
      setConfirmDisconnectDrive(false);
      await loadDriveStatus();
      notify('Conta Google Drive desconectada do servidor (arquivos mantidos).', 'info');
    } catch (err: any) {
      notify(err?.message || 'Erro ao desconectar Google Drive.', 'error');
    }
  };

  const driveMigrationStats = useMemo(() => {
    const total = allFiles.length;
    const inDrive = allFiles.filter((f) => Boolean(f.driveFileId)).length;
    const pending = Math.max(0, total - inDrive);
    const failures = migrationJob?.failures || [];
    return {
      total,
      inDrive,
      pending,
      failuresCount: failures.length,
      failures,
    };
  }, [allFiles, migrationJob]);

  const isMigrating = migrationJob?.status === 'running';

  const handleStartDriveMigration = async (onlyFailures = false) => {
    if (!isSuperAdmin || !user) return;
    if (!driveStatus?.connected) {
      notify('Conecte a conta Google Drive da igreja antes de iniciar a migração.', 'error');
      return;
    }
    if (isMigrating) return;

    migrationPauseRef.current = false;
    setConfirmResetMigration(false);

    try {
      const finalJob = await runSafeDriveMigration({
        files: allFiles,
        caller: { uid: user.uid, email: user.email },
        onlyFailures,
        existingJob: migrationJob,
        resolveChunkedBlob: (uri, mime) => api.resolveChunkedBlob(uri, mime),
        updateFileRecord: async (id, updates) => {
          await api.updateFile(id, updates);
        },
        shouldPause: () => migrationPauseRef.current,
        onProgress: (updated) => {
          setMigrationJob(updated);
        },
      });
      setMigrationJob(finalJob);

      if (finalJob.status === 'paused') {
        notify('Migração pausada com progresso salvo. Você pode retomar depois.', 'info');
      } else if (finalJob.failures.length > 0) {
        notify(
          `Lote finalizado: ${finalJob.copiedCount} copiado(s) nesta execução e ${finalJob.failures.length} falha(s) para tentar novamente. Nenhuma origem antiga foi apagada.`,
          'info'
        );
      } else {
        notify(
          `Migração concluída! ${finalJob.copiedCount} arquivo(s) copiado(s) e conferido(s). Nenhuma origem antiga foi apagada.`,
          'success'
        );
      }
    } catch (err: any) {
      notify(err?.message || 'Erro durante a migração para o Google Drive.', 'error');
    }
  };

  const handlePauseDriveMigration = () => {
    migrationPauseRef.current = true;
    notify('Solicitando pausa segura após o arquivo atual...', 'info');
  };

  const handleResetMigrationLocal = async () => {
    if (isMigrating) return;
    await clearSavedMigrationJob();
    setMigrationJob(null);
    setConfirmResetMigration(false);
    notify('Histórico local de migração limpo (nenhum arquivo foi apagado).', 'info');
  };

  const backupSummary = useMemo(() => {
    if (!backupJob) {
      return {
        completedCols: 0,
        totalCols: BACKUP_COLLECTIONS.length,
        totalDocs: 0,
        hasAnyDocs: false,
        canExportCsv: false,
        filesCount: 0,
      };
    }
    let completedCols = 0;
    let totalDocs = 0;
    for (const colName of BACKUP_COLLECTIONS) {
      const c = backupJob.collections[colName];
      if (!c) continue;
      if (c.status === 'completed') completedCols++;
      totalDocs += c.documents?.length || 0;
    }
    const filesCol = backupJob.collections['files'];
    const filesCount = filesCol?.documents?.length || 0;
    const canExportCsv =
      filesCol?.status === 'completed' || filesCount > 0;

    return {
      completedCols,
      totalCols: BACKUP_COLLECTIONS.length,
      totalDocs,
      hasAnyDocs: totalDocs > 0 || completedCols > 0,
      canExportCsv,
      filesCount,
    };
  }, [backupJob]);

  const isRunning = backupJob?.status === 'running';

  const handleStartOrResumeBackup = async () => {
    if (!isSuperAdmin) {
      notify('Apenas o Super Administrador pode exportar o backup completo.', 'error');
      return;
    }
    if (isRunning) return;

    setIsBackupPanelOpen(true);
    setConfirmReset(false);
    pauseRequestedRef.current = false;

    const baseJob =
      backupJob && backupJob.status !== 'completed'
        ? backupJob
        : backupJob?.status === 'completed'
          ? createInitialBackupJob()
          : createInitialBackupJob();

    try {
      const finalJob = await runResumableFirestoreBackup(baseJob, {
        shouldPause: () => pauseRequestedRef.current,
        onProgress: (updated) => {
          setBackupJob(updated);
        },
      });
      setBackupJob(finalJob);

      if (finalJob.status === 'completed') {
        notify(
          `Backup completo concluído! ${BACKUP_COLLECTIONS.length} coleções exportadas sem alterar nenhum dado.`,
          'success'
        );
      } else if (finalJob.status === 'paused_quota') {
        notify(
          'Cota do Firestore atingida durante o backup. Progresso salvo para retomar de onde parou!',
          'info'
        );
      } else if (finalJob.status === 'paused_manual') {
        notify('Backup pausado com progresso salvo.', 'info');
      } else if (finalJob.status === 'error') {
        notify('Backup interrompido por erro de leitura; progresso anterior salvo.', 'error');
      }
    } catch (err: any) {
      notify(err?.message || 'Erro inesperado ao executar backup.', 'error');
    }
  };

  const handlePauseBackup = () => {
    pauseRequestedRef.current = true;
    notify('Solicitando pausa segura após a página atual...', 'info');
  };

  const handleResetBackupProgress = async () => {
    if (!isSuperAdmin || isRunning) return;
    await clearSavedBackupJob();
    setBackupJob(null);
    setConfirmReset(false);
    notify('Progresso local de backup limpo (nenhum dado do Firestore foi alterado).', 'info');
  };

  const handleDownloadAllJsons = async () => {
    if (!backupJob || isBatchDownloading) return;
    try {
      setIsBatchDownloading(true);
      const count = await downloadAllCompletedJsons(backupJob, false);
      setBackupJob({ ...backupJob });
      notify(`${count} arquivo(s) .json baixado(s).`, 'success');
    } finally {
      setIsBatchDownloading(false);
    }
  };

  const usedBytes = storageStats?.totalBytesUsed || 0;
  const quotaBytes = storageStats?.totalQuota || 2 * 1024 * 1024 * 1024 * 1024;
  const usedPercent = storageStats?.usedPercentage || 0;
  const breakdown = storageStats?.breakdown;

  const storageCategories = [
    { label: 'Vídeos 4K & Transmissões', bytes: breakdown?.videos.bytes || 0, count: breakdown?.videos.count || 0, color: 'bg-blue-500', icon: Film },
    { label: 'Fotos em Alta Resolução', bytes: breakdown?.photos.bytes || 0, count: breakdown?.photos.count || 0, color: 'bg-amber-500', icon: ImageIcon },
    { label: 'Artes Gráficas & Impressão', bytes: breakdown?.arts.bytes || 0, count: breakdown?.arts.count || 0, color: 'bg-purple-500', icon: Palette },
    { label: 'Áudios & Multitracks Master', bytes: breakdown?.audios.bytes || 0, count: breakdown?.audios.count || 0, color: 'bg-emerald-500', icon: Music },
    { label: 'Documentos & Manuais', bytes: breakdown?.documents.bytes || 0, count: breakdown?.documents.count || 0, color: 'bg-red-500', icon: FileText },
  ];

  const hasResumableJob =
    backupJob &&
    (backupJob.status === 'paused_quota' ||
      backupJob.status === 'paused_manual' ||
      backupJob.status === 'error');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-neutral-100">
            Painel Administrativo
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Métricas de armazenamento, Google Drive (PT-B Mídia), auditoria e backup completo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-emerald-400">
            Sistema operacional
          </span>

          {isSuperAdmin && (
            <>
              <button
                type="button"
                disabled={isConnectingDrive || driveStatusLoading}
                onClick={handleConnectDrive}
                className="inline-flex items-center gap-2 px-4 min-h-[40px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 font-semibold text-xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isConnectingDrive ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <HardDrive className="w-4 h-4 text-amber-400" />
                )}
                <span>
                  {driveStatus?.connected ? 'Reconectar Google Drive' : 'Conectar Google Drive'}
                </span>
              </button>

              <button
                type="button"
                disabled={isLoadingJob || isRunning}
                onClick={handleStartOrResumeBackup}
                className="inline-flex items-center gap-2 px-4 min-h-[40px] rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {isRunning
                    ? 'Exportando backup...'
                    : hasResumableJob
                      ? 'Continuar backup'
                      : 'Exportar backup'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Super Admin Google Drive & Safe Migration Panel */}
      {isSuperAdmin && (
        <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <span>Armazenamento no Google Drive (Pasta &ldquo;PT-B Mídia&rdquo;)</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                OAuth conectado à conta da igreja. O refresh token fica salvo exclusivamente no servidor (Supabase/servidor) e os arquivos são enviados em partes diretas ao Drive.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={loadDriveStatus}
                disabled={driveStatusLoading}
                className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${driveStatusLoading ? 'animate-spin' : ''}`} />
                <span>Atualizar</span>
              </button>

              <button
                type="button"
                disabled={isConnectingDrive}
                onClick={handleConnectDrive}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {isConnectingDrive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {driveStatus?.connected ? 'Trocar / Reconectar Drive' : 'Conectar Google Drive'}
                </span>
              </button>

              {driveStatus?.connected && (
                confirmDisconnectDrive ? (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDisconnectDrive}
                      className="px-3 min-h-[36px] rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold hover:bg-red-500/30 cursor-pointer"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDisconnectDrive(false)}
                      className="px-2.5 min-h-[36px] rounded-xl bg-neutral-800 text-neutral-300 text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnectDrive(true)}
                    className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl bg-neutral-950 border border-neutral-800 hover:border-red-500/40 text-neutral-400 hover:text-red-300 text-xs cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Desconectar</span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Connection status card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block">Status da Conexão</span>
              <span className={`text-xs font-semibold mt-1 flex items-center gap-1.5 ${driveStatus?.connected ? 'text-emerald-400' : 'text-amber-300'}`}>
                {driveStatus?.connected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{driveStatus.accountEmail || 'Conta conectada'}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Aguardando conexão da conta</span>
                  </>
                )}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block">Pasta Destino no Drive</span>
              <span className="text-xs font-semibold text-neutral-100 mt-1 flex items-center gap-1.5">
                <FolderCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{driveStatus?.folderName || 'PT-B Mídia'}</span>
                {driveStatus?.folderId && (
                  <span className="text-[10px] font-mono text-neutral-500 truncate">
                    ({driveStatus.folderId.slice(0, 8)}...)
                  </span>
                )}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800">
              <span className="text-[11px] text-neutral-400 block">Cofre do Refresh Token</span>
              <span className="text-xs font-semibold text-neutral-100 mt-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {driveStatus?.tokenBackend === 'supabase'
                    ? 'Supabase (somente servidor)'
                    : 'Servidor protegido (configure Supabase se desejar)'}
                </span>
              </span>
            </div>
          </div>

          {driveStatus?.configured && driveStatus?.tokenBackend === 'supabase' && driveStatus?.supabaseTableReady === false && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
              <p className="font-semibold">
                {driveStatus.supabaseError?.includes('42501')
                  ? 'Permissão pendente no Supabase para a tabela public.google_drive_tokens:'
                  : 'Tabela do Supabase ainda não encontrada (public.google_drive_tokens):'}
              </p>
              {driveStatus.supabaseError?.includes('42501') ? (
                <p className="text-neutral-300 leading-relaxed">
                  Execute no SQL Editor do Supabase:{' '}
                  <code className="text-amber-300">GRANT ALL ON TABLE public.google_drive_tokens TO service_role;</code>
                </p>
              ) : (
                <p className="text-neutral-300 leading-relaxed">
                  Antes de concluir o login OAuth, execute o conteúdo do arquivo{' '}
                  <code className="text-amber-300">supabase_drive_tokens.sql</code> no SQL Editor do seu projeto Supabase para armazenar o refresh token com segurança.
                </p>
              )}
            </div>
          )}

          {!driveStatus?.configured && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
              <p className="font-semibold">
                Configure as credenciais OAuth do Google Drive nas Variáveis/Secrets do servidor:
              </p>
              <p className="text-neutral-300 leading-relaxed">
                Defina <code className="text-amber-300">GOOGLE_DRIVE_CLIENT_ID</code> e{' '}
                <code className="text-amber-300">GOOGLE_DRIVE_CLIENT_SECRET</code> (e opcionalmente{' '}
                <code className="text-amber-300">SUPABASE_URL</code> +{' '}
                <code className="text-amber-300">SUPABASE_SERVICE_ROLE_KEY</code>). Cadastre no Google Cloud Console a URL de redirecionamento autorizada:
              </p>
              {driveStatus?.redirectUri && (
                <p className="font-mono text-[11px] text-amber-300 break-all bg-neutral-950/80 px-2.5 py-1.5 rounded-lg border border-neutral-800">
                  {driveStatus.redirectUri}
                </p>
              )}
            </div>
          )}

          {/* Safe Legacy Migration Controls & Counters */}
          <div className="pt-4 border-t border-neutral-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
                  Migração Segura de Arquivos Antigos (Em Lotes Retomáveis)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Copia arquivos de Firebase Storage, <code className="text-neutral-300">/uploads</code>,{' '}
                  <code className="text-neutral-300">chunked://</code> e <code className="text-neutral-300">data:</code> para o Drive com conferência de tamanho. Nunca apaga a origem antiga.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {isMigrating ? (
                  <button
                    type="button"
                    onClick={handlePauseDriveMigration}
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 text-xs font-semibold cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pausar migração</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={!driveStatus?.connected || driveMigrationStats.pending === 0}
                      onClick={() => handleStartDriveMigration(false)}
                      className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>
                        {driveMigrationStats.pending === 0
                          ? 'Todos no Drive'
                          : migrationJob?.status === 'paused'
                            ? 'Continuar migração'
                            : `Migrar arquivos (${driveMigrationStats.pending})`}
                      </span>
                    </button>

                    {driveMigrationStats.failuresCount > 0 && (
                      <button
                        type="button"
                        disabled={!driveStatus?.connected}
                        onClick={() => handleStartDriveMigration(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Tentar falhas novamente ({driveMigrationStats.failuresCount})</span>
                      </button>
                    )}

                    {migrationJob && (
                      confirmResetMigration ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleResetMigrationLocal}
                            className="px-3 min-h-[36px] rounded-xl bg-neutral-800 border border-neutral-600 text-neutral-200 text-xs font-semibold cursor-pointer"
                          >
                            Confirmar limpeza do log local
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmResetMigration(false)}
                            className="px-2.5 min-h-[36px] rounded-xl bg-neutral-900 text-neutral-400 text-xs cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmResetMigration(true)}
                          className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-400 text-xs cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Limpar histórico</span>
                        </button>
                      )
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Summary counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 block">Total de registros</span>
                <span className="text-lg font-bold font-mono tabular-nums text-neutral-100 mt-0.5 block">
                  {driveMigrationStats.total}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 block">No Drive (copiados)</span>
                <span className="text-lg font-bold font-mono tabular-nums text-emerald-400 mt-0.5 block">
                  {driveMigrationStats.inDrive}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 block">Pendentes (servindo legado)</span>
                <span className="text-lg font-bold font-mono tabular-nums text-amber-400 mt-0.5 block">
                  {driveMigrationStats.pending}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800">
                <span className="text-[11px] text-neutral-400 block">Falhas</span>
                <span className="text-lg font-bold font-mono tabular-nums text-red-400 mt-0.5 block">
                  {driveMigrationStats.failuresCount}
                </span>
              </div>
            </div>

            {/* Migration progress bar */}
            {(isMigrating || migrationJob) && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-neutral-300">
                    {isMigrating && migrationJob?.currentFileName
                      ? `Copiando e conferindo tamanho: ${migrationJob.currentFileName}`
                      : migrationJob?.status === 'completed'
                        ? `Execução finalizada: ${migrationJob.copiedCount} copiado(s), ${migrationJob.failures.length} falha(s).`
                        : migrationJob?.status === 'paused'
                          ? 'Migração pausada (pronta para retomar sem duplicar).'
                          : 'Pronto para migrar em lotes seguros.'}
                  </span>
                  <span className="font-mono tabular-nums text-neutral-400 text-[11px]">
                    {driveMigrationStats.total > 0
                      ? Math.round((driveMigrationStats.inDrive / driveMigrationStats.total) * 100)
                      : 100}
                    %
                  </span>
                </div>
                <div className="w-full h-2.5 bg-neutral-950 border border-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      driveMigrationStats.failuresCount > 0 ? 'bg-amber-400' : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${
                        driveMigrationStats.total > 0
                          ? Math.round((driveMigrationStats.inDrive / driveMigrationStats.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Failure list */}
            {driveMigrationStats.failures.length > 0 && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 overflow-hidden">
                <div className="px-3.5 py-2 border-b border-red-500/20 flex items-center justify-between text-xs">
                  <span className="font-semibold text-red-300">
                    Arquivos com falha ({driveMigrationStats.failures.length})
                  </span>
                  <span className="text-[11px] text-red-200/80">
                    Permanecem funcionando pela origem antiga até serem migrados
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-red-500/15">
                  {driveMigrationStats.failures.map((fail) => (
                    <div key={fail.fileId} className="px-3.5 py-2.5 text-xs space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-neutral-100 truncate">{fail.fileName}</span>
                        <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                          {fail.originType} · {fail.attempts} tent.
                        </span>
                      </div>
                      <p className="text-[11px] text-red-300 leading-snug">{fail.error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-neutral-400">
              Garantia de segurança: nenhuma origem antiga (Firebase Storage, <code className="text-neutral-300">/uploads</code>, <code className="text-neutral-300">file_data</code> ou <code className="text-neutral-300">data:</code>) é removida automaticamente; toda limpeza exige sua confirmação explícita após revisar os totais.
            </p>
          </div>
        </div>
      )}

      {/* Super Admin Resumable Backup Section */}
      {isSuperAdmin && (isBackupPanelOpen || backupJob) && (
        <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                <span>Backup Completo do Firestore (Somente Leitura)</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Exporta um <code className="text-neutral-300">.json</code> por coleção ({BACKUP_COLLECTIONS.length} coleções, incluindo <code className="text-neutral-300">file_data</code>) e um <code className="text-neutral-300">.csv</code> completo dos arquivos. Nenhum registro é alterado ou apagado.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isRunning ? (
                <button
                  type="button"
                  onClick={handlePauseBackup}
                  className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-100 text-xs font-semibold cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pausar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartOrResumeBackup}
                  className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {hasResumableJob
                      ? 'Continuar de onde parou'
                      : backupJob?.status === 'completed'
                        ? 'Novo backup completo'
                        : 'Iniciar backup'}
                  </span>
                </button>
              )}

              {backupSummary.canExportCsv && backupJob && (
                <button
                  type="button"
                  onClick={() => {
                    downloadFilesCsvBackup(backupJob);
                    notify('CSV de arquivos baixado.', 'success');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-emerald-400 text-xs font-semibold cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Baixar CSV ({backupSummary.filesCount})</span>
                </button>
              )}

              {backupSummary.hasAnyDocs && backupJob && (
                <button
                  type="button"
                  disabled={isBatchDownloading}
                  onClick={handleDownloadAllJsons}
                  className="inline-flex items-center gap-1.5 px-3.5 min-h-[36px] rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  <FileJson className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isBatchDownloading ? 'Baixando...' : 'Baixar todos os .json'}</span>
                </button>
              )}

              {!isRunning && backupJob && (
                confirmReset ? (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleResetBackupProgress}
                      className="px-3 min-h-[36px] rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold hover:bg-red-500/30 cursor-pointer"
                    >
                      Confirmar limpeza local
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-2.5 min-h-[36px] rounded-xl bg-neutral-800 text-neutral-300 text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    title="Limpar somente o cache local de progresso deste backup"
                    className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 text-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reiniciar</span>
                  </button>
                )
              )}
            </div>
          </div>

          {backupJob && (
            <>
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-neutral-300 font-medium">
                    Progresso: <strong className="font-mono tabular-nums text-amber-400">{backupSummary.completedCols} / {backupSummary.totalCols}</strong> coleções
                    {' · '}
                    <span className="font-mono tabular-nums text-neutral-200">{backupSummary.totalDocs}</span> registros salvos em cache local
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400">
                    Atualizado: {formatDateTime(backupJob.updatedAt)}
                  </span>
                </div>

                <div className="w-full h-2.5 bg-neutral-950 border border-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      backupJob.status === 'paused_quota' || backupJob.status === 'error'
                        ? 'bg-amber-500'
                        : backupJob.status === 'completed'
                          ? 'bg-emerald-500'
                          : 'bg-amber-400'
                    }`}
                    style={{
                      width: `${Math.round((backupSummary.completedCols / backupSummary.totalCols) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {backupJob.pausedReason && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    backupJob.status === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-200'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{backupJob.pausedReason}</p>
                </div>
              )}

              {backupJob.status === 'completed' && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Backup concluído com sucesso ({backupSummary.totalDocs} documentos nas {backupSummary.totalCols} coleções).
                  </span>
                </div>
              )}

              {/* Per-Collection Status Table */}
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 overflow-hidden">
                <div className="max-h-72 overflow-y-auto divide-y divide-neutral-800/80">
                  {BACKUP_COLLECTIONS.map((colName) => {
                    const colState = backupJob.collections[colName];
                    const docsCount = colState?.documents?.length || 0;
                    const status = colState?.status || 'pending';
                    const canDownloadCol = docsCount > 0 || status === 'completed';

                    let statusText = 'Aguardando';
                    let statusColor = 'text-neutral-500';
                    if (status === 'in_progress') {
                      statusText = `Lendo página ${colState.pagesRead + 1}...`;
                      statusColor = 'text-amber-400';
                    } else if (status === 'completed') {
                      statusText = 'Concluído';
                      statusColor = 'text-emerald-400';
                    } else if (status === 'paused_quota') {
                      statusText = 'Pausado (cota)';
                      statusColor = 'text-amber-400';
                    } else if (status === 'paused_manual') {
                      statusText = 'Pausado';
                      statusColor = 'text-neutral-300';
                    } else if (status === 'error') {
                      statusText = 'Erro';
                      statusColor = 'text-red-400';
                    }

                    return (
                      <div
                        key={colName}
                        className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-3.5 py-2 text-xs hover:bg-neutral-900/60"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-neutral-200 font-medium truncate">
                            {colName}
                          </span>
                          <span className={`text-[11px] font-medium ${statusColor}`}>
                            {statusText}
                          </span>
                          {colState?.lastDocId && status !== 'completed' && (
                            <span className="text-[11px] font-mono text-neutral-500 truncate hidden md:inline">
                              cursor: {colState.lastDocId}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono tabular-nums text-[11px] text-neutral-400">
                            {docsCount} doc(s)
                          </span>
                          {canDownloadCol && colState && (
                            <button
                              type="button"
                              onClick={() => downloadCollectionBackupFile(colState)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-[11px] font-medium cursor-pointer"
                            >
                              <Download className="w-3 h-3 text-amber-400" />
                              <span>.json</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hairline Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-800 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="p-4 bg-neutral-900">
          <span className="text-xs text-neutral-400 block">Arquivos</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-neutral-100 mt-1 block">
            {storageStats?.counts.totalFiles || 0}
          </span>
        </div>

        <div className="p-4 bg-neutral-900">
          <span className="text-xs text-neutral-400 block">Pastas</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-neutral-100 mt-1 block">
            {storageStats?.counts.totalFolders || 0}
          </span>
        </div>

        <div className="p-4 bg-neutral-900">
          <span className="text-xs text-neutral-400 block">Eventos</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-neutral-100 mt-1 block">
            {storageStats?.counts.totalEvents || 0}
          </span>
        </div>

        <div className="p-4 bg-neutral-900">
          <span className="text-xs text-neutral-400 block">Membros</span>
          <span className="text-2xl font-bold font-mono tabular-nums text-amber-400 mt-1 block">
            {storageStats?.counts.totalUsers || 0}
          </span>
        </div>
      </div>

      {/* Storage Breakdown Section */}
      <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-100">
            Distribuição de Armazenamento
          </h2>
          <span className="text-xs font-mono tabular-nums text-amber-400 font-bold">
            {formatBytes(usedBytes)} de {formatBytes(quotaBytes)} ({usedPercent.toFixed(2)}%)
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden flex">
          {storageCategories.map((cat) => {
            const catPercent = usedBytes > 0 ? (cat.bytes / usedBytes) * usedPercent : 0;
            if (catPercent <= 0) return null;
            return (
              <div
                key={cat.label}
                title={`${cat.label}: ${formatBytes(cat.bytes)}`}
                className={`h-full ${cat.color} first:rounded-l-full last:rounded-r-full transition-all duration-500`}
                style={{ width: `${catPercent}%` }}
              />
            );
          })}
        </div>

        {/* Detailed Category Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {storageCategories.map((cat) => {
            const Icon = cat.icon;
            const percentageOfUsed = usedBytes > 0 ? (cat.bytes / usedBytes) * 100 : 0;

            return (
              <div
                key={cat.label}
                className="p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg ${cat.color}/20 text-neutral-100 shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-neutral-200 block truncate">
                      {cat.label}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono tabular-nums mt-0.5 block">
                      {cat.count} arq. ({percentageOfUsed.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                <span className="text-xs font-bold font-mono tabular-nums text-neutral-100 shrink-0">
                  {formatBytes(cat.bytes)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit Log Preview */}
      <div className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h3 className="text-sm font-semibold text-neutral-100">Auditoria Recente</h3>
          <button
            onClick={() => setActiveTab('history')}
            className="text-xs text-amber-400 hover:underline font-medium cursor-pointer"
          >
            Ver histórico completo
          </button>
        </div>

        <div className="divide-y divide-neutral-800">
          {storageStats?.recentActivities && storageStats.recentActivities.length > 0 ? (
            storageStats.recentActivities.slice(0, 6).map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-xs hover:bg-neutral-800/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-neutral-200 shrink-0">{act.userName}:</span>
                  <span className="text-neutral-300 truncate">{act.actionLabel}</span>
                  <span className="text-neutral-500 truncate hidden sm:inline">({act.targetName})</span>
                </div>
                <span className="text-[11px] text-neutral-400 font-mono tabular-nums shrink-0">
                  {formatDateTime(act.createdAt)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-neutral-500 text-xs py-6 text-center">Nenhum registro encontrado.</p>
          )}
        </div>
      </div>
    </div>
  );
};
