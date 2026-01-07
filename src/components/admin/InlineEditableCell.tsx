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
      title={value || placeholder}
    >
      <span className={`truncate text-xs ${value ? "" : "text-muted-foreground italic"}`}>
        {value || placeholder}
      </span>
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </div>
  );
}
