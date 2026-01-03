import { useState, useRef, useEffect } from "react";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InlinePriceCellProps {
  value: number | undefined;
  onSave: (newValue: number | undefined) => void;
  placeholder?: string;
  suffix?: string;
  className?: string;
}

export function InlinePriceCell({
  value,
  onSave,
  placeholder = "0",
  suffix = "₽",
  className = "",
}: InlinePriceCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState(value?.toString() || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedValue(value?.toString() || "");
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const numValue = parseFloat(editedValue);
    if (!isNaN(numValue) && numValue >= 0) {
      if (numValue !== value) {
        onSave(numValue);
      }
    } else if (editedValue === "") {
      onSave(undefined);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedValue(value?.toString() || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(Math.round(price));
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="number"
          value={editedValue}
          onChange={(e) => setEditedValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-7 w-24 text-xs"
          placeholder={placeholder}
          min="0"
          step="0.01"
        />
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-green-600 flex-shrink-0" 
          onClick={handleSave}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-destructive flex-shrink-0" 
          onClick={handleCancel}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={`group flex items-center gap-1 cursor-pointer hover:text-primary transition-colors ${className}`}
      onClick={() => setIsEditing(true)}
      title="Нажмите для редактирования"
    >
      <span className={value ? "text-muted-foreground text-sm" : "text-muted-foreground italic text-sm"}>
        {value ? `${formatPrice(value)} ${suffix}` : "-"}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </div>
  );
}
