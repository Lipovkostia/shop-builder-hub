import { useState, useRef, useEffect } from "react";
import { Check, X, Plus, ChevronDown, Tag } from "lucide-react";
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
}

interface InlineMultiSelectCellProps {
  values: string[];
  options: SelectOption[];
  onSave: (newValues: string[]) => void;
  onAddOption?: (newOption: string) => void;
  allowAddNew?: boolean;
  addNewPlaceholder?: string;
  className?: string;
  placeholder?: string;
}

export function InlineMultiSelectCell({
  values,
  options,
  onSave,
  onAddOption,
  allowAddNew = true,
  addNewPlaceholder = "Новая категория...",
  className = "",
  placeholder = "Без категории",
}: InlineMultiSelectCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAddingNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleToggle = (optionValue: string) => {
    const newValues = values.includes(optionValue)
      ? values.filter(v => v !== optionValue)
      : [...values, optionValue];
    onSave(newValues);
  };

  const handleAddNew = () => {
    const trimmed = newOptionValue.trim();
    if (trimmed) {
      onAddOption?.(trimmed);
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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1 h-6 px-1.5 text-xs border border-dashed rounded-md min-w-[70px] max-w-[200px] hover:bg-muted/50 transition-colors ${
            values.length > 0 
              ? "bg-primary/5 border-primary/30 text-foreground" 
              : "border-border text-muted-foreground"
          } ${className}`}
        >
          <Tag className="h-2.5 w-2.5 flex-shrink-0" />
          {values.length > 0 ? (
            <span className="truncate">
              {selectedLabels.length <= 2 
                ? selectedLabels.join(", ") 
                : `${selectedLabels.length} категорий`}
            </span>
          ) : (
            <span>{placeholder}</span>
          )}
          <ChevronDown className="h-2.5 w-2.5 ml-auto flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 pointer-events-auto" align="start">
        <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
          {options.length > 0 ? (
            options.map((option) => {
              const isSelected = values.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(option.value)}
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground px-2 py-1">Нет категорий</p>
          )}
        </div>
        
        {allowAddNew && (
          <div className="border-t mt-2 pt-2">
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
                Добавить категорию
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
