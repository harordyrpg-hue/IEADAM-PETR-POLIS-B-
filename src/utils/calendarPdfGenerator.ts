import { jsPDF } from 'jspdf';
import { ChurchEvent, TeamTask } from '../types.js';
import { HolidayItem } from './holidays.js';

const CHURCH_NAME = 'IEADAM PETRÓPOLIS B';
const MINISTRY_NAME = 'MINISTÉRIO DE MÍDIA & COMUNICAÇÃO — PT-B MÍDIA';

const MONTH_NAMES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
];

const WEEKDAYS = [
  'DOMINGO',
  'SEGUNDA',
  'TERÇA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SÁBADO',
];

/**
 * Generates an official professional Full Month Calendar in A4 Landscape.
 */
export function exportMonthCalendarPDF(
  year: number,
  month: number, // 1-indexed (1 = Jan, 12 = Dec)
  events: ChurchEvent[],
  tasks: TeamTask[],
  holidays: HolidayItem[]
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 10;

  // 1. Top Decorative Brand Bar
  doc.setFillColor(217, 119, 6); // Amber 600
  doc.rect(0, 0, pageWidth, 4, 'F');

  // 2. Official Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(23, 23, 23);
  doc.text(CHURCH_NAME, margin, y + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(115, 115, 115);
  doc.text(MINISTRY_NAME, margin, y + 6);

  const monthName = MONTH_NAMES[month - 1];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(180, 83, 9); // Amber 700
  doc.text(`CALENDÁRIO OFICIAL — ${monthName} DE ${year}`, pageWidth - margin, y + 3, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(115, 115, 115);
  doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, y + 7, { align: 'right' });

  y += 10;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  // 3. Weekday Column Headers
  y += 3;
  const colWidth = contentWidth / 7;
  const headerHeight = 7;

  doc.setFillColor(24, 24, 27); // Zinc 900
  doc.rect(margin, y, contentWidth, headerHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(245, 158, 11); // Amber 500

  for (let i = 0; i < 7; i++) {
    const colX = margin + i * colWidth;
    doc.text(WEEKDAYS[i], colX + colWidth / 2, y + 4.8, { align: 'center' });
  }

  y += headerHeight;

  // 4. Calculate Calendar Matrix Days
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  // Matrix will have 5 or 6 rows
  const totalSlots = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;
  const numRows = totalSlots / 7;
  const availableGridHeight = pageHeight - y - 18;
  const rowHeight = availableGridHeight / numRows;

  let currentDay = 1;
  let nextMonthDay = 1;

  for (let row = 0; row < numRows; row++) {
    const rowY = y + row * rowHeight;

    for (let col = 0; col < 7; col++) {
      const colX = margin + col * colWidth;
      const slotIndex = row * 7 + col;

      let dayNum = 0;
      let isCurrentMonth = false;
      let dateStr = '';

      if (slotIndex < firstDayOfMonth) {
        // Prev month day
        dayNum = prevMonthDays - firstDayOfMonth + slotIndex + 1;
        isCurrentMonth = false;
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      } else if (currentDay <= daysInMonth) {
        // Current month day
        dayNum = currentDay;
        isCurrentMonth = true;
        dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        currentDay++;
      } else {
        // Next month day
        dayNum = nextMonthDay;
        isCurrentMonth = false;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        nextMonthDay++;
      }

      // Find events and holidays for this date
      const holiday = holidays.find((h) => h.date === dateStr);
      const dayEvents = events.filter((e) => e.date === dateStr);
      const dayTasks = tasks.filter((t) => t.dueDate === dateStr);

      // Cell Background
      if (!isCurrentMonth) {
        doc.setFillColor(249, 250, 251); // Gray 50
      } else if (holiday) {
        doc.setFillColor(254, 243, 199); // Amber 100 for holidays
      } else if (col === 0) {
        doc.setFillColor(255, 251, 235); // Light warm for Sunday
      } else {
        doc.setFillColor(255, 255, 255);
      }

      doc.rect(colX, rowY, colWidth, rowHeight, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.2);
      doc.rect(colX, rowY, colWidth, rowHeight, 'S');

      // Day Number Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);

      if (!isCurrentMonth) {
        doc.setTextColor(156, 163, 175);
      } else if (holiday) {
        doc.setTextColor(180, 83, 9);
      } else if (col === 0) {
        doc.setTextColor(217, 119, 6);
      } else {
        doc.setTextColor(17, 24, 39);
      }

      doc.text(String(dayNum), colX + 2.5, rowY + 4);

      // Holiday Badge in Cell
      let textY = rowY + 6.5;

      if (holiday && isCurrentMonth) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(180, 83, 9);
        const holText = doc.splitTextToSize(holiday.name, colWidth - 4);
        doc.text(holText[0] || holiday.name, colX + 2, textY);
        textY += 3.5;
      }

      // Scheduled Events & Times in Cell
      if (isCurrentMonth) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.2);

        // Render Church Events
        for (const evt of dayEvents) {
          if (textY > rowY + rowHeight - 2) break;
          doc.setTextColor(17, 24, 39);
          const timePrefix = evt.time ? `${evt.time} ` : '';
          const evtLine = `${timePrefix}${evt.name}`;
          const trimmed = doc.splitTextToSize(evtLine, colWidth - 4)[0];
          doc.text(`• ${trimmed}`, colX + 2, textY);
          textY += 3;
        }

        // Render Key Media Tasks
        for (const t of dayTasks) {
          if (textY > rowY + rowHeight - 2) break;
          doc.setTextColor(75, 85, 99);
          const tTime = t.dueTime ? `${t.dueTime} ` : '';
          const taskLine = `${tTime}${t.title}`;
          const trimmed = doc.splitTextToSize(taskLine, colWidth - 4)[0];
          doc.text(`- ${trimmed}`, colX + 2, textY);
          textY += 3;
        }
      }
    }
  }

  // 5. Bottom Legend / Footer
  const footerY = pageHeight - 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);

  const legendText = 'Legenda: 🇧🇷 Feriados Nacionais & Datas Festivas destacados em dourado · Cultos e horários oficiais da IEADAM PETRÓPOLIS B';
  doc.text(legendText, margin, footerY);
  doc.text(`Página 1 de 1 · Mídia & Comunicação IEADAM`, pageWidth - margin, footerY, { align: 'right' });

  // 6. Save PDF
  const filename = `calendario_${monthName.toLowerCase()}_${year}_ieadam_petropolis_b.pdf`;
  doc.save(filename);
}

