import { useState, useRef, useEffect, useCallback } from "react";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InlineEditableCellProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export function InlineEditableCell({
  value,
  onSave,
  placeholder = "Введите текст...",
  className = "",
  debounceMs = 500,
}: InlineEditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(value);
  const [displayValue, setDisplayValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setEditedValue(value);
    setDisplayValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSave = useCallback(() => {
    const trimmedValue = editedValue.trim();
    if (trimmedValue !== value) {
      setDisplayValue(trimmedValue); // Optimistic update
      setIsSaving(true);
      
      // Debounce the actual save
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      debounceRef.current = setTimeout(() => {
        onSave(trimmedValue);
        setIsSaving(false);
      }, debounceMs);
    }
    setIsEditing(false);
  }, [editedValue, value, onSave, debounceMs]);

  const handleCancel = useCallback(() => {
    setEditedValue(value);
    setIsEditing(false);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={editedValue}
          onChange={(e) => setEditedValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-6 min-w-[100px] text-xs px-1.5"
          placeholder={placeholder}
        />
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-5 w-5 text-green-600 flex-shrink-0" 
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleSave}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-5 w-5 text-destructive flex-shrink-0" 
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleCancel}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={`group flex items-center gap-1 cursor-pointer hover:text-primary transition-colors truncate ${className}`}
      onClick={() => setIsEditing(true)}
      title={displayValue || placeholder}
    >
      <span className={`truncate text-xs ${displayValue ? "" : "text-muted-foreground italic"}`}>
        {displayValue || placeholder}
      </span>
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </div>
  );
}
