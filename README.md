# WeldTrack — PWA для учёта работ сварщиков

## Установка и запуск

```bash
npm install
npm run dev
```

## Сборка для продакшна

```bash
npm run build
npm run preview
```

## Структура проекта

```
src/
  lib/
    types.ts          — TypeScript-типы (Rate, PlanItem, WCEntry, Welder)
    utils.ts          — утилиты (normalizeArticle, formatQty, calcOvertime, recalcPlanCompleted)
    stores.ts         — Svelte stores с persistence в localStorage
    components/
      BottomNav.svelte — нижняя навигация
  routes/
    +layout.svelte    — корневой лэйаут
    +page.svelte      — Главная (список сварщиков)
    rates/
      +page.svelte    — Нормы
    plan/
      +page.svelte    — План
    wc/[id]/
      +page.svelte    — Карточка сварщика (WC)
```

## Иконки PWA

Поместите иконки в `static/icons/`:
- `icon-192x192.png`
- `icon-512x512.png`

## Стек

- **SvelteKit** + TypeScript
- **TailwindCSS** для стилей
- **@vite-pwa/sveltekit** для PWA / service worker
- **localStorage** для хранения данных (без бэкенда)
- **uuid** для генерации ID

## Бизнес-логика

- Артикулы нормализуются: `"xt 44"` → `"XT44"`
- Числа всегда отображаются с 2 знаками: `1.30`, `0.40`
- Переработка = сумма (норма × кол-во) за день − 8 часов
- Ручное редактирование переработки блокирует автоперерасчёт для данной даты
- План блокируется (locked) при `completed >= target`
- Заблокированные артикулы нельзя добавлять в карточку
- Повторный ввод одного артикула за один день суммирует количество
