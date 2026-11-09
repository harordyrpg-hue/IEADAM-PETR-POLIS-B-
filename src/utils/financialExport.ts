import { jsPDF } from 'jspdf';
import {
  FinancialTransaction,
  FinancialBill,
  FinancialSummary,
} from '../types.js';

const CHURCH_NAME = 'IEADAM PETRÓPOLIS B';
const MINISTRY_NAME = 'MINISTÉRIO DE MÍDIA & COMUNICAÇÃO — PT-B MÍDIA';

export const FINANCIAL_CATEGORY_LABELS: Record<string, string> = {
  dizimos_ofertas: 'Dízimos & Ofertas',
  doacao_especifica: 'Doação Específica / Oferta',
  equipamentos: 'Equipamentos & Hardware',
  cabos_conectores: 'Cabos & Conectores',
  streaming_internet: 'Streaming & Link de Internet',
  iluminacao: 'Iluminação & Cenografia',
  cenografia: 'Cenografia & Palco',
  manutencao_tecnica: 'Manutenção Técnica',
  servicos_terceiros: 'Serviços & Transportes',
  alimentacao_equipe: 'Alimentação da Equipe',
  transporte: 'Transporte & Deslocamento',
  eventos_especiais: 'Eventos & Conferências',
  outro: 'Outras Operações',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro em Espécie',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  transferencia: 'Transferência Bancária (TED/DOC)',
  boleto: 'Boleto Bancário',
  outro: 'Outro Método',
};

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount || 0);
}

export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return 'Sem data definida';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export interface FinancialExportParams {
  periodLabel: string;
  transactions: FinancialTransaction[];
  bills: FinancialBill[];
  summary: FinancialSummary;
  generatedByName: string;
}

/**
 * 1. OFFICIAL PDF EXPORT: Complete Church Financial Ledger & Statement
 */
