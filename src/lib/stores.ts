import { writable, get } from 'svelte/store';
import type { Writable } from 'svelte/store';
import type { Welder, Rate, PlanItem } from './types';
import { recalcPlanCompleted } from './utils';

function createPersistedStore<T>(key: string, initial: T): Writable<T> {
  let stored: T = initial;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        stored = JSON.parse(raw) as T;
      } catch {
        stored = initial;
      }
    }
  }

  const store = writable<T>(stored);

  store.subscribe((value) => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });

  return store;
}

export const welders = createPersistedStore<Welder[]>('weldtrack_welders', []);
export const rates = createPersistedStore<Rate[]>('weldtrack_rates', []);
export const planItems = createPersistedStore<PlanItem[]>('weldtrack_plan', []);

// Cross-store reactivity: when welders change, recalc plan completed
welders.subscribe((w) => {
  const plan = get(planItems);
  if (plan.length > 0) {
    const updated = recalcPlanCompleted(plan, w);
    // Only update if something changed to avoid infinite loop
    const changed = updated.some(
      (item, i) => item.completed !== plan[i].completed || item.locked !== plan[i].locked
    );
    if (changed) {
      planItems.set(updated);
    }
  }
});

export function exportData(): string {
  const data = {
    welders: get(welders),
    rates: get(rates),
    planItems: get(planItems),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export function importData(json: string): void {
  const data = JSON.parse(json);

  if (data.rates && Array.isArray(data.rates)) {
    const existingRates = get(rates);
    const newRates = data.rates.filter(
      (r: Rate) => !existingRates.some((er) => er.article === r.article)
    );
    rates.update((existing) => [...existing, ...newRates]);
  }

  if (data.planItems && Array.isArray(data.planItems)) {
    const existingPlan = get(planItems);
    const newPlan = data.planItems.filter(
      (p: PlanItem) => !existingPlan.some((ep) => ep.article === p.article)
    );
    planItems.update((existing) => [...existing, ...newPlan]);
  }

  if (data.welders && Array.isArray(data.welders)) {
    welders.update((existing) => {
      const result = [...existing];
      for (const imported of data.welders as Welder[]) {
        const existingIdx = result.findIndex((w) => w.lastName === imported.lastName);
        if (existingIdx >= 0) {
          // Merge entries
          const existingEntryIds = new Set(result[existingIdx].entries.map((e) => e.id));
          const newEntries = imported.entries.filter((e) => !existingEntryIds.has(e.id));
          result[existingIdx] = {
            ...result[existingIdx],
            entries: [...result[existingIdx].entries, ...newEntries],
            overtime: { ...imported.overtime, ...result[existingIdx].overtime },
            overtimeManual: {
              ...imported.overtimeManual,
              ...result[existingIdx].overtimeManual,
            },
          };
        } else {
          result.push(imported);
        }
      }
      return result;
    });
  }

  // Recalc plan after import
  const allWelders = get(welders);
  planItems.update((plan) => recalcPlanCompleted(plan, allWelders));
}
