# Phase 18: Unified Version Dialog - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Заменить 3 отдельных диалога версий (XkeenInfoDialog, MihomoVersionsDialog, XMeowInfoDialog) одним общим модальным окном с вкладками. Клик по версии в sidebar открывает нужную вкладку. Переключение между XKeen/Mihomo/Dashboard без закрытия диалога. Вся функциональность из старых диалогов сохраняется. Старые 3 компонента удаляются.

</domain>

<decisions>
## Implementation Decisions

### Структура вкладок
- shadcn `Tabs` сверху под заголовком диалога
- 3 вкладки: XKeen | Mihomo | Dashboard
- Порядок вкладок совпадает с порядком версий в sidebar footer

### Анимация переключения
- Fade crossfade (~200ms) через tw-animate-css (`animate-in fade-in-0 duration-200`)
- Контент старой вкладки плавно исчезает, новой — появляется

### Сохранение состояния
- Все 3 вкладки монтированы одновременно, неактивные скрыты через `display: none` (или CSS `hidden`)
- Логи установки Mihomo сохраняются при переключении вкладок
- Scroll-позиция сохраняется при возврате на вкладку

### Размер диалога
- Фиксированный для всех вкладок: `max-w-2xl`, `max-h-[85vh]`
- Нет прыжков размера при переключении вкладок
- Внутренний скролл через ScrollArea на каждой вкладке

### Claude's Discretion
- Точные значения ширины/высоты диалога (max-w-2xl ориентир, можно скорректировать)
- Как адаптировать UpdateOverlay при обновлении — встроить в диалог или оставить глобальным
- Порядок миграции stores (объединять или оставить раздельными)
- AlertDialog подтверждений — общий или по-вкладочный

</decisions>

<specifics>
## Specific Ideas

- При клике на "xkeen 1.1.3.9" в sidebar → открывается диалог сразу на вкладке XKeen
- При клике на "mihomo 1.19.20" → открывается на вкладке Mihomo
- При клике на "dashboard v0.1.0" → открывается на вкладке Dashboard
- В collapsed sidebar (иконка с popover) — аналогично, каждая кнопка открывает свою вкладку

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shadcn/ui Tabs` (`TabsList`, `TabsTrigger`, `TabsContent`): основа для переключения вкладок
- `ScrollArea`: уже используется в XkeenInfoDialog для прокрутки контента
- `tw-animate-css`: классы `animate-in`, `fade-in-0`, `duration-200` для анимаций (Pattern from Dialog Animations)
- `UpdateOverlay`: компонент прогресса обновления — может остаться глобальным
- `AlertDialog`: подтверждения — используется во всех 3 текущих диалогах

### Established Patterns
- **Lazy data fetch**: XkeenInfoDialog и MihomoVersionsDialog делают fetch при первом открытии (`useEffect` с `open`)
- **Store separation**: `useUpdateStore` (XMeow), `useReleasesStore` (Mihomo/XKeen) — можно оставить как есть
- **Dialog animation**: `animate-in fade-in-0 duration-200` на условных секциях
- **Version display**: `VersionRow` в sidebar footer с `onClick` + `useState` для open/close

### Integration Points
- `AppSidebar.tsx`: 3 `useState` для 3 диалогов → 1 `useState<string | null>` для activeTab
- `useOverviewStore`: источник версий для sidebar (mihomoVersion, xkeenVersion, dashboardVersion)
- `useUpdateStore`: hasUpdate для индикатора обновления на dashboard tab
- `useReleasesStore`: данные для XKeen и Mihomo вкладок

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-unified-version-dialog*
*Context gathered: 2026-03-05*
