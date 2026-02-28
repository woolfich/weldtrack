<script lang="ts">
  import { goto } from '$app/navigation';
  import { welders, rates, planItems, exportData, importData } from '$lib/stores';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import { capitalizeFirst, todayISO, formatQty } from '$lib/utils';
  import { v4 as uuidv4 } from 'uuid';
  import type { Welder } from '$lib/types';

  let newLastName = '';
  let showInfoModal = false;
  let infoModalWelder: Welder | null = null;
  let showDeleteModal = false;
  let deleteTargetId = '';
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  function addWelder() {
    const name = capitalizeFirst(newLastName);
    if (!name) return;
    welders.update((list) => [
      ...list,
      { id: uuidv4(), lastName: name, entries: [], overtime: {}, overtimeManual: {} },
    ]);
    newLastName = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') addWelder();
  }

  function openInfo(welder: Welder) {
    infoModalWelder = welder;
    showInfoModal = true;
  }

  function startLongPress(welderId: string) {
    longPressTimer = setTimeout(() => {
      deleteTargetId = welderId;
      showDeleteModal = true;
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer) clearTimeout(longPressTimer);
  }

  function confirmDelete() {
    welders.update((list) => list.filter((w) => w.id !== deleteTargetId));
    showDeleteModal = false;
    deleteTargetId = '';
  }

  function handleExport() {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weldtrack-export-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        importData(text);
        alert('Данные успешно импортированы.');
      } catch (e) {
        alert('Ошибка чтения файла. Проверьте формат JSON.');
      }
    };
    input.click();
  }

  function todaySummary(welder: Welder): string {
    const today = todayISO();
    const todayEntries = welder.entries.filter((e) => e.date === today);
    if (!todayEntries.length) return '';
    return todayEntries
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((e) => `${e.article} ${formatQty(e.quantity)} шт`)
      .join('; ');
  }

  function allTimeSummary(welder: Welder): string {
    const map = new Map<string, number>();
    for (const e of welder.entries) {
      map.set(e.article, (map.get(e.article) ?? 0) + e.quantity);
    }
    return [...map.entries()].map(([art, qty]) => `${art} ${formatQty(qty)} шт`).join('\n');
  }
</script>

<div class="page-container">
  <div class="top-panel">
    <div style="display:flex; gap:8px; align-items:center;">
      <input
        type="text"
        bind:value={newLastName}
        placeholder="Фамилия сварщика"
        on:keydown={handleKeydown}
        autocomplete="off"
        style="flex:1;"
      />
      <button class="btn-primary" on:click={addWelder}>+</button>
      <button class="btn-secondary" style="padding:0 10px;min-width:40px;" on:click={handleImport} title="Импорт">
        ↑
      </button>
      <button class="btn-secondary" style="padding:0 10px;min-width:40px;" on:click={handleExport} title="Экспорт">
        ↓
      </button>
    </div>
  </div>

  <div class="scroll-area">
    {#if $welders.length === 0}
      <div class="empty-state">
        <div style="font-size:40px;margin-bottom:12px;">👷</div>
        <div>Нет сварщиков. Добавьте первого.</div>
      </div>
    {:else}
      {#each $welders as welder (welder.id)}
        {@const summary = todaySummary(welder)}
        <div
          class="list-item"
          style="gap:10px;"
          on:touchstart={() => startLongPress(welder.id)}
          on:touchend={cancelLongPress}
          on:touchcancel={cancelLongPress}
          on:mousedown={() => startLongPress(welder.id)}
          on:mouseup={cancelLongPress}
          on:mouseleave={cancelLongPress}
          on:click={() => goto(`/wc/${welder.id}`)}
        >
          <span style="font-weight:700;font-size:17px;min-width:100px;">{welder.lastName}</span>
          <span style="flex:1;font-size:13px;color:#94a3b8;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
            {summary}
          </span>
          <button
            class="btn-secondary"
            style="min-height:36px;padding:0 10px;font-size:16px;flex-shrink:0;"
            on:click|stopPropagation={() => openInfo(welder)}
          >ℹ</button>
        </div>
      {/each}
    {/if}
  </div>

  <BottomNav />
</div>

<!-- Info Modal -->
{#if showInfoModal && infoModalWelder}
  <div class="modal-overlay" on:click={() => (showInfoModal = false)}>
    <div class="modal-sheet" on:click|stopPropagation>
      <h3 style="margin:0 0 16px;font-size:18px;">{infoModalWelder.lastName} — итого</h3>
      <p style="color:#cbd5e1;font-size:15px;line-height:1.7;margin:0;white-space:pre-line;">
        {allTimeSummary(infoModalWelder) || 'Нет записей.'}
      </p>
      <button class="btn-secondary" style="width:100%;margin-top:20px;" on:click={() => (showInfoModal = false)}>
        Закрыть
      </button>
    </div>
  </div>
{/if}

<!-- Delete Confirm Modal -->
{#if showDeleteModal}
  <div class="modal-overlay" on:click={() => (showDeleteModal = false)}>
    <div class="modal-sheet" on:click|stopPropagation>
      <h3 style="margin:0 0 12px;font-size:18px;">Удалить сварщика?</h3>
      <p style="color:#94a3b8;margin:0 0 20px;">Все записи будут удалены. Действие необратимо.</p>
      <div style="display:flex;gap:10px;">
        <button class="btn-secondary" style="flex:1;" on:click={() => (showDeleteModal = false)}>Отмена</button>
        <button class="btn-danger" style="flex:1;" on:click={confirmDelete}>Удалить</button>
      </div>
    </div>
  </div>
{/if}