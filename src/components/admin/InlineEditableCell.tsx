import { useState, useRef, useEffect } from "react";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InlineEditableCellProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  className?: string;
}

export function InlineEditableCell({
  value,
  onSave,
  placeholder = "Введите текст...",
  className = "",
}: InlineEditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editedValue.trim() !== value) {
      onSave(editedValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedValue(value);
    setIsEditing(false);
  };

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
          className="h-8 min-w-[150px]"
          placeholder={placeholder}
        />
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 text-green-600 flex-shrink-0" 
          onClick={handleSave}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 text-destructive flex-shrink-0" 
          onClick={handleCancel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={`group flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors ${className}`}
      onClick={() => setIsEditing(true)}
      title="Нажмите для редактирования"
    >
      <span className={value ? "" : "text-muted-foreground italic"}>
        {value || placeholder}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </div>
  );
}
