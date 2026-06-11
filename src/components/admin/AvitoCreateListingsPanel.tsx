import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Plus, Wand2, Shuffle, Info } from "lucide-react";
import { toast } from "sonner";

/**
 * СКЕЛЕТ — Создание объявлений «с нуля» (не из прайс-листа).
 *
 * Идея:
 *   1. Пользователь задаёт количество объявлений к созданию (1..N).
 *   2. Шаблон названия + варианты слов / синонимов + режим рандомизации.
 *   3. Шаблон описания + варианты вставок + режим рандомизации.
 *   4. Можно указать базовые параметры (цена, город, категория Авито).
 *   5. По кнопке «Создать» — пока выводим preview-генерацию (без записи в БД).
 *
 * Логика записи в avito_listing_variants/avito_feed_products будет
 * подключена позже отдельной задачей. Это намеренно скелет.
 */

type TitleMode = "shuffle_words" | "synonym_swap" | "prefix_suffix" | "template_only";
type DescMode = "intro_outro" | "paragraph_shuffle" | "synonym_swap" | "template_only";

interface PreviewRow {
  title: string;
  description: string;
}

interface Props {
  storeId: string | null;
  activeAccountId: string | null;
}

function pickOne<T>(arr: T[], rnd: () => number): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(rnd() * arr.length)];
}

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildTitle(
  template: string,
  synonyms: Record<string, string[]>,
  prefixes: string[],
  suffixes: string[],
  mode: TitleMode,
  rnd: () => number,
): string {
  let out = template;
  if (mode === "synonym_swap" || mode === "shuffle_words") {
    out = out.replace(/\{(\w+)\}/g, (_, key) => {
      const opts = synonyms[key] || [];
      return pickOne(opts, rnd) ?? `{${key}}`;
    });
  }
  if (mode === "shuffle_words") {
    const parts = out.split(/\s+/);
    for (let i = parts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [parts[i], parts[j]] = [parts[j], parts[i]];
    }
    out = parts.join(" ");
  }
  if (mode === "prefix_suffix") {
    const p = pickOne(prefixes, rnd);
    const s = pickOne(suffixes, rnd);
    out = [p, out, s].filter(Boolean).join(" ");
  }
  return out.trim();
}

function buildDescription(
  template: string,
  intros: string[],
  outros: string[],
  synonyms: Record<string, string[]>,
  mode: DescMode,
  rnd: () => number,
): string {
  let body = template;
  if (mode === "synonym_swap") {
    body = body.replace(/\{(\w+)\}/g, (_, key) => {
      const opts = synonyms[key] || [];
      return pickOne(opts, rnd) ?? `{${key}}`;
    });
  }
  if (mode === "paragraph_shuffle") {
    const paras = body.split(/\n{2,}/);
    for (let i = paras.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [paras[i], paras[j]] = [paras[j], paras[i]];
    }
    body = paras.join("\n\n");
  }
  if (mode === "intro_outro") {
    return [pickOne(intros, rnd), body, pickOne(outros, rnd)].filter(Boolean).join("\n\n");
  }
  return body;
}

