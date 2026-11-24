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
  const rawSubtitle = settings?.subtitle || '';
  const subtitle =
    !rawSubtitle || /uso exclusivo da secretaria/i.test(rawSubtitle)
      ? 'Ficha oficial de inscrição para o Batismo nas Águas'
      : rawSubtitle;

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
  let y = 37;
  drawSectionHeading(doc, 'DADOS DO CANDIDATO(A)', margin, y, contentW);
  y += 6.5;

  const boxH = 8;
  const rowStep = 13;
  const gap = 5;
  const halfW = (contentW - gap) / 2;

  // Row 1: Nome Completo
  drawLabeledBox(doc, 'Nome Completo:', reg.fullName || '', margin, y, contentW, boxH);
  y += rowStep;

  // Row 2: CPF | Data de Nascimento | Idade | Sexo
  const cpfW = 50;
  const birthW = 44;
  const ageW = 24;
  const genderW = contentW - cpfW - birthW - ageW - gap * 3;
  drawLabeledBox(doc, 'CPF:', reg.cpf || '', margin, y, cpfW, boxH);
  drawLabeledBox(
    doc,
    'Data de Nascimento:',
    formatDateBR(reg.birthDate),
    margin + cpfW + gap,
    y,
    birthW,
    boxH
  );
  drawLabeledBox(
    doc,
    'Idade:',
    reg.age ? `${reg.age} anos` : '',
    margin + cpfW + birthW + gap * 2,
    y,
    ageW,
    boxH
  );
  const sexLabel = `Sexo: (${reg.gender === 'Masc.' ? 'X' : ' '})M (${
    reg.gender === 'Fem.' ? 'X' : ' '
  })F`;
  drawLabeledBox(
    doc,
    sexLabel,
    reg.gender === 'Masc.'
      ? 'Masculino'
      : reg.gender === 'Fem.'
        ? 'Feminino'
        : '',
    margin + cpfW + birthW + ageW + gap * 3,
    y,
    genderW,
    boxH
  );
  y += rowStep;

  // Row 3: Naturalidade | Estado Civil | Nome do Cônjuge (se casado)
  const natW = 54;
  const maritalW = 38;
  const spouseW = contentW - natW - maritalW - gap * 2;
  drawLabeledBox(doc, 'Naturalidade:', reg.naturalidade || '', margin, y, natW, boxH);
  drawLabeledBox(
    doc,
    'Estado Civil:',
    reg.maritalStatus || '',
    margin + natW + gap,
    y,
    maritalW,
    boxH
  );
  drawLabeledBox(
    doc,
    'Nome do Cônjuge (se casado):',
    reg.spouseName || '',
    margin + natW + maritalW + gap * 2,
    y,
    spouseW,
    boxH
  );
  y += rowStep;

  // Row 4: Nome da Mãe | Nome do Pai (opcional)
  drawLabeledBox(doc, 'Nome da Mãe:', reg.motherName || '', margin, y, halfW, boxH);
  drawLabeledBox(
    doc,
    'Nome do Pai (opcional):',
    reg.fatherName || '',
    margin + halfW + gap,
    y,
    halfW,
    boxH
  );
  y += rowStep;

  // Row 5: Telefone / WhatsApp | Congregação / Núcleo
  const phoneW = 52;
  const congW = contentW - phoneW - gap;
  drawLabeledBox(doc, 'Telefone / WhatsApp:', reg.phone || '', margin, y, phoneW, boxH);
  drawLabeledBox(
    doc,
    'Congregação / Núcleo:',
    reg.congregation || '',
    margin + phoneW + gap,
    y,
    congW,
    boxH
  );
  y += rowStep;

  // Row 6: CEP | Endereço
  const cepW = 36;
  const addrW = contentW - cepW - gap;
  drawLabeledBox(doc, 'CEP:', reg.cep || '', margin, y, cepW, boxH);
  drawLabeledBox(
    doc,
    'Endereço:',
    reg.address || '',
    margin + cepW + gap,
    y,
    addrW,
    boxH
  );
  y += rowStep;

  // Row 7: Nome do Responsável (se menor)
  drawLabeledBox(
    doc,
    'Nome do Responsável (se menor de 18 anos):',
    reg.guardianName || '',
    margin,
    y,
    contentW,
    boxH
  );
  y += 14.5;

  // =====================================
  // 2. DADOS ECLESIÁSTICOS
  // =====================================
  drawSectionHeading(doc, 'DADOS ECLESIÁSTICOS', margin, y, contentW);
  y += 6.5;

  drawLabeledBox(
    doc,
    'Data da Decisão / Conversão:',
    formatDateBR(reg.conversionDate),
    margin,
    y,
    halfW,
    boxH
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
    boxH
  );
  y += rowStep;

  drawLabeledBox(
    doc,
    'Pastor / Dirigente que indicou:',
    reg.recommendingPastor || '',
    margin,
    y,
    contentW,
    boxH
  );
  y += 14.5;

  // =====================================
  // 3. DECLARAÇÃO
  // =====================================
  drawSectionHeading(doc, 'DECLARAÇÃO', margin, y, contentW);
  y += 6.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(31, 41, 55);
  const declText =
    'Declaro que desejo me batizar nas águas, conforme minha fé e decisão pessoal, e estou ciente das orientações da igreja sobre o batismo.';
  const declLines = doc.splitTextToSize(declText, contentW);
  doc.text(declLines, margin, y);
  y += declLines.length * 4.1 + 3.5;

  const declCity = reg.declarationCity || 'Manaus / AM';
  const declDate = reg.declarationDate ? formatDateBR(reg.declarationDate) : '___ / ___ / _______';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.text(`${declCity}, ${declDate}`, margin, y);
  y += 12;

  // Assinaturas
  const sigW = (contentW - 14) / 2;
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.35);
  doc.line(margin, y, margin + sigW, y);
  doc.line(margin + sigW + 14, y, margin + sigW * 2 + 14, y);

  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  doc.text('Assinatura do Candidato(a)', margin + sigW / 2, y + 4.2, { align: 'center' });
  doc.text('Assinatura do Responsável (se menor)', margin + sigW + 14 + sigW / 2, y + 4.2, {
    align: 'center',
  });
  y += 10.5;

  // =====================================
  // 4. REGISTRO DA SECRETARIA
  // =====================================
  drawSectionHeading(doc, 'REGISTRO DA SECRETARIA', margin, y, contentW);
  y += 6.5;

  const bapDateW = 58;
  const recByW = contentW - bapDateW - gap;
  drawLabeledBox(
    doc,
    'Data do Batismo:',
    formatDateBR(reg.baptismDate),
    margin,
    y,
    bapDateW,
    boxH
  );
  drawLabeledBox(
    doc,
    'Recebido por:',
    reg.receivedBy || '',
    margin + bapDateW + gap,
    y,
    recByW,
    boxH
  );
  y += rowStep + 0.5;

  drawLabeledBox(
    doc,
    'Observações da Secretaria (opcional):',
    reg.secretaryNotes || '',
    margin,
    y,
    contentW,
    18,
    true
  );

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Documento oficial da Direção e Secretaria — IEADAM Petrópolis B',
    margin,
    pageH - 10
  );
  doc.text(
    `Ficha ${pageIndex + 1} de ${totalPages} · Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    pageW - margin,
    pageH - 10,
    { align: 'right' }
  );
}

function savePdfSafely(doc: jsPDF, filename: string): void {
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  if (!isIOS) {
    doc.save(filename);
    return;
  }

  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        link.remove();
        URL.revokeObjectURL(url);
      } catch {}
    }, 8000);
  } catch {
    doc.save(filename);
  }
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
  savePdfSafely(doc, `Ficha_Batismo_${safeName || reg.id}.pdf`);
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
  savePdfSafely(doc, `Fichas_Batismo_${filenameSuffix}_${dateStr}.pdf`);
}
