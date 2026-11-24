import { jsPDF } from 'jspdf';
import { BaptismFormSettings, BaptismRegistration } from '../types.js';

function formatDateBR(isoOrText?: string | null): string {
  const val = String(isoOrText || '').trim();
  if (!val) return '';
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]} / ${match[2]} / ${match[1]}`;
  }
  return val;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente de Análise',
  aprovado: 'Aprovado para Batismo',
  batizado: 'Batizado(a)',
  arquivado: 'Arquivado',
};

function drawLabeledBox(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number,
  h: number,
  multiline = false
) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);
  doc.text(label, x, y);

  const boxY = y + 2;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.35);
  doc.rect(x, boxY, w, h, 'FD');

  if (value && value.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    if (multiline) {
      const lines = doc.splitTextToSize(value.trim(), w - 6);
      doc.text(lines.slice(0, 4), x + 3, boxY + 5.5);
    } else {
      const truncated = doc.splitTextToSize(value.trim(), w - 6)[0] || '';
      doc.text(truncated, x + 3, boxY + h / 2 + 1.3);
    }
  }
}

function drawSectionHeading(doc: jsPDF, title: string, x: number, y: number, w: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text(title, x, y);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.5);
  doc.line(x, y + 2, x + w, y + 2);
}

export function drawBaptismFichaPage(
  doc: jsPDF,
  reg: BaptismRegistration,
  settings?: BaptismFormSettings | null,
  pageIndex = 0,
  totalPages = 1
) {
  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2;

  // Clean White Sheet Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Top Amber Brand Accent Bar + Dark Header Block (PT-B Mídia standard)
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 0, pageW, 3.5, 'F');

  doc.setFillColor(24, 24, 27);
  doc.rect(0, 3.5, pageW, 27, 'F');

  const churchTitle =
    settings?.churchTitle || 'IEADAM PETRÓPOLIS B · PT-B MÍDIA';
  const formTitle = settings?.formTitle || 'Ficha de Inscrição - Batismo nas Águas';
  const subtitle =
    settings?.subtitle || 'Uso exclusivo da Secretaria - Somente informações essenciais';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(245, 158, 11);
  doc.text(churchTitle, margin, 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(formTitle, margin, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(212, 212, 216);
  doc.text(subtitle, margin, 25.5);

  // Protocol & Status right-aligned in header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(251, 191, 36);
  doc.text(reg.protocolNumber || reg.id, pageW - margin, 11.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(228, 228, 231);
  doc.text(
    STATUS_LABELS[reg.status] || reg.status || 'Pendente',
    pageW - margin,
    25.5,
    { align: 'right' }
  );

  // =====================================
  // 1. DADOS DO CANDIDATO(A)
  // =====================================
  let y = 39;
  drawSectionHeading(doc, 'DADOS DO CANDIDATO(A)', margin, y, contentW);
  y += 7;

  // Nome Completo
  drawLabeledBox(doc, 'Nome Completo:', reg.fullName || '', margin, y, contentW, 9.5);
  y += 15;

  // Data de Nascimento | Idade | Sexo
  const birthW = 58;
  const ageW = 30;
  const gap = 6;
  const genderW = contentW - birthW - ageW - gap * 2;
  drawLabeledBox(
    doc,
    'Data de Nascimento:',
    formatDateBR(reg.birthDate),
    margin,
    y,
    birthW,
    9.5
  );
  drawLabeledBox(
    doc,
    'Idade:',
    reg.age ? `${reg.age} anos` : '',
    margin + birthW + gap,
    y,
    ageW,
    9.5
  );
  const sexLabel = `Sexo:  (${reg.gender === 'Masc.' ? 'X' : ' '}) Masc.   (${
    reg.gender === 'Fem.' ? 'X' : ' '
  }) Fem.`;
  drawLabeledBox(
    doc,
    sexLabel,
    reg.gender === 'Masc.'
      ? 'Masculino'
      : reg.gender === 'Fem.'
        ? 'Feminino'
        : '',
    margin + birthW + ageW + gap * 2,
    y,
    genderW,
    9.5
  );
  y += 15;

  // Telefone / WhatsApp | Congregação / Núcleo
  const halfW = (contentW - gap) / 2;
  drawLabeledBox(doc, 'Telefone / WhatsApp:', reg.phone || '', margin, y, halfW, 9.5);
  drawLabeledBox(
    doc,
    'Congregação / Núcleo:',
    reg.congregation || '',
    margin + halfW + gap,
    y,
    halfW,
    9.5
  );
  y += 15;

  // Endereço do Candidato
  drawLabeledBox(doc, 'Endereço:', reg.address || '', margin, y, contentW, 9.5);
  y += 15;

  // Nome do Responsável (se menor)
  drawLabeledBox(
    doc,
    'Nome do Responsável (se menor de 18 anos):',
    reg.guardianName || '',
    margin,
    y,
    contentW,
    9.5
  );
  y += 17;

  // =====================================
  // 2. DADOS ECLESIÁSTICOS
  // =====================================
  drawSectionHeading(doc, 'DADOS ECLESIÁSTICOS', margin, y, contentW);
  y += 7;

  drawLabeledBox(
    doc,
    'Data da Decisão / Conversão:',
    formatDateBR(reg.conversionDate),
    margin,
    y,
    halfW,
    9.5
  );
  const prevLabel = `Já foi batizado antes?  (${
    reg.previouslyBaptized === 'sim' ? 'X' : ' '
  }) Sim   (${reg.previouslyBaptized === 'nao' ? 'X' : ' '}) Não`;
  drawLabeledBox(
    doc,
    prevLabel,
    reg.previouslyBaptized === 'sim'
      ? 'Sim'
      : reg.previouslyBaptized === 'nao'
        ? 'Não'
        : '',
    margin + halfW + gap,
    y,
    halfW,
    9.5
  );
  y += 15;

  drawLabeledBox(
    doc,
    'Pastor / Dirigente que indicou:',
    reg.recommendingPastor || '',
    margin,
    y,
    contentW,
    9.5
  );
  y += 17;

  // =====================================
  // 3. DECLARAÇÃO
  // =====================================
  drawSectionHeading(doc, 'DECLARAÇÃO', margin, y, contentW);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  const declText =
    'Declaro que desejo me batizar nas águas, conforme minha fé e decisão pessoal, e estou ciente das orientações da igreja sobre o batismo.';
  const declLines = doc.splitTextToSize(declText, contentW);
  doc.text(declLines, margin, y);
  y += declLines.length * 4.3 + 4.5;

  const declCity = reg.declarationCity || 'Manaus / AM';
  const declDate = reg.declarationDate ? formatDateBR(reg.declarationDate) : '___ / ___ / _______';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${declCity}, ${declDate}`, margin, y);
  y += 14;

  // Assinaturas
  const sigW = (contentW - 14) / 2;
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.35);
  doc.line(margin, y, margin + sigW, y);
  doc.line(margin + sigW + 14, y, margin + sigW * 2 + 14, y);

  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('Assinatura do Candidato(a)', margin + sigW / 2, y + 4.5, { align: 'center' });
  doc.text('Assinatura do Responsável (se menor)', margin + sigW + 14 + sigW / 2, y + 4.5, {
    align: 'center',
  });
  y += 12;

  // =====================================
  // 4. USO EXCLUSIVO DA SECRETARIA
  // =====================================
  drawSectionHeading(doc, 'USO EXCLUSIVO DA SECRETARIA', margin, y, contentW);
  y += 7;

  const bapDateW = 58;
  const recByW = contentW - bapDateW - gap;
  drawLabeledBox(
    doc,
    'Data do Batismo:',
    formatDateBR(reg.baptismDate),
    margin,
    y,
    bapDateW,
    9.5
  );
  drawLabeledBox(
    doc,
    'Recebido por:',
    reg.receivedBy || '',
    margin + bapDateW + gap,
    y,
    recByW,
    9.5
  );
  y += 15.5;

  drawLabeledBox(
    doc,
    'Observações da Secretaria (opcional):',
    reg.secretaryNotes || '',
    margin,
    y,
    contentW,
    22,
    true
  );

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Nota de segurança: Sem CPF, RG, filiação, tipo sanguíneo ou dados financeiros.',
    margin,
    pageH - 12
  );
  doc.text(
    `Ficha ${pageIndex + 1} de ${totalPages} · Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    pageW - margin,
    pageH - 12,
    { align: 'right' }
  );
}

export function exportSingleBaptismFichaPDF(
  reg: BaptismRegistration,
  settings?: BaptismFormSettings | null
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  drawBaptismFichaPage(doc, reg, settings, 0, 1);
  const safeName = (reg.fullName || reg.protocolNumber || 'inscrito')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  doc.save(`Ficha_Batismo_${safeName || reg.id}.pdf`);
}

export function exportGeneralBaptismFichasPDF(
  registrations: BaptismRegistration[],
  settings?: BaptismFormSettings | null,
  filenameSuffix = 'Geral'
): void {
  if (!registrations || registrations.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  registrations.forEach((reg, idx) => {
    if (idx > 0) doc.addPage();
    drawBaptismFichaPage(doc, reg, settings, idx, registrations.length);
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`Fichas_Batismo_${filenameSuffix}_${dateStr}.pdf`);
}
