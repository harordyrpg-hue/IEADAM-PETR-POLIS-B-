import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Calendar,
  Lock,
  Download,
  Link as LinkIcon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { api } from '../../services/api.js';

export const ShareModal: React.FC = () => {
  const { shareTarget, setShareTarget, notify } = useApp();

  const [allowDownload, setAllowDownload] = useState(true);
  const [requireAuth, setRequireAuth] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!shareTarget) return null;

  const handleGenerateShare = async () => {
    try {
      setIsGenerating(true);

      let expiresAt: string | null = null;
      if (expiresInDays !== 'never') {
        const days = parseInt(expiresInDays, 10);
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + days);
        expiresAt = expDate.toISOString();
      }

      const share = await api.createShare({
        resourceType: shareTarget.type,
        resourceId: shareTarget.id,
        resourceName: shareTarget.name,
        allowDownload,
        requireAuth,
        expiresAt,
      });

      const fullUrl = `${window.location.origin}/#share=${share.token}`;
      setGeneratedLink(fullUrl);
      notify('Link seguro gerado com sucesso!', 'success');
    } catch {
      notify('Erro ao gerar link de compartilhamento', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    notify('Link copiado para a área de transferência', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-100 text-xs animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-sm">Compartilhar {shareTarget.type}</span>
          </div>
          <button
            onClick={() => setShareTarget(null)}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div className="p-3 bg-neutral-800/60 rounded-xl border border-neutral-700/60">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider block mb-0.5">Item selecionado:</span>
            <span className="font-medium text-neutral-200 truncate block">{shareTarget.name}</span>
          </div>

          {!generatedLink ? (
            <div className="space-y-3">
              {/* Expiration setting */}
              <div>
                <label className="block text-neutral-300 font-medium mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Validade do link:
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2 text-neutral-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="1">1 dia</option>
                  <option value="7">7 dias (Recomendado)</option>
                  <option value="30">30 dias</option>
                  <option value="never">Sem expiração</option>
                </select>
              </div>

              {/* Download toggle */}
              <label className="flex items-center justify-between p-2.5 bg-neutral-800/40 rounded-lg border border-neutral-700/40 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-neutral-400" />
                  <span>Permitir download do arquivo original</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowDownload}
                  onChange={(e) => setAllowDownload(e.target.checked)}
                  className="accent-amber-400 w-4 h-4"
                />
              </label>

              {/* Auth required toggle */}
              <label className="flex items-center justify-between p-2.5 bg-neutral-800/40 rounded-lg border border-neutral-700/40 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-neutral-400" />
                  <span>Exigir login na equipe para visualizar</span>
                </div>
                <input
                  type="checkbox"
                  checked={requireAuth}
                  onChange={(e) => setRequireAuth(e.target.checked)}
                  className="accent-amber-400 w-4 h-4"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-4 h-4" /> Link seguro criado com sucesso!
              </span>

              <div className="flex items-center gap-2 p-2 bg-neutral-950 border border-neutral-800 rounded-lg">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="flex-1 bg-transparent text-neutral-300 font-mono text-[11px] outline-none"
                />
                <button
                  onClick={handleCopy}
                  className="p-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded font-medium flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              <p className="text-[11px] text-neutral-400">
                Qualquer pessoa com este link poderá {allowDownload ? 'visualizar e baixar' : 'apenas visualizar'} o conteúdo selecionado.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
          <button
            onClick={() => setShareTarget(null)}
            className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
          >
            Fechar
          </button>
          {!generatedLink && (
            <button
              onClick={handleGenerateShare}
              disabled={isGenerating}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold rounded-lg shadow-sm"
            >
              Criar Link Seguro
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