/**
 * Generates an official professional Single Day Agenda in A4 Portrait.
 */
export function exportDayAgendaPDF(
  dateStr: string, // YYYY-MM-DD
  dayEvents: ChurchEvent[],
  dayTasks: TeamTask[],
  holiday?: HolidayItem | null
) {
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

  // 2. Official Header
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
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - margin, y, { align: 'right' });

  y += 5;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);

  // 3. Document Title Banner
  y += 6;
  doc.setFillColor(24, 24, 27); // Dark zinc container
  doc.roundedRect(margin, y, contentWidth, 13, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(245, 158, 11); // Amber text
  doc.text('AGENDA DIÁRIA, HORÁRIOS & ESCALA OFICIAL', margin + 6, y + 8);

  const [yStr, mStr, dStr] = dateStr.split('-');
  const formattedDate = `${dStr}/${mStr}/${yStr}`;
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(formattedDate, pageWidth - margin - 6, y + 8, { align: 'right' });

  // 4. Date Full Title Heading
  y += 18;
  const dateObj = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10));
  const weekdayName = WEEKDAYS[dateObj.getDay()];
  const fullDateText = `${weekdayName}, ${parseInt(dStr, 10)} DE ${MONTH_NAMES[parseInt(mStr, 10) - 1]} DE ${yStr}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  doc.text(fullDateText, margin, y);

  // 5. Holiday notice if applicable
  if (holiday) {
    y += 5;
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 9, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9);
    doc.text(`★ ${holiday.name} — ${holiday.badge || 'Feriado / Comemoração'}`, margin + 4, y + 6);
    y += 10;
  } else {
    y += 5;
  }

  // 6. Timeline of Scheduled Events & Services
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('1. CULTOS, HORÁRIOS & ATIVIDADES DO DIA', margin, y + 3);

  y += 6;

  if (dayEvents.length === 0) {
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, y, contentWidth, 12, 1, 1, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(115, 115, 115);
    doc.text('Nenhum culto principal ou evento especial cadastrado para este dia.', margin + 4, y + 7.5);
    y += 16;
  } else {
    for (const evt of dayEvents) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, 18, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(evt.name, margin + 4, y + 6);

      const timeLabel = evt.time ? `Horário: ${evt.time}` : 'Dia Todo';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(217, 119, 6);
      doc.text(timeLabel, pageWidth - margin - 4, y + 6, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const locText = evt.location ? `Local: ${evt.location}  ·  ` : '';
      const catText = `Categoria: ${evt.category}`;
      const respText = evt.responsibles?.length ? `  ·  Responsáveis: ${evt.responsibles.join(', ')}` : '';
      doc.text(`${locText}${catText}${respText}`, margin + 4, y + 11);

      if (evt.description || evt.notes) {
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        const desc = evt.notes || evt.description;
        doc.text(`Notas: ${desc.substring(0, 100)}`, margin + 4, y + 15);
      }

      y += 21;
    }
  }

  // 7. Team Duties & Technical Roles (Escala Técnica de Mídia)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(17, 24, 39);
  doc.text('2. ESCALA DA EQUIPE DE MÍDIA & TAREFAS DESIGNADAS', margin, y + 2);

  y += 5;

  if (dayTasks.length === 0) {
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(margin, y, contentWidth, 12, 1, 1, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(115, 115, 115);
    doc.text('Nenhuma tarefa ou escala técnica registrada individualmente para este dia.', margin + 4, y + 7.5);
    y += 16;
  } else {
    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);

    doc.text('HORA', margin + 3, y + 4.2);
    doc.text('POSTO / TAREFA', margin + 22, y + 4.2);
    doc.text('ESCALADO', margin + 85, y + 4.2);
    doc.text('SOLICITADO POR', margin + 130, y + 4.2);
    doc.text('STATUS', pageWidth - margin - 3, y + 4.2, { align: 'right' });

    y += 6;

    for (const t of dayTasks) {
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 7, pageWidth - margin, y + 7);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(17, 24, 39);
      doc.text(t.dueTime || '--:--', margin + 3, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.text(t.title.substring(0, 35), margin + 22, y + 4.5);
      doc.text(t.assignedToName.substring(0, 24), margin + 85, y + 4.5);
      doc.text((t.createdByName || 'Liderança').substring(0, 24), margin + 130, y + 4.5);

      doc.setFont('helvetica', 'bold');
      const stColor = t.status === 'concluido' ? [22, 163, 74] : t.status === 'em_andamento' ? [2, 132, 199] : [100, 116, 139];
      doc.setTextColor(stColor[0], stColor[1], stColor[2]);
      const statusLabel = t.status === 'concluido' ? 'CONCLUÍDO' : t.status === 'em_andamento' ? 'EM ANDAMENTO' : 'PENDENTE';
      doc.text(statusLabel, pageWidth - margin - 3, y + 4.5, { align: 'right' });

      y += 8;
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
    }
  }

  // 8. Footer
  const footerY = 285;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text(`${CHURCH_NAME} · Ministério de Mídia & Comunicação — Documento de Circulação Interna`, margin, footerY);
  doc.text(`Página 1 de 1`, pageWidth - margin, footerY, { align: 'right' });

  // 9. Save PDF
  const filename = `agenda_${dStr}_${mStr}_${yStr}_ieadam.pdf`;
  doc.save(filename);
}