export function exportFinancialStatementPDF({
  periodLabel,
  transactions,
  bills,
  summary,
  generatedByName,
}: FinancialExportParams) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      y = 18;
      // Header top bar on new page
      doc.setFillColor(217, 119, 6);
      doc.rect(0, 0, pageWidth, 4, 'F');
    }
  };

  // Top Bar
  doc.setFillColor(217, 119, 6); // Amber 600
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Header Title
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
    `Gerado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} por ${generatedByName}`,
    pageWidth - margin,
    y,
    { align: 'right' }
  );

  y += 5;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  // Main Banner
  y += 6;
  doc.setFillColor(24, 24, 27); // Zinc 900
  doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(245, 158, 11); // Amber 500
  doc.text('EXTRATO OFICIAL DE CAIXA & LIVRO FINANCEIRO', margin + 6, y + 7.5);

  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  doc.text(`PERÍODO: ${periodLabel.toUpperCase()}`, pageWidth - margin - 6, y + 7.5, { align: 'right' });

  y += 18;

  // KPI Balance Grid
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD');

  const colWidth = contentWidth / 4;

  // Col 1: Saldo Atual
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('SALDO ATUAL EM CAIXA:', margin + 5, y + 7);
  doc.setFontSize(11);
  doc.setTextColor(summary.currentBalance >= 0 ? 16 : 220, summary.currentBalance >= 0 ? 185 : 38, summary.currentBalance >= 0 ? 129 : 38);
  doc.text(formatCurrency(summary.currentBalance), margin + 5, y + 15);
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text('Saldo disponível líquido', margin + 5, y + 21);

  // Col 2: Total Entradas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('ENTRADAS (RECEITAS):', margin + colWidth + 3, y + 7);
  doc.setFontSize(10.5);
  doc.setTextColor(16, 185, 129);
  doc.text(`+ ${formatCurrency(summary.totalIncome)}`, margin + colWidth + 3, y + 15);
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text(`${transactions.filter((t) => t.type === 'entrada').length} lançamentos`, margin + colWidth + 3, y + 21);

  // Col 3: Total Saídas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('SAÍDAS (DESPESAS):', margin + colWidth * 2 + 3, y + 7);
  doc.setFontSize(10.5);
  doc.setTextColor(220, 38, 38);
  doc.text(`- ${formatCurrency(summary.totalExpense)}`, margin + colWidth * 2 + 3, y + 15);
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text(`${transactions.filter((t) => t.type === 'saida').length} lançamentos`, margin + colWidth * 2 + 3, y + 21);

  // Col 4: Contas a Pagar / Pendentes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('CONTAS A PAGAR:', margin + colWidth * 3 + 3, y + 7);
  doc.setFontSize(10.5);
  doc.setTextColor(217, 119, 6);
  doc.text(formatCurrency(summary.pendingPayable), margin + colWidth * 3 + 3, y + 15);
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text(`${bills.filter((b) => b.type === 'a_pagar' && b.status === 'pendente').length} pendentes`, margin + colWidth * 3 + 3, y + 21);

  y += 32;

  // SECTION 1: MOVIMENTAÇÕES DE ENTRADA (DE ONDE VEIO O DINHEIRO)
  const entradas = transactions.filter((t) => t.type === 'entrada');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(31, 41, 55);
  doc.text(`1. ENTRADAS DE DINHEIRO & MOTIVOS DE RECEBIMENTO (${entradas.length})`, margin, y);

  y += 4;

  if (entradas.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Nenhuma entrada registrada para o período selecionado.', margin + 5, y + 7.5);
    y += 18;
  } else {
    for (const tx of entradas) {
      checkPageBreak(18);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(167, 243, 208); // Emerald border
      doc.roundedRect(margin, y, contentWidth, 16, 1.5, 1.5, 'FD');

      // Left green bar
      doc.setFillColor(16, 185, 129);
      doc.rect(margin, y, 2.5, 16, 'F');

      // Row 1: Title and Amount
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(17, 24, 39);
      doc.text(tx.title, margin + 5, y + 5.5);

      doc.setFontSize(9.5);
      doc.setTextColor(16, 185, 129);
      doc.text(`+ ${formatCurrency(tx.amount)}`, pageWidth - margin - 5, y + 5.5, { align: 'right' });

      // Row 2: De onde veio (Counterparty) & Motivo (Description)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      const originText = `Origem: ${tx.counterparty || 'Não especificada'} · Motivo: ${tx.description || 'Entrada em caixa'}`;
      doc.text(originText.substring(0, 95), margin + 5, y + 10);

      // Row 3: Data, Categoria, Método e Comprovante
      const catLabel = FINANCIAL_CATEGORY_LABELS[tx.category] || tx.category;
      const methodLabel = PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod;
      const receiptInfo = tx.receipt ? '[Comprovante Anexado]' : '[Sem comprovante]';
      doc.text(
        `Data: ${formatDateBR(tx.date)} · Categoria: ${catLabel} · ${methodLabel} · ${receiptInfo}`,
        margin + 5,
        y + 14
      );

      y += 19;
    }
  }

  // SECTION 2: MOVIMENTAÇÕES DE SAÍDA (PARA ONDE FOI O DINHEIRO)
  checkPageBreak(25);
  const saidas = transactions.filter((t) => t.type === 'saida');
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(31, 41, 55);
  doc.text(`2. SAÍDAS DE DINHEIRO & DESTINO DOS RECURSOS (${saidas.length})`, margin, y);

  y += 4;

  if (saidas.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Nenhuma saída registrada para o período selecionado.', margin + 5, y + 7.5);
    y += 18;
  } else {
    for (const tx of saidas) {
      checkPageBreak(18);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(254, 202, 202); // Red border
      doc.roundedRect(margin, y, contentWidth, 16, 1.5, 1.5, 'FD');

      // Left red bar
      doc.setFillColor(220, 38, 38);
      doc.rect(margin, y, 2.5, 16, 'F');

      // Row 1: Title and Amount
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(17, 24, 39);
      doc.text(tx.title, margin + 5, y + 5.5);

      doc.setFontSize(9.5);
      doc.setTextColor(220, 38, 38);
      doc.text(`- ${formatCurrency(tx.amount)}`, pageWidth - margin - 5, y + 5.5, { align: 'right' });

      // Row 2: Para onde vai (Favorecido) & Motivo
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      const destText = `Destino: ${tx.counterparty || 'Fornecedor'} · Motivo: ${tx.description || 'Despesa operacional'}`;
      doc.text(destText.substring(0, 95), margin + 5, y + 10);

      // Row 3: Metadata
      const catLabel = FINANCIAL_CATEGORY_LABELS[tx.category] || tx.category;
      const methodLabel = PAYMENT_METHOD_LABELS[tx.paymentMethod] || tx.paymentMethod;
      const receiptInfo = tx.receipt ? '[Comprovante Anexado]' : '[Sem comprovante]';
      doc.text(
        `Data: ${formatDateBR(tx.date)} · Categoria: ${catLabel} · ${methodLabel} · ${receiptInfo}`,
        margin + 5,
        y + 14
      );

      y += 19;
    }
  }

  // SECTION 3: CONTAS A PAGAR & CONTAS A RECEBER PENDENTES
  checkPageBreak(30);
  const pendingBills = bills.filter((b) => b.status === 'pendente' && !b.hasNoForecast);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(31, 41, 55);
  doc.text(`3. CONTAS A PAGAR & A RECEBER (${pendingBills.length})`, margin, y);

  y += 4;

  if (pendingBills.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Nenhuma conta com vencimento pendente no momento.', margin + 5, y + 7.5);
    y += 18;
  } else {
    for (const b of pendingBills) {
      checkPageBreak(16);
      const isPayable = b.type === 'a_pagar';
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(margin, y, contentWidth, 15, 1.5, 1.5, 'FD');

      // Left Accent
      doc.setFillColor(isPayable ? 217 : 37, isPayable ? 119 : 99, isPayable ? 6 : 235);
      doc.rect(margin, y, 2.5, 15, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(17, 24, 39);
      doc.text(`[${isPayable ? 'A PAGAR' : 'A RECEBER'}] ${b.title}`, margin + 5, y + 5.5);

      doc.setFontSize(9);
      doc.setTextColor(isPayable ? 217 : 37, isPayable ? 119 : 99, isPayable ? 6 : 235);
      doc.text(formatCurrency(b.amount), pageWidth - margin - 5, y + 5.5, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      doc.text(`Favorecido/Origem: ${b.counterparty} · Vencimento: ${formatDateBR(b.dueDate)}`, margin + 5, y + 10.5);

      y += 18;
    }
  }

  // SECTION 4: GASTOS FUTUROS & PREVISÕES (COM OU SEM PREVISÃO)
  const futureExpenses = bills.filter((b) => b.type === 'a_pagar' && (b.hasNoForecast || (b.dueDate && new Date(b.dueDate) > new Date())));
  if (futureExpenses.length > 0) {
    checkPageBreak(30);
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 41, 55);
    doc.text(`4. GASTOS FUTUROS & DESPESAS PLANEJADAS (${futureExpenses.length})`, margin, y);

    y += 4;
    for (const b of futureExpenses) {
      checkPageBreak(16);
      doc.setFillColor(254, 243, 199); // Amber 100
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(146, 64, 14);
      doc.text(`• ${b.title} — ${formatCurrency(b.amount)}`, margin + 5, y + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 83, 9);
      const whenText = b.hasNoForecast
        ? 'Previsão: GASTO FUTURO SEM DATA PREVISTA (Demanda mapeada)'
        : `Previsão de pagamento: ${formatDateBR(b.dueDate)}`;
      doc.text(`${whenText} · Destino: ${b.counterparty}`, margin + 5, y + 10);

      y += 17;
    }
  }

  // Signatures Area
  checkPageBreak(32);
  y += 8;
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.4);

  const signWidth = 65;
  const sign1X = margin + 10;
  const sign2X = pageWidth - margin - signWidth - 10;

  doc.line(sign1X, y + 16, sign1X + signWidth, y + 16);
  doc.line(sign2X, y + 16, sign2X + signWidth, y + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text('Responsável Financeiro / Mídia', sign1X + signWidth / 2, y + 20, { align: 'center' });
  doc.text('Liderança / Pastor Responsável', sign2X + signWidth / 2, y + 20, { align: 'center' });

  // Page Footer
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `IEADAM Petrópolis B · PT-B Mídia · Relatório Oficial de Prestação de Contas`,
    pageWidth / 2,
    290,
    { align: 'center' }
  );

  const cleanPeriod = periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`extrato_financeiro_ptb_${cleanPeriod}.pdf`);
}

