// Deterministic, simple text uniqueification for Avito duplicate-listing filter.
// Same seed → same output, чтобы повторное создание вкладки не меняло тексты лишний раз.

function hash(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TITLE_EPITHETS = [
  "Свежий",
  "Качественный",
  "Отборный",
  "Лучший",
  "Премиум",
  "Натуральный",
  "Фирменный",
];

const DESC_INTRO = [
  "Принимаем заказы ежедневно.",
  "Доступно к заказу сегодня.",
  "Привезём быстро и аккуратно.",
  "Работаем без выходных.",
  "Свежее поступление на складе.",
];

const DESC_OUTRO = [
  "Доставка по {city} и области.",
  "Самовывоз и доставка по {city}.",
  "Отгрузка из {city} ежедневно.",
  "Доставим по {city} в день заказа.",
];

export function uniqueifyTitle(original: string, city: string, seed: string): string {
  if (!original) return original;
  const rnd = mulberry32(hash(seed + "|t"));
  const base = original.trim().replace(/\s+/g, " ");

  // Если уже есть город в названии — не добавляем повторно.
  const hasCity = city && base.toLowerCase().includes(city.toLowerCase());

  // Выбираем эпитет, не дублируя существующий первый.
  const firstWord = base.split(" ")[0]?.toLowerCase() || "";
  const epithet = TITLE_EPITHETS[Math.floor(rnd() * TITLE_EPITHETS.length)];
  const addEpithet = !TITLE_EPITHETS.some((e) => e.toLowerCase() === firstWord);

  let result = addEpithet ? `${epithet} ${base[0].toLowerCase()}${base.slice(1)}` : base;

  if (city && !hasCity) {
    // 50/50 — добавить " — {city}" или " (в {city})"
    result += rnd() < 0.5 ? ` — ${city}` : ` (в ${city})`;
  }
  // Avito ограничивает заголовок ~50 символов в некоторых категориях, не режем жёстко.
  return result;
}

export function uniqueifyDescription(original: string, city: string, seed: string): string {
  const rnd = mulberry32(hash(seed + "|d"));
  const base = (original || "").trim();
  const intro = DESC_INTRO[Math.floor(rnd() * DESC_INTRO.length)];
  const outroTpl = DESC_OUTRO[Math.floor(rnd() * DESC_OUTRO.length)];
  const outro = outroTpl.replace(/\{city\}/g, city || "вашему городу");

  // Лёгкая перестановка: если несколько предложений — меняем местами 1 и 2.
  let body = base;
  const sentences = base.split(/(?<=[.!?])\s+/);
  if (sentences.length >= 2 && rnd() < 0.7) {
    const tmp = sentences[0];
    sentences[0] = sentences[1];
    sentences[1] = tmp;
    body = sentences.join(" ");
  }

  return [intro, body, outro].filter(Boolean).join("\n\n");
}

export function applyMarkup(price: number | null | undefined, markupPercent: number): number {
  const p = Number(price) || 0;
  const m = Number(markupPercent) || 0;
  return Math.round(p * (1 + m / 100) * 100) / 100;
}
