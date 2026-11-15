import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  Image as ImageIcon,
  Copy,
  Check,
  Edit3,
  Phone,
  Mail,
  Building,
  MapPin,
  Shield,
  Users,
  QrCode,
} from 'lucide-react';
import {
  AttendanceDepartment,
  AttendanceDepartmentKind,
  AttendanceMember,
} from '../../types.js';
import {
  exportMemberCredentialImage,
  exportMemberCredentialPDF,
  generateMemberQRCode,
  getMemberCredentialCode,
} from '../../utils/memberCredentialPdf.js';
import { useApp } from '../../context/AppContext.js';

interface MemberCredentialModalProps {
  member: AttendanceMember | null;
  department?: AttendanceDepartment;
  onClose: () => void;
  onEditMember?: (member: AttendanceMember) => void;
}

const KIND_LABELS: Record<AttendanceDepartmentKind, string> = {
  departamento: 'Departamento',
  ministerio: 'Ministério',
  equipe: 'Equipe',
};

export const MemberCredentialModal: React.FC<MemberCredentialModalProps> = ({
  member,
  department,
  onClose,
  onEditMember,
}) => {
  const { notify } = useApp();
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [downloadingImage, setDownloadingImage] = useState(false);

  useEffect(() => {
    let active = true;
    if (!member) {
      setQrUrl('');
      return;
    }
    generateMemberQRCode(member, department)
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch(() => {
        if (active) setQrUrl('');
      });
    return () => {
      active = false;
    };
  }, [member, department]);

  if (!member) return null;

  const code = getMemberCredentialCode(member);
  const kindLabel = department ? KIND_LABELS[department.kind] : 'Grupo';
  const initials = member.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    notify('Código da credencial copiado!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    try {
      await exportMemberCredentialPDF(member, department);
      notify(`Credencial PDF de ${member.name} baixada!`, 'success');
    } catch {
      notify('Erro ao gerar credencial em PDF.', 'error');
    }
  };

  const handleDownloadImage = async () => {
    try {
      setDownloadingImage(true);
      await exportMemberCredentialImage(member, department);
      notify(`Imagem da credencial de ${member.name} baixada!`, 'success');
    } catch {
      notify('Erro ao gerar imagem da credencial.', 'error');
    } finally {
      setDownloadingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-neutral-100 truncate">
                Credencial Oficial do Membro
              </h3>
              <p className="text-[11px] text-neutral-400 truncate">
                IEADAM Petrópolis B · Chamada Automática por QR Code
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Fechar credencial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Credential Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Digital Badge Hero */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            {/* Member Information */}
            <div className="flex-1 min-w-0 w-full space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold text-base flex items-center justify-center shrink-0">
                  {initials || 'MB'}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base sm:text-lg font-bold text-neutral-100 truncate">
                    {member.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5 flex-wrap">
                    <span className="text-amber-400 font-semibold">
                      {department?.name || 'Geral'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{kindLabel}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl">
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-neutral-400">
                    Código da Credencial
                  </div>
                  <div className="text-xs font-mono tabular-nums font-bold text-emerald-400 truncate">
                    {code}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <div className="flex items-start gap-2">
                  <Shield className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-neutral-400">Função / Cargo</div>
                    <div className="font-semibold text-neutral-100 truncate">
                      {member.roleTitle || department?.name || 'Membro Ativo'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Phone className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-neutral-400">Telefone</div>
                    <div className="font-semibold font-mono tabular-nums text-neutral-100 truncate">
                      {member.phone || 'Não informado'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Building className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-neutral-400">Congregação</div>
                    <div className="font-semibold text-neutral-100 truncate">
                      {member.congregation || 'IEADAM Petrópolis B'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-neutral-400">Área / Setor</div>
                    <div className="font-semibold text-neutral-100 truncate">
                      {member.area || 'Sede / Geral'}
                    </div>
                  </div>
                </div>

                {member.email && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <Mail className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] text-neutral-400">E-mail</div>
                      <div className="font-semibold text-neutral-100 truncate">
                        {member.email}
                      </div>
                    </div>
                  </div>
                )}

                {member.notes && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <Users className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11px] text-neutral-400">Observações</div>
                      <div className="text-neutral-300 leading-relaxed">{member.notes}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Crisp White QR Box */}
            <div className="w-44 shrink-0 bg-white rounded-2xl p-3 text-center shadow-lg">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`QR Code de ${member.name}`}
                  className="w-full aspect-square object-contain"
                />
              ) : (
                <div className="w-full aspect-square bg-neutral-100 animate-pulse rounded-lg" />
              )}
              <div className="mt-2 pt-2 border-t border-neutral-200">
                <div className="text-[10px] font-bold text-neutral-900">
                  CHAMADA AUTOMÁTICA
                </div>
                <div className="text-[10px] text-neutral-500 leading-tight mt-0.5">
                  Leia no painel da chamada
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {onEditMember ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditMember(member);
                }}
                className="min-h-[40px] px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl border border-neutral-700 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Editar Dados</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={downloadingImage}
                onClick={handleDownloadImage}
                className="min-h-[40px] px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-60 text-neutral-100 text-xs font-semibold rounded-xl border border-neutral-700 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>{downloadingImage ? 'Gerando...' : 'Baixar Imagem'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="min-h-[40px] px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Credencial PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
