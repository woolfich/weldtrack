<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { welders, rates, planItems } from '$lib/stores';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import { normalizeArticle, formatQty, calcOvertime, calcDayHours, calcDayStats, recalcPlanCompleted, todayISO } from '$lib/utils';
  import { v4 as uuidv4 } from 'uuid';
  import { get } from 'svelte/store';
  import type { WCEntry } from '$lib/types';

  $: welderId = $page.params.id;
  $: welder = $welders.find((w) => w.id === welderId);

  let articleInput = '';
  let quantityInput = '';
  let stage: 'article' | 'quantity' = 'article';
  let showSuggestions = false;
  let confirmedArticle = '';

  let editingOvertime = false;
  let overtimeInput = '';

  let editModal = false;
  let editEntry: WCEntry | null = null;
  let editQtyInput = '';
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  $: today = todayISO();

  $: availableArticles = $planItems
    .filter((p) => !p.locked)
    .map((p) => p.article);

  $: suggestions = articleInput
    ? availableArticles.filter((a) =>
        a.includes(normalizeArticle(articleInput))
      ).slice(0, 5)
    : availableArticles.slice(0, 5);

  // Группировка записей по датам, новые сверху
  $: groupedByDate = (() => {
    if (!welder) return [];
    const dateMap = new Map<string, WCEntry[]>();
    for (const entry of welder.entries) {
      if (!dateMap.has(entry.date)) dateMap.set(entry.date, []);
      dateMap.get(entry.date)!.push(entry);
    }
    const sortedDates = [...dateMap.keys()].sort((a, b) => b.localeCompare(a));
    return sortedDates.map((date) => ({
      date,
      entries: dateMap.get(date)!.sort((a, b) => b.updatedAt - a.updatedAt),
    }));
  })();

  // Статистика по дням.
  // Нужно включить ВСЕ рабочие дни в диапазоне (даже пустые) для правильного пула.
  $: dayStats = (() => {
    if (!welder) return new Map();

    // Собираем все даты: и те, где есть записи, и все рабочие дни между ними
    const entryDates = new Set(welder.entries.map((e) => e.date));
    if (entryDates.size === 0) return new Map();

    const minDate = [...entryDates].sort()[0];
    const maxDate = today;

    // Генерируем все дни от minDate до maxDate
    const allDates: string[] = [];
    const cur = new Date(minDate + 'T00:00:00');
    const end = new Date(maxDate + 'T00:00:00');
    while (cur <= end) {
      allDates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    return calcDayStats(welder.entries, $rates, welder.overtime ?? {}, allDates);
  })();

  // Переработка для отображения в панели — берём из overtimeByDate напрямую
  // (ручное значение или авто-расчёт за сегодня)
  $: todayOvertime = (() => {
    if (!welder) return 0;
    if (today in (welder.overtime ?? {})) return welder.overtime[today];
    return calcOvertime(welder.entries, $rates, today);
  })();

  $: infoPlan = confirmedArticle
    ? $planItems.find((p) => p.article === confirmedArticle)
    : null;

  $: infoWelderData = confirmedArticle
    ? $welders
        .filter((w) => w.entries.some((e) => e.article === confirmedArticle))
        .map((w) => ({
          name: w.lastName,
          qty: w.entries
            .filter((e) => e.article === confirmedArticle)
            .reduce((sum, e) => sum + e.quantity, 0),
        }))
    : [];

  function selectArticle(article: string) {
    const plan = $planItems.find((p) => p.article === article);
    if (plan?.locked) {
      alert('План выполнен. Добавление невозможно.');
      return;
    }
    confirmedArticle = article;
    articleInput = article;
    showSuggestions = false;
    stage = 'quantity';
    quantityInput = '';
  }

  function submitEntry() {
    if (!welder || !confirmedArticle) return;
    const qty = parseFloat(quantityInput);
    if (isNaN(qty) || qty <= 0) return;

    const plan = $planItems.find((p) => p.article === confirmedArticle);
    if (plan?.locked) {
      alert('План выполнен. Добавление невозможно.');
      return;
    }

    welders.update((list) => {
      return list.map((w) => {
        if (w.id !== welderId) return w;

        const existingIdx = w.entries.findIndex(
          (e) => e.article === confirmedArticle && e.date === today
        );
        let newEntries: WCEntry[];

        if (existingIdx >= 0) {
          newEntries = w.entries.map((e, i) =>
            i === existingIdx
              ? { ...e, quantity: e.quantity + qty, updatedAt: Date.now() }
              : e
          );
        } else {
          newEntries = [
            ...w.entries,
            {
              id: uuidv4(),
              article: confirmedArticle,
              quantity: qty,
              date: today,
              updatedAt: Date.now(),
            },
          ];
        }

        const newOvertime = { ...w.overtime };
        // Авто-пересчёт переработки за сегодня, только если не было ручного изменения
        // (ручное изменение = значение уже в overtimeByDate И отличается от авто)
        const autoOvertime = calcOvertime(newEntries, get(rates), today);
        // Всегда обновляем авто, если не было ручного ввода через кнопку
        // Ручной ввод мы определяем по флагу — упрощённо: просто пишем авто
        newOvertime[today] = autoOvertime;

        return { ...w, entries: newEntries, overtime: newOvertime };
      });
    });

    planItems.update((plan) => recalcPlanCompleted(plan, get(welders)));

    stage = 'article';
    articleInput = '';
    quantityInput = '';
    confirmedArticle = '';
  }

  function handleArticleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const norm = normalizeArticle(articleInput);
      if (norm) selectArticle(norm);
    }
    if (e.key === 'Escape') resetInput();
  }

  function handleQtyKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') submitEntry();
    if (e.key === 'Escape') resetInput();
  }

  function resetInput() {
    stage = 'article';
    articleInput = '';
    quantityInput = '';
    confirmedArticle = '';
    showSuggestions = false;
  }

  function tapEntry(entry: WCEntry) {
    selectArticle(entry.article);
  }

  function startLongPress(entry: WCEntry) {
    longPressTimer = setTimeout(() => {
      editEntry = entry;
      editQtyInput = String(entry.quantity);
      editModal = true;
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer) clearTimeout(longPressTimer);
  }

  function saveEntryEdit() {
    if (!editEntry || !welder) return;
    const newQty = parseFloat(editQtyInput);
    if (isNaN(newQty) || newQty <= 0) return;

    const editDate = editEntry.date;

    welders.update((list) =>
      list.map((w) => {
        if (w.id !== welderId) return w;

        const newEntries = w.entries.map((e) =>
          e.id === editEntry!.id
            ? { ...e, quantity: newQty, updatedAt: Date.now() }
            : e
        );

        const newOvertime = { ...w.overtime };
        newOvertime[editDate] = calcOvertime(newEntries, get(rates), editDate);

        return { ...w, entries: newEntries, overtime: newOvertime };
      })
    );
    planItems.update((plan) => recalcPlanCompleted(plan, get(welders)));
    editModal = false;
    editEntry = null;
  }

  function deleteEntry() {
    if (!editEntry || !welder) return;
    const entryDate = editEntry.date;

    welders.update((list) =>
      list.map((w) => {
        if (w.id !== welderId) return w;

        const newEntries = w.entries.filter((e) => e.id !== editEntry!.id);

        const newOvertime = { ...w.overtime };
        newOvertime[entryDate] = calcOvertime(newEntries, get(rates), entryDate);

        return { ...w, entries: newEntries, overtime: newOvertime };
      })
    );

    planItems.update((plan) => recalcPlanCompleted(plan, get(welders)));
    editModal = false;
    editEntry = null;
  }

  // Ручная правка переработки — просто пишем значение, ничего не пересчитываем
  function startOvertimeEdit() {
    editingOvertime = true;
    overtimeInput = String(todayOvertime);
  }

  function saveOvertimeEdit() {
    const val = parseFloat(overtimeInput);
    if (isNaN(val) || val < 0) {
      editingOvertime = false;
      return;
    }
    welders.update((list) =>
      list.map((w) => {
        if (w.id !== welderId) return w;
        return {
          ...w,
          overtime: { ...w.overtime, [today]: val },
        };
      })
    );
    editingOvertime = false;
  }

  function handleOvertimeKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') saveOvertimeEdit();
    if (e.key === 'Escape') editingOvertime = false;
  }

  function formatDateLabel(dateISO: string): string {
    if (dateISO === today) return 'Сегодня';
    const [y, m, d] = dateISO.split('-');
    return `${d}.${m}.${y}`;
  }
