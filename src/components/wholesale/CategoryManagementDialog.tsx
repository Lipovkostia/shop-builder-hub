import { useState, useEffect } from "react";
import { GripVertical, Plus, Pencil, Trash2, ChevronRight, FolderPlus, X, Check, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order?: number | null;
  product_count?: number;
}

interface CategoryManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onCreateCategory: (name: string, parentId?: string | null) => Promise<Category | null>;
  onUpdateCategory: (id: string, name: string) => Promise<boolean>;
  onDeleteCategory: (id: string) => Promise<boolean>;
  onUpdateOrder: (orderedIds: string[]) => Promise<void>;
}

function SortableCategoryItem({
  category,
  children,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddSubcategory,
  hasChildren,
  depth = 0,
}: {
  category: Category;
  children?: React.ReactNode;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSubcategory: () => void;
  hasChildren: boolean;
  depth?: number;
}) {
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
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 bg-background border rounded-lg mb-1",
          isDragging && "opacity-50 shadow-lg",
          depth > 0 && "ml-6 border-l-2 border-l-primary/30"
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        
        {hasChildren && (
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-muted rounded"
          >
            <ChevronRight className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              isExpanded && "rotate-90"
            )} />
          </button>
        )}
        
        <span className={cn("flex-1 text-sm font-medium", !hasChildren && "ml-6")}>
          {category.name}
        </span>
        
        {category.product_count !== undefined && category.product_count > 0 && (
          <Badge variant="secondary" className="text-xs">
            {category.product_count}
          </Badge>
        )}
        
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onAddSubcategory}
            title="Добавить подкатегорию"
          >
            <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onEdit}
            title="Редактировать"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onDelete}
            title="Удалить"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
      
      {isExpanded && children}
    </div>
  );
}

export function CategoryManagementDialog({
  open,
  onOpenChange,
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onUpdateOrder,
}: CategoryManagementDialogProps) {
  const [orderedCategories, setOrderedCategories] = useState<Category[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
      // Expand all parent categories by default
      const parentIds = categories
        .filter(c => categories.some(child => child.parent_id === c.id))
        .map(c => c.id);
      setExpandedIds(parentIds);
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

  // Get root categories and their children
  const rootCategories = orderedCategories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => 
    orderedCategories.filter(c => c.parent_id === parentId);

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

  const toggleExpand = (id: string) => {
    setExpandedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    
    const success = await onUpdateCategory(editingId, editingName.trim());
    if (success) {
      setOrderedCategories(prev =>
        prev.map(c => c.id === editingId ? { ...c, name: editingName.trim() } : c)
      );
      toast.success("Категория обновлена");
    } else {
      toast.error("Ошибка при обновлении категории");
    }
    cancelEdit();
  };

  const startCreate = (parentId: string | null = null) => {
    setIsCreating(true);
    setNewCategoryName("");
    setNewCategoryParentId(parentId);
    if (parentId) {
      setExpandedIds(prev => prev.includes(parentId) ? prev : [...prev, parentId]);
    }
  };

  const cancelCreate = () => {
    setIsCreating(false);
    setNewCategoryName("");
    setNewCategoryParentId(null);
  };

  const saveCreate = async () => {
    if (!newCategoryName.trim()) return;
    
    const newCategory = await onCreateCategory(newCategoryName.trim(), newCategoryParentId);
    if (newCategory) {
      toast.success("Категория создана");
    } else {
      toast.error("Ошибка при создании категории");
    }
    cancelCreate();
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    
    const success = await onDeleteCategory(deleteConfirmId);
    if (success) {
      setOrderedCategories(prev => prev.filter(c => c.id !== deleteConfirmId));
      toast.success("Категория удалена");
    } else {
      toast.error("Ошибка при удалении категории");
    }
    setDeleteConfirmId(null);
  };

  const handleSaveOrder = async () => {
    setIsSaving(true);
    try {
      await onUpdateOrder(orderedCategories.map(c => c.id));
      toast.success("Порядок сохранён");
      onOpenChange(false);
    } catch (error) {
      toast.error("Ошибка при сохранении порядка");
    } finally {
      setIsSaving(false);
    }
  };

  const renderCategory = (category: Category, depth = 0) => {
    const children = getChildren(category.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.includes(category.id);

    if (editingId === category.id) {
      return (
        <div key={category.id} className={cn("flex items-center gap-2 px-3 py-2.5 bg-muted border rounded-lg mb-1", depth > 0 && "ml-6")}>
          <Input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className="flex-1 h-8"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
          />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}>
            <Check className="h-4 w-4 text-primary" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <SortableCategoryItem
        key={category.id}
        category={category}
        isExpanded={isExpanded}
        onToggleExpand={() => toggleExpand(category.id)}
        onEdit={() => startEdit(category)}
        onDelete={() => setDeleteConfirmId(category.id)}
        onAddSubcategory={() => startCreate(category.id)}
        hasChildren={hasChildren}
        depth={depth}
      >
        {hasChildren && isExpanded && (
          <div className="mt-1">
            {children.map(child => renderCategory(child, depth + 1))}
            {isCreating && newCategoryParentId === category.id && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-muted border rounded-lg mb-1 ml-6">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Название подкатегории..."
                  className="flex-1 h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCreate();
                    if (e.key === "Escape") cancelCreate();
                  }}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveCreate}>
                  <Check className="h-4 w-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelCreate}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
        {!hasChildren && isCreating && newCategoryParentId === category.id && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-muted border rounded-lg mb-1 ml-6 mt-1">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Название подкатегории..."
              className="flex-1 h-8"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCreate();
                if (e.key === "Escape") cancelCreate();
              }}
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveCreate}>
              <Check className="h-4 w-4 text-primary" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelCreate}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SortableCategoryItem>
    );
  };

  const categoryToDelete = deleteConfirmId 
    ? categories.find(c => c.id === deleteConfirmId) 
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Управление категориями
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Add new root category button */}
            <div className="mb-4">
              {isCreating && newCategoryParentId === null ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-muted border rounded-lg">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Название категории..."
                    className="flex-1 h-8"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCreate();
                      if (e.key === "Escape") cancelCreate();
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveCreate}>
                    <Check className="h-4 w-4 text-primary" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelCreate}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => startCreate(null)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить категорию
                </Button>
              )}
            </div>

            {/* Categories list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {rootCategories.length === 0 && !isCreating ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Нет категорий
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={orderedCategories.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1 pr-2">
                      {rootCategories.map(category => renderCategory(category))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveOrder} disabled={isSaving}>
              {isSaving ? "Сохранение..." : "Сохранить порядок"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить категорию?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить категорию "{categoryToDelete?.name}"?
              {getChildren(deleteConfirmId || "").length > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ Эта категория содержит подкатегории, которые также будут удалены.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