/**
 * 2. OFFICIAL IMAGE EXPORT: High-Resolution Shareable Card (PNG)
 * Ideal for sharing on church leadership WhatsApp and mobile review.
 */
export async function exportFinancialStatementImage({
  periodLabel,
  transactions,
  bills,
  summary,
  generatedByName,
}: FinancialExportParams): Promise<void> {
  const width = 1200;
  const height = 1800;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background gradient: Deep slate/dark church theme
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(1, '#05070a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Top Golden Header Accent
  const goldGrad = ctx.createLinearGradient(0, 0, width, 0);
  goldGrad.addColorStop(0, '#d97706');
  goldGrad.addColorStop(0.5, '#fbbf24');
  goldGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = goldGrad;
  ctx.fillRect(0, 0, width, 14);

  let y = 60;
  const margin = 60;
  const contentWidth = width - margin * 2;

  // Church Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(CHURCH_NAME, margin, y);

  y += 32;
  ctx.fillStyle = '#9ca3af';
  ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(MINISTRY_NAME, margin, y);

  const now = new Date();
  const dateStr = `Emitido em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#6b7280';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(dateStr, width - margin, y);
  ctx.textAlign = 'left';

  y += 24;
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, y);
  ctx.lineTo(width - margin, y);
  ctx.stroke();

  // Banner Title Card
  y += 28;
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.roundRect(margin, y, contentWidth, 58, 12);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('EXTRATO OFICIAL DO LIVRO FINANCEIRO', margin + 24, y + 36);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`PERÍODO: ${periodLabel.toUpperCase()}`, width - margin - 24, y + 36);
  ctx.textAlign = 'left';

  y += 90;

  // Main KPI: Current Balance Card
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(margin, y, contentWidth, 140, 16);
  ctx.fill();
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Left Green Accent Bar
  ctx.fillStyle = summary.currentBalance >= 0 ? '#10b981' : '#ef4444';
  ctx.beginPath();
  ctx.roundRect(margin, y, 10, 140, [16, 0, 0, 16]);
  ctx.fill();

  ctx.fillStyle = '#9ca3af';
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('SALDO ATUAL CONSOLIDADO EM CAIXA', margin + 36, y + 42);

  ctx.fillStyle = summary.currentBalance >= 0 ? '#10b981' : '#f87171';
  ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(formatCurrency(summary.currentBalance), margin + 36, y + 104);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#6b7280';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Auditoria: ${generatedByName}`, width - margin - 30, y + 50);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('DISPONÍVEL', width - margin - 30, y + 85);
  ctx.textAlign = 'left';

  y += 165;

  // 3-Column Mini KPI Grid
  const cardGap = 20;
  const cardWidth = (contentWidth - cardGap * 2) / 3;

  // Card 1: Entradas
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(margin, y, cardWidth, 100, 12);
  ctx.fill();
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#9ca3af';
  ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TOTAL ENTRADAS', margin + 20, y + 34);
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`+ ${formatCurrency(summary.totalIncome)}`, margin + 20, y + 74);

  // Card 2: Saídas
  const col2X = margin + cardWidth + cardGap;
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(col2X, y, cardWidth, 100, 12);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#9ca3af';
  ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TOTAL SAÍDAS', col2X + 20, y + 34);
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`- ${formatCurrency(summary.totalExpense)}`, col2X + 20, y + 74);

  // Card 3: Contas a Pagar
  const col3X = margin + (cardWidth + cardGap) * 2;
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.roundRect(col3X, y, cardWidth, 100, 12);
  ctx.fill();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#9ca3af';
  ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CONTAS A PAGAR', col3X + 20, y + 34);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(formatCurrency(summary.pendingPayable), col3X + 20, y + 74);

  y += 135;

  // Section Header: Últimas Movimentações Detalhadas
  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('ÚLTIMAS MOVIMENTAÇÕES DE CAIXA (ENTRADAS & SAÍDAS)', margin, y);

  y += 24;

  const displayList = transactions.slice(0, 8);
  if (displayList.length === 0) {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(margin, y, contentWidth, 70, 10);
    ctx.fill();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Nenhuma transação financeira registrada neste período.', margin + 24, y + 42);
    y += 90;
  } else {
    for (const tx of displayList) {
      const isIncome = tx.type === 'entrada';
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.roundRect(margin, y, contentWidth, 68, 10);
      ctx.fill();

      // Side marker
      ctx.fillStyle = isIncome ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.roundRect(margin, y, 6, 68, [10, 0, 0, 10]);
      ctx.fill();

      // Title & counterparty
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(tx.title, margin + 24, y + 28);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const subInfo = `${isIncome ? 'Origem' : 'Destino'}: ${tx.counterparty || 'Geral'} · ${formatDateBR(tx.date)} · Motivo: ${tx.description || tx.title}`;
      ctx.fillText(subInfo.substring(0, 75), margin + 24, y + 52);

      // Amount on right
      ctx.textAlign = 'right';
      ctx.fillStyle = isIncome ? '#34d399' : '#f87171';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const sign = isIncome ? '+ ' : '- ';
      ctx.fillText(`${sign}${formatCurrency(tx.amount)}`, width - margin - 24, y + 40);
      ctx.textAlign = 'left';

      y += 76;
    }
  }

  // Section: Contas e Gastos Futuros Previsão
  y += 20;
  ctx.fillStyle = '#f3f4f6';
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PREVISÕES DE GASTOS FUTUROS & CONTAS PENDENTES', margin, y);

  y += 24;
  const plannedBills = bills.filter((b) => b.type === 'a_pagar' && b.status === 'pendente').slice(0, 3);
  if (plannedBills.length === 0) {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(margin, y, contentWidth, 60, 10);
    ctx.fill();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Nenhum gasto futuro pendente mapeado.', margin + 24, y + 36);
  } else {
    for (const b of plannedBills) {
      ctx.fillStyle = '#1e1b18';
      ctx.beginPath();
      ctx.roundRect(margin, y, contentWidth, 64, 10);
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`• ${b.title}`, margin + 24, y + 26);

      ctx.fillStyle = '#d1d5db';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const forecastText = b.hasNoForecast ? 'GASTO SEM DATA PREVISTA' : `Vencimento: ${formatDateBR(b.dueDate)}`;
      ctx.fillText(`${forecastText} · Favorecido: ${b.counterparty}`, margin + 24, y + 48);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(formatCurrency(b.amount), width - margin - 24, y + 38);
      ctx.textAlign = 'left';

      y += 72;
    }
  }

  // Footer
  ctx.fillStyle = '#4b5563';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'IEADAM Petrópolis B · PT-B Mídia · Documento Oficial de Controle Financeiro & Prestação de Contas',
    width / 2,
    height - 40
  );

  // Convert to image and trigger download
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  const link = document.createElement('a');
  link.download = `extrato_financeiro_ptb_midia_${Date.now()}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
