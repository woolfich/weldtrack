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

/** Возвращает суммарные часы выработки за конкретный день (без вычитания нормы) */
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

/**
 * Считает переработку за конкретный день как Math.max(0, totalHours - 8).
 * Используется при добавлении/редактировании записи для авторасчёта.
 */
export function calcOvertime(entries: WCEntry[], rates: Rate[], date: string): number {
  const totalHours = calcDayHours(entries, rates, date);
  return Math.max(0, totalHours - 8);
}

/**
 * Считает отображаемые часы для каждого дня с учётом накопленного пула переработки.
 *
 * overtimeByDate — welder.overtime, может содержать вручную исправленные значения
 * sortedDates — все даты по возрастанию (от старых к новым)
 *
 * Логика:
 *   - raw >= 8: normalHours = 8, overtimeHours = overtime[date], пул += overtimeHours
 *   - raw < 8:  берём из пула сколько нужно до 8ч
 *               normalHours = raw + fromPool, overtimeHours = 0
 *
 * Пул пополняется на значение из overtime[date] (может быть вручную исправлено),
 * а не на raw - 8. Это позволяет ручному редактированию переработки влиять на пул.
 */
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
    const savedOvertime = overtimeByDate[date] ?? Math.max(0, raw - 8);

    if (raw >= 8) {
      pool += savedOvertime;
      result.set(date, { normalHours: 8, overtimeHours: savedOvertime });
    } else {
      const deficit = 8 - raw;
      const fromPool = Math.min(pool, deficit);
      pool -= fromPool;
      result.set(date, { normalHours: raw + fromPool, overtimeHours: 0 });
    }
  }

  return result;
}

export function recalcPlanCompleted(planItems: PlanItem[], allWelders: Welder[]): PlanItem[] {
  return planItems.map((item) => {
    let completed = 0;
    for (const welder of allWelders) {
      for (const entry of welder.entries) {
        if (entry.article === item.article) {
          completed += entry.quantity;
        }
      }
    }
    return {
      ...item,
      completed,
      locked: completed >= item.target,
    };
  });
}

export function capitalizeFirst(str: string): string {
  const trimmed = str.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}