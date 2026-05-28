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

// Maps for bold/italic transformations (Latin + digits)

const BOLD_MAP: Record<string, string> = {};
const ITALIC_MAP: Record<string, string> = {};
for (let i = 0; i < 26; i++) {
  BOLD_MAP[String.fromCharCode(65 + i)] = String.fromCodePoint(0x1d400 + i);
  BOLD_MAP[String.fromCharCode(97 + i)] = String.fromCodePoint(0x1d41a + i);
  ITALIC_MAP[String.fromCharCode(65 + i)] = String.fromCodePoint(0x1d434 + i);
  ITALIC_MAP[String.fromCharCode(97 + i)] = String.fromCodePoint(0x1d44e + i);
}
for (let i = 0; i < 10; i++) BOLD_MAP[String(i)] = String.fromCodePoint(0x1d7ce + i);

const BOLD_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(BOLD_MAP).map(([k, v]) => [v, k]),
);
const ITALIC_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(ITALIC_MAP).map(([k, v]) => [v, k]),
);

// Split string into graphemes (code points), so surrogate pairs (𝐁) stay together
function toCodePoints(str: string): string[] {
  return Array.from(str);
}

function hasBold(str: string): boolean {
  return toCodePoints(str).some((ch) => BOLD_REVERSE[ch]);
}
function hasItalic(str: string): boolean {
  return toCodePoints(str).some((ch) => ITALIC_REVERSE[ch]);
}
function hasStrike(str: string): boolean {
  return str.includes("\u0336");
}

function stripBold(str: string): string {
  return toCodePoints(str).map((ch) => BOLD_REVERSE[ch] ?? ch).join("");
}
function stripItalic(str: string): string {
  return toCodePoints(str).map((ch) => ITALIC_REVERSE[ch] ?? ch).join("");
}
function stripStrike(str: string): string {
  return str.replace(/\u0336/g, "");
}

function toBold(str: string): string {
  return toCodePoints(str).map((ch) => BOLD_MAP[ch] ?? ch).join("");
}
function toItalic(str: string): string {
  return toCodePoints(str).map((ch) => ITALIC_MAP[ch] ?? ch).join("");
}
function toStrike(str: string): string {
  // strip existing strike chars first so we don't double them
  return stripStrike(str).split("").map((ch) => ch + "\u0336").join("");
}

function toggleBold(str: string): string {
  return hasBold(str) ? stripBold(str) : toBold(stripItalic(str));
}
function toggleItalic(str: string): string {
  return hasItalic(str) ? stripItalic(str) : toItalic(stripBold(str));
}
function toggleStrike(str: string): string {
  return hasStrike(str) ? stripStrike(str) : toStrike(str);
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
      <ToolBtn title="Жирный (вкл/выкл для выделения)" onClick={() => applyToSelection(toggleBold)}>
        <Bold className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Курсив (вкл/выкл для выделения)" onClick={() => applyToSelection(toggleItalic)}>
        <Italic className="h-3.5 w-3.5" />
      </ToolBtn>
      <ToolBtn title="Зачёркнутый (вкл/выкл для выделения)" onClick={() => applyToSelection(toggleStrike)}>
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
