import type { WCEntry, Rate, PlanItem, Welder } from './types';

export function normalizeArticle(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export function formatQty(n: number): string {
  return n.toFixed(2);
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function calcDayHours(entries: WCEntry[], rates: Rate[], date: string): number {
  const dayEntries = entries.filter((e) => e.date === date);
  let totalHours = 0;
  for (const entry of dayEntries) {
    const rate = rates.find((r) => r.article === entry.article);
    if (rate) {
      totalHours += rate.norm * entry.quantity;
    }
  }
  return totalHours;
}

export function calcOvertime(entries: WCEntry[], rates: Rate[], date: string): number {
  const totalHours = calcDayHours(entries, rates, date);
  return Math.max(0, totalHours - 8);
}

function isWorkday(dateISO: string): boolean {
  const d = new Date(dateISO + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun, 6=Sat
  return dow !== 0 && dow !== 6;
}

export function calcDayStats(
  entries: WCEntry[],
  rates: Rate[],
  overtimeByDate: Record<string, number>,
  sortedDates: string[]
): Map<string, { normalHours: number; overtimeHours: number }> {
  const result = new Map<string, { normalHours: number; overtimeHours: number }>();
  let pool = 0;

  for (const date of sortedDates) {
    const raw = calcDayHours(entries, rates, date);
    const workday = isWorkday(date);

    if (!workday) {
      // Выходной: показываем реально отработанное, пул не трогаем
      result.set(date, { normalHours: raw, overtimeHours: 0 });
      continue;
    }

    // Рабочий день
    // Переработка: либо из ручного значения, либо авто = max(0, raw - 8)
    const hasManualOvertime = date in overtimeByDate;
    const savedOvertime = hasManualOvertime ? overtimeByDate[date] : Math.max(0, raw - 8);

    if (raw >= 8) {
      // Выполнено >= 8ч: 8ч в норму, остаток в переработку/пул
      pool += savedOvertime;
      result.set(date, { normalHours: 8, overtimeHours: savedOvertime });
    } else if (raw === 0) {
      // Пустой рабочий день: пул покрывает смену (до 8ч)
      const fromPool = Math.min(pool, 8);
      pool -= fromPool;
      // Записей нет, но если пул покрыл — сохраняем для расчётов
      result.set(date, { normalHours: fromPool, overtimeHours: 0 });
    } else {
      // Частичный день: пул добирает до 8ч
      const deficit = 8 - raw;
      const fromPool = Math.min(pool, deficit);
      pool -= fromPool;
      result.set(date, { normalHours: raw + fromPool, overtimeHours: 0 });
    }
  }

  return result;
}

// --- ФИНАЛЬНАЯ ЛОГИКА РАЗДЕЛЕНИЯ ПЛАНОВ ---
export function recalcPlanCompleted(planItems: PlanItem[], allWelders: Welder[]): PlanItem[] {
  const today = todayISO();

  // Сначала собираем "закрытые" периоды, чтобы новые планы не лезли в них
  // Структура: Map<Артикул, МассивДатЗакрытия>
  const lockedDates = new Map<string, string[]>();
  planItems.forEach(p => {
    if (p.locked && p.completedDate) {
      if (!lockedDates.has(p.article)) lockedDates.set(p.article, []);
      lockedDates.get(p.article)!.push(p.completedDate);
    }
  });

  return planItems.map((item) => {
    
    // 1. Если план УЖЕ ЗАКРЫТ — мы его НЕ ПЕРЕСЧИТЫВАЕМ.
    // История неизменна. Это решает проблему "сегодняшнего дня".
    if (item.locked) {
      return item;
    }

    let completed = 0;
    const periodEnd = today; // Для активного плана считаем по сегодня

    // Получаем список дат закрытия для этого артикула (из старых планов)
    const articleLockedDates = lockedDates.get(item.article) || [];

    for (const welder of allWelders) {
      for (const entry of welder.entries) {
        if (entry.article !== item.article) continue;
        
        // Проверяем, что запись входит в окно [startDate, сегодня]
        if (entry.date >= item.startDate && entry.date <= periodEnd) {
          
          // 2. ГЛАВНАЯ ПРОВЕРКА:
          // Запись принадлежит старому плану только если:
          //   - дата записи <= даты закрытия старого плана
          //   - И дата закрытия старого плана строго < даты начала ТЕКУЩЕГО плана
          // Это гарантирует, что записи нового плана не "забирает" старый.
          const isClaimedByLockedPlan = articleLockedDates.some(
            lockDate => entry.date <= lockDate && lockDate < item.startDate
          );
          
          if (isClaimedByLockedPlan) {
            continue;
          }

          completed += entry.quantity;
        }
      }
    }

    const locked = completed >= item.target;
    return {
      ...item,
      completed,
      locked,
      // Если набрали норму, ставим дату закрытия
      completedDate: locked ? (item.completedDate ?? today) : null,
    };
  });
}

export function capitalizeFirst(str: string): string {
  const trimmed = str.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}