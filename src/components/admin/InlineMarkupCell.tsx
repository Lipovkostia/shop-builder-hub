import { useState, useRef, useEffect } from "react";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MarkupSettings } from "@/components/admin/types";

interface InlineMarkupCellProps {
  value: MarkupSettings | undefined;
  onSave: (newValue: MarkupSettings | undefined) => void;
  className?: string;
}

export function InlineMarkupCell({
  value,
  onSave,
  className = "",
}: InlineMarkupCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedType, setEditedType] = useState<"percent" | "rubles">(value?.type || "percent");
  const [editedValue, setEditedValue] = useState(value?.value?.toString() || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedType(value?.type || "percent");
    setEditedValue(value?.value?.toString() || "");
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
      onSave({ type: editedType, value: numValue });
    } else if (editedValue === "" || numValue === 0) {
      onSave(undefined);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedType(value?.type || "percent");
    setEditedValue(value?.value?.toString() || "");
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
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className={editedType === "percent" ? "text-foreground font-medium" : ""}>%</span>
          <Switch
            checked={editedType === "rubles"}
            onCheckedChange={(checked) => setEditedType(checked ? "rubles" : "percent")}
            className="h-4 w-7 data-[state=checked]:bg-primary data-[state=unchecked]:bg-primary"
          />
          <span className={editedType === "rubles" ? "text-foreground font-medium" : ""}>₽</span>
        </div>
        <Input
          ref={inputRef}
          type="number"
          value={editedValue}
          onChange={(e) => setEditedValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-6 w-14 text-xs px-1.5"
          placeholder="0"
          min="0"
          step="0.01"
        />
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-5 w-5 text-green-600 flex-shrink-0" 
          onClick={handleSave}
        >
          <Check className="h-2.5 w-2.5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-5 w-5 text-destructive flex-shrink-0" 
          onClick={(e) => {
            e.stopPropagation();
            handleCancel();
          }}
        >
          <X className="h-2.5 w-2.5" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={`group flex items-center gap-0.5 cursor-pointer hover:text-primary transition-colors ${className}`}
      onClick={() => setIsEditing(true)}
      title="Нажмите для редактирования"
    >
      {value && value.value > 0 ? (
        <span className="text-xs text-green-600 dark:text-green-400 whitespace-nowrap">
          +{value.value}{value.type === "percent" ? "%" : "₽"}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground italic">-</span>
      )}
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
    </div>
  );
}
