import { useState, useRef, useEffect } from "react";
import { Check, X, Plus, ChevronDown, Tag, ExternalLink, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SelectOption {
  value: string;
  label: string;
  sort_order?: number | null;
}

interface InlineMultiSelectCellProps {
  values: string[];
  options: SelectOption[];
  onSave: (newValues: string[]) => void;
  onAddOption?: (newOption: string) => void | string | null | Promise<string | null | void>;
  onNavigate?: (optionValue: string) => void;
  onReorder?: () => void;
  allowAddNew?: boolean;
  addNewPlaceholder?: string;
  addNewButtonLabel?: string;
  className?: string;
  placeholder?: string;
  emptyStateMessage?: string;
  showOnboardingHint?: boolean;
  onboardingHintText?: string;
  showNavigateOnboardingHint?: boolean;
  showReorderButton?: boolean;
}

export function InlineMultiSelectCell({
  values,
  options,
  onSave,
  onAddOption,
  onNavigate,
  onReorder,
  allowAddNew = true,
  addNewPlaceholder = "Новая группа...",
  addNewButtonLabel = "Добавить группу",
  className = "",
  placeholder = "Без группы",
  emptyStateMessage = "Нет групп",
  showOnboardingHint = false,
  onboardingHintText,
  showNavigateOnboardingHint = false,
  showReorderButton = false,
}: InlineMultiSelectCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState("");
  const [draftValues, setDraftValues] = useState<string[]>(values);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep internal draft in sync with внешним значением
  useEffect(() => {
    if (!isOpen) setDraftValues(values);
  }, [values, isOpen]);

  useEffect(() => {
    if (isAddingNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleToggle = (optionValue: string) => {
    setDraftValues((prev) => {
      const next = prev.includes(optionValue)
        ? prev.filter((v) => v !== optionValue)
        : [...prev, optionValue];
      onSave(next);
      return next;
    });
  };

  const handleAddNew = async () => {
    const trimmed = newOptionValue.trim();
    if (trimmed && onAddOption) {
      const result = await onAddOption(trimmed);
      // If the callback returns a new ID, automatically select it and add to current values
      if (typeof result === 'string') {
        const nextValues = [...draftValues, result];
        setDraftValues(nextValues);
        // Call onSave to persist the change (adds product to new catalog)
        onSave(nextValues);
      }
      setNewOptionValue("");
      setIsAddingNew(false);
    }
  };

  const handleCancelAdd = () => {
    setNewOptionValue("");
    setIsAddingNew(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddNew();
    } else if (e.key === "Escape") {
      handleCancelAdd();
    }
  };

  const selectedLabels = values
    .map(v => options.find(o => o.value === v)?.label)
    .filter(Boolean);

  // Show onboarding highlight effect
  const shouldHighlight = showOnboardingHint && options.length === 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1 h-6 px-1.5 text-xs border border-dashed rounded-md min-w-[70px] max-w-[200px] hover:bg-muted/50 transition-colors ${
            values.length > 0 
              ? "bg-primary/5 border-primary/30 text-foreground" 
              : shouldHighlight
                ? "border-primary bg-primary/10 text-primary animate-pulse"
                : "border-border text-muted-foreground"
          } ${className}`}
        >
          <Tag className="h-2.5 w-2.5 flex-shrink-0" />
          {values.length > 0 ? (
            <span className="truncate">
              {selectedLabels.length <= 2 
                ? selectedLabels.join(", ") 
                : `${selectedLabels.length} групп`}
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronDown className="h-2.5 w-2.5 ml-auto flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 pointer-events-auto" align="start">
        <div
          className="flex flex-col gap-1 max-h-[240px] overflow-y-auto overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {options.length > 0 ? (
            options.map((option) => {
              const isSelected = draftValues.includes(option.value);
              return (
                <div
                  key={option.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm group"
                >
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggle(option.value);
                    }}
                    className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none flex-shrink-0"
                    />
                    <span className="truncate">{option.label}</span>
                  </div>
                  {onNavigate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-5 w-5 flex-shrink-0 ${
                        showNavigateOnboardingHint 
                          ? "text-primary bg-primary/10 ring-2 ring-primary/50 ring-offset-1 animate-pulse" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Открыть прайс-лист"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onNavigate(option.value);
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="px-2 py-1">
              <p className="text-xs text-muted-foreground">{emptyStateMessage}</p>
              {showOnboardingHint && onboardingHintText && (
                <p className="text-xs text-primary mt-1 font-medium">{onboardingHintText}</p>
              )}
            </div>
          )}
        </div>
        
        {(allowAddNew && !!onAddOption) || (showReorderButton && onReorder && options.length > 1) ? (
          <div className="border-t mt-2 pt-2 flex flex-col gap-1">
            {showReorderButton && onReorder && options.length > 1 && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onReorder();
                }}
                className="flex items-center gap-1 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded"
              >
                <ArrowUpDown className="h-3 w-3" />
                Порядок отображения
              </button>
            )}
            {allowAddNew && !!onAddOption && (
              isAddingNew ? (
                <div className="flex items-center gap-1">
                  <Input
                    ref={inputRef}
                    value={newOptionValue}
                    onChange={(e) => setNewOptionValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-7 text-xs"
                    placeholder={addNewPlaceholder}
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-green-600 flex-shrink-0" 
                    onClick={handleAddNew}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-destructive flex-shrink-0" 
                    onClick={handleCancelAdd}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingNew(true)}
                  className="flex items-center gap-1 w-full px-2 py-1.5 text-xs text-primary hover:bg-muted rounded"
                >
                  <Plus className="h-3 w-3" />
                  {addNewButtonLabel}
                </button>
              )
            )}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
