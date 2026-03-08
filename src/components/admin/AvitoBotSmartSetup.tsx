import React, { useState } from "react";
import { ShoppingBag, User, Monitor, Sparkles, Mic, Undo2, Redo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface SmartSetupData {
  category: "products" | "services" | "online" | "other";
  company_info: string;
  pricing_info: string;
  delivery_info: string;
  customer_interaction: string;
}

interface SmartSetupProps {
  data: SmartSetupData;
  onChange: (data: SmartSetupData) => void;
  storeId: string | null;
  botId: string;
}

const CATEGORIES = [
  { id: "products" as const, label: "Товары", emoji: "🛍️", icon: ShoppingBag },
  { id: "services" as const, label: "Услуги", emoji: "👩‍💼", icon: User },
  { id: "online" as const, label: "Онлайн-сервис", emoji: "📱", icon: Monitor },
  { id: "other" as const, label: "Другое", emoji: "✨", icon: Sparkles },
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
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [history, setHistory] = useState<string[]>([]);

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
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-shrink-0 gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
          onClick={onImprove}
          disabled={improving || !value.trim()}
        >
          {improving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Открыть в компоновщике
        </Button>
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
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleUndo}
              disabled={historyIndex < 0}
            >
              <Mic className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleUndo}
              disabled={historyIndex < 0}
            >
              <Undo2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
            >
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
              {improving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
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

const QUESTIONS = [
  {
    key: "company_info" as const,
    question: "Как называется компания / кто продаёт? Что за продукция? Какой график работы? Что важно знать о вас?",
    instruction: `Укажите общую информацию о вашем бизнесе:
- Название компании или имя продавца;
- Что вы предлагаете (категория товаров, ниша);
- Основные особенности и преимущества (опыт, стиль работы, уникальное торговое предложение);
- График работы.`,
    example: `Меня зовут Алексей, я продаю качественные итальянские продукты: оливки, сыры, прошутто. Работаю с 2015 года, более 500 довольных клиентов. Все товары привожу напрямую из Италии. Работаем с 9:00 до 21:00 без выходных.`,
  },
  {
    key: "pricing_info" as const,
    question: "Какие цены? Есть ли скидки? Если есть, то как их получить? Предоставляете ли вы бонусы или дополнительные услуги?",
    instruction: `Опишите подход к ценообразованию, расскажите о выгодах для клиента:
- Базовые цены или диапазон цен, формулы расчёта, если применимо;
- Условия, при которых даются скидки (например: по промокоду, при заказе от 3 штук и т.д.);
- Есть ли сезонные акции или распродажи;
- Какие бонусы или подарки вы предлагаете;
- Есть ли дополнительные платные или бесплатные услуги.`,
    example: `Цены указаны за 1 кг. При заказе от 3 кг — скидка 5%, от 5 кг — 10%. Постоянным клиентам даём накопительную скидку до 15%. К первому заказу прилагаем небольшой подарок — пробники других сортов.`,
  },
  {
    key: "delivery_info" as const,
    question: "Как получить товар? Есть ли доставка? Какие условия? Какие варианты оплаты? Какие гарантии и условия возврата средств? Как происходит оформление заказа?",
    instruction: `Уточните, что бот должен сообщить о процессе оформления заказа:
- Как получить товар (где вы находитесь, есть ли самовывоз, есть ли доставка, надо ли приезжать к вам в офис для заключения договора и пр.);
- Варианты доставки (куда, как быстро, стоимость);
- Способы оплаты (наличные, карта, онлайн, рассрочка и т.д.);
- Условия гарантии или возврата средств в тех или иных случаях;
- Требуются ли от клиента какие-то шаги для оформления заказа после завершения чата, если заявка не оформляется прямо через бот.`,
    example: `Доставляем по Москве курьером (от 300₽, бесплатно от 5000₽). Отправляем по России СДЭК или Почтой. Самовывоз возможен с м. Автозаводская. Оплата: перевод на карту или наличные при получении. Если товар не подошёл — вернём деньги в течение 7 дней.`,
  },
  {
    key: "customer_interaction" as const,
    question: "Что спрашивать у клиента? Нужно ли уточнять детали заказа прямо в чате? Что отвечать, если клиент отказывается? В каких случаях нужно отказать клиенту?",
    instruction: `Определите, что бот должен уточнять у клиента, если он готов сделать заказ, и как действовать при отказе:
- Какие данные нужно запросить (товар, количество, адрес, имя и т.п.);
- В каких случаях обязательно задавать уточняющие вопросы, если клиент не прояснил их сам;
- Что бот должен сказать, если клиент отказывается (использовать ли техники работы с возражениями, предложить скидку, вежливо поблагодарить и т.п.);
- Когда можно отказать клиенту (например, нет доставки в ваш регион, нет нужного товара, клиент клянчит скидку и т.п.).`,
    example: `При заказе уточнить: какой именно товар, сколько, адрес доставки, имя и телефон. Если клиент сомневается — предложить пробник или небольшую партию. Если просит невозможную скидку — вежливо объяснить, что это минимальная цена. Не доставляем в Крым и за рубеж.`,
  },
];

export function AvitoBotSmartSetup({ data, onChange, storeId, botId }: SmartSetupProps) {
  const { toast } = useToast();
  const [improvingField, setImprovingField] = useState<string | null>(null);

  const handleCategoryChange = (category: SmartSetupData["category"]) => {
    onChange({ ...data, category });
  };

  const handleFieldChange = (field: keyof SmartSetupData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleImprove = async (field: keyof SmartSetupData) => {
    if (!data[field]?.trim()) return;
    
    setImprovingField(field);
    try {
      const { data: result, error } = await supabase.functions.invoke("ai-generate-description", {
        body: {
          prompt: `Улучши и дополни следующий текст для промпта бота на Авито. Сделай его более чётким, структурированным и профессиональным, сохранив всю исходную информацию. Категория бизнеса: ${data.category}. Исходный текст:\n\n${data[field]}`,
          store_id: storeId,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      const improved = result?.description || result?.text || "";
      if (improved) {
        handleFieldChange(field, improved);
        toast({ title: "Текст улучшен" });
      }
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setImprovingField(null);
    }
  };

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

      {/* Question Blocks */}
      {QUESTIONS.map((q) => (
        <QuestionBlock
          key={q.key}
          question={q.question}
          value={data[q.key] || ""}
          onChange={(value) => handleFieldChange(q.key, value)}
          instruction={q.instruction}
          example={q.example}
          onImprove={() => handleImprove(q.key)}
          improving={improvingField === q.key}
        />
      ))}
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

  parts.push("\n\nВАЖНО: Всегда будь вежливым и профессиональным. Отвечай по существу. Если не знаешь ответа — попроси клиента уточнить или предложи связаться с продавцом напрямую.");

  return parts.join("");
}
