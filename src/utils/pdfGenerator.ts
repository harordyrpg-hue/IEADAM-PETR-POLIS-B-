import { jsPDF } from 'jspdf';
import { TeamTask, ChurchEvent } from '../types.js';
import { formatDate } from './formatters.js';

const CHURCH_NAME = 'IEADAM PETRÓPOLIS B';
const MINISTRY_NAME = 'MINISTÉRIO DE MÍDIA & COMUNICAÇÃO — PT-B MÍDIA';

const CATEGORY_NAMES: Record<string, string> = {
  transmissao: 'Transmissão Ao Vivo',
  som: 'Áudio & Mesa de Som',
  projecao: 'Projeção & Telão LED',
  fotografia: 'Fotografia & Cobertura',
  video: 'Captação de Vídeo & Reels',
  design_redes: 'Design Gráfico & Mídias',
  iluminacao: 'Iluminação & Cenografia',
  outro: 'Serviço Operacional de Mídia',
};

const PRIORITY_NAMES: Record<string, string> = {
  urgente: 'URGENTE',
  alta: 'ALTA PRIORIDADE',
  media: 'NORMAL / MÉDIA',
  baixa: 'BAIXA',
};

const STATUS_NAMES: Record<string, string> = {
  pendente: 'PENDENTE',
  em_andamento: 'EM ANDAMENTO',
  concluido: 'CONCLUÍDO',
};

/**
 * 1. Generates an official professional PDF for a single duty / task (Ordem de Serviço)
 * Explicitly displays:
 * - Nome do usuário destinatário (assignedToName)
 * - Quem destinou a tarefa (createdByName)
 * - Se é tarefa privada ou pública
 * - Todos os afazeres, prazos e assinaturas formais
 */
