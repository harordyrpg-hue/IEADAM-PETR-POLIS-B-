import { jsPDF } from 'jspdf';
import {
  AttendanceCall,
  AttendanceDepartment,
  AttendanceDepartmentKind,
  AttendanceEntry,
  AttendanceMember,
} from '../types.js';

const CHURCH_NAME = 'IEADAM PETRÓPOLIS B';
const MINISTRY_SUBTITLE = 'CONTROLE DE CHAMADA, PRESENÇAS & FALTAS';

const KIND_LABELS: Record<AttendanceDepartmentKind, string> = {
  departamento: 'Departamento',
  ministerio: 'Ministério',
  equipe: 'Equipe',
};

export function formatAttendanceDateBR(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export interface DepartmentExportGroup {
  department: AttendanceDepartment;
  members: {
    member: AttendanceMember;
    entry?: AttendanceEntry;
  }[];
  presentCount: number;
  absentCount: number;
  unmarkedCount: number;
}

export interface AttendanceExportParams {
  date: string;
  callTitle: string;
  groups: DepartmentExportGroup[];
  totals: {
    totalIncluded: number;
    presentCount: number;
    absentCount: number;
    unmarkedCount: number;
  };
  responsibleUserName: string;
  call?: AttendanceCall | null;
}

function getAbsenceJustificationText(entry: AttendanceEntry): string {
  if (entry.noJustification) {
    return 'Não apresentou justificativa';
  }
  return entry.justification?.trim() || 'Não apresentou justificativa';
}

/**
 * 1. OFFICIAL PDF EXPORT: Grouped by Department/Ministry/Team
 * - Only absent members display justification (in red)
 * - Shows responsible user who marked presence/absence
 */
export function exportAttendancePDF({
  date,
  callTitle,
  groups,
  totals,
  responsibleUserName,
}: AttendanceExportParams) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage();
      y = 16;
      doc.setFillColor(217, 119, 6);
      doc.rect(0, 0, pageWidth, 4, 'F');
    }
  };

  // Top Header Strip
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 0, pageWidth, 5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(23, 23, 23);
  doc.text(CHURCH_NAME, margin, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(MINISTRY_SUBTITLE, margin, y);

  const now = new Date();
  doc.setFontSize(7.5);
  doc.text(
    `Emitido em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    pageWidth - margin,
    y,
    { align: 'right' }
  );

  y += 5;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Title Banner
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(245, 158, 11);
  doc.text(`LISTA DE CHAMADA — ${(callTitle || 'CHAMADA GERAL').toUpperCase()}`, margin + 5, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(229, 231, 235);
  doc.text(
    `Responsável pela chamada: ${responsibleUserName}`,
    margin + 5,
    y + 12.2
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`DATA: ${formatAttendanceDateBR(date)}`, pageWidth - margin - 5, y + 9.5, {
    align: 'right',
  });

  y += 21;

  // Overall Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

  const boxW = contentWidth / 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('MEMBROS NA CHAMADA', margin + 4, y + 6.5);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totals.totalIncluded}`, margin + 4, y + 14.5);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL DE PRESENÇAS', margin + boxW + 4, y + 6.5);
  doc.setFontSize(12);
  doc.setTextColor(22, 163, 74);
  doc.text(`${totals.presentCount}`, margin + boxW + 4, y + 14.5);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL DE FALTAS', margin + boxW * 2 + 4, y + 6.5);
  doc.setFontSize(12);
  doc.setTextColor(220, 38, 38);
  doc.text(`${totals.absentCount}`, margin + boxW * 2 + 4, y + 14.5);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('SEM MARCAÇÃO', margin + boxW * 3 + 4, y + 6.5);
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(`${totals.unmarkedCount}`, margin + boxW * 3 + 4, y + 14.5);

  y += 26;

  // Department Sections
  for (const group of groups) {
    if (group.members.length === 0) continue;

    ensureSpace(22);

    // Department Header
    doc.setFillColor(39, 39, 42);
    doc.roundedRect(margin, y, contentWidth, 9, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(251, 191, 36);
    const kindLabel = KIND_LABELS[group.department.kind] || 'Departamento';
    doc.text(
      `${group.department.name.toUpperCase()} (${kindLabel})`,
      margin + 4,
      y + 6
    );

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(
      `Presenças: ${group.presentCount}   |   Faltas: ${group.absentCount}   |   Total: ${group.members.length}`,
      pageWidth - margin - 4,
      y + 6,
      { align: 'right' }
    );

    y += 11;

    // Member Rows inside this department
    group.members.forEach(({ member, entry }, idx) => {
      const isAbsent = entry?.status === 'falta';
      const isPresent = entry?.status === 'presente';
      const justifText = isAbsent && entry ? getAbsenceJustificationText(entry) : '';
      const wrappedJustif = isAbsent
        ? doc.splitTextToSize(`Justificativa: ${justifText}`, contentWidth - 10)
        : [];
      const rowHeight = isAbsent ? 10 + wrappedJustif.length * 3.8 : 8.5;

      ensureSpace(rowHeight + 2);

      if (isAbsent) {
        // Highlight absent member in RED
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(252, 165, 165);
        doc.roundedRect(margin, y, contentWidth, rowHeight, 1, 1, 'FD');

        doc.setFillColor(220, 38, 38);
        doc.rect(margin, y, 2.2, rowHeight, 'F');
      } else {
        doc.setFillColor(idx % 2 === 0 ? 255 : 249, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 251);
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(margin, y, contentWidth, rowHeight, 1, 1, 'FD');
      }

      // Member Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      if (isAbsent) {
        doc.setTextColor(185, 28, 28);
      } else {
        doc.setTextColor(23, 23, 23);
      }
      doc.text(`${idx + 1}. ${member.name}`, margin + 4.5, y + 5.5);

      // Marked by user (center-right)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      const markedByLabel = entry?.markedByName
        ? `Marcado por: ${entry.markedByName}`
        : 'Aguardando marcação';
      doc.text(markedByLabel, pageWidth - margin - 34, y + 5.5, { align: 'right' });

      // Status text on far right
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      if (isPresent) {
        doc.setTextColor(22, 163, 74);
        doc.text('PRESENTE', pageWidth - margin - 4, y + 5.5, { align: 'right' });
      } else if (isAbsent) {
        doc.setTextColor(220, 38, 38);
        doc.text('FALTA', pageWidth - margin - 4, y + 5.5, { align: 'right' });
      } else {
        doc.setTextColor(148, 163, 184);
        doc.text('PENDENTE', pageWidth - margin - 4, y + 5.5, { align: 'right' });
      }

      // ONLY absent members display justification in red!
      if (isAbsent && wrappedJustif.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(185, 28, 28);
        doc.text(wrappedJustif, margin + 5.5, y + 9.8);
      }

      y += rowHeight + 1.5;
    });

    y += 4;
  }

  // Footer
  ensureSpace(12);
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(115, 115, 115);
  doc.text(
    `${CHURCH_NAME} · Documento de Chamada de Membros · Emitido por ${responsibleUserName}`,
    pageWidth / 2,
    pageHeight - 9,
    { align: 'center' }
  );

  doc.save(`chamada_${date}.pdf`);
}

