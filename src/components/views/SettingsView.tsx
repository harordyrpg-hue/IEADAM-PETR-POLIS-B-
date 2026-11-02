import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cloud,
  HardDrive,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  Save,
  Database,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { SystemSettings } from '../../types.js';
import { formatBytes } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const SettingsView: React.FC = () => {
  const { notify, user } = useApp();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [churchName, setChurchName] = useState('PT-B Mídia');
  const [churchSubtitle, setChurchSubtitle] = useState('Central de Arquivos e Mídias');
  const [totalQuotaGb, setTotalQuotaGb] = useState('1024');

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const data = await api.getSettings();
        setSettings(data);
        setChurchName(data.churchName || 'PT-B Mídia');
        setChurchSubtitle(data.churchSubtitle || 'Central de Arquivos e Mídias');
        const gb = Math.round((data.totalQuotaBytes || 1024 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024));
        setTotalQuotaGb(String(gb));
      } catch {
        notify('Erro ao carregar configurações', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [notify]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      notify('Apenas o Super Administrador pode alterar configurações.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const quotaBytes = Number(totalQuotaGb) * 1024 * 1024 * 1024;
      await api.updateSettings({
        churchName: churchName.trim(),
        churchSubtitle: churchSubtitle.trim(),
        totalQuotaBytes: quotaBytes,
        storageEngine: 'Cloud Storage for Firebase',
      });
      notify('Configurações atualizadas com sucesso no Firestore!', 'success');
    } catch {
      notify('Erro ao salvar configurações', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="pb-3 border-b border-neutral-800">
        <h1 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-400" />
          Configurações da Central & Infraestrutura Oficial
        </h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          Parâmetros do sistema, integração em nuvem com Firebase (Auth, Firestore e Cloud Storage).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form settings */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-5 text-xs">
            <h2 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-400" />
              Identidade & Parâmetros da Igreja
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Nome da Plataforma / Igreja:</label>
                <input
                  type="text"
                  value={churchName}
                  disabled={!isSuperAdmin}
                  onChange={(e) => setChurchName(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Subtítulo:</label>
                <input
                  type="text"
                  value={churchSubtitle}
                  disabled={!isSuperAdmin}
                  onChange={(e) => setChurchSubtitle(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Cota Total de Armazenamento (em GB):</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="10"
                    max="100000"
                    value={totalQuotaGb}
                    disabled={!isSuperAdmin}
                    onChange={(e) => setTotalQuotaGb(e.target.value)}
                    className="w-36 bg-neutral-800 border border-neutral-700 rounded-lg p-2.5 text-neutral-200 font-mono-numbers focus:outline-none focus:border-amber-500 disabled:opacity-60"
                  />
                  <span className="text-neutral-400 text-xs font-mono-numbers">
                    = {formatBytes(Number(totalQuotaGb) * 1024 * 1024 * 1024)} disponíveis
                  </span>
                </div>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl shadow-md transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
                </button>
              </div>
            )}
          </form>

          {/* Infrastructure Health Status */}
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4 text-xs">
            <h2 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-amber-400" />
              Serviços Cloud Conectados
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Firebase Auth</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Autenticação segura via E-mail + Senha e Google OAuth com papéis RBAC.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                  <Database className="w-4 h-4" />
                  <span>Cloud Firestore</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Banco NoSQL escalável com regras de segurança ativas e sincronização em tempo real.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-800/60 border border-neutral-700/60">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cloud Storage</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Upload direto e preservação de fotos e vídeos em qualidade 100% original.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info & Parameters */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs space-y-4">
            <h3 className="font-semibold text-neutral-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Credenciais do Projeto Firebase
            </h3>

            <div className="space-y-3 font-mono text-[11px]">
              <div>
                <span className="text-neutral-500 block">ID do Projeto</span>
                <span className="text-neutral-300 font-medium select-all">
                  {settings?.projectId || 'massive-voyager-tgtt6'}
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block">Storage Bucket</span>
                <span className="text-neutral-300 font-medium select-all">
                  {settings?.storageBucket || 'massive-voyager-tgtt6.firebasestorage.app'}
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block">Banco de Dados Firestore</span>
                <span className="text-neutral-300 font-medium select-all break-all">
                  {settings?.firestoreDatabaseId || 'ai-studio-ptbmdia-695ad5ee-916f-48c6-81f8-22f4d1a5dd48'}
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block">Super Administrador Oficial</span>
                <span className="text-amber-400 font-medium select-all">
                  pedro.martinss225@gmail.com
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <Lock className="w-4 h-4" />
              <span>Regra de Qualidade Original</span>
            </div>
            <p className="text-neutral-300 text-[11px] leading-relaxed">
              O PT-B Mídia armazena todos os arquivos enviados exatamente nos bytes originais recebidos. Nenhuma foto ou vídeo 4K sofre compressão arbitrária na nuvem.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
