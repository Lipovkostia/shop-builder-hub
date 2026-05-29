## Проблема

Авито-валидатор отчитывается «Не до конца заполнен параметр PromoAutoOption или PromoManualOption» для всех 550 объявлений. Причина — в `supabase/functions/avito-feed/index.ts` мы пишем плоский текст:

```xml
<PromoAutoOptions>Москва, 20000</PromoAutoOptions>
<PromoManualOptions>Москва|1000|10000</PromoManualOptions>
```

По спецификации Авито эти параметры — контейнеры с вложенными `<Item>` (можно несколько регионов подряд):

```xml
<PromoAutoOptions>
  <Item>
    <Region>Москва</Region>
    <Budget>20000</Budget>
  </Item>
</PromoAutoOptions>

<PromoManualOptions>
  <Item>
    <Region>Москва</Region>
    <Bid>1000</Bid>
    <DailyLimit>10000</DailyLimit>
  </Item>
</PromoManualOptions>
```

Поля для Manual: `Region`, `Bid` (цена целевого действия), `DailyLimit` (лимит на день). Для Auto: `Region`, `Budget` (период берётся из `Promo`: `Auto_1`/`Auto_7`/`Auto_30`).

## Что меняем

Только `supabase/functions/avito-feed/index.ts`, блок «Promo settings» (строки ~152–170). Создаём хелпер, который из уже сохранённых в `avito_params` строк собирает корректный XML.

### Формат входных данных (как уже хранится в админке)

- `params.promoManualOptions` — многострочно, по строке на регион: `Регион|Bid|DailyLimit` (любая из трёх частей может отсутствовать; используем `|` как разделитель, второй разделитель `\n` — между регионами).
- `params.promoAutoOptions` — многострочно, по строке на регион: `Регион|Budget`.
- Legacy одиночные поля `promoRegion` + `promoBudget` / `promoPrice` + `promoLimit` — fallback, превращаем в один `<Item>`.

### Логика сборки

```ts
function buildPromoAutoXml(raw: string): string {
  const items = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(line => {
    const [region, budget] = line.split('|').map(s => s?.trim() ?? '');
    const parts: string[] = [];
    if (region) parts.push(`        <Region>${escapeXml(region)}</Region>`);
    if (budget) parts.push(`        <Budget>${escapeXml(budget)}</Budget>`);
    return parts.length ? `      <Item>\n${parts.join('\n')}\n      </Item>` : '';
  }).filter(Boolean);
  return items.length ? `    <PromoAutoOptions>\n${items.join('\n')}\n    </PromoAutoOptions>\n` : '';
}

function buildPromoManualXml(raw: string): string {
  const items = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(line => {
    const [region, bid, limit] = line.split('|').map(s => s?.trim() ?? '');
    const parts: string[] = [];
    if (region) parts.push(`        <Region>${escapeXml(region)}</Region>`);
    if (bid)    parts.push(`        <Bid>${escapeXml(bid)}</Bid>`);
    if (limit)  parts.push(`        <DailyLimit>${escapeXml(limit)}</DailyLimit>`);
    return parts.length ? `      <Item>\n${parts.join('\n')}\n      </Item>` : '';
  }).filter(Boolean);
  return items.length ? `    <PromoManualOptions>\n${items.join('\n')}\n    </PromoManualOptions>\n` : '';
}
```

Текущий блок заменяем на:

```ts
if (promo) {
  ads += `    <Promo>${escapeXml(promo)}</Promo>\n`;
  if (promo === 'Manual') {
    let raw = (params.promoManualOptions || '').trim();
    if (!raw) {
      // legacy fallback → одна строка Region|Bid|DailyLimit
      raw = [params.promoRegion, params.promoPrice, params.promoLimit]
              .map(v => v ?? '').join('|');
      if (raw.replace(/\|/g, '').trim() === '') raw = '';
    }
    ads += buildPromoManualXml(raw);
  } else if (promo.startsWith('Auto')) {
    let raw = (params.promoAutoOptions || '').trim();
    if (!raw) {
      raw = [params.promoRegion, params.promoBudget].map(v => v ?? '').join('|');
      if (raw.replace(/\|/g, '').trim() === '') raw = '';
    }
    ads += buildPromoAutoXml(raw);
  }
}
```

Если после разбора ни одной валидной строки нет — блок `<PromoAutoOptions>`/`<PromoManualOptions>` не выводим вовсе (Авито считает пустой контейнер ошибкой; лучше его не отдавать, тогда у объявления просто не будет продвижения, но ошибка модерации уйдёт).

### Что НЕ трогаем

- Логику ввода в админке (`AvitoSection.tsx`) — формат хранения уже подходящий.
- Excel-импорт ошибок, флаги `excluded_from_feed`, подсветку — без изменений.
- Прочие поля XML — без изменений.

## Файлы

- `supabase/functions/avito-feed/index.ts` — заменить блок Promo на структурный вывод с `<Item>`.

## Проверка

После деплоя edge-функции — открыть `/functions/v1/avito-feed?...` для тестового магазина, убедиться что в XML появились вложенные `<Item><Region>…</Region><Budget>…</Budget></Item>` и прогнать через валидатор Авито.
