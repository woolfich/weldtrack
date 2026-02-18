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

export function calcOvertime(entries: WCEntry[], rates: Rate[], date: string): number {
  const dayEntries = entries.filter((e) => e.date === date);
  let totalHours = 0;
  for (const entry of dayEntries) {
    const rate = rates.find((r) => r.article === entry.article);
    if (rate) {
      totalHours += rate.norm * entry.quantity;
    }
  }
  return Math.max(0, totalHours - 8);
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
