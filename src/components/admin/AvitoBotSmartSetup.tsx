import React, { useState } from "react";
import { ShoppingBag, User, Monitor, Sparkles, Mic, Undo2, Redo2, Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CustomBlock {
  id: string;
  title: string;
  content: string;
}

export interface SmartSetupData {
  category: "products" | "services" | "online" | "other";
  company_info: string;
  pricing_info: string;
  delivery_info: string;
  customer_interaction: string;
  custom_blocks?: CustomBlock[];
}

interface SmartSetupProps {
  data: SmartSetupData;
  onChange: (data: SmartSetupData) => void;
  storeId: string | null;
  botId: string;
}

const CATEGORIES = [
  { id: "products" as const, label: "Товары", emoji: "🛍️" },
  { id: "services" as const, label: "Услуги", emoji: "👩‍💼" },
  { id: "online" as const, label: "Онлайн-сервис", emoji: "📱" },
  { id: "other" as const, label: "Другое", emoji: "✨" },
];

interface QuestionBlockProps {
  question: string;
  value: string;
  onChange: (value: string) => void;
  instruction: string;
  example: string;
  onImprove: () => Promise<void>;
  improving: boolean;
}

function QuestionBlock({ question, value, onChange, instruction, example, onImprove, improving }: QuestionBlockProps) {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleChange = (newValue: string) => {
    if (value && value !== newValue) {
      setHistory(prev => [...prev.slice(0, historyIndex + 1), value]);
      setHistoryIndex(prev => prev + 1);
    }
    onChange(newValue);
  };

  const handleUndo = () => {
    if (historyIndex >= 0) {
      onChange(history[historyIndex]);
      setHistoryIndex(prev => prev - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      onChange(history[historyIndex + 1]);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold leading-tight">{question}</h3>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Введите информацию..."
            className="min-h-[180px] resize-none"
          />
          <div className="flex items-center gap-1 mt-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleUndo} disabled={historyIndex < 0}>
              <Undo2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
              <Redo2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="text-primary gap-1"
              onClick={onImprove}
              disabled={improving || !value.trim()}
            >
              {improving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Улучшить
            </Button>
          </div>
        </div>

        <div className="w-72 flex-shrink-0">
          <Tabs defaultValue="instruction" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="instruction">Инструкция</TabsTrigger>
              <TabsTrigger value="example">Пример</TabsTrigger>
            </TabsList>
            <TabsContent value="instruction" className="mt-3">
              <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {instruction}
              </div>
            </TabsContent>
            <TabsContent value="example" className="mt-3">
              <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed bg-muted/50 p-3 rounded-md border">
                {example}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Card>
  );
}

// ===== CATEGORY-SPECIFIC QUESTIONS =====

interface QuestionDef {
  key: "company_info" | "pricing_info" | "delivery_info" | "customer_interaction";
  question: string;
  instruction: string;
  example: string;
}

const QUESTIONS_PRODUCTS: QuestionDef[] = [
  {
    key: "company_info",
    question: "Как называется компания / кто продаёт? Что за продукция? Какой график работы? Что важно знать о вас?",
    instruction: `Укажите общую информацию о вашем бизнесе:
- Название компании или имя продавца;
- Что вы предлагаете (категория товаров, ниша);
- Основные особенности и преимущества;
- График работы.`,
    example: `Меня зовут Алексей, я продаю качественные итальянские продукты: оливки, сыры, прошутто. Работаю с 2015 года, более 500 довольных клиентов. Все товары привожу напрямую из Италии. Работаем с 9:00 до 21:00 без выходных.`,
  },
  {
    key: "pricing_info",
    question: "Какие цены? Есть ли скидки? Как их получить? Предоставляете ли вы бонусы или дополнительные услуги?",
    instruction: `Опишите подход к ценообразованию:
- Базовые цены или диапазон цен;
- Условия скидок (промокод, объём заказа и т.д.);
- Сезонные акции или распродажи;
- Бонусы или подарки;
- Дополнительные услуги.`,
    example: `Цены указаны за 1 кг. При заказе от 3 кг — скидка 5%, от 5 кг — 10%. Постоянным клиентам даём накопительную скидку до 15%. К первому заказу прилагаем пробники.`,
  },
  {
    key: "delivery_info",
    question: "Как получить товар? Есть ли доставка? Какие условия оплаты? Гарантии и возврат? Как оформить заказ?",
    instruction: `Уточните информацию о процессе заказа:
- Способы получения (самовывоз, доставка);
- Варианты доставки (регионы, сроки, стоимость);
- Способы оплаты;
- Условия гарантии или возврата;
- Шаги оформления заказа.`,
    example: `Доставляем по Москве курьером (от 300₽, бесплатно от 5000₽). Отправляем по России СДЭК или Почтой. Самовывоз с м. Автозаводская. Оплата: перевод на карту или наличные. Возврат денег в течение 7 дней.`,
  },
  {
    key: "customer_interaction",
    question: "Что спрашивать у клиента? Нужно ли уточнять детали? Что отвечать при отказе? Когда отказать клиенту?",
    instruction: `Определите взаимодействие бота с клиентом:
- Какие данные запрашивать (товар, количество, адрес);
- Когда задавать уточняющие вопросы;
- Как реагировать на отказ (возражения, скидки);
- Когда отказать клиенту.`,
    example: `При заказе уточнить: какой товар, сколько, адрес, имя и телефон. Если сомневается — предложить пробник. Если просит невозможную скидку — вежливо объяснить. Не доставляем в Крым и за рубеж.`,
  },
];

const QUESTIONS_SERVICES: QuestionDef[] = [
  {
    key: "company_info",
    question: "Кто вы? Какие услуги оказываете? Какой опыт? График работы? Ваши преимущества?",
    instruction: `Расскажите о себе и своих услугах:
- Название компании или ваше имя, специализация;
- Какие услуги вы оказываете (перечень);
- Опыт работы, сертификаты, квалификация;
- График и режим работы;
- Чем вы лучше конкурентов.`,
    example: `Студия «Комфорт». Оказываем услуги по ремонту квартир: от косметического до капитального. Работаем с 2012 года, более 300 объектов. Бригада из 8 мастеров. Работаем ежедневно с 8:00 до 20:00. Предоставляем гарантию на все работы 2 года.`,
  },
  {
    key: "pricing_info",
    question: "Сколько стоят ваши услуги? От чего зависит цена? Есть ли скидки или пакетные предложения?",
    instruction: `Опишите ценообразование услуг:
- Фиксированные цены или диапазон «от ... до»;
- От чего зависит итоговая стоимость (объём, сложность, срочность);
- Есть ли бесплатная консультация или выезд;
- Пакетные предложения, абонементы;
- Скидки для постоянных клиентов.`,
    example: `Косметический ремонт — от 3 500₽/м². Капитальный — от 7 000₽/м². Цена зависит от объёма и материалов. Бесплатный выезд замерщика. При заказе ремонта «под ключ» — скидка 10%. Постоянным клиентам — 5% на следующий заказ.`,
  },
  {
    key: "delivery_info",
    question: "Как проходит оказание услуги? Какие этапы? Варианты оплаты? Гарантии? Что нужно от клиента?",
    instruction: `Опишите процесс работы:
- Этапы оказания услуги (консультация, выезд, выполнение, сдача);
- Сроки выполнения;
- Варианты оплаты (предоплата, по этапам, по завершению);
- Гарантийные обязательства;
- Какие документы или данные нужны от клиента.`,
    example: `Этапы: 1) Бесплатная консультация, 2) Выезд замерщика, 3) Согласование сметы, 4) Выполнение работ, 5) Приёмка и гарантийный акт. Срок: от 2 недель. Оплата 50/50: предоплата и по завершению. Гарантия 2 года.`,
  },
  {
    key: "customer_interaction",
    question: "Что уточнять у клиента? Какие вопросы задать для оценки? Как обрабатывать возражения?",
    instruction: `Определите логику общения бота с клиентом:
- Какие данные нужны для оценки (адрес, площадь, фото);
- Какие вопросы задавать для понимания задачи;
- Как реагировать на «дорого» или сравнение с конкурентами;
- Когда перевести на живого специалиста.`,
    example: `Уточнить: какая услуга нужна, адрес объекта, желаемые сроки. Попросить фото или видео, если возможно. Если клиент говорит «дорого» — объяснить, что в стоимость входят материалы и гарантия. При сложных вопросах — предложить связь с мастером.`,
  },
];

const QUESTIONS_ONLINE: QuestionDef[] = [
  {
    key: "company_info",
    question: "Что за сервис? Для кого он? Какие ключевые функции? Чем отличаетесь от конкурентов?",
    instruction: `Расскажите о вашем онлайн-сервисе:
- Название и краткое описание;
- Целевая аудитория;
- Ключевые функции и возможности;
- Конкурентные преимущества;
- Поддерживаемые платформы (веб, iOS, Android).`,
    example: `TaskFlow — сервис управления проектами для малого бизнеса. Канбан-доски, учёт времени, автоматические отчёты. Интеграция с Telegram и Google Calendar. Отличие от конкурентов — простой интерфейс на русском языке и бесплатный тариф до 5 пользователей.`,
  },
  {
    key: "pricing_info",
    question: "Какие тарифы? Есть ли бесплатная версия? Пробный период? Как оплатить?",
    instruction: `Опишите тарифную политику:
- Список тарифов и что входит в каждый;
- Есть ли бесплатный тариф или пробный период;
- Стоимость и периодичность оплаты;
- Способы оплаты;
- Скидки при годовой подписке или для команд.`,
    example: `Бесплатный тариф: до 5 пользователей, 3 проекта. Про-тариф: 490₽/мес за пользователя — безлимитные проекты, интеграции, приоритетная поддержка. При годовой оплате — скидка 20%. 14-дней бесплатно на Про-тариф.`,
  },
  {
    key: "delivery_info",
    question: "Как начать? Нужна ли регистрация? Как подключить? Есть ли техподдержка? Условия возврата?",
    instruction: `Опишите процесс подключения:
- Как зарегистрироваться и начать;
- Нужна ли установка или всё в браузере;
- Как подключить команду;
- Каналы техподдержки (чат, email, телефон);
- Политика возврата средств.`,
    example: `Регистрация за 30 секунд по email или через Google. Работает в браузере, есть мобильное приложение. Приглашайте команду по ссылке. Техподдержка в чате с 9:00 до 21:00. Возврат — в течение 14 дней, если сервис не подошёл.`,
  },
  {
    key: "customer_interaction",
    question: "Какие вопросы задать клиенту? Как помочь выбрать тариф? Что делать при технических проблемах?",
    instruction: `Определите поведение бота:
- Что спрашивать (размер команды, задачи, бюджет);
- Как рекомендовать подходящий тариф;
- Как реагировать на технические вопросы;
- Когда переводить на живого оператора.`,
    example: `Спросить: сколько человек в команде, какие задачи хотите решить. Для 1-5 человек — рекомендовать бесплатный тариф. Для больших команд — Про. При техпроблемах — уточнить браузер/устройство и передать в поддержку с описанием.`,
  },
];

const QUESTIONS_OTHER: QuestionDef[] = [
  {
    key: "company_info",
    question: "Расскажите о себе. Чем вы занимаетесь? Что предлагаете на Авито? Какой у вас опыт?",
    instruction: `Общая информация:
- Кто вы (компания, частное лицо, ИП);
- Чем занимаетесь;
- Что предлагаете в объявлениях;
- Опыт и достижения;
- Режим работы.`,
    example: `Иван, частный мастер по ремонту техники Apple. Работаю с 2018 года. Чиню iPhone, iPad, MacBook. Опыт — более 2000 устройств. Работаю ежедневно с 10:00 до 22:00, принимаю у себя или выезжаю к клиенту.`,
  },
  {
    key: "pricing_info",
    question: "Сколько это стоит? Есть ли фиксированные цены? От чего зависит стоимость?",
    instruction: `Опишите ценообразование:
- Фиксированные цены или диапазон;
- Факторы, влияющие на стоимость;
- Предоплата или оплата по факту;
- Скидки и акции.`,
    example: `Замена экрана iPhone — от 3000₽ до 8000₽ в зависимости от модели. Диагностика бесплатно. Оплата после ремонта. Постоянным клиентам — скидка 10%.`,
  },
  {
    key: "delivery_info",
    question: "Как всё происходит? Какие шаги? Как с вами связаться? Есть ли гарантии?",
    instruction: `Процесс взаимодействия:
- Шаги от первого контакта до результата;
- Сроки;
- Способы связи;
- Гарантии;
- Что нужно от клиента.`,
    example: `Написать в чат → обсудить проблему → приехать ко мне или вызвать на дом → ремонт за 1-3 часа → проверка и оплата. Гарантия 3 месяца на работу и запчасти. Нужен только сам аппарат.`,
  },
  {
    key: "customer_interaction",
    question: "Что узнать у клиента? Как помочь определиться? Что делать при отказе?",
    instruction: `Логика общения:
- Какие вопросы задавать;
- Как помочь клиенту сделать выбор;
- Как работать с возражениями;
- Когда отказать.`,
    example: `Спросить: модель устройства, описание проблемы. Если клиент не уверен — предложить бесплатную диагностику. Если говорит «дорого» — объяснить, что используем оригинальные запчасти. Не берём устройства с признаками «утопления».`,
  },
];

function getQuestionsForCategory(category: SmartSetupData["category"]): QuestionDef[] {
  switch (category) {
    case "products": return QUESTIONS_PRODUCTS;
    case "services": return QUESTIONS_SERVICES;
    case "online": return QUESTIONS_ONLINE;
    case "other": return QUESTIONS_OTHER;
    default: return QUESTIONS_PRODUCTS;
  }
}

// ===== CUSTOM BLOCK COMPONENT =====
function CustomBlockEditor({
  block,
  onUpdate,
  onDelete,
  onImprove,
  improving,
}: {
  block: CustomBlock;
  onUpdate: (updates: Partial<CustomBlock>) => void;
  onDelete: () => void;
  onImprove: () => Promise<void>;
  improving: boolean;
}) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Input
            value={block.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Название блока (например: Часто задаваемые вопросы)"
            className="font-semibold border-none px-0 text-base shadow-none focus-visible:ring-0 placeholder:font-normal"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Textarea
        value={block.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        placeholder="Введите информацию, которую должен знать бот..."
        className="min-h-[140px] resize-none"
      />
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="text-primary gap-1" onClick={onImprove} disabled={improving || !block.content.trim()}>
          {improving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Улучшить
        </Button>
      </div>
    </Card>
  );
}

// ===== MAIN COMPONENT =====
export function AvitoBotSmartSetup({ data, onChange, storeId, botId }: SmartSetupProps) {
  const { toast } = useToast();
  const [improvingField, setImprovingField] = useState<string | null>(null);

  const handleCategoryChange = (category: SmartSetupData["category"]) => {
    onChange({ ...data, category });
  };

  const handleFieldChange = (field: keyof SmartSetupData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleImprove = async (field: string, text: string) => {
    if (!text.trim()) return;

    setImprovingField(field);
    try {
      const { data: result, error } = await supabase.functions.invoke("ai-generate-description", {
        body: {
          prompt: `Улучши и дополни следующий текст для промпта бота на Авито. Сделай его более чётким, структурированным и профессиональным, сохранив всю исходную информацию. Категория бизнеса: ${data.category}. Верни ТОЛЬКО улучшенный текст без пояснений.\n\nИсходный текст:\n${text}`,
          store_id: storeId,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const improved = result?.description || result?.text || "";
      if (improved) {
        toast({ title: "Текст улучшен ✨" });
        return improved;
      }
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setImprovingField(null);
    }
    return null;
  };

  const handleImproveField = async (field: keyof SmartSetupData) => {
    const improved = await handleImprove(field, data[field] as string);
    if (improved) handleFieldChange(field, improved);
  };

  // Custom blocks
  const customBlocks = data.custom_blocks || [];

  const addCustomBlock = () => {
    const newBlock: CustomBlock = {
      id: crypto.randomUUID(),
      title: "",
      content: "",
    };
    onChange({ ...data, custom_blocks: [...customBlocks, newBlock] });
  };

  const updateCustomBlock = (id: string, updates: Partial<CustomBlock>) => {
    onChange({
      ...data,
      custom_blocks: customBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    });
  };

  const deleteCustomBlock = (id: string) => {
    onChange({
      ...data,
      custom_blocks: customBlocks.filter((b) => b.id !== id),
    });
  };

  const handleImproveCustomBlock = async (block: CustomBlock) => {
    const improved = await handleImprove(`custom_${block.id}`, block.content);
    if (improved) updateCustomBlock(block.id, { content: improved });
  };

  const questions = getQuestionsForCategory(data.category);

  return (
    <div className="space-y-6">
      {/* Category Selection */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Выберите вашу категорию</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Умная настройка предложит вопросы в зависимости от категории
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={cn(
                "p-4 rounded-xl border-2 text-left transition-all hover:shadow-md",
                data.category === cat.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <span className="text-3xl block mb-2">{cat.emoji}</span>
              <span className="font-medium text-sm">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category-Specific Question Blocks */}
      {questions.map((q) => (
        <QuestionBlock
          key={`${data.category}_${q.key}`}
          question={q.question}
          value={(data[q.key] as string) || ""}
          onChange={(value) => handleFieldChange(q.key, value)}
          instruction={q.instruction}
          example={q.example}
          onImprove={() => handleImproveField(q.key)}
          improving={improvingField === q.key}
        />
      ))}

      {/* Custom Blocks */}
      {customBlocks.map((block) => (
        <CustomBlockEditor
          key={block.id}
          block={block}
          onUpdate={(updates) => updateCustomBlock(block.id, updates)}
          onDelete={() => deleteCustomBlock(block.id)}
          onImprove={() => handleImproveCustomBlock(block)}
          improving={improvingField === `custom_${block.id}`}
        />
      ))}

      {/* Add Custom Block Button */}
      <Button variant="outline" className="w-full gap-2 border-dashed" onClick={addCustomBlock}>
        <Plus className="h-4 w-4" />
        Добавить свой блок информации
      </Button>
    </div>
  );
}

// Helper function to build system prompt from smart setup data
export function buildSystemPromptFromSmartSetup(data: SmartSetupData): string {
  const parts: string[] = [];

  parts.push("Ты — виртуальный ассистент продавца на Авито. Твоя задача — помогать клиентам с информацией о товарах и услугах, отвечать на вопросы и помогать с оформлением заказа.");

  if (data.company_info) {
    parts.push(`\n\n--- ИНФОРМАЦИЯ О ПРОДАВЦЕ ---\n${data.company_info}`);
  }

  if (data.pricing_info) {
    parts.push(`\n\n--- ЦЕНООБРАЗОВАНИЕ И СКИДКИ ---\n${data.pricing_info}`);
  }

  if (data.delivery_info) {
    parts.push(`\n\n--- ДОСТАВКА, ОПЛАТА И ГАРАНТИИ ---\n${data.delivery_info}`);
  }

  if (data.customer_interaction) {
    parts.push(`\n\n--- ВЗАИМОДЕЙСТВИЕ С КЛИЕНТОМ ---\n${data.customer_interaction}`);
  }

  // Include custom blocks
  if (data.custom_blocks?.length) {
    for (const block of data.custom_blocks) {
      if (block.content.trim()) {
        const title = block.title.trim() || "ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ";
        parts.push(`\n\n--- ${title.toUpperCase()} ---\n${block.content}`);
      }
    }
  }

  parts.push("\n\nВАЖНО: Всегда будь вежливым и профессиональным. Отвечай по существу. Если не знаешь ответа — попроси клиента уточнить или предложи связаться с продавцом напрямую.");

  return parts.join("");
}
