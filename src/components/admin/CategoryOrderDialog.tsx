import { useState, useEffect } from "react";
import { GripVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
}

function SortableCategoryItem({ category }: { category: Category }) {
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
      <span className="flex-1 text-sm font-medium">{category.name}</span>
    </div>
  );
}

export function CategoryOrderDialog({
  open,
  onOpenChange,
  categories,
  onSave,
}: CategoryOrderDialogProps) {
  const [orderedCategories, setOrderedCategories] = useState<Category[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Sort by sort_order, then by name
      const sorted = [...categories].sort((a, b) => {
        const orderA = a.sort_order ?? 999999;
        const orderB = b.sort_order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
      setOrderedCategories(sorted);
    }
  }, [open, categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
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
          <DialogTitle>Порядок отображения категорий</DialogTitle>
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