</script>

<div class="page-container">
  <!-- Top bar -->
  <div class="top-panel" style="display:flex;align-items:center;gap:10px;">
    <button
      class="btn-secondary"
      style="min-height:36px;padding:0 12px;font-size:20px;"
      on:click={() => goto('/')}
    >←</button>
    <span style="font-weight:700;font-size:18px;flex:1;">{welder?.lastName ?? '...'}</span>
  </div>

  <!-- Input area -->
  <div style="background:#1e293b;border-bottom:1px solid #334155;padding:10px 12px;">
    {#if stage === 'article'}
      <div style="position:relative;">
        <input
          type="text"
          bind:value={articleInput}
          placeholder="Введите артикул"
          on:input={() => (showSuggestions = true)}
          on:focus={() => (showSuggestions = true)}
          on:blur={() => setTimeout(() => (showSuggestions = false), 150)}
          on:keydown={handleArticleKeydown}
          autocomplete="off"
          style="text-transform:uppercase;"
        />
        {#if showSuggestions && suggestions.length > 0}
          <div class="suggestions">
            {#each suggestions as s}
              {@const plan = $planItems.find((p) => p.article === s)}
              <div
                class="suggestion-item"
                style={plan?.locked ? 'opacity:0.5;text-decoration:line-through;' : ''}
                on:mousedown={() => selectArticle(s)}
              >
                {s}
                {#if plan?.locked}<span style="font-size:12px;color:#f87171;"> (план выполнен)</span>{/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div style="margin-bottom:8px;padding:10px;background:#0f172a;border-radius:8px;font-size:13px;color:#94a3b8;">
        {#if infoPlan}
          <strong style="color:#38bdf8;font-size:15px;">{confirmedArticle}</strong>
          — план: {formatQty(infoPlan.target)} шт
          {#if infoWelderData.length > 0}
            <span style="margin-left:6px;">|</span>
            {#each infoWelderData as wd}
              <span style="margin-left:6px;">{wd.name}: {formatQty(wd.qty)}</span>
            {/each}
          {/if}
        {:else}
          <strong style="color:#38bdf8;">{confirmedArticle}</strong>
        {/if}
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn-secondary" style="min-height:40px;padding:0 10px;" on:click={resetInput}>✕</button>
        <input
          type="number"
          bind:value={quantityInput}
          placeholder="Количество (шт)"
          inputmode="decimal"
          on:keydown={handleQtyKeydown}
          autocomplete="off"
          style="flex:1;"
        />
        <button class="btn-primary" on:click={submitEntry}>Добавить</button>
      </div>
    {/if}
  </div>

  <!-- Entries list grouped by date + overtime overlay -->
  <div style="position:relative;flex:1;overflow:hidden;">
    <div class="scroll-area" style="padding-right:90px;">
      {#if groupedByDate.length === 0}
        <div class="empty-state">Нет записей. Добавьте первую.</div>
      {:else}
        {#each groupedByDate as group (group.date)}
          {@const stats = dayStats.get(group.date)}
          {@const normalH = stats?.normalHours ?? 0}
          {@const overH = stats?.overtimeHours ?? 0}
          {@const rawH = calcDayHours(welder?.entries ?? [], $rates, group.date)}

          <!-- Day block header -->
          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            padding:8px 12px 6px;
            margin-top:10px;
            border-bottom:2px solid #334155;
            background:#0f172a;
            position:sticky;
            top:0;
            z-index:10;
          ">
            <!-- Дата -->
            <span style="font-size:13px;font-weight:700;color:{group.date === today ? '#38bdf8' : '#64748b'};">
              {formatDateLabel(group.date)}
            </span>

            <!-- Часы -->
            <div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;">
              <!-- Нормальные часы (зелёный) — показываем реально выполненные -->
              <span style="color:#4ade80;">{formatQty(rawH)}ч</span>

              {#if overH > 0}
                <!-- Переработка (оранжевый) -->
                <span style="color:#94a3b8;font-size:11px;font-weight:400;">+</span>
                <span style="color:#f59e0b;">{formatQty(overH)}ч</span>
              {/if}

              {#if normalH > rawH && rawH < 8}
                <!-- Показываем, сколько добавил пул (серый, информационно) -->
                <span style="color:#94a3b8;font-size:11px;font-weight:400;">
                  (пул +{formatQty(normalH - rawH)}ч)
                </span>
              {/if}
            </div>
          </div>

          <!-- Записи дня -->
          {#each group.entries as entry (entry.id)}
            {@const plan = $planItems.find((p) => p.article === entry.article)}
            <div
              class="list-item"
              on:click={() => tapEntry(entry)}
              on:touchstart={() => startLongPress(entry)}
              on:touchend={cancelLongPress}
              on:touchcancel={cancelLongPress}
              on:mousedown={() => startLongPress(entry)}
              on:mouseup={cancelLongPress}
              on:mouseleave={cancelLongPress}
            >
              <span
                style="flex:1;font-weight:700;font-size:16px;{plan?.locked ? 'text-decoration:line-through;color:#64748b;' : ''}"
              >{entry.article}{plan?.locked ? ' ✓' : ''}</span>
              <span style="font-size:15px;">{formatQty(entry.quantity)} шт</span>
            </div>
          {/each}
        {/each}
      {/if}
    </div>

    <!-- Overtime panel (сегодня) — ручное редактирование -->
    <div
      style="
        position:absolute;
        top:8px;
        right:0;
        width:82px;
        background:#1e293b;
        border-radius:10px 0 0 10px;
        padding:10px 8px;
        border:1px solid #334155;
        border-right:none;
        cursor:pointer;
        text-align:center;
      "
      on:click={startOvertimeEdit}
    >
      <div style="font-size:10px;color:#64748b;margin-bottom:4px;">Перераб.</div>
      {#if editingOvertime}
        <input
          type="number"
          bind:value={overtimeInput}
          inputmode="decimal"
          on:keydown={handleOvertimeKeydown}
          on:blur={saveOvertimeEdit}
          autocomplete="off"
          style="width:66px;text-align:center;font-size:14px;padding:4px;"
          on:click|stopPropagation
        />
      {:else}
        <div
          style="font-size:16px;font-weight:700;color:{todayOvertime > 0 ? '#f59e0b' : '#64748b'};"
        >
          {formatQty(todayOvertime)}
        </div>
        <div style="font-size:11px;color:#64748b;">ч</div>
      {/if}
    </div>
  </div>

  <BottomNav />
</div>

<!-- Entry Edit Modal -->
{#if editModal && editEntry}
  <div class="modal-overlay" on:click={() => (editModal = false)}>
    <div class="modal-sheet" on:click|stopPropagation>
      <h3 style="margin:0 0 4px;font-size:18px;">Запись: {editEntry.article}</h3>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">{editEntry.date}</p>
      <input
        type="number"
        bind:value={editQtyInput}
        placeholder="Количество (шт)"
        inputmode="decimal"
        autocomplete="off"
        style="margin-bottom:16px;"
      />
      <div style="display:flex;gap:8px;">
        <button class="btn-danger" style="flex:1;" on:click={deleteEntry}>Удалить</button>
        <button class="btn-secondary" style="flex:1;" on:click={() => (editModal = false)}>Отмена</button>
        <button class="btn-primary" style="flex:1;" on:click={saveEntryEdit}>Сохранить</button>
      </div>
    </div>
  </div>
{/if}