/**
 * 2. HIGH-RESOLUTION IMAGE (PNG) EXPORT: Grouped by Department/Ministry/Team
 * - Separated by department with totals of presenças and faltas
 * - Absent members highlighted in RED with justification
 * - Present members DO NOT show justification
 * - Responsible user displayed cleanly
 */
export async function exportAttendanceImage({
  date,
  callTitle,
  groups,
  totals,
  responsibleUserName,
}: AttendanceExportParams): Promise<void> {
  const width = 1240;
  const margin = 52;
  const contentWidth = width - margin * 2;
  const activeGroups = groups.filter((g) => g.members.length > 0);

  // Pre-calculate exact dynamic height so nothing gets clipped
  let estimatedHeight = 360;
  for (const group of activeGroups) {
    estimatedHeight += 74; // Department header + spacing
    for (const item of group.members) {
      estimatedHeight += item.entry?.status === 'falta' ? 88 : 56;
    }
    estimatedHeight += 24;
  }
  estimatedHeight += 90; // Footer space

  const height = Math.max(760, estimatedHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Falha ao inicializar canvas');

  // Dark slate clean background
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, width, height);

  // Top amber accent bar
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, width, 10);

  let y = 58;

  // Header
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(CHURCH_NAME, margin, y);

  y += 38;
  ctx.fillStyle = '#f4f4f5';
  ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(`Chamada: ${callTitle || 'Chamada Geral'}`, margin, y);

  // Date & Responsible User on right
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(formatAttendanceDateBR(date), width - margin, y - 10);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(`Responsável: ${responsibleUserName}`, width - margin, y + 20);
  ctx.textAlign = 'left';

  y += 28;
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(MINISTRY_SUBTITLE, margin, y);

  y += 32;

  // 4-Column Overall Summary Strip
  const gap = 16;
  const kpiW = (contentWidth - gap * 3) / 4;
  const kpis = [
    { label: 'NA CHAMADA', value: String(totals.totalIncluded), color: '#f4f4f5', border: '#27272a' },
    { label: 'PRESENÇAS', value: String(totals.presentCount), color: '#34d399', border: '#065f46' },
    { label: 'FALTAS', value: String(totals.absentCount), color: '#f87171', border: '#7f1d1d' },
    { label: 'SEM MARCAÇÃO', value: String(totals.unmarkedCount), color: '#a1a1aa', border: '#27272a' },
  ];

  kpis.forEach((kpi, idx) => {
    const x = margin + idx * (kpiW + gap);
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.roundRect(x, y, kpiW, 88, 12);
    ctx.fill();
    ctx.strokeStyle = kpi.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#a1a1aa';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(kpi.label, x + 18, y + 30);

    ctx.fillStyle = kpi.color;
    ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(kpi.value, x + 18, y + 70);
  });

  y += 120;

  // Groups by Department / Ministry / Team
  for (const group of activeGroups) {
    // Dept Header Bar
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.roundRect(margin, y, contentWidth, 52, 10);
    ctx.fill();
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1;
    ctx.stroke();

    const kindLabel = KIND_LABELS[group.department.kind] || 'Departamento';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`${group.department.name} · ${kindLabel}`, margin + 20, y + 33);

    ctx.textAlign = 'right';
    ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillStyle = '#34d399';
    const presText = `${group.presentCount} Presença(s)`;
    const absText = `${group.absentCount} Falta(s)`;
    const presWidth = ctx.measureText(presText).width;
    ctx.fillStyle = '#f87171';
    ctx.fillText(absText, width - margin - 20, y + 33);
    const absWidth = ctx.measureText(absText).width;
    ctx.fillStyle = '#71717a';
    ctx.fillText('  |  ', width - margin - 20 - absWidth, y + 33);
    const sepWidth = ctx.measureText('  |  ').width;
    ctx.fillStyle = '#34d399';
    ctx.fillText(presText, width - margin - 20 - absWidth - sepWidth, y + 33);
    void presWidth;
    ctx.textAlign = 'left';

    y += 62;

    for (let i = 0; i < group.members.length; i++) {
      const { member, entry } = group.members[i];
      const isAbsent = entry?.status === 'falta';
      const isPresent = entry?.status === 'presente';
      const rowH = isAbsent ? 78 : 48;

      if (isAbsent) {
        ctx.fillStyle = '#2a1215';
        ctx.beginPath();
        ctx.roundRect(margin, y, contentWidth, rowH, 8);
        ctx.fill();
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Red left strip inside card
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(margin, y, 7, rowH, [8, 0, 0, 8]);
        ctx.fill();
      } else {
        ctx.fillStyle = '#121215';
        ctx.beginPath();
        ctx.roundRect(margin, y, contentWidth, rowH, 8);
        ctx.fill();
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Member name
      ctx.fillStyle = isAbsent ? '#fca5a5' : '#f4f4f5';
      ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(`${i + 1}. ${member.name}`, margin + 20, y + 30);

      // Marked by user + Status on right
      ctx.textAlign = 'right';
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      const markerText = entry?.markedByName ? `Marcado por: ${entry.markedByName}` : 'Sem marcação';
      ctx.fillText(markerText, width - margin - 140, y + 30);

      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      if (isPresent) {
        ctx.fillStyle = '#34d399';
        ctx.fillText('PRESENTE', width - margin - 20, y + 30);
      } else if (isAbsent) {
        ctx.fillStyle = '#f87171';
        ctx.fillText('FALTA', width - margin - 20, y + 30);
      } else {
        ctx.fillStyle = '#71717a';
        ctx.fillText('PENDENTE', width - margin - 20, y + 30);
      }
      ctx.textAlign = 'left';

      // ONLY absent members display justification in RED!
      if (isAbsent && entry) {
        const justif = getAbsenceJustificationText(entry);
        ctx.fillStyle = '#fca5a5';
        ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(`Justificativa: ${justif}`.substring(0, 105), margin + 20, y + 58);
      }

      y += rowH + 8;
    }

    y += 20;
  }

  // Footer
  ctx.fillStyle = '#71717a';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${CHURCH_NAME} · Chamada Oficial de Membros · Usuário Responsável: ${responsibleUserName}`,
    width / 2,
    height - 32
  );

  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const link = document.createElement('a');
  link.download = `chamada_${date}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
