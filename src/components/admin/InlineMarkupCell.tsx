import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MarkupSettings } from "@/components/admin/types";
import { cn } from "@/lib/utils";

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
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isEditing) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, editedValue, editedType]);

  const handleSave = () => {
    const numValue = parseFloat(editedValue);
    if (!isNaN(numValue) && numValue > 0) {
      onSave({ type: editedType, value: numValue });
    } else {
      onSave(undefined);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditedType(value?.type || "percent");
      setEditedValue(value?.value?.toString() || "");
      setIsEditing(false);
    }
  };

  const toggleType = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedType(prev => prev === "percent" ? "rubles" : "percent");
  };

  if (isEditing) {
    return (
      <div ref={containerRef} className="flex items-center min-w-[100px]">
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            type="number"
            value={editedValue}
            onChange={(e) => setEditedValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-7 w-14 text-xs px-2 rounded-md border-primary/50 focus-visible:ring-1 focus-visible:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="0"
            min="0"
            step="0.01"
          />
          <button
            type="button"
            onClick={toggleType}
            className={cn(
              "h-7 w-7 rounded text-xs font-semibold transition-all flex-shrink-0",
              "flex items-center justify-center",
              "hover:scale-105 active:scale-95",
              editedType === "percent" 
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30" 
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30"
            )}
            title={editedType === "percent" ? "Проценты → Рубли" : "Рубли → Проценты"}
          >
            {editedType === "percent" ? "%" : "₽"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "group flex items-center gap-1 cursor-pointer transition-all",
        "hover:opacity-80",
        className
      )}
      onClick={() => setIsEditing(true)}
      title="Нажмите для редактирования"
    >
      {value && value.value > 0 ? (
        <span className={cn(
          "text-xs font-medium px-1.5 py-0.5 rounded",
          value.type === "percent" 
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" 
            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        )}>
          +{value.value}{value.type === "percent" ? "%" : "₽"}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground/50 italic">—</span>
      )}
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
    </div>
  );
}
