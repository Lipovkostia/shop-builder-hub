import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles, Wand2, BookOpen, Plus, Trash2, Loader2, X,
  Smartphone, Monitor, AlertTriangle, CheckCircle2, Eye, Blocks, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RichTextToolbar } from "./RichTextToolbar";

export interface AiTemplate {
  id: string;
  name: string;
  instruction: string;
  maxChars: number;
  blocks?: { heading: string; main: string; advantages: string; cta: string };
  stopWords?: string;
  preserveCta?: boolean;
}

interface PreviewProduct {
  id: string;
  name: string;
  description?: string;
  pricePerUnit?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  singleProduct: PreviewProduct | null;
  previewProduct: PreviewProduct | null;
  city?: string;
  // controlled state — comes from parent
  instruction: string;
  setInstruction: (v: string) => void;
  maxChars: number;
  setMaxChars: (v: number) => void;
  // templates
  templates: AiTemplate[];
  onSaveTemplate: (tpl: Omit<AiTemplate, "id">) => void;
  onDeleteTemplate: (id: string) => void;
  // generation
  generating: boolean;
  progress: { done: number; total: number };
  onGenerate: (compiled: { instruction: string; maxChars: number }) => void;
}

const PLACEHOLDERS = [
  { key: "{product_name}", label: "Название" },
  { key: "{price}", label: "Цена" },
  { key: "{city}", label: "Город" },
  { key: "{description}", label: "Старое описание" },
];

const DEFAULT_STOP_WORDS = "бесплатно, гарантия 100%, акция, скидка только сегодня, дешевле всех, лучший, №1";

const PHONE_RE = /(\+?\d[\d\s\-()]{8,}\d)/g;
const URL_RE = /\bhttps?:\/\/\S+|www\.\S+|\b\S+\.(ru|com|net|org|рф)\b/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const TG_RE = /@[a-zA-Z][\w_]{3,}/g;
const CAPS_RE = /[А-ЯA-Z]{5,}/g;

function fillPlaceholders(text: string, p: PreviewProduct | null, city?: string) {
  if (!p) return text;
  return text
    .replace(/\{product_name\}/g, p.name || "")
    .replace(/\{price\}/g, p.pricePerUnit ? `${Math.round(p.pricePerUnit)} ₽` : "")
    .replace(/\{city\}/g, city || "вашем городе")
    .replace(/\{description\}/g, p.description || "");
}

