import { useState, useRef, useEffect } from "react";
import { Check, X, Plus, ChevronDown, Folder, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CategoryOption {
  value: string;
  label: string;
  sort_order?: number | null;
  parent_id?: string | null;
}

interface InlinePrimaryCategoryCellProps {
  value: string | null;
  options: CategoryOption[];
  onSave: (newValue: string | null) => void;
  onAddOption?: (newOption: string) => void | string | null | Promise<string | null | void>;
  allowAddNew?: boolean;
  addNewPlaceholder?: string;
  addNewButtonLabel?: string;
  className?: string;
  placeholder?: string;
  emptyStateMessage?: string;
}

export function InlinePrimaryCategoryCell({
  value,
  options,
  onSave,
  onAddOption,
  allowAddNew = true,
  addNewPlaceholder = "Новая категория...",
  addNewButtonLabel = "Создать категорию",
  className = "",
  placeholder = "Категория...",
  emptyStateMessage = "Нет категорий",
}: InlinePrimaryCategoryCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter to show only root categories (parent_id is null)
  const rootCategories = options.filter(opt => !opt.parent_id);

  useEffect(() => {
    if (isAddingNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleSelect = (optionValue: string | null) => {
    onSave(optionValue);
    setIsOpen(false);
  };

  const handleAddNew = async () => {
    const trimmed = newOptionValue.trim();
    if (trimmed && onAddOption) {
      const result = await onAddOption(trimmed);
      // If the callback returns a new ID, automatically select it
      if (typeof result === 'string') {
        onSave(result);
        setIsOpen(false);
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

  const selectedLabel = value 
    ? rootCategories.find(o => o.value === value)?.label 
    : null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1 h-6 px-1.5 text-xs border border-dashed rounded-md min-w-[80px] max-w-[150px] hover:bg-muted/50 transition-colors ${
            value 
              ? "bg-primary/5 border-primary/30 text-foreground" 
              : "border-border text-muted-foreground"
          } ${className}`}
        >
          {value ? (
            <FolderOpen className="h-2.5 w-2.5 flex-shrink-0" />
          ) : (
            <Folder className="h-2.5 w-2.5 flex-shrink-0" />
          )}
          <span className="truncate">
            {selectedLabel || placeholder}
          </span>
          <ChevronDown className="h-2.5 w-2.5 ml-auto flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 pointer-events-auto" align="start">
        <div
          className="flex flex-col gap-1 max-h-[240px] overflow-y-auto overscroll-contain"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {/* Clear selection option */}
          <div
            onClick={() => handleSelect(null)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm cursor-pointer ${
              !value ? "bg-muted" : ""
            }`}
          >
            <span className="text-muted-foreground">— Без категории</span>
          </div>
          
          {rootCategories.length > 0 ? (
            rootCategories
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((option) => {
                const isSelected = value === option.value;
                return (
                  <div
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm cursor-pointer ${
                      isSelected ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check className="h-3 w-3 ml-auto flex-shrink-0" />}
                  </div>
                );
              })
          ) : (
            <div className="px-2 py-1">
              <p className="text-xs text-muted-foreground">{emptyStateMessage}</p>
            </div>
          )}
        </div>
        
        {allowAddNew && !!onAddOption && (
          <div className="border-t mt-2 pt-2 flex flex-col gap-1">
            {isAddingNew ? (
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
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
