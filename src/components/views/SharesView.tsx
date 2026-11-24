import React, { useState, useEffect } from 'react';
import { Share2, Copy, Trash2, Check, Lock, Download, ExternalLink, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { ShareLink } from '../../types.js';
import { formatDate } from '../../utils/formatters.js';
import { api } from '../../services/api.js';
import { buildPublicUrl, copyTextSafely } from '../../utils/publicUrl.js';

export const SharesView: React.FC = () => {
  const { notify } = useApp();
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadShares = async () => {
    try {
      setLoading(true);
      const data = await api.getShares();
      setShares(data);
    } catch {
      notify('Erro ao carregar compartilhamentos', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShares();
  }, []);

  const handleCopyLink = async (token: string) => {
    const url = buildPublicUrl(`/#share=${token}`);
    await copyTextSafely(url);
    setCopiedToken(token);
    notify('Link seguro copiado!', 'success');
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRevokeShare = async (id: string) => {
    try {
      await api.deleteShare(id);
      notify('Link de compartilhamento revogado', 'info');
      loadShares();
    } catch {
      notify('Erro ao revogar compartilhamento', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="pb-4 border-b border-neutral-800">
        <h1 className="text-xl font-bold text-neutral-100">
          Compartilhamentos
        </h1>
        <p className="text-xs text-neutral-400 mt-0.5">
          Links externos ativos para equipe e convidados ({shares.length}).
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs">Carregando links...</div>
      ) : shares.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs">
          Nenhum link de compartilhamento ativo no momento. Use "Compartilhar" em qualquer arquivo ou pasta para gerar um link.
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 overflow-hidden">
          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-neutral-800">
            {shares.map((share) => (
              <div key={share.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-neutral-100 truncate">
                    {share.resourceName}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-400 font-mono tabular-nums">
                    <span className="uppercase">{share.resourceType}</span>
                    <span aria-hidden="true">·</span>
                    <span className={share.allowDownload ? 'text-emerald-400' : 'text-red-400'}>
                      {share.allowDownload ? 'Download livre' : 'Bloqueado'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{share.expiresAt ? formatDate(share.expiresAt) : 'Sem expiração'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleCopyLink(share.token)}
                    className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl cursor-pointer"
                    title="Copiar link"
                  >
                    {copiedToken === share.token ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleRevokeShare(share.id)}
                    className="p-2.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-xl cursor-pointer"
                    title="Revogar link"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-[11px] font-medium text-neutral-400 bg-neutral-950/50">
                  <th className="px-4 py-3">Recurso</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Download</th>
                  <th className="px-4 py-3">Validade</th>
                  <th className="px-4 py-3">Criado por</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/70">
                {shares.map((share) => (
                  <tr key={share.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-neutral-200 truncate max-w-xs">
                      {share.resourceName}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 uppercase font-mono text-[11px]">
                      {share.resourceType}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${share.allowDownload ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {share.allowDownload ? 'Permitido' : 'Bloqueado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 font-mono tabular-nums">
                      {share.expiresAt ? formatDate(share.expiresAt) : 'Sem expiração'}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {share.createdByName}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleCopyLink(share.token)}
                          className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                          title="Copiar link"
                        >
                          {copiedToken === share.token ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span className="text-[11px]">{copiedToken === share.token ? 'Copiado' : 'Copiar'}</span>
                        </button>

                        <button
                          onClick={() => handleRevokeShare(share.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg cursor-pointer"
                          title="Revogar link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
