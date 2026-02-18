<script lang="ts">
  import { rates, planItems, welders } from '$lib/stores';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import { normalizeArticle, formatQty, recalcPlanCompleted } from '$lib/utils';
  import { v4 as uuidv4 } from 'uuid';
  import type { PlanItem } from '$lib/types';

  let articleInput = '';
  let targetInput = '';
  let showSuggestions = false;
  let editModal = false;
  let editTarget: PlanItem | null = null;
  let editTargetQty = '';
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  // Info modal
  let showInfoModal = false;
  let infoItem: PlanItem | null = null;
  let infoWelders: { name: string; qty: number }[] = [];

  $: rateArticles = $rates.map((r) => r.article);
  $: suggestions = articleInput
    ? rateArticles.filter(
        (a) => a.includes(normalizeArticle(articleInput)) && !$planItems.some((p) => p.article === a)
      ).slice(0, 5)
    : [];

  function addPlanItem() {
    const article = normalizeArticle(articleInput);
    const target = parseFloat(targetInput);
    if (!article || isNaN(target) || target <= 0) return;
    if (!rateArticles.includes(article)) {
      alert(`Артикул ${article} не найден в нормах.`);
      return;
    }
    if ($planItems.some((p) => p.article === article)) {
      alert(`Артикул ${article} уже в плане.`);
      return;
    }
    // Calculate current completed from welders
    let completed = 0;
    for (const w of $welders) {
      for (const e of w.entries) {
        if (e.article === article) completed += e.quantity;
      }
    }
    planItems.update((list) => [
      { id: uuidv4(), article, target, completed, locked: completed >= target },
      ...list,
    ]);
    articleInput = '';
    targetInput = '';
    showSuggestions = false;
  }

  function selectSuggestion(s: string) {
    articleInput = s;
    showSuggestions = false;
  }

  function startLongPress(item: PlanItem) {
    longPressTimer = setTimeout(() => {
      editTarget = item;
      editTargetQty = String(item.target);
      editModal = true;
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer) clearTimeout(longPressTimer);
  }

  function saveEdit() {
    if (!editTarget) return;
    const target = parseFloat(editTargetQty);
    if (isNaN(target) || target <= 0) return;
    planItems.update((list) => {
      const updated = list.map((p) =>
        p.id === editTarget!.id
          ? { ...p, target, locked: p.completed >= target }
          : p
      );
      return recalcPlanCompleted(updated, $welders);
    });
    editModal = false;
    editTarget = null;
  }

  function deletePlan() {
    if (!editTarget) return;
    planItems.update((list) => list.filter((p) => p.id !== editTarget!.id));
    editModal = false;
    editTarget = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') addPlanItem();
  }

  function openInfo(item: PlanItem) {
    // Собираем статистику по сварщикам для этого артикула
    const stats: { name: string; qty: number }[] = [];
    for (const w of $welders) {
      const qty = w.entries
        .filter((e) => e.article === item.article)
        .reduce((sum, e) => sum + e.quantity, 0);
      if (qty > 0) {
        stats.push({ name: w.lastName, qty });
      }
    }
    infoWelders = stats.sort((a, b) => b.qty - a.qty);
    infoItem = item;
    showInfoModal = true;
  }
</script>

<div class="page-container">
  <div class="top-panel">
    <div style="display:flex;gap:8px;align-items:center;">
      <div style="position:relative;flex:1;">
        <input
          type="text"
          bind:value={articleInput}
          placeholder="Артикул"
          on:input={() => (showSuggestions = true)}
          on:focus={() => (showSuggestions = true)}
          on:blur={() => setTimeout(() => (showSuggestions = false), 150)}
          on:keydown={handleKeydown}
          autocomplete="off"
          style="text-transform:uppercase;"
        />
        {#if showSuggestions && suggestions.length > 0}
          <div class="suggestions">
            {#each suggestions as s}
              <div class="suggestion-item" on:mousedown={() => selectSuggestion(s)}>{s}</div>
            {/each}
          </div>
        {/if}
      </div>
      <input
        type="number"
        bind:value={targetInput}
        placeholder="Кол-во (шт)"
        inputmode="decimal"
        on:keydown={handleKeydown}
        autocomplete="off"
        style="width:120px;"
      />
      <button class="btn-primary" on:click={addPlanItem}>Добавить</button>
    </div>
  </div>

  <div class="scroll-area">
    {#if $planItems.length === 0}
      <div class="empty-state">
        <div style="font-size:40px;margin-bottom:12px;">📊</div>
        <div>Нет позиций плана. Сначала добавьте нормы.</div>
      </div>
    {:else}
      {#each $planItems as item (item.id)}
        <div
          class="list-item"
          style={item.locked ? 'background:#14532d;' : ''}
          on:touchstart={() => startLongPress(item)}
          on:touchend={cancelLongPress}
          on:touchcancel={cancelLongPress}
          on:mousedown={() => startLongPress(item)}
          on:mouseup={cancelLongPress}
          on:mouseleave={cancelLongPress}
        >
          <span style="font-weight:700;font-size:16px;flex:1;">{item.article}</span>
          {#if item.locked}
            <span style="color:#4ade80;font-size:13px;font-weight:600;margin-right:8px;">ПЛАН ВЫПОЛНЕН</span>
          {/if}
          <span style="color:{item.locked ? '#4ade80' : '#94a3b8'};font-size:15px;margin-right:8px;">
            {formatQty(item.target)} / {formatQty(item.completed)}
          </span>
          <button
            class="btn-secondary"
            style="min-height:36px;padding:0 10px;font-size:16px;flex-shrink:0;"
            on:click|stopPropagation={() => openInfo(item)}
          >ℹ</button>
        </div>
      {/each}
    {/if}
  </div>

  <BottomNav />
</div>

<!-- Edit/Delete Modal -->
{#if editModal && editTarget}
  <div class="modal-overlay" on:click={() => (editModal = false)}>
    <div class="modal-sheet" on:click|stopPropagation>
      <h3 style="margin:0 0 16px;font-size:18px;">
        Редактировать план — {editTarget.article}
      </h3>
      <input
        type="number"
        bind:value={editTargetQty}
        placeholder="Целевое количество (шт)"
        inputmode="decimal"
        autocomplete="off"
        style="margin-bottom:16px;"
      />
      <div style="display:flex;gap:8px;">
        <button class="btn-danger" style="flex:1;" on:click={deletePlan}>Удалить</button>
        <button class="btn-secondary" style="flex:1;" on:click={() => (editModal = false)}>Отмена</button>
        <button class="btn-primary" style="flex:1;" on:click={saveEdit}>Сохранить</button>
      </div>
    </div>
  </div>
{/if}

<!-- Info Modal -->
{#if showInfoModal && infoItem}
  <div class="modal-overlay" on:click={() => (showInfoModal = false)}>
    <div class="modal-sheet" on:click|stopPropagation>
      <h3 style="margin:0 0 4px;font-size:18px;">{infoItem.article}</h3>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">
        Выполнено {formatQty(infoItem.completed)} из {formatQty(infoItem.target)} шт
      </p>
      
      {#if infoWelders.length === 0}
        <p style="color:#94a3b8;text-align:center;padding:20px;">Нет данных о сварщиках</p>
      {:else}
        <div style="max-height:300px;overflow-y:auto;">
          {#each infoWelders as w}
            <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #334155;">
              <span style="font-weight:600;">{w.name}</span>
              <span style="color:#38bdf8;">{formatQty(w.qty)} шт</span>
            </div>
          {/each}
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:2px solid #38bdf8;display:flex;justify-content:space-between;font-weight:700;">
          <span>Итого сварщиков: {infoWelders.length}</span>
          <span>{formatQty(infoItem.completed)} шт</span>
        </div>
      {/if}
      
      <button class="btn-secondary" style="width:100%;margin-top:20px;" on:click={() => (showInfoModal = false)}>
        Закрыть
      </button>
    </div>
  </div>
{/if}