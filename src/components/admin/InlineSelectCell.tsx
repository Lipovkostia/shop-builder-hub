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
  const [isEditing, setIsEditing] = useState(false);
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
    } else {
      if (selectedValue !== value) {
        onSave(selectedValue);
      }
      setIsEditing(false);
    }
  };

  const handleAddNew = () => {
    const trimmed = newOptionValue.trim();
    if (trimmed) {
      onAddOption?.(trimmed);
      onSave(trimmed);
      setNewOptionValue("");
      setIsAddingNew(false);
      setIsEditing(false);
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

  const displayLabel = options.find(o => o.value === value)?.label || value;

  if (isAddingNew) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={newOptionValue}
          onChange={(e) => setNewOptionValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 min-w-[100px] text-xs"
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
    );
  }

  if (isEditing) {
    return (
      <Select value={value} onValueChange={handleSelect}>
        <SelectTrigger 
          className="h-7 text-xs min-w-[100px]"
          onBlur={() => setTimeout(() => setIsEditing(false), 200)}
          autoFocus
        >
          <SelectValue />
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
                <Plus className="h-3 w-3" />
                Добавить
              </div>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={`text-xs cursor-pointer hover:bg-muted transition-colors ${className}`}
      onClick={() => setIsEditing(true)}
      title="Нажмите для изменения"
    >
      {displayLabel}
    </Badge>
  );
}
