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

function drawWavePolygon(
  doc: jsPDF,
  baseY: number,
  bottomY: number,
  pageW: number,
  amp: number,
  freq: number,
  phase: number,
  color: [number, number, number]
) {
  const steps = 60;
  const waveY = (x: number) =>
    baseY + Math.sin((x / pageW) * Math.PI * freq + phase) * amp;

  const segments: number[][] = [];
  const startTop = waveY(0);
  segments.push([0, startTop - bottomY]);

  let prevX = 0;
  let prevY = startTop;
  for (let i = 1; i <= steps; i++) {
    const cx = (i / steps) * pageW;
    const cy = waveY(cx);
    segments.push([cx - prevX, cy - prevY]);
    prevX = cx;
    prevY = cy;
  }
  segments.push([0, bottomY - prevY]);

  doc.setFillColor(color[0], color[1], color[2]);
  doc.lines(segments, 0, bottomY, [1, 1], 'F', true);
}

function drawBaptismEmblem(doc: jsPDF, cx: number, cy: number) {
  // Outer sky ring
  doc.setFillColor(56, 189, 248);
  doc.circle(cx, cy, 8.2, 'F');
  // Deep ocean inner circle
  doc.setFillColor(8, 47, 73);
  doc.circle(cx, cy, 7.1, 'F');

  // Stylized water waves inside bottom half of emblem
  doc.setFillColor(14, 165, 233);
  doc.ellipse(cx, cy + 3.2, 5.2, 2.2, 'F');
  doc.setFillColor(186, 230, 253);
  doc.ellipse(cx - 0.8, cy + 2.6, 3.6, 0.8, 'F');

  // Golden cross rising gracefully out of the water
  doc.setFillColor(253, 224, 71);
  doc.rect(cx - 0.65, cy - 4.7, 1.3, 6.7, 'F');
  doc.rect(cx - 2.6, cy - 2.7, 5.2, 1.2, 'F');

  // Small sparkling droplets above wave
  doc.setFillColor(224, 242, 254);
  doc.circle(cx - 3.6, cy + 0.5, 0.45, 'F');
  doc.circle(cx + 3.7, cy + 0.2, 0.45, 'F');
}

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
  doc.setFontSize(7.8);
  doc.setTextColor(12, 74, 110);
  doc.text(label, x, y);

  const boxY = y + 1.8;
  doc.setFillColor(248, 252, 255);
  doc.setDrawColor(148, 197, 226);
  doc.setLineWidth(0.32);
  doc.roundedRect(x, boxY, w, h, 1.1, 1.1, 'FD');

  if (value && value.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);
    if (multiline) {
      const lines = doc.splitTextToSize(value.trim(), w - 6);
      doc.text(lines.slice(0, 3), x + 3, boxY + 5);
    } else {
      const truncated = doc.splitTextToSize(value.trim(), w - 6)[0] || '';
      doc.text(truncated, x + 3, boxY + h / 2 + 1.2);
    }
  }
}

