import { ChurchEvent, TeamTask } from '../types.js';
import { HolidayItem } from './holidays.js';

const CHURCH_NAME = 'IEADAM PETRÓPOLIS B';
const MINISTRY_NAME = 'MINISTÉRIO DE MÍDIA & COMUNICAÇÃO';

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

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}

/**
 * Exports full month calendar as high-res 1920x1080 PNG image.
 */
export function exportMonthCalendarImage(
  year: number,
  month: number, // 1-indexed (1-12)
  events: ChurchEvent[],
  tasks: TeamTask[],
  holidays: HolidayItem[]
) {
  const width = 1920;
  const height = 1080;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0c0c0e');
  bgGrad.addColorStop(0.5, '#121216');
  bgGrad.addColorStop(1, '#09090b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Top Amber decorative bar
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, width, 8);

  // Header Church branding
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(CHURCH_NAME, 60, 60);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '500 16px sans-serif';
  ctx.fillText(MINISTRY_NAME, 60, 88);

  // Month & Year title
  const monthName = MONTH_NAMES[month - 1];
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f59e0b';
  ctx.font = '900 36px sans-serif';
  ctx.fillText(`${monthName} ${year}`, width - 60, 60);

  ctx.fillStyle = '#6b7280';
  ctx.font = '400 14px sans-serif';
  ctx.fillText('CALENDÁRIO OFICIAL DE CULTOS, EVENTOS E DATAS FESTIVAS', width - 60, 88);
  ctx.textAlign = 'left';

  // Divider
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 110);
  ctx.lineTo(width - 60, 110);
  ctx.stroke();

  // Weekday column headers
  const startX = 60;
  const startY = 130;
  const gridWidth = width - 120;
  const colWidth = gridWidth / 7;
  const headerHeight = 44;

  ctx.fillStyle = '#18181b';
  ctx.fillRect(startX, startY, gridWidth, headerHeight);

  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 1;
  ctx.strokeRect(startX, startY, gridWidth, headerHeight);

  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 7; i++) {
    const colX = startX + i * colWidth;
    ctx.fillStyle = i === 0 ? '#f59e0b' : '#e4e4e7';
    ctx.fillText(WEEKDAYS[i], colX + colWidth / 2, startY + 28);
  }

  // Calendar Matrix
  const gridY = startY + headerHeight;
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const totalSlots = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const numRows = totalSlots / 7;
  const availableHeight = height - gridY - 60;
  const rowHeight = availableHeight / numRows;

  let currentDay = 1;
  let nextMonthDay = 1;

  ctx.textAlign = 'left';

  for (let row = 0; row < numRows; row++) {
    const rY = gridY + row * rowHeight;

    for (let col = 0; col < 7; col++) {
      const cX = startX + col * colWidth;
      const slotIndex = row * 7 + col;

      let dayNum = 0;
      let isCurMonth = false;
      let dateStr = '';

      if (slotIndex < firstDay) {
        dayNum = prevMonthDays - firstDay + slotIndex + 1;
        isCurMonth = false;
        const prevM = month === 1 ? 12 : month - 1;
        const prevY = month === 1 ? year - 1 : year;
        dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      } else if (currentDay <= daysInMonth) {
        dayNum = currentDay;
        isCurMonth = true;
        dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        currentDay++;
      } else {
        dayNum = nextMonthDay;
        isCurMonth = false;
        const nextM = month === 12 ? 1 : month + 1;
        const nextY = month === 12 ? year + 1 : year;
        dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        nextMonthDay++;
      }

      const holiday = holidays.find((h) => h.date === dateStr);
      const dayEvents = events.filter((e) => e.date === dateStr);
      const dayTasks = tasks.filter((t) => t.dueDate === dateStr);

      // Cell Fill
      if (!isCurMonth) {
        ctx.fillStyle = '#121215';
      } else if (holiday) {
        ctx.fillStyle = '#221b10'; // Subtle warm amber
      } else if (col === 0) {
        ctx.fillStyle = '#16161a';
      } else {
        ctx.fillStyle = '#18181c';
      }
      ctx.fillRect(cX, rY, colWidth, rowHeight);

      // Border
      ctx.strokeStyle = holiday && isCurMonth ? '#78350f' : '#27272a';
      ctx.lineWidth = 1;
      ctx.strokeRect(cX, rY, colWidth, rowHeight);

      // Day Number
      ctx.font = 'bold 16px sans-serif';
      if (!isCurMonth) {
        ctx.fillStyle = '#52525b';
      } else if (holiday) {
        ctx.fillStyle = '#f59e0b';
      } else if (col === 0) {
        ctx.fillStyle = '#fbbf24';
      } else {
        ctx.fillStyle = '#f4f4f5';
      }
      ctx.fillText(String(dayNum), cX + 12, rY + 26);

      let textY = rY + 46;

      // Holiday Label
      if (holiday && isCurMonth) {
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`★ ${holiday.name.substring(0, 26)}`, cX + 10, textY);
        textY += 18;
      }

      // Events & Times
      if (isCurMonth) {
        ctx.font = '500 12px sans-serif';
        for (const evt of dayEvents) {
          if (textY > rY + rowHeight - 8) break;
          ctx.fillStyle = '#ffffff';
          const time = evt.time ? `${evt.time} ` : '';
          ctx.fillText(`• ${time}${evt.name.substring(0, 24)}`, cX + 10, textY);
          textY += 17;
        }

        ctx.font = '400 11px sans-serif';
        for (const t of dayTasks) {
          if (textY > rY + rowHeight - 8) break;
          ctx.fillStyle = '#a1a1aa';
          const tTime = t.dueTime ? `${t.dueTime} ` : '';
          ctx.fillText(`- ${tTime}${t.title.substring(0, 24)}`, cX + 10, textY);
          textY += 16;
        }
      }
    }
  }

  // Footer
  ctx.fillStyle = '#71717a';
  ctx.font = '400 13px sans-serif';
  ctx.fillText('IEADAM PETRÓPOLIS B — Ministério de Mídia & Comunicação · Calendário Oficial', 60, height - 24);

  ctx.textAlign = 'right';
  ctx.fillText(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, width - 60, height - 24);

  downloadCanvas(canvas, `calendario_${monthName.toLowerCase()}_${year}_ieadam.png`);
}