export function AvitoAiDescriptionWorkspace({
  open, onOpenChange, selectedCount, singleProduct, previewProduct, city,
  instruction, setInstruction, maxChars, setMaxChars,
  templates, onSaveTemplate, onDeleteTemplate,
  generating, progress, onGenerate,
}: Props) {
  const [tab, setTab] = useState<"prompt" | "blocks" | "rules">("prompt");

  const [heading, setHeading] = useState("");
  const [main, setMain] = useState("");
  const [advantages, setAdvantages] = useState("");
  const [cta, setCta] = useState("");
  const [stopWords, setStopWords] = useState(DEFAULT_STOP_WORDS);
  const [preserveCta, setPreserveCta] = useState(true);
  const [useBlocks, setUseBlocks] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [newTplName, setNewTplName] = useState("");
  const [previewExpanded, setPreviewExpanded] = useState(false);

  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLTextAreaElement>(null);
  const mainRef = useRef<HTMLTextAreaElement>(null);
  const advantagesRef = useRef<HTMLTextAreaElement>(null);
  const ctaRef = useRef<HTMLTextAreaElement>(null);


  // Compose final instruction sent to AI
  const compiledInstruction = useMemo(() => {
    const parts: string[] = [];
    if (instruction.trim()) parts.push(instruction.trim());

    if (useBlocks) {
      parts.push(
        "СТРУКТУРА ОБЪЯВЛЕНИЯ (соблюдай порядок блоков, разделяй пустой строкой):\n" +
          `[Заголовок]: ${heading || "— краткий цепляющий заголовок"}\n` +
          `[Основная информация]: ${main || "— описание товара и характеристики"}\n` +
          `[Преимущества]: ${advantages || "— список плюсов через дефис"}\n` +
          `[CTA]: ${cta || "— призыв к действию в конце"}`,
      );
    } else if (cta.trim() && preserveCta) {
      parts.push(`ВСЕГДА завершай текст этим призывом к действию (CTA): "${cta.trim()}"`);
    }

    if (stopWords.trim()) {
      parts.push(
        `ЗАПРЕЩЁННЫЕ слова и фразы (НЕ используй их в тексте): ${stopWords.trim()}. ` +
          "Также не вставляй ссылки, номера телефонов, e-mail, мессенджеры (@username), КАПС подряд.",
      );
    }

    parts.push(
      "Поддерживаются плейсхолдеры в тексте, которые НЕ нужно раскрывать самому — оставляй как есть, " +
        "система подставит их сама: {product_name}, {price}, {city}, {description}.",
    );

    return parts.join("\n\n");
  }, [instruction, useBlocks, heading, main, advantages, cta, preserveCta, stopWords]);

  // Live preview text
  const previewRaw = useMemo(() => {
    if (useBlocks) {
      const parts = [heading, main, advantages, cta].filter(Boolean);
      return parts.join("\n\n");
    }
    // pretend live: show user's instruction skeleton until generation
    const sample =
      `{product_name}\n\n${instruction || "Описание появится здесь после генерации."}` +
      (cta ? `\n\n${cta}` : "");
    return sample;
  }, [useBlocks, heading, main, advantages, cta, instruction]);

  const preview = useMemo(() => fillPlaceholders(previewRaw, previewProduct, city), [previewRaw, previewProduct, city]);

  // Avito hides text after ~150 chars on mobile under "Показать ещё"
  const CUTOFF = device === "mobile" ? 150 : 300;
  const visibleBeforeCut = preview.slice(0, CUTOFF);
  const cutHidden = preview.length > CUTOFF;

  // Moderation validation
  const issues = useMemo(() => {
    const out: { type: "error" | "warn"; msg: string; sample?: string }[] = [];
    const phones = preview.match(PHONE_RE);
    if (phones) out.push({ type: "error", msg: "Номер телефона в тексте", sample: phones[0] });
    const urls = preview.match(URL_RE);
    if (urls) out.push({ type: "error", msg: "Ссылка в тексте", sample: urls[0] });
    const emails = preview.match(EMAIL_RE);
    if (emails) out.push({ type: "error", msg: "E-mail в тексте", sample: emails[0] });
    const tg = preview.match(TG_RE);
    if (tg) out.push({ type: "error", msg: "Упоминание мессенджера", sample: tg[0] });
    const caps = preview.match(CAPS_RE);
    if (caps) out.push({ type: "warn", msg: "КАПС подряд (модерация не любит)", sample: caps[0] });
    if (preview.length > maxChars) out.push({ type: "warn", msg: `Превышен лимит символов (${preview.length}/${maxChars})` });
    if (stopWords) {
      const words = stopWords.split(",").map((s) => s.trim()).filter(Boolean);
      for (const w of words) {
        if (w && preview.toLowerCase().includes(w.toLowerCase())) {
          out.push({ type: "warn", msg: `Стоп-слово: «${w}»` });
        }
      }
    }
    return out;
  }, [preview, maxChars, stopWords]);

  const handleInsertPlaceholder = (key: string) => {
    setInstruction(instruction + (instruction.endsWith(" ") || !instruction ? "" : " ") + key + " ");
  };

  const handleLoadTpl = (tpl: AiTemplate) => {
    setInstruction(tpl.instruction);
    setMaxChars(tpl.maxChars);
    if (tpl.blocks) {
      setHeading(tpl.blocks.heading);
      setMain(tpl.blocks.main);
      setAdvantages(tpl.blocks.advantages);
      setCta(tpl.blocks.cta);
      setUseBlocks(true);
    }
    if (tpl.stopWords !== undefined) setStopWords(tpl.stopWords);
    if (tpl.preserveCta !== undefined) setPreserveCta(tpl.preserveCta);
  };

  const handleSaveTpl = () => {
    if (!newTplName.trim()) return;
    onSaveTemplate({
      name: newTplName.trim(),
      instruction,
      maxChars,
      blocks: useBlocks ? { heading, main, advantages, cta } : undefined,
      stopWords,
      preserveCta,
    });
    setNewTplName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 max-w-[100vw] w-screen h-screen sm:rounded-none border-0 sm:max-w-[100vw]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b bg-background shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">AI-генерация описаний для Авито</h2>
            <Badge variant="secondary" className="text-[10px]">
              {singleProduct ? singleProduct.name : `${selectedCount} товаров`}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {generating && progress.total > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {progress.done}/{progress.total}
              </div>
            )}
            <Button
              size="sm"
              onClick={() => onGenerate({ instruction: compiledInstruction, maxChars })}
              disabled={generating || (selectedCount === 0 && !singleProduct)}
            >
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              {generating ? "Генерация..." : `Сгенерировать${singleProduct ? "" : ` (${selectedCount})`}`}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEFT: tools */}
          <div className="w-[58%] border-r flex flex-col min-h-0">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "prompt" | "blocks" | "rules")} className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-3 mt-3 grid grid-cols-3 w-auto">
                <TabsTrigger value="prompt" className="text-xs">
                  <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Промпт
                </TabsTrigger>
                <TabsTrigger value="blocks" className="text-xs">
                  <Blocks className="h-3.5 w-3.5 mr-1.5" /> Блоки
                </TabsTrigger>
                <TabsTrigger value="rules" className="text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Правила
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-3">
                <div className="px-4 pb-6 space-y-5">
                  {/* Templates always visible */}
                  {templates.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" /> Шаблоны
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {templates.map((tpl) => (
                          <div key={tpl.id} className="group inline-flex items-center gap-1 px-2 py-1 rounded-md border bg-muted/40 hover:bg-muted/70 transition-colors">
                            <button className="text-xs font-medium" onClick={() => handleLoadTpl(tpl)} title={tpl.instruction}>
                              {tpl.name}
                            </button>
                            <span className="text-[10px] text-muted-foreground">· {tpl.maxChars}</span>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                              onClick={() => onDeleteTemplate(tpl.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <TabsContent value="prompt" className="space-y-4 mt-0">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Инструкция для AI</Label>
                      <RichTextToolbar
                        targetRef={instructionRef}
                        value={instruction}
                        onChange={setInstruction}
                        placeholders={PLACEHOLDERS}
                        onInsertPlaceholder={handleInsertPlaceholder}
                      />
                      <Textarea
                        ref={instructionRef}
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="Например: Пиши от лица оптового поставщика мясной продукции. Упоминай, что доставка по Москве и МО."
                        className="text-sm min-h-[180px] font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Выделите текст и нажмите <b>B/I/S</b> — символы заменятся на Unicode-аналоги, которые Авито отображает как
                        жирный/курсив/зачёркнутый. Эмодзи вставляются в позиции курсора.
                      </p>
                    </div>


                    <Separator />

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Лимит символов</Label>
                        <Input
                          type="number"
                          value={maxChars}
                          onChange={(e) => setMaxChars(Number(e.target.value) || 500)}
                          className="h-8 text-sm"
                          min={50}
                          max={7500}
                        />
                        <p className="text-[10px] text-muted-foreground">Авито: до 7500. Рекомендуем 400–1500.</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Сохранить шаблон</Label>
                        <div className="flex gap-1.5">
                          <Input
                            value={newTplName}
                            onChange={(e) => setNewTplName(e.target.value)}
                            placeholder="Название"
                            className="h-8 text-sm"
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveTpl(); }}
                          />
                          <Button size="sm" variant="outline" className="h-8" onClick={handleSaveTpl}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="blocks" className="space-y-4 mt-0">
                    <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                      <div className="text-xs">
                        <div className="font-medium">Блочная структура</div>
                        <div className="text-muted-foreground text-[11px]">
                          AI собирает текст из 4-х блоков. Можно редактировать только один — остальные остаются.
                        </div>
                      </div>
                      <Switch checked={useBlocks} onCheckedChange={setUseBlocks} />
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">1. Заголовок</Label>
                        <Textarea value={heading} onChange={(e) => setHeading(e.target.value)} className="text-sm min-h-[60px]" placeholder="{product_name} — оптовая цена от поставщика" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">2. Основная информация</Label>
                        <Textarea value={main} onChange={(e) => setMain(e.target.value)} className="text-sm min-h-[80px]" placeholder="Опиши состав, вес, происхождение. Используй {description}." />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">3. Преимущества</Label>
                        <Textarea value={advantages} onChange={(e) => setAdvantages(e.target.value)} className="text-sm min-h-[80px]" placeholder="— свежие поставки еженедельно&#10;— доставка по {city}&#10;— документы и сертификаты" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">4. CTA (призыв)</Label>
                        <Textarea value={cta} onChange={(e) => setCta(e.target.value)} className="text-sm min-h-[60px]" placeholder="Напишите в чат за прайсом — пришлём в течение часа." />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="rules" className="space-y-4 mt-0">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Стоп-слова (через запятую)</Label>
                      <Textarea
                        value={stopWords}
                        onChange={(e) => setStopWords(e.target.value)}
                        className="text-sm min-h-[100px] font-mono"
                        placeholder="бесплатно, гарантия 100%, лучший"
                      />
                      <p className="text-[10px] text-muted-foreground">AI исключит эти слова. Валидатор справа отметит, если они всё же появились.</p>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                      <div className="text-xs">
                        <div className="font-medium">Сохранять CTA в конце</div>
                        <div className="text-muted-foreground text-[11px]">AI обязан завершить текст вашим призывом из вкладки «Блоки».</div>
                      </div>
                      <Switch checked={preserveCta} onCheckedChange={setPreserveCta} />
                    </div>

                    <div className="rounded-md border p-3 space-y-1.5 bg-muted/20">
                      <div className="text-[11px] font-medium text-muted-foreground">Автоматически запрещено модерацией Авито:</div>
                      <ul className="text-[11px] space-y-0.5 text-muted-foreground list-disc pl-4">
                        <li>Номера телефонов и e-mail в тексте</li>
                        <li>Ссылки (http://, .ru, .com)</li>
                        <li>Упоминания мессенджеров (@username)</li>
                        <li>КАПС из 5+ букв подряд</li>
                      </ul>
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>

          {/* RIGHT: preview + validator */}
          <div className="flex-1 flex flex-col min-h-0 bg-muted/20">
            <div className="px-4 h-10 border-b bg-background flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Live-превью</span>
                {previewProduct && <Badge variant="outline" className="text-[10px]">{previewProduct.name}</Badge>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant={device === "mobile" ? "default" : "ghost"} className="h-7 text-[11px]" onClick={() => setDevice("mobile")}>
                  <Smartphone className="h-3 w-3 mr-1" /> Моб.
                </Button>
                <Button size="sm" variant={device === "desktop" ? "default" : "ghost"} className="h-7 text-[11px]" onClick={() => setDevice("desktop")}>
                  <Monitor className="h-3 w-3 mr-1" /> Десктоп
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 flex justify-center">
                <div
                  className={cn(
                    "bg-background border rounded-xl shadow-sm transition-all",
                    device === "mobile" ? "w-[360px]" : "w-full max-w-[640px]",
                  )}
                >
                  {/* Avito-style header */}
                  <div className="px-4 pt-4 pb-2">
                    <div className="text-base font-semibold leading-tight">
                      {previewProduct?.name || "Название товара"}
                    </div>
                    <div className="text-xl font-bold mt-1">
                      {previewProduct?.pricePerUnit ? `${Math.round(previewProduct.pricePerUnit).toLocaleString("ru-RU")} ₽` : "—"}
                    </div>
                  </div>
                  <Separator />
                  <div className="px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Описание</div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      <span>{visibleBeforeCut}</span>
                      {cutHidden && (
                        <>
                          <span className="text-muted-foreground/50">{preview.slice(CUTOFF, CUTOFF + 60)}…</span>
                          <div className="mt-2 text-primary text-xs font-medium cursor-pointer">Показать ещё ↓</div>
                          <div className="opacity-50 mt-1">{preview.slice(CUTOFF + 60)}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Counters + validator */}
              <div className="px-4 pb-6 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <CounterCard label="Всего символов" value={preview.length} max={maxChars} />
                  <CounterCard label={`До «Показать ещё»`} value={Math.min(preview.length, CUTOFF)} max={CUTOFF} />
                  <CounterCard label="Строк" value={preview.split("\n").length} />
                </div>

                <div className="rounded-lg border bg-background p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium">Валидатор модерации Авито</span>
                  </div>
                  {issues.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Замечаний нет — текст соответствует правилам.
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {issues.map((i, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs">
                          <span
                            className={cn(
                              "mt-0.5 h-1.5 w-1.5 rounded-full shrink-0",
                              i.type === "error" ? "bg-destructive" : "bg-amber-500",
                            )}
                          />
                          <span className={cn(i.type === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-500")}>
                            {i.msg}
                            {i.sample && <code className="ml-1 px-1 py-0.5 rounded bg-muted text-[10px]">{i.sample}</code>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <details className="rounded-lg border bg-background p-3 text-xs">
                  <summary className="cursor-pointer text-muted-foreground font-medium">Скомпилированный промпт для AI</summary>
                  <pre className="mt-2 text-[11px] whitespace-pre-wrap font-mono text-muted-foreground">{compiledInstruction || "(пусто)"}</pre>
                </details>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CounterCard({ label, value, max }: { label: string; value: number; max?: number }) {
  const over = max !== undefined && value > max;
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="rounded-lg border bg-background p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-base font-semibold", over && "text-destructive")}>
        {value}
        {max !== undefined && <span className="text-muted-foreground text-xs font-normal"> / {max}</span>}
      </div>
      {max !== undefined && (
        <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full", over ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
