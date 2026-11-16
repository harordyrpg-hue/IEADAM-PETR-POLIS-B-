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
        storageEngine: 'Servidor Dedicado PT-B Mídia',
      });
      notify('Configurações atualizadas com sucesso!', 'success');
    } catch {
      notify('Erro ao salvar configurações', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="pb-4 border-b border-neutral-800">
        <h1 className="text-xl font-bold text-neutral-100">
          Configurações
        </h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          Parâmetros da central e infraestrutura do servidor.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form settings */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="p-5 sm:p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-5 text-xs">
            <h2 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-400" />
              Identidade e Cota
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-neutral-300 font-medium mb-1">Nome da Plataforma</label>
                <input
                  type="text"
                  value={churchName}
                  disabled={!isSuperAdmin}
                  onChange={(e) => setChurchName(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 min-h-[40px] text-neutral-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Subtítulo</label>
                <input
                  type="text"
                  value={churchSubtitle}
                  disabled={!isSuperAdmin}
                  onChange={(e) => setChurchSubtitle(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 min-h-[40px] text-neutral-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">Cota Total (GB)</label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min="10"
                    max="100000"
                    value={totalQuotaGb}
                    disabled={!isSuperAdmin}
                    onChange={(e) => setTotalQuotaGb(e.target.value)}
                    className="w-36 bg-neutral-800 border border-neutral-700 rounded-xl px-3 min-h-[40px] text-neutral-200 font-mono tabular-nums focus:outline-none focus:border-amber-500 disabled:opacity-60"
                  />
                  <span className="text-neutral-400 text-xs font-mono tabular-nums">
                    = {formatBytes(Number(totalQuotaGb) * 1024 * 1024 * 1024)}
                  </span>
                </div>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 min-h-[40px] bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar alterações'}</span>
                </button>
              </div>
            )}
          </form>

          {/* Infrastructure Health Status */}
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden text-xs">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center gap-2">
              <Cloud className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-neutral-200">Serviços Conectados</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-neutral-800">
              <div className="p-4 bg-neutral-900">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Autenticação Local</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Login direto e controle de acesso por cargo.
                </p>
              </div>

              <div className="p-4 bg-neutral-900">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                  <Database className="w-4 h-4" />
                  <span>Banco Persistente Local</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Sincronização em tempo real sem limite de cota.
                </p>
              </div>

              <div className="p-4 bg-neutral-900">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Armazenamento Dedicado</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Mídias originais sem compressão.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs space-y-4">
            <h3 className="font-semibold text-neutral-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Servidor PT-B Mídia
            </h3>

            <div className="space-y-3 font-mono text-[11px]">
              <div>
                <span className="text-neutral-500 block">Identificador</span>
                <span className="text-neutral-300 font-medium select-all break-all">
                  {settings?.projectId || 'ptb-midia-local'}
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block">Diretório de Mídias</span>
                <span className="text-neutral-300 font-medium select-all break-all">
                  {settings?.storageBucket || '/uploads'}
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block">Motor de Dados</span>
                <span className="text-neutral-300 font-medium select-all break-all">
                  {settings?.firestoreDatabaseId || 'Banco Persistente Local'}
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block">Super Administradores</span>
                <span className="text-amber-400 font-medium select-all block">
                  pedro.martinss225@gmail.com
                </span>
                <span className="text-amber-400 font-medium select-all block mt-0.5">
                  emillycampos308@gmail.com
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <Lock className="w-4 h-4" />
              <span>Qualidade Original</span>
            </div>
            <p className="text-neutral-300 text-[11px] leading-relaxed">
              Todos os arquivos enviados preservam os bytes originais sem compressão arbitrária.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