/**
 * Exports single day agenda as vertical 1080x1350 card PNG (ideal for WhatsApp / Stories).
 */
export function exportDayAgendaImage(
  dateStr: string,
  dayEvents: ChurchEvent[],
  dayTasks: TeamTask[],
  holiday?: HolidayItem | null
) {
  const width = 1080;
  const height = 1350;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0c0c0e');
  bgGrad.addColorStop(0.3, '#141418');
  bgGrad.addColorStop(1, '#09090b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Top Accent Bar
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, width, 12);

  // Church Name & Badge
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(CHURCH_NAME, 70, 80);

  ctx.fillStyle = '#f59e0b';
  ctx.font = '600 18px sans-serif';
  ctx.fillText('MINISTÉRIO DE MÍDIA & COMUNICAÇÃO', 70, 115);

  // Date formatted
  const [yStr, mStr, dStr] = dateStr.split('-');
  const dateObj = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, parseInt(dStr, 10));
  const weekdayName = WEEKDAYS[dateObj.getDay()];
  const monthName = MONTH_NAMES[parseInt(mStr, 10) - 1];

  let currentY = 180;

  // Big Date Header Box
  ctx.fillStyle = '#18181b';
  ctx.fillRect(70, currentY, width - 140, 130);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.strokeRect(70, currentY, width - 140, 130);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(weekdayName, 100, currentY + 45);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 46px sans-serif';
  ctx.fillText(`${parseInt(dStr, 10)} DE ${monthName} DE ${yStr}`, 100, currentY + 100);

  currentY += 160;

  // Holiday / Festive Callout
  if (holiday) {
    ctx.fillStyle = '#291b07';
    ctx.fillRect(70, currentY, width - 140, 70);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(70, currentY, width - 140, 70);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`★ ${holiday.name}`, 100, currentY + 42);

    currentY += 95;
  }

  // Section: Cultos & Horários
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('CULTOS & HORÁRIOS DO DIA', 70, currentY);

  currentY += 25;

  if (dayEvents.length === 0) {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(70, currentY, width - 140, 70);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '18px sans-serif';
    ctx.fillText('Nenhum culto principal cadastrado para este dia.', 100, currentY + 42);
    currentY += 95;
  } else {
    for (const evt of dayEvents) {
      if (currentY > 800) break;
      ctx.fillStyle = '#1f1f23';
      ctx.fillRect(70, currentY, width - 140, 110);
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 1;
      ctx.strokeRect(70, currentY, width - 140, 110);

      // Time tag
      const timeText = evt.time ? evt.time : 'DIA TODO';
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(timeText, 100, currentY + 45);

      // Event Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(evt.name, 240, currentY + 45);

      // Location & Category
      ctx.fillStyle = '#9ca3af';
      ctx.font = '17px sans-serif';
      const locText = evt.location ? `Local: ${evt.location}  ·  ` : '';
      const respText = evt.responsibles?.length ? `Responsáveis: ${evt.responsibles.join(', ')}` : '';
      ctx.fillText(`${locText}${evt.category}  ·  ${respText}`, 100, currentY + 85);

      currentY += 130;
    }
  }

  // Section: Escala da Equipe de Mídia
  currentY += 20;
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('ESCALA DA EQUIPE TÉCNICA DE MÍDIA', 70, currentY);

  currentY += 25;

  if (dayTasks.length === 0) {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(70, currentY, width - 140, 70);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '18px sans-serif';
    ctx.fillText('Nenhum posto de mídia individual registrado para hoje.', 100, currentY + 42);
  } else {
    for (const task of dayTasks.slice(0, 4)) {
      if (currentY > 1200) break;
      ctx.fillStyle = '#18181b';
      ctx.fillRect(70, currentY, width - 140, 65);
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      ctx.strokeRect(70, currentY, width - 140, 65);

      const tTime = task.dueTime ? `${task.dueTime}` : '--:--';
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(tTime, 95, currentY + 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 18px sans-serif';
      ctx.fillText(task.title.substring(0, 32), 180, currentY + 40);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`👤 ${task.assignedToName}`, width - 100, currentY + 40);
      ctx.textAlign = 'left';

      currentY += 75;
    }
  }

  // Footer Card
  ctx.fillStyle = '#52525b';
  ctx.font = '14px sans-serif';
  ctx.fillText('IEADAM PETRÓPOLIS B · MINISTÉRIO DE MÍDIA E COMUNICAÇÃO', 70, height - 35);

  ctx.textAlign = 'right';
  ctx.fillText(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, width - 70, height - 35);

  downloadCanvas(canvas, `agenda_${dStr}_${mStr}_${yStr}_ieadam.png`);
}