export function exportIndividualTaskPDF(task: TeamTask, event?: ChurchEvent | null) {
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
  doc.text(`Documento gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, y, { align: 'right' });

  y += 5;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  // 3. Document Title Banner
  y += 6;
  doc.setFillColor(24, 24, 27); // Dark zinc container
  doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(245, 158, 11); // Amber text
  doc.text('ORDEM DE SERVIÇO & FICHA DE TAREFA INDIVIDUAL', margin + 6, y + 7.5);

  const privacyText = task.isPrivate ? 'CONFIDENCIAL / PRIVADA' : 'PÚBLICA';
  doc.setFontSize(8);
  doc.setTextColor(task.isPrivate ? 248 : 220, task.isPrivate ? 113 : 220, task.isPrivate ? 113 : 220);
  doc.text(privacyText, pageWidth - margin - 6, y + 7.5, { align: 'right' });

  // 4. Task Title Heading
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  doc.text(task.title, margin, y);

  y += 3;

  // 5. Identification Data Grid (Destinatário vs Solicitante)
  y += 5;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin, y, contentWidth, 42, 2, 2, 'FD');

  const col1 = margin + 5;
  const col2 = margin + contentWidth / 2 + 5;

  let gridY = y + 7;

  // Row 1: Destinatário & Quem Destinou (Solicitante) - CRITICAL REQUIREMENT
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('DESTINATÁRIO / RESPONSÁVEL:', col1, gridY);
  doc.text('QUEM DESTINOU A TAREFA (SOLICITANTE):', col2, gridY);

  gridY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text(task.assignedToName || 'Membro da Equipe', col1, gridY);
  doc.text(task.createdByName || 'Liderança de Mídia', col2, gridY);

  if (task.assignedToEmail) {
    gridY += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text(task.assignedToEmail, col1, gridY);
  }

  // Row 2: Função / Categoria & Data / Horário
  gridY += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('SETOR / FUNÇÃO:', col1, gridY);
  doc.text('DATA & HORÁRIO DE EXECUÇÃO:', col2, gridY);

  gridY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text(CATEGORY_NAMES[task.category] || 'Mídia Geral', col1, gridY);
  doc.text(`${formatDate(task.dueDate)} às ${task.dueTime || 'Horário do Culto'}`, col2, gridY);

  // Row 3: Prioridade & Status
  gridY += 6.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('PRIORIDADE:', col1, gridY);
  doc.text('STATUS ATUAL:', col2, gridY);

  gridY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(task.priority === 'urgente' ? 220 : 17, task.priority === 'urgente' ? 38 : 24, task.priority === 'urgente' ? 38 : 39);
  doc.text(PRIORITY_NAMES[task.priority] || task.priority.toUpperCase(), col1, gridY);

  doc.setTextColor(task.status === 'concluido' ? 16 : 17, task.status === 'concluido' ? 185 : 24, task.status === 'concluido' ? 129 : 39);
  doc.text(STATUS_NAMES[task.status] || task.status.toUpperCase(), col2, gridY);

  y += 48;

  // 6. Culto ou Evento Vinculado
  if (task.eventName || event?.name) {
    const evtName = task.eventName || event?.name || '';
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(245, 158, 11);
    doc.roundedRect(margin, y, contentWidth, 10, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);
    doc.text(`CULTO / EVENTO VINCULADO: ${evtName}`, margin + 5, y + 6.5);
    y += 14;
  }

  // 7. Descrição e Escopo Detalhado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(31, 41, 55);
  doc.text('ESCOPO & INSTRUÇÕES DA TAREFA', margin, y);

  y += 4;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);

  const descText = task.description?.trim() || 'Nenhuma instrução adicional informada. Executar conforme orientação da liderança de mídia.';
  const splitDesc = doc.splitTextToSize(descText, contentWidth - 10);
  const descHeight = Math.max(16, splitDesc.length * 4.5 + 8);

  doc.roundedRect(margin, y, contentWidth, descHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);
  doc.text(splitDesc, margin + 5, y + 6);

  y += descHeight + 7;

  // 8. Lista de Afazeres Específicos / Checklist
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(31, 41, 55);
  doc.text('AFAZERES ESPECÍFICOS & CHECKLIST OPERACIONAL', margin, y);

  y += 4;
  const items = task.checklist && task.checklist.length > 0
    ? task.checklist
    : [
        { id: '1', text: 'Chegar com 30 minutos de antecedência para testes técnicos', completed: false },
        { id: '2', text: 'Conferir conexões e funcionamento dos equipamentos do setor', completed: false },
        { id: '3', text: 'Acompanhar a transmissão/gravação até a oração final', completed: false },
        { id: '4', text: 'Desligar e guardar os equipamentos com zelo ao final', completed: false },
      ];

  const checklistHeight = items.length * 7 + 8;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin, y, contentWidth, checklistHeight, 1.5, 1.5, 'FD');

  let checkY = y + 6;
  for (const item of items) {
    // Draw checkbox box
    doc.setDrawColor(item.completed ? 16 : 156, item.completed ? 185 : 163, item.completed ? 129 : 175);
    doc.setFillColor(item.completed ? 209 : 255, item.completed ? 250 : 255, item.completed ? 229 : 255);
    doc.rect(margin + 5, checkY - 3, 3.5, 3.5, 'FD');

    if (item.completed) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(5, 150, 105);
      doc.text('X', margin + 5.8, checkY - 0.5);
    }

    doc.setFont('helvetica', item.completed ? 'normal' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(item.completed ? 107 : 31, item.completed ? 114 : 41, item.completed ? 128 : 55);
    doc.text(item.text, margin + 11, checkY);

    checkY += 7;
  }

  y += checklistHeight + 12;

  // 9. Document Footer
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `IEADAM Petrópolis B · PT-B Mídia · Tarefa ID: ${task.id}`,
    pageWidth / 2,
    290,
    { align: 'center' }
  );

  const cleanName = (task.title || 'tarefa')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 30);
  doc.save(`tarefa_${task.id}_${cleanName}.pdf`);
}

/**
 * 2. Generates a consolidated Personal Schedule & Tasks PDF for a specific team member
 * Lists all tasks requested for them, with requester, date, status, checklist and assigned events.
 */
export function exportUserSchedulePDF(
  user: { name: string; email?: string; roleLabel?: string },
  tasks: TeamTask[],
  events: ChurchEvent[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 20) {
      doc.addPage();
      y = 20;
      doc.setFillColor(217, 119, 6);
      doc.rect(0, 0, pageWidth, 4, 'F');
    }
  };

  // Top Bar
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Header
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
  doc.text(`Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, y, { align: 'right' });

  y += 5;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  // Title Banner
  y += 6;
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(245, 158, 11);
  doc.text('ESCALA PESSOAL & RELATÓRIO INDIVIDUAL DE AFAZERES', margin + 6, y + 7.5);

  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  doc.text(`TOTAL: ${tasks.length} TAREFAS`, pageWidth - margin - 6, y + 7.5, { align: 'right' });

  // Member Identification Card
  y += 18;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('MEMBRO DA EQUIPE DE MÍDIA (RESPONSÁVEL):', margin + 6, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(user.name, margin + 6, y + 13.5);

  if (user.email) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(user.email, margin + 6, y + 18);
  }

  // Summary stats on the right
  const pending = tasks.filter((t) => t.status === 'pendente').length;
  const inProgress = tasks.filter((t) => t.status === 'em_andamento').length;
  const done = tasks.filter((t) => t.status === 'concluido').length;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('RESUMO DE AFAZERES:', margin + contentWidth - 65, y + 7);

  doc.setFontSize(8);
  doc.setTextColor(217, 119, 6);
  doc.text(`• Pendentes: ${pending}`, margin + contentWidth - 65, y + 12);
  doc.setTextColor(37, 99, 235);
  doc.text(`• Em Andamento: ${inProgress}`, margin + contentWidth - 65, y + 16);
  doc.setTextColor(16, 185, 129);
  doc.text(`• Concluídos: ${done}`, margin + contentWidth - 65, y + 20);

  y += 28;

  // Tasks Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text('LISTA DE AFAZERES SOLICITADOS', margin, y);

  y += 5;

  if (tasks.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(margin, y, contentWidth, 16, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text('Nenhum afazer pendente ou escala atribuída a você no momento.', margin + 6, y + 10);
    y += 24;
  } else {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const cardHeight = 24 + (task.checklist && task.checklist.length > 0 ? task.checklist.length * 4.5 + 4 : 0);

      checkPageBreak(cardHeight + 4);

      // Task Item Card
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(task.isPrivate ? 252 : 229, task.isPrivate ? 165 : 231, task.isPrivate ? 165 : 235);
      doc.roundedRect(margin, y, contentWidth, cardHeight, 1.5, 1.5, 'FD');

      // Left Accent bar
      doc.setFillColor(task.isPrivate ? 239 : 217, task.isPrivate ? 68 : 119, task.isPrivate ? 68 : 6);
      doc.rect(margin, y, 2.5, cardHeight, 'F');

      // Task Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(17, 24, 39);
      doc.text(`${i + 1}. ${task.title}`, margin + 6, y + 6);

      // Privacy Badge
      if (task.isPrivate) {
        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(248, 113, 113);
        doc.roundedRect(pageWidth - margin - 36, y + 2.5, 32, 5, 1, 1, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(220, 38, 38);
        doc.text('TAREFA PRIVADA', pageWidth - margin - 20, y + 6, { align: 'center' });
      }

      // Metadata Line 1: Solicitante (Quem destinou) & Categoria
      let textY = y + 11.5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      doc.text('Solicitado por:', margin + 6, textY);
      doc.setTextColor(17, 24, 39);
      doc.text(task.createdByName || 'Liderança', margin + 25, textY);

      doc.setTextColor(107, 114, 128);
      doc.text('Setor:', margin + 85, textY);
      doc.setTextColor(17, 24, 39);
      doc.text(CATEGORY_NAMES[task.category] || 'Mídia', margin + 94, textY);

      doc.setTextColor(107, 114, 128);
      doc.text('Prazo:', margin + 130, textY);
      doc.setTextColor(17, 24, 39);
      doc.text(`${formatDate(task.dueDate)} às ${task.dueTime || 'Culto'}`, margin + 140, textY);

      // Metadata Line 2: Status & Prioridade
      textY += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      doc.text('Status:', margin + 6, textY);
      doc.setTextColor(task.status === 'concluido' ? 16 : 17, task.status === 'concluido' ? 185 : 24, task.status === 'concluido' ? 129 : 39);
      doc.text(STATUS_NAMES[task.status] || task.status.toUpperCase(), margin + 17, textY);

      if (task.eventName) {
        doc.setTextColor(107, 114, 128);
        doc.text('Culto/Evento:', margin + 55, textY);
        doc.setTextColor(146, 64, 14);
        doc.text(task.eventName, margin + 74, textY);
      }

      // Checklist (if any)
      if (task.checklist && task.checklist.length > 0) {
        textY += 6;
        for (const ch of task.checklist) {
          doc.setDrawColor(ch.completed ? 16 : 156, ch.completed ? 185 : 163, ch.completed ? 129 : 175);
          doc.setFillColor(ch.completed ? 209 : 255, ch.completed ? 250 : 255, ch.completed ? 229 : 255);
          doc.rect(margin + 7, textY - 2.5, 2.8, 2.8, 'FD');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(ch.completed ? 107 : 31, ch.completed ? 114 : 41, ch.completed ? 128 : 55);
          doc.text(ch.text, margin + 12, textY);
          textY += 4.5;
        }
      }

      y += cardHeight + 4;
    }
  }

  // Associated Events Section
  checkPageBreak(30);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text('CULTOS & EVENTOS RELACIONADOS', margin, y);

  y += 5;

  const userEvents = events.filter((ev) =>
    (ev.responsibles && ev.responsibles.includes(user.name)) ||
    tasks.some((t) => t.eventId === ev.id || t.eventName === ev.name)
  );

  if (userEvents.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Nenhum culto com escala direta atribuído nominalmente na agenda.', margin + 6, y + 8.5);
    y += 20;
  } else {
    for (const ev of userEvents) {
      checkPageBreak(16);
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(146, 64, 14);
      doc.text(`• ${ev.name} — Data: ${formatDate(ev.date)} (${ev.category})`, margin + 5, y + 7.5);

      y += 15;
    }
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `IEADAM Petrópolis B · PT-B Mídia · Relatório Pessoal de Escalas e Afazeres`,
    pageWidth / 2,
    290,
    { align: 'center' }
  );

  const cleanUserName = user.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`escala_pessoal_${cleanUserName}.pdf`);
}

