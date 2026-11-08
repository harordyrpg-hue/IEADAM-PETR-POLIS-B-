import React, { useEffect, useRef } from 'react';
import {
  HardDrive,
  Tv,
  Square,
  Upload,
  Trash2,
  FolderOpen,
  Image as ImageIcon,
  Film,
  Palette,
  Music,
  FileText,
  Activity,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Laptop,
  Maximize2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { formatBytes } from '../../utils/formatters.js';

export const StorageTransmissionView: React.FC = () => {
  const {
    storageStats,
    refreshStats,
    isTransmitting,
    transmissionStream,
    toggleTransmission,
    setActiveTab,
    openUpload,
    notify,
  } = useApp();

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (videoRef.current && transmissionStream) {
      videoRef.current.srcObject = transmissionStream;
    }
  }, [transmissionStream, isTransmitting]);

  const usedBytes = storageStats?.totalBytesUsed || 0;
  const quotaBytes = storageStats?.totalQuota || 2 * 1024 * 1024 * 1024 * 1024;
  const availableBytes = storageStats?.availableBytes || Math.max(0, quotaBytes - usedBytes);
  const usedPercent = storageStats?.usedPercentage || 0;

  const categories = [
    {
      id: 'photos' as const,
      name: 'Fotos',
      icon: ImageIcon,
      count: storageStats?.breakdown.photos.count || 0,
      bytes: storageStats?.breakdown.photos.bytes || 0,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      id: 'videos' as const,
      name: 'Vídeos',
      icon: Film,
      count: storageStats?.breakdown.videos.count || 0,
      bytes: storageStats?.breakdown.videos.bytes || 0,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
      id: 'arts' as const,
      name: 'Artes Gráficas',
      icon: Palette,
      count: storageStats?.breakdown.arts.count || 0,
      bytes: storageStats?.breakdown.arts.bytes || 0,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
    {
      id: 'audios' as const,
      name: 'Áudios & Louvores',
      icon: Music,
      count: storageStats?.breakdown.audios.count || 0,
      bytes: storageStats?.breakdown.audios.bytes || 0,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      id: 'documents' as const,
      name: 'Documentos',
      icon: FileText,
      count: storageStats?.breakdown.documents.count || 0,
      bytes: storageStats?.breakdown.documents.bytes || 0,
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
    },
    {
      id: 'trash' as const,
      name: 'Lixeira',
      icon: Trash2,
      count: storageStats?.breakdown.trash.count || 0,
      bytes: storageStats?.breakdown.trash.bytes || 0,
      color: 'text-neutral-400 bg-neutral-800 border-neutral-700',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-neutral-900 border border-neutral-800 rounded-2xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight">
                Armazenamento & Telão
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
                Monitoramento de disco, detalhamento de arquivos e transmissão ao vivo para telão/projetor.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refreshStats();
              notify('Estatísticas atualizadas com sucesso', 'info');
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            title="Atualizar estatísticas"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>

          <button
            onClick={() => openUpload()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Enviar arquivos</span>
          </button>
        </div>
      </div>

      {/* 2. Telão & Transmissão de Tela (Section 1) */}
      <div className="p-5 sm:p-6 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              isTransmitting
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                : 'bg-neutral-800 border-neutral-700 text-neutral-300'
            }`}>
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-100">
                  Transmissão para o Telão / Projetor
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-amber-300 border border-neutral-700">
                  PC
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Projete fotos, avisos, escalas e vídeos diretamente no telão ou TV da igreja.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleTransmission()}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md ${
                isTransmitting
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/80 shadow-rose-600/30 animate-pulse'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 hover:border-amber-500/50'
              }`}
            >
              {isTransmitting ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>Parar de transmitir</span>
                </>
              ) : (
                <>
                  <Tv className="w-4 h-4 text-amber-400" />
                  <span>Transmitir para a tela</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live video feed if transmitting */}
        {isTransmitting ? (
          <div className="space-y-3">
            <div className="relative aspect-video max-w-2xl mx-auto rounded-xl overflow-hidden bg-black border border-rose-500/40 shadow-xl flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/80 text-[11px] font-bold text-rose-400 flex items-center gap-1.5 border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>AO VIVO NO TELÃO</span>
              </div>
            </div>
            <p className="text-xs text-center text-neutral-400">
              Transmitindo a tela/janela selecionada do computador para o telão da igreja.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs text-neutral-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Laptop className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Para transmitir para o telão, utilize o computador da cabine de mídia conectado via HDMI ou projetor e clique em <strong>Transmitir para a tela</strong>.
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 shrink-0 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Pronto para conexão</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Armazenamento Overview (Section 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Quota Gauge */}
        <div className="lg:col-span-2 p-5 sm:p-6 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-neutral-100">
                Capacidade de Armazenamento
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Espaço em nuvem para fotos de alta resolução, vídeos e artes da igreja.
              </p>
            </div>
            <span className="text-lg font-bold font-mono-numbers text-amber-400">
              {usedPercent.toFixed(1)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden p-0.5 border border-neutral-700/60">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(usedPercent, 1))}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 text-center border-t border-neutral-800">
            <div className="p-2.5 rounded-xl bg-neutral-950/50 border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block uppercase font-medium">
                Usado
              </span>
              <span className="text-sm sm:text-base font-bold font-mono-numbers text-neutral-100">
                {formatBytes(usedBytes)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-neutral-950/50 border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block uppercase font-medium">
                Disponível
              </span>
              <span className="text-sm sm:text-base font-bold font-mono-numbers text-emerald-400">
                {formatBytes(availableBytes)}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-neutral-950/50 border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block uppercase font-medium">
                Capacidade Total
              </span>
              <span className="text-sm sm:text-base font-bold font-mono-numbers text-neutral-100">
                {formatBytes(quotaBytes)}
              </span>
            </div>
          </div>
        </div>

        {/* Sync & Integrity Status */}
        <div className="p-5 sm:p-6 bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Sincronização & Qualidade</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Todos os arquivos enviados preservam 100% da resolução original sem compressão automática.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/40 border border-neutral-800">
              <span className="text-neutral-400">Total de Arquivos:</span>
              <span className="font-bold text-neutral-200 font-mono-numbers">
                {storageStats?.counts.totalFiles || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/40 border border-neutral-800">
              <span className="text-neutral-400">Total de Pastas:</span>
              <span className="font-bold text-neutral-200 font-mono-numbers">
                {storageStats?.counts.totalFolders || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/40 border border-neutral-800">
              <span className="text-neutral-400">Sincronização:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Tempo Real</span>
              </span>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('files')}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Acessar Arquivos</span>
          </button>
        </div>
      </div>

      {/* 4. Categorias de Mídia */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          Distribuição por Categoria de Mídia
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                onClick={() => setActiveTab(cat.id === 'trash' ? 'trash' : cat.id)}
                className="p-3.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-xl cursor-pointer transition-all hover:bg-neutral-800/60 group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg border ${cat.color} group-hover:scale-105 transition-transform`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <ExternalLink className="w-3 h-3 text-neutral-600 group-hover:text-amber-400 transition-colors" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-neutral-200 group-hover:text-amber-300 block truncate">
                    {cat.name}
                  </span>
                  <div className="text-[11px] text-neutral-400 font-mono-numbers mt-0.5">
                    <span>{cat.count} arq.</span>
                    <span className="mx-1">·</span>
                    <span>{formatBytes(cat.bytes)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
