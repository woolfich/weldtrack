<script lang="ts">
  import { rates } from '$lib/stores';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import { normalizeArticle, formatQty } from '$lib/utils';
  import { v4 as uuidv4 } from 'uuid';
  import type { Rate } from '$lib/types';

  let articleInput = '';
  let normInput = '';
  let showSuggestions = false;
  let editModal = false;
  let editTarget: Rate | null = null;
  let editArticle = '';
  let editNorm = '';
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressId = '';

  $: suggestions = articleInput
    ? $rates
        .map((r) => r.article)
        .filter((a) => a.includes(normalizeArticle(articleInput)) && a !== normalizeArticle(articleInput))
        .slice(0, 5)
    : [];

  function addRate() {
    const article = normalizeArticle(articleInput);
    const norm = parseFloat(normInput);
    if (!article || isNaN(norm) || norm <= 0) return;
    rates.update((list) => {
      const existing = list.findIndex((r) => r.article === article);
      if (existing >= 0) {
        // Update existing, move to top
        const updated = { ...list[existing], norm };
        const rest = list.filter((_, i) => i !== existing);
        return [updated, ...rest];
      }
      return [{ id: uuidv4(), article, norm }, ...list];
    });
    articleInput = '';
    normInput = '';
    showSuggestions = false;
  }

  function selectSuggestion(s: string) {
    articleInput = s;
    showSuggestions = false;
  }

  function startLongPress(rate: Rate) {
    longPressId = rate.id;
    longPressTimer = setTimeout(() => {
      editTarget = rate;
      editArticle = rate.article;
      editNorm = String(rate.norm);
      editModal = true;
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer) clearTimeout(longPressTimer);
  }

  function saveEdit() {
    if (!editTarget) return;
    const article = normalizeArticle(editArticle);
    const norm = parseFloat(editNorm);
    if (!article || isNaN(norm) || norm <= 0) return;
    rates.update((list) => {
      const filtered = list.filter((r) => r.id !== editTarget!.id);
      return [{ ...editTarget!, article, norm }, ...filtered];
    });
    editModal = false;
    editTarget = null;
  }

  function deleteRate() {
    if (!editTarget) return;
    rates.update((list) => list.filter((r) => r.id !== editTarget!.id));
    editModal = false;
    editTarget = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') addRate();
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
        bind:value={normInput}
        placeholder="Норма (ч)"
        inputmode="decimal"
        on:keydown={handleKeydown}
        autocomplete="off"
        style="width:110px;"
      />
      <button class="btn-primary" on:click={addRate}>Добавить</button>
    </div>
  </div>

  <div class="scroll-area">
    {#if $rates.length === 0}
      <div class="empty-state">
        <div style="font-size:40px;margin-bottom:12px;">📋</div>
        <div>Нет норм. Добавьте первую.</div>
      </div>
    {:else}
      {#each $rates as rate (rate.id)}
        <div
          class="list-item"
          on:touchstart={() => startLongPress(rate)}
          on:touchend={cancelLongPress}
          on:touchcancel={cancelLongPress}
          on:mousedown={() => startLongPress(rate)}
          on:mouseup={cancelLongPress}
          on:mouseleave={cancelLongPress}
        >
          <span style="flex:1;font-weight:700;font-size:16px;">{rate.article}</span>
          <span style="color:#94a3b8;font-size:15px;">{formatQty(rate.norm)} ч</span>
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
      <h3 style="margin:0 0 16px;font-size:18px;">Редактировать норму</h3>
      <div style="display:flex;gap:8px;margin-bottom:16px;">
        <input
          type="text"
          bind:value={editArticle}
          placeholder="Артикул"
          autocomplete="off"
          style="flex:1;text-transform:uppercase;"
        />
        <input
          type="number"
          bind:value={editNorm}
          placeholder="Норма (ч)"
          inputmode="decimal"
          autocomplete="off"
          style="width:110px;"
        />
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn-danger" style="flex:1;" on:click={deleteRate}>Удалить</button>
        <button class="btn-secondary" style="flex:1;" on:click={() => (editModal = false)}>Отмена</button>
        <button class="btn-primary" style="flex:1;" on:click={saveEdit}>Сохранить</button>
      </div>
    </div>
  </div>
{/if}
