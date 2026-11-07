/**
 * Brazilian National Holidays, Festive Dates, and Church Commemorations
 * Computes exact holidays for any given Gregorian year (including dynamic Easter-based dates).
 */

export interface HolidayItem {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'nacional' | 'festiva' | 'igreja';
  description?: string;
  badge?: string;
}

/**
 * Calculates Easter Sunday for a given year using the Meeus/Jones/Butcher algorithm.
 */
function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Adds or subtracts days from a given date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Formats a Date object to YYYY-MM-DD string.
 */
function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Finds the nth day-of-week of a specific month.
 * e.g., 2nd Sunday of May (dayOfWeek = 0, n = 2, month = 4 [0-indexed])
 */
function getNthDayOfMonth(year: number, month: number, dayOfWeek: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const cur = new Date(year, month, day);
    if (cur.getMonth() !== month) break;
    if (cur.getDay() === dayOfWeek) {
      count++;
      if (count === n) {
        return cur;
      }
    }
  }
  return firstDay;
}

/**
 * Generates all Brazilian national holidays, cultural festive dates, and Christian church commemorations for a year.
 */
export function getHolidaysForYear(year: number): HolidayItem[] {
  const holidays: HolidayItem[] = [];

  // 1. Fixed National Holidays & Cultural Dates
  holidays.push({
    date: `${year}-01-01`,
    name: 'Confraternização Universal (Ano Novo)',
    type: 'nacional',
    badge: '🇧🇷 Feriado Nacional',
    description: 'Início do Ano Civil e Dia da Paz Mundial',
  });

  holidays.push({
    date: `${year}-04-21`,
    name: 'Tiradentes',
    type: 'nacional',
    badge: '🇧🇷 Feriado Nacional',
    description: 'Homenagem a Joaquim José da Silva Xavier',
  });

  holidays.push({
    date: `${year}-05-01`,
    name: 'Dia Mundial do Trabalho',
    type: 'nacional',
    badge: '🇧🇷 Feriado Nacional',
    description: 'Celebração e valorização de todos os trabalhadores',
  });

  holidays.push({
    date: `${year}-09-07`,
    name: 'Independência do Brasil',
    type: 'nacional',
    badge: '🇧🇷 Feriado Nacional',
    description: 'Proclamação da Independência da Pátria (1822)',
  });

  holidays.push({
    date: `${year}-10-12`,
    name: 'Nossa Senhora Aparecida / Dia das Crianças',
    type: 'nacional',
    badge: '🇧🇷 Feriado Nacional',
    description: 'Feriado Nacional e Celebração do Dia das Crianças',
  });

  holidays.push({
    date: `${year}-10-31`,
    name: 'Dia da Reforma Protestante',
    type: 'igreja',
    badge: '📖 Data Histórica',
    description: 'Celebração das 95 Teses de Martinho Lutero e retorno às Escrituras',
  });

  holidays.push({
    date: `${year}-11-02`,
    name: 'Finados',
    type: 'nacional',
    badge: '🇧🇷 Feriado Nacional',
    description: 'Dia de reflexão e memória aos entes queridos',
  });

  holidays.push({
    date: `${year}-11-15`,
    name: 'Proclamação da República',
    type: 'nacional',
    badge: '🇧🇷 Feriado Nacional',
    description: 'Marco da instauração da República no Brasil (1889)',
  });

  holidays.push({
    date: `${year}-11-20`,
    name: 'Dia Nacional de Zumbi e da Consciência Negra',
    type: 'nacional',
    badge: '🇧🇷 Feriado Nacional',
    description: 'Feriado Nacional de valorização da história e cultura afro-brasileira (Lei 14.759/23)',
  });

  holidays.push({
    date: `${year}-12-24`,
    name: 'Véspera de Natal',
    type: 'festiva',
    badge: '🌟 Data Festiva',
    description: 'Culto de Véspera de Natal e comunhão das famílias',
  });

  holidays.push({
    date: `${year}-12-25`,
    name: 'Natal (Nascimento de Jesus Cristo)',
    type: 'nacional',
    badge: '✝️ Natal do Senhor',
    description: 'Celebração do Nascimento do Salvador Jesus Cristo',
  });

  holidays.push({
    date: `${year}-12-31`,
    name: 'Véspera de Ano Novo / Culto da Virada',
    type: 'igreja',
    badge: '🔥 Culto da Virada',
    description: 'Grande culto de agradecimento e consagração do novo ano',
  });

  // 2. Dynamic Easter-Based Holidays & Celebrations
  const easter = getEasterSunday(year);
  const easterDate = new Date(year, easter.month - 1, easter.day);

  // Carnaval (47 days before Easter)
  const carnivalTuesday = addDays(easterDate, -47);
  holidays.push({
    date: toDateString(carnivalTuesday),
    name: 'Carnaval (Terça-feira)',
    type: 'festiva',
    badge: '🎭 Ponto Facultativo',
    description: 'Período tradicional de Retiros Espirituais e Congressos da Igreja',
  });

  // Quarta-feira de Cinzas (46 days before Easter)
  const ashWednesday = addDays(easterDate, -46);
  holidays.push({
    date: toDateString(ashWednesday),
    name: 'Quarta-feira de Cinzas',
    type: 'festiva',
    badge: '🕊️ Período de Consagração',
    description: 'Início da reflexão quaresmal',
  });

  // Sexta-feira Santa (Paixão de Cristo) (2 days before Easter)
  const goodFriday = addDays(easterDate, -2);
  holidays.push({
    date: toDateString(goodFriday),
    name: 'Sexta-feira Santa (Paixão de Cristo)',
    type: 'nacional',
    badge: '✝️ Feriado Religioso',
    description: 'Memória do sacrifício de Jesus Cristo na cruz por nossos pecados',
  });

  // Domingo de Páscoa (Ressurreição)
  holidays.push({
    date: toDateString(easterDate),
    name: 'Domingo de Páscoa (Ressurreição de Cristo)',
    type: 'igreja',
    badge: '👑 Ressurreição',
    description: 'Celebração da vitória de Cristo sobre a morte: Ele vive!',
  });

  // Corpus Christi (60 days after Easter)
  const corpusChristi = addDays(easterDate, 60);
  holidays.push({
    date: toDateString(corpusChristi),
    name: 'Corpus Christi',
    type: 'festiva',
    badge: '🕊️ Feriado Municipal / Facultativo',
    description: 'Celebração e feriado religioso tradicional',
  });

  // 3. Dynamic Commemorative Days for Church & Families
  // Dia das Mães: 2º domingo de maio
  const mothersDay = getNthDayOfMonth(year, 4, 0, 2);
  holidays.push({
    date: toDateString(mothersDay),
    name: 'Dia das Mães (Culto Especial)',
    type: 'igreja',
    badge: '💐 Homenagem às Mães',
    description: 'Culto especial de honra e gratidão a todas as mães',
  });

  // Dia do Pastor: 2º domingo de junho
  const pastorsDay = getNthDayOfMonth(year, 5, 0, 2);
  holidays.push({
    date: toDateString(pastorsDay),
    name: 'Dia do Pastor & Ministério Pastoral',
    type: 'igreja',
    badge: '⛪ Dia do Pastor',
    description: 'Gratidão a Deus pela liderança pastoral e ministerial da igreja',
  });

  // Dia dos Pais: 2º domingo de agosto
  const fathersDay = getNthDayOfMonth(year, 7, 0, 2);
  holidays.push({
    date: toDateString(fathersDay),
    name: 'Dia dos Pais (Culto Especial)',
    type: 'igreja',
    badge: '👔 Homenagem aos Pais',
    description: 'Culto especial de honra e oração por todos os pais e famílias',
  });

  // Dia Nacional de Ação de Graças: 4ª quinta-feira de novembro
  const thanksgiving = getNthDayOfMonth(year, 10, 4, 4);
  holidays.push({
    date: toDateString(thanksgiving),
    name: 'Dia Nacional de Ação de Graças',
    type: 'igreja',
    badge: '🙏 Ação de Graças',
    description: 'Momento de gratidão a Deus por todas as vitórias e bênçãos',
  });

  // Dia da Bíblia: 2º domingo de dezembro
  const bibleDay = getNthDayOfMonth(year, 11, 0, 2);
  holidays.push({
    date: toDateString(bibleDay),
    name: 'Dia da Bíblia Sagrada',
    type: 'igreja',
    badge: '📜 Dia da Bíblia',
    description: 'Celebração e gratidão pela Palavra de Deus viva e eficaz',
  });

  // Sort by date chronologically
  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Returns all holidays for a specific month (1-indexed: 1 = Jan, 12 = Dec).
 */
export function getHolidaysForMonth(year: number, month: number): HolidayItem[] {
  const monthStr = String(month).padStart(2, '0');
  const prefix = `${year}-${monthStr}-`;
  return getHolidaysForYear(year).filter((h) => h.date.startsWith(prefix));
}

/**
 * Returns holiday for a specific date (YYYY-MM-DD) if any.
 */
export function getHolidayForDate(dateStr: string): HolidayItem | undefined {
  if (!dateStr) return undefined;
  const [yearStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  if (isNaN(year)) return undefined;
  const holidays = getHolidaysForYear(year);
  return holidays.find((h) => h.date === dateStr);
}
