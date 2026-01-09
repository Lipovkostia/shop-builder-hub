import { useState, useRef, useEffect } from "react";
import { Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectOption {
  value: string;
  label: string;
}

interface InlineSelectCellProps {
  value: string;
  options: SelectOption[];
  onSave: (newValue: string) => void;
  onAddOption?: (newOption: string) => void;
  allowAddNew?: boolean;
  addNewPlaceholder?: string;
  className?: string;
}

export function InlineSelectCell({
  value,
  options,
  onSave,
  onAddOption,
  allowAddNew = true,
  addNewPlaceholder = "Новое значение...",
  className = "",
}: InlineSelectCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAddingNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingNew]);

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === "__add_new__") {
      setIsAddingNew(true);
      setIsOpen(false);
    } else {
      if (selectedValue !== value) {
        onSave(selectedValue);
      }
      setIsOpen(false);
    }
  };

  const handleAddNew = () => {
    const trimmed = newOptionValue.trim();
    if (trimmed) {
      onAddOption?.(trimmed);
      onSave(trimmed);
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

  const handleBlur = () => {
    // Auto-save on blur if there's a value
    const trimmed = newOptionValue.trim();
    if (trimmed) {
      handleAddNew();
    } else {
      handleCancelAdd();
    }
  };

  const displayLabel = options.find(o => o.value === value)?.label || value;

  if (isAddingNew) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={newOptionValue}
          onChange={(e) => setNewOptionValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="h-6 min-w-[70px] text-xs px-1.5"
          placeholder={addNewPlaceholder}
        />
      </div>
    );
  }

  return (
    <Select 
      value={value} 
      onValueChange={handleSelect} 
      open={isOpen} 
      onOpenChange={setIsOpen}
    >
      <SelectTrigger 
        className="h-6 text-xs min-w-[70px] px-1.5 border-dashed"
      >
        <SelectValue placeholder={displayLabel} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
        {allowAddNew && (
          <SelectItem value="__add_new__" className="text-xs text-primary">
            <div className="flex items-center gap-1">
              <Plus className="h-2.5 w-2.5" />
              Добавить
            </div>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
