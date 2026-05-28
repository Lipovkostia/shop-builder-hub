import { useState, RefObject } from "react";
import { Bold, Italic, Strikethrough, Smile, List, Heading } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Авито не поддерживает HTML/Markdown в описании, но поддерживает Unicode-символы.
 * Поэтому "жирный", "курсив", "зачёркнутый" реализуем через Unicode-альтернативы букв
 * и комбинирующий символ U+0336 для зачёркивания. Эмодзи — обычные Unicode-символы.
 */

const EMOJIS = [
  "🔥", "✅", "📦", "🚚", "💰", "⭐", "🎁", "🏷️", "📞", "📍",
  "✨", "💎", "🛒", "🔔", "⚡", "🥇", "👍", "🌿", "🍃", "🇷🇺",
  "❤️", "💯", "🎯", "📌", "🆕", "🔝", "🤝", "👀", "💬", "📲",
  "🟢", "🟡", "🔴", "⏰", "📅", "🛡️", "🧾", "📈", "🍀", "🥩",
  "🧀", "🍖", "🍷", "🥖", "🥗", "🌍", "🇪🇸", "🇮🇹", "🇫🇷", "🇩🇪",
];

function toBold(str: string): string {
  const map: Record<string, string> = {};
  // Latin
  for (let i = 0; i < 26; i++) {
    map[String.fromCharCode(65 + i)] = String.fromCodePoint(0x1d400 + i);
    map[String.fromCharCode(97 + i)] = String.fromCodePoint(0x1d41a + i);
  }
  for (let i = 0; i < 10; i++) map[String(i)] = String.fromCodePoint(0x1d7ce + i);
  // Cyrillic: жирных нет в Unicode стандартно, используем "Mathematical Bold" нет для кириллицы.
  // Применяем комбинирующий U+0331 (нижнее подчёркивание) как fallback? Нет — Авито поддерживает обычный текст.
  // Для кириллицы оставим как есть — пусть будет уникод там, где работает.
  return str.split("").map((ch) => map[ch] ?? ch).join("");
}

function toItalic(str: string): string {
  const map: Record<string, string> = {};
  for (let i = 0; i < 26; i++) {
    map[String.fromCharCode(65 + i)] = String.fromCodePoint(0x1d434 + i);
    map[String.fromCharCode(97 + i)] = String.fromCodePoint(0x1d44e + i);
  }
  return str.split("").map((ch) => map[ch] ?? ch).join("");
}

function toStrike(str: string): string {
  return str.split("").map((ch) => ch + "\u0336").join("");
}

interface Props {
  targetRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  placeholders?: { key: string; label: string }[];
  onInsertPlaceholder?: (key: string) => void;
}

export function RichTextToolbar({ targetRef, value, onChange, className, placeholders, onInsertPlaceholder }: Props) {
  const [emojiOpen, setEmojiOpen] = useState(false);

  const applyToSelection = (transform: (s: string) => string) => {
    const ta = targetRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    if (start === end) return;
    const selected = value.slice(start, end);
    const transformed = transform(selected);
    const next = value.slice(0, start) + transformed + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start + transformed.length);
    });
  };

  const insertAtCursor = (text: string) => {
    const ta = targetRef.current;
    if (!ta) {
      onChange(value + text);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-0.5 border rounded-md bg-muted/30 px-1 py-1", className)}>
      <ToolBtn title="Жирный (выделите текст)" onClick={() => applyToSelection(toBold)}>
        <Bold className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Курсив (выделите текст)" onClick={() => applyToSelection(toItalic)}>
        <Italic className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Зачёркнутый (выделите текст)" onClick={() => applyToSelection(toStrike)}>
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolBtn title="Маркер •" onClick={() => insertAtCursor("\n• ")}>
        <List className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Заголовок (ВЕРХНИЙ РЕГИСТР)" onClick={() => applyToSelection((s) => s.toUpperCase())}>
        <Heading className="h-3.5 w-3.5" />
      </ToolBtn>
      <div className="w-px h-4 bg-border mx-1" />
      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs">
            <Smile className="h-3.5 w-3.5" /> Эмодзи
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="grid grid-cols-10 gap-0.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className="hover:bg-muted rounded text-base leading-none p-1"
                onClick={() => {
                  insertAtCursor(e);
                  setEmojiOpen(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {placeholders && placeholders.length > 0 && onInsertPlaceholder && (
        <>
          <div className="w-px h-4 bg-border mx-1" />
          {placeholders.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-1.5 text-[10px] font-mono text-primary"
              title={p.label}
              onClick={() => insertAtCursor(p.key)}
            >
              {p.key}
            </Button>
          ))}
        </>
      )}
    </div>
  );
}

function ToolBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" {...props}>
      {children}
    </Button>
  );
}
