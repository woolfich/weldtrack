<script lang="ts">
  import { rates, planItems, welders } from '$lib/stores';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import { normalizeArticle, formatQty, recalcPlanCompleted, todayISO } from '$lib/utils';
  import { v4 as uuidv4 } from 'uuid';
  import type { PlanItem } from '$lib/types';

  let articleInput = '';
  let targetInput = '';
  let dateInput = todayISO();
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
    ? rateArticles.filter((a) => {
        const matchesInput = a.includes(normalizeArticle(articleInput));
        if (!matchesInput) return false;
        const hasActivePlan = $planItems.some(
          (p) => p.article === a && !p.locked
        );
        return !hasActivePlan;
      }).slice(0, 5)
    : [];

  function addPlanItem() {
    const article = normalizeArticle(articleInput);
    const target = parseFloat(targetInput);
    const startDate = dateInput || todayISO();
    if (!article || isNaN(target) || target <= 0) return;
    if (!rateArticles.includes(article)) {
      alert(`Артикул ${article} не найден в нормах.`);
      return;
    }

    const activePlanExists = $planItems.some(p => p.article === article && !p.locked);
    if (activePlanExists) {
       alert(`Уже есть активный план по ${article}. Дождитесь выполнения.`);
       return;
    }

    planItems.update((list) => [
      { 
        id: uuidv4(), 
        article, 
        target, 
        completed: 0, 
        locked: false, 
        startDate, 
        completedDate: null 
      },
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
          ? { ...p, target, locked: p.completed >= target, completedDate: p.completed >= target ? (p.completedDate ?? todayISO()) : null }
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

  // Открыть детали плана.
  // Показываем только тех сварщиков и только те записи,
  // которые попадают строго в период ЭТОГО плана.
  //
  // Логика определения периода:
  //   - startDate = item.startDate
  //   - endDate = item.completedDate (если завершён) или сегодня (если активный)
  //
  // Дополнительно: исключаем записи, которые "забрал" более ранний закрытый план
  // для того же артикула (те же правила, что в recalcPlanCompleted).
  function openInfo(item: PlanItem) {
    const periodStart = item.startDate;
    const periodEnd = item.completedDate || todayISO();

    // Даты закрытия ДРУГИХ планов по этому же артикулу (более ранних)
    // Запись принадлежит старому плану, если entry.date <= lockDate того плана
    const otherLockedDates = $planItems
      .filter(p => p.id !== item.id && p.article === item.article && p.locked && p.completedDate)
      .map(p => p.completedDate as string)
      .sort();

    const stats: { name: string; qty: number }[] = [];

    for (const w of $welders) {
      const qty = w.entries
        .filter((e) => {
          // Артикул совпадает
          if (e.article !== item.article) return false;

          // Запись в периоде плана
          if (e.date < periodStart || e.date > periodEnd) return false;

          // Запись не забрана другим (более ранним) закрытым планом
          // Запись принадлежит старому плану только если lockDate < startDate текущего
          const isClaimedByOtherPlan = otherLockedDates.some(
            lockDate => e.date <= lockDate && lockDate < item.startDate
          );
          if (isClaimedByOtherPlan) return false;

          return true;
        })
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
        placeholder="Кол-во"
        inputmode="decimal"
        on:keydown={handleKeydown}
        autocomplete="off"
        style="width:80px;"
      />
      <input
        type="date"
        bind:value={dateInput}
        on:keydown={handleKeydown}
        autocomplete="off"
        style="width:130px;"
      />
      <button class="btn-primary" on:click={addPlanItem}>+</button>
    </div>
  </div>

  <div class="scroll-area">
    {#if $planItems.length === 0}
      <div class="empty-state">
        <div style="font-size:40px;margin-bottom:12px;">📊</div>
        <div>Нет позиций плана.</div>
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
          <div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-weight:700;font-size:16px;">{item.article}</span>
                {#if item.locked}
                    <span style="font-size:10px;background:#166534;padding:2px 6px;border-radius:4px;color:#fff;">ЗАВЕРШЁН</span>
                {/if}
            </div>
            <span style="font-size:11px;color:#94a3b8;white-space:nowrap;">
              Старт: {item.startDate}
              {#if item.completedDate}
                → Финиш: {item.completedDate}
              {/if}
            </span>
          </div>
          
          <div style="text-align:right;margin-left:8px;flex-shrink:0;">
             <div style="font-size:15px;">
                <span style="color:#fbbf24;font-weight:700;">{formatQty(item.completed)}</span>
                <span style="color:#64748b;"> / {formatQty(item.target)} шт</span>
             </div>
             <button
                class="btn-secondary"
                style="min-height:30px;padding:0 8px;font-size:12px;margin-top:4px;"
                on:click|stopPropagation={() => openInfo(item)}
             >Детали</button>
          </div>
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
      <h3 style="margin:0 0 4px;font-size:18px;">
        Редактировать: {editTarget.article}
      </h3>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">
        Период: {editTarget.startDate} — {editTarget.completedDate || 'сейчас'}
      </p>
      <input
        type="number"
        bind:value={editTargetQty}
        placeholder="Целевое количество"
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
        Период: {infoItem.startDate} — {infoItem.completedDate || 'сейчас'}
      </p>
      
      {#if infoWelders.length === 0}
        <p style="color:#94a3b8;text-align:center;padding:20px;">Нет данных за этот период</p>
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
          <span>Всего сварщиков: {infoWelders.length}</span>
          <span>{formatQty(infoItem.completed)} шт</span>
        </div>
      {/if}
      
      <button class="btn-secondary" style="width:100%;margin-top:20px;" on:click={() => (showInfoModal = false)}>
        Закрыть
      </button>
    </div>
  </div>
{/if}