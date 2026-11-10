import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { EventRegistration, PublicRegistrationEvent } from '../types.js';

const CHURCH_NAME = 'IEADAM PETRÓPOLIS B';
const MINISTRY_NAME = 'MINISTÉRIO DE MÍDIA & COMUNICAÇÃO — PT-B MÍDIA';

export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return 'Data a confirmar';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Generates a high-resolution QR code data URL containing full registration info and rules
 */
export async function generateTicketQRCode(registration: EventRegistration, event?: PublicRegistrationEvent | null): Promise<string> {
  const qrObject = {
    codigo: registration.id,
    evento: registration.eventName,
    data: event ? formatDateBR(event.date) : 'Conforme cronograma',
    horario: event?.time || '19:30',
    local: event?.location || 'IEADAM Petrópolis B',
    participante: registration.fullName,
    telefone: registration.phone,
    email: registration.email || 'Não informado',
    igreja: registration.church || 'IEADAM',
    area: registration.area || 'Geral',
    lider: registration.responsibleLeader || 'Liderança',
    pastor: registration.responsiblePastor || 'Pastoral',
    regras: event?.rulesAndNotes ? event.rulesAndNotes.substring(0, 300) : 'Apresente este código no check-in.',
    status: 'CONFIRMADA',
  };

  try {
    const dataUrl = await QRCode.toDataURL(JSON.stringify(qrObject), {
      width: 400,
      margin: 1.5,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code:', err);
    // Fallback QR code with just ticket ID and name
    return await QRCode.toDataURL(`PTB-EVENTO:${registration.id}:${registration.fullName}`, {
      width: 400,
      margin: 1,
    });
  }
}

/**
 * Generates an official printable PDF ticket / confirmation credential
 */
export async function exportRegistrationTicketPDF(
  registration: EventRegistration,
  event?: PublicRegistrationEvent | null
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  // 1. Top Decorative Brand Bar
  doc.setFillColor(217, 119, 6); // Amber 600
  doc.rect(0, 0, pageWidth, 5, 'F');

  // 2. Official Church Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(23, 23, 23);
  doc.text(CHURCH_NAME, margin, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(115, 115, 115);
  doc.text(MINISTRY_NAME, margin, y);

  doc.setFontSize(7.5);
  const now = new Date();
  doc.text(
    `Emitido em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    pageWidth - margin,
    y,
    { align: 'right' }
  );

  y += 5;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  // 3. Ticket Title Banner
  y += 6;
  doc.setFillColor(24, 24, 27); // Dark zinc container
  doc.roundedRect(margin, y, contentWidth, 13, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(245, 158, 11); // Amber 500
  const isPaid = !!(registration.isPaidEvent || event?.isPaid);
  const ticketTitle = isPaid
    ? 'COMPROVANTE DE PAGAMENTO & INGRESSO PAGO'
    : 'COMPROVANTE OFICIAL DE INSCRIÇÃO & CREDENCIAL';
  doc.text(ticketTitle, margin + 6, y + 8.5);

  doc.setFontSize(8);
  doc.setTextColor(52, 211, 153); // Emerald text
  const statusLabel = isPaid
    ? 'PAGAMENTO CONFIRMADO'
    : 'INSCRIÇÃO CONFIRMADA';
  doc.text(statusLabel, pageWidth - margin - 6, y + 8.5, { align: 'right' });

  // 4. Registration ID & Event Name Hero Card
  y += 19;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('CÓDIGO DE INSCRIÇÃO (CHECK-IN):', margin + 6, y + 7);
  doc.text('EVENTO:', margin + 60, y + 7);
  if (isPaid) {
    doc.text('VALOR PAGO:', margin + contentWidth - 45, y + 7);
  }

  doc.setFontSize(11);
  doc.setTextColor(217, 119, 6); // Amber code
  doc.text(registration.id, margin + 6, y + 14);

  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  doc.text(registration.eventName, margin + 60, y + 14);

  if (isPaid) {
    const priceVal = registration.ticketPrice || event?.price || 0;
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129); // Emerald 500
    doc.text(`R$ ${priceVal.toFixed(2)}`, margin + contentWidth - 45, y + 14);
  }

  y += 30;

  // 5. Two-Column Grid: Participant Information on Left, QR Code on Right
  const qrCodeDataUrl = await generateTicketQRCode(registration, event);

  const leftColWidth = contentWidth - 55;
  const rightColWidth = 50;
  const gridHeight = 76;

  // Left Box: Participant & Church Info
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin, y, leftColWidth, gridHeight, 2, 2, 'FD');

  // Left Accent Bar
  doc.setFillColor(217, 119, 6);
  doc.rect(margin, y, 2.5, gridHeight, 'F');

  let py = y + 7;
  const col1X = margin + 6;
  const col2X = margin + leftColWidth / 2 + 2;

  // Field: Nome Completo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('PARTICIPANTE (NOME COMPLETO):', col1X, py);
  py += 4.5;
  doc.setFontSize(10.5);
  doc.setTextColor(17, 24, 39);
  doc.text(registration.fullName, col1X, py);

  // Row 2: Telefone & E-mail
  py += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('TELEFONE / WHATSAPP:', col1X, py);
  doc.text('E-MAIL:', col2X, py);

  py += 4.5;
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text(registration.phone || 'Não informado', col1X, py);
  doc.text(registration.email || 'Não informado', col2X, py);

  // Row 3: Igreja & Área
  py += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('IGREJA / CONGREGAÇÃO:', col1X, py);
  doc.text('ÁREA:', col2X, py);

  py += 4.5;
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text(registration.church || 'IEADAM Petrópolis B', col1X, py);
  doc.text(registration.area || 'Geral', col2X, py);

  // Row 4: Líder & Pastor Responsável
  py += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('LÍDER RESPONSÁVEL:', col1X, py);
  doc.text('PASTOR RESPONSÁVEL:', col2X, py);

  py += 4.5;
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text(registration.responsibleLeader || 'Liderança', col1X, py);
  doc.text(registration.responsiblePastor || 'Pastoral', col2X, py);

  // Right Box: QR Code Container
  const qrX = margin + leftColWidth + 5;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(qrX, y, rightColWidth, gridHeight, 2, 2, 'FD');

  doc.addImage(qrCodeDataUrl, 'PNG', qrX + 3.5, y + 5, 43, 43);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(17, 24, 39);
  doc.text('APRESENTE NO CHECK-IN', qrX + rightColWidth / 2, y + 53, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text('Todos os dados da sua', qrX + rightColWidth / 2, y + 59, { align: 'center' });
  doc.text('inscrição e regras estão', qrX + rightColWidth / 2, y + 64, { align: 'center' });
  doc.text('armazenados neste QR code.', qrX + rightColWidth / 2, y + 69, { align: 'center' });

  y += gridHeight + 8;

  // 6. Event Logistics Card (Data, Horário, Local)
  doc.setFillColor(254, 243, 199); // Amber 100
  doc.setDrawColor(245, 158, 11); // Amber 500
  doc.roundedRect(margin, y, contentWidth, 18, 1.5, 1.5, 'FD');

  const evDate = event ? formatDateBR(event.date) : 'Conforme anúncio';
  const evTime = event?.time || '19:30';
  const evLoc = event?.location || 'IEADAM Petrópolis B - Templo Central';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14);
  doc.text(`DATA & HORÁRIO: ${evDate} às ${evTime}`, margin + 5, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 83, 9);
  doc.text(`LOCAL: ${evLoc}`, margin + 5, y + 12.5);

  y += 24;

  // 7. Rules & Notes from Event Administrator
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(31, 41, 55);
  doc.text('REGRAS, TERMOS & ANOTAÇÕES IMPORTANTES DO EVENTO', margin, y);

  y += 4;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);

  const rulesText = event?.rulesAndNotes?.trim() ||
    '• Este comprovante é pessoal e intransferível.\n• Chegue com 15 a 20 minutos de antecedência para facilitar o credenciamento.\n• Mantenha o QR Code salvo em seu aparelho ou impresso para leitura na portaria.\n• Em caso de dúvidas, procure a liderança de mídia ou organização do evento.';

  const splitRules = doc.splitTextToSize(rulesText, contentWidth - 10);
  const rulesHeight = Math.max(22, splitRules.length * 4.5 + 8);

  doc.roundedRect(margin, y, contentWidth, rulesHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text(splitRules, margin + 5, y + 6);

  y += rulesHeight + 12;

  // 8. Cut / Folding Guide Line
  doc.setDrawColor(209, 213, 219);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0); // reset

  doc.setFontSize(6.5);
  doc.setTextColor(156, 163, 175);
  doc.text('Dobre ou recorte aqui para guardar sua credencial impressa', pageWidth / 2, y + 4, { align: 'center' });

  // 9. Document Footer
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `IEADAM Petrópolis B · PT-B Mídia · Autenticação Digital: ${registration.id}`,
    pageWidth / 2,
    290,
    { align: 'center' }
  );

  const cleanName = registration.fullName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`ingresso_inscricao_${registration.id}_${cleanName}.pdf`);
}
