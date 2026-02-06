import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Category {
  id: string;
  name: string;
  sort_order: number | null;
}

interface CategoryOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onSave: (orderedIds: string[]) => Promise<void>;
  onRename?: (id: string, newName: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  catalogId?: string | null;
  catalogName?: string;
}

function SortableCategoryItem({
  category,
  onRename,
  onDelete,
}: {
  category: Category;
  onRename?: (id: string, newName: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleStartEdit = () => {
    setEditName(category.name);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSaveRename = async () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== category.name && onRename) {
      await onRename(category.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveRename();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditName(category.name);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(category.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 bg-background border rounded-lg ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {isEditing ? (
        <Input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSaveRename}
          onKeyDown={handleKeyDown}
          className="flex-1 h-8 text-sm"
        />
      ) : (
        <span className="flex-1 text-sm font-medium">{category.name}</span>
      )}

      {!isEditing && onRename && (
        <button
          onClick={handleStartEdit}
          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      {onDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
              <AlertDialogDescription>
                Категория «{category.name}» будет удалена. Товары останутся без категории.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

export function CategoryOrderDialog({
  open,
  onOpenChange,
  categories,
  onSave,
  onRename,
  onDelete,
  catalogId,
  catalogName,
}: CategoryOrderDialogProps) {
  const [orderedCategories, setOrderedCategories] = useState<Category[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (catalogId) {
      supabase
        .from('catalog_category_settings')
        .select('category_id, sort_order')
        .eq('catalog_id', catalogId)
        .then(({ data }) => {
          const orderMap = new Map(data?.map(d => [d.category_id, d.sort_order ?? 999999]) || []);
          const sorted = [...categories].sort((a, b) => {
            const orderA = orderMap.get(a.id) ?? a.sort_order ?? 999999;
            const orderB = orderMap.get(b.id) ?? b.sort_order ?? 999999;
            return orderA - orderB || a.name.localeCompare(b.name);
          });
          setOrderedCategories(sorted);
        });
    } else {
      const sorted = [...categories].sort((a, b) => {
        const orderA = a.sort_order ?? 999999;
        const orderB = b.sort_order ?? 999999;
        return orderA - orderB || a.name.localeCompare(b.name);
      });
      setOrderedCategories(sorted);
    }
  }, [open, categories, catalogId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedCategories((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRename = onRename
    ? async (id: string, newName: string) => {
        await onRename(id, newName);
        setOrderedCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, name: newName } : c))
        );
      }
    : undefined;

  const handleDelete = onDelete
    ? async (id: string) => {
        await onDelete(id);
        setOrderedCategories((prev) => prev.filter((c) => c.id !== id));
      }
    : undefined;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(orderedCategories.map((c) => c.id));
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {catalogId && catalogName
              ? `Порядок категорий: ${catalogName}`
              : "Порядок отображения категорий"}
          </DialogTitle>
          {catalogId && (
            <p className="text-sm text-muted-foreground">
              Этот порядок будет применён на витрине, подключённой к данному прайс-листу
            </p>
          )}
        </DialogHeader>
        <div className="py-4">
          {orderedCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Нет категорий для сортировки
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedCategories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                  {orderedCategories.map((category) => (
                    <SortableCategoryItem
                      key={category.id}
                      category={category}
                      onRename={handleRename}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
