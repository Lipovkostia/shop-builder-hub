import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AVITO_CATEGORY_PATHS } from "@/lib/avitoCategories";

interface AvitoCategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean; // tighter look for table cells
}

/**
 * Searchable Avito category picker.
 * Shows hierarchical paths like "Готовый бизнес---IT бизнес---Майнинг".
 * Allows free text fallback for categories not in the curated list.
 */
export function AvitoCategoryCombobox({
  value,
  onChange,
  placeholder = "Начните вводить категорию...",
  className,
  compact = false,
}: AvitoCategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return AVITO_CATEGORY_PATHS.slice(0, 200);
    const terms = q.split(/\s+/);
    return AVITO_CATEGORY_PATHS.filter((c) => {
      const lower = c.path.toLowerCase();
      return terms.every((t) => lower.includes(t));
    }).slice(0, 200);
  }, [query]);

  const displayValue = value || "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            compact ? "h-6 px-1.5 text-xs border-dashed" : "h-8 px-2 text-xs",
            !value && "text-muted-foreground",
            className
          )}
          title={displayValue || placeholder}
        >
          <span className="truncate text-left">{displayValue || placeholder}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[480px] max-w-[90vw]"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-1 border-b px-2 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: мясо, сыр, IT бизнес..."
            className="h-7 border-0 px-1 text-xs focus-visible:ring-0 shadow-none"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {query.trim() && (
            <button
              type="button"
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-accent border-b flex items-center gap-2"
              onClick={() => {
                onChange(query.trim());
                setOpen(false);
                setQuery("");
              }}
            >
              <Check className={cn("h-3 w-3", value === query.trim() ? "opacity-100" : "opacity-0")} />
              <span className="text-muted-foreground">Использовать как есть:</span>
              <span className="font-medium truncate">{query.trim()}</span>
            </button>
          )}
          {filtered.length === 0 && !query.trim() && (
            <div className="p-3 text-xs text-muted-foreground text-center">Нет совпадений</div>
          )}
          {filtered.map((c) => {
            const selected = value === c.path || value === c.subType || value === c.goodsType;
            return (
              <button
                key={c.path}
                type="button"
                className={cn(
                  "w-full text-left px-2 py-1.5 text-xs hover:bg-accent flex items-start gap-2",
                  selected && "bg-accent/60"
                )}
                onClick={() => {
                  onChange(c.path);
                  setOpen(false);
                  setQuery("");
                }}
                title={c.path}
              >
                <Check className={cn("h-3 w-3 mt-0.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{c.path}</span>
              </button>
            );
          })}
        </div>
        <div className="border-t px-2 py-1 text-[10px] text-muted-foreground bg-muted/30">
          {filtered.length} из {AVITO_CATEGORY_PATHS.length} • можно ввести свою категорию
        </div>
      </PopoverContent>
    </Popover>
  );
}