export function AvitoCreateListingsPanel({ storeId, activeAccountId }: Props) {
  const [count, setCount] = useState<number | "">(5);
  const [titleTemplate, setTitleTemplate] = useState(
    "{type} {product} {quality}",
  );
  const [titleSynonyms, setTitleSynonyms] = useState(
    "type: Свежий, Отборный, Премиум, Качественный\nproduct: сыр, пармезан, моцарелла\nquality: класса А, для ресторана, оптом",
  );
  const [titlePrefixes, setTitlePrefixes] = useState("");
  const [titleSuffixes, setTitleSuffixes] = useState("");
  const [titleMode, setTitleMode] = useState<TitleMode>("synonym_swap");

  const [descTemplate, setDescTemplate] = useState(
    "Предлагаем {product}. {quality}.\n\nОтгрузка ежедневно, доставка по городу и области.",
  );
  const [descIntros, setDescIntros] = useState(
    "Принимаем заказы ежедневно.\nДоступно к заказу прямо сейчас.\nСвежая партия на складе.",
  );
  const [descOutros, setDescOutros] = useState(
    "Доставка по городу.\nСамовывоз и доставка.\nОтгружаем со склада в день заказа.",
  );
  const [descMode, setDescMode] = useState<DescMode>("intro_outro");
  const [uniqueizePerListing, setUniqueizePerListing] = useState(true);

  const [preview, setPreview] = useState<PreviewRow[]>([]);

  const parseSyn = (raw: string): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([^:]+):\s*(.+)$/);
      if (m) out[m[1].trim()] = m[2].split(",").map((s) => s.trim()).filter(Boolean);
    });
    return out;
  };
  const parseLines = (raw: string) =>
    raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  const handlePreview = () => {
    const n = Number(count) || 0;
    if (n < 1 || n > 200) {
      toast.error("Укажите количество от 1 до 200");
      return;
    }
    const synT = parseSyn(titleSynonyms);
    const synD = parseSyn(titleSynonyms); // используем общие синонимы и для описания
    const intros = parseLines(descIntros);
    const outros = parseLines(descOutros);
    const prefixes = parseLines(titlePrefixes);
    const suffixes = parseLines(titleSuffixes);

    const rows: PreviewRow[] = [];
    for (let i = 0; i < n; i++) {
      const rnd = makeRng((uniqueizePerListing ? i + 1 : 1) * 2654435761);
      rows.push({
        title: buildTitle(titleTemplate, synT, prefixes, suffixes, titleMode, rnd),
        description: buildDescription(descTemplate, intros, outros, synD, descMode, rnd),
      });
    }
    setPreview(rows);
  };

  const handleCreate = () => {
    toast.info("Скелет: запись в БД ещё не подключена. Здесь будет создание объявлений в avito_listing_variants.");
  };

  return (
    <Card className="p-4 space-y-4 border-primary/20 bg-primary/[0.02]">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Создать новые объявления</h3>
            <Badge variant="secondary" className="text-[10px]">скелет</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Генерация объявлений «с нуля» — без привязки к товарам прайс-листа. Задайте шаблоны и режим рандомизации.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs whitespace-nowrap">Количество</Label>
          <Input
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-24 h-8"
            placeholder="5"
          />
        </div>
      </div>

      {/* TITLE BLOCK */}
      <div className="rounded-md border p-3 space-y-2 bg-background">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5" /> Название
          </Label>
          <Select value={titleMode} onValueChange={(v) => setTitleMode(v as TitleMode)}>
            <SelectTrigger className="h-8 w-[230px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="synonym_swap">Замена синонимов в {`{slot}`}</SelectItem>
              <SelectItem value="shuffle_words">Перемешать слова</SelectItem>
              <SelectItem value="prefix_suffix">Префикс + суффикс</SelectItem>
              <SelectItem value="template_only">Без рандомизации</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          value={titleTemplate}
          onChange={(e) => setTitleTemplate(e.target.value)}
          placeholder="Например: {type} {product} {quality}"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Синонимы для слотов (формат: slot: a, b, c)</Label>
            <Textarea
              value={titleSynonyms}
              onChange={(e) => setTitleSynonyms(e.target.value)}
              rows={4}
              className="text-xs font-mono"
            />
          </div>
          <div className="grid grid-rows-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Префиксы (по строкам)</Label>
              <Textarea
                value={titlePrefixes}
                onChange={(e) => setTitlePrefixes(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="Срочно&#10;Новое поступление"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Суффиксы (по строкам)</Label>
              <Textarea
                value={titleSuffixes}
                onChange={(e) => setTitleSuffixes(e.target.value)}
                rows={2}
                className="text-xs"
                placeholder="— оптом&#10;(в Москве)"
              />
            </div>
          </div>
        </div>
      </div>

      {/* DESCRIPTION BLOCK */}
      <div className="rounded-md border p-3 space-y-2 bg-background">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Shuffle className="h-3.5 w-3.5" /> Описание
          </Label>
          <Select value={descMode} onValueChange={(v) => setDescMode(v as DescMode)}>
            <SelectTrigger className="h-8 w-[230px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="intro_outro">Вставлять вступление + концовку</SelectItem>
              <SelectItem value="paragraph_shuffle">Перемешать абзацы</SelectItem>
              <SelectItem value="synonym_swap">Замена синонимов в {`{slot}`}</SelectItem>
              <SelectItem value="template_only">Без рандомизации</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={descTemplate}
          onChange={(e) => setDescTemplate(e.target.value)}
          rows={4}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Варианты вступлений (по строкам)</Label>
            <Textarea
              value={descIntros}
              onChange={(e) => setDescIntros(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Варианты концовок (по строкам)</Label>
            <Textarea
              value={descOutros}
              onChange={(e) => setDescOutros(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={uniqueizePerListing}
            onCheckedChange={(c) => setUniqueizePerListing(!!c)}
          />
          Уникализировать каждое объявление детерминированным сидом (одинаковый результат при повторе)
        </label>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={handlePreview} variant="secondary" className="gap-1">
          <Sparkles className="h-4 w-4" /> Сгенерировать превью
        </Button>
        <Button onClick={handleCreate} disabled={!preview.length} className="gap-1">
          <Plus className="h-4 w-4" /> Создать {preview.length || ""} объявлений
        </Button>
        {!activeAccountId && (
          <span className="text-xs text-amber-600 flex items-center gap-1">
            <Info className="h-3 w-3" /> Выберите аккаунт Авито, чтобы записать объявления
          </span>
        )}
      </div>

      {preview.length > 0 && (
        <div className="rounded-md border bg-background divide-y">
          <div className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Превью ({preview.length})
          </div>
          {preview.map((row, i) => (
            <div key={i} className="p-3 space-y-1">
              <div className="text-sm font-medium">{i + 1}. {row.title}</div>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap">{row.description}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
