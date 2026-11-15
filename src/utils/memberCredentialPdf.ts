import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  AttendanceDepartment,
  AttendanceDepartmentKind,
  AttendanceMember,
} from '../types.js';

const CHURCH_NAME = 'IEADAM PETRÓPOLIS B';
const SYSTEM_SUBTITLE = 'CREDENCIAL OFICIAL DE MEMBRO · CONTROLE DE CHAMADA';

const KIND_LABELS: Record<AttendanceDepartmentKind, string> = {
  departamento: 'Departamento',
  ministerio: 'Ministério',
  equipe: 'Equipe',
};

export function getMemberCredentialCode(member: AttendanceMember): string {
  if (member.memberCode && member.memberCode.trim()) {
    return member.memberCode.trim().toUpperCase();
  }
  const cleanId = member.id.replace(/^mem_/, '').replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
  return `PTB-MEM-${cleanId}`;
}

export async function generateMemberQRCode(
  member: AttendanceMember,
  department?: AttendanceDepartment | null
): Promise<string> {
  const code = getMemberCredentialCode(member);
  const payload = {
    tipo: 'PTB_MEMBRO',
    id: member.id,
    codigo: code,
    nome: member.name,
    categoria: department?.name || 'Geral',
    tipoCategoria: department ? KIND_LABELS[department.kind] : 'Membro',
    cargo: member.roleTitle || '',
    telefone: member.phone || '',
    congregacao: member.congregation || 'IEADAM Petrópolis B',
    area: member.area || 'Geral',
  };

  try {
    return await QRCode.toDataURL(JSON.stringify(payload), {
      width: 440,
      margin: 1.5,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch {
    return await QRCode.toDataURL(`PTB-MEMBRO:${member.id}:${code}:${member.name}`, {
      width: 440,
      margin: 1,
    });
  }
}

function drawCredentialCardOnPdf(
  doc: jsPDF,
  member: AttendanceMember,
  department: AttendanceDepartment | undefined,
  qrDataUrl: string,
  startY: number
) {
  const pageWidth = 210;
  const margin = 16;
  const cardW = pageWidth - margin * 2;
  const cardH = 114;
  const code = getMemberCredentialCode(member);
  const kindLabel = department ? KIND_LABELS[department.kind] : 'Membro';

  // Card Container
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(212, 212, 216);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, startY, cardW, cardH, 3, 3, 'FD');

  // Dark Header Band inside Card
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(margin, startY, cardW, 20, 3, 3, 'F');
  doc.rect(margin, startY + 12, cardW, 8, 'F');

  // Top Amber Accent
  doc.setFillColor(245, 158, 11);
  doc.rect(margin, startY, cardW, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(251, 191, 36);
  doc.text(CHURCH_NAME, margin + 6, startY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(212, 212, 216);
  doc.text(SYSTEM_SUBTITLE, margin + 6, startY + 15.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(52, 211, 153);
  doc.text(code, pageWidth - margin - 6, startY + 12.5, { align: 'right' });

  // Left Info Column
  const infoX = margin + 7;
  const col2X = margin + 64;
  const rightQrW = 48;
  const infoMaxW = cardW - rightQrW - 18;
  let py = startY + 30;

  // Member Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text('MEMBRO / INTEGRANTE:', infoX, py);
  py += 5.5;

  doc.setFontSize(13.5);
  doc.setTextColor(24, 24, 27);
  const nameLines = doc.splitTextToSize(member.name, infoMaxW);
  doc.text(nameLines.slice(0, 2), infoX, py);
  py += nameLines.slice(0, 2).length > 1 ? 11 : 7.5;

  // Category & Role
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text(`${kindLabel.toUpperCase()}:`, infoX, py);
  doc.text('FUNÇÃO / CARGO:', col2X, py);
  py += 4.5;

  doc.setFontSize(9.5);
  doc.setTextColor(217, 119, 6);
  doc.text(department?.name || 'Geral', infoX, py);
  doc.setTextColor(24, 24, 27);
  doc.text(member.roleTitle || department?.name || 'Membro Ativo', col2X, py);
  py += 8.5;

  // Congregation & Area
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text('CONGREGAÇÃO:', infoX, py);
  doc.text('ÁREA / SETOR:', col2X, py);
  py += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(39, 39, 42);
  doc.text(member.congregation || 'IEADAM Petrópolis B', infoX, py);
  doc.text(member.area || 'Sede / Geral', col2X, py);
  py += 8.5;

  // Phone & Email
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text('TELEFONE / WHATSAPP:', infoX, py);
  doc.text('E-MAIL:', col2X, py);
  py += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(39, 39, 42);
  doc.text(member.phone || 'Não informado', infoX, py);
  doc.text(member.email || 'Não informado', col2X, py);

  // Right QR Code Container
  const qrBoxX = margin + cardW - rightQrW - 6;
  const qrBoxY = startY + 26;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(228, 228, 231);
  doc.roundedRect(qrBoxX, qrBoxY, rightQrW, 66, 2, 2, 'FD');

  doc.addImage(qrDataUrl, 'PNG', qrBoxX + 4, qrBoxY + 4, 40, 40);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(24, 24, 27);
  doc.text('CHAMADA AUTOMÁTICA', qrBoxX + rightQrW / 2, qrBoxY + 50.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(113, 113, 122);
  doc.text('Aponte no leitor QR da chamada', qrBoxX + rightQrW / 2, qrBoxY + 55.5, {
    align: 'center',
  });
  doc.text('para confirmar sua presença.', qrBoxX + rightQrW / 2, qrBoxY + 59.5, {
    align: 'center',
  });

  // Footer strip inside card
  doc.setDrawColor(244, 244, 245);
  doc.line(margin + 6, startY + cardH - 13, pageWidth - margin - 6, startY + cardH - 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(113, 113, 122);
  doc.text(
    'Credencial pessoal e intransferível · IEADAM Petrópolis B · Sistema de Chamada Digital',
    margin + 6,
    startY + cardH - 6.5
  );
}

/**
 * Exports a single member's official credential PDF with QR code
 */
export async function exportMemberCredentialPDF(
  member: AttendanceMember,
  department?: AttendanceDepartment
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const qrDataUrl = await generateMemberQRCode(member, department);
  drawCredentialCardOnPdf(doc, member, department, qrDataUrl, 22);

  // Helpful cut line below card
  doc.setDrawColor(209, 213, 219);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(16, 146, 194, 146);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('Recorte na linha pontilhada para plastificar ou guardar como crachá', 105, 151, {
    align: 'center',
  });

  const safeName = member.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`credencial_${safeName}.pdf`);
}

/**
 * Batch exports multiple member credentials (2 cards per A4 page)
 */
export async function exportBatchMemberCredentialsPDF(
  membersList: AttendanceMember[],
  departments: AttendanceDepartment[],
  fileNameSuffix = 'todos'
): Promise<void> {
  if (membersList.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const deptMap = new Map(departments.map((d) => [d.id, d]));

  for (let i = 0; i < membersList.length; i++) {
    if (i > 0 && i % 2 === 0) {
      doc.addPage();
    }
    const member = membersList[i];
    const dept = deptMap.get(member.departmentId);
    const qrDataUrl = await generateMemberQRCode(member, dept);
    const yOffset = i % 2 === 0 ? 18 : 150;
    drawCredentialCardOnPdf(doc, member, dept, qrDataUrl, yOffset);

    if (i % 2 === 0) {
      doc.setDrawColor(228, 228, 231);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(16, 140, 194, 140);
      doc.setLineDashPattern([], 0);
    }
  }

  const safeSuffix = fileNameSuffix.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`credenciais_membros_${safeSuffix}.pdf`);
}

/**
 * Exports a crisp PNG image of a member's credential (easy to send via WhatsApp)
 */
export async function exportMemberCredentialImage(
  member: AttendanceMember,
  department?: AttendanceDepartment
): Promise<void> {
  const qrDataUrl = await generateMemberQRCode(member, department);
  const code = getMemberCredentialCode(member);
  const kindLabel = department ? KIND_LABELS[department.kind] : 'Membro';

  const width = 1080;
  const height = 640;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Falha ao inicializar canvas');

  // Card dark background
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, width, height);

  // Outer subtle border
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  // Top amber bar
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(18, 18, width - 36, 12);

  // Header text
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(CHURCH_NAME, 56, 78);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(SYSTEM_SUBTITLE, 56, 108);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(code, width - 56, 86);
  ctx.textAlign = 'left';

  // Divider
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(56, 134);
  ctx.lineTo(width - 56, 134);
  ctx.stroke();

  // Member Name
  ctx.fillStyle = '#a1a1aa';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('MEMBRO / INTEGRANTE', 56, 182);

  ctx.fillStyle = '#fafafa';
  ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(member.name.slice(0, 28), 56, 232);

  // Details grid on left
  const drawField = (label: string, val: string, x: number, y: number, color = '#f4f4f5') => {
    ctx.fillStyle = '#71717a';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(label, x, y);
    ctx.fillStyle = color;
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(val.slice(0, 26), x, y + 30);
  };

  drawField(kindLabel.toUpperCase(), department?.name || 'Geral', 56, 298, '#fbbf24');
  drawField('FUNÇÃO / CARGO', member.roleTitle || department?.name || 'Membro Ativo', 370, 298);
  drawField('CONGREGAÇÃO', member.congregation || 'IEADAM Petrópolis B', 56, 396);
  drawField('ÁREA / SETOR', member.area || 'Sede / Geral', 370, 396);
  drawField('TELEFONE / WHATSAPP', member.phone || 'Não informado', 56, 494);

  // White QR Box on right
  const qrBoxX = width - 356;
  const qrBoxY = 172;
  const qrBoxW = 300;
  const qrBoxH = 368;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 16);
  ctx.fill();

  const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = qrDataUrl;
  });

  ctx.drawImage(qrImg, qrBoxX + 25, qrBoxY + 22, 250, 250);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#18181b';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('CHAMADA AUTOMÁTICA', qrBoxX + qrBoxW / 2, qrBoxY + 306);

  ctx.fillStyle = '#52525b';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('Apresente este QR Code', qrBoxX + qrBoxW / 2, qrBoxY + 332);
  ctx.fillText('na chegada para confirmar presença', qrBoxX + qrBoxW / 2, qrBoxY + 352);

  // Footer note
  ctx.textAlign = 'left';
  ctx.fillStyle = '#71717a';
  ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(
    'IEADAM Petrópolis B · Credencial Oficial para Sistema de Chamada Digital',
    56,
    height - 46
  );

  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const link = document.createElement('a');
  const safeName = member.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  link.download = `credencial_${safeName}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