function drawSectionHeading(doc: jsPDF, title: string, x: number, y: number, w: number) {
  // Small water-droplet / aqua accent pill mark beside section title
  doc.setFillColor(2, 132, 199);
  doc.roundedRect(x, y - 3.1, 2.2, 3.4, 0.8, 0.8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(12, 74, 110);
  doc.text(title, x + 3.8, y);

  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.55);
  doc.line(x, y + 1.8, x + 46, y + 1.8);

  doc.setDrawColor(186, 230, 253);
  doc.setLineWidth(0.35);
  doc.line(x + 46, y + 1.8, x + w, y + 1.8);
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

  // Crisp White Sheet Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');

  // =====================================
  // HEADER BANNER — DESIGN DE BATISMO NAS ÁGUAS
  // =====================================
  const headerH = 35;
  const gradSteps = 18;
  for (let i = 0; i < gradSteps; i++) {
    const ratio = i / (gradSteps - 1);
    const r = Math.round(8 + ratio * (2 - 8));
    const g = Math.round(47 + ratio * (132 - 47));
    const b = Math.round(73 + ratio * (199 - 73));
    doc.setFillColor(r, g, b);
    doc.rect(0, (i * headerH) / gradSteps, pageW, headerH / gradSteps + 0.3, 'F');
  }

  // Subtle top golden-sky accent line
  doc.setFillColor(251, 191, 36);
  doc.rect(0, 0, pageW, 1.4, 'F');

  // Layered flowing baptism water waves transitioning from blue banner to white sheet
  drawWavePolygon(doc, 27.2, 36, pageW, 1.8, 3.2, 0.3, [14, 165, 233]);
  drawWavePolygon(doc, 29.4, 36, pageW, 1.6, 3.6, 1.9, [125, 211, 252]);
  drawWavePolygon(doc, 31.6, 36.2, pageW, 1.4, 3.0, 3.5, [255, 255, 255]);

  // Baptismal Emblem (Cross + Waters)
  drawBaptismEmblem(doc, margin + 8.5, 14.5);

  const churchTitle =
    settings?.churchTitle || 'IEADAM PETRÓPOLIS B · PT-B MÍDIA';
  const formTitle = settings?.formTitle || 'Ficha de Inscrição - Batismo nas Águas';
  const rawSubtitle = settings?.subtitle || '';
  const subtitle =
    !rawSubtitle || /uso exclusivo da secretaria/i.test(rawSubtitle)
      ? 'Ficha oficial de inscrição para o Batismo nas Águas'
      : rawSubtitle;

  const textX = margin + 20.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(253, 224, 71);
  doc.text(churchTitle, textX, 9.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text(formTitle, textX, 16.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(224, 242, 254);
  doc.text(subtitle, textX, 22.3);

  // Protocol & Status Card inside right side of banner
  const cardW = 45;
  const cardX = pageW - margin - cardW;
  doc.setFillColor(8, 47, 73);
  doc.setDrawColor(125, 211, 252);
  doc.setLineWidth(0.35);
  doc.roundedRect(cardX, 5.2, cardW, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(125, 211, 252);
  doc.text('PROTOCOLO OFICIAL', cardX + cardW / 2, 9.2, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(253, 224, 71);
  doc.text(reg.protocolNumber || reg.id, cardX + cardW / 2, 14.6, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(224, 242, 254);
  doc.text(
    STATUS_LABELS[reg.status] || reg.status || 'Pendente',
    cardX + cardW / 2,
    20.2,
    { align: 'center' }
  );

  // =====================================
  // 1. DADOS DO CANDIDATO(A)
  // =====================================
  let y = 39.5;
  drawSectionHeading(doc, 'DADOS DO CANDIDATO(A)', margin, y, contentW);
  y += 6;

  const boxH = 7.6;
  const rowStep = 12.2;
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
  y += 13.5;

  // =====================================
  // 2. DADOS ECLESIÁSTICOS
  // =====================================
  drawSectionHeading(doc, 'DADOS ECLESIÁSTICOS', margin, y, contentW);
  y += 6;

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
  y += 13.5;

  // =====================================
  // 3. DECLARAÇÃO
  // =====================================
  drawSectionHeading(doc, 'DECLARAÇÃO', margin, y, contentW);
  y += 5.5;

  // Verse accent banner for Baptism in the Waters
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.6);
  doc.setTextColor(3, 105, 161);
  const verseText =
    '"Fomos, pois, sepultados com ele na morte pelo batismo; para que, como Cristo foi ressuscitado dentre os mortos pela glória do Pai, assim andemos nós também em novidade de vida." (Romanos 6:4)';
  const verseLines = doc.splitTextToSize(verseText, contentW);
  doc.text(verseLines, margin, y);
  y += verseLines.length * 3.5 + 2.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  const declText =
    'Declaro que desejo me batizar nas águas, conforme minha fé e decisão pessoal, e estou ciente das orientações da igreja sobre o batismo.';
  const declLines = doc.splitTextToSize(declText, contentW);
  doc.text(declLines, margin, y);
  y += declLines.length * 3.8 + 2.8;

  const declCity = reg.declarationCity || 'Manaus / AM';
  const declDate = reg.declarationDate ? formatDateBR(reg.declarationDate) : '___ / ___ / _______';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`${declCity}, ${declDate}`, margin, y);
  y += 11;

  // Assinaturas
  const sigW = (contentW - 14) / 2;
  doc.setDrawColor(51, 102, 153);
  doc.setLineWidth(0.35);
  doc.line(margin, y, margin + sigW, y);
  doc.line(margin + sigW + 14, y, margin + sigW * 2 + 14, y);

  doc.setFontSize(7.6);
  doc.setTextColor(51, 65, 85);
  doc.text('Assinatura do Candidato(a)', margin + sigW / 2, y + 3.8, { align: 'center' });
  doc.text('Assinatura do Responsável (se menor)', margin + sigW + 14 + sigW / 2, y + 3.8, {
    align: 'center',
  });
  y += 9.5;

  // =====================================
  // 4. REGISTRO DA SECRETARIA
  // =====================================
  drawSectionHeading(doc, 'REGISTRO DA SECRETARIA', margin, y, contentW);
  y += 6;

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
  y += rowStep;

  drawLabeledBox(
    doc,
    'Observações da Secretaria (opcional):',
    reg.secretaryNotes || '',
    margin,
    y,
    contentW,
    15,
    true
  );

  // =====================================
  // BOTTOM BAPTISM WAVE FOOTER
  // =====================================
  drawWavePolygon(doc, pageH - 17.5, pageH, pageW, 1.5, 3.2, 0.8, [186, 230, 253]);
  drawWavePolygon(doc, pageH - 14.5, pageH, pageW, 1.4, 3.5, 2.6, [2, 132, 199]);
  drawWavePolygon(doc, pageH - 11.2, pageH, pageW, 1.1, 2.8, 4.1, [12, 74, 110]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(224, 242, 254);
  doc.text(
    'Documento oficial da Direção e Secretaria — IEADAM Petrópolis B · Batismo nas Águas',
    margin,
    pageH - 4.5
  );
  doc.text(
    `Ficha ${pageIndex + 1} de ${totalPages} · Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    pageW - margin,
    pageH - 4.5,
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