/**
 * 3. Generates an official Event Schedule PDF
 */
export function exportEventSchedulePDF(event: ChurchEvent, relatedTasks: TeamTask[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  // Top Bar
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(23, 23, 23);
  doc.text(CHURCH_NAME, margin, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(115, 115, 115);
  doc.text(MINISTRY_NAME, margin, y);

  y += 5;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  // Title
  y += 6;
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(245, 158, 11);
  doc.text('ESCALA OFICIAL DO CULTO / EVENTO', margin + 6, y + 7.5);

  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  doc.text(event.category, pageWidth - margin - 6, y + 7.5, { align: 'right' });

  // Event Card
  y += 18;
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(event.name, margin + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128);
  doc.text(`Data do Evento: ${formatDate(event.date)} · Categoria: ${event.category}`, margin + 6, y + 14);

  const respList = event.responsibles && event.responsibles.length > 0 ? event.responsibles.join(', ') : 'Equipe Geral';
  doc.text(`Equipe / Responsáveis: ${respList}`, margin + 6, y + 19);

  y += 32;

  // Tasks in this event
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(31, 41, 55);
  doc.text(`AFAZERES & ESCALAS DESIGNADAS (${relatedTasks.length})`, margin, y);

  y += 5;

  if (relatedTasks.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text('Nenhuma tarefa ou escala individual cadastrada para este evento.', margin + 6, y + 9);
    y += 20;
  } else {
    for (let i = 0; i < relatedTasks.length; i++) {
      const t = relatedTasks[i];
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(margin, y, contentWidth, 18, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(17, 24, 39);
      doc.text(`${i + 1}. ${t.title} [${CATEGORY_NAMES[t.category] || 'Mídia'}]`, margin + 5, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      doc.text(`Destinatário: ${t.assignedToName} | Solicitado por: ${t.createdByName} | Horário: ${t.dueTime || 'Culto'} | Status: ${STATUS_NAMES[t.status] || t.status}`, margin + 5, y + 12);

      y += 22;
    }
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `IEADAM Petrópolis B · PT-B Mídia · Escala Oficial do Evento`,
    pageWidth / 2,
    290,
    { align: 'center' }
  );

  const cleanName = event.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  doc.save(`escala_evento_${cleanName}.pdf`);
}
